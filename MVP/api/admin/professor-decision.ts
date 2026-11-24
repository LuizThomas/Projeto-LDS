import { requireAdminUser, moderateProfessorRequest } from '../../src/server/authService';

function extractProfessorId(req: any): number {
  if (req.query?.id) {
    return parseInt(String(req.query.id), 10);
  }
  const match = String(req.url || '').match(/\/professors\/(\d+)\/decision/);
  if (match?.[1]) {
    return parseInt(match[1], 10);
  }
  return NaN;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!['PATCH', 'POST'].includes(req.method)) {
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

  const professorId = extractProfessorId(req);
  if (Number.isNaN(professorId)) {
    return res.status(400).json({ success: false, message: 'ID do professor inválido.' });
  }

  try {
    const admin = await requireAdminUser(req);
    const { decision, motivo } = body || {};
    const updated = await moderateProfessorRequest({
      professorId,
      adminId: admin.id_usuario,
      decision,
      motivo,
    });
    return res.status(200).json({ success: true, professor: updated });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Erro ao registrar decisão administrativa.',
      errorCode: error.errorCode || 'ADMIN_ERROR',
    });
  }
}
