import crypto from 'crypto';
import {
  query,
  isConfiguredWithRealDatabase,
  ensurePostgresSchema,
  inMemoryEvents,
  inMemoryActivities,
  inMemoryInscriptions,
  inMemoryAttendances,
  inMemoryCertificates,
  inMemoryFavorites,
  inMemoryUsers,
} from '../lib/db';
import { sanitizeImageUrlOrDataUri } from './http';
import {
  Atividade,
  Certificado,
  Evento,
  Frequencia,
  Inscricao,
  SolicitacaoCertificadoModeracao,
  StatusEvento,
  Usuario,
} from '../types';

type ModalidadeEvento = 'Presencial' | 'Online';

function toCertificado(row: any): Certificado {
  return {
    id_certificado: Number(row.id_certificado),
    id_frequencia: Number(row.id_frequencia || 0),
    codigo_validacao: row.codigo_validacao,
    data_emissao: row.data_emissao,
    status_aprovacao: row.status_aprovacao || 'APROVADO',
    participante_nome: row.participante_nome || '',
    participante_matricula: row.participante_matricula ?? undefined,
    evento_titulo: row.evento_titulo || '',
    atividade_titulo: row.atividade_titulo || '',
    organizador_nome: row.organizador_nome || 'IFCE Docente',
    carga_horaria: Number(row.carga_horaria || 20),
    data_evento: row.data_evento || '',
  };
}

export interface WorkspaceSnapshot {
  eventos: Evento[];
  atividades: Atividade[];
  inscricoes: Inscricao[];
  frequencias: Frequencia[];
  certificados: Certificado[];
  favoritos: number[];
  solicitacoesCertificado: SolicitacaoCertificadoModeracao[];
}

export async function getWorkspaceDataForUser(
  user: Omit<Usuario, 'senha_hash'>
): Promise<WorkspaceSnapshot> {
  await ensurePostgresSchema();

  if (isConfiguredWithRealDatabase) {
    const eventsRes = await query(
      `SELECT
         e.id_evento,
         e.id_organizador,
         COALESCE(u.nome, 'Coordenação IFCE') AS organizador_nome,
         e.titulo,
         COALESCE(e.descricao, '') AS descricao,
         e.banner_url,
         e.data_inicio::text AS data_inicio,
         e.data_fim::text AS data_fim,
         e.inicio_inscricoes::text AS inicio_inscricoes,
         e.fim_inscricoes::text AS fim_inscricoes,
         e.status,
         e.local,
         e.modalidade,
         e.horario_formatado,
         e.data_formatada,
         e.created_at::text AS created_at,
         COALESCE((
           SELECT COUNT(*)::int
           FROM inscricao i
           JOIN atividade a ON a.id_atividade = i.id_atividade
           WHERE a.id_evento = e.id_evento AND i.status = 'CONFIRMADA'
         ), 0) AS inscritos_count
       FROM evento e
       LEFT JOIN usuario u ON u.id_usuario = e.id_organizador
       ORDER BY e.created_at DESC, e.id_evento DESC`
    );

    const activitiesRes = await query(
      `SELECT
         a.id_atividade,
         a.id_evento,
         a.titulo,
         a.descricao,
         a.tipo,
         a.data_hora_inicio::text AS data_hora_inicio,
         a.data_hora_fim::text AS data_hora_fim,
         a.local,
         a.limite_vagas,
         a.carga_horaria,
         a.created_at::text AS created_at,
         COALESCE((
           SELECT COUNT(*)::int FROM inscricao i WHERE i.id_atividade = a.id_atividade AND i.status = 'CONFIRMADA'
         ), 0) AS vagas_ocupadas
       FROM atividade a
       ORDER BY a.id_atividade ASC`
    );

    const isStaff = user.perfil === 'PROFESSOR' || user.perfil === 'ADMINISTRADOR';
    const inscRes = await query(
      `SELECT
         i.id_inscricao,
         i.id_usuario,
         i.id_atividade,
         i.data_inscricao::text AS data_inscricao,
         i.status,
         u.nome AS usuario_nome,
         u.email AS usuario_email,
         u.matricula AS usuario_matricula,
         u.perfil AS usuario_perfil,
         a.titulo AS atividade_titulo,
         e.titulo AS evento_titulo,
         e.id_evento AS evento_id,
         e.local AS evento_local,
         e.modalidade AS evento_modalidade,
         COALESCE(e.data_formatada, e.data_inicio::text) AS evento_data,
         f.presente AS presente,
         f.data_registro::text AS frequencia_registrada_em
       FROM inscricao i
       JOIN usuario u ON u.id_usuario = i.id_usuario
       JOIN atividade a ON a.id_atividade = i.id_atividade
       JOIN evento e ON e.id_evento = a.id_evento
       LEFT JOIN frequencia f ON f.id_inscricao = i.id_inscricao
       WHERE ($1::boolean = TRUE OR i.id_usuario = $2)
       ORDER BY i.data_inscricao DESC`,
      [isStaff, user.id_usuario]
    );

    const freqRes = await query(
      `SELECT f.id_frequencia, f.id_inscricao, f.presente, f.data_registro::text AS data_registro
       FROM frequencia f
       JOIN inscricao i ON i.id_inscricao = f.id_inscricao
       WHERE ($1::boolean = TRUE OR i.id_usuario = $2)`,
      [isStaff, user.id_usuario]
    );

    const certRes = await query(
      `SELECT
         id_certificado,
         COALESCE(id_frequencia, 0) AS id_frequencia,
         codigo_validacao,
         data_emissao::text AS data_emissao,
         status_aprovacao,
         participante_nome,
         participante_matricula,
         evento_titulo,
         atividade_titulo,
         organizador_nome,
         carga_horaria,
         data_evento
       FROM certificado
       WHERE ($1::boolean = TRUE OR id_usuario = $2 OR LOWER(COALESCE(participante_nome, '')) = LOWER($3))
       ORDER BY data_emissao DESC`,
      [isStaff, user.id_usuario, user.nome]
    );

    const favRes = await query<{ id_evento: number }>(
      `SELECT id_evento FROM favorito WHERE id_usuario = $1`,
      [user.id_usuario]
    );

    const allCerts: Certificado[] = certRes.rows.map(toCertificado);

    const solicitacoesCertificado: SolicitacaoCertificadoModeracao[] = allCerts.map((c) => ({
      id_certificado: c.id_certificado,
      evento_titulo: c.evento_titulo || 'Evento IFCE',
      organizador_nome: c.organizador_nome || 'Coordenação IFCE',
      data_solicitacao: new Date(c.data_emissao).toLocaleDateString('pt-BR'),
      status_moderacao: c.status_aprovacao || 'PENDENTE',
      participante_nome: c.participante_nome || 'Participante IFCE',
    }));

    return {
      eventos: eventsRes.rows.map((r) => ({
        ...r,
        id_evento: Number(r.id_evento),
        id_organizador: Number(r.id_organizador),
        inscritos_count: Number(r.inscritos_count || 0),
      })),
      atividades: activitiesRes.rows.map((r) => ({
        ...r,
        id_atividade: Number(r.id_atividade),
        id_evento: Number(r.id_evento),
        limite_vagas: Number(r.limite_vagas),
        vagas_ocupadas: Number(r.vagas_ocupadas || 0),
        carga_horaria: Number(r.carga_horaria || 20),
      })),
      inscricoes: inscRes.rows.map((r) => ({
        ...r,
        id_inscricao: Number(r.id_inscricao),
        id_usuario: Number(r.id_usuario),
        id_atividade: Number(r.id_atividade),
        evento_id: Number(r.evento_id),
        presente: r.presente === null || r.presente === undefined ? null : Boolean(r.presente),
      })),
      frequencias: freqRes.rows.map((r) => ({
        ...r,
        id_frequencia: Number(r.id_frequencia),
        id_inscricao: Number(r.id_inscricao),
        presente: Boolean(r.presente),
      })),
      certificados: allCerts.filter((c) => c.status_aprovacao === 'APROVADO'),
      favoritos: favRes.rows.map((r) => Number(r.id_evento)),
      solicitacoesCertificado,
    };
  }

  // Non-production preview fallback
  const eventos: Evento[] = inMemoryEvents.map((e) => ({
    ...e,
    inscritos_count: inMemoryInscriptions.filter(
      (i) => i.id_evento === e.id_evento && i.status === 'CONFIRMADA'
    ).length,
  }));

  const atividades: Atividade[] = inMemoryActivities.map((a) => ({
    ...a,
    vagas_ocupadas: inMemoryInscriptions.filter(
      (i) => i.id_atividade === a.id_atividade && i.status === 'CONFIRMADA'
    ).length,
  }));

  const isStaff = user.perfil === 'PROFESSOR' || user.perfil === 'ADMINISTRADOR';
  const inscricoes: Inscricao[] = inMemoryInscriptions
    .filter((i) => isStaff || i.id_usuario === user.id_usuario)
    .map((i) => {
      const u = inMemoryUsers.find((usr) => usr.id_usuario === i.id_usuario);
      const ev = inMemoryEvents.find((evt) => evt.id_evento === i.id_evento);
      const act = inMemoryActivities.find((a) => a.id_atividade === i.id_atividade);
      const freq = inMemoryAttendances.find((f) => f.id_inscricao === i.id_inscricao);
      return {
        id_inscricao: i.id_inscricao,
        id_usuario: i.id_usuario,
        id_atividade: i.id_atividade,
        data_inscricao: i.data_inscricao,
        status: i.status,
        usuario_nome: u?.nome || 'Participante',
        usuario_email: u?.email || undefined,
        usuario_matricula: u?.matricula || undefined,
        usuario_perfil: u?.perfil,
        atividade_titulo: act?.titulo,
        evento_titulo: ev?.titulo,
        evento_id: ev?.id_evento,
        evento_local: ev?.local,
        evento_modalidade: ev?.modalidade,
        evento_data: ev?.data_formatada || ev?.data_inicio,
        presente: freq ? freq.presente : null,
        frequencia_registrada_em: freq ? freq.data_registro : null,
      };
    });

  const certificados: Certificado[] = inMemoryCertificates
    .filter((c) => c.status_aprovacao === 'APROVADO')
    .map(toCertificado);

  const solicitacoesCertificado: SolicitacaoCertificadoModeracao[] = inMemoryCertificates.map((c) => ({
    id_certificado: c.id_certificado,
    evento_titulo: c.evento_titulo,
    organizador_nome: c.organizador_nome,
    data_solicitacao: new Date(c.data_emissao).toLocaleDateString('pt-BR'),
    status_moderacao: c.status_aprovacao,
    participante_nome: c.participante_nome,
  }));

  return {
    eventos,
    atividades,
    inscricoes,
    frequencias: inMemoryAttendances.map((f) => ({ ...f })),
    certificados,
    favoritos: inMemoryFavorites.get(user.id_usuario) || [],
    solicitacoesCertificado,
  };
}

export async function createEvent(
  user: Omit<Usuario, 'senha_hash'>,
  input: {
    titulo: string;
    descricao?: string;
    banner_url?: string | null;
    data_inicio?: string;
    data_fim?: string;
    inicio_inscricoes?: string;
    fim_inscricoes?: string;
    status?: StatusEvento;
    local: string;
    modalidade?: ModalidadeEvento;
    data_formatada?: string;
    horario_formatado?: string;
  }
): Promise<{ evento: Evento; atividade: Atividade }> {
  await ensurePostgresSchema();

  const titulo = input.titulo ? input.titulo.trim() : '';
  const local = input.local ? input.local.trim() : '';
  if (titulo.length < 3 || !local) {
    const err = new Error('Informe o nome e o local do evento.');
    (err as any).statusCode = 400;
    throw err;
  }

  const sanitizedBanner =
    input.banner_url !== undefined ? sanitizeImageUrlOrDataUri(input.banner_url) : null;
  const status: StatusEvento =
    input.status && ['RASCUNHO', 'PUBLICADO', 'ENCERRADO', 'CANCELADO'].includes(input.status)
      ? input.status
      : 'PUBLICADO';
  const modalidade: ModalidadeEvento = input.modalidade === 'Online' ? 'Online' : 'Presencial';
  const descricao =
    input.descricao?.trim() || 'Descrição oficial do evento acadêmico no IFCE.';
  const dataInicio = input.data_inicio || new Date(Date.now() + 7 * 86400000).toISOString();
  const dataFim = input.data_fim || new Date(Date.now() + 8 * 86400000).toISOString();
  const inicioInsc = input.inicio_inscricoes || new Date().toISOString();
  const fimInsc = input.fim_inscricoes || dataInicio;
  const dataFormatada = input.data_formatada?.trim() || 'A definir';
  const horarioFormatado = input.horario_formatado?.trim() || '08:00h - 18:00h';

  if (isConfiguredWithRealDatabase) {
    const evRes = await query(
      `INSERT INTO evento (
        id_organizador, titulo, descricao, banner_url,
        data_inicio, data_fim, inicio_inscricoes, fim_inscricoes,
        local, modalidade, status, horario_formatado, data_formatada
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        user.id_usuario,
        titulo,
        descricao,
        sanitizedBanner,
        dataInicio,
        dataFim,
        inicioInsc,
        fimInsc,
        local,
        modalidade,
        status,
        horarioFormatado,
        dataFormatada,
      ]
    );
    const createdEv = evRes.rows[0];

    const actRes = await query(
      `INSERT INTO atividade (
        id_evento, titulo, descricao, tipo, data_hora_inicio, data_hora_fim, local, limite_vagas, carga_horaria
      ) VALUES ($1, $2, $3, 'Palestra', $4, $5, $6, 100, 20)
      RETURNING *`,
      [
        createdEv.id_evento,
        `Sessão Principal - ${titulo}`,
        descricao,
        dataInicio,
        dataFim,
        local,
      ]
    );
    const createdAct = actRes.rows[0];

    return {
      evento: {
        ...createdEv,
        id_evento: Number(createdEv.id_evento),
        id_organizador: Number(createdEv.id_organizador),
        organizador_nome: user.nome,
        inscritos_count: 0,
      },
      atividade: {
        ...createdAct,
        id_atividade: Number(createdAct.id_atividade),
        id_evento: Number(createdAct.id_evento),
        vagas_ocupadas: 0,
      },
    };
  }

  const nextEvId =
    inMemoryEvents.length > 0 ? Math.max(...inMemoryEvents.map((e) => e.id_evento)) + 1 : 1;
  const nextActId =
    inMemoryActivities.length > 0
      ? Math.max(...inMemoryActivities.map((a) => a.id_atividade)) + 1
      : 1;

  const newEvent = {
    id_evento: nextEvId,
    id_organizador: user.id_usuario,
    organizador_nome: user.nome,
    titulo,
    descricao,
    banner_url: sanitizedBanner,
    data_inicio: dataInicio,
    data_fim: dataFim,
    inicio_inscricoes: inicioInsc,
    fim_inscricoes: fimInsc,
    local,
    modalidade,
    status,
    horario_formatado: horarioFormatado,
    data_formatada: dataFormatada,
    created_at: new Date().toISOString(),
  };
  inMemoryEvents.unshift(newEvent);

  const newActivity = {
    id_atividade: nextActId,
    id_evento: nextEvId,
    titulo: `Sessão Principal - ${titulo}`,
    descricao,
    tipo: 'Palestra',
    data_hora_inicio: dataInicio,
    data_hora_fim: dataFim,
    local,
    limite_vagas: 100,
    carga_horaria: 20,
    created_at: new Date().toISOString(),
  };
  inMemoryActivities.push(newActivity);

  return {
    evento: { ...newEvent, inscritos_count: 0 },
    atividade: { ...newActivity, vagas_ocupadas: 0 },
  };
}

export async function updateEvent(
  user: Omit<Usuario, 'senha_hash'>,
  eventoId: number,
  updates: Partial<{
    titulo: string;
    descricao: string;
    local: string;
    data_formatada: string;
    horario_formatado: string;
    status: StatusEvento;
    banner_url: string | null;
    modalidade: ModalidadeEvento;
  }>
): Promise<Evento> {
  await ensurePostgresSchema();

  const sanitizedBanner =
    updates.banner_url !== undefined ? sanitizeImageUrlOrDataUri(updates.banner_url) : undefined;

  if (isConfiguredWithRealDatabase) {
    const existingRes = await query('SELECT * FROM evento WHERE id_evento = $1', [eventoId]);
    if (existingRes.rows.length === 0) {
      const err = new Error('Evento não encontrado.');
      (err as any).statusCode = 404;
      throw err;
    }
    const existing = existingRes.rows[0];

    if (user.perfil !== 'ADMINISTRADOR' && Number(existing.id_organizador) !== user.id_usuario) {
      const err = new Error('Você só pode editar eventos criados por você.');
      (err as any).statusCode = 403;
      throw err;
    }

    const nextStatus =
      updates.status && ['RASCUNHO', 'PUBLICADO', 'ENCERRADO', 'CANCELADO'].includes(updates.status)
        ? updates.status
        : existing.status;

    const updatedRes = await query(
      `UPDATE evento
       SET titulo = COALESCE($1, titulo),
           descricao = COALESCE($2, descricao),
           local = COALESCE($3, local),
           data_formatada = COALESCE($4, data_formatada),
           horario_formatado = COALESCE($5, horario_formatado),
           status = $6,
           banner_url = CASE WHEN $7::boolean THEN $8 ELSE banner_url END,
           modalidade = COALESCE($9, modalidade)
       WHERE id_evento = $10
       RETURNING *`,
      [
        updates.titulo?.trim() || null,
        updates.descricao?.trim() || null,
        updates.local?.trim() || null,
        updates.data_formatada?.trim() || null,
        updates.horario_formatado?.trim() || null,
        nextStatus,
        sanitizedBanner !== undefined,
        sanitizedBanner ?? null,
        updates.modalidade || null,
        eventoId,
      ]
    );
    const updated = updatedRes.rows[0];
    return {
      ...updated,
      id_evento: Number(updated.id_evento),
      id_organizador: Number(updated.id_organizador),
    };
  }

  const idx = inMemoryEvents.findIndex((e) => e.id_evento === eventoId);
  if (idx === -1) {
    const err = new Error('Evento não encontrado.');
    (err as any).statusCode = 404;
    throw err;
  }
  const ev = inMemoryEvents[idx];
  if (user.perfil !== 'ADMINISTRADOR' && ev.id_organizador !== user.id_usuario) {
    const err = new Error('Você só pode editar eventos criados por você.');
    (err as any).statusCode = 403;
    throw err;
  }

  if (updates.titulo !== undefined) ev.titulo = updates.titulo.trim();
  if (updates.descricao !== undefined) ev.descricao = updates.descricao.trim();
  if (updates.local !== undefined) ev.local = updates.local.trim();
  if (updates.data_formatada !== undefined) ev.data_formatada = updates.data_formatada.trim();
  if (updates.horario_formatado !== undefined) ev.horario_formatado = updates.horario_formatado.trim();
  if (updates.status !== undefined) ev.status = updates.status;
  if (sanitizedBanner !== undefined) ev.banner_url = sanitizedBanner;

  return { ...ev };
}

export async function inscribeInEvent(
  user: Omit<Usuario, 'senha_hash'>,
  eventoId: number
): Promise<{ inscricao: Inscricao; message: string }> {
  await ensurePostgresSchema();

  if (isConfiguredWithRealDatabase) {
    const evRes = await query('SELECT * FROM evento WHERE id_evento = $1', [eventoId]);
    if (evRes.rows.length === 0) {
      const err = new Error('Evento não encontrado.');
      (err as any).statusCode = 404;
      throw err;
    }
    const ev = evRes.rows[0];
    if (ev.status !== 'PUBLICADO') {
      const err = new Error('Este evento não está aberto para novas inscrições.');
      (err as any).statusCode = 400;
      throw err;
    }

    let actRes = await query('SELECT * FROM atividade WHERE id_evento = $1 ORDER BY id_atividade ASC LIMIT 1', [
      eventoId,
    ]);
    if (actRes.rows.length === 0) {
      actRes = await query(
        `INSERT INTO atividade (id_evento, titulo, tipo, data_hora_inicio, data_hora_fim, local, limite_vagas, carga_horaria)
         VALUES ($1, $2, 'Geral', $3, $4, $5, 100, 20) RETURNING *`,
        [eventoId, ev.titulo, ev.data_inicio, ev.data_fim, ev.local]
      );
    }
    const act = actRes.rows[0];

    const existingInsc = await query(
      `SELECT id_inscricao, status FROM inscricao WHERE id_usuario = $1 AND id_atividade = $2`,
      [user.id_usuario, act.id_atividade]
    );

    if (existingInsc.rows.length > 0 && existingInsc.rows[0].status === 'CONFIRMADA') {
      const err = new Error('Você já possui inscrição confirmada para este evento.');
      (err as any).statusCode = 409;
      throw err;
    }

    let inscRow: any;
    if (existingInsc.rows.length > 0) {
      const reactivated = await query(
        `UPDATE inscricao SET status = 'CONFIRMADA', data_inscricao = CURRENT_TIMESTAMP
         WHERE id_inscricao = $1 RETURNING *`,
        [existingInsc.rows[0].id_inscricao]
      );
      inscRow = reactivated.rows[0];
    } else {
      const inserted = await query(
        `INSERT INTO inscricao (id_usuario, id_atividade, status)
         VALUES ($1, $2, 'CONFIRMADA') RETURNING *`,
        [user.id_usuario, act.id_atividade]
      );
      inscRow = inserted.rows[0];
    }

    return {
      message: 'Inscrição confirmada e salva com sucesso no IFCE Iventus!',
      inscricao: {
        id_inscricao: Number(inscRow.id_inscricao),
        id_usuario: Number(inscRow.id_usuario),
        id_atividade: Number(inscRow.id_atividade),
        data_inscricao: inscRow.data_inscricao,
        status: 'CONFIRMADA',
        usuario_nome: user.nome,
        usuario_matricula: user.matricula || undefined,
        evento_titulo: ev.titulo,
        evento_id: Number(ev.id_evento),
        evento_local: ev.local,
        evento_modalidade: ev.modalidade,
        evento_data: ev.data_formatada || ev.data_inicio,
      },
    };
  }

  const evento = inMemoryEvents.find((e) => e.id_evento === eventoId);
  if (!evento) {
    const err = new Error('Evento não encontrado.');
    (err as any).statusCode = 404;
    throw err;
  }

  let atividade = inMemoryActivities.find((a) => a.id_evento === eventoId);
  if (!atividade) {
    atividade = {
      id_atividade: inMemoryActivities.length + 10,
      id_evento: eventoId,
      titulo: evento.titulo,
      tipo: 'Geral',
      data_hora_inicio: evento.data_inicio,
      data_hora_fim: evento.data_fim,
      local: evento.local,
      limite_vagas: 100,
      carga_horaria: 20,
      created_at: new Date().toISOString(),
    };
    inMemoryActivities.push(atividade);
  }

  const already = inMemoryInscriptions.find(
    (i) => i.id_usuario === user.id_usuario && i.id_evento === eventoId && i.status === 'CONFIRMADA'
  );
  if (already) {
    const err = new Error('Você já possui inscrição confirmada para este evento.');
    (err as any).statusCode = 409;
    throw err;
  }

  const nextId =
    inMemoryInscriptions.length > 0
      ? Math.max(...inMemoryInscriptions.map((i) => i.id_inscricao)) + 1
      : 1;
  const created = {
    id_inscricao: nextId,
    id_usuario: user.id_usuario,
    id_atividade: atividade.id_atividade,
    id_evento: eventoId,
    status: 'CONFIRMADA' as const,
    data_inscricao: new Date().toISOString(),
  };
  inMemoryInscriptions.push(created);

  return {
    message: 'Inscrição confirmada com sucesso no IFCE Iventus!',
    inscricao: {
      ...created,
      usuario_nome: user.nome,
      usuario_matricula: user.matricula || undefined,
      evento_titulo: evento.titulo,
      evento_id: evento.id_evento,
      evento_local: evento.local,
      evento_modalidade: evento.modalidade,
      evento_data: evento.data_formatada || evento.data_inicio,
    },
  };
}

export async function cancelEventInscription(
  user: Omit<Usuario, 'senha_hash'>,
  inscricaoId: number
): Promise<{ success: boolean }> {
  await ensurePostgresSchema();

  if (isConfiguredWithRealDatabase) {
    const res = await query('SELECT * FROM inscricao WHERE id_inscricao = $1', [inscricaoId]);
    if (res.rows.length === 0) {
      const err = new Error('Inscrição não encontrada.');
      (err as any).statusCode = 404;
      throw err;
    }
    const row = res.rows[0];
    if (user.perfil !== 'ADMINISTRADOR' && Number(row.id_usuario) !== user.id_usuario) {
      const err = new Error('Você não tem permissão para cancelar esta inscrição.');
      (err as any).statusCode = 403;
      throw err;
    }
    await query(`UPDATE inscricao SET status = 'CANCELADA' WHERE id_inscricao = $1`, [inscricaoId]);
    return { success: true };
  }

  const insc = inMemoryInscriptions.find((i) => i.id_inscricao === inscricaoId);
  if (!insc) {
    const err = new Error('Inscrição não encontrada.');
    (err as any).statusCode = 404;
    throw err;
  }
  if (user.perfil !== 'ADMINISTRADOR' && insc.id_usuario !== user.id_usuario) {
    const err = new Error('Sem permissão para cancelar esta inscrição.');
    (err as any).statusCode = 403;
    throw err;
  }
  insc.status = 'CANCELADA';
  return { success: true };
}

export async function toggleUserFavorite(
  userId: number,
  eventoId: number
): Promise<{ favoritos: number[] }> {
  await ensurePostgresSchema();

  if (isConfiguredWithRealDatabase) {
    const existing = await query(
      `SELECT 1 FROM favorito WHERE id_usuario = $1 AND id_evento = $2`,
      [userId, eventoId]
    );
    if (existing.rows.length > 0) {
      await query(`DELETE FROM favorito WHERE id_usuario = $1 AND id_evento = $2`, [userId, eventoId]);
    } else {
      await query(
        `INSERT INTO favorito (id_usuario, id_evento) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userId, eventoId]
      );
    }
    const all = await query<{ id_evento: number }>(
      `SELECT id_evento FROM favorito WHERE id_usuario = $1`,
      [userId]
    );
    return { favoritos: all.rows.map((r) => Number(r.id_evento)) };
  }

  const current = inMemoryFavorites.get(userId) || [];
  const next = current.includes(eventoId)
    ? current.filter((id) => id !== eventoId)
    : [...current, eventoId];
  inMemoryFavorites.set(userId, next);
  return { favoritos: next };
}

export async function getEventInscriptionsForAttendance(
  staffUser: Omit<Usuario, 'senha_hash'>,
  eventoId: number
): Promise<{
  evento: Evento;
  inscriptions: Inscricao[];
  frequencias: Frequencia[];
  canManageAttendance: boolean;
}> {
  await ensurePostgresSchema();

  if (isConfiguredWithRealDatabase) {
    const evRes = await query(
      `SELECT
         e.id_evento,
         e.id_organizador,
         COALESCE(u.nome, 'Coordenação IFCE') AS organizador_nome,
         e.titulo,
         COALESCE(e.descricao, '') AS descricao,
         e.banner_url,
         e.data_inicio::text AS data_inicio,
         e.data_fim::text AS data_fim,
         e.inicio_inscricoes::text AS inicio_inscricoes,
         e.fim_inscricoes::text AS fim_inscricoes,
         e.status,
         e.local,
         e.modalidade,
         e.horario_formatado,
         e.data_formatada,
         e.created_at::text AS created_at
       FROM evento e
       LEFT JOIN usuario u ON u.id_usuario = e.id_organizador
       WHERE e.id_evento = $1
       LIMIT 1`,
      [eventoId]
    );

    if (evRes.rows.length === 0) {
      const err = new Error('Evento não encontrado.');
      (err as any).statusCode = 404;
      throw err;
    }

    const evRow = evRes.rows[0];
    const canManageAttendance =
      staffUser.perfil === 'ADMINISTRADOR' || Number(evRow.id_organizador) === staffUser.id_usuario;

    const inscRes = await query(
      `SELECT
         i.id_inscricao,
         i.id_usuario,
         i.id_atividade,
         i.data_inscricao::text AS data_inscricao,
         i.status,
         u.nome AS usuario_nome,
         u.email AS usuario_email,
         u.matricula AS usuario_matricula,
         u.perfil AS usuario_perfil,
         a.titulo AS atividade_titulo,
         e.titulo AS evento_titulo,
         e.id_evento AS evento_id,
         e.local AS evento_local,
         e.modalidade AS evento_modalidade,
         COALESCE(e.data_formatada, e.data_inicio::text) AS evento_data,
         f.id_frequencia AS frequencia_id,
         f.presente AS presente,
         f.data_registro::text AS frequencia_registrada_em
       FROM inscricao i
       JOIN usuario u ON u.id_usuario = i.id_usuario
       JOIN atividade a ON a.id_atividade = i.id_atividade
       JOIN evento e ON e.id_evento = a.id_evento
       LEFT JOIN frequencia f ON f.id_inscricao = i.id_inscricao
       WHERE e.id_evento = $1 AND i.status = 'CONFIRMADA'
       ORDER BY u.nome ASC, i.data_inscricao ASC`,
      [eventoId]
    );

    const inscriptions: Inscricao[] = inscRes.rows.map((r) => ({
      id_inscricao: Number(r.id_inscricao),
      id_usuario: Number(r.id_usuario),
      id_atividade: Number(r.id_atividade),
      data_inscricao: r.data_inscricao,
      status: r.status,
      usuario_nome: r.usuario_nome,
      usuario_email: r.usuario_email,
      usuario_matricula: r.usuario_matricula || undefined,
      usuario_perfil: r.usuario_perfil,
      atividade_titulo: r.atividade_titulo,
      evento_titulo: r.evento_titulo,
      evento_id: Number(r.evento_id),
      evento_local: r.evento_local,
      evento_modalidade: r.evento_modalidade,
      evento_data: r.evento_data,
      presente: r.presente === null || r.presente === undefined ? null : Boolean(r.presente),
      frequencia_registrada_em: r.frequencia_registrada_em || null,
    }));

    const frequencias: Frequencia[] = inscRes.rows
      .filter((r) => r.frequencia_id !== null && r.frequencia_id !== undefined)
      .map((r) => ({
        id_frequencia: Number(r.frequencia_id),
        id_inscricao: Number(r.id_inscricao),
        presente: Boolean(r.presente),
        data_registro: r.frequencia_registrada_em || new Date().toISOString(),
      }));

    return {
      evento: {
        ...evRow,
        id_evento: Number(evRow.id_evento),
        id_organizador: Number(evRow.id_organizador),
        inscritos_count: inscriptions.length,
      },
      inscriptions,
      frequencias,
      canManageAttendance,
    };
  }

  const ev = inMemoryEvents.find((e) => e.id_evento === eventoId);
  if (!ev) {
    const err = new Error('Evento não encontrado.');
    (err as any).statusCode = 404;
    throw err;
  }

  const canManageAttendance =
    staffUser.perfil === 'ADMINISTRADOR' || ev.id_organizador === staffUser.id_usuario;

  const evInsc = inMemoryInscriptions.filter(
    (i) => i.id_evento === eventoId && i.status === 'CONFIRMADA'
  );

  const inscriptions: Inscricao[] = evInsc
    .map((i) => {
      const u = inMemoryUsers.find((usr) => usr.id_usuario === i.id_usuario);
      const act = inMemoryActivities.find((a) => a.id_atividade === i.id_atividade);
      const freq = inMemoryAttendances.find((f) => f.id_inscricao === i.id_inscricao);
      return {
        id_inscricao: i.id_inscricao,
        id_usuario: i.id_usuario,
        id_atividade: i.id_atividade,
        data_inscricao: i.data_inscricao,
        status: i.status,
        usuario_nome: u?.nome || 'Participante',
        usuario_email: u?.email || undefined,
        usuario_matricula: u?.matricula || undefined,
        usuario_perfil: u?.perfil,
        atividade_titulo: act?.titulo,
        evento_titulo: ev.titulo,
        evento_id: ev.id_evento,
        evento_local: ev.local,
        evento_modalidade: ev.modalidade,
        evento_data: ev.data_formatada || ev.data_inicio,
        presente: freq ? freq.presente : null,
        frequencia_registrada_em: freq ? freq.data_registro : null,
      };
    })
    .sort((a, b) => (a.usuario_nome || '').localeCompare(b.usuario_nome || '', 'pt-BR'));

  const inscIds = new Set(inscriptions.map((i) => i.id_inscricao));
  const frequencias = inMemoryAttendances
    .filter((f) => inscIds.has(f.id_inscricao))
    .map((f) => ({ ...f }));

  return {
    evento: { ...ev, inscritos_count: inscriptions.length },
    inscriptions,
    frequencias,
    canManageAttendance,
  };
}

export async function setOrToggleAttendance(
  staffUser: Omit<Usuario, 'senha_hash'>,
  inscricaoId: number,
  explicitPresente?: boolean
): Promise<{ frequencia: Frequencia; eventoId: number }> {
  await ensurePostgresSchema();

  if (isConfiguredWithRealDatabase) {
    const inscLookup = await query(
      `SELECT
         i.id_inscricao,
         i.status,
         e.id_evento,
         e.id_organizador,
         f.presente AS current_presente
       FROM inscricao i
       JOIN atividade a ON a.id_atividade = i.id_atividade
       JOIN evento e ON e.id_evento = a.id_evento
       LEFT JOIN frequencia f ON f.id_inscricao = i.id_inscricao
       WHERE i.id_inscricao = $1
       LIMIT 1`,
      [inscricaoId]
    );

    if (inscLookup.rows.length === 0) {
      const err = new Error('Inscrição não encontrada para registro de frequência.');
      (err as any).statusCode = 404;
      throw err;
    }

    const row = inscLookup.rows[0];
    if (row.status !== 'CONFIRMADA') {
      const err = new Error('Não é possível registrar frequência para uma inscrição cancelada.');
      (err as any).statusCode = 400;
      throw err;
    }

    if (staffUser.perfil !== 'ADMINISTRADOR' && Number(row.id_organizador) !== staffUser.id_usuario) {
      const err = new Error(
        'Apenas o professor organizador deste evento ou um administrador pode registrar ou alterar frequências.'
      );
      (err as any).statusCode = 403;
      throw err;
    }

    const nextVal =
      typeof explicitPresente === 'boolean'
        ? explicitPresente
        : row.current_presente === null || row.current_presente === undefined
          ? true
          : !Boolean(row.current_presente);

    const upserted = await query(
      `INSERT INTO frequencia (id_inscricao, presente, data_registro)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (id_inscricao)
       DO UPDATE SET presente = EXCLUDED.presente, data_registro = CURRENT_TIMESTAMP
       RETURNING id_frequencia, id_inscricao, presente, data_registro::text AS data_registro`,
      [inscricaoId, nextVal]
    );

    const saved = upserted.rows[0];
    return {
      frequencia: {
        id_frequencia: Number(saved.id_frequencia),
        id_inscricao: Number(saved.id_inscricao),
        presente: Boolean(saved.presente),
        data_registro: saved.data_registro,
      },
      eventoId: Number(row.id_evento),
    };
  }

  const insc = inMemoryInscriptions.find((i) => i.id_inscricao === inscricaoId);
  if (!insc) {
    const err = new Error('Inscrição não encontrada para registro de frequência.');
    (err as any).statusCode = 404;
    throw err;
  }
  if (insc.status !== 'CONFIRMADA') {
    const err = new Error('Não é possível registrar frequência para uma inscrição cancelada.');
    (err as any).statusCode = 400;
    throw err;
  }

  const ev = inMemoryEvents.find((e) => e.id_evento === insc.id_evento);
  if (!ev) {
    const err = new Error('Evento associado à inscrição não encontrado.');
    (err as any).statusCode = 404;
    throw err;
  }

  if (staffUser.perfil !== 'ADMINISTRADOR' && ev.id_organizador !== staffUser.id_usuario) {
    const err = new Error(
      'Apenas o professor organizador deste evento ou um administrador pode registrar ou alterar frequências.'
    );
    (err as any).statusCode = 403;
    throw err;
  }

  const freq = inMemoryAttendances.find((f) => f.id_inscricao === inscricaoId);
  const nextVal =
    typeof explicitPresente === 'boolean' ? explicitPresente : freq ? !freq.presente : true;

  if (freq) {
    freq.presente = nextVal;
    freq.data_registro = new Date().toISOString();
    return { frequencia: { ...freq }, eventoId: ev.id_evento };
  }
  const created = {
    id_frequencia: inMemoryAttendances.length + 1,
    id_inscricao: inscricaoId,
    presente: nextVal,
    data_registro: new Date().toISOString(),
  };
  inMemoryAttendances.push(created);
  return { frequencia: created, eventoId: ev.id_evento };
}

export async function issueCertificate(
  staffUser: Omit<Usuario, 'senha_hash'>,
  input: {
    participante_nome: string;
    participante_matricula?: string | null;
    evento_titulo: string;
    carga_horaria?: number;
    id_inscricao?: number;
  }
): Promise<{ certificado: Certificado }> {
  await ensurePostgresSchema();

  const nome = input.participante_nome?.trim();
  const eventoTitulo = input.evento_titulo?.trim();
  if (!nome || !eventoTitulo) {
    const err = new Error('Dados insuficientes para emissão de certificado.');
    (err as any).statusCode = 400;
    throw err;
  }

  const cargaHoraria = Number(input.carga_horaria || 20);
  const matricula = input.participante_matricula?.trim() || null;

  if (isConfiguredWithRealDatabase) {
    let idFrequencia: number | null = null;
    let idUsuario: number | null = null;
    let idEvento: number | null = null;

    if (input.id_inscricao) {
      const fRes = await query(
        `SELECT f.id_frequencia, f.presente, i.id_usuario, e.id_evento, e.id_organizador, e.titulo
         FROM inscricao i
         JOIN atividade a ON a.id_atividade = i.id_atividade
         JOIN evento e ON e.id_evento = a.id_evento
         LEFT JOIN frequencia f ON f.id_inscricao = i.id_inscricao
         WHERE i.id_inscricao = $1 LIMIT 1`,
        [input.id_inscricao]
      );
      if (fRes.rows.length === 0) {
        const err = new Error('Inscrição informada para emissão não encontrada.');
        (err as any).statusCode = 404;
        throw err;
      }
      const row = fRes.rows[0];
      if (staffUser.perfil !== 'ADMINISTRADOR' && Number(row.id_organizador) !== staffUser.id_usuario) {
        const err = new Error('Você só pode emitir certificados para eventos sob sua coordenação.');
        (err as any).statusCode = 403;
        throw err;
      }
      if (!row.presente) {
        const err = new Error('O participante precisa estar marcado como Presente para receber o certificado.');
        (err as any).statusCode = 400;
        throw err;
      }
      idFrequencia = row.id_frequencia || null;
      idUsuario = row.id_usuario || null;
      idEvento = row.id_evento || null;
    }

    const existing = await query(
      `SELECT * FROM certificado WHERE LOWER(participante_nome) = LOWER($1) AND LOWER(evento_titulo) = LOWER($2) LIMIT 1`,
      [nome, eventoTitulo]
    );
    if (existing.rows.length > 0) {
      return { certificado: toCertificado(existing.rows[0]) };
    }

    const prefix = eventoTitulo.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'EVNT';
    const rand1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const rand2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const rand3 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const codigo = `IFCE-${prefix}-${rand1}-${rand2}-${rand3}`;

    const ins = await query(
      `INSERT INTO certificado (
        id_frequencia, id_usuario, id_evento, codigo_validacao, status_aprovacao,
        participante_nome, participante_matricula, evento_titulo, atividade_titulo,
        organizador_nome, carga_horaria, data_evento
      ) VALUES ($1, $2, $3, $4, 'APROVADO', $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        idFrequencia,
        idUsuario,
        idEvento,
        codigo,
        nome,
        matricula,
        eventoTitulo,
        'Participação Geral e Aproveitamento nas Atividades Acadêmicas',
        staffUser.nome || 'Coordenação Geral IFCE',
        cargaHoraria,
        new Date().toLocaleDateString('pt-BR'),
      ]
    );

    return { certificado: toCertificado(ins.rows[0]) };
  }

  if (input.id_inscricao) {
    const insc = inMemoryInscriptions.find((i) => i.id_inscricao === input.id_inscricao);
    const ev = insc ? inMemoryEvents.find((e) => e.id_evento === insc.id_evento) : undefined;
    if (ev && staffUser.perfil !== 'ADMINISTRADOR' && ev.id_organizador !== staffUser.id_usuario) {
      const err = new Error('Você só pode emitir certificados para eventos sob sua coordenação.');
      (err as any).statusCode = 403;
      throw err;
    }
    const freq = inMemoryAttendances.find((f) => f.id_inscricao === input.id_inscricao);
    if (!freq || !freq.presente) {
      const err = new Error('O participante precisa estar marcado como Presente para receber o certificado.');
      (err as any).statusCode = 400;
      throw err;
    }
  }

  const existing = inMemoryCertificates.find(
    (c) =>
      c.participante_nome.toLowerCase() === nome.toLowerCase() &&
      c.evento_titulo.toLowerCase() === eventoTitulo.toLowerCase()
  );
  if (existing) {
    return { certificado: toCertificado(existing) };
  }

  const nextId =
    inMemoryCertificates.length > 0
      ? Math.max(...inMemoryCertificates.map((c) => c.id_certificado)) + 1
      : 1;
  const rand1 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const rand2 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const codigo = `IFCE-${eventoTitulo.slice(0, 3).toUpperCase()}-${rand1}-${rand2}-CERT`;

  const created = {
    id_certificado: nextId,
    id_frequencia: input.id_inscricao || nextId,
    codigo_validacao: codigo,
    data_emissao: new Date().toISOString(),
    status_aprovacao: 'APROVADO' as const,
    participante_nome: nome,
    participante_matricula: matricula,
    evento_titulo: eventoTitulo,
    atividade_titulo: 'Participação Geral e Aproveitamento nas Atividades Acadêmicas',
    organizador_nome: staffUser.nome || 'Coordenação Geral IFCE',
    carga_horaria: cargaHoraria,
    data_evento: new Date().toLocaleDateString('pt-BR'),
  };
  inMemoryCertificates.unshift(created);
  return { certificado: toCertificado(created) };
}

export async function moderateCertificate(
  certId: number,
  decision: 'APROVAR' | 'RECUSAR'
): Promise<{ success: boolean; status_aprovacao: 'APROVADO' | 'RECUSADO' }> {
  await ensurePostgresSchema();

  const nextStatus = decision === 'APROVAR' ? 'APROVADO' : 'RECUSADO';

  if (isConfiguredWithRealDatabase) {
    const res = await query(
      `UPDATE certificado SET status_aprovacao = $1 WHERE id_certificado = $2 RETURNING id_certificado`,
      [nextStatus, certId]
    );
    if (res.rows.length === 0) {
      const err = new Error('Certificado não encontrado.');
      (err as any).statusCode = 404;
      throw err;
    }
    return { success: true, status_aprovacao: nextStatus };
  }

  const cert = inMemoryCertificates.find((c) => c.id_certificado === certId);
  if (!cert) {
    const err = new Error('Certificado não encontrado.');
    (err as any).statusCode = 404;
    throw err;
  }
  cert.status_aprovacao = nextStatus;
  return { success: true, status_aprovacao: nextStatus };
}

export async function validateCertificateCode(code: string): Promise<Certificado | null> {
  await ensurePostgresSchema();

  const clean = code ? code.trim().toUpperCase() : '';
  if (!clean || clean.length < 4) return null;

  if (isConfiguredWithRealDatabase) {
    const res = await query(
      `SELECT
         id_certificado,
         COALESCE(id_frequencia, 0) AS id_frequencia,
         codigo_validacao,
         data_emissao::text AS data_emissao,
         status_aprovacao,
         participante_nome,
         participante_matricula,
         evento_titulo,
         atividade_titulo,
         organizador_nome,
         carga_horaria,
         data_evento
       FROM certificado
       WHERE UPPER(codigo_validacao) = $1 AND status_aprovacao = 'APROVADO'
       LIMIT 1`,
      [clean]
    );
    return res.rows[0] || null;
  }

  const found = inMemoryCertificates.find(
    (c) => c.codigo_validacao.toUpperCase() === clean && c.status_aprovacao === 'APROVADO'
  );
  return found ? toCertificado(found) : null;
}
