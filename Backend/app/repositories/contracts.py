import re
from typing import Any

from Backend.app.db.mongo import Collections, get_database
from Backend.app.models.contract import Contract, ContractStatus, IndexStatus

_WITHOUT_TEXT = {"_id": 0, "text_content": 0}


class ContractRepository:
    def __init__(self) -> None:
        self.collection = get_database()[Collections.CONTRACTS]

    @staticmethod
    def _key(contract_id: str, owner_id: str) -> dict[str, str]:
        return {"contract_id": contract_id, "owner_id": owner_id}

    async def insert(self, contract: Contract) -> None:
        await self.collection.insert_one(contract.model_dump(mode="json"))

    async def get(self, contract_id: str, owner_id: str, *, with_text: bool = True) -> dict | None:
        projection = {"_id": 0} if with_text else _WITHOUT_TEXT
        return await self.collection.find_one(self._key(contract_id, owner_id), projection)

    async def get_text(self, contract_id: str, owner_id: str) -> str | None:
        document = await self.collection.find_one(
            self._key(contract_id, owner_id), {"_id": 0, "text_content": 1}
        )
        return document.get("text_content", "") if document else None

    async def search(
        self,
        owner_id: str,
        *,
        search: str | None = None,
        status: str | None = None,
        limit: int | None = None,
        skip: int = 0,
    ) -> tuple[list[dict], int]:
        query: dict[str, Any] = {"owner_id": owner_id}
        if search and search.strip():
            # Escaped, so a filename with regex characters is matched literally.
            query["originalname"] = {"$regex": re.escape(search.strip()), "$options": "i"}
        if status and status.strip():
            query["status"] = status.strip()

        total = await self.collection.count_documents(query)
        cursor = self.collection.find(query, _WITHOUT_TEXT).sort("upload_date", -1).skip(skip)
        if limit is not None:
            cursor = cursor.limit(limit)
        return await cursor.to_list(), total

    async def set_status(self, contract_id: str, owner_id: str, status: ContractStatus) -> None:
        await self.collection.update_one(
            self._key(contract_id, owner_id), {"$set": {"status": status.value}}
        )

    async def set_index_state(
        self,
        contract_id: str,
        owner_id: str,
        status: IndexStatus,
        *,
        error: str | None = None,
        passage_count: int | None = None,
    ) -> None:
        update: dict[str, Any] = {"index_status": status.value, "index_error": error}
        if passage_count is not None:
            update["passage_count"] = passage_count
        await self.collection.update_one(self._key(contract_id, owner_id), {"$set": update})

    async def delete(self, contract_id: str, owner_id: str) -> None:
        await self.collection.delete_one(self._key(contract_id, owner_id))
