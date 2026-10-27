import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { registerUser, getPendingUsers, moderateUserAccount } from './src/server/authService';
import { initPostgresSchema, query, isConfiguredWithRealDatabase, inMemoryUsers } from './src/lib/db';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // CORS headers for local / cross-origin testing
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Verify and initialize PostgreSQL database schema safely on boot
  initPostgresSchema().catch((err) => {
    console.warn('[DATABASE BOOTSTRAP NOTICE]:', err.message);
  });

  // Healthcheck endpoint
  app.get('/api/health', async (req, res) => {
    if (!isConfiguredWithRealDatabase) {
      return res.status(200).json({
        status: 'online',
        database: 'preview_mode',
        target: 'Render PostgreSQL',
        message:
          'Servidor ativo. Modo preview ativado. Ao configurar a DATABASE_URL real do Render na Vercel, o PostgreSQL conectará automaticamente.',
        total_usuarios: inMemoryUsers.length,
      });
    }

    try {
      const startTime = Date.now();
      const result = await query('SELECT NOW() as current_time, count(*)::int as total_usuarios FROM usuario');
      const latency = Date.now() - startTime;
      return res.status(200).json({
        status: 'online',
        database: 'connected',
        target: 'Render PostgreSQL',
        latency: `${latency}ms`,
        server_time: result.rows[0]?.current_time,
        total_usuarios: result.rows[0]?.total_usuarios,
        database_url_configured: true,
      });
    } catch (err: any) {
      console.warn('[API HEALTH NOTICE]: PostgreSQL em espera ou hibernando:', err.message);
      return res.status(503).json({
        status: 'warning',
        database: 'sleeping_or_unreachable',
        error: err.message,
        code: err.code,
        database_url_configured: true,
        hint: 'A instância do Render pode estar em modo de espera (plano gratuito) ou inicializando. Aguarde alguns instantes.',
      });
    }
  });

  // Register endpoint
  app.post('/api/auth/register', async (req, res) => {
    const { nome, email, senha, perfil, matricula, telefone, materias } = req.body || {};

    try {
      console.log('[EXPRESS /api/auth/register] Recebido cadastro para:', email);
      const result = await registerUser({
        nome,
        email,
        senha,
        perfil,
        matricula,
        telefone,
        materias,
      });
      console.log('[EXPRESS /api/auth/register] Sucesso, ID criado:', result.user?.id_usuario, 'Armazenamento:', result.storage);
      return res.status(201).json(result);
    } catch (error: any) {
      console.warn('[EXPRESS /api/auth/register NOTICE]:', error.message);
      const statusCode = error.statusCode || (error.code === '23505' ? 409 : 500);
      const message =
        error.code === '23505'
          ? 'Já existe um usuário cadastrado com estes dados (e-mail ou matrícula já em uso).'
          : error.message || 'Erro ao gravar usuário no PostgreSQL.';

      return res.status(statusCode).json({
        success: false,
        message,
        errorCode: error.code || 'DB_ERROR',
      });
    }
  });

  // List pending users
  app.get('/api/users/pending', async (req, res) => {
    try {
      const users = await getPendingUsers();
      return res.json({ success: true, users });
    } catch (error: any) {
      console.warn('[API GET /api/users/pending NOTICE]:', error.message);
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  // Moderate user account
  app.patch('/api/users/:id/status', async (req, res) => {
    const idUsuario = parseInt(req.params.id, 10);
    const { status } = req.body;
    try {
      const updated = await moderateUserAccount(idUsuario, status);
      return res.json({ success: true, user: updated });
    } catch (error: any) {
      console.warn('[API PATCH /api/users/:id/status NOTICE]:', error.message);
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({ success: false, message: error.message });
    }
  });

  // Vite dev server or static dist serving
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[IVENTUS SERVER] Rodando na porta ${PORT} (modo ${isProduction ? 'produção' : 'desenvolvimento'})`);
  });
}

startServer().catch((err) => {
  console.warn('[FATAL SERVER START ERROR]:', err);
});
