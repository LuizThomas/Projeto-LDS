import { requireAuthenticatedUser } from '../../src/server/authService';

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

  try {
    const user = await requireAuthenticatedUser(req);
    if (!['PROFESSOR', 'ADMINISTRADOR'].includes(user.perfil)) {
      return res.status(403).json({
        success: false,
        message: 'Apenas professores aprovados ou administradores podem criar eventos.',
        errorCode: 'PROFESSOR_REQUIRED',
      });
    }

    return res.status(201).json({
      success: true,
      organizerId: user.id_usuario,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 403;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Erro ao autorizar criação de evento.',
      errorCode: error.errorCode || 'AUTH_ERROR',
    });
  }
}
