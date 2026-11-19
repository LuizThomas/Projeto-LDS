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

const getSecret = (): string => {
  const explicit = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (explicit && !explicit.includes('troque-por-um-segredo')) {
    return explicit;
  }
  const envSeed =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    'ifce-iventus-local-dev-seed';
  return crypto.createHash('sha256').update(`ifce-iventus:${envSeed}`).digest('hex');
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
 * Generates an HMAC-SHA256 signed JWT-compatible session token
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
  expiresInSeconds: number = 60 * 60 * 24 * 7 // 7 days
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

/**
 * Extracts Bearer token from Authorization header
 */
export function extractBearerToken(req: any): string | null {
  const authHeader = req?.headers?.authorization || req?.headers?.Authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
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
