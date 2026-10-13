import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z', end: true },
  { to: '/transactions', label: 'Transactions', icon: 'M4 6h16M4 12h16M4 18h10' },
  { to: '/categories', label: 'Categories', icon: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z' },
];

export function Layout() {
  const { user, logout } = useAuth();
  const initials = user.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">$</span>
          <span className="brand__name">Expense Tracker</span>
        </div>

        <nav className="nav" aria-label="Main">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="nav__link">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d={item.icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="user-box">
          <span className="avatar" aria-hidden="true">{initials}</span>
          <div className="user-box__text">
            <span className="user-box__name">{user.name}</span>
            <span className="user-box__email">{user.email}</span>
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>

      <main id="main" className="main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
