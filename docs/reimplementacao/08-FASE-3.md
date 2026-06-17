# Fase 3 — Redução do App.jsx e evolução de domínio

Objetivo: tirar do `App.jsx` o que sobrou após as fases 0–12, sem quebrar PWA, Capacitor, import PDF nem RBAC.

**Status:** subfases 3.1–3.5 concluídas (2026-06-17). Resta 3.6 (infra opcional).

## 3.1 Limpeza (baixo risco) — concluída ✅

Removidos de `App.jsx`:

- Estado e modal `inviteModalProject` — convite já em `ProjectSettingsView`
- Estado e modal `projectToRename` — rename inline em `ProjectSettingsView`
- Handlers `handleSendInvite`, `handleRenameProject`

## 3.2 Extrair chat assistente — concluída ✅

| Arquivo | Papel |
|---------|-------|
| `src/utils/chatParser.js` | Parser de intents e extração de lançamentos |
| `src/hooks/useChatAssistant.js` | Estado e handlers do chat |
| `src/components/ChatAssistant.jsx` | UI do FAB e painel |

## 3.3 Shell de layout — concluída ✅

| Arquivo | Papel |
|---------|-------|
| `src/views/MainShell.jsx` | Sidebar, header mobile, nav, top-bar |
| `src/components/ProjectSelectorDropdown.jsx` | Seletor Geral + projetos |
| `src/components/NotificationsDropdown.jsx` | Convites e notificações |

## 3.4 Orçamentos com `categoryId` — concluída ✅

Schema v2 em `budgetModel.js` + migração automática em `budgetService.js`:

```javascript
{
  schemaVersion: 2,
  ownerId, projectId,
  limits: { [categoryId]: number },
  limitsByName: { "Alimentação": number } // compat leitura/UI
}
```

Documentos legados (`{ "Alimentação": 500 }` no nível raiz) migram na leitura.

| Arquivo | Mudança |
|---------|---------|
| `budgetModel.js` | Normalização e helpers v2 |
| `budgetService.js` | Ler/gravar schema v2 + migração |
| `financeCalculations.js` | `computeBudgetStats` por `categoryId` |

## 3.5 Modais como componentes — concluída ✅

| Modal | Status |
|-------|--------|
| `modals/TaskModal.jsx` | ✅ |
| `modals/PaymentModal.jsx` | ✅ |
| `modals/ProjectModal.jsx` | ✅ |
| `modals/BudgetModal.jsx` | ✅ |
| `modals/DeleteProjectModal.jsx` | ✅ |

## 3.6 Domínio e infra (futuro)

| Item | Prioridade |
|------|------------|
| `dueDate` em tarefas | Média |
| Export PDF/Excel | Baixa |
| Cloud Functions para recorrências | Baixa |
| Sentry / Analytics | Baixa |
| iOS Capacitor + remover `server.url` dev | Média |
| Centralizar UI de notificações | Média |
| Mover `HubView` para `views/` | Baixa |

## Métricas pós-Fase 3

| Métrica | Valor |
|---------|-------|
| Linhas `App.jsx` | ~1.380 |
| Testes Vitest | 21 |
| Meta App.jsx | &lt; 1.500 linhas ✅ |

## Checklist por PR (referência)

- [x] `npm run test` (inclui smoke PDF em `statementImport.smoke.test.js`)
- [x] `npm run build`
- [x] Smoke manual no navegador (produção, usuário Lucas — import PDF OK)
- [x] Atualizar `07-STATUS.md` e seção 20 do `DOCUMENTACAO.md`
