import { useEffect, useState } from 'react';
import StatusBadge from '../../components/StatusBadge';

const FILTER_OPTIONS = [
  'All',
  'Needs Review',
  'Needs Correction',
  'Corrected',
  'Pending Approval',
  'Approved',
  'Failed',
];

const SUMMARY_FIELD_KEYS = ['owner_name', 'survey_number', 'village', 'district'];

export default function ReviewQueue() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [sortKey, setSortKey] = useState('overallStatus');
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const normalizeStatus = (status = '') => String(status || '').toLowerCase();

  const getStatusLabel = (status = '') => {
    switch (normalizeStatus(status)) {
      case 'approved':
        return 'Approved';
      case 'corrected':
        return 'Corrected';
      case 'extracted':
      case 'review':
        return 'Needs Review';
      case 'correction_needed':
        return 'Needs Correction';
      case 'pending_approval':
        return 'Pending Approval';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  const getStatusDescription = (status = '') => {
    switch (normalizeStatus(status)) {
      case 'approved':
        return 'Ready for registry verification';
      case 'corrected':
        return 'Reviewed and corrected';
      case 'extracted':
      case 'review':
        return 'AI extraction complete, human review pending';
      case 'correction_needed':
        return 'Needs field correction before approval';
      case 'pending_approval':
        return 'Awaiting final approval';
      case 'failed':
        return 'Processing failed';
      default:
        return 'Status unavailable';
    }
  };

  const getStatusBadgeClass = (status = '') => {
    switch (normalizeStatus(status)) {
      case 'approved':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'corrected':
        return 'bg-blue-500/10 text-blue-300 border-blue-500/20';
      case 'extracted':
      case 'review':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'correction_needed':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'pending_approval':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      case 'failed':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getFieldValue = (record, key, fallback = '—') => {
    const value = record?.fields?.[key]?.value;
    if (value === null || value === undefined || value === '') return fallback;
    if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : 'None';
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
  };

  const formatFieldValue = (value) => {
    if (value === null || value === undefined || value === '') return '—';
    if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : 'None';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
  };

  const confidenceForRecord = (rec) => {
    const fields = rec.fields || {};
    const confidences = Object.values(fields)
      .map((field) => Number(field?.confidence))
      .filter((value) => Number.isFinite(value));

    if (confidences.length === 0) return 0;

    const average = confidences.reduce((sum, value) => sum + value, 0) / confidences.length;
    return Math.round(average * 100);
  };

  const confidenceBand = (score) => {
    if (score >= 90) {
      return {
        label: 'High confidence',
        classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      };
    }

    if (score >= 60) {
      return {
        label: 'Needs review',
        classes: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      };
    }

    return {
      label: 'Low confidence',
      classes: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    };
  };

  const issuesCount = (rec) => {
    const fields = rec.fields || {};
    return Object.values(fields).filter((field) => field?.issue).length;
  };

  const fetchRecords = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('http://localhost:5000/api/records');
      if (!res.ok) throw new Error(`Failed to fetch records (${res.status})`);
      const data = await res.json();
      if (data.success && data.records) {
        setRecords(data.records);
      } else {
        throw new Error(data.error || 'Unexpected records response');
      }
    } catch (e) {
      console.error(e);
      setRecords([]);
      setError(e.message || 'Failed to load records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const applyFilter = (rec) => {
    const status = normalizeStatus(rec.overallStatus);
    switch (filter) {
      case 'Needs Review':
        return status === 'review' || status === 'extracted';
      case 'Needs Correction':
        return status === 'correction_needed';
      case 'Corrected':
        return status === 'corrected';
      case 'Pending Approval':
        return status === 'pending_approval';
      case 'Approved':
        return status === 'approved';
      case 'Failed':
        return status === 'failed';
      default:
        return true;
    }
  };

  const sortedRecords = [...records]
    .filter(applyFilter)
    .sort((a, b) => {
      const av = sortKey === 'confidence' ? confidenceForRecord(a) : String(a[sortKey] || '');
      const bv = sortKey === 'confidence' ? confidenceForRecord(b) : String(b[sortKey] || '');
      if (av < bv) return sortOrder === 'asc' ? -1 : 1;
      if (av > bv) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  const openDetails = async (id) => {
    setDetailsLoading(true);
    setSelectedRecord(null);
    setShowAdvanced(false);
    setDetailsError('');
    try {
      const res = await fetch(`http://localhost:5000/api/records/${id}`);
      if (!res.ok) throw new Error('Failed to fetch record');
      const data = await res.json();
      if (data.success) {
        setSelectedRecord(data.record);
      } else {
        throw new Error(data.error || 'Unexpected record response');
      }
    } catch (e) {
      console.error(e);
      setDetailsError(e.message || 'Failed to load record details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const totalRecords = records.length;
  const filteredCount = sortedRecords.length;
  const reviewCount = records.filter((rec) => {
    const status = normalizeStatus(rec.overallStatus);
    return status === 'review' || status === 'extracted' || status === 'correction_needed' || status === 'pending_approval';
  }).length;
  const approvedCount = records.filter((rec) => normalizeStatus(rec.overallStatus) === 'approved').length;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-900 px-4 py-6 text-slate-100 md:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-2xl shadow-slate-950/40 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-blue-300">
                Review Queue
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
                  Extracted records awaiting review
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                  Real records returned by <span className="font-mono text-slate-300">GET /api/records</span> are shown here with their extracted fields, confidence, and review status.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={fetchRecords}
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800"
              >
                Refresh queue
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Records in view</div>
              <div className="mt-2 text-2xl font-semibold text-white">{filteredCount}</div>
              <div className="mt-1 text-xs text-slate-500">Of {totalRecords} total loaded</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Needs review</div>
              <div className="mt-2 text-2xl font-semibold text-white">{reviewCount}</div>
              <div className="mt-1 text-xs text-slate-500">Extracted or correction-pending records</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Approved</div>
              <div className="mt-2 text-2xl font-semibold text-white">{approvedCount}</div>
              <div className="mt-1 text-xs text-slate-500">Completed and signed records</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Backend state</div>
              <div className="mt-2 text-2xl font-semibold text-white">{error ? 'Error' : loading ? 'Loading' : 'Online'}</div>
              <div className="mt-1 text-xs text-slate-500">Live fetch from the records API</div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    filter === option
                      ? 'border-blue-500/30 bg-blue-500/10 text-blue-200'
                      : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none transition-colors focus:border-blue-500/40"
              >
                <option value="overallStatus">Status</option>
                <option value="updated_at">Updated</option>
                <option value="confidence">Confidence</option>
              </select>
              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-slate-700 hover:bg-slate-900"
              >
                {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-950/20 px-4 py-3 text-sm text-red-300">
            <div className="font-semibold text-red-200">Unable to load review records</div>
            <div className="mt-1 text-xs leading-5 text-red-200/80">{error}</div>
          </div>
        )}

        {detailsError && !selectedRecord && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
            <div className="font-semibold text-amber-100">Record details unavailable</div>
            <div className="mt-1 text-xs leading-5 text-amber-100/80">{detailsError}</div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center rounded-3xl border border-slate-800 bg-slate-950/80 py-20 shadow-2xl shadow-slate-950/40">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-500/20 bg-slate-950/80 px-6 py-10 text-center shadow-2xl shadow-slate-950/40">
            <h3 className="text-lg font-semibold text-white">Review queue unavailable</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
              The backend could not return records. Check the API connection and try again.
            </p>
            <button
              type="button"
              onClick={fetchRecords}
              className="mt-5 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800"
            >
              Retry
            </button>
          </div>
        ) : sortedRecords.length === 0 ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-950/80 px-6 py-12 text-center shadow-2xl shadow-slate-950/40">
            <h3 className="text-lg font-semibold text-white">No records match this filter</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
              When the pipeline extracts new land records, they will appear here automatically.
            </p>
          </div>
        ) : (
          <>
            <div className="md:hidden space-y-4">
              {sortedRecords.map((rec) => {
                const confidence = confidenceForRecord(rec);
                const band = confidenceBand(confidence);
                return (
                  <article
                    key={rec.id}
                    className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg shadow-slate-950/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">
                          Record {rec.id}
                        </div>
                        <div className="mt-1 truncate text-sm font-semibold text-white">
                          {getFieldValue(rec, 'owner_name')}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Document {rec.document_id || '—'}
                        </div>
                      </div>
                      <StatusBadge status={rec.overallStatus} />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Survey</div>
                        <div className="mt-1 font-medium text-slate-200">{getFieldValue(rec, 'survey_number')}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Village</div>
                        <div className="mt-1 font-medium text-slate-200">{getFieldValue(rec, 'village')}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Confidence</div>
                        <div className="mt-1 font-medium text-slate-200">
                          {confidence}% <span className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] ${band.classes}`}>{band.label}</span>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Issues</div>
                        <div className="mt-1 font-medium text-slate-200">{issuesCount(rec)}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="text-[11px] text-slate-500">
                        Updated {formatDate(rec.updated_at || rec.created_at)}
                      </div>
                      <button
                        type="button"
                        onClick={() => openDetails(rec.id)}
                        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800"
                      >
                        Review record
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/80 shadow-2xl shadow-slate-950/40 md:block">
              <div className="overflow-x-auto">
                <table className="min-w-[1120px] w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      <th className="p-4">Record</th>
                      <th className="p-4">Document</th>
                      <th className="p-4">Fields</th>
                      <th className="p-4 text-center">Confidence</th>
                      <th className="p-4 text-center">Issues</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Updated</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {sortedRecords.map((rec) => {
                      const confidence = confidenceForRecord(rec);
                      const band = confidenceBand(confidence);

                      return (
                        <tr key={rec.id} className="transition-colors hover:bg-slate-900/70">
                          <td className="p-4 align-top">
                            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">Record</div>
                            <div className="mt-1 font-mono text-sm text-slate-200">{rec.id}</div>
                          </td>
                          <td className="p-4 align-top">
                            <div className="font-semibold text-slate-100">{rec.document_id || '—'}</div>
                            <div className="mt-1 text-[11px] text-slate-500">Document identifier from the backend</div>
                          </td>
                          <td className="p-4 align-top">
                            <div className="grid gap-2">
                              {SUMMARY_FIELD_KEYS.map((key) => (
                                <div key={key} className="rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-2">
                                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{key.replace(/_/g, ' ')}</div>
                                  <div className="mt-1 font-medium text-slate-200">{getFieldValue(rec, key)}</div>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="p-4 align-top text-center">
                            <div className="inline-flex flex-col items-center gap-2">
                              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${band.classes}`}>
                                {confidence}%
                              </span>
                              <div className="text-[11px] text-slate-500">{band.label}</div>
                            </div>
                          </td>
                          <td className="p-4 align-top text-center">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${issuesCount(rec) > 0 ? 'border-amber-500/20 bg-amber-500/10 text-amber-400' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'}`}>
                              {issuesCount(rec)}
                            </span>
                          </td>
                          <td className="p-4 align-top">
                            <StatusBadge status={rec.overallStatus} />
                            <div className="mt-2 max-w-[240px] text-[11px] leading-5 text-slate-500">
                              {getStatusDescription(rec.overallStatus)}
                            </div>
                          </td>
                          <td className="p-4 align-top text-slate-400">
                            {formatDate(rec.updated_at || rec.created_at)}
                          </td>
                          <td className="p-4 align-top text-right">
                            <button
                              type="button"
                              onClick={() => openDetails(rec.id)}
                              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800"
                            >
                              Review
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm">
          <div className="flex h-full w-full max-w-4xl flex-col border-l border-slate-800 bg-slate-900 shadow-2xl shadow-slate-950/60">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4 md:px-6">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Review details
                </div>
                <h3 className="mt-1 truncate text-lg font-semibold text-white">
                  {selectedRecord.id}
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge status={selectedRecord.overallStatus} />
                  <span className="rounded-full border border-slate-800 bg-slate-950 px-2.5 py-0.5 text-xs text-slate-300">
                    Document {selectedRecord.document_id || '—'}
                  </span>
                  <span className="rounded-full border border-slate-800 bg-slate-950 px-2.5 py-0.5 text-xs text-slate-300">
                    Confidence {confidenceForRecord(selectedRecord)}%
                  </span>
                  <span className="rounded-full border border-slate-800 bg-slate-950 px-2.5 py-0.5 text-xs text-slate-300">
                    Issues {issuesCount(selectedRecord)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300 transition-colors hover:border-slate-700 hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            {detailsLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-5 py-5 md:px-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Owner</div>
                    <div className="mt-2 text-sm font-medium text-slate-100">{getFieldValue(selectedRecord, 'owner_name')}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Survey number</div>
                    <div className="mt-2 text-sm font-medium text-slate-100">{getFieldValue(selectedRecord, 'survey_number')}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Village</div>
                    <div className="mt-2 text-sm font-medium text-slate-100">{getFieldValue(selectedRecord, 'village')}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">District</div>
                    <div className="mt-2 text-sm font-medium text-slate-100">{getFieldValue(selectedRecord, 'district')}</div>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm text-slate-300">
                    Review the extracted field values below. Missing backend fields stay blank and are never filled with demo data.
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAdvanced((value) => !value)}
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800"
                    >
                      {showAdvanced ? 'Hide raw OCR' : 'Show raw OCR'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openDetails(selectedRecord.id)}
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800"
                    >
                      Refresh record
                    </button>
                  </div>
                </div>

                {showAdvanced && (
                  <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Raw OCR payload
                    </div>
                    <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-800 bg-slate-900 p-4 text-xs leading-6 text-slate-300">
                      {formatFieldValue(selectedRecord.fields?.raw_ocr_text?.value || selectedRecord.fields?.raw_ocr_text || '')}
                    </pre>
                  </div>
                )}

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {Object.entries(selectedRecord.fields || {}).length > 0 ? (
                    Object.entries(selectedRecord.fields || {}).map(([key, fld]) => {
                      const fieldConfidence = Number(fld?.confidence);
                      const fieldBand = confidenceBand(Number.isFinite(fieldConfidence) ? Math.round(fieldConfidence * 100) : 0);

                      return (
                        <div key={key} className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                                {key.replace(/_/g, ' ')}
                              </div>
                              <div className="mt-2 text-sm font-medium text-slate-100">
                                {formatFieldValue(fld?.value)}
                              </div>
                            </div>
                            <div className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${fieldBand.classes}`}>
                              {Number.isFinite(fieldConfidence) ? `${Math.round(fieldConfidence * 100)}%` : '—'}
                            </div>
                          </div>
                          {fld?.issue && (
                            <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                              {fld.issue}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-400 md:col-span-2">
                      No extracted fields are available for this record.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
