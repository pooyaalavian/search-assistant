import copy
import json
import os
import logging
import uuid
import httpx
import asyncio
from quart import (
    Blueprint,
    Quart,
    jsonify,
    make_response,
    request,
    send_from_directory,
    render_template,
    current_app,
)
from quart_cors import cors

from openai import AsyncAzureOpenAI
from openai.types.chat import ChatCompletion
from azure.identity.aio import DefaultAzureCredential, get_bearer_token_provider
from src.cosmos_client import CosmosConversationClient
from src.ai_search import AISearchClient

bp = Blueprint("routes", __name__, static_folder="static", template_folder="static")

cosmos_db_ready = asyncio.Event()


def create_app():
    app = Quart(__name__)
    app = cors(app, allow_origin="*")
    app.register_blueprint(bp)
    app.config["TEMPLATES_AUTO_RELOAD"] = True

    @app.before_serving
    async def init():
        try:
            app.cosmos_conversation_client = await init_cosmosdb_conversation_client()
            cosmos_db_ready.set()
        except Exception as e:
            logging.exception("Failed to initialize CosmosDB client")
            app.cosmos_conversation_client = None
            raise e

        app.search_client = await init_search_client()
        app.openai_client = await init_openai_client()

    return app


# Debug settings
DEBUG = os.environ.get("DEBUG", "false")
if DEBUG.lower() == "true":
    logging.basicConfig(level=logging.DEBUG)


# Frontend Settings via Environment Variables
frontend_settings = {"auth_enabled": True}


# Initialize Azure OpenAI Client
async def init_openai_client() -> AsyncAzureOpenAI:
    azure_openai_client = None

    try:
        endpoint = f"https://{os.getenv('AZURE_OPENAI_ACCOUNT')}.openai.azure.com/"

        # Authentication
        aoai_api_key = os.getenv("AZURE_OPENAI_KEY")
        ad_token_provider = None
        if not aoai_api_key:
            logging.debug("No AZURE_OPENAI_KEY found, using Azure Entra ID auth")
            async with DefaultAzureCredential() as credential:
                ad_token_provider = get_bearer_token_provider(
                    credential, "https://cognitiveservices.azure.com/.default"
                )

        # Deployment
        deployment = os.getenv("AZURE_OPENAI_MODEL")
        if not deployment:
            raise ValueError("AZURE_OPENAI_MODEL is required")

        aoai_api_version = os.getenv("AZURE_OPENAI_API_VERSION")
        if not aoai_api_version:
            raise ValueError("AZURE_OPENAI_API_VERSION is required")

        # Default Headers
        default_headers = {"x-ms-useragent": "paccar/assistant/1.0.0"}

        azure_openai_client = AsyncAzureOpenAI(
            api_version=aoai_api_version,
            api_key=aoai_api_key,
            azure_ad_token_provider=ad_token_provider,
            default_headers=default_headers,
            azure_endpoint=endpoint,
        )

        return azure_openai_client
    except Exception as e:
        logging.exception("Exception in Azure OpenAI initialization", e)
        azure_openai_client = None
        raise e


async def init_cosmosdb_conversation_client():
    cosmos_conversation_client = None
    try:
        cosmos_service = os.getenv("AZURE_COSMOS_SERVICE")
        if not cosmos_service:
            raise ValueError("AZURE_COSMOS_SERVICE is required")

        cosmos_key = os.getenv("AZURE_COSMOS_KEY")

        cosmos_endpoint = f"https://{cosmos_service}.documents.azure.com:443/"

        if not cosmos_key:
            async with DefaultAzureCredential() as cred:
                credential = cred
        else:
            credential = cosmos_key

        cosmos_db_name = os.getenv("AZURE_COSMOS_DB_NAME")
        if not cosmos_db_name:
            raise ValueError("AZURE_COSMOS_DB_NAME is required")

        cosmos_conversation_container_name = os.getenv(
            "AZURE_COSMOS_CONVERSATION_CONTAINER"
        )
        if not cosmos_conversation_container_name:
            raise ValueError("AZURE_COSMOS_CONVERSATION_CONTAINER is required")

        cosmos_conversation_client = CosmosConversationClient(
            cosmosdb_endpoint=cosmos_endpoint,
            credential=credential,
            database_name=cosmos_db_name,
            container_name=cosmos_conversation_container_name,
        )
    except Exception as e:
        logging.exception("Exception in CosmosDB initialization", e)
        cosmos_conversation_client = None
        raise e

    return cosmos_conversation_client


async def init_search_client():
    try:
        ENDPOINT = os.getenv("AZURE_SEARCH_SERVICE")
        if not ENDPOINT:
            raise ValueError("AZURE_SEARCH_SERVICE is required")
        ENDPOINT = f"https://{ENDPOINT}.search.windows.net/"

        INDEX = os.getenv("AZURE_SEARCH_INDEX")
        if not INDEX:
            raise ValueError("AZURE_SEARCH_INDEX is required")

        KEY = os.getenv("AZURE_SEARCH_QUERY_KEY")
        if not KEY:
            raise ValueError("AZURE_SEARCH_KEY is required")

        return AISearchClient(
            ENDPOINT,
            INDEX,
            KEY,
        )

    except Exception as e:
        logging.exception("Exception in AI search initialization", e)

    return None




async def send_chat_request(request_body, request_headers):
    filtered_messages = []
    messages = request_body.get("messages", [])
    for message in messages:
        if message.get("role") != "tool":
            filtered_messages.append(message)

    request_body["messages"] = filtered_messages
    # model_args = prepare_model_args(request_body, request_headers)

    try:
        azure_openai_client = await init_openai_client()
        raw_response = (
            await azure_openai_client.chat.completions.with_raw_response.create(
                **{}
            )
        )
        response = raw_response.parse()
        apim_request_id = raw_response.headers.get("apim-request-id")
    except Exception as e:
        logging.exception("Exception in send_chat_request")
        raise e

    return response, apim_request_id


async def complete_chat_request(request_body, request_headers):
    response, apim_request_id = await send_chat_request(request_body, request_headers)
    history_metadata = request_body.get("history_metadata", {})
    return format_non_streaming_response(response, history_metadata, apim_request_id)


async def conversation_internal(request_body, request_headers):
    try:
        result = await complete_chat_request(request_body, request_headers)
        return jsonify(result)

    except Exception as ex:
        logging.exception(ex)
        if hasattr(ex, "status_code"):
            return jsonify({"error": str(ex)}), ex.status_code
        else:
            return jsonify({"error": str(ex)}), 500


@bp.route("/frontend_settings", methods=["GET"])
def get_frontend_settings():
    try:
        return jsonify(frontend_settings), 200
    except Exception as e:
        logging.exception("Exception in /frontend_settings")
        return jsonify({"error": str(e)}), 500


@bp.route("/conversation", methods=["GET"])
async def init_or_load_conversation():
    user_id = request.args.get("userId")
    chassis_id = request.args.get("chassisId")

    if not user_id or not chassis_id:
        return jsonify({"error": "user_id and chassis_id are required"}), 400

    client: CosmosConversationClient = current_app.cosmos_conversation_client
    conv = await client.search_conversation(user_id=user_id, chassis_id=chassis_id)
    if conv is None:
        conv = await client.create_conversation(user_id=user_id, chassis_id=chassis_id)
        search_client: AISearchClient = current_app.search_client
        # 0. Get original chassis data for conversation
        chassis_data = search_client.get_chassis_by_id(chassis_id)
        
        # 1. perform search
        search_result = search_client.get_matching_chassis(chassis_id, count_needed=10)

        # 2. save search in cosmos message
        msg = await client.add_search_message(conv["id"], chassis_data, search_result)

        # 3. update conv with search
        conv["messages"].append(msg)

    return jsonify(conv)


async def handle_chat(conv, oai_client: AsyncAzureOpenAI, cosmos_client:CosmosConversationClient, user_msg, assistant_msg):

    messages = [
        {
            "role": "system",
            "content": "You are Chassis design engineer assistant. A chassis engineer working on a truck ordered by customer is chatting with you. He is given a few chassis that are similar to chassis he is trying to design. Help answer his questions. When possible, display the results in tabular format.",
        },
        {"role": "user", "content": "Show me 10 related chassis to my base chassis."},
    ]
    for m in conv["messages"]:
        if m["sender"] == "user":
            messages.append({"role": "user", "content": m["content"]})
        elif m["sender"] == "assistant" and m["state"] == "completed":
            messages.append({"role": "assistant", "content": m["content"]})
        elif m["sender"] == "search_results":
            content = f"Base chassis:\nID: {m['baseChassis']['ID']}\n{m['baseChassis']['description']}\n\nRelated Chassis:\n"
            for id, r in enumerate(m["results"]):
                content += f"Item {id+1} ID: {r['ID']}\n{r['description']}\n\n"
            messages.append({"role": "assistant", "content": content})
    
    messages.append({"role": "user", "content": user_msg["content"]})

    response: ChatCompletion = await oai_client.chat.completions.create(
        messages=messages,
        temperature=0.7,
        max_tokens=1600,
        stream=False,
        model=os.getenv("AZURE_OPENAI_MODEL"),
    )
    final = await cosmos_client.update_assistant_message(conv['conversationId'],assistant_msg["id"], response.choices[0].message.content)
    return True


@bp.route("/conversation/<conversation_id>/message", methods=["POST"])
async def post_message(conversation_id):
    user_id = request.args.get("userId")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    client: CosmosConversationClient = current_app.cosmos_conversation_client
    conv = await client.verify_conversation(
        conversation_id, user_id, with_messages=True
    )
    if conv is None:
        return jsonify({"error": "conversation not found or user does not own it"}), 404

    message = await request.get_json()
    user_msg = await client.add_user_message(conversation_id, message["content"])
    assistant_msg = await client.add_assistant_message(conversation_id, user_msg["id"])

    asyncio.create_task(handle_chat(conv, current_app.openai_client, client, user_msg, assistant_msg))

    return jsonify(
        {"status": "ok", "userMessage": user_msg, "assistantMessage": assistant_msg}
    )


@bp.route("/conversation/<conversation_id>/message/<message_id>", methods=["GET"])
async def poll_message(conversation_id, message_id):
    user_id = request.args.get("userId")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    client: CosmosConversationClient = current_app.cosmos_conversation_client
    conv = await client.verify_conversation(
        conversation_id, user_id, with_messages=False
    )
    if conv is None:
        return jsonify({"error": "conversation not found or user does not own it"}), 404

    message = await client.retrieve_message(conversation_id, message_id)
    if message:
        return jsonify(message)
    else:
        return jsonify({"error": "message not found"}), 404


@bp.route(
    "/conversation/<conversation_id>/message/<message_id>/feedback", methods=["PUT"]
)
async def update_feedback(conversation_id, message_id):
    user_id = request.args.get("userId")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    feedback = await request.get_json()
    liked = feedback.get("liked", 0)

    client: CosmosConversationClient = current_app.cosmos_conversation_client
    conv = await client.verify_conversation(
        conversation_id, user_id, with_messages=False
    )
    if conv is None:
        return jsonify({"error": "conversation not found or user does not own it"}), 404
    try:
        message = await client.update_message_feedback(conversation_id, message_id, liked)
        if message:
            return jsonify(message)
        else:
            return jsonify({"error": "message not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/user/conversations", methods=["DELETE"])
async def delete_user_conversations():
    user_id = request.args.get("userId")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    client: CosmosConversationClient = current_app.cosmos_conversation_client
    counts = await client.delete_all_conversations(user_id)
    return jsonify({"status": "ok", **counts})


@bp.route("/version", methods=["GET"])
async def version():
    from _version import VERSION
    return jsonify({"version": VERSION})

# if __name__ == "__main__":
app = create_app()
