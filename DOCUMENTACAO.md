# Karonte — Documentação Completa

> Controle financeiro pessoal e compartilhado.  
> Stack: **React 19 + Vite 8 + Firebase (Auth + Firestore) + PWA + Capacitor (Android)**  
> Produção: https://karonte-nu-blue.vercel.app

---

## Índice

1. [Visão geral](#1-visão-geral)
2. [Stack e dependências](#2-stack-e-dependências)
3. [Estrutura organizacional do projeto](#3-estrutura-organizacional-do-projeto)
4. [Arquitetura da aplicação](#4-arquitetura-da-aplicação)
5. [Modelo de dados (Firestore)](#5-modelo-de-dados-firestore)
6. [Regras de segurança (Firestore)](#6-regras-de-segurança-firestore)
7. [Camada de serviços](#7-camada-de-serviços)
8. [Componentes de interface](#8-componentes-de-interface)
9. [Telas e navegação](#9-telas-e-navegação)
10. [Sistema de permissões](#10-sistema-de-permissões)
11. [Cálculos e fórmulas](#11-cálculos-e-fórmulas)
12. [Assistente (chatbot)](#12-assistente-chatbot)
13. [Insights mensais](#13-insights-mensais)
14. [Exportação de relatório](#14-exportação-de-relatório)
15. [PWA e deploy](#15-pwa-e-deploy)
16. [Capacitor (Android)](#16-capacitor-android)
17. [Variáveis de ambiente](#17-variáveis-de-ambiente)
18. [Scripts npm](#18-scripts-npm)
19. [Limitações e pendências conhecidas](#19-limitações-e-pendências-conhecidas)
20. [Importações (extratos e notas fiscais)](#20-importações-extratos-e-notas-fiscais)
21. [Refatoração em andamento (prioridades técnicas)](#21-refatoração-em-andamento-prioridades-técnicas)

---

## 1. Visão geral

O **Karonte** é um aplicativo web de finanças pessoais com suporte a **projetos compartilhados** (orçamentos em grupo). Principais capacidades:

| Área | Funcionalidades |
|------|-----------------|
| **Finanças pessoais** | Lançamentos de receita/despesa, categorias customizáveis, orçamentos por categoria, cartões de crédito, regra 50-30-20 |
| **Projetos compartilhados** | Criação de projetos, convites por e-mail, papéis de colaborador, transações e tarefas por projeto |
| **Tarefas** | Lista de tarefas e despesas com meta, parcelas e abatimento de pagamentos |
| **Dashboard (Hub)** | KPIs, gráficos (6 meses), previsão de gastos, alertas rápidos |
| **Assistente** | Chat com NLP simples para consultas e registro de lançamentos; suporte a voz (Web Speech API) |
| **Importações** | Extratos (PDF, CSV, XLS/XLSX, OFX), notas fiscais (XML/PDF) e histórico de lotes |
| **Administração** | Painel admin para gestão de usuários (bloqueio, reset de senha, edição de username) |
| **Mobile** | UI responsiva + PWA instalável; shell Android via Capacitor |

A lógica de orquestração permanece em `src/App.jsx` (~1.380 linhas): auth, estado global, handlers e composição de telas. Layout (`MainShell`), chat (`useChatAssistant` + `ChatAssistant`), modais e views estão extraídos.

---

## 2. Stack e dependências

### Runtime

| Pacote | Versão | Uso |
|--------|--------|-----|
| `react` / `react-dom` | ^19.2.4 | Interface |
| `firebase` | ^12.10.0 | Autenticação + Firestore |
| `recharts` | ^3.8.0 | Gráficos no Hub |
| `@capacitor/core` / `android` | ^8.2.0 | App nativo Android (WebView) |

### Build / Dev

| Pacote | Uso |
|--------|-----|
| `vite` | Bundler e dev server |
| `@vitejs/plugin-react` | Fast Refresh |
| `vite-plugin-pwa` | Manifest + Service Worker |
| `sharp` | Geração de ícones PWA a partir do SVG |
| `eslint` | Linting |

---

## 3. Estrutura organizacional do projeto

```
karonte/
├── DOCUMENTACAO.md          ← Esta documentação
├── README.md
├── package.json
├── vite.config.js           ← Vite + PWA
├── capacitor.config.json    ← Config Android/Capacitor
├── firebase.json            ← Deploy das regras Firestore
├── firestore.rules          ← Segurança do banco
├── index.html               ← Entry HTML + meta PWA
├── .env.example             ← Template de variáveis Firebase
│
├── public/                  ← Assets estáticos
│   ├── assets/karonte-favicon.svg
│   ├── karonte-logo-*.svg
│   ├── pwa-192x192.png      ← Ícones PWA (gerados no build)
│   ├── pwa-512x512.png
│   ├── pwa-maskable-512x512.png
│   └── apple-touch-icon.png
│
├── scripts/
│   └── generate-pwa-icons.mjs  ← Rasteriza SVG → PNG
│
├── src/
│   ├── main.jsx             ← Bootstrap React + registro PWA
│   ├── App.jsx              ← Orquestração: estado, handlers, composição
│   ├── App.css              ← Estilos do app
│   ├── index.css            ← Design tokens (tema claro/escuro)
│   │
│   ├── config/
│   │   └── firebase.js      ← Inicialização Firebase (auth, db)
│   │
│   ├── constants/
│   │   └── categories.js    ← Categorias padrão e classificações 50-30-20
│   │
│   ├── hooks/
│   │   ├── usePermissions.js
│   │   ├── useFinanceDerived.js
│   │   └── useChatAssistant.js
│   │
│   ├── views/
│   │   ├── MainShell.jsx    ← Sidebar, header mobile, nav, top-bar
│   │   ├── LoadingView.jsx, AuthView.jsx, AdminApp.jsx
│   │   ├── UserSettingsView.jsx, ProjectSettingsView.jsx
│   │   ├── BudgetsView.jsx, TasksView.jsx
│   │   └── (import lazy) ImportHubView em components/
│   │
│   ├── components/
│   │   ├── HubView.jsx, TransactionDrawer.jsx, ChatAssistant.jsx
│   │   ├── ImportHubView.jsx, StatementImportView.jsx, InvoiceImportView.jsx
│   │   ├── ImportHistoryView.jsx
│   │   ├── ProjectSelectorDropdown.jsx, NotificationsDropdown.jsx
│   │   ├── ErrorBoundary.jsx
│   │   └── modals/          ← Budget, Project, Task, Payment, DeleteProject
│   │
│   ├── utils/
│   │   ├── categoryModel.js, budgetModel.js, categoryDetection.js
│   │   ├── chatParser.js, financeCalculations.js, money.js
│   │   ├── taskCalculations.js, statementParser.js, structuredStatementParser.js
│   │   ├── invoiceParser.js
│   │   └── __tests__/       ← Vitest
│   │
│   └── services/            ← Camada de acesso ao Firestore
│       ├── authService.js
│       ├── transactionService.js
│       ├── budgetService.js
│       ├── categoriesService.js
│       ├── creditCardService.js
│       ├── projectService.js
│       ├── taskService.js
│       ├── inviteService.js
│       ├── notificationService.js
│       ├── insightService.js
│       ├── statementImportService.js
│       ├── importBatchService.js
│       └── purchaseInvoiceService.js
│
└── android/                 ← Projeto Capacitor Android
    └── app/src/main/...
```

### Responsabilidade por camada

| Camada | Responsabilidade |
|--------|------------------|
| `src/config/` | Configuração de infraestrutura (Firebase) |
| `src/services/` | CRUD Firestore, sem lógica de UI |
| `src/views/` | Telas de rota e shell de layout (`MainShell`) |
| `src/hooks/` | Permissões, cálculos derivados, assistente de chat |
| `src/utils/` | Modelos de domínio, parsers, cálculos puros |
| `src/components/` | UI reutilizável (Hub, drawer, chat, modais, dropdowns) |
| `src/App.jsx` | Estado global, handlers, composição de views e serviços |
| `src/index.css` | Variáveis CSS de tema (`--primary-color`, etc.) |
| `firestore.rules` | Autorização no backend |
| `public/` + PWA | Assets e instalabilidade mobile |

---

## 4. Arquitetura da aplicação

```
┌─────────────────────────────────────────────────────────────┐
│  Browser / PWA / Capacitor WebView                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  App.jsx (estado, handlers, composição)                 │  │
│  │    ├── MainShell.jsx (layout)                           │  │
│  │    ├── views/* (Auth, Hub via HubView, Budgets, …)      │  │
│  │    ├── ChatAssistant + useChatAssistant                 │  │
│  │    ├── modals/* (orçamento, projeto, tarefa, …)         │  │
│  │    └── TransactionDrawer.jsx                            │  │
│  └───────────────────────┬─────────────────────────────┘  │
│                          │                                   │
│  ┌───────────────────────▼─────────────────────────────┐  │
│  │  services/*.js (10 módulos)                          │  │
│  └───────────────────────┬─────────────────────────────┘  │
│                          │                                   │
│  ┌───────────────────────▼─────────────────────────────┐  │
│  │  config/firebase.js → auth + db                      │  │
│  └───────────────────────┬─────────────────────────────┘  │
└──────────────────────────┼──────────────────────────────────┘
                           ▼
                    Firebase Firestore
                    Firebase Auth
```

### Fluxo de autenticação

1. `onAuthStateChanged` (Firebase Auth) detecta sessão
2. Carrega documento `users/{uid}` no Firestore
3. Se `active === false` → logout forçado (`access-denied`)
4. Se `role === 'admin'` → painel administrativo (sem finanças)
5. Usuário comum → carrega projetos, transações, orçamentos, convites, notificações

### Escopo de dados (projeto ativo)

| `activeProjectId` | Comportamento |
|-------------------|---------------|
| `null` | **Geral** — finanças pessoais; transações sem `projectId` ou com `projectId === 'geral'` |
| `{id}` | Projeto específico; transações via `getProjectTransactions`; tarefas habilitadas |

---

## 5. Modelo de dados (Firestore)

### `users/{uid}`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `uid` | string | ID do Firebase Auth |
| `email` | string | E-mail |
| `fullName` | string | Nome completo |
| `username` | string | Nome de exibição curto |
| `role` | string | `'user'` ou `'admin'` |
| `active` | boolean | `false` bloqueia login |
| `createdAt` | ISO string | Data de criação |

### `transactions/{id}`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `userId` | string | Autor (UID) |
| `createdByUid` | string | UID de quem criou |
| `createdByName` | string | Nome de quem criou |
| `description` | string | Descrição |
| `amount` | number | Valor em reais |
| `type` | string | `'income'` ou `'expense'` |
| `category` | string | Nome da categoria |
| `date` | ISO string | Data do lançamento |
| `projectId` | string? | ID do projeto (omitido no Geral) |
| `isRecurring` | boolean? | Despesa recorrente mensal |
| `isInstallment` | boolean? | Compra parcelada |
| `installments` | number? | Total de parcelas |
| `installmentNumber` | number? | Parcela atual |
| `paymentMethod` | string? | `'avulsa'` ou `'card'` |
| `cardId` | string? | ID do cartão de crédito |
| `parentId` | string? | ID da transação pai (recorrência) |
| `source` | string? | `'statement_import'`, `'invoice_import'` ou legado `'statement_pdf'` |
| `importBatchId` | string? | UUID do lote de importação |
| `importedAt` | ISO string? | Timestamp da importação |
| `invoiceId` | string? | ID em `purchaseInvoices` (nota fiscal) |
| `rawDescription` | string? | Texto original do extrato |
| `duplicateHash` | string? | Hash para detecção de duplicatas |
| `createdAt` | ISO string | Criação |

### `importBatches/{batchId}`

Registro persistente de cada importação (extrato ou nota fiscal).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | string | Mesmo UUID usado em `importBatchId` das transações |
| `userId` | string | Autor |
| `projectId` | string? | Projeto ou `null` (Geral) |
| `type` | string | `'statement'` ou `'invoice'` |
| `fileNames` | string[] | Arquivos processados |
| `importedAt` | ISO string | Data da importação |
| `status` | string | `'completed'`, `'partial'`, `'undone'` |
| `counts` | object | `{ detected, imported, failed, ignored, duplicates }` |
| `importedTransactionIds` | string[] | IDs salvos |
| `importedInvoiceIds` | string[] | IDs de notas (quando aplicável) |
| `skippedRows` | object[] | Linhas não importadas (motivo + descrição) |
| `failedRows` | object[] | Falhas ao salvar |
| `createdByUid` / `createdByName` | string | Quem importou |

### `purchaseInvoices/{id}`

Modelo Karonte de nota fiscal — **sem armazenar o arquivo original**.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `userId` | string | Autor |
| `projectId` | string? | Projeto |
| `issuerName` | string | Emitente (loja/fornecedor) |
| `issuerDocument` | string | CNPJ/CPF (somente dígitos) |
| `accessKey` | string | Chave NF-e (44 dígitos) |
| `invoiceNumber` | string | Número da NF |
| `series` | string | Série |
| `issueDate` | ISO string | Data de emissão |
| `totalAmount` | number | Valor total |
| `items` | object[] | `{ description, quantity, unitPrice, totalAmount }` |
| `purchaseDescription` | string | Descrição escolhida pelo usuário |
| `category` / `categoryId` / `categoryName` | | Categoria da despesa |
| `importBatchId` | string? | Lote associado |
| `sourceFormat` | string | `'nfe_xml'` ou `'pdf_text'` |
| `createdAt` | ISO string | Registro no Karonte |

### `budgets/{docId}`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `schemaVersion` | number | `2` (schema atual) |
| `limits` | map | `{ categoryId: number }` — limites por ID de categoria |
| `limitsByName` | map | `{ "Alimentação": number }` — compatibilidade e UI |
| `ownerId` | string? | Dono do orçamento (projetos compartilhados) |
| `projectId` | string? | Projeto associado |

Documentos legados com chaves `{categoria}: number` no nível raiz são migrados automaticamente em `getUserBudgets`.

**ID do documento:** `{uid}` (Geral) ou `{ownerUid}_{projectId}` (projeto)

### `projects/{id}`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `name` | string | Nome do projeto |
| `userId` | string | Dono (owner) |
| `collaborators` | string[] | UIDs dos colaboradores |
| `collaboratorRoles` | map | `{ uid: 'view' \| 'add' \| 'manage' }` |
| `collaboratorNames` | map? | `{ uid: 'Nome exibido' }` |
| `createdAt` | ISO string | Criação |
| `updatedAt` | ISO string? | Última atualização |

### `tasks/{id}`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `projectId` | string | Projeto (obrigatório) |
| `userId` | string | Criador |
| `createdByUid` | string | UID do criador |
| `createdByName` | string | Nome do criador |
| `title` | string | Título |
| `type` | string | `'tarefa'` ou `'despesa'` |
| `completed` | boolean | Concluída |
| `metaValue` | number | Valor meta total |
| `parcelas` | number | Quantidade de parcelas |
| `paidAmount` | number | Valor já pago/abatido |
| `createdAt` | ISO string | Criação |
| `updatedAt` | ISO string? | Atualização |

### `invites/{id}`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `projectId` | string | Projeto convidado |
| `projectName` | string | Nome para exibição |
| `fromUid` | string | Quem convidou |
| `toEmail` | string | E-mail do convidado (normalizado) |
| `toUid` | string? | UID após aceite |
| `role` | string | `'view'`, `'add'` ou `'manage'` |
| `status` | string | `'pending'`, `'accepted'`, `'rejected'` |
| `createdAt` | ISO string | Criação |

### `notifications/{id}`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `userId` | string | Destinatário |
| `type` | string | Tipo da notificação |
| `data` | object | Payload |
| `read` | boolean | Lida |
| `createdAt` | ISO string | Criação |

### `userCategories/{uid}`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `expense` | object[] | Categorias de despesa `{ id, name }` (schema v2) |
| `income` | object[] | Categorias de receita `{ id, name }` |
| `classificationsById` | map | `{ categoryId: 'needs' \| 'wants' \| 'savings' }` |
| `classifications` | map | Legado por nome — regravado no save para compat |

### `creditCards/{id}`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `userId` | string | Dono |
| `projectId` | string | Projeto (`'geral'` ou ID) |
| `name` | string | Nome do cartão |
| `limit` | number | Limite |
| `closingDay` | number | Dia de fechamento (1–31) |
| `dueDay` | number | Dia de vencimento |

### `insights/{userId}_{scope}_{month}_{year}`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `text` | string | Texto do insight mensal |
| `createdAt` | ISO string | Cache |
| `projectId` | string? | `null` = Geral; ID do projeto quando escopo compartilhado |

ID do documento: `buildInsightCacheId(uid, month, year, projectId)` → `{uid}_{geral\|projectId}_{month}_{year}`.

> **Atenção:** A coleção `insights` **não possui regra explícita** em `firestore.rules` e é bloqueada pela regra catch-all. O cache de insights pode falhar em produção até adicionar regras.

---

## 6. Regras de segurança (Firestore)

### Funções auxiliares

| Função | Condição |
|--------|----------|
| `isAuthenticated()` | `request.auth != null` |
| `isOwner(uid)` | `request.auth.uid == uid` |
| `isAdmin()` | Usuário autenticado com `users/{uid}.role == 'admin'` |
| `isActiveUser()` | Usuário autenticado com `users/{uid}.active == true` |
| `userEmail()` | `request.auth.token.email` |
| `isProjectMember(projectId)` | Dono OU UID em `collaborators` |

### Resumo por coleção

| Coleção | Leitura | Escrita |
|---------|---------|---------|
| `users` | Próprio perfil ou admin | Criar: self com `role=user`, `active=true`. Update: owner (sem mudar role/active) ou admin |
| `transactions` | Próprias OU membro do projeto | Criar/atualizar/excluir: próprio OU membro do projeto |
| `budgets` | Doc ID começa com UID OU membro do projeto | Mesmo critério |
| `projects` | Dono ou colaborador | Criar: dono. Update: dono OU self-join (aceitar convite). Delete: dono |
| `tasks` | Próprias OU membro do projeto | Criar: membro do projeto. Update/delete: próprio OU membro |
| `invites` | Remetente ou destinatário (e-mail/uid) | Criar: remetente. Update: remetente ou destinatário |
| `notifications` | Destinatário (`userId`) | Criar: qualquer ativo. Update/delete: destinatário |
| `userCategories` | Doc ID == `auth.uid` | Doc ID == `auth.uid` |
| `creditCards` | Próprio OU cartão de projeto (não `'geral'`) | Mesmo critério |
| `importBatches` | Próprio OU membro do projeto | Criar: membro com `canAddInProject`. Update: dono ou `canDeleteInProject` (desfazer) |
| `purchaseInvoices` | Próprio OU membro do projeto | Criar/atualizar/excluir: dono OU membro com permissão equivalente a transações |
| `/**` (demais) | **Negado** | **Negado** |

---

## 7. Camada de serviços

### `authService.js`

| Função | Descrição |
|--------|-----------|
| `login(email, password)` | Login; rejeita usuário inativo |
| `register(email, password, fullName, role?)` | Registro + doc em `users` |
| `logout()` | Encerra sessão |
| `getAllUsers()` | Lista todos os usuários (admin) |
| `toggleUserStatus(uid, currentStatus)` | Alterna `active` |
| `updateUsername(uid, newUsername)` | Atualiza `username` |
| `changeOwnPassword(user, newPassword)` | Altera senha do usuário logado |
| `sendPasswordReset(email)` | E-mail de reset Firebase |
| `createAdminUser(email, password, fullName)` | Bootstrap de admin (console) |

### `transactionService.js`

| Função | Descrição |
|--------|-----------|
| `addTransaction(data, projectId?)` | Cria lançamento com `createdByUid/Name` |
| `getUserTransactions(userId, projectId?)` | Transações do usuário; `null` filtra Geral |
| `getProjectTransactions(projectId)` | Todas as transações do projeto |
| `deleteTransaction(id)` | Remove lançamento |
| `deleteTransactionsByIds(ids)` | Remove vários (desfazer importação) |
| `getTransactionsByImportBatchId(batchId)` | Transações de um lote |

### `statementImportService.js`

| Função | Descrição |
|--------|-----------|
| `validateStatementFile(file)` | Valida tipo e tamanho (5 MB) |
| `processStatementFiles(files, opts)` | Processa PDF/CSV/XLS/OFX no navegador |
| `parseStatementFile(file, opts)` | Roteia para parser adequado |

Parsers: `statementParser.js` (PDF texto), `structuredStatementParser.js` (CSV/OFX/planilha).

### `importBatchService.js`

| Função | Descrição |
|--------|-----------|
| `saveImportBatch(batchId, data)` | Persiste lote de importação |
| `getImportBatchesForScope(userId, projectId?)` | Histórico por escopo |
| `getImportBatch(batchId)` | Detalhe de um lote |
| `markImportBatchUndone(batchId)` | Marca lote como desfeito |

### `purchaseInvoiceService.js`

| Função | Descrição |
|--------|-----------|
| `savePurchaseInvoice(data, projectId?)` | Salva modelo Karonte da nota |
| `getPurchaseInvoicesForScope(userId, projectId?)` | Lista notas do escopo |
| `deletePurchaseInvoice(id)` | Remove nota |

### `budgetService.js`

| Função | Descrição |
|--------|-----------|
| `saveUserBudgets(budgets, projectId?, ownerId?)` | Salva limites por categoria |
| `getUserBudgets(userId, projectId?)` | Carrega orçamentos |

### `categoriesService.js`

| Função | Descrição |
|--------|-----------|
| `getUserCategories(uid)` | Categorias + classificações 50-30-20 |
| `saveUserCategories(uid, categories)` | Persiste categorias |

### `creditCardService.js`

| Função | Descrição |
|--------|-----------|
| `getCreditCards(userId, projectId?)` | Lista cartões |
| `addCreditCard(cardData, projectId?)` | Cria cartão |
| `deleteCreditCard(cardId)` | Remove cartão |

### `projectService.js`

| Função | Descrição |
|--------|-----------|
| `createProject(name)` | Novo projeto (owner) |
| `getUserProjects(userId)` | Projetos próprios + compartilhados |
| `updateProject(id, data)` | Atualização parcial |
| `deleteProject(id)` | Exclui projeto |
| `addCollaborator(projectId, uid, role, displayName?)` | Self-join via `arrayUnion` (aceite de convite) |
| `getProjectRole(project, uid)` | Retorna `'owner'`, `'view'`, `'add'`, `'manage'` ou `null` |

### `taskService.js`

| Função | Descrição |
|--------|-----------|
| `getProjectTasks(projectId)` | Tarefas de todos os membros do projeto |
| `addTask(projectId, payload)` | Cria tarefa/despesa |
| `updateTask(taskId, data)` | Atualização parcial |
| `deleteTask(taskId)` | Remove tarefa |

### `inviteService.js`

| Função | Descrição |
|--------|-----------|
| `createInvite(projectId, projectName, toEmail, role)` | Convite pendente |
| `getInvitesByEmail(email)` | Convites recebidos |
| `acceptInvite(inviteId)` | Aceita + `addCollaborator` |
| `rejectInvite(inviteId)` | Rejeita convite |

### `notificationService.js`

| Função | Descrição |
|--------|-----------|
| `getNotifications(userId)` | Até 50 notificações |
| `markNotificationRead(id)` | Marca como lida |
| `createNotification(userId, type, data)` | Cria notificação (não usado na UI atual) |

### `insightService.js`

| Função | Descrição |
|--------|-----------|
| `buildInsightCacheId(userId, month, year, projectId?)` | Monta ID do doc de cache |
| `getCachedInsight(userId, month, year, projectId?)` | Lê cache mensal por escopo |
| `saveInsightToCache(userId, month, year, text, projectId?)` | Salva cache |

---

## 8. Componentes de interface

### `HubView.jsx` — Visão Geral

Dashboard em layout **bento grid** com:

| Seção | Conteúdo |
|-------|----------|
| KPI strip | Saldo, entradas, saídas, previsão de gastos |
| Evolução 6 meses | `AreaChart` — saldo mensal |
| Top categorias | Barras de progresso (orçamento ou % do total) |
| Receitas vs despesas | `BarChart` — 6 meses |
| Composição | `PieChart` — despesas por categoria |
| Orçado vs realizado | Top 4 categorias com limite |
| Regra 50-30-20 | Barra empilhada (necessidades/desejos/poupança) |
| Indicadores | Poupança %, uso orçamento %, maior gasto |
| Análise rápida | Alertas automáticos |
| Últimos lançamentos | Lista com add/delete |

**Props recebidas de `App.jsx`:** totais, `categoryStats`, `budgetStats`, `ruleStats`, `monthlyEvolutionData`, `calculateForecast`, permissões, callbacks.

### `TransactionDrawer.jsx` — Novo lançamento

Drawer lateral com:

- Descrição, valor (máscara BRL), tipo (receita/despesa)
- Seleção de categoria
- Despesa: pagamento avulso ou cartão; parcelas (2–24x); recorrente mensal
- Gerenciador de categorias customizadas (com classificação 50-30-20)

### `MainShell.jsx` — Layout principal

Sidebar (desktop), header e bottom nav (mobile), top-bar com seletor de projeto, notificações e avatar. Recebe `currentView`, `onNavigate`, slots de conteúdo e props de projeto/usuário.

### `ChatAssistant.jsx` + `useChatAssistant`

FAB do assistente, histórico de mensagens, entrada de texto e voz. Lógica de parser em `src/utils/chatParser.js`; inferência de categoria compartilhada com importações em `src/utils/categoryDetection.js`.

### `ImportHubView.jsx` — Importações

Hub com três abas (lazy-loaded via `App.jsx`, view `'import'`):

| Aba | Componente | Função |
|-----|------------|--------|
| **Extrato** | `StatementImportView` | PDF, CSV, XLS/XLSX, OFX; revisão; duplicatas; barras de progresso |
| **Nota fiscal** | `InvoiceImportView` | XML NF-e ou PDF (DANFE); extrai campos no browser; **não armazena arquivo** |
| **Histórico** | `ImportHistoryView` | Lotes em `importBatches`; importadas vs ignoradas; desfazer |

Processamento 100% client-side (`pdfjs-dist`, `xlsx`). Limite: **5 MB** por arquivo.

### Modais (`src/components/modals/`)

| Modal | Função |
|-------|--------|
| `BudgetModal` | Definir limites por categoria |
| `ProjectModal` | Criar projeto |
| `DeleteProjectModal` | Confirmar exclusão |
| `TaskModal` | Nova tarefa/despesa |
| `PaymentModal` | Registrar pagamento de tarefa |

### Dropdowns

| Componente | Função |
|------------|--------|
| `ProjectSelectorDropdown` | Geral + projetos do usuário |
| `NotificationsDropdown` | Convites e notificações |

### `ErrorBoundary.jsx`

Captura erros React; tela de crash com reload. Export default via `AppWrapper` em `App.jsx`.

---

## 9. Telas e navegação

### Estados de tela (não autenticado / loading)

| Condição | Tela |
|----------|------|
| `authLoading` | Spinner "Conectando ao Karonte..." |
| `!currentUser` | Login / Registro (`authMode`: `'login'` \| `'register'`) |
| `currentUser.role === 'admin'` | Painel admin (layout separado) |

### Views (`currentView`) — usuário comum

| Valor | Título | Descrição |
|-------|--------|-----------|
| `'hub'` | Visão Geral | Renderiza `<HubView />` |
| `'budgets'` | Orçamentos | Limites por categoria + cartões (sub-abas: `categories` / `cards`) |
| `'import'` | Importações | Extratos, notas fiscais e histórico (`ImportHubView`) |
| `'tarefas'` | Tarefas | Lista de tarefas do projeto ativo (não disponível no Geral) |
| `'userSettings'` | Configurações de Conta | Perfil (somente leitura) |
| `'projectSettings'` | Configurações do Projeto | Renomear, participantes, convites, excluir (owner) |

### Navegação

- **Sidebar / bottom nav mobile:** `hub`, `budgets`, `tarefas`, `import` (se `canAddToProject`)
- **Avatar / perfil:** `userSettings`
- **Ícone ⚙ (owner):** `projectSettings`
- **Seletor de projeto:** dropdown com Geral + projetos
- **Sino 🔔:** painel de convites e notificações

### Painel Admin (`role === 'admin'`)

- Estatísticas: total, ativos, bloqueados
- Lista de usuários com edição de username
- Reset de senha por e-mail
- Bloquear/desbloquear usuário
- Alterar própria senha
- Toggle tema + logout

---

## 10. Sistema de permissões

### Papel global (`users.role`)

| Role | Acesso |
|------|--------|
| `'user'` | App financeiro completo |
| `'admin'` | Apenas painel de usuários |

### Papel no projeto (`collaboratorRoles`)

| Role | Ver | Adicionar | Excluir | Configurar projeto |
|------|-----|-----------|---------|-------------------|
| `owner` | ✅ | ✅ | ✅ | ✅ |
| `manage` | ✅ | ✅ | ✅ | ❌ |
| `add` | ✅ | ✅ | ❌ | ❌ |
| `view` | ✅ | ❌ | ❌ | ❌ |

### Permissões computadas em `App.jsx`

```
activeProjectRole:
  activeProjectId === null  →  'owner'   (Geral = acesso total pessoal)
  senão                     →  getProjectRole(project, uid)

canAddToProject =
  !activeProjectId OU role ∈ { owner, add, manage }

canDeleteInProject =
  !activeProjectId OU role ∈ { owner, manage }
```

### Orçamentos e categorias em projetos compartilhados

- Orçamento e categorias usam o **UID do dono do projeto** (`activeProject.userId`), não do colaborador.
- Edição de categorias: apenas dono ou papel `manage` (`canEditCategories`).
- Limites gravados em schema v2 (`limits` por `categoryId` + `limitsByName` para compat).

---

## 11. Cálculos e fórmulas

### 11.1 Formatação e parsing monetário

**`formatMoney(val)`**
```
(typeof val === 'number' ? val : 0).toLocaleString('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})
```

**`parseMoneyInput(str)`** — máscara centavos:
```
digits = str.replace(/\D/g, '')
return digits === '' ? 0 : parseInt(digits, 10) / 100
```

**`handleAddTransaction`** — conversão do campo amount:
```
numericAmount = parseFloat(amount.replace(/\./g, '').replace(',', '.'))
```

---

### 11.2 Filtro de período

**`filteredTransactions`** — mês/ano selecionados:
```
filter t onde:
  new Date(t.date).getMonth() + 1 === selectedMonth
  E new Date(t.date).getFullYear() === selectedYear

ordenar por data decrescente
```

---

### 11.3 Totais do período

```
totalIncome  = Σ filteredTransactions[type === 'income'].amount
totalExpense = Σ filteredTransactions[type === 'expense'].amount
balance      = totalIncome - totalExpense
```

---

### 11.4 Estatísticas por categoria

**`categoryStats`:**
```
para cada categoria de despesa:
  total = Σ despesas do período na categoria

filtrar total > 0
ordenar por total decrescente
```

**Barra visual no Hub (`visualPct`):**
```
se limite orçamento === 0:
  visualPct = min((total / totalExpense) * 100, 100)
senão:
  visualPct = getCategoryBudgetInfo(categoria, total).pct
```

---

### 11.5 Evolução mensal (6 meses)

**`monthlyEvolutionData`:**
```
para i de 5 até 0:
  targetDate = hoje menos i meses
  mIncome  = Σ receitas naquele mês/ano
  mExpense = Σ despesas naquele mês/ano
  Saldo    = mIncome - mExpense
  Receitas = mIncome
  Despesas = mExpense
  name     = nome do mês (PT-BR, maiúsculo)
```

---

### 11.6 Orçamentos

**`totalBudgetLimit`:**
```
Σ Object.values(budgets) convertidos para número
```

**`budgetStats`:**
```
para cada categoria de despesa com limite > 0:
  spent   = Σ despesas do período na categoria
  percent = (spent / limit) * 100   // se limit > 0

ordenar por spent decrescente
```

**`getCategoryBudgetInfo(catName, currentSpent)`:**
```
limit = budgets[catName] || 0

se limit === 0 → { limit: 0, pct: 0, isOver80: false, isOver100: false }

pct = (currentSpent / limit) * 100

retorno:
  limit
  pct: min(pct, 100)      // cap visual em 100%
  isOver80: pct >= 80
  isOver100: pct > 100
```

**Indicador "Uso orçamento" (Hub):**
```
totalBudgetLimit > 0
  ? ((totalExpense / totalBudgetLimit) * 100).toFixed(0) + '%'
  : '—'
```

**Indicador "Poupança" (Hub):**
```
totalIncome > 0
  ? (((totalIncome - totalExpense) / totalIncome) * 100).toFixed(0) + '%'
  : '0%'
```

---

### 11.7 Regra 50-30-20

**Classificações padrão:**
```
Moradia, Alimentação, Transporte, Saúde → 'needs'
Lazer, Outros → 'wants'
(customCategories.classifications sobrescreve por categoria)
```

**`ruleStats`:**
```
needsSpent   += despesas onde classificação === 'needs'
wantsSpent   += despesas onde classificação === 'wants'
savingsSpent += despesas onde classificação === 'savings'

savingsAmount = (balance > 0 ? balance : 0) + savingsSpent
total = needsSpent + wantsSpent + savingsAmount

se total === 0 → todos pct = 0

needsPct   = (needsSpent / total) * 100
wantsPct   = (wantsSpent / total) * 100
savingsPct = (savingsAmount / total) * 100
```

> A poupança inclui o saldo positivo do período + gastos classificados como `savings`.

---

### 11.8 Previsão de gastos — `calculateForecast()`

Usa **todas** as transações (não só o período filtrado):

```
currentMonthSpent = Σ despesas do mês/ano atual

threeMonthsAgo = hoje - 3 meses
pastTransactions = despesas onde:
  data < primeiro dia do mês atual
  E data >= threeMonthsAgo

totalPastDays  = 90
totalPastSpent = Σ pastTransactions.amount
dailyAverage   = totalPastSpent / totalPastDays
monthlyAverage = dailyAverage * 30

lastDayOfMonth  = dias no mês atual
daysRemaining   = lastDayOfMonth - dia de hoje
forecastAmount  = currentMonthSpent + (dailyAverage * daysRemaining)

variationPct = monthlyAverage > 0
  ? ((forecastAmount - monthlyAverage) / monthlyAverage) * 100
  : 0

isHigh = variationPct > 15
```

**Retorno:** `{ currentMonthSpent, monthlyAverage, forecastAmount, variationPct, isHigh }`

---

### 11.9 Fatura do cartão de crédito — `getCardInvoiceStats(card, transactionsList)`

```
limit      = Number(card.limit) || 0
closingDay = Number(card.closingDay) || 5

closingDate     = selectedYear, selectedMonth-1, closingDay 23:59:59
prevClosingDate = selectedYear, selectedMonth-2, closingDay 23:59:59

cardExpenses = despesas com paymentMethod === 'card' E cardId === card.id

invoiceAmount = Σ cardExpenses onde:
  prevClosingDate < data <= closingDate

availableLimit = limit - invoiceAmount
percentUsed    = limit > 0 ? (invoiceAmount / limit) * 100 : 0
```

Barra de progresso: `min(percentUsed, 100)`; cor vermelha se `> 100`, amarela se `> 80`.

---

### 11.10 Tarefas e parcelas

**Valor da parcela:**
```
parcelaValue = (meta > 0 && parcelas > 0) ? meta / parcelas : 0
```

**Parcelas pagas (contagem):**
```
parcelasPagas = parcelaValue > 0
  ? min(parcelas, floor((paidAmount + 1e-9) / parcelaValue))
  : 0
```

**Parcelas restantes:**
```
parcelasRestantes = parcelas > 0 ? max(0, parcelas - parcelasPagas) : 0
```

**Barra de progresso da tarefa:**
```
se metaValue > 0:
  se tipo === 'despesa': min(100, (paidAmount / metaValue) * 100)
  senão: completed ? 100 : min(100, (paidAmount / metaValue) * 100)
senão:
  completed ? 100 : 0
```

**Ao salvar tarefa (`handleSaveTask`):**
```
metaValue = metaFromInput > 0
  ? metaFromInput
  : (parcelas > 0 && parcelaFromInput > 0 ? parcelas * parcelaFromInput : 0)

initialPaidAmount = (parcelas > 0 && parcelaFromInput > 0 && parcelasPagas > 0)
  ? min(parcelasPagas, parcelas) * parcelaFromInput
  : null
```

**Abatimento (`handleAddPayment`):**
```
se paymentMode === 'parcelas':
  amount = parcelasSelecionadas * parcelaValue
senão:
  amount = parseMoneyInput(paymentAmountInput)

newPaidAmount = paidAmount atual + amount
```

**Ordenação de tarefas (`sortedAndFilteredTasks`):**

| `tasksSort` | Ordem |
|-------------|-------|
| `'title'` | A–Z (`localeCompare` pt-BR) |
| `'metaValue'` | `metaValue` decrescente |
| `'createdAt'` | `createdAt` decrescente |
| `'updatedAt'` | `updatedAt \|\| createdAt` decrescente |

Filtro por aba: `pendentes` → `!completed`; `concluidas` → `completed`.

---

### 11.11 Lançamentos parcelados e recorrentes

**Validação de parcelas:**
```
total   = parseInt(installmentTotal)   // mínimo 2
current = parseInt(installmentCurrent) // 1 <= current <= total
```

**Data do lançamento:**
```
isCurrentPeriod = selectedMonth === mês atual E selectedYear === ano atual
date = isCurrentPeriod ? agora : new Date(selectedYear, selectedMonth-1, 1, 12:00)
```

**Clone de recorrentes (`recurrenceService.persistMissingRecurrences`):**

```
para cada transação isRecurring (raiz) do usuário:
  para cada mês faltante até o mês atual:
    buildRecurrenceClone → addTransaction no Firestore
```

Clones são **persistidos** via `addTransaction`; o App recarrega transações após o efeito.

---

### 11.12 Alertas rápidos no Hub

| Condição | Mensagem |
|----------|----------|
| `totalExpense / totalIncome > 0.8` | Gastos acima de 80% das receitas |
| Algum `budgetStats.percent > 100` | Categoria(s) estouraram orçamento |
| `ruleStats.savingsPct >= 20` | Poupança acima de 20% |
| Senão | Sugestão para chegar a 20% |
| Sempre | Fechamento estimado = `forecast.forecastAmount` |

---

## 12. Assistente (chatbot)

Implementação: `useChatAssistant` + `ChatAssistant.jsx`; parser em `chatParser.js`.

### Detecção de voz

```
hasSpeechSupport = window.SpeechRecognition || window.webkitSpeechRecognition
```

**`handleVoiceToggle()`:** Web Speech API, `lang = 'pt-BR'`, preenche `chatInput` com transcrição.

### Intents de consulta (`processChatMessage`)

| Padrão (regex) | Resposta |
|----------------|----------|
| saldo, dinheiro, quanto tenho | Saldo do período |
| gasto, despesa, saída | Total de despesas |
| receita, entrada (sem número) | Total de receitas |
| maior gasto, mais caro | Top categoria |
| previsão, projeção | Resultado de `calculateForecast()` |
| resumo, balanço, como estou | Receitas, despesas, saldo, % |
| ajuda, comandos | Lista de capacidades |
| categoria, quais categorias | Lista de categorias de despesa |

### Extração de lançamento

1. **Valor:** regex `(?:r\$)?\s?(\d+(?:[.,]\d{1,3})?)\s?(k|mil)?` — sufixo `k`/`mil` × 1000
2. **Data relativa:** `ontem`, `anteontem`, dias da semana
3. **Descrição:** texto limpo removendo valor, stopwords e datas
4. **Tipo:** palavras-chave de receita → `income`; senão `expense`
5. **Categoria:** `categoryDetection.js` (regex + categorias customizadas; mesma lógica do import PDF)
6. **Alerta de orçamento:** se gasto projetado ultrapassa 80% ou 100% do limite

### Confirmação

- Resposta `type: 'action'` → entra em `pendingActions`
- Usuário confirma com `sim`/`s` → `handleChatConfirm` → `addTransaction` (com `activeProjectId`)
- Correção de valor ou campos antes de confirmar suportada

---

## 13. Insights mensais

**`buildMonthlyInsightContext(month, year)`:**
```
income  = Σ receitas do mês
expense = Σ despesas do mês
balance = income - expense
topCategory = categoria com maior gasto
```

**`generateAIInsight(month, year, projectId?)`:**
1. Verifica cache em `insights/{uid}_{scope}_{month}_{year}`
2. Se sem dados → mensagem padrão
3. Gera texto por **template** (não chama LLM externa)
4. Salva no cache

Disparado no login quando muda o mês (`localStorage: karonte_last_insight_{uid}`).

---

## 14. Exportação de relatório

**`exportToCSV()`**

- Exporta apenas `filteredTransactions` (período selecionado)
- Colunas: `Data`, `Descrição`, `Categoria`, `Tipo`, `Valor`
- Separador: `;`
- BOM UTF-8 (`\uFEFF`)
- Nome: `karonte_export_{mês}_{ano}.csv`
- Download via `<a>` temporário

---

## 15. PWA e deploy

### Configuração (`vite.config.js`)

- `vite-plugin-pwa` com `registerType: 'autoUpdate'`
- Manifest: `standalone`, `pt-BR`, tema `#0b1018`
- Workbox: cache de assets; `navigateFallback: index.html`
- Ícones: 192, 512, maskable 512

### Deploy

| Plataforma | Fluxo |
|------------|-------|
| **Vercel** | Push em `master` → build automático (`npm run build`) |
| **URL produção** | https://karonte-nu-blue.vercel.app |

### Instalação mobile

- **Android:** Chrome → "Instalar app"
- **iOS:** Safari → "Adicionar à Tela de Início"

---

## 16. Capacitor (Android)

| Item | Valor |
|------|-------|
| App ID | `com.karonte.app` |
| Web dir | `dist` |
| Projeto | `android/` |

**Build para Android:**
```bash
npm run build
npx cap sync android
npx cap open android
```

> `capacitor.config.json` pode conter `server.url` apontando para dev local — remover para build de produção.

---

## 17. Variáveis de ambiente

Arquivo: `.env.local` (não versionado)

| Variável | Uso |
|----------|-----|
| `VITE_FIREBASE_API_KEY` | API Key Firebase |
| `VITE_FIREBASE_AUTH_DOMAIN` | Domínio Auth |
| `VITE_FIREBASE_PROJECT_ID` | ID do projeto |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Sender ID |
| `VITE_FIREBASE_APP_ID` | App ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Analytics (opcional) |

**Vercel:** configurar as mesmas variáveis no painel do projeto para o build de produção.

**Firebase Auth:** adicionar domínio Vercel em *Authorized domains*.

---

## 18. Scripts npm

| Script | Comando | Descrição |
|--------|---------|-----------|
| `dev` | `vite` | Servidor de desenvolvimento |
| `build` | `generate:pwa-icons && vite build` | Build produção + ícones PWA |
| `generate:pwa-icons` | `node scripts/generate-pwa-icons.mjs` | Gera PNGs em `public/` |
| `lint` | `eslint .` | Linting |
| `preview` | `vite preview` | Preview do build local |

---

## 19. Limitações e pendências conhecidas

| Item | Detalhe |
|------|---------|
| `insights` sem regra Firestore | Cache de insights pode falhar com "permission denied" |
| `createNotification` não usado | Convites exibidos via coleção `invites`, não `notifications` |
| Recorrentes só em memória | Clones no login não persistem no Firestore automaticamente |
| `authUsername` no registro | Campo coletado na UI mas não enviado a `register()` |
| Modais mortos | `inviteModalProject` e `projectToRename` existem no JSX sem gatilho de abertura |
| Reconhecimento de voz | Depende do navegador; `onend` pode ler `chatInput` desatualizado (stale closure) |
| `insights` / LLM | Insights são template fixo, não IA real |
| Capacitor dev server | `server.url` no config aponta IP local — inadequado para loja |
| iOS | Projeto Capacitor iOS não criado |
| PDF de extrato Nubank (saldos) | Formato diário não é ideal; preferir **CSV/OFX** do e-mail |
| PDF de nota fiscal | Extração heurística; preferir **XML NF-e** para precisão |

---

## 20. Importações (extratos e notas fiscais)

### Fluxo de extrato

1. Usuário seleciona arquivos na aba **Extrato**
2. `processStatementFiles` extrai transações (parser por formato)
3. `markDuplicates` compara com lançamentos existentes
4. Usuário revisa, edita e seleciona linhas
5. Cada linha vira `addTransaction` com `source: 'statement_import'` e `importBatchId`
6. `saveImportBatch` registra importadas, ignoradas e falhas
7. Desfazer: `deleteTransactionsByIds` + `markImportBatchUndone`

### Formatos de extrato

| Formato | Parser | Observação |
|---------|--------|------------|
| PDF | `statementParser.js` + pdfjs | Texto selecionável; sem OCR |
| CSV | `structuredStatementParser.js` | Nubank conta/fatura, delimitador `,` ou `;` |
| XLS/XLSX | `structuredStatementParser.js` + xlsx | Primeira planilha |
| OFX | `structuredStatementParser.js` | Blocos `STMTTRN` |

### Fluxo de nota fiscal

1. Upload **XML NF-e** (recomendado) ou **PDF DANFE**
2. `invoiceParser.js` extrai emitente, valor, data, itens, chave
3. Arquivo original é **descartado** após extração
4. Usuário define descrição da compra e categoria
5. Salva `purchaseInvoices` + despesa com `invoiceId` e `source: 'invoice_import'`

### Histórico

Coleção `importBatches` permite ver, por lote:

- Quantas transações foram **importadas**
- Quais ficaram **fora** (não selecionadas, duplicadas, erro)
- **Desfazer** importação (requer `canDeleteInProject` em projetos compartilhados)

### Deploy

Após atualizar o app, publique as regras Firestore:

```bash
firebase deploy --only firestore:rules
```

---

## Apêndice A — Handlers principais em `App.jsx`

| Handler | Função |
|---------|--------|
| `handleAuth` | Login / registro |
| `handleLogout` | Logout + limpa estado |
| `handleAddTransaction` | Novo lançamento |
| `handleDelete` | Excluir lançamento |
| `handleCreateProject` | Criar projeto |
| `handleConfirmDeleteProject` | Excluir projeto |
| `handleRenameProject` | Renomear projeto |
| `handleSaveTask` | Criar/editar tarefa |
| `handleToggleTaskComplete` | Marcar concluída |
| `handleDeleteTask` | Excluir tarefa |
| `handleAddPayment` | Abater despesa |
| `handleSendInvite` | Enviar convite |
| `handleAcceptInvite` / `handleRejectInvite` | Convites |
| `handleConfirmBudget` | Salvar limite de categoria |
| `handleAddCustomCategory` / `handleRemoveCustomCategory` | Categorias |
| `handleCreateCreditCard` / `handleDeleteCreditCard` | Cartões |
| `calculateForecast` | Previsão de gastos |
| `getCategoryBudgetInfo` | % orçamento por categoria |
| `getCardInvoiceStats` | Fatura do cartão |
| `exportToCSV` | Download relatório |
| `handleStatementImport` | Salva transação importada de extrato |
| `handleImportBatchComplete` | Persiste lote em `importBatches` |
| `handleSaveInvoice` | Nota fiscal + despesa vinculada |
| `handleUndoImport` | Desfaz lote de importação |
| `processChatMessage` | NLP do assistente |
| `handleChatSubmit` / `handleChatConfirm` / `handleChatCancel` | Fluxo do chat |
| `handleVoiceToggle` | Entrada por voz |
| `generateAIInsight` | Insight mensal |
| `handleToggleUserStatus` | Admin: bloquear usuário |
| `handleSaveUsername` | Admin: editar username |
| `handleSendPasswordReset` | Admin: reset senha |
| `handleChangeOwnPassword` | Admin: própria senha |

---

## Apêndice B — `useEffect` e carregamento de dados

| Dependências | Ação |
|--------------|------|
| `[theme]` | Persiste tema em `localStorage('finance_theme')` |
| `[]` | `onAuthStateChanged` — sessão Firebase |
| `[currentUser]` | Projetos, convites, notificações |
| `[currentUser, activeProjectId]` | Tarefas do projeto |
| `[currentUser, activeProjectId, projects]` | Transações, orçamentos, categorias, cartões, usuários (admin) |
| `[currentUser]` (2º) | `persistMissingRecurrences` para lançamentos recorrentes |
| `[chatOpen, transactions]` | Alerta proativo de previsão alta no chat |
| `[currentUser, transactions.length, dataLoading]` | Insight mensal automático |

---

## 21. Refatoração em andamento (prioridades técnicas)

### Fase 1 — Concluída

| Item | Implementação |
|------|----------------|
| Cálculos extraídos | `src/utils/financeCalculations.js`, `money.js`, `taskCalculations.js` |
| Hooks | `usePermissions`, `useFinanceDerived` |
| Testes | Vitest — `npm run test` |
| Recorrências | `recurrenceService.js` persiste clones no Firestore |
| Regras Firestore | `insights` liberado por UID; papéis `view`/`add`/`manage`/`owner` em transações, tarefas, orçamentos e cartões |
| Categorias com ID | `categoryModel.js` — migração automática no `getUserCategories` |
| ErrorBoundary | `src/components/ErrorBoundary.jsx` |
| Registro | `authUsername` enviado ao `register()` |
| Insights | Renomeado para `generateMonthlyInsight` (ainda template, não LLM) |

### Fase 2 — Concluída

| Item | Implementação |
|------|----------------|
| Views extraídas | `src/views/` — `LoadingView`, `AuthView`, `AdminApp`, `UserSettingsView`, `ProjectSettingsView`, `BudgetsView`, `TasksView` |
| `categoryId` nas transações | `buildTransactionCategoryFields()` e `resolveCategoryForTransaction()` em `categoryModel.js`; usado em `handleAddTransaction` e `handleChatConfirm` |
| Snapshot de categoria | Transações gravam `categoryId`, `categoryName` e `category` (nome legado) |
| Labels em relatórios | `getTransactionCategoryLabel()` prioriza `categoryName` |
| Testes | 21 testes Vitest (`financeCalculations`, `categoryDetection`, `budgetModel`, recorrências) |

### Fase 3 — Concluída (exceto 3.6 infra)

| Item | Implementação |
|------|----------------|
| Limpeza modais mortos | Convite/rename só em `ProjectSettingsView` (3.1) |
| Chat extraído | `chatParser.js`, `useChatAssistant`, `ChatAssistant` (3.2) |
| Layout | `MainShell`, `ProjectSelectorDropdown`, `NotificationsDropdown` (3.3) |
| Orçamentos v2 | `budgetModel.js`, `limits` + `limitsByName`, migração em `budgetService` (3.4) |
| Modais | `src/components/modals/*` (3.5) |
| Categorias compartilhadas | Leitura do dono; `canEditCategories` para edição |
| Tarefas de projeto | `getProjectTasks(projectId)` — todos os membros |
| Detecção de categoria | `categoryDetection.js` (chat + importações) |
| `App.jsx` | ~1.380 linhas (orquestração: auth, fetch, handlers, composição) |

### Pendente (Fase 3.6+)

Roadmap: [`docs/reimplementacao/08-FASE-3.md`](docs/reimplementacao/08-FASE-3.md)  
Status: [`docs/reimplementacao/07-STATUS.md`](docs/reimplementacao/07-STATUS.md)

| Item | Status |
|------|--------|
| Centralizar UI de notificações | Pendente (3.6) |
| `dueDate` em tarefas | Pendente (3.6) |
| Export PDF/Excel | Pendente (3.6) |
| Cloud Functions para recorrências | Pendente (3.6) |
| Sentry / Analytics | Pendente (3.6) |
| iOS Capacitor / remover `server.url` dev | Pendente (3.6) |
| Mover `HubView` para `views/` | Opcional |

### Estrutura atual de `src/`

```
src/
├── constants/categories.js
├── hooks/
│   ├── useFinanceDerived.js
│   ├── usePermissions.js
│   └── useChatAssistant.js
├── views/
│   ├── MainShell.jsx
│   ├── AdminApp.jsx, AuthView.jsx, BudgetsView.jsx
│   ├── LoadingView.jsx, ProjectSettingsView.jsx
│   ├── TasksView.jsx, UserSettingsView.jsx
├── components/
│   ├── HubView.jsx, TransactionDrawer.jsx, ChatAssistant.jsx
│   ├── ImportHubView.jsx, StatementImportView.jsx, InvoiceImportView.jsx
│   ├── ImportHistoryView.jsx
│   ├── ProjectSelectorDropdown.jsx, NotificationsDropdown.jsx
│   ├── ErrorBoundary.jsx
│   └── modals/ (Budget, Project, Task, Payment, DeleteProject)
├── utils/
│   ├── categoryModel.js, budgetModel.js, categoryDetection.js
│   ├── chatParser.js, financeCalculations.js, money.js
│   ├── taskCalculations.js, statementParser.js, structuredStatementParser.js
│   ├── invoiceParser.js
│   └── __tests__/ (Vitest)
├── services/ (auth, transactions, budgets, categories, statementImport, importBatch, purchaseInvoice, …)
└── App.jsx (~1.380 linhas)
```

