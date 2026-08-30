import { useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:5000';

const STATUS_CONFIG = {
  VERIFIED: {
    icon: '✓',
    label: 'Verified',
    color: 'emerald',
    description: 'Record is authentic. Signature verified against the signed canonical hash.',
  },
  TAMPERED: {
    icon: '✗',
    label: 'Tampered',
    color: 'rose',
    description: 'Signature mismatch — the record has been altered since it was signed.',
  },
  NOT_FOUND: {
    icon: '?',
    label: 'Not Found',
    color: 'amber',
    description: 'No verified record found for this ID.',
  },
  SERVICE_UNAVAILABLE: {
    icon: '!',
    label: 'Service Unavailable',
    color: 'orange',
    description: 'Signature verification service is currently offline. Please try again later.',
  },
};

const FIELD_LABELS = {
  survey_number: 'Survey Number',
  village: 'Village',
  taluk: 'Taluk',
  district: 'District',
  area: 'Area',
  area_unit: 'Unit',
  land_type: 'Land Type',
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['NOT_FOUND'];
  const colorMap = {
    emerald: {
      wrapper: 'bg-emerald-950/20 border-emerald-800/40',
      icon: 'bg-emerald-500/10 text-emerald-400',
      label: 'text-emerald-400',
      msg: 'text-slate-350',
    },
    rose: {
      wrapper: 'bg-rose-950/20 border-rose-900/30',
      icon: 'bg-rose-500/10 text-rose-400',
      label: 'text-rose-400',
      msg: 'text-slate-350',
    },
    amber: {
      wrapper: 'bg-amber-950/20 border-amber-900/30',
      icon: 'bg-amber-500/10 text-amber-400',
      label: 'text-amber-400',
      msg: 'text-slate-350',
    },
    orange: {
      wrapper: 'bg-orange-950/20 border-orange-900/30',
      icon: 'bg-orange-500/10 text-orange-400',
      label: 'text-orange-400',
      msg: 'text-slate-350',
    },
  };
  const c = colorMap[cfg.color];

  return (
    <div className={`rounded-2xl border p-6 flex flex-col items-center text-center gap-4 shadow-md ${c.wrapper}`}>
      <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${c.icon}`}>
        {cfg.icon}
      </div>
      <div>
        <div className={`text-xl font-bold uppercase tracking-wider ${c.label}`}>{cfg.label}</div>
        <p className={`text-xs mt-2.5 leading-relaxed max-w-xs ${c.msg}`}>{cfg.description}</p>
      </div>
    </div>
  );
}

export default function PublicVerify() {
  const [inputId, setInputId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [networkError, setNetworkError] = useState(null);

  // Core verification function
  const triggerVerify = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    setResult(null);
    setNetworkError(null);

    try {
      const res = await fetch(`${API_BASE}/api/records/public-verify/${encodeURIComponent(id)}`);
      const data = await res.json();

      if (res.status === 503) {
        setResult({ ...data, status: data.status || 'SERVICE_UNAVAILABLE' });
      } else if (res.status === 404) {
        setResult({ ...data, status: 'NOT_FOUND' });
      } else {
        setResult(data);
      }
    } catch (err) {
      setNetworkError('Cannot reach the verification server. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleVerifySubmit = (e) => {
    e.preventDefault();
    const id = inputId.trim();
    if (id) {
      triggerVerify(id);
    }
  };

  // Auto-verify if ID is passed in query parameters (e.g. ?view=public-verify&id=xxx)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    if (idParam) {
      setInputId(idParam);
      triggerVerify(idParam);
    }
  }, [triggerVerify]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-600/40 flex items-center justify-center text-emerald-400 font-bold text-sm">
          ✓
        </div>
        <div>
          <div className="text-sm font-bold text-white tracking-tight">Terravision Land Registry</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Public Document Verification</div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-start py-12 md:py-16 px-4">
        <div className="w-full max-w-lg space-y-8">

          {/* Hero Header */}
          <div className="text-center space-y-2.5">
            <h1 className="text-3xl font-bold tracking-tight text-white">Verify a Land Record</h1>
            <p className="text-sm text-slate-400 leading-relaxed max-w-sm mx-auto">
              Enter a Verification ID from a land record certificate or scan the QR code to check
              its authenticity and integrity.
            </p>
          </div>

          {/* Search Form */}
          <form onSubmit={handleVerifySubmit} className="space-y-3">
            <div className="flex gap-2">
              <input
                id="verification-id-input"
                type="text"
                placeholder="Enter verification ID (UUID)…"
                value={inputId}
                onChange={(e) => setInputId(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 text-sm rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 outline-none transition-all font-mono"
                spellCheck={false}
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={loading || !inputId.trim()}
                id="verify-btn"
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all shadow-md"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Checking
                  </span>
                ) : 'Verify'}
              </button>
            </div>
            <p className="text-[11px] text-slate-550 text-center">
              The verification ID is printed on official land record certificates and encoded in the QR code.
            </p>
          </form>

          {/* Network Error Alert */}
          {networkError && (
            <div className="p-4 bg-rose-950/20 border border-rose-900/40 rounded-xl text-xs text-rose-450 font-mono shadow-sm">
              ⚠ {networkError}
            </div>
          )}

          {/* Loading Skeleton */}
          {loading && (
            <div className="space-y-4 animate-pulse">
              <div className="h-32 bg-slate-900/50 border border-slate-800 rounded-2xl"></div>
              <div className="h-40 bg-slate-900/50 border border-slate-800 rounded-2xl"></div>
            </div>
          )}

          {/* Verification Results Panel */}
          {!loading && result && (
            <div className="space-y-6">

              {/* Status Badge Card */}
              <StatusBadge status={result.status} />

              {/* Meta Records Details */}
              {result.success && (
                <>
                  {/* Document Information */}
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3.5 shadow-md">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-800/80">
                      Document Information
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Verification ID</span>
                        <span className="text-slate-300 font-mono break-all block mt-0.5">{result.verificationId || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Record ID</span>
                        <span className="text-slate-300 font-mono block mt-0.5">{result.recordId || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Record Status</span>
                        <span className="text-emerald-400 font-bold uppercase block mt-0.5">{result.recordStatus || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Verified At</span>
                        <span className="text-slate-300 block mt-0.5">
                          {result.verifiedAt ? new Date(result.verifiedAt).toLocaleString() : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Cadastral Records Summary */}
                  {result.summary && Object.keys(result.summary).length > 0 && (
                    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3.5 shadow-md">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-800/80">
                        Record Summary
                      </h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5 text-xs">
                        {Object.entries(result.summary).map(([key, val]) => (
                          <div key={key}>
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">
                              {FIELD_LABELS[key] || key.replace(/_/g, ' ')}
                            </span>
                            <span className="text-slate-200 font-semibold block mt-0.5">{val !== null && val !== undefined && val !== '' ? String(val) : '—'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* QR Code Container */}
                  {result.qrCode && (
                    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-col items-center gap-3.5 shadow-md">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Verification QR Code
                      </h2>
                      <div className="bg-white p-3 rounded-xl inline-block shadow-lg">
                        <img
                          src={result.qrCode}
                          alt="Verification QR Code"
                          className="w-36 h-36"
                        />
                      </div>
                      <p className="text-[10px] text-slate-600 text-center leading-relaxed max-w-xs">
                        Scan this QR code to re-verify this record at any time.
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Explicit signing service error */}
              {result.status === 'SERVICE_UNAVAILABLE' && (
                <div className="p-4 bg-orange-950/20 border border-orange-900/40 rounded-xl text-xs text-orange-450 leading-relaxed shadow-sm">
                  <strong>Signing service offline:</strong> {result.message}
                  <br />
                  <span className="text-[10px] text-orange-500/70 mt-1 block">
                    This is not an indication the record is invalid. Please retry when the service is back online.
                  </span>
                </div>
              )}

            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 text-center mt-auto">
        <p className="text-[10px] text-slate-600 font-mono uppercase tracking-wider">
          Terravision Digital Registry System © 2026 · Public Verification Portal
        </p>
      </footer>
    </div>
  );
}
