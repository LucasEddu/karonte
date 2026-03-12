import { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import './App.css';

function App() {
  // --------- STATE: AUTH ---------
  const [users, setUsers] = useState(() => {
    const saved = localStorage.getItem('finance_users');
    let parsedUsers = saved ? JSON.parse(saved) : [];
    
    // Always ensure the default admin exists, in case cache wiped it or it was saved incorrectly in older versions.
    if (!parsedUsers.some(u => u.username === 'admin')) {
       parsedUsers.push({ id: 'admin-1', username: 'admin', password: 'admin', role: 'admin', active: true });
    }
    return parsedUsers;
  });
  
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('finance_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [authMode, setAuthMode] = useState('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // --------- STATE: TRANSACTIONS & FORM ---------
  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem('finance_transactions');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [category, setCategory] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);

  // --------- STATE: BUDGETS & GOALS ---------
  // Maps category name to a numeric limit e.g. { 'Moradia': 1500, 'Lazer': 300 }
  const [budgets, setBudgets] = useState(() => {
    const saved = localStorage.getItem('finance_budgets');
    return saved ? JSON.parse(saved) : {};
  });

  // --------- STATE: UI NAVIGATION & FILTERS ---------
  const [currentView, setCurrentView] = useState('dashboard');
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const expenseCategories = ['Moradia', 'Alimentação', 'Lazer', 'Transporte', 'Saúde', 'Outros'];
  const incomeCategories = ['Salário', 'Investimentos', 'Freelance', 'Outros'];
  const COLORS = ['#1D9E75', '#5DCAA5', '#f87171', '#f59e0b', '#8b5cf6', '#3b82f6'];

  // --------- EFFECTS ---------
  useEffect(() => { localStorage.setItem('finance_users', JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem('finance_budgets', JSON.stringify(budgets)); }, [budgets]);
  useEffect(() => { 
    if (currentUser) localStorage.setItem('finance_current_user', JSON.stringify(currentUser));
    else localStorage.removeItem('finance_current_user');
  }, [currentUser]);
  useEffect(() => { localStorage.setItem('finance_transactions', JSON.stringify(transactions)); }, [transactions]);

  // RECURRING TRANSACTIONS EFFECT: Runs once on login to process recurrences
  useEffect(() => {
    if (!currentUser || currentUser.role === 'admin') return;
    
    // Simple logic: check if any recurring transaction exists in previous months 
    // but wasn't cloned to the current month yet.
    const runRecurrences = () => {
       const today = new Date();
       const currentM = today.getMonth() + 1;
       const currentY = today.getFullYear();
       
       const userRecurrents = transactions.filter(t => t.userId === currentUser.id && t.isRecurring);
       let hasNewGenerations = false;
       let newBatch = [...transactions];

       // For each recurring transaction, check if we need to clone it
       userRecurrents.forEach(rt => {
         const tDate = new Date(rt.date);
         
         // If it's a past month (this year, or previous year)
         if ((tDate.getFullYear() < currentY) || (tDate.getFullYear() === currentY && (tDate.getMonth() + 1) < currentM)) {
            
            // Generate missing months up to Current
            let y = tDate.getFullYear();
            let m = tDate.getMonth() + 1;
            
            while(y < currentY || (y === currentY && m < currentM)) {
              m++;
              if (m > 12) { m = 1; y++; }
              
              // Check if already cloned for this target month
              const alreadyCloned = userRecurrents.some(existing => {
                const exD = new Date(existing.date);
                return existing.parentId === rt.id && exD.getMonth() + 1 === m && exD.getFullYear() === y;
              });

              if (!alreadyCloned) {
                // Determine a safe day
                const targetDay = Math.min(tDate.getDate(), new Date(y, m, 0).getDate());
                const targetDate = new Date(y, m - 1, targetDay, 12, 0, 0); // Noon

                newBatch.push({
                   ...rt,
                   id: crypto.randomUUID(),
                   parentId: rt.parentId || rt.id, // Linking back to original
                   date: targetDate.toISOString(),
                   displayDate: targetDate.toLocaleDateString('pt-BR')
                });
                hasNewGenerations = true;
              }
            }
         }
       });

       if (hasNewGenerations) {
         setTransactions(newBatch);
       }
    };

    runRecurrences();
  }, [currentUser]); // Run on mount / login


  // --------- AUTH LOGIC ---------
  const handleAuth = (e) => {
    e.preventDefault();
    setAuthError('');
    if (authMode === 'login') {
      const user = users.find(u => u.username === authUsername && u.password === authPassword);
      if (user) {
        if (!user.active) { setAuthError('Usuário bloqueado.'); return; }
        setCurrentUser(user);
        setAuthUsername(''); setAuthPassword('');
      } else {
        setAuthError('Credenciais inválidas.');
      }
    } else {
      if (users.find(u => u.username === authUsername)) { setAuthError('Usuário já existe.'); return; }
      const newUser = { id: crypto.randomUUID(), username: authUsername, password: authPassword, role: 'user', active: true };
      setUsers([...users, newUser]);
      setCurrentUser(newUser);
      setAuthUsername(''); setAuthPassword('');
    }
  };

  const handleLogout = () => setCurrentUser(null);

  // --------- ADMIN PANEL LOGIC ---------
  const handleToggleUserStatus = (id) => {
    if (id === currentUser.id) return alert('Você não pode bloquear a si mesmo.');
    setUsers(users.map(u => u.id === id ? { ...u, active: !u.active } : u));
  };

  const handleEditUsername = (id, currentUsername) => {
    const newName = prompt(`Novo nome de usuário (atual: ${currentUsername}):`, currentUsername);
    if (!newName || newName === currentUsername) return;
    if (users.some(u => u.username === newName && u.id !== id)) return alert('Este nome já está em uso.');
    setUsers(users.map(u => u.id === id ? { ...u, username: newName } : u));
    if (currentUser.id === id) setCurrentUser({...currentUser, username: newName});
  };

  const handleResetPassword = (id, username) => {
    const newPass = prompt(`Nova senha para ${username} (a senha atual não é exibida):`);
    if (!newPass) return;
    setUsers(users.map(u => u.id === id ? { ...u, password: newPass } : u));
    alert(`Senha atualizada com sucesso.`);
    if (currentUser.id === id) setCurrentUser({...currentUser, password: newPass});
  };

  const handleChangeOwnPassword = () => {
    const newPass = prompt('Sua nova senha de administrador:');
    if (!newPass) return;
    setUsers(users.map(u => u.id === currentUser.id ? { ...u, password: newPass } : u));
    setCurrentUser({...currentUser, password: newPass});
    alert('Sua senha foi alterada com sucesso.');
  };

  // --------- TRANSACTION FORM MASK & LOGIC ---------
  const handleAmountChange = (e) => {
    let value = e.target.value.replace(/\D/g, ''); 
    if (value === '') { setAmount(''); return; }
    const num = parseInt(value, 10) / 100;
    const formatted = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    setAmount(formatted);
  };

  const handleAddTransaction = (e) => {
    e.preventDefault();
    if (!description || !amount || !category) return;
    
    const numericAmount = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
    if(isNaN(numericAmount) || numericAmount <= 0) return;

    /*
      Force logic for selected filter month instead of pure "today".
      So if user is viewing "Feb/2026", new transaction goes into Feb.
    */
    const now = new Date();
    // Use selected month/year but keep today's day/time if viewing current month, otherwise 1st of month.
    const isCurrentPeriod = (selectedMonth === now.getMonth() + 1) && (selectedYear === now.getFullYear());
    
    let dateObj;
    if (isCurrentPeriod) {
       dateObj = now;
    } else {
       dateObj = new Date(selectedYear, selectedMonth - 1, 1, 12, 0, 0); 
    }
    
    const newTransaction = {
      id: crypto.randomUUID(),
      userId: currentUser.id,
      description,
      amount: numericAmount,
      type,
      category,
      isRecurring: isRecurring && type === 'expense', // Only support repeating expenses for now
      date: dateObj.toISOString(), 
      displayDate: dateObj.toLocaleDateString('pt-BR')
    };
    
    setTransactions([newTransaction, ...transactions]);
    setDescription(''); setAmount(''); setCategory(''); setIsRecurring(false);
  };

  const handleDelete = (id) => {
     setTransactions(transactions.filter(t => t.id !== id));
  };


  // --------- DATA CALCULATIONS (Memoized) ---------
  
  const userTransactions = useMemo(() => {
    return transactions.filter(t => t.userId === currentUser?.id);
  }, [transactions, currentUser]);

  const filteredTransactions = useMemo(() => {
    return userTransactions.filter(t => {
      const d = new Date(t.date);
      return (d.getMonth() + 1 === selectedMonth) && (d.getFullYear() === selectedYear);
    }).sort((a,b) => new Date(b.date) - new Date(a.date));
  }, [userTransactions, selectedMonth, selectedYear]);

  const totalIncome = filteredTransactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = filteredTransactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
  const balance = totalIncome - totalExpense;

  const categoryStats = useMemo(() => {
    const expenses = filteredTransactions.filter(t => t.type === 'expense');
    
    return expenseCategories.map(cat => {
       const total = expenses.filter(t => t.category === cat).reduce((sum, item) => sum + item.amount, 0);
       return { name: cat, total };
    }).filter(item => item.total > 0).sort((a,b) => b.total - a.total);
  }, [filteredTransactions]);

  const monthlyEvolutionData = useMemo(() => {
    const data = [];
    const currentDate = new Date();
    
    for (let i = 5; i >= 0; i--) {
       const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
       const tMonth = targetDate.getMonth() + 1;
       const tYear = targetDate.getFullYear();
       
       const monthTrans = userTransactions.filter(t => {
         const d = new Date(t.date);
         return d.getMonth() + 1 === tMonth && d.getFullYear() === tYear;
       });

       const mIncome = monthTrans.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
       const mExpense = monthTrans.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
       
       data.push({
         name: targetDate.toLocaleString('pt-BR', { month: 'short' }).toUpperCase(),
         Receitas: mIncome,
         Despesas: mExpense,
         Saldo: mIncome - mExpense
       });
    }
    return data;
  }, [userTransactions]);


  // --------- HELPERS ---------
  const formatMoney = (val) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const getCatColor = (index) => COLORS[index % COLORS.length];

  // Budget Manager logic
  const getCategoryBudgetInfo = (catName, currentSpent) => {
    // Check user specifically or default
    const userBudgets = budgets[currentUser?.id] || {};
    const limit = userBudgets[catName] || 0; // 0 means no limit defined
    
    if (limit === 0) return { limit: 0, pct: 0, isOver80: false, isOver100: false };
    
    const pct = (currentSpent / limit) * 100;
    return {
       limit,
       pct: Math.min(pct, 100), // Cap visual to 100
       isOver80: pct >= 80,
       isOver100: pct > 100
    };
  };

  const handleBudgetChange = (catName) => {
    const val = prompt(`Definir limite mensal para ${catName} (Apenas números, 0 para remover):`);
    if (val === null) return;
    const num = parseFloat(val);
    if (isNaN(num)) return;
    
    setBudgets(prev => {
      const userObj = { ...(prev[currentUser.id] || {}) };
      if (num === 0) delete userObj[catName];
      else userObj[catName] = num;
      return { ...prev, [currentUser.id]: userObj };
    });
  };

  // --------- EXPORT ---------
  const exportToCSV = () => {
    if(filteredTransactions.length === 0) return;
    
    const headers = "Data,Tipo,Categoria,Descricao,Valor\n";
    const csvContent = headers + filteredTransactions.map(t => {
      return `${t.displayDate},${t.type === 'income' ? 'Receita' : 'Despesa'},${t.category},"${t.description}",${t.amount}`;
    }).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `extrato_${selectedMonth}_${selectedYear}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  // ================= VIEWS =================

  if (!currentUser) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h2>{authMode === 'login' ? 'Entrar' : 'Criar Conta'}</h2>
            <p>Acesse seu controle financeiro.</p>
          </div>
          {authError && <div className="auth-error">{authError}</div>}
          <form className="auth-form" onSubmit={handleAuth}>
            <div className="form-group">
              <label>Usuário</label>
              <input type="text" value={authUsername} onChange={e => setAuthUsername(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Senha</label>
              <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} required />
            </div>
            <button type="submit" className="submit-btn full-width auth-btn">
              {authMode === 'login' ? 'Acessar' : 'Registrar'}
            </button>
          </form>
          <div className="auth-footer">
            <p>
              {authMode === 'login' ? 'Novo por aqui?' : 'Já possui conta?'} 
              <button type="button" className="text-btn" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }}>
                {authMode === 'login' ? 'Registre-se' : 'Faça login'}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (currentUser.role === 'admin') {
    return (
      <div className="admin-layout">
         <header className="top-bar admin-bar">
          <div className="user-info">
            <div className="avatar">A</div>
            <div className="user-details">
              <h3>Painel Admin</h3>
              <span>Gestão de Sistema</span>
            </div>
          </div>
          <div className="top-actions">
            <button onClick={handleChangeOwnPassword} className="text-btn" style={{marginRight: 15, color: 'var(--text-secondary)'}}>Alterar Senha Admin</button>
            <button onClick={handleLogout} className="logout-btn">Sair</button>
          </div>
        </header>

        <main className="main-content padding-container">
          <div className="card list-section">
              <div className="list-header">
                <h2>Gerenciar Usuários</h2>
              </div>
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Usuário</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th style={{textAlign: 'right'}}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td>
                          {u.username}
                          {u.id === currentUser.id && <span style={{marginLeft: 8, fontSize: 10, color: 'var(--text-tertiary)'}}>(Você)</span>}
                        </td>
                        <td>{u.role === 'admin' ? 'Administrador' : 'Usuário'}</td>
                        <td style={{color: u.active ? 'var(--success-color)' : 'var(--danger-color)'}}>
                           {u.active ? 'Ativo' : 'Bloqueado'}
                        </td>
                        <td style={{textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end'}}>
                           <button className="text-btn" onClick={() => handleEditUsername(u.id, u.username)} title="Alterar Login">Editar Nome</button>
                           <button className="text-btn" onClick={() => handleResetPassword(u.id, u.username)} title="Alterar Senha">Resetar Senha</button>
                           {u.id !== currentUser.id && (
                             <button className="text-btn" onClick={() => handleToggleUserStatus(u.id)} style={{color: u.active ? 'var(--danger-color)' : 'var(--success-color)'}}>
                                {u.active ? 'Inativar' : 'Ativar'}
                             </button>
                           )}
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

  // View: USER MAIN LAYOUT
  return (
    <div className="app-layout">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">Δ</div>
          <span>MIDNIGHT</span>
        </div>
        
        <nav className="sidebar-nav">
          <a href="#" className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setCurrentView('dashboard'); }}>
            <span className="icon">⊞</span> Dashboard
          </a>
          <a href="#" className={`nav-item ${currentView === 'analytics' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setCurrentView('analytics'); }}>
            <span className="icon">◠</span> Análises
          </a>
          <a href="#" className={`nav-item ${currentView === 'budgets' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setCurrentView('budgets'); }}>
            <span className="icon">○</span> Orçamentos
          </a>
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="content-wrapper">
        <header className="top-bar">
          <div className="user-info">
            <div className="avatar">{currentUser.username.charAt(0).toUpperCase()}</div>
            <div className="user-details">
              <h3>{currentUser.username}</h3>
              <span>{new Date(selectedYear, selectedMonth-1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
          
          <div className="top-actions">
            <div className="period-filter">
               <select className="month-select" value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
                 {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                   <option key={m} value={m}>{new Date(2000, m-1, 1).toLocaleString('pt-BR', {month: 'short'}).toUpperCase()}</option>
                 ))}
               </select>
               <select className="year-select" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                  <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                  <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
               </select>
            </div>
            {filteredTransactions.length > 0 && (
               <button onClick={exportToCSV} className="export-btn" title="Exportar CSV">Descarga</button>
            )}
            <div className="divider"></div>
            <button onClick={handleLogout} className="logout-btn">Sair</button>
          </div>
        </header>

        {currentView === 'dashboard' && (
          <main className="main-content">
            
            <section className="dashboard-grid">
              
              <div className="card grid-card">
                <div className="balance-label">SALDO ATUAL</div>
                <div className="balance-value">R$ {formatMoney(balance)}</div>
                <div className="mini-cards-container">
                  <div className="mini-card income">
                    <span className="mini-label">Entradas</span>
                    <span className="mini-value income">R$ {formatMoney(totalIncome)}</span>
                  </div>
                  <div className="mini-card expense">
                    <span className="mini-label">Saídas</span>
                    <span className="mini-value expense">R$ {formatMoney(totalExpense)}</span>
                  </div>
                </div>
              </div>

              <div className="card grid-card">
                <div className="card-title">Despesas por Categoria (Top 3)</div>
                <div className="category-list">
                  {categoryStats.length === 0 ? (
                     <div style={{fontSize: 11, color: 'var(--text-tertiary)'}}>Nenhuma despesa no mês.</div>
                  ) : (
                    categoryStats.slice(0, 3).map((item, index) => {
                      const budgetInfo = getCategoryBudgetInfo(item.name, item.total);
                      const isUnbudgeted = budgetInfo.limit === 0;
                      
                      // visual percentage falls back to just relative size if no budget
                      let visualPct = isUnbudgeted ? Math.min((item.total / totalExpense)*100, 100) : budgetInfo.pct;
                      const color = budgetInfo.isOver100 ? 'var(--danger-color)' : getCatColor(index);

                      return (
                        <div key={item.name} className="cat-item">
                          <div className="cat-header">
                            <span className="cat-name">{item.name}</span>
                            <div>
                              {budgetInfo.isOver80 && <span className="badge-alert">{visualPct.toFixed(0)}% Util</span>}
                              <span className="cat-value" style={{color: color}}>R$ {formatMoney(item.total)}</span>
                            </div>
                          </div>
                          <div className="progress-bg" title={!isUnbudgeted ? `Limite: R$ ${budgetInfo.limit}` : ''}>
                            <div className="progress-fill" style={{width: `${visualPct}%`, backgroundColor: color}}></div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="card grid-card">
                <div className="card-title">Resumo Mensal ({new Date(selectedYear, selectedMonth-1).toLocaleString('pt-BR', { month: 'short' })})</div>
                <div className="goals-list">
                  {/* Reuse goal layout to show period summary */}
                  <div className="goal-card" style={{backgroundColor: 'var(--bg-color)', border: '0.5px solid var(--border-color)'}}>
                    <div className="goal-header">
                      <span className="goal-name-target">Balanço do Período</span>
                      <span className="goal-percent" style={{color: balance >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}}>
                        {balance >= 0 ? '+' : ''}{((balance / (totalIncome || 1)) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="progress-bg" style={{height: 2}}>
                      <div className="progress-fill" style={{width: '100%', backgroundColor: balance >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}}></div>
                    </div>
                  </div>
                  
                  <div style={{fontSize: 10, color: 'var(--text-tertiary)', padding: '5px', lineHeight: 1.4}}>
                    Este mês você gastou <span style={{color:'var(--text-primary)'}}>R$ {formatMoney(totalExpense)}</span> e 
                    arrecadou <span style={{color:'var(--text-primary)'}}>R$ {formatMoney(totalIncome)}</span>.
                    {balance < 0 && <span style={{color: 'var(--danger-color)'}}><br/>Déficit Operacional detectado.</span>}
                  </div>
                </div>
              </div>
            </section>

            <section className="card form-section">
              <form onSubmit={handleAddTransaction} className="transaction-form" style={{gridTemplateColumns: '2fr 1fr 1fr 1fr auto'}}>
                <div className="form-group">
                  <label>Descrição</label>
                  <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Conta de Luz" required />
                  {type === 'expense' && (
                     <label className="checkbox-label" style={{display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', marginTop: 4}}>
                        <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} style={{width: 'auto', margin: 0}} />
                        Repetir mensamente
                     </label>
                  )}
                </div>
                
                <div className="form-group" style={{justifyContent: 'flex-start'}}>
                  <label>Valor (R$)</label>
                  <input type="text" value={amount} onChange={handleAmountChange} placeholder="0,00" required />
                </div>
                
                <div className="form-group" style={{justifyContent: 'flex-start'}}>
                  <label>Tipo</label>
                  <select value={type} onChange={(e) => { setType(e.target.value); setCategory(''); setIsRecurring(false); }}>
                    <option value="expense">Despesa</option>
                    <option value="income">Receita</option>
                  </select>
                </div>
                
                <div className="form-group" style={{justifyContent: 'flex-start'}}>
                  <label>Categoria</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} required>
                    <option value="" disabled>Selecione</option>
                    {(type === 'expense' ? expenseCategories : incomeCategories).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                
                <button type="submit" className="submit-btn" style={{alignSelf: 'flex-start', marginTop: '18px'}}>Registrar</button>
              </form>
            </section>

            <section className="card list-section">
              <div className="list-header">
                <h2>Registros Recentes</h2>
                <span className="link-all" style={{color: 'var(--text-tertiary)'}}>{filteredTransactions.length} registros</span>
              </div>
              
              <div className="history-list">
                {filteredTransactions.length === 0 ? (
                  <div style={{fontSize: 11, padding: '1rem', textAlign: 'center', color: 'var(--text-tertiary)'}}>
                    Ainda não há registros lançados neste mês.
                  </div>
                ) : (
                  filteredTransactions.map(t => (
                    <div key={t.id} className="history-item">
                      <div className={`t-icon-box ${t.type}`}>
                        <div className={t.type === 'expense' ? 'arrow-down' : 'arrow-up'}></div>
                      </div>
                      <div className="t-details">
                        <span className="t-name">
                           {t.description} 
                           {t.isRecurring && <span title="Despesa Recorrente" style={{marginLeft: 4, color: 'var(--primary-color)'}}>⟳</span>}
                        </span>
                        <span className="t-meta">{t.category} • {t.displayDate}</span>
                      </div>
                      <div className={`t-amount ${t.type}`}>
                        {t.type === 'expense' ? '− ' : '+ '}R$ {formatMoney(t.amount)}
                      </div>
                      <button className="delete-btn-subtle" onClick={() => handleDelete(t.id)} title="Remover">×</button>
                    </div>
                  ))
                )}
              </div>
            </section>
          </main>
        )}

        {currentView === 'analytics' && (
           <main className="main-content">
              <div className="card grid-card" style={{height: '350px', marginBottom: '10px'}}>
                 <div className="card-title">Evolução do Saldo Liquido (6 meses)</div>
                 <ResponsiveContainer width="100%" height="90%">
                    <LineChart data={monthlyEvolutionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--text-tertiary)" fontSize={10} tickFormatter={(val) => `R$${val/1000}k`} tickLine={false} axisLine={false} />
                      <RechartsTooltip contentStyle={{backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)', borderRadius: '8px', fontSize: '11px'}} />
                      <Legend iconType="circle" wrapperStyle={{fontSize: '11px', color: 'var(--text-secondary)'}} />
                      <Line type="monotone" dataKey="Saldo" stroke="var(--primary-color)" strokeWidth={2} dot={{fill: 'var(--primary-color)', r: 4}} activeDot={{r: 6}} />
                      <Line type="monotone" dataKey="Receitas" stroke="var(--success-color)" strokeWidth={1} strokeDasharray="5 5" dot={false} />
                      <Line type="monotone" dataKey="Despesas" stroke="var(--danger-color)" strokeWidth={1} strokeDasharray="5 5" dot={false} />
                    </LineChart>
                 </ResponsiveContainer>
              </div>

              <div className="dashboard-grid">
                 <div className="card grid-card" style={{height: '250px'}}>
                   <div className="card-title">Composição do Gasto</div>
                   {categoryStats.length > 0 ? (
                      <ResponsiveContainer width="100%" height="90%">
                        <PieChart>
                          <Pie data={categoryStats} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="total">
                            {categoryStats.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={getCatColor(index)} stroke="rgba(0,0,0,0)" />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(val) => `R$ ${formatMoney(val)}`} contentStyle={{backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)', borderRadius: '8px', fontSize: '11px'}} />
                        </PieChart>
                      </ResponsiveContainer>
                   ) : (
                      <div style={{fontSize: 11, color: 'var(--text-tertiary)', marginTop: '2rem'}}>Sem dados.</div>
                   )}
                 </div>
              </div>
           </main>
        )}

        {currentView === 'budgets' && (
           <main className="main-content">
             <div className="card list-section">
                <div className="list-header">
                  <h2>Gestão de Limite Mensal (Orçamento)</h2>
                </div>
                <div style={{fontSize: 11, color: 'var(--text-tertiary)', marginBottom: '1rem'}}>
                   Defina um teto de gastos para alertar quando estiver próximo ao limite. Clique sobre a categoria para editar.
                </div>

                <div className="history-list">
                  {expenseCategories.map(cat => {
                     const catSpent = filteredTransactions.filter(t => t.type === 'expense' && t.category === cat).reduce((acc, curr) => acc + curr.amount, 0);
                     const info = getCategoryBudgetInfo(cat, catSpent);
                     const hasBudget = info.limit > 0;
                     
                     return (
                      <div key={cat} className="history-item" onClick={() => handleBudgetChange(cat)} style={{cursor: 'pointer'}}>
                        <div className="t-details">
                          <span className="t-name">{cat}</span>
                          <span className="t-meta">
                             {hasBudget ? `Gasto: R$ ${formatMoney(catSpent)} de R$ ${formatMoney(info.limit)}` : 'Sem Limite (Clique para definir)'}
                          </span>
                        </div>
                        {hasBudget && (
                           <div style={{width: 100, marginRight: 15}}>
                             <div className="progress-bg">
                               <div className="progress-fill" style={{width: `${info.pct}%`, backgroundColor: info.isOver100 ? 'var(--danger-color)' : 'var(--primary-color)'}}></div>
                             </div>
                           </div>
                        )}
                        <div className="t-amount" style={{color: info.isOver80 ? 'var(--danger-color)' : 'var(--text-tertiary)'}}>
                           {hasBudget ? `${info.pct.toFixed(0)}%` : '—'}
                        </div>
                      </div>
                     );
                  })}
                </div>
             </div>
           </main>
        )}
      </div>
    </div>
  );
}

export default App;
