import { registerUser } from '../../src/server/authService';

export default async function handler(req: any, res: any) {
  // CORS Configuration for Vercel Serverless
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: `Método ${req.method} não suportado. Utilize POST para cadastro.`,
    });
  }

  // Parse body if incoming as string or buffer
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Corpo da requisição inválido (JSON malformatado).',
      });
    }
  }

  if (!body || typeof body !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'Dados de cadastro não fornecidos.',
    });
  }

  const { nome, email, senha, perfil, matricula, telefone, materias } = body;

  try {
    console.log('[API /api/auth/register] Iniciando cadastro para:', email);
    
    const result = await registerUser({
      nome,
      email,
      senha,
      perfil,
      matricula,
      telefone,
      materias,
    });

    console.log('[API /api/auth/register] Usuário cadastrado com sucesso:', result.user?.id_usuario);
    return res.status(201).json(result);
  } catch (error: any) {
    console.warn('[API /api/auth/register NOTICE]:', error.message);

    const statusCode = error.statusCode || (error.code === '23505' ? 409 : 500);
    const message =
      error.code === '23505'
        ? 'Já existe um usuário cadastrado com estes dados (e-mail ou matrícula já em uso).'
        : error.message || 'Erro ao processar cadastro no banco de dados Render.';

    return res.status(statusCode).json({
      success: false,
      message,
      errorCode: error.code || 'DB_ERROR',
      hint:
        !process.env.DATABASE_URL
          ? 'Atenção: A variável de ambiente DATABASE_URL não foi configurada na Vercel.'
          : undefined,
    });
  }
}
