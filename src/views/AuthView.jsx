export default function AuthView({
  authMode,
  authFullName,
  authUsername,
  authEmail,
  authPassword,
  authConfirmPassword,
  authError,
  onSubmit,
  onFullNameChange,
  onUsernameChange,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onToggleMode,
}) {
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>{authMode === 'login' ? 'Entrar no Karonte' : 'Criar Conta no Karonte'}</h2>
          <p>Seu sistema de controle financeiro.</p>
        </div>
        {authError ? <div className="auth-error">{authError}</div> : null}
        <form className="auth-form" onSubmit={onSubmit}>
          {authMode === 'register' && (
            <>
              <div className="form-group">
                <label>Nome Completo</label>
                <input type="text" value={authFullName} onChange={(e) => onFullNameChange(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Nome de Usuário (Como quer ser chamado)</label>
                <input type="text" value={authUsername} onChange={(e) => onUsernameChange(e.target.value)} required />
              </div>
            </>
          )}
          <div className="form-group">
            <label>E-mail</label>
            <input type="email" value={authEmail} onChange={(e) => onEmailChange(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Senha</label>
            <input type="password" value={authPassword} onChange={(e) => onPasswordChange(e.target.value)} required />
          </div>
          {authMode === 'register' && (
            <div className="form-group">
              <label>Confirmar Senha</label>
              <input
                type="password"
                value={authConfirmPassword}
                onChange={(e) => onConfirmPasswordChange(e.target.value)}
                placeholder="Repita a senha acima"
                required
                style={authConfirmPassword && authPassword !== authConfirmPassword ? { borderColor: 'var(--danger-color)' } : {}}
              />
              {authConfirmPassword && authPassword !== authConfirmPassword ? (
                <span style={{ fontSize: 10, color: 'var(--danger-color)', marginTop: 2 }}>As senhas não coincidem</span>
              ) : null}
            </div>
          )}
          <button type="submit" className="submit-btn full-width auth-btn">
            {authMode === 'login' ? 'Acessar' : 'Registrar'}
          </button>
        </form>
        <div className="auth-footer">
          <p>
            {authMode === 'login' ? 'Novo por aqui?' : 'Já possui conta?'}
            <button type="button" className="text-btn" onClick={onToggleMode}>
              {authMode === 'login' ? 'Registre-se' : 'Faça login'}
            </button>
          </p>
        </div>
        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '11px', color: 'var(--text-tertiary)' }}>
          Desenvolvido por Lucas Eduardo Moura Santos
        </div>
      </div>
    </div>
  );
}
