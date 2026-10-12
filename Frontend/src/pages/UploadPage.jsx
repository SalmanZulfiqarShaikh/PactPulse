import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileText, X } from 'lucide-react'

import { PageContainer, PageHeader } from '../components/layout/AppShell'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Alert } from '../components/ui/Alert'
import { FileDropzone } from '../components/FileDropzone'
import { api } from '../api/client'
import { MAX_FILE_SIZE_LABEL } from '../lib/constants'
import { formatBytes, formatCount } from '../lib/format'
import { validateFile } from '../lib/validateFile'

/** A labelled progress bar. The percentage is also text, not colour alone. */
function UploadProgress({ percent }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Uploading</span>
        <span className="tabular-nums text-stone-600 dark:text-stone-400">{percent}%</span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Upload progress"
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800"
      >
        <div
          className="h-full rounded-full bg-accent-700 transition-[width] duration-200 dark:bg-accent-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

export function UploadPage() {
  const navigate = useNavigate()

  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState(null)
  const [status, setStatus] = useState('idle') // idle | uploading | analyzing
  const [percent, setPercent] = useState(0)
  const [error, setError] = useState(null)

  const abortRef = useRef(null)

  const busy = status !== 'idle'

  const handleSelect = (selected) => {
    const validationError = validateFile(selected)
    setFileError(validationError)
    setError(null)
    setFile(validationError ? null : selected)
  }

  const handleReset = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setFile(null)
    setFileError(null)
    setError(null)
    setStatus('idle')
    setPercent(0)
  }

  const handleCancel = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setStatus('idle')
    setPercent(0)
  }

  const handleUpload = async () => {
    const validationError = validateFile(file)
    if (validationError) {
      setFileError(validationError)
      return
    }

    setError(null)
    setStatus('uploading')
    setPercent(0)

    const controller = new AbortController()
    abortRef.current = controller

    let uploaded

    try {
      uploaded = await api.uploadContract(file, {
        onProgress: setPercent,
        signal: controller.signal,
      })
    } catch (uploadError) {
      if (uploadError?.name === 'AbortError') {
        setStatus('idle')
        setPercent(0)
        return
      }
      setError(uploadError)
      setStatus('idle')
      setPercent(0)
      return
    } finally {
      abortRef.current = null
    }

    setStatus('analyzing')

    try {
      await api.analyze(uploaded.contract_id)
    } catch (analysisError) {
      // A 409 means a job is already running for this contract, which is fine.
      // Anything else is shown on the contract page, where the user can retry
      // without losing the file they just uploaded.
      if (analysisError?.status !== 409 && analysisError?.name !== 'AbortError') {
        navigate(`/app/contracts/${uploaded.contract_id}`)
        return
      }
    }

    navigate(`/app/contracts/${uploaded.contract_id}`)
  }

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title="Upload contract"
        description="The text is extracted on upload, then analysed for risk. You will be taken to the contract while it runs."
      />

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Choose a file"
            description="PDF, DOCX or TXT. Scanned image-only PDFs have no text to extract."
          />

          <CardBody className="space-y-4">
            <FileDropzone
              onSelect={handleSelect}
              disabled={busy}
              invalid={Boolean(fileError)}
            />

            {file && (
              <div className="flex items-start justify-between gap-3 rounded-md border border-stone-200 px-3 py-2.5 dark:border-stone-800">
                <div className="flex min-w-0 items-start gap-2.5">
                  <FileText
                    className="mt-0.5 h-4 w-4 shrink-0 text-stone-500 dark:text-stone-400"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      {formatBytes(file.size)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  disabled={busy}
                  aria-label="Remove selected file"
                  className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-stone-500 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-50 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}

            {fileError && <Alert tone="danger">{fileError}</Alert>}
            {error && <Alert tone="danger" title="Upload failed">{error.message}</Alert>}

            {status === 'uploading' && <UploadProgress percent={percent} />}

            {status === 'analyzing' && (
              <Alert tone="info">
                Uploaded. Starting the analysis and opening the contract…
              </Alert>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleUpload} loading={busy} disabled={!file || Boolean(fileError)}>
                {busy ? 'Working…' : 'Upload and analyze'}
              </Button>

              {status === 'uploading' && (
                <Button variant="ghost" onClick={handleCancel}>
                  Cancel
                </Button>
              )}

              {!busy && (
                <Link
                  to="/app"
                  className="text-sm text-stone-600 underline underline-offset-2 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
                >
                  Back to contracts
                </Link>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="What happens next" />
          <CardBody>
            <ol className="space-y-2 text-sm text-stone-700 dark:text-stone-300">
              <li>1. The document is parsed and its text stored.</li>
              <li>2. The analysis runs in the background, taking up to a few minutes.</li>
              <li>3. The contract page fills in the report as soon as it is ready.</li>
            </ol>
            {file && (
              <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
                Selected: {formatCount(file.size)} bytes. Maximum is {MAX_FILE_SIZE_LABEL}.
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </PageContainer>
  )
}
