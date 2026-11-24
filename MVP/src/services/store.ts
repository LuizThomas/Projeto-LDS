import {
  Usuario,
  Evento,
  Atividade,
  Inscricao,
  Frequencia,
  Certificado,
  SolicitacaoCertificadoModeracao,
} from '../types';

const DEMO_STORAGE_KEY = 'ifce_iventus_demo_v4';

interface StoreData {
  currentUser: Usuario;
  usuarios: Usuario[];
  eventos: Evento[];
  atividades: Atividade[];
  inscricoes: Inscricao[];
  frequencias: Frequencia[];
  certificados: Certificado[];
  favoritos: number[];
  solicitacoesCertificado: SolicitacaoCertificadoModeracao[];
}

const EMPTY_USER: Usuario = {
  id_usuario: 0,
  nome: '',
  email: '',
  matricula: null,
  perfil: 'PARTICIPANTE',
  status_conta: 'ATIVO',
  email_verificado: true,
  created_at: '',
};

export class AppStore {
  private data: StoreData;
  private listeners: Set<() => void> = new Set();
  private inMemoryToken: string | null = null;
  private demoMode: boolean = false;
  private idCounter: number = Date.now();

  private nextUniqueId(): number {
    this.idCounter = Math.max(this.idCounter + 1, Date.now());
    return this.idCounter;
  }

  constructor() {
    this.data = this.createEmptyState();
  }

  private createEmptyState(): StoreData {
    return {
      currentUser: { ...EMPTY_USER },
      usuarios: [],
      eventos: [],
      atividades: [],
      inscricoes: [],
      frequencias: [],
      certificados: [],
      favoritos: [],
      solicitacoesCertificado: [],
    };
  }

  public setDemoMode(enabled: boolean): void {
    this.demoMode = enabled;
  }

  public isDemoMode(): boolean {
    return this.demoMode;
  }

  private save(): void {
    if (this.demoMode && typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(this.data));
      } catch {
        // ignore quota errors
      }
    }
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  // In-memory Bearer token (primary browser persistence uses HttpOnly cookies)
  public getToken(): string | null {
    return this.inMemoryToken;
  }

  public setToken(token: string | null): void {
    this.inMemoryToken = token;
  }

  public clearSession(): void {
    this.inMemoryToken = null;
    this.data = this.createEmptyState();
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('ifce_iventus_auth_token');
        localStorage.removeItem('ifce_iventus_data_v3');
        sessionStorage.removeItem(DEMO_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    this.notify();
  }

  public hydrateWorkspace(snapshot: Partial<StoreData>): void {
    this.data = {
      ...this.data,
      eventos: Array.isArray(snapshot.eventos) ? snapshot.eventos : this.data.eventos,
      atividades: Array.isArray(snapshot.atividades) ? snapshot.atividades : this.data.atividades,
      inscricoes: Array.isArray(snapshot.inscricoes) ? snapshot.inscricoes : this.data.inscricoes,
      frequencias: Array.isArray(snapshot.frequencias) ? snapshot.frequencias : this.data.frequencias,
      certificados: Array.isArray(snapshot.certificados)
        ? snapshot.certificados
        : this.data.certificados,
      favoritos: Array.isArray(snapshot.favoritos) ? snapshot.favoritos : this.data.favoritos,
      solicitacoesCertificado: Array.isArray(snapshot.solicitacoesCertificado)
        ? snapshot.solicitacoesCertificado
        : this.data.solicitacoesCertificado,
    };
    this.save();
  }

  public setCurrentUser(user: Usuario): void {
    this.data.currentUser = user;
    const idx = this.data.usuarios.findIndex((u) => u.id_usuario === user.id_usuario);
    if (idx >= 0) {
      this.data.usuarios[idx] = { ...this.data.usuarios[idx], ...user };
    } else if (user.id_usuario > 0) {
      this.data.usuarios.unshift(user);
    }
    this.save();
  }

  public setUsuariosFromServer(serverUsers: Usuario[]): void {
    if (!Array.isArray(serverUsers)) return;
    const byId = new Map<number, Usuario>();
    this.data.usuarios.forEach((u) => byId.set(u.id_usuario, u));
    serverUsers.forEach((su) => byId.set(su.id_usuario, su));
    this.data.usuarios = Array.from(byId.values());
    this.save();
  }

  public getCurrentUser(): Usuario {
    return this.data.currentUser;
  }

  public getUsuarios(): Usuario[] {
    return [...this.data.usuarios];
  }

  public getProfessoresPendentes(): Usuario[] {
    return this.data.usuarios.filter(
      (u) => u.perfil === 'PROFESSOR' && u.status_conta === 'PENDENTE'
    );
  }

  public getEventos(): Evento[] {
    return [...this.data.eventos];
  }

  public getAtividades(): Atividade[] {
    return [...this.data.atividades];
  }

  public getInscricoes(): Inscricao[] {
    return [...this.data.inscricoes];
  }

  public getFrequencias(): Frequencia[] {
    return [...this.data.frequencias];
  }

  public getCertificados(): Certificado[] {
    return [...this.data.certificados];
  }

  public getFavoritos(): number[] {
    return [...this.data.favoritos];
  }

  public getSolicitacoesCertificado(): SolicitacaoCertificadoModeracao[] {
    return [...this.data.solicitacoesCertificado];
  }

  public addCreatedUser(user: Partial<Usuario> & { id_usuario: number; email: string }): void {
    const existingIdx = this.data.usuarios.findIndex(
      (u) => u.email.toLowerCase() === user.email.toLowerCase()
    );
    const merged: Usuario = {
      id_usuario: user.id_usuario,
      nome: user.nome || 'Novo Usuário',
      email: user.email,
      matricula: user.matricula || null,
      perfil: user.perfil || 'PARTICIPANTE',
      status_conta: user.status_conta || (user.perfil === 'PROFESSOR' ? 'PENDENTE' : 'ATIVO'),
      email_verificado: user.email_verificado ?? user.perfil !== 'PARTICIPANTE',
      telefone: user.telefone || null,
      materias: user.materias || null,
      created_at: user.created_at || new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      this.data.usuarios[existingIdx] = { ...this.data.usuarios[existingIdx], ...merged };
    } else {
      this.data.usuarios.unshift(merged);
    }
    this.save();
  }

  public moderarUsuario(
    id_usuario: number,
    decisao: 'APROVAR' | 'RECUSAR',
    motivo?: string
  ): void {
    const user = this.data.usuarios.find((u) => u.id_usuario === id_usuario);
    if (user) {
      user.status_conta = decisao === 'APROVAR' ? 'ATIVO' : 'RECUSADO';
      user.decisao_em = new Date().toISOString();
      if (motivo !== undefined) {
        user.motivo_decisao = motivo || null;
      }
      this.save();
    }
  }

  public updateProfile(id_usuario: number, updates: Partial<Usuario>): void {
    const idx = this.data.usuarios.findIndex((u) => u.id_usuario === id_usuario);
    if (idx !== -1) {
      this.data.usuarios[idx] = { ...this.data.usuarios[idx], ...updates };
      if (this.data.currentUser.id_usuario === id_usuario) {
        this.data.currentUser = this.data.usuarios[idx];
      }
      this.save();
    } else if (this.data.currentUser.id_usuario === id_usuario) {
      this.data.currentUser = { ...this.data.currentUser, ...updates };
      this.save();
    }
  }

  public setFavoritosFromServer(favoritos: number[]): void {
    this.data.favoritos = [...favoritos];
    this.save();
  }

  public toggleFavorito(id_evento: number): void {
    if (this.data.favoritos.includes(id_evento)) {
      this.data.favoritos = this.data.favoritos.filter((id) => id !== id_evento);
    } else {
      this.data.favoritos.push(id_evento);
    }
    this.save();
  }

  public upsertEventoFromServer(evento: Evento, atividade?: Atividade): void {
    const idx = this.data.eventos.findIndex((e) => e.id_evento === evento.id_evento);
    if (idx >= 0) {
      this.data.eventos[idx] = { ...this.data.eventos[idx], ...evento };
    } else {
      this.data.eventos.unshift(evento);
    }
    if (atividade) {
      const aIdx = this.data.atividades.findIndex((a) => a.id_atividade === atividade.id_atividade);
      if (aIdx >= 0) {
        this.data.atividades[aIdx] = atividade;
      } else {
        this.data.atividades.push(atividade);
      }
    }
    this.save();
  }

  public addInscricaoFromServer(inscricao: Inscricao): void {
    const idx = this.data.inscricoes.findIndex((i) => i.id_inscricao === inscricao.id_inscricao);
    if (idx >= 0) {
      this.data.inscricoes[idx] = inscricao;
    } else {
      this.data.inscricoes.unshift(inscricao);
    }
    const evento = this.data.eventos.find((e) => e.id_evento === inscricao.evento_id);
    if (evento) {
      evento.inscritos_count = (evento.inscritos_count || 0) + 1;
    }
    this.save();
  }

  public cancelarInscricao(id_inscricao: number): void {
    const inscricao = this.data.inscricoes.find((i) => i.id_inscricao === id_inscricao);
    if (inscricao) {
      inscricao.status = 'CANCELADA';
      const evento = this.data.eventos.find((e) => e.id_evento === inscricao.evento_id);
      if (evento && evento.inscritos_count && evento.inscritos_count > 0) {
        evento.inscritos_count -= 1;
      }
      this.save();
    }
  }

  public updateFrequenciaFromServer(freq: Frequencia): void {
    const idx = this.data.frequencias.findIndex((f) => f.id_inscricao === freq.id_inscricao);
    if (idx >= 0) {
      this.data.frequencias[idx] = freq;
    } else {
      this.data.frequencias.push(freq);
    }
    this.save();
  }

  public isPresente(id_inscricao: number): boolean {
    const freq = this.data.frequencias.find((f) => f.id_inscricao === id_inscricao);
    return Boolean(freq && freq.presente);
  }

  public addCertificadoFromServer(cert: Certificado): void {
    const exists = this.data.certificados.some((c) => c.id_certificado === cert.id_certificado);
    if (!exists) {
      this.data.certificados.unshift(cert);
    }
    this.save();
  }

  public moderarCertificado(id_certificado: number, decisao: 'APROVAR' | 'RECUSAR'): void {
    const item = this.data.solicitacoesCertificado.find((s) => s.id_certificado === id_certificado);
    if (item) {
      item.status_moderacao = decisao === 'APROVAR' ? 'APROVADO' : 'RECUSADO';
      this.save();
    }
  }

  public validarCertificado(codigo: string): Certificado | null {
    const clean = codigo.trim().toUpperCase();
    return this.data.certificados.find((c) => c.codigo_validacao.toUpperCase() === clean) || null;
  }

  public nextLocalId(): number {
    return this.nextUniqueId();
  }
}

export const store = new AppStore();
