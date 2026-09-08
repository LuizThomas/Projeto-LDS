/**
 * IFCE Iventus - Módulo de Eventos e Inscrições
 */

import { store } from './store.js';
import { showToast, openModal, closeModal } from './ui.js';

export const eventsModule = {
  activeCategory: 'todos',
  searchQuery: '',

  renderEventsGrid(containerId = 'events-grid') {
    const container = document.getElementById(containerId);
    if (!container) return;

    let events = store.getEvents();
    const currentUser = store.getCurrentUser();

    // Filtra por categoria
    if (this.activeCategory !== 'todos') {
      events = events.filter(e => e.category.toLowerCase() === this.activeCategory.toLowerCase());
    }

    // Filtra por busca
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      events = events.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      );
    }

    if (events.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px; background: #FFFFFF; border-radius: var(--radius-lg); border: 1px dashed var(--color-border);">
          <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
          <h3 style="margin-bottom: 6px;">Nenhum evento encontrado</h3>
          <p style="color: var(--color-text-secondary); font-size: 14px;">Tente ajustar seus termos de busca ou filtros de categoria.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = events.map(evt => {
      const isRegistered = currentUser ? store.isUserRegistered(evt.id, currentUser.id) : false;
      const isFull = evt.occupiedSeats >= evt.totalSeats;
      const progressPercent = Math.min(100, Math.round((evt.occupiedSeats / evt.totalSeats) * 100));

      return `
        <article class="event-card" data-event-id="${evt.id}">
          <div style="position: relative;">
            <img src="${evt.cover}" alt="${evt.title}" class="event-card-cover" onerror="this.src='/assets/images/event-comp.svg'" />
            <span class="event-card-tag">${evt.category}</span>
            <span class="event-card-status-chip badge ${
              evt.status === 'publicado' ? 'badge-success' :
              evt.status === 'em_andamento' ? 'badge-info' :
              evt.status === 'rascunho' ? 'badge-neutral' : 'badge-danger'
            }">
              <span class="badge-dot"></span>
              ${evt.status.replace('_', ' ')}
            </span>
          </div>

          <div class="event-card-body">
            <h3 class="event-card-title">${evt.title}</h3>
            <p class="event-card-description">${evt.description}</p>

            <div class="event-card-meta">
              <div class="meta-row">
                <span class="meta-icon">📅</span>
                <span>${evt.datesLabel}</span>
              </div>
              <div class="meta-row">
                <span class="meta-icon">🕒</span>
                <span>${evt.timeLabel} (${evt.workload})</span>
              </div>
              <div class="meta-row">
                <span class="meta-icon">📍</span>
                <span>${evt.location}</span>
              </div>
              <div class="meta-row">
                <span class="meta-icon">👥</span>
                <span>${evt.occupiedSeats} / ${evt.totalSeats} vagas (${progressPercent}%)</span>
              </div>
              <div style="width: 100%; height: 4px; background: #E2E8F0; border-radius: 2px; overflow: hidden; margin-top: 4px;">
                <div style="width: ${progressPercent}%; height: 100%; background: ${isFull ? '#DC2626' : 'var(--color-primary)'};"></div>
              </div>
            </div>

            <div class="event-card-footer">
              <button class="btn btn-outline btn-sm btn-view-event" data-id="${evt.id}">
                Ver Detalhes
              </button>

              ${isRegistered ? `
                <span class="badge badge-success" style="padding: 6px 12px;">
                  ✓ Inscrito
                </span>
              ` : isFull ? `
                <button class="btn btn-secondary btn-sm" disabled>
                  Esgotado
                </button>
              ` : `
                <button class="btn btn-primary btn-sm btn-enroll-event" data-id="${evt.id}">
                  Inscrever-se
                </button>
              `}
            </div>
          </div>
        </article>
      `;
    }).join('');

    // Bind botões
    container.querySelectorAll('.btn-view-event').forEach(btn => {
      btn.addEventListener('click', () => {
        this.openEventDetailsModal(btn.dataset.id);
      });
    });

    container.querySelectorAll('.btn-enroll-event').forEach(btn => {
      btn.addEventListener('click', () => {
        this.handleEnrollment(btn.dataset.id);
      });
    });
  },

  openEventDetailsModal(eventId) {
    const evt = store.getEventById(eventId);
    if (!evt) return;

    const currentUser = store.getCurrentUser();
    const isRegistered = currentUser ? store.isUserRegistered(evt.id, currentUser.id) : false;

    const modalTitle = document.getElementById('view-modal-title');
    const modalBody = document.getElementById('view-modal-body');
    const modalFooter = document.getElementById('view-modal-footer');

    if (modalTitle) modalTitle.textContent = 'Detalhes do Evento';

    if (modalBody) {
      modalBody.innerHTML = `
        <div class="modal-event-layout">
          <div>
            <img src="${evt.cover}" alt="${evt.title}" style="width: 100%; border-radius: var(--radius-lg); object-fit: cover; max-height: 220px;" onerror="this.src='/assets/images/event-comp.svg'" />
            <div style="margin-top: 14px; padding: 12px; background: #F8FAFC; border-radius: var(--radius-md); font-size: 13px;">
              <div style="font-weight: 700; color: var(--color-primary); margin-bottom: 4px;">Organização:</div>
              <div style="color: var(--color-text-main); font-weight: 600;">${evt.organizerName}</div>
              <div style="color: var(--color-text-muted); font-size: 11px;">Instituto Federal do Ceará</div>
            </div>
          </div>

          <div>
            <div style="display: flex; gap: 8px; margin-bottom: 12px; align-items: center;">
              <span class="badge badge-info">${evt.category}</span>
              <span class="badge ${evt.status === 'publicado' ? 'badge-success' : 'badge-warning'}">${evt.status}</span>
            </div>

            <h2 style="font-size: 22px; margin-bottom: 12px;">${evt.title}</h2>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #F8FAFC; padding: 14px; border-radius: var(--radius-md); margin-bottom: 16px; font-size: 13px;">
              <div><strong>📅 Período:</strong> ${evt.datesLabel}</div>
              <div><strong>🕒 Horário:</strong> ${evt.timeLabel}</div>
              <div><strong>📍 Local:</strong> ${evt.location}</div>
              <div><strong>🎓 Carga Horária:</strong> ${evt.workload}</div>
              <div><strong>👥 Vagas:</strong> ${evt.occupiedSeats} / ${evt.totalSeats} preenchidas</div>
            </div>

            <div style="margin-bottom: 16px;">
              <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 6px;">Descrição do Evento:</h4>
              <p style="font-size: 14px; line-height: 1.6; color: var(--color-text-secondary);">${evt.description}</p>
            </div>
          </div>
        </div>
      `;
    }

    if (modalFooter) {
      modalFooter.innerHTML = `
        <button class="btn btn-secondary" onclick="window.closeAnyModal()">Fechar</button>
        ${isRegistered ? `
          <button class="btn btn-outline-danger btn-cancel-reg" data-id="${evt.id}">
            Cancelar Inscrição
          </button>
          <button class="btn btn-primary" onclick="window.showTicketModal('${evt.id}')">
            Ver Comprovante / QR Code
          </button>
        ` : `
          <button class="btn btn-primary btn-modal-enroll" data-id="${evt.id}">
            Confirmar Inscrição
          </button>
        `}
      `;

      const enrollBtn = modalFooter.querySelector('.btn-modal-enroll');
      if (enrollBtn) {
        enrollBtn.addEventListener('click', () => {
          closeModal('modal-view-event');
          this.handleEnrollment(evt.id);
        });
      }

      const cancelBtn = modalFooter.querySelector('.btn-cancel-reg');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          this.handleCancelEnrollmentByEventId(evt.id);
        });
      }
    }

    openModal('modal-view-event');
  },

  handleEnrollment(eventId) {
    const currentUser = store.getCurrentUser();
    if (!currentUser) {
      showToast('Faça login para se inscrever nos eventos do IFCE.', 'info');
      window.navigateToView('login');
      return;
    }

    try {
      const reg = store.enrollEvent(eventId, currentUser);
      showToast(`Inscrição confirmada com sucesso! Código: ${reg.ticketCode}`, 'success');
      this.renderEventsGrid();
      window.showTicketModal(eventId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  handleCancelEnrollmentByEventId(eventId) {
    const currentUser = store.getCurrentUser();
    if (!currentUser) return;

    const userRegs = store.getRegistrationsForUser(currentUser.id);
    const target = userRegs.find(r => r.eventId === eventId && r.status !== 'cancelada');

    if (target) {
      if (confirm('Deseja realmente cancelar sua inscrição neste evento?')) {
        store.cancelEnrollment(target.id);
        showToast('Inscrição cancelada com sucesso.', 'info');
        closeModal('modal-view-event');
        this.renderEventsGrid();
        this.renderMyRegistrations();
      }
    }
  },

  renderMyRegistrations(containerId = 'my-registrations-container') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const currentUser = store.getCurrentUser();
    if (!currentUser) {
      container.innerHTML = `<p class="text-center">Por favor, faça login para ver suas inscrições.</p>`;
      return;
    }

    const regs = store.getRegistrationsForUser(currentUser.id).filter(r => r.status !== 'cancelada');

    if (regs.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 48px; background: #FFFFFF; border-radius: var(--radius-lg); border: 1px dashed var(--color-border);">
          <div style="font-size: 36px; margin-bottom: 8px;">📝</div>
          <h3 style="margin-bottom: 6px;">Você ainda não possui inscrições ativas</h3>
          <p style="color: var(--color-text-secondary); font-size: 14px; margin-bottom: 16px;">
            Explore o catálogo de eventos do IFCE e inscreva-se gratuitamente.
          </p>
          <button class="btn btn-primary" onclick="window.navigateToView('eventos')">
            Explorar Eventos
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        ${regs.map(r => {
          const evt = store.getEventById(r.eventId) || {
            title: r.eventTitle,
            datesLabel: 'Data confirmada',
            location: 'IFCE Fortaleza',
            workload: 'Carga Horária Válida',
            cover: '/assets/images/event-comp.svg'
          };

          return `
            <div class="card" style="padding: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
              <div style="display: flex; align-items: center; gap: 16px;">
                <img src="${evt.cover}" alt="${evt.title}" style="width: 70px; height: 70px; border-radius: var(--radius-md); object-fit: cover;" onerror="this.src='/assets/images/event-comp.svg'" />
                <div>
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <span class="badge badge-success">Inscrição Ativa</span>
                    <span style="font-family: var(--font-family-mono); font-size: 11px; color: var(--color-text-muted);">
                      Ticket: ${r.ticketCode}
                    </span>
                  </div>
                  <h3 style="font-size: 17px; margin-bottom: 4px;">${evt.title}</h3>
                  <div style="font-size: 13px; color: var(--color-text-secondary); display: flex; gap: 16px; flex-wrap: wrap;">
                    <span>📅 ${evt.datesLabel}</span>
                    <span>📍 ${evt.location}</span>
                    <span>${r.attended ? '✅ Presença Confirmada' : '⏳ Aguardando Evento'}</span>
                  </div>
                </div>
              </div>

              <div style="display: flex; gap: 10px; align-items: center;">
                <button class="btn btn-outline btn-sm" onclick="window.showTicketModal('${r.eventId}')">
                  Ver QR Code
                </button>
                <button class="btn btn-outline-danger btn-sm" onclick="window.eventsModule.cancelEnrollment('${r.id}')">
                  Cancelar
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  cancelEnrollment(regId) {
    if (confirm('Tem certeza que deseja cancelar sua inscrição?')) {
      store.cancelEnrollment(regId);
      showToast('Inscrição cancelada com sucesso.', 'info');
      this.renderMyRegistrations();
      this.renderEventsGrid();
    }
  }
};
