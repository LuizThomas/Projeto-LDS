import React, { useState, useEffect } from 'react';
import { Usuario, PerfilUsuario, StatusConta } from '../../types';
import {
  Users,
  Clock,
  Check,
  X,
  ShieldCheck,
  GraduationCap,
  User,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  Mail,
  Phone,
  BookOpen,
  Calendar,
  Hash,
  Loader2,
  MailCheck,
  MailWarning,
} from 'lucide-react';

interface AdminUsersViewProps {
  usuarios: Usuario[];
  authToken: string | null;
  onProfessorDecision: (
    id_usuario: number,
    decisao: 'APROVAR' | 'RECUSAR',
    motivo?: string
  ) => Promise<void>;
  onUpdateUserStatus: (id_usuario: number, status: StatusConta) => Promise<void>;
  onRefreshFromServer?: () => Promise<void>;
}

export const AdminUsersView: React.FC<AdminUsersViewProps> = ({
  usuarios,
  authToken,
  onProfessorDecision,
  onUpdateUserStatus,
  onRefreshFromServer,
}) => {
  const [sectionTab, setSectionTab] = useState<'professores' | 'geral'>('professores');
  const [profFilter, setProfFilter] = useState<'PENDENTE' | 'ATIVO' | 'RECUSADO' | 'TODOS'>('PENDENTE');
  const [profSearch, setProfSearch] = useState('');

  const [generalSearch, setGeneralSearch] = useState('');
  const [generalRoleFilter, setGeneralRoleFilter] = useState<string>('TODOS');
  const [generalStatusFilter, setGeneralStatusFilter] = useState<'TODOS' | StatusConta>('TODOS');

  const [selectedProfessor, setSelectedProfessor] = useState<Usuario | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessingId, setIsProcessingId] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [feedback, setFeedback] = useState<{
    message: string;
    type: 'success' | 'danger';
  } | null>(null);

  useEffect(() => {
    if (onRefreshFromServer) {
      setIsRefreshing(true);
      onRefreshFromServer().finally(() => setIsRefreshing(false));
    }
  }, [authToken]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedProfessor) setSelectedProfessor(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedProfessor]);

  // Exclusive list of Professor accounts for the Approval area
  const allProfessors = usuarios.filter((u) => u.perfil === 'PROFESSOR');
  const pendingProfessorsCount = allProfessors.filter((u) => u.status_conta === 'PENDENTE').length;
  const approvedProfessorsCount = allProfessors.filter(
    (u) => u.status_conta === 'ATIVO' || !u.status_conta
  ).length;
  const rejectedProfessorsCount = allProfessors.filter((u) => u.status_conta === 'RECUSADO').length;

  const filteredProfessors = allProfessors.filter((prof) => {
    const status = prof.status_conta || 'ATIVO';
    if (profFilter !== 'TODOS' && status !== profFilter) return false;
    if (profSearch.trim()) {
      const q = profSearch.toLowerCase();
      return (
        prof.nome.toLowerCase().includes(q) ||
        prof.email.toLowerCase().includes(q) ||
        (prof.materias && prof.materias.toLowerCase().includes(q)) ||
        (prof.matricula && prof.matricula.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // General user directory
  const filteredGeneralUsers = usuarios.filter((u) => {
    const status = u.status_conta || 'ATIVO';
    if (generalStatusFilter !== 'TODOS' && status !== generalStatusFilter) return false;
    if (generalRoleFilter !== 'TODOS' && u.perfil !== generalRoleFilter) return false;
    if (generalSearch.trim()) {
      const q = generalSearch.toLowerCase();
      return (
        u.nome.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.matricula && u.matricula.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleProfessorAction = async (
    prof: Usuario,
    decisao: 'APROVAR' | 'RECUSAR',
    motivo?: string
  ) => {
    setIsProcessingId(prof.id_usuario);
    try {
      await onProfessorDecision(prof.id_usuario, decisao, motivo);
      setFeedback({
        message:
          decisao === 'APROVAR'
            ? `Professor "${prof.nome}" aprovado e liberado para criar eventos.`
            : `Solicitação de "${prof.nome}" foi rejeitada.`,
        type: decisao === 'APROVAR' ? 'success' : 'danger',
      });
      setSelectedProfessor(null);
      setRejectionReason('');
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      setFeedback({
        message: err?.message || 'Erro ao registrar decisão administrativa.',
        type: 'danger',
      });
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleGeneralStatusChange = async (user: Usuario, status: StatusConta) => {
    setIsProcessingId(user.id_usuario);
    try {
      await onUpdateUserStatus(user.id_usuario, status);
      setFeedback({
        message: `Status de "${user.nome}" atualizado com sucesso.`,
        type: status === 'ATIVO' ? 'success' : 'danger',
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({
        message: err?.message || 'Erro ao atualizar status do usuário.',
        type: 'danger',
      });
    } finally {
      setIsProcessingId(null);
    }
  };

  const renderProfessorStatus = (status?: StatusConta) => {
    const st = status || 'ATIVO';
    if (st === 'PENDENTE') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
          <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>Pendente</span>
        </span>
      );
    }
    if (st === 'ATIVO') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Aprovado</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400">
        <XCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
        <span>Rejeitado</span>
      </span>
    );
  };

  const renderRoleText = (perfil: PerfilUsuario) => {
    switch (perfil) {
      case 'ADMINISTRADOR':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span>Administrador</span>
          </span>
        );
      case 'PROFESSOR':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
            <GraduationCap className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400 shrink-0" />
            <span>Professor</span>
          </span>
        );
      case 'PARTICIPANTE':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <User className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
            <span>Aluno / Participante</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 iv-fade-up">
      {/* Header + Segmented Section Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
            Aprovação e Gestão de Usuários
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Aprovação administrativa exclusiva para solicitações de professores e gerenciamento geral de contas.
          </p>
        </div>

        {/* Sub-view Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 self-start lg:self-auto w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setSectionTab('professores')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 min-h-[38px] ${
              sectionTab === 'professores'
                ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <GraduationCap className="w-4 h-4 shrink-0" />
            <span>Solicitações de Professores</span>
            {pendingProfessorsCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold tabular-nums bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 rounded">
                {pendingProfessorsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSectionTab('geral')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 min-h-[38px] ${
              sectionTab === 'geral'
                ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>Base de Usuários ({usuarios.length})</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold border flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* SECTION 1: EXCLUSIVE PROFESSOR APPROVAL REQUESTS */}
      {sectionTab === 'professores' && (
        <div className="space-y-4">
          {/* KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setProfFilter('PENDENTE')}
              className={`text-left p-4 rounded-2xl border transition-colors cursor-pointer ${
                profFilter === 'PENDENTE'
                  ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700'
                  : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-amber-200 dark:hover:border-amber-800'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Pendentes</span>
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1.5 tabular-nums">
                {pendingProfessorsCount}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                Aguardando decisão
              </p>
            </button>

            <button
              type="button"
              onClick={() => setProfFilter('ATIVO')}
              className={`text-left p-4 rounded-2xl border transition-colors cursor-pointer ${
                profFilter === 'ATIVO'
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700'
                  : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-800'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Aprovados</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1.5 tabular-nums">
                {approvedProfessorsCount}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                Docentes ativos
              </p>
            </button>

            <button
              type="button"
              onClick={() => setProfFilter('RECUSADO')}
              className={`text-left p-4 rounded-2xl border transition-colors cursor-pointer ${
                profFilter === 'RECUSADO'
                  ? 'bg-red-50/70 dark:bg-red-950/40 border-red-300 dark:border-red-700'
                  : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-red-200 dark:hover:border-red-800'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Rejeitados</span>
                <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-2xl font-bold text-red-700 dark:text-red-400 mt-1.5 tabular-nums">
                {rejectedProfessorsCount}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                Solicitações negadas
              </p>
            </button>

            <button
              type="button"
              onClick={() => setProfFilter('TODOS')}
              className={`text-left p-4 rounded-2xl border transition-colors cursor-pointer ${
                profFilter === 'TODOS'
                  ? 'bg-slate-100 dark:bg-slate-800 border-slate-400 dark:border-slate-600'
                  : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Total Docentes</span>
                <GraduationCap className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 mt-1.5 tabular-nums">
                {allProfessors.length}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                Todas as solicitações
              </p>
            </button>
          </div>

          {/* Filter & Search Toolbar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3 sm:p-4 flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto">
              {(
                [
                  { id: 'PENDENTE', label: `Pendentes (${pendingProfessorsCount})` },
                  { id: 'ATIVO', label: `Aprovados (${approvedProfessorsCount})` },
                  { id: 'RECUSADO', label: `Rejeitados (${rejectedProfessorsCount})` },
                  { id: 'TODOS', label: `Todos (${allProfessors.length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setProfFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap min-h-[34px] ${
                    profFilter === tab.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={profSearch}
                onChange={(e) => setProfSearch(e.target.value)}
                placeholder="Buscar professor ou área..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-emerald-600 text-slate-800 dark:text-slate-100 min-h-[38px]"
              />
            </div>
          </div>

          {/* Mobile Cards (< md) */}
          <div className="md:hidden space-y-3">
            {isRefreshing && filteredProfessors.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500 dark:text-slate-400 text-xs flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600 dark:text-emerald-400" />
                <span>Carregando solicitações de professores...</span>
              </div>
            ) : filteredProfessors.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-slate-500 dark:text-slate-400">
                <GraduationCap className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
                  Nenhuma solicitação encontrada
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Não há solicitações de professores para o filtro selecionado.
                </p>
              </div>
            ) : (
              filteredProfessors.map((prof) => {
                const status = prof.status_conta || 'ATIVO';
                const busy = isProcessingId === prof.id_usuario;

                return (
                  <div
                    key={`m-prof-${prof.id_usuario}`}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 dark:text-slate-50 text-sm truncate">
                          {prof.nome}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {prof.email}
                        </p>
                      </div>
                      {renderProfessorStatus(status)}
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400 dark:text-slate-500">Área / Matérias:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200 text-right truncate max-w-[180px]">
                          {prof.materias || 'Não informado'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400 dark:text-slate-500">Enviado em:</span>
                        <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                          {new Date(prof.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProfessor(prof);
                          setRejectionReason(prof.motivo_decisao || '');
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px]"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver detalhes do cadastro</span>
                      </button>

                      {status === 'PENDENTE' && (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleProfessorAction(prof, 'APROVAR')}
                            className="py-2 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer min-h-[42px] disabled:opacity-60"
                          >
                            <Check className="w-4 h-4" />
                            <span>Aprovar</span>
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setSelectedProfessor(prof);
                              setRejectionReason('');
                            }}
                            className="py-2 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer min-h-[42px] disabled:opacity-60"
                          >
                            <X className="w-4 h-4" />
                            <span>Rejeitar</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table (>= md) */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3.5">Professor</th>
                    <th className="px-5 py-3.5">Área / Disciplinas</th>
                    <th className="px-5 py-3.5">Data de Envio</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredProfessors.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-10 text-center text-xs text-slate-500 dark:text-slate-400"
                      >
                        Nenhuma solicitação de professor encontrada para o filtro selecionado.
                      </td>
                    </tr>
                  ) : (
                    filteredProfessors.map((prof) => {
                      const status = prof.status_conta || 'ATIVO';
                      const busy = isProcessingId === prof.id_usuario;

                      return (
                        <tr
                          key={`dt-prof-${prof.id_usuario}`}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                        >
                          <td className="px-5 py-3.5">
                            <p className="font-bold text-slate-900 dark:text-slate-50 text-sm">
                              {prof.nome}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {prof.email} · {prof.matricula || 'Sem registro'}
                            </p>
                          </td>
                          <td className="px-5 py-3.5 text-xs text-slate-700 dark:text-slate-300 max-w-[220px] truncate">
                            {prof.materias || 'Não informado'}
                          </td>
                          <td className="px-5 py-3.5 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {new Date(prof.created_at).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {renderProfessorStatus(status)}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedProfessor(prof);
                                  setRejectionReason(prof.motivo_decisao || '');
                                }}
                                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Detalhes</span>
                              </button>

                              {status === 'PENDENTE' && (
                                <>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => handleProfessorAction(prof, 'APROVAR')}
                                    className="px-3 py-1.5 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer whitespace-nowrap disabled:opacity-60"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Aprovar</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                      setSelectedProfessor(prof);
                                      setRejectionReason('');
                                    }}
                                    className="px-3 py-1.5 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer whitespace-nowrap disabled:opacity-60"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    <span>Rejeitar</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: GENERAL USERS DIRECTORY */}
      {sectionTab === 'geral' && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-slate-100/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Somente <strong>professores</strong> passam pela fila de aprovação administrativa.{' '}
              <strong>Participantes</strong> são ativados diretamente após concluírem a verificação
              simulada de e-mail, sem gerar solicitações pendentes aqui.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3 sm:p-4 flex flex-col sm:flex-row gap-2.5 justify-between items-stretch sm:items-center">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={generalSearch}
                onChange={(e) => setGeneralSearch(e.target.value)}
                placeholder="Buscar por nome, e-mail ou matrícula..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-emerald-600 text-slate-800 dark:text-slate-100 min-h-[38px]"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={generalRoleFilter}
                onChange={(e) => setGeneralRoleFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium text-slate-700 dark:text-slate-200 cursor-pointer min-h-[38px]"
              >
                <option value="TODOS">Todos os perfis</option>
                <option value="PARTICIPANTE">Alunos / Participantes</option>
                <option value="PROFESSOR">Professores</option>
                <option value="ADMINISTRADOR">Administradores</option>
              </select>

              <select
                value={generalStatusFilter}
                onChange={(e) => setGeneralStatusFilter(e.target.value as any)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium text-slate-700 dark:text-slate-200 cursor-pointer min-h-[38px]"
              >
                <option value="TODOS">Todos os status</option>
                <option value="ATIVO">Ativos</option>
                <option value="RECUSADO">Rejeitados / Suspensos</option>
              </select>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredGeneralUsers.map((user) => {
              const status = user.status_conta || 'ATIVO';
              return (
                <div
                  key={`m-gen-user-${user.id_usuario}`}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 dark:text-slate-50 text-sm truncate">
                        {user.nome}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {user.email}
                      </p>
                    </div>
                    {renderProfessorStatus(status)}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                    {renderRoleText(user.perfil)}
                    {user.perfil === 'PARTICIPANTE' && (
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                          user.email_verificado
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-sky-700 dark:text-sky-400'
                        }`}
                      >
                        {user.email_verificado ? (
                          <>
                            <MailCheck className="w-3.5 h-3.5" />
                            <span>Verificado (Simulação)</span>
                          </>
                        ) : (
                          <>
                            <MailWarning className="w-3.5 h-3.5" />
                            <span>Simulação pendente</span>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3.5">Usuário</th>
                    <th className="px-5 py-3.5">Perfil</th>
                    <th className="px-5 py-3.5">Verificação</th>
                    <th className="px-5 py-3.5">Cadastro</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Governança</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredGeneralUsers.map((user) => {
                    const status = user.status_conta || 'ATIVO';
                    const busy = isProcessingId === user.id_usuario;
                    return (
                      <tr
                        key={`dt-gen-user-${user.id_usuario}`}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-5 py-3.5">
                          <p className="font-bold text-slate-900 dark:text-slate-50 text-sm">
                            {user.nome}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {user.email} · {user.matricula || 'S/N'}
                          </p>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {renderRoleText(user.perfil)}
                        </td>
                        <td className="px-5 py-3.5 text-xs whitespace-nowrap">
                          {user.email_verificado !== false ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                              <MailCheck className="w-3.5 h-3.5" />
                              <span>
                                {user.perfil === 'PARTICIPANTE'
                                  ? 'Verificado (Simulação)'
                                  : 'Verificado'}
                              </span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-400 font-medium">
                              <MailWarning className="w-3.5 h-3.5" />
                              <span>Simulação pendente</span>
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {new Date(user.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {renderProfessorStatus(status)}
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          {user.perfil !== 'ADMINISTRADOR' && (
                            <>
                              {status === 'ATIVO' ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handleGeneralStatusChange(user, 'RECUSADO')}
                                  className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-400 cursor-pointer"
                                >
                                  Suspender
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handleGeneralStatusChange(user, 'ATIVO')}
                                  className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                                >
                                  Reativar conta
                                </button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PROFESSOR DETAILS & APPROVAL / REJECTION */}
      {selectedProfessor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-5 my-auto iv-modal-in">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                  Avaliação de Solicitação Docente
                </p>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">
                  {selectedProfessor.nome}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProfessor(null)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                aria-label="Fechar detalhes"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-slate-500 dark:text-slate-400">E-mail:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {selectedProfessor.email}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <Hash className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-slate-500 dark:text-slate-400">SIAPE / Matrícula:</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {selectedProfessor.matricula || 'Não informado'}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-slate-500 dark:text-slate-400">Telefone:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {selectedProfessor.telefone || 'Não informado'}
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <BookOpen className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">
                    Área / Disciplinas Ministradas:
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {selectedProfessor.materias || 'Não informado'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-700">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-slate-500 dark:text-slate-400">Data da solicitação:</span>
                <span className="font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                  {new Date(selectedProfessor.created_at).toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">Situação atual:</span>
                {renderProfessorStatus(selectedProfessor.status_conta)}
              </div>
            </div>

            {selectedProfessor.status_conta === 'PENDENTE' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Observação / Motivo (obrigatório apenas se rejeitar)
                  </label>
                  <textarea
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Ex: Documentação institucional não localizada ou vínculo docente não confirmado..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 text-xs text-slate-800 dark:text-slate-100 outline-none resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={isProcessingId === selectedProfessor.id_usuario}
                    onClick={() =>
                      handleProfessorAction(selectedProfessor, 'RECUSAR', rejectionReason)
                    }
                    className="py-2.5 px-4 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer min-h-[42px]"
                  >
                    <X className="w-4 h-4" />
                    <span>Rejeitar Solicitação</span>
                  </button>
                  <button
                    type="button"
                    disabled={isProcessingId === selectedProfessor.id_usuario}
                    onClick={() => handleProfessorAction(selectedProfessor, 'APROVAR')}
                    className="py-2.5 px-4 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer min-h-[42px]"
                  >
                    <Check className="w-4 h-4" />
                    <span>Aprovar Professor</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
                {selectedProfessor.motivo_decisao && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                    Motivo registrado: {selectedProfessor.motivo_decisao}
                  </p>
                )}
                <div className="flex gap-2 ml-auto">
                  {selectedProfessor.status_conta === 'RECUSADO' && (
                    <button
                      type="button"
                      onClick={() => handleProfessorAction(selectedProfessor, 'APROVAR')}
                      className="px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold rounded-xl cursor-pointer min-h-[40px]"
                    >
                      Reavaliar e Aprovar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedProfessor(null)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl cursor-pointer min-h-[40px]"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
