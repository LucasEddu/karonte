import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense, lazy } from 'react';
import './App.css';
import HubView from './components/HubView';
import TransactionDrawer from './components/TransactionDrawer';
import ErrorBoundary from './components/ErrorBoundary';

const ImportHubView = lazy(() => import('./components/ImportHubView'));
import { auth } from './config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { login, register, logout, getAllUsers, toggleUserStatus, updateUsername, changeOwnPassword, sendPasswordReset } from './services/authService';
import { addTransaction, addTransactionsBatch, deleteTransaction, updateTransaction, deleteTransactionsByIds } from './services/transactionService';
import { saveImportBatch, markImportBatchUndone } from './services/importBatchService';
import { savePurchaseInvoice } from './services/purchaseInvoiceService';
import { getUserBudgets, saveUserBudgets } from './services/budgetService';
import { getUserCategories, saveUserCategories } from './services/categoriesService';
import { getCreditCards, addCreditCard, deleteCreditCard } from './services/creditCardService';
import { getCachedInsight, saveInsightToCache } from './services/insightService';
import { getUserProjects, createProject, deleteProject, updateProject } from './services/projectService';
import { getProjectTasks, addTask, updateTask, deleteTask, appendTaskComment } from './services/taskService';
import { createInvite, getInvitesByEmail, acceptInvite, rejectInvite } from './services/inviteService';
import { getNotifications, markNotificationRead } from './services/notificationService';
import { persistMissingRecurrences } from './services/recurrenceService';
import { DEFAULT_EXPENSE_CATS, DEFAULT_INCOME_CATS } from './constants/categories';
import { mergeCategoryNames, getClassificationsByName, createCategoryItem, buildTransactionCategoryFields, resolveCategoryForTransaction } from './utils/categoryModel';
import { EMPTY_BUDGETS, setBudgetLimit, getBudgetLimitByName } from './utils/budgetModel';
import { formatMoney, parseMoneyInput } from './utils/money';
import { getCategoryBudgetInfo, getCardInvoiceStats, getTransactionCategoryLabel } from './utils/financeCalculations';
import { computeParcelaValue, computeParcelasPagas } from './utils/taskCalculations';
import { usePermissions } from './hooks/usePermissions';
import { useFinanceDerived } from './hooks/useFinanceDerived';
import LoadingView from './views/LoadingView';
import AuthView from './views/AuthView';
import AdminApp from './views/AdminApp';
import UserSettingsView from './views/UserSettingsView';
import ProjectSettingsView from './views/ProjectSettingsView';
import BudgetsView from './views/BudgetsView';
import ChatAssistant from './components/ChatAssistant';
import BudgetModal from './components/modals/BudgetModal';
import ProjectModal from './components/modals/ProjectModal';
import DeleteProjectModal from './components/modals/DeleteProjectModal';
import TaskModal from './components/modals/TaskModal';
import PaymentModal from './components/modals/PaymentModal';
import { useChatAssistant } from './hooks/useChatAssistant';
import MainShell from './views/MainShell';
import TasksView from './views/TasksView';
import FinancialCalendarView from './views/FinancialCalendarView';
import SubscriptionsView from './views/SubscriptionsView';
import ActivityFeedView from './views/ActivityFeedView';
import SavingsSimulatorView from './views/SavingsSimulatorView';
import FamilyModeView from './views/FamilyModeView';
import CashFlowForecastView from './views/CashFlowForecastView';
import PeriodComparisonView from './views/PeriodComparisonView';
import FinancialLeaksView from './views/FinancialLeaksView';
import { buildCashFlowForecast } from './utils/cashFlowForecast.js';
import { comparePeriods, getPeriodPreset } from './utils/periodComparison.js';
import { detectFinancialLeaks, buildLeakReport } from './utils/financialLeakDetector.js';
import { logActivity, ACTIVITY_TYPES } from './utils/activityLog.js';
import { DEFAULT_FAMILY_CONFIG } from './constants/projectTypes.js';
import {
  getScopeKey,
  getScopeCache,
  addTransactionsToCache,
  updateTransactionInCache,
  removeTransactionsFromCache,
} from './utils/dataCache.js';
import { loadTransactionsForScope, loadTransactionsForImportWindow } from './utils/transactionLoader.js';

const FirestoreUsageDebugPanel = import.meta.env.DEV
  ? lazy(() => import('./components/dev/FirestoreUsageDebugPanel.jsx'))
  : null;

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
  const [editingTransactionId, setEditingTransactionId] = useState(null);
  const [transactionDate, setTransactionDate] = useState(() => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  });

  // --------- STATE: CUSTOM CATEGORIES ---------
  const [customCategories, setCustomCategories] = useState({ expense: [], income: [], classifications: {}, classificationsById: {} });
  const [showCatManager, setShowCatManager] = useState(false);
  const [newCatName, setNewCatName]  = useState('');
  const [newCatType, setNewCatType]  = useState('expense');
  const [newCatClassification, setNewCatClassification] = useState('wants');
  const [catSaving, setCatSaving]    = useState(false);

  const expenseCategories = mergeCategoryNames(DEFAULT_EXPENSE_CATS, customCategories.expense);
  const incomeCategories  = mergeCategoryNames(DEFAULT_INCOME_CATS, customCategories.income);
  const classificationsByName = useMemo(
    () => getClassificationsByName(customCategories),
    [customCategories]
  );

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
  const [budgets, setBudgets] = useState({ ...EMPTY_BUDGETS });
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

  // --------- STATE: PROJECTS / TABS ---------
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null); // null = Geral
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectType, setNewProjectType] = useState('default');
  const [projectTypeInput, setProjectTypeInput] = useState('default');
  const [familyConfigInput, setFamilyConfigInput] = useState({ ...DEFAULT_FAMILY_CONFIG });
  const [projectToDelete, setProjectToDelete] = useState(null); // { id, name } or null
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
  const [taskCommentInput, setTaskCommentInput] = useState('');
  const [taskCommentSaving, setTaskCommentSaving] = useState(false);
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
        setBudgets({ ...EMPTY_BUDGETS });
        setCustomCategories({ expense: [], income: [], classifications: {} });
        setCreditCards([]);
      }
    });

    return () => unsubscribe();
  }, []);

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
    getProjectTasks(activeProjectId)
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

  // Fetch user data when currentUser or activeProjectId or projects changes.
  // Não depende de `transactions` para evitar loops de reload.
  useEffect(() => {
    const fetchData = async () => {
       if (!currentUser) return;
       setDataLoading(true);
       try {
         let budgetOwnerId = currentUser.uid;
         const activeProject = activeProjectId
           ? projects.find((p) => p.id === activeProjectId)
           : null;
         if (activeProject) budgetOwnerId = activeProject.userId;
         const categoryOwnerId = budgetOwnerId;

         const txs = await loadTransactionsForScope({
           userId: currentUser.uid,
           projectId: activeProjectId || null,
           monthsBack: 18,
         });
         setTransactions(txs);

         const userBudgets = await getUserBudgets(budgetOwnerId, activeProjectId);
         setBudgets(userBudgets);

         const cats = await getUserCategories(categoryOwnerId);
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
  }, [currentUser?.uid, currentUser?.role, activeProjectId, projects]);

  // RECURRING TRANSACTIONS: persiste clones faltantes no Firestore.
  // Depende apenas de transactions.length, não do array inteiro.
  useEffect(() => {
    if (!currentUser || currentUser.role === 'admin' || dataLoading) return;

    const runRecurrences = async () => {
      try {
        const created = await persistMissingRecurrences({
          userId: currentUser.uid,
          transactions,
          projectId: activeProjectId,
        });
        if (created.length > 0) {
          const scopeKey = getScopeKey(currentUser.uid, activeProjectId);
          const cache = getScopeCache(scopeKey);
          setTransactions(addTransactionsToCache(cache, created));
        }
      } catch (error) {
        console.error('Erro ao gerar recorrências:', error);
      }
    };

    runRecurrences();
  }, [currentUser?.uid, currentUser?.role, dataLoading, activeProjectId, transactions.length]);


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
         await register(authEmail, authPassword, authFullName, authUsername);
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

  const toTransactionDateInput = (iso) => {
    const d = new Date(iso || Date.now());
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const resetTransactionForm = () => {
    setEditingTransactionId(null);
    setDescription('');
    setAmount('');
    setCategory('');
    setType('expense');
    setIsRecurring(false);
    setIsInstallment(false);
    setInstallmentTotal('2');
    setInstallmentCurrent('1');
    setPaymentMethod('avulsa');
    setSelectedCardId('');
    setShowCatManager(false);
    const now = new Date();
    const isCurrentPeriod = selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear();
    const dateRef = isCurrentPeriod ? now : new Date(selectedYear, selectedMonth - 1, 1, 12, 0, 0);
    setTransactionDate(toTransactionDateInput(dateRef.toISOString()));
  };

  const closeTransactionDrawer = () => {
    setShowTransactionDrawer(false);
    resetTransactionForm();
  };

  const openTransactionForEdit = (tx) => {
    if (!tx) return;
    setEditingTransactionId(tx.id);
    setDescription(tx.description || '');
    setAmount(formatMoney(tx.amount));
    setType(tx.type || 'expense');
    setCategory(getTransactionCategoryLabel(tx));
    setIsRecurring(!!tx.isRecurring);
    setIsInstallment(!!tx.isInstallment);
    setInstallmentTotal(String(tx.installments || 2));
    setInstallmentCurrent(String(tx.installmentNumber || 1));
    setPaymentMethod(tx.paymentMethod || 'avulsa');
    setSelectedCardId(tx.cardId || '');
    setTransactionDate(toTransactionDateInput(tx.date));
    setShowCatManager(false);
    setShowTransactionDrawer(true);
  };

  const handleSaveTransaction = async (e) => {
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
    const [year, month, day] = (transactionDate || '').split('-').map(Number);
    const dateObj = year && month && day
      ? new Date(year, month - 1, day, 12, 0, 0)
      : (selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear()
        ? now
        : new Date(selectedYear, selectedMonth - 1, 1, 12, 0, 0));
    
    const newTransaction = {
      description,
      amount: numericAmount,
      type,
      isRecurring: isRecurring && type === 'expense',
      date: dateObj.toISOString(),
      displayDate: dateObj.toLocaleDateString('pt-BR'),
      ...buildTransactionCategoryFields(category, type, customCategories),
    };

    if (type === 'expense') {
      newTransaction.paymentMethod = paymentMethod;
      if (paymentMethod === 'card') {
        newTransaction.cardId = selectedCardId;
      } else {
        newTransaction.cardId = null;
      }
      if (isInstallment) {
        newTransaction.isInstallment = true;
        newTransaction.installments = parseInt(installmentTotal, 10);
        newTransaction.installmentNumber = parseInt(installmentCurrent, 10);
      } else {
        newTransaction.isInstallment = false;
        newTransaction.installments = null;
        newTransaction.installmentNumber = null;
      }
    } else {
      newTransaction.isRecurring = false;
      newTransaction.isInstallment = false;
      newTransaction.paymentMethod = null;
      newTransaction.cardId = null;
      newTransaction.installments = null;
      newTransaction.installmentNumber = null;
    }
    
    try {
      if (editingTransactionId) {
        const existing = transactions.find((t) => t.id === editingTransactionId);
        const updatedPayload = {
          ...newTransaction,
          source: existing?.source,
          importBatchId: existing?.importBatchId,
          importedAt: existing?.importedAt,
          rawDescription: existing?.rawDescription,
          duplicateHash: existing?.duplicateHash,
        };
        const savedDoc = await updateTransaction(editingTransactionId, updatedPayload);
        const merged = { ...existing, ...savedDoc };
        const scopeKey = getScopeKey(currentUser.uid, activeProjectId);
        setTransactions(updateTransactionInCache(getScopeCache(scopeKey), merged));
        recordActivityRef.current(ACTIVITY_TYPES.TRANSACTION_UPDATED, savedDoc.id, {
          amount: numericAmount,
          categoryName: getTransactionCategoryLabel(merged),
          type,
          description,
        });
        closeTransactionDrawer();
        return;
      }

      const createdByName = currentUser?.username || currentUser?.displayName || currentUser?.email || currentUser?.uid;
      const savedDoc = await addTransaction({ ...newTransaction, createdByName }, activeProjectId);
      const scopeKey = getScopeKey(currentUser.uid, activeProjectId);
      setTransactions(addTransactionsToCache(getScopeCache(scopeKey), [savedDoc]));
      recordActivityRef.current(ACTIVITY_TYPES.TRANSACTION_CREATED, savedDoc.id, {
        amount: numericAmount,
        categoryName: getTransactionCategoryLabel(savedDoc),
        type,
      });
      closeTransactionDrawer();
    } catch(err) { 
      console.error('Erro ao salvar transação:', err);
      alert('Erro ao salvar transação.'); 
    }
  };

  const handleStatementImportBatch = async (rows) => {
    const createdByName =
      currentUser?.username || currentUser?.displayName || currentUser?.email || currentUser?.uid;

    const payloads = rows.map((row) => {
      const categoryFields = buildTransactionCategoryFields(
        row.category,
        row.type,
        customCategories
      );
      return { ...row, ...categoryFields, createdByName };
    });

    const { created, failed } = await addTransactionsBatch(payloads, activeProjectId);
    if (created.length) {
      const scopeKey = getScopeKey(currentUser.uid, activeProjectId);
      setTransactions(addTransactionsToCache(getScopeCache(scopeKey), created));
    }
    return { created, failed };
  };

  const fetchTransactionsForImportWindow = useCallback(async ({ startDate, endDate }) => {
    if (!currentUser?.uid) return [];
    return loadTransactionsForImportWindow({
      userId: currentUser.uid,
      projectId: activeProjectId || null,
      startDate,
      endDate,
      inMemoryTransactions: transactions,
    });
  }, [currentUser?.uid, activeProjectId, transactions]);

  const handleImportBatchComplete = async (batchPayload) => {
    const createdByName =
      currentUser?.username || currentUser?.displayName || currentUser?.email || currentUser?.uid;

    await saveImportBatch(batchPayload.importBatchId, {
      projectId: activeProjectId || null,
      type: batchPayload.type || 'statement',
      fileNames: batchPayload.fileNames || [],
      importedAt: batchPayload.importedAt,
      status: batchPayload.counts?.failed > 0 ? 'partial' : 'completed',
      counts: batchPayload.counts,
      importedTransactionIds: batchPayload.importedTransactionIds || [],
      importedInvoiceIds: batchPayload.importedInvoiceIds || [],
      failedRows: batchPayload.failedRows || [],
      skippedRows: batchPayload.skippedRows || [],
      createdByName,
      importFingerprint: batchPayload.importFingerprint || null,
      periodStart: batchPayload.periodStart || null,
      periodEnd: batchPayload.periodEnd || null,
      metadata: batchPayload.metadata || {},
    });

    recordActivityRef.current(ACTIVITY_TYPES.IMPORT_COMPLETED, batchPayload.importBatchId, {
      count: batchPayload.counts?.imported || 0,
      type: batchPayload.type || 'statement',
      fileNames: batchPayload.fileNames || [],
    });
  };

  const handleSaveInvoice = async (draft) => {
    const createdByName =
      currentUser?.username || currentUser?.displayName || currentUser?.email || currentUser?.uid;
    const importBatchId = crypto.randomUUID();
    const importedAt = new Date().toISOString();
    const issueDate = draft.issueDate
      ? new Date(`${draft.issueDate}T12:00:00`)
      : new Date();
    const categoryFields = buildTransactionCategoryFields(
      draft.category,
      'expense',
      customCategories
    );

    const invoicePayload = {
      issuerName: draft.issuerName,
      issuerDocument: draft.issuerDocument,
      accessKey: draft.accessKey,
      invoiceNumber: draft.invoiceNumber,
      series: draft.series,
      issueDate: issueDate.toISOString(),
      issueDateDisplay: issueDate.toLocaleDateString('pt-BR'),
      totalAmount: draft.totalAmount,
      items: draft.items || [],
      purchaseDescription: draft.purchaseDescription,
      type: 'expense',
      category: draft.category,
      notes: draft.notes || '',
      sourceFormat: draft.sourceFormat,
      importBatchId,
      extractedAt: importedAt,
      ...categoryFields,
      createdByName,
    };

    const savedInvoice = await savePurchaseInvoice(invoicePayload, activeProjectId);

    const savedTx = await addTransaction(
      {
        description: draft.purchaseDescription,
        amount: draft.totalAmount,
        type: 'expense',
        ...categoryFields,
        date: issueDate.toISOString(),
        displayDate: issueDate.toLocaleDateString('pt-BR'),
        paymentMethod: 'avulsa',
        source: 'invoice_import',
        importBatchId,
        importedAt,
        invoiceId: savedInvoice.id,
        createdByName,
      },
      activeProjectId
    );

    const scopeKey = getScopeKey(currentUser.uid, activeProjectId);
    setTransactions(addTransactionsToCache(getScopeCache(scopeKey), [savedTx]));

    await saveImportBatch(importBatchId, {
      projectId: activeProjectId || null,
      type: 'invoice',
      fileNames: draft.sourceFileName ? [draft.sourceFileName] : [],
      importedAt,
      status: 'completed',
      counts: {
        detected: 1,
        imported: 1,
        failed: 0,
        ignored: 0,
        duplicates: 0,
      },
      importedTransactionIds: [savedTx.id],
      importedInvoiceIds: [savedInvoice.id],
      failedRows: [],
      skippedRows: [],
      createdByName,
      metadata: { purchaseDescription: draft.purchaseDescription },
    });

    recordActivityRef.current(ACTIVITY_TYPES.IMPORT_COMPLETED, importBatchId, {
      count: 1,
      type: 'invoice',
      fileNames: draft.sourceFileName ? [draft.sourceFileName] : [],
    });

    return {
      ...savedInvoice,
      linkedTransactionId: savedTx.id,
      purchaseDescription: draft.purchaseDescription,
      totalAmount: draft.totalAmount,
    };
  };

  const handleUndoImport = async ({ importedIds, importBatchId, count }) => {
    if (!importedIds?.length) return;
    if (activeProjectId && !canDeleteInProject) {
      throw new Error('Você não tem permissão para desfazer importações neste projeto.');
    }
    await deleteTransactionsByIds(importedIds);
    const scopeKey = getScopeKey(currentUser.uid, activeProjectId);
    setTransactions(removeTransactionsFromCache(getScopeCache(scopeKey), importedIds));
    if (importBatchId) {
      await markImportBatchUndone(importBatchId);
    }
    recordActivityRef.current(ACTIVITY_TYPES.IMPORT_UNDONE, importBatchId || 'import-batch', {
      count: count || importedIds.length,
    });
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const proj = await createProject(newProjectName.trim(), newProjectType);
      setProjects(prev => [...prev, proj]);
      setShowProjectModal(false);
      setNewProjectName('');
      setNewProjectType('default');
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

  const openTaskModal = (task = null) => {
    const meta = Number(task?.metaValue) || 0;
    const parcelas = Number(task?.parcelas) || 0;
    const paid = Number(task?.paidAmount) || 0;
    const parcelaValue = computeParcelaValue(meta, parcelas);
    const parcelasPagas = computeParcelasPagas(paid, parcelaValue, parcelas);

    setTaskEditId(task ? task.id : null);
    setTaskTitleInput(task ? task.title : '');
    setTaskTypeInput(task?.type || 'tarefa');
    setTaskMetaValueInput(task?.metaValue != null && meta > 0 ? formatMoney(meta) : '');
    setTaskParcelasInput(parcelas > 0 ? String(parcelas) : '');
    setTaskParcelaValueInput(parcelaValue > 0 ? formatMoney(parcelaValue) : '');
    setTaskParcelasPaidInput(parcelasPagas > 0 ? String(parcelasPagas) : '');
    setTaskCommentInput('');
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
    setTaskCommentInput('');
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
      recordActivityRef.current(ACTIVITY_TYPES.TASK_PAYMENT, taskToPay.id, {
        amount,
        title: taskToPay.title,
      });
      closePaymentModal();
    } catch (err) {
      console.error('Erro ao registrar pagamento:', err);
      alert('Erro ao registrar pagamento.');
    } finally {
      setPaymentSaving(false);
    }
  };

  const editingTask = useMemo(
    () => (taskEditId ? tasks.find((t) => t.id === taskEditId) || null : null),
    [tasks, taskEditId]
  );

  const handleAddTaskComment = async () => {
    if (!taskEditId || !taskCommentInput.trim() || !canAddToProject) return;
    setTaskCommentSaving(true);
    try {
      const comments = await appendTaskComment(
        taskEditId,
        editingTask?.comments,
        taskCommentInput,
        currentUser?.username || currentUser?.displayName || currentUser?.email || currentUser?.uid
      );
      setTasks((prev) => prev.map((t) => (t.id === taskEditId ? { ...t, comments } : t)));
      setTaskCommentInput('');
    } catch (err) {
      console.error('Erro ao adicionar comentário:', err);
      alert('Erro ao adicionar comentário.');
    } finally {
      setTaskCommentSaving(false);
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
        recordActivityRef.current(ACTIVITY_TYPES.TASK_UPDATED, taskEditId, { title: payload.title });
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
        recordActivityRef.current(ACTIVITY_TYPES.TASK_CREATED, newTask.id, { title: payload.title });
        try {
          const updated = await getProjectTasks(activeProjectId);
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
      if (!task.completed) {
        recordActivityRef.current(ACTIVITY_TYPES.TASK_COMPLETED, task.id, { title: task.title });
      }
    } catch (err) { alert('Erro ao atualizar tarefa.'); }
  };

  const handleDeleteTask = async (taskId) => {
    const task = tasks.find((t) => t.id === taskId);
    try {
      await deleteTask(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      recordActivityRef.current(ACTIVITY_TYPES.TASK_DELETED, taskId, { title: task?.title });
    } catch (err) { alert('Erro ao excluir tarefa.'); }
  };

  const handleAcceptInvite = async (invite) => {
    try {
      await acceptInvite(invite.id);
      const list = await getUserProjects(currentUser.uid);
      setProjects(list);
      setInvites(prev => prev.filter(i => i.id !== invite.id));
      setShowNotificationsPanel(false);
      setActiveProjectId(invite.projectId);
      recordActivityRef.current(ACTIVITY_TYPES.INVITE_ACCEPTED, invite.projectId, {
        projectName: invite.projectName,
      }, invite.projectId);
      recordActivityRef.current(ACTIVITY_TYPES.COLLABORATOR_JOINED, invite.projectId, {}, invite.projectId);
    } catch (err) {
      alert(err.message || 'Erro ao aceitar convite.');
    }
  };

  const handleRejectInvite = async (inviteId) => {
    const invite = invites.find((i) => i.id === inviteId);
    try {
      await rejectInvite(inviteId);
      setInvites(prev => prev.filter(i => i.id !== inviteId));
      recordActivityRef.current(ACTIVITY_TYPES.INVITE_REJECTED, invite?.projectId || inviteId, {
        projectName: invite?.projectName,
      }, invite?.projectId || null);
    } catch (err) {
      alert(err.message || 'Erro ao rejeitar.');
    }
  };

  const handleDelete = async (id) => {
     const tx = transactions.find((t) => t.id === id);
     try {
       await deleteTransaction(id);
       const scopeKey = getScopeKey(currentUser.uid, activeProjectId);
       setTransactions(removeTransactionsFromCache(getScopeCache(scopeKey), [id]));
       recordActivityRef.current(ACTIVITY_TYPES.TRANSACTION_DELETED, id, {
         description: tx?.description,
       });
     } catch (err) { 
       console.error(err);
       alert('Erro ao deletar');
     }
  };


  // --------- DATA CALCULATIONS (hooks + utils) ---------

  const { activeProjectRole, canAddToProject, canDeleteInProject, canManageProject } = usePermissions({
    activeProjectId,
    projects,
    currentUserId: currentUser?.uid,
  });

  const recordActivityRef = useRef(() => {});

  const activeProject = useMemo(
    () => (activeProjectId ? projects.find((p) => p.id === activeProjectId) || null : null),
    [projects, activeProjectId]
  );

  recordActivityRef.current = (type, entityId, metadata = {}, overrideProjectId = undefined) => {
    if (!currentUser) return;
    const projectId = overrideProjectId !== undefined ? overrideProjectId : (activeProjectId || null);
    const project = projectId ? projects.find((p) => p.id === projectId) : activeProject;
    const ownerId = project?.userId ?? currentUser.uid;
    logActivity({
      userId: ownerId,
      projectId,
      actorUid: currentUser.uid,
      actorName: currentUser.username || currentUser.displayName || currentUser.email || currentUser.uid,
      type,
      entityId,
      metadata,
    }).catch(console.error);
  };

  const openTransactionDrawerForDate = (dateOrTx) => {
    if (dateOrTx?.id) {
      openTransactionForEdit(dateOrTx);
      return;
    }
    resetTransactionForm();
    if (dateOrTx instanceof Date) {
      setTransactionDate(toTransactionDateInput(dateOrTx.toISOString()));
      setSelectedMonth(dateOrTx.getMonth() + 1);
      setSelectedYear(dateOrTx.getFullYear());
    } else if (dateOrTx && typeof dateOrTx === 'object') {
      const raw = dateOrTx.date || dateOrTx.createdAt;
      if (raw) {
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime())) {
          setTransactionDate(toTransactionDateInput(d.toISOString()));
          setSelectedMonth(d.getMonth() + 1);
          setSelectedYear(d.getFullYear());
        }
      }
    }
    setShowTransactionDrawer(true);
  };

  const openCardDetails = () => {
    setCurrentView('budgets');
    setBudgetsSubTab('cards');
  };

  const canEditSubscriptions = !activeProjectId || canDeleteInProject;
  const isFamilyProject = activeProject?.projectType === 'family';

  const categoryOwnerId = useMemo(
    () => activeProject?.userId ?? currentUser?.uid ?? null,
    [activeProject, currentUser]
  );

  const canEditCategories = !activeProjectId || canManageProject;

  const {
    filteredTransactions,
    totalIncome,
    totalExpense,
    balance,
    categoryStats,
    monthlyEvolutionData,
    totalBudgetLimit,
    budgetStats,
    ruleStats,
    calculateForecast,
  } = useFinanceDerived({
    transactions,
    budgets,
    selectedMonth,
    selectedYear,
    expenseCategories,
    classifications: classificationsByName,
    customCategories,
  });

  const getCategoryBudgetInfoForCat = useCallback((catName, currentSpent) => {
    const { categoryId } = resolveCategoryForTransaction(catName, 'expense', customCategories);
    return getCategoryBudgetInfo(budgets, catName, currentSpent, categoryId);
  }, [budgets, customCategories]);

  const getCardInvoiceStatsForCard = (card, transactionsList) =>
    getCardInvoiceStats(card, transactionsList, selectedMonth, selectedYear);

  const hubAnalytics = useMemo(() => {
    const cashFlow = buildCashFlowForecast({
      transactions,
      creditCards,
      monthsAhead: 3,
    });
    const comparisonPreset = getPeriodPreset('month_vs_previous', new Date(selectedYear, selectedMonth - 1, 15));
    const comparison = comparePeriods({
      transactions,
      periodA: comparisonPreset.periodA,
      periodB: comparisonPreset.periodB,
      budgets,
      expenseCategories,
      customCategories,
      creditCards,
      tasks,
    });
    const leaks = buildLeakReport(detectFinancialLeaks({
      transactions,
      month: selectedMonth,
      year: selectedYear,
      referenceDate: new Date(selectedYear, selectedMonth - 1, 15),
    }));
    return {
      nextBalance: cashFlow.months[0]?.projectedBalance ?? 0,
      nextMonthLabel: cashFlow.months[0]?.label ?? '',
      incomeChangePct: comparison.summary.income.percent,
      expenseChangePct: comparison.summary.expense.percent,
      topLeak: leaks.biggestIncrease,
    };
  }, [transactions, creditCards, budgets, expenseCategories, customCategories, tasks, selectedMonth, selectedYear]);

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
      getTransactionCategoryLabel(t),
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
  // --------- HELPERS ---------
  const handleBudgetChange = (catName) => {
    const currentLimit = getBudgetLimitByName(budgets, catName);
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
    const { categoryId } = resolveCategoryForTransaction(activeBudgetCat, 'expense', customCategories);
    const newBudgets = setBudgetLimit(budgets, activeBudgetCat, categoryId, finalVal);

    try {
       const budgetOwnerId = activeProject?.userId ?? currentUser?.uid;
       await saveUserBudgets(newBudgets, activeProjectId, budgetOwnerId);
       setBudgets(newBudgets);
       setBudgetModalOpen(false);
       recordActivityRef.current(ACTIVITY_TYPES.BUDGET_UPDATED, categoryId, {
         categoryName: activeBudgetCat,
         amount: finalVal,
       });
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
       const label = getTransactionCategoryLabel(t);
       catAnalysis[label] = (catAnalysis[label] || 0) + t.amount;
    });
    
    const sortedCats = Object.entries(catAnalysis).sort((a, b) => b[1] - a[1]);
    const topCategory = sortedCats.length > 0 ? sortedCats[0][0] : 'Nenhuma';

    return { month, year, income, expense, balance: income - expense, topCategory };
  };

  const generateMonthlyInsight = async (month, year) => {
    if (!currentUser) return null;
    
    // 1. Check Cache
    const cached = await getCachedInsight(currentUser.uid, month, year, activeProjectId);
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
    await saveInsightToCache(currentUser.uid, month, year, insight, activeProjectId);
    
    return insight;
  };

  // --------- CUSTOM CATEGORIES HANDLERS ---------
  const handleAddCustomCategory = async () => {
    const name = newCatName.trim();
    if (!name || !currentUser) return;
    if (!canEditCategories) {
      alert('Apenas o dono do projeto pode alterar categorias compartilhadas.');
      return;
    }
    const allForType = newCatType === 'expense' ? expenseCategories : incomeCategories;
    if (allForType.map(c => c.toLowerCase()).includes(name.toLowerCase())) {
      alert('Esta categoria já existe.');
      return;
    }
    const updated = {
      expense: [...customCategories.expense],
      income: [...customCategories.income],
      classifications: { ...customCategories.classifications },
      classificationsById: { ...(customCategories.classificationsById || {}) },
    };
    const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
    const item = createCategoryItem(formattedName, newCatType);
    updated[newCatType].push(item);
    if (newCatType === 'expense') {
      updated.classifications[formattedName] = newCatClassification;
      updated.classificationsById[item.id] = newCatClassification;
    }
    setCatSaving(true);
    try {
      await saveUserCategories(categoryOwnerId, updated);
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
    if (!canEditCategories) {
      alert('Apenas o dono do projeto pode alterar categorias compartilhadas.');
      return;
    }
    const updatedClassifications = { ...customCategories.classifications };
    delete updatedClassifications[catName];
    const updated = {
      expense: customCategories.expense.filter((c) => (typeof c === 'string' ? c : c.name) !== catName),
      income: customCategories.income.filter((c) => (typeof c === 'string' ? c : c.name) !== catName),
      classifications: updatedClassifications,
      classificationsById: Object.fromEntries(
        Object.entries(customCategories.classificationsById || {}).filter(([id]) => {
          const item = [...customCategories.expense, ...customCategories.income].find((c) => c.id === id);
          return item ? item.name !== catName : true;
        })
      ),
    };
    if (category === catName) setCategory('');
    try {
      await saveUserCategories(categoryOwnerId, updated);
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
      recordActivityRef.current(ACTIVITY_TYPES.CARD_CREATED, savedCard.id, { name });
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
    const card = creditCards.find((c) => c.id === cardId);
    if (!window.confirm('Tem certeza de que deseja remover este cartão? As despesas associadas a ele continuarão existindo, mas perderão a associação com o cartão.')) {
      return;
    }
    try {
      await deleteCreditCard(cardId);
      setCreditCards(creditCards.filter(c => c.id !== cardId));
      if (selectedCardId === cardId) setSelectedCardId('');
      recordActivityRef.current(ACTIVITY_TYPES.CARD_DELETED, cardId, { name: card?.name });
    } catch (err) {
      console.error('Erro ao deletar cartão:', err);
      alert('Erro ao excluir cartão de crédito.');
    }
  };

  const chatContext = useMemo(() => ({
    balance,
    totalExpense,
    totalIncome,
    categoryStats,
    calculateForecast,
    expenseCategories,
    customCategories,
    getCategoryBudgetInfoForCat,
  }), [
    balance,
    totalExpense,
    totalIncome,
    categoryStats,
    calculateForecast,
    expenseCategories,
    customCategories,
    getCategoryBudgetInfoForCat,
  ]);

  const chatAssistant = useChatAssistant({
    chatContext,
    selectedMonth,
    selectedYear,
    generateMonthlyInsight,
    transactions,
    setTransactions,
    customCategories,
    activeProjectId,
    calculateForecast,
  });

  const { pushBotMessage } = chatAssistant;

  useEffect(() => {
    if (!currentUser || transactions.length === 0 || dataLoading) return undefined;
    const checkInsight = async () => {
      const today = new Date();
      const currentM = today.getMonth() + 1;
      const currentY = today.getFullYear();
      const lastCheck = localStorage.getItem(`karonte_last_insight_${currentUser.uid}`);
      if (lastCheck && lastCheck === `${currentM}_${currentY}`) return;
      const prevDate = new Date();
      prevDate.setMonth(today.getMonth() - 1);
      const insight = await generateMonthlyInsight(prevDate.getMonth() + 1, prevDate.getFullYear());
      if (insight) {
        pushBotMessage(insight);
        localStorage.setItem(`karonte_last_insight_${currentUser.uid}`, `${currentM}_${currentY}`);
      }
    };
    checkInsight();
    return undefined;
  }, [currentUser, transactions.length, dataLoading, generateMonthlyInsight, pushBotMessage]);

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setTaskToPay(null);
    setPaymentAmountInput('');
    setPaymentParcelasInput('');
  };

  // ================= VIEWS =================

  if (authLoading) {
    return <LoadingView />;
  }

  if (!currentUser) {
    return (
      <AuthView
        authMode={authMode}
        authFullName={authFullName}
        authUsername={authUsername}
        authEmail={authEmail}
        authPassword={authPassword}
        authConfirmPassword={authConfirmPassword}
        authError={authError}
        onSubmit={handleAuth}
        onFullNameChange={setAuthFullName}
        onUsernameChange={setAuthUsername}
        onEmailChange={setAuthEmail}
        onPasswordChange={setAuthPassword}
        onConfirmPasswordChange={setAuthConfirmPassword}
        onToggleMode={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }}
      />
    );
  }

  if (currentUser.role === 'admin') {
    return (
      <AdminApp
        theme={theme}
        users={users}
        currentUser={currentUser}
        editingUserId={editingUserId}
        editingValue={editingValue}
        resetSentId={resetSentId}
        adminOwnPassVisible={adminOwnPassVisible}
        adminOwnPassInput={adminOwnPassInput}
        adminOwnPassMsg={adminOwnPassMsg}
        onToggleTheme={toggleTheme}
        onToggleOwnPassForm={() => { setAdminOwnPassVisible((v) => !v); setAdminOwnPassMsg(''); }}
        onOwnPassInputChange={setAdminOwnPassInput}
        onChangeOwnPassword={handleChangeOwnPassword}
        onLogout={handleLogout}
        onStartEditUsername={handleStartEditUsername}
        onSaveUsername={handleSaveUsername}
        onCancelEditUsername={() => setEditingUserId(null)}
        onEditingValueChange={setEditingValue}
        onSendPasswordReset={handleSendPasswordReset}
        onToggleUserStatus={handleToggleUserStatus}
      />
    );
  }

  // View: USER MAIN LAYOUT
  return (
    <>
      <MainShell
        theme={theme}
        currentUser={currentUser}
        projects={projects}
        activeProjectId={activeProjectId}
        activeProjectName={activeProject?.name}
        isFamilyProject={isFamilyProject}
        currentView={currentView}
        canAddToProject={canAddToProject}
        showProjectDropdown={showProjectDropdown}
        onToggleProjectDropdown={() => setShowProjectDropdown((prev) => !prev)}
        onSelectProject={(id) => {
          setActiveProjectId(id);
          setShowProjectDropdown(false);
        }}
        onOpenProjectSettings={(projectId) => {
          const proj = projects.find((p) => p.id === projectId);
          setProjectSettingsId(projectId);
          setRenameProjectValue(proj?.name || '');
          setProjectTypeInput(proj?.projectType || 'default');
          setFamilyConfigInput({ ...DEFAULT_FAMILY_CONFIG, ...(proj?.familyConfig || {}) });
          setCurrentView('projectSettings');
          setShowProjectDropdown(false);
        }}
        onNewProject={() => {
          setShowProjectModal(true);
          setShowProjectDropdown(false);
        }}
        showProfilePopover={showProfilePopover}
        onToggleProfilePopover={(value) => {
          if (typeof value === 'boolean') setShowProfilePopover(value);
          else setShowProfilePopover((prev) => !prev);
        }}
        onNavigate={setCurrentView}
        onOpenTransactionDrawer={() => { resetTransactionForm(); setShowTransactionDrawer(true); }}
        onLogout={handleLogout}
        onToggleTheme={toggleTheme}
        invites={invites}
        notifications={notifications}
        showNotificationsPanel={showNotificationsPanel}
        onToggleNotificationsPanel={() => setShowNotificationsPanel((prev) => !prev)}
        onAcceptInvite={handleAcceptInvite}
        onRejectInvite={handleRejectInvite}
        onMarkNotificationRead={(id) => markNotificationRead(id).then(() => setNotifications((prev) => prev.map((x) => (x.id === id ? { ...x, read: true } : x))))}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onMonthChange={setSelectedMonth}
        onYearChange={setSelectedYear}
        hasExportableTransactions={filteredTransactions.length > 0}
        onExportCSV={exportToCSV}
      >
        {currentView === 'userSettings' && (
          <UserSettingsView currentUser={currentUser} onBack={() => setCurrentView('hub')} />
        )}

        {currentView === 'projectSettings' && projectSettingsId && (
          <ProjectSettingsView
            project={projects.find((p) => p.id === projectSettingsId)}
            currentUser={currentUser}
            renameProjectValue={renameProjectValue}
            projectTypeValue={projectTypeInput}
            familyConfigValue={familyConfigInput}
            inviteEmailInput={inviteEmailInput}
            inviteRoleInput={inviteRoleInput}
            inviteSending={inviteSending}
            canManageProject={canManageProject}
            onRenameValueChange={setRenameProjectValue}
            onProjectTypeChange={setProjectTypeInput}
            onFamilyConfigChange={(patch) => setFamilyConfigInput((prev) => ({ ...prev, ...patch }))}
            onSaveProjectType={() => {
              const proj = projects.find((p) => p.id === projectSettingsId);
              if (!proj || !canManageProject) return;
              const payload = { projectType: projectTypeInput };
              if (projectTypeInput === 'family') {
                payload.familyConfig = { ...DEFAULT_FAMILY_CONFIG, ...familyConfigInput };
              }
              updateProject(proj.id, payload)
                .then(() => {
                  setProjects((prev) => prev.map((p) => (p.id === proj.id ? { ...p, ...payload } : p)));
                  alert('Tipo do projeto atualizado.');
                })
                .catch(() => alert('Erro ao salvar tipo do projeto.'));
            }}
            onSaveName={() => {
              const proj = projects.find((p) => p.id === projectSettingsId);
              if (!proj || !renameProjectValue.trim()) return;
              updateProject(proj.id, { name: renameProjectValue.trim() })
                .then(() => {
                  setProjects((prev) => prev.map((p) => (p.id === proj.id ? { ...p, name: renameProjectValue.trim() } : p)));
                })
                .catch(() => alert('Erro ao renomear projeto.'));
            }}
            onSaveCollaboratorName={(uid, val) => {
              const proj = projects.find((p) => p.id === projectSettingsId);
              if (!proj) return;
              const namesMap = proj.collaboratorNames || {};
              updateProject(proj.id, { collaboratorNames: { ...namesMap, [uid]: val } })
                .then(() => {
                  setProjects((prev) => prev.map((p) => (p.id === proj.id ? { ...p, collaboratorNames: { ...(p.collaboratorNames || {}), [uid]: val } } : p)));
                })
                .catch(() => alert('Erro ao salvar nome do colaborador.'));
            }}
            onUpdateCollaboratorRole={(uid, newRole) => {
              const proj = projects.find((p) => p.id === projectSettingsId);
              if (!proj) return;
              const rolesMap = proj.collaboratorRoles || {};
              updateProject(proj.id, { collaboratorRoles: { ...rolesMap, [uid]: newRole } })
                .then(() => {
                  setProjects((prev) => prev.map((p) => (p.id === proj.id ? { ...p, collaboratorRoles: { ...(p.collaboratorRoles || {}), [uid]: newRole } } : p)));
                })
                .catch(() => alert('Erro ao atualizar permissão.'));
            }}
            onRemoveCollaborator={(uid) => {
              const proj = projects.find((p) => p.id === projectSettingsId);
              if (!proj) return;
              const rolesMap = proj.collaboratorRoles || {};
              const namesMap = proj.collaboratorNames || {};
              const { [uid]: _, ...restRoles } = rolesMap;
              const { [uid]: __, ...restNames } = namesMap;
              const newCollabs = (proj.collaborators || []).filter((id) => id !== uid);
              updateProject(proj.id, { collaborators: newCollabs, collaboratorRoles: restRoles, collaboratorNames: restNames })
                .then(() => {
                  setProjects((prev) => prev.map((p) => (p.id === proj.id ? { ...p, collaborators: newCollabs, collaboratorRoles: restRoles, collaboratorNames: restNames } : p)));
                })
                .catch(() => alert('Erro ao remover colaborador.'));
            }}
            onInviteEmailChange={setInviteEmailInput}
            onInviteRoleChange={setInviteRoleInput}
            onSendInvite={() => {
              const proj = projects.find((p) => p.id === projectSettingsId);
              if (!proj || !inviteEmailInput.trim()) return;
              const email = inviteEmailInput.trim();
              setInviteSending(true);
              createInvite(proj.id, proj.name, email, inviteRoleInput)
                .then(() => {
                  setInviteEmailInput('');
                  recordActivityRef.current(ACTIVITY_TYPES.INVITE_SENT, proj.id, {
                    toEmail: email,
                    projectName: proj.name,
                  }, proj.id);
                  alert('Convite enviado.');
                })
                .catch((err) => alert(err.message || 'Erro ao enviar convite.'))
                .finally(() => setInviteSending(false));
            }}
            onDeleteProject={() => {
              const proj = projects.find((p) => p.id === projectSettingsId);
              if (proj) setProjectToDelete({ id: proj.id, name: proj.name });
            }}
            onBack={() => { setProjectSettingsId(null); setCurrentView('hub'); }}
          />
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
            getCategoryBudgetInfo={getCategoryBudgetInfoForCat}
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
            onAddClick={() => { resetTransactionForm(); setShowTransactionDrawer(true); }}
            onEdit={openTransactionForEdit}
            onDelete={handleDelete}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            isFamilyProject={isFamilyProject}
            onOpenFamily={() => setCurrentView('family')}
            hubAnalytics={hubAnalytics}
            onNavigateToView={setCurrentView}
          />
        )}

        {currentView === 'cashflow' && (
          <CashFlowForecastView
            transactions={transactions}
            creditCards={creditCards}
            formatMoney={formatMoney}
            chartTheme={chartTheme}
            chartTooltipStyle={chartTooltipStyle}
            activeProjectId={activeProjectId}
          />
        )}

        {currentView === 'comparison' && (
          <PeriodComparisonView
            transactions={transactions}
            budgets={budgets}
            expenseCategories={expenseCategories}
            customCategories={customCategories}
            creditCards={creditCards}
            tasks={tasks}
            formatMoney={formatMoney}
            chartTheme={chartTheme}
            chartTooltipStyle={chartTooltipStyle}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            activeProjectId={activeProjectId}
          />
        )}

        {currentView === 'leaks' && (
          <FinancialLeaksView
            transactions={transactions}
            formatMoney={formatMoney}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            activeProjectId={activeProjectId}
          />
        )}

        {currentView === 'simulator' && (
          <SavingsSimulatorView
            transactions={transactions}
            expenseCategories={expenseCategories}
            totalIncome={totalIncome}
            totalExpense={totalExpense}
            currentUser={currentUser}
            activeProjectId={activeProjectId}
            formatMoney={formatMoney}
          />
        )}

        {currentView === 'family' && (
          <FamilyModeView
            activeProject={activeProject}
            currentUser={currentUser}
            filteredTransactions={filteredTransactions}
            transactions={transactions}
            budgets={budgets}
            expenseCategories={expenseCategories}
            tasks={tasks}
            formatMoney={formatMoney}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onOpenTasks={() => setCurrentView('tarefas')}
          />
        )}

       
        {currentView === 'budgets' && (
          <BudgetsView
            budgetsSubTab={budgetsSubTab}
            onSubTabChange={setBudgetsSubTab}
            expenseCategories={expenseCategories}
            filteredTransactions={filteredTransactions}
            formatMoney={formatMoney}
            getCategoryBudgetInfo={getCategoryBudgetInfoForCat}
            getCatFill={getCatFill}
            getCatTrack={getCatTrack}
            onBudgetChange={handleBudgetChange}
            creditCards={creditCards}
            transactions={transactions}
            getCardInvoiceStats={getCardInvoiceStatsForCard}
            onDeleteCreditCard={handleDeleteCreditCard}
            newCardName={newCardName}
            newCardLimit={newCardLimit}
            newCardClosingDay={newCardClosingDay}
            newCardDueDay={newCardDueDay}
            cardSavingActive={cardSavingActive}
            onNewCardNameChange={setNewCardName}
            onNewCardLimitChange={setNewCardLimit}
            onNewCardClosingDayChange={setNewCardClosingDay}
            onNewCardDueDayChange={setNewCardDueDay}
            onCreateCreditCard={handleCreateCreditCard}
            onTaskMoneyInput={handleTaskMoneyInput}
          />
        )}

        {currentView === 'import' && (
          <Suspense fallback={<main className="main-content"><div className="card" style={{ padding: '2rem', textAlign: 'center' }}>Carregando importação…</div></main>}>
            <ImportHubView
              currentUser={currentUser}
              activeProjectId={activeProjectId}
              activeProject={activeProject}
              transactions={transactions}
              expenseCategories={expenseCategories}
              incomeCategories={incomeCategories}
              customCategories={customCategories}
              canAddToProject={canAddToProject}
              canDeleteInProject={canDeleteInProject}
              onImportTransactionsBatch={handleStatementImportBatch}
              fetchTransactionsForImportWindow={fetchTransactionsForImportWindow}
              onImportBatchComplete={handleImportBatchComplete}
              onUndoImport={handleUndoImport}
              onSaveInvoice={handleSaveInvoice}
              formatMoney={formatMoney}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
            />
          </Suspense>
        )}

        {currentView === 'tarefas' && (
          <TasksView
            activeProjectId={activeProjectId}
            canAddToProject={canAddToProject}
            canDeleteInProject={canDeleteInProject}
            tasks={tasks}
            tasksLoading={tasksLoading}
            tasksTab={tasksTab}
            tasksSort={tasksSort}
            sortedAndFilteredTasks={sortedAndFilteredTasks}
            formatMoney={formatMoney}
            onTasksTabChange={setTasksTab}
            onTasksSortChange={setTasksSort}
            onOpenTaskModal={openTaskModal}
            onToggleTaskComplete={handleToggleTaskComplete}
            onOpenPaymentModal={openPaymentModal}
            onDeleteTask={handleDeleteTask}
          />
        )}

        {currentView === 'calendar' && (
          <FinancialCalendarView
            transactions={filteredTransactions}
            creditCards={creditCards}
            tasks={tasks}
            currentUser={currentUser}
            activeProjectId={activeProjectId}
            formatMoney={formatMoney}
            canAddToProject={canAddToProject}
            onOpenTransactionForDate={openTransactionDrawerForDate}
            onOpenTaskModal={openTaskModal}
            onOpenCardDetails={openCardDetails}
            initialMonth={selectedMonth}
            initialYear={selectedYear}
          />
        )}

        {currentView === 'subscriptions' && (
          <SubscriptionsView
            transactions={filteredTransactions}
            currentUser={currentUser}
            activeProjectId={activeProjectId}
            formatMoney={formatMoney}
            canManageProject={canEditSubscriptions}
            customCategories={customCategories}
          />
        )}

        {currentView === 'activity' && (
          <ActivityFeedView
            currentUser={currentUser}
            activeProjectId={activeProjectId}
            activeProject={activeProject}
          />
        )}
      </MainShell>

      <ChatAssistant {...chatAssistant} />

      {FirestoreUsageDebugPanel ? (
        <Suspense fallback={null}>
          <FirestoreUsageDebugPanel />
        </Suspense>
      ) : null}

      <BudgetModal
        open={budgetModalOpen}
        categoryName={activeBudgetCat}
        value={budgetInputValue}
        onValueChange={setBudgetInputValue}
        onClose={() => setBudgetModalOpen(false)}
        onConfirm={handleConfirmBudget}
      />

      <TransactionDrawer
        open={showTransactionDrawer}
        onClose={closeTransactionDrawer}
        onSubmit={handleSaveTransaction}
        isEdit={!!editingTransactionId}
        transactionDate={transactionDate}
        setTransactionDate={setTransactionDate}
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
        canEditCategories={canEditCategories}
      />

      <ProjectModal
        open={showProjectModal}
        projectName={newProjectName}
        projectType={newProjectType}
        onProjectNameChange={setNewProjectName}
        onProjectTypeChange={setNewProjectType}
        onClose={() => setShowProjectModal(false)}
        onConfirm={handleCreateProject}
      />

      <DeleteProjectModal
        project={projectToDelete}
        onClose={() => setProjectToDelete(null)}
        onConfirm={handleConfirmDeleteProject}
      />

      <TaskModal
        open={showTaskModal}
        isEdit={!!taskEditId}
        title={taskTitleInput}
        type={taskTypeInput}
        metaValue={taskMetaValueInput}
        parcelaValue={taskParcelaValueInput}
        parcelas={taskParcelasInput}
        parcelasPaid={taskParcelasPaidInput}
        saving={taskSaving}
        comments={editingTask?.comments || []}
        commentInput={taskCommentInput}
        commentSaving={taskCommentSaving}
        canAddComments={canAddToProject}
        currentUserId={currentUser?.uid}
        onCommentInputChange={setTaskCommentInput}
        onAddComment={handleAddTaskComment}
        onTitleChange={setTaskTitleInput}
        onTypeChange={setTaskTypeInput}
        onMetaValueChange={setTaskMetaValueInput}
        onParcelaValueChange={setTaskParcelaValueInput}
        onParcelasChange={setTaskParcelasInput}
        onParcelasPaidChange={setTaskParcelasPaidInput}
        onMoneyInput={handleTaskMoneyInput}
        onClose={closeTaskModal}
        onSave={handleSaveTask}
      />

      <PaymentModal
        open={showPaymentModal}
        task={taskToPay}
        mode={paymentMode}
        amountInput={paymentAmountInput}
        parcelasInput={paymentParcelasInput}
        saving={paymentSaving}
        onModeChange={setPaymentMode}
        onAmountChange={setPaymentAmountInput}
        onParcelasInputChange={setPaymentParcelasInput}
        onMoneyInput={handleTaskMoneyInput}
        onClose={closePaymentModal}
        onConfirm={handleAddPayment}
      />
    </>
  );
}

export default function AppWrapper() {
  return (
    <ErrorBoundary>
       <App />
    </ErrorBoundary>
  )
}
