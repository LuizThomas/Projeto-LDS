import React, { useState } from 'react';
import { Mail, Check, Loader2, ExternalLink, AlertCircle, ArrowRight } from 'lucide-react';
import { ThemeToggle } from '../common/ThemeToggle';

interface ForgotPasswordViewProps {
  onGoToLogin: () => void;
  onGoToResetPassword: (email?: string) => void;
}

export const ForgotPasswordView: React.FC<ForgotPasswordViewProps> = ({
  onGoToLogin,
  onGoToResetPassword,
}) => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        setError(data.message || 'Não foi possível enviar o e-mail de recuperação.');
        return;
      }

      setFeedbackMsg(data.message);
      setPreviewUrl(data.emailPreviewUrl);
      setSent(true);
    } catch {
      setError('Erro de comunicação ao solicitar recuperação de senha.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090e1a] flex items-center justify-center p-4 relative transition-colors">
      <div className="fixed top-4 right-4 z-20">
        <ThemeToggle compact />
      </div>

      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xl p-8 sm:p-10 text-center iv-fade-up">
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-6 text-slate-600 dark:text-slate-300">
          <Mail className="w-8 h-8 stroke-[1.5]" />
        </div>

        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2">
          Recuperar senha
        </h2>

        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 max-w-xs mx-auto leading-relaxed">
          Digite seu e-mail cadastrado para receber o código e o link de recuperação de senha.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-xs font-semibold border border-red-200 dark:border-red-800 flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {sent ? (
          <div className="space-y-4 mb-6 text-left">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs font-semibold flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>{feedbackMsg}</span>
            </div>

            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Abrir e-mail de recuperação (Caixa de Testes)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            <button
              type="button"
              onClick={() => onGoToResetPassword(email.trim().toLowerCase())}
              className="w-full py-3 bg-[#16a34a] hover:bg-[#15803d] text-white text-sm font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Inserir código e criar nova senha</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@ifce.edu.br"
                disabled={isLoading}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 dark:text-slate-100 outline-none transition-all shadow-2xs font-medium"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#16a34a] hover:bg-[#15803d] text-white text-sm font-bold rounded-xl shadow-xs transition-colors cursor-pointer mt-2 flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <span>Enviar código e link de recuperação</span>
              )}
            </button>
          </form>
        )}

        <div className="mt-6">
          <button
            type="button"
            onClick={onGoToLogin}
            className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
          >
            Voltar para o login
          </button>
        </div>
      </div>
    </div>
  );
};
