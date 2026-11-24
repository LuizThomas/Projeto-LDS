import { registerUser } from '../../src/server/authService';
import { checkRateLimit, getClientIp, isBotHoneypotTriggered } from '../../src/server/rateLimit';

function resolveOrigin(req: any): string | undefined {
  const rawProto = (req?.headers?.['x-forwarded-proto'] as string) || 'https';
  const rawHost = (req?.headers?.['x-forwarded-host'] as string) || req?.headers?.host;
  const proto = rawProto.split(',')[0].trim();
  const host = typeof rawHost === 'string' ? rawHost.split(',')[0].trim() : '';
  if (host) {
    return `${proto}://${host}`;
  }
  return undefined;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: `Método ${req.method} não suportado. Utilize POST para cadastro.`,
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Corpo da requisição inválido (JSON malformatado).',
      });
    }
  }

  if (!body || typeof body !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'Dados de cadastro não fornecidos.',
    });
  }

  if (isBotHoneypotTriggered(body)) {
    return res.status(400).json({
      success: false,
      message: 'Solicitação rejeitada pela verificação anti-spam.',
    });
  }

  const ip = getClientIp(req);
  const ipRate = checkRateLimit(`register:ip:${ip}`, 10, 15 * 60 * 1000);
  if (!ipRate.allowed) {
    return res.status(429).json({
      success: false,
      message: `Muitas tentativas de cadastro. Aguarde ${ipRate.retryAfterSeconds} segundos e tente novamente.`,
    });
  }

  const { nome, email, senha, perfil, matricula, telefone, materias } = body;

  try {
    const result = await registerUser({
      nome,
      email,
      senha,
      perfil,
      matricula,
      telefone,
      materias,
      ip,
      baseUrl: resolveOrigin(req),
    });

    return res.status(201).json(result);
  } catch (error: any) {
    console.warn('[API /api/auth/register NOTICE]:', error.message);
    const statusCode = error.statusCode || (error.code === '23505' ? 409 : 500);
    const message =
      error.code === '23505'
        ? 'Já existe um usuário cadastrado com estes dados (e-mail ou matrícula já em uso).'
        : error.message || 'Erro ao processar cadastro no banco de dados.';

    return res.status(statusCode).json({
      success: false,
      message,
      errorCode: error.errorCode || error.code || 'DB_ERROR',
    });
  }
}
