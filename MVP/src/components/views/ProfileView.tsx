import React, { useState } from 'react';
import { User, Check, AlertCircle, Camera, Loader2, Sun, Moon } from 'lucide-react';
import { Usuario } from '../../types';
import { useTheme } from '../../utils/theme';

interface ProfileViewProps {
  currentUser: Usuario;
  onUpdateProfile: (updates: Partial<Usuario>) => Promise<void> | void;
  onChangePassword?: (senhaAtual: string, novaSenha: string) => Promise<void>;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  onUpdateProfile,
  onChangePassword,
}) => {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'dados_pessoais' | 'alterar_senha' | 'aparencia'>(
    'dados_pessoais'
  );

  const [nome, setNome] = useState(currentUser.nome);
  const [email, setEmail] = useState(currentUser.email);
  const [matricula, setMatricula] = useState(currentUser.matricula || '');
  const [telefone, setTelefone] = useState(currentUser.telefone || '');
  const [materias, setMaterias] = useState(currentUser.materias || '');

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  React.useEffect(() => {
    setNome(currentUser.nome);
    setEmail(currentUser.email);
    setMatricula(currentUser.matricula || '');
    setTelefone(currentUser.telefone || '');
    setMaterias(currentUser.materias || '');
  }, [currentUser]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !email.trim()) {
      setFeedback({ type: 'error', message: 'Por favor, preencha todos os campos obrigatórios.' });
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      await onUpdateProfile({
        nome: nome.trim(),
        email: email.trim(),
        matricula: matricula.trim() || null,
        telefone: telefone.trim() || null,
        materias: currentUser.perfil === 'PROFESSOR' ? materias.trim() || null : null,
      });
      setFeedback({
        type: 'success',
        message: 'Dados pessoais atualizados com sucesso no IFCE Iventus!',
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erro ao atualizar perfil.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (file?: File) => {
    if (!file) return;
    if (file.size > 1_200_000) {
      setFeedback({ type: 'error', message: 'A imagem deve ter no máximo 1.2 MB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await onUpdateProfile({ foto_perfil: reader.result as string });
        setFeedback({ type: 'success', message: 'Foto de perfil atualizada!' });
      } catch (err: any) {
        setFeedback({ type: 'error', message: err?.message || 'Erro ao atualizar foto.' });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senhaAtual || !novaSenha || !confirmarNovaSenha) {
      setFeedback({ type: 'error', message: 'Preencha todos os campos de senha.' });
      return;
    }

    if (novaSenha !== confirmarNovaSenha) {
      setFeedback({ type: 'error', message: 'A confirmação de senha não confere.' });
      return;
    }

    if (novaSenha.length < 6) {
      setFeedback({ type: 'error', message: 'A nova senha deve ter no mínimo 6 caracteres.' });
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      if (onChangePassword) {
        await onChangePassword(senhaAtual, novaSenha);
      }
      setFeedback({ type: 'success', message: 'Senha alterada com sucesso!' });
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarNovaSenha('');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Não foi possível alterar a senha.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl iv-fade-up">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
          Configurações e Perfil
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Gerencie seus dados institucionais, segurança de acesso e tema visual da plataforma.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 pt-4 gap-4 sm:gap-8 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab('dados_pessoais');
              setFeedback(null);
            }}
            className={`pb-3.5 text-xs sm:text-sm font-semibold transition-all relative shrink-0 cursor-pointer whitespace-nowrap ${
              activeTab === 'dados_pessoais'
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Dados pessoais
            {activeTab === 'dados_pessoais' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400 rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('alterar_senha');
              setFeedback(null);
            }}
            className={`pb-3.5 text-xs sm:text-sm font-semibold transition-all relative shrink-0 cursor-pointer whitespace-nowrap ${
              activeTab === 'alterar_senha'
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Alterar senha
            {activeTab === 'alterar_senha' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400 rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('aparencia');
              setFeedback(null);
            }}
            className={`pb-3.5 text-xs sm:text-sm font-semibold transition-all relative shrink-0 cursor-pointer whitespace-nowrap ${
              activeTab === 'aparencia'
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Aparência (Tema)
            {activeTab === 'aparencia' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400 rounded-full" />
            )}
          </button>
        </div>

        {feedback && (
          <div
            className={`mx-4 sm:mx-6 mt-4 sm:mt-6 p-3 rounded-xl text-xs font-semibold flex items-center gap-2.5 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
            }`}
          >
            {feedback.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {activeTab === 'dados_pessoais' && (
          <form onSubmit={handleSaveProfile} className="p-4 sm:p-8">
            <div className="flex flex-col md:flex-row gap-6 md:gap-10">
              <div className="flex flex-col items-center shrink-0">
                <div className="w-32 h-32 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400 relative overflow-hidden group">
                  {currentUser.foto_perfil ? (
                    <img
                      src={currentUser.foto_perfil}
                      alt={currentUser.nome}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-16 h-16 stroke-[1.2]" />
                  )}
                  <label className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-white text-[11px] font-semibold">
                    <Camera className="w-5 h-5 mb-1" />
                    <span>Alterar</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(e.target.files?.[0])}
                    />
                  </label>
                </div>

                <label className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline mt-3 cursor-pointer">
                  Alterar foto
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => handlePhotoUpload(e.target.files?.[0])}
                  />
                </label>
              </div>

              <div className="flex-1 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Nome completo
                  </label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 dark:text-slate-100 outline-none transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 dark:text-slate-100 outline-none transition-all"
                    required
                  />
                </div>

                {currentUser.perfil === 'PARTICIPANTE' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Matrícula (Caso for estudante da instituição)
                    </label>
                    <input
                      type="text"
                      value={matricula}
                      onChange={(e) => setMatricula(e.target.value)}
                      placeholder="Ex: 2026101234"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 dark:text-slate-100 outline-none transition-all"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(88) 99999-9999"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 dark:text-slate-100 outline-none transition-all"
                  />
                </div>

                {currentUser.perfil === 'PROFESSOR' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Responsável por Matérias
                    </label>
                    <input
                      type="text"
                      value={materias}
                      onChange={(e) => setMaterias(e.target.value)}
                      placeholder="Ex: Engenharia de Software"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 dark:text-slate-100 outline-none transition-all"
                    />
                  </div>
                )}

                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full sm:w-auto px-6 py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer min-h-[42px] flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Salvar alterações</span>
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}

        {activeTab === 'alterar_senha' && (
          <form onSubmit={handleSavePassword} className="p-4 sm:p-8 max-w-xl mx-auto space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Senha atual
              </label>
              <input
                type="password"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 dark:text-slate-100 outline-none transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Nova senha
              </label>
              <input
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 dark:text-slate-100 outline-none transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Confirmar nova senha
              </label>
              <input
                type="password"
                value={confirmarNovaSenha}
                onChange={(e) => setConfirmarNovaSenha(e.target.value)}
                placeholder="Repita a nova senha"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 dark:text-slate-100 outline-none transition-all"
                required
              />
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer min-h-[42px] flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Alterar senha</span>
              </button>
            </div>
          </form>
        )}

        {activeTab === 'aparencia' && (
          <div className="p-4 sm:p-8 space-y-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50">
                Tema da Interface
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Escolha entre o modo claro institucional ou modo escuro de baixo contraste para uso prolongado. Sua preferência é salva automaticamente neste navegador.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                  theme === 'light'
                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <Sun className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-50">
                    Modo Claro
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Fundo claro de alta legibilidade para ambientes iluminados.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                  theme === 'dark'
                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-slate-800 text-amber-300 flex items-center justify-center shrink-0">
                  <Moon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-50">
                    Modo Escuro
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Superfícies escuras suaves para conforto visual em longas sessões.
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
