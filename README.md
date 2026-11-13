# Karonte

Controle financeiro pessoal e compartilhado, em **React + Firebase + PWA**, com casca Android via Capacitor. Projeto pessoal:
lançamentos, orçamentos, cartões, projetos compartilhados (família/grupo) e importação de extratos e notas fiscais.

## Funcionalidades

| Área | Recursos |
|------|----------|
| **Finanças** | Lançamentos de receita/despesa, categorias, orçamentos, cartões, regra 50-30-20, exportação CSV |
| **Projetos** | Compartilhamento com colaboradores (papéis), tarefas, modo família |
| **Importações** | Extratos PDF/CSV/XLS/OFX, notas fiscais XML/PDF, histórico e desfazer lote, deduplicação por fingerprint |
| **Analytics** | Fluxo de caixa projetado, comparador de períodos, detector de vazamentos |
| **Extras** | Calendário financeiro, assinaturas, simulador de economia, feed de atividades |
| **Assistente** | Chatbot com NLP simples e voz para registrar e consultar finanças |
| **Administração** | Painel admin (bloqueio de usuários, reset de senha) |
| **Mobile** | PWA instalável + Capacitor Android |

## Documentação

- **[DOCUMENTACAO.md](./DOCUMENTACAO.md)**: referência completa (arquitetura, modelo Firestore, regras, telas, cálculos, importações, PWA, Capacitor).
- [docs/firestore-indexes.md](./docs/firestore-indexes.md): índices do Firestore.
- [docs/reimplementacao/](./docs/reimplementacao/): roadmap técnico (status em `07-STATUS.md`).
- [STACK.md](./STACK.md): retrato técnico.

## Como instalar e rodar

Pré-requisito: Node.js 20+ e um projeto Firebase (Auth + Firestore).

```bash
npm install
cp .env.example .env.local   # preencha as variáveis VITE_FIREBASE_*
npm run dev
```

Em modo DEV o app mostra logs `[Firestore READ/WRITE/QUERY]` e um painel de uso do Firestore para auditar consultas.

```bash
npm run test     # Vitest
npm run lint
npm run build    # gera os ícones PWA e o build de produção
```

Regras e índices: `firebase deploy --only firestore:rules` e `firebase deploy --only firestore:indexes`.

Android: `npm run build`, `npx cap sync android`, `npx cap open android`.

## Estrutura de pastas

```
src/
  App.jsx           orquestração (auth, estado global, handlers)
  views/            telas (Hub, orçamentos, calendário, assinaturas, analytics, admin, configurações...)
  components/       Hub, chat, importações, drawers, modais
  services/         acesso ao Firestore por domínio (transações, projetos, cartões, importações...)
  utils/            cálculos, parsers de extrato/nota, deduplicação, cache, previsão (com __tests__)
  hooks/ · constants/ · config/firebase.js
android/            projeto Capacitor Android
fixtures/           amostras sintéticas para testar importações
scripts/            geração de ícones PWA
docs/               índices e roadmap técnico
firestore.rules · firestore.indexes.json · capacitor.config.json
```

## Status

Em uso e evolução (refatoração de `App.jsx` e RBAC em andamento; ver `docs/reimplementacao/07-STATUS.md`). Pendências conhecidas
estão na seção 19 do `DOCUMENTACAO.md`. Projeto privado de uso pessoal.
