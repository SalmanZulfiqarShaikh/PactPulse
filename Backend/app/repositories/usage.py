from datetime import datetime

from pymongo import ReturnDocument

from Backend.app.db.mongo import Collections, get_database


class UsageRepository:
    """Daily counters, one document per (visitor IP, action, day)."""

    def __init__(self) -> None:
        self.collection = get_database()[Collections.USAGE]

    async def increment(self, key: str, expires_at: datetime) -> int:
        """Add one to the counter and return the new count, atomically."""
        document = await self.collection.find_one_and_update(
            {"key": key},
            {"$inc": {"count": 1}, "$setOnInsert": {"expires_at": expires_at}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        return int(document["count"])

    async def decrement(self, key: str) -> None:
        await self.collection.update_one({"key": key, "count": {"$gt": 0}}, {"$inc": {"count": -1}})
