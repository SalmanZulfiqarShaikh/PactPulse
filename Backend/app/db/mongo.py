"""The MongoDB connection.

PyMongo's native async client (``AsyncMongoClient``) keeps database calls off
the event loop's critical path. The client is created in the app lifespan and
reached everywhere else through ``get_database()``.
"""

from pymongo import ASCENDING, DESCENDING, AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

from Backend.app.core.config import settings

_client: AsyncMongoClient | None = None
_database: AsyncDatabase | None = None


class Collections:
    USERS = "users"
    CONTRACTS = "contracts"
    ANALYSES = "analysis"
    CHAT_MESSAGES = "chat_messages"
    EMAIL_CODES = "email_codes"
    USAGE = "usage"


def get_database() -> AsyncDatabase:
    if _database is None:
        raise RuntimeError("MongoDB is not connected. connect_mongo() runs in the app lifespan.")
    return _database


def use_database(database: AsyncDatabase) -> None:
    """Swap in another database object (used by the tests)."""
    global _database
    _database = database


async def connect_mongo() -> None:
    global _client
    _client = AsyncMongoClient(settings.mongo.uri, tz_aware=True)
    use_database(_client[settings.mongo.db_name])
    await create_indexes(get_database())


async def close_mongo() -> None:
    global _client
    if _client is not None:
        await _client.close()
        _client = None


async def create_indexes(db: AsyncDatabase) -> None:
    users = db[Collections.USERS]
    await users.create_index("email", unique=True)
    await users.create_index("user_id", unique=True)

    contracts = db[Collections.CONTRACTS]
    await contracts.create_index("contract_id", unique=True)
    await contracts.create_index([("owner_id", ASCENDING), ("upload_date", DESCENDING)])

    # Unique per contract: the analyze route relies on this to detect a job
    # that is already running (see AnalysisRepository.claim).
    analyses = db[Collections.ANALYSES]
    await analyses.create_index("contract_id", unique=True)
    await analyses.create_index("owner_id")

    # Expired codes and old usage counters are removed by MongoDB itself.
    codes = db[Collections.EMAIL_CODES]
    await codes.create_index("email", unique=True)
    await codes.create_index("expires_at", expireAfterSeconds=0)

    usage = db[Collections.USAGE]
    await usage.create_index("key", unique=True)
    await usage.create_index("expires_at", expireAfterSeconds=0)

    await db[Collections.CHAT_MESSAGES].create_index(
        [("owner_id", ASCENDING), ("contract_id", ASCENDING), ("created_at", ASCENDING)]
    )
