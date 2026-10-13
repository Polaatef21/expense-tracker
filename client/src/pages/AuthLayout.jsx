// Shared frame for the login and registration screens
export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth">
      <main className="auth__card">
        <div className="brand brand--center">
          <span className="brand__mark" aria-hidden="true">$</span>
          <span className="brand__name">Expense Tracker</span>
        </div>
        <h1 className="auth__title">{title}</h1>
        {subtitle && <p className="auth__subtitle">{subtitle}</p>}
        {children}
        {footer && <p className="auth__footer">{footer}</p>}
      </main>
    </div>
  );
}
