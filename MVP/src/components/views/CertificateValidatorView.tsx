import React, { useState } from 'react';
import { ShieldCheck, Search, CheckCircle2, XCircle, Download, Loader2 } from 'lucide-react';
import { Certificado } from '../../types';
import { gerarCertificadoPDF } from '../../utils/pdfGenerator';

interface CertificateValidatorViewProps {
  onValidate: (codigo: string) => Promise<Certificado | null> | Certificado | null;
  certificados: Certificado[];
}

export const CertificateValidatorView: React.FC<CertificateValidatorViewProps> = ({
  onValidate,
  certificados,
}) => {
  const [codigo, setCodigo] = useState('');
  const [resultado, setResultado] = useState<Certificado | null>(null);
  const [pesquisado, setPesquisado] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  const runValidation = async (targetCode: string) => {
    if (!targetCode.trim() || isValidating) return;
    setIsValidating(true);
    try {
      const cert = await onValidate(targetCode);
      setResultado(cert);
      setPesquisado(true);
    } finally {
      setIsValidating(false);
    }
  };

  const handleVerificar = (e: React.FormEvent) => {
    e.preventDefault();
    runValidation(codigo);
  };

  const handleTestCode = (sampleCode: string) => {
    setCodigo(sampleCode);
    runValidation(sampleCode);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto iv-fade-up">
      <div className="text-center space-y-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
          <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          <span>Serviço Oficial de Autenticidade Digital</span>
        </p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">
          Validador de Certificados IFCE Iventus
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
          Consulte e confirme a legitimidade de certificados acadêmicos emitidos pelo Instituto
          Federal do Ceará através do código alfanumérico único.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-8">
        <form onSubmit={handleVerificar} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Código de Validação Digital (Token Único)
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={codigo}
                onChange={(e) => {
                  setCodigo(e.target.value);
                  setPesquisado(false);
                }}
                placeholder="Ex: IFCE-SC23-9F8A-7C21-BD3E-88A1"
                className="flex-1 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-sm font-mono uppercase text-slate-900 dark:text-slate-100 outline-none transition-all min-h-[44px]"
                required
              />
              <button
                type="submit"
                disabled={isValidating}
                className="w-full sm:w-auto px-6 py-3 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px] disabled:opacity-70 whitespace-nowrap"
              >
                {isValidating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>Verificar Certificado</span>
              </button>
            </div>
          </div>
        </form>

        {certificados.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mb-2">
              Códigos emitidos para consulta rápida:
            </p>
            <div className="flex flex-wrap gap-2">
              {certificados.slice(0, 3).map((c, index) => (
                <button
                  key={`val-${c.id_certificado}-${c.codigo_validacao}-${index}`}
                  type="button"
                  onClick={() => handleTestCode(c.codigo_validacao)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-[11px] font-mono text-slate-700 dark:text-slate-300 hover:text-emerald-800 dark:hover:text-emerald-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 transition-colors cursor-pointer break-all text-left"
                >
                  {c.codigo_validacao}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {pesquisado && (
        <div className="iv-fade-up">
          {resultado ? (
            <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-3xl p-5 sm:p-8 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-emerald-800 dark:text-emerald-400 uppercase tracking-wide">
                    Documento Válido e Autêntico
                  </p>
                  <h3 className="text-lg sm:text-xl font-bold text-emerald-950 dark:text-emerald-100">
                    Certificado Oficial Registrado no IFCE
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800/70 text-xs">
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block font-medium">
                    Nome do Participante:
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-50 text-sm">
                    {resultado.participante_nome}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block font-medium">
                    Matrícula Acadêmica:
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                    {resultado.participante_matricula || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block font-medium">
                    Evento Científico:
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-50">
                    {resultado.evento_titulo}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block font-medium">
                    Carga Horária Aprovada:
                  </span>
                  <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-400 text-sm">
                    {resultado.carga_horaria || 20} Horas
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block font-medium">
                    Docente / Coordenador:
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {resultado.organizador_nome || 'IFCE Docente'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block font-medium">
                    Data de Conclusão / Emissão:
                  </span>
                  <span className="font-mono tabular-nums font-medium text-slate-800 dark:text-slate-200">
                    {resultado.data_evento ||
                      new Date(resultado.data_emissao).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
                <div className="text-[11px] text-emerald-900 dark:text-emerald-300 font-mono break-all">
                  Chave: <span className="font-bold">{resultado.codigo_validacao}</span>
                </div>

                <button
                  type="button"
                  onClick={() => gerarCertificadoPDF(resultado)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[42px]"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Via Oficial em PDF</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-3xl p-6 sm:p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
                <XCircle className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-red-900 dark:text-red-200">
                Certificado Não Encontrado
              </h3>
              <p className="text-xs text-red-700 dark:text-red-300 max-w-md mx-auto leading-relaxed">
                O código informado ("{codigo}") não corresponde a nenhum registro autêntico no banco
                de dados do IFCE Iventus. Certifique-se de digitar o código completo incluindo os
                hífens.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
