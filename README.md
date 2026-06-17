# Karonte

Controle financeiro pessoal e compartilhado — React + Firebase + PWA.

**Produção:** https://karonte-nu-blue.vercel.app

## Documentação

Consulte **[DOCUMENTACAO.md](./DOCUMENTACAO.md)** para a referência completa do projeto:

- Estrutura organizacional e arquitetura
- Todas as funcionalidades e telas
- Modelo de dados Firestore
- Regras de segurança
- Cálculos e fórmulas (orçamentos, previsão, 50-30-20, parcelas, cartões)
- Serviços, permissões, chatbot, PWA e deploy

**Reimplementação / roadmap técnico:** [`docs/reimplementacao/`](./docs/reimplementacao/) — status em [07-STATUS.md](./docs/reimplementacao/07-STATUS.md), próximas fases em [08-FASE-3.md](./docs/reimplementacao/08-FASE-3.md).

## Desenvolvimento local

```bash
npm install
cp .env.example .env.local   # preencher credenciais Firebase
npm run dev
```

## Build

```bash
npm run build
```
