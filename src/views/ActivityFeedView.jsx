import { useEffect, useMemo, useState } from 'react';
import { getActivityLogsByScope } from '../services/activityService.js';
import { filterActivityLogs, formatRelativeTime } from '../utils/activityLog.js';

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'transactions', label: 'Transações' },
  { id: 'tasks', label: 'Tarefas' },
  { id: 'projects', label: 'Projetos' },
  { id: 'imports', label: 'Importações' },
  { id: 'budgets', label: 'Orçamentos' },
];

const ICONS = {
  transaction: '💰',
  task: '☑',
  project: '👥',
  import: '📄',
  budget: '📊',
  credit_card: '💳',
  other: '•',
};

export default function ActivityFeedView({
  currentUser,
  activeProjectId,
  activeProject,
}) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!currentUser?.uid) return;
    setLoading(true);
    getActivityLogsByScope(currentUser.uid, activeProjectId)
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [currentUser?.uid, activeProjectId]);

  const filtered = useMemo(() => filterActivityLogs(logs, filter), [logs, filter]);

  return (
    <main className="main-content activity-view">
      <div className="card activity-header">
        <h2>Atividades</h2>
        <p className="activity-context">
          {activeProjectId && activeProject
            ? `Projeto: ${activeProject.name}`
            : 'Finanças Gerais'}
        </p>
        <div className="activity-filters">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`calendar-filter-btn ${filter === f.id ? 'active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card"><p>Carregando atividades…</p></div>
      ) : filtered.length === 0 ? (
        <div className="card"><p>Nenhuma atividade registrada ainda.</p></div>
      ) : (
        <ul className="activity-list card">
          {filtered.map((log) => (
            <li key={log.id} className="activity-item">
              <span className="activity-icon">{ICONS[log.entityType] || ICONS.other}</span>
              <div className="activity-body">
                <p className="activity-message">{log.message}</p>
                <span className="activity-meta">
                  {log.actorName} • {formatRelativeTime(log.createdAt)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
