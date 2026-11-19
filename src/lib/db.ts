import { Pool, QueryResult, QueryResultRow } from 'pg';
import bcrypt from 'bcryptjs';

/**
 * Sanitizes and validates the connection string.
 * Strips outer quotes, whitespace, and accidental trailing parentheses from copy-pastes.
 */
export function sanitizeConnectionString(raw?: string): string | undefined {
  if (!raw) return undefined;
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^["']|["']$/g, '');
  cleaned = cleaned.replace(/[),;]+$/, '').trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * Detects if the connection string is an unresolved placeholder
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

const rawConnectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.RENDER_DATABASE_URL;
export const sanitizedUrl = sanitizeConnectionString(rawConnectionString);
export const isConfiguredWithRealDatabase = Boolean(sanitizedUrl && !isPlaceholderUrl(sanitizedUrl));

const isLocalhost = Boolean(
  sanitizedUrl?.includes('localhost') || sanitizedUrl?.includes('127.0.0.1')
);

// In-memory store fallback when DATABASE_URL is not connected to a live PostgreSQL instance (e.g. sandbox preview)
export interface InMemoryUser {
  id_usuario: number;
  nome: string;
  email: string;
  senha_hash: string;
  matricula: string | null;
  perfil: 'ADMINISTRADOR' | 'PROFESSOR' | 'PARTICIPANTE';
  status_conta: 'PENDENTE' | 'ATIVO' | 'RECUSADO';
  email_verificado: boolean;
  email_verificado_em?: string | null;
  foto_perfil?: string | null;
  telefone?: string | null;
  materias?: string | null;
  aprovado_por?: number | null;
  decisao_em?: string | null;
  motivo_decisao?: string | null;
  created_at: string;
}

export interface InMemoryVerificationToken {
  id: number;
  id_usuario: number;
  token_hash: string;
  code_hash?: string | null;
  failed_attempts: number;
  expires_at: string;
  used_at: string | null;
  ip_origem?: string | null;
  created_at: string;
}

export interface InMemoryEventInscription {
  id_inscricao: number;
  id_usuario: number;
  id_evento: number;
  status: 'CONFIRMADA' | 'CANCELADA';
  data_inscricao: string;
}

const defaultDemoHash = bcrypt.hashSync('alunoifce', 10);

export const inMemoryUsers: InMemoryUser[] = [
  {
    id_usuario: 1,
    nome: 'Luiz Thomas Marte Moreira',
    email: 'luiz.thomas@gmail.com',
    senha_hash: defaultDemoHash,
    matricula: '123456789101112',
    perfil: 'PARTICIPANTE',
    status_conta: 'ATIVO',
    email_verificado: true,
    email_verificado_em: '2024-01-10T10:05:00Z',
    telefone: '(88) 99999-9999',
    created_at: '2024-01-10T10:00:00Z',
  },
  {
    id_usuario: 2,
    nome: 'Lucas Nogueira',
    email: 'lucas.nogueira@ifce.edu.br',
    senha_hash: defaultDemoHash,
    matricula: 'ADM-2024-991',
    perfil: 'ADMINISTRADOR',
    status_conta: 'ATIVO',
    email_verificado: true,
    email_verificado_em: '2023-12-01T08:05:00Z',
    telefone: '(88) 98888-0001',
    materias: 'Gestão de Tecnologia e Redes',
    created_at: '2023-12-01T08:00:00Z',
  },
  {
    id_usuario: 3,
    nome: 'Saulo Bezerra',
    email: 'saulo_bezerra@gmail.com',
    senha_hash: defaultDemoHash,
    matricula: 'DOC-8831',
    perfil: 'PROFESSOR',
    status_conta: 'ATIVO',
    email_verificado: true,
    email_verificado_em: '2023-11-15T09:05:00Z',
    telefone: '(88) 96798-1099',
    materias: 'LDS ARQM',
    created_at: '2023-11-15T09:00:00Z',
  },
  {
    id_usuario: 4,
    nome: 'José Olinda',
    email: 'jose.olinda@ifce.edu.br',
    senha_hash: defaultDemoHash,
    matricula: 'DOC-7720',
    perfil: 'PROFESSOR',
    status_conta: 'ATIVO',
    email_verificado: true,
    email_verificado_em: '2023-10-10T11:05:00Z',
    telefone: '(88) 97777-2233',
    materias: 'Algoritmos e Estruturas de Dados',
    created_at: '2023-10-10T11:00:00Z',
  },
  {
    id_usuario: 5,
    nome: 'Lyrane Brito Bezerra',
    email: 'lyrane@ifce.edu.br',
    senha_hash: defaultDemoHash,
    matricula: 'DOC-5501',
    perfil: 'PROFESSOR',
    status_conta: 'ATIVO',
    email_verificado: true,
    email_verificado_em: '2024-02-01T14:05:00Z',
    telefone: '(88) 99655-4433',
    materias: 'Inteligência Artificial',
    created_at: '2024-02-01T14:00:00Z',
  },
  {
    id_usuario: 16,
    nome: 'Mariana Ribeiro Feitosa',
    email: 'mariana.feitosa@gmail.com',
    senha_hash: defaultDemoHash,
    matricula: '20241INFO08',
    perfil: 'PARTICIPANTE',
    status_conta: 'ATIVO',
    email_verificado: false,
    email_verificado_em: null,
    telefone: '(88) 99888-1122',
    created_at: '2026-10-14T09:15:00Z',
  },
  {
    id_usuario: 17,
    nome: 'Prof. Rodrigo Cavalcante Maia',
    email: 'rodrigo.maia@ifce.edu.br',
    senha_hash: defaultDemoHash,
    matricula: 'DOC-9912',
    perfil: 'PROFESSOR',
    status_conta: 'PENDENTE',
    email_verificado: true,
    email_verificado_em: '2026-10-14T10:30:00Z',
    telefone: '(88) 99777-3344',
    materias: 'Sistemas Embarcados e IoT',
    created_at: '2026-10-14T10:30:00Z',
  },
  {
    id_usuario: 18,
    nome: 'Profa. Fernanda Alencar Moura',
    email: 'fernanda.moura@ifce.edu.br',
    senha_hash: defaultDemoHash,
    matricula: 'DOC-9945',
    perfil: 'PROFESSOR',
    status_conta: 'PENDENTE',
    email_verificado: true,
    email_verificado_em: '2026-10-15T14:20:00Z',
    telefone: '(88) 99612-8890',
    materias: 'Engenharia de Software e Banco de Dados',
    created_at: '2026-10-15T14:20:00Z',
  },
];

export const inMemoryVerificationTokens: InMemoryVerificationToken[] = [];
export const inMemoryInscriptions: InMemoryEventInscription[] = [
  {
    id_inscricao: 1,
    id_usuario: 1,
    id_evento: 1,
    status: 'CONFIRMADA',
    data_inscricao: '2024-04-10T14:22:00Z',
  },
  {
    id_inscricao: 2,
    id_usuario: 1,
    id_evento: 3,
    status: 'CONFIRMADA',
    data_inscricao: '2024-05-02T16:15:00Z',
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
      max: process.env.VERCEL ? 3 : process.env.NODE_ENV === 'production' ? 10 : 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    globalPool.on('error', (err) => {
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
        error.message?.includes('Connection terminated') ||
        error.message?.includes('terminating connection') ||
        error.message?.includes('timeout exceeded') ||
        error.code === '57P01' ||
        error.code === 'ECONNRESET' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT';

      if (isConnectionTerminated && attempts < maxAttempts) {
        console.warn(
          `[DATABASE RETRY]: Conexão redefinida pela nuvem Render. Repetindo consulta (${attempts}/${maxAttempts})...`
        );
        await new Promise((resolve) => setTimeout(resolve, 1200));
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
 * Ensures the `usuario` and `email_verification_tokens` tables exist with safe migrations
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

  const createAndMigrateSQL = `
    CREATE TABLE IF NOT EXISTS usuario (
      id_usuario SERIAL PRIMARY KEY,
      nome VARCHAR(100) NOT NULL,
      email VARCHAR(120) NOT NULL UNIQUE,
      senha_hash VARCHAR(255) NOT NULL,
      matricula VARCHAR(30) UNIQUE,
      perfil VARCHAR(30) NOT NULL DEFAULT 'PARTICIPANTE',
      status_conta VARCHAR(30) NOT NULL DEFAULT 'PENDENTE',
      email_verificado BOOLEAN NOT NULL DEFAULT FALSE,
      email_verificado_em TIMESTAMP WITH TIME ZONE,
      foto_perfil VARCHAR(255),
      telefone VARCHAR(20),
      materias VARCHAR(150),
      aprovado_por INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
      decisao_em TIMESTAMP WITH TIME ZONE,
      motivo_decisao TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE usuario ADD COLUMN IF NOT EXISTS status_conta VARCHAR(30) NOT NULL DEFAULT 'PENDENTE';
    ALTER TABLE usuario ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE usuario ADD COLUMN IF NOT EXISTS email_verificado_em TIMESTAMP WITH TIME ZONE;
    ALTER TABLE usuario ADD COLUMN IF NOT EXISTS aprovado_por INT;
    ALTER TABLE usuario ADD COLUMN IF NOT EXISTS decisao_em TIMESTAMP WITH TIME ZONE;
    ALTER TABLE usuario ADD COLUMN IF NOT EXISTS motivo_decisao TEXT;

    -- Safe migration: preserve existing active users so they are not locked out
    UPDATE usuario
    SET email_verificado = TRUE,
        email_verificado_em = COALESCE(email_verificado_em, created_at, CURRENT_TIMESTAMP)
    WHERE status_conta = 'ATIVO' AND email_verificado = FALSE;

    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id SERIAL PRIMARY KEY,
      id_usuario INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      code_hash VARCHAR(64),
      failed_attempts INT NOT NULL DEFAULT 0,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      used_at TIMESTAMP WITH TIME ZONE,
      ip_origem VARCHAR(64),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE email_verification_tokens ADD COLUMN IF NOT EXISTS code_hash VARCHAR(64);
    ALTER TABLE email_verification_tokens ADD COLUMN IF NOT EXISTS failed_attempts INT NOT NULL DEFAULT 0;

    CREATE INDEX IF NOT EXISTS idx_email_verif_usuario ON email_verification_tokens(id_usuario);
    CREATE INDEX IF NOT EXISTS idx_email_verif_expires ON email_verification_tokens(expires_at);
    CREATE INDEX IF NOT EXISTS idx_email_verif_code ON email_verification_tokens(code_hash);
  `;

  try {
    await activePool.query(createAndMigrateSQL);

    // Seed initial accounts ONLY if the database is brand-new / completely empty
    const countRes = await activePool.query<{ total: number }>(
      'SELECT COUNT(*)::int AS total FROM usuario'
    );
    if ((countRes.rows[0]?.total || 0) === 0) {
      for (const u of inMemoryUsers) {
        await activePool.query(
          `INSERT INTO usuario (
            id_usuario, nome, email, senha_hash, matricula, perfil, status_conta,
            email_verificado, email_verificado_em, telefone, materias, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (email) DO NOTHING`,
          [
            u.id_usuario,
            u.nome,
            u.email,
            u.senha_hash,
            u.matricula,
            u.perfil,
            u.status_conta,
            u.email_verificado,
            u.email_verificado_em || null,
            u.telefone || null,
            u.materias || null,
            u.created_at,
          ]
        );
      }
      await activePool.query(
        `SELECT setval('usuario_id_usuario_seq', COALESCE((SELECT MAX(id_usuario) FROM usuario), 1), true)`
      );
      console.log('[DATABASE SEED]: Contas iniciais de demonstração populadas no PostgreSQL vazio.');
    }

    schemaInitialized = true;
    console.log('[DATABASE INIT]: Tabelas e migrações verificadas com sucesso no PostgreSQL.');
  } catch (err: any) {
    console.warn(
      '[DATABASE INIT NOTICE]: O banco PostgreSQL do Render está inicializando ou indisponível no momento (%s). O servidor permanecerá ativo e reconectará sob demanda.',
      err.message
    );
  }
}

let schemaPromise: Promise<void> | null = null;

/**
 * Ensures PostgreSQL schema/migrations run once per serverless/server lifecycle before auth queries.
 */
export async function ensurePostgresSchema(): Promise<void> {
  if (!isConfiguredWithRealDatabase || schemaInitialized) return;
  if (!schemaPromise) {
    schemaPromise = initPostgresSchema().finally(() => {
      if (!schemaInitialized) {
        schemaPromise = null;
      }
    });
  }
  await schemaPromise;
}

export function isSchemaReady(): boolean {
  return schemaInitialized;
}
