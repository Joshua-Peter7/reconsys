import { useMemo, useState } from 'react';
import { uploadApi } from '../api/endpoints';

const targetFields = [
  { value: '', label: 'Ignore' },
  { value: 'transactionId', label: 'Transaction ID (Required)' },
  { value: 'referenceNumber', label: 'Reference Number (Required)' },
  { value: 'amount', label: 'Amount (Required)' },
  { value: 'date', label: 'Date (Required)' },
];

const requiredTargets = ['transactionId', 'referenceNumber', 'amount', 'date'];

function normalizeHeader(header) {
  return header.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function autoMap(headers) {
  const mapping = {};

  headers.forEach((header) => {
    const normalized = normalizeHeader(header);

    if (normalized.includes('transactionid')) mapping[header] = 'transactionId';
    if (normalized.includes('referencenumber') || normalized.includes('reference')) mapping[header] = 'referenceNumber';
    if (normalized === 'amount' || normalized.includes('amount')) mapping[header] = 'amount';
    if (normalized === 'date' || normalized.includes('transactiondate')) mapping[header] = 'date';
  });

  return mapping;
}

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [uploadType, setUploadType] = useState('transaction');
  const [headers, setHeaders] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [jobResponse, setJobResponse] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  const mappedTargets = useMemo(() => Object.values(mapping).filter(Boolean), [mapping]);
  const missingTargets = useMemo(
    () => requiredTargets.filter((field) => !mappedTargets.includes(field)),
    [mappedTargets]
  );

  async function handlePreview(event) {
    event.preventDefault();
    setStatusMessage('');

    if (!file) {
      setStatusMessage('Please choose a CSV or Excel file first.');
      return;
    }

    setLoadingPreview(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await uploadApi.preview(formData);
      const nextHeaders = response.data.headers || [];

      setHeaders(nextHeaders);
      setPreviewRows(response.data.preview || []);
      setMapping(autoMap(nextHeaders));
      setStatusMessage(`Preview ready. Total rows detected: ${response.data.totalRows}.`);
    } catch (error) {
      setStatusMessage(error.response?.data?.message || 'Could not preview this file.');
    } finally {
      setLoadingPreview(false);
    }
  }

  async function pollJob(jobId) {
    let attempts = 0;
    const maxAttempts = 120;

    while (attempts < maxAttempts) {
      // eslint-disable-next-line no-await-in-loop
      const response = await uploadApi.status(jobId);
      const job = response.data.job;

      setJobResponse((prev) => ({ ...prev, status: job.status, job }));

      if (job.status === 'completed' || job.status === 'failed') {
        return job;
      }

      attempts += 1;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });
    }

    return null;
  }

  async function handleUpload(event) {
    event.preventDefault();
    setStatusMessage('');

    if (!file) {
      setStatusMessage('Please choose a file before uploading.');
      return;
    }

    if (missingTargets.length > 0) {
      setStatusMessage(`Missing mandatory mapping: ${missingTargets.join(', ')}`);
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('columnMapping', JSON.stringify(mapping));
      formData.append('uploadType', uploadType);

      const response = await uploadApi.create(formData);
      setJobResponse(response.data);

      if (!response.data.reused && response.data.status === 'processing') {
        setStatusMessage('Upload accepted. Processing in background...');
        const finalJob = await pollJob(response.data.jobId);
        if (finalJob) {
          setStatusMessage(
            finalJob.status === 'completed'
              ? `Job completed. Processed ${finalJob.processedRows}/${finalJob.rowCount} rows.`
              : `Job failed: ${finalJob.errorMessage || 'Unknown error'}`
          );
        } else {
          setStatusMessage('Processing is taking longer than expected. You can check status from dashboard.');
        }
      } else {
        setStatusMessage(response.data.message);
      }
    } catch (error) {
      setStatusMessage(error.response?.data?.message || 'Upload failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page-stack">
      <div className="page-header">
        <h2>File Upload & Column Mapping</h2>
        <p>Drop a file, check the first 20 rows, and map required columns before we process it.</p>
      </div>

      <div className="panel">
        <form className="form-grid" onSubmit={handlePreview}>
          <label>
            Data File (CSV/XLSX)
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] || null;
                setFile(nextFile);
                setHeaders([]);
                setPreviewRows([]);
                setMapping({});
                setJobResponse(null);
              }}
              required
            />
          </label>

          <label>
            Upload Type
            <select value={uploadType} onChange={(event) => setUploadType(event.target.value)}>
              <option value="transaction">Transaction Upload (for reconciliation)</option>
              <option value="system">System Records Baseline</option>
            </select>
          </label>

          <div className="button-row">
            <button type="submit" className="btn btn-secondary" disabled={loadingPreview || !file}>
              {loadingPreview ? 'Generating Preview...' : 'Preview First 20 Rows'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setMapping(autoMap(headers))} disabled={!headers.length}>
              Auto Map Columns
            </button>
          </div>
        </form>
      </div>

      {headers.length > 0 && (
        <div className="panel">
          <h3>Column Mapping</h3>
          <p className="muted-text">You can edit mappings without re-uploading the file.</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Uploaded Column</th>
                  <th>Map To System Field</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((header) => (
                  <tr key={header}>
                    <td>{header}</td>
                    <td>
                      <select
                        value={mapping[header] || ''}
                        onChange={(event) =>
                          setMapping((prev) => ({
                            ...prev,
                            [header]: event.target.value,
                          }))
                        }
                      >
                        {targetFields.map((field) => (
                          <option key={field.value || 'ignore'} value={field.value}>
                            {field.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {missingTargets.length > 0 && (
            <p className="error-text">Missing mandatory fields: {missingTargets.join(', ')}</p>
          )}

          <button className="btn btn-primary" onClick={handleUpload} disabled={submitting || missingTargets.length > 0}>
            {submitting ? 'Uploading...' : 'Submit for Async Processing'}
          </button>
        </div>
      )}

      {previewRows.length > 0 && (
        <div className="panel">
          <h3>Preview (First 20 Rows)</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {headers.map((header) => (
                    <th key={`header-${header}`}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, index) => (
                  <tr key={`row-${index}`}>
                    {headers.map((header) => (
                      <td key={`${index}-${header}`}>{String(row[header] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {statusMessage && <p className="info-text">{statusMessage}</p>}

      {jobResponse && (
        <div className="panel">
          <h3>Upload Job</h3>
          <p>
            Job ID: <code>{jobResponse.jobId}</code>
          </p>
          <p>
            Status: <span className={`badge ${jobResponse.status}`}>{jobResponse.status}</span>
          </p>
          {jobResponse.reused && <p className="muted-text">Existing completed/processing job reused to keep uploads idempotent.</p>}
        </div>
      )}
    </section>
  );
}
