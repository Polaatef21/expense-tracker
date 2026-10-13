import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client.js';
import { Alert } from '../components/ui/Alert.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Field } from '../components/ui/Field.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { validateRegistration } from '../utils/validation.js';
import { AuthLayout } from './AuthLayout.jsx';

export function RegisterPage() {
  const { register } = useAuth();
  const [values, setValues] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setErrors((errs) => ({ ...errs, [field]: undefined }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    const clientErrors = validateRegistration(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    setSubmitting(true);
    try {
      await register({ name: values.name.trim(), email: values.email.trim(), password: values.password });
    } catch (err) {
      if (err instanceof ApiError && err.details.length > 0) setErrors(err.fieldErrors());
      setFormError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Track income and expenses in one place. Default categories are set up for you."
      footer={
        <>
          Already have an account? <Link to="/login">Log in</Link>
        </>
      }
    >
      <form className="form" onSubmit={handleSubmit} noValidate>
        {formError && <Alert variant="error">{formError}</Alert>}

        <Field label="Name" error={errors.name}>
          {(props) => <input {...props} className="input" autoComplete="name" value={values.name} onChange={set('name')} autoFocus />}
        </Field>
        <Field label="Email" error={errors.email}>
          {(props) => (
            <input {...props} className="input" type="email" autoComplete="email" value={values.email} onChange={set('email')} />
          )}
        </Field>
        <Field label="Password" error={errors.password} hint="At least 8 characters, with a letter and a number.">
          {(props) => (
            <input
              {...props}
              className="input"
              type="password"
              autoComplete="new-password"
              value={values.password}
              onChange={set('password')}
            />
          )}
        </Field>
        <Field label="Confirm password" error={errors.confirmPassword}>
          {(props) => (
            <input
              {...props}
              className="input"
              type="password"
              autoComplete="new-password"
              value={values.confirmPassword}
              onChange={set('confirmPassword')}
            />
          )}
        </Field>

        <Button type="submit" loading={submitting} className="btn--block">
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
