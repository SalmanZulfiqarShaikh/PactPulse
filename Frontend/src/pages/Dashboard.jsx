import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Search, Upload, X } from 'lucide-react'

import { PageContainer, PageHeader } from '../components/layout/AppShell'
import { Card } from '../components/ui/Card'
import { Button, buttonClasses } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { CardSkeleton, TableSkeleton } from '../components/ui/Skeleton'
import { ContractTable } from '../components/ContractTable'
import { ContractCards } from '../components/ContractCards'
import { DeleteContractDialog } from '../components/DeleteContractDialog'
import { useContracts } from '../hooks/useContracts'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { PAGE_SIZE, STATUS_FILTER_OPTIONS } from '../lib/constants'
import { formatCount } from '../lib/format'

export function Dashboard() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pendingDelete, setPendingDelete] = useState(null)

  const debouncedSearch = useDebouncedValue(search, 350)

  // Any change to the filters invalidates the current page number.
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, status])

  const { contracts, total, loading, error, reload, removeLocally } = useContracts({
    search: debouncedSearch,
    status,
    page,
    pollWhileAnalyzing: true,
  })

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const firstOnPage = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const lastOnPage = (page - 1) * PAGE_SIZE + contracts.length

  const isFiltered = Boolean(debouncedSearch || status)

  const clearFilters = () => {
    setSearch('')
    setStatus('')
  }

  const handleDeleted = (contract) => {
    // Drop the row immediately, then refetch: deleting the last item on a page
    // shifts the counts, so the local edit alone can leave the list short.
    removeLocally(contract.contract_id)
    reload()
  }

  const emptyState = useMemo(() => {
    if (isFiltered) {
      return {
        icon: Search,
        title: 'No contracts match those filters',
        description: 'Try a different name, or clear the filters to see everything.',
        action: (
          <Button variant="secondary" onClick={clearFilters}>
            Clear filters
          </Button>
        ),
      }
    }

    return {
      icon: FileText,
      title: 'No contracts yet',
      description: `Upload a PDF, DOCX or TXT contract to get a risk report. Up to ${PAGE_SIZE} are shown per page.`,
      action: (
        <Link to="/app/upload" className={buttonClasses({ variant: 'primary' })}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          Upload contract
        </Link>
      ),
    }
  }, [isFiltered])

  return (
    <PageContainer>
      <PageHeader
        title="Contracts"
        description="Everything you have uploaded, newest first."
        actions={
          <Link to="/app/upload" className={buttonClasses({ variant: 'primary' })}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            Upload contract
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-stone-400"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by file name"
            aria-label="Search contracts by file name"
            className="pl-9"
          />
        </div>

        <div className="sm:w-48">
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Filter by analysis status"
          >
            {STATUS_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        {isFiltered && (
          <Button variant="ghost" onClick={clearFilters}>
            <X className="h-4 w-4" aria-hidden="true" />
            Clear
          </Button>
        )}
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && contracts.length === 0 ? (
        <>
          <Card className="hidden overflow-hidden md:block">
            <TableSkeleton rows={5} columns={5} />
          </Card>
          <Card className="p-4 md:hidden">
            <CardSkeleton count={4} />
          </Card>
        </>
      ) : contracts.length === 0 ? (
        <Card>
          <EmptyState {...emptyState} />
        </Card>
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <ContractTable contracts={contracts} onDelete={setPendingDelete} />
          </Card>

          <Card className="overflow-hidden md:hidden">
            <ContractCards contracts={contracts} onDelete={setPendingDelete} />
          </Card>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-stone-600 dark:text-stone-400" aria-live="polite">
              Showing {formatCount(firstOnPage)}&ndash;{formatCount(lastOnPage)} of{' '}
              {formatCount(total)}
              {loading && <span className="ml-2 text-xs">Updating…</span>}
            </p>

            {totalPages > 1 && (
              <nav className="flex items-center gap-2" aria-label="Pagination">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={page <= 1 || loading}
                >
                  Previous
                </Button>

                <span className="text-sm text-stone-600 dark:text-stone-400">
                  Page {page} of {totalPages}
                </span>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  disabled={page >= totalPages || loading}
                >
                  Next
                </Button>
              </nav>
            )}
          </div>
        </>
      )}

      <DeleteContractDialog
        contract={pendingDelete}
        onClose={() => setPendingDelete(null)}
        onDeleted={handleDeleted}
      />
    </PageContainer>
  )
}
