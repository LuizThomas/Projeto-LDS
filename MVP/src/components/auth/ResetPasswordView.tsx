import React, { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { ThemeToggle } from '../common/ThemeToggle';

interface ResetPasswordViewProps {
  onGoToLogin: () => void;
  initialEmail?: string;
  resetToken?: string | null;
}

export const ResetPasswordView: React.FC<ResetPasswordViewProps> = ({
  onGoToLogin,
  initialEmail = '',
  resetToken = null,
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!resetToken && (!email.trim() || code.replace(/\D/g, '').length !== 6)) {
      setError('Informe seu e-mail e o código de 6 dígitos enviado para sua caixa de entrada.');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setError('As senhas não coincidem.');
      return;
    }
    if (novaSenha.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: resetToken || undefined,
          email: resetToken ? undefined : email.trim().toLowerCase(),
          code: resetToken ? undefined : code.replace(/\D/g, ''),
          novaSenha,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        setError(data.message || 'Não foi possível redefinir sua senha.');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        onGoToLogin();
      }, 2000);
    } catch {
      setError('Erro de conexão ao redefinir a senha.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090e1a] flex items-center justify-center p-4 relative transition-colors">
      <div className="fixed top-4 right-4 z-20">
        <ThemeToggle compact />
      </div>

      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xl p-8 sm:p-10 iv-fade-up">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-6 text-center">
          Criação da nova senha
        </h2>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-xs font-semibold border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        {success ? (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 mb-6">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Senha redefinida com sucesso! Redirecionando...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!resetToken && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    E-mail cadastrado
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

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Código de recuperação (6 dígitos)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    disabled={isLoading}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-center font-mono text-base font-bold tracking-[0.25em] text-slate-900 dark:text-white outline-none transition-all shadow-2xs"
                    required
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Nova senha
              </label>
              <input
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 dark:text-slate-100 outline-none transition-all shadow-2xs font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Confirmar nova senha
              </label>
              <input
                type="password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="••••••••"
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
                  <span>Salvando...</span>
                </>
              ) : (
                <span>Redefinir senha</span>
              )}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
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
