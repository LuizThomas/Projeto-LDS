import React, { useState } from 'react';
import { Plus, Eye, Edit2, Users } from 'lucide-react';
import { Evento, PerfilUsuario, StatusEvento } from '../../types';
import { EventBanner } from '../../utils/eventImages';

interface ProfessorEventsViewProps {
  eventos: Evento[];
  userRole?: PerfilUsuario;
  currentUserId?: number;
  onOpenCreateModal: () => void;
  onOpenEditModal: (evento: Evento) => void;
  onOpenDetailsModal: (evento: Evento) => void;
  onOpenAttendanceForEvent?: (eventoId: number) => void;
}

export const ProfessorEventsView: React.FC<ProfessorEventsViewProps> = ({
  eventos,
  userRole = 'PROFESSOR',
  currentUserId,
  onOpenCreateModal,
  onOpenEditModal,
  onOpenDetailsModal,
  onOpenAttendanceForEvent,
}) => {
  const [activeTab, setActiveTab] = useState<
    'Publicados' | 'Ativos' | 'Encerrados' | 'Cancelados' | 'Rascunhos'
  >('Publicados');

  const roleEventos =
    userRole === 'PROFESSOR' && currentUserId
      ? eventos.filter((e) => e.id_organizador === currentUserId)
      : eventos;

  const filteredEventos = roleEventos.filter((e) => {
    switch (activeTab) {
      case 'Publicados':
      case 'Ativos':
        return e.status === 'PUBLICADO';
      case 'Encerrados':
        return e.status === 'ENCERRADO';
      case 'Cancelados':
        return e.status === 'CANCELADO';
      case 'Rascunhos':
        return e.status === 'RASCUNHO';
    }
  });

  const getStatusBadge = (status: StatusEvento) => {
    switch (status) {
      case 'PUBLICADO':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60">
            Ativo
          </span>
        );
      case 'ENCERRADO':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60">
            Encerrado
          </span>
        );
      case 'CANCELADO':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/60">
            Cancelado
          </span>
        );
      case 'RASCUNHO':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
            Rascunho
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 iv-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
            {userRole === 'ADMINISTRADOR' ? 'Gerenciar Eventos' : 'Meus Eventos'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1">
            {userRole === 'ADMINISTRADOR'
              ? 'Gerenciamento global do ciclo de vida, edição e supervisão de eventos científicos.'
              : 'Gerencie os eventos sob sua coordenação, edite programações e acesse a lista de inscritos.'}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenCreateModal}
          className="w-full sm:w-auto justify-center px-5 py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white text-sm font-semibold rounded-xl flex items-center gap-2 shadow-xs transition-colors cursor-pointer min-h-[44px] whitespace-nowrap"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Criar Evento</span>
        </button>
      </div>

      {/* Tabs with horizontal scroll on mobile */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto gap-2 sm:gap-6 -mx-1 px-1">
        {(['Publicados', 'Ativos', 'Encerrados', 'Cancelados', 'Rascunhos'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`pb-3 px-2.5 text-xs sm:text-sm font-semibold transition-all relative whitespace-nowrap cursor-pointer shrink-0 min-h-[40px] ${
              activeTab === tab
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {tab}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400 rounded-full" />
            )}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {/* Mobile View */}
        <div className="sm:hidden space-y-3">
          {filteredEventos.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center text-slate-400">
              <p className="font-semibold text-slate-600 dark:text-slate-300 text-xs">
                Nenhum evento com status "{activeTab}" encontrado.
              </p>
            </div>
          ) : (
            filteredEventos.map((evento, index) => (
              <div
                key={`m-prof-evt-${evento.id_evento}-${index}`}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-16 h-14 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shrink-0 overflow-hidden">
                    <EventBanner evento={evento} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-900 dark:text-slate-50 text-sm leading-snug line-clamp-2">
                      {evento.titulo}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {evento.data_formatada || evento.data_inicio}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {getStatusBadge(evento.status)}
                      <span className="text-[11px] font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                        {String(evento.inscritos_count || 0)} inscritos
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenDetailsModal(evento)}
                    className="flex-1 justify-center px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[40px]"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Detalhes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenEditModal(evento)}
                    className="flex-1 justify-center px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[40px]"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>
                  {userRole === 'PROFESSOR' && onOpenAttendanceForEvent && (
                    <button
                      type="button"
                      onClick={() => onOpenAttendanceForEvent(evento.id_evento)}
                      className="w-full justify-center px-3 py-2 rounded-xl bg-slate-900 dark:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[40px]"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Inscritos e Presença</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View */}
        <div className="hidden sm:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-4">Evento</th>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Inscritos</th>
                  <th className="px-6 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredEventos.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-10 text-center text-xs text-slate-400 dark:text-slate-500"
                    >
                      Nenhum evento com status "{activeTab}" encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredEventos.map((evento, index) => (
                    <tr
                      key={`prof-evt-${evento.id_evento}-${index}`}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-12 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shrink-0 overflow-hidden">
                            <EventBanner evento={evento} />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-slate-50 text-sm">
                              {evento.titulo}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {evento.local}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {evento.data_formatada || evento.data_inicio}
                      </td>

                      <td className="px-6 py-4 text-center">{getStatusBadge(evento.status)}</td>

                      <td className="px-6 py-4 text-center font-bold tabular-nums text-slate-800 dark:text-slate-100 text-sm">
                        {String(evento.inscritos_count || 0).padStart(2, '0')}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {userRole === 'PROFESSOR' && onOpenAttendanceForEvent && (
                            <button
                              type="button"
                              onClick={() => onOpenAttendanceForEvent(evento.id_evento)}
                              className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                              title="Gerenciar inscritos e frequência"
                            >
                              Inscritos
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenDetailsModal(evento)}
                            className="p-2 text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Visualizar detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenEditModal(evento)}
                            className="p-2 text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Editar evento"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
