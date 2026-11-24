-- ============================================================
-- IFCE IVENTUS - BANCO DE DADOS POSTGRESQL
-- Script de Criação e Migração Segura para PostgreSQL 14+
-- Compatível com Neon, Supabase, Render e Vercel Postgres
-- ============================================================

-- 1. Tipos ENUM
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'perfil_usuario_enum') THEN
        CREATE TYPE perfil_usuario_enum AS ENUM ('ADMINISTRADOR', 'PROFESSOR', 'PARTICIPANTE');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_conta_enum') THEN
        CREATE TYPE status_conta_enum AS ENUM ('PENDENTE', 'ATIVO', 'RECUSADO');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'modalidade_enum') THEN
        CREATE TYPE modalidade_enum AS ENUM ('Presencial', 'Online');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_evento_enum') THEN
        CREATE TYPE status_evento_enum AS ENUM ('RASCUNHO', 'PUBLICADO', 'ENCERRADO', 'CANCELADO');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_inscricao_enum') THEN
        CREATE TYPE status_inscricao_enum AS ENUM ('CONFIRMADA', 'CANCELADA');
    END IF;
END $$;

-- 2. Tabela USUARIO
CREATE TABLE IF NOT EXISTS usuario (
    id_usuario SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    matricula VARCHAR(30) UNIQUE,
    perfil VARCHAR(30) NOT NULL DEFAULT 'PARTICIPANTE'
        CHECK (perfil IN ('ADMINISTRADOR', 'PROFESSOR', 'PARTICIPANTE')),
    status_conta VARCHAR(30) NOT NULL DEFAULT 'PENDENTE'
        CHECK (status_conta IN ('PENDENTE', 'ATIVO', 'RECUSADO')),
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
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS aprovado_por INT REFERENCES usuario(id_usuario) ON DELETE SET NULL;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS decisao_em TIMESTAMP WITH TIME ZONE;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS motivo_decisao TEXT;
ALTER TABLE usuario ALTER COLUMN foto_perfil TYPE TEXT;

UPDATE usuario
SET email_verificado = TRUE,
    email_verificado_em = COALESCE(email_verificado_em, created_at, CURRENT_TIMESTAMP)
WHERE status_conta = 'ATIVO' AND email_verificado = FALSE;

-- 3. Tabela EMAIL_VERIFICATION_TOKENS
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

-- 4. Tabela PASSWORD_RESET_TOKENS
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

-- 5. Tabela EVENTO
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
    modalidade VARCHAR(20) NOT NULL DEFAULT 'Presencial' CHECK (modalidade IN ('Presencial', 'Online')),
    status VARCHAR(20) NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO', 'PUBLICADO', 'ENCERRADO', 'CANCELADO')),
    horario_formatado VARCHAR(80),
    data_formatada VARCHAR(120),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE evento ADD COLUMN IF NOT EXISTS horario_formatado VARCHAR(80);
ALTER TABLE evento ADD COLUMN IF NOT EXISTS data_formatada VARCHAR(120);
ALTER TABLE evento ALTER COLUMN banner_url TYPE TEXT;
ALTER TABLE evento ALTER COLUMN local TYPE VARCHAR(150);

-- 6. Tabela ATIVIDADE
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

-- 7. Tabela INSCRICAO
CREATE TABLE IF NOT EXISTS inscricao (
    id_inscricao SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE ON UPDATE CASCADE,
    id_atividade INT NOT NULL REFERENCES atividade(id_atividade) ON DELETE CASCADE ON UPDATE CASCADE,
    data_inscricao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMADA' CHECK (status IN ('CONFIRMADA', 'CANCELADA')),
    CONSTRAINT uk_usuario_atividade UNIQUE (id_usuario, id_atividade)
);

-- 8. Tabela FREQUENCIA
CREATE TABLE IF NOT EXISTS frequencia (
    id_frequencia SERIAL PRIMARY KEY,
    id_inscricao INT NOT NULL UNIQUE REFERENCES inscricao(id_inscricao) ON DELETE CASCADE ON UPDATE CASCADE,
    presente BOOLEAN NOT NULL DEFAULT FALSE,
    data_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Tabela CERTIFICADO
CREATE TABLE IF NOT EXISTS certificado (
    id_certificado SERIAL PRIMARY KEY,
    id_frequencia INT REFERENCES frequencia(id_frequencia) ON DELETE SET NULL ON UPDATE CASCADE,
    id_usuario INT REFERENCES usuario(id_usuario) ON DELETE SET NULL ON UPDATE CASCADE,
    id_evento INT REFERENCES evento(id_evento) ON DELETE SET NULL ON UPDATE CASCADE,
    codigo_validacao VARCHAR(64) NOT NULL UNIQUE,
    status_aprovacao VARCHAR(20) NOT NULL DEFAULT 'PENDENTE' CHECK (status_aprovacao IN ('PENDENTE', 'APROVADO', 'RECUSADO')),
    participante_nome VARCHAR(120),
    participante_matricula VARCHAR(30),
    evento_titulo VARCHAR(150),
    atividade_titulo VARCHAR(150),
    organizador_nome VARCHAR(120),
    carga_horaria INT NOT NULL DEFAULT 20,
    data_evento VARCHAR(60),
    data_emissao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Tabela FAVORITO
CREATE TABLE IF NOT EXISTS favorito (
    id_usuario INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    id_evento INT NOT NULL REFERENCES evento(id_evento) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_usuario, id_evento)
);

-- 11. Índices de Integridade e Performance por Evento
CREATE INDEX IF NOT EXISTS idx_evento_organizador ON evento(id_organizador);
CREATE INDEX IF NOT EXISTS idx_atividade_evento ON atividade(id_evento);
CREATE INDEX IF NOT EXISTS idx_inscricao_atividade ON inscricao(id_atividade);
CREATE INDEX IF NOT EXISTS idx_inscricao_usuario ON inscricao(id_usuario);
CREATE INDEX IF NOT EXISTS idx_frequencia_inscricao ON frequencia(id_inscricao);

-- Nota: O primeiro administrador do ambiente de produção deve ser criado pela tela inicial
-- de configuração do sistema ou pelas variáveis INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD.
