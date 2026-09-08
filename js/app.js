/**
 * IFCE Iventus - Controlador Principal da Aplicação
 * Roteamento de visualizações, orquestração de eventos e inicialização
 */

import { store } from './store.js';
import { auth } from './auth.js';
import { eventsModule } from './events.js';
import { adminModule } from './admin.js';
import { profileModule } from './profile.js';
import {
  openModal,
  closeModal,
  closeAnyModal,
  showToast,
  toggleProfileDropdown,
  closeProfileDropdown,
  toggleMobileSidebar,
  closeMobileSidebar
} from './ui.js';
import { downloadProjectZip } from './export-zip.js';

class App {
  constructor() {
    this.currentView = 'eventos';
  }

  init() {
    console.log('IFCE Iventus iniciado com sucesso.');

    // Assina mudanças de estado no store para re-renderizar componentes
    store.subscribe((state, currentUser) => {
      this.updateHeaderAndSidebar(currentUser);
      this.renderCurrentView();
    });

    this.bindGlobalListeners();
    this.updateHeaderAndSidebar(store.getCurrentUser());
    this.navigateToView('eventos');
  }

  navigateToView(viewName) {
    this.currentView = viewName;
    closeMobileSidebar();
    closeProfileDropdown();

    // Atualiza links da sidebar
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === viewName);
    });

    // Alterna seções de conteúdo
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.toggle('hidden', sec.id !== `view-${viewName}`);
    });

    // Se estiver em telas de autenticação, esconde layout do dashboard
    const isAuth = ['login', 'cadastro', 'recuperar-senha', 'nova-senha'].includes(viewName);
    const dashboardLayout = document.getElementById('dashboard-layout');
    const authLayout = document.getElementById('auth-layout');

    if (dashboardLayout && authLayout) {
      if (isAuth) {
        dashboardLayout.classList.add('hidden');
        authLayout.classList.remove('hidden');

        // Esconde sub-telas de auth
        document.querySelectorAll('.auth-card-screen').forEach(el => {
          el.classList.toggle('hidden', el.id !== `auth-${viewName}`);
        });
      } else {
        dashboardLayout.classList.remove('hidden');
        authLayout.classList.add('hidden');
      }
    }

    this.renderCurrentView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  renderCurrentView() {
    const currentUser = store.getCurrentUser();

    switch (this.currentView) {
      case 'eventos':
        eventsModule.renderEventsGrid('events-grid');
        break;

      case 'meus-eventos':
        adminModule.renderMyEventsTable('my-events-table-body');
        break;

      case 'minhas-inscricoes':
        eventsModule.renderMyRegistrations('my-registrations-container');
        break;

      case 'gerenciar-inscricoes':
        adminModule.renderAttendanceManagement('attendance-table-body');
        break;

      case 'solicitacoes-admin':
        adminModule.renderPendingApplications('pending-applications-body');
        break;

      case 'certificados':
        adminModule.renderCertificatesList('certificates-container');
        break;

      case 'perfil':
        profileModule.renderProfile();
        break;
    }
  }

  updateHeaderAndSidebar(user) {
    // Atualiza Topbar de Demonstração
    document.querySelectorAll('.demo-role-btn').forEach(btn => {
      const role = btn.dataset.role;
      if (user && user.role === role) {
        btn.classList.add('active');
      } else if (!user && role === 'guest') {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (!user) {
      // Usuário deslogado
      return;
    }

    // Avatar e Nome no Topo
    const topAvatar = document.getElementById('header-user-avatar');
    const topName = document.getElementById('header-user-name');
    const roleChip = document.getElementById('header-role-chip');

    if (topAvatar) topAvatar.src = user.avatar;
    if (topName) topName.textContent = user.name;
    if (roleChip) {
      roleChip.textContent =
        user.role === 'participante' ? 'Participante' :
        user.role === 'professor' ? 'Professor / Org.' : 'Administrador';
      roleChip.className = `header-role-chip role-chip-${user.role}`;
    }

    // Dropdown de perfil
    const dropName = document.getElementById('dropdown-name');
    const dropEmail = document.getElementById('dropdown-email');
    if (dropName) dropName.textContent = user.name;
    if (dropEmail) dropEmail.textContent = user.email;

    // Sidebar footer
    const sideAvatar = document.getElementById('sidebar-user-avatar');
    const sideName = document.getElementById('sidebar-user-name');
    const sideRole = document.getElementById('sidebar-user-role');
    if (sideAvatar) sideAvatar.src = user.avatar;
    if (sideName) sideName.textContent = user.name;
    if (sideRole) sideRole.textContent = user.role === 'participante' ? 'Aluno IFCE' : user.role === 'professor' ? 'Docente IFCE' : 'Gestão IFCE';

    // Botão "+ Criar Evento" no header (visível para Professor e Admin)
    const btnCreateEvent = document.getElementById('header-btn-create-event');
    if (btnCreateEvent) {
      if (user.role === 'professor' || user.role === 'administrador') {
        btnCreateEvent.classList.remove('hidden');
      } else {
        btnCreateEvent.classList.add('hidden');
      }
    }

    // Itens de Menu da Sidebar dinâmicos por Perfil
    const navContainer = document.getElementById('sidebar-dynamic-nav');
    if (!navContainer) return;

    if (user.role === 'participante') {
      navContainer.innerHTML = `
        <span class="nav-category-label">Principal</span>
        <a class="nav-item ${this.currentView === 'eventos' ? 'active' : ''}" data-view="eventos">
          <span class="nav-item-icon">📅</span>
          <span>Eventos</span>
        </a>
        <a class="nav-item ${this.currentView === 'minhas-inscricoes' ? 'active' : ''}" data-view="minhas-inscricoes">
          <span class="nav-item-icon">📝</span>
          <span>Minhas Inscrições</span>
        </a>
        <a class="nav-item ${this.currentView === 'certificados' ? 'active' : ''}" data-view="certificados">
          <span class="nav-item-icon">🎓</span>
          <span>Certificados</span>
        </a>
        <span class="nav-category-label">Conta</span>
        <a class="nav-item ${this.currentView === 'perfil' ? 'active' : ''}" data-view="perfil">
          <span class="nav-item-icon">⚙️</span>
          <span>Meu Perfil</span>
        </a>
      `;
    } else if (user.role === 'professor') {
      navContainer.innerHTML = `
        <span class="nav-category-label">Gestão de Eventos</span>
        <a class="nav-item ${this.currentView === 'eventos' ? 'active' : ''}" data-view="eventos">
          <span class="nav-item-icon">📅</span>
          <span>Catálogo Geral</span>
        </a>
        <a class="nav-item ${this.currentView === 'meus-eventos' ? 'active' : ''}" data-view="meus-eventos">
          <span class="nav-item-icon">🗂️</span>
          <span>Meus Eventos</span>
        </a>
        <a class="nav-item ${this.currentView === 'gerenciar-inscricoes' ? 'active' : ''}" data-view="gerenciar-inscricoes">
          <span class="nav-item-icon">👥</span>
          <span>Inscrições & Presença</span>
        </a>
        <span class="nav-category-label">Conta</span>
        <a class="nav-item ${this.currentView === 'perfil' ? 'active' : ''}" data-view="perfil">
          <span class="nav-item-icon">⚙️</span>
          <span>Meu Perfil</span>
        </a>
      `;
    } else if (user.role === 'administrador') {
      navContainer.innerHTML = `
        <span class="nav-category-label">Administração IFCE</span>
        <a class="nav-item ${this.currentView === 'eventos' ? 'active' : ''}" data-view="eventos">
          <span class="nav-item-icon">📅</span>
          <span>Todos os Eventos</span>
        </a>
        <a class="nav-item ${this.currentView === 'meus-eventos' ? 'active' : ''}" data-view="meus-eventos">
          <span class="nav-item-icon">🗂️</span>
          <span>Gerenciar Eventos</span>
        </a>
        <a class="nav-item ${this.currentView === 'solicitacoes-admin' ? 'active' : ''}" data-view="solicitacoes-admin">
          <span class="nav-item-icon">📋</span>
          <span>Solicitações de Inscrição</span>
        </a>
        <a class="nav-item ${this.currentView === 'certificados' ? 'active' : ''}" data-view="certificados">
          <span class="nav-item-icon">🎓</span>
          <span>Aprovação de Certificados</span>
        </a>
        <span class="nav-category-label">Conta</span>
        <a class="nav-item ${this.currentView === 'perfil' ? 'active' : ''}" data-view="perfil">
          <span class="nav-item-icon">⚙️</span>
          <span>Configurações</span>
        </a>
      `;
    }

    // Re-associa clicks na sidebar
    navContainer.querySelectorAll('.nav-item').forEach(link => {
      link.addEventListener('click', () => {
        this.navigateToView(link.dataset.view);
      });
    });
  }

  bindGlobalListeners() {
    // Alternador de Perfis na Topbar
    document.querySelectorAll('.demo-role-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const role = btn.dataset.role;
        if (role === 'guest') {
          auth.logout();
          this.navigateToView('login');
        } else {
          store.switchRole(role);
          showToast(`Perfil alternado para ${role.toUpperCase()}`, 'info');
          if (role === 'participante') {
            this.navigateToView('eventos');
          } else if (role === 'professor') {
            this.navigateToView('meus-eventos');
          } else if (role === 'administrador') {
            this.navigateToView('solicitacoes-admin');
          }
        }
      });
    });

    // Botão de Download ZIP
    document.querySelectorAll('.btn-download-zip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        downloadProjectZip();
      });
    });

    // Botão Mobile Drawer
    const mobileBtn = document.getElementById('mobile-menu-toggle');
    if (mobileBtn) {
      mobileBtn.addEventListener('click', toggleMobileSidebar);
    }
    const backdrop = document.getElementById('sidebar-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', closeMobileSidebar);
    }

    // Dropdown de perfil
    const userProfileBtn = document.getElementById('user-profile-button');
    if (userProfileBtn) {
      userProfileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleProfileDropdown();
      });
    }

    document.addEventListener('click', () => {
      closeProfileDropdown();
    });

    // Busca de Eventos com debounce
    const searchInput = document.getElementById('global-search-input');
    if (searchInput) {
      let timeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          eventsModule.searchQuery = e.target.value;
          if (this.currentView !== 'eventos') {
            this.navigateToView('eventos');
          } else {
            eventsModule.renderEventsGrid('events-grid');
          }
        }, 200);
      });
    }

    // Filtros de Categoria em Eventos
    document.querySelectorAll('.category-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.category-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        eventsModule.activeCategory = btn.dataset.category;
        eventsModule.renderEventsGrid('events-grid');
      });
    });

    // Filtros de Abas em "Meus Eventos"
    document.querySelectorAll('.my-events-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.my-events-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        adminModule.activeTab = btn.dataset.tab;
        adminModule.renderMyEventsTable('my-events-table-body');
      });
    });

    // Abas de Perfil (Dados Pessoais vs Alterar Senha)
    document.querySelectorAll('.profile-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.profile-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;

        const personalSec = document.getElementById('tab-content-personal');
        const passwordSec = document.getElementById('tab-content-password');

        if (personalSec && passwordSec) {
          personalSec.classList.toggle('hidden', tab !== 'personal');
          passwordSec.classList.toggle('hidden', tab !== 'password');
        }
      });
    });

    // Botão Criar Evento no Header
    const btnCreate = document.getElementById('header-btn-create-event');
    if (btnCreate) {
      btnCreate.addEventListener('click', () => {
        adminModule.openCreateEventModal();
      });
    }

    // Formulário de Criar Evento
    const formCreate = document.getElementById('form-create-event');
    if (formCreate) {
      formCreate.addEventListener('submit', (e) => adminModule.handleCreateEventSubmit(e));
    }

    // Formulário de Editar Evento (Modal Amarelo)
    const formEdit = document.getElementById('form-edit-event');
    if (formEdit) {
      formEdit.addEventListener('submit', (e) => adminModule.handleEditEventSubmit(e));
    }

    // Formulário de Perfil
    const formProfile = document.getElementById('form-personal-data');
    if (formProfile) {
      formProfile.addEventListener('submit', (e) => profileModule.handleProfileSubmit(e));
    }

    // Formulário de Senha
    const formPassword = document.getElementById('form-change-password');
    if (formPassword) {
      formPassword.addEventListener('submit', (e) => profileModule.handlePasswordSubmit(e));
    }

    // Formulários de Autenticação
    const formLogin = document.getElementById('form-auth-login');
    if (formLogin) {
      formLogin.addEventListener('submit', (e) => {
        e.preventDefault();
        const ident = formLogin.querySelector('[name="identifier"]').value;
        const pass = formLogin.querySelector('[name="password"]').value;
        try {
          auth.login(ident, pass);
          this.navigateToView('eventos');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    const formRegister = document.getElementById('form-auth-register');
    if (formRegister) {
      formRegister.addEventListener('submit', (e) => {
        e.preventDefault();
        try {
          auth.register({
            name: formRegister.querySelector('[name="name"]').value.trim(),
            email: formRegister.querySelector('[name="email"]').value.trim(),
            matricula: formRegister.querySelector('[name="matricula"]').value.trim(),
            role: formRegister.querySelector('[name="role"]').value,
            password: formRegister.querySelector('[name="password"]').value,
            confirmPassword: formRegister.querySelector('[name="confirmPassword"]').value
          });
          this.navigateToView('eventos');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    const formRecover = document.getElementById('form-auth-recover');
    if (formRecover) {
      formRecover.addEventListener('submit', (e) => {
        e.preventDefault();
        try {
          auth.recoverPassword(formRecover.querySelector('[name="email"]').value);
          this.navigateToView('nova-senha');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    const formReset = document.getElementById('form-auth-reset');
    if (formReset) {
      formReset.addEventListener('submit', (e) => {
        e.preventDefault();
        try {
          auth.resetPassword(
            formReset.querySelector('[name="new_password"]').value,
            formReset.querySelector('[name="confirm_password"]').value
          );
          this.navigateToView('login');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }
  }
}

// Inicializa a aplicação
const app = new App();
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});

// Expõe globalmente para acesso nos atributos onclick do HTML
window.app = app;
window.navigateToView = (view) => app.navigateToView(view);
window.eventsModule = eventsModule;
window.adminModule = adminModule;
window.profileModule = profileModule;
window.auth = auth;
