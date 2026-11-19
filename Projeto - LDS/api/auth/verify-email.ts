import { verifyEmailToken, verifyEmailCode } from '../../src/server/authService';
import { checkRateLimit, getClientIp } from '../../src/server/rateLimit';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ success: false, message: 'Método não permitido.' });
  }

  const ip = getClientIp(req);
  const ipRate = checkRateLimit(`verify:ip:${ip}`, 30, 15 * 60 * 1000);
  if (!ipRate.allowed) {
    return res.status(429).json({
      success: false,
      message: 'Muitas tentativas de verificação. Tente novamente em alguns minutos.',
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const token = (req.query?.token as string) || body?.token || '';
  const email = body?.email || '';
  const code = body?.code || '';

  try {
    const result =
      email && code
        ? await verifyEmailCode({ email, code })
        : await verifyEmailToken(token);
    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Não foi possível verificar o e-mail.',
      errorCode: error.errorCode || 'VERIFY_ERROR',
    });
  }
}
