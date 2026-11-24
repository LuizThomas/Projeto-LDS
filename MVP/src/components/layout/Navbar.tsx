import React, { useState } from 'react';
import {
  Search,
  ChevronDown,
  LogOut,
  Settings,
  ShieldCheck,
  GraduationCap,
  UserCheck,
  Check,
  Menu,
  X,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { Logo } from '../common/Logo';
import { ThemeToggle } from '../common/ThemeToggle';
import { Usuario, PerfilUsuario } from '../../types';

interface NavbarProps {
  currentUser: Usuario;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onSwitchUser: (email: string) => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  allUsers: Usuario[];
  demoMode?: boolean;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
  onToggleCollapseDesktop?: () => void;
  isCollapsedDesktop?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  searchTerm,
  onSearchChange,
  onSwitchUser,
  onOpenProfile,
  onLogout,
  allUsers,
  demoMode = false,
  onToggleMobileMenu,
  isMobileMenuOpen = false,
  onToggleCollapseDesktop,
  isCollapsedDesktop = false,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const demoProfiles: { label: string; role: PerfilUsuario; user: Usuario; icon: any }[] = [
    {
      label: 'Participante',
      role: 'PARTICIPANTE',
      user:
        allUsers.find((u) => u.perfil === 'PARTICIPANTE' && u.email_verificado !== false) ||
        currentUser,
      icon: UserCheck,
    },
    {
      label: 'Professor',
      role: 'PROFESSOR',
      user:
        allUsers.find((u) => u.perfil === 'PROFESSOR' && u.status_conta === 'ATIVO') ||
        currentUser,
      icon: GraduationCap,
    },
    {
      label: 'Administrador',
      role: 'ADMINISTRADOR',
      user: allUsers.find((u) => u.perfil === 'ADMINISTRADOR') || currentUser,
      icon: ShieldCheck,
    },
  ];

  const getRoleLabel = (perfil: PerfilUsuario) => {
    switch (perfil) {
      case 'ADMINISTRADOR':
        return 'Administrador';
      case 'PROFESSOR':
        return 'Professor';
      case 'PARTICIPANTE':
        return 'Participante';
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 px-3 sm:px-6 lg:px-8 py-2 transition-colors">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        {/* Zone 1: Menu toggle + Brand */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {onToggleMobileMenu && (
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="lg:hidden p-2 -ml-1 text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label={isMobileMenuOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}

          {onToggleCollapseDesktop && (
            <button
              type="button"
              onClick={onToggleCollapseDesktop}
              className="hidden lg:flex p-2 -ml-1 text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title={isCollapsedDesktop ? 'Expandir barra lateral' : 'Recolher barra lateral'}
              aria-label={isCollapsedDesktop ? 'Expandir barra lateral' : 'Recolher barra lateral'}
            >
              {isCollapsedDesktop ? (
                <PanelLeft className="w-5 h-5" />
              ) : (
                <PanelLeftClose className="w-5 h-5" />
              )}
            </button>
          )}

          <Logo size="md" />
        </div>

        {/* Zone 2: Search Bar (Desktop/Tablet) */}
        <div className="flex-1 max-w-lg mx-2 hidden md:block">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Pesquisar eventos acadêmicos..."
              className="w-full pl-10 pr-16 py-2 bg-slate-100/80 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/90 focus:bg-white dark:focus:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl border border-transparent focus:border-emerald-600 focus:outline-none transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Zone 3: Theme Toggle + User Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
            aria-label="Buscar eventos"
          >
            <Search className="w-5 h-5" />
          </button>

          <ThemeToggle compact />

          {/* Role Switcher ONLY in explicit Demo Mode */}
          {demoMode && (
            <div className="hidden xl:flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium">
              {demoProfiles.map(({ label, user, role }) => {
                const isActive = currentUser.perfil === role;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => onSwitchUser(user.email)}
                    className={`px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 font-semibold shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                    title={`Alternar para ${user.nome} (${label})`}
                  >
                    <span>{label}</span>
                    {isActive && (
                      <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 p-1 sm:p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:outline-none cursor-pointer min-h-[42px]"
            >
              <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center border border-emerald-200 dark:border-emerald-800 overflow-hidden font-bold text-xs shrink-0">
                {currentUser.foto_perfil ? (
                  <img
                    src={currentUser.foto_perfil}
                    alt={currentUser.nome}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>
                    {(currentUser.nome || 'US')
                      .split(' ')
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()}
                  </span>
                )}
              </div>

              <div className="text-left hidden lg:block">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight truncate max-w-[140px]">
                  {currentUser.nome}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {getRoleLabel(currentUser.perfil)}
                </p>
              </div>

              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${
                  dropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {dropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50 iv-modal-in"
                onClick={() => setDropdownOpen(false)}
              >
                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                    Conectado como
                  </p>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-50 truncate">
                    {currentUser.nome}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {currentUser.email}
                  </p>
                  <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
                    {getRoleLabel(currentUser.perfil)}
                  </p>
                </div>

                {demoMode && (
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 xl:hidden">
                    <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mb-1.5">
                      Alternar Perfil (Demo)
                    </p>
                    <div className="space-y-1">
                      {demoProfiles.map(({ label, user, role, icon: Icon }) => {
                        const isActive = currentUser.perfil === role;
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSwitchUser(user.email);
                              setDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[40px] ${
                              isActive
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>{label}</span>
                            </div>
                            {isActive && (
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenProfile();
                      setDropdownOpen(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 font-medium transition-colors cursor-pointer min-h-[42px]"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span>Meu Perfil e Configurações</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onLogout();
                      setDropdownOpen(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-2.5 font-medium transition-colors cursor-pointer min-h-[42px]"
                  >
                    <LogOut className="w-4 h-4 text-red-500" />
                    <span>Sair da conta</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {mobileSearchOpen && (
        <div className="pt-2.5 pb-1 md:hidden">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Pesquisar eventos acadêmicos..."
              autoFocus
              className="w-full pl-9 pr-9 py-2.5 bg-slate-100 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-900 outline-none min-h-[42px]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
