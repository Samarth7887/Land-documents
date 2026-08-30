import { useEffect, useState } from 'react';
import StatusBadge from '../../components/StatusBadge';

const WORKFLOW_FILTERS = [
  'All',
  'Processing',
  'Ready for review',
  'Approved',
  'Failed',
];

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value, fallback = '—') {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString();
}

function formatCount(value) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function normalizeStatus(status = '') {
  return String(status || '').toLowerCase();
}

function getDocumentStage(doc) {
  const docStatus = normalizeStatus(doc.doc_status);
  const jobStatus = normalizeStatus(doc.job_status);
  const recordCount = toNumber(doc.record_count);
  const approvedCount = toNumber(doc.approved_count);
  const correctedCount = toNumber(doc.corrected_count);

  if (docStatus === 'failed' || jobStatus === 'failed') {
    return {
      label: 'Failed',
      description: 'The pipeline could not complete processing for this upload.',
      tone: 'failed',
    };
  }

  if (docStatus === 'processing' || jobStatus === 'pending' || jobStatus === 'processing') {
    return {
      label: 'Processing',
      description: 'The document is still being processed by the backend pipeline.',
      tone: 'processing',
    };
  }

  if (docStatus === 'preprocessed' && recordCount > 0) {
    if (approvedCount > 0 && approvedCount === recordCount) {
      return {
        label: 'Approved',
        description: 'All extracted records for this document have been approved.',
        tone: 'approved',
      };
    }

    if (correctedCount > 0) {
      return {
        label: 'Ready for review',
        description: 'Records were extracted and at least one record has been corrected.',
        tone: 'review',
      };
    }

    return {
      label: 'Ready for review',
      description: 'Extraction is complete and the document is ready for manual review.',
      tone: 'review',
    };
  }

  if (docStatus === 'pending') {
    return {
      label: 'Queued',
      description: 'The upload has been received and is waiting to enter the pipeline.',
      tone: 'queued',
    };
  }

  return {
    label: docStatus || jobStatus || 'Unknown',
    description: 'Backend status returned without a more specific workflow stage.',
    tone: 'neutral',
  };
}

function getToneClasses(tone) {
  switch (tone) {
    case 'approved':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400';
    case 'review':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-400';
    case 'processing':
      return 'border-sky-500/20 bg-sky-500/10 text-sky-400';
    case 'failed':
      return 'border-red-500/20 bg-red-500/10 text-red-400';
    case 'queued':
      return 'border-slate-700 bg-slate-800/70 text-slate-300';
    default:
      return 'border-slate-700 bg-slate-800/70 text-slate-300';
  }
}

function getReviewStatusLabel(doc) {
  const recordCount = toNumber(doc.record_count);
  const approvedCount = toNumber(doc.approved_count);
  const correctedCount = toNumber(doc.corrected_count);

  if (recordCount === 0) return 'No records';
  if (approvedCount > 0 && approvedCount === recordCount) return 'Completed';
  if (correctedCount > 0) return 'Corrected';
  return 'Pending';
}

export default function Documents({ onViewChange }) {
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [docDetails, setDocDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [dbError, setDbError] = useState(false);
  const [detailsError, setDetailsError] = useState('');

  const fetchDocuments = async () => {
    setLoading(true);
    setDbError(false);
    try {
      const res = await fetch('http://localhost:5000/api/documents');
      if (!res.ok) {
        throw new Error(`Failed to fetch documents (${res.status})`);
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.documents)) {
        setDocuments(data.documents);
      } else {
        throw new Error(data.error || 'Unexpected documents response');
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
      setDocuments([]);
      setDbError(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetails = async (id) => {
    setDetailsLoading(true);
    setSelectedDocId(id);
    setDocDetails(null);
    setDetailsError('');
    try {
      const res = await fetch(`http://localhost:5000/api/documents/${id}`);
      if (!res.ok) throw new Error('Could not fetch details');
      const data = await res.json();
      if (data.success) {
        setDocDetails(data);
      } else {
        throw new Error(data.error || 'Unexpected document detail response');
      }
    } catch (err) {
      console.error(err);
      setDetailsError(err.message || 'Unable to load document details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const closeDetails = () => {
    setSelectedDocId(null);
    setDocDetails(null);
    setDetailsError('');
  };

  const summary = {
    total: documents.length,
    processing: documents.filter((doc) => getDocumentStage(doc).tone === 'processing').length,
    review: documents.filter((doc) => getDocumentStage(doc).tone === 'review').length,
    approved: documents.filter((doc) => getDocumentStage(doc).tone === 'approved').length,
  };

  const [activeFilter, setActiveFilter] = useState('All');

  const filteredDocuments = [...documents].filter((doc) => {
    if (activeFilter === 'All') return true;
    return getDocumentStage(doc).label === activeFilter;
  });

  if (dbError) {
    return (
      <div className="flex-1 bg-slate-900 px-4 py-10 text-slate-100 md:px-6">
        <div className="mx-auto flex max-w-2xl flex-col items-center justify-center rounded-3xl border border-red-500/20 bg-slate-950/80 p-8 text-center shadow-2xl shadow-slate-950/40">
          <div className="text-3xl font-bold text-red-400">⚠</div>
          <h2 className="mt-4 text-lg font-semibold text-white">Documents unavailable</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
            The backend could not return the document list. Check the API connection and try again.
          </p>
          <button
            onClick={fetchDocuments}
            className="mt-6 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800"
          >
            Retry connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-900 px-4 py-6 text-slate-100 md:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-2xl shadow-slate-950/40 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-blue-300">
                Documents
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
                  Uploaded documents and pipeline status
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                  This view shows real document rows returned by <span className="font-mono text-slate-300">GET /api/documents</span> with their actual backend status, progress, and extracted record counts.
                </p>
              </div>
            </div>

            <button
              onClick={() => onViewChange('upload')}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-200 transition-colors hover:border-blue-500/30 hover:bg-blue-500/15"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"></path>
              </svg>
              Upload document
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Documents loaded</div>
              <div className="mt-2 text-2xl font-semibold text-white">{summary.total}</div>
              <div className="mt-1 text-xs text-slate-500">From the live documents API</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Processing</div>
              <div className="mt-2 text-2xl font-semibold text-white">{summary.processing}</div>
              <div className="mt-1 text-xs text-slate-500">Currently in the pipeline</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Ready for review</div>
              <div className="mt-2 text-2xl font-semibold text-white">{summary.review}</div>
              <div className="mt-1 text-xs text-slate-500">Extraction complete, review pending</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Approved</div>
              <div className="mt-2 text-2xl font-semibold text-white">{summary.approved}</div>
              <div className="mt-1 text-xs text-slate-500">Signed and finalized records</div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {WORKFLOW_FILTERS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setActiveFilter(option)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeFilter === option
                      ? 'border-blue-500/30 bg-blue-500/10 text-blue-200'
                      : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            <button
              onClick={fetchDocuments}
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800"
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-3xl border border-slate-800 bg-slate-950/80 py-20 shadow-2xl shadow-slate-950/40">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-950/80 px-6 py-12 text-center shadow-2xl shadow-slate-950/40">
            <h3 className="text-lg font-semibold text-white">
              {documents.length === 0 ? 'No documents found' : 'No documents match this filter'}
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
              {documents.length === 0
                ? 'Upload a scanned land document to start the pipeline. Real documents will appear here after upload.'
                : 'Choose a different status filter or upload another document to see more records.'}
            </p>
            <button
              onClick={() => onViewChange('upload')}
              className="mt-5 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-200 transition-colors hover:border-blue-500/30 hover:bg-blue-500/15"
            >
              Upload document
            </button>
          </div>
        ) : (
          <>
            <div className="md:hidden space-y-4">
              {filteredDocuments.map((doc) => {
                const stage = getDocumentStage(doc);
                const recordCount = toNumber(doc.record_count);
                const approvedCount = toNumber(doc.approved_count);
                const progress = doc.progress === null || doc.progress === undefined ? null : toNumber(doc.progress);

                return (
                  <article
                    key={doc.id}
                    className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg shadow-slate-950/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">Document</div>
                        <div className="mt-1 truncate text-sm font-semibold text-white">{doc.filename || 'Unnamed document'}</div>
                        <div className="mt-1 text-xs text-slate-500">ID {doc.id}</div>
                      </div>
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${getToneClasses(stage.tone)}`}>
                        {stage.label}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Upload date</div>
                        <div className="mt-1 font-medium text-slate-200">{formatDate(doc.created_at)}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Progress</div>
                        <div className="mt-1 font-medium text-slate-200">
                          {doc.job_status === 'completed' ? '100%' : progress === null ? '—' : `${progress}%`}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Records</div>
                        <div className="mt-1 font-medium text-slate-200">{recordCount}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Approved</div>
                        <div className="mt-1 font-medium text-slate-200">{approvedCount}</div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Processing status</span>
                        <span className="font-medium text-slate-200">{doc.job_status || doc.doc_status || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Review status</span>
                        <span className="font-medium text-slate-200">{getReviewStatusLabel(doc)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Job message</span>
                        <span className="max-w-[190px] truncate font-medium text-slate-200">{doc.job_message || '—'}</span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => fetchDetails(doc.id)}
                        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800"
                      >
                        Open details
                      </button>
                      {doc.job_status === 'completed' && recordCount > 0 && approvedCount !== recordCount && (
                        <button
                          onClick={() => onViewChange('review')}
                          className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-200 transition-colors hover:border-amber-500/30 hover:bg-amber-500/15"
                        >
                          Review records
                        </button>
                      )}
                      {approvedCount > 0 && approvedCount === recordCount && recordCount > 0 && (
                        <button
                          onClick={() => onViewChange('verify')}
                          className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/15"
                        >
                          Verify
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/80 shadow-2xl shadow-slate-950/40 md:block">
              <div className="overflow-x-auto">
                <table className="min-w-[1180px] w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      <th className="p-4">Document</th>
                      <th className="p-4">Uploaded</th>
                      <th className="p-4">Pipeline status</th>
                      <th className="p-4 text-center">Progress</th>
                      <th className="p-4 text-center">Records</th>
                      <th className="p-4 text-center">Approved</th>
                      <th className="p-4">Review state</th>
                      <th className="p-4">Last message</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {filteredDocuments.map((doc) => {
                      const stage = getDocumentStage(doc);
                      const recordCount = toNumber(doc.record_count);
                      const approvedCount = toNumber(doc.approved_count);
                      const progress = doc.progress === null || doc.progress === undefined ? null : toNumber(doc.progress);

                      return (
                        <tr key={doc.id} className="transition-colors hover:bg-slate-900/70">
                          <td className="p-4 align-top">
                            <div className="max-w-[260px]">
                              <div className="truncate text-sm font-semibold text-white">{doc.filename || 'Unnamed document'}</div>
                              <div className="mt-1 font-mono text-[11px] text-slate-500">{doc.id}</div>
                            </div>
                          </td>
                          <td className="p-4 align-top text-slate-400">{formatDate(doc.created_at)}</td>
                          <td className="p-4 align-top">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getToneClasses(stage.tone)}`}>
                              {stage.label}
                            </span>
                            <div className="mt-2 max-w-[220px] text-[11px] leading-5 text-slate-500">
                              {stage.description}
                            </div>
                          </td>
                          <td className="p-4 align-top text-center">
                            <span className="inline-flex rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200">
                              {doc.job_status === 'completed' ? '100%' : progress === null ? '—' : `${progress}%`}
                            </span>
                          </td>
                          <td className="p-4 align-top text-center font-mono text-sm text-slate-200">
                            {formatCount(recordCount)}
                          </td>
                          <td className="p-4 align-top text-center font-mono text-sm text-slate-200">
                            {formatCount(approvedCount)}
                          </td>
                          <td className="p-4 align-top">
                            <StatusBadge status={approvedCount > 0 && approvedCount === recordCount && recordCount > 0 ? 'approved' : recordCount > 0 ? 'extracted' : 'pending_approval'} />
                            <div className="mt-2 text-[11px] leading-5 text-slate-500">
                              {getReviewStatusLabel(doc)}
                            </div>
                          </td>
                          <td className="p-4 align-top">
                            <div className="max-w-[240px] text-[11px] leading-5 text-slate-400">
                              {doc.job_message || '—'}
                            </div>
                          </td>
                          <td className="p-4 align-top text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => fetchDetails(doc.id)}
                                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800"
                              >
                                Open
                              </button>
                              {doc.job_status === 'completed' && recordCount > 0 && approvedCount !== recordCount && (
                                <button
                                  onClick={() => onViewChange('review')}
                                  className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-200 transition-colors hover:border-amber-500/30 hover:bg-amber-500/15"
                                >
                                  Review
                                </button>
                              )}
                              {approvedCount > 0 && approvedCount === recordCount && recordCount > 0 && (
                                <button
                                  onClick={() => onViewChange('verify')}
                                  className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/15"
                                >
                                  Verify
                                </button>
                              )}
                              {doc.job_status === 'processing' && (
                                <button
                                  onClick={() => onViewChange('upload')}
                                  className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-200 transition-colors hover:border-blue-500/30 hover:bg-blue-500/15"
                                >
                                  Upload more
                                </button>
                              )}
                            </div>
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

      {selectedDocId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm">
          <div className="flex h-full w-full max-w-4xl flex-col border-l border-slate-800 bg-slate-900 shadow-2xl shadow-slate-950/60">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4 md:px-6">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Document details
                </div>
                <h3 className="mt-1 truncate text-lg font-semibold text-white">
                  {docDetails?.document?.filename || 'Document details'}
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full border border-slate-800 bg-slate-950 px-2.5 py-0.5 text-xs text-slate-300">
                    ID {selectedDocId}
                  </span>
                  <span className="rounded-full border border-slate-800 bg-slate-950 px-2.5 py-0.5 text-xs text-slate-300">
                    Status {docDetails?.document?.status || '—'}
                  </span>
                  <span className="rounded-full border border-slate-800 bg-slate-950 px-2.5 py-0.5 text-xs text-slate-300">
                    Updated {formatDate(docDetails?.document?.updated_at, '—')}
                  </span>
                </div>
              </div>
              <button
                onClick={closeDetails}
                className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300 transition-colors hover:border-slate-700 hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            {detailsLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
              </div>
            ) : detailsError ? (
              <div className="flex flex-1 items-center justify-center px-6">
                <div className="w-full max-w-xl rounded-3xl border border-amber-500/20 bg-amber-950/20 p-6 text-center text-sm text-amber-200">
                  <div className="text-lg font-semibold text-amber-100">Unable to load document details</div>
                  <div className="mt-2 text-xs leading-6 text-amber-100/80">{detailsError}</div>
                  <button
                    onClick={() => fetchDetails(selectedDocId)}
                    className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-200 transition-colors hover:border-amber-500/30 hover:bg-amber-500/15"
                  >
                    Retry details
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-5 py-5 md:px-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Filename</div>
                    <div className="mt-2 break-words text-sm font-medium text-white">
                      {docDetails?.document?.filename || '—'}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Created</div>
                    <div className="mt-2 text-sm font-medium text-white">
                      {formatDate(docDetails?.document?.created_at)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Backend status</div>
                    <div className="mt-2 text-sm font-medium text-white">
                      {docDetails?.document?.status || '—'}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Processed records</div>
                    <div className="mt-2 text-sm font-medium text-white">
                      {docDetails?.records?.length ?? 0}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Processing history</h4>
                        <p className="mt-2 text-xs leading-6 text-slate-400">
                          Real job state and progress returned by the backend.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {docDetails?.jobs?.length > 0 ? (
                        docDetails.jobs.map((job) => {
                          const jobProgress = job.progress === null || job.progress === undefined ? '—' : `${job.progress}%`;
                          return (
                            <div key={job.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="font-mono text-xs text-slate-300">{job.id}</div>
                                  <div className="mt-1 text-[11px] text-slate-500">Created {formatDate(job.created_at)}</div>
                                </div>
                                <StatusBadge status={job.status === 'completed' ? 'approved' : job.status === 'failed' ? 'failed' : 'extracted'} />
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                                <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5">
                                  Status {job.status || '—'}
                                </span>
                                <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5">
                                  Progress {jobProgress}
                                </span>
                              </div>
                              <div className="mt-3 text-xs leading-6 text-slate-400">
                                {job.message || '—'}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">
                          No processing history returned by the backend.
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                    <div>
                      <h4 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Review and verification state</h4>
                      <p className="mt-2 text-xs leading-6 text-slate-400">
                        This section shows actual extracted records, corrections, approvals, and audit entries from the backend.
                      </p>
                    </div>

                    <div className="mt-4 space-y-3">
                      {docDetails?.records?.length > 0 ? (
                        docDetails.records.map((rec) => {
                          const fields = rec.extracted_fields || {};
                          return (
                            <div key={rec.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="font-mono text-xs text-slate-300">{rec.id}</div>
                                  <div className="mt-1 text-[11px] text-slate-500">
                                    {rec.document_id_code ? `Verification ID ${rec.document_id_code}` : 'No verification ID returned'}
                                  </div>
                                </div>
                                <StatusBadge status={rec.status === 'approved' ? 'approved' : rec.status === 'corrected' ? 'corrected' : 'extracted'} />
                              </div>

                              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                {['owner_name', 'survey_number', 'village', 'district', 'area', 'area_unit'].map((key) => {
                                  const field = fields[key];
                                  if (!field) return null;
                                  return (
                                    <div key={key} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{key.replace(/_/g, ' ')}</div>
                                      <div className="mt-1 text-sm font-medium text-slate-100">
                                        {field.value === null || field.value === undefined || field.value === '' ? '—' : String(field.value)}
                                      </div>
                                      <div className="mt-1 text-[11px] text-slate-500">
                                        Confidence {field.confidence !== undefined ? `${Math.round(Number(field.confidence) * 100)}%` : '—'}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">
                          No extracted records returned for this document.
                        </div>
                      )}

                      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Approvals</div>
                        <div className="mt-3 space-y-2">
                          {docDetails?.approvals?.length > 0 ? (
                            docDetails.approvals.map((approval) => (
                              <div key={approval.id} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-medium text-slate-100">
                                    {approval.supervisor_name || 'Supervisor'}
                                  </span>
                                  <span className="text-slate-500">{formatDate(approval.approved_at)}</span>
                                </div>
                                <div className="mt-1 text-slate-500">Signed approval returned by the backend.</div>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-slate-400">No approvals returned.</div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Corrections</div>
                        <div className="mt-3 space-y-2">
                          {docDetails?.corrections?.length > 0 ? (
                            docDetails.corrections.map((correction) => (
                              <div key={correction.id} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-medium text-slate-100">{correction.field_name}</span>
                                  <span className="text-slate-500">{correction.reviewer_name || 'Reviewer'}</span>
                                </div>
                                <div className="mt-1 text-slate-500">
                                  {formatDate(correction.timestamp)}
                                </div>
                                <div className="mt-2 text-slate-400">
                                  {String(correction.original_value ?? '—')} → {String(correction.corrected_value ?? '—')}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-slate-400">No corrections returned.</div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Audit log</div>
                        <div className="mt-3 space-y-2">
                          {docDetails?.auditLogs?.length > 0 ? (
                            docDetails.auditLogs.map((entry) => (
                              <div key={entry.id} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-medium text-slate-100">{entry.actor_name || 'System'}</span>
                                  <span className="text-slate-500">{formatDate(entry.timestamp)}</span>
                                </div>
                                <div className="mt-1 text-slate-400">
                                  {entry.previous_state || 'None'} → {entry.new_state || '—'}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-slate-400">No audit entries returned.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
