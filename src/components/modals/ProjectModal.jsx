import { PROJECT_TYPE_OPTIONS } from '../../constants/projectTypes.js';

export default function ProjectModal({
  open,
  projectName,
  projectType = 'default',
  onProjectNameChange,
  onProjectTypeChange,
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
          Crie projetos para gerenciar orçamentos separados (ex: &quot;Construção da Casa&quot;, &quot;Família Silva&quot;).
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
        <div className="form-group">
          <label>Tipo de projeto</label>
          <select value={projectType} onChange={(e) => onProjectTypeChange?.(e.target.value)}>
            {PROJECT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="submit-btn" onClick={onConfirm}>Criar Projeto</button>
        </div>
      </div>
    </div>
  );
}
