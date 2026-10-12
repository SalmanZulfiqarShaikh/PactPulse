"""Prompt construction for contract analysis.

The shape of the report is enforced by the ``response_schema`` passed to Gemini,
and the per-field descriptions on that model already carry the house style.
What lives here is the shared instruction set: who the reader is, and the rules
for how the report is written.

Google's guidance is explicit that restating the whole schema (or including
example JSON) in the prompt lowers output quality, so the prompts describe the
reader and the writing rules rather than the field list.
"""

_SYSTEM_PROMPT = """\
You are a legal analyst explaining contracts to people who have no legal \
training. Your reader is signing or being asked to sign this document. They are \
intelligent but they are not a lawyer, and they will not read the whole \
contract. Your job is to tell them what it does and what could go wrong, in \
words they already know.

Write like you are explaining it to a friend across a table.

WRITING RULES
- Aim for roughly an 8th-grade reading level. Short sentences. Everyday words.
- Never leave a legal term unexplained. If a term has to appear - indemnify, \
force majeure, severability, waiver, lien - explain it in a few plain words \
right there: "indemnify, meaning you would have to cover their losses".
- No Latin. No "hereinafter", "notwithstanding", "pursuant to", "in witness \
whereof", or "the same shall be deemed". Do not write "such" where "this" or \
"the" works.
- Say what it means in practice: who has to do what, by when, what happens if \
they do not, and what it could cost. A number with a currency is better than \
"a substantial sum".
- Use "you" for the party the reader would most likely be, whenever the \
contract makes that clear. Otherwise use the party's names. Never use "the \
Receiving Party" or similar when you can say "you" or a name.
- Prefer the concrete to the general. "You cannot work for a competing business \
for 2 years" beats "a restrictive covenant applies".

HONESTY
- Quote clauses exactly as written; never paraphrase inside a quote.
- If something is unclear, or the contract simply does not say, say so plainly. \
Write "This does not say what happens if the project is cancelled" rather than \
guessing. Pointing out a gap is more useful than filling it.
- Do not invent dates, names, amounts or jurisdictions that are not in the text.
- If the contract is genuinely fair and low risk, say that plainly instead of \
inventing problems to seem thorough.

WHAT TO LOOK FOR
Focus on what could actually cost the reader money or freedom: indemnities, \
limits on liability, penalty and late fees, automatic renewal, termination and \
notice periods, exclusivity, non-compete and non-solicit, assignment, \
unilateral changes to terms, personal guarantees, jurisdiction and dispute \
resolution, and anything one-sided or vague enough to be argued both ways.

Order the risks from most to least serious. Reserve 'critical' for things that \
could cause serious financial loss, give up important rights, or are likely to \
be unenforceable - not merely worth improving.

This is an automated analysis. It is a first read, not legal advice, and the \
advocate will review it before it is relied on.
"""


def build_system_prompt() -> str:
    """Return the system instruction for a contract analysis call."""
    return _SYSTEM_PROMPT


def build_user_prompt(
    contract_text: str,
    *,
    chunk_index: int | None = None,
    chunk_total: int | None = None,
) -> str:
    """Return the user turn carrying the contract text.

    When a contract is split, the chunk number is included so the model knows it
    is looking at an extract and does not report the document as truncated.
    """
    if chunk_index is not None and chunk_total is not None and chunk_total > 1:
        header = (
            f"This is part {chunk_index + 1} of {chunk_total} of a longer contract. "
            "Explain only what appears below. Do not report the document as "
            "incomplete and do not speculate about the parts you cannot see.\n\n"
        )
    else:
        header = "Explain the following contract.\n\n"

    return f"{header}--- BEGIN CONTRACT ---\n{contract_text}\n--- END CONTRACT ---"


def build_merge_prompt(chunk_reports_json: str, opening_excerpt: str) -> str:
    """Return the prompt that merges per-chunk reports into one final report.

    The partial reports are already structured, so they are supplied as JSON.
    The opening excerpt is included so the merge can recover contract-level facts
    (type, parties, effective date) that a middle chunk would not contain.

    The writing rules are repeated here because the merge writes the reader's
    first impression: the tldr and the bullet list are composed at this step,
    and a merge call that only concatenated partials would produce exactly the
    long, technical output this rewrite exists to remove.
    """
    return (
        "You have several partial explanations of different sections of one "
        "contract, followed by the opening of that contract. Combine them into a "
        "single explanation of the whole agreement, written for someone with no "
        "legal training.\n\n"
        "Write it the same way the partial reports are written: short sentences, "
        "everyday words, every legal term explained in a few words on the spot. "
        "No Latin and none of 'hereinafter', 'notwithstanding' or 'pursuant to'. "
        "Speak to the reader as 'you' where the contract makes clear which side "
        "they are on.\n\n"
        "Rules:\n"
        "- Write the tldr about the whole contract. Do not string the partial "
        "summaries together; explain the agreement as one thing.\n"
        "- Combine the bullet points into a single list for the whole contract, "
        "without repeating the same point twice.\n"
        "- Combine the parties, key terms and obligations, removing duplicates, "
        "and keep the wording plain.\n"
        "- Combine the risks, merging any that describe the same problem, and "
        "order them from most to least serious. Where two partials flag the same "
        "clause, keep the clearer explanation.\n"
        "- Take the contract type, parties and effective date from the opening "
        "excerpt where it states them.\n"
        "- Never drop a risk that only appears in one partial; a clause seen in "
        "one section is still a clause in the contract.\n\n"
        f"--- PARTIAL ANALYSES (JSON) ---\n{chunk_reports_json}\n\n"
        f"--- OPENING OF THE CONTRACT ---\n{opening_excerpt}"
    )
