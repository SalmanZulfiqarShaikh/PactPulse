"""The contract report, as Gemini is asked to write it.

These models are passed to Gemini as the ``response_schema``, so the field
descriptions are instructions the model reads on every call. They steer it
towards short sentences and everyday words.

Older stored reports may be missing newer fields (``checklist``, ``tldr``) and
are returned as stored; the frontend falls back field by field.
"""

from typing import Literal

from pydantic import BaseModel, Field

Severity = Literal["low", "medium", "high", "critical"]

READING_LEVEL = "plain"


class KeyTerm(BaseModel):
    term: str = Field(
        description=(
            "What the term is about, as a short everyday label rather than a legal heading. "
            "Write 'How long you must keep this secret', not 'Confidentiality Obligation "
            "Survival Period'."
        )
    )
    value: str = Field(
        description=(
            "The answer in one short sentence of plain words, including the figure if there "
            "is one. Write '3 years after the deal ends', not 'three (3) years from the date "
            "of termination hereof'."
        )
    )


class Obligation(BaseModel):
    party: str = Field(
        description=(
            "Who this duty falls on. Use 'You' when the contract clearly makes the reader the "
            "one who must act, otherwise the party's name."
        )
    )
    obligation: str = Field(
        description=(
            "What they must or must not do, in one or two short sentences that say what "
            "happens in practice, and by when if the contract says."
        )
    )


class RiskItem(BaseModel):
    title: str = Field(
        description=(
            "A short plain-language label for the problem. Write 'They can change the terms "
            "without asking you', not 'Unilateral amendment provision'."
        )
    )
    severity: Severity = Field(description="'critical', 'high', 'medium' or 'low'")
    clause_text: str = Field(
        description=(
            "The clause copied character for character from the contract: no corrections, "
            "no shortening, no '...'. It is checked against the document automatically. If "
            "the risk is something missing, quote the nearest relevant wording."
        )
    )
    plain_explanation: str = Field(
        description=(
            "What this clause means and why it could hurt, in plain words: what it could "
            "cost, who it protects, what happens if things go wrong. Explain any legal term "
            'on the spot, e.g. "indemnify, meaning you would have to cover their losses".'
        )
    )
    what_to_do: str = Field(
        description=(
            "One concrete change a non-lawyer could ask for, e.g. 'Ask them to cap your total "
            "liability at the fee you are paying them'."
        )
    )
    legal_note: str | None = Field(
        default=None,
        description=(
            "Optional. The precise point or replacement wording for a lawyer. Leave out when "
            "there is nothing to add."
        ),
    )


CheckStatus = Literal["fine", "needs_attention", "missing", "not_applicable"]

_CHECK_STATUS_HELP = (
    "'fine' if the contract covers this fairly; 'needs_attention' if it covers it in a way "
    "that is one-sided, risky or unclear; 'missing' if the contract is silent on it and that "
    "silence matters for this kind of contract; 'not_applicable' if it does not matter here."
)


class CheckItem(BaseModel):
    status: CheckStatus = Field(description=_CHECK_STATUS_HELP)
    note: str = Field(description="One short plain sentence saying why, or what the contract says.")


class ClauseChecklist(BaseModel):
    """A fixed list, answered for every contract, so runs are comparable."""

    liability_cap: CheckItem = Field(description="Is there a limit on how much each side can owe?")
    indemnity: CheckItem = Field(description="Does anyone have to cover the other side's losses?")
    termination: CheckItem = Field(
        description="How can the contract be ended, and with what notice?"
    )
    auto_renewal: CheckItem = Field(description="Does it renew automatically unless cancelled?")
    payment_terms: CheckItem = Field(
        description="Payment amounts, deadlines, penalties, late fees."
    )
    non_compete: CheckItem = Field(description="Non-compete or non-solicit restrictions.")
    confidentiality: CheckItem = Field(description="What must be kept secret, and for how long?")
    ip_ownership: CheckItem = Field(description="Who owns the work, data or intellectual property?")
    assignment: CheckItem = Field(
        description="Can either side transfer the contract to someone else?"
    )
    unilateral_changes: CheckItem = Field(description="Can one side change the terms on its own?")
    dispute_resolution: CheckItem = Field(
        description="Courts, arbitration, jurisdiction, governing law."
    )
    personal_guarantee: CheckItem = Field(description="Is anyone personally guaranteeing payment?")


class ContractReport(BaseModel):
    tldr: str = Field(
        description=(
            "The whole contract in 2-3 short plain sentences, then one sentence naming the "
            "single most important thing to watch out for."
        )
    )
    what_this_means: list[str] = Field(
        default_factory=list,
        description="3-6 one-sentence bullets: who does what, what it costs, how it ends.",
    )
    contract_type: str = Field(
        description="The everyday name, e.g. 'Rental agreement' or 'Freelance work contract'."
    )
    parties: list[str] = Field(default_factory=list, description="The names of the parties")
    effective_date: str | None = Field(
        default=None, description="Start date, or null if not stated"
    )
    governing_law: str | None = Field(
        default=None, description="e.g. 'Pakistani law'. Null if not stated."
    )
    key_terms: list[KeyTerm] = Field(default_factory=list)
    obligations: list[Obligation] = Field(default_factory=list)
    risks: list[RiskItem] = Field(default_factory=list, description="Most serious first")
    checklist: ClauseChecklist
    chunk_count: int = Field(default=1, description="Always 1; set by the server")
    reading_level: Literal["plain"] = Field(default=READING_LEVEL, description="Always 'plain'")
