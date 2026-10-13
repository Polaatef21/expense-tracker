import { Button } from './Button.jsx';
import { Modal } from './Modal.jsx';

export function ConfirmDialog({ open, title, children, confirmLabel = 'Delete', loading, onConfirm, onCancel }) {
  return (
    <Modal open={open} title={title} onClose={onCancel} size="sm">
      <div className="confirm__text">{children}</div>
      <div className="form-actions">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
