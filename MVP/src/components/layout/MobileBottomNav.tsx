import React from 'react';
import {
  LayoutDashboard,
  Calendar,
  Ticket,
  ClipboardCheck,
  Users,
  Menu,
} from 'lucide-react';
import { PerfilUsuario } from '../../types';
import { ActiveTab } from './Sidebar';

interface MobileBottomNavProps {
  userRole: PerfilUsuario;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenMobileMenu: () => void;
  pendingProfessorsCount?: number;
  pendingCertificatesCount?: number;
  onOpenCreateModal?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  userRole,
  activeTab,
  onSelectTab,
  onOpenMobileMenu,
  pendingProfessorsCount = 0,
}) => {
  const getNavItems = () => {
    switch (userRole) {
      case 'PARTICIPANTE':
        return [
          {
            id: 'dashboard' as ActiveTab,
            label: 'Painel',
            icon: LayoutDashboard,
          },
          {
            id: 'eventos' as ActiveTab,
            label: 'Eventos',
            icon: Calendar,
          },
          {
            id: 'minhas_inscricoes' as ActiveTab,
            label: 'Inscrições',
            icon: Ticket,
          },
        ];

      case 'PROFESSOR':
        return [
          {
            id: 'dashboard' as ActiveTab,
            label: 'Painel',
            icon: LayoutDashboard,
          },
          {
            id: 'eventos' as ActiveTab,
            label: 'Eventos',
            icon: Calendar,
          },
          {
            id: 'inscritos_frequencia' as ActiveTab,
            label: 'Presença',
            icon: ClipboardCheck,
          },
        ];

      case 'ADMINISTRADOR':
        return [
          {
            id: 'dashboard' as ActiveTab,
            label: 'Painel',
            icon: LayoutDashboard,
          },
          {
            id: 'eventos' as ActiveTab,
            label: 'Eventos',
            icon: Calendar,
          },
          {
            id: 'moderacao_usuarios' as ActiveTab,
            label: 'Docentes',
            icon: Users,
            badge: pendingProfessorsCount,
          },
        ];
    }
  };

  const navItems = getNavItems();

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 px-2 py-1 transition-colors"
      aria-label="Navegação móvel"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-colors cursor-pointer min-h-[44px] relative ${
                isActive
                  ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 ${
                    isActive
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 px-1 min-w-[16px] h-4 text-[10px] font-bold tabular-nums bg-amber-600 text-white rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-0.5 tracking-tight truncate max-w-[72px]">
                {item.label}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium transition-colors cursor-pointer min-h-[44px]"
          aria-label="Abrir menu completo"
        >
          <Menu className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          <span className="text-[11px] mt-0.5 tracking-tight truncate max-w-[72px]">Menu</span>
        </button>
      </div>
    </nav>
  );
};
