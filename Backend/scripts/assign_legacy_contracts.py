"""Assign pre-accounts contracts and analyses to a real user.

Before this change there were no accounts, so every contract in the database has
no ``owner_id``. Ownership filters cannot match a missing field, which means
those rows are invisible to every account - safe, but useless. This script hands
them to one user.

Run from the repository root:

    # Show what would change, without writing anything
    Backend/venv/Scripts/python.exe Backend/scripts/assign_legacy_contracts.py ada@example.com

    # Actually assign them
    Backend/venv/Scripts/python.exe Backend/scripts/assign_legacy_contracts.py ada@example.com --apply

Dry run is the default: this rewrites ownership of documents that may be
confidential, so the change should be looked at before it is made.
"""

import argparse
import sys
from pathlib import Path

# Running this file directly puts Backend/scripts on sys.path, not the repo
# root, so the Backend.app package would not import. Add the repo root, which is
# two levels up from this file.
_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from Backend.app.database import analysis_collection, contracts_collection, users_collection  # noqa: E402
from Backend.app.models.user import normalise_email  # noqa: E402


def _ownerless(collection) -> list[dict]:
    """Rows with no usable owner_id.

    Matches a missing field and an explicit null, so a half-written row cannot
    be missed. Note that a query like ``{"owner_id": None}`` would be a
    *dangerous* filter to use for authorisation, precisely because it matches
    every ownerless document - it is correct here only because this script's
    whole job is to find those.
    """
    return list(
        collection.find(
            {"$or": [{"owner_id": {"$exists": False}}, {"owner_id": None}]},
            {"_id": 0, "contract_id": 1, "owner_id": 1, "originalname": 1, "user_id": 1, "email": 1},
        )
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("email", help="Email of the account to give the legacy rows to")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write the changes. Without this the script only reports what it would do.",
    )
    args = parser.parse_args()

    email = normalise_email(args.email)

    user = users_collection.find_one({"email": email}, {"_id": 0, "user_id": 1, "email": 1})

    if not user:
        print(f"No account found for {email!r}.")
        print("Register that account first (POST /auth/register), then run this again.")
        return 1

    owner_id = user["user_id"]
    print(f"Target account: {user['email']}  (user_id={owner_id})")

    orphan_contracts = _ownerless(contracts_collection)
    orphan_analyses = _ownerless(analysis_collection)

    print(f"Contracts without an owner: {len(orphan_contracts)}")
    for contract in orphan_contracts:
        print(f"  {contract.get('contract_id')}  {contract.get('originalname')}")

    # Analyses are assigned from their contract's owner rather than blanket
    # assigned, so an analysis can never end up pointing at a different account
    # than the contract it belongs to.
    print(f"Analyses without an owner: {len(orphan_analyses)}")

    if not orphan_contracts and not orphan_analyses:
        print("Nothing to do.")
        return 0

    if not args.apply:
        print()
        print("Dry run. Nothing was written. Re-run with --apply to make these changes.")
        return 0

    contract_result = contracts_collection.update_many(
        {"$or": [{"owner_id": {"$exists": False}}, {"owner_id": None}]},
        {"$set": {"owner_id": owner_id}},
    )
    print(f"Assigned {contract_result.modified_count} contract(s).")

    assigned_analyses = 0
    skipped_analyses = 0

    for analysis in orphan_analyses:
        contract = contracts_collection.find_one(
            {"contract_id": analysis.get("contract_id")}, {"_id": 0, "owner_id": 1}
        )

        if not contract or not contract.get("owner_id"):
            # Should not happen once contracts are assigned, but an analysis
            # whose contract is gone has no owner to inherit, and guessing one
            # would be worse than leaving it unowned.
            print(f"  ! Analysis {analysis.get('contract_id')} has no contract; left unassigned.")
            skipped_analyses += 1
            continue

        analysis_collection.update_one(
            {
                "contract_id": analysis.get("contract_id"),
                "$or": [{"owner_id": {"$exists": False}}, {"owner_id": None}],
            },
            {"$set": {"owner_id": contract["owner_id"]}},
        )
        assigned_analyses += 1

    print(f"Assigned {assigned_analyses} analysis record(s), skipped {skipped_analyses}.")
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
