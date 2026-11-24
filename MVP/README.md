# IFCE Iventus — Gestão de Eventos Científicos e Acadêmicos

Plataforma institucional para gerenciamento de eventos científicos, inscrições, controle de frequência, aprovação exclusiva de professores, verificação simulada de e-mail para participantes e emissão/validação pública de certificados digitais com geração de PDF.

## Regras de Perfis e Autenticação

- **Professor (`PROFESSOR`)**: Cadastro permanece com status `PENDENTE` aguardando aprovação administrativa na aba *Aprovação e Gestão de Usuários*. Professores pendentes ou rejeitados são bloqueados pelo backend (`403`) e não acessam áreas restritas.
- **Participante (`PARTICIPANTE`)**: Não passa por aprovação administrativa. Após o cadastro, conclui a **verificação de e-mail simulada (demonstração)** no próprio sistema — sem dependência de servidor externo de e-mail — mantendo o status persistido no servidor após atualizar a página ou fazer logout/login.
- **Administrador (`ADMINISTRADOR`)**: Aprovação e rejeição exclusivamente para solicitações de professores (a aba de "Solicitações de Inscrição" foi removida do painel administrativo, mantendo as inscrições nos eventos funcionando normalmente).

## Stack Tecnológica

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons, jsPDF
- **Backend / API:** Node.js + Express consolidado (`src/server/apiApp.ts`), compatível com execução local (`server.ts`) e função serverless única no Vercel (`api/index.ts`)
- **Banco de Dados:** PostgreSQL externo (`pg`) — compatível com Neon, Supabase, Render ou Vercel Postgres
- **E-mail Transacional (recuperação de senha):** Resend API ou SMTP via Nodemailer (com fallback Ethereal Sandbox apenas em desenvolvimento/preview)

## Estrutura do Projeto

```text
.
├── api/
│   └── index.ts              # Entrypoint serverless único no Vercel (/api/:path*)
├── database/
│   ├── schema.postgres.sql   # Script completo de criação/migração PostgreSQL
│   └── schema.sql            # Referência estrutural legada
├── src/
│   ├── components/           # Interface React (auth, layout, modals, views, common)
│   ├── lib/
│   │   └── db.ts             # Pool PostgreSQL singleton + schema auto-init
│   ├── server/               # Serviços e roteador da API (auth, events, email, session, http, rateLimit)
│   ├── services/
│   │   └── store.ts          # Gerenciamento reativo de estado sincronizado com a API
│   ├── types/                # Tipagens TypeScript compartilhadas
│   ├── utils/                # Gerador de PDF de certificados
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── .env.example              # Modelo de variáveis de ambiente (sem segredos)
├── .gitignore
├── index.html
├── metadata.json
├── package.json
├── server.ts                 # Servidor local/Node tradicional na porta 3000
├── tsconfig.json
├── vercel.json               # Roteamento SPA + Serverless para Vercel
└── vite.config.ts
```

## Execução Local (Windows / PowerShell)

1. **Instale as dependências:**
   ```powershell
   npm install
   ```

2. **Configure as variáveis de ambiente:**
   Copie `.env.example` para `.env`:
   ```powershell
   Copy-Item .env.example .env
   ```
   Preencha no `.env` a string de conexão PostgreSQL (`DATABASE_URL`) e um segredo aleatório forte em `AUTH_SECRET` (mínimo 32 caracteres).

3. **Inicie o servidor de desenvolvimento (Frontend + API na porta 3000):**
   ```powershell
   npm run dev
   ```
   Para simular sem PostgreSQL apenas localmente, mantenha `DATABASE_URL` vazio ou defina `ENABLE_DEMO_MODE=true`.

4. **Verificação de qualidade e build de produção:**
   ```powershell
   npm run lint
   npm run build
   ```

## Deploy no Vercel

1. Suba este repositório para sua nova conta no **GitHub**.
2. Importe o repositório na sua nova conta **Vercel** deixando o **Root Directory** como `.` (raiz).
3. Configure as variáveis de ambiente obrigatórias no painel da Vercel (**Settings → Environment Variables**):
   - `DATABASE_URL`: URL de conexão do seu banco PostgreSQL externo (com SSL).
   - `AUTH_SECRET`: Chave secreta aleatória com pelo menos 32 caracteres para assinatura de sessões.
   - `RESEND_API_KEY` (ou `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) + `EMAIL_FROM`: Opcional para recuperação de senha por e-mail (a verificação simulada dos participantes funciona localmente sem serviço externo).
   - `APP_URL`: URL pública do seu projeto no Vercel (ex.: `https://seu-projeto.vercel.app`).
4. Faça o **Deploy** e acesse a aplicação. Caso o banco esteja vazio (sem administradores cadastrados), a tela inicial exibirá automaticamente o formulário de **Configuração Inicial** para cadastrar a primeira conta de Administrador com segurança.
