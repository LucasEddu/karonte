import { computeParcelaValue, computeParcelasPagas, computeTaskProgressPct } from '../utils/taskCalculations';

export default function TasksView({
  activeProjectId,
  canAddToProject,
  canDeleteInProject,
  tasks,
  tasksLoading,
  tasksTab,
  tasksSort,
  sortedAndFilteredTasks,
  formatMoney,
  onTasksTabChange,
  onTasksSortChange,
  onOpenTaskModal,
  onToggleTaskComplete,
  onOpenPaymentModal,
  onDeleteTask,
}) {
  return (
    <main className="main-content">
      <div className="card list-section">
        <div className="list-header">
          <h2>Tarefas</h2>
          {activeProjectId && canAddToProject ? (
            <button type="button" className="submit-btn" onClick={() => onOpenTaskModal()} style={{ padding: '8px 16px', fontSize: 13 }}>
              + Nova tarefa
            </button>
          ) : null}
        </div>
        {activeProjectId ? (
          <div className="tasks-toolbar">
            <div className="tasks-tabs">
              <button type="button" className={`tasks-tab ${tasksTab === 'pendentes' ? 'active' : ''}`} onClick={() => onTasksTabChange('pendentes')}>
                Pendentes ({tasks.filter((t) => !t.completed).length})
              </button>
              <button type="button" className={`tasks-tab ${tasksTab === 'concluidas' ? 'active' : ''}`} onClick={() => onTasksTabChange('concluidas')}>
                Concluídas ({tasks.filter((t) => !!t.completed).length})
              </button>
            </div>
            <div className="tasks-sort">
              <label className="tasks-sort-label">Ordenar por</label>
              <select value={tasksSort} onChange={(e) => onTasksSortChange(e.target.value)} className="tasks-sort-select">
                <option value="updatedAt">Última alteração</option>
                <option value="createdAt">Data de inclusão</option>
                <option value="title">Nome (A–Z)</option>
                <option value="metaValue">Valor total (maior)</option>
              </select>
            </div>
          </div>
        ) : null}
        {!activeProjectId ? (
          <p className="tasks-empty-hint">Selecione um projeto no seletor para gerenciar as tarefas desse projeto.</p>
        ) : tasksLoading ? (
          <p className="tasks-empty-hint">Carregando tarefas...</p>
        ) : sortedAndFilteredTasks.length === 0 ? (
          <p className="tasks-empty-hint">
            {tasksTab === 'concluidas'
              ? 'Nenhuma tarefa concluída ainda.'
              : 'Nenhuma tarefa pendente ainda. Clique em "+ Nova tarefa" para adicionar.'}
          </p>
        ) : (
          <ul className="tasks-list">
            {sortedAndFilteredTasks.map((task) => {
              const meta = Number(task.metaValue) || 0;
              const paid = Number(task.paidAmount) || 0;
              const isDespesa = task.type === 'despesa';
              const parcelasCount = Number(task.parcelas) || 0;
              const parcelaValue = computeParcelaValue(meta, parcelasCount);
              const parcelasPagas = computeParcelasPagas(paid, parcelaValue, parcelasCount);
              const parcelasRestantes = parcelasCount > 0 ? Math.max(0, parcelasCount - parcelasPagas) : 0;
              const progressPct = computeTaskProgressPct(task);
              return (
                <li key={task.id} className={`task-item ${task.completed ? 'completed' : ''} ${isDespesa ? 'task-despesa' : ''}`}>
                  <label className="task-check-wrap">
                    <input type="checkbox" checked={!!task.completed} onChange={() => onToggleTaskComplete(task)} />
                    <span className="task-check-custom" />
                  </label>
                  <div className="task-body">
                    <div className="task-row">
                      <span className="task-title">{task.title}</span>
                      {parcelasCount > 0 && <span className="task-parcelas">{parcelasCount}x</span>}
                      <div className="task-actions">
                        {canAddToProject && isDespesa && meta > 0 && (
                          <button type="button" className="task-btn-pay" onClick={() => onOpenPaymentModal(task)} title="Registrar pagamento">+ Abater</button>
                        )}
                        {canAddToProject && <button type="button" className="task-btn-edit" onClick={() => onOpenTaskModal(task)} title="Editar">✎</button>}
                        {canDeleteInProject && <button type="button" className="task-btn-delete" onClick={() => onDeleteTask(task.id)} title="Excluir">✕</button>}
                      </div>
                    </div>
                    {(meta > 0 || isDespesa) && (
                      <div className="task-progress-wrap">
                        <div className="task-meta-info">
                          {isDespesa && meta > 0 && (
                            <span className="task-meta-text">R$ {formatMoney(paid)} de R$ {formatMoney(meta)}</span>
                          )}
                          {parcelasCount > 0 && meta > 0 && (
                            <span className="task-meta-parcela">Valor parcela: R$ {formatMoney(parcelaValue)}</span>
                          )}
                          {isDespesa && parcelasCount > 0 && meta > 0 && (
                            <span className="task-meta-parcelas-status">
                              Parcelas: {parcelasPagas}/{parcelasCount} pagas • faltam {parcelasRestantes}
                            </span>
                          )}
                          {task.createdByName ? <span className="task-meta-text">por {task.createdByName}</span> : null}
                        </div>
                        <div className="progress-bg task-progress-bg">
                          <div className="progress-fill task-progress-fill" style={{ width: `${progressPct}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
