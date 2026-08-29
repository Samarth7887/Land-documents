import { useState, useRef, useCallback } from 'react'

// Maps backend progress message keywords → step index (0-based)
const STEPS = [
  { label: 'Uploading',              keywords: ['upload', 'initialized', 'pending'] },
  { label: 'Processing document',    keywords: ['splitting', 'split', 'processing document'] },
  { label: 'Classifying pages',      keywords: ['classif'] },
  { label: 'Extracting information', keywords: ['extract', 'batching', 'batch'] },
  { label: 'Validating records',     keywords: ['validat'] },
  { label: 'Finalizing records',     keywords: ['merging', 'merge', 'complete', 'finaliz'] },
]

function inferStep(message = '', status = '') {
  if (status === 'completed') return STEPS.length - 1
  const lower = message.toLowerCase()
  for (let i = STEPS.length - 1; i >= 0; i--) {
    if (STEPS[i].keywords.some(k => lower.includes(k))) return i
  }
  return 0
}

const POLL_INTERVAL_MS = 1500

export default function DocumentUpload() {
  // Upload state
  const [file, setFile] = useState(null)
  const [engine, setEngine] = useState('gemini')
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef(null)

  // Job state
  const [phase, setPhase] = useState('idle') // idle | uploading | processing | done | failed
  const [jobId, setJobId] = useState(null)
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const [currentStep, setCurrentStep] = useState(0)
  const [results, setResults] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)

  const pollRef = useRef(null)

  // ── File selection ──────────────────────────────────────────────
  function handleFileChange(e) {
    const picked = e.target.files?.[0]
    if (picked) selectFile(picked)
  }

  function selectFile(f) {
    const ext = f.name.toLowerCase().slice(f.name.lastIndexOf('.'))
    if (!['.pdf', '.tiff', '.tif', '.zip'].includes(ext)) {
      setErrorMsg(`Unsupported file type "${ext}". Please upload a PDF, TIFF, or ZIP.`)
      return
    }
    setFile(f)
    setErrorMsg(null)
    setPhase('idle')
    setResults(null)
    setJobId(null)
    setProgress(0)
    setStatusMessage('')
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) selectFile(dropped)
  }

  // ── Polling ─────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const startPolling = useCallback((id) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/jobs/${id}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()

        setProgress(data.progress ?? 0)
        setStatusMessage(data.message ?? '')
        setCurrentStep(inferStep(data.message, data.status))

        if (data.status === 'completed') {
          stopPolling()
          // Fetch full results
          const rRes = await fetch(`http://localhost:5000/api/jobs/${id}/results`)
          const rData = await rRes.json()
          setResults(rData.results)
          setPhase('done')
        } else if (data.status === 'failed') {
          stopPolling()
          setErrorMsg(data.message || 'Pipeline failed. Check service logs.')
          setPhase('failed')
        }
      } catch (err) {
        stopPolling()
        setErrorMsg(`Lost connection while polling: ${err.message}`)
        setPhase('failed')
      }
    }, POLL_INTERVAL_MS)
  }, [stopPolling])

  // ── Submit ──────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!file) return
    stopPolling()
    setPhase('uploading')
    setErrorMsg(null)
    setResults(null)
    setProgress(0)
    setStatusMessage('Uploading...')
    setCurrentStep(0)

    try {
      const form = new FormData()
      form.append('file', file)

      const res = await fetch(`http://localhost:5000/api/documents?engine=${engine}`, {
        method: 'POST',
        body: form,
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || `Upload failed with status ${res.status}.`)
        setPhase('failed')
        return
      }

      setJobId(data.job_id)
      setPhase('processing')
      setCurrentStep(1)
      setStatusMessage(data.message)
      startPolling(data.job_id)

    } catch (err) {
      setErrorMsg(`Upload failed: ${err.message}`)
      setPhase('failed')
    }
  }

  function handleReset() {
    stopPolling()
    setFile(null)
    setPhase('idle')
    setJobId(null)
    setProgress(0)
    setStatusMessage('')
    setCurrentStep(0)
    setResults(null)
    setErrorMsg(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Render helpers ──────────────────────────────────────────────
  const isRunning = phase === 'uploading' || phase === 'processing'

  return (
    <div className="flex-1 overflow-y-auto bg-slate-900 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-slate-100">Document Processing Pipeline</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Upload a land record PDF to run the full split → classify → extract → validate pipeline.
          </p>
        </div>

        {/* Upload panel — hidden when running or done */}
        {(phase === 'idle' || phase === 'failed') && (
          <div className="space-y-4">
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all
                ${dragging
                  ? 'border-blue-500 bg-blue-500/5'
                  : file
                    ? 'border-emerald-600/50 bg-emerald-950/20'
                    : 'border-slate-700 bg-slate-950/40 hover:border-slate-500 hover:bg-slate-900/60'
                }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.tiff,.tif,.zip"
                className="hidden"
                onChange={handleFileChange}
              />
              {file ? (
                <>
                  <div className="text-3xl mb-2">📄</div>
                  <div className="text-sm font-semibold text-emerald-400">{file.name}</div>
                  <div className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB · Click to change</div>
                </>
              ) : (
                <>
                  <div className="text-3xl mb-3 opacity-40">⬆</div>
                  <div className="text-sm text-slate-300 font-medium">Drop a PDF here, or click to browse</div>
                  <div className="text-xs text-slate-500 mt-1">Supports .pdf, .tiff, .zip — max 50 MB</div>
                </>
              )}
            </div>

            {/* Engine selector */}
            <div className="flex items-center space-x-4">
              <span className="text-xs text-slate-400 font-medium">Extraction Engine:</span>
              {['gemini', 'paddleocr'].map((e) => (
                <button
                  key={e}
                  onClick={() => setEngine(e)}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all border ${
                    engine === e
                      ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                      : 'border-slate-700 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {e === 'gemini' ? '✦ Gemini Vision' : '🔠 PaddleOCR'}
                </button>
              ))}
              {engine === 'gemini' && (
                <span className="text-[10px] text-amber-500 font-mono">Requires GEMINI_API_KEY env var</span>
              )}
            </div>

            {/* Error */}
            {errorMsg && (
              <div className="p-4 bg-red-950/50 border border-red-800/50 rounded-xl text-xs font-mono text-red-400 whitespace-pre-wrap">
                ✗ {errorMsg}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!file}
              className="w-full py-3 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shadow-blue-600/20 transition-all"
            >
              Start Processing Pipeline →
            </button>
          </div>
        )}

        {/* Progress screen — shown when running or done */}
        {(isRunning || phase === 'done') && (
          <div className="space-y-6">

            {/* File badge */}
            <div className="flex items-center space-x-3 px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs">
              <span className="text-slate-400">📄</span>
              <span className="text-slate-300 font-medium">{file?.name}</span>
              {jobId && (
                <span className="ml-auto font-mono text-slate-500 text-[10px]">job: {jobId.slice(0, 12)}…</span>
              )}
            </div>

            {/* Step indicators */}
            <div className="space-y-2">
              {STEPS.map((step, i) => {
                const isDone = phase === 'done' ? true : i < currentStep
                const isActive = !isDone && i === currentStep && isRunning
                const isPending = !isDone && !isActive

                return (
                  <div key={i} className={`flex items-center space-x-3 px-4 py-3 rounded-xl border transition-all ${
                    isDone
                      ? 'bg-emerald-950/30 border-emerald-800/30'
                      : isActive
                        ? 'bg-blue-950/40 border-blue-700/40 shadow-blue-500/5 shadow-md'
                        : 'bg-slate-950/60 border-slate-800/50 opacity-50'
                  }`}>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      {isDone ? (
                        <span className="text-emerald-400">✓</span>
                      ) : isActive ? (
                        <span className="animate-spin text-blue-400">⟳</span>
                      ) : (
                        <span className="text-slate-600">{i + 1}</span>
                      )}
                    </span>
                    <span className={`text-sm font-medium ${
                      isDone ? 'text-emerald-300' : isActive ? 'text-blue-300' : 'text-slate-500'
                    }`}>
                      {step.label}
                    </span>
                    {isActive && statusMessage && (
                      <span className="ml-auto text-[10px] font-mono text-blue-400/80 truncate max-w-xs">
                        {statusMessage}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>{statusMessage || 'Processing…'}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Results table — shown when done */}
            {phase === 'done' && results && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200">
                    Extracted Records
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      ({results.records?.length ?? 0} record{results.records?.length !== 1 ? 's' : ''})
                    </span>
                  </h3>
                  <button
                    onClick={handleReset}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-all"
                  >
                    ↩ Upload another
                  </button>
                </div>

                {/* Discarded duplicates log */}
                {results.discarded_logs?.length > 0 && (
                  <div className="p-3 bg-amber-950/30 border border-amber-800/30 rounded-xl space-y-1">
                    <div className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Duplicates Merged</div>
                    {results.discarded_logs.map((log, i) => (
                      <div key={i} className="text-[10px] text-amber-300/70 font-mono">{log}</div>
                    ))}
                  </div>
                )}

                {/* No records found */}
                {(!results.records || results.records.length === 0) && (
                  <div className="p-6 text-center text-slate-500 text-sm border border-slate-800 rounded-xl border-dashed">
                    No record entries were classified in this document.
                    <div className="text-xs mt-1 text-slate-600">The pipeline classified all pages as cover_page, mutation_log, or blank.</div>
                  </div>
                )}

                {/* Record cards */}
                {results.records?.map((item, i) => {
                  const rec = item.record || {}
                  const isValid = item.isValid
                  const conf = item.aggregate_confidence ?? 0

                  return (
                    <div
                      key={i}
                      className={`rounded-2xl border p-5 space-y-4 ${
                        isValid
                          ? 'bg-slate-950 border-slate-800'
                          : 'bg-amber-950/10 border-amber-800/30'
                      }`}
                    >
                      {/* Card header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs text-slate-500 font-mono">Page {item.page_number}</div>
                          <div className="text-base font-bold text-slate-100 mt-0.5">
                            {rec.owner_name?.value ?? '—'}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 font-mono">
                            Survey: {rec.survey_number?.value ?? '—'}
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-1">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                            isValid
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {isValid ? '✓ VALID' : '⚠ ISSUES'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            avg confidence: {(conf * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      {/* Field grid */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.entries(rec).map(([key, field]) => {
                          if (key === 'raw_ocr_text') return null
                          if (typeof field !== 'object' || !('value' in field)) return null
                          const val = Array.isArray(field.value) ? field.value.join(', ') : String(field.value ?? '—')
                          const conf = field.confidence ?? 0
                          const confColor = conf >= 0.9 ? 'text-emerald-400' : conf >= 0.6 ? 'text-amber-400' : 'text-red-400'
                          return (
                            <div key={key} className="bg-slate-900/60 rounded-lg px-3 py-2">
                              <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                                {key.replace(/_/g, ' ')}
                              </div>
                              <div className="text-xs text-slate-200 mt-0.5 font-medium truncate" title={val}>{val}</div>
                              {field.issue && (
                                <div className="text-[9px] text-amber-400 mt-0.5">⚠ {field.issue}</div>
                              )}
                              <div className={`text-[9px] font-mono mt-0.5 ${confColor}`}>
                                {(conf * 100).toFixed(0)}% conf
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Validation issues */}
                      {item.issues?.length > 0 && (
                        <div className="space-y-1 pt-1 border-t border-slate-800">
                          <div className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">Validation Issues</div>
                          {item.issues.map((issue, j) => (
                            <div key={j} className="text-[10px] text-amber-300/80 font-mono">• {JSON.stringify(issue)}</div>
                          ))}
                        </div>
                      )}

                      {/* Failed page */}
                      {item.status === 'failed' && (
                        <div className="p-3 bg-red-950/40 border border-red-900/40 rounded-lg text-xs text-red-400 font-mono">
                          ✗ Page failed: {item.error}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Failure state */}
            {phase === 'failed' && (
              <div className="space-y-4">
                <div className="p-5 bg-red-950/50 border border-red-800/50 rounded-2xl space-y-2">
                  <div className="text-sm font-bold text-red-300">Pipeline Failed</div>
                  <div className="text-xs font-mono text-red-400 whitespace-pre-wrap">{errorMsg}</div>
                </div>
                <button
                  onClick={handleReset}
                  className="text-xs px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-all"
                >
                  ↩ Try again
                </button>
              </div>
            )}

            {/* Still running — no reset button, just wait */}
            {isRunning && (
              <div className="text-center text-[10px] text-slate-600 font-mono">
                Polling job status every {POLL_INTERVAL_MS / 1000}s… do not close this tab.
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  )
}
