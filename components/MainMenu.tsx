import React, { useState, useMemo } from 'react';
import type { Page, User } from '../types';
import { UserGroupIcon, ArchiveIcon, CogIcon, ClipboardListIcon, ChartBarIcon, ChatBubbleLeftRightIcon, WrenchScrewdriverIcon, AdjustmentsIcon, DocumentTextIcon, ExclamationIcon } from './icons';
import MSMLogo from './MSMLogo';
import { fetchTable } from '../services/supabaseService';
import type { KaizenProblem } from '../types';




interface MainMenuProps {
    setPage: (page: Page) => void;
    onLogout: () => void;
    currentUser: User | null;
}

const MenuButton: React.FC<{ onClick: () => void; label: string; description: string; icon: React.ReactNode; notificationCount?: number; color?: 'cyan' | 'blue' | 'purple' | 'teal' | 'indigo' }> = ({ onClick, label, description, icon, notificationCount, color = 'blue' }) => {

    const colorStyles = {
        cyan: { bg: 'bg-cyan-50/50', text: 'text-cyan-600', border: 'border-cyan-100' },
        blue: { bg: 'bg-blue-50/50', text: 'text-blue-600', border: 'border-blue-100' },
        purple: { bg: 'bg-violet-50/50', text: 'text-violet-600', border: 'border-violet-100' },
        teal: { bg: 'bg-teal-50/50', text: 'text-teal-600', border: 'border-teal-100' },
        indigo: { bg: 'bg-indigo-50/50', text: 'text-indigo-600', border: 'border-indigo-100' },
    };

    const style = colorStyles[color] || colorStyles['blue'];

    return (
        <button
            onClick={onClick}
            className="group relative flex flex-col p-5 rounded-2xl glass-card text-left transition-all duration-300 h-full overflow-hidden"
        >
            {notificationCount && notificationCount > 0 && (
                <div className="badge-count">
                    {notificationCount}
                </div>
            )}

            <div className="flex items-start justify-between mb-4">
                <div className={`menu-icon-container inline-flex p-3 rounded-xl ${style.bg} ${style.text}`}>
                    {React.cloneElement(icon as React.ReactElement<any>, { className: `h-6 w-6` })}
                </div>
            </div>

            <div>
                <h3 className="text-base font-bold text-slate-800 mb-1.5 group-hover:text-blue-600 transition-colors">
                    {label}
                </h3>
                <p className="text-slate-500 text-xs leading-relaxed line-clamp-2">{description}</p>
            </div>

            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-right from-transparent via-blue-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </button>
    );
};


const MainMenu: React.FC<MainMenuProps> = ({ setPage, onLogout, currentUser }) => {
    const [pendingKaizenCount, setPendingKaizenCount] = useState(0);



    React.useEffect(() => {
        if (currentUser?.employeeId) {
            const checkTasks = async () => {
                try {
                    const allProblems = await fetchTable<KaizenProblem>('kaizen_problems');
                    const myTasks = allProblems.filter(p => {
                        const isResponsibleId = p.responsibleIds?.includes(currentUser.employeeId!);
                        const isResponsibleName = p.responsible && currentUser.username && p.responsible.includes(currentUser.username);
                        return (isResponsibleId || isResponsibleName) && p.status !== 'Resolvido';
                    });
                    setPendingKaizenCount(myTasks.length);
                } catch (e) {
                    console.error('Error fetching pending tasks for menu', e);
                }
            };
            checkTasks();
        }
    }, [currentUser]);



    const hasPermission = (page: Page): boolean => {
        if (!currentUser) return false;
        // Super-admin and gestores always have access to everything by default
        if (currentUser.username === 'admin' || currentUser.role === 'admin' || currentUser.role === 'gestor') return true;

        // Self-management for employees
        if (page === 'peopleManagement' && currentUser.employeeId) return true;

        // Specific permissions check
        return !!currentUser.permissions?.[page];
    };

    const isGestor = currentUser?.role === 'admin' || currentUser?.role === 'gestor';

    return (
        <div className="min-h-screen p-6 sm:p-8 md:p-12 bg-[#F8FAFC]">


            <div className="mb-8">
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
                    <span className="gradient-text">MSM</span> Gestão Inteligente
                </h1>
                <div className="flex items-center gap-2 text-slate-500 font-medium">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <p>Bem-vindo, <span className="text-slate-900 font-bold">{currentUser?.username || 'Usuário'}</span></p>
                    <span className="mx-2 text-slate-300">|</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs px-2 py-0.5 bg-slate-100 rounded-full border border-slate-200 text-slate-500">
                        {currentUser?.role === 'admin' ? 'Administrador' : currentUser?.role === 'gestor' ? 'Gestor' : 'Operador'}
                    </span>
                    <button
                        onClick={onLogout}
                        className="flex items-center gap-2 text-xs font-black text-slate-400 hover:text-red-600 transition-all uppercase tracking-[0.2em] px-4 py-2 bg-slate-100 rounded-xl hover:bg-red-50 border border-slate-200 hover:border-red-100"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        Sair do Sistema
                    </button>
                </div>
            </div>

            <main className="space-y-10">
                {/* ESTOQUE */}
                {(hasPermission('stock') || hasPermission('finishedGoods') || hasPermission('stock_add') || hasPermission('stock_transfer') || hasPermission('stock_inventory') || hasPermission('stock_map')) && (
                    <section>
                        <div className="section-title">
                            <h2>Estoque</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                            {hasPermission('stock') && (
                                <MenuButton
                                    onClick={() => setPage('stock')}
                                    label="Controle de Estoque"
                                    description="Gestão de lotes de matéria-prima e localização."
                                    icon={<ArchiveIcon />}
                                    color="cyan"
                                />
                            )}
                            {hasPermission('stock_add') && (
                                <MenuButton
                                    onClick={() => setPage('stock_add')}
                                    label="Adicionar ao Estoque"
                                    description="Conferência de entrada de novos lotes."
                                    icon={<ClipboardListIcon />}
                                    color="teal"
                                />
                            )}
                            {hasPermission('stock_transfer') && (
                                <MenuButton
                                    onClick={() => setPage('stock_transfer')}
                                    label="Transferência"
                                    description="Movimentação de lotes entre setores."
                                    icon={<AdjustmentsIcon />}
                                    color="indigo"
                                />
                            )}
                            {hasPermission('stock_inventory') && (
                                <MenuButton
                                    onClick={() => setPage('stock_inventory')}
                                    label="Inventário (Conferência)"
                                    description="Auditoria física de estoque via celular."
                                    icon={<ChartBarIcon />}
                                    color="blue"
                                />
                            )}
                            {hasPermission('stock_map') && (
                                <MenuButton
                                    onClick={() => setPage('stock_map')}
                                    label="Mapa de Estoque"
                                    description="Visualização em pirâmide dos lotes."
                                    icon={<AdjustmentsIcon />}
                                    color="cyan"
                                />
                            )}
                            {hasPermission('finishedGoods') && (
                                <MenuButton
                                    onClick={() => setPage('finishedGoods')}
                                    label="Estoque Acabado (Treliça)"
                                    description="Visualização de produtos prontos para expedição."
                                    icon={<ArchiveIcon />}
                                    color="teal"
                                />
                            )}
                        </div>
                    </section>
                )}

                {/* ORDEM DE PRODUÇÃO */}
                {(hasPermission('productionOrderTrelica') || hasPermission('productionOrder')) && (
                    <section>
                        <div className="section-title">
                            <h2>Ordem de Produção</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                            {hasPermission('productionOrderTrelica') && (
                                <MenuButton
                                    onClick={() => setPage('productionOrderTrelica')}
                                    label="Ordem (Treliça)"
                                    description="Criação e acompanhamento de ordens para treliça."
                                    icon={<ClipboardListIcon />}
                                    color="blue"
                                />
                            )}
                            {hasPermission('productionOrder') && (
                                <MenuButton
                                    onClick={() => setPage('productionOrder')}
                                    label="Ordem (Trefila)"
                                    description="Criação e acompanhamento de ordens para trefila."
                                    icon={<ClipboardListIcon />}
                                    color="teal"
                                />
                            )}
                        </div>
                    </section>
                )}

                {/* GESTÃO DE FÁBRICA */}
                {(hasPermission('stickyNotes') || hasPermission('productionDashboard')) && (
                    <section>
                        <div className="section-title">
                            <h2>Gestão de Fábrica</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                            {hasPermission('productionDashboard') && (
                                <MenuButton
                                    onClick={() => setPage('productionDashboard')}
                                    label="Painel de Controle"
                                    description="Visão geral da produção e KPIs em tempo real."
                                    icon={<ChartBarIcon />}
                                    color="indigo"
                                />
                            )}
                            {hasPermission('stickyNotes') && (
                                <MenuButton
                                    onClick={() => setPage('stickyNotes')}
                                    label="Quadro de Lembretes"
                                    description="Post-its digitais para avisos e pendências importantes."
                                    icon={<ChatBubbleLeftRightIcon />}
                                    color="purple"
                                />
                            )}
                        </div>
                    </section>
                )}

                {/* RH */}
                {(hasPermission('continuousImprovement') || hasPermission('peopleManagement')) && (
                    <section>
                        <div className="section-title">
                            <h2>Recursos Humanos</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                            {hasPermission('continuousImprovement') && (
                                <MenuButton
                                    onClick={() => setPage('continuousImprovement')}
                                    label="Melhoria Contínua"
                                    description="Kaizen Digital, gestão de ações e problemas."
                                    icon={<AdjustmentsIcon />}
                                    color="teal"
                                />
                            )}
                            {hasPermission('peopleManagement') && (
                                <MenuButton
                                    onClick={() => setPage('peopleManagement')}
                                    label="Gestão de Pessoas"
                                    description="Engajamento, disciplina e desenvolvimento."
                                    icon={<UserGroupIcon />}
                                    color="cyan"
                                    notificationCount={pendingKaizenCount}
                                />
                            )}
                        </div>
                    </section>
                )}

                {/* EM PRODUÇÃO */}
                {(hasPermission('trefila_in_progress') || hasPermission('trefila_pending') || hasPermission('trefila_completed') || hasPermission('trefila_reports') ||
                    hasPermission('trelica_in_progress') || hasPermission('trelica_pending') || hasPermission('trelica_completed') || hasPermission('trelica_reports') ||
                    hasPermission('productionDashboard')) && (
                        <section>
                            <div className="section-title">
                                <h2>Em Produção</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                                {(hasPermission('trefila_in_progress') || hasPermission('trefila_pending') || hasPermission('trefila_completed') || hasPermission('trefila_reports')) && (
                                    <MenuButton
                                        onClick={() => setPage('trefila')}
                                        label="Produção (Trefila)"
                                        description="Painel de operação da máquina trefiladeira."
                                        icon={<CogIcon />}
                                        color="cyan"
                                    />
                                )}
                                {(hasPermission('trelica_in_progress') || hasPermission('trelica_pending') || hasPermission('trelica_completed') || hasPermission('trelica_reports')) && (
                                    <MenuButton
                                        onClick={() => setPage('trelica')}
                                        label="Produção (Treliça)"
                                        description="Painel de operação da máquina de treliça."
                                        icon={<CogIcon />}
                                        color="indigo"
                                    />
                                )}
                                {hasPermission('productionDashboard') && (
                                    <MenuButton
                                        onClick={() => setPage('productionDashboard')}
                                        label="Dashboard"
                                        description="Monitoramento em tempo real da produção."
                                        icon={<ChartBarIcon />}
                                        color="teal"
                                    />
                                )}
                            </div>
                        </section>
                    )}

                {/* GESTÃO & FERRAMENTAS */}
                <section>
                    <div className="section-title">
                        <h2>Gestão & Ferramentas</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">

                        {hasPermission('reports') && (
                            <MenuButton
                                onClick={() => setPage('reports')}
                                label="Relatórios"
                                description="Indicadores de performance e resultados."
                                icon={<ChartBarIcon />}
                                color="purple"
                            />
                        )}
                        {hasPermission('userManagement') && (
                            <MenuButton
                                onClick={() => setPage('userManagement')}
                                label="Gerenciar Usuários"
                                description="Controle de acesso e perfis do sistema."
                                icon={<UserGroupIcon />}
                                color="indigo"
                            />
                        )}
                        {hasPermission('gaugesManager') && (
                            <MenuButton
                                onClick={() => setPage('gaugesManager')}
                                label="Gerenciar Bitolas"
                                description="Configuração de bitolas de Fio Máquina e CA-60."
                                icon={<AdjustmentsIcon />}
                                color="blue"
                            />
                        )}
                        {hasPermission('partsManager') && (
                            <MenuButton
                                onClick={() => setPage('partsManager')}
                                label="Gerenciador de Peças"
                                description="Estoque de manutenção e peças de reposição."
                                icon={<WrenchScrewdriverIcon />}
                                color="cyan"
                            />
                        )}
                        {hasPermission('workInstructions') && (
                            <MenuButton
                                onClick={() => setPage('workInstructions')}
                                label="Instruções de Trabalho"
                                description="Procedimentos e guias operacionais."
                                icon={<DocumentTextIcon />}
                                color="indigo"
                            />
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
};


export default MainMenu;