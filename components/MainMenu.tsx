import React, { useState, useMemo } from 'react';
import type { Page, User, Message, MachineType } from '../types';
import { UserGroupIcon, ArchiveIcon, CogIcon, ClipboardListIcon, ChartBarIcon, ChatBubbleLeftRightIcon } from './icons';
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
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <h2 className="text-2xl font-bold text-slate-800 mb-4 border-b pb-4">Central de Mensagens do Gestor</h2>
                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                    {sortedGroups.length > 0 ? sortedGroups.map(group => (
                        <div key={group.orderId} className="bg-slate-50 p-4 rounded-lg">
                            <h3 className="font-semibold text-slate-800">Ordem: {group.orderId} ({group.machine})</h3>
                            <div className="mt-2 space-y-2 text-sm max-h-48 overflow-y-auto">
                                {group.messages.map(msg => (
                                    <div key={msg.id} className={`p-2 rounded border ${msg.senderId === currentUser?.id ? 'bg-[#e6f0f5]' : 'bg-white'}`}>
                                        <div className="flex justify-between items-baseline">
                                            <span className={`font-bold ${msg.senderId === currentUser?.id ? 'text-[#0F3F5C]' : 'text-slate-700'}`}>{msg.senderUsername}</span>
                                            <span className="text-xs text-slate-400">{new Date(msg.timestamp).toLocaleString('pt-BR')}</span>
                                        </div>
                                        <p className="text-slate-600 mt-1">{msg.message}</p>
                                    </div>
                                ))}
                            </div>
                            <form onSubmit={(e) => handleReply(e, group.orderId, group.machine)} className="flex gap-2 mt-2 pt-2 border-t">
                                <input
                                    type="text"
                                    value={replyMessages[group.orderId] || ''}
                                    onChange={(e) => handleReplyChange(group.orderId, e.target.value)}
                                    className="flex-grow p-2 border border-slate-300 rounded-md text-sm"
                                    placeholder="Digite sua resposta..."
                                    required
                                />
                                <button type="submit" className="bg-[#0F3F5C] text-white font-semibold py-2 px-3 rounded-md hover:bg-[#0A2A3D] text-sm">Enviar</button>
                            </form>
                        </div>
                    )) : (
                        <p className="text-center text-slate-500 py-10">Nenhuma mensagem recebida.</p>
                    )}
                </div>
                <div className="flex justify-end pt-4 mt-auto border-t">
                    <button type="button" onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition">Fechar</button>
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

const MenuButton: React.FC<{ onClick: () => void; label: string; description: string; icon: React.ReactNode; notificationCount?: number; }> = ({ onClick, label, description, icon, notificationCount }) => {
    return (
        <button
            onClick={onClick}
            className="relative bg-white p-6 rounded-xl shadow-sm hover:shadow-xl border border-slate-200 hover:border-[#0F3F5C]/20 hover:-translate-y-1 transition-all duration-300 text-left w-full flex flex-col justify-between"
        >
            {notificationCount && notificationCount > 0 && (
                <div className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                    {notificationCount}
                </div>
            )}
            <div>
                <div className="bg-[#e6f0f5] inline-block p-3 rounded-lg mb-4">
                    {React.cloneElement(icon as React.ReactElement<any>, { className: `h-8 w-8 text-[#0F3F5C]` })}
                </div>
                <h3 className="text-lg font-bold text-[#0F3F5C]">
                    {label}
                </h3>
                <p className="text-slate-500 mt-1 text-sm">{description}</p>
            </div>
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
        return !!currentUser.permissions?.[page];
    };

    return (
        <div className="min-h-screen p-4 sm:p-6 md:p-8">
            <ManagerMessagesModal
                isOpen={isManagerModalOpen}
                onClose={() => setIsManagerModalOpen(false)}
                messages={messages}
                currentUser={currentUser}
                addMessage={addMessage}
            />
            <header className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                    <MSMLogo size="sm" showText={false} />
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Menu Principal</h1>
                        <p className="text-slate-500">Bem-vindo, {currentUser?.username || 'Usuário'}.</p>
                    </div>
                </div>
                <button
                    onClick={onLogout}
                    className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 rounded-lg transition"
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
                />}
                {hasPermission('finishedGoods') && <MenuButton
                    onClick={() => setPage('finishedGoods')}
                    label="Estoque Acabado (Treliça)"
                    description="Visualize o estoque de treliças prontas para expedição."
                    icon={<ArchiveIcon />}
                />}
                {hasPermission('trefila') && <MenuButton
                    onClick={() => setPage('trefila')}
                    label="Produção (TREFILA)"
                    description="Acesse o painel de produção da máquina trefiladeira."
                    icon={<CogIcon />}
                />}
                {hasPermission('trelica') && <MenuButton
                    onClick={() => setPage('trelica')}
                    label="Produção (TRELIÇA)"
                    description="Acesse o painel de produção da máquina de treliça."
                    icon={<CogIcon />}
                />}
                {hasPermission('productionOrder') && <MenuButton
                    onClick={() => setPage('productionOrder')}
                    label="Ordem (Trefila)"
                    description="Crie e acompanhe as ordens para a máquina Trefila."
                    icon={<ClipboardListIcon />}
                />}
                {hasPermission('productionOrderTrelica') && <MenuButton
                    onClick={() => setPage('productionOrderTrelica')}
                    label="Ordem (Treliça)"
                    description="Crie e acompanhe as ordens para a máquina Treliça."
                    icon={<ClipboardListIcon />}
                />}
                {hasPermission('productionDashboard') && <MenuButton
                    onClick={() => setPage('productionDashboard')}
                    label="Dashboard de Produção"
                    description="Acompanhe Trefila e Treliça em tempo real."
                    icon={<ChartBarIcon />}
                />}
                {(currentUser?.role === 'admin' || currentUser?.role === 'gestor') && (
                    <MenuButton
                        onClick={handleOpenManagerMessages}
                        label="Central de Mensagens"
                        description="Veja as mensagens dos operadores de produção."
                        icon={<ChatBubbleLeftRightIcon />}
                        notificationCount={unreadCount}
                    />
                )}
                {hasPermission('reports') && <MenuButton
                    onClick={() => setPage('reports')}
                    label="Relatórios"
                    description="Acompanhe os indicadores de produção e estoque."
                    icon={<ChartBarIcon />}
                />}
                {(currentUser?.role === 'admin' || currentUser?.role === 'gestor') && (
                    <MenuButton
                        onClick={() => setPage('userManagement')}
                        label="Gerenciar Usuários"
                        description="Adicione, edite ou remova usuários do sistema."
                        icon={<UserGroupIcon />}
                    />
                )}
            </div>
        </div>
    );
};

export default MainMenu;