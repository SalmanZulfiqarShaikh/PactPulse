"""The contract report, written for someone without legal training.

The field descriptions below are not just documentation: this model is passed
to Gemini as the ``response_schema``, so these strings are instructions the
model reads. They are written to steer the output towards short sentences and
everyday words, because the schema is the one place a formatting rule is
guaranteed to reach the model on every call.

Backwards compatibility: reports are stored as plain documents and returned
without re-validation, so a report written before this change still loads and
is served unchanged. Readers should treat ``tldr`` and ``plain_explanation``
as possibly absent and fall back to the older ``summary``/``explanation``
fields. ``reading_level`` marks which shape a report is.
"""

from typing import Literal

from pydantic import BaseModel, Field

Severity = Literal["low", "medium", "high", "critical"]

# Stamped on every new report so a reader can tell the plain-language shape
# from the older technical one without guessing from which fields are present.
READING_LEVEL = "plain"


class KeyTerm(BaseModel):
    term: str = Field(
        description=(
            "What the term is about, as a short everyday label rather than a legal "
            "heading. Write 'How long you must keep this secret', not 'Confidentiality "
            "Obligation Survival Period'."
        )
    )
    value: str = Field(
        description=(
            "The answer in one short sentence of plain words, including the figure if "
            "there is one. Write '3 years after the deal ends', not 'three (3) years "
            "from the date of termination hereof'."
        )
    )


class Obligation(BaseModel):
    party: str = Field(
        description=(
            "Who this duty falls on. Use 'You' when the contract clearly makes the "
            "reader the one who must act, otherwise the party's name."
        )
    )
    obligation: str = Field(
        description=(
            "What they must do or must not do, in one or two short sentences that say "
            "what happens in practice, and by when if the contract says."
        )
    )


class RiskItem(BaseModel):
    """One clause worth worrying about, explained twice: once plainly, once for a lawyer."""

    title: str = Field(
        description=(
            "A short plain-language label for the problem, understandable on its own. "
            "Write 'They can change the terms without asking you', not 'Unilateral "
            "amendment provision'."
        )
    )
    severity: Severity = Field(
        description="How much risk this clause carries: 'critical', 'high', 'medium' or 'low'"
    )
    clause_text: str = Field(
        description=(
            "The clause quoted word for word, exactly as it appears in the contract. "
            "Do not correct, shorten or modernise the wording - a lawyer needs the "
            "original text. If a risk is something missing from the contract rather "
            "than a clause in it, quote the nearest relevant wording instead."
        )
    )
    plain_explanation: str = Field(
        description=(
            "What this clause actually means and why it could hurt, in plain words for "
            "someone with no legal training. Say what it could cost, who it protects, "
            "and what happens if things go wrong. Explain any legal term in a few words "
            "right where it appears, for example \"indemnify, meaning you would have to "
            "cover their losses\". No Latin, no 'hereinafter', no 'notwithstanding'."
        )
    )
    what_to_do: str = Field(
        description=(
            "One concrete change that would fix it, in plain words a non-lawyer could "
            "ask for, for example 'Ask them to cap your total liability at the fee you "
            "are paying them'. Say what to ask for, not how to draft it."
        )
    )
    legal_note: str | None = Field(
        default=None,
        description=(
            "Optional. The precise point or exact replacement wording for a lawyer: the "
            "doctrine, the statutory reference, or the redline text. Leave this out when "
            "there is nothing to add beyond the plain explanation."
        ),
    )


class ContractInsights(BaseModel):
    """The contract report.

    This model is used for both the Gemini ``response_schema`` and the API
    response, so the shape the model is asked to produce and the shape we store
    and return can never drift apart.
    """

    tldr: str = Field(
        description=(
            "The whole contract in 2-3 short sentences of plain words, then one more "
            "sentence naming the single most important thing to watch out for. Write it "
            "so someone could read only this and still know what they are signing."
        )
    )
    what_this_means: list[str] = Field(
        default_factory=list,
        description=(
            "3-6 short bullet points, each one sentence, describing what this contract "
            "does in practice: who has to do what, what it costs, how it ends."
        ),
    )
    contract_type: str = Field(
        description=(
            "The everyday name for this kind of contract, for example 'Rental agreement' "
            "or 'Freelance work contract' - not the formal title from the document."
        )
    )
    parties: list[str] = Field(default_factory=list, description="The names of the parties")
    effective_date: str | None = Field(
        default=None, description="The date it starts, or null if the contract does not say"
    )
    governing_law: str | None = Field(
        default=None,
        description=(
            "Which country's or state's law applies, as a plain phrase such as "
            "'Pakistani law' or 'the law of England and Wales'. Null if not stated."
        ),
    )
    key_terms: list[KeyTerm] = Field(
        default_factory=list, description="The terms that matter commercially, in plain words"
    )
    obligations: list[Obligation] = Field(
        default_factory=list, description="What each side has to do, in plain words"
    )
    risks: list[RiskItem] = Field(
        default_factory=list, description="Risky or unclear clauses, most serious first"
    )

    # Audit signal: greater than 1 means the contract was analysed in chunks and
    # the report was merged, so it is worth a second look.
    chunk_count: int = Field(default=1, description="Number of chunks the contract was split into")

    # Lets a reader tell a plain-language report from an older technical one
    # without inferring it from which fields happen to be present.
    reading_level: Literal["plain"] = Field(
        default=READING_LEVEL, description="Marks the plain-language report format"
    )
