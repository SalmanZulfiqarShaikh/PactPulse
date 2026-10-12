import { Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'

import { StatusBadge } from './StatusBadge'
import { formatCount, formatDateTime } from '../lib/format'

/**
 * The narrow-screen equivalent of the table. The same fields, stacked, so no
 * horizontal scrolling is needed on a phone.
 */
export function ContractCards({ contracts, onDelete }) {
  return (
    <ul className="divide-y divide-stone-200 dark:divide-stone-800">
      {contracts.map((contract) => (
        <li key={contract.contract_id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <Link
              to={`/app/contracts/${contract.contract_id}`}
              className="min-w-0 font-medium text-stone-900 hover:text-accent-700 hover:underline underline-offset-2 dark:text-stone-100 dark:hover:text-accent-400"
            >
              {contract.originalname || contract.filename || contract.contract_id}
            </Link>

            <button
              type="button"
              onClick={() => onDelete?.(contract)}
              aria-label={`Delete ${contract.originalname || contract.contract_id}`}
              className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-stone-500 hover:bg-red-50 hover:text-red-700 dark:text-stone-400 dark:hover:bg-red-950/50 dark:hover:text-red-300"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-2">
            <StatusBadge status={contract.status} />
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-stone-600 dark:text-stone-400">
            <div className="flex gap-1.5">
              <dt>Pages:</dt>
              <dd className="tabular-nums">{formatCount(contract.page_count)}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Words:</dt>
              <dd className="tabular-nums">{formatCount(contract.word_count)}</dd>
            </div>
            <div className="col-span-2 flex gap-1.5">
              <dt>Uploaded:</dt>
              <dd>{formatDateTime(contract.upload_date)}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  )
}
