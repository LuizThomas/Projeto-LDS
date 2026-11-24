import {
  requireAdminUser,
  getAllUsersAdmin,
  updateUserStatusAdmin,
} from '../../src/server/authService';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const admin = await requireAdminUser(req);

    if (req.method === 'GET') {
      const users = await getAllUsersAdmin();
      return res.status(200).json({ success: true, users });
    }

    if (req.method === 'PATCH') {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          return res.status(400).json({ success: false, message: 'JSON inválido.' });
        }
      }

      const { userId, status, motivo } = body || {};
      const updated = await updateUserStatusAdmin({
        userId: Number(userId),
        adminId: admin.id_usuario,
        status,
        motivo,
      });
      return res.status(200).json({ success: true, user: updated });
    }

    return res.status(405).json({ success: false, message: 'Método não permitido.' });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Erro na gestão de usuários.',
      errorCode: error.errorCode || 'ADMIN_ERROR',
    });
  }
}
