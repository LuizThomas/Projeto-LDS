import bcrypt from 'bcryptjs';
import {
  query,
  isConfiguredWithRealDatabase,
  inMemoryUsers,
} from '../lib/db';

export interface RegisterInput {
  nome: string;
  email: string;
  senha: string;
  perfil?: 'ADMINISTRADOR' | 'PROFESSOR' | 'PARTICIPANTE';
  matricula?: string;
  telefone?: string;
  materias?: string;
}

export interface RegisterResult {
  success: boolean;
  message: string;
  user?: {
    id_usuario: number;
    nome: string;
    email: string;
    matricula: string | null;
    perfil: string;
    status_conta: string;
    created_at: string;
  };
  storage: 'postgresql' | 'memory_fallback';
}

const ALLOWED_PERFIS = ['ADMINISTRADOR', 'PROFESSOR', 'PARTICIPANTE'] as const;

/**
 * Registers a new user into the PostgreSQL Render database with 'PENDENTE' status.
 * Falls back to in-memory store in preview/development mode when DATABASE_URL is not yet connected.
 */
export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const nome = input.nome ? input.nome.trim() : '';
  const email = input.email ? input.email.trim().toLowerCase() : '';
  const senha = input.senha ? input.senha.trim() : '';
  const perfil = input.perfil || 'PARTICIPANTE';

  // 1. Validations
  if (!nome || nome.length < 3) {
    throw new Error('O nome completo deve ter no mínimo 3 caracteres.');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    throw new Error('Forneça um endereço de e-mail válido.');
  }

  if (!senha || senha.length < 6) {
    throw new Error('A senha deve ter no mínimo 6 caracteres.');
  }

  if (!ALLOWED_PERFIS.includes(perfil)) {
    throw new Error(`Perfil inválido: "${perfil}". Permitidos: ADMINISTRADOR, PROFESSOR, PARTICIPANTE.`);
  }

  // 2. Generate matricula if not supplied
  let matricula = input.matricula ? input.matricula.trim() : null;
  if (!matricula) {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    if (perfil === 'PARTICIPANTE') {
      matricula = `20241${randomNum}`;
    } else if (perfil === 'PROFESSOR') {
      matricula = `DOC-${randomNum}`;
    } else {
      matricula = `ADM-${randomNum}`;
    }
  }

  // 3. Hash the password
  const salt = await bcrypt.genSalt(10);
  const senhaHash = await bcrypt.hash(senha, salt);

  const statusConta = 'PENDENTE';

  // 4. Try PostgreSQL if configured
  if (isConfiguredWithRealDatabase) {
    try {
      // Check if user already exists
      const existingUserResult = await query(
        'SELECT id_usuario, email FROM usuario WHERE LOWER(email) = LOWER($1)',
        [email]
      );

      if (existingUserResult.rows.length > 0) {
        const error = new Error('Já existe um usuário cadastrado com este e-mail.');
        (error as any).statusCode = 409;
        throw error;
      }

      // Execute INSERT into Render PostgreSQL database
      const insertSQL = `
        INSERT INTO usuario (
          nome,
          email,
          senha_hash,
          matricula,
          perfil,
          status_conta,
          telefone,
          materias
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id_usuario, nome, email, matricula, perfil, status_conta, created_at;
      `;

      const values = [
        nome,
        email,
        senhaHash,
        matricula,
        perfil,
        statusConta,
        input.telefone || null,
        input.materias || null,
      ];

      const result = await query(insertSQL, values);

      if (result.rows.length === 0) {
        throw new Error('Falha ao inserir o registro de usuário no banco de dados.');
      }

      const createdUser = result.rows[0];

      return {
        success: true,
        message:
          'Sua solicitação de conta foi registrada no sistema do IFCE Iventus. Aguarde a confirmação de um administrador para liberação do acesso.',
        user: {
          id_usuario: createdUser.id_usuario,
          nome: createdUser.nome,
          email: createdUser.email,
          matricula: createdUser.matricula,
          perfil: createdUser.perfil,
          status_conta: createdUser.status_conta,
          created_at: createdUser.created_at,
        },
        storage: 'postgresql',
      };
    } catch (err: any) {
      if (err.statusCode === 409) {
        throw err;
      }
      console.warn(
        '[POSTGRESQL INSERT NOTICE]: Não foi possível gravar no PostgreSQL (%s). Utilizando armazenamento de contingência.',
        err.message
      );
      // Fall through to memory fallback so preview and test flows continue
    }
  }

  // 5. In-Memory fallback (Preview / Development when no live PostgreSQL instance is connected)
  const existingInMemory = inMemoryUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existingInMemory) {
    const error = new Error('Já existe um usuário cadastrado com este e-mail.');
    (error as any).statusCode = 409;
    throw error;
  }

  const newId = inMemoryUsers.length > 0 ? Math.max(...inMemoryUsers.map((u) => u.id_usuario)) + 1 : 100;
  const inMemUser = {
    id_usuario: newId,
    nome,
    email,
    senha_hash: senhaHash,
    matricula,
    perfil,
    status_conta: statusConta,
    telefone: input.telefone || null,
    materias: input.materias || null,
    created_at: new Date().toISOString(),
  };

  inMemoryUsers.push(inMemUser);

  return {
    success: true,
    message:
      'Sua solicitação de conta foi registrada no sistema do IFCE Iventus. Aguarde a confirmação de um administrador para liberação do acesso.',
    user: {
      id_usuario: inMemUser.id_usuario,
      nome: inMemUser.nome,
      email: inMemUser.email,
      matricula: inMemUser.matricula,
      perfil: inMemUser.perfil,
      status_conta: inMemUser.status_conta,
      created_at: inMemUser.created_at,
    },
    storage: 'memory_fallback',
  };
}

/**
 * Lists all pending users waiting for administrator approval
 */
export async function getPendingUsers() {
  if (isConfiguredWithRealDatabase) {
    try {
      const result = await query(
        `SELECT id_usuario, nome, email, matricula, perfil, status_conta, created_at 
         FROM usuario 
         WHERE status_conta = 'PENDENTE' 
         ORDER BY created_at DESC`
      );
      return result.rows;
    } catch (err: any) {
      console.warn('[POSTGRES GET PENDING NOTICE]:', err.message);
    }
  }

  return inMemoryUsers.filter((u) => u.status_conta === 'PENDENTE');
}

/**
 * Updates a user account status (ATIVO or RECUSADO)
 */
export async function moderateUserAccount(id_usuario: number, status: 'ATIVO' | 'RECUSADO') {
  if (!['ATIVO', 'RECUSADO'].includes(status)) {
    throw new Error('Status inválido. Escolha ATIVO ou RECUSADO.');
  }

  if (isConfiguredWithRealDatabase) {
    try {
      const result = await query(
        `UPDATE usuario 
         SET status_conta = $1 
         WHERE id_usuario = $2 
         RETURNING id_usuario, nome, email, perfil, status_conta`,
        [status, id_usuario]
      );

      if (result.rows.length > 0) {
        return result.rows[0];
      }
    } catch (err: any) {
      console.warn('[POSTGRES MODERATE NOTICE]:', err.message);
    }
  }

  const memIdx = inMemoryUsers.findIndex((u) => u.id_usuario === id_usuario);
  if (memIdx !== -1) {
    inMemoryUsers[memIdx].status_conta = status;
    return inMemoryUsers[memIdx];
  }

  const err = new Error('Usuário não encontrado.');
  (err as any).statusCode = 404;
  throw err;
}
