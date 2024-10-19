import os
import logging
import asyncio
from quart import (
    Blueprint,
    Quart,
    jsonify,
    request,
    # make_response, send_from_directory, render_template,
    current_app,
)
from quart_cors import cors

from openai import AsyncAzureOpenAI
from openai.types.chat import ChatCompletion
# import copy
# import json
# import uuid
# import httpx
# from azure.identity.aio import DefaultAzureCredential, get_bearer_token_provider
from src.cosmos_client import CosmosConversationClient
from src.ai_search import AISearchClient
from src import init_openai_client, init_cosmosdb_conversation_client, init_search_client

bp = Blueprint("routes", __name__, static_folder="static", template_folder="static")
api_bp = Blueprint("routes", __name__, url_prefix="/api")

cosmos_db_ready = asyncio.Event()


def create_app():
    app = Quart(__name__)
    app = cors(app, allow_origin="*")
    app.register_blueprint(bp)
    app.register_blueprint(api_bp)
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
if DEBUG.lower() == "true" or DEBUG.lower() == "1":
    logging.basicConfig(level=logging.DEBUG)


# Frontend Settings via Environment Variables
frontend_settings = {"auth_enabled": True}


@bp.route("/frontend_settings", methods=["GET"])
def get_frontend_settings():
    try:
        return jsonify(frontend_settings), 200
    except Exception as e:
        logging.exception("Exception in /frontend_settings")
        return jsonify({"error": str(e)}), 500


@bp.route("/version", methods=["GET"])
async def version():
    from _version import VERSION
    return jsonify({"version": VERSION})

# API ROUTES

@api_bp.route("/conversation", methods=["GET"])
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
        msg = await client.add_search_results_message(conv["id"], chassis_data, search_result)

        # 3. update conv with search
        conv["messages"].append(msg)

    return jsonify(conv)


async def handle_chat(conv, oai_client: AsyncAzureOpenAI, cosmos_client:CosmosConversationClient, user_msg, assistant_msg):

    preamble = [
        {
            "role": "system",
            "content": "You are Chassis design engineer assistant. A chassis engineer (working on the design of the chassis for a truck ordered by customer) is chatting with you. He is given a bunch of chassis that are similar to the chassis he is designing. Help answer his questions. When possible, display the results in tabular format. He may refer to the the base chassis as 'my chassis' or 'current chassis' and to the matching chassis as search results.",
        },
        {"role": "user", "content": "Show me the related chassis to my base chassis."},
    ]
    messages = []
    for m in conv["messages"]:
        if m["sender"] == "user":
            messages.append({"role": "user", "content": m["content"]})
        elif m["sender"] == "assistant" and m["state"] == "completed":
            messages.append({"role": "assistant", "content": m["content"]})
        elif m["sender"] == "search_request":
            print("found a new search request, deleting previous chat_history")
            messages = []
        elif m["sender"] == "search_results":
            content = f"My chassis (base):\nID: {m['baseChassis']['ID']}\n{m['baseChassis']['description']}\n\nRelated Chassis:\n"
            for id, r in enumerate(m["results"]):
                content += f"Item {id+1} ID: {r['ID']}\n{r['description']}\n\n"
            messages.append({"role": "assistant", "content": content})
    
    messages.append({"role": "user", "content": user_msg["content"]})
    messages = preamble + messages

    response: ChatCompletion = await oai_client.chat.completions.create(
        messages=messages,
        temperature=0.7,
        max_tokens=1600,
        stream=False,
        model=os.getenv("AZURE_OPENAI_MODEL"),
    )
    final = await cosmos_client.update_assistant_message(conv['conversationId'],assistant_msg["id"], response.choices[0].message.content)
    return True


# handles a new text message from user
@api_bp.route("/conversation/<conversation_id>/message", methods=["POST"])
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


# handles a new search request from user
@api_bp.route("/conversation/<conversation_id>/search", methods=["POST"])
async def post_new_search(conversation_id):
    user_id = request.args.get("userId")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    cosmos_client: CosmosConversationClient = current_app.cosmos_conversation_client
    search_client: AISearchClient = current_app.search_client
    
    conv = await cosmos_client.verify_conversation(
        conversation_id, user_id, with_messages=True
    )
    if conv is None:
        return jsonify({"error": "conversation not found or user does not own it"}), 404

    body = await request.get_json()
    # chassis_id = body.get("chassisId")
    chassis_id = conv.get("chassisId")
    search_keys = body.get("searchKeys", [])
    count_needed = body.get("countNeeded", None)
    await cosmos_client.add_user_message(conversation_id, search_keys)
    
    base_chassis = search_client.get_chassis_by_id(chassis_id)
    results = search_client.get_matching_chassis_custom(chassis_id, search_keys, count_needed)
    await cosmos_client.add_search_results_message(conversation_id, base_chassis, results)
    
    conv = await cosmos_client.verify_conversation(conversation_id, user_id, with_messages=True)
    return jsonify( conv )
    

@api_bp.route("/conversation/<conversation_id>/message/<message_id>", methods=["GET"])
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


@api_bp.route("/conversation/<conversation_id>/message/<message_id>/feedback", methods=["PUT"])
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


@api_bp.route("/user/conversations", methods=["DELETE"])
async def delete_user_conversations():
    user_id = request.args.get("userId")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    client: CosmosConversationClient = current_app.cosmos_conversation_client
    counts = await client.delete_all_conversations(user_id)
    return jsonify({"status": "ok", **counts})

@api_bp.route("/search/keys", methods=["GET"])
async def get_search_keys():
    search_client: AISearchClient = current_app.search_client
    keys = search_client.search_keys(extended=True)
    return jsonify(keys)

    
    
# if __name__ == "__main__":
app = create_app()
