import { Link } from 'react-router-dom'
import { ArrowRight, Trash2 } from 'lucide-react'

import { StatusBadge } from './StatusBadge'
import { formatCount, formatDateTime } from '../lib/format'

/**
 * The desktop list. Rows scroll horizontally inside the card rather than
 * squashing, so nothing is ever hidden by a narrow window.
 */
export function ContractTable({ contracts, onDelete }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] border-collapse text-sm">
        <caption className="sr-only">Uploaded contracts</caption>

        <thead>
          <tr className="border-b border-stone-200 text-left text-xs font-medium uppercase tracking-wide text-stone-500 dark:border-stone-800 dark:text-stone-400">
            <th scope="col" className="px-5 py-3 font-medium">
              Contract
            </th>
            <th scope="col" className="px-5 py-3 font-medium">
              Status
            </th>
            <th scope="col" className="px-5 py-3 text-right font-medium">
              Pages
            </th>
            <th scope="col" className="px-5 py-3 text-right font-medium">
              Words
            </th>
            <th scope="col" className="px-5 py-3 font-medium">
              Uploaded
            </th>
            <th scope="col" className="px-5 py-3 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
          {contracts.map((contract) => (
            <tr
              key={contract.contract_id}
              className="transition-colors hover:bg-stone-50 dark:hover:bg-stone-800/50"
            >
              <th scope="row" className="max-w-xs px-5 py-3.5 text-left font-normal">
                <Link
                  to={`/app/contracts/${contract.contract_id}`}
                  className="font-medium text-stone-900 hover:text-accent-700 hover:underline underline-offset-2 dark:text-stone-100 dark:hover:text-accent-400"
                >
                  {contract.originalname || contract.filename || contract.contract_id}
                </Link>
              </th>

              <td className="px-5 py-3.5">
                <StatusBadge status={contract.status} />
              </td>

              <td className="px-5 py-3.5 text-right tabular-nums text-stone-600 dark:text-stone-400">
                {formatCount(contract.page_count)}
              </td>

              <td className="px-5 py-3.5 text-right tabular-nums text-stone-600 dark:text-stone-400">
                {formatCount(contract.word_count)}
              </td>

              <td className="whitespace-nowrap px-5 py-3.5 text-stone-600 dark:text-stone-400">
                {formatDateTime(contract.upload_date)}
              </td>

              <td className="px-5 py-3.5">
                <div className="flex items-center justify-end gap-1">
                  <Link
                    to={`/app/contracts/${contract.contract_id}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
                  >
                    Open
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>

                  <button
                    type="button"
                    onClick={() => onDelete?.(contract)}
                    aria-label={`Delete ${contract.originalname || contract.contract_id}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-stone-500 hover:bg-red-50 hover:text-red-700 dark:text-stone-400 dark:hover:bg-red-950/50 dark:hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
