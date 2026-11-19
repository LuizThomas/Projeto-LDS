import { loginUser } from '../../src/server/authService';
import { checkRateLimit, getClientIp } from '../../src/server/rateLimit';

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

  const ip = getClientIp(req);
  const ipRate = checkRateLimit(`login:ip:${ip}`, 25, 5 * 60 * 1000);
  if (!ipRate.allowed) {
    return res.status(429).json({
      success: false,
      message: `Muitas tentativas de login. Aguarde ${ipRate.retryAfterSeconds} segundos.`,
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ success: false, message: 'JSON inválido.' });
    }
  }

  try {
    const { email, senha, isDemoQuickLogin } = body || {};
    const result = await loginUser({ email, senha, isDemoQuickLogin: Boolean(isDemoQuickLogin) });
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Erro ao realizar login.',
      errorCode: error.errorCode || 'AUTH_ERROR',
      email: error.email,
    });
  }
}
