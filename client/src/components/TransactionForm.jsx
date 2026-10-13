import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client.js';
import { todayISO } from '../utils/dates.js';
import { validateTransaction } from '../utils/validation.js';
import { Alert } from './ui/Alert.jsx';
import { Button } from './ui/Button.jsx';
import { Field } from './ui/Field.jsx';

function initialValues(transaction) {
  if (!transaction) return { type: 'expense', categoryId: '', amount: '', date: todayISO(), description: '' };
  return {
    type: transaction.type,
    categoryId: String(transaction.category.id),
    amount: transaction.amount,
    date: transaction.date,
    description: transaction.description ?? '',
  };
}

// Add/edit form. `onSubmit(payload)` performs the API call; server-side
// validation errors are shown next to the matching fields.
export function TransactionForm({ transaction, categories, onSubmit, onCancel }) {
  const [values, setValues] = useState(() => initialValues(transaction));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const options = categories.filter((c) => c.type === values.type);

  const set = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setErrors((errs) => ({ ...errs, [field]: undefined }));
  };

  const setType = (type) => {
    setValues((v) => ({
      ...v,
      type,
      // keep the category only if it belongs to the new type
      categoryId: categories.some((c) => String(c.id) === v.categoryId && c.type === type) ? v.categoryId : '',
    }));
    setErrors((errs) => ({ ...errs, type: undefined, categoryId: undefined }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    const clientErrors = validateTransaction(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    setSaving(true);
    try {
      await onSubmit({
        type: values.type,
        categoryId: Number(values.categoryId),
        amount: values.amount.trim(),
        date: values.date,
        description: values.description.trim() || null,
      });
    } catch (err) {
      if (err instanceof ApiError && err.details.length > 0) setErrors(err.fieldErrors());
      setFormError(err.message);
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      {formError && <Alert variant="error">{formError}</Alert>}

      <fieldset className="segmented" aria-label="Transaction type">
        {['expense', 'income'].map((type) => (
          <label key={type} className={`segmented__option segmented__option--${type}`}>
            <input type="radio" name="type" value={type} checked={values.type === type} onChange={() => setType(type)} />
            <span>{type === 'expense' ? 'Expense' : 'Income'}</span>
          </label>
        ))}
      </fieldset>

      <div className="form-grid">
        <Field label="Amount" error={errors.amount}>
          {(props) => (
            <input
              {...props}
              className="input"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={values.amount}
              onChange={set('amount')}
              autoFocus
            />
          )}
        </Field>

        <Field label="Date" error={errors.date}>
          {(props) => <input {...props} className="input" type="date" value={values.date} onChange={set('date')} />}
        </Field>
      </div>

      <Field
        label="Category"
        error={errors.categoryId}
        hint={options.length === 0 ? undefined : `${options.length} ${values.type} categories`}
      >
        {(props) => (
          <select {...props} className="input" value={values.categoryId} onChange={set('categoryId')}>
            <option value="">Choose a category…</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      {options.length === 0 && (
        <p className="field__hint">
          You have no {values.type} categories. <Link to="/categories">Create one</Link> first.
        </p>
      )}

      <Field label="Description (optional)" error={errors.description} hint={`${[...values.description].length}/255`}>
        {(props) => (
          <input
            {...props}
            className="input"
            maxLength={255}
            placeholder="e.g. Weekly groceries"
            value={values.description}
            onChange={set('description')}
          />
        )}
      </Field>

      <div className="form-actions">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {transaction ? 'Save changes' : 'Add transaction'}
        </Button>
      </div>
    </form>
  );
}
