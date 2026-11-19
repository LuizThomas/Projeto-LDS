import React, { useState, useEffect } from 'react';
import { X, Plus, Edit3 } from 'lucide-react';
import { Evento, StatusEvento } from '../../types';

interface EditEventModalProps {
  evento: Evento | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id_evento: number, updates: Partial<Evento>) => void;
}

export const EditEventModal: React.FC<EditEventModalProps> = ({
  evento,
  isOpen,
  onClose,
  onSave,
}) => {
  const [nome, setNome] = useState('');
  const [local, setLocal] = useState('');
  const [data, setData] = useState('');
  const [horario, setHorario] = useState('');
  const [descricao, setDescricao] = useState('');
  const [status, setStatus] = useState<StatusEvento>('PUBLICADO');
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  useEffect(() => {
    if (evento) {
      setNome(evento.titulo);
      setLocal(evento.local);
      setData(evento.data_formatada || evento.data_inicio);
      setHorario(evento.horario_formatado || '13:00h - 15:00h');
      setDescricao(evento.descricao);
      setStatus(evento.status);
      setBannerUrl(evento.banner_url || null);
    }
  }, [evento]);

  if (!isOpen || !evento) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(evento.id_evento, {
      titulo: nome.trim(),
      local: local.trim(),
      data_formatada: data.trim(),
      horario_formatado: horario.trim(),
      descricao: descricao.trim(),
      status,
      banner_url: bannerUrl,
    });
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
    <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-white border border-slate-200 rounded-2xl sm:rounded-3xl shadow-2xl animate-in zoom-in-95 duration-150 my-auto">
        <div className="flex items-center justify-between px-5 sm:px-8 py-4 sm:py-5 border-b border-slate-100 bg-amber-50/40 rounded-t-2xl sm:rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
                Editando Evento
              </h2>
              <p className="text-xs text-slate-500">
                Atualize informações, banner ou status do ciclo de vida do evento
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer shrink-0"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-8 flex flex-col md:flex-row gap-6 md:gap-8">
          {/* Left Column: Banner & Status */}
          <div className="w-full md:w-64 shrink-0 space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Imagem do Evento
              </label>
              <label className="w-full h-48 sm:h-52 bg-slate-50 hover:bg-slate-100 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors overflow-hidden group">
                {bannerUrl ? (
                  <img src={bannerUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-500 px-4 text-center">
                    <Plus className="w-10 h-10 stroke-[1.5] mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-semibold text-slate-700">Alterar imagem</span>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Situação do Evento
              </label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus('PUBLICADO')}
                  className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer min-h-[40px] border ${
                    status === 'PUBLICADO'
                      ? 'bg-[#16a34a] text-white border-[#15803d]'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Ativo / Publicado
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('ENCERRADO')}
                  className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer min-h-[40px] border ${
                    status === 'ENCERRADO'
                      ? 'bg-amber-600 text-white border-amber-700'
                      : 'bg-amber-50/70 text-amber-800 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  Encerrar Evento
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('CANCELADO')}
                  className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer min-h-[40px] border ${
                    status === 'CANCELADO'
                      ? 'bg-red-600 text-white border-red-700'
                      : 'bg-red-50/70 text-red-700 border-red-200 hover:bg-red-100'
                  }`}
                >
                  Cancelar Evento
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Form Fields */}
          <div className="flex-1 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nome do Evento
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-900 outline-none transition-all font-medium min-h-[44px]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Local</label>
              <input
                type="text"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-900 outline-none transition-all font-medium min-h-[44px]"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Data</label>
                <input
                  type="text"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-900 outline-none transition-all font-medium min-h-[44px]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Horário</label>
                <input
                  type="text"
                  value={horario}
                  onChange={(e) => setHorario(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-900 outline-none transition-all font-medium min-h-[44px]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Descrição do Evento
              </label>
              <textarea
                rows={5}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="w-full p-3.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm text-slate-800 outline-none resize-none font-medium"
                required
              />
            </div>

            <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-colors cursor-pointer min-h-[44px]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-sm rounded-xl shadow-xs transition-colors cursor-pointer min-h-[44px]"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
