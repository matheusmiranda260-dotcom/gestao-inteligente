import React, { useState } from 'react';
import type { Page, User } from '../types';
import {
    ChartBarIcon,
    CogIcon,
    ClipboardListIcon,
    ArchiveIcon,
    UserGroupIcon,
    AdjustmentsIcon,
    DocumentTextIcon,
    WrenchScrewdriverIcon,
    ChatBubbleLeftRightIcon,
    StarIcon,
    ChevronRightIcon,
    DocumentReportIcon,
    LogoutIcon
} from './icons';

interface SidebarProps {
    page: Page;
    setPage: (page: Page) => void;
    currentUser: User | null;
    notificationCount?: number;
    isMobileMenuOpen?: boolean;
    onLogout?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ page, setPage, currentUser, notificationCount, isMobileMenuOpen, onLogout }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [expandedMenus, setExpandedMenus] = useState<string[]>(['stock']); // Default open

    const toggleMenu = (menu: string) => {
        setExpandedMenus(prev => prev.includes(menu) ? prev.filter(m => m !== menu) : [...prev, menu]);
    };

    React.useEffect(() => {
        if (['stock', 'stockAdd', 'stockTransfer'].includes(page)) {
            setExpandedMenus(prev => prev.includes('stock') ? prev : [...prev, 'stock']);
        } else if (['trefilaInProgress', 'trefilaPending', 'trefilaCompleted', 'trefilaReports', 'trefilaWeighing', 'trefilaRings'].includes(page)) {
            setExpandedMenus(prev => prev.includes('trefila') ? prev : [...prev, 'trefila']);
        } else if (['trelicaInProgress', 'trelicaPending', 'trelicaCompleted', 'trelicaReports'].includes(page)) {
            setExpandedMenus(prev => prev.includes('trelica') ? prev : [...prev, 'trelica']);
        } else if (['peopleManagement', 'continuousImprovement'].includes(page)) {
            setExpandedMenus(prev => prev.includes('people') ? prev : [...prev, 'people']);
        }
    }, [page]);

    const hasPermission = (targetPage: Page): boolean => {
        if (!currentUser) return false;
        // Super-admin and gestores always have access to everything by default
        if (currentUser.username === 'admin' || currentUser.role === 'admin' || currentUser.role === 'gestor') return true;

        // Self-management for employees
        if (targetPage === 'peopleManagement' && currentUser.employeeId) return true;

        // Specific permissions check
        return !!currentUser.permissions?.[targetPage];
    };

    const isGestor = currentUser?.role === 'admin' || currentUser?.role === 'gestor' || currentUser?.username === 'admin';
    const u = currentUser?.username?.toLowerCase();

    const MenuItem = ({ target, label, icon: Icon, highlight = false }: { target: Page, label: string, icon: any, highlight?: boolean }) => {
        if (!hasPermission(target)) return null;

        return (
            <button
                onClick={() => setPage(target)}
                className={`sidebar-item ${page === target ? 'active' : ''}`}
                title={isCollapsed ? label : ''}
            >
                <div className="sidebar-item-icon">
                    <Icon className="w-full h-full" />
                </div>
                {!isCollapsed && (
                    <span className="sidebar-item-label flex items-center gap-2">
                        {label}
                        {highlight && <StarIcon className="h-3 w-3 text-yellow-400" />}
                    </span>
                )}
                {label === 'Gestão de Pessoas' && notificationCount && notificationCount > 0 && isCollapsed && (
                    <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-[#0A2A3D]" />
                )}
            </button>
        );
    };

    return (
        <aside className={`sidebar no-print ${isCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
            <div className="sidebar-header">
                {!isCollapsed && (
                    <div className="sidebar-logo">
                        <span className="text-[#00E5FF]">MSM</span> GESTÃO
                    </div>
                )}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="sidebar-toggle"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d={isCollapsed ? "M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5" : "M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5"} />
                    </svg>
                </button>
            </div>

            <div className="sidebar-content">
                {/* VISÃO GERAL */}
                <div className="sidebar-category">
                    <div className="sidebar-category-title">{isCollapsed ? '📊' : '📊 Visão Geral'}</div>
                    <MenuItem target="productionDashboard" label="Dashboard" icon={ChartBarIcon} highlight />
                    <MenuItem target="meetingsTasks" label="Reuniões e Tarefas" icon={ClipboardListIcon} highlight />
                </div>

                {/* PRODUÇÃO */}
                <div className="sidebar-category">
                    <div className="sidebar-category-title">{isCollapsed ? '🏭' : '🏭 Produção'}</div>

                    {/* Trefila Collapsible */}
                    {(hasPermission('trefilaInProgress') || hasPermission('trefilaWeighing') || hasPermission('trefilaPending') || hasPermission('trefilaCompleted') || hasPermission('trefilaReports') || hasPermission('trefilaRings')) && (
                        <>
                            <button
                                onClick={() => toggleMenu('trefila')}
                                className={`sidebar-item ${['trefilaInProgress', 'trefilaPending', 'trefilaCompleted', 'trefilaReports', 'trefilaWeighing', 'trefilaRings'].includes(page) ? 'active' : ''} justify-between group`}
                                title={isCollapsed ? 'Produção – Trefila' : ''}
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="sidebar-item-icon shrink-0">
                                        <CogIcon className="w-full h-full" />
                                    </div>
                                    {!isCollapsed && <span className="sidebar-item-label whitespace-nowrap">Produção – Trefila</span>}
                                </div>
                                {!isCollapsed && (
                                    <ChevronRightIcon className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${expandedMenus.includes('trefila') ? 'rotate-90' : ''}`} />
                                )}
                            </button>

                            {!isCollapsed && expandedMenus.includes('trefila') && (
                                <div className="ml-4 pl-4 border-l border-slate-700/50 flex flex-col gap-0.5 mt-1 mb-2 animate-in slide-in-from-left-2 duration-200">
                                    {hasPermission('trefilaInProgress') && (
                                        <>
                                            <button onClick={() => setPage('trefilaInProgress')} className={`text-left text-[12px] font-medium py-1.5 px-3 rounded-md transition-all ${page === 'trefilaInProgress' ? 'text-[#00E5FF] bg-white/5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                                                ⚙️ Em Produção (Geral)
                                            </button>
                                            <div className="flex gap-1 px-3 mb-2">
                                                <button onClick={() => { localStorage.setItem('msm_active_machine', 'Trefila 1'); setPage('trefilaInProgress'); }} className="text-[9px] font-black bg-white/5 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 px-2 py-1 rounded border border-white/5 uppercase transition-all flex-1">Máquina 1</button>
                                                <button onClick={() => { localStorage.setItem('msm_active_machine', 'Trefila 2'); setPage('trefilaInProgress'); }} className="text-[9px] font-black bg-white/5 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 px-2 py-1 rounded border border-white/5 uppercase transition-all flex-1">Máquina 2</button>
                                            </div>
                                        </>
                                    )}
                                    {hasPermission('trefilaWeighing') && (
                                        <button onClick={() => setPage('trefilaWeighing')} className={`text-left text-[12px] font-medium py-1.5 px-3 rounded-md transition-all ${page === 'trefilaWeighing' ? 'text-[#00E5FF] bg-white/5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                                            ⚖️ Pesagem de Rolos
                                        </button>
                                    )}
                                    {hasPermission('trefilaPending') && (
                                        <button onClick={() => setPage('trefilaPending')} className={`text-left text-[12px] font-medium py-1.5 px-3 rounded-md transition-all ${page === 'trefilaPending' ? 'text-[#00E5FF] bg-white/5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                                            📋 Próximas Produções
                                        </button>
                                    )}
                                    {hasPermission('trefilaCompleted') && (
                                        <button onClick={() => setPage('trefilaCompleted')} className={`text-left text-[12px] font-medium py-1.5 px-3 rounded-md transition-all ${page === 'trefilaCompleted' ? 'text-[#00E5FF] bg-white/5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                                            📦 Produções Finalizadas
                                        </button>
                                    )}
                                    {hasPermission('trefilaReports') && (
                                        <button onClick={() => setPage('trefilaReports')} className={`text-left text-[12px] font-medium py-1.5 px-3 rounded-md transition-all ${page === 'trefilaReports' ? 'text-[#00E5FF] bg-white/5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                                            📑 Relatórios de Turno
                                        </button>
                                    )}
                                    {hasPermission('trefilaRings') && (
                                        <button onClick={() => setPage('trefilaRings')} className={`text-left text-[12px] font-medium py-1.5 px-3 rounded-md transition-all ${page === 'trefilaRings' ? 'text-[#00E5FF] bg-white/5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                                            💍 Simulação & Anéis
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {/* Treliça Collapsible */}
                    {(hasPermission('trelicaInProgress') || hasPermission('trelicaPending') || hasPermission('trelicaCompleted') || hasPermission('trelicaReports')) && (
                        <>
                            <button
                                onClick={() => toggleMenu('trelica')}
                                className={`sidebar-item ${['trelicaInProgress', 'trelicaPending', 'trelicaCompleted', 'trelicaReports'].includes(page) ? 'active' : ''} justify-between group`}
                                title={isCollapsed ? 'Produção – Treliça' : ''}
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="sidebar-item-icon shrink-0">
                                        <CogIcon className="w-full h-full" />
                                    </div>
                                    {!isCollapsed && <span className="sidebar-item-label whitespace-nowrap">Produção – Treliça</span>}
                                </div>
                                {!isCollapsed && (
                                    <ChevronRightIcon className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${expandedMenus.includes('trelica') ? 'rotate-90' : ''}`} />
                                )}
                            </button>

                            {!isCollapsed && expandedMenus.includes('trelica') && (
                                <div className="ml-4 pl-4 border-l border-slate-700/50 flex flex-col gap-0.5 mt-1 mb-2 animate-in slide-in-from-left-2 duration-200">
                                    {hasPermission('trelicaInProgress') && (
                                        <>
                                            <button onClick={() => setPage('trelicaInProgress')} className={`text-left text-[12px] font-medium py-1.5 px-3 rounded-md transition-all ${page === 'trelicaInProgress' ? 'text-[#00E5FF] bg-white/5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                                                ⚙️ Em Produção (Geral)
                                            </button>
                                            <div className="flex gap-1 px-3 mb-2">
                                                <button onClick={() => { localStorage.setItem('msm_active_machine', 'Treliça 1'); setPage('trelicaInProgress'); }} className="text-[9px] font-black bg-white/5 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 px-2 py-1 rounded border border-white/5 uppercase transition-all flex-1">Máquina 1</button>
                                                <button onClick={() => { localStorage.setItem('msm_active_machine', 'Treliça 2'); setPage('trelicaInProgress'); }} className="text-[9px] font-black bg-white/5 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 px-2 py-1 rounded border border-white/5 uppercase transition-all flex-1">Máquina 2</button>
                                            </div>
                                        </>
                                    )}
                                    {hasPermission('trelicaPending') && (
                                        <button onClick={() => setPage('trelicaPending')} className={`text-left text-[12px] font-medium py-1.5 px-3 rounded-md transition-all ${page === 'trelicaPending' ? 'text-[#00E5FF] bg-white/5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                                            📋 Próximas Produções
                                        </button>
                                    )}
                                    {hasPermission('trelicaCompleted') && (
                                        <button onClick={() => setPage('trelicaCompleted')} className={`text-left text-[12px] font-medium py-1.5 px-3 rounded-md transition-all ${page === 'trelicaCompleted' ? 'text-[#00E5FF] bg-white/5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                                            📦 Produções Finalizadas
                                        </button>
                                    )}
                                    {hasPermission('trelicaReports') && (
                                        <button onClick={() => setPage('trelicaReports')} className={`text-left text-[12px] font-medium py-1.5 px-3 rounded-md transition-all ${page === 'trelicaReports' ? 'text-[#00E5FF] bg-white/5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                                            📑 Relatórios de Turno
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    <MenuItem target="productionOrder" label="Ordens (Trefila)" icon={ClipboardListIcon} />
                    <MenuItem target="productionOrderTrelica" label="Ordens (Treliça)" icon={ClipboardListIcon} />
                </div>

                {/* ESTOQUE */}
                <div className="sidebar-category">
                    <div className="sidebar-category-title">{isCollapsed ? '📦' : '📦 Estoque'}</div>

                    {hasPermission('stock') && (
                        <>
                            {/* Collapsible Matéria-prima */}
                            <button
                                onClick={() => toggleMenu('stock')}
                                className={`sidebar-item ${['stock', 'stockAdd', 'stockTransfer'].includes(page) ? 'active' : ''} justify-between group`}
                                title={isCollapsed ? 'Matéria-prima' : ''}
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="sidebar-item-icon shrink-0">
                                        <ArchiveIcon className="w-full h-full" />
                                    </div>
                                    {!isCollapsed && <span className="sidebar-item-label whitespace-nowrap">Matéria-prima</span>}
                                </div>
                                {!isCollapsed && (
                                    <ChevronRightIcon className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${expandedMenus.includes('stock') ? 'rotate-90' : ''}`} />
                                )}
                            </button>

                            {/* Submenu */}
                            {!isCollapsed && expandedMenus.includes('stock') && (
                                <div className="ml-4 pl-4 border-l border-slate-700/50 flex flex-col gap-0.5 mt-1 mb-2 animate-in slide-in-from-left-2 duration-200">
                                    {hasPermission('stockAdd') && (
                                        <button onClick={() => setPage('stockAdd')} className={`text-left text-[12px] font-medium py-1.5 px-3 rounded-md transition-all ${page === 'stockAdd' ? 'text-[#00E5FF] bg-white/5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                                            + Conferência
                                        </button>
                                    )}
                                    {hasPermission('stockTransfer') && (
                                        <button onClick={() => setPage('stockTransfer')} className={`text-left text-[12px] font-medium py-1.5 px-3 rounded-md transition-all ${page === 'stockTransfer' ? 'text-[#00E5FF] bg-white/5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                                            ➡️ Transferência
                                        </button>
                                    )}

                                    {hasPermission('stock') && (
                                        <button onClick={() => setPage('stock')} className={`text-left text-[12px] font-medium py-1.5 px-3 rounded-md transition-all ${page === 'stock' ? 'text-[#00E5FF] bg-white/5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                                            ⚙️ Gestão de Lotes
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    <MenuItem target="finishedGoods" label="Produto Acabado" icon={ArchiveIcon} />
                    <MenuItem target="trelicaStock" label="Estoque de Treliça" icon={ArchiveIcon} />
                </div>


                {/* PESSOAS */}
                <div className="sidebar-category">
                    <div className="sidebar-category-title">{isCollapsed ? '👥' : '👥 Pessoas'}</div>

                    <button
                        onClick={() => toggleMenu('people')}
                        className={`sidebar-item ${['peopleManagement', 'continuousImprovement'].includes(page) ? 'active' : ''} justify-between group`}
                        title={isCollapsed ? 'Pessoas' : ''}
                    >
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="sidebar-item-icon shrink-0">
                                <UserGroupIcon className="w-full h-full" />
                            </div>
                            {!isCollapsed && <span className="sidebar-item-label whitespace-nowrap">Gestão</span>}
                        </div>
                        {!isCollapsed && (
                            <ChevronRightIcon className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${expandedMenus.includes('people') ? 'rotate-90' : ''}`} />
                        )}
                    </button>

                    {!isCollapsed && expandedMenus.includes('people') && (
                        <div className="ml-4 pl-4 border-l border-slate-700/50 flex flex-col gap-0.5 mt-1 mb-2 animate-in slide-in-from-left-2 duration-200">
                            {hasPermission('peopleManagement') && (
                                <button onClick={() => setPage('peopleManagement')} className={`text-left text-[12px] font-medium py-1.5 px-3 rounded-md transition-all ${page === 'peopleManagement' ? 'text-[#00E5FF] bg-white/5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                                    👥 Gestão de Pessoas
                                </button>
                            )}
                            {hasPermission('continuousImprovement') && (
                                <button onClick={() => setPage('continuousImprovement')} className={`text-left text-[12px] font-medium py-1.5 px-3 rounded-md transition-all ${page === 'continuousImprovement' ? 'text-[#00E5FF] bg-white/5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                                    ✨ Melhoria Contínua
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* GESTÃO */}
                <div className="sidebar-category">
                    <div className="sidebar-category-title">{isCollapsed ? '🧰' : '🧰 Gestão'}</div>
                    <MenuItem target="reports" label="Relatórios" icon={ChartBarIcon} />
                    <MenuItem target="laboratory" label="Laboratório" icon={DocumentReportIcon} />
                    <MenuItem target="documents" label="Documentos" icon={DocumentTextIcon} />
                    <MenuItem target="workInstructions" label="Instruções" icon={DocumentTextIcon} />
                    <MenuItem target="partsManager" label="Peças" icon={WrenchScrewdriverIcon} />
                </div>

                {/* SISTEMA */}
                {(hasPermission('userManagement') || hasPermission('gaugesManager')) && (
                    <div className="sidebar-category">
                        <div className="sidebar-category-title">{isCollapsed ? '⚙️' : '⚙️ Sistema'}</div>
                        <MenuItem target="userManagement" label="Usuários" icon={UserGroupIcon} />
                        <MenuItem target="gaugesManager" label="Bitolas" icon={AdjustmentsIcon} />
                    </div>
                )}
            </div>

            {/* Logout Button */}
            <div className="sidebar-footer p-4 border-t border-white/10">
                <button
                    onClick={() => {
                        if (onLogout && confirm('Deseja realmente sair e voltar para a tela de login?')) {
                            onLogout();
                        }
                    }}
                    className="flex items-center gap-3 w-full p-3 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 group"
                    title={isCollapsed ? 'Sair' : ''}
                >
                    <div className="sidebar-item-icon shrink-0">
                        <LogoutIcon className="w-full h-full group-hover:scale-110 transition-transform" />
                    </div>
                    {!isCollapsed && <span className="font-bold text-sm uppercase tracking-wider">Sair do Sistema</span>}
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
