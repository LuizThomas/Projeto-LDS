import React, { useState, useEffect, useCallback } from 'react';
import { store } from './services/store';
import {
  Usuario,
  Evento,
  Atividade,
  Inscricao,
  Certificado,
  Frequencia,
  StatusConta,
} from './types';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { DashboardView } from './components/views/DashboardView';
import { CatalogView } from './components/views/CatalogView';
import { MyRegistrationsView } from './components/views/MyRegistrationsView';
import { MyCertificatesView } from './components/views/MyCertificatesView';
import { ProfileView } from './components/views/ProfileView';
import { ProfessorEventsView } from './components/views/ProfessorEventsView';
import { AttendanceView, EventAttendancePayload } from './components/views/AttendanceView';
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
import { useTheme } from './utils/theme';
import { Check, AlertCircle, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';

async function apiFetch(
  url: string,
  options: RequestInit = {},
  tokenOverride?: string | null
): Promise<Response> {
  const token = tokenOverride !== undefined ? tokenOverride : store.getToken();
  const headers = new Headers(options.headers || {});
  headers.set('X-Requested-With', 'XMLHttpRequest');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });
}

export default function App() {
  useTheme();

  const [verifyToken, setVerifyToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('verify_token');
  });

  const [resetToken, setResetToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('reset_token');
  });

  const [authToken, setAuthToken] = useState<string | null>(() => store.getToken());
  const [isCheckingSession, setIsCheckingSession] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [demoMode, setDemoMode] = useState<boolean>(false);
  const [needsAdminSetup, setNeedsAdminSetup] = useState<boolean>(false);
  const [resetEmailHint, setResetEmailHint] = useState<string>('');
  const [authView, setAuthView] = useState<
    'login' | 'register' | 'forgot_password' | 'reset_password'
  >(() => (resetToken ? 'reset_password' : 'login'));

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
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedAttendanceEventId, setSelectedAttendanceEventId] = useState<number | null>(null);
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

  // Clean query tokens from browser address bar once captured
  useEffect(() => {
    if ((verifyToken || resetToken) && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      let changed = false;
      if (url.searchParams.has('verify_token')) {
        url.searchParams.delete('verify_token');
        changed = true;
      }
      if (url.searchParams.has('reset_token')) {
        url.searchParams.delete('reset_token');
        changed = true;
      }
      if (changed) {
        window.history.replaceState({}, '', url.pathname + url.search);
      }
    }
  }, [verifyToken, resetToken]);

  const fetchWorkspace = useCallback(async (tokenOverride?: string | null) => {
    try {
      const res = await apiFetch('/api/workspace', {}, tokenOverride);
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data?.success) {
        store.hydrateWorkspace({
          eventos: data.eventos,
          atividades: data.atividades,
          inscricoes: data.inscricoes,
          frequencias: data.frequencias,
          certificados: data.certificados,
          favoritos: data.favoritos,
          solicitacoesCertificado: data.solicitacoesCertificado,
        });
      }
    } catch {
      // ignore network interruptions
    }
  }, []);

  const fetchAdminUsers = useCallback(async (tokenOverride?: string | null) => {
    try {
      const [usersRes, profRes] = await Promise.all([
        apiFetch('/api/admin/users', {}, tokenOverride),
        apiFetch('/api/admin/professors', {}, tokenOverride),
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
      // ignore
    }
  }, []);

  // Bootstrap status + Cookie/Session hydration on mount
  useEffect(() => {
    let cancelled = false;

    async function bootstrapApp() {
      try {
        const bootRes = await apiFetch('/api/auth/bootstrap');
        const bootData = await bootRes.json().catch(() => ({}));
        if (!cancelled && bootRes.ok && bootData?.success) {
          const isDemo = Boolean(bootData.demoMode);
          setDemoMode(isDemo);
          store.setDemoMode(isDemo);
          setNeedsAdminSetup(Boolean(bootData.needsAdminSetup));
        }
      } catch {
        // ignore bootstrap warning
      }

      if (verifyToken || resetToken) {
        if (!cancelled) setIsCheckingSession(false);
        return;
      }

      try {
        const meRes = await apiFetch('/api/auth/me');
        if (!meRes.ok) throw new Error('Sessão não ativa');
        const meData = await meRes.json();
        if (cancelled) return;

        if (meData?.success && meData?.user) {
          store.setCurrentUser(meData.user);
          setCurrentUser(meData.user);
          setIsAuthenticated(true);
          setActiveTab('dashboard');
          await fetchWorkspace();
          if (meData.user.perfil === 'ADMINISTRADOR') {
            await fetchAdminUsers();
          }
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        if (!cancelled) {
          store.clearSession();
          setAuthToken(null);
          setIsAuthenticated(false);
        }
      } finally {
        if (!cancelled) setIsCheckingSession(false);
      }
    }

    bootstrapApp();
    return () => {
      cancelled = true;
    };
  }, [fetchAdminUsers, fetchWorkspace, verifyToken, resetToken]);

  // Sync reactive store subscriptions
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

  const handleAuthSuccess = async (user: Usuario, token: string) => {
    store.setToken(token);
    setAuthToken(token);
    store.setCurrentUser(user);
    setCurrentUser(user);
    setIsAuthenticated(true);
    setActiveTab('dashboard');

    await fetchWorkspace(token);
    if (user.perfil === 'ADMINISTRADOR') {
      await fetchAdminUsers(token);
    }
  };

  // Switch Demo User ONLY in demo mode
  const handleSwitchUser = async (email: string) => {
    if (!demoMode) return;
    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, isDemoQuickLogin: true }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        showToast(data.message || 'Não foi possível alternar para este perfil.', 'error');
        return;
      }

      await handleAuthSuccess(data.user, data.token);
      showToast(`Perfil alterado para ${data.user.nome} (${data.user.perfil})`);
    } catch {
      showToast('Erro de comunicação ao alternar perfil de demonstração.', 'error');
    }
  };

  const handleLogout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    store.clearSession();
    setAuthToken(null);
    setIsAuthenticated(false);
    setSelectedAttendanceEventId(null);
    setAuthView('login');
  };

  const displayedEventos = searchTerm.trim()
    ? eventos.filter(
        (e) =>
          e.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.local.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.descricao.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : eventos;

  const participantInscriptions = inscricoes.filter(
    (i) => i.id_usuario === currentUser.id_usuario && i.status === 'CONFIRMADA'
  );
  const participantSubscribedEventIds = participantInscriptions
    .map((i) => i.evento_id)
    .filter((id): id is number => typeof id === 'number');

  const handleInscrever = async (id_evento: number) => {
    try {
      const response = await apiFetch(`/api/events/${id_evento}/inscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        showToast(data.message || 'Não foi possível concluir a inscrição.', 'error');
        return;
      }

      if (data.inscricao) {
        store.addInscricaoFromServer(data.inscricao);
      }
      showToast(data.message || 'Inscrição confirmada com sucesso!', 'success');
      confetti({ particleCount: 50, spread: 60 });
    } catch {
      showToast('Erro de conexão ao registrar inscrição no evento.', 'error');
    }
  };

  const handleCancelarInscricao = async (id_inscricao: number) => {
    try {
      const response = await apiFetch(`/api/inscriptions/${id_inscricao}`, {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        showToast(data.message || 'Erro ao cancelar inscrição.', 'error');
        return;
      }
      store.cancelarInscricao(id_inscricao);
      showToast('Inscrição cancelada com sucesso.');
      if (detailsModalEvento) {
        setDetailsModalEvento(null);
      }
    } catch {
      showToast('Erro de conexão ao cancelar inscrição.', 'error');
    }
  };

  const handleToggleFavorito = async (id_evento: number) => {
    store.toggleFavorito(id_evento);
    try {
      const res = await apiFetch(`/api/favorites/${id_evento}`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.favoritos)) {
        store.setFavoritosFromServer(data.favoritos);
      }
    } catch {
      // keep optimistic UI if offline
    }
  };

  const handleCreateEvento = async (
    novo: Omit<Evento, 'id_evento' | 'created_at' | 'inscritos_count'>
  ) => {
    try {
      const response = await apiFetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novo),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        showToast(data.message || 'Sem permissão para criar eventos.', 'error');
        return;
      }

      if (data.evento) {
        store.upsertEventoFromServer(data.evento, data.atividade);
      }
      showToast('Evento criado e salvo com sucesso!');
      confetti({ particleCount: 50, spread: 60 });
    } catch {
      showToast('Erro de conexão ao criar evento.', 'error');
    }
  };

  const handleSaveEvento = async (id_evento: number, updates: Partial<Evento>) => {
    try {
      const response = await apiFetch(`/api/events/${id_evento}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        showToast(data.message || 'Não foi possível salvar alterações no evento.', 'error');
        return;
      }
      if (data.evento) {
        store.upsertEventoFromServer(data.evento);
      }
      showToast('Alterações salvas no evento!');
    } catch {
      showToast('Erro de conexão ao salvar alterações.', 'error');
    }
  };

  const handleFetchEventInscriptions = useCallback(
    async (eventoId: number): Promise<EventAttendancePayload> => {
      const res = await apiFetch(`/api/events/${eventoId}/inscriptions`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Erro ao buscar inscritos do evento.');
      }
      return {
        evento: data.evento,
        inscriptions: Array.isArray(data.inscriptions) ? data.inscriptions : [],
        frequencias: Array.isArray(data.frequencias) ? data.frequencias : [],
        canManageAttendance: Boolean(data.canManageAttendance),
      };
    },
    []
  );

  const handleSetPresenca = useCallback(
    async (id_inscricao: number, presente: boolean): Promise<Frequencia> => {
      const res = await apiFetch(`/api/attendance/${id_inscricao}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presente }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.frequencia) {
        throw new Error(data.message || 'Erro ao registrar frequência.');
      }
      store.updateFrequenciaFromServer(data.frequencia);
      await fetchWorkspace();
      return data.frequencia;
    },
    [fetchWorkspace]
  );

  const handleEmitirCertificado = async (
    alunoNome: string,
    matricula: string,
    eventoTitulo: string,
    idInscricao?: number
  ) => {
    const res = await apiFetch('/api/certificates/issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participante_nome: alunoNome,
        participante_matricula: matricula,
        evento_titulo: eventoTitulo,
        id_inscricao: idInscricao,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Erro ao emitir certificado.');
    }
    if (data.certificado) {
      store.addCertificadoFromServer(data.certificado);
    }
    await fetchWorkspace();
  };

  const handleModerarCertificado = async (
    id_certificado: number,
    decisao: 'APROVAR' | 'RECUSAR'
  ) => {
    try {
      const res = await apiFetch(`/api/admin/certificates/${id_certificado}/decision`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: decisao }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        showToast(data.message || 'Erro ao moderar certificado.', 'error');
        return;
      }
      store.moderarCertificado(id_certificado, decisao);
      await fetchWorkspace();
    } catch {
      showToast('Erro de conexão ao moderar certificado.', 'error');
    }
  };

  const handleUpdateProfile = async (updates: Partial<Usuario>) => {
    const res = await apiFetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Erro ao atualizar perfil.');
    }
    if (data.user) {
      store.setCurrentUser(data.user);
      setCurrentUser(data.user);
    }
    showToast('Perfil atualizado com sucesso!');
  };

  const handleChangePassword = async (senhaAtual: string, novaSenha: string) => {
    const res = await apiFetch('/api/profile/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senhaAtual, novaSenha }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Erro ao alterar senha.');
    }
    showToast('Senha alterada com sucesso!');
  };

  const handleValidateCertificate = async (codigo: string): Promise<Certificado | null> => {
    try {
      const res = await apiFetch(
        `/api/certificates/validate?code=${encodeURIComponent(codigo.trim())}`
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        return data.certificado || null;
      }
    } catch {
      // fallback to loaded state if offline
    }
    return store.validarCertificado(codigo);
  };

  const handleProfessorDecision = async (
    id_usuario: number,
    decisao: 'APROVAR' | 'RECUSAR',
    motivo?: string
  ) => {
    const response = await apiFetch(`/api/admin/professors/${id_usuario}/decision`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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

  const handleUpdateUserStatus = async (id_usuario: number, status: StatusConta) => {
    const response = await apiFetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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

  const handleOpenAttendanceForEvent = useCallback((eventoId: number) => {
    setSelectedAttendanceEventId(eventoId);
    setActiveTab('inscritos_frequencia');
  }, []);

  // 1. Email Verification View (?verify_token=...)
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 gap-4">
        <Logo size="lg" showText={false} />
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-700 dark:text-emerald-400" />
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
          onGoToResetPassword={(hintEmail) => {
            if (hintEmail) setResetEmailHint(hintEmail);
            setAuthView('reset_password');
          }}
        />
      );
    }
    if (authView === 'reset_password') {
      return (
        <ResetPasswordView
          initialEmail={resetEmailHint}
          resetToken={resetToken}
          onGoToLogin={() => {
            setResetToken(null);
            setAuthView('login');
          }}
        />
      );
    }

    return (
      <LoginView
        demoMode={demoMode}
        needsAdminSetup={needsAdminSetup}
        onAdminSetupComplete={() => setNeedsAdminSetup(false)}
        onAuthSuccess={handleAuthSuccess}
        onGoToRegister={() => setAuthView('register')}
        onGoToForgotPassword={() => setAuthView('forgot_password')}
      />
    );
  }

  // Defensive access guard matching server rules
  if (
    (currentUser.perfil === 'PROFESSOR' && currentUser.status_conta !== 'ATIVO') ||
    (currentUser.perfil === 'PARTICIPANTE' && currentUser.email_verificado === false)
  ) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-lg p-8 text-center space-y-4">
          <Logo size="md" showText={false} />
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">
            {currentUser.perfil === 'PROFESSOR'
              ? currentUser.status_conta === 'RECUSADO'
                ? 'Solicitação de Professor Rejeitada'
                : 'Aguardando Aprovação Administrativa'
              : 'Verificação Simulada Pendente'}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {currentUser.perfil === 'PROFESSOR'
              ? currentUser.status_conta === 'RECUSADO'
                ? 'Sua solicitação de acesso como professor foi rejeitada pela administração.'
                : 'Sua solicitação de professor está pendente de aprovação por um administrador.'
              : 'Conclua a verificação simulada de e-mail para acessar o sistema.'}
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold rounded-xl cursor-pointer"
          >
            Voltar ao Login
          </button>
        </div>
      </div>
    );
  }

  const pendingProfessorsCount = allUsers.filter(
    (u) => u.perfil === 'PROFESSOR' && u.status_conta === 'PENDENTE'
  ).length;
  const pendingCertificatesCount = solicitacoesCertificado.filter(
    (s) => s.status_moderacao === 'PENDENTE'
  ).length;

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#090e1a] text-slate-800 dark:text-slate-100 flex flex-col font-sans overflow-x-hidden transition-colors">
      {toast && (
        <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50 iv-fade-up">
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

      <Navbar
        currentUser={currentUser}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onSwitchUser={handleSwitchUser}
        onOpenProfile={() => setActiveTab('configuracoes')}
        onLogout={handleLogout}
        allUsers={allUsers}
        demoMode={demoMode}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleCollapseDesktop={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isCollapsedDesktop={isSidebarCollapsed}
      />

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
          {activeTab === 'dashboard' && (
            <DashboardView
              currentUser={currentUser}
              eventos={displayedEventos}
              inscricoes={inscricoes}
              certificados={certificados}
              allUsers={allUsers}
              solicitacoesCertificado={solicitacoesCertificado}
              onNavigateTab={setActiveTab}
              onOpenDetails={(evento) => setDetailsModalEvento(evento)}
              onOpenCreateModal={() => setCreateModalOpen(true)}
              onOpenAttendanceForEvent={handleOpenAttendanceForEvent}
            />
          )}

          {activeTab === 'eventos' && (
            <CatalogView
              eventos={displayedEventos}
              favoritos={favoritos}
              onToggleFavorito={handleToggleFavorito}
              onOpenDetails={(evento) => setDetailsModalEvento(evento)}
              onQuickInscrever={handleInscrever}
              inscricoesIds={participantSubscribedEventIds}
              userRole={currentUser.perfil}
              currentUserId={currentUser.id_usuario}
              onOpenCreateModal={() => setCreateModalOpen(true)}
              onOpenEditModal={(evento) => setEditModalEvento(evento)}
              onOpenAttendanceForEvent={handleOpenAttendanceForEvent}
            />
          )}

          {activeTab === 'minhas_inscricoes' && (
            <MyRegistrationsView
              inscricoes={inscricoes}
              eventos={eventos}
              favoritos={favoritos}
              onToggleFavorito={handleToggleFavorito}
              onOpenDetails={(evento) => setDetailsModalEvento(evento)}
              onCancelarInscricao={handleCancelarInscricao}
              userRole={currentUser.perfil}
              currentUserId={currentUser.id_usuario}
              onOpenAttendanceForEvent={handleOpenAttendanceForEvent}
            />
          )}

          {activeTab === 'certificados' && (
            <MyCertificatesView
              certificados={certificados.filter(
                (c) =>
                  c.participante_nome?.toLowerCase() === currentUser.nome.toLowerCase() ||
                  (demoMode && c.id_certificado <= 4)
              )}
            />
          )}

          {activeTab === 'meus_eventos' && (
            <ProfessorEventsView
              eventos={displayedEventos}
              userRole={currentUser.perfil}
              currentUserId={currentUser.id_usuario}
              onOpenCreateModal={() => setCreateModalOpen(true)}
              onOpenEditModal={(evento) => setEditModalEvento(evento)}
              onOpenDetailsModal={(evento) => setDetailsModalEvento(evento)}
              onOpenAttendanceForEvent={handleOpenAttendanceForEvent}
            />
          )}

          {activeTab === 'inscritos_frequencia' && (
            <AttendanceView
              eventos={eventos}
              currentUserId={currentUser.id_usuario}
              initialEventId={selectedAttendanceEventId}
              onFetchEventInscriptions={handleFetchEventInscriptions}
              onSetPresenca={handleSetPresenca}
              onEmitirCertificado={handleEmitirCertificado}
            />
          )}

          {activeTab === 'moderacao_usuarios' && (
            <AdminUsersView
              usuarios={allUsers}
              authToken={authToken}
              onProfessorDecision={handleProfessorDecision}
              onUpdateUserStatus={handleUpdateUserStatus}
              onRefreshFromServer={() => fetchAdminUsers()}
            />
          )}

          {activeTab === 'moderacao_certificados' && (
            <AdminCertificatesView
              solicitacoes={solicitacoesCertificado}
              onModerar={handleModerarCertificado}
            />
          )}

          {activeTab === 'configuracoes' && (
            <div className="space-y-6 max-w-4xl">
              <ProfileView
                currentUser={currentUser}
                onUpdateProfile={handleUpdateProfile}
                onChangePassword={handleChangePassword}
              />
            </div>
          )}

          {activeTab === 'validar_certificado' && (
            <CertificateValidatorView
              onValidate={handleValidateCertificate}
              certificados={demoMode ? certificados : []}
            />
          )}
        </main>
      </div>

      <CreateEventModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateEvento}
        organizadorId={currentUser.id_usuario}
      />

      <EditEventModal
        evento={editModalEvento}
        isOpen={Boolean(editModalEvento)}
        onClose={() => setEditModalEvento(null)}
        onSave={handleSaveEvento}
      />

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
        onToggleFavorito={handleToggleFavorito}
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
