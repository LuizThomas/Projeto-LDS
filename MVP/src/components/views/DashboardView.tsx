import React from 'react';
import {
  Calendar,
  Ticket,
  Award,
  Users,
  GraduationCap,
  CheckCircle2,
  Clock,
  ArrowRight,
  Plus,
  FileCheck2,
  ClipboardCheck,
  Sparkles,
  MapPin,
} from 'lucide-react';
import { Usuario, Evento, Inscricao, Certificado, SolicitacaoCertificadoModeracao } from '../../types';
import { ActiveTab } from '../layout/Sidebar';
import { EventBanner } from '../../utils/eventImages';

interface DashboardViewProps {
  currentUser: Usuario;
  eventos: Evento[];
  inscricoes: Inscricao[];
  certificados: Certificado[];
  allUsers: Usuario[];
  solicitacoesCertificado: SolicitacaoCertificadoModeracao[];
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenDetails: (evento: Evento) => void;
  onOpenCreateModal: () => void;
  onOpenAttendanceForEvent: (eventoId: number) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  eventos,
  inscricoes,
  certificados,
  allUsers,
  solicitacoesCertificado,
  onNavigateTab,
  onOpenDetails,
  onOpenCreateModal,
  onOpenAttendanceForEvent,
}) => {
  const role = currentUser.perfil;

  const publishedEvents = eventos.filter((e) => e.status === 'PUBLICADO');
  const myOwnedEvents = eventos.filter((e) => e.id_organizador === currentUser.id_usuario);
  const myOwnedEventIds = new Set(myOwnedEvents.map((e) => e.id_evento));

  const activeInscriptions = inscricoes.filter((i) => i.status === 'CONFIRMADA');
  const participantInscriptions = activeInscriptions.filter(
    (i) => i.id_usuario === currentUser.id_usuario
  );
  const professorEventInscriptions = activeInscriptions.filter(
    (i) => i.evento_id && myOwnedEventIds.has(i.evento_id)
  );
  const professorPresentCount = professorEventInscriptions.filter(
    (i) => i.presente === true
  ).length;

  const participantPresentCount = participantInscriptions.filter(
    (i) => i.presente === true
  ).length;
  const participantCertificates = certificados.filter(
    (c) => c.participante_nome?.toLowerCase() === currentUser.nome.toLowerCase()
  );

  const pendingProfessors = allUsers.filter(
    (u) => u.perfil === 'PROFESSOR' && u.status_conta === 'PENDENTE'
  );
  const pendingCertificates = solicitacoesCertificado.filter(
    (s) => s.status_moderacao === 'PENDENTE'
  );

  const upcomingEvents = (
    role === 'PARTICIPANTE'
      ? publishedEvents
      : role === 'PROFESSOR'
      ? myOwnedEvents.length > 0
        ? myOwnedEvents
        : publishedEvents
      : eventos
  ).slice(0, 4);

  const firstName = (currentUser.nome || 'Usuário').split(' ')[0];

  const kpis =
    role === 'ADMINISTRADOR'
      ? [
          {
            label: 'Eventos na Plataforma',
            value: eventos.length,
            helper: `${publishedEvents.length} publicados ativos`,
            icon: Calendar,
            accent: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50',
            onClick: () => onNavigateTab('meus_eventos'),
          },
          {
            label: 'Professores Pendentes',
            value: pendingProfessors.length,
            helper: 'Aguardando aprovação',
            icon: GraduationCap,
            accent: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50',
            onClick: () => onNavigateTab('moderacao_usuarios'),
          },
          {
            label: 'Inscrições Ativas',
            value: activeInscriptions.length,
            helper: 'Total confirmado',
            icon: Ticket,
            accent: 'text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/50',
            onClick: () => onNavigateTab('minhas_inscricoes'),
          },
          {
            label: 'Certificados Pendentes',
            value: pendingCertificates.length,
            helper: `${certificados.length} emitidos no total`,
            icon: Award,
            accent: 'text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/50',
            onClick: () => onNavigateTab('moderacao_certificados'),
          },
        ]
      : role === 'PROFESSOR'
      ? [
          {
            label: 'Eventos Coordenados',
            value: myOwnedEvents.length,
            helper: `${myOwnedEvents.filter((e) => e.status === 'PUBLICADO').length} publicados`,
            icon: Calendar,
            accent: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50',
            onClick: () => onNavigateTab('meus_eventos'),
          },
          {
            label: 'Inscritos nos Meus Eventos',
            value: professorEventInscriptions.length,
            helper: 'Participações confirmadas',
            icon: Users,
            accent: 'text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/50',
            onClick: () => onNavigateTab('inscritos_frequencia'),
          },
          {
            label: 'Presenças Registradas',
            value: professorPresentCount,
            helper:
              professorEventInscriptions.length > 0
                ? `${Math.round((professorPresentCount / professorEventInscriptions.length) * 100)}% de frequência`
                : 'Sem registros ainda',
            icon: ClipboardCheck,
            accent: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50',
            onClick: () => onNavigateTab('inscritos_frequencia'),
          },
          {
            label: 'Catálogo Institucional',
            value: publishedEvents.length,
            helper: 'Eventos abertos no IFCE',
            icon: Sparkles,
            accent: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50',
            onClick: () => onNavigateTab('eventos'),
          },
        ]
      : [
          {
            label: 'Eventos Disponíveis',
            value: publishedEvents.length,
            helper: 'Com inscrições abertas',
            icon: Calendar,
            accent: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50',
            onClick: () => onNavigateTab('eventos'),
          },
          {
            label: 'Minhas Inscrições',
            value: participantInscriptions.length,
            helper: 'Participações ativas',
            icon: Ticket,
            accent: 'text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/50',
            onClick: () => onNavigateTab('minhas_inscricoes'),
          },
          {
            label: 'Presenças Confirmadas',
            value: participantPresentCount,
            helper: 'Validadas pelo docente',
            icon: CheckCircle2,
            accent: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50',
            onClick: () => onNavigateTab('minhas_inscricoes'),
          },
          {
            label: 'Certificados Obtidos',
            value: participantCertificates.length,
            helper: 'Prontos para download',
            icon: Award,
            accent: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50',
            onClick: () => onNavigateTab('certificados'),
          },
        ];

  return (
    <div className="space-y-6 iv-fade-up">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            {role === 'ADMINISTRADOR'
              ? 'Painel da Coordenação Administrativa'
              : role === 'PROFESSOR'
              ? 'Painel Acadêmico do Docente'
              : 'Painel do Participante IFCE'}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight mt-0.5">
            Olá, {firstName}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            {role === 'ADMINISTRADOR'
              ? 'Acompanhe eventos científicos, aprove solicitações de professores e supervise inscrições e certificados.'
              : role === 'PROFESSOR'
              ? 'Gerencie seus eventos publicados, controle presenças por evento e acompanhe o catálogo institucional.'
              : 'Descubra eventos científicos abertos, acompanhe suas inscrições, frequência e emita seus certificados.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {(role === 'PROFESSOR' || role === 'ADMINISTRADOR') && (
            <button
              type="button"
              onClick={onOpenCreateModal}
              className="px-4 py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer min-h-[42px] whitespace-nowrap"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Criar Evento</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigateTab('eventos')}
            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer min-h-[42px] whitespace-nowrap"
          >
            <span>Explorar Eventos</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <button
              key={kpi.label}
              type="button"
              onClick={kpi.onClick}
              className="text-left bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 p-4 sm:p-5 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {kpi.label}
                </span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${kpi.accent}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-50 tabular-nums mt-2.5">
                {kpi.value}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
                <span className="truncate">{kpi.helper}</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-emerald-600 dark:text-emerald-400 transition-opacity shrink-0" />
              </p>
            </button>
          );
        })}
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Upcoming / Highlighted Events */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50">
                {role === 'PROFESSOR' && myOwnedEvents.length > 0
                  ? 'Seus Eventos Recentes'
                  : 'Próximos Eventos Científicos'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Programação em destaque no IFCE Iventus
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab(role === 'PARTICIPANTE' ? 'eventos' : 'meus_eventos')}
              className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <span>Ver todos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 flex-1">
            {upcomingEvents.length === 0 ? (
              <div className="p-8 text-center">
                <Calendar className="w-9 h-9 text-slate-300 dark:text-slate-700 mx-auto mb-2.5" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Nenhum evento encontrado
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Novos eventos científicos aparecerão aqui assim que forem publicados.
                </p>
              </div>
            ) : (
              upcomingEvents.map((ev) => (
                <div
                  key={ev.id_evento}
                  className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-16 h-12 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                      <EventBanner evento={ev} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                        {ev.titulo}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate flex items-center gap-1.5">
                        <span>{ev.data_formatada || ev.data_inicio}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {ev.local}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 shrink-0">
                    {role === 'PROFESSOR' && ev.id_organizador === currentUser.id_usuario && (
                      <button
                        type="button"
                        onClick={() => onOpenAttendanceForEvent(ev.id_evento)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Presença
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenDetails(ev)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer whitespace-nowrap"
                    >
                      Detalhes
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Role Operations & Shortcuts */}
        <div className="lg:col-span-5 space-y-5">
          {role === 'ADMINISTRADOR' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50">
                  Fila de Aprovação Docente
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigateTab('moderacao_usuarios')}
                  className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Gerenciar
                </button>
              </div>
              {pendingProfessors.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                  Nenhuma solicitação de professor pendente no momento.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pendingProfessors.slice(0, 3).map((prof) => (
                    <div key={prof.id_usuario} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {prof.nome}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {prof.materias || prof.email}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 shrink-0">
                        <Clock className="w-3.5 h-3.5" />
                        Pendente
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {role === 'PROFESSOR' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50">
                  Controle Rápido de Frequência
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigateTab('inscritos_frequencia')}
                  className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Abrir módulo
                </button>
              </div>
              {myOwnedEvents.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                  Crie seu primeiro evento para gerenciar inscritos e registrar presença por evento.
                </p>
              ) : (
                <div className="space-y-2">
                  {myOwnedEvents.slice(0, 3).map((ev) => (
                    <button
                      key={ev.id_evento}
                      type="button"
                      onClick={() => onOpenAttendanceForEvent(ev.id_evento)}
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {ev.titulo}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                          {ev.inscritos_count || 0} inscritos confirmados
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {role === 'PARTICIPANTE' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50">
                  Suas Inscrições Recentes
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigateTab('minhas_inscricoes')}
                  className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Ver todas
                </button>
              </div>
              {participantInscriptions.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                  Você ainda não possui inscrições ativas. Explore os eventos ao lado para participar.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {participantInscriptions.slice(0, 3).map((insc) => (
                    <div key={insc.id_inscricao} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {insc.evento_titulo}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {insc.evento_data || 'Programação IFCE'}
                        </p>
                      </div>
                      <span
                        className={`text-[11px] font-semibold shrink-0 ${
                          insc.presente === true
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : insc.presente === false
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {insc.presente === true
                          ? 'Presente'
                          : insc.presente === false
                          ? 'Ausente'
                          : 'Confirmada'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quick Shortcuts */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50">
              Atalhos de Navegação
            </h2>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onNavigateTab('eventos')}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer flex items-center gap-2"
              >
                <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">Eventos</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('minhas_inscricoes')}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer flex items-center gap-2"
              >
                <Ticket className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <span className="truncate">Inscrições</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onNavigateTab(
                    role === 'PARTICIPANTE'
                      ? 'certificados'
                      : role === 'PROFESSOR'
                      ? 'inscritos_frequencia'
                      : 'moderacao_usuarios'
                  )
                }
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer flex items-center gap-2"
              >
                {role === 'ADMINISTRADOR' ? (
                  <Users className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                ) : role === 'PROFESSOR' ? (
                  <ClipboardCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <Award className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                )}
                <span className="truncate">
                  {role === 'ADMINISTRADOR'
                    ? 'Professores'
                    : role === 'PROFESSOR'
                    ? 'Inscritos'
                    : 'Certificados'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('validar_certificado')}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer flex items-center gap-2"
              >
                <FileCheck2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">Validar Código</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
