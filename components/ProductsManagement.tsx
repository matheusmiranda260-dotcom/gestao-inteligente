import React, { useState, useEffect } from 'react';
import type { Page, TrelicaModel, User } from '../types';
import { supabase } from '../supabaseClient';
import { DEFAULT_TRELICA_MODELS } from '../utils/trelicaModelsData';
import { 
    PlusIcon, 
    TrashIcon, 
    WrenchScrewdriverIcon, 
    ArrowLeftIcon,
    AdjustmentsIcon,
    CheckCircleIcon
} from './icons';

interface ProductsManagementProps {
    setPage: (page: Page) => void;
    currentUser: User | null;
    showNotification: (message: string, type: 'success' | 'error') => void;
}

const getWeightPerMeter = (d: string) => {
    const dNum = parseFloat(d.replace(',', '.'));
    if (isNaN(dNum)) return 0;
    return dNum * dNum * 0.0061654;
};

const calculateTrelicaWeights = (tamanhoStr: string, superior: string, inferior: string, senozoide: string, trName: string) => {
    const tamanho = parseFloat(tamanhoStr.replace(',', '.'));
    if (isNaN(tamanho) || !superior || !inferior || !senozoide || !trName) return null;

    let senozoideMultiplier = 2.58; // default to H-8
    const nameUpper = trName.toUpperCase();
    if (nameUpper.includes('H6') || nameUpper.includes('H-6')) senozoideMultiplier = 2.41;
    else if (nameUpper.includes('H8') || nameUpper.includes('H-8')) senozoideMultiplier = 2.58;
    else if (nameUpper.includes('H10') || nameUpper.includes('H-10')) senozoideMultiplier = 2.86;
    else if (nameUpper.includes('H12') || nameUpper.includes('H-12')) senozoideMultiplier = 3.19;
    else if (nameUpper.includes('H16') || nameUpper.includes('H-16')) senozoideMultiplier = 3.74;
    else if (nameUpper.includes('H25') || nameUpper.includes('H-25')) senozoideMultiplier = 5.40;

    const wSup = getWeightPerMeter(superior) * tamanho;
    const wInf = getWeightPerMeter(inferior) * tamanho * 2;
    const wSen = getWeightPerMeter(senozoide) * tamanho * senozoideMultiplier;

    return {
        pesoSuperior: wSup.toFixed(3).replace('.', ','),
        pesoInferior: wInf.toFixed(3).replace('.', ','),
        pesoSenozoide: wSen.toFixed(3).replace('.', ','),
        pesoFinal: (wSup + wInf + wSen).toFixed(3).replace('.', ',')
    };
};

export const ProductsManagement: React.FC<ProductsManagementProps> = ({ setPage, currentUser, showNotification }) => {
    const [models, setModels] = useState<TrelicaModel[]>(() => {
        try {
            const saved = localStorage.getItem('cached_trelica_models');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) {
            console.error(e);
        }
        return DEFAULT_TRELICA_MODELS;
    });

    const [loading, setLoading] = useState(false);
    const [isCloudSync, setIsCloudSync] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingModel, setEditingModel] = useState<TrelicaModel | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        cod: '',
        modelo: '',
        tamanho: '',
        superior: '',
        inferior: '',
        senozoide: '',
        peso_final: '',
        peso_superior: '',
        peso_senozoide: '',
        peso_inferior: ''
    });

    useEffect(() => {
        fetchModels();
    }, []);

    const fetchModels = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('trelica_models')
                .select('*')
                .order('modelo', { ascending: true });

            if (!error && data && data.length > 0) {
                const mappedData = data.map(m => ({
                    ...m,
                    pesoFinal: m.peso_final,
                    pesoSuperior: m.peso_superior,
                    pesoSenozoide: m.peso_senozoide,
                    pesoInferior: m.peso_inferior
                }));
                setModels(mappedData);
                localStorage.setItem('cached_trelica_models', JSON.stringify(mappedData));
                setIsCloudSync(true);
            } else {
                // Tabela não existe ou está vazia no Supabase: usar cache local ou modelos padrão
                const saved = localStorage.getItem('cached_trelica_models');
                if (saved) {
                    try {
                        const parsed = JSON.parse(saved);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            setModels(parsed);
                        } else {
                            setModels(DEFAULT_TRELICA_MODELS);
                            localStorage.setItem('cached_trelica_models', JSON.stringify(DEFAULT_TRELICA_MODELS));
                        }
                    } catch (e) {
                        setModels(DEFAULT_TRELICA_MODELS);
                    }
                } else {
                    setModels(DEFAULT_TRELICA_MODELS);
                    localStorage.setItem('cached_trelica_models', JSON.stringify(DEFAULT_TRELICA_MODELS));
                }
                setIsCloudSync(false);
            }
        } catch (err) {
            console.error(err);
            setModels(DEFAULT_TRELICA_MODELS);
            setIsCloudSync(false);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const next = { ...prev, [name]: value };
            
            // Auto calculate se os campos principais mudaram
            if (['modelo', 'tamanho', 'superior', 'inferior', 'senozoide'].includes(name)) {
                const calc = calculateTrelicaWeights(next.tamanho, next.superior, next.inferior, next.senozoide, next.modelo);
                if (calc) {
                    next.peso_superior = calc.pesoSuperior;
                    next.peso_inferior = calc.pesoInferior;
                    next.peso_senozoide = calc.pesoSenozoide;
                    next.peso_final = calc.pesoFinal;
                }
            }
            return next;
        });
    };

    const handleSave = async () => {
        if (!formData.cod || !formData.modelo || !formData.tamanho) {
            showNotification('Preencha os campos obrigatórios (Código, Modelo, Tamanho).', 'error');
            return;
        }

        try {
            // Tenta salvar no Supabase se a nuvem estiver ativa
            if (isCloudSync) {
                if (editingModel) {
                    await supabase
                        .from('trelica_models')
                        .update(formData)
                        .eq('id', editingModel.id);
                } else {
                    await supabase
                        .from('trelica_models')
                        .insert([formData]);
                }
            }

            // Sempre atualiza o estado local e o cache do navegador
            setModels(prev => {
                let updated: TrelicaModel[];
                if (editingModel) {
                    updated = prev.map(m => m.id === editingModel.id ? { 
                        ...m, 
                        ...formData,
                        pesoFinal: formData.peso_final,
                        pesoSuperior: formData.peso_superior,
                        pesoSenozoide: formData.peso_senozoide,
                        pesoInferior: formData.peso_inferior
                    } : m);
                } else {
                    const newModel: TrelicaModel = {
                        id: String(Date.now()),
                        ...formData,
                        pesoFinal: formData.peso_final,
                        pesoSuperior: formData.peso_superior,
                        pesoSenozoide: formData.peso_senozoide,
                        pesoInferior: formData.peso_inferior
                    };
                    updated = [...prev, newModel];
                }
                localStorage.setItem('cached_trelica_models', JSON.stringify(updated));
                return updated;
            });
            
            showNotification(editingModel ? 'Modelo atualizado com sucesso!' : 'Modelo cadastrado com sucesso!', 'success');
            setIsModalOpen(false);
            setEditingModel(null);
            setFormData({
                cod: '', modelo: '', tamanho: '', superior: '', inferior: '', senozoide: '',
                peso_final: '', peso_superior: '', peso_senozoide: '', peso_inferior: ''
            });
        } catch (err: any) {
            showNotification('Erro ao salvar modelo: ' + err.message, 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este modelo?')) return;
        
        try {
            if (isCloudSync) {
                await supabase.from('trelica_models').delete().eq('id', id);
            }
            
            setModels(prev => {
                const updated = prev.filter(m => m.id !== id);
                localStorage.setItem('cached_trelica_models', JSON.stringify(updated));
                return updated;
            });
            showNotification('Modelo excluído com sucesso!', 'success');
        } catch (err: any) {
            showNotification('Erro ao excluir: ' + err.message, 'error');
        }
    };

    const handleRestoreDefaults = () => {
        if (!confirm('Deseja restaurar a lista padrão de 19 modelos de treliça?')) return;
        setModels(DEFAULT_TRELICA_MODELS);
        localStorage.setItem('cached_trelica_models', JSON.stringify(DEFAULT_TRELICA_MODELS));
        showNotification('Modelos padrão restaurados com sucesso!', 'success');
    };

    const openEdit = (model: TrelicaModel) => {
        setEditingModel(model);
        setFormData({
            cod: model.cod,
            modelo: model.modelo,
            tamanho: model.tamanho,
            superior: model.superior,
            inferior: model.inferior,
            senozoide: model.senozoide,
            peso_final: model.peso_final,
            peso_superior: model.peso_superior,
            peso_senozoide: model.peso_senozoide,
            peso_inferior: model.peso_inferior
        });
        setIsModalOpen(true);
    };

    return (
        <div className="flex-1 overflow-auto bg-slate-900 text-slate-200">
            {/* Header */}
            <div className="bg-slate-800 border-b border-slate-700 p-6 flex flex-col gap-4 sticky top-0 z-10 shadow-md">
                <div className="flex items-center gap-3 mb-2">
                    <button 
                        onClick={() => setPage('menu')}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
                        title="Voltar ao Menu"
                    >
                        <ArrowLeftIcon className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <AdjustmentsIcon className="h-7 w-7 text-emerald-400" />
                            Fichas Técnicas
                        </h1>
                        <p className="text-slate-400 text-sm font-medium">Gestão de modelos de treliças e suas especificações</p>
                    </div>
                </div>

                <div className="flex flex-wrap justify-between items-center gap-4">
                    <div className="flex items-center gap-3 text-sm text-slate-400">
                        <span className="font-bold text-white bg-slate-700/60 px-3 py-1 rounded-full border border-slate-600">
                            {models.length} modelos cadastrados
                        </span>
                        {isCloudSync ? (
                            <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                Sincronizado na Nuvem
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20" title="Para salvar diretamente no banco de dados Supabase para todos os usuários, execute o script SQL trelica_models.sql">
                                💾 Armazenamento Local Ativo
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleRestoreDefaults}
                            className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-lg text-xs font-bold transition-colors border border-slate-600"
                            title="Restaurar os 19 modelos padrão originais"
                        >
                            ⚡ Restaurar Padrões
                        </button>
                        <button
                            onClick={() => {
                                setEditingModel(null);
                                setFormData({
                                    cod: '', modelo: '', tamanho: '', superior: '', inferior: '', senozoide: '',
                                    peso_final: '', peso_superior: '', peso_senozoide: '', peso_inferior: ''
                                });
                                setIsModalOpen(true);
                            }}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg shadow-emerald-500/20 text-sm"
                        >
                            <PlusIcon className="h-5 w-5" />
                            Novo Modelo
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-6">
                {loading && models.length === 0 ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
                    </div>
                ) : (
                    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-900/50 text-slate-400 uppercase text-xs font-bold">
                                    <tr>
                                        <th className="px-4 py-3 border-b border-slate-700">Código</th>
                                        <th className="px-4 py-3 border-b border-slate-700">Modelo</th>
                                        <th className="px-4 py-3 border-b border-slate-700">Tamanho</th>
                                        <th className="px-4 py-3 border-b border-slate-700">Sup.</th>
                                        <th className="px-4 py-3 border-b border-slate-700">Inf.</th>
                                        <th className="px-4 py-3 border-b border-slate-700">Sen.</th>
                                        <th className="px-4 py-3 border-b border-slate-700 text-right">Peso Final</th>
                                        <th className="px-4 py-3 border-b border-slate-700 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {models.map(model => (
                                        <tr key={model.id || model.cod} className="hover:bg-slate-700/30 transition-colors">
                                            <td className="px-4 py-3 font-mono text-emerald-400 font-bold">{model.cod}</td>
                                            <td className="px-4 py-3 font-bold text-slate-200">{model.modelo}</td>
                                            <td className="px-4 py-3">{model.tamanho}m</td>
                                            <td className="px-4 py-3">
                                                <div className="text-xs font-semibold">{model.superior}</div>
                                                <div className="text-[10px] text-slate-400">{model.peso_superior || model.pesoSuperior}kg</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-xs font-semibold">{model.inferior}</div>
                                                <div className="text-[10px] text-slate-400">{model.peso_inferior || model.pesoInferior}kg</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-xs font-semibold">{model.senozoide}</div>
                                                <div className="text-[10px] text-slate-400">{model.peso_senozoide || model.pesoSenozoide}kg</div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-amber-400">
                                                {model.peso_final || model.pesoFinal} kg
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button 
                                                        onClick={() => openEdit(model)}
                                                        className="p-1.5 bg-sky-500/10 text-sky-400 rounded hover:bg-sky-500/20 transition-colors"
                                                        title="Editar Modelo"
                                                    >
                                                        <WrenchScrewdriverIcon className="h-4 w-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(model.id)}
                                                        className="p-1.5 bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 transition-colors"
                                                        title="Excluir Modelo"
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {models.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                                                Nenhum modelo disponível. Clique em "Restaurar Padrões" para carregar os modelos originais.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de Cadastro/Edição */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[#0f172a] rounded-2xl w-full max-w-2xl border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 rounded-t-2xl">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <AdjustmentsIcon className="h-6 w-6 text-emerald-400" />
                                {editingModel ? 'Editar Modelo' : 'Novo Modelo'}
                            </h2>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Código do Produto *</label>
                                    <input 
                                        type="text" name="cod" value={formData.cod} onChange={handleInputChange}
                                        className="w-full bg-[#1e293b] border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono focus:border-emerald-500 outline-none"
                                        placeholder="Ex: H6LE12S"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Nome do Modelo *</label>
                                    <input 
                                        type="text" name="modelo" value={formData.modelo} onChange={handleInputChange}
                                        className="w-full bg-[#1e293b] border border-slate-700 rounded-xl px-4 py-2.5 text-white font-bold focus:border-emerald-500 outline-none"
                                        placeholder="Ex: H-6 LEVE (ESPAÇADOR)"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tamanho (m) *</label>
                                    <input 
                                        type="text" name="tamanho" value={formData.tamanho} onChange={handleInputChange}
                                        className="w-full bg-[#1e293b] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-emerald-500 outline-none"
                                        placeholder="Ex: 12"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Bitola Sup.</label>
                                    <input 
                                        type="text" name="superior" value={formData.superior} onChange={handleInputChange}
                                        className="w-full bg-[#1e293b] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-emerald-500 outline-none"
                                        placeholder="Ex: 5,4"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Bitola Sen.</label>
                                    <input 
                                        type="text" name="senozoide" value={formData.senozoide} onChange={handleInputChange}
                                        className="w-full bg-[#1e293b] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-emerald-500 outline-none"
                                        placeholder="Ex: 3,2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Bitola Inf.</label>
                                    <input 
                                        type="text" name="inferior" value={formData.inferior} onChange={handleInputChange}
                                        className="w-full bg-[#1e293b] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-emerald-500 outline-none"
                                        placeholder="Ex: 3,2"
                                    />
                                </div>
                            </div>

                            {/* Detalhes de Peso Calculado */}
                            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3">Pesos Teóricos (Cálculo Automático)</div>
                                <div className="grid grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-[10px] text-slate-400 mb-1">Peso Sup (kg)</label>
                                        <input 
                                            type="text" name="peso_superior" value={formData.peso_superior} onChange={handleInputChange}
                                            className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-slate-400 mb-1">Peso Sen (kg)</label>
                                        <input 
                                            type="text" name="peso_senozoide" value={formData.peso_senozoide} onChange={handleInputChange}
                                            className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-slate-400 mb-1">Peso Inf (kg)</label>
                                        <input 
                                            type="text" name="peso_inferior" value={formData.peso_inferior} onChange={handleInputChange}
                                            className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-amber-400 font-bold mb-1">Peso Final (kg)</label>
                                        <input 
                                            type="text" name="peso_final" value={formData.peso_final} onChange={handleInputChange}
                                            className="w-full bg-[#0f172a] border border-amber-500/30 rounded-lg px-3 py-1.5 text-xs text-amber-300 font-bold outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                        </div>

                        <div className="p-6 border-t border-slate-800 bg-slate-900 rounded-b-2xl flex justify-end gap-3">
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-2.5 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSave}
                                className="px-5 py-2.5 rounded-xl font-bold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                            >
                                <CheckCircleIcon className="h-5 w-5" />
                                Salvar Produto
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductsManagement;
