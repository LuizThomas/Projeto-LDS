import React, { useState } from 'react';
import { SolicitacaoCertificadoModeracao } from '../../types';
import { Check, X } from 'lucide-react';

interface AdminCertificatesViewProps {
  solicitacoes: SolicitacaoCertificadoModeracao[];
  onModerar: (id_certificado: number, decisao: 'APROVAR' | 'RECUSAR') => void;
}

export const AdminCertificatesView: React.FC<AdminCertificatesViewProps> = ({
  solicitacoes,
  onModerar,
}) => {
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleAction = (id: number, decisao: 'APROVAR' | 'RECUSAR', evento: string) => {
    onModerar(id, decisao);
    setFeedback(
      decisao === 'APROVAR'
        ? `Lote de certificados para "${evento}" aprovado com sucesso!`
        : `Lote de certificados para "${evento}" recusado.`
    );
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Homologação de Certificados
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Aprovação institucional e liberação de chaves públicas de autenticidade para certificados.
        </p>
      </div>

      {feedback && (
        <div className="p-3.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      <div className="space-y-3">
        {/* Mobile View */}
        <div className="sm:hidden space-y-3">
          {solicitacoes.map((item, index) => {
            const isModerated = item.status_moderacao !== 'PENDENTE';
            return (
              <div
                key={`m-sol-cert-${item.id_certificado}-${index}`}
                className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{item.evento_titulo}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Organizador: {item.organizador_nome}
                    </p>
                  </div>
                  {isModerated && (
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-md ${
                        item.status_moderacao === 'APROVADO'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-red-50 text-red-800 border border-red-200'
                      }`}
                    >
                      {item.status_moderacao === 'APROVADO' ? 'Aprovado' : 'Recusado'}
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-500 pt-2 border-t border-slate-100 font-mono tabular-nums">
                  <span>Solicitado em {item.data_solicitacao}</span>
                </div>

                {!isModerated && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleAction(item.id_certificado, 'APROVAR', item.evento_titulo)}
                      className="w-full py-2 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer min-h-[42px] flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Aprovar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction(item.id_certificado, 'RECUSAR', item.evento_titulo)}
                      className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-xl transition-colors cursor-pointer min-h-[42px] flex items-center justify-center gap-1.5"
                    >
                      <X className="w-4 h-4 stroke-[2.5]" />
                      <span>Recusar</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop View */}
        <div className="hidden sm:block bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-6 py-4">Evento</th>
                  <th className="px-6 py-4">Organizador</th>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {solicitacoes.map((item, index) => {
                  const isModerated = item.status_moderacao !== 'PENDENTE';
                  return (
                    <tr
                      key={`sol-cert-${item.id_certificado}-${index}`}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="px-6 py-4 font-bold text-slate-900 text-sm">
                        {item.evento_titulo}
                      </td>

                      <td className="px-6 py-4 text-xs font-medium text-slate-600">
                        {item.organizador_nome}
                      </td>

                      <td className="px-6 py-4 text-xs font-mono tabular-nums text-slate-600">
                        {item.data_solicitacao}
                      </td>

                      <td className="px-6 py-4 text-center">
                        {isModerated ? (
                          <span
                            className={`text-xs font-bold px-3 py-1 rounded-md ${
                              item.status_moderacao === 'APROVADO'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-red-50 text-red-800 border border-red-200'
                            }`}
                          >
                            {item.status_moderacao === 'APROVADO' ? 'Aprovado' : 'Recusado'}
                          </span>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleAction(item.id_certificado, 'RECUSAR', item.evento_titulo)
                              }
                              className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                            >
                              Recusar
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleAction(item.id_certificado, 'APROVAR', item.evento_titulo)
                              }
                              className="px-3.5 py-1.5 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                            >
                              Aprovar
                            </button>
                          </div>
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
    </div>
  );
};
