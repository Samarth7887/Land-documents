import { useState, useCallback, useEffect } from 'react';

export default function Administration() {
  const [healthData, setHealthData] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState(null);

  // Interactive Developer Preprocessing States
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultImage, setResultImage] = useState(null);
  const [resultMetadata, setResultMetadata] = useState(null);
  const [consoleError, setConsoleError] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setConsoleError(null);
      setResultImage(null);
      setResultMetadata(null);
    }
  };

  const handleTestPipeline = async () => {
    if (!selectedFile) {
      setConsoleError("Please select a land record scan file (PNG, JPG, or PDF) first.");
      return;
    }

    setIsProcessing(true);
    setConsoleError(null);
    setResultImage(null);
    setResultMetadata(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    const startTime = Date.now();

    try {
      const response = await fetch("http://localhost:5000/api/preprocessing/process", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const imgUrl = URL.createObjectURL(blob);
      const duration = Date.now() - startTime;

      setResultImage(imgUrl);
      setResultMetadata({
        status: `${response.status} ${response.statusText}`,
        timeMs: duration,
        sizeBytes: (blob.size / 1024).toFixed(2) + " KB",
        contentType: blob.type
      });
    } catch (err) {
      setConsoleError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const res = await fetch('http://localhost:5000/api/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setHealthData(await res.json());
    } catch (err) {
      setHealthError(err.message);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  return (
    <div className="flex-1 p-4 md:p-8 overflow-y-auto bg-slate-900 text-slate-100 min-h-0">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-6 gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">Administration & Diagnostics</h2>
            <p className="text-sm text-slate-400 mt-2">
              Configure system microservices, check health states, and run low-level pipeline checks.
            </p>
          </div>
          <button
            onClick={fetchHealth}
            disabled={healthLoading}
            className="self-start md:self-auto px-4 py-2 text-xs rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-700 border border-slate-700 text-slate-300 font-semibold transition-all disabled:opacity-50 shadow-md"
          >
            {healthLoading ? 'Checking status...' : 'Refresh Service Health'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Left Column: Health Monitor & Ports map */}
          <div className="lg:col-span-1 space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Microservice Status</h3>
            
            {/* Overall Status Banner */}
            {healthLoading ? (
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/20 text-xs text-slate-500 flex items-center space-x-2">
                <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span>Checking system status...</span>
              </div>
            ) : healthData ? (
              <div className={`p-4 rounded-xl border text-xs font-bold flex items-center space-x-3 shadow-sm ${
                healthData.overall === 'healthy'
                  ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-400'
                  : 'bg-amber-950/30 border-amber-800/40 text-amber-400'
              }`}>
                <span className={`w-2.5 h-2.5 rounded-full ${
                  healthData.overall === 'healthy' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}></span>
                <span>
                  System is {healthData.overall === 'healthy' ? 'FULLY OPERATIONAL' : 'DEGRADED'}
                </span>
              </div>
            ) : null}

            {healthError && (
              <div className="p-4 bg-rose-950/20 border border-rose-900/40 rounded-xl text-xs text-rose-400 font-mono shadow-sm">
                <div>✗ Connection to backend failed: {healthError}</div>
                <span className="text-[10px] text-rose-500/70 block mt-1">Ensure the backend application is running.</span>
              </div>
            )}

            {/* Service Lists */}
            <div className="space-y-3">
              {healthLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-16 bg-slate-950/40 border border-slate-800/60 rounded-xl animate-pulse"></div>
                  ))}
                </div>
              ) : healthData ? (
                healthData.services.map((svc, i) => {
                  const isOnline = svc.status === 'online';
                  return (
                    <div
                      key={i}
                      className={`p-4 rounded-xl border flex items-center justify-between shadow-sm transition-colors ${
                        isOnline
                          ? 'bg-slate-950 border-slate-800/60'
                          : 'bg-rose-950/10 border-rose-900/30'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-4">
                        <div className="text-xs font-bold text-slate-200 truncate">{svc.name}</div>
                        {svc.detail && (
                          <div className="text-[10px] text-slate-500 font-mono mt-1 overflow-x-auto whitespace-pre scrollbar-none">
                            {typeof svc.detail === 'object' ? JSON.stringify(svc.detail) : String(svc.detail)}
                          </div>
                        )}
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 border ${
                        isOnline
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {svc.status.toUpperCase()}
                      </span>
                    </div>
                  );
                })
              ) : (
                !healthError && !healthLoading && (
                  <div className="p-6 text-center text-slate-500 text-xs border border-slate-800 border-dashed rounded-xl">
                    No status data available. Check backend ports.
                  </div>
                )
              )}
            </div>

            {/* Port Legend Card */}
            <div className="border border-slate-800/60 bg-slate-950/40 rounded-xl p-4 text-[11px] font-mono space-y-2 text-slate-400 shadow-md">
              <div className="text-slate-200 font-semibold mb-3 font-sans text-xs uppercase tracking-wider">Port Mapping</div>
              <div className="flex justify-between border-b border-slate-900/50 pb-1.5"><span>Port 5000</span> <span className="text-slate-500">Express API Gateway</span></div>
              <div className="flex justify-between border-b border-slate-900/50 pb-1.5"><span>Port 8010</span> <span className="text-slate-500">Preprocessing Service</span></div>
              <div className="flex justify-between border-b border-slate-900/50 pb-1.5"><span>Port 8011</span> <span className="text-slate-500">Extraction Service</span></div>
              <div className="flex justify-between border-b border-slate-900/50 pb-1.5"><span>Port 8012</span> <span className="text-slate-500">Validation Service</span></div>
              <div className="flex justify-between border-b border-slate-900/50 pb-1.5"><span>Port 8013</span> <span className="text-slate-500">Pipeline Orchestrator</span></div>
              <div className="flex justify-between"><span>Port 8014</span> <span className="text-slate-500">Verification-Mark Service</span></div>
            </div>

          </div>

          {/* Right Column: Preprocessing Diagnostic Test Platform */}
          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Developer Diagnostic Sandbox</h3>
            
            <div className="bg-slate-950/40 border border-slate-800/60 rounded-2xl p-6 space-y-6 backdrop-blur-sm shadow-xl">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 border-b border-slate-900 pb-4">
                <div>
                  <h4 className="font-semibold text-slate-200 text-sm">Test Preprocessing Pipeline</h4>
                  <p className="text-slate-400 text-xs leading-relaxed mt-1">
                    Manually run scans through the image processing engine to observe deskewing, noise-reduction, and contrast-stretching outputs.
                  </p>
                </div>
                <code className="text-[10px] bg-slate-900 px-2 py-1 rounded text-indigo-400 border border-slate-800/60 font-mono self-start">
                  POST /api/preprocessing/process
                </code>
              </div>

              {/* Upload Input Area */}
              <div className="border-2 border-slate-800 bg-slate-950/80 rounded-xl p-8 flex flex-col items-center justify-center border-dashed hover:border-slate-700 transition-colors">
                <input 
                  type="file" 
                  id="admin-upload" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleFileChange}
                />
                <label 
                  htmlFor="admin-upload"
                  className="cursor-pointer bg-slate-900 border border-slate-800 hover:border-blue-500 hover:bg-slate-800 text-slate-300 text-xs px-4 py-2 rounded-lg font-medium transition-all"
                >
                  {selectedFile ? "Change Image" : "Choose Test Registry Image"}
                </label>
                {selectedFile && (
                  <div className="text-xs text-slate-400 mt-3 font-mono">
                    {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end">
                <button 
                  onClick={handleTestPipeline}
                  disabled={isProcessing || !selectedFile}
                  className="px-5 py-2.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold transition-all shadow-md"
                >
                  {isProcessing ? "Processing scan..." : "Start Preprocessing Service Check"}
                </button>
              </div>

              {/* Console Error */}
              {consoleError && (
                <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-xl text-xs text-rose-400 font-mono">
                  Error: {consoleError}
                </div>
              )}

              {/* Results visualization */}
              {resultImage && (
                <div className="border border-slate-800 bg-slate-950 rounded-xl p-4 space-y-4 shadow-inner">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-900 pb-2">
                    Pipeline Response Output
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 border border-slate-900 rounded-lg overflow-hidden bg-slate-900/60 flex items-center justify-center p-4">
                      <img 
                        src={resultImage} 
                        alt="Preprocessed Result Output" 
                        className="max-h-[280px] w-auto rounded border border-slate-800 shadow-sm"
                      />
                    </div>
                    <div className="bg-slate-900/40 p-4 rounded-lg border border-slate-900 font-mono text-[10px] space-y-2.5 text-slate-300">
                      <div className="text-slate-500 font-bold uppercase tracking-wider border-b border-slate-900 pb-1.5 mb-1.5">Response Details</div>
                      <div><span className="text-slate-500">Status:</span> <span className="text-emerald-400 font-semibold">{resultMetadata.status}</span></div>
                      <div><span className="text-slate-500">Latency:</span> <span className="text-indigo-400">{resultMetadata.timeMs}ms</span></div>
                      <div><span className="text-slate-500">Output Size:</span> <span className="text-indigo-400">{resultMetadata.sizeBytes}</span></div>
                      <div><span className="text-slate-500">Type:</span> <span className="text-indigo-400">{resultMetadata.contentType}</span></div>
                      <div className="pt-2 text-emerald-400 font-bold font-sans border-t border-slate-900/50 mt-2">✓ Preprocessing complete. Scanner code validation passed.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
