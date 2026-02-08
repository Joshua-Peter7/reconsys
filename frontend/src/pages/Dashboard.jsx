import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dashboardApi, uploadApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'matched', label: 'Matched' },
  { value: 'partially_matched', label: 'Partially Matched' },
  { value: 'not_matched', label: 'Not Matched' },
  { value: 'duplicate', label: 'Duplicate' },
];

const chartSwatches = ['#713600', '#C05800', '#38240D', '#FDFBD4'];

export default function DashboardPage() {
  const { role } = useAuth();
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: '',
    uploadedBy: '',
  });

  const query = useMemo(() => {
    const params = {};
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    if (filters.status) params.status = filters.status;
    if (filters.uploadedBy) params.uploadedBy = filters.uploadedBy;
    return params;
  }, [filters]);

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      setLoading(true);
      try {
        const requests = [dashboardApi.summary(query), uploadApi.list({ ...query, uploadType: 'transaction' })];
        if (role === 'admin') {
          requests.push(dashboardApi.filters());
        }

        const [summaryResponse, jobsResponse, filterResponse] = await Promise.all(requests);
        if (!ignore) {
          setSummary(summaryResponse.data);
          setJobs(jobsResponse.data.jobs || []);
          if (filterResponse) {
            setUsers(filterResponse.data.users || []);
          }
        }
      } catch {
        if (!ignore) {
          setSummary(null);
          setJobs([]);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      ignore = true;
    };
  }, [query, role]);

  return (
    <section className="page-stack">
      <div className="page-header">
        <h2>Reconciliation Dashboard</h2>
        <p>Quick view of what landed, what matched, and what still needs attention.</p>
      </div>

      <div className="panel">
        <div className="filter-grid">
          <label>
            Start Date
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
            />
          </label>

          <label>
            End Date
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
            />
          </label>

          <label>
            Status
            <select
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              {statusOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {role === 'admin' && (
            <label>
              Uploaded By
              <select
                value={filters.uploadedBy}
                onChange={(event) => setFilters((prev) => ({ ...prev, uploadedBy: event.target.value }))}
              >
                <option value="">All Users</option>
                {users.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.fullName} ({user.email})
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {loading && <p className="muted-text">Refreshing numbers...</p>}

      {summary && (
        <>
          <div className="summary-grid">
            <article className="metric-card">
              <span>Total Records Uploaded</span>
              <strong>{summary.totalRecordsUploaded}</strong>
            </article>
            <article className="metric-card">
              <span>Matched Records</span>
              <strong>{summary.matchedRecords}</strong>
            </article>
            <article className="metric-card">
              <span>Unmatched Records</span>
              <strong>{summary.unmatchedRecords}</strong>
            </article>
            <article className="metric-card">
              <span>Duplicate Records</span>
              <strong>{summary.duplicateRecords}</strong>
            </article>
            <article className="metric-card">
              <span>Accuracy Percentage</span>
              <strong>{summary.accuracyPercentage}%</strong>
            </article>
          </div>

          <div className="chart-grid">
            <div className="panel chart-panel">
              <h3>Match Distribution (Bar)</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={summary.chart}>
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {summary.chart.map((entry, index) => (
                      <Cell
                        key={`${entry.label}-${index}`}
                        fill={chartSwatches[index % chartSwatches.length]}
                        stroke="#38240D"
                        strokeWidth={0.8}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="panel chart-panel">
              <h3>Match Distribution (Donut)</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={summary.chart}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={70}
                    outerRadius={110}
                    label
                    stroke="#38240D"
                  >
                    {summary.chart.map((entry, index) => (
                      <Cell key={`${entry.label}-pie-${index}`} fill={chartSwatches[index % chartSwatches.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      <div className="panel">
        <h3>Recent Upload Jobs</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>File Name</th>
                <th>Status</th>
                <th>Rows</th>
                <th>Processed</th>
                <th>Failed</th>
                <th>Uploaded By</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted-text">
                    No jobs found for selected filters.
                  </td>
                </tr>
              )}
              {jobs.map((job) => (
                <tr key={job._id}>
                  <td>{job.fileName}</td>
                  <td><span className={`badge ${job.status}`}>{job.status}</span></td>
                  <td>{job.rowCount}</td>
                  <td>{job.processedRows}</td>
                  <td>{job.failedRows}</td>
                  <td>{job.uploadedBy?.fullName || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
