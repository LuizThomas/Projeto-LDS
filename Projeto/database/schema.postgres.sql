-- ============================================================
-- IFCE IVENTUS - BANCO DE DADOS POSTGRESQL (RENDER.COM)
-- Script de Criação e Configuração para PostgreSQL 14+
-- ============================================================

-- 1. Criação de Tipos ENUM (ou constraints VARCHAR)
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
    foto_perfil VARCHAR(255),
    telefone VARCHAR(20),
    materias VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabela EVENTO
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

-- 4. Tabela ATIVIDADE
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

-- 5. Tabela INSCRICAO
CREATE TABLE IF NOT EXISTS inscricao (
    id_inscricao SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE,
    id_atividade INT NOT NULL REFERENCES atividade(id_atividade) ON DELETE RESTRICT ON UPDATE CASCADE,
    data_inscricao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMADA' CHECK (status IN ('CONFIRMADA', 'CANCELADA')),
    CONSTRAINT uk_usuario_atividade UNIQUE (id_usuario, id_atividade)
);

-- 6. Tabela FREQUENCIA
CREATE TABLE IF NOT EXISTS frequencia (
    id_frequencia SERIAL PRIMARY KEY,
    id_inscricao INT NOT NULL UNIQUE REFERENCES inscricao(id_inscricao) ON DELETE RESTRICT ON UPDATE CASCADE,
    presente BOOLEAN NOT NULL DEFAULT FALSE,
    data_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Tabela CERTIFICADO
CREATE TABLE IF NOT EXISTS certificado (
    id_certificado SERIAL PRIMARY KEY,
    id_frequencia INT NOT NULL UNIQUE REFERENCES frequencia(id_frequencia) ON DELETE RESTRICT ON UPDATE CASCADE,
    codigo_validacao VARCHAR(64) NOT NULL UNIQUE,
    data_emissao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- DADOS INICIAIS (SEEDS)
-- ============================================================
INSERT INTO usuario (id_usuario, nome, email, senha_hash, matricula, perfil, status_conta)
VALUES 
(1, 'Luiz Thomas Marte Moreira', 'luiz.thomas@gmail.com', '$2b$10$w8.1fceIventusSimulatedHashPart', '123456789101112', 'PARTICIPANTE', 'ATIVO'),
(2, 'Lucas Nogueira', 'lucas.nogueira@ifce.edu.br', '$2b$10$w8.1fceIventusSimulatedHashAdm', 'ADM-2024-991', 'ADMINISTRADOR', 'ATIVO'),
(3, 'Saulo Bezerra', 'saulo_bezerra@gmail.com', '$2b$10$w8.1fceIventusSimulatedHashProf', 'DOC-8831', 'PROFESSOR', 'ATIVO')
ON CONFLICT (id_usuario) DO NOTHING;

-- Ajustar a sequência do serial após inserções com IDs manuais
SELECT setval('usuario_id_usuario_seq', COALESCE((SELECT MAX(id_usuario) FROM usuario), 1), true);
