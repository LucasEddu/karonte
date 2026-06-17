export default function UserSettingsView({ currentUser, onBack }) {
  return (
    <main className="main-content">
      <div className="card list-section">
        <div className="list-header">
          <h2>Configurações da conta</h2>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
          Gerencie suas informações básicas e preferências.
        </div>
        <div className="settings-grid">
          <div className="settings-card">
            <h3>Perfil</h3>
            <p><strong>Nome de exibição</strong><br />{currentUser.displayName || '—'}</p>
            <p><strong>Username</strong><br />{currentUser.username || '—'}</p>
            <p><strong>E-mail</strong><br />{currentUser.email}</p>
          </div>
          <div className="settings-card">
            <h3>Segurança</h3>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Use a tela de login para redefinir sua senha se necessário.</p>
          </div>
        </div>
        <div style={{ marginTop: 24 }}>
          <button type="button" className="text-btn" onClick={onBack}>
            ← Voltar para Dashboard
          </button>
        </div>
      </div>
    </main>
  );
}
