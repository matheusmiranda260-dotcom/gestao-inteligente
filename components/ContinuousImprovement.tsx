import React, { useState, useEffect, useRef } from 'react';
import { Page, KaizenProblem, KaizenAction, OrgUnit, Employee } from '../types';
import {
    ArrowLeftIcon,
    PlusIcon,
    CheckCircleIcon,
    ClockIcon,
    SearchIcon,
    XIcon,
    TrashIcon,
    PencilIcon,
    SaveIcon
} from './icons';
import { fetchTable, insertItem, updateItem, deleteItem, uploadFile } from '../services/supabaseService';

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

type ViewState = 'LIST' | 'REGISTER' | 'DETAIL' | 'ADD_IMPROVEMENT' | 'EDIT';

const ContinuousImprovement: React.FC<{ setPage: (page: Page) => void }> = ({ setPage }) => {
    const [view, setView] = useState<ViewState>('LIST');
    const [problems, setProblems] = useState<KaizenProblem[]>([]);
    const [selectedProblem, setSelectedProblem] = useState<KaizenProblem | null>(null);
    const [newProblemData, setNewProblemData] = useState({ description: '', sector: '' });
    const [selectedResponsibles, setSelectedResponsibles] = useState<{ id: string, name: string }[]>([]);
    const [improvementData, setImprovementData] = useState({ description: '' });
    const [loading, setLoading] = useState(false);
    const [uploadingInfo, setUploadingInfo] = useState(false);

    // Image Upload State
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);

    useEffect(() => {
        loadProblems();
        loadMetadata();
    }, []);

    const loadMetadata = async () => {
        try {
            const units = await fetchTable<OrgUnit>('org_units');
            const emps = await fetchTable<Employee>('employees');
            setOrgUnits(units);
            setEmployees(emps);
        } catch (e) { console.error('Error loading metadata', e); }
    };

    const loadProblems = async () => {
        setLoading(true);
        try {
            const data = await fetchTable<KaizenProblem>('kaizen_problems');
            // Sort by date desc
            const sorted = data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) || data;
            setProblems(sorted);
        } catch (error) {
            console.error('Error loading problems', error);
        }
        setLoading(false);
    };

    const getStatusColor = (status: KaizenProblem['status']) => {
        switch (status) {
            case 'Aberto': return 'bg-red-100 text-red-600 border-red-200';
            case 'Em melhoria': return 'bg-orange-100 text-orange-600 border-orange-200';
            case 'Resolvido': return 'bg-green-100 text-green-600 border-green-200';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;

    // Image Helper
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const handleSaveProblem = async () => {
        if (!newProblemData.description || !newProblemData.sector) {
            alert('Preencha descrição e setor.');
            return;
        }

        setUploadingInfo(true);
        try {
            let photoUrl = undefined;

            if (selectedFile) {
                const fileName = `kaizen-${Date.now()}-${selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`; // Sanitize filename
                console.log('Attempting to upload file:', fileName, 'to bucket: kaizen-images');

                // Using existing uploadFile service
                try {
                    const uploadedUrl = await uploadFile('kaizen-images', fileName, selectedFile);
                    if (uploadedUrl) {
                        photoUrl = uploadedUrl;
                        console.log('Upload successful. URL:', photoUrl);
                    } else {
                        throw new Error('Upload returned null URL');
                    }
                } catch (uploadError) {
                    console.error('Detailed Upload Error:', uploadError);
                    alert(`Falha no upload da imagem: ${(uploadError as any).message || 'Erro desconhecido'}. O problema será salvo sem foto.`);
                }
            }

            const newProblem: KaizenProblem = {
                id: generateId('KZ'),
                description: newProblemData.description,
                sector: newProblemData.sector,
                responsible: selectedResponsibles.map(r => r.name).join(', '), // Legacy display string
                responsibleIds: selectedResponsibles.map(r => r.id), // New link
                status: 'Aberto',
                date: new Date().toISOString(),
                history: [],
                photoUrl: photoUrl
            };

            console.log('Saving problem to DB:', newProblem);
            // Map camelCase to snake_case manually if needed for specialized columns, but responsible_ids needs to be explicit if the type has keys that don't match.
            // My types usually match or I rely on the service.
            // Let's explicitly cast to any to pass snake_case for the new column if needed, or rely on Supabase handling it if I renamed the prop in the interface. 
            // In types.ts I named it responsibleIds. Supabase JS client usually keeps case if not configured otherwise. 
            // Actually, best practice with Supabase JS: stick to DB column names in object OR rely on auto-mapping.
            // I'll send specific payload to be safe.
            const payload = {
                ...newProblem,
                responsible_ids: newProblem.responsibleIds
            };

            try {
                await insertItem('kaizen_problems', payload);
            } catch (error: any) {
                console.warn('Initial save failed, retrying without responsible_ids...', error);

                // Fallback for missing column
                const fallbackPayload = { ...newProblem };
                delete fallbackPayload.responsibleIds;

                await insertItem('kaizen_problems', fallbackPayload);
                alert('Aviso: O problema foi salvo, mas não foi possível vincular ao RH pois o Banco de Dados precisa de atualização (coluna responsável faltando).');
            }

            setProblems([newProblem, ...problems]);
            setNewProblemData({ description: '', sector: '' });
            setSelectedResponsibles([]);
            setSelectedFile(null);
            setPreviewUrl(null);
            setView('LIST');
        } catch (error) {
            console.error('Final Save Error:', error);
            alert(`Erro ao salvar problema: ${(error as any).message || JSON.stringify(error)}`);
        }
        setUploadingInfo(false);
    };

    const handleDeleteProblem = async () => {
        if (!selectedProblem || !confirm('Tem certeza que deseja excluir este registro?')) return;

        try {
            await deleteItem('kaizen_problems', selectedProblem.id);
            setProblems(problems.filter(p => p.id !== selectedProblem.id));
            setSelectedProblem(null);
            setView('LIST');
        } catch (error) {
            alert('Erro ao excluir.');
            console.error(error);
        }
    };

    const handleUpdateProblem = async () => {
        if (!selectedProblem) return;
        try {
            await updateItem('kaizen_problems', selectedProblem.id, {
                description: selectedProblem.description,
                sector: selectedProblem.sector,
                responsible: selectedProblem.responsible
            });
            // Update list
            setProblems(problems.map(p => p.id === selectedProblem.id ? selectedProblem : p));
            setView('DETAIL');
        } catch (error) {
            alert('Erro ao atualizar.');
        }
    };

    const handleAddImprovement = async () => {
        if (!selectedProblem) return;
        setUploadingInfo(true);
        try {
            let photoUrl = undefined;
            if (selectedFile) {
                const fileName = `kaizen-action-${Date.now()}-${selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
                try {
                    const uploadedUrl = await uploadFile('kaizen-images', fileName, selectedFile);
                    if (uploadedUrl) photoUrl = uploadedUrl;
                } catch (uploadError) {
                    alert('Erro ao subir foto da melhoria, salvando sem foto.');
                }
            }

            const newAction: KaizenAction = {
                id: generateId('ACT'),
                date: new Date().toISOString(),
                description: improvementData.description,
                type: 'action',
                photoUrl: photoUrl
            };

            const updatedProblem = {
                ...selectedProblem,
                status: 'Em melhoria' as const,
                history: [newAction, ...(selectedProblem.history || [])]
            };

            await updateItem('kaizen_problems', selectedProblem.id, {
                status: updatedProblem.status,
                history: updatedProblem.history
            });

            setProblems(problems.map(p => p.id === updatedProblem.id ? updatedProblem : p));
            setSelectedProblem(updatedProblem);
            setImprovementData({ description: '' });
            setSelectedFile(null);
            setPreviewUrl(null);
            setView('DETAIL');
            alert('Melhoria registrada com sucesso!');
        } catch (error) {
            alert('Erro ao registrar melhoria.');
            console.error(error);
        }
        setUploadingInfo(false);
    };

    const handleResolve = async () => {
        if (!selectedProblem) return;
        try {
            const updatedProblem = {
                ...selectedProblem,
                status: 'Resolvido' as const
            };

            await updateItem('kaizen_problems', selectedProblem.id, { status: 'Resolvido' });

            setProblems(problems.map(p => p.id === updatedProblem.id ? updatedProblem : p));
            setSelectedProblem(updatedProblem);
            alert('Problema resolvido!');
        } catch (error) {
            alert('Erro ao resolver problema.');
            console.error(error);
        }
    };

    // --- Views ---

    const renderList = () => (
        <div className="flex flex-col h-full bg-[#f2f4f6] min-h-screen">
            <header className="bg-white p-4 shadow-sm flex items-center justify-between sticky top-0 z-10">
                <button onClick={() => setPage('menu')} className="p-2 text-slate-600">
                    <MenuIconLocal className="h-6 w-6" />
                </button>
                <h1 className="text-lg font-bold text-slate-800">Painel de Problemas</h1>
                <button onClick={loadProblems} className="p-2 text-slate-600">
                    <SearchIcon className="h-6 w-6" />
                </button>
            </header>

            <div className="p-4 space-y-4 pb-24">
                {loading ? <p className="text-center text-slate-500 mt-10">Carregando...</p> : problems.length === 0 ? <p className="text-center text-slate-500 mt-10">Nenhum problema registrado.</p> : problems.map(problem => (
                    <div
                        key={problem.id}
                        onClick={() => { setSelectedProblem(problem); setView('DETAIL'); }}
                        className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex gap-4 cursor-pointer active:scale-95 transition-transform"
                    >
                        <div className="w-24 h-24 bg-slate-200 rounded-lg flex-shrink-0 flex items-center justify-center text-slate-400 overflow-hidden">
                            {problem.photoUrl ? <img src={problem.photoUrl} alt="" className="w-full h-full object-cover" /> : <CameraIconLocal className="h-8 w-8" />}
                        </div>

                        <div className="flex flex-col justify-between flex-grow">
                            <div>
                                <h3 className="font-semibold text-slate-800 leading-tight mb-1">{problem.description}</h3>
                                <p className="text-sm text-slate-500">{problem.sector}</p>
                            </div>
                            <div className="flex justify-between items-end">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getStatusColor(problem.status)}`}>
                                    {problem.status}
                                </span>
                                <span className="text-xs text-slate-400">{new Date(problem.date).toLocaleDateString('pt-BR')}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <button
                onClick={() => { setView('REGISTER'); setPreviewUrl(null); setSelectedFile(null); }}
                className="fixed bottom-6 w-4/5 left-1/2 -translate-x-1/2 bg-[#3B82F6] text-white font-bold py-3 px-6 rounded-full shadow-lg flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors z-50"
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
                <h1 className="text-xl font-bold text-slate-800">Registrar Problema (v2.1)</h1>
            </header>

            <div className="p-6 space-y-6">
                <div onClick={triggerFileInput} className="aspect-video bg-slate-100 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-50 transition-colors overflow-hidden relative">
                    {previewUrl ? (
                        <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                    ) : (
                        <>
                            <CameraIconLocal className="h-12 w-12 mb-2" />
                            <span className="text-sm font-medium">Toque para adicionar foto</span>
                        </>
                    )}
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileSelect}
                    />
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Setor / Máquina</label>
                        {orgUnits.length > 0 ? (
                            <select
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                                value={newProblemData.sector}
                                onChange={e => setNewProblemData({ ...newProblemData, sector: e.target.value })}
                            >
                                <option value="">Selecione um setor...</option>
                                {orgUnits.map(u => (
                                    <option key={u.id} value={u.name}>{u.name}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                type="text"
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                                placeholder="Digite o setor (Lista vazia)"
                                value={newProblemData.sector}
                                onChange={e => setNewProblemData({ ...newProblemData, sector: e.target.value })}
                            />
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                        <textarea
                            rows={3}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                            value={newProblemData.description}
                            onChange={e => setNewProblemData({ ...newProblemData, description: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Responsáveis</label>
                        <div className="flex gap-2 mb-2">
                            {employees.length > 0 ? (
                                <select
                                    className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                                    onChange={(e) => {
                                        const empId = e.target.value;
                                        if (!empId) return;
                                        const emp = employees.find(ep => ep.id === empId);
                                        if (emp && !selectedResponsibles.find(r => r.id === emp.id)) {
                                            setSelectedResponsibles([...selectedResponsibles, { id: emp.id, name: emp.name }]);
                                        }
                                        e.target.value = ''; // Reset select
                                    }}
                                >
                                    <option value="">Selecione para adicionar...</option>
                                    {employees.filter(e => e.active).map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className="flex-1 flex gap-2">
                                    <input
                                        type="text"
                                        className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                                        placeholder="Digite o nome"
                                        id="manualResponsibleInput"
                                    />
                                    <button
                                        onClick={() => {
                                            const input = document.getElementById('manualResponsibleInput') as HTMLInputElement;
                                            if (input.value) {
                                                setSelectedResponsibles([...selectedResponsibles, { id: generateId('manual'), name: input.value }]);
                                                input.value = '';
                                            }
                                        }}
                                        className="bg-blue-600 text-white px-4 rounded-xl"
                                    >Adicionar</button>
                                </div>
                            )}
                        </div>

                        {/* Chips */}
                        <div className="flex flex-wrap gap-2">
                            {selectedResponsibles.map(r => (
                                <span key={r.id} className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full flex items-center gap-2">
                                    {r.name}
                                    <button onClick={() => setSelectedResponsibles(selectedResponsibles.filter(sr => sr.id !== r.id))}>
                                        <XIcon className="h-4 w-4" />
                                    </button>
                                </span>
                            ))}
                        </div>
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
                        disabled={uploadingInfo}
                        className="w-full bg-[#3B82F6] text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                    >
                        {uploadingInfo ? 'Salvando...' : 'Salvar problema'}
                    </button>
                </div>
            </div>
        </div>
    );

    const renderEdit = () => {
        if (!selectedProblem) return null;
        return (
            <div className="flex flex-col h-full bg-white min-h-screen">
                <header className="p-4 flex items-center gap-4 border-b border-slate-100 sticky top-0 bg-white z-10">
                    <button onClick={() => setView('DETAIL')} className="p-2 -ml-2 text-slate-600">
                        <ArrowLeftIcon className="h-6 w-6" />
                    </button>
                    <h1 className="text-xl font-bold text-slate-800">Editar Problema</h1>
                </header>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Setor</label>
                        <input
                            type="text"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl"
                            value={selectedProblem.sector}
                            onChange={e => setSelectedProblem({ ...selectedProblem, sector: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                        <textarea
                            rows={3}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl"
                            value={selectedProblem.description}
                            onChange={e => setSelectedProblem({ ...selectedProblem, description: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Responsável</label>
                        <input
                            type="text"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl"
                            value={selectedProblem.responsible}
                            onChange={e => setSelectedProblem({ ...selectedProblem, responsible: e.target.value })}
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            onClick={handleUpdateProblem}
                            className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl"
                        >
                            Salvar Alterações
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    const renderDetail = () => {
        if (!selectedProblem) return null;
        return (
            <div className="flex flex-col h-full bg-[#f8fafc] min-h-screen">
                <header className="p-4 flex items-center justify-between bg-white shadow-sm sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setView('LIST')} className="p-2 -ml-2 text-slate-600">
                            <ArrowLeftIcon className="h-6 w-6" />
                        </button>
                        <h1 className="text-xl font-bold text-slate-800">Detalhe</h1>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setView('EDIT')} className="p-2 text-blue-600 bg-blue-50 rounded-lg">
                            <PencilIcon className="h-5 w-5" />
                        </button>
                        <button onClick={handleDeleteProblem} className="p-2 text-red-600 bg-red-50 rounded-lg">
                            <TrashIcon className="h-5 w-5" />
                        </button>
                    </div>
                </header>

                <div className="p-4 space-y-6 pb-24">
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
                        <div className="h-56 bg-slate-200 flex items-center justify-center text-slate-400 overflow-hidden">
                            {selectedProblem.photoUrl ? <img src={selectedProblem.photoUrl} alt="" className="w-full h-full object-contain bg-black/5" /> : <CameraIconLocal className="h-12 w-12" />}
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

                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-slate-800">Histórico de Ações</h3>

                        <div className="relative pl-4 border-l-2 border-slate-200 space-y-8 ml-2">
                            <div className="relative">
                                <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-slate-400 ring-4 ring-white"></div>
                                <p className="text-xs text-slate-400 mb-1">{new Date(selectedProblem.date).toLocaleDateString('pt-BR')}</p>
                                <p className="text-slate-700 font-medium">Problema registrado por <span className="font-bold">{selectedProblem.responsible}</span></p>
                            </div>

                            {selectedProblem.history && selectedProblem.history.map((action) => (
                                <div key={action.id} className="relative">
                                    <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-orange-500 ring-4 ring-white"></div>
                                    <p className="text-xs text-slate-400 mb-1">{new Date(action.date).toLocaleDateString('pt-BR')}</p>
                                    <p className="text-slate-800 mb-2">{action.description}</p>
                                    {action.photoUrl && (
                                        <div className="mt-2 mb-2 w-32 h-24 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                                            <a href={action.photoUrl} target="_blank" rel="noopener noreferrer">
                                                <img src={action.photoUrl} alt="Foto da melhoria" className="w-full h-full object-cover" />
                                            </a>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-slate-200 flex flex-col gap-3">
                    <button
                        onClick={() => { setView('ADD_IMPROVEMENT'); setSelectedFile(null); setPreviewUrl(null); }}
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
                <div onClick={triggerFileInput} className="aspect-video bg-slate-100 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-50 transition-colors overflow-hidden relative">
                    {previewUrl ? (
                        <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                    ) : (
                        <>
                            <CameraIconLocal className="h-12 w-12 mb-2" />
                            <span className="text-sm font-medium">Foto da melhoria (opcional)</span>
                        </>
                    )}
                    {/* The input is shared but state is cleared on view change, so it works. */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileSelect}
                    />
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">O que foi feito?</label>
                        <textarea
                            rows={4}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
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
            {view === 'EDIT' && renderEdit()}
        </div>
    );
};

export default ContinuousImprovement;
