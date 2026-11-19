import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Mail,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  KeyRound,
} from 'lucide-react';
import { Logo } from '../common/Logo';
import { Usuario } from '../../types';

interface VerifyEmailViewProps {
  token: string;
  onGoToLogin: () => void;
  onAuthSuccess?: (user: Usuario, token: string) => void;
}

export const VerifyEmailView: React.FC<VerifyEmailViewProps> = ({
  token,
  onGoToLogin,
  onAuthSuccess,
}) => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Validando seu link de confirmação...');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [verifiedSession, setVerifiedSession] = useState<{
    user: Usuario;
    token: string;
  } | null>(null);

  // Prevent React StrictMode double-fire for the same single-use token
  const requestedTokenRef = useRef<string | null>(null);

  // Fallback resend + OTP code when link expired or invalid
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<{
    type: 'success' | 'error';
    text: string;
    previewUrl?: string;
  } | null>(null);

  const [otpCode, setOtpCode] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || requestedTokenRef.current === token) return;
    requestedTokenRef.current = token;

    let cancelled = false;

    async function runVerification() {
      setStatus('loading');
      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await response.json().catch(() => ({}));
        if (cancelled) return;

        if (response.ok && data.success) {
          setStatus('success');
          setMessage(data.message || 'E-mail confirmado com sucesso!');
          setVerifiedEmail(data.user?.email || null);
          if (data.token && data.user) {
            setVerifiedSession({ user: data.user, token: data.token });
          }
        } else {
          setStatus('error');
          setErrorCode(data.errorCode || null);
          setMessage(data.message || 'Não foi possível validar este link de verificação.');
        }
      } catch {
        if (cancelled) return;
        setStatus('error');
        setMessage('Erro de conexão ao tentar verificar seu e-mail. Tente novamente.');
      }
    }

    runVerification();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;
    setResending(true);
    setResendMessage(null);
    setCodeError(null);

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail.trim().toLowerCase() }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        setResendMessage({
          type: 'success',
          text: data.message,
          previewUrl: data.emailPreviewUrl,
        });
      } else {
        setResendMessage({
          type: 'error',
          text: data.message || 'Não foi possível reenviar o e-mail.',
        });
      }
    } catch {
      setResendMessage({
        type: 'error',
        text: 'Erro de comunicação ao solicitar novo link.',
      });
    } finally {
      setResending(false);
    }
  };

  const handleVerifyWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = resendEmail.trim().toLowerCase();
    const cleanCode = otpCode.replace(/\D/g, '').slice(0, 6);
    if (!cleanEmail || cleanCode.length !== 6) {
      setCodeError('Informe seu e-mail e o código de 6 dígitos.');
      return;
    }

    setVerifyingCode(true);
    setCodeError(null);

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, code: cleanCode }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        setStatus('success');
        setMessage(data.message || 'E-mail confirmado com sucesso!');
        setVerifiedEmail(data.user?.email || cleanEmail);
        if (data.token && data.user) {
          setVerifiedSession({ user: data.user, token: data.token });
        }
      } else {
        setCodeError(data.message || 'Código inválido ou expirado.');
      }
    } catch {
      setCodeError('Falha de conexão ao validar o código.');
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleEnterAccount = () => {
    if (verifiedSession && onAuthSuccess) {
      onAuthSuccess(verifiedSession.user, verifiedSession.token);
    } else {
      onGoToLogin();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-lg p-6 sm:p-10 text-center">
        <div className="flex justify-center mb-6">
          <Logo size="md" showText={false} />
        </div>

        {status === 'loading' && (
          <div className="space-y-4 py-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-700">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Verificando seu e-mail</h1>
            <p className="text-sm text-slate-600">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                E-mail Verificado!
              </h1>
              {verifiedEmail && (
                <p className="text-xs font-semibold text-emerald-700 mt-1">{verifiedEmail}</p>
              )}
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">{message}</p>
            </div>

            <button
              type="button"
              onClick={handleEnterAccount}
              className="w-full py-3 bg-[#16a34a] hover:bg-[#15803d] text-white text-sm font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 min-h-[44px]"
            >
              <span>Acessar minha conta</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-5">
            <div
              className={`w-16 h-16 rounded-2xl border flex items-center justify-center mx-auto ${
                errorCode === 'TOKEN_ALREADY_USED'
                  ? 'bg-amber-50 border-amber-200 text-amber-600'
                  : 'bg-red-50 border-red-200 text-red-600'
              }`}
            >
              {errorCode === 'TOKEN_ALREADY_USED' ? (
                <AlertTriangle className="w-8 h-8" />
              ) : (
                <XCircle className="w-8 h-8" />
              )}
            </div>

            <div>
              <h1 className="text-xl font-extrabold text-slate-900">
                {errorCode === 'TOKEN_ALREADY_USED'
                  ? 'Link já utilizado'
                  : errorCode === 'TOKEN_EXPIRED'
                  ? 'Link expirado'
                  : 'Não foi possível verificar'}
              </h1>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">{message}</p>
            </div>

            {errorCode !== 'TOKEN_ALREADY_USED' && (
              <div className="pt-4 border-t border-slate-100 text-left space-y-4">
                <form onSubmit={handleResend} className="space-y-2.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Solicitar novo link e código de verificação:
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="email"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      placeholder="seu-email@aluno.ifce.edu.br"
                      required
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-600 text-xs text-slate-800 outline-none min-h-[42px]"
                    />
                    <button
                      type="submit"
                      disabled={resending}
                      className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 min-h-[42px] whitespace-nowrap"
                    >
                      {resending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>Reenviar</span>
                    </button>
                  </div>

                  {resendMessage && (
                    <div
                      className={`p-3 rounded-xl text-xs font-medium border ${
                        resendMessage.type === 'success'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}
                    >
                      <p>{resendMessage.text}</p>
                      {resendMessage.previewUrl && (
                        <a
                          href={resendMessage.previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-1.5 font-bold underline text-emerald-900"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>Abrir e-mail de verificação (Teste)</span>
                        </a>
                      )}
                    </div>
                  )}
                </form>

                {resendEmail.trim() && (
                  <form
                    onSubmit={handleVerifyWithCode}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2"
                  >
                    <label className="block text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Ou digite o código de 6 dígitos recebido:</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => {
                          setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                          setCodeError(null);
                        }}
                        placeholder="000000"
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-300 bg-white text-center font-mono text-sm font-bold tracking-[0.25em] outline-none min-h-[38px]"
                      />
                      <button
                        type="submit"
                        disabled={verifyingCode || otpCode.length < 6}
                        className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg disabled:opacity-50 cursor-pointer min-h-[38px]"
                      >
                        {verifyingCode ? 'Validando...' : 'Confirmar'}
                      </button>
                    </div>
                    {codeError && (
                      <p className="text-[11px] font-semibold text-red-700">{codeError}</p>
                    )}
                  </form>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={onGoToLogin}
              className="w-full py-3 bg-[#16a34a] hover:bg-[#15803d] text-white text-sm font-bold rounded-xl shadow-xs transition-colors cursor-pointer min-h-[44px]"
            >
              Ir para o Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
