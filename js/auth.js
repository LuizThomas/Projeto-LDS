/**
 * IFCE Iventus - Módulo de Autenticação e Gestão de Usuários
 */

import { store } from './store.js';
import { showToast } from './ui.js';

export const auth = {
  getCurrentUser() {
    return store.getCurrentUser();
  },

  isAuthenticated() {
    return !!store.getCurrentUser();
  },

  login(identifier, password) {
    if (!identifier || !password) {
      throw new Error('Preencha o e-mail/CPF e a senha.');
    }

    // Busca usuário pelo e-mail ou nome
    const users = store.state.users;
    let found = users.find(
      u => u.email.toLowerCase() === identifier.trim().toLowerCase() ||
           u.matricula.toLowerCase() === identifier.trim().toLowerCase()
    );

    // Se for e-mail genérico no mock, usa o primeiro usuário
    if (!found) {
      found = users[0];
    }

    store.setCurrentUser(found);
    showToast(`Bem-vindo(a) de volta, ${found.name}!`, 'success');
    return found;
  },

  register(userData) {
    if (!userData.name || !userData.email || !userData.password) {
      throw new Error('Todos os campos obrigatórios devem ser preenchidos.');
    }

    if (userData.password !== userData.confirmPassword) {
      throw new Error('As senhas digitadas não coincidem.');
    }

    const newUser = {
      id: 'usr_' + Date.now(),
      name: userData.name,
      email: userData.email,
      role: userData.role || 'participante',
      matricula: userData.matricula || `2024${Math.floor(100000 + Math.random() * 900000)}`,
      curso: userData.curso || 'Ensino Superior IFCE',
      campus: userData.campus || 'Campus Fortaleza',
      telefone: userData.telefone || '(85) 99999-0000',
      avatar: userData.role === 'professor'
        ? '/assets/images/avatar-prof.svg'
        : userData.role === 'administrador'
        ? '/assets/images/avatar-admin.svg'
        : '/assets/images/avatar-lais.svg',
      bio: 'Novo membro da comunidade acadêmica do IFCE.'
    };

    store.state.users.push(newUser);
    store.setCurrentUser(newUser);
    store.save();

    showToast('Conta criada com sucesso!', 'success');
    return newUser;
  },

  logout() {
    store.setCurrentUser(null);
    showToast('Você saiu da sua conta com segurança.', 'info');
  },

  recoverPassword(email) {
    if (!email || !email.includes('@')) {
      throw new Error('Informe um e-mail institucional válido.');
    }

    showToast('Link de recuperação enviado para ' + email, 'success');
    return true;
  },

  resetPassword(newPassword, confirmPassword) {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('A nova senha deve ter no mínimo 6 caracteres.');
    }

    if (newPassword !== confirmPassword) {
      throw new Error('As senhas não coincidem.');
    }

    showToast('Sua senha foi redefinida com sucesso!', 'success');
    return true;
  }
};
