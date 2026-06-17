import NotificationsDropdown from '../components/NotificationsDropdown';
import ProjectSelectorDropdown from '../components/ProjectSelectorDropdown';

const PAGE_TITLES = {
  hub: 'Visão Geral',
  budgets: 'Orçamentos',
  tarefas: 'Tarefas',
  import: 'Importar Extrato',
  userSettings: 'Configurações de Conta',
  projectSettings: 'Configurações do Projeto',
};

export default function MainShell({
  theme,
  currentUser,
  projects,
  activeProjectId,
  activeProjectName,
  currentView,
  canAddToProject,
  children,
  showProjectDropdown,
  onToggleProjectDropdown,
  onSelectProject,
  onOpenProjectSettings,
  onNewProject,
  showProfilePopover,
  onToggleProfilePopover,
  onNavigate,
  onOpenTransactionDrawer,
  onLogout,
  onToggleTheme,
  invites,
  notifications,
  showNotificationsPanel,
  onToggleNotificationsPanel,
  onAcceptInvite,
  onRejectInvite,
  onMarkNotificationRead,
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
  hasExportableTransactions,
  onExportCSV,
}) {
  const userInitial = (currentUser.username || currentUser.displayName || currentUser.email || '?').charAt(0).toUpperCase();
  const userLabel = currentUser.username || currentUser.displayName || currentUser.email;

  const profilePopover = (mobile = false) => (
    <div className={`profile-popover ${mobile ? 'mobile-dropdown' : ''}`}>
      <div className="profile-popover-header">Sua Conta</div>
      {mobile ? (
        <div className="profile-popover-user-info">
          <h4>{userLabel}</h4>
          <span>{currentUser.email}</span>
        </div>
      ) : null}
      <div className="profile-popover-item" onClick={() => { onNavigate('userSettings'); onToggleProfilePopover(false); }}>
        ⚙ Configurações
      </div>
      <div className="profile-popover-item" onClick={() => { onToggleTheme(); onToggleProfilePopover(false); }}>
        {theme === 'dark' ? '☀️ Modo Claro' : '🌙 Modo Escuro'}
      </div>
      <div className="profile-popover-divider" />
      <button type="button" className="profile-popover-logout" onClick={() => { onLogout(); onToggleProfilePopover(false); }}>
        🚪 Sair do App
      </button>
    </div>
  );

  return (
    <div className="app-layout">
      <header className="mobile-header">
        <button type="button" className="mobile-project-btn" onClick={() => onToggleProjectDropdown()}>
          <span className="mobile-project-avatar">
            {activeProjectId === null ? 'G' : (activeProjectName || '?').charAt(0).toUpperCase()}
          </span>
          <span className="mobile-project-name">
            {activeProjectId === null ? 'Geral' : (activeProjectName || '...')}
          </span>
          <span className="mobile-project-arrow">▾</span>
        </button>

        <div className="mobile-header-actions">
          <NotificationsDropdown
            invites={invites}
            notifications={notifications}
            open={showNotificationsPanel}
            onToggle={onToggleNotificationsPanel}
            onAcceptInvite={onAcceptInvite}
            onRejectInvite={onRejectInvite}
            onMarkNotificationRead={onMarkNotificationRead}
          />
          <button type="button" className="mobile-profile-avatar" onClick={() => onToggleProfilePopover()}>
            {userInitial}
          </button>
        </div>

        {showProjectDropdown ? (
          <ProjectSelectorDropdown
            className="mobile-dropdown"
            projects={projects}
            activeProjectId={activeProjectId}
            currentUserId={currentUser.uid}
            onSelectProject={onSelectProject}
            onOpenProjectSettings={onOpenProjectSettings}
            onNewProject={onNewProject}
          />
        ) : null}

        {showProfilePopover ? profilePopover(true) : null}
      </header>

      <aside className="sidebar">
        <div className="sidebar-brand">
          <img
            id="logo"
            src={theme === 'dark' ? '/karonte-logo-dark.svg' : '/karonte-logo-light.svg'}
            alt="Karonte"
            style={{ height: 32, width: 'auto' }}
          />
        </div>

        <div className="project-selector-container">
          <button type="button" className="project-selector-btn" onClick={() => onToggleProjectDropdown()}>
            <div className="project-selector-avatar">
              {activeProjectId === null ? 'G' : (activeProjectName || '?').charAt(0).toUpperCase()}
            </div>
            <div className="project-selector-info">
              <span className="project-selector-title">Projeto</span>
              <span className="project-selector-name">
                {activeProjectId === null ? 'Geral' : (activeProjectName || '...')}
              </span>
            </div>
            <span className="project-selector-arrow">▾</span>
          </button>

          {showProjectDropdown ? (
            <ProjectSelectorDropdown
              projects={projects}
              activeProjectId={activeProjectId}
              currentUserId={currentUser.uid}
              onSelectProject={onSelectProject}
              onOpenProjectSettings={onOpenProjectSettings}
              onNewProject={onNewProject}
            />
          ) : null}
        </div>

        <nav className="sidebar-nav">
          <a href="#" className={`nav-item ${currentView === 'hub' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); onNavigate('hub'); }}>
            <span className="icon">◈</span> Visão geral
          </a>
          <a href="#" className={`nav-item ${currentView === 'budgets' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); onNavigate('budgets'); }}>
            <span className="icon">○</span> Orçamentos
          </a>
          <a href="#" className={`nav-item ${currentView === 'tarefas' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); onNavigate('tarefas'); }}>
            <span className="icon">☑</span> Tarefas
          </a>
          {canAddToProject ? (
            <a href="#" className={`nav-item ${currentView === 'import' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); onNavigate('import'); }}>
              <span className="icon">↓</span> Importar
            </a>
          ) : null}
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile-card" onClick={() => onToggleProfilePopover()}>
            <div className="avatar">{userInitial}</div>
            <div className="user-profile-details">
              <span className="user-profile-name">{userLabel}</span>
              <span className="user-profile-email">{currentUser.email}</span>
            </div>
            <span className="profile-options-trigger">⚙</span>
          </div>
          {showProfilePopover ? profilePopover(false) : null}
        </div>
      </aside>

      <nav className="mobile-bottom-nav">
        <a href="#" className={`mobile-nav-item ${currentView === 'hub' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); onNavigate('hub'); }}>
          <span className="icon">◈</span>
          <span className="label">Início</span>
        </a>
        {canAddToProject ? (
          <button type="button" className="mobile-nav-fab" onClick={onOpenTransactionDrawer} aria-label="Novo lançamento">
            +
          </button>
        ) : null}
        <a href="#" className={`mobile-nav-item ${currentView === 'budgets' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); onNavigate('budgets'); }}>
          <span className="icon">○</span>
          <span className="label">Orçamento</span>
        </a>
        <a href="#" className={`mobile-nav-item ${currentView === 'tarefas' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); onNavigate('tarefas'); }}>
          <span className="icon">☑</span>
          <span className="label">Tarefas</span>
        </a>
        {canAddToProject ? (
          <a href="#" className={`mobile-nav-item ${currentView === 'import' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); onNavigate('import'); }}>
            <span className="icon">↓</span>
            <span className="label">Importar</span>
          </a>
        ) : null}
      </nav>

      <div className="content-wrapper">
        <header className="top-bar">
          <div className="page-context">
            <h2 className="page-title">{PAGE_TITLES[currentView] || 'Karonte'}</h2>
            {activeProjectId !== null && activeProjectName ? (
              <span className="project-badge">{activeProjectName}</span>
            ) : null}
          </div>

          <div className="top-actions">
            <div className="period-filter">
              <select className="month-select" value={selectedMonth} onChange={(e) => onMonthChange(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleString('pt-BR', { month: 'short' }).toUpperCase()}</option>
                ))}
              </select>
              <select className="year-select" value={selectedYear} onChange={(e) => onYearChange(Number(e.target.value))}>
                <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
              </select>
            </div>
            {hasExportableTransactions ? (
              <button type="button" onClick={onExportCSV} className="export-btn" title="Exportar CSV">Download Relatório</button>
            ) : null}
            <div className="divider" />
            <div className="desktop-only">
              <NotificationsDropdown
                invites={invites}
                notifications={notifications}
                open={showNotificationsPanel}
                onToggle={onToggleNotificationsPanel}
                onAcceptInvite={onAcceptInvite}
                onRejectInvite={onRejectInvite}
                onMarkNotificationRead={onMarkNotificationRead}
              />
            </div>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
