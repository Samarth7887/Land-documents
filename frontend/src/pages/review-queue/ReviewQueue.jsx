import { useState, useEffect } from 'react';

export default function ReviewQueue() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [sortKey, setSortKey] = useState('overallStatus');
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
const [showAdvanced, setShowAdvanced] = useState(false);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/records');
      if (!res.ok) throw new Error('Failed to fetch records');
      const data = await res.json();
      if (data.success && data.records) {
        setRecords(data.records);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const applyFilter = (rec) => {
    switch (filter) {
      case 'Needs Review':
        return rec.overallStatus === 'review';
      case 'Needs Correction':
        return rec.overallStatus === 'correction_needed';
      case 'Corrected':
        return rec.overallStatus === 'corrected';
      case 'Pending Approval':
        return rec.overallStatus === 'pending_approval';
      case 'Approved':
        return rec.overallStatus === 'approved';
      default:
        return true;
    }
  };

  const sortedRecords = [...records]
    .filter(applyFilter)
    .sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av < bv) return sortOrder === 'asc' ? -1 : 1;
      if (av > bv) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  const confidenceForRecord = (rec) => {
    const fields = rec.fields || {};
    const confidences = Object.values(fields)
      .map(f => parseFloat(f.confidence))
      .filter(v => !isNaN(v));
    if (confidences.length === 0) return 0;
    return (confidences.reduce((a, b) => a + b, 0) / confidences.length).toFixed(2);
  };

  // Determine a validation icon based on confidence thresholds
  const validationIcon = (conf) => {
    const c = parseFloat(conf);
    if (isNaN(c)) return '';
    if (c >= 0.9) return '✅'; // high confidence
    if (c >= 0.6) return '⚠️'; // needs review
    return '❌'; // low confidence
  };

  const issuesCount = (rec) => {
    const fields = rec.fields || {};
    return Object.values(fields).filter(f => f.issue).length;
  };

  const openDetails = async (id) => {
    setDetailsLoading(true);
    setSelectedRecord(null);
    try {
      const res = await fetch(`http://localhost:5000/api/records/${id}`);
      if (!res.ok) throw new Error('Failed to fetch record');
      const data = await res.json();
      if (data.success) setSelectedRecord(data.record);
    } catch (e) {
      console.error(e);
    } finally {
      setDetailsLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-slate-900 text-slate-100 relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">Review Queue</h2>
        <div className="flex space-x-2">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="bg-slate-800 text-slate-200 text-sm rounded px-2 py-1"
          >
            <option>All</option>
            <option>Needs Review</option>
            <option>Needs Correction</option>
            <option>Corrected</option>
            <option>Pending Approval</option>
            <option>Approved</option>
          </select>
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value)}
            className="bg-slate-800 text-slate-200 text-sm rounded px-2 py-1"
          >
            <option value="overallStatus">Status</option>
            <option value="updated_at">Updated</option>
            <option value="confidence">Confidence</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="bg-slate-800 text-slate-200 text-sm rounded px-2 py-1"
          >{sortOrder === 'asc' ? '↑' : '↓'}</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950 text-slate-400 uppercase tracking-wider">
              <th className="p-2">Record ID</th>
              <th className="p-2">Document</th>
              <th className="p-2">Owner</th>
              <th className="p-2">Survey</th>
              <th className="p-2">Village</th>
              <th className="p-2 text-center">Confidence</th>
              <th className="p-2 text-center">Issues</th>
              <th className="p-2">Status</th>
              <th className="p-2">Updated</th>
              <th className="p-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850">
            {sortedRecords.map(rec => (
              <tr key={rec.id} className="hover:bg-slate-800 transition-colors">
                <td className="p-2 font-mono text-slate-300">{rec.id.slice(0, 8)}…</td>
                <td className="p-2 text-slate-300">{rec.document_id || 'N/A'}</td>
                <td className="p-2 text-slate-300">{rec.fields?.owner_name?.value || '—'}</td>
                <td className="p-2 text-slate-300">{rec.fields?.survey_number?.value || '—'}</td>
                <td className="p-2 text-slate-300">{rec.fields?.village?.value || '—'}</td>
                <td className="p-2 text-center text-slate-300">{confidenceForRecord(rec)} {validationIcon(confidenceForRecord(rec))}</td>
                <td className="p-2 text-center text-slate-300">{issuesCount(rec)}</td>
                <td className="p-2 text-slate-300 capitalize">{rec.overallStatus}</td>
                <td className="p-2 text-slate-300">{rec.updated_at ? new Date(rec.updated_at).toLocaleDateString() : '—'}</td>
                <td className="p-2 text-right">
                  <button
                    onClick={() => openDetails(rec.id)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded"
                  >Open</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Details Drawer */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-2xl bg-slate-900 p-6 overflow-y-auto h-full">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
              <h3 className="text-lg font-bold text-white">Record {selectedRecord.id.slice(0, 8)}…</h3>
              <button onClick={() => setSelectedRecord(null)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>
            {detailsLoading ? (
              <div className="flex justify-center items-center py-10">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-4 text-slate-300 text-sm">
                <div><strong>Document ID:</strong> {selectedRecord.document_id || 'N/A'}</div>
                <div><strong>Status:</strong> {selectedRecord.overallStatus}</div>
                <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs text-indigo-400 underline">
                  {showAdvanced ? 'Hide Raw OCR' : 'Show Raw OCR'}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(selectedRecord.fields || {}).map(([key, fld]) => (
                    <div key={key} className="border border-slate-800 p-2 rounded">
                      <div className="font-medium text-indigo-400 capitalize">{key}</div>
                      <div>Value: <span className="font-semibold text-slate-200">{fld.value}</span></div>
                      <div>Confidence: <span className="font-semibold text-slate-200">{fld.confidence}</span></div>
                      {fld.issue && <div className="text-rose-400">Issue: {fld.issue}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
