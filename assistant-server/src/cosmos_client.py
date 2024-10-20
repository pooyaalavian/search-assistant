import uuid
from datetime import datetime
from azure.cosmos.aio import CosmosClient
from azure.cosmos import exceptions


class MyCosmosClient:

    def __init__(
        self,
        cosmosdb_endpoint: str,
        credential: any,
        database_name: str,
        container_name: str,
    ):
        self.cosmosdb_endpoint = cosmosdb_endpoint
        self.credential = credential
        self.database_name = database_name
        self.container_name = container_name
        try:
            self.cosmosdb_client = CosmosClient(
                self.cosmosdb_endpoint, credential=credential
            )
        except exceptions.CosmosHttpResponseError as e:
            if e.status_code == 401:
                raise ValueError("Invalid credentials") from e
            else:
                raise ValueError("Invalid CosmosDB endpoint") from e

        try:
            self.database_client = self.cosmosdb_client.get_database_client(
                database_name
            )
        except exceptions.CosmosResourceNotFoundError:
            raise ValueError("Invalid CosmosDB database name")

        try:
            self.container_client = self.database_client.get_container_client(
                container_name
            )
        except exceptions.CosmosResourceNotFoundError:
            raise ValueError("Invalid CosmosDB container name")
        return

    async def ensure(self):
        if (
            not self.cosmosdb_client
            or not self.database_client
            or not self.container_client
        ):
            return False, "CosmosDB client not initialized correctly"
        try:
            database_info = await self.database_client.read()
        except:
            return (
                False,
                f"CosmosDB database {self.database_name} on account {self.cosmosdb_endpoint} not found",
            )

        try:
            container_info = await self.container_client.read()
        except:
            return False, f"CosmosDB container {self.container_name} not found"

        return True, "CosmosDB client initialized successfully"


class CosmosConversationClient(MyCosmosClient):
    async def create_conversation(self, user_id, chassis_id):
        id = str(uuid.uuid4())
        conversation = {
            "id": id,
            "conversationId": id,
            "type": "conversation",
            "timestamp": int(datetime.now().timestamp()),
            "userId": user_id,
            "chassisId": chassis_id,
        }

        resp = await self.container_client.upsert_item(conversation)
        if resp:
            resp["messages"] = []
            return resp
        else:
            return False

    async def search_conversation(self, user_id, chassis_id):
        query = f"SELECT * FROM c WHERE c.userId = '{user_id}' AND c.chassisId = '{chassis_id}' and c.type = 'conversation'"
        conversation = None
        async for item in self.container_client.query_items(query):
            conversation = item
            break

        if conversation is None:
            return None

        msgs = []
        query = f"SELECT * FROM c WHERE c.conversationId = '{conversation['conversationId']}' and c.type = 'message'"
        async for item in self.container_client.query_items(
            query, partition_key=conversation["conversationId"]
        ):
            msgs.append(item)

        conversation["messages"] = sorted(msgs, key=lambda x: x["timestamp"])
        return conversation

    async def verify_conversation(self, conversation_id, user_id, with_messages=False):
        query = f"SELECT * FROM c WHERE c.conversationId = '{conversation_id}' and c.userId = '{user_id}' and c.type = 'conversation'"
        conversation = None
        async for item in self.container_client.query_items(query):
            conversation = item
            break

        if conversation is None:
            return None

        msgs = []
        if with_messages:
            query = f"SELECT * FROM c WHERE c.conversationId = '{conversation['conversationId']}' and c.type = 'message'"
            async for item in self.container_client.query_items(
                query, partition_key=conversation["conversationId"]
            ):
                msgs.append(item)

        conversation["messages"] = sorted(msgs, key=lambda x: x["timestamp"])
        return conversation

    async def add_user_message(self, conversation_id, content):
        id = str(uuid.uuid4())
        message = {
            "id": id,
            "messageId": id,
            "conversationId": conversation_id,
            "type": "message",
            "timestamp": int(datetime.now().timestamp()),
            "sender": "user",
            "content": content,
        }

        resp = await self.container_client.upsert_item(message)
        if resp:
            return resp
        else:
            return False

    async def add_assistant_message(self, conversation_id, in_response_to_id):
        id = str(uuid.uuid4())
        message = {
            "id": id,
            "inResponseTo": in_response_to_id,
            "messageId": id,
            "conversationId": conversation_id,
            "type": "message",
            "timestamp": int(datetime.now().timestamp()),
            "sender": "assistant",
            "content": "",
            "liked": 0,
            "references": [],
            "actions": [],
            "followupPrompts": [],
            "state": "pending",
        }

        resp = await self.container_client.upsert_item(message)
        if resp:
            return resp
        else:
            return False

    async def update_assistant_message(self, conversation_id, message_id, content):
        resp = await self.container_client.read_item(
            item=message_id, partition_key=conversation_id
        )
        if resp:
            resp["content"] = content
            resp["state"] = "completed"
            resp = await self.container_client.upsert_item(resp)
            return resp
        else:
            return False

    async def add_search_results_message(self, conversation_id, base_chassis, results=[], query=""):
        id = str(uuid.uuid4())
        message = {
            "id": id,
            "conversationId": conversation_id,
            "messageId": id,
            "type": "message",
            "timestamp": int(datetime.now().timestamp()),
            "sender": "search_results",
            "content": "",
            "results": results,
            "baseChassis": base_chassis,
            "query": query,
        }

        resp = await self.container_client.upsert_item(message)
        if resp:
            return resp
        else:
            return False
    
    async def add_search_request_message(self, conversation_id, search_keys=[]):
        id = str(uuid.uuid4())
        message = {
            "id": id,
            "conversationId": conversation_id,
            "messageId": id,
            "type": "message",
            "timestamp": int(datetime.now().timestamp()),
            "sender": "search_request",
            "content": "",
            "query": search_keys,
        }

        resp = await self.container_client.upsert_item(message)
        if resp:
            return resp
        else:
            return False

    async def update_message_feedback(self, conversation_id, message_id, liked):
        message = await self.container_client.read_item(
            item=message_id, partition_key=conversation_id
        )
        if message:
            message["liked"] = liked
            resp = await self.container_client.upsert_item(message)
            return resp
        else:
            return False

    async def retrieve_message(self, conversation_id, message_id):
        resp = await self.container_client.read_item(
            item=message_id, partition_key=conversation_id
        )
        if resp:
            return resp
        else:
            return False

    async def delete_all_conversations(self, user_id):
        query = f"SELECT * FROM c WHERE c.type = 'conversation' and c.userId = '{user_id}'"
        conversationIds = []
        deleteCount = {
            "conversation": 0,
            "message": 0,
        }
        async for item in self.container_client.query_items(query):
            conversationIds.append(item["conversationId"])
        for conversationId in conversationIds:
            query = f"SELECT * FROM c WHERE c.conversationId = '{conversationId}'"
            async for item in self.container_client.query_items(
                query, partition_key=conversationId
            ):
                await self.container_client.delete_item(item, partition_key=conversationId)
                deleteCount[item["type"]] += 1
        return deleteCount
    
    async def delete_conversation(self, conversation_id):
        query = f"SELECT * FROM c WHERE c.conversationId = '{conversation_id}'"
        deleteCount = {
            "conversation": 0,
            "message": 0,
        }
        async for item in self.container_client.query_items(query):
            await self.container_client.delete_item(item, partition_key=conversation_id)
            deleteCount[item["type"]] += 1
        return deleteCount