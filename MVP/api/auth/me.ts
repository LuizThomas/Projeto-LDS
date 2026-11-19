import { requireAuthenticatedUser } from '../../src/server/authService';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Método não permitido.' });
  }

  try {
    const user = await requireAuthenticatedUser(req);
    return res.status(200).json({ success: true, user });
  } catch (error: any) {
    const statusCode = error.statusCode || 401;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Sessão inválida.',
      errorCode: error.errorCode || 'UNAUTHORIZED',
    });
  }
}
