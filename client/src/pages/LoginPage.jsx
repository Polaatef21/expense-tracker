import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../components/ui/Alert.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Field } from '../components/ui/Field.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { EMAIL_PATTERN } from '../utils/validation.js';
import { AuthLayout } from './AuthLayout.jsx';

export function LoginPage() {
  const { login, notice, clearNotice } = useAuth();
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setErrors((errs) => ({ ...errs, [field]: undefined }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    clearNotice();
    setFormError(null);
    const clientErrors = {};
    if (!EMAIL_PATTERN.test(values.email.trim())) clientErrors.email = 'Enter a valid email address';
    if (!values.password) clientErrors.password = 'Enter your password';
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    setSubmitting(true);
    try {
      await login({ email: values.email.trim(), password: values.password });
      // PublicOnlyRoute redirects to the dashboard once the session starts
    } catch (err) {
      setFormError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to see your income, spending and balance."
      footer={
        <>
          New here? <Link to="/register">Create an account</Link>
        </>
      }
    >
      <form className="form" onSubmit={handleSubmit} noValidate>
        {notice && <Alert variant="info">{notice}</Alert>}
        {formError && <Alert variant="error">{formError}</Alert>}

        <Field label="Email" error={errors.email}>
          {(props) => (
            <input {...props} className="input" type="email" autoComplete="email" value={values.email} onChange={set('email')} autoFocus />
          )}
        </Field>
        <Field label="Password" error={errors.password}>
          {(props) => (
            <input
              {...props}
              className="input"
              type="password"
              autoComplete="current-password"
              value={values.password}
              onChange={set('password')}
            />
          )}
        </Field>

        <Button type="submit" loading={submitting} className="btn--block">
          Log in
        </Button>
      </form>
    </AuthLayout>
  );
}
