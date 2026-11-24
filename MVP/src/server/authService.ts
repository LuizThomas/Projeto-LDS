import bcrypt from 'bcryptjs';
import {
  query,
  isConfiguredWithRealDatabase,
  isDemoModeEnabled,
  isProductionEnvironment,
  ensurePostgresSchema,
  inMemoryUsers,
  inMemoryVerificationTokens,
  inMemoryPasswordResetTokens,
  InMemoryUser,
} from '../lib/db';
import {
  generateVerificationToken,
  hashVerificationToken,
  generateVerificationCode,
  hashVerificationCode,
  signAuthToken,
  verifyAuthToken,
  extractAuthToken,
  SessionPayload,
} from './session';
import { verifyMutationOrigin, sanitizeImageUrlOrDataUri } from './http';
import { sendVerificationEmail, sendPasswordResetEmail } from './emailService';
import { checkRateLimit } from './rateLimit';
import { PerfilUsuario, StatusConta, Usuario } from '../types';

export interface RegisterInput {
  nome: string;
  email: string;
  senha: string;
  perfil?: PerfilUsuario;
  matricula?: string;
  telefone?: string;
  materias?: string;
  ip?: string;
  baseUrl?: string;
}

export interface SimulatedVerificationPayload {
  code: string;
  token: string;
  expiresAt: string;
  notice: string;
}

export interface RegisterResult {
  success: boolean;
  requiresEmailVerification: boolean;
  requiresAdminApproval: boolean;
  verificationMode?: 'simulated';
  simulatedVerification?: SimulatedVerificationPayload;
  message: string;
  user?: Omit<Usuario, 'senha_hash'>;
  emailPreviewUrl?: string;
  emailProvider?: 'smtp' | 'resend' | 'ethereal_test' | 'simulated';
  storage: 'postgresql' | 'memory_preview';
}

const PUBLIC_REGISTER_PERFIS = ['PARTICIPANTE', 'PROFESSOR'] as const;

export function sanitizeUser(u: any): Omit<Usuario, 'senha_hash'> {
  return {
    id_usuario: Number(u.id_usuario),
    nome: u.nome,
    email: u.email,
    matricula: u.matricula ?? null,
    perfil: u.perfil,
    status_conta: u.status_conta || 'ATIVO',
    email_verificado: Boolean(u.email_verificado),
    email_verificado_em: u.email_verificado_em ?? null,
    foto_perfil: u.foto_perfil ?? null,
    telefone: u.telefone ?? null,
    materias: u.materias ?? null,
    aprovado_por: u.aprovado_por ?? null,
    decisao_em: u.decisao_em ?? null,
    motivo_decisao: u.motivo_decisao ?? null,
    created_at: u.created_at,
  };
}

function buildSignedSessionForUser(sanitized: Omit<Usuario, 'senha_hash'>): string {
  return signAuthToken({
    id_usuario: sanitized.id_usuario,
    email: sanitized.email,
    nome: sanitized.nome,
    perfil: sanitized.perfil,
    status_conta: (sanitized.status_conta || 'ATIVO') as StatusConta,
    email_verificado: Boolean(sanitized.email_verificado),
  });
}

export async function getBootstrapStatus(): Promise<{
  needsAdminSetup: boolean;
  demoMode: boolean;
  storage: 'postgresql' | 'memory_preview';
}> {
  await ensurePostgresSchema();
  const demoMode = isDemoModeEnabled();

  if (isConfiguredWithRealDatabase) {
    const res = await query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM usuario WHERE perfil = 'ADMINISTRADOR'`
    );
    const totalAdmins = res.rows[0]?.total || 0;
    return {
      needsAdminSetup: totalAdmins === 0,
      demoMode,
      storage: 'postgresql',
    };
  }

  return {
    needsAdminSetup: false,
    demoMode,
    storage: 'memory_preview',
  };
}

/**
 * Allows creating the very first ADMINISTRADOR account on a brand-new PostgreSQL database
 * only while zero administrators exist in the database.
 */
export async function bootstrapFirstAdmin(input: {
  nome: string;
  email: string;
  senha: string;
  matricula?: string;
}): Promise<{
  success: boolean;
  user: Omit<Usuario, 'senha_hash'>;
  token: string;
}> {
  await ensurePostgresSchema();

  if (!isConfiguredWithRealDatabase) {
    const err = new Error('Configuração inicial de administrador disponível apenas com PostgreSQL ativo.');
    (err as any).statusCode = 400;
    throw err;
  }

  const adminCheck = await query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM usuario WHERE perfil = 'ADMINISTRADOR'`
  );
  if ((adminCheck.rows[0]?.total || 0) > 0) {
    const err = new Error('Já existe um administrador configurado no sistema.');
    (err as any).statusCode = 409;
    throw err;
  }

  const nome = input.nome ? input.nome.trim() : '';
  const email = input.email ? input.email.trim().toLowerCase() : '';
  const senha = input.senha ? input.senha.trim() : '';
  const matricula = input.matricula ? input.matricula.trim() : 'ADM-001';

  if (nome.length < 3) {
    const err = new Error('O nome do administrador deve ter no mínimo 3 caracteres.');
    (err as any).statusCode = 400;
    throw err;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const err = new Error('Informe um e-mail válido.');
    (err as any).statusCode = 400;
    throw err;
  }
  if (senha.length < 8) {
    const err = new Error('A senha do administrador inicial deve ter no mínimo 8 caracteres.');
    (err as any).statusCode = 400;
    throw err;
  }

  const existingEmail = await query('SELECT id_usuario FROM usuario WHERE LOWER(email) = LOWER($1)', [
    email,
  ]);
  if (existingEmail.rows.length > 0) {
    const err = new Error('Já existe uma conta cadastrada com este e-mail.');
    (err as any).statusCode = 409;
    throw err;
  }

  const senhaHash = await bcrypt.hash(senha, 12);
  const insertRes = await query(
    `INSERT INTO usuario (
      nome, email, senha_hash, matricula, perfil, status_conta, email_verificado, email_verificado_em
    ) VALUES ($1, $2, $3, $4, 'ADMINISTRADOR', 'ATIVO', TRUE, CURRENT_TIMESTAMP)
    RETURNING *`,
    [nome, email, senhaHash, matricula]
  );

  const sanitized = sanitizeUser(insertRes.rows[0]);
  return {
    success: true,
    user: sanitized,
    token: buildSignedSessionForUser(sanitized),
  };
}

/**
 * Registers a new Student (email verification) or Professor (pending admin approval).
 */
export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  await ensurePostgresSchema();

  const nome = input.nome ? input.nome.trim() : '';
  const email = input.email ? input.email.trim().toLowerCase() : '';
  const senha = input.senha ? input.senha.trim() : '';
  const perfil: PerfilUsuario = input.perfil || 'PARTICIPANTE';
  const telefone = input.telefone ? input.telefone.trim() : null;
  const materias = input.materias ? input.materias.trim() : null;

  if (!nome || nome.length < 3) {
    const err = new Error('O nome completo deve ter no mínimo 3 caracteres.');
    (err as any).statusCode = 400;
    throw err;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    const err = new Error('Forneça um endereço de e-mail válido.');
    (err as any).statusCode = 400;
    throw err;
  }

  if (!senha || senha.length < 6) {
    const err = new Error('A senha deve ter no mínimo 6 caracteres.');
    (err as any).statusCode = 400;
    throw err;
  }

  if (!PUBLIC_REGISTER_PERFIS.includes(perfil as any)) {
    const err = new Error(
      'Perfil inválido para autocadastro. Selecione Participante (Aluno) ou Professor.'
    );
    (err as any).statusCode = 400;
    throw err;
  }

  if (perfil === 'PROFESSOR' && (!materias || materias.length < 3)) {
    const err = new Error(
      'Informe sua área de atuação ou disciplinas ministradas para análise administrativa.'
    );
    (err as any).statusCode = 400;
    throw err;
  }

  let matricula = input.matricula ? input.matricula.trim() : null;
  if (!matricula) {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    matricula = perfil === 'PARTICIPANTE' ? `20261${randomNum}` : `DOC-${randomNum}`;
  }

  const senhaHash = await bcrypt.hash(senha, 10);

  const isStudent = perfil === 'PARTICIPANTE';
  const statusConta: StatusConta = isStudent ? 'ATIVO' : 'PENDENTE';
  const emailVerificado = !isStudent;

  const tokenPair = isStudent ? generateVerificationToken() : null;
  const codePair = isStudent ? generateVerificationCode(email) : null;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  if (isConfiguredWithRealDatabase) {
    const existingUserResult = await query(
      'SELECT id_usuario, email, matricula, perfil, status_conta FROM usuario WHERE LOWER(email) = LOWER($1) OR (matricula IS NOT NULL AND LOWER(matricula) = LOWER($2))',
      [email, matricula]
    );

    if (existingUserResult.rows.length > 0) {
      const existing = existingUserResult.rows[0];
      let msg = 'Já existe um usuário cadastrado com este e-mail.';
      if (existing.email?.toLowerCase() === email) {
        msg =
          existing.perfil === 'PROFESSOR' && existing.status_conta === 'PENDENTE'
            ? 'Já existe uma solicitação de cadastro pendente para este e-mail de professor.'
            : 'Já existe um usuário cadastrado com este e-mail.';
      } else {
        msg = 'Esta matrícula / SIAPE já está vinculada a outro cadastro no sistema.';
      }
      const error = new Error(msg);
      (error as any).statusCode = 409;
      throw error;
    }

    const insertSQL = `
      INSERT INTO usuario (
        nome, email, senha_hash, matricula, perfil, status_conta,
        email_verificado, email_verificado_em, telefone, materias
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;

    const result = await query(insertSQL, [
      nome,
      email,
      senhaHash,
      matricula,
      perfil,
      statusConta,
      emailVerificado,
      emailVerificado ? new Date().toISOString() : null,
      telefone,
      materias,
    ]);

    const createdUser = result.rows[0];

    if (isStudent && tokenPair && codePair) {
      await query(
        `INSERT INTO email_verification_tokens (id_usuario, token_hash, code_hash, expires_at, ip_origem)
         VALUES ($1, $2, $3, $4, $5)`,
        [createdUser.id_usuario, tokenPair.tokenHash, codePair.codeHash, expiresAt, input.ip || null]
      );

      return {
        success: true,
        requiresEmailVerification: true,
        requiresAdminApproval: false,
        verificationMode: 'simulated',
        simulatedVerification: {
          code: codePair.code,
          token: tokenPair.rawToken,
          expiresAt,
          notice:
            'Recurso de demonstração: verificação de e-mail simulada localmente sem envio por servidor externo.',
        },
        message:
          'Cadastro realizado! Conclua a verificação simulada de e-mail para liberar seu acesso de participante.',
        user: sanitizeUser(createdUser),
        emailProvider: 'simulated',
        storage: 'postgresql',
      };
    }

    return {
      success: true,
      requiresEmailVerification: false,
      requiresAdminApproval: true,
      message:
        'Solicitação enviada! Seu cadastro de professor está pendente e aguarda aprovação de um administrador.',
      user: sanitizeUser(createdUser),
      storage: 'postgresql',
    };
  }

  // Non-production preview fallback
  const existingInMemory = inMemoryUsers.find(
    (u) =>
      u.email.toLowerCase() === email ||
      (u.matricula && matricula && u.matricula.toLowerCase() === matricula.toLowerCase())
  );
  if (existingInMemory) {
    let msg = 'Já existe um usuário cadastrado com este e-mail.';
    if (existingInMemory.email.toLowerCase() === email) {
      msg =
        existingInMemory.perfil === 'PROFESSOR' && existingInMemory.status_conta === 'PENDENTE'
          ? 'Já existe uma solicitação de cadastro pendente para este e-mail de professor.'
          : 'Já existe um usuário cadastrado com este e-mail.';
    } else {
      msg = 'Esta matrícula / SIAPE já está vinculada a outro cadastro no sistema.';
    }
    const error = new Error(msg);
    (error as any).statusCode = 409;
    throw error;
  }

  const newId =
    inMemoryUsers.length > 0 ? Math.max(...inMemoryUsers.map((u) => u.id_usuario)) + 1 : 100;

  const newUser: InMemoryUser = {
    id_usuario: newId,
    nome,
    email,
    senha_hash: senhaHash,
    matricula,
    perfil,
    status_conta: statusConta,
    email_verificado: emailVerificado,
    email_verificado_em: emailVerificado ? new Date().toISOString() : null,
    telefone,
    materias,
    created_at: new Date().toISOString(),
  };

  inMemoryUsers.push(newUser);

  if (isStudent && tokenPair && codePair) {
    inMemoryVerificationTokens.push({
      id: inMemoryVerificationTokens.length + 1,
      id_usuario: newUser.id_usuario,
      token_hash: tokenPair.tokenHash,
      code_hash: codePair.codeHash,
      failed_attempts: 0,
      expires_at: expiresAt,
      used_at: null,
      ip_origem: input.ip || null,
      created_at: new Date().toISOString(),
    });

    return {
      success: true,
      requiresEmailVerification: true,
      requiresAdminApproval: false,
      verificationMode: 'simulated',
      simulatedVerification: {
        code: codePair.code,
        token: tokenPair.rawToken,
        expiresAt,
        notice:
          'Recurso de demonstração: verificação de e-mail simulada localmente sem envio por servidor externo.',
      },
      message:
        'Cadastro realizado! Conclua a verificação simulada de e-mail para liberar seu acesso de participante.',
      user: sanitizeUser(newUser),
      emailProvider: 'simulated',
      storage: 'memory_preview',
    };
  }

  return {
    success: true,
    requiresEmailVerification: false,
    requiresAdminApproval: true,
    message:
      'Solicitação enviada! Seu cadastro de professor está pendente e aguarda aprovação de um administrador.',
    user: sanitizeUser(newUser),
    storage: 'memory_preview',
  };
}

export async function verifyEmailToken(rawToken: string): Promise<{
  success: boolean;
  message: string;
  verificationMode?: 'simulated';
  user?: Omit<Usuario, 'senha_hash'>;
  token?: string;
}> {
  await ensurePostgresSchema();

  if (!rawToken || rawToken.trim().length < 16) {
    const err = new Error('Token de verificação inválido ou malformado.');
    (err as any).statusCode = 400;
    (err as any).errorCode = 'TOKEN_INVALID';
    throw err;
  }

  const tokenHash = hashVerificationToken(rawToken);

  if (isConfiguredWithRealDatabase) {
    const tokenRes = await query(
      `SELECT t.id, t.id_usuario, t.expires_at, t.used_at
       FROM email_verification_tokens t
       WHERE t.token_hash = $1`,
      [tokenHash]
    );

    if (tokenRes.rows.length === 0) {
      const err = new Error('Link de verificação inválido ou inexistente.');
      (err as any).statusCode = 400;
      (err as any).errorCode = 'TOKEN_INVALID';
      throw err;
    }

    const row = tokenRes.rows[0];

    if (row.used_at) {
      const err = new Error(
        'Este link de verificação já foi utilizado anteriormente. Faça login para acessar sua conta.'
      );
      (err as any).statusCode = 409;
      (err as any).errorCode = 'TOKEN_ALREADY_USED';
      throw err;
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      const err = new Error(
        'Este link de verificação expirou. Solicite um novo e-mail de confirmação.'
      );
      (err as any).statusCode = 410;
      (err as any).errorCode = 'TOKEN_EXPIRED';
      throw err;
    }

    const markUsed = await query(
      `UPDATE email_verification_tokens
       SET used_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND used_at IS NULL
       RETURNING id`,
      [row.id]
    );

    if (markUsed.rows.length === 0) {
      const err = new Error('Este link de verificação já foi utilizado.');
      (err as any).statusCode = 409;
      (err as any).errorCode = 'TOKEN_ALREADY_USED';
      throw err;
    }

    const updatedUser = await query(
      `UPDATE usuario
       SET email_verificado = TRUE,
           email_verificado_em = CURRENT_TIMESTAMP,
           status_conta = CASE WHEN perfil = 'PARTICIPANTE' THEN 'ATIVO' ELSE status_conta END
       WHERE id_usuario = $1
       RETURNING *`,
      [row.id_usuario]
    );

    const sanitized = sanitizeUser(updatedUser.rows[0]);
    const isParticipant = sanitized.perfil === 'PARTICIPANTE';
    return {
      success: true,
      verificationMode: isParticipant ? 'simulated' : undefined,
      message: isParticipant
        ? 'E-mail verificado por simulação! Seu acesso como participante foi liberado.'
        : 'E-mail confirmado com sucesso! Sua conta foi ativada e já pode ser utilizada.',
      user: sanitized,
      token: buildSignedSessionForUser(sanitized),
    };
  }

  const tokenEntry = inMemoryVerificationTokens.find((t) => t.token_hash === tokenHash);
  if (!tokenEntry) {
    const err = new Error('Link de verificação inválido ou inexistente.');
    (err as any).statusCode = 400;
    (err as any).errorCode = 'TOKEN_INVALID';
    throw err;
  }

  if (tokenEntry.used_at) {
    const err = new Error(
      'Este link de verificação já foi utilizado anteriormente. Faça login para acessar sua conta.'
    );
    (err as any).statusCode = 409;
    (err as any).errorCode = 'TOKEN_ALREADY_USED';
    throw err;
  }

  if (new Date(tokenEntry.expires_at).getTime() < Date.now()) {
    const err = new Error(
      'Este link de verificação expirou. Solicite um novo e-mail de confirmação.'
    );
    (err as any).statusCode = 410;
    (err as any).errorCode = 'TOKEN_EXPIRED';
    throw err;
  }

  tokenEntry.used_at = new Date().toISOString();
  const user = inMemoryUsers.find((u) => u.id_usuario === tokenEntry.id_usuario);
  if (!user) {
    const err = new Error('Usuário associado ao token não encontrado.');
    (err as any).statusCode = 404;
    throw err;
  }

  user.email_verificado = true;
  user.email_verificado_em = new Date().toISOString();
  if (user.perfil === 'PARTICIPANTE') {
    user.status_conta = 'ATIVO';
  }

  const sanitized = sanitizeUser(user);
  const isParticipant = sanitized.perfil === 'PARTICIPANTE';
  return {
    success: true,
    verificationMode: isParticipant ? 'simulated' : undefined,
    message: isParticipant
      ? 'E-mail verificado por simulação! Seu acesso como participante foi liberado.'
      : 'E-mail confirmado com sucesso! Sua conta foi ativada e já pode ser utilizada.',
    user: sanitized,
    token: buildSignedSessionForUser(sanitized),
  };
}

export async function verifyEmailCode(params: {
  email: string;
  code: string;
}): Promise<{
  success: boolean;
  message: string;
  verificationMode?: 'simulated';
  user?: Omit<Usuario, 'senha_hash'>;
  token?: string;
}> {
  await ensurePostgresSchema();

  const email = params.email ? params.email.trim().toLowerCase() : '';
  const code = params.code ? params.code.replace(/\D/g, '').trim() : '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const err = new Error('Informe um e-mail válido.');
    (err as any).statusCode = 400;
    (err as any).errorCode = 'INVALID_EMAIL';
    throw err;
  }

  if (!/^\d{6}$/.test(code)) {
    const err = new Error('Informe o código numérico de 6 dígitos enviado para seu e-mail.');
    (err as any).statusCode = 400;
    (err as any).errorCode = 'CODE_INVALID_FORMAT';
    throw err;
  }

  const expectedCodeHash = hashVerificationCode(email, code);

  if (isConfiguredWithRealDatabase) {
    const userRes = await query('SELECT * FROM usuario WHERE LOWER(email) = LOWER($1)', [email]);
    if (userRes.rows.length === 0) {
      const err = new Error('Conta não encontrada para este e-mail.');
      (err as any).statusCode = 404;
      throw err;
    }

    const user = userRes.rows[0];
    if (user.email_verificado) {
      const err = new Error('Este e-mail já foi verificado anteriormente. Faça login normalmente.');
      (err as any).statusCode = 409;
      (err as any).errorCode = 'ALREADY_VERIFIED';
      throw err;
    }

    const tokenRes = await query(
      `SELECT * FROM email_verification_tokens
       WHERE id_usuario = $1 AND used_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [user.id_usuario]
    );

    if (tokenRes.rows.length === 0) {
      const err = new Error('Nenhum código pendente encontrado. Solicite o reenvio do e-mail.');
      (err as any).statusCode = 400;
      (err as any).errorCode = 'TOKEN_INVALID';
      throw err;
    }

    const row = tokenRes.rows[0];

    if (new Date(row.expires_at).getTime() < Date.now()) {
      const err = new Error('Este código expirou. Solicite um novo e-mail de verificação.');
      (err as any).statusCode = 410;
      (err as any).errorCode = 'TOKEN_EXPIRED';
      throw err;
    }

    if ((row.failed_attempts || 0) >= 5) {
      await query('UPDATE email_verification_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1', [
        row.id,
      ]);
      const err = new Error(
        'Muitas tentativas incorretas. Por segurança, solicite um novo código de verificação.'
      );
      (err as any).statusCode = 429;
      (err as any).errorCode = 'MAX_ATTEMPTS_EXCEEDED';
      throw err;
    }

    if (row.code_hash !== expectedCodeHash) {
      await query(
        'UPDATE email_verification_tokens SET failed_attempts = failed_attempts + 1 WHERE id = $1',
        [row.id]
      );
      const remaining = Math.max(0, 4 - (row.failed_attempts || 0));
      const err = new Error(
        remaining > 0
          ? `Código incorreto. Você ainda tem ${remaining} tentativa(s) antes de precisar gerar um novo código.`
          : 'Código incorreto. Limite de tentativas atingido — solicite um novo e-mail.'
      );
      (err as any).statusCode = 400;
      (err as any).errorCode = 'CODE_MISMATCH';
      throw err;
    }

    const markUsed = await query(
      `UPDATE email_verification_tokens
       SET used_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND used_at IS NULL
       RETURNING id`,
      [row.id]
    );
    if (markUsed.rows.length === 0) {
      const err = new Error('Este código já foi utilizado.');
      (err as any).statusCode = 409;
      (err as any).errorCode = 'TOKEN_ALREADY_USED';
      throw err;
    }

    const updatedUser = await query(
      `UPDATE usuario
       SET email_verificado = TRUE,
           email_verificado_em = CURRENT_TIMESTAMP,
           status_conta = CASE WHEN perfil = 'PARTICIPANTE' THEN 'ATIVO' ELSE status_conta END
       WHERE id_usuario = $1
       RETURNING *`,
      [user.id_usuario]
    );

    const sanitized = sanitizeUser(updatedUser.rows[0]);
    const isParticipant = sanitized.perfil === 'PARTICIPANTE';
    return {
      success: true,
      verificationMode: isParticipant ? 'simulated' : undefined,
      message: isParticipant
        ? 'E-mail verificado por simulação! Seu acesso como participante foi liberado.'
        : 'E-mail confirmado com sucesso! Sua conta foi ativada.',
      user: sanitized,
      token: buildSignedSessionForUser(sanitized),
    };
  }

  const user = inMemoryUsers.find((u) => u.email.toLowerCase() === email);
  if (!user) {
    const err = new Error('Conta não encontrada para este e-mail.');
    (err as any).statusCode = 404;
    throw err;
  }

  if (user.email_verificado) {
    const err = new Error('Este e-mail já foi verificado anteriormente. Faça login normalmente.');
    (err as any).statusCode = 409;
    (err as any).errorCode = 'ALREADY_VERIFIED';
    throw err;
  }

  const activeEntry = [...inMemoryVerificationTokens]
    .reverse()
    .find((t) => t.id_usuario === user.id_usuario && !t.used_at);

  if (!activeEntry) {
    const err = new Error('Nenhum código pendente encontrado. Solicite o reenvio do e-mail.');
    (err as any).statusCode = 400;
    (err as any).errorCode = 'TOKEN_INVALID';
    throw err;
  }

  if (new Date(activeEntry.expires_at).getTime() < Date.now()) {
    const err = new Error('Este código expirou. Solicite um novo e-mail de verificação.');
    (err as any).statusCode = 410;
    (err as any).errorCode = 'TOKEN_EXPIRED';
    throw err;
  }

  if (activeEntry.failed_attempts >= 5) {
    activeEntry.used_at = new Date().toISOString();
    const err = new Error(
      'Muitas tentativas incorretas. Por segurança, solicite um novo código de verificação.'
    );
    (err as any).statusCode = 429;
    (err as any).errorCode = 'MAX_ATTEMPTS_EXCEEDED';
    throw err;
  }

  if (activeEntry.code_hash !== expectedCodeHash) {
    activeEntry.failed_attempts += 1;
    const remaining = Math.max(0, 5 - activeEntry.failed_attempts);
    const err = new Error(
      remaining > 0
        ? `Código incorreto. Você ainda tem ${remaining} tentativa(s) restante(s).`
        : 'Código incorreto. Limite de tentativas atingido — solicite um novo e-mail.'
    );
    (err as any).statusCode = 400;
    (err as any).errorCode = 'CODE_MISMATCH';
    throw err;
  }

  activeEntry.used_at = new Date().toISOString();
  user.email_verificado = true;
  user.email_verificado_em = new Date().toISOString();
  if (user.perfil === 'PARTICIPANTE') {
    user.status_conta = 'ATIVO';
  }

  const sanitized = sanitizeUser(user);
  const isParticipant = sanitized.perfil === 'PARTICIPANTE';
  return {
    success: true,
    verificationMode: isParticipant ? 'simulated' : undefined,
    message: isParticipant
      ? 'E-mail verificado por simulação! Seu acesso como participante foi liberado.'
      : 'E-mail confirmado com sucesso! Sua conta foi ativada.',
    user: sanitized,
    token: buildSignedSessionForUser(sanitized),
  };
}

export async function resendVerificationEmail(params: {
  email: string;
  ip?: string;
  baseUrl?: string;
}): Promise<{
  success: boolean;
  message: string;
  verificationMode?: 'simulated';
  simulatedVerification?: SimulatedVerificationPayload;
  emailPreviewUrl?: string;
  emailProvider?: 'smtp' | 'resend' | 'ethereal_test' | 'simulated';
}> {
  await ensurePostgresSchema();

  const email = params.email ? params.email.trim().toLowerCase() : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const err = new Error('Informe um e-mail válido.');
    (err as any).statusCode = 400;
    throw err;
  }

  const cooldownCheck = checkRateLimit(`resend:cooldown:${email}`, 1, 10 * 1000);
  if (!cooldownCheck.allowed) {
    const err = new Error(
      `Aguarde ${cooldownCheck.retryAfterSeconds} segundos antes de gerar um novo código de verificação.`
    );
    (err as any).statusCode = 429;
    (err as any).retryAfterSeconds = cooldownCheck.retryAfterSeconds;
    throw err;
  }

  const hourlyCheck = checkRateLimit(`resend:hour:${email}`, 12, 60 * 60 * 1000);
  if (!hourlyCheck.allowed) {
    const err = new Error(
      'Limite de solicitações atingido para este e-mail. Tente novamente mais tarde.'
    );
    (err as any).statusCode = 429;
    throw err;
  }

  const tokenPair = generateVerificationToken();
  const codePair = generateVerificationCode(email);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  if (isConfiguredWithRealDatabase) {
    const userRes = await query('SELECT * FROM usuario WHERE LOWER(email) = LOWER($1)', [email]);
    if (userRes.rows.length === 0) {
      const err = new Error('Nenhuma conta encontrada com este endereço de e-mail.');
      (err as any).statusCode = 404;
      throw err;
    }

    const user = userRes.rows[0];
    if (user.email_verificado) {
      const err = new Error('Este e-mail já foi verificado. Você já pode fazer login normalmente.');
      (err as any).statusCode = 400;
      (err as any).errorCode = 'ALREADY_VERIFIED';
      throw err;
    }

    await query(
      `UPDATE email_verification_tokens SET used_at = CURRENT_TIMESTAMP
       WHERE id_usuario = $1 AND used_at IS NULL`,
      [user.id_usuario]
    );

    await query(
      `INSERT INTO email_verification_tokens (id_usuario, token_hash, code_hash, expires_at, ip_origem)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id_usuario, tokenPair.tokenHash, codePair.codeHash, expiresAt, params.ip || null]
    );

    if (user.perfil === 'PARTICIPANTE') {
      return {
        success: true,
        verificationMode: 'simulated',
        simulatedVerification: {
          code: codePair.code,
          token: tokenPair.rawToken,
          expiresAt,
          notice:
            'Recurso de demonstração: verificação de e-mail simulada localmente sem envio por servidor externo.',
        },
        message: 'Novo código de verificação simulada gerado! Conclua a etapa abaixo.',
        emailProvider: 'simulated',
      };
    }

    const emailResult = await sendVerificationEmail({
      toEmail: user.email,
      nome: user.nome,
      rawToken: tokenPair.rawToken,
      verificationCode: codePair.code,
      baseUrl: params.baseUrl,
    });

    return {
      success: true,
      message:
        emailResult.provider === 'ethereal_test'
          ? 'Novo e-mail enviado para a caixa de testes Ethereal!'
          : 'Novo e-mail de verificação enviado com sucesso! Confira sua caixa de entrada e spam.',
      emailPreviewUrl: emailResult.previewUrl,
      emailProvider: emailResult.provider,
    };
  }

  const user = inMemoryUsers.find((u) => u.email.toLowerCase() === email);
  if (!user) {
    const err = new Error('Nenhuma conta encontrada com este endereço de e-mail.');
    (err as any).statusCode = 404;
    throw err;
  }

  if (user.email_verificado) {
    const err = new Error('Este e-mail já foi verificado. Você já pode fazer login normalmente.');
    (err as any).statusCode = 400;
    (err as any).errorCode = 'ALREADY_VERIFIED';
    throw err;
  }

  const nowIso = new Date().toISOString();
  inMemoryVerificationTokens.forEach((t) => {
    if (t.id_usuario === user.id_usuario && !t.used_at) {
      t.used_at = nowIso;
    }
  });

  inMemoryVerificationTokens.push({
    id: inMemoryVerificationTokens.length + 1,
    id_usuario: user.id_usuario,
    token_hash: tokenPair.tokenHash,
    code_hash: codePair.codeHash,
    failed_attempts: 0,
    expires_at: expiresAt,
    used_at: null,
    ip_origem: params.ip || null,
    created_at: nowIso,
  });

  if (user.perfil === 'PARTICIPANTE') {
    return {
      success: true,
      verificationMode: 'simulated',
      simulatedVerification: {
        code: codePair.code,
        token: tokenPair.rawToken,
        expiresAt,
        notice:
          'Recurso de demonstração: verificação de e-mail simulada localmente sem envio por servidor externo.',
      },
      message: 'Novo código de verificação simulada gerado! Conclua a etapa abaixo.',
      emailProvider: 'simulated',
    };
  }

  const emailResult = await sendVerificationEmail({
    toEmail: user.email,
    nome: user.nome,
    rawToken: tokenPair.rawToken,
    verificationCode: codePair.code,
    baseUrl: params.baseUrl,
  });

  return {
    success: true,
    message:
      emailResult.provider === 'ethereal_test'
        ? 'Novo e-mail enviado para a caixa de testes Ethereal!'
        : 'Novo e-mail de verificação enviado com sucesso! Confira sua caixa de entrada e spam.',
    emailPreviewUrl: emailResult.previewUrl,
    emailProvider: emailResult.provider,
  };
}

/**
 * Authenticates user credentials. Demo quick login is ONLY allowed when demo mode is active
 * in non-production environments (never in production).
 */
export async function loginUser(params: {
  email: string;
  senha: string;
  isDemoQuickLogin?: boolean;
}): Promise<{
  success: boolean;
  token: string;
  user: Omit<Usuario, 'senha_hash'>;
}> {
  await ensurePostgresSchema();

  const email = params.email ? params.email.trim().toLowerCase() : '';
  const senha = params.senha ? params.senha : '';

  if (!email) {
    const err = new Error('Informe seu e-mail.');
    (err as any).statusCode = 400;
    throw err;
  }

  if (params.isDemoQuickLogin && (!isDemoModeEnabled() || isProductionEnvironment())) {
    const err = new Error('Login rápido de demonstração está desabilitado neste ambiente.');
    (err as any).statusCode = 403;
    (err as any).errorCode = 'DEMO_LOGIN_DISABLED';
    throw err;
  }

  let user: any = null;
  if (isConfiguredWithRealDatabase) {
    const res = await query('SELECT * FROM usuario WHERE LOWER(email) = LOWER($1)', [email]);
    user = res.rows[0] || null;
  } else {
    user = inMemoryUsers.find((u) => u.email.toLowerCase() === email) || null;
  }

  if (!user) {
    const err = new Error('E-mail ou senha incorretos.');
    (err as any).statusCode = 401;
    throw err;
  }

  if (!params.isDemoQuickLogin) {
    if (!senha) {
      const err = new Error('Informe sua senha.');
      (err as any).statusCode = 400;
      throw err;
    }
    const isPasswordValid = await bcrypt.compare(senha, user.senha_hash || '');
    if (!isPasswordValid) {
      const err = new Error('E-mail ou senha incorretos.');
      (err as any).statusCode = 401;
      throw err;
    }
  }

  if (user.perfil === 'PARTICIPANTE' && !user.email_verificado) {
    const err = new Error(
      'Seu endereço de e-mail ainda não foi confirmado. Digite o código de 6 dígitos enviado para seu e-mail ou clique no link de confirmação.'
    );
    (err as any).statusCode = 403;
    (err as any).errorCode = 'EMAIL_NOT_VERIFIED';
    (err as any).email = user.email;
    throw err;
  }

  if (user.perfil === 'PROFESSOR' && user.status_conta === 'PENDENTE') {
    const err = new Error(
      'Sua solicitação de cadastro como professor está aguardando análise e aprovação de um administrador.'
    );
    (err as any).statusCode = 403;
    (err as any).errorCode = 'PROFESSOR_PENDING';
    throw err;
  }

  if (user.status_conta === 'RECUSADO') {
    const reasonText = user.motivo_decisao ? ` Motivo informado: ${user.motivo_decisao}` : '';
    const err = new Error(
      `Sua solicitação de cadastro foi rejeitada pela administração do IFCE.${reasonText}`
    );
    (err as any).statusCode = 403;
    (err as any).errorCode = 'ACCOUNT_REJECTED';
    throw err;
  }

  const sanitized = sanitizeUser(user);
  const token = buildSignedSessionForUser(sanitized);

  return {
    success: true,
    token,
    user: sanitized,
  };
}

/**
 * Initiates a real password reset flow (6-digit code + expiring token sent via email)
 */
export async function requestPasswordReset(params: {
  email: string;
  ip?: string;
  baseUrl?: string;
}): Promise<{
  success: boolean;
  message: string;
  emailPreviewUrl?: string;
  emailProvider?: 'smtp' | 'resend' | 'ethereal_test';
}> {
  await ensurePostgresSchema();

  const email = params.email ? params.email.trim().toLowerCase() : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const err = new Error('Informe um endereço de e-mail válido.');
    (err as any).statusCode = 400;
    throw err;
  }

  const rl = checkRateLimit(`pwdreset:${email}`, 3, 15 * 60 * 1000);
  if (!rl.allowed) {
    const err = new Error(
      `Muitas solicitações de recuperação. Aguarde ${rl.retryAfterSeconds} segundos.`
    );
    (err as any).statusCode = 429;
    throw err;
  }

  const genericMessage =
    'Se este e-mail estiver cadastrado no sistema, enviaremos um código e um link de recuperação válidos por 60 minutos.';

  let user: any = null;
  if (isConfiguredWithRealDatabase) {
    const res = await query('SELECT * FROM usuario WHERE LOWER(email) = LOWER($1)', [email]);
    user = res.rows[0] || null;
  } else {
    user = inMemoryUsers.find((u) => u.email.toLowerCase() === email) || null;
  }

  if (!user) {
    return { success: true, message: genericMessage };
  }

  const tokenPair = generateVerificationToken();
  const codePair = generateVerificationCode(email);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  if (isConfiguredWithRealDatabase) {
    await query(
      `UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP
       WHERE id_usuario = $1 AND used_at IS NULL`,
      [user.id_usuario]
    );
    await query(
      `INSERT INTO password_reset_tokens (id_usuario, token_hash, code_hash, expires_at, ip_origem)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id_usuario, tokenPair.tokenHash, codePair.codeHash, expiresAt, params.ip || null]
    );
  } else {
    inMemoryPasswordResetTokens.forEach((t) => {
      if (t.id_usuario === user.id_usuario && !t.used_at) {
        t.used_at = new Date().toISOString();
      }
    });
    inMemoryPasswordResetTokens.push({
      id: inMemoryPasswordResetTokens.length + 1,
      id_usuario: user.id_usuario,
      token_hash: tokenPair.tokenHash,
      code_hash: codePair.codeHash,
      failed_attempts: 0,
      expires_at: expiresAt,
      used_at: null,
      created_at: new Date().toISOString(),
    });
  }

  const emailResult = await sendPasswordResetEmail({
    toEmail: user.email,
    nome: user.nome,
    rawToken: tokenPair.rawToken,
    resetCode: codePair.code,
    baseUrl: params.baseUrl,
  });

  return {
    success: true,
    message:
      emailResult.provider === 'ethereal_test'
        ? 'E-mail de recuperação enviado para a caixa de testes Ethereal!'
        : genericMessage,
    emailPreviewUrl: emailResult.previewUrl,
    emailProvider: emailResult.provider,
  };
}

/**
 * Completes password reset using either a ?reset_token= link OR email + 6-digit code
 */
export async function confirmPasswordReset(params: {
  token?: string;
  email?: string;
  code?: string;
  novaSenha: string;
}): Promise<{ success: boolean; message: string }> {
  await ensurePostgresSchema();

  const novaSenha = params.novaSenha ? params.novaSenha.trim() : '';
  if (novaSenha.length < 6) {
    const err = new Error('A nova senha deve ter no mínimo 6 caracteres.');
    (err as any).statusCode = 400;
    throw err;
  }

  const rawToken = params.token?.trim();
  const email = params.email?.trim().toLowerCase();
  const code = params.code?.replace(/\D/g, '').trim();

  if (!rawToken && (!email || !code || code.length !== 6)) {
    const err = new Error('Informe o código de 6 dígitos e o e-mail (ou o link de recuperação).');
    (err as any).statusCode = 400;
    throw err;
  }

  const newHash = await bcrypt.hash(novaSenha, 10);

  if (isConfiguredWithRealDatabase) {
    let tokenRow: any = null;

    if (rawToken) {
      const tokenHash = hashVerificationToken(rawToken);
      const res = await query(`SELECT * FROM password_reset_tokens WHERE token_hash = $1`, [
        tokenHash,
      ]);
      tokenRow = res.rows[0] || null;
    } else if (email && code) {
      const userRes = await query('SELECT id_usuario FROM usuario WHERE LOWER(email) = LOWER($1)', [
        email,
      ]);
      if (userRes.rows.length === 0) {
        const err = new Error('Código de recuperação inválido ou expirado.');
        (err as any).statusCode = 400;
        throw err;
      }
      const res = await query(
        `SELECT * FROM password_reset_tokens
         WHERE id_usuario = $1 AND used_at IS NULL
         ORDER BY created_at DESC LIMIT 1`,
        [userRes.rows[0].id_usuario]
      );
      tokenRow = res.rows[0] || null;
      if (tokenRow) {
        if ((tokenRow.failed_attempts || 0) >= 5) {
          await query('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1', [
            tokenRow.id,
          ]);
          const err = new Error('Limite de tentativas excedido. Solicite um novo código.');
          (err as any).statusCode = 429;
          throw err;
        }
        const expectedCodeHash = hashVerificationCode(email, code);
        if (tokenRow.code_hash !== expectedCodeHash) {
          await query(
            'UPDATE password_reset_tokens SET failed_attempts = failed_attempts + 1 WHERE id = $1',
            [tokenRow.id]
          );
          const err = new Error('Código de recuperação incorreto.');
          (err as any).statusCode = 400;
          throw err;
        }
      }
    }

    if (!tokenRow || tokenRow.used_at || new Date(tokenRow.expires_at).getTime() < Date.now()) {
      const err = new Error('Token ou código de recuperação inválido ou expirado.');
      (err as any).statusCode = 400;
      throw err;
    }

    await query(
      `UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [tokenRow.id]
    );
    await query(`UPDATE usuario SET senha_hash = $1 WHERE id_usuario = $2`, [
      newHash,
      tokenRow.id_usuario,
    ]);

    return { success: true, message: 'Senha redefinida com sucesso! Faça login com a nova senha.' };
  }

  // Non-production memory fallback
  let entry: any = null;
  if (rawToken) {
    const tokenHash = hashVerificationToken(rawToken);
    entry = inMemoryPasswordResetTokens.find((t) => t.token_hash === tokenHash) || null;
  } else if (email && code) {
    const user = inMemoryUsers.find((u) => u.email.toLowerCase() === email);
    if (user) {
      entry =
        [...inMemoryPasswordResetTokens]
          .reverse()
          .find((t) => t.id_usuario === user.id_usuario && !t.used_at) || null;
      if (entry && entry.code_hash !== hashVerificationCode(email, code)) {
        entry.failed_attempts += 1;
        const err = new Error('Código de recuperação incorreto.');
        (err as any).statusCode = 400;
        throw err;
      }
    }
  }

  if (!entry || entry.used_at || new Date(entry.expires_at).getTime() < Date.now()) {
    const err = new Error('Token ou código de recuperação inválido ou expirado.');
    (err as any).statusCode = 400;
    throw err;
  }

  entry.used_at = new Date().toISOString();
  const targetUser = inMemoryUsers.find((u) => u.id_usuario === entry.id_usuario);
  if (targetUser) targetUser.senha_hash = newHash;

  return { success: true, message: 'Senha redefinida com sucesso! Faça login com a nova senha.' };
}

/**
 * Validates the Bearer token OR HttpOnly session cookie + reloads authoritative user state from database.
 */
export async function requireAuthenticatedUser(req: any): Promise<Omit<Usuario, 'senha_hash'>> {
  await ensurePostgresSchema();

  const { token, source } = extractAuthToken(req);
  if (!token) {
    const err = new Error('Autenticação obrigatória. Faça login para continuar.');
    (err as any).statusCode = 401;
    (err as any).errorCode = 'UNAUTHORIZED';
    throw err;
  }

  if (!verifyMutationOrigin(req, source)) {
    const err = new Error('Origem da requisição não autorizada para esta sessão.');
    (err as any).statusCode = 403;
    (err as any).errorCode = 'CSRF_ORIGIN_MISMATCH';
    throw err;
  }

  const payload: SessionPayload | null = verifyAuthToken(token);
  if (!payload) {
    const err = new Error('Sessão inválida ou expirada. Faça login novamente.');
    (err as any).statusCode = 401;
    (err as any).errorCode = 'INVALID_TOKEN';
    throw err;
  }

  let user: any = null;
  if (isConfiguredWithRealDatabase) {
    const res = await query('SELECT * FROM usuario WHERE id_usuario = $1', [payload.sub]);
    user = res.rows[0] || null;
  } else {
    user = inMemoryUsers.find((u) => u.id_usuario === payload.sub) || null;
  }

  if (!user) {
    const err = new Error('Usuário autenticado não encontrado.');
    (err as any).statusCode = 401;
    throw err;
  }

  if (user.perfil === 'PARTICIPANTE' && !user.email_verificado) {
    const err = new Error('Acesso bloqueado: confirme seu e-mail antes de utilizar este recurso.');
    (err as any).statusCode = 403;
    (err as any).errorCode = 'EMAIL_NOT_VERIFIED';
    throw err;
  }

  if (user.status_conta !== 'ATIVO') {
    const err = new Error(
      user.status_conta === 'PENDENTE'
        ? 'Acesso bloqueado: sua conta de professor aguarda aprovação administrativa.'
        : 'Acesso bloqueado: sua conta foi rejeitada ou suspensa.'
    );
    (err as any).statusCode = 403;
    (err as any).errorCode =
      user.status_conta === 'PENDENTE' ? 'PROFESSOR_PENDING' : 'ACCOUNT_REJECTED';
    throw err;
  }

  return sanitizeUser(user);
}

export async function requireAdminUser(req: any): Promise<Omit<Usuario, 'senha_hash'>> {
  const user = await requireAuthenticatedUser(req);
  if (user.perfil !== 'ADMINISTRADOR') {
    const err = new Error('Acesso restrito a administradores autorizados.');
    (err as any).statusCode = 403;
    (err as any).errorCode = 'ADMIN_REQUIRED';
    throw err;
  }
  return user;
}

export async function requireStaffUser(req: any): Promise<Omit<Usuario, 'senha_hash'>> {
  const user = await requireAuthenticatedUser(req);
  if (user.perfil !== 'PROFESSOR' && user.perfil !== 'ADMINISTRADOR') {
    const err = new Error('Apenas professores aprovados ou administradores podem realizar esta ação.');
    (err as any).statusCode = 403;
    (err as any).errorCode = 'STAFF_REQUIRED';
    throw err;
  }
  return user;
}

export async function updateOwnProfile(
  userId: number,
  updates: {
    nome?: string;
    email?: string;
    matricula?: string | null;
    telefone?: string | null;
    materias?: string | null;
    foto_perfil?: string | null;
  }
): Promise<Omit<Usuario, 'senha_hash'>> {
  await ensurePostgresSchema();

  const sanitizedPhoto =
    updates.foto_perfil !== undefined ? sanitizeImageUrlOrDataUri(updates.foto_perfil) : undefined;

  if (isConfiguredWithRealDatabase) {
    const existingRes = await query('SELECT * FROM usuario WHERE id_usuario = $1', [userId]);
    if (existingRes.rows.length === 0) {
      const err = new Error('Usuário não encontrado.');
      (err as any).statusCode = 404;
      throw err;
    }
    const current = existingRes.rows[0];

    const nextNome = updates.nome !== undefined ? updates.nome.trim() : current.nome;
    const nextEmail = updates.email !== undefined ? updates.email.trim().toLowerCase() : current.email;
    if (nextNome.length < 3) {
      const err = new Error('Nome deve ter no mínimo 3 caracteres.');
      (err as any).statusCode = 400;
      throw err;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      const err = new Error('E-mail inválido.');
      (err as any).statusCode = 400;
      throw err;
    }

    if (nextEmail !== current.email.toLowerCase()) {
      const dup = await query(
        'SELECT id_usuario FROM usuario WHERE LOWER(email) = LOWER($1) AND id_usuario <> $2',
        [nextEmail, userId]
      );
      if (dup.rows.length > 0) {
        const err = new Error('Este e-mail já está em uso por outra conta.');
        (err as any).statusCode = 409;
        throw err;
      }
    }

    const nextMatricula =
      updates.matricula !== undefined ? (updates.matricula ? updates.matricula.trim() : null) : current.matricula;
    const nextTelefone =
      updates.telefone !== undefined ? (updates.telefone ? updates.telefone.trim() : null) : current.telefone;
    const nextMaterias =
      current.perfil === 'PROFESSOR' && updates.materias !== undefined
        ? updates.materias
          ? updates.materias.trim()
          : null
        : current.materias;
    const nextFoto = sanitizedPhoto !== undefined ? sanitizedPhoto : current.foto_perfil;

    const updated = await query(
      `UPDATE usuario
       SET nome = $1, email = $2, matricula = $3, telefone = $4, materias = $5, foto_perfil = $6
       WHERE id_usuario = $7
       RETURNING *`,
      [nextNome, nextEmail, nextMatricula, nextTelefone, nextMaterias, nextFoto, userId]
    );
    return sanitizeUser(updated.rows[0]);
  }

  const idx = inMemoryUsers.findIndex((u) => u.id_usuario === userId);
  if (idx === -1) {
    const err = new Error('Usuário não encontrado.');
    (err as any).statusCode = 404;
    throw err;
  }

  const u = inMemoryUsers[idx];
  if (updates.nome !== undefined) u.nome = updates.nome.trim();
  if (updates.email !== undefined) u.email = updates.email.trim().toLowerCase();
  if (updates.matricula !== undefined) u.matricula = updates.matricula || null;
  if (updates.telefone !== undefined) u.telefone = updates.telefone || null;
  if (u.perfil === 'PROFESSOR' && updates.materias !== undefined) {
    u.materias = updates.materias || null;
  }
  if (sanitizedPhoto !== undefined) u.foto_perfil = sanitizedPhoto;

  return sanitizeUser(u);
}

export async function changeOwnPassword(
  userId: number,
  senhaAtual: string,
  novaSenha: string
): Promise<{ success: boolean; message: string }> {
  await ensurePostgresSchema();

  if (!senhaAtual || !novaSenha || novaSenha.trim().length < 6) {
    const err = new Error('Informe a senha atual e uma nova senha com no mínimo 6 caracteres.');
    (err as any).statusCode = 400;
    throw err;
  }

  const cleanNew = novaSenha.trim();

  if (isConfiguredWithRealDatabase) {
    const res = await query('SELECT id_usuario, senha_hash FROM usuario WHERE id_usuario = $1', [
      userId,
    ]);
    if (res.rows.length === 0) {
      const err = new Error('Usuário não encontrado.');
      (err as any).statusCode = 404;
      throw err;
    }

    const ok = await bcrypt.compare(senhaAtual, res.rows[0].senha_hash || '');
    if (!ok) {
      const err = new Error('A senha atual informada está incorreta.');
      (err as any).statusCode = 401;
      throw err;
    }

    const newHash = await bcrypt.hash(cleanNew, 10);
    await query('UPDATE usuario SET senha_hash = $1 WHERE id_usuario = $2', [newHash, userId]);
    return { success: true, message: 'Senha alterada com sucesso!' };
  }

  const user = inMemoryUsers.find((u) => u.id_usuario === userId);
  if (!user) {
    const err = new Error('Usuário não encontrado.');
    (err as any).statusCode = 404;
    throw err;
  }

  const ok = await bcrypt.compare(senhaAtual, user.senha_hash || '');
  if (!ok) {
    const err = new Error('A senha atual informada está incorreta.');
    (err as any).statusCode = 401;
    throw err;
  }

  user.senha_hash = await bcrypt.hash(cleanNew, 10);
  return { success: true, message: 'Senha alterada com sucesso!' };
}

export async function getProfessorRequests() {
  await ensurePostgresSchema();

  if (isConfiguredWithRealDatabase) {
    const result = await query(
      `SELECT id_usuario, nome, email, matricula, perfil, status_conta, email_verificado,
              telefone, materias, aprovado_por, decisao_em, motivo_decisao, created_at
       FROM usuario
       WHERE perfil = 'PROFESSOR'
       ORDER BY
         CASE status_conta WHEN 'PENDENTE' THEN 0 WHEN 'RECUSADO' THEN 1 ELSE 2 END,
         created_at DESC`
    );
    return result.rows.map(sanitizeUser);
  }

  return inMemoryUsers
    .filter((u) => u.perfil === 'PROFESSOR')
    .sort((a, b) => {
      const order = { PENDENTE: 0, RECUSADO: 1, ATIVO: 2 };
      const diff = order[a.status_conta] - order[b.status_conta];
      if (diff !== 0) return diff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .map(sanitizeUser);
}

export async function moderateProfessorRequest(params: {
  professorId: number;
  adminId: number;
  decision: 'APROVAR' | 'RECUSAR';
  motivo?: string;
}) {
  await ensurePostgresSchema();

  const { professorId, adminId, decision, motivo } = params;
  if (!['APROVAR', 'RECUSAR'].includes(decision)) {
    const err = new Error('Decisão inválida. Informe APROVAR ou RECUSAR.');
    (err as any).statusCode = 400;
    throw err;
  }

  const newStatus: StatusConta = decision === 'APROVAR' ? 'ATIVO' : 'RECUSADO';
  const cleanMotivo = motivo ? motivo.trim() : null;

  if (isConfiguredWithRealDatabase) {
    const checkRes = await query('SELECT id_usuario, perfil FROM usuario WHERE id_usuario = $1', [
      professorId,
    ]);
    if (checkRes.rows.length === 0) {
      const err = new Error('Solicitação de professor não encontrada.');
      (err as any).statusCode = 404;
      throw err;
    }
    if (checkRes.rows[0].perfil !== 'PROFESSOR') {
      const err = new Error('Esta solicitação não pertence a um perfil de professor.');
      (err as any).statusCode = 400;
      throw err;
    }

    const result = await query(
      `UPDATE usuario
       SET status_conta = $1,
           aprovado_por = $2,
           decisao_em = CURRENT_TIMESTAMP,
           motivo_decisao = $3
       WHERE id_usuario = $4
       RETURNING *`,
      [newStatus, adminId, cleanMotivo, professorId]
    );

    return sanitizeUser(result.rows[0]);
  }

  const idx = inMemoryUsers.findIndex((u) => u.id_usuario === professorId);
  if (idx === -1) {
    const err = new Error('Solicitação de professor não encontrada.');
    (err as any).statusCode = 404;
    throw err;
  }
  if (inMemoryUsers[idx].perfil !== 'PROFESSOR') {
    const err = new Error('Esta solicitação não pertence a um perfil de professor.');
    (err as any).statusCode = 400;
    throw err;
  }

  inMemoryUsers[idx].status_conta = newStatus;
  inMemoryUsers[idx].aprovado_por = adminId;
  inMemoryUsers[idx].decisao_em = new Date().toISOString();
  inMemoryUsers[idx].motivo_decisao = cleanMotivo;

  return sanitizeUser(inMemoryUsers[idx]);
}

export async function getAllUsersAdmin() {
  await ensurePostgresSchema();

  if (isConfiguredWithRealDatabase) {
    const result = await query(
      `SELECT id_usuario, nome, email, matricula, perfil, status_conta, email_verificado,
              email_verificado_em, telefone, materias, aprovado_por, decisao_em, motivo_decisao, created_at
       FROM usuario
       ORDER BY created_at DESC`
    );
    return result.rows.map(sanitizeUser);
  }

  return inMemoryUsers.map(sanitizeUser);
}

export async function updateUserStatusAdmin(params: {
  userId: number;
  adminId: number;
  status: StatusConta;
  motivo?: string;
}) {
  await ensurePostgresSchema();

  if (!['ATIVO', 'RECUSADO', 'PENDENTE'].includes(params.status)) {
    const err = new Error('Status inválido.');
    (err as any).statusCode = 400;
    throw err;
  }

  if (isConfiguredWithRealDatabase) {
    const targetRes = await query('SELECT id_usuario, perfil FROM usuario WHERE id_usuario = $1', [
      params.userId,
    ]);
    if (targetRes.rows.length === 0) {
      const err = new Error('Usuário não encontrado.');
      (err as any).statusCode = 404;
      throw err;
    }
    if (targetRes.rows[0].perfil === 'PARTICIPANTE' && params.status === 'PENDENTE') {
      const err = new Error('Participantes não passam por fila de aprovação pendente.');
      (err as any).statusCode = 400;
      throw err;
    }

    const result = await query(
      `UPDATE usuario
       SET status_conta = $1,
           aprovado_por = $2,
           decisao_em = CURRENT_TIMESTAMP,
           motivo_decisao = COALESCE($3, motivo_decisao)
       WHERE id_usuario = $4
       RETURNING *`,
      [params.status, params.adminId, params.motivo || null, params.userId]
    );
    return sanitizeUser(result.rows[0]);
  }

  const idx = inMemoryUsers.findIndex((u) => u.id_usuario === params.userId);
  if (idx === -1) {
    const err = new Error('Usuário não encontrado.');
    (err as any).statusCode = 404;
    throw err;
  }
  if (inMemoryUsers[idx].perfil === 'PARTICIPANTE' && params.status === 'PENDENTE') {
    const err = new Error('Participantes não passam por fila de aprovação pendente.');
    (err as any).statusCode = 400;
    throw err;
  }

  inMemoryUsers[idx].status_conta = params.status;
  inMemoryUsers[idx].aprovado_por = params.adminId;
  inMemoryUsers[idx].decisao_em = new Date().toISOString();
  if (params.motivo) {
    inMemoryUsers[idx].motivo_decisao = params.motivo;
  }
  return sanitizeUser(inMemoryUsers[idx]);
}
