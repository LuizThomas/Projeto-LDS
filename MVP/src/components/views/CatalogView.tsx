import React, { useState } from 'react';
import { Calendar, MapPin, Heart, ChevronRight, Plus, Users, Edit2 } from 'lucide-react';
import { Evento, PerfilUsuario } from '../../types';
import { EventBanner } from '../../utils/eventImages';

interface CatalogViewProps {
  eventos: Evento[];
  favoritos: number[];
  onToggleFavorito: (id_evento: number) => void;
  onOpenDetails: (evento: Evento) => void;
  onQuickInscrever: (id_evento: number) => void;
  inscricoesIds: number[];
  userRole?: PerfilUsuario;
  currentUserId?: number;
  onOpenCreateModal?: () => void;
  onOpenEditModal?: (evento: Evento) => void;
  onOpenAttendanceForEvent?: (eventoId: number) => void;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  eventos,
  favoritos,
  onToggleFavorito,
  onOpenDetails,
  onQuickInscrever,
  inscricoesIds,
  userRole = 'PARTICIPANTE',
  currentUserId,
  onOpenCreateModal,
  onOpenEditModal,
  onOpenAttendanceForEvent,
}) => {
  const [filterModalidade, setFilterModalidade] = useState<
    'TODOS' | 'Presencial' | 'Online' | 'FAVORITOS'
  >('TODOS');

  const visibleEventos = eventos.filter((e) => e.status !== 'RASCUNHO');

  const filteredEventos = visibleEventos.filter((e) => {
    if (filterModalidade === 'Presencial') return e.modalidade === 'Presencial';
    if (filterModalidade === 'Online') return e.modalidade === 'Online';
    if (filterModalidade === 'FAVORITOS') return favoritos.includes(e.id_evento);
    return true;
  });

  return (
    <div className="space-y-5 sm:space-y-6 iv-fade-up">
      {/* Header and Filter Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
            Eventos
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1">
            {userRole === 'PARTICIPANTE'
              ? 'Explore e participe de congressos, workshops e simpósios científicos do IFCE.'
              : 'Catálogo institucional de eventos publicados no IFCE Iventus.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          {/* Filter Controls */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs font-semibold overflow-x-auto max-w-full shrink-0">
            <button
              type="button"
              onClick={() => setFilterModalidade('TODOS')}
              className={`px-3 py-1.5 rounded-lg transition-all shrink-0 whitespace-nowrap cursor-pointer min-h-[36px] flex items-center justify-center ${
                filterModalidade === 'TODOS'
                  ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Todos ({visibleEventos.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterModalidade('Presencial')}
              className={`px-3 py-1.5 rounded-lg transition-all shrink-0 whitespace-nowrap cursor-pointer min-h-[36px] flex items-center justify-center ${
                filterModalidade === 'Presencial'
                  ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Presencial
            </button>
            <button
              type="button"
              onClick={() => setFilterModalidade('Online')}
              className={`px-3 py-1.5 rounded-lg transition-all shrink-0 whitespace-nowrap cursor-pointer min-h-[36px] flex items-center justify-center ${
                filterModalidade === 'Online'
                  ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Online
            </button>
            <button
              type="button"
              onClick={() => setFilterModalidade('FAVORITOS')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer min-h-[36px] ${
                filterModalidade === 'FAVORITOS'
                  ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400'
              }`}
            >
              <Heart className="w-3.5 h-3.5 fill-current" />
              <span>Favoritos ({favoritos.length})</span>
            </button>
          </div>

          {(userRole === 'ADMINISTRADOR' || userRole === 'PROFESSOR') && onOpenCreateModal && (
            <button
              type="button"
              onClick={onOpenCreateModal}
              className="px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[42px] whitespace-nowrap"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Criar Evento</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid of Event Cards */}
      {filteredEventos.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 sm:p-12 text-center">
          <Calendar className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm sm:text-base font-semibold text-slate-700 dark:text-slate-200">
            Nenhum evento encontrado
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Não há eventos disponíveis para o filtro selecionado no momento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredEventos.map((evento, index) => {
            const isFav = favoritos.includes(evento.id_evento);
            const isInscrito = inscricoesIds.includes(evento.id_evento);
            const isOwner = currentUserId !== undefined && evento.id_organizador === currentUserId;
            const canEdit = userRole === 'ADMINISTRADOR' || (userRole === 'PROFESSOR' && isOwner);

            return (
              <div
                key={`cat-${evento.id_evento}-${index}`}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all hover:shadow-md flex flex-col overflow-hidden group"
              >
                {/* Event Artwork */}
                <div className="relative h-40 sm:h-44 bg-slate-100 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800 overflow-hidden">
                  <EventBanner
                    evento={evento}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-slate-950/20 pointer-events-none" />

                  {/* Modality Label */}
                  <span
                    className={`absolute top-3 left-3 px-2.5 py-1 rounded-md text-[11px] font-semibold shadow-xs ${
                      evento.modalidade === 'Presencial'
                        ? 'bg-blue-50/95 dark:bg-blue-950/90 text-blue-800 dark:text-blue-200 border border-blue-200/70 dark:border-blue-800'
                        : 'bg-amber-50/95 dark:bg-amber-950/90 text-amber-800 dark:text-amber-200 border border-amber-200/70 dark:border-amber-800'
                    }`}
                  >
                    {evento.modalidade}
                  </span>

                  {/* Favorite Heart Button */}
                  <button
                    type="button"
                    onClick={() => onToggleFavorito(evento.id_evento)}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/95 dark:bg-slate-900/90 backdrop-blur-xs shadow-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-red-500 hover:scale-110 transition-all cursor-pointer min-h-[32px] min-w-[32px]"
                    title={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                    aria-label={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                  >
                    <Heart
                      className={`w-4 h-4 transition-colors ${
                        isFav ? 'text-red-500 fill-red-500' : 'text-slate-400 dark:text-slate-300'
                      }`}
                    />
                  </button>

                  {/* Status Overlay if canceled/closed */}
                  {evento.status === 'CANCELADO' && (
                    <span className="absolute bottom-2.5 left-3 px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white uppercase shadow-xs">
                      Cancelado
                    </span>
                  )}
                  {evento.status === 'ENCERRADO' && (
                    <span className="absolute bottom-2.5 left-3 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-600 text-white uppercase shadow-xs">
                      Encerrado
                    </span>
                  )}
                  {isOwner && userRole === 'PROFESSOR' && evento.status === 'PUBLICADO' && (
                    <span className="absolute bottom-2.5 left-3 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-700/95 text-white shadow-xs">
                      Seu evento
                    </span>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-2.5 sm:space-y-3">
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors line-clamp-2">
                      {evento.titulo}
                    </h2>

                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="truncate">
                          {evento.data_formatada || evento.data_inicio}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span className="truncate">{evento.local}</span>
                      </div>
                      <div className="flex items-center gap-2 tabular-nums">
                        <Users className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span>{evento.inscritos_count || 0} inscritos</span>
                        {evento.organizador_nome && (
                          <>
                            <span>·</span>
                            <span className="truncate">{evento.organizador_nome}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="pt-3.5 mt-3 sm:pt-4 sm:mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenDetails(evento)}
                      className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 text-xs font-bold flex items-center gap-1 group/btn cursor-pointer py-1"
                    >
                      <span>Ver detalhes</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                    </button>

                    {userRole === 'PARTICIPANTE' ? (
                      isInscrito ? (
                        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
                          Inscrito ✓
                        </span>
                      ) : evento.status === 'PUBLICADO' ? (
                        <button
                          type="button"
                          onClick={() => onQuickInscrever(evento.id_evento)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs cursor-pointer min-h-[34px] whitespace-nowrap"
                        >
                          Inscrever-se
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium italic">
                          {evento.status === 'ENCERRADO' ? 'Encerrado' : 'Indisponível'}
                        </span>
                      )
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {canEdit && onOpenAttendanceForEvent && (
                          <button
                            type="button"
                            onClick={() => onOpenAttendanceForEvent(evento.id_evento)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold cursor-pointer whitespace-nowrap"
                          >
                            Inscritos
                          </button>
                        )}
                        {canEdit && onOpenEditModal && (
                          <button
                            type="button"
                            onClick={() => onOpenEditModal(evento)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                            title="Editar evento"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
