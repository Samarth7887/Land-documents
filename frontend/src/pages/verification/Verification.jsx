import { useState, useEffect } from 'react'

export default function Verification() {
  const [approvedRecords, setApprovedRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchId, setSearchId] = useState('')
  const [selectedRecord, setSelectedRecord] = useState(null)
  
  // Verification check states
  const [verificationResult, setVerificationResult] = useState(null)
  const [verificationLoading, setVerificationLoading] = useState(false)
  const [verificationError, setVerificationError] = useState(null)

  // Certificate file verifier states
  const [uploadedCert, setUploadedCert] = useState(null)
  const [certVerifyResult, setCertVerifyResult] = useState(null)
  const [certVerifyLoading, setCertVerifyLoading] = useState(false)
  const [certVerifyError, setCertVerifyError] = useState(null)
  const [dbError, setDbError] = useState(false)

  // Fetch approved records
  const fetchApproved = async () => {
    setLoading(true)
    try {
      const res = await fetch('http://localhost:5000/api/records')
      if (!res.ok) {
        setDbError(true)
        setApprovedRecords([])
        return
      }
      const data = await res.json()
      if (data.success) {
        // Filter records that have been approved (have document_id)
        const approved = data.records.filter(r => r.overallStatus === 'approved' || r.document_id)
        setApprovedRecords(approved)
        if (approved.length > 0) {
          setSelectedRecord(approved[0])
          triggerVerification(approved[0].document_id)
        }
        setDbError(false)
      }
    } catch (err) {
      console.error("Failed to load approved records", err)
      setDbError(true)
      setApprovedRecords([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchApproved()
  }, [])

  // Call GET /api/records/verify-id/:document_id
  const triggerVerification = async (docId) => {
    if (!docId) return
    setVerificationLoading(true)
    setVerificationResult(null)
    setVerificationError(null)
    try {
      const res = await fetch(`http://localhost:5000/api/records/verify-id/${encodeURIComponent(docId)}`)
      const data = await res.json()
      setVerificationResult(data)
    } catch (err) {
      setVerificationError("Network error contacting signature verification service.")
    } finally {
      setVerificationLoading(false)
    }
  }

  const handleRecordSelect = (record) => {
    setSelectedRecord(record)
    triggerVerification(record.document_id)
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (!searchId.trim()) return
    triggerVerification(searchId.trim())
  }

  // Cryptographic JSON certificate upload verification handler
  const handleCertUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setCertVerifyError(null)
    setCertVerifyResult(null)

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target.result)
        if (!json.fields || !json.signature) {
          throw new Error("Invalid certificate format. JSON must contain both 'fields' and 'signature' keys.")
        }
        setUploadedCert(json)
      } catch (err) {
        setCertVerifyError(err.message)
      }
    }
    reader.readAsText(file)
  }

  const verifyUploadedCert = async () => {
    if (!uploadedCert) return
    setCertVerifyLoading(true)
    setCertVerifyError(null)
    setCertVerifyResult(null)

    try {
      const res = await fetch('http://localhost:5000/api/verification-mark/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: uploadedCert.fields,
          signature: uploadedCert.signature
        })
      })
      
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: ${res.statusText}`)
      }
      
      const data = await res.json()
      setCertVerifyResult(data)
    } catch (err) {
      setCertVerifyError(err.message)
    } finally {
      setCertVerifyLoading(false)
    }
  }

  if (dbError) {
    return (
      <div className="flex-1 p-12 flex flex-col items-center justify-center bg-slate-900 text-slate-100">
        <div className="max-w-md w-full bg-slate-950 border border-red-500/30 rounded-2xl p-8 text-center space-y-4 shadow-xl">
          <div className="text-red-500 text-3xl font-bold font-mono">⚠️</div>
          <h2 className="text-lg font-bold text-slate-200">Database unavailable</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            The PostgreSQL database is offline. Active registry records cannot be fetched or verified.
          </p>
          <button
            onClick={fetchApproved}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs rounded-lg text-slate-300 font-semibold transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-slate-900 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="border-b border-slate-800 pb-5">
          <h2 className="text-2xl font-bold tracking-tight text-white">Registry Verification Center</h2>
          <p className="text-sm text-slate-400 mt-1">
            Stage 5: Cryptographically verify signed land documents and public registry records.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Approved Documents Browser */}
          <div className="lg:col-span-1 space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Approved Registries</h3>
            
            {/* Search by Doc ID */}
            <form onSubmit={handleSearchSubmit} className="flex space-x-2">
              <input
                type="text"
                placeholder="Search by Document ID..."
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 text-xs rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-xs rounded-lg text-white font-semibold transition-colors"
              >
                Verify ID
              </button>
            </form>

            {/* List of Approved Records */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {loading ? (
                <div className="text-xs text-slate-500 py-4 text-center">Loading approved records...</div>
              ) : approvedRecords.length > 0 ? (
                approvedRecords.map((rec) => (
                  <button
                    key={rec.id}
                    onClick={() => handleRecordSelect(rec)}
                    className={`w-full text-left p-3.5 rounded-xl border text-xs transition-all ${
                      selectedRecord?.id === rec.id
                        ? 'bg-blue-600/10 border-blue-500/40 text-blue-400 shadow-md shadow-blue-500/5'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-semibold text-slate-200">{rec.document_id || 'Approved Record'}</div>
                    <div className="flex justify-between mt-1 text-[10px] text-slate-500">
                      <span>Owner: {rec.fields.owner_name.value}</span>
                      <span>{rec.village}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-6 text-center text-slate-500 text-xs border border-slate-850 rounded-xl border-dashed">
                  No approved documents found. Complete reviews in the queue first.
                </div>
              )}
            </div>

            {/* Certificate Signature Uploader box */}
            <div className="border border-slate-800 bg-slate-950/40 rounded-xl p-5 space-y-4">
              <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider">Independent Signer Verification</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Upload a JSON certificate containing the extracted land fields and signature block to check if the data has been altered.
              </p>
              
              <div className="flex flex-col space-y-3">
                <input
                  type="file"
                  id="cert-file"
                  accept=".json"
                  className="hidden"
                  onChange={handleCertUpload}
                />
                <label
                  htmlFor="cert-file"
                  className="cursor-pointer text-center bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs px-3 py-2 rounded-lg font-medium transition-colors"
                >
                  Choose JSON Certificate File
                </label>

                {uploadedCert && (
                  <div className="p-3 bg-slate-900 border border-slate-850 rounded-lg space-y-3">
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      File Loaded: Signature block exists
                    </div>
                    <button
                      onClick={verifyUploadedCert}
                      disabled={certVerifyLoading}
                      className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-[11px] font-semibold text-white rounded-md transition-colors"
                    >
                      {certVerifyLoading ? "Verifying..." : "Validate Certificate"}
                    </button>
                  </div>
                )}

                {certVerifyError && (
                  <div className="p-3 bg-red-950/20 border border-red-900/40 rounded-lg text-[10px] text-red-400 font-mono">
                    Failed: {certVerifyError}
                  </div>
                )}

                {certVerifyResult && (
                  <div className={`p-3 border rounded-lg text-center font-semibold text-[11px] ${
                    certVerifyResult.verified
                      ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-400'
                      : 'bg-rose-950/30 border-rose-800/40 text-rose-400'
                  }`}>
                    {certVerifyResult.verified 
                      ? "✓ CERTIFICATE AUTHENTIC" 
                      : "✗ INVALID / ALTERED DATA SIGNATURE"}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Cryptographic Verification Display panel */}
          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Cryptographic Details</h3>
            
            {verificationLoading ? (
              <div className="p-12 text-center text-slate-500 text-xs border border-slate-850 rounded-2xl bg-slate-950/20">
                Contacting Verification-Mark microservice...
              </div>
            ) : verificationResult ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Left side: verification status card */}
                <div className="md:col-span-1 space-y-4">
                  <div className={`p-5 rounded-2xl border text-center space-y-4 shadow-lg ${
                    verificationResult.verified
                      ? 'bg-emerald-950/20 border-emerald-800/40'
                      : 'bg-rose-950/20 border-rose-800/40'
                  }`}>
                    <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center bg-slate-900/50">
                      {verificationResult.verified ? (
                        <span className="text-emerald-400 text-xl font-bold">✓</span>
                      ) : (
                        <span className="text-rose-400 text-xl font-bold">✗</span>
                      )}
                    </div>
                    <div>
                      <div className={`text-base font-bold uppercase ${
                        verificationResult.verified ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {verificationResult.status}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                        {verificationResult.message}
                      </p>
                    </div>
                  </div>

                  {/* QR code section */}
                  {selectedRecord?.qr_code && (
                    <div className="border border-slate-800 bg-slate-950 rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-2.5">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Verification QR Link</div>
                      <div className="bg-white p-2 rounded-lg inline-block">
                        <img 
                          src={selectedRecord.qr_code}
                          alt="Verification QR Code" 
                          className="w-28 h-28"
                        />
                      </div>
                      <div className="text-[9px] text-slate-400 font-mono truncate max-w-full">
                        {selectedRecord.document_id}
                      </div>
                      {selectedRecord.document_id && (
                        <a
                          href={`?view=public-verify`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-blue-400 hover:text-blue-300 underline"
                          title={selectedRecord.document_id}
                        >
                          Open Public Verification Page ↗
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Right side: Signed registry fields & Key metadata */}
                <div className="md:col-span-2 space-y-6">
                  
                  {/* Registry Fields */}
                  <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
                    <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider border-b border-slate-900 pb-2">
                      Signed Data Fields
                    </h4>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
                      {Object.keys(verificationResult.record?.fields || selectedRecord?.fields || {}).map((key) => {
                        const field = (verificationResult.record?.fields || selectedRecord?.fields)[key]
                        return (
                          <div key={key} className="space-y-1">
                            <span className="text-[10px] text-slate-500 capitalize">{key.replace(/_/g, ' ')}</span>
                            <div className="font-medium text-slate-300 truncate">{String(field.value)}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Key Blocks */}
                  <div className="bg-slate-950/20 border border-slate-800 rounded-2xl p-5 space-y-4 text-[10px] font-mono text-slate-400">
                    <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider font-sans border-b border-slate-900 pb-2">
                      Signature Blocks
                    </h4>
                    <div className="space-y-2">
                      <div>
                        <span className="text-slate-500 font-bold block mb-1">DIGITAL SIGNATURE BLOCK (HEX)</span>
                        <div className="bg-slate-950 border border-slate-850 p-2 rounded max-h-16 overflow-y-auto break-all font-mono">
                          {selectedRecord?.signature || 'No signature block'}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500 font-bold block mb-1">SIGNER PUBLIC KEY</span>
                        <div className="bg-slate-950 border border-slate-850 p-2 rounded max-h-16 overflow-y-auto break-all font-mono">
                          {selectedRecord?.public_key || 'No public key block'}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 text-xs border border-slate-800 border-dashed rounded-2xl">
                Select an approved record from the left browser to check signature verification.
              </div>
            )}
            
            {verificationError && (
              <div className="p-4 bg-red-950/20 border border-red-900/40 rounded-xl text-xs text-red-400 font-mono">
                Error: {verificationError}
              </div>
            )}

            {verificationResult?.status === 'SERVICE_UNAVAILABLE' && (
              <div className="p-4 bg-orange-950/20 border border-orange-900/40 rounded-xl text-xs text-orange-400">
                <strong>Signing service offline:</strong> {verificationResult.message}
                <br />
                <span className="text-[10px] text-orange-500/70 mt-1 block">
                  Signature verification is temporarily unavailable. This is not an indication the record is invalid.
                </span>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  )
}
