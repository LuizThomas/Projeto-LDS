import { requireAdminUser, getProfessorRequests } from '../../src/server/authService';

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
    await requireAdminUser(req);
    const professors = await getProfessorRequests();
    return res.status(200).json({ success: true, professors });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Erro ao carregar solicitações de professores.',
      errorCode: error.errorCode || 'ADMIN_ERROR',
    });
  }
}
