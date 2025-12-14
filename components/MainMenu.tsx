import React, { useState, useMemo } from 'react';
import type { Page, User, Message, MachineType } from '../types';
import { UserGroupIcon, ArchiveIcon, CogIcon, ClipboardListIcon, ChartBarIcon, ChatBubbleLeftRightIcon, WrenchScrewdriverIcon, AdjustmentsIcon, DocumentTextIcon } from './icons';
import MSMLogo from './MSMLogo';

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
        cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-100' },
        blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
        purple: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100' },
        teal: { bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-100' },
        indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100' },
    };

    const style = colorStyles[color] || colorStyles['blue'];

    return (
        <button
            onClick={onClick}
            className="relative bg-white p-6 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 text-left w-full flex flex-col h-full border border-slate-100 group"
        >
            {notificationCount && notificationCount > 0 && (
                <div className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center animate-pulse shadow-md">
                    {notificationCount}
                </div>
            )}

            <div className={`inline-flex p-3 rounded-xl mb-4 transition-colors duration-300 ${style.bg} ${style.text}`}>
                {React.cloneElement(icon as React.ReactElement<any>, { className: `h-8 w-8` })}
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-blue-600 transition-colors">
                {label}
            </h3>

            <p className="text-slate-500 text-sm leading-relaxed">{description}</p>
        </button>
    );
};


const MainMenu: React.FC<MainMenuProps> = ({ setPage, onLogout, currentUser, messages, markAllMessagesAsRead, addMessage }) => {
    const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);

    const unreadCount = useMemo(() => messages.filter(m => !m.isRead).length, [messages]);

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

    return (
        <div className="min-h-screen p-4 sm:p-6 md:p-10 bg-[#F8FAFC]">
            <ManagerMessagesModal
                isOpen={isManagerModalOpen}
                onClose={() => setIsManagerModalOpen(false)}
                messages={messages}
                currentUser={currentUser}
                addMessage={addMessage}
            />

            <header className="flex justify-between items-center mb-12">
                <div className="flex items-center gap-4">
                    <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                        <MSMLogo size="sm" showText={false} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Menu Principal</h1>
                        <p className="text-slate-500 font-medium">Bem-vindo, {currentUser?.username || 'Usuário'}. <span className="text-xs text-slate-300">({currentUser?.role} | EmpID: {currentUser?.employeeId || 'Nenhum'} | Perms: {Object.keys(currentUser?.permissions || {}).filter(k => currentUser?.permissions?.[k as Page]).length})</span></p>
                    </div>
                </div>
                <button
                    onClick={onLogout}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-6 rounded-lg transition"
                >
                    Sair
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {hasPermission('stock') && <MenuButton
                    onClick={() => setPage('stock')}
                    label="Controle de Estoque"
                    description="Cadastre, visualize e gerencie os lotes de matéria-prima."
                    icon={<ArchiveIcon />}
                    color="cyan"
                />}
                {hasPermission('finishedGoods') && <MenuButton
                    onClick={() => setPage('finishedGoods')}
                    label="Estoque Acabado (Treliça)"
                    description="Visualize o estoque de treliças prontas para expedição."
                    icon={<ArchiveIcon />}
                    color="blue"
                />}
                {hasPermission('trefila') && <MenuButton
                    onClick={() => setPage('trefila')}
                    label="Produção (TREFILA)"
                    description="Acesse o painel de produção da máquina trefiladeira."
                    icon={<CogIcon />}
                    color="cyan"
                />}
                {hasPermission('trelica') && <MenuButton
                    onClick={() => setPage('trelica')}
                    label="Produção (TRELIÇA)"
                    description="Acesse o painel de produção da máquina de treliça."
                    icon={<CogIcon />}
                    color="indigo"
                />}
                {hasPermission('productionOrder') && <MenuButton
                    onClick={() => setPage('productionOrder')}
                    label="Ordem (Trefila)"
                    description="Crie e acompanhe as ordens para a máquina Trefila."
                    icon={<ClipboardListIcon />}
                    color="teal"
                />}
                {hasPermission('productionOrderTrelica') && <MenuButton
                    onClick={() => setPage('productionOrderTrelica')}
                    label="Ordem (Treliça)"
                    description="Crie e acompanhe as ordens para a máquina Treliça."
                    icon={<ClipboardListIcon />}
                    color="blue"
                />}
                {hasPermission('productionDashboard') && <MenuButton
                    onClick={() => setPage('productionDashboard')}
                    label="Dashboard de Produção"
                    description="Acompanhe Trefila e Treliça em tempo real."
                    icon={<ChartBarIcon />}
                    color="teal"
                />}
                {(currentUser?.role === 'admin' || currentUser?.role === 'gestor') && (
                    <MenuButton
                        onClick={handleOpenManagerMessages}
                        label="Central de Mensagens"
                        description="Veja as mensagens dos operadores de produção."
                        icon={<ChatBubbleLeftRightIcon />}
                        notificationCount={unreadCount}
                        color="blue"
                    />
                )}
                {hasPermission('reports') && <MenuButton
                    onClick={() => setPage('reports')}
                    label="Relatórios"
                    description="Acompanhe os indicadores de produção e estoque."
                    icon={<ChartBarIcon />}
                    color="purple"
                />}
                {(currentUser?.role === 'admin' || currentUser?.role === 'gestor') && (
                    <MenuButton
                        onClick={() => setPage('userManagement')}
                        label="Gerenciar Usuários"
                        description="Adicione, edite ou remova usuários do sistema."
                        icon={<UserGroupIcon />}
                        color="indigo"
                    />
                )}
                {hasPermission('partsManager') && <MenuButton
                    onClick={() => setPage('partsManager')}
                    label="Gerenciador de Peças"
                    description="Controle de estoque de peças de reposição."
                    icon={<WrenchScrewdriverIcon />}
                    color="cyan"
                />}
                {hasPermission('continuousImprovement') && <MenuButton
                    onClick={() => setPage('continuousImprovement')}
                    label="Melhoria Contínua"
                    description="Kaizen Digital, Ações e Problemas"
                    icon={<AdjustmentsIcon />}
                    color="teal"
                />}
                {hasPermission('workInstructions') && <MenuButton
                    onClick={() => setPage('workInstructions')}
                    label="Instruções de Trabalho"
                    description="Procedimentos e Guias Padrão"
                    icon={<DocumentTextIcon />}
                    color="indigo"
                />}
                {hasPermission('peopleManagement') && <MenuButton
                    onClick={() => setPage('peopleManagement')}
                    label="Gestão de Pessoas"
                    description="Engajamento, Disciplina e Melhoria"
                    icon={<UserGroupIcon />}
                    color="cyan"
                />}
            </div>
        </div>
    );
};

export default MainMenu;