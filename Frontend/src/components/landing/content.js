// Copy for the landing page. Every claim here matches what the app does today.

export const NAV_LINKS = [
  { href: '#plain-words', label: 'How it helps' },
  { href: '#ask', label: 'Ask a contract' },
  { href: '#privacy', label: 'Confidentiality' },
  { href: '#faq', label: 'FAQ' },
]

// The clause shown on the hero. Invented for illustration.
export const SAMPLE_CLAUSE = {
  heading: 'Lease, clause 9.2',
  before: 'The Tenant shall bear ',
  marked: 'all costs of repair and maintenance of the premises, howsoever arising',
  after: ', during the term of this Lease.',
  label: 'Worth negotiating',
  meaning: 'Your client pays for every repair, even normal wear and tear.',
  advice: 'Ask to limit it to damage your client causes.',
}

export const TRANSLATIONS = [
  {
    topic: 'Ending early',
    original:
      'Either party may terminate this Agreement for convenience upon thirty (30) days written notice, provided that all fees accrued up to the date of termination shall become immediately due and payable.',
    plain:
      'Either of you can walk away with a month’s notice, but you pay everything owed up to that day, at once.',
  },
  {
    topic: 'Late delivery',
    original:
      'In the event of delay, the Contractor shall pay liquidated damages at the rate of 0.5% of the Contract Price per week, subject to a maximum of 10% of the Contract Price.',
    plain:
      'Each week late costs the contractor 0.5% of the price, up to 10% in total. Beyond that, the cap protects them.',
  },
  {
    topic: 'Disputes',
    original:
      'This Agreement shall be governed by the laws of Pakistan and the courts at Karachi shall have exclusive jurisdiction.',
    plain:
      'Pakistani law applies, and any case has to be filed in Karachi, even if you are based in Lahore.',
  },
]

export const CHECKS = [
  ['Limit on liability', 'missing'],
  ['Covering their losses (indemnity)', 'attention'],
  ['Ending the contract', 'fine'],
  ['Automatic renewal', 'attention'],
  ['Payment, penalties, late fees', 'fine'],
  ['Non-compete and non-solicit', 'na'],
  ['Confidentiality', 'fine'],
  ['Who owns the work', 'missing'],
  ['Transferring the contract', 'fine'],
  ['One-sided changes to terms', 'attention'],
  ['Disputes, courts, governing law', 'fine'],
  ['Personal guarantee', 'na'],
]

export const FAQS = [
  {
    question: 'What kinds of documents can I review?',
    answer:
      'Service agreements, NDAs, leases, employment contracts, sale deeds, partnership deeds, and more. Upload a PDF or Word file. Scanned copies and stamp paper work too.',
  },
  {
    question: 'Can I rely on the clauses it quotes?',
    answer:
      'Every quoted clause is checked against your document and linked to the exact line, so you can confirm it in one click. If a quote cannot be matched, the report tells you plainly.',
  },
  {
    question: 'How long does a review take?',
    answer:
      'Usually under a minute. A long agreement takes a little longer, and you can start asking it questions while the review finishes.',
  },
  {
    question: 'Does it replace my own review?',
    answer:
      'No. It gives you a fast, organised first read so you know where to look. The judgment, and the advice to your client, stay with you.',
  },
  {
    question: 'Who can see the documents I upload?',
    answer:
      'Only you. Documents are private to your account, and you can delete any of them, permanently, at any time.',
  },
  {
    question: 'Does it work for Pakistani contracts?',
    answer:
      'Yes. It was built with Pakistani agreements in mind and recognises the Contract Act 1872, local courts and governing-law clauses.',
  },
]

export const AUTHOR = {
  name: 'Salman Zulfiqar Shaikh',
  site: 'https://www.salmanzulfi.dev',
  links: [
    { label: 'Website', href: 'https://www.salmanzulfi.dev' },
    { label: 'GitHub', href: 'https://www.github.com/SalmanZulfiqarShaikh' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/SalmanZulfiqarShaikh' },
  ],
}
