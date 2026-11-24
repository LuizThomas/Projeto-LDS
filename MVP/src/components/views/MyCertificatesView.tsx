import React, { useState } from 'react';
import { Download, Award } from 'lucide-react';
import { Certificado } from '../../types';
import { gerarCertificadoPDF } from '../../utils/pdfGenerator';
import confetti from 'canvas-confetti';

interface MyCertificatesViewProps {
  certificados: Certificado[];
}

export const MyCertificatesView: React.FC<MyCertificatesViewProps> = ({ certificados }) => {
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const handleDownload = (cert: Certificado) => {
    setDownloadingId(cert.id_certificado);
    try {
      gerarCertificadoPDF(cert);
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } finally {
      setTimeout(() => setDownloadingId(null), 800);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 iv-fade-up">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
          Meus certificados
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Acesse, emita e comprove sua participação oficial com certificados assinados
          digitalmente pelo IFCE.
        </p>
      </div>

      {certificados.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 sm:p-12 text-center">
          <Award className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm sm:text-base font-semibold text-slate-700 dark:text-slate-200">
            Nenhum certificado emitido
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Ao concluir um evento e ter sua presença homologada pelo professor organizador, seu
            certificado oficial ficará disponível aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Mobile View */}
          <div className="sm:hidden space-y-3">
            {certificados.map((cert, index) => {
              const isDownloading = downloadingId === cert.id_certificado;
              return (
                <div
                  key={`m-cert-${cert.id_certificado}-${index}`}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 dark:text-slate-50 text-sm leading-snug">
                        {cert.evento_titulo}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-1 break-all">
                        {cert.codigo_validacao}
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-bold tabular-nums bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                      {cert.carga_horaria || 20}h
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                    <span className="font-mono tabular-nums">
                      {cert.data_evento || new Date(cert.data_emissao).toLocaleDateString('pt-BR')}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDownload(cert)}
                      disabled={isDownloading}
                      className="px-3.5 py-2 rounded-xl bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer min-h-[40px]"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isDownloading ? 'Gerando...' : 'Baixar PDF'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop View */}
          <div className="hidden sm:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-6 py-4">
                      Evento
                    </th>
                    <th scope="col" className="px-6 py-4">
                      Data
                    </th>
                    <th scope="col" className="px-6 py-4">
                      Carga Horária
                    </th>
                    <th scope="col" className="px-6 py-4 text-center">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {certificados.map((cert, index) => {
                    const isDownloading = downloadingId === cert.id_certificado;
                    return (
                      <tr
                        key={`cert-${cert.id_certificado}-${cert.codigo_validacao}-${index}`}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900 dark:text-slate-50 text-sm">
                            {cert.evento_titulo}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono">
                            Código: {cert.codigo_validacao}
                          </div>
                        </td>

                        <td className="px-6 py-4 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                          {cert.data_evento || new Date(cert.data_emissao).toLocaleDateString('pt-BR')}
                        </td>

                        <td className="px-6 py-4 text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                          {cert.carga_horaria || 20}h
                        </td>

                        <td className="px-6 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleDownload(cert)}
                            disabled={isDownloading}
                            className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white border border-emerald-200 dark:border-emerald-800 hover:border-emerald-600 transition-colors cursor-pointer"
                            title="Baixar Certificado Oficial em PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
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
    </div>
  );
};
