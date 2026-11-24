import { Pool, QueryResult, QueryResultRow } from 'pg';
import bcrypt from 'bcryptjs';

/**
 * Sanitizes and validates the PostgreSQL connection string.
 * Strips outer quotes, whitespace, and accidental trailing characters from copy-pastes.
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
    url.includes('user:password@localhost') ||
    url.includes('usuario:senha@host')
  );
}

const rawConnectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.RENDER_DATABASE_URL;

export const sanitizedUrl = sanitizeConnectionString(rawConnectionString);
export const isConfiguredWithRealDatabase = Boolean(sanitizedUrl && !isPlaceholderUrl(sanitizedUrl));

export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

export function isDemoModeEnabled(): boolean {
  if (process.env.ENABLE_DEMO_MODE === 'true') {
    return true;
  }
  if (isProductionEnvironment()) {
    return false;
  }
  return !isConfiguredWithRealDatabase;
}

const isLocalhost = Boolean(
  sanitizedUrl?.includes('localhost') || sanitizedUrl?.includes('127.0.0.1')
);

const sslDisabled =
  process.env.PGSSLMODE === 'disable' ||
  Boolean(sanitizedUrl && /[?&]sslmode=disable/i.test(sanitizedUrl));

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

export interface InMemoryPasswordResetToken {
  id: number;
  id_usuario: number;
  token_hash: string;
  code_hash: string;
  failed_attempts: number;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface InMemoryEvent {
  id_evento: number;
  id_organizador: number;
  organizador_nome: string;
  titulo: string;
  descricao: string;
  banner_url: string | null;
  data_inicio: string;
  data_fim: string;
  inicio_inscricoes: string;
  fim_inscricoes: string;
  local: string;
  modalidade: 'Presencial' | 'Online';
  status: 'RASCUNHO' | 'PUBLICADO' | 'ENCERRADO' | 'CANCELADO';
  horario_formatado: string;
  data_formatada: string;
  created_at: string;
}

export interface InMemoryActivity {
  id_atividade: number;
  id_evento: number;
  titulo: string;
  descricao?: string;
  tipo: string;
  data_hora_inicio: string;
  data_hora_fim: string;
  local: string;
  limite_vagas: number;
  carga_horaria: number;
  created_at: string;
}

export interface InMemoryEventInscription {
  id_inscricao: number;
  id_usuario: number;
  id_atividade: number;
  id_evento: number;
  status: 'CONFIRMADA' | 'CANCELADA';
  data_inscricao: string;
}

export interface InMemoryAttendance {
  id_frequencia: number;
  id_inscricao: number;
  presente: boolean;
  data_registro: string;
}

export interface InMemoryCertificate {
  id_certificado: number;
  id_frequencia: number;
  codigo_validacao: string;
  data_emissao: string;
  status_aprovacao: 'PENDENTE' | 'APROVADO' | 'RECUSADO';
  participante_nome: string;
  participante_matricula: string | null;
  evento_titulo: string;
  atividade_titulo: string;
  organizador_nome: string;
  carga_horaria: number;
  data_evento: string;
}

// Lazy demo data only used in non-production preview or explicit ENABLE_DEMO_MODE=true
let cachedDemoHash: string | null = null;
function getDemoHash(): string {
  if (!cachedDemoHash) {
    cachedDemoHash = bcrypt.hashSync('alunoifce', 10);
  }
  return cachedDemoHash;
}

function createInitialDemoUsers(): InMemoryUser[] {
  const hash = getDemoHash();
  return [
    {
      id_usuario: 1,
      nome: 'Luiz Thomas Marte Moreira',
      email: 'luiz.thomas@gmail.com',
      senha_hash: hash,
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
      senha_hash: hash,
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
      senha_hash: hash,
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
      senha_hash: hash,
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
      senha_hash: hash,
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
      senha_hash: hash,
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
      senha_hash: hash,
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
      senha_hash: hash,
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
}

export const inMemoryUsers: InMemoryUser[] = isDemoModeEnabled() ? createInitialDemoUsers() : [];
export const inMemoryVerificationTokens: InMemoryVerificationToken[] = [];
export const inMemoryPasswordResetTokens: InMemoryPasswordResetToken[] = [];

export const inMemoryEvents: InMemoryEvent[] = isDemoModeEnabled()
  ? [
      {
        id_evento: 1,
        id_organizador: 3,
        organizador_nome: 'Saulo Bezerra',
        titulo: 'Semana da Computação 2024',
        descricao:
          'A Semana da Computação é o maior evento acadêmico integrado de ciência da computação e tecnologia do IFCE Campus Cedro. Inclui minicursos práticos, maratonas de programação, palestras sobre o mercado de tecnologia e mostras de projetos de iniciação científica e extensão.',
        banner_url: null,
        data_inicio: '2024-05-16 08:00:00',
        data_fim: '2024-05-18 18:00:00',
        inicio_inscricoes: '2024-04-01 00:00:00',
        fim_inscricoes: '2024-05-15 23:59:59',
        status: 'PUBLICADO',
        local: 'Campus Cedro - IFCE',
        modalidade: 'Presencial',
        horario_formatado: '08:00h - 18:00h',
        data_formatada: '16 a 18 de Maio de 2024',
        created_at: '2024-03-01T10:00:00Z',
      },
      {
        id_evento: 2,
        id_organizador: 5,
        organizador_nome: 'Lyrane Brito Bezerra',
        titulo: 'Workshop de IA',
        descricao:
          'Workshop imersivo abordando Modelos de Linguagem de Grande Escala (LLMs), Visão Computacional e agentes inteligentes aplicados à resolução de problemas regionais e automação sustentável no estado do Ceará.',
        banner_url: null,
        data_inicio: '2024-05-20 14:00:00',
        data_fim: '2024-05-20 18:00:00',
        inicio_inscricoes: '2024-04-10 00:00:00',
        fim_inscricoes: '2024-05-19 23:59:59',
        status: 'CANCELADO',
        local: 'Online',
        modalidade: 'Online',
        horario_formatado: '14:00h - 18:00h',
        data_formatada: '20 de Maio de 2024',
        created_at: '2024-03-10T11:00:00Z',
      },
      {
        id_evento: 3,
        id_organizador: 3,
        organizador_nome: 'Saulo Bezerra',
        titulo: 'Mostra Científica IFCE',
        descricao:
          'Apresentação de artigos, banners científicos e protótipos de engenharia e computação desenvolvidos pelos grupos de pesquisa do IFCE. Espaço propício para networking com pesquisadores, empresas juniores e fomento à inovação.',
        banner_url: null,
        data_inicio: '2024-06-05 13:00:00',
        data_fim: '2024-06-05 17:00:00',
        inicio_inscricoes: '2024-05-01 00:00:00',
        fim_inscricoes: '2024-06-04 23:59:59',
        status: 'PUBLICADO',
        local: 'Campus Cedro - IFCE',
        modalidade: 'Presencial',
        horario_formatado: '13:00h - 15:00h',
        data_formatada: '05 de Junho de 2024',
        created_at: '2024-03-15T09:00:00Z',
      },
      {
        id_evento: 4,
        id_organizador: 2,
        organizador_nome: 'Lucas Nogueira',
        titulo: 'Palestra Inovação e Tecnologia',
        descricao:
          'Discussão sobre as novas fronteiras da computação em nuvem, metodologias ágeis em equipes multidisciplinares e práticas de Clean Architecture em projetos de alta escala.',
        banner_url: null,
        data_inicio: '2024-06-10 09:00:00',
        data_fim: '2024-06-10 11:30:00',
        inicio_inscricoes: '2024-05-15 00:00:00',
        fim_inscricoes: '2024-06-09 23:59:59',
        status: 'RASCUNHO',
        local: 'Campus Cedro - IFCE',
        modalidade: 'Presencial',
        horario_formatado: '09:00h - 11:30h',
        data_formatada: '10 de Junho de 2024',
        created_at: '2024-04-01T08:00:00Z',
      },
      {
        id_evento: 5,
        id_organizador: 4,
        organizador_nome: 'José Olinda',
        titulo: 'Minicurso de Python',
        descricao:
          'Minicurso prático com foco em análise exploratória de dados, manipulação com Pandas e visualização gráfica com Seaborn e Matplotlib para iniciação científica.',
        banner_url: null,
        data_inicio: '2024-06-12 14:00:00',
        data_fim: '2024-06-12 18:00:00',
        inicio_inscricoes: '2024-05-20 00:00:00',
        fim_inscricoes: '2024-06-11 23:59:59',
        status: 'PUBLICADO',
        local: 'Online',
        modalidade: 'Online',
        horario_formatado: '14:00h - 18:00h',
        data_formatada: '12 de Junho de 2024',
        created_at: '2024-04-05T12:00:00Z',
      },
      {
        id_evento: 6,
        id_organizador: 3,
        organizador_nome: 'Saulo Bezerra',
        titulo: 'Simpósio de Pesquisa',
        descricao:
          'Encontro com avaliadores externos, bancas de qualificação e palestras magnas sobre fomento à pesquisa pelo CNPq e FUNCAP no interior cearense.',
        banner_url: null,
        data_inicio: '2024-06-15 08:30:00',
        data_fim: '2024-06-15 17:30:00',
        inicio_inscricoes: '2024-05-25 00:00:00',
        fim_inscricoes: '2024-06-14 23:59:59',
        status: 'PUBLICADO',
        local: 'Campus Cedro - IFCE',
        modalidade: 'Presencial',
        horario_formatado: '08:30h - 17:30h',
        data_formatada: '15 de Junho de 2024',
        created_at: '2024-04-10T15:00:00Z',
      },
      {
        id_evento: 7,
        id_organizador: 2,
        organizador_nome: 'Lucas Nogueira',
        titulo: 'E.A.G.L.E. 2026',
        descricao:
          'Encontro Acadêmico de Grandes Lideranças Estudantis e Extensão Tecnológica. Programação integrando todos os campi do IFCE.',
        banner_url: null,
        data_inicio: '2026-09-30 08:00:00',
        data_fim: '2026-10-02 18:00:00',
        inicio_inscricoes: '2026-08-01 00:00:00',
        fim_inscricoes: '2026-09-29 23:59:59',
        status: 'PUBLICADO',
        local: 'Auditório Principal - IFCE',
        modalidade: 'Presencial',
        horario_formatado: '08:00h - 18:00h',
        data_formatada: '30 de Setembro a 02 de Outubro de 2026',
        created_at: '2026-08-01T10:00:00Z',
      },
      {
        id_evento: 8,
        id_organizador: 4,
        organizador_nome: 'José Olinda',
        titulo: 'Semana da Computação 2023',
        descricao:
          'Edição histórica com oficinas de Arduino, maratona de programação competitiva e painel sobre mulheres na tecnologia.',
        banner_url: null,
        data_inicio: '2023-05-12 08:00:00',
        data_fim: '2023-05-14 18:00:00',
        inicio_inscricoes: '2023-04-01 00:00:00',
        fim_inscricoes: '2023-05-11 23:59:59',
        status: 'ENCERRADO',
        local: 'Campus Cedro - IFCE',
        modalidade: 'Presencial',
        horario_formatado: '08:00h - 18:00h',
        data_formatada: '12 de Maio de 2023',
        created_at: '2023-04-01T10:00:00Z',
      },
    ]
  : [];

export const inMemoryActivities: InMemoryActivity[] = isDemoModeEnabled()
  ? [
      {
        id_atividade: 1,
        id_evento: 1,
        titulo: 'Palestra Magna: Engenharia de Software Moderna e Cloud',
        descricao: 'Palestra inaugural sobre arquiteturas resilientes e observabilidade.',
        tipo: 'Palestra',
        data_hora_inicio: '2024-05-16 09:00:00',
        data_hora_fim: '2024-05-16 11:30:00',
        local: 'Auditório Central',
        limite_vagas: 120,
        carga_horaria: 20,
        created_at: '2024-03-05T10:00:00Z',
      },
      {
        id_atividade: 2,
        id_evento: 2,
        titulo: 'Workshop Prático: Agentes Inteligentes com LLMs',
        descricao: 'Construção de aplicações com modelos generativos.',
        tipo: 'Workshop',
        data_hora_inicio: '2024-05-20 14:00:00',
        data_hora_fim: '2024-05-20 18:00:00',
        local: 'Sala Virtual Google Meet',
        limite_vagas: 50,
        carga_horaria: 8,
        created_at: '2024-03-12T10:00:00Z',
      },
      {
        id_atividade: 3,
        id_evento: 3,
        titulo: 'Mostra Científica: Apresentação de Pôsteres e Protótipos',
        descricao: 'Avaliação presencial de trabalhos de pesquisa.',
        tipo: 'Apresentação de Artigos',
        data_hora_inicio: '2024-06-05 13:00:00',
        data_hora_fim: '2024-06-05 17:00:00',
        local: 'Pátio Acadêmico IFCE',
        limite_vagas: 100,
        carga_horaria: 15,
        created_at: '2024-03-16T10:00:00Z',
      },
      {
        id_atividade: 4,
        id_evento: 5,
        titulo: 'Minicurso: Python para Ciência de Dados',
        descricao: 'Hands-on com NumPy, Pandas e visualização de dados.',
        tipo: 'Minicurso',
        data_hora_inicio: '2024-06-12 14:00:00',
        data_hora_fim: '2024-06-12 18:00:00',
        local: 'Laboratório Virtual',
        limite_vagas: 45,
        carga_horaria: 12,
        created_at: '2024-04-06T10:00:00Z',
      },
    ]
  : [];

export const inMemoryInscriptions: InMemoryEventInscription[] = isDemoModeEnabled()
  ? [
      {
        id_inscricao: 1,
        id_usuario: 1,
        id_atividade: 1,
        id_evento: 1,
        status: 'CONFIRMADA',
        data_inscricao: '2024-04-10T14:22:00Z',
      },
      {
        id_inscricao: 2,
        id_usuario: 1,
        id_atividade: 3,
        id_evento: 3,
        status: 'CONFIRMADA',
        data_inscricao: '2024-05-02T16:15:00Z',
      },
    ]
  : [];

export const inMemoryAttendances: InMemoryAttendance[] = [];
export const inMemoryCertificates: InMemoryCertificate[] = isDemoModeEnabled()
  ? [
      {
        id_certificado: 1,
        id_frequencia: 101,
        codigo_validacao: 'IFCE-SC23-9F8A-7C21-BD3E-88A1',
        data_emissao: '2023-05-12T17:00:00Z',
        status_aprovacao: 'APROVADO',
        participante_nome: 'Luiz Thomas Marte Moreira',
        participante_matricula: '123456789101112',
        evento_titulo: 'Semana da Computação 2023',
        atividade_titulo: 'Ciclo de Minicursos e Palestras Técnicas',
        organizador_nome: 'José Olinda',
        carga_horaria: 20,
        data_evento: '12/05/2023',
      },
    ]
  : [];

export const inMemoryFavorites = new Map<number, number[]>([[1, [1, 3]]]);

const globalWithPool = globalThis as typeof globalThis & {
  __iventusPgPool?: Pool | null;
};

export function getPool(): Pool | null {
  if (!isConfiguredWithRealDatabase || !sanitizedUrl) {
    return null;
  }

  if (!globalWithPool.__iventusPgPool) {
    globalWithPool.__iventusPgPool = new Pool({
      connectionString: sanitizedUrl,
      ssl:
        isLocalhost || sslDisabled
          ? false
          : {
              rejectUnauthorized: false,
            },
      max: process.env.VERCEL ? 3 : isProductionEnvironment() ? 10 : 5,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 15000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    globalWithPool.__iventusPgPool.on('error', (err) => {
      console.warn('[DATABASE POOL NOTICE]: Conexão ociosa redefinida pelo PostgreSQL:', err.message);
    });
  }

  return globalWithPool.__iventusPgPool;
}

export const pool = getPool();

let schemaInitialized = false;

/**
 * Throws 503 if running in production without a real PostgreSQL connection.
 */
export function assertStorageAvailable(): void {
  if (!isConfiguredWithRealDatabase && isProductionEnvironment()) {
    const err = new Error(
      'Banco de dados PostgreSQL não configurado no ambiente de produção. Defina DATABASE_URL ou POSTGRES_URL nas variáveis de ambiente do Vercel.'
    );
    (err as any).statusCode = 503;
    (err as any).errorCode = 'DATABASE_NOT_CONFIGURED';
    throw err;
  }
}

/**
 * Helper to run a SQL query with automatic reconnection retry for cloud PostgreSQL instances
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const activePool = getPool();

  if (!activePool) {
    const err = new Error('DATABASE_URL_NOT_CONFIGURED');
    (err as any).statusCode = 503;
    (err as any).errorCode = 'DATABASE_NOT_CONFIGURED';
    throw err;
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
          `[DATABASE RETRY]: Conexão redefinida pelo PostgreSQL. Repetindo consulta (${attempts}/${maxAttempts})...`
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
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
 * Ensures all IFCE Iventus PostgreSQL tables and migrations exist
 */
export async function initPostgresSchema(): Promise<void> {
  if (!isConfiguredWithRealDatabase || !sanitizedUrl) {
    if (!isProductionEnvironment()) {
      console.log(
        '[DATABASE INFO]: Modo preview/desenvolvimento local sem DATABASE_URL. Configure DATABASE_URL no .env ou no Vercel para persistência real em PostgreSQL.'
      );
    }
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
      foto_perfil TEXT,
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
    ALTER TABLE usuario ALTER COLUMN foto_perfil TYPE TEXT;

    -- Safe migration: preserve existing active users so they are not locked out
    UPDATE usuario
    SET email_verificado = TRUE,
        email_verificado_em = COALESCE(email_verificado_em, created_at, CURRENT_TIMESTAMP)
    WHERE status_conta = 'ATIVO' AND email_verificado = FALSE;

    -- Safe migration: participants do not require administrative approval
    UPDATE usuario
    SET status_conta = 'ATIVO'
    WHERE perfil = 'PARTICIPANTE' AND status_conta = 'PENDENTE';

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

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      id_usuario INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      code_hash VARCHAR(64) NOT NULL,
      failed_attempts INT NOT NULL DEFAULT 0,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      used_at TIMESTAMP WITH TIME ZONE,
      ip_origem VARCHAR(64),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_pwd_reset_usuario ON password_reset_tokens(id_usuario);
    CREATE INDEX IF NOT EXISTS idx_pwd_reset_expires ON password_reset_tokens(expires_at);

    CREATE TABLE IF NOT EXISTS evento (
      id_evento SERIAL PRIMARY KEY,
      id_organizador INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE,
      titulo VARCHAR(150) NOT NULL,
      descricao TEXT,
      banner_url TEXT,
      data_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
      data_fim TIMESTAMP WITH TIME ZONE NOT NULL,
      inicio_inscricoes TIMESTAMP WITH TIME ZONE NOT NULL,
      fim_inscricoes TIMESTAMP WITH TIME ZONE NOT NULL,
      local VARCHAR(150) NOT NULL,
      modalidade VARCHAR(20) NOT NULL DEFAULT 'Presencial',
      status VARCHAR(20) NOT NULL DEFAULT 'RASCUNHO',
      horario_formatado VARCHAR(80),
      data_formatada VARCHAR(120),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE evento ADD COLUMN IF NOT EXISTS horario_formatado VARCHAR(80);
    ALTER TABLE evento ADD COLUMN IF NOT EXISTS data_formatada VARCHAR(120);
    ALTER TABLE evento ALTER COLUMN banner_url TYPE TEXT;
    ALTER TABLE evento ALTER COLUMN local TYPE VARCHAR(150);

    CREATE TABLE IF NOT EXISTS atividade (
      id_atividade SERIAL PRIMARY KEY,
      id_evento INT NOT NULL REFERENCES evento(id_evento) ON DELETE CASCADE ON UPDATE CASCADE,
      titulo VARCHAR(150) NOT NULL,
      descricao TEXT,
      tipo VARCHAR(50) NOT NULL DEFAULT 'Palestra',
      data_hora_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
      data_hora_fim TIMESTAMP WITH TIME ZONE NOT NULL,
      local VARCHAR(150) NOT NULL,
      limite_vagas INT NOT NULL DEFAULT 100 CHECK (limite_vagas > 0),
      carga_horaria INT NOT NULL DEFAULT 20,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inscricao (
      id_inscricao SERIAL PRIMARY KEY,
      id_usuario INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE ON UPDATE CASCADE,
      id_atividade INT NOT NULL REFERENCES atividade(id_atividade) ON DELETE CASCADE ON UPDATE CASCADE,
      data_inscricao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMADA',
      CONSTRAINT uk_usuario_atividade UNIQUE (id_usuario, id_atividade)
    );

    CREATE TABLE IF NOT EXISTS frequencia (
      id_frequencia SERIAL PRIMARY KEY,
      id_inscricao INT NOT NULL UNIQUE REFERENCES inscricao(id_inscricao) ON DELETE CASCADE ON UPDATE CASCADE,
      presente BOOLEAN NOT NULL DEFAULT FALSE,
      data_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS certificado (
      id_certificado SERIAL PRIMARY KEY,
      id_frequencia INT REFERENCES frequencia(id_frequencia) ON DELETE SET NULL ON UPDATE CASCADE,
      id_usuario INT REFERENCES usuario(id_usuario) ON DELETE SET NULL ON UPDATE CASCADE,
      id_evento INT REFERENCES evento(id_evento) ON DELETE SET NULL ON UPDATE CASCADE,
      codigo_validacao VARCHAR(64) NOT NULL UNIQUE,
      status_aprovacao VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
      participante_nome VARCHAR(120),
      participante_matricula VARCHAR(30),
      evento_titulo VARCHAR(150),
      atividade_titulo VARCHAR(150),
      organizador_nome VARCHAR(120),
      carga_horaria INT NOT NULL DEFAULT 20,
      data_evento VARCHAR(60),
      data_emissao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE certificado ADD COLUMN IF NOT EXISTS id_usuario INT REFERENCES usuario(id_usuario) ON DELETE SET NULL;
    ALTER TABLE certificado ADD COLUMN IF NOT EXISTS id_evento INT REFERENCES evento(id_evento) ON DELETE SET NULL;
    ALTER TABLE certificado ADD COLUMN IF NOT EXISTS status_aprovacao VARCHAR(20) NOT NULL DEFAULT 'PENDENTE';
    ALTER TABLE certificado ADD COLUMN IF NOT EXISTS participante_nome VARCHAR(120);
    ALTER TABLE certificado ADD COLUMN IF NOT EXISTS participante_matricula VARCHAR(30);
    ALTER TABLE certificado ADD COLUMN IF NOT EXISTS evento_titulo VARCHAR(150);
    ALTER TABLE certificado ADD COLUMN IF NOT EXISTS atividade_titulo VARCHAR(150);
    ALTER TABLE certificado ADD COLUMN IF NOT EXISTS organizador_nome VARCHAR(120);
    ALTER TABLE certificado ADD COLUMN IF NOT EXISTS carga_horaria INT NOT NULL DEFAULT 20;
    ALTER TABLE certificado ADD COLUMN IF NOT EXISTS data_evento VARCHAR(60);

    CREATE TABLE IF NOT EXISTS favorito (
      id_usuario INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
      id_evento INT NOT NULL REFERENCES evento(id_evento) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id_usuario, id_evento)
    );

    CREATE INDEX IF NOT EXISTS idx_evento_organizador ON evento(id_organizador);
    CREATE INDEX IF NOT EXISTS idx_atividade_evento ON atividade(id_evento);
    CREATE INDEX IF NOT EXISTS idx_inscricao_atividade ON inscricao(id_atividade);
    CREATE INDEX IF NOT EXISTS idx_inscricao_usuario ON inscricao(id_usuario);
    CREATE INDEX IF NOT EXISTS idx_frequencia_inscricao ON frequencia(id_inscricao);
  `;

  try {
    await activePool.query(createAndMigrateSQL);

    // Optional production admin bootstrap via environment variables (safe: never uses hardcoded demo password)
    const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
    const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD?.trim();
    const initialAdminName = process.env.INITIAL_ADMIN_NAME?.trim() || 'Administrador IFCE Iventus';

    if (initialAdminEmail && initialAdminPassword && initialAdminPassword.length >= 8) {
      const adminCountRes = await activePool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM usuario WHERE perfil = 'ADMINISTRADOR'`
      );
      if ((adminCountRes.rows[0]?.total || 0) === 0) {
        const hash = await bcrypt.hash(initialAdminPassword, 12);
        await activePool.query(
          `INSERT INTO usuario (
            nome, email, senha_hash, matricula, perfil, status_conta, email_verificado, email_verificado_em
          ) VALUES ($1, $2, $3, $4, 'ADMINISTRADOR', 'ATIVO', TRUE, CURRENT_TIMESTAMP)
          ON CONFLICT (email) DO NOTHING`,
          [initialAdminName, initialAdminEmail, hash, 'ADM-001']
        );
        console.log('[DATABASE INIT]: Administrador inicial configurado via variáveis de ambiente.');
      }
    }

    // Seed demo accounts and sample events ONLY when explicit demo mode is enabled
    if (process.env.ENABLE_DEMO_MODE === 'true') {
      const countRes = await activePool.query<{ total: number }>(
        'SELECT COUNT(*)::int AS total FROM usuario'
      );
      if ((countRes.rows[0]?.total || 0) === 0) {
        for (const u of createInitialDemoUsers()) {
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
        console.log('[DATABASE SEED]: Contas de demonstração populadas (ENABLE_DEMO_MODE=true).');
      }
    }

    schemaInitialized = true;
    console.log('[DATABASE INIT]: Schema PostgreSQL verificado com sucesso.');
  } catch (err: any) {
    console.warn('[DATABASE INIT NOTICE]:', err.message);
  }
}

let schemaPromise: Promise<void> | null = null;

/**
 * Ensures PostgreSQL schema/migrations run once per serverless/server lifecycle before queries.
 */
export async function ensurePostgresSchema(): Promise<void> {
  assertStorageAvailable();
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
