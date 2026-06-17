export default function AdminApp({
  theme,
  users,
  currentUser,
  editingUserId,
  editingValue,
  resetSentId,
  adminOwnPassVisible,
  adminOwnPassInput,
  adminOwnPassMsg,
  onToggleTheme,
  onToggleOwnPassForm,
  onOwnPassInputChange,
  onChangeOwnPassword,
  onLogout,
  onStartEditUsername,
  onSaveUsername,
  onCancelEditUsername,
  onEditingValueChange,
  onSendPasswordReset,
  onToggleUserStatus,
}) {
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.active).length;
  const blockedUsers = totalUsers - activeUsers;

  return (
    <div className="admin-layout">
      <header className="top-bar admin-bar">
        <div className="user-info">
          <div className="avatar" style={{ background: 'var(--primary-bg)', color: 'var(--primary-color)', fontWeight: 700 }}>A</div>
          <div className="user-details">
            <h3>Painel Admin</h3>
            <span>Gestão de Acessos — Karonte</span>
          </div>
        </div>
        <div className="top-actions">
          <button type="button" onClick={onToggleTheme} className="text-btn" style={{ fontSize: '14px' }} title="Mudar Tema">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button type="button" onClick={onToggleOwnPassForm} className="logout-btn">
            {adminOwnPassVisible ? 'Cancelar' : 'Alterar Minha Senha'}
          </button>
          <button type="button" onClick={onLogout} className="logout-btn">Sair</button>
        </div>
      </header>

      {adminOwnPassVisible ? (
        <div className="admin-own-pass-bar">
          <form onSubmit={onChangeOwnPassword} className="admin-own-pass-form">
            <input
              type="password"
              placeholder="Nova senha de administrador"
              value={adminOwnPassInput}
              onChange={(e) => onOwnPassInputChange(e.target.value)}
              className="admin-inline-input"
              autoFocus
            />
            <button type="submit" className="submit-btn">Salvar Senha</button>
            {adminOwnPassMsg ? (
              <span className={`admin-msg ${adminOwnPassMsg.includes('sucesso') ? 'admin-msg--ok' : 'admin-msg--err'}`}>
                {adminOwnPassMsg}
              </span>
            ) : null}
          </form>
        </div>
      ) : null}

      <main className="main-content padding-container">
        <div className="admin-stats-row">
          <div className="admin-stat-card">
            <span className="admin-stat-label">Total de Usuários</span>
            <span className="admin-stat-value">{totalUsers}</span>
          </div>
          <div className="admin-stat-card admin-stat-card--ok">
            <span className="admin-stat-label">Ativos</span>
            <span className="admin-stat-value" style={{ color: 'var(--success-color)' }}>{activeUsers}</span>
          </div>
          <div className="admin-stat-card admin-stat-card--err">
            <span className="admin-stat-label">Bloqueados</span>
            <span className="admin-stat-value" style={{ color: 'var(--danger-color)' }}>{blockedUsers}</span>
          </div>
        </div>

        <div className="card list-section">
          <div className="list-header">
            <h2>Usuários Registrados</h2>
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome Completo</th>
                  <th>Email</th>
                  <th>Usuário</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={editingUserId === u.id ? 'admin-row--editing' : ''}>
                    <td>{u.fullName || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 10 }}>{u.email}</td>
                    <td>
                      {editingUserId === u.id ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            className="admin-inline-input"
                            value={editingValue}
                            onChange={(e) => onEditingValueChange(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') onSaveUsername(u.id);
                              if (e.key === 'Escape') onCancelEditUsername();
                            }}
                            autoFocus
                          />
                          <button type="button" className="admin-action-btn admin-action-btn--ok" onClick={() => onSaveUsername(u.id)}>✓</button>
                          <button type="button" className="admin-action-btn" onClick={onCancelEditUsername}>✕</button>
                        </div>
                      ) : (
                        <span>
                          {u.username}
                          {u.id === currentUser.uid && <span className="admin-you-badge">você</span>}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`admin-role-badge ${u.role === 'admin' ? 'admin-role-badge--admin' : 'admin-role-badge--user'}`}>
                        {u.role === 'admin' ? 'Admin' : 'Usuário'}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: u.active ? 'var(--success-color)' : 'var(--danger-color)', fontSize: 11 }}>
                        {u.active ? '● Ativo' : '● Bloqueado'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                        {editingUserId !== u.id && (
                          <button type="button" className="admin-action-btn" onClick={() => onStartEditUsername(u)} title="Editar nome de usuário">
                            ✏️ Editar
                          </button>
                        )}
                        {u.id !== currentUser.uid && (
                          resetSentId === u.id ? (
                            <span className="admin-msg admin-msg--ok">✉ Email enviado!</span>
                          ) : (
                            <button
                              type="button"
                              className="admin-action-btn"
                              onClick={() => onSendPasswordReset(u.id, u.email)}
                              title={`Enviar reset de senha para ${u.email}`}
                            >
                              🔑 Alterar Senha
                            </button>
                          )
                        )}
                        {u.id !== currentUser.uid && (
                          <button
                            type="button"
                            className="admin-action-btn"
                            style={{ color: u.active ? 'var(--danger-color)' : 'var(--success-color)' }}
                            onClick={() => onToggleUserStatus(u.id, u.active)}
                          >
                            {u.active ? '🚫 Bloquear' : '✅ Ativar'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
