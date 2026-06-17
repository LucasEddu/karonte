export default function ProjectModal({
  open,
  projectName,
  onProjectNameChange,
  onClose,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Novo Projeto Orçamentário</h2>
          <button type="button" className="close-btn" onClick={onClose}>✕</button>
        </div>
        <p className="modal-subtitle">
          Crie projetos para gerenciar orçamentos separados (ex: &quot;Construção da Casa&quot;, &quot;Casamento 2025&quot;).
        </p>
        <div className="form-group">
          <label>Nome do Projeto</label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => onProjectNameChange(e.target.value)}
            placeholder="Digite o nome..."
            autoFocus
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="submit-btn" onClick={onConfirm}>Criar Projeto</button>
        </div>
      </div>
    </div>
  );
}
