import { useState, useRef, useEffect } from 'react'

// Mock database queue of pending land records
const INITIAL_QUEUE = [
  {
    id: "rec_9011",
    village: "Green Valley",
    documentName: "registry_record_valley_404.pdf (Page 2)",
    overallStatus: "needs_review",
    fields: {
      owner_name: { value: "Johnathan Smith", confidence: 0.95, original_value: "Johnathan Smith" },
      survey_number: { value: "404-B / Part 2", confidence: 0.52, original_value: "404-B / Part 2", issue: "Duplicate survey number detected in Green Valley" },
      khasra_or_khata_number: { value: "KH-88902", confidence: 0.85, original_value: "KH-88902" },
      area: { value: 55.75, confidence: 0.95, original_value: "55.75", issue: "Plausible maximum size exceeded. Area 55.75 exceeds limit of 50.0" },
      area_unit: { value: "Acres", confidence: 0.98, original_value: "Acres" },
      village: { value: "Green Valley", confidence: 0.90, original_value: "Green Valley" },
      taluk: { value: "East Taluk", confidence: 0.85, original_value: "East Taluk" },
      district: { value: "River District", confidence: 0.95, original_value: "River District" },
      land_classification: { value: "Agricultural (Wet Land)", confidence: 0.92, original_value: "Agricultural (Wet Land)" },
      khata_type: { value: "A", confidence: 0.88, original_value: "A" },
      tenancy_status: { value: "Owner-cultivated", confidence: 0.90, original_value: "Owner-cultivated" },
      liabilities: { value: ["Bank Mortgage of 500,000 INR"], confidence: 0.80, original_value: ["Bank Mortgage of 500,000 INR"] },
      tax_status: { value: "Paid", confidence: 0.95, original_value: "Paid" }
    }
  },
  {
    id: "rec_9012",
    village: "Sunny Hill",
    documentName: "registry_record_hill_102.pdf (Page 4)",
    overallStatus: "auto_approved",
    fields: {
      owner_name: { value: "Alice Margret", confidence: 0.98, original_value: "Alice Margret" },
      survey_number: { value: "1024/2", confidence: 0.92, original_value: "1024/2" },
      khasra_or_khata_number: { value: "KH-33104", confidence: 0.94, original_value: "KH-33104" },
      area: { value: 2.50, confidence: 0.97, original_value: "2.50" },
      area_unit: { value: "Acres", confidence: 0.99, original_value: "Acres" },
      village: { value: "Sunny Hill", confidence: 0.95, original_value: "Sunny Hill" },
      taluk: { value: "North Taluk", confidence: 0.91, original_value: "North Taluk" },
      district: { value: "Valley District", confidence: 0.96, original_value: "Valley District" },
      land_classification: { value: "Residential", confidence: 0.94, original_value: "Residential" },
      khata_type: { value: "A", confidence: 0.90, original_value: "A" },
      tenancy_status: { value: "Owner-cultivated", confidence: 0.95, original_value: "Owner-cultivated" },
      liabilities: { value: [], confidence: 0.92, original_value: [] },
      tax_status: { value: "Paid", confidence: 0.98, original_value: "Paid" }
    }
  },
  {
    id: "rec_9013",
    village: "River Dale",
    documentName: "blurry_scan_bundle_009.pdf (Page 1)",
    overallStatus: "needs_correction",
    fields: {
      owner_name: { value: "M...k D...n", confidence: 0.35, original_value: "M...k D...n", issue: "Illegible text detected" },
      survey_number: { value: "Unknown", confidence: 0.35, original_value: "Unknown", issue: "Unrecognized survey sequence" },
      khasra_or_khata_number: { value: "KH-90", confidence: 0.45, original_value: "KH-90", issue: "Faint ink - high ambiguity" },
      area: { value: 0.00, confidence: 0.30, original_value: "0.00", issue: "Area must be a positive number" },
      area_unit: { value: "Hectares", confidence: 0.85, original_value: "Hectares" },
      village: { value: "River Dale", confidence: 0.90, original_value: "River Dale" },
      taluk: { value: "West Taluk", confidence: 0.88, original_value: "West Taluk" },
      district: { value: "Coast District", confidence: 0.94, original_value: "Coast District" },
      land_classification: { value: "Wet Land", confidence: 0.82, original_value: "Wet Land" },
      khata_type: { value: null, confidence: 0.50, original_value: null, issue: "Khata verification failed" },
      tenancy_status: { value: "Leased", confidence: 0.87, original_value: "Leased" },
      liabilities: { value: [], confidence: 0.80, original_value: [] },
      tax_status: { value: "Outstanding", confidence: 0.92, original_value: "Outstanding" }
    }
  }
]

export default function VerificationConsole() {
  const [queue, setQueue] = useState(INITIAL_QUEUE)
  const [selectedIdx, setSelectedIdx] = useState(0)
  
  // Current active record details
  const activeRecord = queue[selectedIdx]
  const [formFields, setFormFields] = useState(activeRecord.fields)
  const [unreadableOverrides, setUnreadableOverrides] = useState({})
  const [correctionLogs, setCorrectionLogs] = useState([])
  const [message, setMessage] = useState(null)

  // Zoom/Pan State for Left Document Panel
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0 })
  const viewerRef = useRef(null)

  // Reset form and overrides when active record changes
  useEffect(() => {
    setFormFields(activeRecord.fields)
    setUnreadableOverrides({})
    setMessage(null)
    setZoom(1)
    setPanOffset({ x: 0, y: 0 })
  }, [selectedIdx, activeRecord])

  // Helper to map confidence score to band
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
    const reviewerId = "REV_CLERK_03"
    const timestamp = new Date().toISOString()
    
    Object.keys(formFields).forEach((key) => {
      const current = formFields[key]
      const original = activeRecord.fields[key]
      
      if (String(current.value) !== String(original.original_value)) {
        logs.push({
          field: key,
          original_value: original.original_value,
          corrected_value: current.value,
          reviewer_id: reviewerId,
          timestamp
        })
      }
    })
    
    if (logs.length === 0) {
      setMessage({ type: "info", text: "No changes detected." })
      return
    }

    // Mock API call trigger
    console.log(`[POST /records/${activeRecord.id}/correct] payload:`, logs)
    setCorrectionLogs([...correctionLogs, ...logs])
    
    // Simulate updating queue memory
    const updatedQueue = [...queue]
    updatedQueue[selectedIdx].fields = formFields
    setQueue(updatedQueue)
    
    setMessage({ type: "success", text: `Saved ${logs.length} field corrections successfully!` })
  }

  // Handle Approve Record
  const handleApprove = () => {
    const updatedQueue = [...queue]
    updatedQueue[selectedIdx].overallStatus = "approved"
    setQueue(updatedQueue)
    setMessage({ type: "success", text: "Record has been officially approved and logged!" })
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
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusBadge} font-medium`}>
                        {item.overallStatus}
                      </span>
                    </div>
                    
                    <div className="text-xs space-y-1">
                      <div className="text-slate-300 font-medium">{item.village}</div>
                      <div className="opacity-60 truncate text-[11px]">{item.documentName}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
          
          {/* Quick Logs Summary */}
          {correctionLogs.length > 0 && (
            <div className="mt-8 border-t border-slate-800 pt-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Reviewer Corrections Log</h4>
              <div className="max-h-28 overflow-y-auto text-[10px] font-mono text-slate-400 space-y-1 bg-slate-950 p-2.5 rounded-lg border border-slate-900">
                {correctionLogs.map((log, i) => (
                  <div key={i} className="truncate">
                    [{log.field}]: {log.original_value} &rarr; {log.corrected_value}
                  </div>
                ))}
              </div>
            </div>
          )}
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
            {/* Mock physical land record scan layout */}
            <div 
              style={{
                transform: `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                transformOrigin: "center center",
                transition: isPanning ? "none" : "transform 0.15s ease-out"
              }}
              className="w-[480px] min-h-[640px] bg-[#fbf9f2] text-slate-800 border-2 border-[#e7e1cc] rounded-lg p-8 shadow-2xl relative flex flex-col space-y-6"
            >
              {/* Document Header stamp */}
              <div className="border border-slate-400 p-4 text-center rounded relative border-dashed">
                <div className="absolute top-2 left-2 text-[8px] text-red-700 border border-red-700/30 px-1 py-0.5 rounded font-bold uppercase tracking-widest">
                  DEPT OF REVENUE
                </div>
                <h3 className="font-serif text-lg font-bold uppercase tracking-wider text-slate-800">
                  Form VII-C Land Registry Page
                </h3>
                <p className="text-[9px] text-slate-500 mt-1">Village Land Administration Board Office Record</p>
              </div>

              {/* Document Fields */}
              <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-xs font-serif leading-relaxed text-slate-800">
                <div className="col-span-2 border-b border-slate-300 pb-1.5 flex justify-between">
                  <span className="font-bold">LANDOWNER OF RECORD:</span>
                  <span className="font-mono font-medium underline decoration-dotted text-blue-900 bg-blue-50/50 px-1">{formFields.owner_name?.value}</span>
                </div>
                
                <div className="border-b border-slate-300 pb-1.5 flex justify-between">
                  <span className="font-bold">SURVEY NUM:</span>
                  <span className={`font-mono font-medium underline text-blue-900 px-1 ${getConfidenceBand(formFields.survey_number?.confidence).band === 'needs_correction' ? 'bg-red-100 text-red-900' : 'bg-blue-50/50'}`}>
                    {formFields.survey_number?.value}
                  </span>
                </div>
                
                <div className="border-b border-slate-300 pb-1.5 flex justify-between">
                  <span className="font-bold">KHATA NUM:</span>
                  <span className="font-mono font-medium text-blue-900 bg-blue-50/50 px-1">{formFields.khasra_or_khata_number?.value}</span>
                </div>

                <div className="border-b border-slate-300 pb-1.5 flex justify-between">
                  <span className="font-bold">AREA SIZE:</span>
                  <span className={`font-mono font-medium underline text-blue-900 px-1 ${getConfidenceBand(formFields.area?.confidence).band === 'needs_correction' ? 'bg-red-100 text-red-900' : 'bg-blue-50/50'}`}>
                    {formFields.area?.value} {formFields.area_unit?.value}
                  </span>
                </div>

                <div className="border-b border-slate-300 pb-1.5 flex justify-between">
                  <span className="font-bold">CLASSIFICATION:</span>
                  <span className="font-mono text-blue-900">{formFields.land_classification?.value}</span>
                </div>

                <div className="border-b border-slate-300 pb-1.5 flex justify-between">
                  <span className="font-bold">VILLAGE:</span>
                  <span className="font-mono text-blue-900">{formFields.village?.value}</span>
                </div>

                <div className="border-b border-slate-300 pb-1.5 flex justify-between">
                  <span className="font-bold">TALUK:</span>
                  <span className="font-mono text-blue-900">{formFields.taluk?.value}</span>
                </div>
              </div>

              {/* Bottom Stamp mock */}
              <div className="mt-auto border-t border-slate-300 pt-6 flex justify-between items-center text-[10px] text-slate-500 font-serif">
                <div>
                  <div>Assigned Registry ID: {activeRecord.id}</div>
                  <div>Processed: 2026-08-29</div>
                </div>
                <div className="w-16 h-16 rounded-full border-2 border-red-500/20 flex items-center justify-center text-center text-red-700/40 text-[8px] font-bold uppercase rotate-12 select-none">
                  VERIFIED STAMP
                </div>
              </div>
            </div>
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
