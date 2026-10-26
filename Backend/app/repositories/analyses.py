from datetime import timedelta

from pymongo.errors import DuplicateKeyError

from Backend.app.core.clock import iso_now, utc_now
from Backend.app.core.errors import ConflictError
from Backend.app.db.mongo import Collections, get_database
from Backend.app.models.contract import ContractStatus


class AnalysisRepository:
    def __init__(self) -> None:
        self.collection = get_database()[Collections.ANALYSES]

    @staticmethod
    def _key(contract_id: str, owner_id: str) -> dict[str, str]:
        return {"contract_id": contract_id, "owner_id": owner_id}

    async def get(self, contract_id: str, owner_id: str) -> dict | None:
        return await self.collection.find_one(self._key(contract_id, owner_id), {"_id": 0})

    async def claim(
        self, contract_id: str, owner_id: str, run_id: str, stale_after_seconds: int
    ) -> None:
        """Mark a new run as started, unless one is already running.

        The filter only matches a record that is not running (or whose run went
        stale). If a fresh run exists, the filter misses, the upsert tries to
        insert a second record, and the unique index on contract_id refuses it.
        """
        stale_cutoff = (utc_now() - timedelta(seconds=stale_after_seconds)).isoformat()
        try:
            await self.collection.update_one(
                {
                    **self._key(contract_id, owner_id),
                    "$or": [
                        {"status": {"$ne": ContractStatus.ANALYZING.value}},
                        {"started_at": {"$lt": stale_cutoff}},
                    ],
                },
                {
                    "$set": {
                        "status": ContractStatus.ANALYZING.value,
                        "run_id": run_id,
                        "started_at": iso_now(),
                        "completed_at": None,
                        "insights": None,
                        "error": None,
                    }
                },
                upsert=True,
            )
        except DuplicateKeyError:
            raise ConflictError("An analysis is already in progress for this contract.") from None

    async def finish(self, contract_id: str, owner_id: str, run_id: str, **fields: object) -> bool:
        """Record a run's outcome. False if a newer run has taken over since."""
        result = await self.collection.update_one(
            {**self._key(contract_id, owner_id), "run_id": run_id},
            {"$set": {**fields, "completed_at": iso_now()}},
        )
        return result.matched_count == 1

    async def delete(self, contract_id: str, owner_id: str) -> None:
        await self.collection.delete_one(self._key(contract_id, owner_id))
