import React, { useState, useEffect } from 'react';
import { X, Plus, CalendarPlus, CheckCircle2 } from 'lucide-react';
import { Evento, StatusEvento } from '../../types';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (eventoData: Omit<Evento, 'id_evento' | 'created_at' | 'inscritos_count'>) => void;
  organizadorId: number;
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  organizadorId,
}) => {
  const [nome, setNome] = useState('');
  const [local, setLocal] = useState('');
  const [data, setData] = useState('');
  const [horario, setHorario] = useState('');
  const [descricao, setDescricao] = useState('');
  const [status, setStatus] = useState<StatusEvento>('PUBLICADO');
  const [modalidade, setModalidade] = useState<'Presencial' | 'Online'>('Presencial');
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !local.trim()) return;

    onCreate({
      id_organizador: organizadorId,
      titulo: nome.trim(),
      descricao: descricao.trim() || 'Descrição oficial do evento acadêmico no IFCE.',
      banner_url: bannerUrl,
      data_inicio: '2026-10-20 08:00:00',
      data_fim: '2026-10-22 18:00:00',
      inicio_inscricoes: '2026-09-01 00:00:00',
      fim_inscricoes: '2026-10-19 23:59:59',
      status,
      local: local.trim(),
      modalidade,
      data_formatada: data.trim() || '20 a 22 de Outubro de 2026',
      horario_formatado: horario.trim() || '08:00h - 18:00h',
    });

    setNome('');
    setLocal('');
    setData('');
    setHorario('');
    setDescricao('');
    setBannerUrl(null);
    onClose();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setBannerUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl iv-modal-in my-auto">
        <div className="flex items-center justify-between px-5 sm:px-8 py-4 sm:py-5 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/40 dark:bg-emerald-950/30 rounded-t-2xl sm:rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <CalendarPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-50 leading-tight">
                Criar Novo Evento
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Preencha as informações oficiais para divulgação no catálogo acadêmico
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-8 flex flex-col md:flex-row gap-6 md:gap-8">
          <div className="w-full md:w-64 shrink-0 space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Imagem de Divulgação
              </label>
              <label className="w-full h-48 sm:h-52 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors overflow-hidden group">
                {bannerUrl ? (
                  <img src={bannerUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 px-4 text-center">
                    <Plus className="w-10 h-10 stroke-[1.5] mb-2 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Enviar banner
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      PNG ou JPG
                    </span>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Publicação Inicial
              </label>
              <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus('PUBLICADO')}
                  className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[42px] border ${
                    status === 'PUBLICADO'
                      ? 'bg-[#16a34a] text-white border-[#15803d] shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Publicar Agora</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('RASCUNHO')}
                  className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer min-h-[42px] border ${
                    status === 'RASCUNHO'
                      ? 'bg-slate-800 dark:bg-slate-700 text-white border-slate-900 dark:border-slate-600 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  Salvar como Rascunho
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Nome do Evento
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Semana da Computação 2026"
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-900 dark:text-slate-100 outline-none transition-all min-h-[44px]"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Local
                </label>
                <input
                  type="text"
                  value={local}
                  onChange={(e) => setLocal(e.target.value)}
                  placeholder="Ex: Auditório Central - IFCE Campus Cedro"
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-900 dark:text-slate-100 outline-none transition-all min-h-[44px]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Modalidade
                </label>
                <select
                  value={modalidade}
                  onChange={(e) => setModalidade(e.target.value as 'Presencial' | 'Online')}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 focus:border-emerald-600 text-sm text-slate-900 dark:text-slate-100 outline-none transition-all min-h-[44px]"
                >
                  <option value="Presencial">Presencial</option>
                  <option value="Online">Online</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Data
                </label>
                <input
                  type="text"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  placeholder="Ex: 20 a 22 de Outubro de 2026"
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-900 dark:text-slate-100 outline-none transition-all min-h-[44px]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Horário
                </label>
                <input
                  type="text"
                  value={horario}
                  onChange={(e) => setHorario(e.target.value)}
                  placeholder="Ex: 08:00h - 18:00h"
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-900 dark:text-slate-100 outline-none transition-all min-h-[44px]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Descrição e Programação
              </label>
              <textarea
                rows={5}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Detalhes da programação, submissão de trabalhos, palestrantes e carga horária para certificados..."
                className="w-full p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 dark:text-slate-100 outline-none resize-none"
                required
              />
            </div>

            <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm rounded-xl transition-colors cursor-pointer min-h-[44px]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-sm rounded-xl shadow-xs transition-colors cursor-pointer min-h-[44px]"
              >
                Salvar e Criar Evento
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
