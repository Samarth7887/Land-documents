import { useState, useRef, useCallback } from 'react'

// Maps backend progress message keywords → step index (0-based)
const STEPS = [
  { label: 'Upload',            keywords: ['upload', 'initialized', 'pending'] },
  { label: 'Page processing',   keywords: ['splitting', 'split', 'processing document', 'classif'] },
  { label: 'AI extraction',     keywords: ['extract', 'batching', 'batch'] },
  { label: 'Validation',        keywords: ['validat'] },
  { label: 'Record creation',   keywords: ['merging', 'merge', 'complete', 'finaliz'] },
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

export default function DocumentUpload({ role = 'clerk', onViewChange }) {
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

  // File selection
  function handleFileChange(e) {
    const picked = e.target.files?.[0]
    if (picked) selectFile(picked)
  }

  function selectFile(f) {
    const ext = f.name.toLowerCase().slice(f.name.lastIndexOf('.'))
    const allowed = ['.pdf', '.tiff', '.tif', '.zip', '.jpg', '.jpeg', '.png']
    if (!allowed.includes(ext)) {
      setErrorMsg(`Unsupported file type "${ext}". Please upload a PDF, image, or ZIP.`)
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

  // Polling
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
        const res = await fetch(`http://localhost:5000/api/documents/jobs/${id}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()

        setProgress(data.progress ?? 0)
        setStatusMessage(data.message ?? '')
        setCurrentStep(inferStep(data.message, data.status))

        if (data.status === 'completed') {
          stopPolling()
          const rRes = await fetch(`http://localhost:5000/api/documents/jobs/${id}/results`)
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

  // Submit
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
    onViewChange('documents')
  }

  const isRunning = phase === 'uploading' || phase === 'processing'

  return (
    <div className="flex-1 overflow-y-auto bg-slate-900 p-6 text-slate-100">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-bold">Upload Document</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Submit scanned land register files to run AI extraction and validation.
            </p>
          </div>
          <button
            onClick={() => onViewChange('documents')}
            className="px-3 py-1.5 bg-slate-850 hover:bg-slate-800 text-xs font-semibold rounded text-slate-300 border border-slate-800 transition-colors"
          >
            ← Back to Documents
          </button>
        </div>

        {/* Upload panel — hidden when running or done */}
        {(phase === 'idle' || phase === 'failed') && (
          <div className="space-y-4">
            
            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all
                ${dragging
                  ? 'border-indigo-500 bg-indigo-500/5'
                  : file
                    ? 'border-emerald-600/50 bg-emerald-950/20'
                    : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.tiff,.tif,.zip,.jpg,.jpeg,.png"
                className="hidden"
                onChange={handleFileChange}
              />
              {file ? (
                <>
                  <div className="text-3xl mb-2">📄</div>
                  <div className="text-sm font-semibold text-emerald-400">{file.name}</div>
                  <div className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB · Click or drag to change</div>
                </>
              ) : (
                <>
                  <div className="text-3xl mb-3 opacity-40">⬆</div>
                  <div className="text-sm text-slate-300 font-medium">Drag and drop file here, or click to browse</div>
                  <div className="text-xs text-slate-500 mt-1">Supports PDF, TIFF, ZIP and images up to 50 MB</div>
                </>
              )}
            </div>

            {/* Advanced Engine Configuration - visible only to Admin */}
            {role === 'admin' && (
              <div className="p-4 bg-slate-950 border border-slate-850 rounded-2xl flex items-center space-x-4">
                <span className="text-xs text-slate-400 font-medium">Advanced Engine Configuration:</span>
                {['gemini', 'paddleocr'].map((e) => (
                  <button
                    key={e}
                    onClick={() => setEngine(e)}
                    className={`px-3 py-1 text-xs rounded font-medium transition-all border ${
                      engine === e
                        ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                        : 'border-slate-850 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {e === 'gemini' ? '✦ Gemini Vision' : '🔠 PaddleOCR'}
                  </button>
                ))}
              </div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="p-4 bg-red-950/20 border border-red-900/40 rounded-xl text-xs font-mono text-red-400">
                ✗ {errorMsg}
              </div>
            )}

            {/* Upload Button */}
            <button
              onClick={handleSubmit}
              disabled={!file}
              className="w-full py-3 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg transition-all"
            >
              Upload & Process
            </button>
          </div>
        )}

        {/* Processing Screen — shown when running or done */}
        {(isRunning || phase === 'done') && (
          <div className="space-y-6">

            {/* File info banner */}
            <div className="flex items-center space-x-3 px-4 py-3 bg-slate-950 border border-slate-850 rounded-xl text-xs">
              <span className="text-slate-400">📄</span>
              <span className="text-slate-200 font-bold max-w-md truncate">{file?.name}</span>
              {jobId && (
                <span className="ml-auto font-mono text-slate-500 text-[10px]">Job ID: {jobId}</span>
              )}
            </div>

            {/* Processing pipeline */}
            <div className="space-y-2">
              {STEPS.map((step, i) => {
                const isDone = phase === 'done' ? true : i < currentStep
                const isActive = !isDone && i === currentStep && isRunning
                const isPending = !isDone && !isActive

                return (
                  <div key={i} className={`flex items-center space-x-3 px-4 py-3 rounded-xl border transition-all ${
                    isDone
                      ? 'bg-emerald-950/20 border-emerald-900/20 text-emerald-300'
                      : isActive
                        ? 'bg-indigo-950/30 border-indigo-850 text-indigo-300'
                        : 'bg-slate-955 border-slate-850 opacity-40'
                  }`}>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {isDone ? (
                        <span className="text-emerald-400">✓</span>
                      ) : isActive ? (
                        <span className="animate-spin text-indigo-400">⟳</span>
                      ) : (
                        <span className="text-slate-600 font-mono">-</span>
                      )}
                    </span>
                    <span className="text-sm font-semibold">{step.label}</span>
                    {isActive && (
                      <span className="ml-auto text-[10px] bg-indigo-500/10 px-2 py-0.5 rounded font-mono uppercase tracking-wider font-bold">
                        active
                      </span>
                    )}
                    {isDone && (
                      <span className="ml-auto text-emerald-400 text-xs font-bold font-mono">✓</span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5 p-4 bg-slate-950 border border-slate-850 rounded-xl">
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>{statusMessage || 'Processing…'}</span>
                <span className="font-bold text-white">{progress}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Done Screen / Extracted Records */}
            {phase === 'done' && results && (
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">
                    Digitized Land Records
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      ({results.records?.length ?? 0} record{results.records?.length !== 1 ? 's' : ''})
                    </span>
                  </h3>
                  <button
                    onClick={handleReset}
                    className="text-xs px-3 py-1.5 bg-slate-850 hover:bg-slate-850 text-slate-350 font-semibold rounded border border-slate-800 transition-colors"
                  >
                    View Documents Workspace
                  </button>
                </div>

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
                          ? 'bg-slate-950 border-slate-850'
                          : 'bg-amber-950/10 border-amber-900/20'
                      }`}
                    >
                      <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                        <span className="text-xs font-bold text-slate-200">Deed Record Page {item.page_number}</span>
                        <div className="flex items-center space-x-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                            isValid
                              ? 'bg-emerald-500/10 text-emerald-450'
                              : 'bg-amber-500/10 text-amber-450'
                          }`}>
                            {isValid ? 'Valid' : 'Warnings Detected'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">Confidence: {(conf * 100).toFixed(0)}%</span>
                        </div>
                      </div>

                      {/* Fields grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-slate-500">Owner Name</span>
                          <p className="font-semibold text-slate-200">{rec.owner_name?.value || 'Not available'}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Survey Number</span>
                          <p className="font-semibold text-slate-200">{rec.survey_number?.value || 'Not available'}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Area</span>
                          <p className="font-semibold text-slate-200">{rec.area?.value} {rec.area_unit?.value || ''}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Village / District</span>
                          <p className="font-semibold text-slate-200">{rec.village?.value || 'Not available'} / {rec.district?.value || 'Not available'}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
