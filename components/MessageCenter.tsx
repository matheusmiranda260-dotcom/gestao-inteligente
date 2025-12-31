import React, { useState, useMemo } from 'react';
import type { Message, User, MachineType } from '../types';

interface MessageCenterProps {
    messages: Message[];
    currentUser: User | null;
    addMessage: (messageText: string, productionOrderId: string, machine: MachineType) => void;
    markAllMessagesAsRead: () => void;
}

const MessageCenter: React.FC<MessageCenterProps> = ({ messages, currentUser, addMessage, markAllMessagesAsRead }) => {
    const [replyMessages, setReplyMessages] = useState<Record<string, string>>({});

    React.useEffect(() => {
        markAllMessagesAsRead();
    }, []);

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

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Central de Mensagens</h1>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {sortedGroups.length > 0 ? sortedGroups.map(group => (
                    <div key={group.orderId} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                        <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-50">
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">Ordem: {group.orderId}</h3>
                                <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-bold border border-blue-100">{group.machine}</span>
                            </div>
                        </div>

                        <div className="flex-grow space-y-3 mb-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {group.messages.map(msg => (
                                <div key={msg.id} className={`flex ${msg.senderId === currentUser?.id ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] p-4 rounded-2xl ${msg.senderId === currentUser?.id
                                        ? 'bg-[#0A2A3D] text-white rounded-tr-none'
                                        : 'bg-slate-100 text-slate-800 rounded-tl-none'}`}>
                                        <div className="flex justify-between items-baseline gap-4 mb-1">
                                            <span className={`text-xs font-bold ${msg.senderId === currentUser?.id ? 'text-[#00E5FF]' : 'text-slate-500'}`}>
                                                {msg.senderUsername}
                                            </span>
                                            <span className="text-[10px] opacity-50">
                                                {new Date(msg.timestamp).toLocaleString('pt-BR')}
                                            </span>
                                        </div>
                                        <p className="text-sm leading-relaxed">{msg.message}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <form onSubmit={(e) => handleReply(e, group.orderId, group.machine)} className="flex gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                            <input
                                type="text"
                                value={replyMessages[group.orderId] || ''}
                                onChange={(e) => handleReplyChange(group.orderId, e.target.value)}
                                className="flex-grow bg-transparent border-none outline-none px-3 py-2 text-sm text-slate-700"
                                placeholder="Digite sua resposta..."
                                required
                            />
                            <button type="submit" className="bg-[#0A2A3D] text-[#00E5FF] px-6 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors">
                                Enviar
                            </button>
                        </form>
                    </div>
                )) : (
                    <div className="bg-white p-20 rounded-2xl shadow-sm border border-slate-100 text-center">
                        <div className="inline-flex p-4 rounded-full bg-slate-50 text-slate-300 mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-1">Sem conversas ativas</h3>
                        <p className="text-slate-500 text-sm">As mensagens das ordens de produção aparecerão aqui.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MessageCenter;
