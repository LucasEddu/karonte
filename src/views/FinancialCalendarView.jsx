import { useMemo, useState } from 'react';
import {
  buildFinancialCalendarEvents,
  calculateDayTotals,
  calculateMonthCalendarSummary,
  getMonthCalendarGrid,
  groupEventsByDate,
  toDateKey,
} from '../utils/financialCalendar.js';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const TYPE_LABELS = {
  income: 'Receita',
  expense: 'Despesa',
  recurring: 'Recorrente',
  installment: 'Parcela',
  card_invoice: 'Fatura',
  task: 'Tarefa',
};

const FILTER_TYPES = [
  { id: 'all', label: 'Todos' },
  { id: 'income', label: 'Receitas' },
  { id: 'expense', label: 'Despesas' },
  { id: 'card_invoice', label: 'Cartões' },
  { id: 'task', label: 'Tarefas' },
  { id: 'recurring', label: 'Recorrentes' },
];

const matchesFilter = (ev, filter) => {
  if (filter === 'all') return true;
  if (filter === 'expense') return ev.type === 'expense' || ev.type === 'installment';
  if (filter === 'recurring') return ev.type === 'recurring' || ev.type === 'installment';
  return ev.type === filter;
};

export default function FinancialCalendarView({
  transactions = [],
  creditCards = [],
  tasks = [],
  currentUser,
  activeProjectId,
  formatMoney,
  canAddToProject,
  onOpenTransactionForDate,
  onOpenTaskModal,
  onOpenCardDetails,
  initialMonth,
  initialYear,
}) {
  const now = new Date();
  const [month, setMonth] = useState(initialMonth || now.getMonth() + 1);
  const [year, setYear] = useState(initialYear || now.getFullYear());
  const [selectedDay, setSelectedDay] = useState(toDateKey(now));
  const [filter, setFilter] = useState('all');

  const events = useMemo(
    () =>
      buildFinancialCalendarEvents({
        transactions,
        creditCards,
        tasks,
        month,
        year,
        userId: currentUser?.uid,
      }),
    [transactions, creditCards, tasks, month, year, currentUser?.uid]
  );

  const filteredEvents = useMemo(
    () => events.filter((ev) => matchesFilter(ev, filter)),
    [events, filter]
  );

  const byDate = useMemo(() => groupEventsByDate(filteredEvents), [filteredEvents]);
  const summary = useMemo(() => calculateMonthCalendarSummary(filteredEvents), [filteredEvents]);
  const grid = useMemo(() => getMonthCalendarGrid(month, year), [month, year]);
  const todayKey = toDateKey(now);
  const dayEvents = byDate[selectedDay] || [];
  const dayTotals = calculateDayTotals(dayEvents);

  const shiftMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  };

  const handleEventClick = (ev) => {
    if (ev.type === 'task' && ev.metadata?.task) {
      onOpenTaskModal?.(ev.metadata.task);
      return;
    }
    if (ev.type === 'card_invoice' && ev.metadata?.card) {
      onOpenCardDetails?.(ev.metadata.card);
      return;
    }
    if (ev.metadata?.transaction) {
      onOpenTransactionForDate?.(ev.metadata.transaction);
    }
  };

  return (
    <main className="main-content calendar-view">
      <div className="card calendar-toolbar">
        <div className="calendar-nav">
          <button type="button" className="text-btn" onClick={() => shiftMonth(-1)}>‹ Anterior</button>
          <h2>{MONTH_NAMES[month - 1]} {year}</h2>
          <button type="button" className="text-btn" onClick={() => shiftMonth(1)}>Próximo ›</button>
        </div>
        <div className="calendar-filters">
          {FILTER_TYPES.map((f) => (
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

      <div className="calendar-summary-strip">
        <div className="calendar-summary-item">
          <span>Receitas</span>
          <strong className="text-success">R$ {formatMoney(summary.income)}</strong>
        </div>
        <div className="calendar-summary-item">
          <span>Despesas</span>
          <strong className="text-danger">R$ {formatMoney(summary.expense)}</strong>
        </div>
        <div className="calendar-summary-item">
          <span>Saldo previsto</span>
          <strong>R$ {formatMoney(summary.projectedBalance)}</strong>
        </div>
        <div className="calendar-summary-item">
          <span>Faturas</span>
          <strong>{summary.cardInvoices}</strong>
        </div>
        <div className="calendar-summary-item">
          <span>Tarefas</span>
          <strong>{summary.tasksDue}</strong>
        </div>
      </div>

      <div className="calendar-layout card">
        <div className="calendar-grid-wrap">
          <div className="calendar-weekdays">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {grid.flat().map((cell) => {
              const key = cell.key;
              const count = (byDate[key] || []).length;
              const isSelected = key === selectedDay;
              const isToday = key === todayKey;
              return (
                <button
                  key={key}
                  type="button"
                  className={`calendar-day ${cell.inMonth ? '' : 'calendar-day--muted'} ${isSelected ? 'calendar-day--selected' : ''} ${isToday ? 'calendar-day--today' : ''}`}
                  onClick={() => setSelectedDay(key)}
                >
                  <span className="calendar-day-num">{cell.inMonth ? cell.day : ''}</span>
                  {count > 0 ? <span className="calendar-day-dot">{count}</span> : null}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="calendar-day-panel">
          <div className="calendar-day-panel-header">
            <h3>{selectedDay ? new Date(selectedDay + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Dia'}</h3>
            {canAddToProject && selectedDay ? (
              <button
                type="button"
                className="submit-btn calendar-add-btn"
                onClick={() => onOpenTransactionForDate?.(new Date(selectedDay + 'T12:00:00'))}
              >
                + Lançamento
              </button>
            ) : null}
          </div>
          <div className="calendar-day-totals">
            <span>Entradas: R$ {formatMoney(dayTotals.income)}</span>
            <span>Saídas: R$ {formatMoney(dayTotals.expense)}</span>
          </div>
          {dayEvents.length === 0 ? (
            <p className="calendar-empty">Nenhum evento neste dia.</p>
          ) : (
            <ul className="calendar-event-list">
              {dayEvents.map((ev) => (
                <li key={ev.id}>
                  <button type="button" className="calendar-event-item" onClick={() => handleEventClick(ev)}>
                    <span className={`calendar-event-type calendar-event-type--${ev.type}`}>
                      {TYPE_LABELS[ev.type] || ev.type}
                    </span>
                    <span className="calendar-event-title">{ev.title}</span>
                    {ev.amount > 0 ? (
                      <span className={`calendar-event-amount ${ev.type === 'income' ? 'text-success' : 'text-danger'}`}>
                        R$ {formatMoney(ev.amount)}
                      </span>
                    ) : null}
                    {ev.status === 'forecast' ? <span className="calendar-event-forecast">previsto</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </main>
  );
}
