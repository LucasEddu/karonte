# Firestore RBAC (reimplementado)

Funcoes adicionadas sobre a base do GitHub:

- `projectRole(projectId)` — owner | view | add | manage
- `canAddInProject(projectId)` — owner, add ou manage
- `canDeleteInProject(projectId)` — owner ou manage
- `canManageProject(projectId)` — apenas owner

## Regras alteradas vs GitHub

| Recurso | GitHub | Local |
|---------|--------|-------|
| transactions create/update | membro do projeto | `canAddInProject` |
| transactions delete | membro do projeto | `canDeleteInProject` |
| tasks | read/write generico | create/update/delete por permissao |
| creditCards (projeto) | membro | `canManageProject` |
| insights | (nao existia) | docId = `{uid}_*` |

Deploy: `firebase deploy --only firestore:rules`
