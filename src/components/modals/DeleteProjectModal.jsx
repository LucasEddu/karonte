export default function DeleteProjectModal({
  project,
  onClose,
  onConfirm,
}) {
  if (!project) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-confirm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Excluir projeto</h2>
          <button type="button" className="close-btn" onClick={onClose}>✕</button>
        </div>
        <p className="modal-subtitle">
          Tem certeza que deseja excluir o projeto &quot;{project.name}&quot;? Esta ação não pode ser desfeita.
        </p>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="submit-btn" style={{ background: 'var(--danger-color)' }} onClick={onConfirm}>Excluir</button>
        </div>
      </div>
    </div>
  );
}
