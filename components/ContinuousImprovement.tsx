import React, { useState } from 'react';
import { Page } from '../types';
import {
    ArrowLeftIcon,
    PlusIcon,
    CheckCircleIcon,
    ClockIcon,
    SearchIcon,
    XIcon
} from './icons';

// Placeholder Types
interface ImprovementAction {
    id: string;
    date: string;
    description: string;
    photoUrl?: string;
    type: 'action' | 'resolution';
}

interface Problem {
    id: string;
    description: string;
    sector: string;
    responsible: string;
    status: 'Aberto' | 'Em melhoria' | 'Resolvido';
    date: string;
    photoUrl?: string;
    history: ImprovementAction[];
}

const CameraIconLocal = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
    </svg>
);

const MenuIconLocal = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
);

const MOCK_PROBLEMS: Problem[] = [
    {
        id: '1',
        description: 'Desgaste na guia da trefila',
        sector: 'Trefila',
        responsible: 'João Silva',
        status: 'Aberto',
        date: '10/03/2024',
        // In a real app these would be URLs. Using placeholder for now or emojis/colors.
        history: []
    },
    {
        id: '2',
        description: 'Alinhamento incorreto',
        sector: 'Treliça',
        responsible: 'Maria Santos',
        status: 'Em melhoria',
        date: '08/03/2024',
        history: [{ id: 'h1', date: '09/03/2024', description: 'Realizado ajuste inicial no alinhador.', type: 'action' }]
    },
    {
        id: '3',
        description: 'Peça danificada',
        sector: 'Manutenção',
        responsible: 'Carlos Souza',
        status: 'Resolvido',
        date: '05/03/2024',
        history: []
    }
];

type ViewState = 'LIST' | 'REGISTER' | 'DETAIL' | 'ADD_IMPROVEMENT';

const ContinuousImprovement: React.FC<{ setPage: (page: Page) => void }> = ({ setPage }) => {
    const [view, setView] = useState<ViewState>('LIST');
    const [problems, setProblems] = useState<Problem[]>(MOCK_PROBLEMS);
    const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
    const [newProblemData, setNewProblemData] = useState({ description: '', sector: '', responsible: '' });
    const [improvementData, setImprovementData] = useState({ description: '' });

    // Mock Image Upload (just visual)
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const getStatusColor = (status: Problem['status']) => {
        switch (status) {
            case 'Aberto': return 'bg-red-100 text-red-600 border-red-200';
            case 'Em melhoria': return 'bg-orange-100 text-orange-600 border-orange-200';
            case 'Resolvido': return 'bg-green-100 text-green-600 border-green-200';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    const handleSaveProblem = () => {
        const newProblem: Problem = {
            id: Date.now().toString(),
            description: newProblemData.description,
            sector: newProblemData.sector,
            responsible: newProblemData.responsible,
            status: 'Aberto',
            date: new Date().toLocaleDateString('pt-BR'),
            history: []
        };
        setProblems([newProblem, ...problems]);
        setNewProblemData({ description: '', sector: '', responsible: '' });
        setPreviewImage(null);
        setView('LIST');
    };

    const handleAddImprovement = () => {
        if (!selectedProblem) return;
        const updatedProblem = {
            ...selectedProblem,
            status: 'Em melhoria' as const, // Should allow keeping as resolved? Usually adding improvement means working on it.
            history: [
                {
                    id: Date.now().toString(),
                    date: new Date().toLocaleDateString('pt-BR'),
                    description: improvementData.description,
                    type: 'action'
                },
                ...selectedProblem.history
            ]
        };

        // Update list and selected
        setProblems(problems.map(p => p.id === updatedProblem.id ? updatedProblem : p));
        setSelectedProblem(updatedProblem);
        setImprovementData({ description: '' });
        setView('DETAIL');
    };

    const handleResolve = () => {
        if (!selectedProblem) return;
        const updatedProblem = {
            ...selectedProblem,
            status: 'Resolvido' as const
        };
        setProblems(problems.map(p => p.id === updatedProblem.id ? updatedProblem : p));
        setSelectedProblem(updatedProblem);
    };

    // --- Views ---

    const renderList = () => (
        <div className="flex flex-col h-full bg-[#f2f4f6] min-h-screen">
            {/* Header */}
            <header className="bg-white p-4 shadow-sm flex items-center justify-between sticky top-0 z-10">
                <button onClick={() => setPage('menu')} className="p-2 text-slate-600">
                    <MenuIconLocal className="h-6 w-6" />
                </button>
                <h1 className="text-lg font-bold text-slate-800">Painel de Problemas</h1>
                <button className="p-2 text-slate-600">
                    <SearchIcon className="h-6 w-6" />
                </button>
            </header>

            {/* Content */}
            <div className="p-4 space-y-4 pb-20">
                {problems.map(problem => (
                    <div
                        key={problem.id}
                        onClick={() => { setSelectedProblem(problem); setView('DETAIL'); }}
                        className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex gap-4 cursor-pointer active:scale-95 transition-transform"
                    >
                        {/* Thumbnail Placeholder */}
                        <div className="w-24 h-24 bg-slate-200 rounded-lg flex-shrink-0 flex items-center justify-center text-slate-400">
                            {problem.photoUrl ? <img src={problem.photoUrl} alt="" className="w-full h-full object-cover rounded-lg" /> : <CameraIconLocal className="h-8 w-8" />}
                        </div>

                        <div className="flex flex-col justify-between flex-grow">
                            <div>
                                <h3 className="font-semibold text-slate-800 leading-tight mb-1">{problem.description}</h3>
                                <p className="text-sm text-slate-500">{problem.sector}</p>
                            </div>
                            <span className={`self-start px-2 py-1 rounded-full text-xs font-bold border ${getStatusColor(problem.status)}`}>
                                {problem.status}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* FAB */}
            <button
                onClick={() => setView('REGISTER')}
                className="fixed bottom-6 w-4/5 left-1/2 -translate-x-1/2 bg-[#3B82F6] text-white font-bold py-3 px-6 rounded-full shadow-lg flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors"
                style={{ zIndex: 100 }}
            >
                <PlusIcon className="h-6 w-6" />
                Registrar Problema
            </button>
        </div>
    );

    const renderRegister = () => (
        <div className="flex flex-col h-full bg-white min-h-screen">
            <header className="p-4 flex items-center gap-4 border-b border-slate-100 sticky top-0 bg-white z-10">
                <button onClick={() => setView('LIST')} className="p-2 -ml-2 text-slate-600">
                    <ArrowLeftIcon className="h-6 w-6" />
                </button>
                <h1 className="text-xl font-bold text-slate-800">Registrar Problema</h1>
            </header>

            <div className="p-6 space-y-6">
                {/* Photo Upload Area */}
                <div className="aspect-video bg-slate-100 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-50 transition-colors">
                    <CameraIconLocal className="h-12 w-12 mb-2" />
                    <span className="text-sm font-medium">Tirar foto / Upload</span>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Setor / Máquina</label>
                        <input
                            type="text"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            value={newProblemData.sector}
                            onChange={e => setNewProblemData({ ...newProblemData, sector: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Descrição do problema</label>
                        <textarea
                            rows={3}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            value={newProblemData.description}
                            onChange={e => setNewProblemData({ ...newProblemData, description: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Responsável</label>
                        <input
                            type="text"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            value={newProblemData.responsible}
                            onChange={e => setNewProblemData({ ...newProblemData, responsible: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                        <input
                            type="text"
                            disabled
                            value={new Date().toLocaleDateString('pt-BR')}
                            className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500"
                        />
                    </div>
                </div>

                <div className="pt-4">
                    <button
                        onClick={handleSaveProblem}
                        className="w-full bg-[#3B82F6] text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-600 transition-colors active:scale-95"
                    >
                        Salvar problema
                    </button>
                </div>
            </div>
        </div>
    );

    const renderDetail = () => {
        if (!selectedProblem) return null;
        return (
            <div className="flex flex-col h-full bg-[#f8fafc] min-h-screen">
                <header className="p-4 flex items-center gap-4 bg-white shadow-sm sticky top-0 z-10">
                    <button onClick={() => setView('LIST')} className="p-2 -ml-2 text-slate-600">
                        <ArrowLeftIcon className="h-6 w-6" />
                    </button>
                    <h1 className="text-xl font-bold text-slate-800">Detalhe do Problema</h1>
                </header>

                <div className="p-4 space-y-6 pb-24">
                    {/* Hero Image/Card */}
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
                        <div className="h-48 bg-slate-200 flex items-center justify-center text-slate-400">
                            {selectedProblem.photoUrl ? <img src={selectedProblem.photoUrl} alt="" className="w-full h-full object-cover" /> : <CameraIconLocal className="h-12 w-12" />}
                        </div>
                        <div className="p-5">
                            <h2 className="text-xl font-bold text-slate-800 mb-2">{selectedProblem.description}</h2>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500 text-sm font-medium">{selectedProblem.sector}</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(selectedProblem.status)}`}>
                                    {selectedProblem.status}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-slate-800">Histórico de Ações</h3>

                        <div className="relative pl-4 border-l-2 border-slate-200 space-y-8 ml-2">
                            {/* Initial Problem Log */}
                            <div className="relative">
                                <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-slate-400 ring-4 ring-white"></div>
                                <p className="text-xs text-slate-400 mb-1">{selectedProblem.date}</p>
                                <p className="text-slate-700 font-medium">Problema registrado por <span className="font-bold">{selectedProblem.responsible}</span></p>
                            </div>

                            {selectedProblem.history.map((action) => (
                                <div key={action.id} className="relative">
                                    <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-orange-500 ring-4 ring-white"></div>
                                    <p className="text-xs text-slate-400 mb-1">{action.date}</p>
                                    <p className="text-slate-800">{action.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Bottom Actions */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-slate-200 flex flex-col gap-3">
                    <button
                        onClick={() => setView('ADD_IMPROVEMENT')}
                        className="w-full bg-[#F59E0B] text-white font-bold py-3.5 rounded-xl shadow-sm hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
                    >
                        <PlusIcon className="h-5 w-5" />
                        Adicionar melhoria
                    </button>
                    {selectedProblem.status !== 'Resolvido' && (
                        <button
                            onClick={handleResolve}
                            className="w-full bg-[#10B981] text-white font-bold py-3.5 rounded-xl shadow-sm hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <CheckCircleIcon className="h-5 w-5" />
                            Marcar como resolvido
                        </button>
                    )}
                </div>
            </div>
        );
    };

    const renderAddImprovement = () => (
        <div className="flex flex-col h-full bg-white min-h-screen">
            <header className="p-4 flex items-center gap-4 border-b border-slate-100 sticky top-0 bg-white z-10">
                <button onClick={() => setView('DETAIL')} className="p-2 -ml-2 text-slate-600">
                    <ArrowLeftIcon className="h-6 w-6" />
                </button>
                <h1 className="text-xl font-bold text-slate-800">Adicionar Melhoria</h1>
            </header>

            <div className="p-6 space-y-6">
                <div className="aspect-video bg-slate-100 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-50 transition-colors">
                    <CameraIconLocal className="h-12 w-12 mb-2" />
                    <span className="text-sm font-medium">Foto da melhoria (opcional)</span>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">O que foi feito?</label>
                        <textarea
                            rows={4}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            value={improvementData.description}
                            onChange={e => setImprovementData({ description: e.target.value })}
                            placeholder="Descreva a ação realizada..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                        <input
                            type="text"
                            disabled
                            value={new Date().toLocaleDateString('pt-BR')}
                            className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500"
                        />
                    </div>
                </div>

                <div className="pt-4">
                    <button
                        onClick={handleAddImprovement}
                        className="w-full bg-[#3B82F6] text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-600 transition-colors active:scale-95"
                    >
                        Salvar melhoria
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="bg-white min-h-screen">
            {view === 'LIST' && renderList()}
            {view === 'REGISTER' && renderRegister()}
            {view === 'DETAIL' && renderDetail()}
            {view === 'ADD_IMPROVEMENT' && renderAddImprovement()}
        </div>
    );
};

export default ContinuousImprovement;
