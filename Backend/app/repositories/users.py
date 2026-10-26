from pymongo.errors import DuplicateKeyError

from Backend.app.core.errors import ConflictError
from Backend.app.db.mongo import Collections, get_database
from Backend.app.models.user import User


class UserRepository:
    def __init__(self) -> None:
        self.collection = get_database()[Collections.USERS]

    async def create(self, user: User) -> None:
        try:
            await self.collection.insert_one(user.model_dump())
        except DuplicateKeyError:
            raise ConflictError("An account with that email already exists.") from None

    async def by_email(self, email: str) -> User | None:
        document = await self.collection.find_one({"email": email}, {"_id": 0})
        return User.model_validate(document) if document else None

    async def by_id(self, user_id: str) -> User | None:
        document = await self.collection.find_one({"user_id": user_id}, {"_id": 0})
        return User.model_validate(document) if document else None

    async def set_password_hash(self, user_id: str, password_hash: str) -> None:
        await self.collection.update_one(
            {"user_id": user_id}, {"$set": {"password_hash": password_hash}}
        )

    async def bump_token_version(self, user_id: str) -> None:
        await self.collection.update_one({"user_id": user_id}, {"$inc": {"token_version": 1}})

    async def mark_verified(self, user_id: str) -> None:
        await self.collection.update_one({"user_id": user_id}, {"$set": {"email_verified": True}})
