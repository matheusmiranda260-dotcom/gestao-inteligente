import React, { useState, useMemo } from 'react';
import { Meeting, MeetingItem, User, Employee } from '../types';
import { PlusIcon, TrashIcon, CheckCircleIcon, XIcon, ClockIcon, CalendarIcon, ClipboardListIcon, PencilIcon, UserIcon, UserGroupIcon, CogIcon, WrenchScrewdriverIcon, ArchiveIcon } from './icons';

interface MeetingsTasksProps {
    meetings: Meeting[];
    currentUser: User | null;
    employees: Employee[];
    onAddMeeting: (title: string, date: string) => void;
    onUpdateMeeting: (id: string, updates: Partial<Meeting>) => void;
    onDeleteMeeting: (id: string) => void;
}

const CATEGORIES = [
    { id: 'trefila', label: 'Máquina Trefila', icon: <WrenchScrewdriverIcon className="h-4 w-4" /> },
    { id: 'trelica', label: 'Máquina Treliça', icon: <CogIcon className="h-4 w-4" /> },
    { id: 'pecas', label: 'Gestão de Peças', icon: <ArchiveIcon className="h-4 w-4" /> },
    { id: 'geral', label: 'Gestão Geral / Operações', icon: <ClipboardListIcon className="h-4 w-4" /> }
];

const MeetingModal: React.FC<{
    onClose: () => void;
    onSubmit: (title: string, date: string) => void;
    initialData?: { title: string; date: string };
}> = ({ onClose, onSubmit, initialData }) => {
    const [title, setTitle] = useState(initialData?.title || '');
    const [date, setDate] = useState(initialData?.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (title.trim()) {
            onSubmit(title.trim(), new Date(date).toISOString());
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
            <form onSubmit={handleSubmit} className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-zoom-in">
                <div className="p-8 bg-gradient-to-br from-indigo-600 to-violet-700 text-white flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tight">{initialData ? 'Editar Reunião' : 'Nova Reunião'}</h3>
                        <p className="text-indigo-100 text-xs font-bold opacity-80 mt-1">Defina o tema e a data da pauta</p>
                    </div>
                    <button type="button" onClick={onClose} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-all">
                        <XIcon className="h-5 w-5" />
                    </button>
                </div>
                <div className="p-8 space-y-6">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Título da Reunião</label>
                        <input
                            type="text"
                            autoFocus
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full p-4 bg-slate-50 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white rounded-2xl font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300"
                            placeholder="Ex: Reunião Semanal de Produção"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Data da Pauta</label>
                        <div className="relative">
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full p-4 bg-slate-50 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white rounded-2xl font-bold text-slate-700 outline-none transition-all"
                                required
                            />
                        </div>
                    </div>
                </div>
                <div className="p-8 pt-0">
                    <button
                        type="submit"
                        disabled={!title.trim()}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-100 transition-all active:scale-[0.98] uppercase tracking-wider"
                    >
                        {initialData ? 'SALVAR ALTERAÇÕES' : 'CRIAR REUNIÃO'}
                    </button>
                </div>
            </form>
        </div>
    );
};

const MeetingsTasks: React.FC<MeetingsTasksProps> = ({ meetings, currentUser, employees, onAddMeeting, onUpdateMeeting, onDeleteMeeting }) => {
    const [isAddingMeeting, setIsAddingMeeting] = useState(false);
    const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
    const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>('geral');
    const [newItemContent, setNewItemContent] = useState('');
    const [assignedTo, setAssignedTo] = useState<string>('');
    const [viewMode, setViewMode] = useState<'meeting' | 'groups'>('meeting');

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
            completed: false,
            assignedTo: assignedTo || undefined,
            category: selectedCategory
        };

        onUpdateMeeting(meetingId, {
            items: [...(meeting.items || []), newItem]
        });
        setNewItemContent('');
        setAssignedTo('');
    };

    const toggleItem = (meetingId: string, itemId: string) => {
        const meeting = meetings.find(m => m.id === meetingId);
        if (!meeting) return;

        const newItems = (meeting.items || []).map(item => {
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

        const newItems = (meeting.items || []).filter(item => item.id !== itemId);
        onUpdateMeeting(meetingId, { items: newItems });
    };

    const getEmployeeName = (idOrName: string) => {
        const emp = employees.find(e => e.id === idOrName || e.name === idOrName);
        return emp ? emp.name : idOrName;
    };

    const getGroupedItems = () => {
        const allItems: (MeetingItem & { meetingTitle: string, meetingDate: string, meetingId: string })[] = [];
        meetings.forEach(m => {
            (m.items || []).forEach(item => {
                allItems.push({ ...item, meetingTitle: m.title, meetingDate: m.meetingDate, meetingId: m.id });
            });
        });

        const grouped: Record<string, typeof allItems> = {};
        CATEGORIES.forEach(cat => grouped[cat.id] = []);

        allItems.forEach(item => {
            const cat = item.category || 'geral';
            if (grouped[cat]) grouped[cat].push(item);
            else {
                if (!grouped['geral']) grouped['geral'] = [];
                grouped['geral'].push(item);
            }
        });

        // Sort items by date within groups
        Object.keys(grouped).forEach(cat => {
            grouped[cat].sort((a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime());
        });

        return grouped;
    };

    const groupedHistory = useMemo(() => getGroupedItems(), [meetings]);

    return (
        <div className="p-4 md:p-8 min-h-screen bg-slate-50 animate-fade-in">
            <div className="max-w-7xl mx-auto">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center">
                                <ClipboardListIcon className="h-6 w-6 text-indigo-600" />
                            </div>
                            <h1 className="text-4xl font-black text-slate-800 tracking-tighter uppercase">Reuniões e Tarefas</h1>
                        </div>
                        <div className="flex items-center gap-4 ml-1">
                            <button
                                onClick={() => setViewMode('meeting')}
                                className={`text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${viewMode === 'meeting' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                            >
                                Visão por Reunião
                            </button>
                            <button
                                onClick={() => setViewMode('groups')}
                                className={`text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${viewMode === 'groups' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                            >
                                Visão por Sub-Grupos
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsAddingMeeting(true)}
                        className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-black px-8 py-4 rounded-2xl shadow-2xl shadow-slate-200 transition-all hover:scale-105 active:scale-95 group"
                    >
                        <PlusIcon className="h-6 w-6 group-hover:rotate-90 transition-transform" />
                        NOVA REUNIÃO
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
                    {/* Sidebar: Meetings List */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Linha do Tempo</label>
                            <span className="bg-slate-200 text-slate-500 text-[9px] font-black px-2 py-0.5 rounded-full">{meetings.length}</span>
                        </div>

                        <div className="space-y-3 overflow-y-auto max-h-[75vh] pr-2 custom-scrollbar">
                            {sortedMeetings.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => { setSelectedMeetingId(m.id); setViewMode('meeting'); }}
                                    className={`w-full text-left p-5 rounded-3xl transition-all border-2 relative overflow-hidden group ${(activeMeeting?.id === m.id && viewMode === 'meeting')
                                        ? 'bg-white border-indigo-500 shadow-xl shadow-slate-200 translate-x-2'
                                        : 'bg-white border-slate-100 hover:border-slate-300 text-slate-600 hover:shadow-lg'
                                        }`}
                                >
                                    {(activeMeeting?.id === m.id && viewMode === 'meeting') && (
                                        <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />
                                    )}
                                    <div className="flex items-center gap-2 mb-2">
                                        <CalendarIcon className={`h-3.5 w-3.5 ${activeMeeting?.id === m.id && viewMode === 'meeting' ? 'text-indigo-500' : 'text-slate-300'}`} />
                                        <span className={`text-[10px] font-black uppercase tracking-wider ${activeMeeting?.id === m.id && viewMode === 'meeting' ? 'text-indigo-500' : 'text-slate-400'}`}>
                                            {new Date(m.meetingDate).toLocaleDateString('pt-BR')}
                                        </span>
                                    </div>
                                    <h4 className={`font-black tracking-tight leading-tight mb-3 ${activeMeeting?.id === m.id && viewMode === 'meeting' ? 'text-slate-800 text-lg' : 'text-slate-600'}`}>{m.title}</h4>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                                                <UserIcon className="h-2.5 w-2.5 text-slate-400" />
                                            </div>
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{m.author}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-[9px] font-black text-slate-400">
                                            <ClipboardListIcon className="h-3 w-3" />
                                            {m.items?.length || 0}
                                        </div>
                                    </div>
                                </button>
                            ))}

                            {meetings.length === 0 && (
                                <div className="p-10 text-center bg-white rounded-[2rem] border-3 border-dashed border-slate-100">
                                    <p className="text-xs text-slate-300 font-black uppercase tracking-widest">Nenhuma Reunião</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="lg:col-span-3">
                        {viewMode === 'meeting' && activeMeeting ? (
                            <div className="bg-white rounded-[3rem] shadow-2xl shadow-slate-200 overflow-hidden flex flex-col min-h-[70vh] animate-slide-up border border-slate-100">
                                {/* Meeting Hero/Header */}
                                <div className="p-10 bg-slate-900 text-white relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12">
                                        <ClipboardListIcon className="h-64 w-64" />
                                    </div>

                                    <div className="flex justify-between items-start relative z-10">
                                        <div>
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></div>
                                                    Visão por Reunião
                                                </div>
                                                <span className="text-white/40 text-[10px] font-black tracking-widest uppercase font-mono">
                                                    {new Date(activeMeeting.meetingDate).toLocaleDateString('pt-BR', { dateStyle: 'full' })}
                                                </span>
                                            </div>
                                            <h2 className="text-5xl font-black tracking-tighter uppercase leading-[0.9]">{activeMeeting.title}</h2>
                                            <div className="mt-6 flex items-center gap-6">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                                                        <UserIcon className="h-4 w-4 text-slate-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Gestor Responsável</p>
                                                        <p className="text-sm font-bold">{activeMeeting.author}</p>
                                                    </div>
                                                </div>
                                                <div className="w-px h-8 bg-white/10"></div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                                                        <ClockIcon className="h-4 w-4 text-slate-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Registrado em</p>
                                                        <p className="text-sm font-bold">{new Date(activeMeeting.createdAt).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setEditingMeeting(activeMeeting)}
                                                className="bg-white/5 hover:bg-white/10 text-white/50 hover:text-white p-4 rounded-2xl transition-all border border-white/5"
                                                title="Editar Título/Data"
                                            >
                                                <PencilIcon className="h-5 w-5" />
                                            </button>
                                            <button
                                                onClick={() => { if (confirm('ATENÇÃO: Deseja realmente excluir permanentemente toda esta reunião e suas tarefas?')) onDeleteMeeting(activeMeeting.id); }}
                                                className="bg-white/5 hover:bg-rose-500/20 text-white/50 hover:text-rose-400 p-4 rounded-2xl transition-all border border-white/5 hover:border-rose-500/20"
                                                title="Excluir Reunião"
                                            >
                                                <TrashIcon className="h-6 w-6" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Meeting Content */}
                                <div className="p-10 flex-1 flex flex-col gap-10">
                                    {/* Task Entry Bar with Category Selector */}
                                    <div className="bg-slate-50 p-4 rounded-[2.5rem] border-2 border-slate-100 flex flex-col gap-4">
                                        <div className="flex flex-col md:flex-row gap-3">
                                            <div className="flex-1 relative group">
                                                <span className="absolute left-6 top-1/2 -translate-y-1/2">
                                                    <ClipboardListIcon className="h-6 w-6 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                                                </span>
                                                <input
                                                    type="text"
                                                    value={newItemContent}
                                                    onChange={(e) => setNewItemContent(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleAddItem(activeMeeting.id)}
                                                    placeholder="Adicionar nova pauta ou melhoria..."
                                                    className="w-full pl-16 pr-6 py-5 bg-white shadow-sm rounded-2xl font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300"
                                                />
                                            </div>
                                            <button
                                                onClick={() => handleAddItem(activeMeeting.id)}
                                                disabled={!newItemContent.trim()}
                                                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-10 py-5 rounded-2xl font-black transition-all shadow-xl shadow-indigo-100 uppercase tracking-widest text-xs"
                                            >
                                                CRIAR PAUTA
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-6 px-4">
                                            <div>
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Nível / Sub-Grupo</label>
                                                <div className="flex gap-2">
                                                    {CATEGORIES.map(cat => (
                                                        <button
                                                            key={cat.id}
                                                            onClick={() => setSelectedCategory(cat.id)}
                                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all border-2 ${selectedCategory === cat.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-md scale-105' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                                                        >
                                                            {cat.icon}
                                                            {cat.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="w-px h-10 bg-slate-200 hidden md:block"></div>
                                            <div className="flex-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Responsável</label>
                                                <div className="relative">
                                                    <select
                                                        value={assignedTo}
                                                        onChange={(e) => setAssignedTo(e.target.value)}
                                                        className="appearance-none w-full bg-white border-2 border-slate-200 py-2.5 pl-10 pr-8 rounded-xl font-bold text-xs text-slate-600 focus:border-indigo-500 outline-none transition-all"
                                                    >
                                                        <option value="">Sem Responsável</option>
                                                        {employees.map(emp => (
                                                            <option key={emp.id} value={emp.name}>{emp.name}</option>
                                                        ))}
                                                    </select>
                                                    <UserIcon className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Task Lists Grouped by Category */}
                                    <div className="space-y-12">
                                        {CATEGORIES.map(cat => {
                                            const catItems = (activeMeeting.items || []).filter(item => (item.category || 'geral') === cat.id);
                                            if (catItems.length === 0) return null;
                                            return (
                                                <div key={cat.id} className="space-y-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-lg">
                                                            {cat.icon}
                                                        </div>
                                                        <div>
                                                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{cat.label}</h3>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{catItems.length} pautas exclusivas</p>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {catItems.map(item => (
                                                            <div key={item.id} className={`group p-5 rounded-3xl border-2 transition-all flex items-start gap-4 ${item.completed ? 'bg-emerald-50/10 border-emerald-100/30' : 'bg-white border-slate-100 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-50/50'}`}>
                                                                <button
                                                                    onClick={() => toggleItem(activeMeeting.id, item.id)}
                                                                    className={`mt-1 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${item.completed ? 'bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-100' : 'border-slate-200 hover:border-indigo-500'}`}
                                                                >
                                                                    {item.completed ? <CheckCircleIcon className="h-5 w-5 text-white" /> : <div className="w-4 h-4 rounded-full bg-indigo-500 scale-0 group-hover:scale-50 transition-all opacity-0 group-hover:opacity-100" />}
                                                                </button>
                                                                <div className="flex-1 space-y-2">
                                                                    <p className={`font-black tracking-tight leading-snug ${item.completed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{item.content}</p>
                                                                    <div className="flex items-center justify-between">
                                                                        {item.assignedTo && (
                                                                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${item.completed ? 'bg-slate-100 text-slate-400' : 'bg-indigo-50 text-indigo-500'}`}>
                                                                                Resp: {getEmployeeName(item.assignedTo)}
                                                                            </span>
                                                                        )}
                                                                        {item.completedAt && (
                                                                            <span className="text-[9px] font-bold text-emerald-500 italic">O.K. {new Date(item.completedAt).toLocaleDateString()}</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <button onClick={() => deleteItem(activeMeeting.id, item.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 p-2 transition-all">
                                                                    <XIcon className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {(activeMeeting.items || []).length === 0 && (
                                            <div className="py-20 text-center border-4 border-dashed border-slate-100 rounded-[3rem]">
                                                <ClipboardListIcon className="h-16 w-16 text-slate-100 mx-auto mb-4" />
                                                <p className="text-slate-400 font-bold uppercase tracking-widest">Nenhuma pauta nesta reunião ainda.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : viewMode === 'groups' ? (
                            <div className="space-y-10 animate-fade-in">
                                {CATEGORIES.map(cat => {
                                    const items = groupedHistory[cat.id] || [];
                                    return (
                                        <div key={cat.id} className="bg-white rounded-[3rem] border-2 border-slate-100 overflow-hidden shadow-xl shadow-slate-100 transition-all hover:border-indigo-200">
                                            <div className="p-8 bg-slate-900 text-white flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-4 bg-white/10 rounded-2xl border border-white/5 shadow-2xl">
                                                        {cat.icon}
                                                    </div>
                                                    <div>
                                                        <h3 className="text-2xl font-black uppercase tracking-tight">{cat.label}</h3>
                                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Histórico Acumulado / Looping de Melhoria</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-4xl font-black tracking-tighter text-indigo-400">{items.length}</p>
                                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Ações Registradas</p>
                                                </div>
                                            </div>
                                            <div className="p-8 space-y-6">
                                                <div className="grid grid-cols-1 gap-4">
                                                    {items.map((item, idx) => (
                                                        <div key={`${item.meetingId}-${item.id}`} className={`flex items-start gap-6 p-6 rounded-3xl transition-all border-2 relative ${item.completed ? 'bg-emerald-50/5 border-emerald-100/20' : 'bg-slate-50 border-transparent hover:border-indigo-100 shadow-sm'}`}>
                                                            <div className="absolute top-0 right-0 p-4">
                                                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">{item.meetingTitle}</span>
                                                            </div>
                                                            <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center min-w-[60px]">
                                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">{new Date(item.meetingDate).toLocaleString('pt-BR', { month: 'short' })}</p>
                                                                <p className="text-xl font-black text-slate-800 leading-none">{new Date(item.meetingDate).getDate()}</p>
                                                            </div>
                                                            <div className="flex-1 pt-1">
                                                                <p className={`text-lg font-black tracking-tight leading-tight mb-2 ${item.completed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{item.content}</p>
                                                                <div className="flex flex-wrap items-center gap-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className={`w-2 h-2 rounded-full ${item.completed ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
                                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{item.completed ? 'Concluído' : 'Pendente / Em Melhoria'}</span>
                                                                    </div>
                                                                    {item.assignedTo && (
                                                                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg">
                                                                            <UserIcon className="h-2.5 w-2.5 text-slate-400" />
                                                                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-tight">{getEmployeeName(item.assignedTo)}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col gap-2">
                                                                <button
                                                                    onClick={() => toggleItem(item.meetingId, item.id)}
                                                                    className={`p-3 rounded-xl transition-all ${item.completed ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-white border border-slate-200 text-slate-300 hover:text-emerald-500 hover:border-emerald-500'}`}
                                                                >
                                                                    <CheckCircleIcon className="h-5 w-5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {items.length === 0 && (
                                                        <div className="py-12 text-center">
                                                            <p className="text-slate-400 font-bold uppercase tracking-widest italic text-xs">Nenhuma pauta registrada para este grupo.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="bg-white rounded-[4rem] p-24 text-center border-4 border-dashed border-slate-100 overflow-hidden animate-zoom-in">
                                <div className="bg-indigo-50 w-40 h-40 rounded-[3rem] flex items-center justify-center mx-auto mb-10 rotate-12 shadow-inner group">
                                    <ClipboardListIcon className="h-20 w-20 text-indigo-200 group-hover:scale-110 group-hover:-rotate-12 transition-all duration-500" />
                                </div>
                                <h3 className="text-4xl font-black text-slate-800 uppercase tracking-tighter leading-tight max-w-sm mx-auto">Seleção Necessária</h3>
                                <p className="text-slate-400 mt-6 max-w-sm mx-auto font-bold leading-relaxed">Crie ou selecione uma pauta para gerenciar melhorias contínuas por grupo.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modals */}
            {isAddingMeeting && (
                <MeetingModal
                    onClose={() => setIsAddingMeeting(false)}
                    onSubmit={(title, date) => {
                        onAddMeeting(title, date);
                        setIsAddingMeeting(false);
                    }}
                />
            )}

            {editingMeeting && (
                <MeetingModal
                    initialData={{ title: editingMeeting.title, date: editingMeeting.meetingDate }}
                    onClose={() => setEditingMeeting(null)}
                    onSubmit={(title, date) => {
                        onUpdateMeeting(editingMeeting.id, { title, meetingDate: date });
                        setEditingMeeting(null);
                    }}
                />
            )}
        </div>
    );
};

export default MeetingsTasks;
