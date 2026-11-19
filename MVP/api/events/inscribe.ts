import { requireAuthenticatedUser } from '../../src/server/authService';
import { inscribeStudentInEvent } from '../../src/server/eventsService';

function extractEventoId(req: any): number {
  if (req.query?.id) {
    return parseInt(String(req.query.id), 10);
  }
  const match = String(req.url || '').match(/\/events\/(\d+)\/inscribe/);
  if (match?.[1]) {
    return parseInt(match[1], 10);
  }
  return NaN;
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

  try {
    const user = await requireAuthenticatedUser(req);
    const eventoId = extractEventoId(req);
    const result = await inscribeStudentInEvent({ user, eventoId });
    return res.status(201).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Erro ao realizar inscrição no evento.',
      errorCode: error.errorCode || 'INSCRIPTION_ERROR',
    });
  }
}
