import React, { useEffect } from 'react';
import { X, Heart, Calendar, Clock, MapPin } from 'lucide-react';
import { Evento, Atividade, PerfilUsuario } from '../../types';
import { EventBanner } from '../../utils/eventImages';

interface EventDetailsModalProps {
  evento: Evento | null;
  isOpen: boolean;
  onClose: () => void;
  userRole: PerfilUsuario;
  isInscrito: boolean;
  isFavorito: boolean;
  onToggleFavorito: (id_evento: number) => void;
  onInscrever: (id_evento: number) => void;
  onCancelarInscricao: () => void;
  atividades: Atividade[];
}

export const EventDetailsModal: React.FC<EventDetailsModalProps> = ({
  evento,
  isOpen,
  onClose,
  userRole,
  isInscrito,
  isFavorito,
  onToggleFavorito,
  onInscrever,
  onCancelarInscricao,
  atividades,
}) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !evento) return null;

  const eventAtividades = atividades.filter((a) => a.id_evento === evento.id_evento);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl iv-modal-in my-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer z-10"
          aria-label="Fechar detalhes do evento"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          {/* Left Column */}
          <div className="w-full md:w-64 shrink-0 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-full h-48 sm:h-52 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                <EventBanner evento={evento} />
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Organizador:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100 text-right truncate">
                    {evento.organizador_nome || 'IFCE Docente'}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Modalidade:</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {evento.modalidade}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Inscritos:</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-100">
                    {evento.inscritos_count || 0} vagas ocupadas
                  </span>
                </div>
              </div>
            </div>

            {userRole === 'PARTICIPANTE' && (
              <div className="pt-5 hidden md:flex items-center gap-2.5">
                {isInscrito ? (
                  <button
                    type="button"
                    onClick={onCancelarInscricao}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer min-h-[42px]"
                  >
                    Cancelar inscrição
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onInscrever(evento.id_evento)}
                    disabled={evento.status !== 'PUBLICADO'}
                    className={`flex-1 py-2.5 font-bold text-xs rounded-xl shadow-xs transition-colors min-h-[42px] ${
                      evento.status === 'PUBLICADO'
                        ? 'bg-[#16a34a] hover:bg-[#15803d] text-white cursor-pointer'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    Inscrever-se
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onToggleFavorito(evento.id_evento)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer min-h-[42px] min-w-[42px] flex items-center justify-center ${
                    isFavorito
                      ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400'
                      : 'border-slate-300 dark:border-slate-700 text-slate-400 hover:text-red-500'
                  }`}
                  title="Favoritar evento"
                  aria-label="Favoritar evento"
                >
                  <Heart className={`w-5 h-5 ${isFavorito ? 'fill-current' : ''}`} />
                </button>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="flex-1 space-y-4 pr-0 sm:pr-6">
            <div>
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                Detalhes do Evento
              </p>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 leading-snug">
                {evento.titulo}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200/80 dark:border-slate-700 flex items-start gap-2">
                <MapPin className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-slate-400 dark:text-slate-500 block text-[11px]">
                    Local
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100 break-words">
                    {evento.local}
                  </span>
                </div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200/80 dark:border-slate-700 flex items-start gap-2">
                <Calendar className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Data</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100 break-words">
                    {evento.data_formatada || evento.data_inicio}
                  </span>
                </div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200/80 dark:border-slate-700 flex items-start gap-2">
                <Clock className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-slate-400 dark:text-slate-500 block text-[11px]">
                    Horário
                  </span>
                  <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                    {evento.horario_formatado || '13:00h - 15:00h'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Descrição do Evento
              </span>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line min-h-[110px]">
                {evento.descricao}
              </div>
            </div>

            {eventAtividades.length > 0 && (
              <div className="pt-1">
                <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Atividades e Minicursos Vinculados
                </span>
                <div className="space-y-2">
                  {eventAtividades.map((atv) => (
                    <div
                      key={atv.id_atividade}
                      className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/40 border border-emerald-200/90 dark:border-emerald-800/70 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 dark:text-slate-100">
                          {atv.titulo}
                        </p>
                        <p className="text-slate-600 dark:text-slate-400 mt-0.5 tabular-nums">
                          {atv.tipo} · Carga horária: {atv.carga_horaria || 20}h · Limite:{' '}
                          {atv.limite_vagas} vagas
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {userRole === 'PARTICIPANTE' && (
              <div className="pt-3 md:hidden flex items-center gap-2.5">
                {isInscrito ? (
                  <button
                    type="button"
                    onClick={onCancelarInscricao}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl shadow-xs transition-colors cursor-pointer min-h-[44px]"
                  >
                    Cancelar inscrição
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onInscrever(evento.id_evento)}
                    disabled={evento.status !== 'PUBLICADO'}
                    className={`flex-1 py-3 font-bold text-sm rounded-xl shadow-xs transition-colors min-h-[44px] ${
                      evento.status === 'PUBLICADO'
                        ? 'bg-[#16a34a] hover:bg-[#15803d] text-white cursor-pointer'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    Inscrever-se
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onToggleFavorito(evento.id_evento)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center ${
                    isFavorito
                      ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400'
                      : 'border-slate-300 dark:border-slate-700 text-slate-400 hover:text-red-500'
                  }`}
                  title="Favoritar evento"
                  aria-label={isFavorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                >
                  <Heart className={`w-5 h-5 ${isFavorito ? 'fill-current' : ''}`} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
