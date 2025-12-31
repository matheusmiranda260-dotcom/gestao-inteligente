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
    StarIcon
} from './icons';

interface SidebarProps {
    page: Page;
    setPage: (page: Page) => void;
    currentUser: User | null;
    notificationCount?: number;
}

const Sidebar: React.FC<SidebarProps> = ({ page, setPage, currentUser, notificationCount }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const hasPermission = (targetPage: Page): boolean => {
        if (!currentUser) return false;
        if (currentUser.role === 'admin' || currentUser.role === 'gestor') return true;
        if (targetPage === 'peopleManagement' && currentUser.employeeId) return true;
        return !!currentUser.permissions?.[targetPage];
    };

    const isGestor = currentUser?.role === 'admin' || currentUser?.role === 'gestor';

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
        <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
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
                </div>

                {/* PRODUÇÃO */}
                <div className="sidebar-category">
                    <div className="sidebar-category-title">{isCollapsed ? '🏭' : '🏭 Produção'}</div>
                    <MenuItem target="trefila" label="Produção – Trefila" icon={CogIcon} />
                    <MenuItem target="trelica" label="Produção – Treliça" icon={CogIcon} />
                    <MenuItem target="productionOrder" label="Ordens (Trefila)" icon={ClipboardListIcon} />
                    <MenuItem target="productionOrderTrelica" label="Ordens (Treliça)" icon={ClipboardListIcon} />
                </div>

                {/* ESTOQUE */}
                <div className="sidebar-category">
                    <div className="sidebar-category-title">{isCollapsed ? '📦' : '📦 Estoque'}</div>
                    <MenuItem target="stock" label="Matéria-prima" icon={ArchiveIcon} />
                    <MenuItem target="finishedGoods" label="Produto Acabado" icon={ArchiveIcon} />
                </div>

                {/* PESSOAS */}
                <div className="sidebar-category">
                    <div className="sidebar-category-title">{isCollapsed ? '👥' : '👥 Pessoas'}</div>
                    <MenuItem target="peopleManagement" label="Gestão de Pessoas" icon={UserGroupIcon} />
                    <MenuItem target="continuousImprovement" label="Melhoria Contínua" icon={AdjustmentsIcon} />
                </div>

                {/* GESTÃO */}
                <div className="sidebar-category">
                    <div className="sidebar-category-title">{isCollapsed ? '🧰' : '🧰 Gestão'}</div>
                    <MenuItem target="reports" label="Relatórios" icon={ChartBarIcon} />
                    <MenuItem target="workInstructions" label="Instruções" icon={DocumentTextIcon} />
                    <MenuItem target="partsManager" label="Peças" icon={WrenchScrewdriverIcon} />
                </div>

                {/* SISTEMA */}
                {isGestor && (
                    <div className="sidebar-category">
                        <div className="sidebar-category-title">{isCollapsed ? '⚙️' : '⚙️ Sistema'}</div>
                        <MenuItem target="userManagement" label="Usuários" icon={UserGroupIcon} />
                        <MenuItem target="messages" label="Mensagens" icon={ChatBubbleLeftRightIcon} />
                    </div>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;
