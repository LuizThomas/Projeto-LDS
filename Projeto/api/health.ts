import { query, isConfiguredWithRealDatabase, inMemoryUsers } from '../src/lib/db';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!isConfiguredWithRealDatabase) {
    return res.status(200).json({
      status: 'online',
      database: 'preview_mode',
      target: 'Render PostgreSQL',
      message:
        'DATABASE_URL não configurada ou em modo preview. Configure a variável DATABASE_URL nas variáveis de ambiente da Vercel para conectar ao banco do Render.',
      total_usuarios_memoria: inMemoryUsers.length,
    });
  }

  try {
    const startTime = Date.now();
    const result = await query('SELECT NOW() as current_time, count(*)::int as total_usuarios FROM usuario');
    const latency = Date.now() - startTime;

    return res.status(200).json({
      status: 'online',
      database: 'connected',
      target: 'Render PostgreSQL',
      latency: `${latency}ms`,
      server_time: result.rows[0]?.current_time,
      total_usuarios_no_banco: result.rows[0]?.total_usuarios,
      database_url_configured: true,
    });
  } catch (err: any) {
    console.warn('[HEALTHCHECK DB NOTICE]:', err.message);
    return res.status(503).json({
      status: 'warning',
      database: 'sleeping_or_unreachable',
      error: err.message,
      code: err.code,
      database_url_configured: true,
      hint: 'O banco Render pode estar em modo de espera (free-tier spin-down). Ele despertará automaticamente em poucos instantes.',
    });
  }
}
