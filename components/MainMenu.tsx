import React, { useState, useMemo } from 'react';
import type { Page, User, Message, MachineType } from '../types';
import { UserGroupIcon, ArchiveIcon, CogIcon, ClipboardListIcon, ChartBarIcon, ChatBubbleLeftRightIcon, WrenchScrewdriverIcon, AdjustmentsIcon, DocumentTextIcon, ExclamationIcon } from './icons';
import MSMLogo from './MSMLogo';
import { fetchTable } from '../services/supabaseService';
import type { KaizenProblem } from '../types';

const ManagerMessagesModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    messages: Message[];
    currentUser: User | null;
    addMessage: (messageText: string, productionOrderId: string, machine: MachineType) => void;
}> = ({ isOpen, onClose, messages, currentUser, addMessage }) => {
    const [replyMessages, setReplyMessages] = useState<Record<string, string>>({});

    const groupedMessages = useMemo(() => {
        return messages.reduce((acc, msg) => {
            const key = msg.productionOrderId;
            if (!acc[key]) {
                acc[key] = {
                    orderId: msg.productionOrderId,
                    machine: msg.machine,
                    messages: [],
                };
            }
            acc[key].messages.push(msg);
            return acc;
        }, {} as Record<string, { orderId: string; machine: MachineType; messages: Message[] }>);
    }, [messages]);

    const sortedGroups = useMemo(() => {
        type MessageGroup = { orderId: string; machine: MachineType; messages: Message[] };
        // FIX: Explicitly type the parameters of the sort callback function to prevent them from being inferred as 'unknown'.
        // Fix: Explicitly type the sort callback parameters to avoid type inference issues.
        return Object.values(groupedMessages).sort((a: MessageGroup, b: MessageGroup) => {
            const lastMsgA = a.messages[a.messages.length - 1];
            const lastMsgB = b.messages[b.messages.length - 1];
            return new Date(lastMsgB.timestamp).getTime() - new Date(lastMsgA.timestamp).getTime();
        });
    }, [groupedMessages]);

    const handleReplyChange = (orderId: string, text: string) => {
        setReplyMessages(prev => ({ ...prev, [orderId]: text }));
    };

    const handleReply = (e: React.FormEvent, orderId: string, machine: MachineType) => {
        e.preventDefault();
        const messageText = replyMessages[orderId];
        if (messageText && messageText.trim() && currentUser) {
            addMessage(messageText.trim(), orderId, machine);
            setReplyMessages(prev => ({ ...prev, [orderId]: '' }));
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass-dark p-6 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-white/10">
                <h2 className="text-2xl font-bold text-white mb-4 border-b border-white/10 pb-4">Central de Mensagens do Gestor</h2>
                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                    {sortedGroups.length > 0 ? sortedGroups.map(group => (
                        <div key={group.orderId} className="bg-white/5 p-4 rounded-lg border border-white/5">
                            <h3 className="font-semibold text-[#00E5FF]">Ordem: {group.orderId} ({group.machine})</h3>
                            <div className="mt-2 space-y-2 text-sm max-h-48 overflow-y-auto">
                                {group.messages.map(msg => (
                                    <div key={msg.id} className={`p-3 rounded-lg border ${msg.senderId === currentUser?.id ? 'bg-[#0A2A3D] border-[#00E5FF]/30' : 'bg-white/5 border-white/10'}`}>
                                        <div className="flex justify-between items-baseline">
                                            <span className={`font-bold ${msg.senderId === currentUser?.id ? 'text-[#00E5FF]' : 'text-slate-300'}`}>{msg.senderUsername}</span>
                                            <span className="text-xs text-slate-500">{new Date(msg.timestamp).toLocaleString('pt-BR')}</span>
                                        </div>
                                        <p className="text-slate-200 mt-1">{msg.message}</p>
                                    </div>
                                ))}
                            </div>
                            <form onSubmit={(e) => handleReply(e, group.orderId, group.machine)} className="flex gap-2 mt-2 pt-2 border-t border-white/10">
                                <input
                                    type="text"
                                    value={replyMessages[group.orderId] || ''}
                                    onChange={(e) => handleReplyChange(group.orderId, e.target.value)}
                                    className="flex-grow p-2 bg-black/20 border border-white/10 rounded-md text-sm text-white focus:border-[#00E5FF] outline-none"
                                    placeholder="Digite sua resposta..."
                                    required
                                />
                                <button type="submit" className="bg-[#00E5FF] text-black font-bold py-2 px-4 rounded-md hover:bg-[#00BCD4] text-sm transition-colors">Enviar</button>
                            </form>
                        </div>
                    )) : (
                        <p className="text-center text-slate-500 py-10">Nenhuma mensagem recebida.</p>
                    )}
                </div>
                <div className="flex justify-end pt-4 mt-auto border-t border-white/10">
                    <button type="button" onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-4 rounded-lg transition border border-white/5">Fechar</button>
                </div>
            </div>
        </div>
    );
};


interface MainMenuProps {
    setPage: (page: Page) => void;
    onLogout: () => void;
    currentUser: User | null;
    messages: Message[];
    markAllMessagesAsRead: () => void;
    addMessage: (messageText: string, productionOrderId: string, machine: MachineType) => void;
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


const MainMenu: React.FC<MainMenuProps> = ({ setPage, onLogout, currentUser, messages, markAllMessagesAsRead, addMessage }) => {
    const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);
    const [pendingKaizenCount, setPendingKaizenCount] = useState(0);

    const unreadCount = useMemo(() => messages.filter(m => !m.isRead).length, [messages]);

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

    const handleOpenManagerMessages = () => {
        markAllMessagesAsRead();
        setIsManagerModalOpen(true);
    };

    const hasPermission = (page: Page): boolean => {
        if (!currentUser) return false;
        if (currentUser.role === 'admin' || currentUser.role === 'gestor') {
            return true;
        }
        if (page === 'peopleManagement' && currentUser.employeeId) {
            return true;
        }
        return !!currentUser.permissions?.[page];
    };

    const isGestor = currentUser?.role === 'admin' || currentUser?.role === 'gestor';

    return (
        <div className="min-h-screen p-6 sm:p-8 md:p-12 bg-[#F8FAFC]">
            <ManagerMessagesModal
                isOpen={isManagerModalOpen}
                onClose={() => setIsManagerModalOpen(false)}
                messages={messages}
                currentUser={currentUser}
                addMessage={addMessage}
            />

            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">
                        <span className="gradient-text">MSM</span> Gestão Inteligente
                    </h1>
                    <div className="flex items-center gap-2 text-slate-500 font-medium">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        <p>Bem-vindo, <span className="text-slate-900 font-bold">{currentUser?.username || 'Usuário'}</span></p>
                        <span className="mx-2 text-slate-300">|</span>
                        <span className="text-xs px-2 py-0.5 bg-slate-100 rounded-full border border-slate-200">
                            {currentUser?.role === 'admin' ? 'Administrador' : currentUser?.role === 'gestor' ? 'Gestor' : 'Operador'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={onLogout}
                        className="px-6 py-2.5 bg-white text-slate-700 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm flex items-center gap-2 group"
                    >
                        <span>Sair da conta</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 group-hover:text-red-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </button>
                </div>
            </header>

            <main className="space-y-10">
                {/* ESTOQUE */}
                {(hasPermission('stock') || hasPermission('finishedGoods')) && (
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
                            {hasPermission('finishedGoods') && (
                                <MenuButton
                                    onClick={() => setPage('finishedGoods')}
                                    label="Estoque Acabado (Treliça)"
                                    description="Visualização de produtos prontos para expedição."
                                    icon={<ArchiveIcon />}
                                    color="blue"
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
                {(hasPermission('trefila') || hasPermission('trelica') || hasPermission('productionDashboard')) && (
                    <section>
                        <div className="section-title">
                            <h2>Em Produção</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                            {hasPermission('trefila') && (
                                <MenuButton
                                    onClick={() => setPage('trefila')}
                                    label="Produção (Trefila)"
                                    description="Painel de operação da máquina trefiladeira."
                                    icon={<CogIcon />}
                                    color="cyan"
                                />
                            )}
                            {hasPermission('trelica') && (
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
                        {isGestor && (
                            <MenuButton
                                onClick={handleOpenManagerMessages}
                                label="Central de Mensagens"
                                description="Comunicação com operadores de produção."
                                icon={<ChatBubbleLeftRightIcon />}
                                notificationCount={unreadCount}
                                color="blue"
                            />
                        )}
                        {hasPermission('reports') && (
                            <MenuButton
                                onClick={() => setPage('reports')}
                                label="Relatórios"
                                description="Indicadores de performance e resultados."
                                icon={<ChartBarIcon />}
                                color="purple"
                            />
                        )}
                        {isGestor && (
                            <MenuButton
                                onClick={() => setPage('userManagement')}
                                label="Gerenciar Usuários"
                                description="Controle de acesso e perfis do sistema."
                                icon={<UserGroupIcon />}
                                color="indigo"
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