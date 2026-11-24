function normalizeOrigin(raw?: string): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw.trim());
    return `${parsed.protocol}//${parsed.host}`.toLowerCase();
  } catch {
    return null;
  }
}

export function getAllowedOrigins(req: any): Set<string> {
  const allowed = new Set<string>();

  const envUrls = [
    process.env.APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ];

  for (const candidate of envUrls) {
    const norm = normalizeOrigin(candidate);
    if (norm) allowed.add(norm);
  }

  if (process.env.ALLOWED_ORIGINS) {
    for (const part of process.env.ALLOWED_ORIGINS.split(',')) {
      const norm = normalizeOrigin(part);
      if (norm) allowed.add(norm);
    }
  }

  const hostHeader = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '')
    .split(',')[0]
    .trim();
  const protoHeader = String(req?.headers?.['x-forwarded-proto'] || 'https')
    .split(',')[0]
    .trim();

  if (hostHeader) {
    allowed.add(`${protoHeader}://${hostHeader}`.toLowerCase());
    allowed.add(`https://${hostHeader}`.toLowerCase());
    allowed.add(`http://${hostHeader}`.toLowerCase());
  }

  if (process.env.NODE_ENV !== 'production') {
    allowed.add('http://localhost:3000');
    allowed.add('http://127.0.0.1:3000');
  }

  return allowed;
}

export function resolveRequestOrigin(req: any): string | undefined {
  const rawProto = String(req?.headers?.['x-forwarded-proto'] || req?.protocol || 'https');
  const rawHost = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '');
  const proto = rawProto.split(',')[0].trim();
  const host = rawHost.split(',')[0].trim();
  if (host) {
    return `${proto}://${host}`;
  }
  return undefined;
}

/**
 * Applies strict origin-checked CORS headers (never wildcard * with credentials)
 * and baseline HTTP security headers.
 */
export function applyCorsAndSecurityHeaders(req: any, res: any): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Vary', 'Origin');

  const requestOrigin = normalizeOrigin(req?.headers?.origin);
  if (requestOrigin) {
    const allowed = getAllowedOrigins(req);
    if (allowed.has(requestOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    }
  }
}

/**
 * Verifies same-origin for cookie-authenticated state-changing requests (CSRF defense).
 */
export function verifyMutationOrigin(req: any, authSource: 'bearer' | 'cookie' | null): boolean {
  if (authSource !== 'cookie') return true;
  if (['GET', 'HEAD', 'OPTIONS'].includes(String(req?.method || '').toUpperCase())) return true;

  const origin = normalizeOrigin(req?.headers?.origin);
  const refererOrigin = normalizeOrigin(req?.headers?.referer);
  const candidate = origin || refererOrigin;

  if (!candidate) {
    // Allow when custom X-Requested-With header is explicitly sent by same-origin SPA
    return Boolean(req?.headers?.['x-requested-with']);
  }

  return getAllowedOrigins(req).has(candidate);
}

/**
 * Validates image/avatar URLs or base64 data URIs safely (blocks javascript:, svg+xml scripts, etc.)
 */
export function sanitizeImageUrlOrDataUri(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-zA-Z0-9+/=]+$/i.test(trimmed)) {
    if (trimmed.length > 2_000_000) {
      const err = new Error('Imagem excede o tamanho máximo permitido (1.5 MB).');
      (err as any).statusCode = 400;
      throw err;
    }
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    // invalid URL
  }

  const err = new Error('URL ou formato de imagem inválido.');
  (err as any).statusCode = 400;
  throw err;
}
