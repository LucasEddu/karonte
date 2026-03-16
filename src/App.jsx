import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { getCachedInsight, saveInsightToCache } from './services/insightService';
import { getUserProjects, createProject, deleteProject } from './services/projectService';

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
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [activeBudgetCat, setActiveBudgetCat] = useState('');
  const [budgetInputValue, setBudgetInputValue] = useState('');

  // --------- STATE: UI NAVIGATION & FILTERS ---------
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // --------- STATE: CHATBOT UI ---------
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  // --------- STATE: DRAGGABLE CHAT FAB ---------
  const [fabPosition, setFabPosition] = useState(() => {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    try {
      const stored = localStorage.getItem('karonte_fab_pos');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') return parsed;
      }
    } catch {
      // ignore parse errors
    }
    const defaultX = window.innerWidth - 30 - 56; // right: 30px, width: 56px
    const defaultY = window.innerHeight - 30 - 56; // bottom: 30px, height: 56px
    return { x: defaultX, y: defaultY };
  });
  const [isDraggingFab, setIsDraggingFab] = useState(false);
  const fabOffsetRef = useRef({ x: 0, y: 0 });

  // --------- STATE: PROJECTS / TABS ---------
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null); // null = Geral
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');


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

  // Proactive alert for forecast when chat opens
  useEffect(() => {
    if (chatOpen && transactions.length > 0) {
      const forecast = calculateForecast();
      if (forecast.isHigh) {
        setTimeout(() => {
          const alertMsg = `Olá! Notei que seu ritmo de gastos este mês está **${forecast.variationPct.toFixed(0)}% acima** da sua média. Sua previsão de fechamento é de **R$ ${formatMoney(forecast.forecastAmount)}**. Quer ver onde pode economizar?`;
          setMessages(prev => {
             const last = prev[prev.length - 1];
             if (last && last.text.includes('ritmo de gastos')) return prev;
             return [...prev, { text: alertMsg, sender: 'bot' }];
          });
        }, 1000);
      }
    }
  }, [chatOpen, transactions]);

  // Detect month change for Automatic Insight
  useEffect(() => {
    if (currentUser && transactions.length > 0 && !dataLoading) {
      const checkInsight = async () => {
        const today = new Date();
        const currentM = today.getMonth() + 1;
        const currentY = today.getFullYear();
        const lastCheck = localStorage.getItem(`karonte_last_insight_${currentUser.uid}`);
        
        // Se não houver registro ou se o mês/ano mudou
        if (!lastCheck || lastCheck !== `${currentM}_${currentY}`) {
          // Precisamos do insight do mês ANTERIOR
          const prevDate = new Date();
          prevDate.setMonth(today.getMonth() - 1);
          const pM = prevDate.getMonth() + 1;
          const pY = prevDate.getFullYear();
          
          const insight = await generateAIInsight(pM, pY);
          if (insight) {
            setMessages(prev => [...prev, { text: insight, sender: 'bot' }]);
            setChatOpen(true);
            setUnreadCount(prev => prev + 1);
            localStorage.setItem(`karonte_last_insight_${currentUser.uid}`, `${currentM}_${currentY}`);
          }
        }
      };
      checkInsight();
    }
  }, [currentUser, transactions.length, dataLoading]);

  // Fetch user projects
  useEffect(() => {
    if (currentUser) {
      getUserProjects(currentUser.uid).then(setProjects).catch(console.error);
    }
  }, [currentUser]);

  // Fetch user data when currentUser or activeProjectId changes
  useEffect(() => {
    const fetchData = async () => {
       if (!currentUser) return;
       setDataLoading(true);
       try {
         const txs = await getUserTransactions(currentUser.uid, activeProjectId);
         setTransactions(txs);
         
         const userBudgets = await getUserBudgets(currentUser.uid, activeProjectId);
         setBudgets(userBudgets);

         // Load custom categories (categories are global, not per project)
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
  }, [currentUser, activeProjectId]);

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
      const savedDoc = await addTransaction(newTransaction, activeProjectId);
      setTransactions([savedDoc, ...transactions]);
      setDescription(''); setAmount(''); setCategory(''); setIsRecurring(false);
    } catch(err) { alert('Erro ao salvar transação.'); }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const proj = await createProject(newProjectName.trim());
      setProjects(prev => [...prev, proj]);
      setShowProjectModal(false);
      setNewProjectName('');
      setActiveProjectId(proj.id);
    } catch (err) { alert('Erro ao criar projeto.'); }
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

  const calculateForecast = () => {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    
    // Gasto atual do mês
    const currentMonthSpent = transactions
      .filter(t => t.type === 'expense' && new Date(t.date).getMonth() + 1 === currentMonth && new Date(t.date).getFullYear() === currentYear)
      .reduce((acc, curr) => acc + curr.amount, 0);

    // Média dos últimos 3 meses fechados
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(today.getMonth() - 3);
    
    const pastTransactions = transactions.filter(t => {
      const d = new Date(t.date);
      // Pega meses anteriores ao atual, nos últimos 3 meses
      return t.type === 'expense' && d < new Date(currentYear, currentMonth - 1, 1) && d >= threeMonthsAgo;
    });

    const totalPastDays = 90; // Simplificado para 3 meses
    const totalPastSpent = pastTransactions.reduce((acc, curr) => acc + curr.amount, 0);
    const dailyAverage = totalPastSpent / totalPastDays;
    const monthlyAverage = dailyAverage * 30;

    // Projeção
    const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate();
    const currentDay = today.getDate();
    const daysRemaining = lastDayOfMonth - currentDay;
    
    const forecastAmount = currentMonthSpent + (dailyAverage * daysRemaining);
    const variationPct = monthlyAverage > 0 ? ((forecastAmount - monthlyAverage) / monthlyAverage) * 100 : 0;

    return {
      currentMonthSpent,
      monthlyAverage,
      forecastAmount,
      variationPct,
      isHigh: variationPct > 15
    };
  };

  const handleBudgetChange = (catName) => {
    const currentLimit = budgets[catName] || 0;
    setActiveBudgetCat(catName);
    setBudgetInputValue(currentLimit > 0 ? currentLimit.toString() : '');
    setBudgetModalOpen(true);
  };

  const handleConfirmBudget = async () => {
    const num = parseFloat(budgetInputValue.replace(',', '.'));
    if (isNaN(num) && budgetInputValue !== '') {
       alert('Por favor, insira um número válido.');
       return;
    }
    
    const finalVal = isNaN(num) ? 0 : num;
    const newBudgets = { ...budgets };
    
    if (finalVal === 0) delete newBudgets[activeBudgetCat];
    else newBudgets[activeBudgetCat] = finalVal;

    try {
       await saveUserBudgets(newBudgets, activeProjectId);
       setBudgets(newBudgets);
       setBudgetModalOpen(false);
    } catch(err) { alert('Erro ao salvar orçamento.')}
  };

  // --------- AI MONTHLY INSIGHTS LOGIC ---------
  
  const buildMonthlyInsightContext = (month, year) => {
    const monthTransactions = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    });

    const income = monthTransactions.filter(t => t.type === 'income').reduce((acc, crr) => acc + crr.amount, 0);
    const expense = monthTransactions.filter(t => t.type === 'expense').reduce((acc, crr) => acc + crr.amount, 0);
    
    // Group by category to find top expense
    const catAnalysis = {};
    monthTransactions.filter(t => t.type === 'expense').forEach(t => {
       catAnalysis[t.category] = (catAnalysis[t.category] || 0) + t.amount;
    });
    
    const sortedCats = Object.entries(catAnalysis).sort((a, b) => b[1] - a[1]);
    const topCategory = sortedCats.length > 0 ? sortedCats[0][0] : 'Nenhuma';

    return { month, year, income, expense, balance: income - expense, topCategory };
  };

  const generateAIInsight = async (month, year) => {
    if (!currentUser) return null;
    
    // 1. Check Cache
    const cached = await getCachedInsight(currentUser.uid, month, year);
    if (cached) return cached;

    // 2. Build Context
    const ctx = buildMonthlyInsightContext(month, year);
    
    // Fallback if no data
    if (ctx.income === 0 && ctx.expense === 0) {
      return `Ainda não tenho dados suficientes para o mês de ${month}/${year}. Assim que você registrar suas primeiras movimentações, poderei gerar um resumo inteligente para você! 📊`;
    }

    // 3. Simulate IA response (Karonte Voice)
    // Here we could call a real LLM API, but we'll use a template that mimics the requested tone
    const insight = `Seu resumo de ${month}/${year} chegou! ✨

💰 Você teve R$ ${formatMoney(ctx.income)} em entradas e R$ ${formatMoney(ctx.expense)} em saídas, fechando o mês com um saldo de R$ ${formatMoney(ctx.balance)}. 

🔍 Notei que seu maior foco de gastos foi em **${ctx.topCategory}**. Se esse valor estiver dentro do planejado, ótimo! Caso contrário, que tal colocar um limite nessa categoria para o próximo mês?

🚀 Continue assim! Manter a constância é o segredo para sua liberdade financeira. No que mais posso te ajudar hoje?`;

    // 4. Save to Cache
    await saveInsightToCache(currentUser.uid, month, year, insight);
    
    return insight;
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
  const [pendingActions, setPendingActions] = useState([]); // Array para suportar múltiplos lançamentos

  // --------- EFFECTS: DRAGGABLE CHAT FAB ---------
  useEffect(() => {
    if (!isDraggingFab) return;

    const handleMove = (e) => {
      if (typeof window === 'undefined') return;
      const clientX = e.clientX;
      const clientY = e.clientY;
      if (typeof clientX !== 'number' || typeof clientY !== 'number') return;

      const rawX = clientX - fabOffsetRef.current.x;
      const rawY = clientY - fabOffsetRef.current.y;

      const maxX = window.innerWidth - 56; // 56 = botão
      const maxY = window.innerHeight - 56;

      const clamped = {
        x: Math.min(Math.max(10, rawX), maxX - 10),
        y: Math.min(Math.max(10, rawY), maxY - 10),
      };

      setFabPosition(clamped);
      try {
        localStorage.setItem('karonte_fab_pos', JSON.stringify(clamped));
      } catch {
        // ignore storage errors
      }
    };

    const handleUp = () => {
      setIsDraggingFab(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDraggingFab]);

  const processChatMessage = (text) => {
    // 1. Normalização profunda
    const normalized = text.toLowerCase().trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove acentos
    
    // 2. Intents de Consulta (Respostas diretas)
    if (/(saldo|dinheiro|quanto tenho)/.test(normalized)) {
       return { type: 'answer', text: `Seu saldo atual neste período é de R$ ${formatMoney(balance)}.` };
    }
    if (/(gasto|despesa|saida|quanto gastei)/.test(normalized)) {
       return { type: 'answer', text: `Você gastou R$ ${formatMoney(totalExpense)} em despesas este mês.` };
    }
    if (/(receita|entrada|ganhei|recebi)/.test(normalized) && !/\d/.test(normalized)) {
       return { type: 'answer', text: `Você recebeu R$ ${formatMoney(totalIncome)} em receitas este mês.` };
    }
    if (/(maior gasto|mais caro|gastei mais)/.test(normalized)) {
       if(categoryStats.length === 0) return { type: 'answer', text: 'Você ainda não tem despesas registradas este mês.' };
       const top = categoryStats[0];
       return { type: 'answer', text: `Seu maior gasto este mês é com ${top.name}, totalizando R$ ${formatMoney(top.total)}.` };
    }
    // Intent: ASK_FORECAST
    if (/(quanto vou gastar|previsao|projeção|predição)/.test(normalized)) {
      const forecast = calculateForecast();
      let response = `Analisei seu histórico e aqui está a projeção para este mês: \n\n`;
      response += `📌 Gasto até agora: R$ ${formatMoney(forecast.currentMonthSpent)}\n`;
      response += `🔮 Previsão final: R$ ${formatMoney(forecast.forecastAmount)}\n`;
      
      if (forecast.isHigh) {
        response += `⚠️ Atenção: Sua projeção está **${forecast.variationPct.toFixed(0)}% acima** da sua média histórica (R$ ${formatMoney(forecast.monthlyAverage)}). Sugiro revisar seus gastos variáveis.`;
      } else {
        response += `✅ Tudo sob controle! Sua projeção está dentro da sua média histórica.`;
      }
      return { type: 'answer', text: response };
    }
    if (/(resumo|balanco|geral|estatistica|como estou)/.test(normalized)) {
       const percent = totalIncome > 0 ? ((balance / totalIncome) * 100).toFixed(0) : '0';
       return { type: 'answer', text: `Resumo do mês: Receitas R$ ${formatMoney(totalIncome)}, Despesas R$ ${formatMoney(totalExpense)}. Seu saldo está em R$ ${formatMoney(balance)} (${percent}% do total).` };
    }
    if (/(ajuda|socorro|que voce faz|comandos)/.test(normalized)) {
       return { type: 'answer', text: 'Eu sou o Karonte! Posso registrar seus gastos (ex: "50 pizza e 20 uber", "ontem gastei 30 com café") ou responder sobre suas finanças (ex: "qual meu saldo?", "maior gasto do mês?").' };
    }
    if (/(categoria|quais categorias)/.test(normalized)) {
       return { type: 'answer', text: `Suas categorias de despesa são: ${expenseCategories.join(', ')}.` };
    }

    // 3. Extração de Valor Robustecida
    let numericValue = null;
    let moneyMatch = normalized.match(/(?:r\$)?\s?(\d+(?:[.,]\d{1,3})?)\s?(k|mil)?/);
    
    if (moneyMatch) {
      let valStr = moneyMatch[1].replace(',', '.');
      numericValue = parseFloat(valStr);
      if (moneyMatch[2] === 'k' || moneyMatch[2] === 'mil') numericValue *= 1000;
    }

    if (!numericValue || isNaN(numericValue)) {
       return { type: 'answer', text: 'Não consegui identificar o valor. Tente algo como "50 lanche" ou "1.5k salario".' };
    }

    // 4. Inteligência Temporal (Datas Naturais)
    let finalDate = new Date();
    if (normalized.includes('ontem')) {
      finalDate.setDate(finalDate.getDate() - 1);
    } else if (normalized.includes('anteontem')) {
      finalDate.setDate(finalDate.getDate() - 2);
    } else {
      const days = {
        'segunda': 1, 'terca': 2, 'quarta': 3, 'quinta': 4, 'sexta': 5, 'sabado': 6, 'domingo': 0
      };
      for (let [day, code] of Object.entries(days)) {
        if (normalized.includes(day)) {
          const currentDay = finalDate.getDay();
          const diff = (currentDay < code) ? (7 - (code - currentDay)) : (currentDay - code);
          finalDate.setDate(finalDate.getDate() - diff);
          break;
        }
      }
    }

    // 5. Extração de Descrição e Limpeza
    let rawDesc = normalized.replace(moneyMatch[0], '')
      .replace(/(ontem|anteontem|segunda|terca|quarta|quinta|sexta|sabado|domingo)/, '')
      .trim();
    const stopwords = /^(com|no|na|de|do|da|pelo|por|o|a|um|uma|em|pro|pra|para|no|nos|nas)\s+/;
    let cleanedDesc = rawDesc.replace(stopwords, '').trim();
    
    if (!cleanedDesc || cleanedDesc.length < 2) cleanedDesc = 'Registro via Assistente';

    // 6. Inferência de Tipo e Categoria
    const incomeKeywords = ['salario', 'freelance', 'receita', 'renda', 'bonus', 'pagamento', 'ganhei', 'venda', 'pix recebido', 'reembolso'];
    let inferType = incomeKeywords.some(kw => normalized.includes(kw)) ? 'income' : 'expense';

    if (inferType === 'expense') {
      const matchCustomIncome = customCategories.income.find(c => normalized.includes(c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
      if (matchCustomIncome) inferType = 'income';
    }

    let inferCategory = 'Outros';
    const categoryMaps = {
      'Lazer': /(academia|cinema|bar|lazer|balada|jogo|game|festa|viagem|netflix|streaming|spotify|show|teatro|shopping|passeio)/,
      'Alimentação': /(mercado|supermercado|restaurante|pizza|ifood|lanche|comida|padaria|acougue|feira|cafe|almoço|jantar|doce)/,
      'Moradia': /(aluguel|reforma|condominio|luz|agua|conta|energia|internet|gas|iptu|moveis|casa|apartamento)/,
      'Saúde': /(farmacia|medico|consulta|remedio|hospital|dentista|exame|saude|psicologo|terapia|plano)/,
      'Transporte': /(transporte|uber|99|gasolina|combustivel|onibus|metro|trem|oficina|pedagio|estacionamento|carro|moto)/,
    };

    if (inferType === 'expense') {
       const matchCustom = customCategories.expense.find(c => normalized.includes(c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
       if (matchCustom) inferCategory = matchCustom;
       else {
         for (const [catName, regex] of Object.entries(categoryMaps)) {
           if (regex.test(normalized)) { inferCategory = catName; break; }
         }
       }
    } else {
       const matchCustom = customCategories.income.find(c => normalized.includes(c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
       if (matchCustom) inferCategory = matchCustom;
       else if (/(salario|pagamento|pro-labore)/.test(normalized)) inferCategory = 'Salário';
       else if (/(freelance|projeto|job|freela)/.test(normalized)) inferCategory = 'Freelance';
       else if (/(investimento|dividendos|juros|rendimento)/.test(normalized)) inferCategory = 'Investimentos';
    }

    // 7. Alertas de Orçamento Proativos
    let budgetWarning = '';
    if (inferType === 'expense') {
       const currentSpent = categoryStats.find(s => s.name === inferCategory)?.total || 0;
       const info = getCategoryBudgetInfo(inferCategory, currentSpent + numericValue);
       if (info.isOver100) {
          budgetWarning = `\n\n⚠️ Atenção: este gasto fará você ultrapassar o limite de R$ ${formatMoney(info.limit)} para ${inferCategory}.`;
       } else if (info.isOver80) {
          budgetWarning = `\n\n💡 Nota: você está chegando perto do limite de ${inferCategory} (${info.pct.toFixed(0)}%).`;
       }
    }

    cleanedDesc = cleanedDesc.charAt(0).toUpperCase() + cleanedDesc.slice(1);

    return {
       type: 'action',
       text: `Entendi! Deseja registrar a seguinte movimentação?${budgetWarning}`,
       payload: {
          description: cleanedDesc,
          amount: numericValue,
          type: inferType,
          category: inferCategory,
          date: finalDate.toISOString()
       }
    };
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    const input = chatInput.trim();
    if (!input) return;

    const normalizedInput = input.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // 1. Handle Simple Confirm/Cancel for the CURRENT pending action
    if (pendingActions.length > 0) {
       if (normalizedInput === 'sim' || normalizedInput === 's') { handleChatConfirm(); return; }
       if (normalizedInput === 'nao' || normalizedInput === 'n') { handleChatCancel(); return; }
       
       // 2. Handle Potential Correction if not Sim/Nao
       // Improved: try to extract just values/categories first to be less destructive
       const moneyMatch = normalizedInput.match(/(?:r\$)?\s?(\d+(?:[.,]\d{1,3})?)\s?(k|mil)?/);
       if (moneyMatch) {
          let valStr = moneyMatch[1].replace(',', '.');
          let newVal = parseFloat(valStr);
          if (moneyMatch[2] === 'k' || moneyMatch[2] === 'mil') newVal *= 1000;
          
          if (!isNaN(newVal)) {
            const updated = [...pendingActions];
            updated[0] = { ...updated[0], amount: newVal };
            setPendingActions(updated);
            setChatMessages(prev => [
              ...prev, 
              { id: crypto.randomUUID(), sender: 'user', text: input },
              { id: crypto.randomUUID(), sender: 'bot', text: `Entendi! Alterei o valor para R$ ${formatMoney(newVal)}. Deseja confirmar agora?` }
            ]);
            setChatInput('');
            return;
          }
       }

       const correction = processChatMessage(input);
       if (correction.type === 'action') {
          const updated = [...pendingActions];
          updated[0] = { ...updated[0], ...correction.payload };
          setPendingActions(updated);
          
          setChatMessages(prev => [
            ...prev, 
            { id: crypto.randomUUID(), sender: 'user', text: input },
            { id: crypto.randomUUID(), sender: 'bot', text: 'Entendi a correção! Atualizei o resumo abaixo. Deseja confirmar agora?' }
          ]);
          setChatInput('');
          return;
       }
    }

    const userMsg = { id: crypto.randomUUID(), sender: 'user', text: input };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');

    // 3. Process Multiple Intentions (Split by " e " or ",")
    const parts = input.split(/\s+e\s+|,\s+/);
    
    // Check for Monthly Insight Intent first (as it might be async)
    // NORMALIZED regex check
    if (/(resumo de|como foi|resumo do mes)/.test(normalizedInput)) {
        const monthsMap = {
          'janeiro': 1, 'fevereiro': 2, 'marco': 3, 'abril': 4, 'maio': 5, 'junho': 6,
          'julho': 7, 'agosto': 8, 'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12
        };
        let tM = selectedMonth;
        let tY = selectedYear;

        Object.keys(monthsMap).forEach(mName => {
          if (normalizedInput.includes(mName)) tM = monthsMap[mName];
        });

        if (normalizedInput.includes('mes passado')) {
          const d = new Date();
          d.setMonth(d.getMonth() - 1);
          tM = d.getMonth() + 1;
          tY = d.getFullYear();
        }

        const insight = await generateAIInsight(tM, tY);
        setChatMessages(prev => [...prev, { id: crypto.randomUUID(), sender: 'bot', text: insight }]);
        if (!chatOpen) setUnreadCount(prev => prev + 1);
        return;
    }

    const results = parts.map(p => processChatMessage(p));
    
    setTimeout(() => {
       const answers = results.filter(r => r.type === 'answer');
       const actions = results.filter(r => r.type === 'action').map(r => r.payload);

       // Show answers if present
       if (answers.length > 0) {
          answers.forEach(a => {
            setChatMessages(prev => [...prev, { id: crypto.randomUUID(), sender: 'bot', text: a.text }]);
          });
       }

       // Queue actions
       if (actions.length > 0) {
          setPendingActions(prev => [...prev, ...actions]);
          if (answers.length === 0) {
             const welcomeMsg = actions.length > 1 
                ? `Encontrei ${actions.length} registros! Vamos confirmar um por um?`
                : results.find(r => r.type === 'action').text;
             setChatMessages(prev => [...prev, { id: crypto.randomUUID(), sender: 'bot', text: welcomeMsg }]);
          }
       } else if (answers.length === 0) {
          // Fallback if nothing was identified
          setChatMessages(prev => [...prev, { id: crypto.randomUUID(), sender: 'bot', text: 'Não entendi seu pedido. Tente "50 pizza" ou "qual meu saldo?".' }]);
       }

       if (!chatOpen) setUnreadCount(prev => prev + 1);
    }, 600);
  };

  const handleVoiceToggle = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Seu navegador não suporta reconhecimento de voz.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsRecording(true);
      setChatInput('');
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0])
        .map(result => result.transcript)
        .join('');
      setChatInput(transcript);
    };

    recognition.onend = () => {
      setIsRecording(false);
      // Se tiver algo no input, envia automaticamente
      if (chatInput.trim()) {
        const dummyEvent = { preventDefault: () => {} };
        handleChatSubmit(dummyEvent);
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech Recognition Error", event.error);
      setIsRecording(false);
      if (event.error === 'not-allowed') alert("Permissão de microfone negada.");
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  useEffect(() => {
    if (chatOpen) setUnreadCount(0);
  }, [chatOpen]);

  const handleChatConfirm = async () => {
     if (pendingActions.length === 0) return;
     const action = pendingActions[0];
     
     // Use the extracted date if available, otherwise fallback to smart period date
     let dateObj;
     if (action.date) {
       dateObj = new Date(action.date);
     } else {
       const now = new Date();
       const isCurrentPeriod = (selectedMonth === now.getMonth() + 1) && (selectedYear === now.getFullYear());
       dateObj = isCurrentPeriod ? now : new Date(selectedYear, selectedMonth - 1, 1, 12, 0, 0); 
     }

     const newTransaction = {
      description: action.description,
      amount: action.amount,
      type: action.type,
      category: action.category,
      isRecurring: false,
      date: dateObj.toISOString(), 
      displayDate: dateObj.toLocaleDateString('pt-BR')
    };
    
    try {
      const savedDoc = await addTransaction(newTransaction);
      setTransactions([savedDoc, ...transactions]);
      
      const updatedActions = pendingActions.slice(1);
      setPendingActions(updatedActions);
      setChatInput('');

      setChatMessages(prev => [
         ...prev, 
         { id: crypto.randomUUID(), sender: 'user', text: 'Sim' }, // Visual feedback
         { id: crypto.randomUUID(), sender: 'bot', text: updatedActions.length > 0 
           ? `Registrado! Vamos para o próximo: ${updatedActions[0].description}?` 
           : `Feito! Registrei ${action.type === 'income' ? 'a receita' : 'a despesa'} com sucesso.` }
      ]);
    } catch(err) { alert('Erro ao registrar via chat') }
  };

  const handleChatCancel = () => {
    if (pendingActions.length === 0) return;
    const action = pendingActions[0];
    const updatedActions = pendingActions.slice(1);
    setPendingActions(updatedActions);
    setChatInput('');
    setChatMessages(prev => [
       ...prev, 
       { id: crypto.randomUUID(), sender: 'user', text: 'Não' }, 
       { id: crypto.randomUUID(), sender: 'bot', text: updatedActions.length > 0 
         ? `Beleza, pulei esse. E quanto a: ${updatedActions[0].description}?` 
         : 'Tudo bem, registro cancelado.' }
    ]);
  };

  const chatSuggestionClick = (txt) => {
     if(pendingActions.length > 0) return;
     setChatInput(txt);
  };

  const handleFabMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFab(true);

    const rect = e.currentTarget.getBoundingClientRect();
    fabOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const chatWindowStyle = useMemo(() => {
    if (typeof window === 'undefined') return {};

    const width = 350;
    const height = 520;

    const fabCenterX = fabPosition.x + 28;
    const fabCenterY = fabPosition.y + 28;

    let x = fabCenterX - width / 2;
    let y = fabCenterY - height - 16;

    const maxX = window.innerWidth - width - 10;
    const maxY = window.innerHeight - height - 10;

    if (x < 10) x = 10;
    if (x > maxX) x = maxX;
    if (y < 10) y = 10;
    if (y > maxY) y = maxY;

    return {
      left: `${x}px`,
      top: `${y}px`,
      transformOrigin: 'center bottom'
    };
  }, [fabPosition]);



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
          {authError ? <div className="auth-error">{authError}</div> : null}
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
                 {(authConfirmPassword && authPassword !== authConfirmPassword) ? (
                   <span style={{fontSize: 10, color: 'var(--danger-color)', marginTop: 2}}>As senhas não coincidem</span>
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
        {adminOwnPassVisible ? (
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
              {adminOwnPassMsg ? (
                <span className={`admin-msg ${adminOwnPassMsg.includes('sucesso') ? 'admin-msg--ok' : 'admin-msg--err'}`}>
                  {adminOwnPassMsg}
                </span>
              ) : null}
            </form>
          </div>
        ) : null}

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
            {filteredTransactions.length > 0 ? (
               <button onClick={exportToCSV} className="export-btn" title="Exportar CSV">Descarga</button>
            ) : null}
            <div className="divider"></div>
            <button onClick={toggleTheme} className="text-btn" style={{marginRight: 10, fontSize: '14px', alignSelf: 'center'}} title="Mudar Tema">
               {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button onClick={handleLogout} className="logout-btn">Sair</button>
          </div>
        </header>

        {/* PROJECT TABS */}
        <div className="project-tabs">
           <button 
             onClick={() => setActiveProjectId(null)}
             style={{ 
               padding: '6px 14px', borderRadius: '20px', border: 'none', 
               background: activeProjectId === null ? 'var(--primary-color)' : 'transparent', 
               color: activeProjectId === null ? '#fff' : 'var(--text-secondary)', 
               cursor: 'pointer', fontWeight: activeProjectId === null ? '600' : 'normal',
               whiteSpace: 'nowrap', transition: 'all 0.2s'
             }}
           >
             Geral
           </button>
           {projects.map(p => (
             <button 
               key={p.id}
               onClick={() => setActiveProjectId(p.id)}
               style={{ 
                 padding: '6px 14px', borderRadius: '20px', border: 'none', 
                 background: activeProjectId === p.id ? 'var(--primary-color)' : 'transparent', 
                 color: activeProjectId === p.id ? '#fff' : 'var(--text-secondary)', 
                 cursor: 'pointer', fontWeight: activeProjectId === p.id ? '600' : 'normal',
                 whiteSpace: 'nowrap', transition: 'all 0.2s'
               }}
             >
               {p.name}
             </button>
           ))}
           <button 
             onClick={() => setShowProjectModal(true)} 
             style={{ 
               padding: '6px 14px', borderRadius: '20px', border: '1px dashed var(--border-color)', 
               background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', 
               whiteSpace: 'nowrap', transition: 'all 0.2s'
             }}
           >
             + Novo Projeto
           </button>
        </div>

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

              {/* FORECAST CARD */}
              <div className={`card grid-card forecast-card ${calculateForecast().isHigh ? 'alert' : ''}`}>
                <div className="balance-label">Previsão Mensal {calculateForecast().isHigh ? '⚠️' : '🔮'}</div>
                <div className="balance-value">R$ {formatMoney(calculateForecast().forecastAmount)}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div className="mini-cards-container" style={{ flex: 1 }}>
                    <div className="mini-card" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                      <span className="mini-label">Média Histórica</span>
                      <span className="mini-value" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>R$ {formatMoney(calculateForecast().monthlyAverage)}</span>
                    </div>
                  </div>
                  <div className={`forecast-badge ${calculateForecast().isHigh ? 'danger' : 'success'}`}>
                    {calculateForecast().variationPct > 0 ? '+' : ''}{calculateForecast().variationPct.toFixed(0)}%
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
                                {budgetInfo.isOver80 ? <span className="badge-alert">{visualPct.toFixed(0)}% Util</span> : null}
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
                      <span>Este mês você gastou </span><span style={{color:'var(--text-primary)'}}>R$ {formatMoney(totalExpense)}</span><span> e arrecadou </span><span style={{color:'var(--text-primary)'}}>R$ {formatMoney(totalIncome)}</span><span>.</span>
                      {balance < 0 ? <span style={{color: 'var(--danger-color)'}}><br/>Déficit Operacional detectado.</span> : null}
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
                  {type === 'expense' ? (
                    <div className="recurring-row">
                      <label className="checkbox-label">
                        <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} />
                        <span>Repetir mensalmente</span>
                      </label>
                    </div>
                  ) : null}
                </form>

                <div className="cat-manager-toggle" onClick={() => setShowCatManager(!showCatManager)}>
                  <span>{showCatManager ? '▾' : '▸'} Gerenciar minhas categorias personalizadas</span>
                </div>

                {showCatManager ? (
                  <div className="cat-manager-content">
                    <div className="cat-list-wrapper">
                      <div>
                        <h4>Despesas</h4>
                        <div className="cat-chips">
                          {customCategories.expense.length === 0 ? <span className="no-cats">Nenhuma personalizada</span> : null}
                          {customCategories.expense.map(cat => (
                            <span key={cat} className="cat-chip">
                              <span>{cat}</span> <button onClick={() => handleRemoveCustomCategory(cat, 'expense')}>×</button>
                            </span>
                          ))}
                        </div>
                      </div>
                      <div style={{marginTop: 15}}>
                        <h4>Receitas</h4>
                        <div className="cat-chips">
                          {customCategories.income.length === 0 ? <span className="no-cats">Nenhuma personalizada</span> : null}
                          {customCategories.income.map(cat => (
                            <span key={cat} className="cat-chip">
                              <span>{cat}</span> <button onClick={() => handleRemoveCustomCategory(cat, 'income')}>×</button>
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
                ) : null}
              </section>

              <section className="card list-section">
                <div className="list-header">
                  <h2>Registros Recentes</h2>
                  <span className="link-all" style={{color: 'var(--text-tertiary)'}}>{filteredTransactions.length} registros</span>
                </div>
                
                <div className="history-list">
                  {filteredTransactions.length === 0 ? (
                    <div style={{fontSize: 11, padding: '1rem', textAlign: 'center', color: 'var(--text-tertiary)'}}>
                      <span>Ainda não há registros lançados neste mês.</span>
                    </div>
                  ) : (
                    filteredTransactions.map(t => (
                      <div key={t.id} className="history-item">
                        <div className={`t-icon-box ${t.type}`}>
                          <div className={t.type === 'expense' ? 'arrow-down' : 'arrow-up'}></div>
                        </div>
                        <div className="t-details">
                          <span className="t-name">
                             <span>{t.description}</span>
                             {t.isRecurring ? <span title="Despesa Recorrente" style={{marginLeft: 4, color: 'var(--primary-color)'}}>⟳</span> : null}
                          </span>
                          <span className="t-meta"><span>{t.category}</span><span> • </span><span>{t.displayDate}</span></span>
                        </div>
                        <div className={`t-amount ${t.type}`}>
                          <span>{t.type === 'expense' ? '− ' : '+ '}</span><span>R$ {formatMoney(t.amount)}</span>
                        </div>
                        <button className="delete-btn-subtle" onClick={() => handleDelete(t.id)} title="Remover">×</button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </main>
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
             {categoryStats.length > 0 ? (
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
             ) : null}
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
                         {hasBudget ? (
                            <div style={{width: 100, marginRight: 15}}>
                              <div className="progress-bg" style={{backgroundColor: trackCol}}>
                                <div className="progress-fill" style={{width: `${info.pct}%`, backgroundColor: fillCol}}></div>
                              </div>
                            </div>
                         ) : null}
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

      {!chatOpen && (
        <button
          className={`chat-fab ${unreadCount > 0 ? 'has-unread' : ''}`}
          onClick={() => { if (!isDraggingFab) setChatOpen(true); }}
          onMouseDown={handleFabMouseDown}
          style={{ left: `${fabPosition.x}px`, top: `${fabPosition.y}px` }}
        >
          <img src="/karonte-favicon-light.svg" alt="Karonte" className="fab-icon-img" />
          {unreadCount > 0 ? <span className="fab-badge">{unreadCount}</span> : null}
        </button>
      )}

      <aside
        className={`chatbot-float-window ${chatOpen ? 'open' : ''}`}
        style={chatWindowStyle}
      >
          <div className="chat-header">
            <div style={{display:'flex', alignItems:'center', gap: 10}}>
              <div className="bot-avatar">
                <img src="/karonte-favicon-light.svg" alt="K" />
              </div>
              <div className="bot-info">
                  <span className="bot-name">Karonte</span>
                  <span className="bot-status">Online</span>
              </div>
            </div>
            <button className="chat-close-btn" onClick={() => setChatOpen(false)}>×</button>
          </div>
          
          <div className="chat-messages">
            {chatMessages.map(msg => (
                <div key={msg.id} style={{display: 'flex', flexDirection: 'column'}}>
                  <div className={`chat-bubble ${msg.sender}`}>
                      {msg.text}
                  </div>
                  
                  {/* Render Confirmation Card if payload exists on this bot msg and it is the pending action match */}
                    {(msg.sender === 'bot' && pendingActions.length > 0 && chatMessages[chatMessages.length - 1].id === msg.id && (msg.text.includes('Deseja registrar') || msg.text.includes('Vamos para o próximo') || msg.text.includes('Entendi a correção'))) ? (
                      <div className="chat-action-card">
                        <div className="action-title">Resumo Extraído</div>
                        <div className="action-detail">
                            <span>Tipo:</span> <span className="action-val" style={{color: pendingActions[0].type === 'expense' ? 'var(--danger-color)' : 'var(--success-color)'}}>{pendingActions[0].type === 'income' ? 'Receita' : 'Despesa'}</span>
                        </div>
                        <div className="action-detail">
                            <span>Valor:</span> <span className="action-val">R$ {formatMoney(pendingActions[0].amount)}</span>
                        </div>
                        <div className="action-detail">
                            <span>Info:</span> <span className="action-val">{pendingActions[0].description}</span>
                        </div>
                        <div className="action-detail">
                            <span>Categoria:</span> <span className="action-val">{pendingActions[0].category}</span>
                        </div>
                        <div className="action-buttons">
                            <button className="btn-confirm" onClick={handleChatConfirm}>Confirmar</button>
                            <button className="btn-cancel" onClick={handleChatCancel}>Cancelar</button>
                        </div>
                      </div>
                  ) : null}
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
                  placeholder={pendingActions.length > 0 ? "Sim ou Não..." : "Ex: 120 da academia"}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                />
                <button 
                   type="button" 
                   className={`chat-voice-btn ${isRecording ? 'recording' : ''}`}
                   onClick={handleVoiceToggle}
                   title="Comando de Voz"
                >
                  🎙️
                </button>
                <button type="submit" className="chat-send-btn" disabled={!chatInput.trim()}>
                  ↑
                </button>
            </form>
          </div>
      </aside>

      {/* BUDGET MODAL */}
      {budgetModalOpen && (
        <div className="modal-overlay" onClick={() => setBudgetModalOpen(false)}>
           <div className="budget-modal-card" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                 <h3>Limite para {activeBudgetCat}</h3>
                 <button className="chat-close-btn" onClick={() => setBudgetModalOpen(false)}>×</button>
              </div>
              <div className="modal-body">
                 <p className="modal-subtitle">Defina o teto de gastos mensal para esta categoria.</p>
                 <div className="budget-input-wrapper">
                    <span className="currency-prefix">R$</span>
                    <input 
                      type="number" 
                      step="0.01" 
                      placeholder="0,00" 
                      className="budget-main-input"
                      value={budgetInputValue}
                      onChange={e => setBudgetInputValue(e.target.value)}
                      autoFocus
                    />
                 </div>
                 <p className="modal-hint">Digite 0 para remover o limite.</p>
              </div>
              <div className="modal-footer">
                 <button className="btn-secondary" onClick={() => setBudgetModalOpen(false)}>Cancelar</button>
                 <button className="btn-confirm" onClick={handleConfirmBudget}>Salvar Limite</button>
              </div>
           </div>
        </div>
      )}
      {/* NEW PROJECT MODAL */}
      {showProjectModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Novo Projeto Orçamentário</h2>
              <button className="close-btn" onClick={() => setShowProjectModal(false)}>✕</button>
            </div>
            <p className="modal-subtitle">
              Crie projetos para gerenciar orçamentos separados (ex: "Construção da Casa", "Casamento 2025").
            </p>
            
            <div className="form-group">
              <label>Nome do Projeto</label>
              <input 
                 type="text" 
                 value={newProjectName} 
                 onChange={e => setNewProjectName(e.target.value)} 
                 placeholder="Digite o nome..." 
                 autoFocus
              />
            </div>
            
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowProjectModal(false)}>Cancelar</button>
              <button className="submit-btn" onClick={handleCreateProject}>Criar Projeto</button>
            </div>
          </div>
        </div>
      )}
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
