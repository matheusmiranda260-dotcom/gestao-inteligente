import React, { useState, useMemo } from 'react';
import { Meeting, MeetingItem, User } from '../types';
import { PlusIcon, TrashIcon, CheckCircleIcon, XIcon, ClockIcon, CalendarIcon, ClipboardListIcon } from './icons';

interface MeetingsTasksProps {
    meetings: Meeting[];
    currentUser: User | null;
    onAddMeeting: (title: string, date: string) => void;
    onUpdateMeeting: (id: string, updates: Partial<Meeting>) => void;
    onDeleteMeeting: (id: string) => void;
}

const MeetingModal: React.FC<{
    onClose: () => void;
    onSubmit: (title: string, date: string) => void;
}> = ({ onClose, onSubmit }) => {
    const [title, setTitle] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (title.trim()) {
            onSubmit(title.trim(), new Date(date).toISOString());
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Nova Reunião / Pauta</h3>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <XIcon className="h-6 w-6" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Título da Reunião</label>
                        <input
                            type="text"
                            autoFocus
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full p-4 bg-slate-100 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl font-medium text-slate-700 outline-none transition-all"
                            placeholder="Ex: Reunião Semanal"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Data</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full p-4 bg-slate-100 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl font-medium text-slate-700 outline-none transition-all"
                            required
                        />
                    </div>
                </div>
                <div className="p-6 bg-slate-50 border-t border-slate-100">
                    <button
                        type="submit"
                        disabled={!title.trim()}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-100 transition-all active:scale-95 text-center"
                    >
                        CRIAR REUNIÃO
                    </button>
                </div>
            </form>
        </div>
    );
};

const MeetingsTasks: React.FC<MeetingsTasksProps> = ({ meetings, currentUser, onAddMeeting, onUpdateMeeting, onDeleteMeeting }) => {
    const [isAddingMeeting, setIsAddingMeeting] = useState(false);
    const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
    const [newItemContent, setNewItemContent] = useState('');

    const sortedMeetings = useMemo(() => {
        return [...meetings].sort((a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime());
    }, [meetings]);

    const activeMeeting = useMemo(() => {
        return meetings.find(m => m.id === selectedMeetingId) || (sortedMeetings.length > 0 ? sortedMeetings[0] : null);
    }, [meetings, selectedMeetingId, sortedMeetings]);

    const handleAddItem = (meetingId: string) => {
        if (!newItemContent.trim()) return;
        const meeting = meetings.find(m => m.id === meetingId);
        if (!meeting) return;

        const newItem: MeetingItem = {
            id: Math.random().toString(36).substring(2, 9),
            content: newItemContent.trim(),
            completed: false
        };

        onUpdateMeeting(meetingId, {
            items: [...(meeting.items || []), newItem]
        });
        setNewItemContent('');
    };

    const toggleItem = (meetingId: string, itemId: string) => {
        const meeting = meetings.find(m => m.id === meetingId);
        if (!meeting) return;

        const newItems = meeting.items.map(item => {
            if (item.id === itemId) {
                return { ...item, completed: !item.completed, completedAt: !item.completed ? new Date().toISOString() : undefined };
            }
            return item;
        });

        onUpdateMeeting(meetingId, { items: newItems });
    };

    const deleteItem = (meetingId: string, itemId: string) => {
        const meeting = meetings.find(m => m.id === meetingId);
        if (!meeting) return;

        const newItems = meeting.items.filter(item => item.id !== itemId);
        onUpdateMeeting(meetingId, { items: newItems });
    };

    return (
        <div className="p-4 md:p-8 min-h-screen bg-slate-50">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase mb-2">Reuniões e Tarefas</h1>
                        <p className="text-slate-500 font-medium">Gestão de pautas, decisões e acompanhamento de fábrica.</p>
                    </div>
                    <button
                        onClick={() => setIsAddingMeeting(true)}
                        className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-4 rounded-2xl shadow-lg shadow-indigo-100 transition-all active:scale-95"
                    >
                        <PlusIcon className="h-6 w-6" />
                        NOVA REUNIÃO
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Sidebar: Meetings List */}
                    <div className="lg:col-span-1 space-y-4 overflow-y-auto max-h-[70vh] pr-2 custom-scrollbar">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-2">Histórico de Reuniões</label>
                        {sortedMeetings.map(m => (
                            <button
                                key={m.id}
                                onClick={() => setSelectedMeetingId(m.id)}
                                className={`w-full text-left p-4 rounded-2xl transition-all border-2 ${(activeMeeting?.id === m.id)
                                        ? 'bg-white border-indigo-500 shadow-md translate-x-1'
                                        : 'bg-white border-transparent hover:border-slate-200 text-slate-600'
                                    }`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <CalendarIcon className="h-4 w-4 text-slate-400" />
                                    <span className="text-xs font-bold text-slate-400">
                                        {new Date(m.meetingDate).toLocaleDateString('pt-BR')}
                                    </span>
                                </div>
                                <h4 className="font-bold text-slate-800 line-clamp-2">{m.title}</h4>
                                <div className="mt-2 flex items-center justify-between">
                                    <span className="text-[10px] font-medium text-slate-400 italic">Por {m.author}</span>
                                    <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                        {m.items?.length || 0} pautas
                                    </span>
                                </div>
                            </button>
                        ))}
                        {meetings.length === 0 && (
                            <div className="p-8 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
                                <p className="text-xs text-slate-400 font-bold">Nenhuma reunião registrada.</p>
                            </div>
                        )}
                    </div>

                    {/* Main Content: Selected Meeting */}
                    <div className="lg:col-span-3">
                        {activeMeeting ? (
                            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200 overflow-hidden flex flex-col min-h-[60vh]">
                                <div className="p-8 bg-slate-800 text-white flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <CalendarIcon className="h-5 w-5 text-slate-400" />
                                            <span className="text-sm font-bold opacity-80 uppercase tracking-widest font-mono">
                                                {new Date(activeMeeting.meetingDate).toLocaleDateString('pt-BR', { dateStyle: 'long' })}
                                            </span>
                                        </div>
                                        <h2 className="text-4xl font-black tracking-tight">{activeMeeting.title}</h2>
                                        <p className="mt-2 text-slate-400 text-sm font-bold flex items-center gap-2">
                                            <ClockIcon className="h-4 w-4" />
                                            Criado em {new Date(activeMeeting.createdAt).toLocaleDateString('pt-BR')} por {activeMeeting.author}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => { if (confirm('Excluir toda esta reunião?')) onDeleteMeeting(activeMeeting.id); }}
                                        className="bg-slate-700/50 hover:bg-rose-600/20 text-slate-400 hover:text-rose-400 p-3 rounded-2xl transition-all"
                                    >
                                        <TrashIcon className="h-6 w-6" />
                                    </button>
                                </div>

                                <div className="p-8 flex-1 flex flex-col gap-8">
                                    {/* Add Item Form */}
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2">
                                                <ClipboardListIcon className="h-6 w-6 text-slate-300" />
                                            </span>
                                            <input
                                                type="text"
                                                value={newItemContent}
                                                onChange={(e) => setNewItemContent(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddItem(activeMeeting.id)}
                                                placeholder="Digite um novo item ou pauta..."
                                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-500 transition-all outline-none font-medium"
                                            />
                                        </div>
                                        <button
                                            onClick={() => handleAddItem(activeMeeting.id)}
                                            className="bg-slate-800 text-white px-8 rounded-2xl font-black hover:bg-slate-900 transition-all active:scale-95"
                                        >
                                            ADICIONAR
                                        </button>
                                    </div>

                                    {/* Items List */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* To Do Section */}
                                        <div className="space-y-4">
                                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                                Pendências / Em Aberto
                                            </h3>
                                            <div className="space-y-3">
                                                {activeMeeting.items.filter(i => !i.completed).map(item => (
                                                    <div key={item.id} className="group flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-indigo-100 transition-all">
                                                        <button
                                                            onClick={() => toggleItem(activeMeeting.id, item.id)}
                                                            className="mt-1 w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center hover:border-indigo-500 transition-colors"
                                                        >
                                                            <div className="w-3 h-3 rounded-full bg-emerald-500 scale-0 group-hover:scale-50 transition-transform"></div>
                                                        </button>
                                                        <span className="flex-1 font-bold text-slate-700 leading-tight pt-1">{item.content}</span>
                                                        <button
                                                            onClick={() => deleteItem(activeMeeting.id, item.id)}
                                                            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 p-1"
                                                        >
                                                            <XIcon className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                                {activeMeeting.items.filter(i => !i.completed).length === 0 && (
                                                    <p className="text-sm text-slate-400 italic">Nenhuma pendência.</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Done Section */}
                                        <div className="space-y-4">
                                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                                Concluído / Decidido
                                            </h3>
                                            <div className="space-y-3">
                                                {activeMeeting.items.filter(i => i.completed).map(item => (
                                                    <div key={item.id} className="group flex items-start gap-4 p-4 bg-emerald-50/50 rounded-2xl border-2 border-emerald-100/50 transition-all">
                                                        <button
                                                            onClick={() => toggleItem(activeMeeting.id, item.id)}
                                                            className="mt-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-emerald-500 flex items-center justify-center"
                                                        >
                                                            <CheckCircleIcon className="h-4 w-4 text-white" />
                                                        </button>
                                                        <div className="flex-1 pt-1 opacity-60">
                                                            <span className="font-bold text-slate-700 leading-tight line-through">{item.content}</span>
                                                            <div className="text-[9px] text-emerald-600 font-bold uppercase mt-1">
                                                                Concluído em {new Date(item.completedAt!).toLocaleDateString('pt-BR')}
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => deleteItem(activeMeeting.id, item.id)}
                                                            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 p-1"
                                                        >
                                                            <XIcon className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                                {activeMeeting.items.filter(i => i.completed).length === 0 && (
                                                    <p className="text-sm text-slate-400 italic">Nada concluído ainda.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-[2.5rem] p-20 text-center border-4 border-dashed border-slate-100 overflow-hidden">
                                <div className="bg-slate-50 w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-8">
                                    <ClipboardListIcon className="h-16 w-16 text-slate-200" />
                                </div>
                                <h3 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Selecione uma Pauta</h3>
                                <p className="text-slate-400 mt-4 max-w-sm mx-auto font-medium leading-relaxed">Clique em uma reunião na lista lateral ou crie uma nova pauta para gerenciar tarefas e decisões.</p>
                                <button
                                    onClick={() => setIsAddingMeeting(true)}
                                    className="mt-8 bg-slate-800 text-white font-black px-12 py-4 rounded-2xl hover:bg-slate-900 transition-all active:scale-95 shadow-xl shadow-slate-100"
                                >
                                    CRIAR PRIMEIRA REUNIÃO
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {isAddingMeeting && (
                <MeetingModal
                    onClose={() => setIsAddingMeeting(false)}
                    onSubmit={(title, date) => {
                        onAddMeeting(title, date);
                        setIsAddingMeeting(false);
                    }}
                />
            )}
        </div>
    );
};

export default MeetingsTasks;
