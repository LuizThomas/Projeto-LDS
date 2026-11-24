import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Award,
  Download,
  Check,
  X,
  Calendar,
  MapPin,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { Inscricao, Evento, Frequencia } from '../../types';
import confetti from 'canvas-confetti';

export interface EventAttendancePayload {
  evento: Evento;
  inscriptions: Inscricao[];
  frequencias: Frequencia[];
  canManageAttendance: boolean;
}

interface AttendanceViewProps {
  eventos: Evento[];
  currentUserId: number;
  initialEventId?: number | null;
  onFetchEventInscriptions: (eventoId: number) => Promise<EventAttendancePayload>;
  onSetPresenca: (id_inscricao: number, presente: boolean) => Promise<Frequencia>;
  onEmitirCertificado: (
    alunoNome: string,
    matricula: string,
    eventoTitulo: string,
    idInscricao?: number
  ) => Promise<void> | void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  eventos,
  currentUserId,
  initialEventId,
  onFetchEventInscriptions,
  onSetPresenca,
  onEmitirCertificado,
}) => {
  // Prioritize events organized by the logged-in professor first
  const sortedEventos = useMemo(() => {
    const owned = eventos.filter((e) => e.id_organizador === currentUserId);
    const others = eventos.filter((e) => e.id_organizador !== currentUserId);
    return [...owned, ...others];
  }, [eventos, currentUserId]);

  const [selectedEventId, setSelectedEventId] = useState<number | null>(() => {
    if (initialEventId && eventos.some((e) => e.id_evento === initialEventId)) {
      return initialEventId;
    }
    const firstOwned = eventos.find((e) => e.id_organizador === currentUserId);
    return firstOwned?.id_evento || eventos[0]?.id_evento || null;
  });

  // Sync external deep-links (e.g. clicking "Gerenciar Presença" from Dashboard or My Events)
  useEffect(() => {
    if (initialEventId && eventos.some((e) => e.id_evento === initialEventId)) {
      setSelectedEventId(initialEventId);
    }
  }, [initialEventId, eventos]);

  // Ensure selectedEventId stays valid when events list updates
  useEffect(() => {
    if (sortedEventos.length === 0) {
      setSelectedEventId(null);
      return;
    }
    if (!selectedEventId || !sortedEventos.some((e) => e.id_evento === selectedEventId)) {
      setSelectedEventId(sortedEventos[0].id_evento);
    }
  }, [sortedEventos, selectedEventId]);

  const [eventInscriptions, setEventInscriptions] = useState<Inscricao[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<number, boolean | null>>({});
  const [canManageAttendance, setCanManageAttendance] = useState<boolean>(true);
  const [selectedEventDetail, setSelectedEventDetail] = useState<Evento | null>(null);
  const [isLoadingRoster, setIsLoadingRoster] = useState<boolean>(false);
  const [rosterError, setRosterError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState<
    'TODOS' | 'PRESENTES' | 'AUSENTES' | 'PENDENTES'
  >('TODOS');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [isBatchIssuing, setIsBatchIssuing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const loadRoster = useCallback(
    async (eventoId: number) => {
      setIsLoadingRoster(true);
      setRosterError(null);
      setEventInscriptions([]); // Clear previous event roster so lists never mix
      setAttendanceMap({});

      try {
        const payload = await onFetchEventInscriptions(eventoId);
        setSelectedEventDetail(payload.evento);
        setCanManageAttendance(payload.canManageAttendance);
        setEventInscriptions(payload.inscriptions);

        const nextMap: Record<number, boolean | null> = {};
        for (const insc of payload.inscriptions) {
          nextMap[insc.id_inscricao] =
            insc.presente === true ? true : insc.presente === false ? false : null;
        }
        for (const freq of payload.frequencias || []) {
          nextMap[freq.id_inscricao] = Boolean(freq.presente);
        }
        setAttendanceMap(nextMap);
      } catch (err: any) {
        setRosterError(err?.message || 'Não foi possível carregar os inscritos deste evento.');
      } finally {
        setIsLoadingRoster(false);
      }
    },
    [onFetchEventInscriptions]
  );

  useEffect(() => {
    if (selectedEventId) {
      loadRoster(selectedEventId);
    }
  }, [selectedEventId, loadRoster]);

  const activeEvento =
    selectedEventDetail || sortedEventos.find((e) => e.id_evento === selectedEventId) || null;

  const getAttendanceState = (inscricaoId: number): boolean | null => {
    return attendanceMap[inscricaoId] ?? null;
  };

  const totalCount = eventInscriptions.length;
  const presentCount = eventInscriptions.filter(
    (i) => getAttendanceState(i.id_inscricao) === true
  ).length;
  const absentCount = eventInscriptions.filter(
    (i) => getAttendanceState(i.id_inscricao) === false
  ).length;
  const pendingCount = totalCount - presentCount - absentCount;

  const filteredInscritos = eventInscriptions.filter((i) => {
    const state = getAttendanceState(i.id_inscricao);
    if (attendanceFilter === 'PRESENTES' && state !== true) return false;
    if (attendanceFilter === 'AUSENTES' && state !== false) return false;
    if (attendanceFilter === 'PENDENTES' && state !== null) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        (i.usuario_nome || '').toLowerCase().includes(q) ||
        (i.usuario_email || '').toLowerCase().includes(q) ||
        (i.usuario_matricula || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleMarkAttendance = async (inscricao: Inscricao, presente: boolean) => {
    if (!canManageAttendance || savingId === inscricao.id_inscricao) return;
    setSavingId(inscricao.id_inscricao);
    setFeedback(null);

    try {
      const saved = await onSetPresenca(inscricao.id_inscricao, presente);
      setAttendanceMap((prev) => ({
        ...prev,
        [inscricao.id_inscricao]: Boolean(saved.presente),
      }));
      setEventInscriptions((prev) =>
        prev.map((item) =>
          item.id_inscricao === inscricao.id_inscricao
            ? {
                ...item,
                presente: Boolean(saved.presente),
                frequencia_registrada_em: saved.data_registro,
              }
            : item
        )
      );
      setFeedback({
        type: 'success',
        message: `${inscricao.usuario_nome || 'Participante'} marcado como ${
          presente ? 'Presente' : 'Ausente'
        } em "${activeEvento?.titulo}".`,
      });
      setTimeout(() => setFeedback(null), 3200);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Erro ao salvar frequência no servidor.',
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleEmitirParaAluno = async (inscricao: Inscricao) => {
    if (!canManageAttendance || !activeEvento) return;
    const nome = inscricao.usuario_nome || 'Participante IFCE';
    const matricula = inscricao.usuario_matricula || 'N/A';

    try {
      await onEmitirCertificado(nome, matricula, activeEvento.titulo, inscricao.id_inscricao);
      setFeedback({
        type: 'success',
        message: `Certificado emitido para ${nome} no evento "${activeEvento.titulo}"!`,
      });
      confetti({ particleCount: 40, spread: 50 });
      setTimeout(() => setFeedback(null), 3200);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Erro ao emitir certificado.',
      });
    }
  };

  const handleBatchEmitirCertificados = async () => {
    if (!canManageAttendance || !activeEvento || isBatchIssuing) return;
    const eligible = eventInscriptions.filter(
      (i) => getAttendanceState(i.id_inscricao) === true
    );
    if (eligible.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Nenhum participante com presença confirmada neste evento.',
      });
      return;
    }

    setIsBatchIssuing(true);
    try {
      let issued = 0;
      for (const item of eligible) {
        await onEmitirCertificado(
          item.usuario_nome || 'Participante',
          item.usuario_matricula || 'N/A',
          activeEvento.titulo,
          item.id_inscricao
        );
        issued++;
      }
      setFeedback({
        type: 'success',
        message: `${issued} certificado(s) emitido(s) para participantes presentes em "${activeEvento.titulo}"!`,
      });
      confetti({ particleCount: 70, spread: 80 });
      setTimeout(() => setFeedback(null), 3500);
    } finally {
      setIsBatchIssuing(false);
    }
  };

  const renderStatusLabel = (state: boolean | null) => {
    if (state === true) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Presente</span>
        </span>
      );
    }
    if (state === false) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Ausente</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>Não registrado</span>
      </span>
    );
  };

  return (
    <div className="space-y-5 sm:space-y-6 iv-fade-up">
      {/* Header + Event Selector */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
              Inscritos e Controle de Frequência
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Selecione um evento para visualizar exclusivamente seus inscritos, registrar presença e emitir certificados.
            </p>
          </div>

          <button
            type="button"
            onClick={handleBatchEmitirCertificados}
            disabled={!canManageAttendance || presentCount === 0 || isBatchIssuing}
            className="w-full lg:w-auto justify-center px-4 py-2.5 bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 dark:hover:bg-emerald-600 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer transition-colors min-h-[42px] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isBatchIssuing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Emitir Certificados em Lote ({presentCount})</span>
          </button>
        </div>

        {/* Event Selector Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-end pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="lg:col-span-6">
            <label
              htmlFor="attendance-event-select"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Selecionar Evento
            </label>
            <select
              id="attendance-event-select"
              value={selectedEventId ? String(selectedEventId) : ''}
              onChange={(e) => {
                const nextId = Number(e.target.value);
                if (nextId) setSelectedEventId(nextId);
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:border-emerald-600 text-sm font-semibold text-slate-900 dark:text-slate-100 outline-none cursor-pointer min-h-[44px]"
            >
              {sortedEventos.length === 0 && <option value="">Nenhum evento disponível</option>}
              {sortedEventos.map((ev) => {
                const isMine = ev.id_organizador === currentUserId;
                return (
                  <option key={ev.id_evento} value={String(ev.id_evento)}>
                    {ev.titulo} {isMine ? '(Seu evento)' : '(Outro organizador)'} — {ev.status}
                  </option>
                );
              })}
            </select>
          </div>

          {activeEvento && (
            <div className="lg:col-span-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs text-slate-600 dark:text-slate-300 min-h-[44px]">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                {activeEvento.data_formatada || activeEvento.data_inicio}
              </span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="inline-flex items-center gap-1.5 font-medium truncate">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">{activeEvento.local}</span>
              </span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {activeEvento.modalidade}
              </span>
            </div>
          )}
        </div>

        {/* Read-only notice when inspecting event owned by another coordinator */}
        {activeEvento && !canManageAttendance && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span>
              Modo somente visualização: apenas o professor organizador deste evento ou um administrador pode alterar presenças e emitir certificados.
            </span>
          </div>
        )}
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold border flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Summary Strip for Selected Event */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setAttendanceFilter('TODOS')}
          className={`text-left p-3.5 sm:p-4 rounded-2xl border transition-colors cursor-pointer ${
            attendanceFilter === 'TODOS'
              ? 'bg-slate-100 dark:bg-slate-800 border-slate-400 dark:border-slate-600'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Total Inscritos
          </span>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-50 tabular-nums mt-1">
            {totalCount}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setAttendanceFilter('PRESENTES')}
          className={`text-left p-3.5 sm:p-4 rounded-2xl border transition-colors cursor-pointer ${
            attendanceFilter === 'PRESENTES'
              ? 'bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-400 dark:border-emerald-700'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300'
          }`}
        >
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Presentes
          </span>
          <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums mt-1">
            {presentCount}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setAttendanceFilter('AUSENTES')}
          className={`text-left p-3.5 sm:p-4 rounded-2xl border transition-colors cursor-pointer ${
            attendanceFilter === 'AUSENTES'
              ? 'bg-red-50/80 dark:bg-red-950/50 border-red-300 dark:border-red-800'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-red-300'
          }`}
        >
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Ausentes
          </span>
          <p className="text-2xl font-extrabold text-red-600 dark:text-red-400 tabular-nums mt-1">
            {absentCount}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setAttendanceFilter('PENDENTES')}
          className={`text-left p-3.5 sm:p-4 rounded-2xl border transition-colors cursor-pointer ${
            attendanceFilter === 'PENDENTES'
              ? 'bg-amber-50/80 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300'
          }`}
        >
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Não Registrados
          </span>
          <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-400 tabular-nums mt-1">
            {pendingCount}
          </p>
        </button>
      </div>

      {/* Roster Panel */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, e-mail ou matrícula..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-emerald-600 outline-none transition-all min-h-[40px]"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto text-xs font-semibold">
            {(
              [
                { id: 'TODOS', label: 'Todos' },
                { id: 'PRESENTES', label: 'Presentes' },
                { id: 'AUSENTES', label: 'Ausentes' },
                { id: 'PENDENTES', label: 'Pendentes' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setAttendanceFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap min-h-[32px] ${
                  attendanceFilter === f.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {rosterError && (
          <div className="p-6 text-center text-xs text-red-600 dark:text-red-400 flex flex-col items-center gap-2">
            <AlertCircle className="w-6 h-6" />
            <p>{rosterError}</p>
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoadingRoster && (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((row) => (
              <div
                key={row}
                className="h-14 rounded-xl iv-skeleton border border-slate-200/50 dark:border-slate-800"
              />
            ))}
          </div>
        )}

        {/* Empty Roster */}
        {!isLoadingRoster && !rosterError && filteredInscritos.length === 0 && (
          <div className="p-8 sm:p-12 text-center">
            <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2.5" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {totalCount === 0
                ? 'Nenhum participante inscrito neste evento'
                : 'Nenhum inscrito corresponde ao filtro aplicado'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {totalCount === 0
                ? 'Assim que participantes se inscreverem, a lista aparecerá aqui.'
                : 'Altere a busca ou o filtro de frequência para visualizar outros registros.'}
            </p>
          </div>
        )}

        {/* Mobile Cards (< md) */}
        {!isLoadingRoster && !rosterError && filteredInscritos.length > 0 && (
          <div className="md:hidden p-3.5 space-y-3">
            {filteredInscritos.map((inscricao) => {
              const state = getAttendanceState(inscricao.id_inscricao);
              const isSaving = savingId === inscricao.id_inscricao;

              return (
                <div
                  key={`m-att-${inscricao.id_inscricao}`}
                  className="bg-slate-50/70 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-slate-900 dark:text-slate-50 text-sm truncate">
                        {inscricao.usuario_nome || 'Participante'}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {inscricao.usuario_email || 'E-mail não informado'}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                        Matrícula: {inscricao.usuario_matricula || 'S/N'} ·{' '}
                        {new Date(inscricao.data_inscricao).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    {renderStatusLabel(state)}
                  </div>

                  {canManageAttendance && (
                    <div className="pt-2.5 border-t border-slate-200/80 dark:border-slate-700 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleMarkAttendance(inscricao, true)}
                          className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer min-h-[42px] border transition-colors ${
                            state === true
                              ? 'bg-[#16a34a] text-white border-[#15803d]'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                          }`}
                        >
                          {isSaving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>Presente</span>
                        </button>

                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleMarkAttendance(inscricao, false)}
                          className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer min-h-[42px] border transition-colors ${
                            state === false
                              ? 'bg-red-600 text-white border-red-700'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-red-400'
                          }`}
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Ausente</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleEmitirParaAluno(inscricao)}
                        disabled={state !== true}
                        className={`w-full py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] flex items-center justify-center gap-1.5 ${
                          state === true
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 cursor-pointer'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>Emitir Certificado</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Desktop Table (>= md) */}
        {!isLoadingRoster && !rosterError && filteredInscritos.length > 0 && (
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3.5">Participante</th>
                  <th className="px-5 py-3.5">Matrícula / Registro</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-center">Marcar Frequência</th>
                  <th className="px-5 py-3.5 text-right">Certificado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredInscritos.map((inscricao) => {
                  const state = getAttendanceState(inscricao.id_inscricao);
                  const isSaving = savingId === inscricao.id_inscricao;

                  return (
                    <tr
                      key={`att-${inscricao.id_inscricao}`}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                          {inscricao.usuario_nome || 'Participante'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {inscricao.usuario_email || 'Sem e-mail'}
                        </p>
                      </td>

                      <td className="px-5 py-3.5 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <p>{inscricao.usuario_matricula || 'S/N'}</p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          {new Date(inscricao.data_inscricao).toLocaleDateString('pt-BR')}
                        </p>
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {renderStatusLabel(state)}
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            disabled={!canManageAttendance || isSaving}
                            onClick={() => handleMarkAttendance(inscricao, true)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors border whitespace-nowrap ${
                              !canManageAttendance
                                ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                                : state === true
                                ? 'bg-[#16a34a] text-white border-[#15803d] cursor-pointer'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 cursor-pointer'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Presente</span>
                          </button>

                          <button
                            type="button"
                            disabled={!canManageAttendance || isSaving}
                            onClick={() => handleMarkAttendance(inscricao, false)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors border whitespace-nowrap ${
                              !canManageAttendance
                                ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                                : state === false
                                ? 'bg-red-600 text-white border-red-700 cursor-pointer'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-red-400 hover:text-red-700 dark:hover:text-red-300 cursor-pointer'
                            }`}
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Ausente</span>
                          </button>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleEmitirParaAluno(inscricao)}
                          disabled={!canManageAttendance || state !== true}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5 whitespace-nowrap ${
                            canManageAttendance && state === true
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white border border-emerald-200 dark:border-emerald-800 cursor-pointer'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-60'
                          }`}
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>Emitir</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
