import React, { useState, useEffect } from 'react';
import { Usuario } from '../../types';
import { Logo } from '../common/Logo';
import { ThemeToggle } from '../common/ThemeToggle';
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
  const [websiteHoneypot, setWebsiteHoneypot] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [submittedState, setSubmittedState] = useState<{
    mode: 'student_verify_email' | 'professor_pending_admin';
    nome: string;
    email: string;
    matricula?: string | null;
    verificationMode?: 'simulated';
    simulatedVerification?: {
      code: string;
      token: string;
      expiresAt: string;
      notice: string;
    };
    emailPreviewUrl?: string;
    emailProvider?: 'smtp' | 'resend' | 'ethereal_test' | 'simulated';
  } | null>(null);

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

  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [resendFeedback, setResendFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    previewUrl?: string;
    provider?: 'smtp' | 'resend' | 'ethereal_test' | 'simulated';
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
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
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
        verificationMode: data.verificationMode,
        simulatedVerification: data.simulatedVerification,
        emailPreviewUrl: data.emailPreviewUrl,
        emailProvider: data.emailProvider,
      });

      if (data.requiresEmailVerification) {
        setResendCooldown(10);
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

  const handleConfirmSimulatedToken = async () => {
    if (!submittedState?.simulatedVerification?.token || isVerifyingCode) return;

    setIsVerifyingCode(true);
    setCodeFeedback(null);

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          token: submittedState.simulatedVerification.token,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        setCodeFeedback({
          type: 'success',
          message: data.message || 'E-mail verificado por simulação!',
        });
        if (data.token && data.user) {
          setVerifiedSession({ user: data.user, token: data.token });
        }
      } else {
        setCodeFeedback({
          type: 'error',
          message: data.message || 'Não foi possível concluir a verificação simulada.',
        });
      }
    } catch {
      setCodeFeedback({
        type: 'error',
        message: 'Falha de comunicação ao validar verificação simulada.',
      });
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittedState || isVerifyingCode) return;

    const cleanCode = verificationCode.replace(/\D/g, '').slice(0, 6);
    if (cleanCode.length !== 6) {
      setCodeFeedback({
        type: 'error',
        message: 'Digite os 6 dígitos do código da simulação.',
      });
      return;
    }

    setIsVerifyingCode(true);
    setCodeFeedback(null);

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          email: submittedState.email,
          code: cleanCode,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        setCodeFeedback({
          type: 'success',
          message: data.message || 'E-mail verificado por simulação!',
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
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ email: submittedState.email }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        setResendCooldown(10);
        if (data.simulatedVerification) {
          setSubmittedState((prev) =>
            prev
              ? {
                  ...prev,
                  verificationMode: 'simulated',
                  simulatedVerification: data.simulatedVerification,
                }
              : prev
          );
        }
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
          message: data.message || 'Erro ao gerar nova verificação.',
        });
      }
    } catch {
      setResendFeedback({
        type: 'error',
        message: 'Falha de conexão ao tentar gerar novo código.',
      });
    } finally {
      setIsResending(false);
    }
  };

  if (submittedState) {
    const isStudentFlow = submittedState.mode === 'student_verify_email';
    const simulatedPayload = submittedState.simulatedVerification;
    const activePreviewUrl = resendFeedback?.previewUrl || submittedState.emailPreviewUrl;

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090e1a] flex items-center justify-center p-4 sm:p-6 relative transition-colors">
        <div className="fixed top-4 right-4 z-20">
          <ThemeToggle compact />
        </div>

        <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-lg p-6 sm:p-10 text-center iv-fade-up">
          <div
            className={`mx-auto w-16 h-16 rounded-2xl border flex items-center justify-center mb-5 ${
              verifiedSession
                ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                : isStudentFlow
                ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-400'
                : 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
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

          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-50 mb-2">
            {verifiedSession
              ? 'E-mail verificado por simulação!'
              : isStudentFlow
              ? 'Verificação Simulada de E-mail'
              : 'Solicitação enviada para análise'}
          </h2>

          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-md mx-auto mb-6">
            {verifiedSession ? (
              <>
                A verificação simulada de{' '}
                <strong className="text-slate-900 dark:text-white">{submittedState.email}</strong> foi
                concluída e persistida no servidor. Seu acesso de participante está liberado!
              </>
            ) : isStudentFlow ? (
              <>
                Cadastro realizado para{' '}
                <strong className="text-slate-900 dark:text-white">{submittedState.email}</strong>.
                Não há aprovação administrativa para participantes — conclua a{' '}
                <strong>verificação simulada abaixo</strong> para liberar seu acesso.
              </>
            ) : (
              <>
                Sua solicitação de cadastro como <strong>Professor</strong> foi enviada e encontra-se{' '}
                <strong>aguardando aprovação</strong> de um administrador do IFCE Iventus.
              </>
            )}
          </p>

          <div className="bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5 text-left text-xs space-y-2.5 mb-6">
            <div className="flex justify-between items-center gap-3 py-1 border-b border-slate-200/70 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Nome:</span>
              <span className="font-bold text-slate-800 dark:text-slate-100 text-right truncate">
                {submittedState.nome}
              </span>
            </div>
            <div className="flex justify-between items-center gap-3 py-1 border-b border-slate-200/70 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400 font-medium">E-mail:</span>
              <span className="font-bold text-slate-800 dark:text-slate-100 text-right truncate">
                {submittedState.email}
              </span>
            </div>
            {submittedState.matricula && (
              <div className="flex justify-between items-center gap-3 py-1 border-b border-slate-200/70 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Registro:</span>
                <span className="font-mono tabular-nums font-bold text-slate-700 dark:text-slate-200">
                  {submittedState.matricula}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center gap-3 py-1">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Situação:</span>
              <span
                className={`font-bold ${
                  verifiedSession
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : isStudentFlow
                    ? 'text-sky-700 dark:text-sky-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {verifiedSession
                  ? 'E-mail verificado por simulação (Acesso liberado)'
                  : isStudentFlow
                  ? 'Verificação simulada pendente'
                  : 'Solicitação enviada — Aguardando aprovação'}
              </span>
            </div>
          </div>

          {isStudentFlow && !verifiedSession && simulatedPayload && (
            <div className="mb-5 p-4 bg-sky-50/90 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 rounded-2xl text-left text-xs text-sky-950 dark:text-sky-100 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold flex items-center gap-1.5 text-sky-900 dark:text-sky-200">
                  <Mail className="w-4 h-4 text-sky-700 dark:text-sky-400 shrink-0" />
                  <span>Simulação de Verificação de E-mail (Demonstração)</span>
                </p>
                <span className="px-2 py-0.5 rounded bg-sky-200/80 dark:bg-sky-900 text-sky-900 dark:text-sky-200 font-bold text-[10px] uppercase tracking-wider shrink-0">
                  Simulação
                </span>
              </div>

              <p className="text-[11px] leading-relaxed text-sky-900/90 dark:text-sky-200/90">
                {simulatedPayload.notice} Nenhum servidor externo de e-mail foi utilizado. Seu
                cadastro permanece <strong>não verificado</strong> até você confirmar abaixo:
              </p>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-sky-200 dark:border-sky-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Código simulado gerado
                  </span>
                  <span className="font-mono text-lg font-extrabold tracking-[0.25em] text-slate-900 dark:text-white">
                    {simulatedPayload.code}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleConfirmSimulatedToken}
                  disabled={isVerifyingCode}
                  className="px-4 py-2.5 rounded-xl bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60 min-h-[40px]"
                >
                  {isVerifyingCode ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Concluir Verificação Simulada</span>
                </button>
              </div>
            </div>
          )}

          {isStudentFlow && !verifiedSession && activePreviewUrl && (
            <div className="mb-5 p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl text-left text-xs">
              <a
                href={activePreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-300 underline"
              >
                <span>Abrir pré-visualização</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {isStudentFlow && !verifiedSession && (
            <form
              onSubmit={handleVerifyCode}
              className="mb-5 p-4 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl text-left space-y-3"
            >
              <label
                htmlFor="otp-register-code"
                className="block text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                <span>Ou digite o código simulado de 6 dígitos para confirmar no servidor:</span>
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
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-center font-mono text-base font-extrabold tracking-[0.35em] text-slate-900 dark:text-white bg-white dark:bg-slate-900 outline-none min-h-[44px]"
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
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                      : 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
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
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                  : 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
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
                <span>Acessar Plataforma Agora</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                {isStudentFlow && (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendCooldown > 0 || isResending}
                    className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed min-h-[42px]"
                  >
                    {isResending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    <span>
                      {resendCooldown > 0
                        ? `Gerar novo código em ${resendCooldown}s`
                        : 'Gerar novo código de verificação simulada'}
                    </span>
                  </button>
                )}

                {!isStudentFlow && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-300 text-left">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 mb-0.5 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      Próxima etapa
                    </p>
                    <p className="text-[11px] leading-relaxed">
                      Sua solicitação aparece exclusivamente para os administradores na aba Aprovação
                      e Gestão de Usuários. Somente após a aprovação seu acesso docente será liberado.
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
    <div className="min-h-screen bg-slate-50 dark:bg-[#090e1a] flex items-center justify-center p-4 sm:p-6 relative transition-colors">
      <div className="fixed top-4 right-4 z-20">
        <ThemeToggle compact />
      </div>

      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-lg p-6 sm:p-10 iv-fade-up">
        <div className="flex items-center gap-3 mb-6">
          <Logo size="md" showText={false} />
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-50 leading-tight">
              Criar sua conta
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cadastro oficial no Sistema IFCE Iventus
            </p>
          </div>
        </div>

        {/* Profile Selector Segmented Control */}
        <div className="mb-5">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
            Tipo de Cadastro
          </label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => {
                setPerfil('PARTICIPANTE');
                setError(null);
              }}
              className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[42px] ${
                perfil === 'PARTICIPANTE'
                  ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
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
                  ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <GraduationCap className="w-4 h-4 shrink-0" />
              <span>Professor</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            {perfil === 'PARTICIPANTE'
              ? 'Participantes não precisam de aprovação administrativa — após o cadastro, basta concluir a verificação simulada de e-mail.'
              : 'Solicitações de professores passam obrigatoriamente por análise e aprovação de um administrador.'}
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-xs font-semibold border border-red-200 dark:border-red-800 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
            <div className="flex-1 leading-relaxed">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Nome completo
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Maria Clara Oliveira"
              disabled={isSubmitting}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 dark:text-slate-100 outline-none transition-all font-medium disabled:opacity-60 min-h-[42px]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
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
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 dark:text-slate-100 outline-none transition-all font-medium disabled:opacity-60 min-h-[42px]"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {perfil === 'PROFESSOR' ? 'SIAPE / Matrícula' : 'Matrícula (opcional)'}
              </label>
              <input
                type="text"
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                placeholder={perfil === 'PROFESSOR' ? 'Ex: DOC-4510' : 'Ex: 2026101234'}
                disabled={isSubmitting}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 dark:text-slate-100 outline-none transition-all font-medium disabled:opacity-60 min-h-[42px]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Telefone / WhatsApp
              </label>
              <input
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(88) 99999-9999"
                disabled={isSubmitting}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 dark:text-slate-100 outline-none transition-all font-medium disabled:opacity-60 min-h-[42px]"
              />
            </div>
          </div>

          {perfil === 'PROFESSOR' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Área de Atuação / Disciplinas Ministradas
              </label>
              <input
                type="text"
                value={materias}
                onChange={(e) => setMaterias(e.target.value)}
                placeholder="Ex: Engenharia de Software, Sistemas Distribuídos"
                disabled={isSubmitting}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 dark:text-slate-100 outline-none transition-all font-medium disabled:opacity-60 min-h-[42px]"
                required
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Senha (mín. 6 caracteres)
              </label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                disabled={isSubmitting}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 dark:text-slate-100 outline-none transition-all font-medium disabled:opacity-60 min-h-[42px]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Confirmar senha
              </label>
              <input
                type="password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="••••••••"
                disabled={isSubmitting}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 dark:text-slate-100 outline-none transition-all font-medium disabled:opacity-60 min-h-[42px]"
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
              className="mt-1 w-4 h-4 rounded text-emerald-600 border-slate-300 dark:border-slate-700 focus:ring-emerald-500 cursor-pointer shrink-0"
            />
            <label
              htmlFor="termos"
              className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed cursor-pointer"
            >
              Li e concordo com os{' '}
              <span className="text-emerald-700 dark:text-emerald-400 font-bold">Termos de Uso</span>{' '}
              e{' '}
              <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                Política de Privacidade
              </span>{' '}
              do IFCE Iventus.
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
                    ? 'Registrando conta...'
                    : 'Enviando solicitação...'}
                </span>
              </>
            ) : (
              <span>
                {perfil === 'PARTICIPANTE'
                  ? 'Cadastrar e Iniciar Verificação Simulada'
                  : 'Enviar Solicitação de Professor'}
              </span>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-600 dark:text-slate-400">
          Já possui uma conta?{' '}
          <button
            type="button"
            onClick={onGoToLogin}
            disabled={isSubmitting}
            className="font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
          >
            Entrar
          </button>
        </p>
      </div>
    </div>
  );
};
