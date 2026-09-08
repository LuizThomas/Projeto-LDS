/**
 * IFCE Iventus - Módulo de Perfil e Alteração de Senha
 */

import { store } from './store.js';
import { showToast } from './ui.js';

export const profileModule = {
  renderProfile() {
    const user = store.getCurrentUser();
    if (!user) return;

    // Atualiza cabeçalho visual do perfil
    const nameHeading = document.getElementById('profile-header-name');
    const roleHeading = document.getElementById('profile-header-role');
    const avatarImg = document.getElementById('profile-avatar-display');

    if (nameHeading) nameHeading.textContent = user.name;
    if (roleHeading) roleHeading.textContent = `${user.curso} • ${user.campus}`;
    if (avatarImg) avatarImg.src = user.avatar;

    // Preenche os campos do formulário de dados pessoais
    const form = document.getElementById('form-personal-data');
    if (form) {
      const setVal = (name, val) => {
        const el = form.querySelector(`[name="${name}"]`);
        if (el) el.value = val || '';
      };

      setVal('name', user.name);
      setVal('email', user.email);
      setVal('matricula', user.matricula);
      setVal('curso', user.curso);
      setVal('campus', user.campus);
      setVal('telefone', user.telefone);
      setVal('bio', user.bio);
    }
  },

  handleProfileSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const currentUser = store.getCurrentUser();
    if (!currentUser) return;

    const updatedData = {
      name: form.querySelector('[name="name"]').value.trim(),
      email: form.querySelector('[name="email"]').value.trim(),
      matricula: form.querySelector('[name="matricula"]').value.trim(),
      curso: form.querySelector('[name="curso"]').value.trim(),
      campus: form.querySelector('[name="campus"]').value.trim(),
      telefone: form.querySelector('[name="telefone"]').value.trim(),
      bio: form.querySelector('[name="bio"]').value.trim()
    };

    if (!updatedData.name || !updatedData.email) {
      showToast('Nome e e-mail institucional são obrigatórios.', 'error');
      return;
    }

    store.updateUserProfile(currentUser.id, updatedData);
    showToast('Dados cadastrais atualizados com sucesso!', 'success');
    this.renderProfile();
  },

  handlePasswordSubmit(e) {
    e.preventDefault();
    const form = e.target;

    const currentPass = form.querySelector('[name="current_password"]').value;
    const newPass = form.querySelector('[name="new_password"]').value;
    const confirmPass = form.querySelector('[name="confirm_new_password"]').value;

    if (!currentPass || !newPass || !confirmPass) {
      showToast('Preencha todos os campos de senha.', 'error');
      return;
    }

    if (newPass.length < 6) {
      showToast('A nova senha deve ter no mínimo 6 caracteres.', 'error');
      return;
    }

    if (newPass !== confirmPass) {
      showToast('A confirmação da nova senha não confere.', 'error');
      return;
    }

    showToast('Senha alterada com sucesso!', 'success');
    form.reset();
  }
};
