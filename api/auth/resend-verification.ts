import { resendVerificationEmail } from '../../src/server/authService';
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
    return res.status(405).json({ success: false, message: 'Método não permitido.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ success: false, message: 'JSON inválido.' });
    }
  }

  if (isBotHoneypotTriggered(body)) {
    return res.status(400).json({ success: false, message: 'Requisição inválida.' });
  }

  const ip = getClientIp(req);
  const ipRate = checkRateLimit(`resend:ip:${ip}`, 10, 15 * 60 * 1000);
  if (!ipRate.allowed) {
    return res.status(429).json({
      success: false,
      message: `Muitas solicitações de reenvio. Aguarde ${ipRate.retryAfterSeconds} segundos.`,
    });
  }

  try {
    const result = await resendVerificationEmail({
      email: body?.email || '',
      ip,
      baseUrl: resolveOrigin(req),
    });
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Erro ao reenviar e-mail de verificação.',
      errorCode: error.errorCode || 'RESEND_ERROR',
      retryAfterSeconds: error.retryAfterSeconds,
    });
  }
}
