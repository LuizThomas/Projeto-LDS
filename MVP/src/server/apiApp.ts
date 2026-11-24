import express, { Request, Response, NextFunction } from 'express';
import {
  query,
  isConfiguredWithRealDatabase,
  isDemoModeEnabled,
  isProductionEnvironment,
  isSchemaReady,
  ensurePostgresSchema,
} from '../lib/db';
import { getConfiguredEmailProvider } from './emailService';
import { applyCorsAndSecurityHeaders, resolveRequestOrigin } from './http';
import { checkRateLimit, getClientIp, isBotHoneypotTriggered } from './rateLimit';
import { clearSessionCookie, isAuthSecretConfigured, setSessionCookie } from './session';
import {
  bootstrapFirstAdmin,
  changeOwnPassword,
  confirmPasswordReset,
  getAllUsersAdmin,
  getBootstrapStatus,
  getProfessorRequests,
  loginUser,
  moderateProfessorRequest,
  registerUser,
  requestPasswordReset,
  requireAdminUser,
  requireAuthenticatedUser,
  requireStaffUser,
  resendVerificationEmail,
  updateOwnProfile,
  updateUserStatusAdmin,
  verifyEmailCode,
  verifyEmailToken,
} from './authService';
import {
  cancelEventInscription,
  createEvent,
  getEventInscriptionsForAttendance,
  getWorkspaceDataForUser,
  inscribeInEvent,
  issueCertificate,
  moderateCertificate,
  setOrToggleAttendance,
  toggleUserFavorite,
  updateEvent,
  validateCertificateCode,
} from './eventsService';

function sendError(res: Response, err: any, fallbackMessage: string) {
  const status = err?.statusCode || 500;
  if (status >= 500) {
    console.error('[API ERROR]:', err);
  }
  return res.status(status).json({
    success: false,
    message: err?.message || fallbackMessage,
    errorCode: err?.errorCode,
    email: err?.email,
    retryAfterSeconds: err?.retryAfterSeconds,
  });
}

export const apiRouter = express.Router();

apiRouter.use((req: Request, res: Response, next: NextFunction) => {
  applyCorsAndSecurityHeaders(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  return next();
});

apiRouter.use((req: Request, res: Response, next: NextFunction) => {
  if (req.readableEnded && req.body !== undefined) {
    return next();
  }
  return express.json({ limit: '3mb' })(req, res, next);
});

// 1. Health & Diagnostics
apiRouter.get('/health', async (_req: Request, res: Response) => {
  let dbReachable = false;
  let dbError: string | null = null;

  if (isConfiguredWithRealDatabase) {
    try {
      await ensurePostgresSchema();
      await query('SELECT 1');
      dbReachable = true;
    } catch (err: any) {
      dbError = err?.message || 'Erro de conexão com PostgreSQL';
    }
  }

  return res.status(200).json({
    status: 'ok',
    service: 'ifce-iventus-api',
    database: isConfiguredWithRealDatabase
      ? dbReachable
        ? 'postgresql_connected'
        : 'postgresql_error'
      : isProductionEnvironment()
        ? 'not_configured'
        : 'preview_memory',
    dbReachable,
    dbError,
    schemaReady: isSchemaReady(),
    emailProvider: getConfiguredEmailProvider(),
    demoMode: isDemoModeEnabled(),
    authSecretConfigured: isAuthSecretConfigured(),
    timestamp: new Date().toISOString(),
  });
});

// 2. Bootstrap & Auth
apiRouter.get('/auth/bootstrap', async (_req: Request, res: Response) => {
  try {
    const status = await getBootstrapStatus();
    return res.status(200).json({ success: true, ...status });
  } catch (err: any) {
    return sendError(res, err, 'Erro ao verificar estado inicial do sistema.');
  }
});

apiRouter.post('/auth/bootstrap-admin', async (req: Request, res: Response) => {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`bootstrap:${ip}`, 5, 15 * 60 * 1000);
    if (!rl.allowed) {
      return res.status(429).json({
        success: false,
        message: `Muitas tentativas. Aguarde ${rl.retryAfterSeconds} segundos.`,
      });
    }

    const result = await bootstrapFirstAdmin({
      nome: req.body?.nome,
      email: req.body?.email,
      senha: req.body?.senha,
      matricula: req.body?.matricula,
    });
    setSessionCookie(res, req, result.token);
    return res.status(201).json(result);
  } catch (err: any) {
    return sendError(res, err, 'Erro ao configurar administrador inicial.');
  }
});

apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`login:${ip}`, 20, 10 * 60 * 1000);
    if (!rl.allowed) {
      return res.status(429).json({
        success: false,
        message: `Muitas tentativas de login. Aguarde ${rl.retryAfterSeconds} segundos.`,
      });
    }

    const { email, senha, isDemoQuickLogin } = req.body || {};
    const result = await loginUser({ email, senha, isDemoQuickLogin });
    setSessionCookie(res, req, result.token);
    return res.status(200).json(result);
  } catch (err: any) {
    return sendError(res, err, 'Falha na autenticação.');
  }
});

apiRouter.post('/auth/logout', (req: Request, res: Response) => {
  clearSessionCookie(res, req);
  return res.status(200).json({ success: true, message: 'Sessão encerrada com sucesso.' });
});

apiRouter.post('/auth/register', async (req: Request, res: Response) => {
  try {
    const ip = getClientIp(req);
    if (isBotHoneypotTriggered(req.body)) {
      return res.status(200).json({
        success: true,
        requiresEmailVerification: true,
        requiresAdminApproval: false,
        message: 'Cadastro processado.',
      });
    }

    const rl = checkRateLimit(`register:${ip}`, 10, 15 * 60 * 1000);
    if (!rl.allowed) {
      return res.status(429).json({
        success: false,
        message: `Muitas tentativas de cadastro. Aguarde ${rl.retryAfterSeconds} segundos.`,
      });
    }

    const baseUrl = resolveRequestOrigin(req);
    const { nome, email, senha, perfil, matricula, telefone, materias } = req.body || {};

    const result = await registerUser({
      nome,
      email,
      senha,
      perfil,
      matricula,
      telefone,
      materias,
      ip,
      baseUrl,
    });

    return res.status(201).json(result);
  } catch (err: any) {
    return sendError(res, err, 'Erro interno ao processar cadastro.');
  }
});

apiRouter.get('/auth/verify-email', async (req: Request, res: Response) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const result = await verifyEmailToken(token);
    if (result.token) setSessionCookie(res, req, result.token);
    return res.status(200).json(result);
  } catch (err: any) {
    return sendError(res, err, 'Erro ao validar link de verificação.');
  }
});

apiRouter.post('/auth/verify-email', async (req: Request, res: Response) => {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    const email = typeof req.body?.email === 'string' ? req.body.email : '';
    const code = typeof req.body?.code === 'string' ? req.body.code : '';

    const result = token
      ? await verifyEmailToken(token)
      : await verifyEmailCode({ email, code });

    if (result.token) setSessionCookie(res, req, result.token);
    return res.status(200).json(result);
  } catch (err: any) {
    return sendError(res, err, 'Erro ao validar confirmação de e-mail.');
  }
});

apiRouter.post('/auth/resend-verification', async (req: Request, res: Response) => {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`resend:ip:${ip}`, 10, 15 * 60 * 1000);
    if (!rl.allowed) {
      return res.status(429).json({
        success: false,
        message: `Muitas solicitações. Aguarde ${rl.retryAfterSeconds} segundos.`,
        retryAfterSeconds: rl.retryAfterSeconds,
      });
    }

    const baseUrl = resolveRequestOrigin(req);
    const result = await resendVerificationEmail({
      email: req.body?.email || '',
      ip,
      baseUrl,
    });
    return res.status(200).json(result);
  } catch (err: any) {
    return sendError(res, err, 'Não foi possível reenviar o e-mail de verificação.');
  }
});

apiRouter.post('/auth/forgot-password', async (req: Request, res: Response) => {
  try {
    const ip = getClientIp(req);
    const baseUrl = resolveRequestOrigin(req);
    const result = await requestPasswordReset({
      email: req.body?.email || '',
      ip,
      baseUrl,
    });
    return res.status(200).json(result);
  } catch (err: any) {
    return sendError(res, err, 'Não foi possível processar a recuperação de senha.');
  }
});

apiRouter.post('/auth/reset-password', async (req: Request, res: Response) => {
  try {
    const result = await confirmPasswordReset({
      token: req.body?.token,
      email: req.body?.email,
      code: req.body?.code,
      novaSenha: req.body?.novaSenha,
    });
    return res.status(200).json(result);
  } catch (err: any) {
    return sendError(res, err, 'Não foi possível redefinir a senha.');
  }
});

apiRouter.get('/auth/me', async (req: Request, res: Response) => {
  try {
    const user = await requireAuthenticatedUser(req);
    return res.status(200).json({ success: true, user });
  } catch (err: any) {
    return sendError(res, err, 'Sessão inválida.');
  }
});

// 3. Profile
apiRouter.patch('/profile', async (req: Request, res: Response) => {
  try {
    const authUser = await requireAuthenticatedUser(req);
    const updatedUser = await updateOwnProfile(authUser.id_usuario, {
      nome: req.body?.nome,
      email: req.body?.email,
      matricula: req.body?.matricula,
      telefone: req.body?.telefone,
      materias: req.body?.materias,
      foto_perfil: req.body?.foto_perfil,
    });
    return res.status(200).json({ success: true, user: updatedUser });
  } catch (err: any) {
    return sendError(res, err, 'Erro ao atualizar perfil.');
  }
});

apiRouter.patch('/profile/password', async (req: Request, res: Response) => {
  try {
    const authUser = await requireAuthenticatedUser(req);
    const result = await changeOwnPassword(
      authUser.id_usuario,
      req.body?.senhaAtual,
      req.body?.novaSenha
    );
    return res.status(200).json(result);
  } catch (err: any) {
    return sendError(res, err, 'Erro ao alterar senha.');
  }
});

// 4. Workspace & Events
apiRouter.get('/workspace', async (req: Request, res: Response) => {
  try {
    const authUser = await requireAuthenticatedUser(req);
    const snapshot = await getWorkspaceDataForUser(authUser);
    return res.status(200).json({ success: true, ...snapshot });
  } catch (err: any) {
    return sendError(res, err, 'Erro ao carregar dados do ambiente.');
  }
});

apiRouter.get('/events', async (req: Request, res: Response) => {
  try {
    const authUser = await requireAuthenticatedUser(req);
    const snapshot = await getWorkspaceDataForUser(authUser);
    return res.status(200).json({ success: true, events: snapshot.eventos });
  } catch (err: any) {
    return sendError(res, err, 'Erro ao listar eventos.');
  }
});

apiRouter.post('/events', async (req: Request, res: Response) => {
  try {
    const staffUser = await requireStaffUser(req);
    const created = await createEvent(staffUser, req.body || {});
    return res.status(201).json({ success: true, ...created });
  } catch (err: any) {
    return sendError(res, err, 'Erro ao criar evento.');
  }
});

apiRouter.patch('/events/:id', async (req: Request, res: Response) => {
  try {
    const staffUser = await requireStaffUser(req);
    const eventoId = Number(req.params.id);
    if (!Number.isFinite(eventoId)) {
      return res.status(400).json({ success: false, message: 'ID de evento inválido.' });
    }
    const updated = await updateEvent(staffUser, eventoId, req.body || {});
    return res.status(200).json({ success: true, evento: updated });
  } catch (err: any) {
    return sendError(res, err, 'Erro ao atualizar evento.');
  }
});

apiRouter.post('/events/:id/inscribe', async (req: Request, res: Response) => {
  try {
    const authUser = await requireAuthenticatedUser(req);
    const eventoId = Number(req.params.id);
    if (!Number.isFinite(eventoId)) {
      return res.status(400).json({ success: false, message: 'ID de evento inválido.' });
    }
    const result = await inscribeInEvent(authUser, eventoId);
    return res.status(200).json({ success: true, ...result });
  } catch (err: any) {
    return sendError(res, err, 'Não foi possível concluir a inscrição.');
  }
});

apiRouter.delete('/inscriptions/:id', async (req: Request, res: Response) => {
  try {
    const authUser = await requireAuthenticatedUser(req);
    const inscricaoId = Number(req.params.id);
    if (!Number.isFinite(inscricaoId)) {
      return res.status(400).json({ success: false, message: 'ID de inscrição inválido.' });
    }
    const result = await cancelEventInscription(authUser, inscricaoId);
    return res.status(200).json(result);
  } catch (err: any) {
    return sendError(res, err, 'Erro ao cancelar inscrição.');
  }
});

apiRouter.post('/favorites/:eventoId', async (req: Request, res: Response) => {
  try {
    const authUser = await requireAuthenticatedUser(req);
    const eventoId = Number(req.params.eventoId);
    if (!Number.isFinite(eventoId)) {
      return res.status(400).json({ success: false, message: 'ID de evento inválido.' });
    }
    const result = await toggleUserFavorite(authUser.id_usuario, eventoId);
    return res.status(200).json({ success: true, ...result });
  } catch (err: any) {
    return sendError(res, err, 'Erro ao atualizar favorito.');
  }
});

apiRouter.get('/events/:id/inscriptions', async (req: Request, res: Response) => {
  try {
    const staffUser = await requireStaffUser(req);
    const eventoId = Number(req.params.id);
    if (!Number.isFinite(eventoId)) {
      return res.status(400).json({ success: false, message: 'ID de evento inválido.' });
    }
    const result = await getEventInscriptionsForAttendance(staffUser, eventoId);
    return res.status(200).json({ success: true, ...result });
  } catch (err: any) {
    return sendError(res, err, 'Erro ao carregar inscritos do evento.');
  }
});

// 5. Attendance & Certificates
apiRouter.post('/attendance/:inscricaoId/toggle', async (req: Request, res: Response) => {
  try {
    const staffUser = await requireStaffUser(req);
    const inscricaoId = Number(req.params.inscricaoId);
    if (!Number.isFinite(inscricaoId)) {
      return res.status(400).json({ success: false, message: 'ID de inscrição inválido.' });
    }
    const explicitPresente =
      typeof req.body?.presente === 'boolean' ? req.body.presente : undefined;
    const result = await setOrToggleAttendance(staffUser, inscricaoId, explicitPresente);
    return res.status(200).json({ success: true, ...result });
  } catch (err: any) {
    return sendError(res, err, 'Erro ao registrar frequência.');
  }
});

apiRouter.put('/attendance/:inscricaoId', async (req: Request, res: Response) => {
  try {
    const staffUser = await requireStaffUser(req);
    const inscricaoId = Number(req.params.inscricaoId);
    if (!Number.isFinite(inscricaoId)) {
      return res.status(400).json({ success: false, message: 'ID de inscrição inválido.' });
    }
    if (typeof req.body?.presente !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Informe o campo booleano "presente" (true para presença, false para ausência).',
      });
    }
    const result = await setOrToggleAttendance(staffUser, inscricaoId, req.body.presente);
    return res.status(200).json({ success: true, ...result });
  } catch (err: any) {
    return sendError(res, err, 'Erro ao atualizar frequência.');
  }
});

apiRouter.post('/certificates/issue', async (req: Request, res: Response) => {
  try {
    const staffUser = await requireStaffUser(req);
    const result = await issueCertificate(staffUser, req.body || {});
    return res.status(201).json({ success: true, ...result });
  } catch (err: any) {
    return sendError(res, err, 'Erro ao emitir certificado.');
  }
});

apiRouter.get('/certificates/validate', async (req: Request, res: Response) => {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const certificado = await validateCertificateCode(code);
    return res.status(200).json({ success: true, valid: Boolean(certificado), certificado });
  } catch (err: any) {
    return sendError(res, err, 'Erro ao validar certificado.');
  }
});

apiRouter.patch('/admin/certificates/:id/decision', async (req: Request, res: Response) => {
  try {
    await requireAdminUser(req);
    const certId = Number(req.params.id);
    if (!Number.isFinite(certId)) {
      return res.status(400).json({ success: false, message: 'ID de certificado inválido.' });
    }
    const result = await moderateCertificate(certId, req.body?.decision);
    return res.status(200).json(result);
  } catch (err: any) {
    return sendError(res, err, 'Erro ao moderar certificado.');
  }
});

// 6. Admin Users & Professor Approvals
apiRouter.get('/admin/professors', async (req: Request, res: Response) => {
  try {
    await requireAdminUser(req);
    const professors = await getProfessorRequests();
    return res.status(200).json({ success: true, professors });
  } catch (err: any) {
    return sendError(res, err, 'Erro ao listar solicitações de professores.');
  }
});

apiRouter.patch('/admin/professors/:id/decision', async (req: Request, res: Response) => {
  try {
    const admin = await requireAdminUser(req);
    const professorId = Number(req.params.id);
    if (!Number.isFinite(professorId)) {
      return res.status(400).json({ success: false, message: 'ID de professor inválido.' });
    }
    const updated = await moderateProfessorRequest({
      professorId,
      adminId: admin.id_usuario,
      decision: req.body?.decision,
      motivo: req.body?.motivo,
    });
    return res.status(200).json({
      success: true,
      message:
        req.body?.decision === 'APROVAR'
          ? `Professor ${updated.nome} aprovado com sucesso!`
          : `Solicitação de ${updated.nome} recusada.`,
      professor: updated,
    });
  } catch (err: any) {
    return sendError(res, err, 'Erro ao moderar solicitação de professor.');
  }
});

apiRouter.get('/admin/users', async (req: Request, res: Response) => {
  try {
    await requireAdminUser(req);
    const users = await getAllUsersAdmin();
    return res.status(200).json({ success: true, users });
  } catch (err: any) {
    return sendError(res, err, 'Erro ao listar usuários.');
  }
});

apiRouter.patch('/admin/users', async (req: Request, res: Response) => {
  try {
    const admin = await requireAdminUser(req);
    const { userId, status, motivo } = req.body || {};
    if (!userId || !status) {
      return res.status(400).json({ success: false, message: 'Informe userId e status.' });
    }
    const updated = await updateUserStatusAdmin({
      userId: Number(userId),
      adminId: admin.id_usuario,
      status,
      motivo,
    });
    return res.status(200).json({ success: true, user: updated });
  } catch (err: any) {
    return sendError(res, err, 'Erro ao atualizar usuário.');
  }
});

apiRouter.use((_req: Request, res: Response) => {
  return res.status(404).json({ success: false, message: 'Endpoint da API não encontrado.' });
});

/**
 * Standalone Express application for Vercel serverless (`/api/index.ts`)
 */
export function createServerlessApiApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use('/api', apiRouter);
  app.use('/', apiRouter);
  return app;
}
