import crypto from 'crypto';
import { PerfilUsuario, StatusConta } from '../types';

export interface SessionPayload {
  sub: number;
  email: string;
  nome: string;
  perfil: PerfilUsuario;
  status_conta: StatusConta;
  email_verificado: boolean;
  iat: number;
  exp: number;
}

export const SESSION_COOKIE_NAME = 'iventus_session';

const globalForSecret = globalThis as typeof globalThis & {
  __iventusRuntimeSecret?: string;
};

export function isAuthSecretConfigured(): boolean {
  const explicit = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  return Boolean(explicit && explicit.trim().length >= 16 && !explicit.includes('troque-por-um-segredo'));
}

const getSecret = (): string => {
  const explicit = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (explicit && explicit.trim().length >= 16 && !explicit.includes('troque-por-um-segredo')) {
    return explicit.trim();
  }

  if (!globalForSecret.__iventusRuntimeSecret) {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
      console.warn(
        '[SECURITY WARNING]: AUTH_SECRET/JWT_SECRET não configurado em produção. Defina AUTH_SECRET no painel do Vercel para manter sessões válidas entre instâncias serverless.'
      );
    }
    globalForSecret.__iventusRuntimeSecret = crypto.randomBytes(32).toString('hex');
  }

  return globalForSecret.__iventusRuntimeSecret;
};

function base64UrlEncode(str: string): string {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let padded = str.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4) {
    padded += '=';
  }
  return Buffer.from(padded, 'base64').toString('utf8');
}

/**
 * Generates an HMAC-SHA256 signed JWT session token
 */
export function signAuthToken(
  user: {
    id_usuario: number;
    email: string;
    nome: string;
    perfil: PerfilUsuario;
    status_conta: StatusConta;
    email_verificado: boolean;
  },
  expiresInSeconds: number = 60 * 60 * 24 * 7
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload: SessionPayload = {
    sub: user.id_usuario,
    email: user.email,
    nome: user.nome,
    perfil: user.perfil,
    status_conta: user.status_conta,
    email_verificado: user.email_verificado,
    iat: now,
    exp: now + expiresInSeconds,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${header}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', getSecret())
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${data}.${signature}`;
}

/**
 * Verifies an HMAC-SHA256 signed session token
 */
export function verifyAuthToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payloadStr, signature] = parts;
    const data = `${header}.${payloadStr}`;
    const expectedSig = crypto
      .createHmac('sha256', getSecret())
      .update(data)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const decoded = JSON.parse(base64UrlDecode(payloadStr)) as SessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!decoded.exp || decoded.exp < now) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

export function parseCookies(req: any): Record<string, string> {
  const header = req?.headers?.cookie;
  if (typeof header !== 'string' || !header) return {};
  const result: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

/**
 * Extracts auth token from Authorization: Bearer header OR HttpOnly session cookie
 */
export function extractAuthToken(req: any): { token: string | null; source: 'bearer' | 'cookie' | null } {
  const authHeader = req?.headers?.authorization || req?.headers?.Authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return { token: bearer, source: 'bearer' };
  }

  const cookies = parseCookies(req);
  if (cookies[SESSION_COOKIE_NAME]) {
    return { token: cookies[SESSION_COOKIE_NAME], source: 'cookie' };
  }

  return { token: null, source: null };
}

export function extractBearerToken(req: any): string | null {
  return extractAuthToken(req).token;
}

function isHttpsRequest(req: any): boolean {
  const proto = String(req?.headers?.['x-forwarded-proto'] || req?.protocol || '').toLowerCase();
  if (proto.includes('https')) return true;
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') return true;
  return false;
}

export function setSessionCookie(res: any, req: any, token: string): void {
  const secure = isHttpsRequest(req);
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${60 * 60 * 24 * 7}`,
  ];
  if (secure) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res: any, req: any): void {
  const secure = isHttpsRequest(req);
  const parts = [`${SESSION_COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'Max-Age=0'];
  if (secure) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

/**
 * Generates a cryptographically secure random token + its SHA-256 hash
 */
export function generateVerificationToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashVerificationToken(rawToken);
  return { rawToken, tokenHash };
}

/**
 * Hashes a verification token with SHA-256 (never store plain-text tokens in DB)
 */
export function hashVerificationToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}

/**
 * Generates a cryptographically random 6-digit verification code + email-bound SHA-256 hash
 */
export function generateVerificationCode(email: string): { code: string; codeHash: string } {
  const code = String(crypto.randomInt(100000, 1000000));
  const codeHash = hashVerificationCode(email, code);
  return { code, codeHash };
}

/**
 * Hashes a 6-digit verification code bound to the normalized user email
 */
export function hashVerificationCode(email: string, code: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCode = code.trim();
  return crypto
    .createHash('sha256')
    .update(`${normalizedEmail}:${normalizedCode}`)
    .digest('hex');
}
