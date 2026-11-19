import React, { useState, useEffect } from 'react';
import { Usuario } from '../../types';
import { Logo } from '../common/Logo';
import {
  Clock,
  ArrowRight,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Mail,
  RefreshCw,
  CheckCircle2,
  GraduationCap,
  User,
  ExternalLink,
  KeyRound,
} from 'lucide-react';

interface RegisterViewProps {
  onRegisterSuccess?: (createdUser: any) => void;
  onAuthSuccess?: (user: Usuario, token: string) => void;
  onGoToLogin: () => void;
}

export const RegisterView: React.FC<RegisterViewProps> = ({
  onRegisterSuccess,
  onAuthSuccess,
  onGoToLogin,
}) => {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [perfil, setPerfil] = useState<'PARTICIPANTE' | 'PROFESSOR'>('PARTICIPANTE');
  const [matricula, setMatricula] = useState('');
  const [telefone, setTelefone] = useState('');
  const [materias, setMaterias] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [termosAceitos, setTermosAceitos] = useState(false);
  // Anti-bot honeypot field (kept hidden from real users)
  const [websiteHoneypot, setWebsiteHoneypot] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Success state after registration
  const [submittedState, setSubmittedState] = useState<{
    mode: 'student_verify_email' | 'professor_pending_admin';
    nome: string;
    email: string;
    matricula?: string | null;
    emailPreviewUrl?: string;
    emailProvider?: 'smtp' | 'resend' | 'ethereal_test';
  } | null>(null);

  // 6-digit OTP verification state
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [codeFeedback, setCodeFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [verifiedSession, setVerifiedSession] = useState<{
    user: Usuario;
    token: string;
  } | null>(null);

  // Resend cooldown timer (seconds)
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [resendFeedback, setResendFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    previewUrl?: string;
    provider?: 'smtp' | 'resend' | 'ethereal_test';
  } | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!termosAceitos) {
      setError('Você deve concordar com os Termos de Uso e Política de Privacidade.');
      return;
    }

    if (nome.trim().length < 3) {
      setError('Informe seu nome completo (mínimo 3 caracteres).');
      return;
    }

    if (perfil === 'PROFESSOR' && materias.trim().length < 3) {
      setError('Informe as disciplinas ou área de atuação para análise administrativa.');
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
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          senha,
          perfil,
          matricula: matricula.trim() || undefined,
          telefone: telefone.trim() || undefined,
          materias: perfil === 'PROFESSOR' ? materias.trim() : undefined,
          website: websiteHoneypot,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        setError(
          data?.message ||
            (response.status === 409
              ? 'Já existe um usuário cadastrado com este e-mail.'
              : 'Não foi possível concluir o cadastro. Verifique os dados informados.')
        );
        setIsSubmitting(false);
        return;
      }

      if (onRegisterSuccess && data.user) {
        onRegisterSuccess(data.user);
      }

      setSubmittedState({
        mode: data.requiresEmailVerification ? 'student_verify_email' : 'professor_pending_admin',
        nome: data.user?.nome || nome.trim(),
        email: data.user?.email || email.trim().toLowerCase(),
        matricula: data.user?.matricula,
        emailPreviewUrl: data.emailPreviewUrl,
        emailProvider: data.emailProvider,
      });

      if (data.requiresEmailVerification) {
        setResendCooldown(60);
      }
    } catch (err: any) {
      setError(
        err?.message ||
          'Erro de comunicação com o servidor. Verifique sua conexão e tente novamente.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittedState || isVerifyingCode) return;

    const cleanCode = verificationCode.replace(/\D/g, '').slice(0, 6);
    if (cleanCode.length !== 6) {
      setCodeFeedback({
        type: 'error',
        message: 'Digite os 6 dígitos do código enviado no e-mail.',
      });
      return;
    }

    setIsVerifyingCode(true);
    setCodeFeedback(null);

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: submittedState.email,
          code: cleanCode,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        setCodeFeedback({
          type: 'success',
          message: data.message || 'E-mail confirmado com sucesso!',
        });
        if (data.token && data.user) {
          setVerifiedSession({ user: data.user, token: data.token });
        }
      } else {
        setCodeFeedback({
          type: 'error',
          message: data.message || 'Código inválido ou expirado.',
        });
      }
    } catch {
      setCodeFeedback({
        type: 'error',
        message: 'Falha de comunicação ao validar o código. Tente novamente.',
      });
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleResendVerification = async () => {
    if (!submittedState || resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setResendFeedback(null);
    setCodeFeedback(null);

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: submittedState.email }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        setResendCooldown(60);
        setResendFeedback({
          type: 'success',
          message: data.message,
          previewUrl: data.emailPreviewUrl,
          provider: data.emailProvider,
        });
      } else {
        if (data.retryAfterSeconds) {
          setResendCooldown(Number(data.retryAfterSeconds));
        }
        setResendFeedback({
          type: 'error',
          message: data.message || 'Erro ao reenviar e-mail de verificação.',
        });
      }
    } catch {
      setResendFeedback({
        type: 'error',
        message: 'Falha de conexão ao tentar reenviar o e-mail.',
      });
    } finally {
      setIsResending(false);
    }
  };

  // Post-Registration Feedback Screens
  if (submittedState) {
    const isStudentFlow = submittedState.mode === 'student_verify_email';
    const activePreviewUrl = resendFeedback?.previewUrl || submittedState.emailPreviewUrl;
    const activeProvider = resendFeedback?.provider || submittedState.emailProvider;
    const isEtherealSandbox = activeProvider === 'ethereal_test' || Boolean(activePreviewUrl);

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200/90 shadow-lg p-6 sm:p-10 text-center">
          <div
            className={`mx-auto w-16 h-16 rounded-2xl border flex items-center justify-center mb-5 ${
              verifiedSession
                ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                : isStudentFlow
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}
          >
            {verifiedSession ? (
              <CheckCircle2 className="w-8 h-8" />
            ) : isStudentFlow ? (
              <Mail className="w-8 h-8" />
            ) : (
              <Clock className="w-8 h-8" />
            )}
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-2">
            {verifiedSession
              ? 'E-mail confirmado com sucesso!'
              : isStudentFlow
              ? 'Verifique seu endereço de e-mail'
              : 'Solicitação enviada para análise'}
          </h2>

          <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto mb-6">
            {verifiedSession ? (
              <>
                Sua conta de participante para{' '}
                <strong className="text-slate-900">{submittedState.email}</strong> está ativa e
                validada. Você já pode acessar os eventos do IFCE Iventus.
              </>
            ) : isStudentFlow ? (
              <>
                Geramos um <strong>código de 6 dígitos</strong> e um{' '}
                <strong>link de ativação</strong> para{' '}
                <strong className="text-slate-900">{submittedState.email}</strong>. Confirme abaixo
                ou pelo link no e-mail para liberar o acesso.
              </>
            ) : (
              <>
                Sua solicitação de cadastro como <strong>Professor</strong> foi registrada no{' '}
                <strong>IFCE Iventus</strong> e encontra-se com status <strong>Pendente</strong>{' '}
                aguardando aprovação de um administrador.
              </>
            )}
          </p>

          {/* Details Summary */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 sm:p-5 text-left text-xs space-y-2.5 mb-6">
            <div className="flex justify-between items-center gap-3 py-1 border-b border-slate-200/70">
              <span className="text-slate-500 font-medium">Nome:</span>
              <span className="font-bold text-slate-800 text-right truncate">
                {submittedState.nome}
              </span>
            </div>
            <div className="flex justify-between items-center gap-3 py-1 border-b border-slate-200/70">
              <span className="text-slate-500 font-medium">E-mail:</span>
              <span className="font-bold text-slate-800 text-right truncate">
                {submittedState.email}
              </span>
            </div>
            {submittedState.matricula && (
              <div className="flex justify-between items-center gap-3 py-1 border-b border-slate-200/70">
                <span className="text-slate-500 font-medium">Registro:</span>
                <span className="font-mono tabular-nums font-bold text-slate-700">
                  {submittedState.matricula}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center gap-3 py-1">
              <span className="text-slate-500 font-medium">Situação:</span>
              <span
                className={`font-bold ${
                  verifiedSession || isStudentFlow ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {verifiedSession
                  ? 'E-mail verificado (Conta Ativa)'
                  : isStudentFlow
                  ? 'Aguardando confirmação de e-mail'
                  : 'Pendente de aprovação'}
              </span>
            </div>
          </div>

          {/* Ethereal Sandbox Guidance */}
          {isStudentFlow && !verifiedSession && activePreviewUrl && (
            <div className="mb-5 p-4 bg-amber-50/90 border border-amber-200 rounded-2xl text-left text-xs text-amber-950 space-y-2">
              <p className="font-bold flex items-center gap-1.5 text-amber-900">
                <Mail className="w-4 h-4 text-amber-700 shrink-0" />
                {isEtherealSandbox
                  ? 'Caixa de Testes (SMTP/Resend não configurado)'
                  : 'Pré-visualização do e-mail enviado'}
              </p>
              <p className="text-[11px] leading-relaxed text-amber-900/90">
                Como este ambiente não possui credenciais SMTP reais configuradas, o e-mail não
                chega no Gmail/IFCE pessoal — ele foi entregue na caixa de testes Ethereal abaixo:
              </p>
              <a
                href={activePreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs transition-colors"
              >
                <span>Abrir e-mail enviado (ver código e link)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* 6-Digit Verification Code Input */}
          {isStudentFlow && !verifiedSession && (
            <form
              onSubmit={handleVerifyCode}
              className="mb-5 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left space-y-3"
            >
              <label
                htmlFor="otp-register-code"
                className="block text-xs font-bold text-slate-800 flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
                <span>Já recebeu o código de 6 dígitos? Confirme aqui:</span>
              </label>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="otp-register-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => {
                    setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setCodeFeedback(null);
                  }}
                  placeholder="000000"
                  disabled={isVerifyingCode}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-center font-mono text-base font-extrabold tracking-[0.35em] text-slate-900 bg-white outline-none min-h-[44px]"
                />
                <button
                  type="submit"
                  disabled={isVerifyingCode || verificationCode.length < 6}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] whitespace-nowrap"
                >
                  {isVerifyingCode ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Confirmar código</span>
                </button>
              </div>

              {codeFeedback && (
                <div
                  className={`p-2.5 rounded-xl text-xs font-semibold border ${
                    codeFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}
                >
                  {codeFeedback.message}
                </div>
              )}
            </form>
          )}

          {resendFeedback && !verifiedSession && (
            <div
              className={`mb-5 p-3 rounded-xl text-xs font-medium border text-left ${
                resendFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              {resendFeedback.message}
            </div>
          )}

          <div className="space-y-3">
            {verifiedSession && onAuthSuccess ? (
              <button
                type="button"
                onClick={() => onAuthSuccess(verifiedSession.user, verifiedSession.token)}
                className="w-full py-3 bg-[#16a34a] hover:bg-[#15803d] text-white text-sm font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 min-h-[44px]"
              >
                <span>Entrar no Sistema Agora</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                {isStudentFlow && (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendCooldown > 0 || isResending}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed min-h-[42px]"
                  >
                    {isResending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    <span>
                      {resendCooldown > 0
                        ? `Reenviar e-mail em ${resendCooldown}s`
                        : 'Reenviar código e link de verificação'}
                    </span>
                  </button>
                )}

                {!isStudentFlow && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 text-left">
                    <p className="font-semibold text-slate-800 mb-0.5 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      Próxima etapa
                    </p>
                    <p className="text-[11px] leading-relaxed">
                      Assim que um administrador aprovar seu cadastro na aba de gestão de
                      professores, você poderá fazer login e criar/gerenciar eventos.
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={onGoToLogin}
                  className="w-full py-3 bg-[#16a34a] hover:bg-[#15803d] text-white text-sm font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <span>Ir para a Tela de Login</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200/90 shadow-lg p-6 sm:p-10">
        <div className="flex items-center gap-3 mb-6">
          <Logo size="md" showText={false} />
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-tight">
              Criar sua conta
            </h1>
            <p className="text-xs text-slate-500">
              Cadastro oficial no Sistema IFCE Iventus
            </p>
          </div>
        </div>

        {/* Profile Selector Segmented Control */}
        <div className="mb-5">
          <label className="block text-xs font-bold text-slate-700 mb-2">
            Tipo de Cadastro
          </label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setPerfil('PARTICIPANTE');
                setError(null);
              }}
              className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[42px] ${
                perfil === 'PARTICIPANTE'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4 shrink-0" />
              <span>Aluno / Participante</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPerfil('PROFESSOR');
                setError(null);
              }}
              className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[42px] ${
                perfil === 'PROFESSOR'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-4 h-4 shrink-0" />
              <span>Professor</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
            {perfil === 'PARTICIPANTE'
              ? 'Alunos recebem um link de verificação por e-mail para ativação imediata da conta.'
              : 'Solicitações de professores passam por análise e aprovação de um administrador.'}
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-50 text-red-700 text-xs font-semibold border border-red-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <div className="flex-1 leading-relaxed">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Anti-bot honeypot field (invisible to real users) */}
          <div className="hidden" aria-hidden="true">
            <label htmlFor="website_hp">Website</label>
            <input
              id="website_hp"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={websiteHoneypot}
              onChange={(e) => setWebsiteHoneypot(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Nome completo
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Maria Clara Oliveira"
              disabled={isSubmitting}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 outline-none transition-all font-medium disabled:opacity-60 min-h-[42px]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {perfil === 'PROFESSOR' ? 'E-mail institucional' : 'E-mail acadêmico ou pessoal'}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={
                perfil === 'PROFESSOR' ? 'docente@ifce.edu.br' : 'aluno@aluno.ifce.edu.br'
              }
              disabled={isSubmitting}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 outline-none transition-all font-medium disabled:opacity-60 min-h-[42px]"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {perfil === 'PROFESSOR' ? 'SIAPE / Matrícula' : 'Matrícula (opcional)'}
              </label>
              <input
                type="text"
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                placeholder={perfil === 'PROFESSOR' ? 'Ex: DOC-4510' : 'Ex: 2026101234'}
                disabled={isSubmitting}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 outline-none transition-all font-medium disabled:opacity-60 min-h-[42px]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Telefone / WhatsApp
              </label>
              <input
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(88) 99999-9999"
                disabled={isSubmitting}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 outline-none transition-all font-medium disabled:opacity-60 min-h-[42px]"
              />
            </div>
          </div>

          {perfil === 'PROFESSOR' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Área de Atuação / Disciplinas Ministradas
              </label>
              <input
                type="text"
                value={materias}
                onChange={(e) => setMaterias(e.target.value)}
                placeholder="Ex: Engenharia de Software, Sistemas Distribuídos"
                disabled={isSubmitting}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 outline-none transition-all font-medium disabled:opacity-60 min-h-[42px]"
                required
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Senha (mín. 6 caracteres)
              </label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                disabled={isSubmitting}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 outline-none transition-all font-medium disabled:opacity-60 min-h-[42px]"
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
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 outline-none transition-all font-medium disabled:opacity-60 min-h-[42px]"
                required
              />
            </div>
          </div>

          <div className="flex items-start gap-2.5 pt-1">
            <input
              type="checkbox"
              id="termos"
              checked={termosAceitos}
              onChange={(e) => setTermosAceitos(e.target.checked)}
              disabled={isSubmitting}
              className="mt-1 w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer shrink-0"
            />
            <label htmlFor="termos" className="text-xs text-slate-600 leading-relaxed cursor-pointer">
              Li e concordo com os{' '}
              <span className="text-emerald-700 font-bold">Termos de Uso</span> e{' '}
              <span className="text-emerald-700 font-bold">Política de Privacidade</span> do IFCE
              Iventus.
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-[#16a34a] hover:bg-[#15803d] text-white text-sm font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed min-h-[44px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  {perfil === 'PARTICIPANTE'
                    ? 'Registrando e enviando e-mail...'
                    : 'Enviando solicitação...'}
                </span>
              </>
            ) : (
              <span>
                {perfil === 'PARTICIPANTE'
                  ? 'Cadastrar e Enviar Verificação'
                  : 'Enviar Solicitação de Professor'}
              </span>
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
