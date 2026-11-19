import bcrypt from 'bcryptjs';
import {
  query,
  isConfiguredWithRealDatabase,
  ensurePostgresSchema,
  inMemoryUsers,
  inMemoryVerificationTokens,
  InMemoryUser,
} from '../lib/db';
import {
  generateVerificationToken,
  hashVerificationToken,
  generateVerificationCode,
  hashVerificationCode,
  signAuthToken,
  verifyAuthToken,
  extractBearerToken,
  SessionPayload,
} from './session';
import { sendVerificationEmail } from './emailService';
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

export interface RegisterResult {
  success: boolean;
  requiresEmailVerification: boolean;
  requiresAdminApproval: boolean;
  message: string;
  user?: Omit<Usuario, 'senha_hash'>;
  emailPreviewUrl?: string;
  emailProvider?: 'smtp' | 'resend' | 'ethereal_test';
  storage: 'postgresql' | 'memory_fallback';
}

const PUBLIC_REGISTER_PERFIS = ['PARTICIPANTE', 'PROFESSOR'] as const;

export function sanitizeUser(u: any): Omit<Usuario, 'senha_hash'> {
  return {
    id_usuario: u.id_usuario,
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

/**
 * Registers a new Student (with real email verification via link + 6-digit code)
 * or Professor (pending admin approval).
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

  const salt = await bcrypt.genSalt(10);
  const senhaHash = await bcrypt.hash(senha, salt);

  // Student starts ACTIVE but unverified (must verify email); Professor starts PENDENTE for admin approval
  const isStudent = perfil === 'PARTICIPANTE';
  const statusConta: StatusConta = isStudent ? 'ATIVO' : 'PENDENTE';
  const emailVerificado = !isStudent;

  const tokenPair = isStudent ? generateVerificationToken() : null;
  const codePair = isStudent ? generateVerificationCode(email) : null;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  if (isConfiguredWithRealDatabase) {
    const existingUserResult = await query(
      'SELECT id_usuario, email, perfil, status_conta FROM usuario WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (existingUserResult.rows.length > 0) {
      const existing = existingUserResult.rows[0];
      const msg =
        existing.perfil === 'PROFESSOR' && existing.status_conta === 'PENDENTE'
          ? 'Já existe uma solicitação de cadastro pendente para este e-mail de professor.'
          : 'Já existe um usuário cadastrado com este e-mail.';
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

      let emailResult;
      try {
        emailResult = await sendVerificationEmail({
          toEmail: email,
          nome,
          rawToken: tokenPair.rawToken,
          verificationCode: codePair.code,
          baseUrl: input.baseUrl,
        });
      } catch (mailErr: any) {
        await query('DELETE FROM usuario WHERE id_usuario = $1', [createdUser.id_usuario]).catch(
          () => {}
        );
        throw mailErr;
      }

      return {
        success: true,
        requiresEmailVerification: true,
        requiresAdminApproval: false,
        message:
          emailResult.provider === 'ethereal_test'
            ? 'Cadastro registrado! Como não há servidor SMTP/Resend configurado no ambiente, o e-mail de confirmação foi enviado para a caixa de testes Ethereal abaixo.'
            : 'Cadastro realizado! Enviamos um código e um link de confirmação para o seu e-mail. Verifique sua caixa de entrada para ativar sua conta.',
        user: sanitizeUser(createdUser),
        emailPreviewUrl: emailResult.previewUrl,
        emailProvider: emailResult.provider,
        storage: 'postgresql',
      };
    }

    return {
      success: true,
      requiresEmailVerification: false,
      requiresAdminApproval: true,
      message:
        'Solicitação de cadastro como professor enviada! Um administrador analisará seus dados e liberará seu acesso após a aprovação.',
      user: sanitizeUser(createdUser),
      storage: 'postgresql',
    };
  }

  // Fallback in-memory storage for preview/dev when DATABASE_URL is placeholder
  const existingInMemory = inMemoryUsers.find((u) => u.email.toLowerCase() === email);
  if (existingInMemory) {
    const msg =
      existingInMemory.perfil === 'PROFESSOR' && existingInMemory.status_conta === 'PENDENTE'
        ? 'Já existe uma solicitação de cadastro pendente para este e-mail de professor.'
        : 'Já existe um usuário cadastrado com este e-mail.';
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

    let emailResult;
    try {
      emailResult = await sendVerificationEmail({
        toEmail: email,
        nome,
        rawToken: tokenPair.rawToken,
        verificationCode: codePair.code,
        baseUrl: input.baseUrl,
      });
    } catch (mailErr) {
      const uIdx = inMemoryUsers.findIndex((u) => u.id_usuario === newUser.id_usuario);
      if (uIdx !== -1) inMemoryUsers.splice(uIdx, 1);
      throw mailErr;
    }

    return {
      success: true,
      requiresEmailVerification: true,
      requiresAdminApproval: false,
      message:
        emailResult.provider === 'ethereal_test'
          ? 'Cadastro registrado! Como não há servidor SMTP/Resend configurado no ambiente, o e-mail de confirmação foi enviado para a caixa de testes Ethereal abaixo.'
          : 'Cadastro realizado! Enviamos um código e um link de confirmação para o seu e-mail. Verifique sua caixa de entrada para ativar sua conta.',
      user: sanitizeUser(newUser),
      emailPreviewUrl: emailResult.previewUrl,
      emailProvider: emailResult.provider,
      storage: 'memory_fallback',
    };
  }

  return {
    success: true,
    requiresEmailVerification: false,
    requiresAdminApproval: true,
    message:
      'Solicitação de cadastro como professor enviada! Um administrador analisará seus dados e liberará seu acesso após a aprovação.',
    user: sanitizeUser(newUser),
    storage: 'memory_fallback',
  };
}

/**
 * Verifies a student email token (single-use, expiring, SHA-256 hashed in DB)
 * and issues an active session JWT so the student can enter the app seamlessly.
 */
export async function verifyEmailToken(rawToken: string): Promise<{
  success: boolean;
  message: string;
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
      `SELECT t.id, t.id_usuario, t.expires_at, t.used_at, u.email, u.nome, u.email_verificado
       FROM email_verification_tokens t
       JOIN usuario u ON u.id_usuario = t.id_usuario
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
    return {
      success: true,
      message: 'E-mail confirmado com sucesso! Sua conta foi ativada e já pode ser utilizada.',
      user: sanitized,
      token: buildSignedSessionForUser(sanitized),
    };
  }

  // Fallback in-memory verification
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
  return {
    success: true,
    message: 'E-mail confirmado com sucesso! Sua conta foi ativada e já pode ser utilizada.',
    user: sanitized,
    token: buildSignedSessionForUser(sanitized),
  };
}

/**
 * Verifies a student email using the 6-digit OTP code sent in the verification email.
 * Enforces single-use, 24h expiry, and max 5 wrong attempts per code.
 */
export async function verifyEmailCode(params: {
  email: string;
  code: string;
}): Promise<{
  success: boolean;
  message: string;
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
    return {
      success: true,
      message: 'E-mail confirmado com sucesso! Sua conta foi ativada.',
      user: sanitized,
      token: buildSignedSessionForUser(sanitized),
    };
  }

  // Fallback in-memory code check
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
  return {
    success: true,
    message: 'E-mail confirmado com sucesso! Sua conta foi ativada.',
    user: sanitized,
    token: buildSignedSessionForUser(sanitized),
  };
}

/**
 * Resends verification email with strict anti-abuse cooldown and rate limiting
 */
export async function resendVerificationEmail(params: {
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
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    const err = new Error('Informe um e-mail válido.');
    (err as any).statusCode = 400;
    throw err;
  }

  const cooldownCheck = checkRateLimit(`resend:cooldown:${email}`, 1, 60 * 1000);
  if (!cooldownCheck.allowed) {
    const err = new Error(
      `Aguarde ${cooldownCheck.retryAfterSeconds} segundos antes de solicitar um novo e-mail de verificação.`
    );
    (err as any).statusCode = 429;
    (err as any).retryAfterSeconds = cooldownCheck.retryAfterSeconds;
    throw err;
  }

  const hourlyCheck = checkRateLimit(`resend:hour:${email}`, 5, 60 * 60 * 1000);
  if (!hourlyCheck.allowed) {
    const err = new Error(
      'Limite de reenvios atingido para este e-mail. Tente novamente mais tarde.'
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
 * Authenticates user credentials and enforces email verification (students) and admin approval (professors).
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
    const isPasswordValid = await bcrypt.compare(senha, user.senha_hash || '');
    const isLegacySeedPassword =
      user.senha_hash?.startsWith('$2b$10$w8.1fceIventusSimulatedHash') && senha === 'alunoifce';

    if (!isPasswordValid && !isLegacySeedPassword) {
      const err = new Error('E-mail ou senha incorretos.');
      (err as any).statusCode = 401;
      throw err;
    }
  }

  // Enforce Student Email Verification
  if (user.perfil === 'PARTICIPANTE' && !user.email_verificado) {
    const err = new Error(
      'Seu endereço de e-mail ainda não foi confirmado. Digite o código de 6 dígitos enviado para seu e-mail ou clique no link de confirmação.'
    );
    (err as any).statusCode = 403;
    (err as any).errorCode = 'EMAIL_NOT_VERIFIED';
    (err as any).email = user.email;
    throw err;
  }

  // Enforce Professor Admin Approval
  if (user.perfil === 'PROFESSOR' && user.status_conta === 'PENDENTE') {
    const err = new Error(
      'Sua solicitação de cadastro como professor está aguardando análise e aprovação de um administrador.'
    );
    (err as any).statusCode = 403;
    (err as any).errorCode = 'PROFESSOR_PENDING';
    throw err;
  }

  // Enforce Rejected Account Block
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
 * Validates the Bearer token from a request and reloads authoritative user state from database
 */
export async function requireAuthenticatedUser(req: any): Promise<Omit<Usuario, 'senha_hash'>> {
  await ensurePostgresSchema();

  const token = extractBearerToken(req);
  if (!token) {
    const err = new Error('Autenticação obrigatória. Faça login para continuar.');
    (err as any).statusCode = 401;
    (err as any).errorCode = 'UNAUTHORIZED';
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

/**
 * Requires an active ADMINISTRADOR account
 */
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

/**
 * Lists EXCLUSIVELY professor registration requests for the Admin Approval panel
 */
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

/**
 * Approves or rejects a professor registration request
 */
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

/**
 * Lists all users for general administrative management
 */
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

/**
 * Updates general user account status by admin
 */
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
    if (result.rows.length === 0) {
      const err = new Error('Usuário não encontrado.');
      (err as any).statusCode = 404;
      throw err;
    }
    return sanitizeUser(result.rows[0]);
  }

  const idx = inMemoryUsers.findIndex((u) => u.id_usuario === params.userId);
  if (idx === -1) {
    const err = new Error('Usuário não encontrado.');
    (err as any).statusCode = 404;
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
