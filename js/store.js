/**
 * IFCE Iventus - Store Centralizado com LocalStorage e Reatividade
 */

import { INITIAL_DATA } from './data.js';

const STORAGE_KEY = 'ifce_iventus_state_v1';
const CURRENT_USER_KEY = 'ifce_iventus_current_user_v1';

class Store {
  constructor() {
    this.listeners = new Set();
    this.init();
  }

  init() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.state = JSON.parse(stored);
      } else {
        this.state = JSON.parse(JSON.stringify(INITIAL_DATA));
        this.save();
      }

      // Usuário atual padrão: Lais Holanda (participante)
      const storedUser = localStorage.getItem(CURRENT_USER_KEY);
      if (storedUser) {
        this.currentUser = JSON.parse(storedUser);
      } else {
        this.currentUser = this.state.users[0]; // Lais Holanda
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(this.currentUser));
      }
    } catch (e) {
      console.warn('Erro ao carregar localStorage, usando dados iniciais', e);
      this.state = JSON.parse(JSON.stringify(INITIAL_DATA));
      this.currentUser = this.state.users[0];
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('Falha ao persistir dados no localStorage', e);
    }
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach(fn => fn(this.state, this.currentUser));
  }

  // --- Gestão de Sessão e Usuário ---
  getCurrentUser() {
    return this.currentUser;
  }

  setCurrentUser(user) {
    this.currentUser = user;
    try {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } catch (e) {}
    this.notify();
  }

  switchRole(role) {
    const found = this.state.users.find(u => u.role === role);
    if (found) {
      this.setCurrentUser(found);
    }
  }

  // --- Operações de Eventos ---
  getEvents() {
    return this.state.events;
  }

  getEventById(id) {
    return this.state.events.find(e => e.id === id);
  }

  createEvent(eventData) {
    const newEvent = {
      id: 'evt_' + Date.now(),
      title: eventData.title || 'Novo Evento IFCE',
      category: eventData.category || 'Geral',
      dateStart: eventData.dateStart || new Date().toISOString().split('T')[0],
      dateEnd: eventData.dateEnd || new Date().toISOString().split('T')[0],
      datesLabel: eventData.datesLabel || 'A definir',
      timeLabel: eventData.timeLabel || '08:00h - 18:00h',
      location: eventData.location || 'Auditório IFCE',
      workload: eventData.workload || '20 horas',
      workloadHours: parseInt(eventData.workloadHours) || 20,
      totalSeats: parseInt(eventData.totalSeats) || 50,
      occupiedSeats: 0,
      status: eventData.status || 'publicado',
      organizerId: this.currentUser ? this.currentUser.id : 'usr_2',
      organizerName: this.currentUser ? this.currentUser.name : 'Organização IFCE',
      cover: eventData.cover || '/assets/images/event-comp.svg',
      description: eventData.description || 'Descrição detalhada do evento acadêmico do IFCE.'
    };

    this.state.events.unshift(newEvent);
    this.save();
    return newEvent;
  }

  updateEvent(id, updatedData) {
    const index = this.state.events.findIndex(e => e.id === id);
    if (index !== -1) {
      this.state.events[index] = { ...this.state.events[index], ...updatedData };
      this.save();
      return this.state.events[index];
    }
    return null;
  }

  deleteEvent(id) {
    this.state.events = this.state.events.filter(e => e.id !== id);
    // Remove inscrições associadas
    this.state.registrations = this.state.registrations.filter(r => r.eventId !== id);
    this.save();
  }

  // --- Inscrições ---
  getRegistrationsForUser(userId) {
    return this.state.registrations.filter(r => r.userId === userId);
  }

  getRegistrationsForEvent(eventId) {
    return this.state.registrations.filter(r => r.eventId === eventId);
  }

  isUserRegistered(eventId, userId) {
    return this.state.registrations.some(
      r => r.eventId === eventId && r.userId === userId && r.status !== 'cancelada'
    );
  }

  enrollEvent(eventId, user) {
    const event = this.getEventById(eventId);
    if (!event) throw new Error('Evento não encontrado');

    if (this.isUserRegistered(eventId, user.id)) {
      throw new Error('Você já está inscrito neste evento.');
    }

    if (event.occupiedSeats >= event.totalSeats) {
      throw new Error('Todas as vagas foram preenchidas.');
    }

    const reg = {
      id: 'reg_' + Date.now(),
      eventId: event.id,
      eventTitle: event.title,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      matricula: user.matricula,
      curso: user.curso,
      registrationDate: new Date().toISOString().split('T')[0],
      status: 'confirmada',
      attended: false,
      ticketCode: `IFCE-${event.id.toUpperCase()}-${Math.floor(10000 + Math.random() * 90000)}`,
      certificateIssued: false
    };

    event.occupiedSeats += 1;
    this.state.registrations.unshift(reg);
    this.save();
    return reg;
  }

  cancelEnrollment(regId) {
    const reg = this.state.registrations.find(r => r.id === regId);
    if (reg) {
      reg.status = 'cancelada';
      const event = this.getEventById(reg.eventId);
      if (event && event.occupiedSeats > 0) {
        event.occupiedSeats -= 1;
      }
      this.save();
      return true;
    }
    return false;
  }

  toggleAttendance(regId) {
    const reg = this.state.registrations.find(r => r.id === regId);
    if (reg) {
      reg.attended = !reg.attended;
      // Se teve presença confirmada, pode emitir certificado
      if (reg.attended && !reg.certificateIssued) {
        reg.certificateIssued = true;
        // Gera o certificado correspondente
        const event = this.getEventById(reg.eventId);
        this.issueCertificate({
          eventId: reg.eventId,
          eventTitle: reg.eventTitle,
          recipientId: reg.userId,
          recipientName: reg.userName,
          recipientMatricula: reg.matricula,
          workload: event ? event.workload : '20 horas',
          signedBy: this.currentUser ? this.currentUser.name : 'Coordenação IFCE'
        });
      }
      this.save();
      return reg;
    }
    return null;
  }

  // --- Certificados ---
  getCertificatesForUser(userId) {
    return this.state.certificates.filter(c => c.recipientId === userId);
  }

  getAllCertificates() {
    return this.state.certificates;
  }

  issueCertificate(certData) {
    const existing = this.state.certificates.find(
      c => c.eventId === certData.eventId && c.recipientId === certData.recipientId
    );
    if (existing) return existing;

    const newCert = {
      id: 'cert_' + Date.now(),
      eventId: certData.eventId,
      eventTitle: certData.eventTitle,
      recipientId: certData.recipientId,
      recipientName: certData.recipientName,
      recipientMatricula: certData.recipientMatricula,
      workload: certData.workload || '20 horas',
      issueDate: new Date().toISOString().split('T')[0],
      validationCode: `IFCE-CERT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`,
      status: 'emitido',
      signedBy: certData.signedBy || 'Coordenação IFCE'
    };

    this.state.certificates.unshift(newCert);
    this.save();
    return newCert;
  }

  approveCertificate(certId) {
    const cert = this.state.certificates.find(c => c.id === certId);
    if (cert) {
      cert.status = 'emitido';
      this.save();
      return cert;
    }
    return null;
  }

  // --- Solicitações de Inscrição (Admin) ---
  getPendingApplications() {
    return this.state.pendingApplications;
  }

  approveApplication(appId) {
    const app = this.state.pendingApplications.find(a => a.id === appId);
    if (app) {
      app.status = 'aprovada';
      this.save();
      return true;
    }
    return false;
  }

  rejectApplication(appId) {
    const app = this.state.pendingApplications.find(a => a.id === appId);
    if (app) {
      app.status = 'recusada';
      this.save();
      return true;
    }
    return false;
  }

  // --- Perfil e Senha ---
  updateUserProfile(userId, data) {
    const user = this.state.users.find(u => u.id === userId);
    if (user) {
      Object.assign(user, data);
      if (this.currentUser && this.currentUser.id === userId) {
        this.currentUser = { ...user };
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(this.currentUser));
      }
      this.save();
      return user;
    }
    return null;
  }

  resetToDefault() {
    this.state = JSON.parse(JSON.stringify(INITIAL_DATA));
    this.currentUser = this.state.users[0];
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CURRENT_USER_KEY);
    this.save();
  }
}

export const store = new Store();
