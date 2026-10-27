import { Pool, QueryResult, QueryResultRow } from 'pg';

/**
 * Sanitizes and validates the connection string.
 * Strips outer quotes, whitespace, and accidental trailing parentheses from copy-pastes.
 */
export function sanitizeConnectionString(raw?: string): string | undefined {
  if (!raw) return undefined;
  let cleaned = raw.trim();
  // Strip enclosing quotes
  cleaned = cleaned.replace(/^["']|["']$/g, '');
  // Strip accidental trailing parentheses or commas
  cleaned = cleaned.replace(/[),;]+$/, '').trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * Detects if the connection string is an unresolved placeholder
 * (e.g. "dpg-xxxxx", "MY_DATABASE_URL", or unconfigured template)
 */
export function isPlaceholderUrl(url?: string): boolean {
  if (!url) return true;
  return (
    url.includes('dpg-xxxxx') ||
    url.includes('MY_DATABASE_URL') ||
    url.includes('example.com') ||
    url.includes('your-render-db') ||
    url.includes('user:password@localhost')
  );
}

const rawConnectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
export const sanitizedUrl = sanitizeConnectionString(rawConnectionString);
export const isConfiguredWithRealDatabase = Boolean(sanitizedUrl && !isPlaceholderUrl(sanitizedUrl));

const isLocalhost = Boolean(
  sanitizedUrl?.includes('localhost') || sanitizedUrl?.includes('127.0.0.1')
);

// In-memory fallback storage for preview/development when DATABASE_URL is not yet connected to a live Render instance
interface InMemoryUser {
  id_usuario: number;
  nome: string;
  email: string;
  senha_hash: string;
  matricula: string | null;
  perfil: string;
  status_conta: string;
  telefone?: string | null;
  materias?: string | null;
  created_at: string;
}

export const inMemoryUsers: InMemoryUser[] = [
  {
    id_usuario: 1,
    nome: 'Luiz Thomas Marte Moreira',
    email: 'luiz.thomas@gmail.com',
    senha_hash: '$2b$10$w8.1fceIventusSimulatedHashPart',
    matricula: '123456789101112',
    perfil: 'PARTICIPANTE',
    status_conta: 'ATIVO',
    created_at: '2024-01-10T10:00:00Z',
  },
  {
    id_usuario: 2,
    nome: 'Lucas Nogueira',
    email: 'lucas.nogueira@ifce.edu.br',
    senha_hash: '$2b$10$w8.1fceIventusSimulatedHashAdm',
    matricula: 'ADM-2024-991',
    perfil: 'ADMINISTRADOR',
    status_conta: 'ATIVO',
    created_at: '2023-12-01T08:00:00Z',
  },
  {
    id_usuario: 3,
    nome: 'Saulo Bezerra',
    email: 'saulo_bezerra@gmail.com',
    senha_hash: '$2b$10$w8.1fceIventusSimulatedHashProf',
    matricula: 'DOC-8831',
    perfil: 'PROFESSOR',
    status_conta: 'ATIVO',
    created_at: '2023-11-15T09:00:00Z',
  },
];

let globalPool: Pool | null = null;

export function getPool(): Pool | null {
  if (!isConfiguredWithRealDatabase || !sanitizedUrl) {
    return null;
  }

  if (!globalPool) {
    globalPool = new Pool({
      connectionString: sanitizedUrl,
      ssl: isLocalhost
        ? false
        : {
            rejectUnauthorized: false,
          },
      max: process.env.NODE_ENV === 'production' ? 10 : 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 7000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    globalPool.on('error', (err) => {
      // Idle client disconnections are common on cloud hosts like Render & Supabase
      console.warn('[DATABASE POOL NOTICE]: Conexão ociosa redefinida pelo host PostgreSQL:', err.message);
    });
  }

  return globalPool;
}

export const pool = getPool();

let schemaInitialized = false;

/**
 * Helper to run a SQL query with automatic reconnection retry for cloud PostgreSQL instances
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const activePool = getPool();

  if (!activePool) {
    throw new Error('DATABASE_URL_NOT_CONFIGURED');
  }

  const start = Date.now();
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const res = await activePool.query<T>(text, params);
      const duration = Date.now() - start;
      if (process.env.DEBUG_SQL === 'true') {
        console.log('[SQL EXECUTADO]', {
          text: text.trim().slice(0, 100),
          duration: `${duration}ms`,
          rows: res.rowCount,
        });
      }
      return res;
    } catch (error: any) {
      const duration = Date.now() - start;
      const isConnectionTerminated =
        error.message?.includes('Connection terminated unexpectedly') ||
        error.message?.includes('terminating connection') ||
        error.code === '57P01' ||
        error.code === 'ECONNRESET';

      if (isConnectionTerminated && attempts < maxAttempts) {
        console.warn(
          `[DATABASE RETRY]: Conexão redefinida pela nuvem Render. Repetindo consulta (${attempts}/${maxAttempts})...`
        );
        await new Promise((resolve) => setTimeout(resolve, 600));
        continue;
      }

      console.warn('[SQL QUERY NOTICE]:', {
        text: text.trim().slice(0, 80),
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  throw new Error('Falha na consulta após tentativas de reconexão ao PostgreSQL.');
}

/**
 * Ensures the `usuario` table exists with the exact required schema in PostgreSQL
 */
export async function initPostgresSchema(): Promise<void> {
  if (!isConfiguredWithRealDatabase || !sanitizedUrl) {
    console.log(
      '[DATABASE INFO]: Ambiente operando em modo preview/desenvolvimento. ' +
        'Quando a DATABASE_URL real do Render for fornecida na Vercel, as tabelas serão sincronizadas automaticamente.'
    );
    return;
  }

  const activePool = getPool();
  if (!activePool) return;

  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS usuario (
      id_usuario SERIAL PRIMARY KEY,
      nome VARCHAR(100) NOT NULL,
      email VARCHAR(120) NOT NULL UNIQUE,
      senha_hash VARCHAR(255) NOT NULL,
      matricula VARCHAR(30) UNIQUE,
      perfil VARCHAR(30) NOT NULL DEFAULT 'PARTICIPANTE',
      status_conta VARCHAR(30) NOT NULL DEFAULT 'PENDENTE',
      foto_perfil VARCHAR(255),
      telefone VARCHAR(20),
      materias VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Ensure status_conta column exists in case an older schema was applied
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'usuario' AND column_name = 'status_conta'
      ) THEN
        ALTER TABLE usuario ADD COLUMN status_conta VARCHAR(30) NOT NULL DEFAULT 'PENDENTE';
      END IF;
    END $$;
  `;

  try {
    await activePool.query(createTableSQL);
    schemaInitialized = true;
    console.log('[DATABASE INIT]: Tabela "usuario" verificada com sucesso no PostgreSQL.');
  } catch (err: any) {
    // Render free-tier databases may be sleeping or taking a moment to boot.
    // We log a friendly notice instead of fatal error so the server stays operational.
    console.warn(
      '[DATABASE INIT NOTICE]: O banco PostgreSQL do Render está inicializando ou indisponível no momento (%s). O servidor permanecerá ativo e reconectará sob demanda.',
      err.message
    );
  }
}

export function isSchemaReady(): boolean {
  return schemaInitialized;
}
