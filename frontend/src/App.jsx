import { useState, useCallback } from 'react'
import VerificationConsole from './pages/verification-console/VerificationConsole'
import Dashboard from './pages/dashboard/Dashboard'
import DocumentUpload from './pages/pipeline/DocumentUpload'

function App() {
  const [activeView, setActiveView] = useState('verification') // default to verification console
  const [activeTab, setActiveTab] = useState('preprocessing')

  // Service Health Monitor States
  const [healthData, setHealthData] = useState(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [healthError, setHealthError] = useState(null)

  // Interactive Developer Console States
  const [selectedFile, setSelectedFile] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [resultImage, setResultImage] = useState(null)
  const [resultMetadata, setResultMetadata] = useState(null)
  const [consoleError, setConsoleError] = useState(null)

  const services = [
    { id: 'preprocessing', name: 'Preprocessing', desc: 'Noise reduction, deskewing, and resizing.', endpoint: '/api/preprocessing/process' },
    { id: 'extraction', name: 'Extraction', desc: 'OCR & Key-Value structured data extraction.', endpoint: '/api/extraction/extract' },
    { id: 'validation', name: 'Validation', desc: 'Business logic & field validation checks.', endpoint: '/api/validation/validate' },
    { id: 'verification', name: 'Verification', desc: 'Cross-matching with external databases.', endpoint: '/api/verification/verify' },
  ]

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
      setConsoleError(null)
      setResultImage(null)
      setResultMetadata(null)
    }
  }

  const handleTestPipeline = async () => {
    if (!selectedFile) {
      setConsoleError("Please select a land record scan file (PNG, JPG, or PDF) first.")
      return
    }

    setIsProcessing(true)
    setConsoleError(null)
    setResultImage(null)
    setResultMetadata(null)

    const formData = new FormData()
    formData.append("file", selectedFile)

    const startTime = Date.now()

    try {
      const response = await fetch("http://localhost:5000/api/preprocessing/process", {
        method: "POST",
        body: formData
      })

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`)
      }

      const blob = await response.blob()
      const imgUrl = URL.createObjectURL(blob)
      const duration = Date.now() - startTime

      setResultImage(imgUrl)
      setResultMetadata({
        status: `${response.status} ${response.statusText}`,
        timeMs: duration,
        sizeBytes: (blob.size / 1024).toFixed(2) + " KB",
        contentType: blob.type
      })
    } catch (err) {
      setConsoleError(err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true)
    setHealthError(null)
    try {
      const res = await fetch('http://localhost:5000/api/health')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setHealthData(await res.json())
    } catch (err) {
      setHealthError(err.message)
    } finally {
      setHealthLoading(false)
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-950 px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
            LR
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">
              Terravision
            </h1>
            <p className="text-xs text-slate-400">Land Record Digitization Suite</p>
          </div>
        </div>

        {/* Global Navigation View Selector */}
        <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex space-x-1">
          <button
            onClick={() => setActiveView('verification')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeView === 'verification'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Clerk Verification Console
          </button>
          <button
            onClick={() => setActiveView('dashboard')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeView === 'dashboard'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Oversight Dashboard
          </button>
          <button
            onClick={() => setActiveView('developer')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeView === 'developer'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Developer Platform
          </button>
          <button
            onClick={() => { setActiveView('health'); fetchHealth() }}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeView === 'health'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Service Health
          </button>
          <button
            onClick={() => setActiveView('upload')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeView === 'upload'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ⬆ Document Upload
          </button>
        </div>

        <div className="flex items-center space-x-4">
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-900 text-slate-400 border border-slate-800">
            Local Dev Mode
          </span>
        </div>
      </header>

      {/* Main Content Area depending on Active View */}
      {activeView === 'verification' && <VerificationConsole />}
      {activeView === 'dashboard' && <Dashboard />}
      {activeView === 'upload' && <DocumentUpload />}
      {activeView === 'health' && (
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-100">Service Health Monitor</h2>
                <p className="text-xs text-slate-400 mt-0.5">Live status of all Terravision microservices</p>
              </div>
              <button
                onClick={fetchHealth}
                disabled={healthLoading}
                className="px-4 py-2 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-medium transition-all disabled:opacity-50"
              >
                {healthLoading ? '⟳ Checking...' : '↻ Refresh'}
              </button>
            </div>

            {/* Overall Status Banner */}
            {healthData && (
              <div className={`p-4 rounded-xl border font-semibold text-sm flex items-center space-x-3 ${
                healthData.overall === 'healthy'
                  ? 'bg-emerald-950/40 border-emerald-700/40 text-emerald-400'
                  : 'bg-amber-950/40 border-amber-700/40 text-amber-400'
              }`}>
                <span className={`w-2.5 h-2.5 rounded-full ${
                  healthData.overall === 'healthy' ? 'bg-emerald-400' : 'bg-amber-400'
                }`}></span>
                <span>
                  System is <strong>{healthData.overall === 'healthy' ? 'FULLY OPERATIONAL' : 'DEGRADED'}</strong>
                  {healthData.overall !== 'healthy' && ' — some services are offline'}
                </span>
              </div>
            )}

            {/* Error */}
            {healthError && (
              <div className="p-4 bg-red-950/40 border border-red-800/40 rounded-xl text-red-400 text-xs font-mono">
                ✗ Failed to reach Express backend: {healthError}<br/>
                <span className="text-red-500/70">Make sure `npm run dev` (or `node run-dev.js`) is running.</span>
              </div>
            )}

            {/* Service Cards */}
            {healthData && (
              <div className="grid grid-cols-1 gap-3">
                {healthData.services.map((svc, i) => (
                  <div
                    key={i}
                    className={`p-4 rounded-xl border flex items-center justify-between ${
                      svc.status === 'online'
                        ? 'bg-slate-950 border-slate-800'
                        : 'bg-red-950/20 border-red-900/40'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        svc.status === 'online' ? 'bg-emerald-400 shadow-emerald-400/50 shadow-sm' : 'bg-red-500'
                      }`}></span>
                      <div>
                        <div className="text-sm font-semibold text-slate-200">{svc.name}</div>
                        {svc.status === 'offline' && svc.error && (
                          <div className="text-[10px] text-red-400 font-mono mt-0.5">{svc.error}</div>
                        )}
                        {svc.detail && (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {JSON.stringify(svc.detail)}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                      svc.status === 'online'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {svc.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Instructions when no data yet */}
            {!healthData && !healthError && !healthLoading && (
              <div className="p-8 text-center text-slate-500 text-sm border border-slate-800 rounded-xl border-dashed">
                Click <strong className="text-slate-400">↻ Refresh</strong> to check service status
              </div>
            )}

            {/* Service map legend */}
            <div className="border border-slate-800 rounded-xl p-4 text-xs font-mono space-y-1 text-slate-500">
              <div className="text-slate-400 font-semibold mb-2 font-sans uppercase tracking-wider text-[10px]">Port Map</div>
              <div>5000 → Express Backend (Node.js API proxy)</div>
              <div>8000 → Preprocessing Service (deskew, enhance)</div>
              <div>8001 → Extraction Service (OCR, key-value)</div>
              <div>8002 → Validation Service (field rules)</div>
              <div>8003 → Pipeline Orchestrator (end-to-end)</div>
              <div>8004 → Signing / Verification Service (RSA)</div>
            </div>
          </div>
        </div>
      )}
      {activeView === 'developer' && (
        <div className="flex-1 flex flex-col">
          {/* Main Grid Layout for Developer Services */}
          <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
            
            {/* Navigation / Service Tabs */}
            <section className="md:col-span-1 space-y-2">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider px-3 mb-3">
                Digitization Services
              </h2>
              {services.map((service) => (
                <button
                  key={service.id}
                  onClick={() => {
                    setActiveTab(service.id)
                    setSelectedFile(null)
                    setResultImage(null)
                    setResultMetadata(null)
                    setConsoleError(null)
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 border ${
                    activeTab === service.id
                      ? 'bg-blue-600/10 border-blue-500/40 text-blue-400 shadow-md shadow-blue-500/5'
                      : 'bg-slate-950/20 border-transparent text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                  }`}
                >
                  <div className="font-semibold text-sm">{service.name}</div>
                  <div className="text-xs mt-0.5 opacity-80 line-clamp-1">{service.desc}</div>
                </button>
              ))}
            </section>

            {/* Console / Interaction Area */}
            <section className="md:col-span-3 bg-slate-950/40 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between backdrop-blur-sm">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-slate-100">
                    {services.find(s => s.id === activeTab)?.name} Service
                  </h3>
                  <code className="text-xs bg-slate-900 px-3 py-1.5 rounded-md text-indigo-400 border border-slate-800">
                    POST {services.find(s => s.id === activeTab)?.endpoint}
                  </code>
                </div>
                
                <p className="text-slate-400 text-sm">
                  {services.find(s => s.id === activeTab)?.desc} Configure this module to convert physical land registries into queryable database entries.
                </p>

                {activeTab === 'preprocessing' ? (
                  <div className="space-y-4">
                    {/* Interactive File Upload Area */}
                    <div className="border border-slate-800 bg-slate-950 rounded-xl p-6 flex flex-col items-center justify-center border-dashed">
                      <input 
                        type="file" 
                        id="console-upload" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleFileChange}
                      />
                      <label 
                        htmlFor="console-upload"
                        className="cursor-pointer bg-slate-900 border border-slate-800 hover:border-blue-500 hover:bg-slate-800/50 text-slate-300 text-xs px-4 py-2.5 rounded-lg font-medium transition-all"
                      >
                        {selectedFile ? "Change File" : "Choose Scan Image"}
                      </label>
                      {selectedFile && (
                        <div className="text-xs text-slate-400 mt-2 font-mono">
                          Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                        </div>
                      )}
                    </div>

                    {/* console actions */}
                    <div className="flex justify-end space-x-3">
                      <button 
                        onClick={handleTestPipeline}
                        disabled={isProcessing}
                        className="px-5 py-2 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium shadow-lg shadow-blue-600/20 transition-all"
                      >
                        {isProcessing ? "Processing Scan..." : "Test Preprocessing Pipeline"}
                      </button>
                    </div>

                    {/* Errors */}
                    {consoleError && (
                      <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-xs text-red-400 font-mono">
                        Error: {consoleError}
                      </div>
                    )}

                    {/* Result View */}
                    {resultImage && (
                      <div className="border border-slate-800 bg-slate-950 rounded-xl p-4 space-y-4">
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Pipeline Preprocessing Response Output
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-2 border border-slate-900 rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center p-4">
                            <img 
                              src={resultImage} 
                              alt="Preprocessed Result Output" 
                              className="max-h-[300px] w-auto rounded border border-slate-850"
                            />
                          </div>
                          <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-900 font-mono text-[10px] space-y-2">
                            <div className="text-slate-500 font-semibold uppercase">Response Metadata</div>
                            <div><span className="text-slate-400">Status:</span> <span className="text-emerald-400 font-bold">{resultMetadata.status}</span></div>
                            <div><span className="text-slate-400">Latency:</span> <span className="text-indigo-400">{resultMetadata.timeMs}ms</span></div>
                            <div><span className="text-slate-400">File Size:</span> <span className="text-indigo-400">{resultMetadata.sizeBytes}</span></div>
                            <div><span className="text-slate-400">Mime Type:</span> <span className="text-indigo-400">{resultMetadata.contentType}</span></div>
                            <div className="pt-2 text-emerald-500 font-semibold font-sans">✓ Preprocessing complete. Image deskewed & enhanced successfully.</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border border-slate-800 bg-slate-950 rounded-xl p-6 flex items-center justify-center text-slate-500 text-xs font-mono border-dashed">
                    Select the Preprocessing tab above to test API processing.
                  </div>
                )}
              </div>
            </section>
          </main>

          {/* Footer */}
          <footer className="border-t border-slate-800/60 bg-slate-950/20 py-4 px-6 text-center text-xs text-slate-500 mt-auto">
            &copy; {new Date().getFullYear()} Terravision Digitization Platform. All rights reserved.
          </footer>
        </div>
      )}
    </div>
  )
}

export default App
