import { PROJECT_TYPE_OPTIONS } from '../constants/projectTypes.js';

export default function ProjectSettingsView({
  project,
  currentUser,
  renameProjectValue,
  projectTypeValue,
  familyConfigValue,
  inviteEmailInput,
  inviteRoleInput,
  inviteSending,
  canManageProject = false,
  onRenameValueChange,
  onProjectTypeChange,
  onFamilyConfigChange,
  onSaveProjectType,
  onSaveName,
  onSaveCollaboratorName,
  onUpdateCollaboratorRole,
  onRemoveCollaborator,
  onInviteEmailChange,
  onInviteRoleChange,
  onSendInvite,
  onDeleteProject,
  onBack,
}) {
  if (!project) {
    return (
      <main className="main-content">
        <div className="card list-section">
          <div className="list-header">
            <h2>Projeto não encontrado</h2>
          </div>
          <button type="button" className="text-btn" onClick={onBack}>← Voltar</button>
        </div>
      </main>
    );
  }

  const rolesMap = project.collaboratorRoles || {};
  const namesMap = project.collaboratorNames || {};
  const collaboratorIds = project.collaborators || [];

  return (
    <main className="main-content">
      <div className="card list-section">
        <div className="list-header">
          <h2>Configurações do projeto</h2>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
          Gerencie o nome, participantes e permissões de “{project.name}”.
        </div>

        <section className="settings-block">
          <h3>Informações básicas</h3>
          <div className="form-group">
            <label>Nome do projeto</label>
            <input type="text" value={renameProjectValue || project.name} onChange={(e) => onRenameValueChange(e.target.value)} />
          </div>
          <button type="button" className="submit-btn" onClick={onSaveName}>Salvar nome</button>
        </section>

        <section className="settings-block">
          <h3>Tipo do projeto</h3>
          <p className="settings-hint">Apenas o dono pode alterar o tipo e configurações familiares.</p>
          <div className="form-group">
            <label>Tipo</label>
            <select
              value={projectTypeValue || project.projectType || 'default'}
              onChange={(e) => onProjectTypeChange?.(e.target.value)}
              disabled={!canManageProject}
            >
              {PROJECT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
          {(projectTypeValue || project.projectType) === 'family' ? (
            <div className="family-config-toggles">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={familyConfigValue?.showMemberContribution !== false}
                  disabled={!canManageProject}
                  onChange={(e) => onFamilyConfigChange?.({ showMemberContribution: e.target.checked })}
                />
                <span>Mostrar contribuição por membro</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={familyConfigValue?.showSettlement !== false}
                  disabled={!canManageProject}
                  onChange={(e) => onFamilyConfigChange?.({ showSettlement: e.target.checked })}
                />
                <span>Mostrar acerto entre membros</span>
              </label>
            </div>
          ) : null}
          {canManageProject ? (
            <button type="button" className="submit-btn" onClick={onSaveProjectType} style={{ marginTop: 12 }}>
              Salvar tipo e configurações
            </button>
          ) : null}
        </section>

        <section className="settings-block">
          <h3>Participantes</h3>
          <p className="settings-hint">Apenas o dono pode gerenciar permissões.</p>
          <div className="participants-list">
            <div className="participant-row">
              <div className="participant-main">
                <span className="participant-name">
                  Dono: {project.userId === currentUser.uid
                    ? (currentUser.username || currentUser.displayName || currentUser.email || project.userId)
                    : project.userId}
                </span>
                <span className="participant-role-tag">Owner</span>
              </div>
            </div>
            {collaboratorIds.map((uid) => (
              <div key={uid} className="participant-row">
                <div className="participant-main">
                  <span className="participant-name">Colaborador: {namesMap[uid] || '—'}</span>
                  {!namesMap[uid] ? (
                    <div className="participant-name-edit">
                      <input
                        className="participant-name-input"
                        type="text"
                        placeholder="Nome do colaborador..."
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter') return;
                          const val = e.currentTarget.value.trim();
                          if (!val) return;
                          onSaveCollaboratorName(uid, val);
                          e.currentTarget.value = '';
                        }}
                      />
                      <span className="participant-name-hint">Pressione Enter para salvar</span>
                    </div>
                  ) : null}
                </div>
                <div className="participant-actions">
                  <select
                    className="participant-role-select"
                    value={rolesMap[uid] || 'view'}
                    onChange={(e) => onUpdateCollaboratorRole(uid, e.target.value)}
                  >
                    <option value="view">Apenas ver</option>
                    <option value="add">Ver e incluir</option>
                    <option value="manage">Ver, incluir e excluir</option>
                  </select>
                  <button type="button" className="text-btn danger" onClick={() => onRemoveCollaborator(uid)}>
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="settings-block">
          <h3>Convidar novo participante</h3>
          <div className="form-group">
            <label>E-mail</label>
            <input type="email" value={inviteEmailInput} onChange={(e) => onInviteEmailChange(e.target.value)} placeholder="email@exemplo.com" />
          </div>
          <div className="form-group">
            <label>Nível de acesso</label>
            <select value={inviteRoleInput} onChange={(e) => onInviteRoleChange(e.target.value)}>
              <option value="view">Apenas ver</option>
              <option value="add">Ver e incluir registros</option>
              <option value="manage">Ver, incluir e excluir registros</option>
            </select>
          </div>
          <button type="button" className="submit-btn" onClick={onSendInvite} disabled={inviteSending || !inviteEmailInput.trim()}>
            {inviteSending ? 'Enviando...' : 'Enviar convite'}
          </button>
        </section>

        <section className="settings-block">
          <h3>Zona perigosa</h3>
          <p className="settings-hint">Excluir o projeto remove também seus dados associados para você.</p>
          <button type="button" className="submit-btn" style={{ background: 'var(--danger-color)' }} onClick={onDeleteProject}>
            Excluir projeto
          </button>
        </section>

        <div style={{ marginTop: 24 }}>
          <button type="button" className="text-btn" onClick={onBack}>
            ← Voltar para Dashboard
          </button>
        </div>
      </div>
    </main>
  );
}
