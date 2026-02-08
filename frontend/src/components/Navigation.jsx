import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navigation() {
  const { user, role, logout } = useAuth();

  return (
    <aside className="top-nav">
      <div className="brand-wrap">
        <h1>Recon Pulse</h1>
        <p>Smart Reconciliation and Audit</p>
      </div>

      <p className="nav-section-title">Navigation</p>
      <nav className="nav-links">
        <NavLink to="/dashboard">Dashboard</NavLink>
        {(role === 'admin' || role === 'analyst') && <NavLink to="/upload">Upload</NavLink>}
        <NavLink to="/reconciliation">Reconciliation</NavLink>
        <NavLink to="/audit">Audit Timeline</NavLink>
      </nav>

      <div className="nav-user">
        <div>
          <strong>{user?.fullName || 'User'}</strong>
          <span>{role}</span>
        </div>
        <button className="btn btn-ghost" onClick={logout} type="button">
          Logout
        </button>
      </div>
    </aside>
  );
}
