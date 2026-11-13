# STACK — Karonte

Retrato técnico atualizado em **13/11/2026**. Produto no `README.md`; detalhes extensos no `DOCUMENTACAO.md`.

## 1. Visão geral

```
  Navegador / PWA (React 19 + Vite 8)  ◀── Capacitor 8 (WebView Android)
        │  SDK Firebase web
        ├── Firebase Auth (e-mail/senha)
        └── Cloud Firestore  (users, projetos, transações, orçamentos, cartões, importações...)
               ▲ regras: firestore.rules (RBAC por usuário ativo / admin / papel no projeto)
  Importações: parsing 100% no cliente (PDF via pdfjs-dist, planilhas via xlsx, OFX/CSV/XML próprios)
```

## 2. Tecnologias (package.json)

| Item | Tecnologia |
|---|---|
| UI | **React ^19.2.4** (ESM) |
| Build/dev | **Vite ^8**, `vite-plugin-pwa ^1.3` (service worker/Workbox), `sharp` para gerar ícones PWA |
| Gráficos | `recharts ^3.8` |
| Backend como serviço | `firebase ^12.10` (Auth + Firestore) |
| Importação | `pdfjs-dist ^6`, `xlsx ^0.18.5` |
| Mobile | `@capacitor/core`, `cli`, `android` ^8.2 (appId `com.karonte.app`, `webDir: dist`) |
| Testes | **Vitest ^3.2** + `jsdom` (`src/utils/__tests__`, `vitest.setup.js`) |
| Lint | ESLint 9 (`react-hooks`, `react-refresh`) |

## 3. Fontes de dados

Firestore (modelo detalhado no `DOCUMENTACAO.md`, seção 5) com cache local por escopo, consultas por janela de datas, escrita em
batch e deduplicação por fingerprint nas importações. Arquivos importados são lidos no navegador; amostras sintéticas em `fixtures/`.

## 4. Ambientes e deploy

- Dev: `npm run dev` (porta padrão do Vite 5173).
- Produção web: hospedagem estática (Vercel; `.vercel` ignorado pelo git). Regras e índices do Firestore via `firebase deploy`.
- Android: `npx cap sync android` e abrir no Android Studio.

## 5. Comandos

`npm run dev` · `npm run build` (gera ícones PWA + build) · `npm run preview` · `npm test` · `npm run test:watch` · `npm run lint` ·
`npm run generate:pwa-icons`.

## 6. Variáveis de ambiente (`.env.local`, só os nomes)

`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
`VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID`.

## 7. Dependências a observar

`xlsx ^0.18.5` (versão do npm, sem atualizações; avaliar riscos ao processar arquivos de terceiros). `sharp` só em dev, para ícones.

## 8. Restrições conhecidas

- `capacitor.config.json` aponta `server.url` para um servidor de desenvolvimento na rede local (cleartext): serve só para testes,
  precisa ser removido para gerar um app de produção.
- Pendências funcionais listadas na seção 19 do `DOCUMENTACAO.md` (ex.: coleção `insights` sem regra, iOS não criado).
- `App.jsx` ainda concentra muita lógica (refatoração em andamento).
- Arquivos `tmp*.txt` na raiz são resíduos de logs de git: não fazem parte do app.
- Projeto no Google Drive: `npm install` pode corromper pacotes; instalar em pasta temporária em `C:` e copiar de volta.

## 9. Manter atualizado

Atualize ao mudar tecnologia, dependência, fonte de dados, porta ou deploy.
