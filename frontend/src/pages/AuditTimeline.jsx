import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { auditApi } from '../api/endpoints';

export default function AuditTimelinePage() {
  const [searchParams] = useSearchParams();
  const [recordId, setRecordId] = useState(searchParams.get('recordId') || '');
  const [timeline, setTimeline] = useState([]);
  const [recordMeta, setRecordMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadTimeline(targetRecordId) {
    if (!targetRecordId) {
      setError('Enter a record ID to view audit timeline.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await auditApi.recordTimeline(targetRecordId);
      setTimeline(response.data.timeline || []);
      setRecordMeta(response.data.record || null);
    } catch (requestError) {
      setTimeline([]);
      setRecordMeta(null);
      setError(requestError.response?.data?.message || 'Failed to load audit timeline.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (searchParams.get('recordId')) {
      loadTimeline(searchParams.get('recordId'));
    }
  }, [searchParams]);

  return (
    <section className="page-stack">
      <div className="page-header">
        <h2>Audit Timeline</h2>
        <p>Visual, immutable sequence of changes: who changed what, when, and from which source.</p>
      </div>

      <div className="panel">
        <div className="filter-grid">
          <label>
            Record ID
            <input
              type="text"
              value={recordId}
              onChange={(event) => setRecordId(event.target.value)}
              placeholder="Paste record ObjectId"
            />
          </label>
        </div>

        <button type="button" className="btn btn-primary" onClick={() => loadTimeline(recordId)}>
          Load Timeline
        </button>
      </div>

      {loading && <p className="muted-text">Fetching timeline...</p>}
      {error && <p className="error-text">{error}</p>}

      {recordMeta && (
        <div className="panel">
          <p>
            Record: <code>{recordMeta._id}</code>
          </p>
          <p>
            Transaction ID: <strong>{recordMeta.transactionId}</strong>
          </p>
        </div>
      )}

      <div className="panel">
        <h3>Timeline Sequence</h3>
        <div className="timeline">
          {timeline.length === 0 && <p className="muted-text">No audit events found for this record.</p>}

          {timeline.map((entry) => (
            <article className="timeline-item" key={entry._id}>
              <div className="timeline-marker" />
              <div className="timeline-content">
                <header>
                  <strong>{entry.action}</strong>
                  <span className="badge">{entry.source}</span>
                </header>
                <p>
                  By: {entry.changedBy?.fullName || 'System'} ({entry.changedBy?.role || 'n/a'})
                </p>
                <p>At: {new Date(entry.createdAt).toLocaleString()}</p>

                {entry.changes?.length > 0 && (
                  <ul>
                    {entry.changes.map((change, index) => (
                      <li key={`${entry._id}-change-${index}`}>
                        {change.field}: {String(change.oldValue ?? '-')} {' -> '} {String(change.newValue ?? '-')}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
