const ICONS = { error: '!', success: '✓', info: 'i' };

export function Alert({ variant = 'error', title, children, action }) {
  return (
    <div className={`alert alert--${variant}`} role={variant === 'error' ? 'alert' : 'status'}>
      <span className="alert__icon" aria-hidden="true">
        {ICONS[variant]}
      </span>
      <div className="alert__body">
        {title && <strong className="alert__title">{title}</strong>}
        {children && <div>{children}</div>}
      </div>
      {action}
    </div>
  );
}
