import {
  query,
  isConfiguredWithRealDatabase,
  ensurePostgresSchema,
  inMemoryUsers,
} from '../src/lib/db';
import { getConfiguredEmailProvider } from '../src/server/emailService';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const emailProvider = getConfiguredEmailProvider();
  const runtime = process.env.VERCEL ? 'vercel_serverless' : 'node_server';

  if (!isConfiguredWithRealDatabase) {
    return res.status(200).json({
      status: 'online',
      runtime,
      database: 'preview_mode',
      target: 'Render PostgreSQL',
      email_provider: emailProvider,
      message:
        'DATABASE_URL não configurada ou em modo preview. Configure a variável DATABASE_URL na Vercel para persistência real no Render PostgreSQL.',
      total_usuarios_memoria: inMemoryUsers.length,
    });
  }

  try {
    await ensurePostgresSchema();
    const startTime = Date.now();
    const result = await query(
      'SELECT NOW() as current_time, count(*)::int as total_usuarios FROM usuario'
    );
    const latency = Date.now() - startTime;

    return res.status(200).json({
      status: 'online',
      runtime,
      database: 'connected',
      target: 'Render PostgreSQL',
      email_provider: emailProvider,
      latency: `${latency}ms`,
      server_time: result.rows[0]?.current_time,
      total_usuarios_no_banco: result.rows[0]?.total_usuarios,
      database_url_configured: true,
    });
  } catch (err: any) {
    console.warn('[HEALTHCHECK DB NOTICE]:', err.message);
    return res.status(503).json({
      status: 'warning',
      runtime,
      database: 'sleeping_or_unreachable',
      email_provider: emailProvider,
      error: err.message,
      code: err.code,
      database_url_configured: true,
      hint: 'O banco Render pode estar despertando (free-tier spin-down) ou a DATABASE_URL precisa de revisão. Recarregue em alguns segundos.',
    });
  }
}
