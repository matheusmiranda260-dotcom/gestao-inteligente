import React, { useState, useEffect, useRef } from 'react';
import { Page, WorkInstruction, InstructionStep } from '../types';
import {
    ArrowLeftIcon,
    PlusIcon,
    SearchIcon,
    PencilIcon,
    TrashIcon,
    SaveIcon
} from './icons';
import { fetchTable, insertItem, updateItem, deleteItem, uploadFile } from '../services/supabaseService';

const ClipboardIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
    </svg>
);

const CameraIconLocal = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
    </svg>
);

type ViewState = 'LIST' | 'EDIT' | 'VIEW';

const WorkInstructions: React.FC<{ setPage: (page: Page) => void }> = ({ setPage }) => {
    const [view, setView] = useState<ViewState>('LIST');
    const [instructions, setInstructions] = useState<WorkInstruction[]>([]);
    const [currentInstruction, setCurrentInstruction] = useState<WorkInstruction | null>(null);
    const [loading, setLoading] = useState(false);

    // Edit Form State
    const [editData, setEditData] = useState<Partial<WorkInstruction>>({ steps: [] });
    const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
    const [uploading, setUploading] = useState(false);

    // File Input Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [targetStepIndexForUpload, setTargetStepIndexForUpload] = useState<number | null>(null);

    useEffect(() => {
        loadInstructions();
    }, []);

    const loadInstructions = async () => {
        setLoading(true);
        try {
            const data = await fetchTable<WorkInstruction>('work_instructions');
            setInstructions(data);
        } catch (error) {
            console.error('Error loading instructions:', error);
        }
        setLoading(false);
    };

    const handleCreateNew = () => {
        setEditData({
            title: '',
            machine: '',
            description: '',
            steps: []
        });
        setCurrentInstruction(null);
        setView('EDIT');
    };

    const handleEdit = (instruction: WorkInstruction) => {
        setCurrentInstruction(instruction);
        setEditData({ ...instruction });
        setView('EDIT');
    };

    const saveInstruction = async () => {
        if (!editData.title || !editData.machine) {
            alert('Preencha título e máquina.');
            return;
        }

        setUploading(true);
        try {
            const steps = editData.steps || [];
            // Assign IDs if missing
            const finalSteps = steps.map((s, i) => ({
                ...s,
                id: s.id || `step-${Date.now()}-${i}`,
                order: i + 1
            }));

            const instructionToSave = {
                title: editData.title!,
                machine: editData.machine!,
                description: editData.description || '',
                steps: finalSteps,
                updatedAt: new Date().toISOString()
            };

            let saved: WorkInstruction;
            if (currentInstruction?.id) {
                saved = await updateItem<WorkInstruction>('work_instructions', currentInstruction.id, instructionToSave);
            } else {
                saved = await insertItem<WorkInstruction>('work_instructions', { ...instructionToSave, id: undefined });
            }

            setInstructions(prev => {
                const filtered = prev.filter(i => i.id !== saved.id);
                return [saved, ...filtered];
            });
            setView('LIST');
            alert('Instrução salva!');
        } catch (error) {
            alert('Erro ao salvar.');
            console.error(error);
        }
        setUploading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir instrução?')) return;
        try {
            await deleteItem('work_instructions', id);
            setInstructions(prev => prev.filter(i => i.id !== id));
            if (currentInstruction?.id === id) setView('LIST');
        } catch (error) {
            alert('Erro ao excluir.');
        }
    };

    const handleAddStep = () => {
        const steps = editData.steps ? [...editData.steps] : [];
        steps.push({
            id: `temp-${Date.now()}`,
            order: steps.length + 1,
            title: '',
            description: ''
        });
        setEditData({ ...editData, steps });
    };

    const handleUpdateStep = (index: number, field: keyof InstructionStep, value: any) => {
        const steps = [...(editData.steps || [])];
        steps[index] = { ...steps[index], [field]: value };
        setEditData({ ...editData, steps });
    };

    const handleRemoveStep = (index: number) => {
        const steps = [...(editData.steps || [])];
        steps.splice(index, 1);
        setEditData({ ...editData, steps });
    };

    const triggerStepImageUpload = (index: number) => {
        setTargetStepIndexForUpload(index);
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || targetStepIndexForUpload === null) return;

        setUploading(true);
        try {
            const fileName = `instr-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            const url = await uploadFile('instruction-images', fileName, file);
            if (url) {
                handleUpdateStep(targetStepIndexForUpload, 'photoUrl', url);
            }
        } catch (error) {
            alert('Erro no upload.');
        }
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = ''; // Reset
    };

    // --- Views ---

    const renderList = () => (
        <div className="bg-[#f2f4f6] min-h-screen flex flex-col">
            <header className="bg-white p-4 shadow-sm flex items-center justify-between sticky top-0 z-10">
                <button onClick={() => setPage('menu')} className="p-2 text-slate-600">
                    <ArrowLeftIcon className="h-6 w-6" />
                </button>
                <h1 className="text-xl font-bold text-slate-800">Instruções de Trabalho</h1>
                <button onClick={handleCreateNew} className="p-2 bg-blue-600 text-white rounded-lg shadow-sm font-bold flex items-center gap-2 px-4 hover:bg-blue-700">
                    <PlusIcon className="h-5 w-5" />
                    <span className="hidden sm:inline">Nova</span>
                </button>
            </header>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {instructions.map(inst => (
                    <div key={inst.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col hover:border-blue-200 transition-colors cursor-pointer" onClick={() => { setCurrentInstruction(inst); setView('VIEW'); }}>
                        <div className="flex items-start justify-between mb-2">
                            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded uppercase tracking-wide">{inst.machine}</span>
                            <div className="flex gap-1">
                                <button onClick={(e) => { e.stopPropagation(); handleEdit(inst); }} className="p-2 text-slate-400 hover:text-blue-600">
                                    <PencilIcon className="h-4 w-4" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(inst.id); }} className="p-2 text-slate-400 hover:text-red-600">
                                    <TrashIcon className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                        <h3 className="font-bold text-lg text-slate-800 mb-2">{inst.title}</h3>
                        <p className="text-slate-500 text-sm line-clamp-2">{inst.description || 'Sem descrição.'}</p>
                        <div className="mt-4 pt-4 border-t border-slate-50 flex items-center text-slate-400 text-sm">
                            <ClipboardIcon className="h-4 w-4 mr-2" />
                            <span>{(inst.steps || []).length} Passos</span>
                        </div>
                    </div>
                ))}
                {instructions.length === 0 && !loading && (
                    <div className="col-span-full text-center py-10 text-slate-400">
                        Nenhuma instrução cadastrada.
                    </div>
                )}
            </div>
        </div>
    );

    const renderEdit = () => (
        <div className="bg-white min-h-screen flex flex-col">
            <header className="bg-white p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <button onClick={() => setView('LIST')} className="p-2 -ml-2 text-slate-600">
                        <ArrowLeftIcon className="h-6 w-6" />
                    </button>
                    <h1 className="text-xl font-bold text-slate-800">{currentInstruction ? 'Editar Instrução' : 'Nova Instrução'}</h1>
                </div>
                <button onClick={saveInstruction} disabled={uploading} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold shadow-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                    <SaveIcon className="h-5 w-5" />
                    Salvar
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-4xl mx-auto w-full">
                <div className="space-y-4 mb-8">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Título da Instrução</label>
                        <input
                            value={editData.title}
                            onChange={e => setEditData({ ...editData, title: e.target.value })}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                            placeholder="Ex: Operação Padrão Trefila"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Máquina / Função</label>
                            <input
                                value={editData.machine}
                                onChange={e => setEditData({ ...editData, machine: e.target.value })}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                                placeholder="Ex: Trefila 1"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Descrição Gera</label>
                            <input
                                value={editData.description}
                                onChange={e => setEditData({ ...editData, description: e.target.value })}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                                placeholder="Breve resumo..."
                            />
                        </div>
                    </div>
                </div>

                <div className="border-t border-slate-100 pt-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold text-slate-800">Passo a Passo</h2>
                        <button onClick={handleAddStep} className="text-blue-600 font-bold hover:bg-blue-50 px-3 py-1 rounded-lg transition-colors flex items-center gap-1">
                            <PlusIcon className="h-5 w-5" /> Adicionar Passo
                        </button>
                    </div>

                    <div className="space-y-6">
                        {(editData.steps || []).map((step, index) => (
                            <div key={index} className="bg-slate-50 p-4 rounded-xl border border-slate-200 relative group">
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleRemoveStep(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                                        <TrashIcon className="h-5 w-5" />
                                    </button>
                                </div>
                                <div className="flex flex-col md:flex-row gap-4">
                                    <div
                                        className="w-full md:w-48 aspect-video bg-white rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-blue-400 overflow-hidden relative"
                                        onClick={() => triggerStepImageUpload(index)}
                                    >
                                        {step.photoUrl ? (
                                            <img src={step.photoUrl} className="w-full h-full object-cover" />
                                        ) : (
                                            <>
                                                <CameraIconLocal className="h-8 w-8 mb-1" />
                                                <span className="text-xs font-bold">Adicionar Foto</span>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex-1 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-slate-200 text-slate-600 font-bold rounded-full w-6 h-6 flex items-center justify-center text-xs">{index + 1}</span>
                                            <input
                                                value={step.title}
                                                onChange={e => handleUpdateStep(index, 'title', e.target.value)}
                                                className="flex-1 bg-transparent border-b border-slate-300 focus:border-blue-500 outline-none pb-1 font-bold text-slate-700 placeholder-slate-400"
                                                placeholder="Título do passo..."
                                            />
                                        </div>
                                        <textarea
                                            value={step.description}
                                            onChange={e => handleUpdateStep(index, 'description', e.target.value)}
                                            rows={2}
                                            className="w-full bg-white p-3 rounded-lg border border-slate-200 outline-none focus:border-blue-500 text-sm"
                                            placeholder="Detalhes da operação..."
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Hidden Input for generic use */}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
        </div>
    );

    const renderView = () => {
        if (!currentInstruction) return null;
        return (
            <div className="bg-white min-h-screen flex flex-col">
                <header className="bg-white p-4 border-b border-slate-100 flex items-center gap-4 sticky top-0 z-20">
                    <button onClick={() => setView('LIST')} className="p-2 -ml-2 text-slate-600">
                        <ArrowLeftIcon className="h-6 w-6" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 leading-tight">{currentInstruction.title}</h1>
                        <p className="text-sm text-slate-500">{currentInstruction.machine}</p>
                    </div>
                </header>

                <div className="p-4 md:p-8 max-w-3xl mx-auto w-full space-y-8 pb-20">
                    {(currentInstruction.steps || []).map((step, index) => (
                        <div key={index} className="scroll-mt-20">
                            <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center">
                                <span className="mr-3 text-slate-300 font-black text-2xl">{(index + 1).toString().padStart(2, '0')}.</span>
                                {step.title}
                            </h2>
                            <div className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-100">
                                {step.photoUrl && (
                                    <div className="aspect-video bg-slate-200">
                                        <img src={step.photoUrl} className="w-full h-full object-cover" />
                                    </div>
                                )}
                                <div className="p-6">
                                    <p className="text-slate-600 leading-relaxed text-lg whitespace-pre-wrap">{step.description}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                    {(currentInstruction.steps || []).length === 0 && (
                        <p className="text-center text-slate-400 py-10">Nenhum passo cadastrado nesta instrução.</p>
                    )}
                </div>

                <div className="sticky bottom-0 bg-white border-t border-slate-100 p-4 flex justify-center">
                    <button onClick={() => { setView('EDIT'); setEditData({ ...currentInstruction }); }} className="text-blue-600 font-bold hover:bg-blue-50 px-6 py-3 rounded-xl transition-colors w-full md:w-auto text-center">
                        Editar Instrução
                    </button>
                </div>
            </div>
        );
    };

    return (
        <>
            {view === 'LIST' && renderList()}
            {view === 'EDIT' && renderEdit()}
            {view === 'VIEW' && renderView()}
        </>
    );
};

export default WorkInstructions;
