import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar,
  AreaChart, Area
} from 'recharts';
import './App.css';
import { auth } from './config/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { login, register, logout, getAllUsers, toggleUserStatus, updateUsername, changeOwnPassword, sendPasswordReset } from './services/authService';
import { addTransaction, getUserTransactions, deleteTransaction } from './services/transactionService';
import { getUserBudgets, saveUserBudgets } from './services/budgetService';
import { getUserCategories, saveUserCategories } from './services/categoriesService';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', backgroundColor: '#fef2f2', color: '#991b1b', height: '100vh', width: '100vw', boxSizing: 'border-box' }}>
          <h2>Application Crash 💥</h2>
          <p>O React travou devido ao seguinte erro de execução:</p>
          <pre style={{ whiteSpace: 'pre-wrap', backgroundColor: '#fee2e2', padding: '1rem', borderRadius: '8px' }}>
             {this.state.error && this.state.error.toString()}
          </pre>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: '1rem' }}>
             <summary>Component Stack trace</summary>
             <div style={{ backgroundColor: '#fff', padding: '1rem', borderRadius: '4px', fontSize: 12 }}>
                 {this.state.errorInfo && this.state.errorInfo.componentStack}
             </div>
          </details>
          <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', marginTop: 20, cursor: 'pointer' }}>Recarregar App</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  // --------- STATE: THEME ---------
  const [theme, setTheme] = useState(() => localStorage.getItem('finance_theme') || 'dark');

  // --------- STATE: AUTH ---------
  const [users, setUsers] = useState([]); // Will be populated for admins
  const [editingUserId, setEditingUserId] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [resetSentId, setResetSentId] = useState(null); // uid com feedback inline
  const [adminOwnPassInput, setAdminOwnPassInput] = useState('');
  const [adminOwnPassVisible, setAdminOwnPassVisible] = useState(false);
  const [adminOwnPassMsg, setAdminOwnPassMsg] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [authMode, setAuthMode] = useState('login');
  const [authFullName, setAuthFullName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // --------- STATE: TRANSACTIONS & FORM ---------
  const [transactions, setTransactions] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [category, setCategory] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);

  // --------- STATE: CUSTOM CATEGORIES ---------
  const [customCategories, setCustomCategories] = useState({ expense: [], income: [] });
  const [showCatManager, setShowCatManager] = useState(false);
  const [newCatName, setNewCatName]  = useState('');
  const [newCatType, setNewCatType]  = useState('expense');
  const [catSaving, setCatSaving]    = useState(false);

  const DEFAULT_EXPENSE_CATS = ['Moradia', 'Alimentação', 'Lazer', 'Transporte', 'Saúde', 'Outros'];
  const DEFAULT_INCOME_CATS  = ['Salário', 'Investimentos', 'Freelance', 'Outros'];

  // Merged lists — defaults + custom (no duplicates)
  const expenseCategories = [...new Set([...DEFAULT_EXPENSE_CATS, ...customCategories.expense])];
  const incomeCategories  = [...new Set([...DEFAULT_INCOME_CATS,  ...customCategories.income])];

  const COLORS = ['#1D9E75', '#5DCAA5', '#f87171', '#f59e0b', '#8b5cf6', '#3b82f6'];

  // --------- STATE: BUDGETS & GOALS ---------
  const [budgets, setBudgets] = useState({});

  // --------- STATE: UI NAVIGATION & FILTERS ---------
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // --------- EFFECTS ---------
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('finance_theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // Firebase Auth Observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Here we could re-fetch full custom data if needed, or rely on login payload.
        // For simplicity, we just set true unless they log in via the full service first.
        // But doing a quick doc fetch is safer to get role
        import('firebase/firestore').then(({ getDoc, doc }) => {
           import('./config/firebase').then(({ db }) => {
              getDoc(doc(db, 'users', user.uid)).then(userDoc => {
                if (userDoc.exists()) {
                   setCurrentUser({ ...user, ...userDoc.data() });
                } else {
                   setCurrentUser(user);
                }
                setAuthLoading(false);
              }).catch(err => {
                 console.error("Auth DB Error:", err);
                 setCurrentUser(user);
                 setAuthLoading(false);
              });
           })
        });
      } else {
        setCurrentUser(null);
        setAuthLoading(false);
        setTransactions([]);
        setBudgets({});
        setCustomCategories({ expense: [], income: [] });
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch user data when currentUser changes
  useEffect(() => {
    const fetchData = async () => {
       if (!currentUser) return;
       setDataLoading(true);
       try {
         const txs = await getUserTransactions(currentUser.uid);
         setTransactions(txs);
         
         const userBudgets = await getUserBudgets(currentUser.uid);
         setBudgets(userBudgets);

         // Load custom categories
         const cats = await getUserCategories(currentUser.uid);
         setCustomCategories(cats);
         
         if (currentUser.role === 'admin') {
            const allU = await getAllUsers();
            setUsers(allU);
         }
       } catch (error) {
         console.error("Error fetching data:", error);
       } finally {
         setDataLoading(false);
       }
    };
    fetchData();
  }, [currentUser]);

  // RECURRING TRANSACTIONS EFFECT: Runs once on login to process recurrences
  useEffect(() => {
    if (!currentUser || currentUser.role === 'admin') return;
    
    // Simple logic: check if any recurring transaction exists in previous months 
    // but wasn't cloned to the current month yet.
    const runRecurrences = () => {
       const today = new Date();
       const currentM = today.getMonth() + 1;
       const currentY = today.getFullYear();
       
       const userRecurrents = transactions.filter(t => t.userId === currentUser.uid && t.isRecurring);
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
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (authMode === 'register' && authPassword !== authConfirmPassword) {
      setAuthError('As senhas não coincidem. Verifique e tente novamente.');
      return;
    }

    try {
      if (authMode === 'login') {
         await login(authEmail, authPassword);
      } else {
         await register(authEmail, authPassword, authFullName);
      }
      setAuthUsername(''); setAuthEmail(''); setAuthPassword(''); setAuthFullName(''); setAuthConfirmPassword('');
    } catch (error) {
       console.error(error.message);
       if (error.code === 'auth/invalid-credential') setAuthError('Credenciais inválidas.');
       else if (error.code === 'auth/email-already-in-use') setAuthError('Usuário já existe.');
       else if (error.message === 'access-denied') setAuthError('Usuário bloqueado pelo administrador.');
       else setAuthError('Ocorreu um erro. Tente novamente.');
    }
  };

  const handleLogout = async () => {
     await logout();
  };

  // --------- ADMIN PANEL LOGIC ---------
  const handleToggleUserStatus = async (id, currentStatus) => {
    if (id === currentUser.uid) return;
    try {
      await toggleUserStatus(id, currentStatus);
      setUsers(users.map(u => u.id === id ? { ...u, active: !u.active } : u));
    } catch(err) { console.error('Erro ao alterar status', err); }
  };

  const handleStartEditUsername = (u) => {
    setEditingUserId(u.id);
    setEditingValue(u.username);
    setResetSentId(null);
  };

  const handleSaveUsername = async (id) => {
    const trimmed = editingValue.trim();
    if (!trimmed) { setEditingUserId(null); return; }
    try {
      await updateUsername(id, trimmed);
      setUsers(users.map(u => u.id === id ? { ...u, username: trimmed } : u));
      if (currentUser.uid === id) setCurrentUser({...currentUser, username: trimmed});
    } catch (err) { console.error('Erro ao atualizar nome', err); }
    setEditingUserId(null);
  };

  const handleSendPasswordReset = async (uid, email) => {
    try {
      await sendPasswordReset(email);
      setResetSentId(uid);
      setTimeout(() => setResetSentId(prev => prev === uid ? null : prev), 4000);
    } catch(err) { console.error('Erro ao enviar reset', err); }
  };

  const handleChangeOwnPassword = async (e) => {
    e.preventDefault();
    if (!adminOwnPassInput.trim()) return;
    try {
      await changeOwnPassword(auth.currentUser, adminOwnPassInput);
      setAdminOwnPassMsg('Senha alterada com sucesso!');
      setAdminOwnPassInput('');
      setTimeout(() => { setAdminOwnPassMsg(''); setAdminOwnPassVisible(false); }, 3000);
    } catch (err) {
      setAdminOwnPassMsg('Erro ao mudar senha. Tente relogar.');
    }
  };

  // --------- TRANSACTION FORM MASK & LOGIC ---------
  const handleAmountChange = (e) => {
    let value = e.target.value.replace(/\D/g, ''); 
    if (value === '') { setAmount(''); return; }
    const num = parseInt(value, 10) / 100;
    const formatted = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    setAmount(formatted);
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!description || !amount || !category) return;
    
    const numericAmount = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
    if(isNaN(numericAmount) || numericAmount <= 0) return;

    const now = new Date();
    const isCurrentPeriod = (selectedMonth === now.getMonth() + 1) && (selectedYear === now.getFullYear());
    
    let dateObj = isCurrentPeriod ? now : new Date(selectedYear, selectedMonth - 1, 1, 12, 0, 0); 
    
    const newTransaction = {
      description,
      amount: numericAmount,
      type,
      category,
      isRecurring: isRecurring && type === 'expense', 
      date: dateObj.toISOString(), 
      displayDate: dateObj.toLocaleDateString('pt-BR')
    };
    
    try {
      const savedDoc = await addTransaction(newTransaction);
      setTransactions([savedDoc, ...transactions]);
      setDescription(''); setAmount(''); setCategory(''); setIsRecurring(false);
    } catch(err) { alert('Erro ao salvar transação.'); }
  };

  const handleDelete = async (id) => {
     try {
       await deleteTransaction(id);
       setTransactions(transactions.filter(t => t.id !== id));
     } catch (err) { alert('Erro ao deletar') }
  };


  // --------- DATA CALCULATIONS (Memoized) ---------
  
  const userTransactions = useMemo(() => {
    return transactions.filter(t => t.userId === currentUser?.uid);
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

  const exportToCSV = () => {
    if (filteredTransactions.length === 0) return;
    const headers = ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor'];
    const rows = filteredTransactions.map(t => [
      t.displayDate,
      t.description,
      t.category,
      t.type === 'income' ? 'Receita' : 'Despesa',
      t.amount.toString().replace('.', ',')
    ]);
    const csvContent = "\uFEFF" + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `karonte_export_${selectedMonth}_${selectedYear}.csv`;
    link.click();
  };

  const getCatFill = (index, catName) => {
    if (catName === 'Moradia') return 'var(--cat-moradia-fill)';
    if (catName === 'Alimentação') return 'var(--cat-alimentacao-fill)';
    if (catName === 'Lazer') return 'var(--cat-lazer-fill)';
    return COLORS[index % COLORS.length];
  };

  const getCatTrack = (catName) => {
    if (catName === 'Moradia') return 'var(--cat-moradia-track)';
    if (catName === 'Alimentação') return 'var(--cat-alimentacao-track)';
    if (catName === 'Lazer') return 'var(--cat-lazer-track)';
    return 'var(--border-medium)';
  };

  // Budget Manager logic
  const getCategoryBudgetInfo = (catName, currentSpent) => {
    // Check user specifically or default
    const limit = budgets[catName] || 0; // 0 means no limit defined
    
    if (limit === 0) return { limit: 0, pct: 0, isOver80: false, isOver100: false };
    
    const pct = (currentSpent / limit) * 100;
    return {
       limit,
       pct: Math.min(pct, 100), // Cap visual to 100
       isOver80: pct >= 80,
       isOver100: pct > 100
    };
  };

  const handleBudgetChange = async (catName) => {
    const val = prompt(`Definir limite mensal para ${catName} (Apenas números, 0 para remover):`);
    if (val === null) return;
    const num = parseFloat(val);
    if (isNaN(num)) return;
    
    const newBudgets = { ...budgets };
    if (num === 0) delete newBudgets[catName];
    else newBudgets[catName] = num;

    try {
       await saveUserBudgets(newBudgets);
       setBudgets(newBudgets);
    } catch(err) { alert('Erro ao salvar orçamento.')}
  };

  // --------- CUSTOM CATEGORIES HANDLERS ---------
  const handleAddCustomCategory = async () => {
    const name = newCatName.trim();
    if (!name || !currentUser) return;
    const allForType = newCatType === 'expense' ? expenseCategories : incomeCategories;
    if (allForType.map(c => c.toLowerCase()).includes(name.toLowerCase())) {
      alert('Esta categoria já existe.');
      return;
    }
    const updated = { expense: [...customCategories.expense], income: [...customCategories.income] };
    updated[newCatType].push(name.charAt(0).toUpperCase() + name.slice(1));
    setCatSaving(true);
    try {
      await saveUserCategories(currentUser.uid, updated);
      setCustomCategories(updated);
      setNewCatName('');
    } catch (err) {
      alert('Erro ao salvar categoria.');
    } finally {
      setCatSaving(false);
    }
  };

  const handleRemoveCustomCategory = async (catName, catType) => {
    if (!currentUser) return;
    const updated = {
      expense: customCategories.expense.filter(c => c !== catName),
      income:  customCategories.income.filter(c  => c !== catName),
    };
    if (category === catName) setCategory('');
    try {
      await saveUserCategories(currentUser.uid, updated);
      setCustomCategories(updated);
    } catch(err) {
      alert('Erro ao remover categoria.');
    }
  };

  // --------- CHATBOT ---------
  const [chatMessages, setChatMessages] = useState([
    { id: 'welcome', sender: 'bot', text: 'Olá! Sou seu assistente. Me mande algo como "cinema 50" ou me pergunte "qual meu saldo?".' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [pendingAction, setPendingAction] = useState(null);

  const processChatMessage = (text) => {
    // 1. Lowercase and Basic Parsing
    const normalized = text.toLowerCase().trim();
    
    // Check for contextual questions
    if (normalized.includes('meu saldo') || normalized.includes('saldo atual')) {
       return { type: 'answer', text: `Seu saldo atual neste período é de R$ ${formatMoney(balance)}.` };
    }
    if (normalized.includes('quanto gastei') || normalized.includes('total de saídas')) {
       return { type: 'answer', text: `Você gastou R$ ${formatMoney(totalExpense)} nas despesas deste mês.` };
    }

    // 2. Data Extraction via Regex
    // Look for the first float or integer
    const moneyMatch = normalized.match(/(?:r\$)?\s?(\d+(?:[.,]\d{1,2})?)/);
    if (!moneyMatch) {
       return { type: 'answer', text: 'Desculpe, não consegui identificar um valor (ex: "50", "120.50"). Pode tentar novamente?' };
    }

    const valueStr = moneyMatch[1].replace(',', '.');
    const numericValue = parseFloat(valueStr);

    // Remove the number from text to get description
    let desc = normalized.replace(moneyMatch[0], '').trim();
    if (desc.startsWith('-') || desc.startsWith('com ')) desc = desc.substring(1).trim();
    if (!desc) desc = 'Registro via Assistente';

    // 3. Inference rules
    const incomeKeywords = ['salário', 'salario', 'freelance', 'receita', 'renda', 'bônus', 'bonus', 'pagamento'];
    let inferType = 'expense';
    if (incomeKeywords.some(kw => normalized.includes(kw))) inferType = 'income';

    // Check custom income categories first (exact lowercase name match)
    if (inferType === 'expense') {
      const matchCustomIncome = customCategories.income.find(c => normalized.includes(c.toLowerCase()));
      if (matchCustomIncome) inferType = 'income';
    }

    // Check category mapping
    let inferCategory = 'Outros';
    if (inferType === 'expense') {
       // Check custom expense categories first
       const matchCustom = customCategories.expense.find(c => normalized.includes(c.toLowerCase()));
       if (matchCustom) inferCategory = matchCustom;
       else if (/(academia|cinema|bar|lazer|balada|jogo)/.test(normalized)) inferCategory = 'Lazer';
       else if (/(mercado|supermercado|restaurante|pizza|ifood|lanche|comida|padaria)/.test(normalized)) inferCategory = 'Alimentação';
       else if (/(aluguel|reforma|condomínio|condominio|luz|água|agua|conta)/.test(normalized)) inferCategory = 'Moradia';
       else if (/(farmácia|farmacia|médico|medico|consulta|remédio|remedio)/.test(normalized)) inferCategory = 'Saúde';
       else if (/(transporte|uber|99|gasolina|combustível|onibus|ônibus|metro|metrô)/.test(normalized)) inferCategory = 'Transporte';
    } else {
       // Check custom income categories
       const matchCustom = customCategories.income.find(c => normalized.includes(c.toLowerCase()));
       if (matchCustom) inferCategory = matchCustom;
       else if (/(salário|salario)/.test(normalized)) inferCategory = 'Salário';
       else if (/(freelance)/.test(normalized)) inferCategory = 'Freelance';
    }

    // Capitalize first letter of description for beauty
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);

    return {
       type: 'action',
       text: 'Entendi! Deseja registrar a seguinte movimentação?',
       payload: {
          description: desc,
          amount: numericValue,
          type: inferType,
          category: inferCategory
       }
    };
  };

  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    // Reject new input if there is a pending confirmation
    if (pendingAction) {
       if (chatInput.toLowerCase() === 'sim') { handleChatConfirm(); return; }
       if (chatInput.toLowerCase() === 'não' || chatInput.toLowerCase() === 'nao') { handleChatCancel(); return; }
       alert("Por favor, confirme (sim) ou cancele (não) a ação atual antes de enviar outra mensagem.");
       return;
    }

    const userMsg = { id: crypto.randomUUID(), sender: 'user', text: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    
    // Process NLP
    const response = processChatMessage(chatInput);
    setChatInput('');

    setTimeout(() => {
       const botMsg = { id: crypto.randomUUID(), sender: 'bot', text: response.text };
       setChatMessages(prev => [...prev, botMsg]);

       if (response.type === 'action') {
          setPendingAction(response.payload);
       }
    }, 600); // Artificial thinking delay
  };

  const handleChatConfirm = async () => {
     if (!pendingAction) return;
     
     const now = new Date();
     const isCurrentPeriod = (selectedMonth === now.getMonth() + 1) && (selectedYear === now.getFullYear());
     const dateObj = isCurrentPeriod ? now : new Date(selectedYear, selectedMonth - 1, 1, 12, 0, 0); 

     const newTransaction = {
      description: pendingAction.description,
      amount: pendingAction.amount,
      type: pendingAction.type,
      category: pendingAction.category,
      isRecurring: false,
      date: dateObj.toISOString(), 
      displayDate: dateObj.toLocaleDateString('pt-BR')
    };
    
    try {
      const savedDoc = await addTransaction(newTransaction);
      setTransactions([savedDoc, ...transactions]);
      setPendingAction(null);
      setChatInput('');

      setChatMessages(prev => [
         ...prev, 
         { id: crypto.randomUUID(), sender: 'user', text: 'Sim' }, // Visual feedback
         { id: crypto.randomUUID(), sender: 'bot', text: `Feito! Registrei ${pendingAction.type === 'income' ? 'a receita' : 'a despesa'} com sucesso no seu dashboard.` }
      ]);
    } catch(err) { alert('Erro ao registrar via chat') }
  };

  const handleChatCancel = () => {
    setPendingAction(null);
    setChatInput('');
    setChatMessages(prev => [
       ...prev, 
       { id: crypto.randomUUID(), sender: 'user', text: 'Não' }, // Visual feedback
       { id: crypto.randomUUID(), sender: 'bot', text: 'Tudo bem, registro cancelado.' }
    ]);
  };

  const chatSuggestionClick = (txt) => {
     if(pendingAction) return;
     setChatInput(txt);
  };


  // ================= VIEWS =================

  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', color: 'var(--text-primary)' }}>
         <div className="spinner" style={{ border: '3px solid var(--border-color)', borderTopColor: 'var(--primary-color)', borderRadius: '50%', width: 40, height: 40, animation: 'spin 1s linear infinite' }}></div>
         <p style={{ marginTop: 15 }}>Conectando ao Karonte...</p>
         <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h2>{authMode === 'login' ? 'Entrar no Karonte' : 'Criar Conta no Karonte'}</h2>
            <p>Seu sistema de controle financeiro.</p>
          </div>
          {authError && <div className="auth-error">{authError}</div>}
          <form className="auth-form" onSubmit={handleAuth}>
            {authMode === 'register' && (
               <>
                 <div className="form-group">
                   <label>Nome Completo</label>
                   <input type="text" value={authFullName} onChange={e => setAuthFullName(e.target.value)} required />
                 </div>
                 <div className="form-group">
                   <label>Nome de Usuário (Como quer ser chamado)</label>
                   <input type="text" value={authUsername} onChange={e => setAuthUsername(e.target.value)} required />
                 </div>
               </>
            )}
            <div className="form-group">
              <label>E-mail</label>
              <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Senha</label>
              <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} required />
            </div>
            {authMode === 'register' && (
              <div className="form-group">
                <label>Confirmar Senha</label>
                <input
                  type="password"
                  value={authConfirmPassword}
                  onChange={e => setAuthConfirmPassword(e.target.value)}
                  placeholder="Repita a senha acima"
                  required
                  style={authConfirmPassword && authPassword !== authConfirmPassword ? {borderColor: 'var(--danger-color)'} : {}}
                />
                {authConfirmPassword && authPassword !== authConfirmPassword && (
                  <span style={{fontSize: 10, color: 'var(--danger-color)', marginTop: 2}}>As senhas não coincidem</span>
                )}
              </div>
            )}
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
          <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '11px', color: 'var(--text-tertiary)' }}>
            Desenvolvido por Lucas Eduardo Moura Santos
          </div>
        </div>
      </div>
    );
  }

  if (currentUser.role === 'admin') {
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.active).length;
    const blockedUsers = totalUsers - activeUsers;

    return (
      <div className="admin-layout">
        <header className="top-bar admin-bar">
          <div className="user-info">
            <div className="avatar" style={{background: 'var(--primary-bg)', color: 'var(--primary-color)', fontWeight: 700}}>A</div>
            <div className="user-details">
              <h3>Painel Admin</h3>
              <span>Gestão de Acessos — Karonte</span>
            </div>
          </div>
          <div className="top-actions">
            <button onClick={toggleTheme} className="text-btn" style={{fontSize: '14px'}} title="Mudar Tema">
               {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button onClick={() => { setAdminOwnPassVisible(v => !v); setAdminOwnPassMsg(''); }} className="logout-btn">
              {adminOwnPassVisible ? 'Cancelar' : 'Alterar Minha Senha'}
            </button>
            <button onClick={handleLogout} className="logout-btn">Sair</button>
          </div>
        </header>

        {/* Admin own password change form */}
        {adminOwnPassVisible && (
          <div className="admin-own-pass-bar">
            <form onSubmit={handleChangeOwnPassword} className="admin-own-pass-form">
              <input
                type="password"
                placeholder="Nova senha de administrador"
                value={adminOwnPassInput}
                onChange={e => setAdminOwnPassInput(e.target.value)}
                className="admin-inline-input"
                autoFocus
              />
              <button type="submit" className="submit-btn">Salvar Senha</button>
              {adminOwnPassMsg && (
                <span className={`admin-msg ${adminOwnPassMsg.includes('sucesso') ? 'admin-msg--ok' : 'admin-msg--err'}`}>
                  {adminOwnPassMsg}
                </span>
              )}
            </form>
          </div>
        )}

        <main className="main-content padding-container">

          {/* Summary cards */}
          <div className="admin-stats-row">
            <div className="admin-stat-card">
              <span className="admin-stat-label">Total de Usuários</span>
              <span className="admin-stat-value">{totalUsers}</span>
            </div>
            <div className="admin-stat-card admin-stat-card--ok">
              <span className="admin-stat-label">Ativos</span>
              <span className="admin-stat-value" style={{color: 'var(--success-color)'}}>{activeUsers}</span>
            </div>
            <div className="admin-stat-card admin-stat-card--err">
              <span className="admin-stat-label">Bloqueados</span>
              <span className="admin-stat-value" style={{color: 'var(--danger-color)'}}>{blockedUsers}</span>
            </div>
          </div>

          {/* Users table */}
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
                    <th style={{textAlign: 'right'}}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className={editingUserId === u.id ? 'admin-row--editing' : ''}>
                      {/* Nome Completo */}
                      <td>{u.fullName || '—'}</td>

                      {/* Email */}
                      <td style={{color: 'var(--text-secondary)', fontSize: 10}}>{u.email}</td>

                      {/* Usuário (inline edit) */}
                      <td>
                        {editingUserId === u.id ? (
                          <div style={{display: 'flex', gap: 6, alignItems: 'center'}}>
                            <input
                              className="admin-inline-input"
                              value={editingValue}
                              onChange={e => setEditingValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveUsername(u.id); if (e.key === 'Escape') setEditingUserId(null); }}
                              autoFocus
                            />
                            <button className="admin-action-btn admin-action-btn--ok" onClick={() => handleSaveUsername(u.id)}>✓</button>
                            <button className="admin-action-btn" onClick={() => setEditingUserId(null)}>✕</button>
                          </div>
                        ) : (
                          <span>
                            {u.username}
                            {u.id === currentUser.uid && <span className="admin-you-badge">você</span>}
                          </span>
                        )}
                      </td>

                      {/* Role */}
                      <td>
                        <span className={`admin-role-badge ${u.role === 'admin' ? 'admin-role-badge--admin' : 'admin-role-badge--user'}`}>
                          {u.role === 'admin' ? 'Admin' : 'Usuário'}
                        </span>
                      </td>

                      {/* Status */}
                      <td>
                        <span style={{color: u.active ? 'var(--success-color)' : 'var(--danger-color)', fontSize: 11}}>
                          {u.active ? '● Ativo' : '● Bloqueado'}
                        </span>
                      </td>

                      {/* Ações */}
                      <td style={{textAlign: 'right'}}>
                        <div style={{display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap'}}>
                          {/* Editar usuário */}
                          {editingUserId !== u.id && (
                            <button className="admin-action-btn" onClick={() => handleStartEditUsername(u)} title="Editar nome de usuário">
                              ✏️ Editar
                            </button>
                          )}

                          {/* Reset senha */}
                          {u.id !== currentUser.uid && (
                            resetSentId === u.id ? (
                              <span className="admin-msg admin-msg--ok">✉ Email enviado!</span>
                            ) : (
                              <button
                                className="admin-action-btn"
                                onClick={() => handleSendPasswordReset(u.id, u.email)}
                                title={`Enviar reset de senha para ${u.email}`}
                              >
                                🔑 Alterar Senha
                              </button>
                            )
                          )}

                          {/* Bloquear / Ativar */}
                          {u.id !== currentUser.uid && (
                            <button
                              className="admin-action-btn"
                              style={{color: u.active ? 'var(--danger-color)' : 'var(--success-color)'}}
                              onClick={() => handleToggleUserStatus(u.id, u.active)}
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

  // View: USER MAIN LAYOUT
  return (
    <div className="app-layout">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img 
             id="logo"
             src={theme === 'dark' ? '/karonte-logo-dark.svg' : '/karonte-logo-light.svg'} 
             alt="Karonte" 
             style={{height: 40, width: 'auto'}} 
          />
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
        <div style={{ marginTop: 'auto', padding: '20px', textAlign: 'center', fontSize: '10px', color: 'var(--text-tertiary)', opacity: 0.7 }}>
          Desenvolvido por<br/>Lucas Eduardo Moura Santos
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="content-wrapper">
        <header className="top-bar">
          <div className="user-info">
            <div className="avatar">{(currentUser.username || currentUser.displayName || currentUser.email || '?').charAt(0).toUpperCase()}</div>
            <div className="user-details">
              <h3>{currentUser.username || currentUser.displayName || currentUser.email}</h3>
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
            <button onClick={toggleTheme} className="text-btn" style={{marginRight: 10, fontSize: '14px', alignSelf: 'center'}} title="Mudar Tema">
               {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button onClick={handleLogout} className="logout-btn">Sair</button>
          </div>
        </header>

        {currentView === 'dashboard' && (
          <div className="dashboard-layout">
            <main className="dashboard-main main-content">
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
                        
                        let visualPct = isUnbudgeted ? Math.min((item.total / totalExpense)*100, 100) : budgetInfo.pct;
                        const fillCol = budgetInfo.isOver100 ? 'var(--danger-color)' : getCatFill(index, item.name);
                        const trackCol = getCatTrack(item.name);

                        return (
                          <div key={item.name} className="cat-item">
                            <div className="cat-header">
                              <span className="cat-name">{item.name}</span>
                              <div>
                                {budgetInfo.isOver80 && <span className="badge-alert">{visualPct.toFixed(0)}% Util</span>}
                                <span className="cat-value" style={{color: fillCol}}>R$ {formatMoney(item.total)}</span>
                              </div>
                            </div>
                            <div className="progress-bg" title={!isUnbudgeted ? `Limite: R$ ${budgetInfo.limit}` : ''} style={{backgroundColor: trackCol}}>
                              <div className="progress-fill" style={{width: `${visualPct}%`, backgroundColor: fillCol}}></div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                <div className="card grid-card">
                  <div className="card-title">Resumo Mensal</div>
                  <div className="goals-list">
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
                <form onSubmit={handleAddTransaction} className="transaction-form">
                  <div className="form-group">
                    <label>Descrição</label>
                    <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Conta de Luz" required />
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

                  <button type="submit" className="submit-btn" style={{alignSelf: 'flex-end'}}>Registrar</button>

                  {/* Repetir mensalmente — abaixo da linha principal, visível apenas para Despesas */}
                  {type === 'expense' && (
                    <div className="recurring-row">
                      <label className="checkbox-label">
                        <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} />
                        Repetir mensalmente
                      </label>
                    </div>
                  )}
                </form>

                <div className="cat-manager-toggle" onClick={() => setShowCatManager(!showCatManager)}>
                  <span>{showCatManager ? '▾' : '▸'} Gerenciar minhas categorias personalizadas</span>
                </div>

                {showCatManager && (
                  <div className="cat-manager-content">
                    <div className="cat-list-wrapper">
                      <div>
                        <h4>Despesas</h4>
                        <div className="cat-chips">
                          {customCategories.expense.length === 0 && <span className="no-cats">Nenhuma personalizada</span>}
                          {customCategories.expense.map(cat => (
                            <span key={cat} className="cat-chip">
                              {cat} <button onClick={() => handleRemoveCustomCategory(cat, 'expense')}>×</button>
                            </span>
                          ))}
                        </div>
                      </div>
                      <div style={{marginTop: 15}}>
                        <h4>Receitas</h4>
                        <div className="cat-chips">
                          {customCategories.income.length === 0 && <span className="no-cats">Nenhuma personalizada</span>}
                          {customCategories.income.map(cat => (
                            <span key={cat} className="cat-chip">
                              {cat} <button onClick={() => handleRemoveCustomCategory(cat, 'income')}>×</button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="cat-add-form">
                      <input 
                        type="text" 
                        placeholder="Nome da categoria..." 
                        value={newCatName} 
                        onChange={e => setNewCatName(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleAddCustomCategory()}
                      />
                      <select value={newCatType} onChange={e => setNewCatType(e.target.value)}>
                        <option value="expense">Despesa</option>
                        <option value="income">Receita</option>
                      </select>
                      <button onClick={handleAddCustomCategory} disabled={catSaving || !newCatName.trim()}>
                        {catSaving ? '...' : '+'}
                      </button>
                    </div>
                  </div>
                )}
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

            {/* CHATBOT AI PANEL OVERLAY */}
            <aside className="chatbot-panel">
               <div className="chat-header">
                  <div className="bot-avatar">⚡</div>
                  <div className="bot-info">
                     <span className="bot-name">Assistente Financeiro</span>
                     <span className="bot-status">Online</span>
                  </div>
               </div>
               
               <div className="chat-messages">
                  {chatMessages.map(msg => (
                     <div key={msg.id} style={{display: 'flex', flexDirection: 'column'}}>
                        <div className={`chat-bubble ${msg.sender}`}>
                           {msg.text}
                        </div>
                        
                        {/* Render Confirmation Card if payload exists on this bot msg and it is the pending action match */}
                        {msg.sender === 'bot' && pendingAction && chatMessages[chatMessages.length - 1].id === msg.id && msg.text.includes('Deseja registrar') && (
                           <div className="chat-action-card">
                              <div className="action-title">Resumo Extraído</div>
                              <div className="action-detail">
                                 <span>Tipo:</span> <span className="action-val" style={{color: pendingAction.type === 'expense' ? 'var(--danger-color)' : 'var(--success-color)'}}>{pendingAction.type === 'income' ? 'Receita' : 'Despesa'}</span>
                              </div>
                              <div className="action-detail">
                                 <span>Valor:</span> <span className="action-val">R$ {formatMoney(pendingAction.amount)}</span>
                              </div>
                              <div className="action-detail">
                                 <span>Info:</span> <span className="action-val">{pendingAction.description}</span>
                              </div>
                              <div className="action-detail">
                                 <span>Categoria:</span> <span className="action-val">{pendingAction.category}</span>
                              </div>
                              <div className="action-buttons">
                                 <button className="btn-confirm" onClick={handleChatConfirm}>Confirmar</button>
                                 <button className="btn-cancel" onClick={handleChatCancel}>Cancelar</button>
                              </div>
                           </div>
                        )}
                     </div>
                  ))}
               </div>

               <div className="chat-input-area">
                  <div className="chat-suggestions">
                     <div className="suggestion-chip" onClick={() => chatSuggestionClick('50 ifood')}>🍟 50 ifood</div>
                     <div className="suggestion-chip" onClick={() => chatSuggestionClick('90 uber')}>🚗 90 uber</div>
                     <div className="suggestion-chip" onClick={() => chatSuggestionClick('Qual meu saldo?')}>📊 Qual meu saldo?</div>
                  </div>
                  <form onSubmit={handleChatSubmit} className="chat-form">
                     <input 
                       type="text" 
                       className="chat-input" 
                       placeholder={pendingAction ? "Digite Sim ou Não..." : "Ex: 120 da academia"}
                       value={chatInput}
                       onChange={e => setChatInput(e.target.value)}
                     />
                     <button type="submit" className="chat-send-btn" disabled={!chatInput.trim()}>
                        ↑
                     </button>
                  </form>
               </div>
            </aside>
          </div>
        )}

        {currentView === 'analytics' && (
           <main className="main-content">

             {/* ROW 1: Area chart — evolução do saldo */}
             <div className="card grid-card" style={{height: 320, marginBottom: 10}}>
               <div className="card-title">Evolução do Saldo Líquido — últimos 6 meses</div>
               <ResponsiveContainer width="100%" height="88%">
                 <AreaChart data={monthlyEvolutionData} margin={{top: 24, right: 16, left: 0, bottom: 0}}>
                   <defs>
                     <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#D85A30" stopOpacity={0.35}/>
                       <stop offset="95%" stopColor="#D85A30" stopOpacity={0}/>
                     </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" stroke="rgba(253,232,224,0.06)" vertical={false} />
                   <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={10} tickLine={false} axisLine={false} />
                   <YAxis stroke="var(--text-tertiary)" fontSize={10} tickFormatter={v => `R$${(v/1000).toFixed(1)}k`} tickLine={false} axisLine={false} width={52}/>
                   <RechartsTooltip
                     contentStyle={{backgroundColor:'#1a0c0c', border:'1px solid #3a1e1e', borderRadius:8, fontSize:11}}
                     itemStyle={{color:'var(--text-primary)'}} labelStyle={{color:'var(--text-secondary)'}}
                     formatter={v => `R$ ${formatMoney(v)}`}
                   />
                   <Legend iconType="circle" wrapperStyle={{fontSize:10, paddingTop:4}} />
                   <Area
                     type="monotone" dataKey="Saldo" stroke="#D85A30" strokeWidth={2.5}
                     fill="url(#gradSaldo)" dot={{fill:'#D85A30', r:3}} activeDot={{r:6}}
                     label={({x, y, value}) => value !== 0 ? (
                       <text x={x} y={y - 8} fill="#D85A30" fontSize={9} textAnchor="middle">
                         {`R$${(value/1000).toFixed(1)}k`}
                       </text>
                     ) : null}
                   />
                   <Area type="monotone" dataKey="Receitas" stroke="#1FBE8E" strokeWidth={1.5} fill="none" dot={{fill:'#1FBE8E', r:2}} strokeDasharray="6 3"
                     label={({x, y, value}) => value !== 0 ? (
                       <text x={x} y={y - 7} fill="#1FBE8E" fontSize={8} textAnchor="middle" opacity={0.8}>
                         {`R$${(value/1000).toFixed(1)}k`}
                       </text>
                     ) : null}
                   />
                   <Area type="monotone" dataKey="Despesas" stroke="#E84B4B" strokeWidth={1.5} fill="none" dot={{fill:'#E84B4B', r:2}} strokeDasharray="6 3"
                     label={({x, y, value}) => value !== 0 ? (
                       <text x={x} y={y - 7} fill="#E84B4B" fontSize={8} textAnchor="middle" opacity={0.8}>
                         {`R$${(value/1000).toFixed(1)}k`}
                       </text>
                     ) : null}
                   />
                 </AreaChart>
               </ResponsiveContainer>
             </div>

             {/* ROW 2: BarChart receitas x despesas  +  Donut de categorias */}
             <div className="analytics-two-col" style={{marginBottom:10}}>

               {/* BarChart */}
               <div className="card grid-card" style={{height:300}}>
                 <div className="card-title">Receitas vs Despesas por Mês</div>
                 <ResponsiveContainer width="100%" height="88%">
                   <BarChart data={monthlyEvolutionData} barCategoryGap="30%" margin={{top:20,right:16,left:0,bottom:0}}>
                     <CartesianGrid strokeDasharray="3 3" stroke="rgba(253,232,224,0.06)" vertical={false} />
                     <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={10} tickLine={false} axisLine={false} />
                     <YAxis stroke="var(--text-tertiary)" fontSize={10} tickFormatter={v => `R$${(v/1000).toFixed(1)}k`} tickLine={false} axisLine={false} width={52}/>
                     <RechartsTooltip
                       contentStyle={{backgroundColor:'#1a0c0c', border:'1px solid #3a1e1e', borderRadius:8, fontSize:11}}
                       itemStyle={{color:'var(--text-primary)'}} labelStyle={{color:'var(--text-secondary)'}}
                       formatter={v => `R$ ${formatMoney(v)}`}
                     />
                     <Legend iconType="circle" wrapperStyle={{fontSize:10}} />
                     <Bar dataKey="Receitas" fill="#1FBE8E" radius={[4,4,0,0]} maxBarSize={32}
                       label={{position:'top', fontSize:9, fill:'#1FBE8E', formatter: v => v > 0 ? `R$${(v/1000).toFixed(1)}k` : ''}}
                     />
                     <Bar dataKey="Despesas" fill="#E84B4B" radius={[4,4,0,0]} maxBarSize={32}
                       label={{position:'top', fontSize:9, fill:'#E84B4B', formatter: v => v > 0 ? `R$${(v/1000).toFixed(1)}k` : ''}}
                     />
                   </BarChart>
                 </ResponsiveContainer>
               </div>

               {/* Donut */}
               <div className="card grid-card" style={{height:280}}>
                 <div className="card-title">Composição de Gastos ({selectedMonth}/{selectedYear})</div>
                 {categoryStats.length > 0 ? (
                   <ResponsiveContainer width="100%" height="88%">
                     <PieChart>
                       <Pie
                         data={categoryStats}
                         innerRadius={58} outerRadius={82}
                         paddingAngle={4}
                         dataKey="total"
                         label={({name, percent}) => `${name} ${(percent*100).toFixed(0)}%`}
                         labelLine={{stroke:'rgba(253,232,224,0.3)', strokeWidth:1}}
                       >
                         {categoryStats.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0)" />
                         ))}
                       </Pie>
                       <RechartsTooltip
                         formatter={v => `R$ ${formatMoney(v)}`}
                         contentStyle={{backgroundColor:'#1a0c0c', border:'1px solid #3a1e1e', borderRadius:8, fontSize:11}}
                         itemStyle={{color:'var(--text-primary)'}} labelStyle={{color:'var(--text-secondary)'}}
                       />
                     </PieChart>
                   </ResponsiveContainer>
                 ) : (
                   <div style={{fontSize:11, color:'var(--text-tertiary)', marginTop:'2rem', textAlign:'center'}}>Sem despesas no período.</div>
                 )}
               </div>
             </div>

             {/* ROW 3: Horizontal BarChart de categorias */}
             {categoryStats.length > 0 && (
               <div className="card grid-card" style={{height: Math.max(180, categoryStats.length * 46 + 60)}}>
                 <div className="card-title">Gasto por Categoria — detalhe</div>
                 <ResponsiveContainer width="100%" height="88%">
                   <BarChart
                     data={categoryStats}
                     layout="vertical"
                     margin={{top:4, right:60, left:0, bottom:0}}
                   >
                     <CartesianGrid strokeDasharray="3 3" stroke="rgba(253,232,224,0.06)" horizontal={false} />
                     <XAxis type="number" stroke="var(--text-tertiary)" fontSize={10} tickFormatter={v => `R$${(v/1000).toFixed(1)}k`} tickLine={false} axisLine={false} />
                     <YAxis type="category" dataKey="name" stroke="var(--text-tertiary)" fontSize={10} tickLine={false} axisLine={false} width={80} />
                     <RechartsTooltip
                       formatter={v => `R$ ${formatMoney(v)}`}
                       contentStyle={{backgroundColor:'#1a0c0c', border:'1px solid #3a1e1e', borderRadius:8, fontSize:11}}
                       itemStyle={{color:'var(--text-primary)'}} labelStyle={{color:'var(--text-secondary)'}}
                     />
                     <Bar dataKey="total" radius={[0,4,4,0]} maxBarSize={20} label={{position:'right', fontSize:10, fill:'var(--text-secondary)', formatter: v => `R$ ${formatMoney(v)}`}}>
                       {categoryStats.map((entry, index) => (
                         <Cell key={`hbar-${index}`} fill={COLORS[index % COLORS.length]} />
                       ))}
                     </Bar>
                   </BarChart>
                 </ResponsiveContainer>
               </div>
             )}

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
                     const fillCol = info.isOver100 ? 'var(--danger-color)' : getCatFill(0, cat);
                     const trackCol = getCatTrack(cat);
                     
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
                             <div className="progress-bg" style={{backgroundColor: trackCol}}>
                               <div className="progress-fill" style={{width: `${info.pct}%`, backgroundColor: fillCol}}></div>
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

export default function AppWrapper() {
  return (
    <ErrorBoundary>
       <App />
    </ErrorBoundary>
  )
}
