import React, { useState, useMemo } from 'react';
import {
  Calendar,
  MapPin,
  Heart,
  ChevronRight,
  TicketX,
  Search,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  ClipboardCheck,
} from 'lucide-react';
import { Inscricao, Evento, PerfilUsuario } from '../../types';
import { EventBanner } from '../../utils/eventImages';

interface MyRegistrationsViewProps {
  inscricoes: Inscricao[];
  eventos: Evento[];
  favoritos: number[];
  onToggleFavorito: (id_evento: number) => void;
  onOpenDetails: (evento: Evento) => void;
  onCancelarInscricao: (id_inscricao: number) => void;
  userRole?: PerfilUsuario;
  currentUserId?: number;
  onOpenAttendanceForEvent?: (eventoId: number) => void;
}

export const MyRegistrationsView: React.FC<MyRegistrationsViewProps> = ({
  inscricoes,
  eventos,
  favoritos,
  onToggleFavorito,
  onOpenDetails,
  onCancelarInscricao,
  userRole = 'PARTICIPANTE',
  currentUserId,
  onOpenAttendanceForEvent,
}) => {
  const [selectedEventId, setSelectedEventId] = useState<string>('TODOS');
  const [searchTerm, setSearchTerm] = useState('');

  const activeInscricoes = useMemo(
    () => inscricoes.filter((i) => i.status === 'CONFIRMADA'),
    [inscricoes]
  );

  // Scoped view by role without granting unauthorized permissions
  const scopedEventosForFilter = useMemo(() => {
    if (userRole === 'PROFESSOR' && currentUserId) {
      return eventos.filter((e) => e.id_organizador === currentUserId);
    }
    return eventos;
  }, [eventos, userRole, currentUserId]);

  const ownedEventIds = useMemo(() => {
    if (!currentUserId) return new Set<number>();
    return new Set(
      eventos.filter((e) => e.id_organizador === currentUserId).map((e) => e.id_evento)
    );
  }, [eventos, currentUserId]);

  const roleFilteredInscricoes = useMemo(() => {
    return activeInscricoes.filter((insc) => {
      if (userRole === 'PARTICIPANTE') {
        if (currentUserId && insc.id_usuario !== currentUserId) return false;
      } else if (userRole === 'PROFESSOR') {
        const isOwnedEvent = insc.evento_id ? ownedEventIds.has(insc.evento_id) : false;
        const isPersonal = currentUserId ? insc.id_usuario === currentUserId : false;
        if (!isOwnedEvent && !isPersonal) return false;
      }

      if (selectedEventId !== 'TODOS' && String(insc.evento_id) !== selectedEventId) {
        return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          (insc.usuario_nome || '').toLowerCase().includes(q) ||
          (insc.usuario_email || '').toLowerCase().includes(q) ||
          (insc.evento_titulo || '').toLowerCase().includes(q) ||
          (insc.usuario_matricula || '').toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [activeInscricoes, userRole, currentUserId, ownedEventIds, selectedEventId, searchTerm]);

  const renderAttendanceStatus = (presente?: boolean | null) => {
    if (presente === true) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Presente</span>
        </span>
      );
    }
    if (presente === false) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Ausente</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>Não registrada</span>
      </span>
    );
  };

  // =========================================================================
  // PARTICIPANT VIEW (Cards of Personal Registrations)
  // =========================================================================
  if (userRole === 'PARTICIPANTE') {
    return (
      <div className="space-y-5 sm:space-y-6 iv-fade-up">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
            Minhas Inscrições
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1">
            Acompanhe suas participações confirmadas nos eventos do IFCE e sua frequência registrada.
          </p>
        </div>

        {roleFilteredInscricoes.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 sm:p-12 text-center">
            <TicketX className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm sm:text-base font-semibold text-slate-700 dark:text-slate-200">
              Nenhuma inscrição ativa
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Você ainda não se inscreveu em nenhuma atividade científica. Navegue pelo catálogo para garantir sua vaga!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {roleFilteredInscricoes.map((inscricao, index) => {
              const evento =
                eventos.find((e) => e.id_evento === inscricao.evento_id) ||
                eventos.find((e) => e.titulo === inscricao.evento_titulo);
              const isFav = evento ? favoritos.includes(evento.id_evento) : false;

              return (
                <div
                  key={`reg-${inscricao.id_inscricao}-${index}`}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all hover:shadow-md flex flex-col overflow-hidden"
                >
                  <div className="relative h-40 sm:h-44 bg-slate-100 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800 overflow-hidden">
                    <EventBanner evento={evento || { titulo: inscricao.evento_titulo || '', id_evento: inscricao.evento_id || 0, modalidade: inscricao.evento_modalidade || 'Presencial' }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-slate-950/20 pointer-events-none" />

                    <span
                      className={`absolute top-3 left-3 px-2.5 py-1 rounded-md text-[11px] font-semibold shadow-xs ${
                        inscricao.evento_modalidade === 'Online'
                          ? 'bg-amber-50/95 dark:bg-amber-950/90 text-amber-800 dark:text-amber-200'
                          : 'bg-blue-50/95 dark:bg-blue-950/90 text-blue-800 dark:text-blue-200'
                      }`}
                    >
                      {inscricao.evento_modalidade || 'Presencial'}
                    </span>

                    {evento && (
                      <button
                        type="button"
                        onClick={() => onToggleFavorito(evento.id_evento)}
                        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/95 dark:bg-slate-900/90 shadow-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-red-500 transition-all cursor-pointer min-h-[32px] min-w-[32px]"
                        aria-label={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                      >
                        <Heart
                          className={`w-4 h-4 ${
                            isFav ? 'text-red-500 fill-red-500' : 'text-slate-400 dark:text-slate-300'
                          }`}
                        />
                      </button>
                    )}
                  </div>

                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3 sm:space-y-4">
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50 line-clamp-2">
                          {inscricao.evento_titulo}
                        </h2>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{inscricao.evento_data || 'Programação IFCE'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{inscricao.evento_local || 'Campus Cedro - IFCE'}</span>
                        </div>
                        <div className="pt-1 flex items-center justify-between">
                          <span className="text-slate-400 dark:text-slate-500">Frequência:</span>
                          {renderAttendanceStatus(inscricao.presente)}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      {evento && (
                        <button
                          type="button"
                          onClick={() => onOpenDetails(evento)}
                          className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 text-xs font-bold flex items-center gap-1 group/btn cursor-pointer py-1"
                        >
                          <span>Ver detalhes</span>
                          <ChevronRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onCancelarInscricao(inscricao.id_inscricao)}
                        className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline py-1 cursor-pointer min-h-[32px] flex items-center"
                      >
                        Cancelar inscrição
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // PROFESSOR & ADMINISTRADOR SHARED VIEW (Inscrições por Evento — sem fila de aprovação)
  // =========================================================================
  return (
    <div className="space-y-5 sm:space-y-6 iv-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
            Inscrições
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {userRole === 'ADMINISTRADOR'
              ? 'Visualização consolidada das inscrições confirmadas em todos os eventos da instituição.'
              : 'Acompanhe os participantes inscritos nos eventos que você coordena.'}
          </p>
        </div>

        {userRole === 'PROFESSOR' && onOpenAttendanceForEvent && (
          <button
            type="button"
            onClick={() => {
              const targetId =
                selectedEventId !== 'TODOS'
                  ? Number(selectedEventId)
                  : scopedEventosForFilter[0]?.id_evento;
              if (targetId) onOpenAttendanceForEvent(targetId);
            }}
            className="px-4 py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[42px] whitespace-nowrap"
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>Ir para Controle de Presença</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-4 flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
        <div className="relative flex-1 md:max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar participante, e-mail ou evento..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-emerald-600 text-slate-800 dark:text-slate-100 min-h-[40px]"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer min-h-[40px]"
          >
            <option value="TODOS">
              {userRole === 'PROFESSOR' ? 'Todos os meus eventos' : 'Todos os eventos'}
            </option>
            {scopedEventosForFilter.map((ev) => (
              <option key={ev.id_evento} value={String(ev.id_evento)}>
                {ev.titulo}
              </option>
            ))}
          </select>

          <span className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-300 text-center whitespace-nowrap">
            {roleFilteredInscricoes.length} inscrições
          </span>
        </div>
      </div>

      {/* Empty State */}
      {roleFilteredInscricoes.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 sm:p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm sm:text-base font-semibold text-slate-700 dark:text-slate-200">
            Nenhuma inscrição encontrada
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Não há inscrições confirmadas para os filtros selecionados.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Cards (< md) */}
          <div className="md:hidden space-y-3">
            {roleFilteredInscricoes.map((insc) => (
              <div
                key={`m-insc-staff-${insc.id_inscricao}`}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {insc.usuario_nome || 'Participante'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {insc.usuario_email || insc.usuario_matricula || 'Sem e-mail'}
                    </p>
                  </div>
                  {renderAttendanceStatus(insc.presente)}
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs space-y-1">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {insc.evento_titulo}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    Inscrito em {new Date(insc.data_inscricao).toLocaleDateString('pt-BR')}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  {userRole === 'PROFESSOR' &&
                  insc.evento_id &&
                  ownedEventIds.has(insc.evento_id) &&
                  onOpenAttendanceForEvent ? (
                    <button
                      type="button"
                      onClick={() => onOpenAttendanceForEvent(insc.evento_id!)}
                      className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Gerenciar Presença
                    </button>
                  ) : (
                    <span />
                  )}

                  {userRole === 'ADMINISTRADOR' && (
                    <button
                      type="button"
                      onClick={() => onCancelarInscricao(insc.id_inscricao)}
                      className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                    >
                      Cancelar inscrição
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table (>= md) */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3.5">Participante</th>
                    <th className="px-5 py-3.5">Evento</th>
                    <th className="px-5 py-3.5">Data Inscrição</th>
                    <th className="px-5 py-3.5">Frequência</th>
                    <th className="px-5 py-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {roleFilteredInscricoes.map((insc) => {
                    const evento = eventos.find((e) => e.id_evento === insc.evento_id);
                    const isOwned = insc.evento_id ? ownedEventIds.has(insc.evento_id) : false;

                    return (
                      <tr
                        key={`dt-insc-staff-${insc.id_inscricao}`}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                            {insc.usuario_nome || 'Participante'}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {insc.usuario_email || 'Sem e-mail'} ·{' '}
                            <span className="font-mono">{insc.usuario_matricula || 'S/M'}</span>
                          </p>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                            {insc.evento_titulo}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {insc.evento_modalidade || 'Presencial'}
                          </p>
                        </td>
                        <td className="px-5 py-3.5 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {new Date(insc.data_inscricao).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {renderAttendanceStatus(insc.presente)}
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {userRole === 'PROFESSOR' && isOwned && onOpenAttendanceForEvent && (
                              <button
                                type="button"
                                onClick={() => onOpenAttendanceForEvent(insc.evento_id!)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold cursor-pointer"
                              >
                                Presença
                              </button>
                            )}
                            {evento && (
                              <button
                                type="button"
                                onClick={() => onOpenDetails(evento)}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                              >
                                Evento
                              </button>
                            )}
                            {userRole === 'ADMINISTRADOR' && (
                              <button
                                type="button"
                                onClick={() => onCancelarInscricao(insc.id_inscricao)}
                                className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-xs font-semibold cursor-pointer"
                              >
                                Cancelar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
