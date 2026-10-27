import React, { useState } from 'react';
import { PerfilUsuario } from '../../types';
import { Logo } from '../common/Logo';
import { Clock, ArrowRight, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';

interface RegisterViewProps {
  onRegister?: (nome: string, email: string, perfil: PerfilUsuario) => { success: boolean; message?: string };
  onRegisterSuccess?: (createdUser: any) => void;
  onGoToLogin: () => void;
}

export const RegisterView: React.FC<RegisterViewProps> = ({
  onRegister,
  onRegisterSuccess,
  onGoToLogin,
}) => {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [perfil, setPerfil] = useState<PerfilUsuario>('PARTICIPANTE');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [termosAceitos, setTermosAceitos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Success state: Waiting for administrator confirmation
  const [submittedUser, setSubmittedUser] = useState<{
    id_usuario?: number;
    nome: string;
    email: string;
    matricula?: string | null;
    perfil: PerfilUsuario;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!termosAceitos) {
      setError('Você deve concordar com os Termos de Uso e Política de Privacidade.');
      return;
    }

    if (senha.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (senha !== confirmarSenha) {
      setError('A confirmação de senha não corresponde.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Enviar requisição real para a API backend (Vercel Serverless / Express no Render)
      console.log('[RegisterView] Enviando cadastro para /api/auth/register...');
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          senha,
          perfil,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        // Log explícito no console do navegador para diagnóstico
        console.error('[RegisterView API Error Response]:', response.status, data);
        const errMsg =
          data?.message ||
          (response.status === 409
            ? 'Já existe um usuário cadastrado com este e-mail.'
            : response.status === 500
            ? 'Erro ao persistir no banco de dados Render. Verifique os logs e a variável DATABASE_URL.'
            : 'Erro ao processar o cadastro.');
        setError(errMsg);
        setIsSubmitting(false);
        return;
      }

      console.log('[RegisterView] Cadastro gravado com sucesso no PostgreSQL:', data);

      // Sucesso real gravado no PostgreSQL
      const created = data?.user || {
        nome: nome.trim(),
        email: email.trim(),
        perfil,
      };

      if (onRegisterSuccess) {
        onRegisterSuccess(created);
      } else if (onRegister) {
        // Atualiza a visualização local para refletir o usuário pendente na listagem administrativa
        onRegister(nome.trim(), email.trim(), perfil);
      }

      setSubmittedUser({
        id_usuario: created.id_usuario,
        nome: created.nome || nome.trim(),
        email: created.email || email.trim(),
        matricula: created.matricula,
        perfil,
      });
    } catch (err: any) {
      console.error('[RegisterView Fetch Exception]:', err);
      // Caso a API não esteja acessível (ex: preview sem backend ativo), tenta o store local como fallback seguro
      if (onRegister) {
        console.warn('[RegisterView] Falha de conexão de rede, recorrendo ao store local para demonstração.');
        const res = onRegister(nome.trim(), email.trim(), perfil);
        if (res.success) {
          setSubmittedUser({
            nome: nome.trim(),
            email: email.trim(),
            perfil,
          });
          setIsSubmitting(false);
          return;
        }
      }

      setError(
        err?.message ||
          'Não foi possível conectar ao servidor de cadastro. Verifique sua conexão ou se a API está online.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Screen when registration was submitted and awaits administrator confirmation
  if (submittedUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200/90 shadow-xl p-8 sm:p-10 text-center animate-in fade-in zoom-in-95 duration-200">
          {/* Institutional Icon */}
          <div className="mx-auto w-16 h-16 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center mb-6">
            <Clock className="w-8 h-8 text-amber-600 animate-pulse" />
          </div>

          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 mb-3 uppercase tracking-wider">
            Aguardando Homologação
          </span>

          <h2 className="text-2xl font-extrabold text-slate-900 mb-2">
            Cadastro Realizado com Sucesso!
          </h2>

          <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto mb-6">
            Sua solicitação de conta foi registrada no sistema do <strong>IFCE Iventus</strong>. 
            Por normas institucionais, novas contas precisam ser confirmadas por um <strong>Administrador</strong> antes de liberar o acesso.
          </p>

          {/* Registration Details Summary Card */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 text-left text-xs space-y-2.5 mb-6">
            <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Nome Completo:</span>
              <span className="font-bold text-slate-800">{submittedUser.nome}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">E-mail:</span>
              <span className="font-bold text-slate-800">{submittedUser.email}</span>
            </div>
            {submittedUser.matricula && (
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Matrícula Gerada:</span>
                <span className="font-mono font-bold text-slate-700">{submittedUser.matricula}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Perfil Solicitado:</span>
              <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                {submittedUser.perfil === 'PARTICIPANTE'
                  ? 'Participante'
                  : submittedUser.perfil === 'PROFESSOR'
                  ? 'Professor / Organizador'
                  : 'Administrador'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 font-medium">Status Atual:</span>
              <span className="font-bold text-amber-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block animate-ping" />
                Pendente de aprovação
              </span>
            </div>
          </div>

          <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-xs text-emerald-800 text-left mb-6">
            <p className="font-semibold mb-0.5 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              O que acontece agora?
            </p>
            <p className="text-[11px] text-emerald-700 leading-relaxed">
              O Administrador do campus receberá seu pedido no painel de moderação. Assim que aprovado, você poderá fazer login imediatamente com seu e-mail e senha.
            </p>
          </div>

          <button
            type="button"
            onClick={onGoToLogin}
            className="w-full py-3 bg-[#16a34a] hover:bg-[#15803d] text-white text-sm font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Ir para a Tela de Login</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200/90 shadow-xl p-8 sm:p-10">
        <div className="flex items-center gap-3 mb-4">
          <Logo size="md" showText={false} />
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 leading-tight">
              Criar sua conta
            </h2>
            <p className="text-xs text-slate-500">
              Cadastro oficial no Sistema IFCE Iventus
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-50 text-red-700 text-xs font-semibold border border-red-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <div className="flex-1 leading-relaxed">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome completo */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Nome completo
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: João da Silva Santos"
              disabled={isSubmitting}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 outline-none transition-all shadow-2xs font-medium disabled:opacity-60 disabled:bg-slate-100"
              required
            />
          </div>

          {/* E-mail */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              E-mail institucional ou pessoal
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemplo@gmail.com ou aluno@ifce.edu.br"
              disabled={isSubmitting}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 outline-none transition-all shadow-2xs font-medium disabled:opacity-60 disabled:bg-slate-100"
              required
            />
          </div>

          {/* Perfil */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Perfil de Acesso
            </label>
            <select
              value={perfil}
              onChange={(e) => setPerfil(e.target.value as PerfilUsuario)}
              disabled={isSubmitting}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 outline-none transition-all shadow-2xs font-medium bg-white disabled:opacity-60 disabled:bg-slate-100"
            >
              <option value="PARTICIPANTE">Participante / Aluno</option>
              <option value="PROFESSOR">Professor / Organizador</option>
              <option value="ADMINISTRADOR">Administrador</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              * Todos os cadastros passam por moderação prévia do Administrador antes da liberação do acesso.
            </p>
          </div>

          {/* Senha e Confirmar senha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Senha (mínimo 6 caracteres)
              </label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                disabled={isSubmitting}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 outline-none transition-all shadow-2xs font-medium disabled:opacity-60 disabled:bg-slate-100"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Confirmar senha
              </label>
              <input
                type="password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="••••••••"
                disabled={isSubmitting}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 outline-none transition-all shadow-2xs font-medium disabled:opacity-60 disabled:bg-slate-100"
                required
              />
            </div>
          </div>

          {/* Checkbox Termos de Uso */}
          <div className="flex items-start gap-2.5 pt-2">
            <input
              type="checkbox"
              id="termos"
              checked={termosAceitos}
              onChange={(e) => setTermosAceitos(e.target.checked)}
              disabled={isSubmitting}
              className="mt-1 w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer disabled:opacity-60"
            />
            <label htmlFor="termos" className="text-xs text-slate-600 leading-relaxed cursor-pointer">
              Li e concordo com os{' '}
              <span className="text-emerald-700 font-bold hover:underline">Termos de Uso</span> e{' '}
              <span className="text-emerald-700 font-bold hover:underline">
                Política de Privacidade
              </span> do IFCE Iventus.
            </label>
          </div>

          {/* Botão Cadastrar */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-[#16a34a] hover:bg-[#15803d] text-white text-sm font-bold rounded-xl shadow-xs transition-colors cursor-pointer mt-4 flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Gravando cadastro no banco de dados...</span>
              </>
            ) : (
              <span>Cadastrar Conta</span>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-600">
          Já possui uma conta?{' '}
          <button
            type="button"
            onClick={onGoToLogin}
            disabled={isSubmitting}
            className="font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
          >
            Entrar
          </button>
        </p>
      </div>
    </div>
  );
};
