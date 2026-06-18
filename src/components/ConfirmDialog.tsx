function ConfirmDialog({
  open,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  danger = false,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="confirm-title">{title}</h3>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button onClick={onCancel}>{cancelText ?? "取消"}</button>
          <button
            className={danger ? "danger-action" : "primary-action"}
            onClick={onConfirm}
          >
            {confirmText ?? "确认"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
