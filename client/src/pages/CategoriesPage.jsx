import { useState } from 'react';
import { ApiError } from '../api/client.js';
import { categoriesApi } from '../api/categories.js';
import { Alert } from '../components/ui/Alert.jsx';
import { Button } from '../components/ui/Button.jsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx';
import { Field } from '../components/ui/Field.jsx';
import { PageLoader } from '../components/ui/Spinner.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useApi } from '../hooks/useApi.js';

function AddCategoryForm({ onCreated }) {
  const toast = useToast();
  const [values, setValues] = useState({ name: '', type: 'expense' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const name = values.name.trim();
    if (!name) return setErrors({ name: 'Enter a name' });
    if (name.length > 50) return setErrors({ name: 'Use at most 50 characters' });

    setSaving(true);
    try {
      const created = await categoriesApi.create({ name, type: values.type });
      toast.success(`Added "${created.name}"`);
      setValues((v) => ({ ...v, name: '' }));
      setErrors({});
      onCreated();
    } catch (err) {
      setErrors(err instanceof ApiError && err.details.length ? err.fieldErrors() : { name: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit} noValidate>
      <Field label="New category" error={errors.name} className="inline-form__grow">
        {(props) => (
          <input
            {...props}
            className="input"
            maxLength={50}
            placeholder="e.g. Pets"
            value={values.name}
            onChange={(e) => {
              setValues((v) => ({ ...v, name: e.target.value }));
              setErrors({});
            }}
          />
        )}
      </Field>
      <Field label="Type" error={errors.type}>
        {(props) => (
          <select {...props} className="input" value={values.type} onChange={(e) => setValues((v) => ({ ...v, type: e.target.value }))}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        )}
      </Field>
      <Button type="submit" loading={saving}>
        Add
      </Button>
    </form>
  );
}

function CategoryRow({ category, onChanged, onDelete }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function save(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError('Enter a name');
    if (trimmed === category.name) return setEditing(false);
    setSaving(true);
    try {
      await categoriesApi.update(category.id, { name: trimmed, type: category.type });
      toast.success('Category renamed');
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.fieldErrors().name ?? err.message : err.message);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <li className="category-row">
        <form className="category-row__edit" onSubmit={save}>
          <input
            className="input"
            aria-label={`New name for ${category.name}`}
            aria-invalid={error ? true : undefined}
            maxLength={50}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            autoFocus
          />
          <Button type="submit" size="sm" loading={saving}>
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(false);
              setName(category.name);
              setError(null);
            }}
          >
            Cancel
          </Button>
        </form>
        {error && <p className="field__error">{error}</p>}
      </li>
    );
  }

  const inUse = category.transactionCount > 0;
  return (
    <li className="category-row">
      <div className="category-row__main">
        <span className={`dot dot--${category.type}`} aria-hidden="true" />
        <span className="category-row__name">{category.name}</span>
        <span className="category-row__count">
          {category.transactionCount} transaction{category.transactionCount === 1 ? '' : 's'}
        </span>
      </div>
      <div className="row-actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(true)}>
          Rename<span className="visually-hidden"> {category.name}</span>
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm btn--danger-text"
          onClick={() => onDelete(category)}
          disabled={inUse}
          title={inUse ? 'Categories with transactions cannot be deleted' : undefined}
        >
          Delete<span className="visually-hidden"> {category.name}</span>
        </button>
      </div>
    </li>
  );
}

export function CategoriesPage() {
  const toast = useToast();
  const { data, error, loading, reload } = useApi((signal) => categoriesApi.list(signal), []);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function confirmDelete() {
    setDeleteBusy(true);
    try {
      await categoriesApi.remove(deleting.id);
      toast.success(`Deleted "${deleting.name}"`);
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1 className="page__title">Categories</h1>
          <p className="page__subtitle">
            Organize transactions your way. Categories that have transactions can be renamed but not deleted.
          </p>
        </div>
      </header>

      <section className="card">
        <AddCategoryForm onCreated={reload} />
      </section>

      {error && (
        <Alert variant="error" title="Couldn't load categories" action={<Button variant="secondary" size="sm" onClick={reload}>Retry</Button>}>
          {error.message}
        </Alert>
      )}
      {!data && loading && <PageLoader label="Loading categories…" />}

      {data && (
        <div className="category-columns">
          {['expense', 'income'].map((type) => {
            const items = data.filter((c) => c.type === type);
            return (
              <section key={type} className="card">
                <header className="card__header">
                  <h2 className="card__title">{type === 'expense' ? 'Expense categories' : 'Income categories'}</h2>
                  <span className="muted">{items.length}</span>
                </header>
                {items.length === 0 ? (
                  <p className="muted card__empty">No {type} categories yet.</p>
                ) : (
                  <ul className="category-list">
                    {items.map((c) => (
                      <CategoryRow key={`${c.id}-${c.name}`} category={c} onChanged={reload} onDelete={setDeleting} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete category?"
        loading={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      >
        {deleting && (
          <p>
            Delete <strong>{deleting.name}</strong>? This cannot be undone.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
