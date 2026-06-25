interface DeleteModalProps {
  open: boolean;
  title: string;
  desc: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteModal({ open, title, desc, onCancel, onConfirm }: DeleteModalProps) {
  return (
    <div className={`modal-bg${open ? ' open' : ''}`}>
      <div className="modal modal-sm">
        <div className="modal-body">
          <div className="modal-icon">!</div>
          <div className="modal-title">{title}</div>
          <div className="modal-desc">{desc}</div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}
