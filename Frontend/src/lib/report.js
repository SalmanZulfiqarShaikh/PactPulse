import { CHECKLIST_ITEMS, CHECK_STATUS_META } from './constants'
import { sortRisks, severityMeta } from './severity'

export const DISCLAIMER = 'Automated analysis. Review before relying on it.'

/**
 * Read a stored report into one shape.
 *
 * The insights endpoint returns reports exactly as they were recorded, without
 * re-validating them, which is what lets reports written before the plain
 * language rewrite keep loading. So both schemas are possible:
 *
 *   plain   tldr, what_this_means, risks[].plain_explanation / .what_to_do
 *   legacy  summary, risks[].explanation / .recommendation
 *
 * Every field falls back individually rather than branching on the whole
 * document, because a partly-migrated report should still render what it has.
 * `isPlain` is the one place the two are told apart, and it is only used to
 * offer a re-analysis.
 */
export function normaliseReport(insights) {
  if (!insights || typeof insights !== 'object') return null

  const risks = (Array.isArray(insights.risks) ? insights.risks : []).map((risk) => ({
    title: risk?.title || risk?.clause || 'Untitled finding',
    severity: risk?.severity ?? null,
    clauseText: risk?.clause_text || '',
    plainExplanation: risk?.plain_explanation ?? risk?.explanation ?? '',
    whatToDo: risk?.what_to_do ?? risk?.recommendation ?? '',
    legalNote: risk?.legal_note || '',
    // { status: 'exact' | 'close' | 'not_found', start, end } - where the quote
    // sits in the document text. Absent on reports from before quote checking.
    quoteCheck: risk?.quote_check ?? null,
  }))

  return {
    isPlain: insights.reading_level === 'plain',
    tldr: insights.tldr || insights.summary || '',
    whatThisMeans: toStringList(insights.what_this_means),
    contractType: insights.contract_type || '',
    parties: toStringList(insights.parties),
    effectiveDate: insights.effective_date || '',
    governingLaw: insights.governing_law || '',
    keyTerms: (Array.isArray(insights.key_terms) ? insights.key_terms : []).filter(
      (item) => item?.term,
    ),
    obligations: (Array.isArray(insights.obligations) ? insights.obligations : []).filter(
      (item) => item?.obligation,
    ),
    risks: sortRisks(risks),
    checklist: normaliseChecklist(insights.checklist),
    chunkCount: Number(insights.chunk_count) || 1,
  }
}

/** The checklist in display order, or [] for reports made before it existed. */
function normaliseChecklist(checklist) {
  if (!checklist || typeof checklist !== 'object') return []
  return CHECKLIST_ITEMS.filter((item) => checklist[item.key]).map((item) => ({
    ...item,
    status: checklist[item.key].status,
    note: checklist[item.key].note || '',
  }))
}

export function checkStatusLabel(status) {
  return CHECK_STATUS_META[status]?.label ?? 'Unknown'
}

function toStringList(value) {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item ?? '').trim()).filter(Boolean)
}

/** "A" | "A and B" | "A, B and C" */
function joinList(items) {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/**
 * One line saying what the contract is, for the top of the report.
 *
 * Built from the structured fields rather than from `tldr`, so the reader gets
 * the shape of the deal in a glance and can then read the summary knowing what
 * they are reading about. The contract type is used exactly as the model
 * returned it - lower-casing it to fit a sentence would turn "NDA" into "nda".
 *
 * Falls back to the opening sentence of the summary when the structured fields
 * are missing, and to nothing at all when there is nothing honest to say, in
 * which case the report simply starts at the summary.
 */
export function reportHeadline(report) {
  if (!report) return ''

  const type = String(report.contractType ?? '')
    .trim()
    .replace(/\.$/, '')
  const parties = (report.parties ?? []).filter(Boolean)

  if (type && parties.length) return `${type} between ${joinList(parties)}.`
  if (type) return `${type}.`
  if (parties.length) return `Agreement between ${joinList(parties)}.`

  const openingSentence = String(report.tldr ?? '').match(/^[^.!?]*[.!?]/)?.[0]?.trim() ?? ''
  return openingSentence.length <= 200 ? openingSentence : ''
}

/** Obligations grouped under the party they belong to, in first-seen order. */
export function groupObligationsByParty(obligations = []) {
  const groups = new Map()

  for (const item of obligations) {
    const party = String(item?.party ?? '').trim() || 'Unnamed party'
    if (!groups.has(party)) groups.set(party, [])
    groups.get(party).push({ party, obligation: String(item?.obligation ?? '').trim() })
  }

  return [...groups.entries()].map(([party, items]) => ({ party, items }))
}

/** How many clauses sit at each severity, worst first. */
export function severityCounts(risks = []) {
  return SEVERITY_ORDER.map((severity) => ({
    severity,
    label: severityMeta(severity).label,
    dot: severityMeta(severity).dot,
    count: risks.filter((risk) => String(risk?.severity ?? '').toLowerCase() === severity).length,
  })).filter((entry) => entry.count > 0)
}

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low']

/** "Not stated" for the placeholder, a local date when it parses, the raw
 *  string when it does not (the model sometimes returns a phrase). */
export function displayDate(value) {
  const text = String(value ?? '').trim()
  if (!text) return 'Not stated'

  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return text

  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// --- Export ------------------------------------------------------------------
//
// Everything below runs in the browser on data already on screen. No request,
// no server-side rendering step, nothing to keep in sync.

function exportLines(contractTitle, report) {
  if (!report) return []

  const lines = []
  const push = (...values) => lines.push(...values)

  push(contractTitle || 'Contract', '')

  if (report.tldr) push('Summary', report.tldr, '')

  if (report.whatThisMeans.length) {
    push('What this means')
    report.whatThisMeans.forEach((item) => push(`- ${item}`))
    push('')
  }

  push('Key details')
  push(`Contract type: ${report.contractType || 'Not stated'}`)
  push(`Parties: ${report.parties.length ? report.parties.join('; ') : 'None identified'}`)
  push(`Effective date: ${displayDate(report.effectiveDate)}`)
  push(`Governing law: ${report.governingLaw || 'Not stated'}`)
  push('')

  push(`Findings (${report.risks.length})`)
  if (!report.risks.length) {
    push('No risks identified.', '')
  } else {
    report.risks.forEach((risk, index) => {
      push(`${index + 1}. ${risk.title} [${severityMeta(risk.severity).label}]`)
      if (risk.plainExplanation) push(`   ${risk.plainExplanation}`)
      if (risk.whatToDo) push(`   What to do: ${risk.whatToDo}`)
      if (risk.legalNote) push(`   Legal detail: ${risk.legalNote}`)
      if (risk.clauseText) push(`   Exact wording: "${risk.clauseText}"${quoteNote(risk)}`)
      push('')
    })
  }

  if (report.checklist.length) {
    push('Clause checklist')
    report.checklist.forEach((item) =>
      push(`- ${item.label}: ${checkStatusLabel(item.status)}${item.note ? ` - ${item.note}` : ''}`),
    )
    push('')
  }

  if (report.keyTerms.length) {
    push('Key terms')
    report.keyTerms.forEach((item) => push(`- ${item.term}: ${item.value ?? ''}`))
    push('')
  }

  if (report.obligations.length) {
    push('Obligations')
    for (const group of groupObligationsByParty(report.obligations)) {
      push(`${group.party}:`)
      group.items.forEach((item) => push(`- ${item.obligation}`))
    }
    push('')
  }

  if (report.chunkCount > 1) {
    push(`Analyzed in ${report.chunkCount} sections.`, '')
  }

  push(DISCLAIMER)
  return lines
}

/** A warning appended to quotes the server could not find in the document. */
function quoteNote(risk) {
  return risk.quoteCheck?.status === 'not_found'
    ? ' (warning: this quote could not be found in the document)'
    : ''
}

/** A clean plain-language summary, as text. */
export function reportToPlainText(contractTitle, report) {
  return exportLines(contractTitle, report).join('\n')
}

/** The same summary with light Markdown, for pasting into notes. */
export function reportToMarkdown(contractTitle, report) {
  if (!report) return ''

  const out = [`# ${contractTitle || 'Contract'}`, '']

  if (report.tldr) out.push('## Summary', report.tldr, '')

  if (report.whatThisMeans.length) {
    out.push('## What this means')
    report.whatThisMeans.forEach((item) => out.push(`- ${item}`))
    out.push('')
  }

  out.push('## Key details')
  out.push(`- **Contract type:** ${report.contractType || 'Not stated'}`)
  out.push(
    `- **Parties:** ${report.parties.length ? report.parties.join('; ') : 'None identified'}`,
  )
  out.push(`- **Effective date:** ${displayDate(report.effectiveDate)}`)
  out.push(`- **Governing law:** ${report.governingLaw || 'Not stated'}`)
  out.push('')

  out.push(`## Findings (${report.risks.length})`)
  if (!report.risks.length) {
    out.push('No risks identified.', '')
  } else {
    report.risks.forEach((risk) => {
      out.push(`### ${risk.title}`)
      out.push(`**${severityMeta(risk.severity).label}**`, '')
      if (risk.plainExplanation) out.push(risk.plainExplanation, '')
      if (risk.whatToDo) out.push(`**What to do:** ${risk.whatToDo}`, '')
      if (risk.legalNote) out.push(`**Legal detail:** ${risk.legalNote}`, '')
      if (risk.clauseText) {
        out.push('> ' + risk.clauseText.split('\n').join('\n> '), '')
        if (quoteNote(risk)) out.push('_Warning: this quote could not be found in the document._', '')
      }
    })
  }

  if (report.checklist.length) {
    out.push('## Clause checklist')
    report.checklist.forEach((item) =>
      out.push(
        `- **${item.label}:** ${checkStatusLabel(item.status)}${item.note ? ` - ${item.note}` : ''}`,
      ),
    )
    out.push('')
  }

  if (report.keyTerms.length) {
    out.push('## Key terms')
    report.keyTerms.forEach((item) => out.push(`- **${item.term}:** ${item.value ?? ''}`))
    out.push('')
  }

  if (report.obligations.length) {
    out.push('## Obligations')
    for (const group of groupObligationsByParty(report.obligations)) {
      out.push(`**${group.party}**`)
      group.items.forEach((item) => out.push(`- ${item.obligation}`))
      out.push('')
    }
  }

  if (report.chunkCount > 1) out.push(`_Analyzed in ${report.chunkCount} sections._`, '')

  out.push('---', '', DISCLAIMER)
  return out.join('\n')
}

/** Trigger a client-side download. Nothing leaves the browser. */
export function downloadText(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()

  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** "nda_sample1.txt" -> "nda_sample1-report.txt" */
export function reportFilename(contractTitle, extension) {
  const base = String(contractTitle || 'contract')
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

  return `${base || 'contract'}-report.${extension}`
}
