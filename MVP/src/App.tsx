import React, { useState, useEffect, useCallback } from 'react';
import { store } from './services/store';
import { Usuario, Evento, Atividade, Inscricao, Certificado, StatusConta } from './types';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { CatalogView } from './components/views/CatalogView';
import { MyRegistrationsView } from './components/views/MyRegistrationsView';
import { MyCertificatesView } from './components/views/MyCertificatesView';
import { ProfileView } from './components/views/ProfileView';
import { ProfessorEventsView } from './components/views/ProfessorEventsView';
import { AttendanceView } from './components/views/AttendanceView';
import { AdminUsersView } from './components/views/AdminUsersView';
import { AdminCertificatesView } from './components/views/AdminCertificatesView';
import { CertificateValidatorView } from './components/views/CertificateValidatorView';
import { CreateEventModal } from './components/modals/CreateEventModal';
import { EditEventModal } from './components/modals/EditEventModal';
import { EventDetailsModal } from './components/modals/EventDetailsModal';
import { LoginView } from './components/auth/LoginView';
import { RegisterView } from './components/auth/RegisterView';
import { ForgotPasswordView } from './components/auth/ForgotPasswordView';
import { ResetPasswordView } from './components/auth/ResetPasswordView';
import { VerifyEmailView } from './components/auth/VerifyEmailView';
import { Logo } from './components/common/Logo';
import { Check, AlertCircle, RotateCcw, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function App() {
  // Check URL for email verification token (?verify_token=...)
  const [verifyToken, setVerifyToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('verify_token');
  });

  // Authentication & Session Flow
  const [authToken, setAuthToken] = useState<string | null>(() => store.getToken());
  const [isCheckingSession, setIsCheckingSession] = useState<boolean>(() => Boolean(store.getToken()));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authView, setAuthView] = useState<
    'login' | 'register' | 'forgot_password' | 'reset_password'
  >('login');

  // Reactive Store States
  const [currentUser, setCurrentUser] = useState<Usuario>(store.getCurrentUser());
  const [allUsers, setAllUsers] = useState<Usuario[]>(store.getUsuarios());
  const [eventos, setEventos] = useState<Evento[]>(store.getEventos());
  const [atividades, setAtividades] = useState<Atividade[]>(store.getAtividades());
  const [inscricoes, setInscricoes] = useState<Inscricao[]>(store.getInscricoes());
  const [certificados, setCertificados] = useState<Certificado[]>(store.getCertificados());
  const [favoritos, setFavoritos] = useState<number[]>(store.getFavoritos());
  const [solicitacoesCertificado, setSolicitacoesCertificado] = useState(
    store.getSolicitacoesCertificado()
  );

  // UI State
  const [activeTab, setActiveTab] = useState<ActiveTab>('eventos');
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalEvento, setEditModalEvento] = useState<Evento | null>(null);
  const [detailsModalEvento, setDetailsModalEvento] = useState<Evento | null>(null);

  // Global Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3800);
  }, []);

  // Clean URL query param once captured
  useEffect(() => {
    if (verifyToken && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('verify_token')) {
        url.searchParams.delete('verify_token');
        window.history.replaceState({}, '', url.pathname + url.search);
      }
    }
  }, [verifyToken]);

  // Fetch admin directory & professor requests from backend
  const fetchAdminUsers = useCallback(async (tokenOverride?: string) => {
    const tokenToUse = tokenOverride ?? store.getToken();
    if (!tokenToUse) return;

    try {
      const [usersRes, profRes] = await Promise.all([
        fetch('/api/admin/users', {
          headers: { Authorization: `Bearer ${tokenToUse}` },
        }),
        fetch('/api/admin/professors', {
          headers: { Authorization: `Bearer ${tokenToUse}` },
        }),
      ]);

      const merged: Usuario[] = [];
      if (usersRes.ok) {
        const usersData = await usersRes.json().catch(() => ({}));
        if (Array.isArray(usersData.users)) merged.push(...usersData.users);
      }
      if (profRes.ok) {
        const profData = await profRes.json().catch(() => ({}));
        if (Array.isArray(profData.professors)) merged.push(...profData.professors);
      }

      if (merged.length > 0) {
        store.setUsuariosFromServer(merged);
        setAllUsers(store.getUsuarios());
      }
    } catch {
      // Keep cached users if offline
    }
  }, []);

  // Hydrate & validate saved session on mount (skip while handling ?verify_token=...)
  useEffect(() => {
    if (verifyToken) {
      setIsCheckingSession(false);
      return;
    }

    const savedToken = store.getToken();
    if (!savedToken) {
      setIsCheckingSession(false);
      setIsAuthenticated(false);
      return;
    }

    let cancelled = false;
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${savedToken}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Sessão inválida');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data?.success && data?.user) {
          store.setCurrentUser(data.user);
          setCurrentUser(data.user);
          setAuthToken(savedToken);
          setIsAuthenticated(true);
          setActiveTab(data.user.perfil === 'PARTICIPANTE' ? 'eventos' : 'meus_eventos');
          if (data.user.perfil === 'ADMINISTRADOR') {
            fetchAdminUsers(savedToken);
          }
        } else {
          throw new Error('Sessão inválida');
        }
      })
      .catch(() => {
        if (cancelled) return;
        store.setToken(null);
        setAuthToken(null);
        setIsAuthenticated(false);
      })
      .finally(() => {
        if (!cancelled) setIsCheckingSession(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchAdminUsers, verifyToken]);

  // Sync with Store changes
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
      setAllUsers(store.getUsuarios());
      setEventos(store.getEventos());
      setAtividades(store.getAtividades());
      setInscricoes(store.getInscricoes());
      setCertificados(store.getCertificados());
      setFavoritos(store.getFavoritos());
      setSolicitacoesCertificado(store.getSolicitacoesCertificado());
    });
    return unsubscribe;
  }, []);

  // Real auth success handler
  const handleAuthSuccess = (user: Usuario, token: string) => {
    store.setToken(token);
    setAuthToken(token);
    store.setCurrentUser(user);
    setCurrentUser(user);
    setIsAuthenticated(true);
    setActiveTab(user.perfil === 'PARTICIPANTE' ? 'eventos' : 'meus_eventos');

    if (user.perfil === 'ADMINISTRADOR') {
      fetchAdminUsers(token);
    }
  };

  // Switch Demo User via backend so signed Bearer token matches role
  const handleSwitchUser = async (email: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, isDemoQuickLogin: true }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        showToast(data.message || 'Não foi possível alternar para este perfil.', 'error');
        return;
      }

      handleAuthSuccess(data.user, data.token);
      showToast(`Perfil alterado para ${data.user.nome} (${data.user.perfil})`);
    } catch {
      showToast('Erro de comunicação ao alternar perfil de demonstração.', 'error');
    }
  };

  const handleLogout = () => {
    store.setToken(null);
    setAuthToken(null);
    setIsAuthenticated(false);
    setAuthView('login');
  };

  // Filtered Events by search term
  const displayedEventos = searchTerm.trim()
    ? eventos.filter(
        (e) =>
          e.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.local.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.descricao.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : eventos;

  // Participant Inscription Check
  const participantInscriptions = inscricoes.filter(
    (i) => i.id_usuario === currentUser.id_usuario && i.status === 'CONFIRMADA'
  );
  const participantSubscribedEventIds = participantInscriptions
    .map((i) => i.evento_id)
    .filter((id): id is number => typeof id === 'number');

  // Protected Event Inscription (enforces verified student on backend)
  const handleInscrever = async (id_evento: number) => {
    if (!authToken) {
      showToast('Faça login novamente para se inscrever.', 'error');
      return;
    }

    try {
      const response = await fetch(`/api/events/${id_evento}/inscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        showToast(data.message || 'Não foi possível concluir a inscrição.', 'error');
        return;
      }

      const localRes = store.inscrever(id_evento, currentUser.id_usuario);
      showToast(data.message || localRes.message, 'success');
      confetti({ particleCount: 50, spread: 60 });
    } catch {
      showToast('Erro de conexão ao registrar inscrição no evento.', 'error');
    }
  };

  // Cancel Inscription
  const handleCancelarInscricao = (id_inscricao: number) => {
    store.cancelarInscricao(id_inscricao);
    showToast('Inscrição cancelada com sucesso.');
    if (detailsModalEvento) {
      setDetailsModalEvento(null);
    }
  };

  // Create Event (enforces approved professor or admin on backend)
  const handleCreateEvento = async (
    novo: Omit<Evento, 'id_evento' | 'created_at' | 'inscritos_count'>
  ) => {
    if (!authToken) {
      showToast('Sessão expirada. Faça login novamente.', 'error');
      return;
    }

    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(novo),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        showToast(data.message || 'Sem permissão para criar eventos.', 'error');
        return;
      }

      store.createEvento(novo);
      showToast('Evento criado com sucesso!');
      confetti({ particleCount: 50, spread: 60 });
    } catch {
      showToast('Erro de conexão ao criar evento.', 'error');
    }
  };

  // Admin: Professor Approval / Rejection
  const handleProfessorDecision = async (
    id_usuario: number,
    decisao: 'APROVAR' | 'RECUSAR',
    motivo?: string
  ) => {
    if (!authToken) {
      throw new Error('Sessão administrativa expirada. Faça login novamente.');
    }

    const response = await fetch(`/api/admin/professors/${id_usuario}/decision`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ decision: decisao, motivo }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Erro ao registrar decisão administrativa.');
    }

    if (data.professor) {
      store.setUsuariosFromServer([data.professor]);
    } else {
      store.moderarUsuario(id_usuario, decisao, motivo);
    }
    setAllUsers(store.getUsuarios());
  };

  // Admin: General User Status Governance
  const handleUpdateUserStatus = async (id_usuario: number, status: StatusConta) => {
    if (!authToken) {
      throw new Error('Sessão administrativa expirada. Faça login novamente.');
    }

    const response = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ userId: id_usuario, status }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Erro ao atualizar status da conta.');
    }

    if (data.user) {
      store.setUsuariosFromServer([data.user]);
      setAllUsers(store.getUsuarios());
    }
  };

  // 1. Dedicated Email Verification Landing Page (?verify_token=...)
  if (verifyToken) {
    return (
      <VerifyEmailView
        token={verifyToken}
        onGoToLogin={() => {
          setVerifyToken(null);
          setIsAuthenticated(false);
          setAuthView('login');
        }}
        onAuthSuccess={(user, token) => {
          setVerifyToken(null);
          handleAuthSuccess(user, token);
          confetti({ particleCount: 50, spread: 60 });
          showToast('E-mail confirmado! Bem-vindo(a) ao IFCE Iventus.');
        }}
      />
    );
  }

  // 2. Session Hydration Spinner
  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 gap-4">
        <Logo size="lg" showText={false} />
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
          <span>Validando sessão acadêmica...</span>
        </div>
      </div>
    );
  }

  // 3. Unauthenticated Screens
  if (!isAuthenticated) {
    if (authView === 'register') {
      return (
        <RegisterView
          onRegisterSuccess={(createdUser) => {
            if (createdUser) {
              store.addCreatedUser(createdUser);
              setAllUsers(store.getUsuarios());
              confetti({ particleCount: 50, spread: 60 });
            }
          }}
          onAuthSuccess={(user, token) => {
            handleAuthSuccess(user, token);
            confetti({ particleCount: 50, spread: 60 });
            showToast('E-mail confirmado! Bem-vindo(a) ao IFCE Iventus.');
          }}
          onGoToLogin={() => setAuthView('login')}
        />
      );
    }
    if (authView === 'forgot_password') {
      return (
        <ForgotPasswordView
          onGoToLogin={() => setAuthView('login')}
          onGoToResetPassword={() => setAuthView('reset_password')}
        />
      );
    }
    if (authView === 'reset_password') {
      return <ResetPasswordView onGoToLogin={() => setAuthView('login')} />;
    }

    return (
      <LoginView
        onAuthSuccess={handleAuthSuccess}
        onGoToRegister={() => setAuthView('register')}
        onGoToForgotPassword={() => setAuthView('forgot_password')}
      />
    );
  }

  // Count pending moderation badges (ONLY professors for User Management)
  const pendingProfessorsCount = allUsers.filter(
    (u) => u.perfil === 'PROFESSOR' && u.status_conta === 'PENDENTE'
  ).length;
  const pendingCertificatesCount = solicitacoesCertificado.filter(
    (s) => s.status_moderacao === 'PENDENTE'
  ).length;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans overflow-x-hidden">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50 animate-in slide-in-from-top-3 duration-200">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2.5 border ${
              toast.type === 'success'
                ? 'bg-emerald-800 text-white border-emerald-700'
                : 'bg-red-700 text-white border-red-600'
            }`}
          >
            {toast.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-300 stroke-[3] shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-300 stroke-[3] shrink-0" />
            )}
            <span className="leading-snug">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Main Top Header Navbar */}
      <Navbar
        currentUser={currentUser}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onSwitchUser={handleSwitchUser}
        onOpenProfile={() => setActiveTab('configuracoes')}
        onLogout={handleLogout}
        allUsers={allUsers}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleCollapseDesktop={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isCollapsedDesktop={isSidebarCollapsed}
      />

      {/* Body: Sidebar + Main Content Layout */}
      <div className="flex-1 flex overflow-x-hidden relative">
        <Sidebar
          userRole={currentUser.perfil}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          pendingProfessorsCount={pendingProfessorsCount}
          pendingCertificatesCount={pendingCertificatesCount}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          isCollapsedDesktop={isSidebarCollapsed}
          onToggleCollapseDesktop={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 pb-24 lg:pb-8 overflow-y-auto max-w-7xl mx-auto w-full min-w-0">
          {/* TAB: EVENTOS (Catálogo do Participante) */}
          {activeTab === 'eventos' && (
            <CatalogView
              eventos={displayedEventos}
              favoritos={favoritos}
              onToggleFavorito={(id) => store.toggleFavorito(id)}
              onOpenDetails={(evento) => setDetailsModalEvento(evento)}
              onQuickInscrever={handleInscrever}
              inscricoesIds={participantSubscribedEventIds}
            />
          )}

          {/* TAB: MINHAS INSCRIÇÕES (Participante) */}
          {activeTab === 'minhas_inscricoes' && (
            <MyRegistrationsView
              inscricoes={participantInscriptions}
              eventos={eventos}
              favoritos={favoritos}
              onToggleFavorito={(id) => store.toggleFavorito(id)}
              onOpenDetails={(evento) => setDetailsModalEvento(evento)}
              onCancelarInscricao={handleCancelarInscricao}
            />
          )}

          {/* TAB: CERTIFICADOS (Participante) */}
          {activeTab === 'certificados' && (
            <MyCertificatesView
              certificados={certificados.filter(
                (c) => c.participante_nome === currentUser.nome || c.id_certificado <= 4
              )}
            />
          )}

          {/* TAB: MEUS EVENTOS (Professor & Admin) */}
          {activeTab === 'meus_eventos' && (
            <ProfessorEventsView
              eventos={displayedEventos}
              onOpenCreateModal={() => setCreateModalOpen(true)}
              onOpenEditModal={(evento) => setEditModalEvento(evento)}
              onOpenDetailsModal={(evento) => setDetailsModalEvento(evento)}
            />
          )}

          {/* TAB: INSCRIÇÕES & FREQUÊNCIA (Professor) */}
          {activeTab === 'inscritos_frequencia' && (
            <AttendanceView
              inscricoes={inscricoes}
              eventos={eventos}
              onTogglePresenca={(id) => store.togglePresenca(id)}
              isPresente={(id) => store.isPresente(id)}
              onEmitirCertificado={(nome, mat, evt) => {
                store.emitirCertificado(nome, mat, evt);
              }}
            />
          )}

          {/* TAB: APROVAÇÃO E GESTÃO DE USUÁRIOS (Administrador) */}
          {activeTab === 'moderacao_usuarios' && (
            <AdminUsersView
              usuarios={allUsers}
              authToken={authToken}
              onProfessorDecision={handleProfessorDecision}
              onUpdateUserStatus={handleUpdateUserStatus}
              onRefreshFromServer={() => fetchAdminUsers()}
            />
          )}

          {/* TAB: MODERAÇÃO DE CERTIFICADOS (Administrador) */}
          {activeTab === 'moderacao_certificados' && (
            <AdminCertificatesView
              solicitacoes={solicitacoesCertificado}
              onModerar={(id, decisao) => store.moderarCertificado(id, decisao)}
            />
          )}

          {/* TAB: CONFIGURAÇÕES / MEU PERFIL */}
          {activeTab === 'configuracoes' && (
            <div className="space-y-6 max-w-4xl">
              <ProfileView
                currentUser={currentUser}
                onUpdateProfile={(updates) => {
                  store.updateProfile(currentUser.id_usuario, updates);
                  showToast('Perfil atualizado com sucesso!');
                }}
              />

              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
                <h4 className="text-sm font-bold text-slate-800 mb-1">
                  Ambiente de Demonstração do IFCE Iventus
                </h4>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                  Restaure os eventos e certificados de demonstração armazenados localmente no
                  navegador para os valores originais.
                </p>
                <button
                  onClick={() => {
                    store.resetToDefaults();
                    showToast('Base de demonstração local restaurada!');
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors cursor-pointer min-h-[40px]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurar dados padrão</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB: VALIDADOR PÚBLICO DE CERTIFICADOS */}
          {activeTab === 'validar_certificado' && (
            <CertificateValidatorView
              onValidate={(cod) => store.validarCertificado(cod)}
              certificados={certificados}
            />
          )}
        </main>
      </div>

      {/* Modal: Criando Evento */}
      <CreateEventModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateEvento}
        organizadorId={currentUser.id_usuario}
      />

      {/* Modal: Editando Evento */}
      <EditEventModal
        evento={editModalEvento}
        isOpen={Boolean(editModalEvento)}
        onClose={() => setEditModalEvento(null)}
        onSave={(id, updates) => {
          store.updateEvento(id, updates);
          showToast('Alterações salvas no evento!');
        }}
      />

      {/* Modal: Visualizando Detalhes do Evento */}
      <EventDetailsModal
        evento={detailsModalEvento}
        isOpen={Boolean(detailsModalEvento)}
        onClose={() => setDetailsModalEvento(null)}
        userRole={currentUser.perfil}
        isInscrito={
          detailsModalEvento
            ? participantSubscribedEventIds.includes(detailsModalEvento.id_evento)
            : false
        }
        isFavorito={
          detailsModalEvento ? favoritos.includes(detailsModalEvento.id_evento) : false
        }
        onToggleFavorito={(id) => store.toggleFavorito(id)}
        onInscrever={(id) => {
          handleInscrever(id);
          setDetailsModalEvento(null);
        }}
        onCancelarInscricao={() => {
          if (detailsModalEvento) {
            const insc = participantInscriptions.find(
              (i) => i.evento_id === detailsModalEvento.id_evento
            );
            if (insc) handleCancelarInscricao(insc.id_inscricao);
          }
        }}
        atividades={atividades}
      />

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        userRole={currentUser.perfil}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        pendingProfessorsCount={pendingProfessorsCount}
        pendingCertificatesCount={pendingCertificatesCount}
        onOpenCreateModal={() => setCreateModalOpen(true)}
      />
    </div>
  );
}
