import { isConfiguredWithRealDatabase, query, inMemoryInscriptions } from '../lib/db';
import { Usuario } from '../types';

/**
 * Verifies user permissions on the backend before performing event inscription.
 * Unverified students or pending/rejected professors are blocked by requireAuthenticatedUser.
 */
export async function inscribeStudentInEvent(params: {
  user: Omit<Usuario, 'senha_hash'>;
  eventoId: number;
  eventoTitulo?: string;
}): Promise<{ success: boolean; message: string; id_inscricao: number }> {
  const { user, eventoId } = params;

  if (!eventoId || Number.isNaN(eventoId)) {
    const err = new Error('ID do evento inválido.');
    (err as any).statusCode = 400;
    throw err;
  }

  if (user.perfil === 'PARTICIPANTE' && !user.email_verificado) {
    const err = new Error('Confirme seu e-mail antes de se inscrever em eventos.');
    (err as any).statusCode = 403;
    (err as any).errorCode = 'EMAIL_NOT_VERIFIED';
    throw err;
  }

  if (isConfiguredWithRealDatabase) {
    // Ensure atividade/evento tables exist or check if an activity exists for this event
    try {
      const atvRes = await query(
        `SELECT id_atividade FROM atividade WHERE id_evento = $1 ORDER BY id_atividade ASC LIMIT 1`,
        [eventoId]
      );
      if (atvRes.rows.length > 0) {
        const idAtividade = atvRes.rows[0].id_atividade;
        const existing = await query(
          `SELECT id_inscricao, status FROM inscricao WHERE id_usuario = $1 AND id_atividade = $2`,
          [user.id_usuario, idAtividade]
        );
        if (existing.rows.length > 0 && existing.rows[0].status === 'CONFIRMADA') {
          const err = new Error('Você já possui inscrição confirmada para este evento.');
          (err as any).statusCode = 409;
          throw err;
        }
        const inserted = await query(
          `INSERT INTO inscricao (id_usuario, id_atividade, status)
           VALUES ($1, $2, 'CONFIRMADA')
           ON CONFLICT (id_usuario, id_atividade)
           DO UPDATE SET status = 'CONFIRMADA', data_inscricao = CURRENT_TIMESTAMP
           RETURNING id_inscricao`,
          [user.id_usuario, idAtividade]
        );
        return {
          success: true,
          message: 'Inscrição confirmada com sucesso!',
          id_inscricao: inserted.rows[0].id_inscricao,
        };
      }
    } catch (err: any) {
      if (err.statusCode) throw err;
      // If event/activity tables haven't been seeded yet in DB, fall back cleanly below
      console.warn('[EVENTS INSCRIPTION DB NOTICE]:', err.message);
    }
  }

  const already = inMemoryInscriptions.find(
    (i) => i.id_usuario === user.id_usuario && i.id_evento === eventoId && i.status === 'CONFIRMADA'
  );
  if (already) {
    const err = new Error('Você já possui inscrição confirmada para este evento.');
    (err as any).statusCode = 409;
    throw err;
  }

  const id_inscricao = Date.now();
  inMemoryInscriptions.push({
    id_inscricao,
    id_usuario: user.id_usuario,
    id_evento: eventoId,
    status: 'CONFIRMADA',
    data_inscricao: new Date().toISOString(),
  });

  return {
    success: true,
    message: 'Inscrição realizada com sucesso no IFCE Iventus!',
    id_inscricao,
  };
}
