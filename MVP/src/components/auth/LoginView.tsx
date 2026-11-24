import React, { useState, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  User,
  GraduationCap,
  ShieldCheck,
  Clock,
  AlertCircle,
  Mail,
  RefreshCw,
  Loader2,
  XCircle,
  ExternalLink,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { Logo } from '../common/Logo';
import { ThemeToggle } from '../common/ThemeToggle';
import { Usuario } from '../../types';

interface LoginViewProps {
  onAuthSuccess: (user: Usuario, token: string) => void;
  onGoToRegister: () => void;
  onGoToForgotPassword: () => void;
  demoMode?: boolean;
  needsAdminSetup?: boolean;
  onAdminSetupComplete?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onAuthSuccess,
  onGoToRegister,
  onGoToForgotPassword,
  demoMode = false,
  needsAdminSetup = false,
  onAdminSetupComplete,
}) => {
  const [email, setEmail] = useState(demoMode ? 'luiz.thomas@gmail.com' : '');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{
    message: string;
    code?: string;
    unverifiedEmail?: string;
  } | null>(null);

  // Initial administrator setup state
  const [adminNome, setAdminNome] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminSenha, setAdminSenha] = useState('');
  const [adminMatricula, setAdminMatricula] = useState('ADM-001');
  const [adminSetupError, setAdminSetupError] = useState<string | null>(null);
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);

  // Inline 6-digit OTP verification state
  const [otpCode, setOtpCode] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  // Resend / Simulated verification inline state
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [resendResult, setResendResult] = useState<{
    type: 'success' | 'error';
    message: string;
    verificationMode?: 'simulated';
    simulatedVerification?: {
      code: string;
      token: string;
      expiresAt: string;
      notice: string;
    };
    previewUrl?: string;
    provider?: 'smtp' | 'resend' | 'ethereal_test' | 'simulated';
  } | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const executeLogin = async (
    targetEmail: string,
    targetSenha: string,
    isDemoQuickLogin = false
  ) => {
    setErrorInfo(null);
    setResendResult(null);
    setOtpCode('');
    setOtpError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          email: targetEmail.trim().toLowerCase(),
          senha: targetSenha,
          isDemoQuickLogin,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        setErrorInfo({
          message: data.message || 'Credenciais inválidas.',
          code: data.errorCode,
          unverifiedEmail:
            data.errorCode === 'EMAIL_NOT_VERIFIED'
              ? data.email || targetEmail.trim().toLowerCase()
              : undefined,
        });
        setIsLoading(false);
        return;
      }

      onAuthSuccess(data.user, data.token);
    } catch {
      setErrorInfo({
        message: 'Não foi possível conectar ao servidor de autenticação. Tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeLogin(email, senha, false);
  };

  const handleQuickLogin = (demoEmail: string) => {
    if (!demoMode) return;
    setEmail(demoEmail);
    executeLogin(demoEmail, '', true);
  };

  const handleCreateInitialAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminSetupError(null);
    setIsCreatingAdmin(true);

    try {
      const response = await fetch('/api/auth/bootstrap-admin', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          nome: adminNome.trim(),
          email: adminEmail.trim().toLowerCase(),
          senha: adminSenha,
          matricula: adminMatricula.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        setAdminSetupError(data.message || 'Não foi possível criar o administrador inicial.');
        return;
      }

      onAdminSetupComplete?.();
      onAuthSuccess(data.user, data.token);
    } catch {
      setAdminSetupError('Erro de comunicação com o servidor ao configurar administrador.');
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  const handleConfirmOtp = async () => {
    const target = errorInfo?.unverifiedEmail;
    const cleanCode = otpCode.replace(/\D/g, '').slice(0, 6);
    if (!target || isVerifyingOtp) return;

    if (cleanCode.length !== 6) {
      setOtpError('Informe os 6 dígitos do código enviado no e-mail.');
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError(null);

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ email: target, code: cleanCode }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success && data.token && data.user) {
        onAuthSuccess(data.user, data.token);
        return;
      }

      setOtpError(data.message || 'Código inválido ou expirado.');
    } catch {
      setOtpError('Erro de conexão ao confirmar o código.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleConfirmSimulatedToken = async (token: string) => {
    if (!token || isVerifyingOtp) return;
    setIsVerifyingOtp(true);
    setOtpError(null);
    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ token }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success && data.token && data.user) {
        onAuthSuccess(data.user, data.token);
        return;
      }
      setOtpError(data.message || 'Não foi possível concluir a verificação simulada.');
    } catch {
      setOtpError('Erro de conexão ao concluir verificação simulada.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleResendEmail = async () => {
    const target = errorInfo?.unverifiedEmail;
    if (!target || resendCooldown > 0 || isResending) return;

    setIsResending(true);
    setResendResult(null);
    setOtpError(null);

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ email: target }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        setResendCooldown(10);
        setResendResult({
          type: 'success',
          message: data.message,
          verificationMode: data.verificationMode,
          simulatedVerification: data.simulatedVerification,
          previewUrl: data.emailPreviewUrl,
          provider: data.emailProvider,
        });
      } else {
        if (data.retryAfterSeconds) setResendCooldown(Number(data.retryAfterSeconds));
        setResendResult({
          type: 'error',
          message: data.message || 'Não foi possível gerar verificação simulada.',
        });
      }
    } catch {
      setResendResult({
        type: 'error',
        message: 'Erro de conexão ao gerar verificação simulada.',
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090e1a] flex items-center justify-center p-4 sm:p-6 lg:p-12 relative transition-colors">
      <div className="fixed top-4 right-4 z-20">
        <ThemeToggle compact />
      </div>

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center iv-fade-up">
        {/* Left Side: Brand Banner */}
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left space-y-5 lg:pl-6">
          <div className="p-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs inline-flex items-center justify-center">
            <Logo size="xl" showText={false} />
          </div>

          <div className="space-y-2 max-w-md">
            <h1 className="text-3xl lg:text-4xl font-extrabold text-[#15803d] dark:text-emerald-400 tracking-tight">
              IFCE Iventus
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
              Plataforma institucional de eventos científicos e acadêmicos do IFCE
            </p>
          </div>

          <div className="hidden sm:block pt-4 border-t border-slate-200/80 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            <p className="font-semibold text-slate-700 dark:text-slate-200">
              Instituto Federal de Educação, Ciência e Tecnologia do Ceará
            </p>
            <p className="mt-1 leading-relaxed">
              Inscrições em eventos, confirmação acadêmica, moderação docente e emissão de
              certificados digitais autenticados.
            </p>
          </div>
        </div>

        {/* Right Side: Initial Admin Setup OR Login Card */}
        <div className="w-full max-w-md mx-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-lg p-6 sm:p-9">
            {needsAdminSetup ? (
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-50 leading-tight">
                      Configuração Inicial
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Cadastre a primeira conta de Administrador no banco de dados.
                    </p>
                  </div>
                </div>

                {adminSetupError && (
                  <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-xs font-semibold border border-red-200 dark:border-red-800">
                    {adminSetupError}
                  </div>
                )}

                <form onSubmit={handleCreateInitialAdmin} className="space-y-3.5 mt-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nome completo do Administrador
                    </label>
                    <input
                      type="text"
                      value={adminNome}
                      onChange={(e) => setAdminNome(e.target.value)}
                      placeholder="Ex: Coordenação de TI IFCE"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 text-sm text-slate-900 dark:text-slate-100 outline-none min-h-[42px]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      E-mail institucional
                    </label>
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="admin@ifce.edu.br"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 text-sm text-slate-900 dark:text-slate-100 outline-none min-h-[42px]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Registro / SIAPE
                    </label>
                    <input
                      type="text"
                      value={adminMatricula}
                      onChange={(e) => setAdminMatricula(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 text-sm text-slate-900 dark:text-slate-100 outline-none min-h-[42px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Senha forte (mínimo 8 caracteres)
                    </label>
                    <input
                      type="password"
                      value={adminSenha}
                      onChange={(e) => setAdminSenha(e.target.value)}
                      placeholder="••••••••"
                      minLength={8}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 text-sm text-slate-900 dark:text-slate-100 outline-none min-h-[42px]"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isCreatingAdmin}
                    className="w-full py-3 bg-[#16a34a] hover:bg-[#15803d] text-white text-sm font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-70"
                  >
                    {isCreatingAdmin ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Configurando...</span>
                      </>
                    ) : (
                      <span>Criar Administrador e Entrar</span>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              <>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 mb-6">
                  Entrar na sua conta
                </h2>

                {errorInfo && (
                  <div
                    className={`mb-5 p-3.5 rounded-xl text-xs font-medium border space-y-2.5 ${
                      errorInfo.code === 'EMAIL_NOT_VERIFIED'
                        ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-950 dark:text-sky-100 border-sky-200 dark:border-sky-800'
                        : errorInfo.code === 'PROFESSOR_PENDING'
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-100 border-amber-200 dark:border-amber-800'
                        : 'bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {errorInfo.code === 'EMAIL_NOT_VERIFIED' ? (
                        <Mail className="w-4 h-4 text-sky-700 dark:text-sky-400 shrink-0 mt-0.5" />
                      ) : errorInfo.code === 'PROFESSOR_PENDING' ? (
                        <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      ) : errorInfo.code === 'ACCOUNT_REJECTED' ? (
                        <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                      )}

                      <div className="leading-relaxed">
                        <p className="font-bold mb-0.5">
                          {errorInfo.code === 'EMAIL_NOT_VERIFIED'
                            ? 'Verificação Simulada Pendente'
                            : errorInfo.code === 'PROFESSOR_PENDING'
                            ? 'Solicitação em Análise (Aguardando Aprovação)'
                            : errorInfo.code === 'ACCOUNT_REJECTED'
                            ? 'Solicitação Rejeitada'
                            : 'Acesso não autorizado'}
                        </p>
                        <p>{errorInfo.message}</p>
                      </div>
                    </div>

                    {errorInfo.unverifiedEmail && (
                      <div className="pt-2.5 border-t border-sky-200/80 dark:border-sky-800 space-y-2.5">
                        <div className="space-y-1.5">
                          <label
                            htmlFor="login-otp-code"
                            className="block text-[11px] font-bold text-sky-900 dark:text-sky-200 flex items-center gap-1"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400" />
                            <span>Confirmar com código simulado de 6 dígitos:</span>
                          </label>
                          <div className="flex gap-2">
                            <input
                              id="login-otp-code"
                              type="text"
                              inputMode="numeric"
                              maxLength={6}
                              value={otpCode}
                              onChange={(e) => {
                                setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                                setOtpError(null);
                              }}
                              placeholder="000000"
                              disabled={isVerifyingOtp}
                              className="flex-1 px-3 py-2 rounded-lg border border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-800 text-center font-mono text-sm font-extrabold tracking-[0.25em] text-slate-900 dark:text-slate-100 outline-none focus:border-sky-600 min-h-[38px]"
                            />
                            <button
                              type="button"
                              onClick={handleConfirmOtp}
                              disabled={isVerifyingOtp || otpCode.length < 6}
                              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50 min-h-[38px] whitespace-nowrap"
                            >
                              {isVerifyingOtp ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              <span>Confirmar</span>
                            </button>
                          </div>
                          {otpError && (
                            <p className="text-[11px] font-semibold text-red-700 dark:text-red-300">
                              {otpError}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={handleResendEmail}
                          disabled={resendCooldown > 0 || isResending}
                          className="w-full py-2 px-3 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 min-h-[38px]"
                        >
                          {isResending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {resendCooldown > 0
                              ? `Gerar novo código em ${resendCooldown}s`
                              : 'Gerar Verificação Simulada (Demonstração)'}
                          </span>
                        </button>

                        {resendResult && (
                          <div
                            className={`p-3 rounded-lg text-[11px] font-semibold space-y-2 ${
                              resendResult.type === 'success'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                            }`}
                          >
                            <p>{resendResult.message}</p>
                            {resendResult.simulatedVerification && (
                              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-emerald-200 dark:border-emerald-800 space-y-2 text-slate-800 dark:text-slate-100">
                                <p className="text-[10px] text-slate-600 dark:text-slate-400 font-normal">
                                  {resendResult.simulatedVerification.notice}
                                </p>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono text-sm font-extrabold tracking-[0.2em]">
                                    {resendResult.simulatedVerification.code}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={isVerifyingOtp}
                                    onClick={() =>
                                      handleConfirmSimulatedToken(
                                        resendResult.simulatedVerification!.token
                                      )
                                    }
                                    className="px-3 py-1.5 bg-[#16a34a] hover:bg-[#15803d] text-white text-[11px] font-bold rounded-lg cursor-pointer"
                                  >
                                    Concluir Simulação Agora
                                  </button>
                                </div>
                              </div>
                            )}
                            {resendResult.previewUrl && (
                              <a
                                href={resendResult.previewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-bold underline text-emerald-800 dark:text-emerald-300"
                              >
                                <span>Abrir caixa de testes</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      E-mail
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setErrorInfo(null);
                      }}
                      placeholder="exemplo@ifce.edu.br"
                      disabled={isLoading}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 dark:text-slate-100 outline-none transition-all font-medium min-h-[44px]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Senha
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={senha}
                        onChange={(e) => {
                          setSenha(e.target.value);
                          setErrorInfo(null);
                        }}
                        placeholder="••••••••"
                        disabled={isLoading}
                        className="w-full px-4 py-2.5 pr-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 dark:text-slate-100 outline-none transition-all font-medium min-h-[44px]"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        aria-label="Mostrar ou ocultar senha"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="text-right pt-0.5">
                    <button
                      type="button"
                      onClick={onGoToForgotPassword}
                      className="text-xs text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 font-medium cursor-pointer"
                    >
                      Esqueceu sua senha?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-[#16a34a] hover:bg-[#15803d] text-white text-sm font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-70"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Autenticando...</span>
                      </>
                    ) : (
                      <span>Entrar</span>
                    )}
                  </button>
                </form>

                <div className="mt-5 text-center text-xs">
                  <p className="text-slate-600 dark:text-slate-400 font-medium">
                    Não tem uma conta?{' '}
                    <button
                      type="button"
                      onClick={onGoToRegister}
                      className="font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Cadastre-se
                    </button>
                  </p>
                </div>

                {/* Quick Demo Access Bar */}
                {demoMode && (
                  <div className="mt-7 pt-5 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center mb-3">
                      Acesso Rápido (Demonstração Local)
                    </p>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleQuickLogin('luiz.thomas@gmail.com')}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 text-center text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-800 dark:hover:text-emerald-300 transition-all cursor-pointer min-h-[56px]"
                      >
                        <User className="w-4 h-4 mx-auto mb-1 text-emerald-600 dark:text-emerald-400" />
                        <span>Aluno Verificado</span>
                      </button>

                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleQuickLogin('saulo_bezerra@gmail.com')}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 text-center text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-800 dark:hover:text-emerald-300 transition-all cursor-pointer min-h-[56px]"
                      >
                        <GraduationCap className="w-4 h-4 mx-auto mb-1 text-emerald-600 dark:text-emerald-400" />
                        <span>Prof. Aprovado</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleQuickLogin('lucas.nogueira@ifce.edu.br')}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 text-center text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-800 dark:hover:text-emerald-300 transition-all cursor-pointer min-h-[56px]"
                      >
                        <ShieldCheck className="w-4 h-4 mx-auto mb-1 text-emerald-600 dark:text-emerald-400" />
                        <span>Administrador</span>
                      </button>

                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleQuickLogin('rodrigo.maia@ifce.edu.br')}
                        className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 hover:bg-amber-100/70 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800 text-center text-[11px] font-semibold text-amber-900 dark:text-amber-200 transition-all cursor-pointer min-h-[56px]"
                      >
                        <Clock className="w-4 h-4 mx-auto mb-1 text-amber-600 dark:text-amber-400" />
                        <span>Prof. Pendente</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
