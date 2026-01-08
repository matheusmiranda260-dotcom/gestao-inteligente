import React, { useState, useMemo } from 'react';
import { StickyNote, User } from '../types';
import { PlusIcon, TrashIcon, PencilIcon, CheckCircleIcon, XIcon, ClockIcon } from './icons';

interface StickyNotesProps {
    notes: StickyNote[];
    currentUser: User | null;
    onAddNote: (content: string, color: string) => void;
    onDeleteNote: (id: string) => void;
    onToggleComplete: (id: string) => void;
}

const COLORS = [
    { name: 'Amarelo', bg: 'bg-yellow-200', border: 'border-yellow-300', text: 'text-yellow-900', shadow: 'shadow-yellow-100' },
    { name: 'Azul', bg: 'bg-blue-200', border: 'border-blue-300', text: 'text-blue-900', shadow: 'shadow-blue-100' },
    { name: 'Verde', bg: 'bg-emerald-200', border: 'border-emerald-300', text: 'text-emerald-900', shadow: 'shadow-emerald-100' },
    { name: 'Rosa', bg: 'bg-rose-200', border: 'border-rose-300', text: 'text-rose-900', shadow: 'shadow-rose-100' },
    { name: 'Roxo', bg: 'bg-purple-200', border: 'border-purple-300', text: 'text-purple-900', shadow: 'shadow-purple-100' },
];

const StickyNotes: React.FC<StickyNotesProps> = ({ notes, currentUser, onAddNote, onDeleteNote, onToggleComplete }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newContent, setNewContent] = useState('');
    const [selectedColor, setSelectedColor] = useState(COLORS[0].bg);

    const handleAdd = () => {
        if (newContent.trim()) {
            onAddNote(newContent.trim(), selectedColor);
            setNewContent('');
            setIsAdding(false);
        }
    };

    const sortedNotes = useMemo(() => {
        return [...notes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [notes]);

    return (
        <div className="p-4 md:p-8 min-h-screen bg-slate-50">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase mb-2">Quadro de Lembretes</h1>
                        <p className="text-slate-500 font-medium">Anote coisas importantes e pendências da fábrica.</p>
                    </div>
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-4 rounded-2xl shadow-lg shadow-indigo-100 transition-all active:scale-95"
                    >
                        <PlusIcon className="h-6 w-6" />
                        ADICIONAR LEMBRETE
                    </button>
                </div>

                {isAdding && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Novo Lembrete</h3>
                                <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600">
                                    <XIcon className="h-6 w-6" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Conteúdo do Post-it</label>
                                    <textarea
                                        autoFocus
                                        value={newContent}
                                        onChange={(e) => setNewContent(e.target.value)}
                                        className="w-full h-32 p-4 bg-slate-100 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl resize-none font-medium text-slate-700 outline-none transition-all"
                                        placeholder="Digite aqui o que precisa ser feito..."
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Escolha uma Cor</label>
                                    <div className="flex gap-3">
                                        {COLORS.map((color) => (
                                            <button
                                                key={color.bg}
                                                onClick={() => setSelectedColor(color.bg)}
                                                className={`w-10 h-10 rounded-full ${color.bg} border-4 transition-all ${selectedColor === color.bg ? 'border-indigo-500 scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 bg-slate-50 border-t border-slate-100">
                                <button
                                    onClick={handleAdd}
                                    disabled={!newContent.trim()}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-100 transition-all active:scale-95"
                                >
                                    CRIAR POST-IT
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {sortedNotes.length > 0 ? (
                        sortedNotes.map((note) => {
                            const colorStyle = COLORS.find(c => c.bg === note.color) || COLORS[0];
                            return (
                                <div
                                    key={note.id}
                                    className={`relative group h-64 ${colorStyle.bg} ${colorStyle.border} border-t-8 rounded-xl shadow-lg ${colorStyle.shadow} transition-all hover:-translate-y-2 hover:rotate-1 flex flex-col p-6 animate-fade-in`}
                                >
                                    {/* Pin circle */}
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-red-500 rounded-full shadow-inner border-2 border-red-600 z-10"></div>

                                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pt-2">
                                        <p className={`text-lg font-bold leading-tight ${colorStyle.text} ${note.completed ? 'line-through opacity-50' : ''}`}>
                                            {note.content}
                                        </p>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-black/5 flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className={`text-[9px] font-black uppercase tracking-widest opacity-60 ${colorStyle.text}`}>
                                                {note.author}
                                            </span>
                                            <span className={`text-[8px] font-medium opacity-50 flex items-center gap-1 ${colorStyle.text}`}>
                                                <ClockIcon className="h-2 w-2" />
                                                {new Date(note.date).toLocaleDateString('pt-BR')}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => onToggleComplete(note.id)}
                                                className={`p-2 rounded-lg hover:bg-black/5 transition-colors ${note.completed ? 'text-emerald-600' : 'text-slate-600'}`}
                                                title={note.completed ? "Desmarcar" : "Concluir"}
                                            >
                                                <CheckCircleIcon className="h-5 w-5" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (confirm('Excluir este lembrete?')) onDeleteNote(note.id);
                                                }}
                                                className="p-2 rounded-lg text-rose-600 hover:bg-rose-500/10 transition-colors"
                                                title="Excluir"
                                            >
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>

                                    {note.completed && (
                                        <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] rounded-xl flex items-center justify-center pointer-events-none">
                                            <div className="rotate-12 bg-emerald-500 text-white font-black px-4 py-1 rounded shadow-lg text-sm uppercase tracking-widest border-2 border-emerald-600">
                                                Concluído
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <div className="col-span-full py-20 bg-white rounded-3xl border-4 border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                            <div className="bg-slate-50 w-24 h-24 rounded-full flex items-center justify-center mb-6">
                                <PlusIcon className="h-10 w-10 text-slate-300" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-700">O quadro está vazio</h3>
                            <p className="text-slate-400 mt-2 max-w-xs">Nenhum lembrete adicionado. Clique no botão acima para criar o primeiro post-it.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StickyNotes;
