"""Data access. The only modules that talk to MongoDB directly.

Every contract, analysis and chat query is filtered by ``owner_id``, so another
account's data never matches - it is indistinguishable from "does not exist".
"""

from Backend.app.repositories.analyses import AnalysisRepository
from Backend.app.repositories.chats import ChatRepository
from Backend.app.repositories.contracts import ContractRepository
from Backend.app.repositories.email_codes import EmailCodeRepository
from Backend.app.repositories.usage import UsageRepository
from Backend.app.repositories.users import UserRepository

__all__ = [
    "AnalysisRepository",
    "ChatRepository",
    "ContractRepository",
    "EmailCodeRepository",
    "UsageRepository",
    "UserRepository",
]
