import React, { useEffect } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Ticket,
  Award,
  Settings,
  ShieldCheck,
  FileCheck2,
  Users,
  ClipboardCheck,
  FolderKanban,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { PerfilUsuario } from '../../types';
import { Logo } from '../common/Logo';

export type ActiveTab =
  | 'dashboard'
  | 'eventos'
  | 'minhas_inscricoes'
  | 'certificados'
  | 'meus_eventos'
  | 'inscritos_frequencia'
  | 'moderacao_usuarios'
  | 'moderacao_certificados'
  | 'configuracoes'
  | 'validar_certificado';

interface SidebarProps {
  userRole: PerfilUsuario;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  pendingCertificatesCount?: number;
  pendingProfessorsCount?: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  isCollapsedDesktop?: boolean;
  onToggleCollapseDesktop?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  userRole,
  activeTab,
  onSelectTab,
  pendingCertificatesCount = 0,
  pendingProfessorsCount = 0,
  isOpenMobile = false,
  onCloseMobile,
  isCollapsedDesktop = false,
  onToggleCollapseDesktop,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpenMobile && onCloseMobile) {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpenMobile, onCloseMobile]);

  useEffect(() => {
    if (isOpenMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpenMobile]);

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
          {
            id: 'certificados' as ActiveTab,
            label: 'Certificados',
            icon: Award,
          },
          {
            id: 'configuracoes' as ActiveTab,
            label: 'Configurações',
            icon: Settings,
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
            id: 'minhas_inscricoes' as ActiveTab,
            label: 'Inscrições',
            icon: Ticket,
          },
          {
            id: 'meus_eventos' as ActiveTab,
            label: 'Meus Eventos',
            icon: FolderKanban,
          },
          {
            id: 'inscritos_frequencia' as ActiveTab,
            label: 'Inscritos e Presença',
            icon: ClipboardCheck,
          },
          {
            id: 'configuracoes' as ActiveTab,
            label: 'Configurações',
            icon: Settings,
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
            id: 'minhas_inscricoes' as ActiveTab,
            label: 'Inscrições',
            icon: Ticket,
          },
          {
            id: 'meus_eventos' as ActiveTab,
            label: 'Gerenciar Eventos',
            icon: FolderKanban,
          },
          {
            id: 'moderacao_usuarios' as ActiveTab,
            label: 'Aprovação e Usuários',
            icon: Users,
            badge: pendingProfessorsCount,
          },
          {
            id: 'moderacao_certificados' as ActiveTab,
            label: 'Certificados',
            icon: Award,
            badge: pendingCertificatesCount,
          },
          {
            id: 'configuracoes' as ActiveTab,
            label: 'Configurações',
            icon: Settings,
          },
        ];
    }
  };

  const navItems = getNavItems();

  const handleItemClick = (tab: ActiveTab) => {
    onSelectTab(tab);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-slate-900/55 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white dark:bg-slate-900 p-4 flex flex-col justify-between shadow-2xl transition-all duration-200 ease-out lg:static lg:z-auto lg:shadow-none lg:border-r lg:border-slate-200/80 dark:lg:border-slate-800 lg:min-h-[calc(100vh-65px)] ${
          isCollapsedDesktop ? 'lg:w-20' : 'lg:w-64'
        } ${
          isOpenMobile
            ? 'translate-x-0 w-72 max-w-[85vw]'
            : '-translate-x-full lg:translate-x-0 w-72 max-w-[85vw]'
        }`}
      >
        <div>
          {/* Mobile Drawer Header */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800 lg:hidden">
            <Logo size="sm" />
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Fechar menu lateral"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Desktop Collapse Toggle */}
          {onToggleCollapseDesktop && (
            <div className="hidden lg:flex items-center justify-end pb-3 mb-2 border-b border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onToggleCollapseDesktop}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title={isCollapsedDesktop ? 'Expandir barra lateral' : 'Recolher barra lateral'}
                aria-label={isCollapsedDesktop ? 'Expandir barra lateral' : 'Recolher barra lateral'}
              >
                {isCollapsedDesktop ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronLeft className="w-4 h-4" />
                )}
              </button>
            </div>
          )}

          {/* Main Navigation */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item.id)}
                  title={isCollapsedDesktop ? item.label : undefined}
                  className={`relative w-full flex items-center ${
                    isCollapsedDesktop ? 'lg:justify-center' : 'justify-between'
                  } px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer min-h-[44px] whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-5 h-5 shrink-0 ${
                        isActive
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    />
                    {!isCollapsedDesktop && <span className="truncate">{item.label}</span>}
                  </div>
                  {!isCollapsedDesktop && item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-2 px-2 py-0.5 text-xs font-bold tabular-nums bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 rounded-md shrink-0">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Academic Tools */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
            {!isCollapsedDesktop && (
              <p className="px-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 mb-2">
                Autenticidade
              </p>
            )}
            <button
              type="button"
              onClick={() => handleItemClick('validar_certificado')}
              title="Validar Certificado Digital"
              className={`w-full flex items-center ${
                isCollapsedDesktop ? 'lg:justify-center' : 'gap-3'
              } px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer min-h-[44px] whitespace-nowrap ${
                activeTab === 'validar_certificado'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/70'
              }`}
            >
              <FileCheck2
                className={`w-4 h-4 shrink-0 ${
                  activeTab === 'validar_certificado'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              />
              {!isCollapsedDesktop && <span className="truncate">Validar Certificado</span>}
            </button>
          </div>
        </div>

        {/* Institutional Footer Note */}
        {!isCollapsedDesktop ? (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs text-slate-700 dark:text-slate-300 mt-6">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                IFCE Campus Cedro
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Gestão de eventos científicos e emissão de certificados digitais.
            </p>
          </div>
        ) : (
          <div
            className="hidden lg:flex justify-center p-2 text-emerald-700 dark:text-emerald-400"
            title="IFCE Campus Cedro"
          >
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
        )}
      </aside>
    </>
  );
};
