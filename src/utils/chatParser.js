import { formatMoney } from './money.js';
import { inferCategory as inferCategoryFromText, findCustomCategoryInText } from './categoryDetection.js';

/**
 * Processa uma mensagem do assistente Karonte.
 * @param {string} text
 * @param {object} ctx - contexto financeiro e callbacks
 */
export const processChatMessage = (text, ctx) => {
  const {
    balance,
    totalExpense,
    totalIncome,
    categoryStats,
    calculateForecast,
    expenseCategories,
    customCategories,
    getCategoryBudgetInfoForCat,
  } = ctx;

  const normalized = text.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

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
    if (categoryStats.length === 0) {
      return { type: 'answer', text: 'Você ainda não tem despesas registradas este mês.' };
    }
    const top = categoryStats[0];
    return { type: 'answer', text: `Seu maior gasto este mês é com ${top.name}, totalizando R$ ${formatMoney(top.total)}.` };
  }
  if (/(quanto vou gastar|previsao|projeção|predição)/.test(normalized)) {
    const forecast = calculateForecast();
    let response = 'Analisei seu histórico e aqui está a projeção para este mês: \n\n';
    response += `📌 Gasto até agora: R$ ${formatMoney(forecast.currentMonthSpent)}\n`;
    response += `🔮 Previsão final: R$ ${formatMoney(forecast.forecastAmount)}\n`;
    if (forecast.isHigh) {
      response += `⚠️ Atenção: Sua projeção está **${forecast.variationPct.toFixed(0)}% acima** da sua média histórica (R$ ${formatMoney(forecast.monthlyAverage)}). Sugiro revisar seus gastos variáveis.`;
    } else {
      response += '✅ Tudo sob controle! Sua projeção está dentro da sua média histórica.';
    }
    return { type: 'answer', text: response };
  }
  if (/(resumo|balanco|geral|estatistica|como estou)/.test(normalized)) {
    const percent = totalIncome > 0 ? ((balance / totalIncome) * 100).toFixed(0) : '0';
    return {
      type: 'answer',
      text: `Resumo do mês: Receitas R$ ${formatMoney(totalIncome)}, Despesas R$ ${formatMoney(totalExpense)}. Seu saldo está em R$ ${formatMoney(balance)} (${percent}% do total).`,
    };
  }
  if (/(ajuda|socorro|que voce faz|comandos)/.test(normalized)) {
    return {
      type: 'answer',
      text: 'Eu sou o Karonte! Posso registrar seus gastos (ex: "50 pizza e 20 uber", "ontem gastei 30 com café") ou responder sobre suas finanças (ex: "qual meu saldo?", "maior gasto do mês?").',
    };
  }
  if (/(categoria|quais categorias)/.test(normalized)) {
    return { type: 'answer', text: `Suas categorias de despesa são: ${expenseCategories.join(', ')}.` };
  }

  let numericValue = null;
  const moneyMatch = normalized.match(/(?:r\$)?\s?(\d+(?:[.,]\d{1,3})?)\s?(k|mil)?/);

  if (moneyMatch) {
    const valStr = moneyMatch[1].replace(',', '.');
    numericValue = parseFloat(valStr);
    if (moneyMatch[2] === 'k' || moneyMatch[2] === 'mil') numericValue *= 1000;
  }

  if (!numericValue || Number.isNaN(numericValue)) {
    return { type: 'answer', text: 'Não consegui identificar o valor. Tente algo como "50 lanche" ou "1.5k salario".' };
  }

  let finalDate = new Date();
  if (normalized.includes('ontem')) {
    finalDate.setDate(finalDate.getDate() - 1);
  } else if (normalized.includes('anteontem')) {
    finalDate.setDate(finalDate.getDate() - 2);
  } else {
    const days = {
      segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6, domingo: 0,
    };
    for (const [day, code] of Object.entries(days)) {
      if (normalized.includes(day)) {
        const currentDay = finalDate.getDay();
        const diff = (currentDay < code) ? (7 - (code - currentDay)) : (currentDay - code);
        finalDate.setDate(finalDate.getDate() - diff);
        break;
      }
    }
  }

  let rawDesc = normalized.replace(moneyMatch[0], '')
    .replace(/(ontem|anteontem|segunda|terca|quarta|quinta|sexta|sabado|domingo)/, '')
    .trim();
  const stopwords = /^(com|no|na|de|do|da|pelo|por|o|a|um|uma|em|pro|pra|para|no|nos|nas)\s+/;
  let cleanedDesc = rawDesc.replace(stopwords, '').trim();

  if (!cleanedDesc || cleanedDesc.length < 2) cleanedDesc = 'Registro via Assistente';

  const incomeKeywords = ['salario', 'freelance', 'receita', 'renda', 'bonus', 'pagamento', 'ganhei', 'venda', 'pix recebido', 'reembolso'];
  let inferType = incomeKeywords.some((kw) => normalized.includes(kw)) ? 'income' : 'expense';

  if (inferType === 'expense' && findCustomCategoryInText(normalized, customCategories.income)) {
    inferType = 'income';
  }

  const inferredCategory = inferCategoryFromText(normalized, inferType, customCategories);

  let budgetWarning = '';
  if (inferType === 'expense') {
    const currentSpent = categoryStats.find((s) => s.name === inferredCategory)?.total || 0;
    const info = getCategoryBudgetInfoForCat(inferredCategory, currentSpent + numericValue);
    if (info.isOver100) {
      budgetWarning = `\n\n⚠️ Atenção: este gasto fará você ultrapassar o limite de R$ ${formatMoney(info.limit)} para ${inferredCategory}.`;
    } else if (info.isOver80) {
      budgetWarning = `\n\n💡 Nota: você está chegando perto do limite de ${inferredCategory} (${info.pct.toFixed(0)}%).`;
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
      category: inferredCategory,
      date: finalDate.toISOString(),
    },
  };
};
