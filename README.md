# Karonte

Controle financeiro pessoal e compartilhado — React + Firebase + PWA.

**Produção:** https://karonte-nu-blue.vercel.app

## Funcionalidades

| Área | Recursos |
|------|----------|
| **Finanças** | Lançamentos, orçamentos, cartões, regra 50-30-20, exportação CSV |
| **Projetos** | Compartilhamento com colaboradores, tarefas, modo família |
| **Importações** | Extratos PDF/CSV/XLS/OFX, notas fiscais XML/PDF, histórico e desfazer lote |
| **Analytics** | Fluxo de caixa, comparador de períodos, detector de vazamentos |
| **Extras** | Calendário financeiro, assinaturas, simulador de economia, feed de atividades |
| **Assistente** | Chatbot com NLP e voz para registrar e consultar finanças |
| **Mobile** | PWA instalável + Capacitor Android |

## Documentação

Consulte **[DOCUMENTACAO.md](./DOCUMENTACAO.md)** — referência completa:

- Arquitetura, modelo de dados Firestore e regras de segurança
- Todas as telas, serviços e fluxos de usuário
- Importações, deduplicação, fingerprint e performance Firestore
- Cálculos (orçamentos, previsão, 50-30-20, parcelas, cartões, analytics)
- Chatbot, PWA, Capacitor e deploy

**Índices Firestore:** [`docs/firestore-indexes.md`](./docs/firestore-indexes.md)

**Roadmap técnico:** [`docs/reimplementacao/`](./docs/reimplementacao/) — status em [07-STATUS.md](./docs/reimplementacao/07-STATUS.md)

## Desenvolvimento local

```bash
npm install
cp .env.example .env.local   # preencher credenciais Firebase
npm run dev
```

Em modo DEV, o app exibe logs `[Firestore READ/WRITE/QUERY]` e o painel `FirestoreUsageDebugPanel` para auditar consultas.

## Testes e build

```bash
npm run test    # Vitest
npm run build   # Build de produção (PWA)
npm run lint
```

## Deploy Firebase

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

## Android (Capacitor)

```bash
npm run build
npx cap sync android
npx cap open android
```

## Stack

React 19 · Vite 8 · Firebase 12 · Recharts · Capacitor 8 · vite-plugin-pwa

## Licença

Projeto privado.
