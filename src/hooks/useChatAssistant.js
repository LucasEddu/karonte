import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { processChatMessage as parseChatMessage } from '../utils/chatParser';
import { formatMoney } from '../utils/money';
import { buildTransactionCategoryFields } from '../utils/categoryModel';
import { addTransaction } from '../services/transactionService';

const hasSpeechSupport = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

const loadFabPosition = () => {
  if (typeof window === 'undefined') return { x: 0, y: 0 };
  try {
    const stored = localStorage.getItem('karonte_fab_pos');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') return parsed;
    }
  } catch {
    // ignore
  }
  return {
    x: window.innerWidth - 30 - 56,
    y: window.innerHeight - 30 - 56,
  };
};

export function useChatAssistant({
  chatContext,
  selectedMonth,
  selectedYear,
  generateMonthlyInsight,
  transactions,
  setTransactions,
  customCategories,
  activeProjectId,
  calculateForecast,
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatMessages, setChatMessages] = useState([
    { id: 'welcome', sender: 'bot', text: 'Olá! Sou seu assistente. Me mande algo como "cinema 50" ou me pergunte "qual meu saldo?".' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [pendingActions, setPendingActions] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [fabPosition, setFabPosition] = useState(loadFabPosition);
  const [isDraggingFab, setIsDraggingFab] = useState(false);

  const recognitionRef = useRef(null);
  const fabOffsetRef = useRef({ x: 0, y: 0 });
  const fabButtonRef = useRef(null);
  const chatWindowRef = useRef(null);
  const chatInputRef = useRef('');

  useEffect(() => {
    chatInputRef.current = chatInput;
  }, [chatInput]);

  const processChatMessage = useCallback(
    (text) => parseChatMessage(text, chatContext),
    [chatContext]
  );

  useEffect(() => {
    if (chatOpen && transactions.length > 0) {
      const forecast = calculateForecast();
      if (forecast.isHigh) {
        const timer = setTimeout(() => {
          const alertMsg = `Olá! Notei que seu ritmo de gastos este mês está **${forecast.variationPct.toFixed(0)}% acima** da sua média. Sua previsão de fechamento é de **R$ ${formatMoney(forecast.forecastAmount)}**. Quer ver onde pode economizar?`;
          setChatMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.text.includes('ritmo de gastos')) return prev;
            return [...prev, { id: crypto.randomUUID(), text: alertMsg, sender: 'bot' }];
          });
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
    return undefined;
  }, [chatOpen, transactions, calculateForecast]);

  useEffect(() => {
    if (!isDraggingFab) return undefined;

    const handleMove = (e) => {
      if (typeof window === 'undefined') return;
      const { clientX, clientY } = e;
      if (typeof clientX !== 'number' || typeof clientY !== 'number') return;

      const rawX = clientX - fabOffsetRef.current.x;
      const rawY = clientY - fabOffsetRef.current.y;
      const maxX = window.innerWidth - 56;
      const maxY = window.innerHeight - 56;
      const clamped = {
        x: Math.min(Math.max(10, rawX), maxX - 10),
        y: Math.min(Math.max(10, rawY), maxY - 10),
      };

      setFabPosition(clamped);
      try {
        localStorage.setItem('karonte_fab_pos', JSON.stringify(clamped));
      } catch {
        // ignore
      }
    };

    const handleUp = () => setIsDraggingFab(false);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDraggingFab]);

  useEffect(() => {
    if (!chatOpen) return undefined;

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

  useEffect(() => {
    if (chatOpen) setUnreadCount(0);
  }, [chatOpen]);

  const handleChatConfirm = useCallback(async () => {
    if (pendingActions.length === 0) return;
    const action = pendingActions[0];

    let dateObj;
    if (action.date) {
      dateObj = new Date(action.date);
    } else {
      const now = new Date();
      const isCurrentPeriod = selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear();
      dateObj = isCurrentPeriod ? now : new Date(selectedYear, selectedMonth - 1, 1, 12, 0, 0);
    }

    const newTransaction = {
      description: action.description,
      amount: action.amount,
      type: action.type,
      isRecurring: false,
      date: dateObj.toISOString(),
      displayDate: dateObj.toLocaleDateString('pt-BR'),
      ...buildTransactionCategoryFields(action.category, action.type, customCategories),
    };

    try {
      const savedDoc = await addTransaction(newTransaction, activeProjectId);
      setTransactions((prev) => [savedDoc, ...prev]);

      const updatedActions = pendingActions.slice(1);
      setPendingActions(updatedActions);
      setChatInput('');

      setChatMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), sender: 'user', text: 'Sim' },
        {
          id: crypto.randomUUID(),
          sender: 'bot',
          text: updatedActions.length > 0
            ? `Registrado! Vamos para o próximo: ${updatedActions[0].description}?`
            : `Feito! Registrei ${action.type === 'income' ? 'a receita' : 'a despesa'} com sucesso.`,
        },
      ]);
    } catch (err) {
      console.error('Erro ao registrar via chat:', err);
      alert('Erro ao registrar via chat');
    }
  }, [pendingActions, selectedMonth, selectedYear, customCategories, activeProjectId, setTransactions]);

  const handleChatCancel = useCallback(() => {
    if (pendingActions.length === 0) return;
    const updatedActions = pendingActions.slice(1);
    setPendingActions(updatedActions);
    setChatInput('');
    setChatMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), sender: 'user', text: 'Não' },
      {
        id: crypto.randomUUID(),
        sender: 'bot',
        text: updatedActions.length > 0
          ? `Beleza, pulei esse. E quanto a: ${updatedActions[0].description}?`
          : 'Tudo bem, registro cancelado.',
      },
    ]);
  }, [pendingActions]);

  const handleChatSubmit = useCallback(async (e) => {
    e.preventDefault();
    const input = chatInput.trim();
    if (!input) return;

    const normalizedInput = input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (pendingActions.length > 0) {
      if (normalizedInput === 'sim' || normalizedInput === 's') {
        handleChatConfirm();
        return;
      }
      if (normalizedInput === 'nao' || normalizedInput === 'n') {
        handleChatCancel();
        return;
      }

      const moneyMatch = normalizedInput.match(/(?:r\$)?\s?(\d+(?:[.,]\d{1,3})?)\s?(k|mil)?/);
      if (moneyMatch) {
        const valStr = moneyMatch[1].replace(',', '.');
        let newVal = parseFloat(valStr);
        if (moneyMatch[2] === 'k' || moneyMatch[2] === 'mil') newVal *= 1000;

        if (!Number.isNaN(newVal)) {
          const updated = [...pendingActions];
          updated[0] = { ...updated[0], amount: newVal };
          setPendingActions(updated);
          setChatMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), sender: 'user', text: input },
            { id: crypto.randomUUID(), sender: 'bot', text: `Entendi! Alterei o valor para R$ ${formatMoney(newVal)}. Deseja confirmar agora?` },
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
        setChatMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), sender: 'user', text: input },
          { id: crypto.randomUUID(), sender: 'bot', text: 'Entendi a correção! Atualizei o resumo abaixo. Deseja confirmar agora?' },
        ]);
        setChatInput('');
        return;
      }
    }

    setChatMessages((prev) => [...prev, { id: crypto.randomUUID(), sender: 'user', text: input }]);
    setChatInput('');

    const parts = input.split(/\s+e\s+|,\s+/);

    if (/(resumo de|como foi|resumo do mes)/.test(normalizedInput)) {
      const monthsMap = {
        janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
        julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
      };
      let tM = selectedMonth;
      let tY = selectedYear;

      Object.keys(monthsMap).forEach((mName) => {
        if (normalizedInput.includes(mName)) tM = monthsMap[mName];
      });

      if (normalizedInput.includes('mes passado')) {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        tM = d.getMonth() + 1;
        tY = d.getFullYear();
      }

      const insight = await generateMonthlyInsight(tM, tY);
      setChatMessages((prev) => [...prev, { id: crypto.randomUUID(), sender: 'bot', text: insight }]);
      if (!chatOpen) setUnreadCount((prev) => prev + 1);
      return;
    }

    const results = parts.map((p) => processChatMessage(p));

    setTimeout(() => {
      const answers = results.filter((r) => r.type === 'answer');
      const actions = results.filter((r) => r.type === 'action').map((r) => r.payload);

      if (answers.length > 0) {
        answers.forEach((a) => {
          setChatMessages((prev) => [...prev, { id: crypto.randomUUID(), sender: 'bot', text: a.text }]);
        });
      }

      if (actions.length > 0) {
        setPendingActions((prev) => [...prev, ...actions]);
        if (answers.length === 0) {
          const welcomeMsg = actions.length > 1
            ? `Encontrei ${actions.length} registros! Vamos confirmar um por um?`
            : results.find((r) => r.type === 'action').text;
          setChatMessages((prev) => [...prev, { id: crypto.randomUUID(), sender: 'bot', text: welcomeMsg }]);
        }
      } else if (answers.length === 0) {
        setChatMessages((prev) => [...prev, { id: crypto.randomUUID(), sender: 'bot', text: 'Não entendi seu pedido. Tente "50 pizza" ou "qual meu saldo?".' }]);
      }

      if (!chatOpen) setUnreadCount((prev) => prev + 1);
    }, 600);
  }, [
    chatInput,
    pendingActions,
    processChatMessage,
    handleChatConfirm,
    handleChatCancel,
    selectedMonth,
    selectedYear,
    generateMonthlyInsight,
    chatOpen,
  ]);

  const handleVoiceToggle = useCallback(() => {
    if (!hasSpeechSupport) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (isRecording) {
      recognitionRef.current?.stop();
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
        .map((result) => result[0])
        .map((result) => result.transcript)
        .join('');
      setChatInput(transcript);
    };

    recognition.onend = () => {
      setIsRecording(false);
      if (chatInputRef.current.trim()) {
        handleChatSubmit({ preventDefault: () => {} });
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech Recognition Error', event.error);
      setIsRecording(false);
      if (event.error === 'not-allowed') alert('Permissão de microfone negada.');
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isRecording, handleChatSubmit]);

  const chatSuggestionClick = useCallback((txt) => {
    if (pendingActions.length > 0) return;
    setChatInput(txt);
  }, [pendingActions.length]);

  const handleFabMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFab(true);
    const rect = e.currentTarget.getBoundingClientRect();
    fabOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

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
      transformOrigin: 'center bottom',
    };
  }, [fabPosition]);

  const pushBotMessage = useCallback((text) => {
    setChatMessages((prev) => [...prev, { id: crypto.randomUUID(), sender: 'bot', text }]);
    setChatOpen(true);
    setUnreadCount((prev) => prev + 1);
  }, []);

  return {
    chatOpen,
    setChatOpen,
    unreadCount,
    chatMessages,
    chatInput,
    setChatInput,
    pendingActions,
    isRecording,
    fabPosition,
    isDraggingFab,
    hasSpeechSupport,
    fabButtonRef,
    chatWindowRef,
    chatWindowStyle,
    handleChatSubmit,
    handleChatConfirm,
    handleChatCancel,
    handleVoiceToggle,
    handleFabMouseDown,
    chatSuggestionClick,
    pushBotMessage,
  };
}
