from Backend.app.db.mongo import Collections, get_database
from Backend.app.models.chat import ChatMessage


class ChatRepository:
    def __init__(self) -> None:
        self.collection = get_database()[Collections.CHAT_MESSAGES]

    async def add(self, message: ChatMessage) -> None:
        await self.collection.insert_one(message.model_dump(mode="json"))

    async def history(
        self, contract_id: str, owner_id: str, *, last: int | None = None
    ) -> list[ChatMessage]:
        """Messages oldest first. ``last`` keeps only the most recent N."""
        cursor = self.collection.find(
            {"contract_id": contract_id, "owner_id": owner_id}, {"_id": 0}
        ).sort("created_at", -1)
        if last is not None:
            cursor = cursor.limit(last)
        documents = await cursor.to_list()
        return [ChatMessage.model_validate(doc) for doc in reversed(documents)]

    async def clear(self, contract_id: str, owner_id: str) -> None:
        await self.collection.delete_many({"contract_id": contract_id, "owner_id": owner_id})
