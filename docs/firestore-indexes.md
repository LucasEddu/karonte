# Índices Firestore — Karonte

Este documento lista as consultas otimizadas e os índices compostos necessários.

## Como criar

1. Copie `firestore.indexes.json` na raiz do projeto Firebase.
2. Execute:

```bash
firebase deploy --only firestore:indexes
```

Ou crie manualmente no [Console Firebase](https://console.firebase.google.com) → Firestore → Índices, quando o erro indicar um link.

## Consultas de transações

| Função | Filtros | Índice |
|--------|---------|--------|
| `getTransactionsForDateWindow` (Geral) | `userId` + `date` range + `orderBy date` | `userId ASC, date DESC` |
| `getTransactionsForDateWindow` (Projeto) | `projectId` + `date` range + `orderBy date` | `projectId ASC, date DESC` |
| `getRecentTransactions` | `userId` ou `projectId` + `orderBy date` | mesmo acima |
| `getTransactionsByImportBatchId` | `importBatchId` | automático (single field) |

## Consultas de importBatches

| Função | Filtros | Índice |
|--------|---------|--------|
| `getImportBatchesForScope` (Geral) | `userId` + `orderBy importedAt` | `userId ASC, importedAt DESC` |
| `getImportBatchesForScope` (Projeto) | `projectId` + `orderBy importedAt` | `projectId ASC, importedAt DESC` |

## Índices futuros (opcionais)

Se deduplicação passar a consultar Firestore por hash:

- `userId + duplicateHash`
- `projectId + duplicateHash`

Atualmente a deduplicação é **100% local** após buscar a janela de datas.

## Debug em desenvolvimento

Com `import.meta.env.DEV`, o console exibe:

- `[Firestore READ]` / `[Firestore WRITE]` / `[Firestore QUERY]`
- Painel flutuante `FirestoreUsageDebugPanel` no app

Use para identificar picos de leitura após importações grandes.
