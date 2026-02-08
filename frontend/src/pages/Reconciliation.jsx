import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { reconciliationApi, uploadApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'matched', label: 'Matched' },
  { value: 'partially_matched', label: 'Partially Matched' },
  { value: 'not_matched', label: 'Not Matched' },
  { value: 'duplicate', label: 'Duplicate' },
];

function differenceFields(differences = []) {
  return new Set(differences.map((difference) => difference.field));
}

export default function ReconciliationPage() {
  const { role } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [status, setStatus] = useState('');
  const [variancePercent, setVariancePercent] = useState(2);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [editingResultId, setEditingResultId] = useState('');
  const [editForm, setEditForm] = useState({
    transactionId: '',
    referenceNumber: '',
    amount: '',
    date: '',
    status: '',
    notes: '',
  });

  const canEdit = role === 'admin' || role === 'analyst';

  useEffect(() => {
    let ignore = false;

    async function loadJobs() {
      try {
        const response = await uploadApi.list({ uploadType: 'transaction' });
        if (!ignore) {
          const nextJobs = response.data.jobs || [];
          setJobs(nextJobs);
          if (!selectedJobId && nextJobs.length > 0) {
            setSelectedJobId(nextJobs[0]._id);
          }
        }
      } catch {
        if (!ignore) {
          setJobs([]);
        }
      }
    }

    loadJobs();

    return () => {
      ignore = true;
    };
  }, [selectedJobId]);

  const query = useMemo(() => {
    const params = {};
    if (selectedJobId) params.uploadJobId = selectedJobId;
    if (status) params.status = status;
    params.limit = 200;
    return params;
  }, [selectedJobId, status]);

  async function loadResults() {
    if (!selectedJobId) {
      setResults([]);
      return;
    }

    setLoading(true);
    setNotice('');

    try {
      const response = await reconciliationApi.results(query);
      setResults(response.data.results || []);
    } catch (error) {
      setNotice(error.response?.data?.message || 'Failed to load reconciliation results.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadResults();
  }, [selectedJobId, status]);

  async function triggerReconciliation() {
    if (!selectedJobId) {
      setNotice('Select a transaction upload job first.');
      return;
    }

    setLoading(true);
    setNotice('');

    try {
      const response = await reconciliationApi.trigger({
        uploadJobId: selectedJobId,
        matchingConfig: {
          partial: {
            variancePercent: Number(variancePercent),
          },
        },
      });

      setNotice(`Reconciliation completed. Accuracy: ${response.data.stats.accuracy}%`);
      await loadResults();
    } catch (error) {
      setNotice(error.response?.data?.message || 'Failed to trigger reconciliation.');
    } finally {
      setLoading(false);
    }
  }

  function beginEdit(result) {
    const uploaded = result.uploadedRecordId;
    setEditingResultId(result._id);
    setEditForm({
      transactionId: uploaded?.transactionId || '',
      referenceNumber: uploaded?.referenceNumber || '',
      amount: uploaded?.amount ?? '',
      date: uploaded?.date ? new Date(uploaded.date).toISOString().slice(0, 10) : '',
      status: result.status,
      notes: '',
    });
  }

  async function saveCorrection(resultId) {
    setLoading(true);
    setNotice('');

    try {
      await reconciliationApi.manualCorrection(resultId, {
        updates: {
          transactionId: editForm.transactionId,
          referenceNumber: editForm.referenceNumber,
          amount: Number(editForm.amount),
          date: editForm.date,
        },
        status: editForm.status,
        notes: editForm.notes,
      });

      setNotice('Manual correction applied and recorded in immutable audit log.');
      setEditingResultId('');
      await loadResults();
    } catch (error) {
      setNotice(error.response?.data?.message || 'Failed to save manual correction.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page-stack">
      <div className="page-header">
        <h2>Reconciliation View</h2>
        <p>Compare uploaded rows with system records and fix exceptions as needed.</p>
      </div>

      <div className="panel">
        <div className="filter-grid">
          <label>
            Upload Job
            <select value={selectedJobId} onChange={(event) => setSelectedJobId(event.target.value)}>
              <option value="">Select Job</option>
              {jobs.map((job) => (
                <option key={job._id} value={job._id}>
                  {job.fileName} - {job.status} ({new Date(job.createdAt).toLocaleString()})
                </option>
              ))}
            </select>
          </label>

          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {statusOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {canEdit && (
            <label>
              Partial Variance %
              <input
                type="number"
                min="0"
                step="0.1"
                value={variancePercent}
                onChange={(event) => setVariancePercent(event.target.value)}
              />
            </label>
          )}
        </div>

        {canEdit && (
          <button type="button" className="btn btn-secondary" onClick={triggerReconciliation} disabled={!selectedJobId || loading}>
            Re-run Reconciliation
          </button>
        )}
      </div>

      {notice && <p className="info-text">{notice}</p>}
      {loading && <p className="muted-text">Loading reconciliation data...</p>}

      <div className="result-grid">
        {results.length === 0 && <p className="muted-text">No reconciliation records found.</p>}

        {results.map((result) => {
          const uploaded = result.uploadedRecordId;
          const system = result.matchedSystemRecordId;
          const diffSet = differenceFields(result.differences);
          const isEditing = editingResultId === result._id;

          return (
            <article key={result._id} className="result-card">
              <div className="result-head">
                <span className={`badge ${result.status}`}>{result.status}</span>
                <span>Confidence: {result.confidence}%</span>
                <Link to={`/audit?recordId=${uploaded?._id}`}>View Audit Timeline</Link>
              </div>

              <div className="comparison-grid">
                <div>
                  <h4>Uploaded Record</h4>
                  <p className={diffSet.has('transactionId') ? 'mismatch' : ''}>Transaction ID: {uploaded?.transactionId || '-'}</p>
                  <p className={diffSet.has('referenceNumber') ? 'mismatch' : ''}>Reference Number: {uploaded?.referenceNumber || '-'}</p>
                  <p className={diffSet.has('amount') ? 'mismatch' : ''}>Amount: {uploaded?.amount ?? '-'}</p>
                  <p className={diffSet.has('date') ? 'mismatch' : ''}>Date: {uploaded?.date ? new Date(uploaded.date).toLocaleDateString() : '-'}</p>
                </div>
                <div>
                  <h4>System Record</h4>
                  <p className={diffSet.has('transactionId') ? 'mismatch' : ''}>Transaction ID: {system?.transactionId || '-'}</p>
                  <p className={diffSet.has('referenceNumber') ? 'mismatch' : ''}>Reference Number: {system?.referenceNumber || '-'}</p>
                  <p className={diffSet.has('amount') ? 'mismatch' : ''}>Amount: {system?.amount ?? '-'}</p>
                  <p className={diffSet.has('date') ? 'mismatch' : ''}>Date: {system?.date ? new Date(system.date).toLocaleDateString() : '-'}</p>
                </div>
              </div>

              {result.differences?.length > 0 && (
                <div className="differences-box">
                  <h5>Mismatched Fields</h5>
                  <ul>
                    {result.differences.map((difference, index) => (
                      <li key={`${result._id}-diff-${index}`}>
                        {difference.field}: uploaded={String(difference.uploadedValue ?? '-')} / system={String(difference.systemValue ?? '-')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {canEdit && !isEditing && (
                <button type="button" className="btn btn-ghost" onClick={() => beginEdit(result)}>
                  Manual Correction
                </button>
              )}

              {canEdit && isEditing && (
                <div className="panel nested-panel">
                  <h4>Manual Correction Form</h4>
                  <div className="filter-grid">
                    <label>
                      Transaction ID
                      <input
                        value={editForm.transactionId}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, transactionId: event.target.value }))}
                      />
                    </label>
                    <label>
                      Reference Number
                      <input
                        value={editForm.referenceNumber}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, referenceNumber: event.target.value }))}
                      />
                    </label>
                    <label>
                      Amount
                      <input
                        type="number"
                        value={editForm.amount}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, amount: event.target.value }))}
                      />
                    </label>
                    <label>
                      Date
                      <input
                        type="date"
                        value={editForm.date}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, date: event.target.value }))}
                      />
                    </label>
                    <label>
                      New Status
                      <select
                        value={editForm.status}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, status: event.target.value }))}
                      >
                        <option value="matched">Matched</option>
                        <option value="partially_matched">Partially Matched</option>
                        <option value="not_matched">Not Matched</option>
                        <option value="duplicate">Duplicate</option>
                      </select>
                    </label>
                  </div>

                  <label>
                    Notes
                    <textarea
                      rows={2}
                      value={editForm.notes}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, notes: event.target.value }))}
                    />
                  </label>

                  <div className="button-row">
                    <button type="button" className="btn btn-primary" onClick={() => saveCorrection(result._id)}>
                      Save Correction
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setEditingResultId('')}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
