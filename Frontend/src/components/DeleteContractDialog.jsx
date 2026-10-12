import { useEffect, useState } from 'react'

import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Alert } from './ui/Alert'
import { api } from '../api/client'

/**
 * Confirms an irreversible delete. The contract record, its analysis and the
 * stored file all go, so this deliberately does not offer an undo.
 */
export function DeleteContractDialog({ contract, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setError(null)
    setDeleting(false)
  }, [contract?.contract_id])

  const open = Boolean(contract)

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)

    try {
      await api.deleteContract(contract.contract_id)
      onDeleted?.(contract)
      onClose?.()
    } catch (requestError) {
      setError(requestError)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={deleting ? undefined : onClose}
      title="Delete this contract?"
      description="This removes the contract, its analysis report and the stored file. It cannot be undone."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>
            Delete contract
          </Button>
        </>
      }
    >
      {contract && (
        <p className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm break-words dark:border-stone-800 dark:bg-stone-950">
          {contract.originalname || contract.filename || contract.contract_id}
        </p>
      )}

      {error && (
        <Alert tone="danger" className="mt-3">
          {error.message}
        </Alert>
      )}
    </Modal>
  )
}
