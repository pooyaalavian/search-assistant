import os 
from src.ai_search import AISearchClient
from src.cosmos_client import CosmosConversationClient
from azure.identity.aio import DefaultAzureCredential, get_bearer_token_provider
from openai import AsyncAzureOpenAI
import logging 

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

