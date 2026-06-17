# Fase 3 — Redução do App.jsx e evolução de domínio

Objetivo: tirar do `App.jsx` o que sobrou após as fases 0–12, sem quebrar PWA, Capacitor, import PDF nem RBAC.

## 3.1 Limpeza (baixo risco) — concluída ✅

Removidos de `App.jsx` (2026-06-17):

- Estado e modal `inviteModalProject` — convite já em `ProjectSettingsView`
- Estado e modal `projectToRename` — rename inline em `ProjectSettingsView`
- Handlers `handleSendInvite`, `handleRenameProject`

**Critério de aceite:** build e testes passam; convite/rename no projeto continuam na tela de configurações.

## 3.2 Extrair chat assistente (médio risco) — concluída ✅

| Novo arquivo | Status |
|--------------|--------|
| `src/utils/chatParser.js` | ✅ |
| `src/hooks/useChatAssistant.js` | ✅ |
| `src/components/ChatAssistant.jsx` | ✅ |

## 3.3 Shell de layout (médio risco) — concluída ✅

| Novo arquivo | Status |
|--------------|--------|
| `src/views/MainShell.jsx` | ✅ sidebar, header mobile, nav, top-bar |
| `src/components/ProjectSelectorDropdown.jsx` | ✅ |
| `src/components/NotificationsDropdown.jsx` | ✅ |

## 3.5 Modais como views (baixo/médio) — concluída ✅

| View | Status |
|------|--------|
| `modals/TaskModal.jsx` | ✅ |
| `modals/PaymentModal.jsx` | ✅ |
| `modals/ProjectModal.jsx` | ✅ |
| `modals/BudgetModal.jsx` | ✅ |
| `modals/DeleteProjectModal.jsx` | ✅ |

## 3.4 Orçamentos com `categoryId` (médio/alto risco) — concluída ✅

Schema v2 em `budgetModel.js` + migração automática em `budgetService.js`. Limites gravados em `limits` (por id) e `limitsByName` (compat).

Hoje: `budgets` = `{ "Alimentação": 500, ownerId, projectId }`.

Meta:

```javascript
{
  ownerId, projectId,
  limits: { [categoryId]: number },
  limitsByName: { "Alimentação": number } // compat leitura
}
```

| Arquivo | Mudança |
|---------|---------|
| `budgetService.js` | Ler/gravar schema v2 + migração |
| `financeCalculations.js` | `computeBudgetStats` por `categoryId` |
| `firestore.rules` | Validar chaves se necessário |

**Critério de aceite:** limites existentes migram; hub e orçamentos mostram mesmos valores.

## 3.5 Modais como views (baixo/médio)

_Removido — ver seção concluída acima._

## 3.6 Domínio e infra (futuro)

| Item | Prioridade |
|------|------------|
| `dueDate` em tarefas | Média |
| Export PDF/Excel | Baixa |
| Cloud Functions para recorrências | Baixa |
| Sentry / Analytics | Baixa |
| iOS Capacitor + remover `server.url` dev | Média |
| Centralizar UI de notificações | Média |

## Ordem recomendada de execução

```
3.1 Limpeza modais
  → 3.2 useChatAssistant
  → 3.3 MainShell
  → 3.5 Modais
  → 3.4 Orçamentos categoryId
  → 3.6 Infra
```

## Checklist por PR

- [ ] `npm run test`
- [ ] `npm run build`
- [ ] Smoke: login, lançamento, orçamento, tarefa, import PDF, projeto compartilhado
- [ ] Atualizar `07-STATUS.md` e seção 20 do `DOCUMENTACAO.md`
