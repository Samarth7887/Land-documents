import { useState, useRef, useCallback } from 'react';

// Maps backend progress message keywords → step index (0-based)
const STEPS = [
  { label: 'Upload',            keywords: ['upload', 'initialized', 'pending'] },
  { label: 'Page processing',   keywords: ['splitting', 'split', 'processing document', 'classif'] },
  { label: 'AI extraction',     keywords: ['extract', 'batching', 'batch'] },
  { label: 'Validation',        keywords: ['validat'] },
  { label: 'Record creation',   keywords: ['merging', 'merge', 'complete', 'finaliz'] },
];

function inferStep(message = '', status = '') {
  if (status === 'completed') return STEPS.length - 1;
  const lower = message.toLowerCase();
  for (let i = STEPS.length - 1; i >= 0; i--) {
    if (STEPS[i].keywords.some(k => lower.includes(k))) return i;
  }
  return 0;
}

const POLL_INTERVAL_MS = 1500;

export default function DocumentUpload({ role = 'clerk', onViewChange }) {
  // Upload state
  const [file, setFile] = useState(null);
  const [engine, setEngine] = useState('gemini');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Job state
  const [phase, setPhase] = useState('idle'); // idle | uploading | processing | done | failed
  const [jobId, setJobId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [results, setResults] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const pollRef = useRef(null);

  // File selection
  function handleFileChange(e) {
    const picked = e.target.files?.[0];
    if (picked) selectFile(picked);
  }

  function selectFile(f) {
    const ext = f.name.toLowerCase().slice(f.name.lastIndexOf('.'));
    const allowed = ['.pdf', '.tiff', '.tif', '.zip', '.jpg', '.jpeg', '.png'];
    if (!allowed.includes(ext)) {
      setErrorMsg(`Unsupported file type "${ext}". Please upload a PDF, image, or ZIP.`);
      return;
    }
    setFile(f);
    setErrorMsg(null);
    setPhase('idle');
    setResults(null);
    setJobId(null);
    setProgress(0);
    setStatusMessage('');
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) selectFile(dropped);
  }

  // Polling
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback((id) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/documents/jobs/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        setProgress(data.progress ?? 0);
        setStatusMessage(data.message ?? '');
        setCurrentStep(inferStep(data.message, data.status));

        if (data.status === 'completed') {
          stopPolling();
          const rRes = await fetch(`http://localhost:5000/api/documents/jobs/${id}/results`);
          const rData = await rRes.json();
          setResults(rData.results);
          setPhase('done');
        } else if (data.status === 'failed') {
          stopPolling();
          setErrorMsg(data.message || 'Pipeline failed. Check service logs.');
          setPhase('failed');
        }
      } catch (err) {
        stopPolling();
        setErrorMsg(`Lost connection while polling: ${err.message}`);
        setPhase('failed');
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling]);

  // Submit
  async function handleSubmit() {
    if (!file) return;
    stopPolling();
    setPhase('uploading');
    setErrorMsg(null);
    setResults(null);
    setProgress(0);
    setStatusMessage('Uploading...');
    setCurrentStep(0);

    try {
      const form = new FormData();
      form.append('file', file);

      const res = await fetch(`http://localhost:5000/api/documents?engine=${engine}`, {
        method: 'POST',
        body: form,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || `Upload failed with status ${res.status}.`);
        setPhase('failed');
        return;
      }

      setJobId(data.job_id);
      setPhase('processing');
      setCurrentStep(1);
      setStatusMessage(data.message);
      startPolling(data.job_id);

    } catch (err) {
      setErrorMsg(`Upload failed: ${err.message}`);
      setPhase('failed');
    }
  }

  function handleReset() {
    stopPolling();
    setFile(null);
    setPhase('idle');
    setJobId(null);
    setProgress(0);
    setStatusMessage('');
    setCurrentStep(0);
    setResults(null);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onViewChange('documents');
  }

  const isRunning = phase === 'uploading' || phase === 'processing';

  return (
    <div className="flex-1 overflow-y-auto bg-slate-900 p-4 md:p-8 text-slate-100 min-h-0">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-5">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">Upload Document</h2>
            <p className="text-sm text-slate-400 mt-2">
              Submit scanned land register files to run AI extraction and validation.
            </p>
          </div>
          <button
            onClick={() => onViewChange('documents')}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-700 text-xs font-semibold rounded-xl text-slate-200 border border-slate-700 transition-colors shadow-md"
          >
            ← Back to Documents
          </button>
        </div>

        {/* Upload panel — hidden when running or done */}
        {(phase === 'idle' || phase === 'failed') && (
          <div className="space-y-6">
            
            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all
                ${dragging
                  ? 'border-blue-500 bg-blue-500/5'
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
                  <div className="text-4xl mb-3">📄</div>
                  <div className="text-sm font-bold text-emerald-400">{file.name}</div>
                  <div className="text-xs text-slate-500 mt-1.5 font-mono">
                    {(file.size / 1024).toFixed(1)} KB · Click or drag to change file
                  </div>
                </>
              ) : (
                <>
                  <div className="text-4xl mb-4 opacity-40">⬆</div>
                  <div className="text-sm text-slate-300 font-semibold">Drag and drop file here, or click to browse</div>
                  <div className="text-xs text-slate-500 mt-2">Supports PDF, TIFF, ZIP and images up to 50 MB</div>
                </>
              )}
            </div>

            {/* Advanced Engine Configuration - visible only to Admin */}
            {role === 'admin' && (
              <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-2xl flex items-center space-x-4 shadow-sm">
                <span className="text-xs text-slate-400 font-semibold">Advanced Engine Configuration:</span>
                {['gemini', 'paddleocr'].map((e) => (
                  <button
                    key={e}
                    onClick={() => setEngine(e)}
                    className={`px-3.5 py-1.5 text-xs rounded-lg font-bold transition-all border ${
                      engine === e
                        ? 'bg-blue-500/10 border-blue-500/40 text-blue-400 shadow-sm'
                        : 'border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {e === 'gemini' ? '✦ Gemini Vision' : '🔠 PaddleOCR'}
                  </button>
                ))}
              </div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="p-4 bg-rose-950/20 border border-rose-900/40 rounded-xl text-xs font-mono text-rose-450">
                ✗ {errorMsg}
              </div>
            )}

            {/* Upload Button */}
            <button
              onClick={handleSubmit}
              disabled={!file}
              className="w-full py-3.5 text-sm font-bold rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg transition-all shadow-blue-600/10"
            >
              Upload & Process
            </button>
          </div>
        )}

        {/* Processing Screen — shown when running or done */}
        {(isRunning || phase === 'done') && (
          <div className="space-y-6">

            {/* File info banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs shadow-sm">
              <div className="flex items-center space-x-3 min-w-0">
                <span className="text-slate-400 text-sm">📄</span>
                <span className="text-slate-200 font-bold truncate max-w-sm">{file?.name}</span>
              </div>
              {jobId && (
                <span className="font-mono text-slate-500 text-[10px] self-start sm:self-auto">Job ID: {jobId}</span>
              )}
            </div>

            {/* Processing pipeline */}
            <div className="space-y-3">
              {STEPS.map((step, i) => {
                const isDone = phase === 'done' ? true : i < currentStep;
                const isActive = !isDone && i === currentStep && isRunning;
                const isPending = !isDone && !isActive;

                return (
                  <div key={i} className={`flex items-center space-x-4 px-4 py-3 rounded-xl border transition-all shadow-sm ${
                    isDone
                      ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-300'
                      : isActive
                        ? 'bg-blue-950/30 border-blue-900/40 text-blue-300'
                        : 'bg-slate-950/40 border-slate-900/60 opacity-40'
                  }`}>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {isDone ? (
                        <span className="text-emerald-400">✓</span>
                      ) : isActive ? (
                        <span className="animate-spin text-blue-400">⟳</span>
                      ) : (
                        <span className="text-slate-655 font-mono">—</span>
                      )}
                    </span>
                    <span className="text-sm font-semibold">{step.label}</span>
                    {isActive && (
                      <span className="ml-auto text-[9px] bg-blue-500/10 px-2 py-0.5 rounded font-mono uppercase tracking-wider font-bold">
                        active
                      </span>
                    )}
                    {isDone && (
                      <span className="ml-auto text-emerald-400 text-xs font-bold font-mono">✓</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="space-y-2.5 p-4 bg-slate-955 border border-slate-800 rounded-xl shadow-sm bg-slate-950/60">
              <div className="flex justify-between text-[11px] font-mono text-slate-400">
                <span className="truncate max-w-[80%]">{statusMessage || 'Processing…'}</span>
                <span className="font-bold text-white">{progress}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Done Screen / Extracted Records */}
            {phase === 'done' && results && (
              <div className="space-y-5 pt-5 border-t border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Digitized Land Records
                    <span className="ml-2 text-xs font-normal text-slate-500 lowercase font-sans">
                      ({results.records?.length ?? 0} record{results.records?.length !== 1 ? 's' : ''} extracted)
                    </span>
                  </h3>
                  <button
                    onClick={handleReset}
                    className="text-xs px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-700 text-slate-300 font-semibold rounded-xl border border-slate-700 transition-colors shadow-sm self-start sm:self-auto"
                  >
                    View Documents Workspace
                  </button>
                </div>

                {/* Record cards */}
                {results.records?.map((item, i) => {
                  const rec = item.record || {};
                  const isValid = item.isValid;
                  const conf = item.aggregate_confidence ?? 0;

                  return (
                    <div
                      key={i}
                      className={`rounded-2xl border p-5 space-y-4 shadow-md ${
                        isValid
                          ? 'bg-slate-950/80 border-slate-800/80'
                          : 'bg-amber-950/10 border-amber-900/20'
                      }`}
                    >
                      <div className="flex justify-between items-center border-b border-slate-900 pb-3">
                        <span className="text-xs font-bold text-slate-200">Deed Record Page {item.page_number}</span>
                        <div className="flex items-center space-x-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border ${
                            isValid
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {isValid ? 'Valid' : 'Warnings Detected'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 font-semibold">Confidence: {(conf * 100).toFixed(0)}%</span>
                        </div>
                      </div>

                      {/* Fields grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-xs">
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Owner Name</span>
                          <p className="font-semibold text-slate-200 truncate">{rec.owner_name?.value || '—'}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Survey Number</span>
                          <p className="font-semibold text-slate-200 truncate">{rec.survey_number?.value || '—'}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Area</span>
                          <p className="font-semibold text-slate-200 truncate">
                            {rec.area?.value !== undefined && rec.area?.value !== null ? String(rec.area.value) : '—'} {rec.area_unit?.value || ''}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Village / District</span>
                          <p className="font-semibold text-slate-200 truncate">
                            {rec.village?.value || '—'} / {rec.district?.value || '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
