import { getProjectRole } from '../services/projectService';

export default function ProjectSelectorDropdown({
  projects,
  activeProjectId,
  currentUserId,
  onSelectProject,
  onOpenProjectSettings,
  onNewProject,
  className = '',
}) {
  return (
    <div className={`project-selector-dropdown ${className}`.trim()}>
      <div className="project-selector-dropdown-header">Seus Projetos</div>
      <div className="project-selector-dropdown-list">
        <button
          type="button"
          className={`project-selector-item ${activeProjectId === null ? 'active' : ''}`}
          onClick={() => onSelectProject(null)}
        >
          <span className="project-item-avatar">G</span>
          <span className="project-item-name">Geral</span>
        </button>
        {projects.map((p) => {
          const role = getProjectRole(p, currentUserId);
          const isOwner = role === 'owner';
          return (
            <div key={p.id} className="project-item-wrapper">
              <button
                type="button"
                className={`project-selector-item ${activeProjectId === p.id ? 'active' : ''}`}
                onClick={() => onSelectProject(p.id)}
              >
                <span className="project-item-avatar">{p.name.charAt(0).toUpperCase()}</span>
                <span className="project-item-name">{p.name}</span>
                {p.isShared ? <span className="project-item-shared" title="Projeto compartilhado">👤</span> : null}
              </button>
              {isOwner ? (
                <button
                  type="button"
                  className="project-item-settings-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenProjectSettings(p.id);
                  }}
                  title="Configurações do projeto"
                >
                  ⚙
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      <button type="button" className="project-selector-add-btn" onClick={onNewProject}>
        + Novo Projeto
      </button>
    </div>
  );
}
