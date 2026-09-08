/**
 * IFCE Iventus - Módulo Administrativo e de Coordenação de Eventos
 * Criar Evento, Editar Evento (Modal Amarelo), Aprovações e Lista de Presença
 */

import { store } from './store.js';
import { showToast, openModal, closeModal } from './ui.js';

export const adminModule = {
  activeTab: 'todos',
  selectedEventForAttendance: 'evt_1', // Evento padrão para gerenciar lista de presença

  renderMyEventsTable(containerId = 'my-events-table-body') {
    const tbody = document.getElementById(containerId);
    if (!tbody) return;

    let events = store.getEvents();
    const currentUser = store.getCurrentUser();

    // Filtro por abas
    if (this.activeTab === 'em_andamento') {
      events = events.filter(e => e.status === 'em_andamento');
    } else if (this.activeTab === 'concluidos') {
      events = events.filter(e => e.status === 'encerrado');
    } else if (this.activeTab === 'rascunhos') {
      events = events.filter(e => e.status === 'rascunho');
    } else if (this.activeTab === 'publicados') {
      events = events.filter(e => e.status === 'publicado');
    }

    if (events.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 36px; color: var(--color-text-muted);">
            Nenhum evento cadastrado nesta categoria.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = events.map(evt => {
      const statusBadge =
        evt.status === 'publicado' ? '<span class="badge badge-success"><span class="badge-dot"></span>Publicado</span>' :
        evt.status === 'em_andamento' ? '<span class="badge badge-info"><span class="badge-dot"></span>Em andamento</span>' :
        evt.status === 'rascunho' ? '<span class="badge badge-neutral"><span class="badge-dot"></span>Rascunho</span>' :
        '<span class="badge badge-danger"><span class="badge-dot"></span>Encerrado</span>';

      return `
        <tr>
          <td>
            <div class="table-event-cell">
              <img src="${evt.cover}" alt="${evt.title}" class="table-event-thumb" onerror="this.src='/assets/images/event-comp.svg'" />
              <div class="table-event-info">
                <span class="table-event-name">${evt.title}</span>
                <span class="table-event-category">${evt.category}</span>
              </div>
            </div>
          </td>
          <td>${evt.datesLabel}</td>
          <td>${evt.location}</td>
          <td><strong>${evt.occupiedSeats}</strong> / ${evt.totalSeats}</td>
          <td>${statusBadge}</td>
          <td>
            <div class="table-actions">
              <button class="btn btn-icon-only btn-view" title="Visualizar Detalhes" data-id="${evt.id}">
                👁️
              </button>
              <button class="btn btn-icon-only btn-edit" title="Editar Evento" data-id="${evt.id}">
                ✏️
              </button>
              <button class="btn btn-icon-only btn-presence" title="Gerenciar Presenças e Inscritos" data-id="${evt.id}">
                👥
              </button>
              <button class="btn btn-icon-only btn-delete" title="Excluir Evento" data-id="${evt.id}">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Bind botões
    tbody.querySelectorAll('.btn-view').forEach(btn => {
      btn.addEventListener('click', () => {
        window.eventsModule.openEventDetailsModal(btn.dataset.id);
      });
    });

    tbody.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        this.openEditEventModal(btn.dataset.id);
      });
    });

    tbody.querySelectorAll('.btn-presence').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedEventForAttendance = btn.dataset.id;
        window.navigateToView('gerenciar-inscricoes');
      });
    });

    tbody.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Deseja realmente excluir este evento? Esta ação não pode ser desfeita.')) {
          store.deleteEvent(btn.dataset.id);
          showToast('Evento excluído com sucesso.', 'info');
          this.renderMyEventsTable();
        }
      });
    });
  },

  openCreateEventModal() {
    const form = document.getElementById('form-create-event');
    if (form) form.reset();

    const preview = document.getElementById('create-image-preview');
    if (preview) {
      preview.src = '/assets/images/event-comp.svg';
    }

    openModal('modal-create-event');
  },

  handleCreateEventSubmit(e) {
    e.preventDefault();
    const form = e.target;

    const title = form.querySelector('[name="title"]').value.trim();
    const category = form.querySelector('[name="category"]').value;
    const location = form.querySelector('[name="location"]').value.trim();
    const dateStart = form.querySelector('[name="dateStart"]').value;
    const dateEnd = form.querySelector('[name="dateEnd"]').value;
    const timeLabel = form.querySelector('[name="timeLabel"]').value.trim();
    const workloadHours = form.querySelector('[name="workload"]').value;
    const totalSeats = form.querySelector('[name="totalSeats"]').value;
    const description = form.querySelector('[name="description"]').value.trim();
    const status = form.querySelector('[name="status"]').value;

    if (!title || !location || !dateStart) {
      showToast('Por favor, preencha todos os campos obrigatórios.', 'error');
      return;
    }

    // Formata o label de datas
    const d1 = new Date(dateStart).toLocaleDateString('pt-BR');
    const d2 = dateEnd ? new Date(dateEnd).toLocaleDateString('pt-BR') : d1;
    const datesLabel = d1 === d2 ? d1 : `${d1} a ${d2}`;

    const newEvt = store.createEvent({
      title,
      category,
      location,
      dateStart,
      dateEnd,
      datesLabel,
      timeLabel: timeLabel || '08:00h - 18:00h',
      workload: `${workloadHours || 20} horas`,
      workloadHours: parseInt(workloadHours) || 20,
      totalSeats: parseInt(totalSeats) || 50,
      description: description || 'Sem descrição informada.',
      status: status || 'publicado',
      cover: category === 'Inteligência Artificial' ? '/assets/images/event-ai.svg' :
             category === 'Robótica' ? '/assets/images/event-robotics.svg' :
             category === 'Ciência e Pesquisa' ? '/assets/images/event-science.svg' :
             '/assets/images/event-comp.svg'
    });

    showToast('Evento cadastrado e publicado com sucesso!', 'success');
    closeModal('modal-create-event');
    this.renderMyEventsTable();
    window.eventsModule.renderEventsGrid();
  },

  openEditEventModal(eventId) {
    const evt = store.getEventById(eventId);
    if (!evt) return;

    const form = document.getElementById('form-edit-event');
    if (!form) return;

    form.querySelector('[name="id"]').value = evt.id;
    form.querySelector('[name="title"]').value = evt.title;
    form.querySelector('[name="category"]').value = evt.category;
    form.querySelector('[name="location"]').value = evt.location;
    form.querySelector('[name="dateStart"]').value = evt.dateStart;
    form.querySelector('[name="dateEnd"]').value = evt.dateEnd;
    form.querySelector('[name="timeLabel"]').value = evt.timeLabel;
    form.querySelector('[name="workload"]').value = evt.workloadHours || 20;
    form.querySelector('[name="totalSeats"]').value = evt.totalSeats;
    form.querySelector('[name="description"]').value = evt.description;
    form.querySelector('[name="status"]').value = evt.status;

    const preview = document.getElementById('edit-image-preview');
    if (preview) {
      preview.src = evt.cover;
    }

    // Modal com o cabeçalho amarelo exato do Figma
    openModal('modal-edit-event');
  },

  handleEditEventSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const id = form.querySelector('[name="id"]').value;

    const updated = store.updateEvent(id, {
      title: form.querySelector('[name="title"]').value.trim(),
      category: form.querySelector('[name="category"]').value,
      location: form.querySelector('[name="location"]').value.trim(),
      dateStart: form.querySelector('[name="dateStart"]').value,
      dateEnd: form.querySelector('[name="dateEnd"]').value,
      timeLabel: form.querySelector('[name="timeLabel"]').value.trim(),
      workload: `${form.querySelector('[name="workload"]').value} horas`,
      workloadHours: parseInt(form.querySelector('[name="workload"]').value) || 20,
      totalSeats: parseInt(form.querySelector('[name="totalSeats"]').value) || 50,
      description: form.querySelector('[name="description"]').value.trim(),
      status: form.querySelector('[name="status"]').value
    });

    if (updated) {
      showToast('Alterações no evento salvas com sucesso!', 'success');
      closeModal('modal-edit-event');
      this.renderMyEventsTable();
      window.eventsModule.renderEventsGrid();
    }
  },

  // ------------------------------------------------------------------------
  // Gerenciamento de Inscrições e Presenças (Professor / Organizador)
  // ------------------------------------------------------------------------
  renderAttendanceManagement(containerId = 'attendance-table-body') {
    const tbody = document.getElementById(containerId);
    if (!tbody) return;

    const event = store.getEventById(this.selectedEventForAttendance) || store.getEvents()[0];
    if (!event) return;

    // Atualiza cabeçalhos e resumos
    const titleElem = document.getElementById('attendance-event-title');
    if (titleElem) titleElem.textContent = `Inscrições - ${event.title}`;

    const regs = store.getRegistrationsForEvent(event.id);

    const totalStudents = regs.length;
    const attendedStudents = regs.filter(r => r.attended).length;
    const certificatesIssued = regs.filter(r => r.certificateIssued).length;

    const totalElem = document.getElementById('stat-total-inscritos');
    const attendedElem = document.getElementById('stat-presencas-confirmadas');
    const certElem = document.getElementById('stat-certificados-emitidos');

    if (totalElem) totalElem.textContent = totalStudents;
    if (attendedElem) attendedElem.textContent = attendedStudents;
    if (certElem) certElem.textContent = certificatesIssued;

    if (regs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 32px; color: var(--color-text-muted);">
            Nenhum participante inscrito neste evento ainda.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = regs.map(r => {
      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 34px; height: 34px; border-radius: 50%; background: var(--color-primary-light); color: var(--color-primary); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px;">
                ${r.userName.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <div style="font-weight: 600; color: var(--color-text-main);">${r.userName}</div>
                <div style="font-size: 11px; color: var(--color-text-muted);">${r.userEmail}</div>
              </div>
            </div>
          </td>
          <td>
            <div>${r.curso}</div>
            <div style="font-family: var(--font-family-mono); font-size: 11px; color: var(--color-text-muted);">${r.matricula}</div>
          </td>
          <td>
            <button class="presence-check-btn ${r.attended ? 'checked' : ''}" data-reg-id="${r.id}">
              ${r.attended ? '✓ Presente' : 'Ausente (Marcar)'}
            </button>
          </td>
          <td>
            ${r.certificateIssued ?
              '<span class="badge badge-success">✓ Apto / Emitido</span>' :
              '<span class="badge badge-neutral">Aguardando Presença</span>'
            }
          </td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="window.showCertificateViewer('${r.eventId}', '${r.userId}')">
              Ver Certificado
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.presence-check-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const regId = btn.dataset.regId;
        const updated = store.toggleAttendance(regId);
        if (updated) {
          showToast(
            updated.attended ? `Presença confirmada para ${updated.userName}. Certificado liberado!` : `Presença desmarcada para ${updated.userName}.`,
            'success'
          );
          this.renderAttendanceManagement();
        }
      });
    });
  },

  // ------------------------------------------------------------------------
  // Aprovação das Inscrições (Administrador)
  // ------------------------------------------------------------------------
  renderPendingApplications(containerId = 'pending-applications-body') {
    const tbody = document.getElementById(containerId);
    if (!tbody) return;

    const apps = store.getPendingApplications();

    if (apps.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 36px; color: var(--color-text-muted);">
            Não há solicitações pendentes no momento.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = apps.map(app => {
      const statusBadge =
        app.status === 'aprovada' ? '<span class="badge badge-success">Aprovada</span>' :
        app.status === 'recusada' ? '<span class="badge badge-danger">Recusada</span>' :
        '<span class="badge badge-warning">Pendente</span>';

      return `
        <tr>
          <td>
            <div style="font-weight: 600;">${app.applicantName}</div>
            <div style="font-size: 11px; color: var(--color-text-muted);">${app.applicantEmail}</div>
          </td>
          <td>${app.institutionRole}</td>
          <td><strong>${app.eventTitle}</strong></td>
          <td>${app.requestDate}</td>
          <td>${statusBadge}</td>
          <td>
            ${app.status === 'pendente' ? `
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-primary btn-sm btn-app-approve" data-id="${app.id}">
                  Aprovar
                </button>
                <button class="btn btn-outline-danger btn-sm btn-app-reject" data-id="${app.id}">
                  Recusar
                </button>
              </div>
            ` : `
              <span style="font-size: 12px; color: var(--color-text-muted);">Finalizado</span>
            `}
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-app-approve').forEach(btn => {
      btn.addEventListener('click', () => {
        store.approveApplication(btn.dataset.id);
        showToast('Solicitação aprovada com sucesso!', 'success');
        this.renderPendingApplications();
      });
    });

    tbody.querySelectorAll('.btn-app-reject').forEach(btn => {
      btn.addEventListener('click', () => {
        store.rejectApplication(btn.dataset.id);
        showToast('Solicitação recusada.', 'info');
        this.renderPendingApplications();
      });
    });
  },

  // ------------------------------------------------------------------------
  // Aprovação / Gestão de Certificados (Administrador e Participante)
  // ------------------------------------------------------------------------
  renderCertificatesList(containerId = 'certificates-container') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const currentUser = store.getCurrentUser();
    const isAdmin = currentUser && currentUser.role === 'administrador';

    const certs = isAdmin
      ? store.getAllCertificates()
      : store.getCertificatesForUser(currentUser ? currentUser.id : 'usr_1');

    if (certs.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 48px; background: #FFFFFF; border-radius: var(--radius-lg); border: 1px dashed var(--color-border);">
          <div style="font-size: 36px; margin-bottom: 8px;">🎓</div>
          <h3 style="margin-bottom: 6px;">Nenhum certificado disponível</h3>
          <p style="color: var(--color-text-secondary); font-size: 14px;">
            Os certificados são emitidos automaticamente após a confirmação de presença no evento.
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        ${certs.map(c => `
          <div class="certificate-card">
            <div class="certificate-icon-badge">
              🎓
            </div>
            <div class="certificate-details">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span class="badge badge-success">Certificado Autêntico</span>
                <span style="font-family: var(--font-family-mono); font-size: 11px; color: var(--color-text-muted);">
                  ${c.validationCode}
                </span>
              </div>
              <h3 class="certificate-title">${c.eventTitle}</h3>
              <div class="certificate-meta">
                <span>👤 Aluno: <strong>${c.recipientName}</strong></span>
                <span>⏱️ Carga Horária: <strong>${c.workload}</strong></span>
                <span>📅 Emitido em: <strong>${c.issueDate}</strong></span>
              </div>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-outline btn-sm" onclick="window.showCertificateViewer('${c.eventId}', '${c.recipientId}')">
                Visualizar
              </button>
              <button class="btn btn-primary btn-sm" onclick="window.mockDownloadCertificate('${c.validationCode}')">
                Baixar PDF
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
};
