import { useState, useRef, useEffect } from 'react'
import StatusBadge from '../../components/StatusBadge'



export default function VerificationConsole() {
  const [queue, setQueue] = useState([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [dbError, setDbError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/records');
      if (res.status === 503) {
        setDbError(true);
        setQueue([]);
        return;
      }
      const data = await res.json();
      if (data.success && data.records) {
        setQueue(data.records);
        setDbError(false);
      } else {
        setDbError(true);
        setQueue([]);
      }
    } catch (err) {
      console.error("Could not fetch records from backend:", err);
      setDbError(true);
      setQueue([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchRecords()
  }, [])
  
  // Current active record details
  const activeRecord = queue[selectedIdx]
  const [formFields, setFormFields] = useState(activeRecord ? activeRecord.fields : {})
  const [unreadableOverrides, setUnreadableOverrides] = useState({})
  const [correctionLogs, setCorrectionLogs] = useState([])
  const [message, setMessage] = useState(null)

  // Zoom/Pan State for Left Document Panel
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [historyTrail, setHistoryTrail] = useState({ state_transitions: [], field_corrections: [] })
  const panStart = useRef({ x: 0, y: 0 })
  const viewerRef = useRef(null)

  // Fetch the record's history trail from the backend
  const fetchHistory = async () => {
    if (!activeRecord) return
    try {
      const res = await fetch(`http://localhost:5000/api/records/${activeRecord.id}/history`)
      const data = await res.json()
      if (data.success) {
        setHistoryTrail(data.history)
      }
    } catch (err) {
      console.warn("Could not fetch history from backend, falling back to local simulation.", err)
    }
  }

  const getStatusLabel = (status = '') => {
    switch (String(status || '').toLowerCase()) {
      case 'approved':
        return 'Human-verified & signed'
      case 'corrected':
        return 'Corrected'
      case 'extracted':
        return 'AI-extracted'
      case 'review':
        return 'Needs Review'
      case 'correction_needed':
        return 'Needs Correction'
      default:
        return status || 'Unknown'
    }
  }

  const getStatusClass = (status = '') => {
    switch (String(status || '').toLowerCase()) {
      case 'approved':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
      case 'corrected':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
      case 'extracted':
      case 'review':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
      case 'correction_needed':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30'
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30'
    }
  }

  const getFieldValue = (record, key, fallback = '—') => {
    return record?.fields?.[key]?.value ?? fallback
  }

  // Reset form and overrides when active record changes
  useEffect(() => {
    if (!activeRecord) return
    setFormFields(activeRecord.fields)
    setUnreadableOverrides({})
    setMessage(null)
    setZoom(1)
    setPanOffset({ x: 0, y: 0 })
    fetchHistory()
  }, [selectedIdx, activeRecord])

  if (dbError) {
    return (
      <div className="flex-1 p-12 flex flex-col items-center justify-center bg-slate-900 text-slate-100">
        <div className="max-w-md w-full bg-slate-950 border border-red-500/30 rounded-2xl p-8 text-center space-y-4 shadow-xl">
          <div className="text-red-500 text-3xl font-bold font-mono">⚠️</div>
          <h2 className="text-lg font-bold text-slate-200">Database unavailable</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            The PostgreSQL database is offline. Real-time land registries and review queues cannot be loaded.
          </p>
          <button
            onClick={fetchRecords}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs rounded-lg text-slate-300 font-semibold transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex-1 p-12 flex items-center justify-center bg-slate-900 text-slate-100">
        <span className="text-gray-400">Loading records…</span>
      </div>
    )
  }

  if (!queue.length) {
    return (
      <div className="flex-1 p-12 flex flex-col items-center justify-center bg-slate-900 text-slate-100">
        <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-950/70 p-8 text-center space-y-3">
          <h2 className="text-lg font-bold text-slate-200">No records available</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            When the pipeline extracts new land records, they will appear here for review and approval.
          </p>
          <button
            onClick={fetchRecords}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs rounded-lg text-slate-300 font-semibold transition-colors"
          >
            Refresh Queue
          </button>
        </div>
      </div>
    )
  }

  const getConfidenceBand = (score) => {
    if (score >= 0.9) return { label: "Auto Approved", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", band: "auto_approved" }
    if (score >= 0.6) return { label: "Needs Review", color: "bg-amber-500/10 text-amber-500 border-amber-500/20", band: "needs_review" }
    return { label: "Needs Correction", color: "bg-rose-500/10 text-rose-500 border-rose-500/20", band: "needs_correction" }
  };

  // Check if "Approve" button should be enabled
  // Enabled only if every field under needs_correction (< 0.6) is either corrected or checked as unreadable
  const isApproveEnabled = () => {
    return Object.keys(formFields).every((key) => {
      const field = formFields[key]
      const band = getConfidenceBand(field.confidence).band
      
      // If it doesn't need correction, it's valid
      if (band !== "needs_correction") return true
      
      // If it's overwritten as unreadable or has been manually corrected (meaning its value changed from original AI value)
      const isOverridden = !!unreadableOverrides[key]
      const isCorrected = String(field.value) !== String(field.original_value)
      
      return isOverridden || isCorrected
    })
  }

  // Handle individual field edits
  const handleFieldChange = (key, value) => {
    const originalField = activeRecord.fields[key]
    const updatedConfidence = value !== originalField.value ? 0.95 : originalField.confidence // Set high confidence when reviewer corrects
    
    setFormFields({
      ...formFields,
      [key]: {
        ...formFields[key],
        value,
        confidence: updatedConfidence,
        // Clear warning issue once edited/corrected
        issue: value !== originalField.value ? null : originalField.issue
      }
    })
  };

  // Override Toggle
  const toggleUnreadable = (key) => {
    setUnreadableOverrides({
      ...unreadableOverrides,
      [key]: !unreadableOverrides[key]
    })
  }

  // Form Submission/Save Correction Logs
  const handleSaveCorrections = async () => {
    const logs = []
    
    Object.keys(formFields).forEach((key) => {
      const current = formFields[key]
      const original = activeRecord.fields[key]
      
      if (String(current.value) !== String(original.original_value)) {
        logs.push({
          field: key,
          original_value: original.original_value,
          corrected_value: current.value
        })
      }
    })
    
    if (logs.length === 0) {
      setMessage({ type: "info", text: "No changes detected." })
      return
    }

    try {
      const res = await fetch(`http://localhost:5000/api/records/${activeRecord.id}/correct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(logs)
      })
      const data = await res.json()
      
      if (data.success) {
        // Update local memory list for the queue view with the returned record details (e.g. signature, document_id, qr_code)
        const updatedQueue = [...queue]
        updatedQueue[selectedIdx] = {
          ...updatedQueue[selectedIdx],
          ...data.record
        }
        setQueue(updatedQueue)
        
        setMessage({ type: "success", text: `Saved ${logs.length} field corrections successfully!` })
        fetchHistory() // Refresh the logs history panel
      } else {
        setMessage({ type: "error", text: `Failed to save: ${data.error}` })
      }
    } catch (err) {
      setMessage({ type: "error", text: "Network error saving corrections to backend API." })
    }
  }

  // Handle Approve Record
  const handleApprove = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/records/${activeRecord.id}/approve`, {
        method: "POST"
      })
      const data = await res.json()
      
      if (data.success) {
        const updatedQueue = [...queue]
        updatedQueue[selectedIdx] = {
          ...updatedQueue[selectedIdx],
          ...data.record
        }
        setQueue(updatedQueue)
        setMessage({ type: "success", text: "Record has been officially approved and logged!" })
        fetchHistory()
      } else {
        setMessage({ type: "error", text: `Failed to approve: ${data.error}` })
      }
    } catch (err) {
      setMessage({ type: "error", text: "Network error approving record." })
    }
  }

  // Document Zoom/Pan mouse handlers
  const handleZoom = (factor) => {
    setZoom((prev) => Math.max(0.5, Math.min(4, prev + factor)))
  }

  const handleResetZoom = () => {
    setZoom(1)
    setPanOffset({ x: 0, y: 0 })
  }

  const handleMouseDown = (e) => {
    setIsPanning(true)
    panStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y }
  }

  const handleMouseMove = (e) => {
    if (!isPanning) return
    setPanOffset({
      x: e.clientX - panStart.current.x,
      y: e.clientY - panStart.current.y
    })
  }

  const handleMouseUp = () => {
    setIsPanning(false)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-68px)] bg-slate-900 text-slate-100 font-sans">
      
      {/* Upper Status/Batch Bar */}
      <div className="bg-slate-950 border-b border-slate-800 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-4">
          <h2 className="text-base font-semibold text-slate-200">
            Document Verification Console
          </h2>
          <span className="text-xs bg-blue-950 text-blue-400 border border-blue-900 px-2 py-0.5 rounded">
            Batch ID: BATCH_2026_AUG
          </span>

          {/* Two-state status badge */}
          {activeRecord.overallStatus === "approved" ? (
            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-medium">
              ✓ {getStatusLabel(activeRecord.overallStatus)}
            </span>
          ) : (
            <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-medium">
              ⚠ {getStatusLabel(activeRecord.overallStatus)}
            </span>
          )}
        </div>
        
        {/* Navigation Indicator */}
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <span>Active Record:</span>
          <span className="font-mono text-slate-200 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
            {activeRecord.id} ({activeRecord.village})
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        
        {/* LEFT COLUMN: Record Queue Sidebar */}
        <aside className="w-80 border-r border-slate-800 bg-slate-950/70 p-4 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
              Pending Records Queue ({queue.filter(r => r.overallStatus !== 'approved').length})
            </h3>
            
            <div className="space-y-2">
              {queue.map((item, idx) => {
                const statusBadge = 
                  item.overallStatus === "approved" 
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                    : item.overallStatus === "needs_review"
                    ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                    : "bg-rose-500/10 text-rose-500 border-rose-500/20"

                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedIdx(idx)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 flex flex-col space-y-2 ${
                      selectedIdx === idx
                        ? "bg-slate-800/80 border-blue-500/40 text-slate-100 shadow-md shadow-blue-500/5"
                        : "bg-slate-950/20 border-slate-900 text-slate-400 hover:bg-slate-800/30"
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="font-mono font-bold text-sm text-slate-300">{item.id}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusClass(item.overallStatus)} font-medium`}>
                        {getStatusLabel(item.overallStatus)}
                      </span>
                    </div>
                    
                    <div className="text-xs space-y-1">
                      <div className="text-slate-300 font-medium">{getFieldValue(item, 'village')}</div>
                      <div className="opacity-60 truncate text-[11px]">
                        {item.document_id || item.id}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
          
          {/* Record History / Audit Logs */}
          <div className="mt-6 border-t border-slate-800 pt-4 flex-1 flex flex-col min-h-[160px] overflow-hidden">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Record History Trail
            </h4>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-[11px]">
              {/* State transitions */}
              {historyTrail.state_transitions && historyTrail.state_transitions.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold text-slate-400">STATE TRANSITIONS:</div>
                  <div className="space-y-1 bg-slate-900/60 p-2 rounded-lg border border-slate-900 font-mono text-[10px]">
                    {historyTrail.state_transitions.map((log) => (
                      <div key={log.id} className="text-slate-300">
                        {new Date(log.timestamp).toLocaleTimeString()}: {log.previous_state || 'None'} &rarr; <span className="text-blue-400 font-bold">{log.new_state}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Field corrections */}
              {historyTrail.field_corrections && historyTrail.field_corrections.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold text-slate-400">FIELD CORRECTIONS:</div>
                  <div className="space-y-1.5 bg-slate-900/60 p-2 rounded-lg border border-slate-900 font-mono text-[10px]">
                    {historyTrail.field_corrections.map((corr) => (
                      <div key={corr.id} className="text-slate-300 border-b border-slate-850 pb-1 last:border-0 last:pb-0">
                        <div className="text-amber-500 font-semibold">{corr.field_name}:</div>
                        <div className="pl-1 truncate text-slate-400 line-through">{corr.original_value}</div>
                        <div className="pl-1 truncate text-emerald-400">&rarr; {corr.corrected_value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!historyTrail.state_transitions?.length && !historyTrail.field_corrections?.length) && (
                <div className="text-slate-500 text-center py-4 italic">No history trail logged.</div>
              )}
            </div>
          </div>
        </aside>

        {/* MIDDLE COLUMN: Document Scan Viewer (Zoom/Pan) */}
        <section className="flex-1 bg-slate-950 relative flex flex-col border-r border-slate-800">
          
          {/* Toolbar */}
          <div className="absolute top-4 left-4 z-10 bg-slate-900/90 border border-slate-800 p-1.5 rounded-xl shadow-lg flex items-center space-x-1.5 backdrop-blur">
            <button 
              onClick={() => handleZoom(0.2)} 
              className="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-300 text-lg font-bold"
              title="Zoom In"
            >
              +
            </button>
            <button 
              onClick={() => handleZoom(-0.2)} 
              className="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-300 text-lg font-bold"
              title="Zoom Out"
            >
              -
            </button>
            <button 
              onClick={handleResetZoom} 
              className="px-2.5 py-1 text-xs hover:bg-slate-800 rounded-lg text-slate-400"
              title="Reset Zoom"
            >
              Reset
            </button>
            <span className="text-[10px] text-slate-500 px-1 font-mono">
              {Math.round(zoom * 100)}%
            </span>
          </div>
          
          {/* Main Viewer canvas area */}
          <div 
            ref={viewerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`flex-1 overflow-hidden relative select-none flex items-center justify-center ${
              isPanning ? "cursor-grabbing" : "cursor-grab"
            }`}
          >
            {activeRecord.imageUrl ? (
              <div 
                style={{
                  transform: `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                  transformOrigin: "center center",
                  transition: isPanning ? "none" : "transform 0.15s ease-out"
                }}
                className="relative flex items-center justify-center border border-slate-800 rounded-lg overflow-hidden shadow-2xl bg-slate-900"
              >
                <img
                  src={activeRecord.imageUrl}
                  alt="Registry Document Scan"
                  className="max-w-[480px] h-auto pointer-events-none select-none"
                />
                {/* Floating QR verified badge if approved */}
                {activeRecord.qr_code && (
                  <div className="absolute bottom-4 right-4 bg-white/95 border border-slate-350 p-1.5 rounded shadow-lg flex flex-col items-center space-y-1">
                    <img 
                      src={activeRecord.qr_code} 
                      alt="Verification QR" 
                      className="w-12 h-12"
                    />
                    <span className="text-[6px] font-sans font-bold text-slate-800 uppercase tracking-wider">
                      Verified Mark
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  transform: `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                  transformOrigin: "center center",
                  transition: isPanning ? "none" : "transform 0.15s ease-out"
                }}
                className="w-[400px] h-[300px] border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center p-6 bg-slate-950/40 text-slate-400"
              >
                <svg className="w-12 h-12 text-slate-600 mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375 0 11-.75 0 .375 0 01.75 0z"></path>
                </svg>
                <div className="font-semibold text-sm text-slate-300">No source image available</div>
                <div className="text-xs text-slate-500 mt-1">Select a record from the queue that has an associated preprocessed document scan.</div>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: Extracted Fields Review Form */}
        <section className="w-[500px] bg-slate-950 flex flex-col justify-between overflow-y-auto">
          
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Extracted Registry Fields
              </h3>
              
              {/* Reset view */}
              <button 
                onClick={() => setFormFields(activeRecord.fields)} 
                className="text-xs text-slate-500 hover:text-slate-300 underline"
              >
                Reset Form
              </button>
            </div>

            {/* Alert Message */}
            {message && (
              <div className={`p-4 rounded-xl border text-xs ${
                message.type === "success" 
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                  : "bg-blue-500/10 border-blue-500/20 text-blue-400"
              }`}>
                {message.text}
              </div>
            )}

            {/* Form grid */}
            <div className="space-y-4">
              {Object.keys(formFields).map((key) => {
                const field = formFields[key]
                const confObj = getConfidenceBand(field.confidence)
                const isOverridden = !!unreadableOverrides[key]

                return (
                  <div key={key} className="space-y-2 border-b border-slate-900 pb-4">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-slate-300 capitalize">
                        {key.replace(/_/g, " ")}
                      </label>
                      
                      {/* Confidence badge with tooltip */}
                      <span 
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${confObj.color} cursor-help transition-colors`}
                        title={`Confidence Score: ${(field.confidence * 100).toFixed(0)}%`}
                      >
                        {confObj.label} ({(field.confidence * 100).toFixed(0)}%)
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        disabled={isOverridden}
                        value={field.value === null ? "" : field.value}
                        onChange={(e) => handleFieldChange(key, e.target.value)}
                        className={`flex-1 bg-slate-900 border text-sm rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                          field.issue 
                            ? "border-rose-500/50 focus:ring-rose-500" 
                            : isOverridden
                            ? "bg-slate-950 border-slate-900 text-slate-500 line-through"
                            : "border-slate-800"
                        }`}
                      />
                      
                      {/* Toggle manual override check if Needs Correction */}
                      {confObj.band === "needs_correction" && (
                        <button
                          type="button"
                          onClick={() => toggleUnreadable(key)}
                          className={`px-3 py-2 text-xs rounded-lg border font-medium transition-colors ${
                            isOverridden
                              ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                              : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                          }`}
                          title="Mark as unreadable/requires manual desk check"
                        >
                          {isOverridden ? "Unreadable ✓" : "Unreadable"}
                        </button>
                      )}
                    </div>

                    {/* Validation issue message */}
                    {field.issue && (
                      <p className="text-[11px] text-rose-400/90 font-medium pl-1 flex items-center">
                        ⚠️ {field.issue}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="p-6 border-t border-slate-800 bg-slate-950/80 sticky bottom-0 flex justify-end space-x-3 backdrop-blur">
            <button
              onClick={handleSaveCorrections}
              className="px-4 py-2.5 text-sm rounded-lg border border-slate-800 text-slate-300 hover:bg-slate-900 transition-colors"
            >
              Save Corrections
            </button>
            <button
              onClick={handleApprove}
              disabled={!isApproveEnabled() || activeRecord.overallStatus === "approved"}
              className={`px-5 py-2.5 text-sm rounded-lg font-medium shadow-lg transition-all ${
                isApproveEnabled() && activeRecord.overallStatus !== "approved"
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20"
                  : "bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              {activeRecord.overallStatus === "approved" ? "Approved ✓" : "Approve & Complete"}
            </button>
          </div>

        </section>

      </div>

    </div>
  )
}
