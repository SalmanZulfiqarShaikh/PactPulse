from pymongo import MongoClient

from Backend.app.config import settings


client = MongoClient(settings.mongodb_uri)

db = client[settings.mongodb_db_name]

users_collection = db["users"]
contracts_collection = db["contracts"]
analysis_collection = db["analysis"]


def initialize_database() -> None:
    """Create the indexes the routes rely on.

    Called once from the app lifespan. Previously this function was defined but
    never invoked, so the uniqueness constraints below did not actually exist.
    """
    # Unique on the normalised (lowercase) email: this is what makes a duplicate
    # registration a 409 rather than a second account.
    users_collection.create_index("email", unique=True)
    users_collection.create_index("user_id", unique=True)

    contracts_collection.create_index("contract_id", unique=True)
    analysis_collection.create_index("contract_id", unique=True)

    # Every contract query filters by owner, so this index carries the ordinary
    # list request and keeps the ownership check from being a collection scan.
    contracts_collection.create_index([("owner_id", 1), ("upload_date", -1)])
    analysis_collection.create_index("owner_id")
