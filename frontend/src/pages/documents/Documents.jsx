import { useState, useEffect } from 'react'

export default function Documents({ onViewChange }) {
  const [documents, setDocuments] = useState([])
  const [selectedDocId, setSelectedDocId] = useState(null)
  const [docDetails, setDocDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [dbError, setDbError] = useState(false)

  const fetchDocuments = async () => {
    setLoading(true)
    try {
      const res = await fetch('http://localhost:5000/api/documents')
      if (!res.ok) {
        setDbError(true)
        setDocuments([])
        return
      }
      const data = await res.json()
      if (data.success && data.documents) {
        setDocuments(data.documents)
        setDbError(false)
      } else {
        setDbError(true)
      }
    } catch (err) {
      console.error("Failed to load documents:", err)
      setDbError(true)
    } finally {
      setLoading(false)
    }
  }

  const fetchDetails = async (id) => {
    setDetailsLoading(true)
    setSelectedDocId(id)
    try {
      const res = await fetch(`http://localhost:5000/api/documents/${id}`)
      if (!res.ok) throw new Error("Could not fetch details")
      const data = await res.json()
      if (data.success) {
        setDocDetails(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setDetailsLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  if (dbError) {
    return (
      <div className="flex-1 p-12 flex flex-col items-center justify-center bg-slate-900 text-slate-100">
        <div className="max-w-md w-full bg-slate-950 border border-red-500/30 rounded-2xl p-8 text-center space-y-4 shadow-xl">
          <div className="text-red-500 text-3xl font-bold font-mono">⚠️</div>
          <h2 className="text-lg font-bold text-slate-200">Database unavailable</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            The PostgreSQL database is offline. Document repositories and uploads cannot be loaded.
          </p>
          <button
            onClick={fetchDocuments}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs rounded-lg text-slate-300 font-semibold transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-slate-900 text-slate-100 relative">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-5">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Registry Workspace</h2>
            <p className="text-sm text-slate-400 mt-1">
              Upload, process, check status, and review scanned land deeds and registers.
            </p>
          </div>
          <button
            onClick={() => onViewChange('upload')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-lg text-white shadow transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"></path>
            </svg>
            Upload Document
          </button>
        </div>

        {/* Loading Indicator */}
        {loading ? (
          <div className="p-20 flex justify-center items-center">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center p-20 bg-slate-950 border border-slate-850 rounded-2xl space-y-4">
            <div className="text-slate-500 text-3xl font-mono">📁</div>
            <h3 className="text-sm font-bold text-slate-300">No documents found</h3>
            <p className="text-xs text-slate-500">Get started by uploading and digitizing your first scanned land document.</p>
            <button
              onClick={() => onViewChange('upload')}
              className="mt-2 px-4 py-2 bg-slate-850 hover:bg-slate-800 text-xs text-indigo-400 font-semibold rounded-lg border border-slate-800"
            >
              Upload Deed
            </button>
          </div>
        ) : (
          <div className="bg-slate-950 border border-slate-850 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 bg-slate-950 text-slate-400 text-[10px] uppercase tracking-wider font-semibold">
                    <th className="p-4">Document Name</th>
                    <th className="p-4">Upload Date</th>
                    <th className="p-4">Pages</th>
                    <th className="p-4">Processing Status</th>
                    <th className="p-4 text-center">Extracted Records</th>
                    <th className="p-4">Review Status</th>
                    <th className="p-4">Final Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-xs text-slate-300">
                  {documents.map((doc) => {
                    const hasFailed = doc.doc_status === 'failed' || doc.job_status === 'failed';
                    const isProcessing = doc.doc_status === 'processing' || doc.job_status === 'pending' || doc.job_status === 'processing';
                    
                    // Determine statuses
                    let reviewStatus = 'Pending';
                    if (doc.corrected_count > 0) reviewStatus = 'Corrected';
                    if (doc.approved_count > 0 && doc.approved_count === doc.record_count) reviewStatus = 'Completed';

                    let finalStatus = 'Incomplete';
                    if (doc.record_count > 0 && doc.approved_count === doc.record_count) finalStatus = 'Approved';
                    
                    return (
                      <tr key={doc.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="p-4 font-semibold text-white max-w-xs truncate">{doc.filename}</td>
                        <td className="p-4 text-slate-400">{new Date(doc.created_at).toLocaleDateString()}</td>
                        <td className="p-4 text-slate-400 font-mono">{doc.record_count || 1}</td>
                        <td className="p-4">
                          {isProcessing ? (
                            <span className="inline-flex items-center gap-1 text-indigo-400 font-semibold">
                              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping"></span>
                              Processing ({doc.progress || 0}%)
                            </span>
                          ) : hasFailed ? (
                            <span className="text-rose-400 font-semibold">Failed</span>
                          ) : (
                            <span className="text-emerald-400 font-semibold">Processed</span>
                          )}
                        </td>
                        <td className="p-4 text-center font-mono font-bold">{doc.record_count || 0}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            reviewStatus === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            reviewStatus === 'Corrected' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            'bg-slate-800 text-slate-400 border-slate-750'
                          }`}>
                            {reviewStatus}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`font-semibold ${finalStatus === 'Approved' ? 'text-emerald-400' : 'text-slate-450'}`}>
                            {finalStatus}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => fetchDetails(doc.id)}
                            className="px-2.5 py-1 bg-slate-850 hover:bg-slate-800 text-[10px] font-bold rounded text-slate-300 transition-colors border border-slate-800"
                          >
                            Open
                          </button>
                          {isProcessing && (
                            <button
                              onClick={() => onViewChange('upload')}
                              className="px-2.5 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-[10px] font-bold rounded text-indigo-400 transition-colors border border-indigo-500/20"
                            >
                              Process
                            </button>
                          )}
                          {!isProcessing && doc.record_count > 0 && reviewStatus !== 'Completed' && (
                            <button
                              onClick={() => onViewChange('review')}
                              className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-[10px] font-bold rounded text-amber-400 transition-colors border border-amber-500/20"
                            >
                              Review
                            </button>
                          )}
                          {finalStatus === 'Approved' && (
                            <button
                              onClick={() => onViewChange('verify')}
                              className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-[10px] font-bold rounded text-emerald-400 transition-colors border border-emerald-500/20"
                            >
                              Verify
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over details drawer */}
      {selectedDocId && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full p-6 overflow-y-auto flex flex-col space-y-6 shadow-2xl">
            
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white max-w-md truncate">
                  {detailsLoading ? "Loading details..." : docDetails?.document?.filename}
                </h3>
                <p className="text-xs text-slate-405 mt-1 font-mono">ID: {selectedDocId}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedDocId(null)
                  setDocDetails(null)
                }}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            {detailsLoading ? (
              <div className="flex-1 flex justify-center items-center">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : docDetails ? (
              <div className="space-y-6 text-xs text-slate-300">
                
                {/* 1. Document Information */}
                <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3">
                  <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Document Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-slate-500 block mb-0.5">Upload Date</span>
                      <span className="font-semibold text-slate-200">
                        {docDetails.document?.created_at ? new Date(docDetails.document.created_at).toLocaleString() : "Not available"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-0.5">Overall Status</span>
                      <span className="font-semibold text-indigo-400 capitalize">{docDetails.document?.status || "Not available"}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Processing History */}
                <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3">
                  <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Processing History</h4>
                  {docDetails.jobs && docDetails.jobs.length > 0 ? (
                    <div className="divide-y divide-slate-850">
                      {docDetails.jobs.map((job) => (
                        <div key={job.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-slate-300 font-semibold">{job.id.slice(0, 8)}...</span>
                            <span className={`font-semibold capitalize ${job.status === 'completed' ? 'text-emerald-400' : 'text-indigo-400'}`}>
                              {job.status} ({job.progress}%)
                            </span>
                          </div>
                          <p className="text-slate-450 italic">{job.message}</p>
                          <span className="text-[10px] text-slate-500 font-mono block">Run: {new Date(job.created_at).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 italic">Not completed</p>
                  )}
                </div>

                {/* 3. Extracted Records */}
                <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3">
                  <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Extracted Records</h4>
                  {docDetails.records && docDetails.records.length > 0 ? (
                    <div className="space-y-3">
                      {docDetails.records.map((rec) => {
                        const fields = rec.extracted_fields || {};
                        return (
                          <div key={rec.id} className="border border-slate-850 p-3 rounded-lg bg-slate-900/40 space-y-2">
                            <div className="flex items-center justify-between border-b border-slate-850 pb-1.5">
                              <span className="font-mono font-bold text-slate-200">{rec.id}</span>
                              <span className="font-semibold text-indigo-400 capitalize">{rec.status}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div><span className="text-slate-500">Owner:</span> <span className="font-bold text-slate-300">{fields.owner_name?.value || "Not available"}</span></div>
                              <div><span className="text-slate-500">Survey:</span> <span className="font-bold text-slate-300">{fields.survey_number?.value || "Not available"}</span></div>
                              <div><span className="text-slate-500">Village:</span> <span className="font-bold text-slate-300">{fields.village?.value || "Not available"}</span></div>
                              <div><span className="text-slate-500">Area:</span> <span className="font-bold text-slate-300">{fields.area?.value} {fields.area_unit?.value || ""}</span></div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-slate-500 italic">Not available</p>
                  )}
                </div>

                {/* 4. Validation Results */}
                <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3">
                  <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Validation Results</h4>
                  {(() => {
                    const issues = []
                    docDetails.records?.forEach((rec) => {
                      const fields = rec.extracted_fields || {}
                      Object.keys(fields).forEach((key) => {
                        if (fields[key]?.issue) {
                          issues.push({ recId: rec.id, field: key, issue: fields[key].issue })
                        }
                      })
                    })
                    
                    if (issues.length > 0) {
                      return (
                        <div className="space-y-1.5">
                          {issues.map((iss, i) => (
                            <div key={i} className="p-2 border border-rose-900/20 bg-rose-950/10 text-rose-300 rounded text-[11px] font-mono">
                              [{iss.recId.slice(0, 8)}...] <span className="text-slate-400">{iss.field}:</span> {iss.issue}
                            </div>
                          ))}
                        </div>
                      )
                    }
                    return <p className="text-slate-500 italic">Not available (No issues detected)</p>
                  })()}
                </div>

                {/* 5. Review History */}
                <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3">
                  <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Review History (Corrections)</h4>
                  {docDetails.corrections && docDetails.corrections.length > 0 ? (
                    <div className="divide-y divide-slate-850">
                      {docDetails.corrections.map((corr) => (
                        <div key={corr.id} className="py-2 first:pt-0 last:pb-0 font-mono">
                          <span className="text-indigo-400">{corr.reviewer_name || "Clerk"}:</span> corrected <span className="text-amber-400">{corr.field_name}</span> from <span className="text-slate-500">"{corr.original_value}"</span> to <span className="text-emerald-400">"{corr.corrected_value}"</span>
                          <span className="text-[9px] text-slate-500 block mt-0.5">{new Date(corr.timestamp).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 italic">Not available</p>
                  )}
                </div>

                {/* 6. Approval History */}
                <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3">
                  <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Approval History</h4>
                  {docDetails.approvals && docDetails.approvals.length > 0 ? (
                    <div className="divide-y divide-slate-850">
                      {docDetails.approvals.map((appr) => (
                        <div key={appr.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-200 block">Approved by {appr.supervisor_name || "Supervisor"}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{new Date(appr.approved_at).toLocaleString()}</span>
                          </div>
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 px-2 py-0.5 rounded font-mono">Signed</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 italic">Not completed</p>
                  )}
                </div>

                {/* 7. Verification Information */}
                <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3">
                  <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Verification Information</h4>
                  {(() => {
                    const approvedRec = docDetails.records?.find(r => r.signature)
                    if (approvedRec) {
                      return (
                        <div className="space-y-3">
                          <div>
                            <span className="text-slate-500 block mb-0.5">Signature Block (Hex)</span>
                            <div className="bg-slate-900 p-2 rounded border border-slate-850 font-mono text-[9px] break-all max-h-16 overflow-y-auto">
                              {approvedRec.signature}
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-500 block mb-0.5">Public Key Block</span>
                            <div className="bg-slate-900 p-2 rounded border border-slate-850 font-mono text-[9px] break-all max-h-16 overflow-y-auto">
                              {approvedRec.public_key}
                            </div>
                          </div>
                        </div>
                      )
                    }
                    return <p className="text-slate-500 italic">Not available</p>
                  })()}
                </div>

              </div>
            ) : null}

          </div>
        </div>
      )}
    </div>
  )
}
