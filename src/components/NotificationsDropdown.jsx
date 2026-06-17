export default function NotificationsDropdown({
  invites,
  notifications,
  open,
  onToggle,
  onAcceptInvite,
  onRejectInvite,
  onMarkNotificationRead,
  className = 'notifications-wrap',
}) {
  return (
    <div className={className}>
      <button
        type="button"
        className="notifications-btn"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        title="Notificações"
      >
        🔔
        {invites.length > 0 ? <span className="notifications-badge">{invites.length}</span> : null}
      </button>
      {open ? (
        <div className="notifications-dropdown" onClick={(e) => e.stopPropagation()}>
          <div className="notifications-dropdown-header">Notificações</div>
          {invites.length === 0 && notifications.length === 0 ? (
            <div className="notifications-empty">Nenhuma notificação.</div>
          ) : null}
          {invites.map((inv) => (
            <div key={inv.id} className="notification-item notification-invite">
              <div className="notification-invite-text">
                Convite para o projeto <strong>{inv.projectName}</strong> com acesso{' '}
                <strong>
                  {inv.role === 'view' ? 'somente leitura' : inv.role === 'add' ? 'ver e incluir' : 'ver, incluir e excluir'}
                </strong>.
              </div>
              <div className="notification-invite-actions">
                <button type="button" className="btn-confirm" onClick={() => onAcceptInvite(inv)}>Aceitar</button>
                <button type="button" className="btn-cancel" onClick={() => onRejectInvite(inv.id)}>Recusar</button>
              </div>
            </div>
          ))}
          {notifications.filter((n) => !n.read).map((n) => (
            <div key={n.id} className="notification-item">
              <span>{n.type === 'invite' ? 'Convite' : n.type}</span>
              <button type="button" className="text-btn" onClick={() => onMarkNotificationRead(n.id)}>Marcar lida</button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
