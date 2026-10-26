from datetime import datetime

from Backend.app.db.mongo import Collections, get_database


class EmailCodeRepository:
    """One pending verification code per email address."""

    def __init__(self) -> None:
        self.collection = get_database()[Collections.EMAIL_CODES]

    async def get(self, email: str) -> dict | None:
        return await self.collection.find_one({"email": email}, {"_id": 0})

    async def replace(
        self, email: str, code_hash: str, expires_at: datetime, sent_at: datetime
    ) -> None:
        await self.collection.update_one(
            {"email": email},
            {
                "$set": {
                    "code_hash": code_hash,
                    "expires_at": expires_at,
                    "sent_at": sent_at,
                    "attempts": 0,
                }
            },
            upsert=True,
        )

    async def count_attempt(self, email: str) -> None:
        await self.collection.update_one({"email": email}, {"$inc": {"attempts": 1}})

    async def delete(self, email: str) -> None:
        await self.collection.delete_one({"email": email})
