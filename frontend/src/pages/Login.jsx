import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import loginTeamArt from '../assets/login-team.svg';

export default function LoginPage() {
  const { login, loading } = useAuth();
  const [form, setForm] = useState({ email: 'analyst@recons.local', password: 'Analyst@123' });
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo = location.state?.from?.pathname || '/dashboard';

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    try {
      await login(form);
      navigate(redirectTo, { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Login failed. Please verify your credentials.');
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <section className="login-pane">
          <h2>Welcome Back</h2>
          <p>Secure sign-in for Smart Reconciliation & Audit.</p>

          <form onSubmit={handleSubmit} className="form-grid">
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                required
              />
            </label>

            {error && <p className="error-text">{error}</p>}

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        </section>

        <section className="login-art-pane" aria-hidden="true">
          <img className="login-art-figure" src={loginTeamArt} alt="" />
          <div className="login-art-copy">
            <h3>Recon Pulse</h3>
            <p>Review, reconcile, and track every change with confidence.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
