import { Spinner } from './Spinner.jsx';

// variant: primary | secondary | ghost | danger;  size: md | sm
export function Button({ variant = 'primary', size = 'md', loading = false, disabled, children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`btn btn--${variant} btn--${size} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
