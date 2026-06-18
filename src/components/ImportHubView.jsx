import React, { useState } from 'react';
import StatementImportView from './StatementImportView';
import InvoiceImportView from './InvoiceImportView';
import ImportHistoryView from './ImportHistoryView';

const TABS = [
  { id: 'statement', label: 'Extrato' },
  { id: 'invoice', label: 'Nota fiscal' },
  { id: 'history', label: 'Histórico' },
];

export default function ImportHubView(props) {
  const [tab, setTab] = useState('statement');

  return (
    <main className="import-view main-content">
      <div className="import-tabs card">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`import-tab ${tab === item.id ? 'import-tab--active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'statement' ? <StatementImportView {...props} embedded /> : null}
      {tab === 'invoice' ? (
        <InvoiceImportView
          expenseCategories={props.expenseCategories}
          canAddToProject={props.canAddToProject}
          onSaveInvoice={props.onSaveInvoice}
          formatMoney={props.formatMoney}
        />
      ) : null}
      {tab === 'history' ? (
        <ImportHistoryView
          currentUser={props.currentUser}
          activeProjectId={props.activeProjectId}
          activeProject={props.activeProject}
          transactions={props.transactions}
          canDeleteInProject={props.canDeleteInProject}
          onUndoImport={props.onUndoImport}
          formatMoney={props.formatMoney}
        />
      ) : null}
    </main>
  );
}
