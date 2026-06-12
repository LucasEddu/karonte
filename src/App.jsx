import React, { useState, useEffect, useMemo, useRef } from 'react';
import './App.css';
import HubView from './components/HubView';
import TransactionDrawer from './components/TransactionDrawer';
import { auth } from './config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { login, register, logout, getAllUsers, toggleUserStatus, updateUsername, changeOwnPassword, sendPasswordReset } from './services/authService';
import { addTransaction, getUserTransactions, getProjectTransactions, deleteTransaction } from './services/transactionService';
import { getUserBudgets, saveUserBudgets } from './services/budgetService';
import { getUserCategories, saveUserCategories } from './services/categoriesService';
import { getCreditCards, addCreditCard, deleteCreditCard } from './services/creditCardService';
import { getCachedInsight, saveInsightToCache } from './services/insightService';
import { getUserProjects, createProject, deleteProject, updateProject, addCollaborator, getProjectRole } from './services/projectService';
import { getProjectTasks, addTask, updateTask, deleteTask } from './services/taskService';
import { createInvite, getInvitesByEmail, acceptInvite, rejectInvite } from './services/inviteService';
import { getNotifications, markNotificationRead } from './services/notificationService';

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
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentTotal, setInstallmentTotal] = useState('2');
  const [installmentCurrent, setInstallmentCurrent] = useState('1');

  // --------- STATE: CUSTOM CATEGORIES ---------
  const [customCategories, setCustomCategories] = useState({ expense: [], income: [], classifications: {} });
  const [showCatManager, setShowCatManager] = useState(false);
  const [newCatName, setNewCatName]  = useState('');
  const [newCatType, setNewCatType]  = useState('expense');
  const [newCatClassification, setNewCatClassification] = useState('wants');
  const [catSaving, setCatSaving]    = useState(false);

  const DEFAULT_EXPENSE_CATS = ['Moradia', 'Alimentação', 'Lazer', 'Transporte', 'Saúde', 'Outros'];
  const DEFAULT_INCOME_CATS  = ['Salário', 'Investimentos', 'Freelance', 'Outros'];

  // Merged lists — defaults + custom (no duplicates)
  const expenseCategories = [...new Set([...DEFAULT_EXPENSE_CATS, ...customCategories.expense])];
  const incomeCategories  = [...new Set([...DEFAULT_INCOME_CATS,  ...customCategories.income])];

  const chartTheme = useMemo(() => {
    const root = document.documentElement;
    const get = (name) => getComputedStyle(root).getPropertyValue(name).trim();
    return {
      balance: get('--chart-balance'),
      income: get('--chart-income'),
      expense: get('--chart-expense'),
      tooltipBg: get('--chart-tooltip-bg'),
      tooltipBorder: get('--chart-tooltip-border'),
      grid: get('--chart-grid'),
      labelLine: get('--chart-label-line'),
      palette: [
        get('--chart-1'),
        get('--chart-2'),
        get('--chart-3'),
        get('--chart-4'),
        get('--chart-5'),
        get('--chart-6'),
      ],
    };
  }, [theme]);

  const chartTooltipStyle = {
    backgroundColor: chartTheme.tooltipBg,
    border: `1px solid ${chartTheme.tooltipBorder}`,
    borderRadius: 8,
    fontSize: 11,
  };

  // --------- STATE: BUDGETS & GOALS ---------
  const [budgets, setBudgets] = useState({});
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [activeBudgetCat, setActiveBudgetCat] = useState('');
  const [budgetInputValue, setBudgetInputValue] = useState('');

  // --------- STATE: CREDIT CARDS ---------
  const [creditCards, setCreditCards] = useState([]);
  const [newCardName, setNewCardName] = useState('');
  const [newCardLimit, setNewCardLimit] = useState('');
  const [newCardClosingDay, setNewCardClosingDay] = useState(5);
  const [newCardDueDay, setNewCardDueDay] = useState(10);
  const [cardSavingActive, setCardSavingActive] = useState(false);
  const [budgetsSubTab, setBudgetsSubTab] = useState('categories'); // 'categories' or 'cards'
  const [paymentMethod, setPaymentMethod] = useState('avulsa'); // 'avulsa' or 'card'
  const [selectedCardId, setSelectedCardId] = useState('');

  // --------- STATE: UI NAVIGATION & FILTERS ---------
  const [currentView, setCurrentView] = useState('hub');
  const [showTransactionDrawer, setShowTransactionDrawer] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // --------- STATE: CHATBOT UI ---------
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  const hasSpeechSupport = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);


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
  const fabButtonRef = useRef(null);
  const chatWindowRef = useRef(null);

  // --------- STATE: PROJECTS / TABS ---------
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null); // null = Geral
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [projectToDelete, setProjectToDelete] = useState(null); // { id, name } or null
  const [projectToRename, setProjectToRename] = useState(null); // { id, name } or null
  const [renameProjectValue, setRenameProjectValue] = useState('');
  const [projectSettingsId, setProjectSettingsId] = useState(null);

  // --------- STATE: TASKS (Tarefas pendentes por projeto) ---------
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskEditId, setTaskEditId] = useState(null); // null = nova tarefa
  const [taskTitleInput, setTaskTitleInput] = useState('');
  const [taskTypeInput, setTaskTypeInput] = useState('tarefa'); // 'tarefa' | 'despesa'
  const [taskMetaValueInput, setTaskMetaValueInput] = useState(''); // valor meta (string para input)
  const [taskParcelasInput, setTaskParcelasInput] = useState(''); // número de parcelas
  const [taskParcelaValueInput, setTaskParcelaValueInput] = useState(''); // valor da parcela (string)
  const [taskParcelasPaidInput, setTaskParcelasPaidInput] = useState(''); // parcelas já pagas (string numérica)
  const [taskSaving, setTaskSaving] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [taskToPay, setTaskToPay] = useState(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentMode, setPaymentMode] = useState('valor'); // 'valor' | 'parcelas'
  const [paymentParcelasInput, setPaymentParcelasInput] = useState(''); // número de parcelas a abater
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [tasksTab, setTasksTab] = useState('pendentes'); // 'pendentes' | 'concluidas'
  const [tasksSort, setTasksSort] = useState('updatedAt'); // 'updatedAt' | 'createdAt' | 'title' | 'metaValue'

  // Notifications & invites
  const [notifications, setNotifications] = useState([]);
  const [invites, setInvites] = useState([]);
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
  const [inviteModalProject, setInviteModalProject] = useState(null); // { id, name }
  const [inviteEmailInput, setInviteEmailInput] = useState('');
  const [inviteRoleInput, setInviteRoleInput] = useState('view');
  const [inviteSending, setInviteSending] = useState(false);

  // --------- STATE: DROPDOWNS / MENU POPUPS ---------
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showProfilePopover, setShowProfilePopover] = useState(false);

  // --------- EFFECTS ---------
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('finance_theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // Handle click outside dropdowns and popovers
  useEffect(() => {
    const handleOutsideClick = (e) => {
      const selector = document.querySelector('.project-selector-container');
      const mobileBtn = document.querySelector('.mobile-project-btn');
      const mobileDropdown = document.querySelector('.project-selector-dropdown.mobile-dropdown');
      
      if (showProjectDropdown && 
          (!selector || !selector.contains(e.target)) && 
          (!mobileBtn || !mobileBtn.contains(e.target)) &&
          (!mobileDropdown || !mobileDropdown.contains(e.target))) {
        setShowProjectDropdown(false);
      }

      const footer = document.querySelector('.sidebar-footer');
      const mobileAvatar = document.querySelector('.mobile-profile-avatar');
      const mobileProfileDropdown = document.querySelector('.profile-popover.mobile-dropdown');
      if (showProfilePopover && 
          (!footer || !footer.contains(e.target)) && 
          (!mobileAvatar || !mobileAvatar.contains(e.target)) &&
          (!mobileProfileDropdown || !mobileProfileDropdown.contains(e.target))) {
        setShowProfilePopover(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showProjectDropdown, showProfilePopover]);

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
        setCustomCategories({ expense: [], income: [], classifications: {} });
        setCreditCards([]);
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
          setChatMessages(prev => {
             const last = prev[prev.length - 1];
             if (last && last.text.includes('ritmo de gastos')) return prev;
             return [...prev, { id: crypto.randomUUID(), text: alertMsg, sender: 'bot' }];
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
            setChatMessages(prev => [...prev, { id: crypto.randomUUID(), text: insight, sender: 'bot' }]);
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

  // Fetch invites and notifications
  useEffect(() => {
    if (!currentUser) return;
    const email = (currentUser.email || '').trim().toLowerCase();
    if (email) {
      getInvitesByEmail(email).then(setInvites).catch(console.error);
    }
    getNotifications(currentUser.uid).then(setNotifications).catch(console.error);
  }, [currentUser]);

  // Fetch tasks for active project
  useEffect(() => {
    if (!currentUser || !activeProjectId) {
      setTasks([]);
      return;
    }
    setTasksLoading(true);
    getProjectTasks(currentUser.uid, activeProjectId)
      .then(setTasks)
      .catch(console.error)
      .finally(() => setTasksLoading(false));
  }, [currentUser, activeProjectId]);

  // Keep default tab consistent when switching project
  useEffect(() => {
    setTasksTab('pendentes');
  }, [activeProjectId]);

  const sortedAndFilteredTasks = useMemo(() => {
    const filtered = tasks.filter(t => (tasksTab === 'concluidas' ? !!t.completed : !t.completed));

    const getDateMs = (val) => {
      if (!val) return 0;
      const ms = new Date(val).getTime();
      return Number.isFinite(ms) ? ms : 0;
    };

    const withIndex = filtered.map((t, idx) => ({ t, idx }));

    withIndex.sort((a, b) => {
      const A = a.t;
      const B = b.t;

      if (tasksSort === 'title') {
        const at = (A.title || '').toString().toLowerCase();
        const bt = (B.title || '').toString().toLowerCase();
        const cmp = at.localeCompare(bt, 'pt-BR');
        return cmp !== 0 ? cmp : (a.idx - b.idx);
      }

      if (tasksSort === 'metaValue') {
        const av = Number(A.metaValue) || 0;
        const bv = Number(B.metaValue) || 0;
        if (bv !== av) return bv - av; // maior valor primeiro
        return a.idx - b.idx;
      }

      if (tasksSort === 'createdAt') {
        const ad = getDateMs(A.createdAt);
        const bd = getDateMs(B.createdAt);
        if (bd !== ad) return bd - ad; // mais recente primeiro
        return a.idx - b.idx;
      }

      // default: updatedAt
      const ad = getDateMs(A.updatedAt || A.createdAt);
      const bd = getDateMs(B.updatedAt || B.createdAt);
      if (bd !== ad) return bd - ad; // mais recente primeiro
      return a.idx - b.idx;
    });

    return withIndex.map(x => x.t);
  }, [tasks, tasksTab, tasksSort]);

  // Fetch user data when currentUser or activeProjectId or projects changes
  useEffect(() => {
    const fetchData = async () => {
       if (!currentUser) return;
       setDataLoading(true);
       try {
         let txs;
         let budgetOwnerId = currentUser.uid;
         if (activeProjectId) {
           const activeProject = projects.find(p => p.id === activeProjectId);
           if (activeProject) budgetOwnerId = activeProject.userId;
           txs = await getProjectTransactions(activeProjectId);
         } else {
           txs = await getUserTransactions(currentUser.uid, null);
         }
         setTransactions(txs);

         const userBudgets = await getUserBudgets(budgetOwnerId, activeProjectId);
         setBudgets(userBudgets);

         const cats = await getUserCategories(currentUser.uid);
         setCustomCategories(cats);

         const cards = await getCreditCards(currentUser.uid, activeProjectId);
         setCreditCards(cards);

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
  }, [currentUser, activeProjectId, projects]);

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

    if (type === 'expense' && paymentMethod === 'card') {
      if (!selectedCardId) {
        alert('Por favor, selecione um cartão de crédito.');
        return;
      }
    }

    if (type === 'expense' && isInstallment) {
      const total = parseInt(installmentTotal, 10) || 0;
      const current = parseInt(installmentCurrent, 10) || 0;
      if (total < 2) {
        alert('Informe pelo menos 2 parcelas.');
        return;
      }
      if (current < 1 || current > total) {
        alert('A parcela atual deve estar entre 1 e o total de parcelas.');
        return;
      }
    }

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

    if (type === 'expense') {
      newTransaction.paymentMethod = paymentMethod;
      if (paymentMethod === 'card') {
        newTransaction.cardId = selectedCardId;
      }
      if (isInstallment) {
        newTransaction.isInstallment = true;
        newTransaction.installments = parseInt(installmentTotal, 10);
        newTransaction.installmentNumber = parseInt(installmentCurrent, 10);
      }
    }
    
    try {
      const createdByName = currentUser?.username || currentUser?.displayName || currentUser?.email || currentUser?.uid;
      const savedDoc = await addTransaction({ ...newTransaction, createdByName }, activeProjectId);
      setTransactions([savedDoc, ...transactions]);
      setDescription(''); 
      setAmount(''); 
      setCategory(''); 
      setIsRecurring(false);
      setIsInstallment(false);
      setInstallmentTotal('2');
      setInstallmentCurrent('1');
      setPaymentMethod('avulsa');
      setSelectedCardId('');
      setShowTransactionDrawer(false);
    } catch(err) { 
      console.error('Erro ao salvar transação:', err);
      alert('Erro ao salvar transação.'); 
    }
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

  const handleConfirmDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      await deleteProject(projectToDelete.id);
      setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
      if (activeProjectId === projectToDelete.id) setActiveProjectId(null);
      setProjectToDelete(null);
    } catch (err) { alert('Erro ao excluir projeto.'); }
  };

  const handleRenameProject = async () => {
    if (!projectToRename || !renameProjectValue.trim()) return;
    try {
      await updateProject(projectToRename.id, { name: renameProjectValue.trim() });
      setProjects(prev => prev.map(p => p.id === projectToRename.id ? { ...p, name: renameProjectValue.trim() } : p));
      setProjectToRename(null);
      setRenameProjectValue('');
    } catch (err) { alert('Erro ao renomear projeto.'); }
  };

  const openTaskModal = (task = null) => {
    const meta = Number(task?.metaValue) || 0;
    const parcelas = Number(task?.parcelas) || 0;
    const paid = Number(task?.paidAmount) || 0;
    const parcelaValue = (meta > 0 && parcelas > 0) ? (meta / parcelas) : 0;
    const parcelasPagas = (parcelaValue > 0) ? Math.min(parcelas, Math.floor((paid + 1e-9) / parcelaValue)) : 0;

    setTaskEditId(task ? task.id : null);
    setTaskTitleInput(task ? task.title : '');
    setTaskTypeInput(task?.type || 'tarefa');
    setTaskMetaValueInput(task?.metaValue != null && meta > 0 ? formatMoney(meta) : '');
    setTaskParcelasInput(parcelas > 0 ? String(parcelas) : '');
    setTaskParcelaValueInput(parcelaValue > 0 ? formatMoney(parcelaValue) : '');
    setTaskParcelasPaidInput(parcelasPagas > 0 ? String(parcelasPagas) : '');
    setShowTaskModal(true);
  };

  const closeTaskModal = () => {
    setShowTaskModal(false);
    setTaskTitleInput('');
    setTaskEditId(null);
    setTaskTypeInput('tarefa');
    setTaskMetaValueInput('');
    setTaskParcelasInput('');
    setTaskParcelaValueInput('');
    setTaskParcelasPaidInput('');
  };

  const openPaymentModal = (task) => {
    setTaskToPay(task);
    setPaymentAmountInput('');
    setPaymentParcelasInput('');
    setPaymentMode('valor');
    setShowPaymentModal(true);
  };

  const handleAddPayment = async () => {
    if (!taskToPay) return;

    const meta = Number(taskToPay.metaValue) || 0;
    const parcelas = Number(taskToPay.parcelas) || 0;
    const parcelaValue = (meta > 0 && parcelas > 0) ? (meta / parcelas) : 0;

    let amount = 0;
    if (paymentMode === 'parcelas') {
      const n = parseInt(paymentParcelasInput, 10) || 0;
      amount = parcelaValue > 0 ? (n * parcelaValue) : 0;
    } else {
      amount = parseMoneyInput(paymentAmountInput);
    }
    if (!taskToPay || amount <= 0) return;
    setPaymentSaving(true);
    try {
      const currentPaid = Number(taskToPay.paidAmount) || 0;
      const newPaid = currentPaid + amount;
      await updateTask(taskToPay.id, { paidAmount: newPaid });
      setTasks(prev => prev.map(t => t.id === taskToPay.id ? { ...t, paidAmount: newPaid } : t));
      setShowPaymentModal(false);
      setTaskToPay(null);
      setPaymentAmountInput('');
      setPaymentParcelasInput('');
    } catch (err) {
      console.error('Erro ao registrar pagamento:', err);
      alert('Erro ao registrar pagamento.');
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleSaveTask = async () => {
    if (!taskTitleInput.trim() || !currentUser || !activeProjectId) return;
    const parcelas = parseInt(taskParcelasInput, 10) || 0;
    const metaFromInput = parseMoneyInput(taskMetaValueInput);
    const parcelaFromInput = parseMoneyInput(taskParcelaValueInput);
    const metaValue = (metaFromInput > 0)
      ? metaFromInput
      : (parcelas > 0 && parcelaFromInput > 0 ? (parcelas * parcelaFromInput) : 0);

    const parcelasPagas = parseInt(taskParcelasPaidInput, 10) || 0;
    const initialPaidAmount = (parcelas > 0 && parcelaFromInput > 0 && parcelasPagas > 0)
      ? (Math.min(parcelasPagas, parcelas) * parcelaFromInput)
      : null;

    setTaskSaving(true);
    try {
      if (taskEditId) {
        const payload = {
          title: taskTitleInput.trim(),
          type: taskTypeInput,
          metaValue,
          parcelas,
          ...(initialPaidAmount != null ? { paidAmount: initialPaidAmount } : {})
        };
        await updateTask(taskEditId, payload);
        setTasks(prev => prev.map(t => t.id === taskEditId ? { ...t, ...payload } : t));
      } else {
        const payload = {
          title: taskTitleInput.trim(),
          type: taskTypeInput,
          metaValue,
          parcelas,
          paidAmount: initialPaidAmount != null ? initialPaidAmount : 0,
          createdByName: currentUser?.username || currentUser?.displayName || currentUser?.email || currentUser?.uid
        };
        const newTask = await addTask(activeProjectId, payload);
        try {
          const updated = await getProjectTasks(currentUser.uid, activeProjectId);
          setTasks(updated);
        } catch (_) {
          setTasks(prev => [newTask, ...prev]);
        }
      }
      closeTaskModal();
    } catch (err) {
      console.error('Erro ao salvar tarefa:', err);
      alert('Erro ao salvar tarefa. Verifique as permissões do Firestore (coleção "tasks").');
    } finally {
      setTaskSaving(false);
    }
  };

  const handleToggleTaskComplete = async (task) => {
    try {
      await updateTask(task.id, { completed: !task.completed });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t));
    } catch (err) { alert('Erro ao atualizar tarefa.'); }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await deleteTask(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err) { alert('Erro ao excluir tarefa.'); }
  };

  const handleSendInvite = async () => {
    if (!inviteModalProject || !inviteEmailInput.trim()) return;
    setInviteSending(true);
    try {
      await createInvite(inviteModalProject.id, inviteModalProject.name, inviteEmailInput.trim(), inviteRoleInput);
      setInviteModalProject(null);
      setInviteEmailInput('');
      setInviteRoleInput('view');
      alert('Convite enviado. O usuário verá na aba de notificações quando fizer login.');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Erro ao enviar convite.');
    } finally {
      setInviteSending(false);
    }
  };

  const handleAcceptInvite = async (invite) => {
    try {
      await acceptInvite(invite.id);
      const list = await getUserProjects(currentUser.uid);
      setProjects(list);
      setInvites(prev => prev.filter(i => i.id !== invite.id));
      setShowNotificationsPanel(false);
      setActiveProjectId(invite.projectId);
    } catch (err) {
      alert(err.message || 'Erro ao aceitar convite.');
    }
  };

  const handleRejectInvite = async (inviteId) => {
    try {
      await rejectInvite(inviteId);
      setInvites(prev => prev.filter(i => i.id !== inviteId));
    } catch (err) {
      alert(err.message || 'Erro ao rejeitar.');
    }
  };

  const handleDelete = async (id) => {
     try {
       await deleteTransaction(id);
       setTransactions(transactions.filter(t => t.id !== id));
     } catch (err) { 
       console.error(err);
       alert('Erro ao deletar');
     }
  };


  // --------- DATA CALCULATIONS (Memoized) ---------
  
  const userTransactions = useMemo(() => transactions, [transactions]);

  const activeProjectRole = useMemo(() => {
    if (!activeProjectId) return 'owner';
    const p = projects.find(x => x.id === activeProjectId);
    return getProjectRole(p, currentUser?.uid) || null;
  }, [projects, activeProjectId, currentUser?.uid]);

  const canAddToProject = !activeProjectId || activeProjectRole === 'owner' || activeProjectRole === 'add' || activeProjectRole === 'manage';
  const canDeleteInProject = !activeProjectId || activeProjectRole === 'owner' || activeProjectRole === 'manage';

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

  const totalBudgetLimit = useMemo(() => {
    return Object.values(budgets).reduce((sum, val) => sum + (Number(val) || 0), 0);
  }, [budgets]);

  const budgetStats = useMemo(() => {
    const expenses = filteredTransactions.filter(t => t.type === 'expense');
    return expenseCategories.map(cat => {
      const limit = budgets[cat] || 0;
      const spent = expenses.filter(t => t.category === cat).reduce((sum, item) => sum + item.amount, 0);
      const percent = limit > 0 ? (spent / limit) * 100 : 0;
      return { name: cat, spent, limit, percent };
    }).filter(item => item.limit > 0).sort((a,b) => b.spent - a.spent);
  }, [filteredTransactions, budgets, expenseCategories]);

  const ruleStats = useMemo(() => {
    const expenses = filteredTransactions.filter(t => t.type === 'expense');
    
    const DEFAULT_CLASSIFICATIONS = {
      'Moradia': 'needs',
      'Alimentação': 'needs',
      'Transporte': 'needs',
      'Saúde': 'needs',
      'Lazer': 'wants',
      'Outros': 'wants'
    };

    let needsSpent = 0;
    let wantsSpent = 0;
    let savingsSpent = 0;

    expenses.forEach(t => {
      const cls = (customCategories.classifications && customCategories.classifications[t.category]) || DEFAULT_CLASSIFICATIONS[t.category] || 'wants';
      if (cls === 'needs') {
        needsSpent += t.amount;
      } else if (cls === 'savings') {
        savingsSpent += t.amount;
      } else {
        wantsSpent += t.amount;
      }
    });

    const savingsAmount = (balance > 0 ? balance : 0) + savingsSpent;
    const total = needsSpent + wantsSpent + savingsAmount;
    if (total === 0) return { needsPct: 0, wantsPct: 0, savingsPct: 0, needsSpent: 0, wantsSpent: 0, savingsAmount: 0 };
    
    return {
      needsPct: (needsSpent / total) * 100,
      wantsPct: (wantsSpent / total) * 100,
      savingsPct: (savingsAmount / total) * 100,
      needsSpent,
      wantsSpent,
      savingsAmount
    };
  }, [filteredTransactions, balance, customCategories.classifications]);


  // --------- HELPERS ---------
  const getCardInvoiceStats = (card, transactionsList) => {
    const limit = Number(card.limit) || 0;
    const closingDay = Number(card.closingDay) || 5;
    
    // Calculate cycle boundaries for selectedMonth/selectedYear
    const closingDate = new Date(selectedYear, selectedMonth - 1, closingDay, 23, 59, 59);
    const prevClosingDate = new Date(selectedYear, selectedMonth - 2, closingDay, 23, 59, 59);
    
    const cardExpenses = transactionsList.filter(t => 
      t.type === 'expense' && 
      t.paymentMethod === 'card' && 
      t.cardId === card.id
    );
    
    const invoiceAmount = cardExpenses.filter(t => {
      const tDate = new Date(t.date);
      return tDate > prevClosingDate && tDate <= closingDate;
    }).reduce((sum, t) => sum + t.amount, 0);
    
    const availableLimit = limit - invoiceAmount;
    const percentUsed = limit > 0 ? (invoiceAmount / limit) * 100 : 0;
    
    return {
      invoiceAmount,
      availableLimit,
      percentUsed
    };
  };

  const formatMoney = (val) => (typeof val === 'number' ? val : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const parseMoneyInput = (str) => {
    if (!str || typeof str !== 'string') return 0;
    const cleaned = str.replace(/\D/g, '');
    if (cleaned === '') return 0;
    return parseInt(cleaned, 10) / 100;
  };
  const handleTaskMoneyInput = (e, setter) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value === '') { setter(''); return; }
    const num = parseInt(value, 10) / 100;
    setter(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

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
    return chartTheme.palette[index % chartTheme.palette.length];
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
       const activeProject = projects.find(p => p.id === activeProjectId);
       const budgetOwnerId = activeProject?.userId ?? currentUser?.uid;
       await saveUserBudgets(newBudgets, activeProjectId, budgetOwnerId);
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
    const updated = {
      expense: [...customCategories.expense],
      income: [...customCategories.income],
      classifications: { ...customCategories.classifications }
    };
    const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
    updated[newCatType].push(formattedName);
    if (newCatType === 'expense') {
      updated.classifications[formattedName] = newCatClassification;
    }
    setCatSaving(true);
    try {
      await saveUserCategories(currentUser.uid, updated);
      setCustomCategories(updated);
      setNewCatName('');
      setShowCatManager(false);
    } catch (err) {
      alert('Erro ao salvar categoria.');
    } finally {
      setCatSaving(false);
    }
  };

  const handleRemoveCustomCategory = async (catName) => {
    if (!currentUser) return;
    const updatedClassifications = { ...customCategories.classifications };
    delete updatedClassifications[catName];
    const updated = {
      expense: customCategories.expense.filter(c => c !== catName),
      income:  customCategories.income.filter(c  => c !== catName),
      classifications: updatedClassifications
    };
    if (category === catName) setCategory('');
    try {
      await saveUserCategories(currentUser.uid, updated);
      setCustomCategories(updated);
    } catch(err) {
      alert('Erro ao remover categoria.');
    }
  };

  // --------- CREDIT CARDS HANDLERS ---------
  const handleCreateCreditCard = async (e) => {
    e.preventDefault();
    const name = newCardName.trim();
    if (!name || !currentUser) return;
    
    const limitNum = parseFloat(newCardLimit.replace(/\./g, '').replace(',', '.'));
    if (isNaN(limitNum) || limitNum <= 0) {
      alert('Por favor, insira um limite válido maior que zero.');
      return;
    }

    const closingDayNum = parseInt(newCardClosingDay, 10);
    const dueDayNum = parseInt(newCardDueDay, 10);
    if (closingDayNum < 1 || closingDayNum > 31 || dueDayNum < 1 || dueDayNum > 31) {
      alert('Dias de fechamento e vencimento devem ser entre 1 e 31.');
      return;
    }

    setCardSavingActive(true);
    try {
      const savedCard = await addCreditCard({
        name,
        limit: limitNum,
        closingDay: closingDayNum,
        dueDay: dueDayNum
      }, activeProjectId);
      setCreditCards([...creditCards, savedCard]);
      setNewCardName('');
      setNewCardLimit('');
      setNewCardClosingDay(5);
      setNewCardDueDay(10);
    } catch (err) {
      console.error('Erro ao salvar cartão:', err);
      alert('Erro ao cadastrar cartão de crédito.');
    } finally {
      setCardSavingActive(false);
    }
  };

  const handleDeleteCreditCard = async (cardId) => {
    if (!currentUser) return;
    if (!window.confirm('Tem certeza de que deseja remover este cartão? As despesas associadas a ele continuarão existindo, mas perderão a associação com o cartão.')) {
      return;
    }
    try {
      await deleteCreditCard(cardId);
      setCreditCards(creditCards.filter(c => c.id !== cardId));
      if (selectedCardId === cardId) setSelectedCardId('');
    } catch (err) {
      console.error('Erro ao deletar cartão:', err);
      alert('Erro ao excluir cartão de crédito.');
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

  // Close chat when clicking outside the window (with animation via CSS)
  useEffect(() => {
    if (!chatOpen) return;

    const handleClickOutside = (e) => {
      if (isDraggingFab) return;
      const chatEl = chatWindowRef.current;
      const fabEl = fabButtonRef.current;
      if (!chatEl) return;
      if (chatEl.contains(e.target)) return;
      if (fabEl && fabEl.contains(e.target)) return;
      setChatOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [chatOpen, isDraggingFab]);

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
    if (!hasSpeechSupport) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

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
    } catch(err) {
      console.error('Erro ao registrar via chat:', err);
      alert('Erro ao registrar via chat');
    }
  };

  const handleChatCancel = () => {
    if (pendingActions.length === 0) return;
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
      
      {/* MOBILE HEADER */}
      <header className="mobile-header">
        <button 
          type="button" 
          className="mobile-project-btn"
          onClick={() => setShowProjectDropdown(prev => !prev)}
        >
          <span className="mobile-project-avatar">
            {activeProjectId === null ? 'G' : (projects.find(p => p.id === activeProjectId)?.name || '?').charAt(0).toUpperCase()}
          </span>
          <span className="mobile-project-name">
            {activeProjectId === null ? 'Geral' : (projects.find(p => p.id === activeProjectId)?.name || '...')}
          </span>
          <span className="mobile-project-arrow">▾</span>
        </button>

        <div className="mobile-header-actions">
          {/* Notifications in Mobile Header */}
          <div className="notifications-wrap">
            <button
              type="button"
              className="notifications-btn"
              onClick={(e) => { e.stopPropagation(); setShowNotificationsPanel(prev => !prev); }}
              title="Notificações"
            >
              🔔
              {(invites.length > 0) && <span className="notifications-badge">{invites.length}</span>}
            </button>
            {showNotificationsPanel && (
              <div className="notifications-dropdown" onClick={(e) => e.stopPropagation()}>
                <div className="notifications-dropdown-header">Notificações</div>
                {invites.length === 0 && notifications.length === 0 && (
                  <div className="notifications-empty">Nenhuma notificação.</div>
                )}
                {invites.map(inv => (
                  <div key={inv.id} className="notification-item notification-invite">
                    <div className="notification-invite-text">
                      Convite para o projeto <strong>{inv.projectName}</strong> com acesso <strong>{inv.role === 'view' ? 'somente leitura' : inv.role === 'add' ? 'ver e incluir' : 'ver, incluir e excluir'}</strong>.
                    </div>
                    <div className="notification-invite-actions">
                      <button type="button" className="btn-confirm" onClick={() => handleAcceptInvite(inv)}>Aceitar</button>
                      <button type="button" className="btn-cancel" onClick={() => handleRejectInvite(inv.id)}>Recusar</button>
                    </div>
                  </div>
                ))}
                {notifications.filter(n => !n.read).map(n => (
                  <div key={n.id} className="notification-item">
                    <span>{n.type === 'invite' ? 'Convite' : n.type}</span>
                    <button type="button" className="text-btn" onClick={() => markNotificationRead(n.id).then(() => setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x)))}>Marcar lida</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Profile in Mobile Header */}
          <button 
            type="button" 
            className="mobile-profile-avatar"
            onClick={() => setShowProfilePopover(prev => !prev)}
          >
            {(currentUser.username || currentUser.displayName || currentUser.email || '?').charAt(0).toUpperCase()}
          </button>
        </div>

        {/* Floating dropdowns rendered relative to mobile view screen */}
        {showProjectDropdown && (
          <div className="project-selector-dropdown mobile-dropdown">
            <div className="project-selector-dropdown-header">Seus Projetos</div>
            <div className="project-selector-dropdown-list">
              <button 
                type="button"
                className={`project-selector-item ${activeProjectId === null ? 'active' : ''}`}
                onClick={() => {
                  setActiveProjectId(null);
                  setShowProjectDropdown(false);
                }}
              >
                <span className="project-item-avatar">G</span>
                <span className="project-item-name">Geral</span>
              </button>
              {projects.map(p => {
                const role = getProjectRole(p, currentUser?.uid);
                const isOwner = role === 'owner';
                return (
                  <div key={p.id} className="project-item-wrapper">
                    <button 
                      type="button"
                      className={`project-selector-item ${activeProjectId === p.id ? 'active' : ''}`}
                      onClick={() => {
                        setActiveProjectId(p.id);
                        setShowProjectDropdown(false);
                      }}
                    >
                      <span className="project-item-avatar">{p.name.charAt(0).toUpperCase()}</span>
                      <span className="project-item-name">{p.name}</span>
                      {p.isShared && <span className="project-item-shared" title="Projeto compartilhado">👤</span>}
                    </button>
                    {isOwner && (
                      <button
                        type="button"
                        className="project-item-settings-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProjectSettingsId(p.id);
                          setCurrentView('projectSettings');
                          setShowProjectDropdown(false);
                        }}
                        title="Configurações do projeto"
                      >
                        ⚙
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button 
              type="button"
              className="project-selector-add-btn"
              onClick={() => {
                setShowProjectModal(true);
                setShowProjectDropdown(false);
              }}
            >
              + Novo Projeto
            </button>
          </div>
        )}

        {showProfilePopover && (
          <div className="profile-popover mobile-dropdown">
            <div className="profile-popover-header">Sua Conta</div>
            <div className="profile-popover-user-info">
              <h4>{currentUser.username || currentUser.displayName || currentUser.email}</h4>
              <span>{currentUser.email}</span>
            </div>
            <div className="profile-popover-divider"></div>
            <div className="profile-popover-item" onClick={() => { setCurrentView('userSettings'); setShowProfilePopover(false); }}>
              ⚙ Configurações
            </div>
            <div className="profile-popover-item" onClick={() => { toggleTheme(); setShowProfilePopover(false); }}>
              {theme === 'dark' ? '☀️ Modo Claro' : '🌙 Modo Escuro'}
            </div>
            <div className="profile-popover-divider"></div>
            <button type="button" className="profile-popover-logout" onClick={() => { handleLogout(); setShowProfilePopover(false); }}>
              🚪 Sair do App
            </button>
          </div>
        )}
      </header>

      {/* SIDEBAR NAVIGATION (DESKTOP) */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img 
             id="logo"
             src={theme === 'dark' ? '/karonte-logo-dark.svg' : '/karonte-logo-light.svg'} 
             alt="Karonte" 
             style={{height: 32, width: 'auto'}} 
          />
        </div>

        {/* DESKTOP PROJECT SELECTOR */}
        <div className="project-selector-container">
          <button 
            type="button" 
            className="project-selector-btn"
            onClick={() => setShowProjectDropdown(prev => !prev)}
          >
            <div className="project-selector-avatar">
              {activeProjectId === null ? 'G' : (projects.find(p => p.id === activeProjectId)?.name || '?').charAt(0).toUpperCase()}
            </div>
            <div className="project-selector-info">
              <span className="project-selector-title">Projeto</span>
              <span className="project-selector-name">
                {activeProjectId === null ? 'Geral' : (projects.find(p => p.id === activeProjectId)?.name || '...')}
              </span>
            </div>
            <span className="project-selector-arrow">▾</span>
          </button>
          
          {showProjectDropdown && (
            <div className="project-selector-dropdown">
              <div className="project-selector-dropdown-header">Seus Projetos</div>
              <div className="project-selector-dropdown-list">
                <button 
                  type="button"
                  className={`project-selector-item ${activeProjectId === null ? 'active' : ''}`}
                  onClick={() => {
                    setActiveProjectId(null);
                    setShowProjectDropdown(false);
                  }}
                >
                  <span className="project-item-avatar">G</span>
                  <span className="project-item-name">Geral</span>
                </button>
                {projects.map(p => {
                  const role = getProjectRole(p, currentUser?.uid);
                  const isOwner = role === 'owner';
                  return (
                    <div key={p.id} className="project-item-wrapper">
                      <button 
                        type="button"
                        className={`project-selector-item ${activeProjectId === p.id ? 'active' : ''}`}
                        onClick={() => {
                          setActiveProjectId(p.id);
                          setShowProjectDropdown(false);
                        }}
                      >
                        <span className="project-item-avatar">{p.name.charAt(0).toUpperCase()}</span>
                        <span className="project-item-name">{p.name}</span>
                        {p.isShared && <span className="project-item-shared" title="Projeto compartilhado">👤</span>}
                      </button>
                      {isOwner && (
                        <button
                          type="button"
                          className="project-item-settings-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setProjectSettingsId(p.id);
                            setCurrentView('projectSettings');
                            setShowProjectDropdown(false);
                          }}
                          title="Configurações do projeto"
                        >
                          ⚙
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <button 
                type="button"
                className="project-selector-add-btn"
                onClick={() => {
                  setShowProjectModal(true);
                  setShowProjectDropdown(false);
                }}
              >
                + Novo Projeto
              </button>
            </div>
          )}
        </div>
        
        <nav className="sidebar-nav">
          <a href="#" className={`nav-item ${currentView === 'hub' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setCurrentView('hub'); }}>
            <span className="icon">◈</span> Visão geral
          </a>
          <a href="#" className={`nav-item ${currentView === 'budgets' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setCurrentView('budgets'); }}>
            <span className="icon">○</span> Orçamentos
          </a>
          <a href="#" className={`nav-item ${currentView === 'tarefas' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setCurrentView('tarefas'); }}>
            <span className="icon">☑</span> Tarefas
          </a>
        </nav>

        {/* DESKTOP USER PROFILE FOOTER */}
        <div className="sidebar-footer">
          <div className="user-profile-card" onClick={() => setShowProfilePopover(prev => !prev)}>
            <div className="avatar">
              {(currentUser.username || currentUser.displayName || currentUser.email || '?').charAt(0).toUpperCase()}
            </div>
            <div className="user-profile-details">
              <span className="user-profile-name">{currentUser.username || currentUser.displayName || currentUser.email}</span>
              <span className="user-profile-email">{currentUser.email}</span>
            </div>
            <span className="profile-options-trigger">⚙</span>
          </div>

          {showProfilePopover && (
            <div className="profile-popover">
              <div className="profile-popover-header">Sua Conta</div>
              <div className="profile-popover-item" onClick={() => { setCurrentView('userSettings'); setShowProfilePopover(false); }}>
                ⚙ Configurações
              </div>
              <div className="profile-popover-item" onClick={() => { toggleTheme(); setShowProfilePopover(false); }}>
                {theme === 'dark' ? '☀️ Modo Claro' : '🌙 Modo Escuro'}
              </div>
              <div className="profile-popover-divider"></div>
              <button type="button" className="profile-popover-logout" onClick={() => { handleLogout(); setShowProfilePopover(false); }}>
                🚪 Sair do App
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="mobile-bottom-nav">
        <a href="#" className={`mobile-nav-item ${currentView === 'hub' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setCurrentView('hub'); }}>
          <span className="icon">◈</span>
          <span className="label">Início</span>
        </a>
        {canAddToProject && (
          <button
            type="button"
            className="mobile-nav-fab"
            onClick={() => setShowTransactionDrawer(true)}
            aria-label="Novo lançamento"
          >
            +
          </button>
        )}
        <a href="#" className={`mobile-nav-item ${currentView === 'budgets' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setCurrentView('budgets'); }}>
          <span className="icon">○</span>
          <span className="label">Orçamento</span>
        </a>
        <a href="#" className={`mobile-nav-item ${currentView === 'tarefas' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setCurrentView('tarefas'); }}>
          <span className="icon">☑</span>
          <span className="label">Tarefas</span>
        </a>
      </nav>

      {/* MAIN CONTENT AREA */}
      <div className="content-wrapper">
        <header className="top-bar">
          <div className="page-context">
            <h2 className="page-title">
              {currentView === 'hub' && 'Visão Geral'}
              {currentView === 'budgets' && 'Orçamentos'}
              {currentView === 'tarefas' && 'Tarefas'}
              {currentView === 'userSettings' && 'Configurações de Conta'}
              {currentView === 'projectSettings' && 'Configurações do Projeto'}
            </h2>
            {activeProjectId !== null && (
              <span className="project-badge">
                {(projects.find(p => p.id === activeProjectId)?.name || '')}
              </span>
            )}
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
               <button onClick={exportToCSV} className="export-btn" title="Exportar CSV">Download Relatório</button>
            ) : null}
            <div className="divider"></div>
            
            {/* DESKTOP NOTIFICATIONS BELL */}
            <div className="notifications-wrap desktop-only">
              <button
                type="button"
                className="notifications-btn"
                onClick={(e) => { e.stopPropagation(); setShowNotificationsPanel(prev => !prev); }}
                title="Notificações"
              >
                🔔
                {(invites.length > 0) && <span className="notifications-badge">{invites.length}</span>}
              </button>
              {showNotificationsPanel && (
                <div className="notifications-dropdown" onClick={(e) => e.stopPropagation()}>
                  <div className="notifications-dropdown-header">Notificações</div>
                  {invites.length === 0 && notifications.length === 0 && (
                    <div className="notifications-empty">Nenhuma notificação.</div>
                  )}
                  {invites.map(inv => (
                    <div key={inv.id} className="notification-item notification-invite">
                      <div className="notification-invite-text">
                        Convite para o projeto <strong>{inv.projectName}</strong> com acesso <strong>{inv.role === 'view' ? 'somente leitura' : inv.role === 'add' ? 'ver e incluir' : 'ver, incluir e excluir'}</strong>.
                      </div>
                      <div className="notification-invite-actions">
                        <button type="button" className="btn-confirm" onClick={() => handleAcceptInvite(inv)}>Aceitar</button>
                        <button type="button" className="btn-cancel" onClick={() => handleRejectInvite(inv.id)}>Recusar</button>
                      </div>
                    </div>
                  ))}
                  {notifications.filter(n => !n.read).map(n => (
                    <div key={n.id} className="notification-item">
                      <span>{n.type === 'invite' ? 'Convite' : n.type}</span>
                      <button type="button" className="text-btn" onClick={() => markNotificationRead(n.id).then(() => setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x)))}>Marcar lida</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        {currentView === 'userSettings' && (
          <main className="main-content">
            <div className="card list-section">
              <div className="list-header">
                <h2>Configurações da conta</h2>
              </div>
              <div style={{fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16}}>
                Gerencie suas informações básicas e preferências.
              </div>
              <div className="settings-grid">
                <div className="settings-card">
                  <h3>Perfil</h3>
                  <p><strong>Nome de exibição</strong><br />{currentUser.displayName || '—'}</p>
                  <p><strong>Username</strong><br />{currentUser.username || '—'}</p>
                  <p><strong>E-mail</strong><br />{currentUser.email}</p>
                </div>
                <div className="settings-card">
                  <h3>Segurança</h3>
                  <p style={{fontSize: 12, color: 'var(--text-tertiary)'}}>Use a tela de login para redefinir sua senha se necessário.</p>
                </div>
              </div>
              <div style={{marginTop: 24}}>
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => setCurrentView('hub')}
                >
                  ← Voltar para Dashboard
                </button>
              </div>
            </div>
          </main>
        )}

        {currentView === 'projectSettings' && projectSettingsId && (
          <main className="main-content">
            <div className="card list-section">
              {(() => {
                const proj = projects.find(p => p.id === projectSettingsId);
                if (!proj) return (
                  <div>
                    <div className="list-header">
                      <h2>Projeto não encontrado</h2>
                    </div>
                    <button type="button" className="text-btn" onClick={() => setCurrentView('hub')}>← Voltar</button>
                  </div>
                );
                const rolesMap = proj.collaboratorRoles || {};
                const namesMap = proj.collaboratorNames || {};
                const collaboratorIds = proj.collaborators || [];
                return (
                  <>
                    <div className="list-header">
                      <h2>Configurações do projeto</h2>
                    </div>
                    <div style={{fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16}}>
                      Gerencie o nome, participantes e permissões de “{proj.name}”.
                    </div>

                    <section className="settings-block">
                      <h3>Informações básicas</h3>
                      <div className="form-group">
                        <label>Nome do projeto</label>
                        <input
                          type="text"
                          value={renameProjectValue || proj.name}
                          onChange={e => setRenameProjectValue(e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        className="submit-btn"
                        onClick={() => {
                          if (!renameProjectValue.trim()) return;
                          updateProject(proj.id, { name: renameProjectValue.trim() })
                            .then(() => {
                              setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, name: renameProjectValue.trim() } : p));
                            })
                            .catch(() => alert('Erro ao renomear projeto.'));
                        }}
                      >
                        Salvar nome
                      </button>
                    </section>

                    <section className="settings-block">
                      <h3>Participantes</h3>
                      <p className="settings-hint">Apenas o dono pode gerenciar permissões.</p>
                      <div className="participants-list">
                        <div className="participant-row">
                          <div className="participant-main">
                            <span className="participant-name">
                              Dono: {proj.userId === currentUser.uid
                                ? (currentUser.username || currentUser.displayName || currentUser.email || proj.userId)
                                : proj.userId}
                            </span>
                            <span className="participant-role-tag">Owner</span>
                          </div>
                        </div>
                        {collaboratorIds.map(uid => (
                          <div key={uid} className="participant-row">
                            <div className="participant-main">
                              <span className="participant-name">
                                Colaborador: {namesMap[uid] || '—'}
                              </span>
                              {!namesMap[uid] ? (
                                <div className="participant-name-edit">
                                  <input
                                    className="participant-name-input"
                                    type="text"
                                    placeholder="Nome do colaborador..."
                                    onKeyDown={(e) => {
                                      if (e.key !== 'Enter') return;
                                      const val = e.currentTarget.value.trim();
                                      if (!val) return;
                                      updateProject(proj.id, { collaboratorNames: { ...namesMap, [uid]: val } })
                                        .then(() => {
                                          setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, collaboratorNames: { ...(p.collaboratorNames || {}), [uid]: val } } : p));
                                          e.currentTarget.value = '';
                                        })
                                        .catch(() => alert('Erro ao salvar nome do colaborador.'));
                                    }}
                                  />
                                  <span className="participant-name-hint">Pressione Enter para salvar</span>
                                </div>
                              ) : null}
                            </div>
                            <div className="participant-actions">
                              <select
                                className="participant-role-select"
                                value={rolesMap[uid] || 'view'}
                                onChange={e => {
                                  const newRole = e.target.value;
                                  updateProject(proj.id, {
                                    collaboratorRoles: { ...rolesMap, [uid]: newRole }
                                  }).then(() => {
                                    setProjects(prev => prev.map(p => p.id === proj.id ? {
                                      ...p,
                                      collaboratorRoles: { ...(p.collaboratorRoles || {}), [uid]: newRole }
                                    } : p));
                                  }).catch(() => alert('Erro ao atualizar permissão.'));
                                }}
                              >
                                <option value="view">Apenas ver</option>
                                <option value="add">Ver e incluir</option>
                                <option value="manage">Ver, incluir e excluir</option>
                              </select>
                              <button
                                type="button"
                                className="text-btn danger"
                                onClick={() => {
                                  const { [uid]: _, ...restRoles } = rolesMap;
                                  const { [uid]: __, ...restNames } = namesMap;
                                  const newCollabs = collaboratorIds.filter(id => id !== uid);
                                  updateProject(proj.id, {
                                    collaborators: newCollabs,
                                    collaboratorRoles: restRoles,
                                    collaboratorNames: restNames
                                  }).then(() => {
                                    setProjects(prev => prev.map(p => p.id === proj.id ? {
                                      ...p,
                                      collaborators: newCollabs,
                                      collaboratorRoles: restRoles,
                                      collaboratorNames: restNames
                                    } : p));
                                  }).catch(() => alert('Erro ao remover colaborador.'));
                                }}
                              >
                                Remover
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="settings-block">
                      <h3>Convidar novo participante</h3>
                      <div className="form-group">
                        <label>E-mail</label>
                        <input
                          type="email"
                          value={inviteEmailInput}
                          onChange={e => setInviteEmailInput(e.target.value)}
                          placeholder="email@exemplo.com"
                        />
                      </div>
                      <div className="form-group">
                        <label>Nível de acesso</label>
                        <select value={inviteRoleInput} onChange={e => setInviteRoleInput(e.target.value)}>
                          <option value="view">Apenas ver</option>
                          <option value="add">Ver e incluir registros</option>
                          <option value="manage">Ver, incluir e excluir registros</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        className="submit-btn"
                        onClick={() => {
                          if (!inviteEmailInput.trim()) return;
                          setInviteSending(true);
                          createInvite(proj.id, proj.name, inviteEmailInput.trim(), inviteRoleInput)
                            .then(() => {
                              setInviteEmailInput('');
                              alert('Convite enviado.');
                            })
                            .catch(err => alert(err.message || 'Erro ao enviar convite.'))
                            .finally(() => setInviteSending(false));
                        }}
                        disabled={inviteSending || !inviteEmailInput.trim()}
                      >
                        {inviteSending ? 'Enviando...' : 'Enviar convite'}
                      </button>
                    </section>

                    <section className="settings-block">
                      <h3>Zona perigosa</h3>
                      <p className="settings-hint">Excluir o projeto remove também seus dados associados para você.</p>
                      <button
                        type="button"
                        className="submit-btn"
                        style={{ background: 'var(--danger-color)' }}
                        onClick={() => setProjectToDelete({ id: proj.id, name: proj.name })}
                      >
                        Excluir projeto
                      </button>
                    </section>

                    <div style={{marginTop: 24}}>
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => { setProjectSettingsId(null); setCurrentView('hub'); }}
                      >
                        ← Voltar para Dashboard
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </main>
        )}

        {currentView === 'hub' && (
          <HubView
            formatMoney={formatMoney}
            balance={balance}
            totalIncome={totalIncome}
            totalExpense={totalExpense}
            totalBudgetLimit={totalBudgetLimit}
            calculateForecast={calculateForecast}
            categoryStats={categoryStats}
            getCategoryBudgetInfo={getCategoryBudgetInfo}
            getCatFill={getCatFill}
            getCatTrack={getCatTrack}
            chartTheme={chartTheme}
            chartTooltipStyle={chartTooltipStyle}
            monthlyEvolutionData={monthlyEvolutionData}
            budgetStats={budgetStats}
            ruleStats={ruleStats}
            filteredTransactions={filteredTransactions}
            creditCards={creditCards}
            canAddToProject={canAddToProject}
            canDeleteInProject={canDeleteInProject}
            onAddClick={() => setShowTransactionDrawer(true)}
            onDelete={handleDelete}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />
        )}

        {currentView === 'budgets' && (
            <main className="main-content">
              {/* SUB-TABS NAVIGATION */}
              <div className="sub-tab-nav" style={{ display: 'flex', gap: 15, marginBottom: 15, borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>
                <button 
                  type="button"
                  className={`sub-tab-item ${budgetsSubTab === 'categories' ? 'active' : ''}`}
                  onClick={() => setBudgetsSubTab('categories')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '8px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: budgetsSubTab === 'categories' ? 'var(--text-highlight)' : 'var(--text-tertiary)',
                    borderBottom: budgetsSubTab === 'categories' ? '2px solid var(--text-highlight)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  Limites Orçamentários
                </button>
                <button 
                  type="button"
                  className={`sub-tab-item ${budgetsSubTab === 'cards' ? 'active' : ''}`}
                  onClick={() => setBudgetsSubTab('cards')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '8px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: budgetsSubTab === 'cards' ? 'var(--text-highlight)' : 'var(--text-tertiary)',
                    borderBottom: budgetsSubTab === 'cards' ? '2px solid var(--text-highlight)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  Cartões de Crédito
                </button>
              </div>

              {budgetsSubTab === 'categories' && (
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
              )}

              {budgetsSubTab === 'cards' && (
                <div className="card-manager-grid">
                  {/* Left: Cards List */}
                  <div className="card list-section" style={{ margin: 0 }}>
                    <div className="list-header">
                      <h2>Meus Cartões de Crédito</h2>
                      <span className="link-all" style={{ color: 'var(--text-tertiary)' }}>{creditCards.length} cadastrados</span>
                    </div>

                    <div className="history-list" style={{ marginTop: 15 }}>
                      {creditCards.length === 0 ? (
                        <div style={{ fontSize: 11, padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                          Nenhum cartão cadastrado. Use o formulário ao lado para cadastrar.
                        </div>
                      ) : (
                        creditCards.map(card => {
                          const stats = getCardInvoiceStats(card, userTransactions);
                          const progressPct = Math.min(stats.percentUsed, 100);
                          let colorClass = 'safe';
                          if (stats.percentUsed > 100) colorClass = 'danger';
                          else if (stats.percentUsed > 80) colorClass = 'warning';

                          return (
                            <div key={card.id} className="history-item" style={{ cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 1rem' }}>
                              <div className="t-details" style={{ flex: 1 }}>
                                <span className="t-name" style={{ fontSize: 13, fontWeight: 600 }}>💳 {card.name}</span>
                                <span className="t-meta" style={{ fontSize: 10, marginTop: 4 }}>
                                  Vencimento: Dia {card.dueDay} • Fechamento: Dia {card.closingDay}
                                </span>
                                <span className="t-meta" style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                                  Fatura Atual: <strong style={{ color: 'var(--text-primary)' }}>R$ {formatMoney(stats.invoiceAmount)}</strong>
                                </span>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, marginRight: 15, width: 140 }}>
                                <div style={{ fontSize: 9, color: 'var(--text-tertiary)', textAlign: 'right' }}>
                                  Disponível: R$ {formatMoney(stats.availableLimit)} / R$ {formatMoney(card.limit)}
                                </div>
                                <div className="budget-progress-track" style={{ width: '100%', height: 6 }}>
                                  <div 
                                    className={`budget-progress-fill ${colorClass}`} 
                                    style={{ width: `${progressPct}%` }}
                                  />
                                </div>
                              </div>

                              <button 
                                type="button"
                                className="delete-btn-subtle" 
                                onClick={() => handleDeleteCreditCard(card.id)} 
                                title="Remover Cartão"
                                style={{ fontSize: 16, background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '0 5px' }}
                              >
                                ×
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Right: Add Card Form */}
                  <div className="card form-section" style={{ margin: 0 }}>
                    <div className="card-title" style={{ fontSize: 14, fontWeight: 700, marginBottom: 15 }}>Cadastrar Novo Cartão</div>
                    <form onSubmit={handleCreateCreditCard} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <label style={{ fontSize: 11, fontWeight: 600 }}>Nome do Cartão</label>
                        <input 
                          type="text" 
                          value={newCardName} 
                          onChange={e => setNewCardName(e.target.value)} 
                          placeholder="Ex: Nubank, Visa" 
                          required 
                          style={{ fontSize: 11, padding: '8px 10px', borderRadius: 6, border: '0.5px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
                        />
                      </div>

                      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <label style={{ fontSize: 11, fontWeight: 600 }}>Limite Total (R$)</label>
                        <input 
                          type="text" 
                          value={newCardLimit} 
                          onChange={(e) => handleTaskMoneyInput(e, setNewCardLimit)} 
                          placeholder="0,00" 
                          required 
                          style={{ fontSize: 11, padding: '8px 10px', borderRadius: 6, border: '0.5px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
                        />
                      </div>

                      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <label style={{ fontSize: 11, fontWeight: 600 }}>Dia de Fechamento</label>
                        <select 
                          value={newCardClosingDay} 
                          onChange={e => setNewCardClosingDay(e.target.value)}
                          style={{ fontSize: 11, padding: '8px', borderRadius: 6, border: '0.5px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
                        >
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                            <option key={day} value={day}>Dia {day}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <label style={{ fontSize: 11, fontWeight: 600 }}>Dia de Vencimento</label>
                        <select 
                          value={newCardDueDay} 
                          onChange={e => setNewCardDueDay(e.target.value)}
                          style={{ fontSize: 11, padding: '8px', borderRadius: 6, border: '0.5px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
                        >
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                            <option key={day} value={day}>Dia {day}</option>
                          ))}
                        </select>
                      </div>

                      <button 
                        type="submit" 
                        className="submit-btn" 
                        disabled={cardSavingActive || !newCardName.trim()}
                        style={{ marginTop: 10, alignSelf: 'stretch', padding: '10px' }}
                      >
                        {cardSavingActive ? 'Adicionando...' : 'Cadastrar Cartão'}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </main>
          )}

        {currentView === 'tarefas' && (
          <main className="main-content">
            <div className="card list-section">
              <div className="list-header">
                <h2>Tarefas</h2>
                {activeProjectId && canAddToProject ? (
                  <button type="button" className="submit-btn" onClick={() => openTaskModal()} style={{ padding: '8px 16px', fontSize: 13 }}>
                    + Nova tarefa
                  </button>
                ) : null}
              </div>
              {activeProjectId ? (
                <div className="tasks-toolbar">
                  <div className="tasks-tabs">
                    <button
                      type="button"
                      className={`tasks-tab ${tasksTab === 'pendentes' ? 'active' : ''}`}
                      onClick={() => setTasksTab('pendentes')}
                    >
                      Pendentes ({tasks.filter(t => !t.completed).length})
                    </button>
                    <button
                      type="button"
                      className={`tasks-tab ${tasksTab === 'concluidas' ? 'active' : ''}`}
                      onClick={() => setTasksTab('concluidas')}
                    >
                      Concluídas ({tasks.filter(t => !!t.completed).length})
                    </button>
                  </div>

                  <div className="tasks-sort">
                    <label className="tasks-sort-label">Ordenar por</label>
                    <select value={tasksSort} onChange={e => setTasksSort(e.target.value)} className="tasks-sort-select">
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
                  {sortedAndFilteredTasks.map(task => {
                    const meta = Number(task.metaValue) || 0;
                    const paid = Number(task.paidAmount) || 0;
                    const isDespesa = task.type === 'despesa';
                    const parcelasCount = Number(task.parcelas) || 0;
                    const parcelaValue = parcelasCount > 0 && meta > 0 ? (meta / parcelasCount) : 0;
                    const parcelasPagas = parcelaValue > 0
                      ? Math.min(parcelasCount, Math.floor((paid + 1e-9) / parcelaValue))
                      : 0;
                    const parcelasRestantes = parcelasCount > 0 ? Math.max(0, parcelasCount - parcelasPagas) : 0;
                    const progressPct = meta > 0
                      ? (isDespesa ? Math.min(100, (paid / meta) * 100) : (task.completed ? 100 : Math.min(100, (paid / meta) * 100)))
                      : (task.completed ? 100 : 0);
                    return (
                      <li key={task.id} className={`task-item ${task.completed ? 'completed' : ''} ${isDespesa ? 'task-despesa' : ''}`}>
                        <label className="task-check-wrap">
                          <input
                            type="checkbox"
                            checked={!!task.completed}
                            onChange={() => handleToggleTaskComplete(task)}
                          />
                          <span className="task-check-custom" />
                        </label>
                        <div className="task-body">
                          <div className="task-row">
                            <span className="task-title">{task.title}</span>
                            {parcelasCount > 0 && <span className="task-parcelas">{parcelasCount}x</span>}
                            <div className="task-actions">
                              {canAddToProject && isDespesa && meta > 0 && (
                                <button type="button" className="task-btn-pay" onClick={() => openPaymentModal(task)} title="Registrar pagamento">+ Abater</button>
                              )}
                              {canAddToProject && <button type="button" className="task-btn-edit" onClick={() => openTaskModal(task)} title="Editar">✎</button>}
                              {canDeleteInProject && <button type="button" className="task-btn-delete" onClick={() => handleDeleteTask(task.id)} title="Excluir">✕</button>}
                            </div>
                          </div>
                          {(meta > 0 || isDespesa) && (
                            <div className="task-progress-wrap">
                              <div className="task-meta-info">
                                {isDespesa && meta > 0 && (
                                  <span className="task-meta-text">R$ {formatMoney(paid)} de R$ {formatMoney(meta)}</span>
                                )}
                                {parcelasCount > 0 && meta > 0 && (
                                  <span className="task-meta-parcela">Valor parcela: R$ {formatMoney(meta / parcelasCount)}</span>
                                )}
                                {isDespesa && parcelasCount > 0 && meta > 0 && (
                                  <span className="task-meta-parcelas-status">
                                    Parcelas: {parcelasPagas}/{parcelasCount} pagas • faltam {parcelasRestantes}
                                  </span>
                                )}
                                {task.createdByName ? (
                                  <span className="task-meta-text">por {task.createdByName}</span>
                                ) : null}
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
        )}
      </div>

      {!chatOpen && (
        <button
          className={`chat-fab ${unreadCount > 0 ? 'has-unread' : ''}`}
          onClick={() => { if (!isDraggingFab) setChatOpen(true); }}
          onMouseDown={handleFabMouseDown}
          ref={fabButtonRef}
          style={{ left: `${fabPosition.x}px`, top: `${fabPosition.y}px` }}
        >
          <img src="/karonte-favicon-light.svg" alt="Karonte" className="fab-icon-img" />
          {unreadCount > 0 ? <span className="fab-badge">{unreadCount}</span> : null}
        </button>
      )}

      <aside
        className={`chatbot-float-window ${chatOpen ? 'open' : ''}`}
        ref={chatWindowRef}
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
                   title={hasSpeechSupport ? "Comando de Voz" : "Seu navegador não suporta reconhecimento de voz da Web API."}
                   disabled={!hasSpeechSupport}
                   style={!hasSpeechSupport ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
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
      <TransactionDrawer
        open={showTransactionDrawer}
        onClose={() => setShowTransactionDrawer(false)}
        onSubmit={handleAddTransaction}
        description={description}
        setDescription={setDescription}
        amount={amount}
        handleAmountChange={handleAmountChange}
        type={type}
        setType={setType}
        category={category}
        setCategory={setCategory}
        isRecurring={isRecurring}
        setIsRecurring={setIsRecurring}
        isInstallment={isInstallment}
        setIsInstallment={setIsInstallment}
        installmentTotal={installmentTotal}
        setInstallmentTotal={setInstallmentTotal}
        installmentCurrent={installmentCurrent}
        setInstallmentCurrent={setInstallmentCurrent}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        selectedCardId={selectedCardId}
        setSelectedCardId={setSelectedCardId}
        expenseCategories={expenseCategories}
        incomeCategories={incomeCategories}
        creditCards={creditCards}
        showCatManager={showCatManager}
        setShowCatManager={setShowCatManager}
        customCategories={customCategories}
        handleRemoveCustomCategory={handleRemoveCustomCategory}
        newCatName={newCatName}
        setNewCatName={setNewCatName}
        newCatType={newCatType}
        setNewCatType={setNewCatType}
        newCatClassification={newCatClassification}
        setNewCatClassification={setNewCatClassification}
        handleAddCustomCategory={handleAddCustomCategory}
        catSaving={catSaving}
      />

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

      {/* MODAL CONVIDAR PARA PROJETO */}
      {inviteModalProject && (
        <div className="modal-overlay" onClick={() => { setInviteModalProject(null); setInviteEmailInput(''); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Convidar para &quot;{inviteModalProject.name}&quot;</h2>
              <button className="close-btn" onClick={() => { setInviteModalProject(null); setInviteEmailInput(''); }}>✕</button>
            </div>
            <p className="modal-subtitle">O convidado receberá o convite ao fazer login (e-mail usado no cadastro).</p>
            <div className="form-group">
              <label>E-mail do usuário</label>
              <input type="email" value={inviteEmailInput} onChange={e => setInviteEmailInput(e.target.value)} placeholder="email@exemplo.com" autoFocus />
            </div>
            <div className="form-group">
              <label>Nível de acesso</label>
              <select value={inviteRoleInput} onChange={e => setInviteRoleInput(e.target.value)}>
                <option value="view">Apenas ver</option>
                <option value="add">Ver e incluir registros</option>
                <option value="manage">Ver, incluir e excluir registros</option>
              </select>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => { setInviteModalProject(null); setInviteEmailInput(''); }}>Cancelar</button>
              <button type="button" className="submit-btn" onClick={handleSendInvite} disabled={inviteSending || !inviteEmailInput.trim()}>{inviteSending ? 'Enviando...' : 'Enviar convite'}</button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMAÇÃO EXCLUSÃO PROJETO */}
      {projectToDelete && (
        <div className="modal-overlay" onClick={() => setProjectToDelete(null)}>
          <div className="modal-content modal-confirm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Excluir projeto</h2>
              <button className="close-btn" onClick={() => setProjectToDelete(null)}>✕</button>
            </div>
            <p className="modal-subtitle">Tem certeza que deseja excluir o projeto &quot;{projectToDelete.name}&quot;? Esta ação não pode ser desfeita.</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setProjectToDelete(null)}>Cancelar</button>
              <button className="submit-btn" style={{ background: 'var(--danger-color)' }} onClick={handleConfirmDeleteProject}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* RENOMEAR PROJETO */}
      {projectToRename && (
        <div className="modal-overlay" onClick={() => { setProjectToRename(null); setRenameProjectValue(''); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Renomear projeto</h2>
              <button className="close-btn" onClick={() => { setProjectToRename(null); setRenameProjectValue(''); }}>✕</button>
            </div>
            <div className="form-group">
              <label>Nome do projeto</label>
              <input
                type="text"
                value={renameProjectValue}
                onChange={e => setRenameProjectValue(e.target.value)}
                placeholder="Novo nome..."
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => { setProjectToRename(null); setRenameProjectValue(''); }}>Cancelar</button>
              <button className="submit-btn" onClick={handleRenameProject} disabled={!renameProjectValue.trim()}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAREFA (adicionar / editar) */}
      {showTaskModal && (
        <div className="modal-overlay" onClick={closeTaskModal}>
          <div className="modal-content modal-task" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{taskEditId ? 'Editar tarefa' : 'Nova tarefa'}</h2>
              <button className="close-btn" onClick={closeTaskModal}>✕</button>
            </div>
            <div className="form-group">
              <label>Descrição da tarefa</label>
              <input
                type="text"
                value={taskTitleInput}
                onChange={e => setTaskTitleInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSaveTask(); } }}
                placeholder="Ex: Conta de luz, Empréstimo"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Tipo</label>
              <select value={taskTypeInput} onChange={e => setTaskTypeInput(e.target.value)}>
                <option value="tarefa">Tarefa</option>
                <option value="despesa">Despesa / Dívida</option>
              </select>
            </div>
            {taskTypeInput === 'despesa' && (
              <>
                <div className="form-group">
                  <label>Valor total (R$)</label>
                  <input
                    type="text"
                    value={taskMetaValueInput}
                    onChange={e => handleTaskMoneyInput(e, setTaskMetaValueInput)}
                    placeholder="0,00"
                  />
                </div>
                <div className="form-group">
                  <label>Valor da parcela (R$) (opcional)</label>
                  <input
                    type="text"
                    value={taskParcelaValueInput}
                    onChange={e => handleTaskMoneyInput(e, setTaskParcelaValueInput)}
                    placeholder="0,00"
                  />
                  {(parseInt(taskParcelasInput, 10) || 0) > 0 && parseMoneyInput(taskParcelaValueInput) > 0 ? (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                      Total calculado: R$ {formatMoney((parseInt(taskParcelasInput, 10) || 0) * parseMoneyInput(taskParcelaValueInput))}
                    </div>
                  ) : null}
                </div>
                <div className="form-group">
                  <label>Número de parcelas (opcional)</label>
                  <input
                    type="number"
                    min="1"
                    value={taskParcelasInput}
                    onChange={e => setTaskParcelasInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="Ex: 12"
                  />
                </div>
                <div className="form-group">
                  <label>Parcelas já pagas (opcional)</label>
                  <input
                    type="number"
                    min="0"
                    value={taskParcelasPaidInput}
                    onChange={e => setTaskParcelasPaidInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="Ex: 3"
                  />
                  {parseMoneyInput(taskParcelaValueInput) > 0 && (parseInt(taskParcelasPaidInput, 10) || 0) > 0 ? (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                      Abatimento calculado: R$ {formatMoney(Math.min(parseInt(taskParcelasPaidInput, 10) || 0, parseInt(taskParcelasInput, 10) || 0) * parseMoneyInput(taskParcelaValueInput))}
                    </div>
                  ) : null}
                </div>
              </>
            )}
            {taskTypeInput === 'tarefa' && (
              <div className="form-group">
                <label>Valor meta (R$), opcional</label>
                <input
                  type="text"
                  value={taskMetaValueInput}
                  onChange={e => handleTaskMoneyInput(e, setTaskMetaValueInput)}
                  placeholder="0,00"
                />
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={closeTaskModal}>Cancelar</button>
              <button type="button" className="submit-btn" onClick={handleSaveTask} disabled={taskSaving || !taskTitleInput.trim()}>{taskSaving ? '...' : (taskEditId ? 'Salvar' : 'Adicionar')}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR PAGAMENTO (abater dívida) */}
      {showPaymentModal && taskToPay && (
        <div className="modal-overlay" onClick={() => { setShowPaymentModal(false); setTaskToPay(null); setPaymentAmountInput(''); setPaymentParcelasInput(''); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Registrar pagamento</h2>
              <button className="close-btn" onClick={() => { setShowPaymentModal(false); setTaskToPay(null); setPaymentAmountInput(''); setPaymentParcelasInput(''); }}>✕</button>
            </div>
            <p className="modal-subtitle">Abater valor em &quot;{taskToPay.title}&quot;. Valor pago até agora: R$ {formatMoney(Number(taskToPay.paidAmount) || 0)} de R$ {formatMoney(Number(taskToPay.metaValue) || 0)}.</p>
            <div className="form-group">
              <label>Modo de abatimento</label>
              <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                <option value="valor">Por valor</option>
                <option value="parcelas">Por parcelas</option>
              </select>
            </div>
            <div className="form-group">
              {paymentMode === 'parcelas' ? (
                <>
                  <label>Parcelas pagas agora</label>
                  <input
                    type="number"
                    min="1"
                    value={paymentParcelasInput}
                    onChange={e => setPaymentParcelasInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="Ex: 1"
                    autoFocus
                  />
                  {(() => {
                    const meta = Number(taskToPay.metaValue) || 0;
                    const parcelas = Number(taskToPay.parcelas) || 0;
                    const parcelaValue = (meta > 0 && parcelas > 0) ? (meta / parcelas) : 0;
                    const n = parseInt(paymentParcelasInput, 10) || 0;
                    return (parcelaValue > 0 && n > 0)
                      ? <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Valor abatido: R$ {formatMoney(n * parcelaValue)}</div>
                      : (parcelas <= 0 ? <div style={{ fontSize: 11, color: 'var(--danger-color)', marginTop: 4 }}>Esta despesa não tem parcelas definidas.</div> : null);
                  })()}
                </>
              ) : (
                <>
                  <label>Valor a abater (R$)</label>
                  <input
                    type="text"
                    value={paymentAmountInput}
                    onChange={e => handleTaskMoneyInput(e, setPaymentAmountInput)}
                    placeholder="0,00"
                    autoFocus
                  />
                </>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => { setShowPaymentModal(false); setTaskToPay(null); setPaymentAmountInput(''); setPaymentParcelasInput(''); }}>Cancelar</button>
              <button
                type="button"
                className="submit-btn"
                onClick={handleAddPayment}
                disabled={paymentSaving || (paymentMode === 'parcelas' ? (parseInt(paymentParcelasInput, 10) || 0) <= 0 : parseMoneyInput(paymentAmountInput) <= 0)}
              >
                {paymentSaving ? '...' : 'Registrar'}
              </button>
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
