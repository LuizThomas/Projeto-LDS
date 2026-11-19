-- ============================================================
-- IFCE IVENTUS - BANCO DE DADOS POSTGRESQL (RENDER.COM)
-- Script de Criação e Migração Segura para PostgreSQL 14+
-- ============================================================

-- 1. Tipos ENUM (se aplicável)
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
    foto_perfil VARCHAR(255),
    telefone VARCHAR(20),
    materias VARCHAR(150),
    aprovado_por INT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    decisao_em TIMESTAMP WITH TIME ZONE,
    motivo_decisao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Migração segura para bancos já existentes (preserva registros existentes)
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS email_verificado_em TIMESTAMP WITH TIME ZONE;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS aprovado_por INT REFERENCES usuario(id_usuario) ON DELETE SET NULL;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS decisao_em TIMESTAMP WITH TIME ZONE;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS motivo_decisao TEXT;

-- Contas já ativas antes da migração são preservadas como verificadas para evitar bloqueio indevido
UPDATE usuario
SET email_verificado = TRUE,
    email_verificado_em = COALESCE(email_verificado_em, created_at, CURRENT_TIMESTAMP)
WHERE status_conta = 'ATIVO' AND email_verificado = FALSE;

-- 3. Tabela EMAIL_VERIFICATION_TOKENS (tokens e códigos armazenados exclusivamente como hash SHA-256)
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

-- 4. Tabela EVENTO
CREATE TABLE IF NOT EXISTS evento (
    id_evento SERIAL PRIMARY KEY,
    id_organizador INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE,
    titulo VARCHAR(150) NOT NULL,
    descricao TEXT,
    banner_url VARCHAR(255),
    data_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    data_fim TIMESTAMP WITH TIME ZONE NOT NULL,
    inicio_inscricoes TIMESTAMP WITH TIME ZONE NOT NULL,
    fim_inscricoes TIMESTAMP WITH TIME ZONE NOT NULL,
    local VARCHAR(100) NOT NULL,
    modalidade VARCHAR(20) NOT NULL DEFAULT 'Presencial' CHECK (modalidade IN ('Presencial', 'Online')),
    status VARCHAR(20) NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO', 'PUBLICADO', 'ENCERRADO', 'CANCELADO')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_evento_datas CHECK (
        inicio_inscricoes < fim_inscricoes 
        AND fim_inscricoes <= data_inicio 
        AND data_inicio < data_fim
    )
);

-- 5. Tabela ATIVIDADE
CREATE TABLE IF NOT EXISTS atividade (
    id_atividade SERIAL PRIMARY KEY,
    id_evento INT NOT NULL REFERENCES evento(id_evento) ON DELETE RESTRICT ON UPDATE CASCADE,
    titulo VARCHAR(150) NOT NULL,
    descricao TEXT,
    tipo VARCHAR(50) NOT NULL,
    data_hora_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    data_hora_fim TIMESTAMP WITH TIME ZONE NOT NULL,
    local VARCHAR(100) NOT NULL,
    limite_vagas INT NOT NULL CHECK (limite_vagas > 0),
    carga_horaria INT NOT NULL DEFAULT 20,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_atividade_datas CHECK (data_hora_inicio < data_hora_fim)
);

-- 6. Tabela INSCRICAO
CREATE TABLE IF NOT EXISTS inscricao (
    id_inscricao SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE,
    id_atividade INT NOT NULL REFERENCES atividade(id_atividade) ON DELETE RESTRICT ON UPDATE CASCADE,
    data_inscricao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMADA' CHECK (status IN ('CONFIRMADA', 'CANCELADA')),
    CONSTRAINT uk_usuario_atividade UNIQUE (id_usuario, id_atividade)
);

-- 7. Tabela FREQUENCIA
CREATE TABLE IF NOT EXISTS frequencia (
    id_frequencia SERIAL PRIMARY KEY,
    id_inscricao INT NOT NULL UNIQUE REFERENCES inscricao(id_inscricao) ON DELETE RESTRICT ON UPDATE CASCADE,
    presente BOOLEAN NOT NULL DEFAULT FALSE,
    data_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Tabela CERTIFICADO
CREATE TABLE IF NOT EXISTS certificado (
    id_certificado SERIAL PRIMARY KEY,
    id_frequencia INT NOT NULL UNIQUE REFERENCES frequencia(id_frequencia) ON DELETE RESTRICT ON UPDATE CASCADE,
    codigo_validacao VARCHAR(64) NOT NULL UNIQUE,
    data_emissao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- DADOS INICIAIS (SEEDS)
-- ============================================================
INSERT INTO usuario (id_usuario, nome, email, senha_hash, matricula, perfil, status_conta, email_verificado, email_verificado_em)
VALUES 
(1, 'Luiz Thomas Marte Moreira', 'luiz.thomas@gmail.com', '$2b$10$w8.1fceIventusSimulatedHashPart', '123456789101112', 'PARTICIPANTE', 'ATIVO', TRUE, CURRENT_TIMESTAMP),
(2, 'Lucas Nogueira', 'lucas.nogueira@ifce.edu.br', '$2b$10$w8.1fceIventusSimulatedHashAdm', 'ADM-2024-991', 'ADMINISTRADOR', 'ATIVO', TRUE, CURRENT_TIMESTAMP),
(3, 'Saulo Bezerra', 'saulo_bezerra@gmail.com', '$2b$10$w8.1fceIventusSimulatedHashProf', 'DOC-8831', 'PROFESSOR', 'ATIVO', TRUE, CURRENT_TIMESTAMP)
ON CONFLICT (id_usuario) DO NOTHING;

SELECT setval('usuario_id_usuario_seq', COALESCE((SELECT MAX(id_usuario) FROM usuario), 1), true);
