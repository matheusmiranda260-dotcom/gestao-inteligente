import React, { useState, useMemo } from 'react';
import type { StockGauge, MaterialType } from '../types';
import { MaterialOptions, DefaultElectrodeGauges, DefaultSabaoGauges, DefaultTrelicaGauges } from '../types';
import { TrashIcon, PlusIcon, CheckCircleIcon, ScaleIcon, ArrowPathIcon, PencilIcon, XIcon, SearchIcon } from './icons';

interface GaugesManagerProps {
    gauges: StockGauge[];
    onAdd: (gauge: Omit<StockGauge, 'id'>) => void;
    onDelete: (id: string) => void;
    onUpdate: (id: string, data: Partial<StockGauge>) => void;
    onRestoreDefaults: () => void;
}

const getWeightPerMeter = (d: string) => {
    const dNum = parseFloat((d || '').replace(',', '.'));
    if (isNaN(dNum)) return 0;
    return dNum * dNum * 0.0061654;
};

const calculateTrelicaWeights = (tamanhoStr: string, superior: string, inferior: string, senozoide: string, trName: string) => {
    const tamanho = parseFloat((tamanhoStr || '12').replace(',', '.'));
    if (isNaN(tamanho) || !superior || !inferior || !senozoide) return null;

    let senozoideMultiplier = 2.58; // default to H-8
    const nameUpper = (trName || '').toUpperCase();
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

const syncTrelicaModelToCache = (modelData: any) => {
    try {
        const cachedStr = localStorage.getItem('cached_trelica_models');
        let list = cachedStr ? JSON.parse(cachedStr) : [];
        const existingIdx = list.findIndex((m: any) => (modelData.cod && m.cod === modelData.cod) || (m.modelo === modelData.modelo && m.tamanho === modelData.tamanho));
        if (existingIdx >= 0) {
            list[existingIdx] = { ...list[existingIdx], ...modelData };
        } else {
            list.push({ id: String(Date.now()), ...modelData });
        }
        localStorage.setItem('cached_trelica_models', JSON.stringify(list));
    } catch (err) {
        console.warn('Erro ao sincronizar cache de treliças:', err);
    }
};

const removeTrelicaFromCache = (code?: string, modelo?: string, tamanho?: string) => {
    try {
        const cachedStr = localStorage.getItem('cached_trelica_models');
        if (!cachedStr) return;
        let list = JSON.parse(cachedStr);
        list = list.filter((m: any) => {
            if (code && m.cod === code) return false;
            if (modelo && tamanho && m.modelo === modelo && m.tamanho === tamanho) return false;
            return true;
        });
        localStorage.setItem('cached_trelica_models', JSON.stringify(list));
    } catch (err) {
        console.warn('Erro ao remover do cache de treliças:', err);
    }
};

const GaugesManager: React.FC<GaugesManagerProps> = ({ gauges, onAdd, onDelete, onUpdate, onRestoreDefaults }) => {
    const [newGauge, setNewGauge] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newProductCode, setNewProductCode] = useState('');
    const [materialType, setMaterialType] = useState<MaterialType>('Fio Máquina');

    // Treliça specific form states
    const [trModelo, setTrModelo] = useState('');
    const [trTamanho, setTrTamanho] = useState('12');
    const [trSuperior, setTrSuperior] = useState('5,6');
    const [trInferior, setTrInferior] = useState('3,2');
    const [trSenozoide, setTrSenozoide] = useState('3,2');
    const [trPesoFinal, setTrPesoFinal] = useState('');
    const [trCode, setTrCode] = useState('');
    
    // Editing states
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingGauge, setEditingGauge] = useState('');
    const [editingDescription, setEditingDescription] = useState('');
    const [editingCode, setEditingCode] = useState('');
    const [editingTrSuperior, setEditingTrSuperior] = useState('');
    const [editingTrInferior, setEditingTrInferior] = useState('');
    const [editingTrSenozoide, setEditingTrSenozoide] = useState('');
    const [editingTrPesoFinal, setEditingTrPesoFinal] = useState('');
    const [editingTrTamanho, setEditingTrTamanho] = useState('12');
    const [searchTerm, setSearchTerm] = useState('');

    // Ensure default electrode, sabao & trelica gauges are visible if not yet added
    const effectiveGauges = useMemo(() => {
        let result = [...gauges];
        
        let deletedDefaults: string[] = [];
        let overriddenDefaults: string[] = [];
        try {
            deletedDefaults = JSON.parse(localStorage.getItem('deleted_default_gauges') || '[]');
            overriddenDefaults = JSON.parse(localStorage.getItem('overridden_default_gauges') || '[]');
        } catch (e) {}

        // 1. Eletrodos: inclui os padrões que ainda não estejam salvos no banco ou substituídos
        DefaultElectrodeGauges.forEach(d => {
            const defId = `default_el_${d.productCode}`;
            if (deletedDefaults.includes(defId) || overriddenDefaults.includes(defId)) return;
            const exists = result.some(g => 
                g.materialType === 'Eletrodos Treliças' && 
                ((d.productCode && g.productCode === d.productCode) || g.id === defId)
            );
            if (!exists) {
                result.push({
                    id: defId,
                    materialType: d.materialType,
                    gauge: d.gauge,
                    productCode: d.productCode,
                    description: d.description
                });
            }
        });

        // 2. Sabão: inclui os padrões que ainda não estejam salvos no banco ou substituídos
        DefaultSabaoGauges.forEach(d => {
            const defId = `default_sb_${d.productCode}`;
            if (deletedDefaults.includes(defId) || overriddenDefaults.includes(defId)) return;
            const exists = result.some(g => 
                g.materialType === 'Sabão' && 
                ((d.productCode && g.productCode === d.productCode) || g.id === defId)
            );
            if (!exists) {
                result.push({
                    id: defId,
                    materialType: d.materialType,
                    gauge: d.gauge,
                    productCode: d.productCode,
                    description: d.description
                });
            }
        });

        // 3. Treliças: inclui os modelos padrão que ainda não estejam no banco ou substituídos
        DefaultTrelicaGauges.forEach(d => {
            const defId = d.id || `default_tr_${d.productCode}`;
            if (deletedDefaults.includes(defId) || overriddenDefaults.includes(defId)) return;
            const exists = result.some(g => 
                g.materialType === 'Treliça' && 
                ((d.productCode && g.productCode === d.productCode) || 
                 (g.description === d.description && (g.tamanho === d.tamanho || g.gauge === d.gauge)) ||
                 g.id === defId)
            );
            if (!exists) {
                result.push({
                    id: defId,
                    ...d
                });
            }
        });

        return result;
    }, [gauges]);

    const handleAdd = () => {
        if (materialType === 'Eletrodos Treliças') {
            const code = newProductCode.trim() || newGauge.trim();
            const desc = newDescription.trim() || newGauge.trim();
            if (!code && !desc) {
                alert('Por favor, insira o código (ex: 1000) ou o modelo do eletrodo.');
                return;
            }

            const finalGauge = code || '1000';
            const finalDesc = desc || `Eletrodo Cód. ${finalGauge}`;

            const isDuplicate = effectiveGauges.some(g =>
                g.materialType === 'Eletrodos Treliças' &&
                ((code && g.productCode === code) ||
                 (g.description || '').toLowerCase() === finalDesc.toLowerCase())
            );

            if (isDuplicate) {
                alert('Já existe um eletrodo cadastrado com este mesmo código ou modelo.');
                return;
            }

            onAdd({
                materialType: 'Eletrodos Treliças',
                gauge: finalGauge,
                description: finalDesc,
                productCode: code || undefined
            });

            setNewGauge('');
            setNewDescription('');
            setNewProductCode('');
            return;
        }

        if (materialType === 'Sabão') {
            const embalagem = newGauge.trim() || 'Saco 25kg';
            const desc = newDescription.trim() || 'Condat';
            const code = newProductCode.trim() || '00010';

            const isDuplicate = effectiveGauges.some(g =>
                g.materialType === 'Sabão' &&
                ((code && g.productCode === code) ||
                 (g.description || '').toLowerCase() === desc.toLowerCase())
            );

            if (isDuplicate) {
                alert('Já existe um produto de Sabão cadastrado com este mesmo código ou descrição.');
                return;
            }

            onAdd({
                materialType: 'Sabão',
                gauge: embalagem,
                description: desc,
                productCode: code || undefined
            });

            setNewGauge('');
            setNewDescription('');
            setNewProductCode('');
            return;
        }

        if (materialType === 'Treliça') {
            const modelo = trModelo.trim() || newDescription.trim() || 'H-8 LEVE';
            const tamanho = trTamanho.trim() || '12';
            const sup = trSuperior.trim() || '5,6';
            const inf = trInferior.trim() || '3,2';
            const sen = trSenozoide.trim() || '3,2';
            const calculated = calculateTrelicaWeights(tamanho, sup, inf, sen, modelo);
            const pesoFinal = trPesoFinal.trim() || calculated?.pesoFinal || '5,797';
            const code = trCode.trim() || newProductCode.trim() || (modelo.replace(/[^A-Za-z0-9]/g, '') + tamanho).toUpperCase();

            const isDuplicate = effectiveGauges.some(g =>
                g.materialType === 'Treliça' &&
                ((code && g.productCode === code) ||
                 ((g.description || '').toLowerCase() === modelo.toLowerCase() && (g.tamanho || g.gauge.replace(/\D/g, '')) === tamanho))
            );

            if (isDuplicate) {
                alert(`Já existe um modelo de Treliça cadastrado com o código ${code} ou ${modelo} ${tamanho}m.`);
                return;
            }

            const newTrelica: Omit<StockGauge, 'id'> = {
                materialType: 'Treliça',
                gauge: `${tamanho}m`,
                description: modelo,
                productCode: code,
                tamanho: tamanho,
                superior: sup,
                inferior: inf,
                senozoide: sen,
                peso_final: pesoFinal,
                peso_superior: calculated?.pesoSuperior,
                peso_inferior: calculated?.pesoInferior,
                peso_senozoide: calculated?.pesoSenozoide
            };

            onAdd(newTrelica);

            syncTrelicaModelToCache({
                cod: code,
                modelo: modelo,
                tamanho: tamanho,
                superior: sup,
                inferior: inf,
                senozoide: sen,
                peso_final: pesoFinal,
                peso_superior: calculated?.pesoSuperior || '',
                peso_inferior: calculated?.pesoInferior || '',
                peso_senozoide: calculated?.pesoSenozoide || '',
                pesoFinal: pesoFinal,
                pesoSuperior: calculated?.pesoSuperior || '',
                pesoInferior: calculated?.pesoInferior || '',
                pesoSenozoide: calculated?.pesoSenozoide || ''
            });

            setTrModelo('');
            setTrSuperior('5,6');
            setTrInferior('3,2');
            setTrSenozoide('3,2');
            setTrPesoFinal('');
            setTrCode('');
            return;
        }

        if (!newGauge.trim()) {
            alert('Por favor, insira o diâmetro da bitola em mm.');
            return;
        }

        // Normalize gauge string (comma to dot)
        const normalized = newGauge.trim().replace(',', '.');
        const numberVal = parseFloat(normalized);
        if (isNaN(numberVal) || numberVal <= 0) {
            alert('Por favor, insira um número válido e positivo para a bitola (ex: 5.00 ou 6.50).');
            return;
        }

        const formatted = numberVal.toFixed(2);
        const finalDesc = newDescription.trim() || `${materialType} ${formatted.replace('.', ',')}mm`;

        // Check if already exists an EXACT DUPLICATE
        const isExactDuplicate = effectiveGauges.some(g => 
            g.materialType === materialType && 
            g.gauge === formatted && 
            (g.description || '').trim().toLowerCase() === finalDesc.toLowerCase() &&
            (g.productCode || '').trim().toLowerCase() === newProductCode.trim().toLowerCase()
        );

        if (isExactDuplicate) {
            alert('Já existe exatamente este produto cadastrado com a mesma bitola, descrição e código para este material.');
            return;
        }

        onAdd({
            materialType: materialType,
            gauge: formatted,
            description: finalDesc,
            productCode: newProductCode.trim() || undefined
        });

        setNewGauge('');
        setNewDescription('');
        setNewProductCode('');
    };

    const handleUpdate = (id: string) => {
        const item = effectiveGauges.find(g => g.id === id);
        if (item?.materialType === 'Treliça') {
            const calculated = calculateTrelicaWeights(editingTrTamanho || item.tamanho || '12', editingTrSuperior || item.superior || '5,6', editingTrInferior || item.inferior || '3,2', editingTrSenozoide || item.senozoide || '3,2', editingDescription || item.description || '');
            const finalPeso = editingTrPesoFinal || calculated?.pesoFinal || item.peso_final || '0';

            onUpdate(id, { 
                materialType: 'Treliça',
                gauge: `${editingTrTamanho || item.tamanho || '12'}m`,
                description: editingDescription.trim() || item.description || 'Treliça',
                productCode: editingCode.trim() || item.productCode || '',
                tamanho: editingTrTamanho || item.tamanho || '12',
                superior: editingTrSuperior || item.superior,
                inferior: editingTrInferior || item.inferior,
                senozoide: editingTrSenozoide || item.senozoide,
                peso_final: finalPeso,
                peso_superior: calculated?.pesoSuperior || item.peso_superior,
                peso_inferior: calculated?.pesoInferior || item.peso_inferior,
                peso_senozoide: calculated?.pesoSenozoide || item.peso_senozoide
            });

            syncTrelicaModelToCache({
                cod: editingCode.trim() || item.productCode,
                modelo: editingDescription.trim() || item.description,
                tamanho: editingTrTamanho || item.tamanho,
                superior: editingTrSuperior || item.superior,
                inferior: editingTrInferior || item.inferior,
                senozoide: editingTrSenozoide || item.senozoide,
                peso_final: finalPeso,
                pesoFinal: finalPeso,
                pesoSuperior: calculated?.pesoSuperior || item.peso_superior || '',
                pesoInferior: calculated?.pesoInferior || item.peso_inferior || '',
                pesoSenozoide: calculated?.pesoSenozoide || item.peso_senozoide || ''
            });
        } else if (item?.materialType === 'Eletrodos Treliças' || item?.materialType === 'Sabão') {
            onUpdate(id, { 
                materialType: item.materialType,
                gauge: editingGauge.trim() || item.gauge,
                description: editingDescription.trim() || item.description,
                productCode: editingCode.trim() || item.productCode 
            });
        } else {
            const normalized = editingGauge.trim().replace(',', '.');
            const numberVal = parseFloat(normalized);
            const finalGauge = !isNaN(numberVal) && numberVal > 0 ? numberVal.toFixed(2) : (item?.gauge || editingGauge.trim());

            onUpdate(id, { 
                materialType: item?.materialType,
                gauge: finalGauge,
                description: editingDescription.trim() || item?.description,
                productCode: editingCode.trim() || item?.productCode 
            });
        }
        setEditingId(null);
        setEditingGauge('');
        setEditingDescription('');
        setEditingCode('');
        setEditingTrSuperior('');
        setEditingTrInferior('');
        setEditingTrSenozoide('');
        setEditingTrPesoFinal('');
        setEditingTrTamanho('12');
    };

    const startEditing = (g: StockGauge) => {
        setEditingId(g.id);
        setEditingGauge(g.gauge);
        setEditingDescription(g.description || (g.materialType === 'Eletrodos Treliças' ? `Eletrodo ${g.productCode || g.gauge}` : `${g.materialType} ${g.gauge.replace('.', ',')}mm`));
        setEditingCode(g.productCode || '');
        if (g.materialType === 'Treliça') {
            setEditingTrTamanho(g.tamanho || g.gauge.replace(/\D/g, '') || '12');
            setEditingTrSuperior(g.superior || '5,6');
            setEditingTrInferior(g.inferior || '3,2');
            setEditingTrSenozoide(g.senozoide || '3,2');
            setEditingTrPesoFinal(g.peso_final || '');
        }
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditingGauge('');
        setEditingDescription('');
        setEditingCode('');
        setEditingTrSuperior('');
        setEditingTrInferior('');
        setEditingTrSenozoide('');
        setEditingTrPesoFinal('');
        setEditingTrTamanho('12');
    };

    const gaugesByMaterial = MaterialOptions.reduce((acc, material) => {
        acc[material] = effectiveGauges
            .filter(g => g.materialType === material)
            .filter(g => {
                if (!searchTerm) return true;
                const searchLower = searchTerm.toLowerCase();
                return (
                    g.gauge.replace('.', ',').includes(searchLower) ||
                    g.gauge.includes(searchLower) ||
                    (g.description || '').toLowerCase().includes(searchLower) ||
                    (g.productCode || '').toLowerCase().includes(searchLower) ||
                    (g.superior || '').includes(searchLower) ||
                    (g.inferior || '').includes(searchLower) ||
                    (g.senozoide || '').includes(searchLower)
                );
            })
            .sort((a, b) => {
                if (material === 'Treliça') {
                    const compDesc = (a.description || '').localeCompare(b.description || '');
                    if (compDesc !== 0) return compDesc;
                    const sizeA = parseInt(a.tamanho || a.gauge) || 0;
                    const sizeB = parseInt(b.tamanho || b.gauge) || 0;
                    return sizeA - sizeB;
                }
                if (material === 'Eletrodos Treliças') {
                    const codeA = parseInt(a.productCode || a.gauge) || 0;
                    const codeB = parseInt(b.productCode || b.gauge) || 0;
                    if (codeA !== codeB) return codeA - codeB;
                    return (a.description || '').localeCompare(b.description || '');
                }
                if (material === 'Sabão') {
                    return (a.description || a.gauge).localeCompare(b.description || b.gauge);
                }
                const diff = parseFloat(a.gauge) - parseFloat(b.gauge);
                if (diff !== 0) return diff;
                return (a.description || '').localeCompare(b.description || '');
            });
        return acc;
    }, {} as Record<string, StockGauge[]>);

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 animate-fadeIn">
            <div className="max-w-[1680px] mx-auto space-y-6">
                <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Gerenciar Produtos, Bitolas, Eletrodos & Treliças</h1>
                        <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                            Catálogo industrial unificado: Matéria-Prima, Insumos (Sabão), Eletrodos e Modelos de Treliça (Ficha Técnica).
                        </p>
                    </div>
                    <button
                        onClick={onRestoreDefaults}
                        className="bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 font-bold py-2 px-4 rounded-xl shadow-sm transition text-xs sm:text-sm flex items-center gap-2"
                        title="Carrega as bitolas industriais padrão, eletrodos, sabão e modelos de treliça caso não existam"
                    >
                        <ArrowPathIcon className="h-4 w-4 text-blue-600" />
                        Restaurar Padrões
                    </button>
                </header>

                {/* FORMULÁRIO DE CADASTRO */}
                <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
                    <div className="p-5 sm:p-6 bg-slate-50/70 border-b border-slate-200">
                        <h2 className="text-base sm:text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
                                <PlusIcon className="h-5 w-5" />
                            </span>
                            {materialType === 'Treliça' ? 'Cadastrar Modelo de Treliça (Ficha Técnica)' : 'Cadastrar Novo Produto / Bitola'}
                        </h2>

                        {/* Seletor de Material */}
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                Tipo de Material / Categoria <span className="text-red-500">*</span>
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {MaterialOptions.map(m => {
                                    const isSelected = materialType === m;
                                    const icon = m === 'Treliça' ? '📐' : m === 'Sabão' ? '🧼' : m === 'Eletrodos Treliças' ? '⚡' : '⚙️';
                                    return (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => setMaterialType(m as MaterialType)}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-xs ${
                                                isSelected
                                                    ? 'bg-[#0F3F5C] text-white border-[#0F3F5C] shadow-md'
                                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                            }`}
                                        >
                                            <span>{icon}</span>
                                            <span>{m === 'Treliça' ? 'Treliças' : m}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {materialType === 'Treliça' ? (
                            /* FORMULÁRIO EXCLUSIVO DE TRELIÇA */
                            <div className="bg-cyan-50/60 p-4 rounded-xl border border-cyan-200 space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
                                    {/* Modelo */}
                                    <div className="lg:col-span-2">
                                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                            Modelo da Treliça <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            list="trelica-model-suggestions"
                                            value={trModelo}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setTrModelo(val);
                                                const calc = calculateTrelicaWeights(trTamanho, trSuperior, trInferior, trSenozoide, val);
                                                if (calc) setTrPesoFinal(calc.pesoFinal);
                                                if (!trCode) {
                                                    const clean = val.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                                                    setTrCode(clean ? `${clean}${trTamanho}` : '');
                                                }
                                            }}
                                            placeholder="Ex: H-8 LEVE, H-10 LEVE..."
                                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none text-xs font-bold bg-white"
                                        />
                                        <datalist id="trelica-model-suggestions">
                                            <option value="H-6 LEVE (ESPAÇADOR)" />
                                            <option value="H-6" />
                                            <option value="H-8 LEVE" />
                                            <option value="H-8 MÉDIA" />
                                            <option value="H-8 PESADA" />
                                            <option value="H-8 SUPER PESADO" />
                                            <option value="H-10 LEVE" />
                                            <option value="H-10 PESADA" />
                                            <option value="H-12 LEVE" />
                                            <option value="H-12 PESADA" />
                                            <option value="H-16" />
                                            <option value="H-25" />
                                        </datalist>
                                    </div>

                                    {/* Tamanho */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                            Comprimento <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={trTamanho}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setTrTamanho(val);
                                                const calc = calculateTrelicaWeights(val, trSuperior, trInferior, trSenozoide, trModelo);
                                                if (calc) setTrPesoFinal(calc.pesoFinal);
                                                if (trModelo) {
                                                    const clean = trModelo.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                                                    setTrCode(`${clean}${val}`);
                                                }
                                            }}
                                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none text-xs font-bold bg-white"
                                        >
                                            <option value="12">12 Metros</option>
                                            <option value="6">6 Metros</option>
                                            <option value="8">8 Metros</option>
                                            <option value="10">10 Metros</option>
                                        </select>
                                    </div>

                                    {/* Código */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                            Cód. Produto <span className="text-cyan-800 font-extrabold">(Ex: H8L12)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={trCode}
                                            onChange={e => setTrCode(e.target.value.toUpperCase())}
                                            placeholder="Ex: H8L12"
                                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none text-xs font-mono font-bold uppercase bg-white"
                                        />
                                    </div>

                                    {/* Superior */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                            Superior (mm)
                                        </label>
                                        <input
                                            type="text"
                                            value={trSuperior}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setTrSuperior(val);
                                                const calc = calculateTrelicaWeights(trTamanho, val, trInferior, trSenozoide, trModelo);
                                                if (calc) setTrPesoFinal(calc.pesoFinal);
                                            }}
                                            placeholder="Ex: 5,6"
                                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none text-xs font-bold bg-white"
                                        />
                                    </div>

                                    {/* Inferior */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                            Inferior (mm)
                                        </label>
                                        <input
                                            type="text"
                                            value={trInferior}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setTrInferior(val);
                                                const calc = calculateTrelicaWeights(trTamanho, trSuperior, val, trSenozoide, trModelo);
                                                if (calc) setTrPesoFinal(calc.pesoFinal);
                                            }}
                                            placeholder="Ex: 3,2"
                                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none text-xs font-bold bg-white"
                                        />
                                    </div>

                                    {/* Senóide */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                            Senóide (mm)
                                        </label>
                                        <input
                                            type="text"
                                            value={trSenozoide}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setTrSenozoide(val);
                                                const calc = calculateTrelicaWeights(trTamanho, trSuperior, trInferior, val, trModelo);
                                                if (calc) setTrPesoFinal(calc.pesoFinal);
                                            }}
                                            placeholder="Ex: 3,2"
                                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none text-xs font-bold bg-white"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-cyan-200">
                                    <div className="flex items-center gap-3">
                                        <label className="text-xs font-bold text-slate-700 uppercase">
                                            Peso Final da Barra:
                                        </label>
                                        <div className="relative w-36">
                                            <input
                                                type="text"
                                                value={trPesoFinal}
                                                onChange={e => setTrPesoFinal(e.target.value)}
                                                placeholder="Ex: 5,797"
                                                className="w-full p-1.5 pr-8 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none text-xs font-black text-cyan-900 bg-white"
                                            />
                                            <span className="absolute right-2 top-1.5 text-xs font-bold text-slate-400">kg</span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 italic">(calculado automaticamente pelo padrão técnico)</span>
                                    </div>

                                    <button
                                        onClick={handleAdd}
                                        className="bg-cyan-700 hover:bg-cyan-800 text-white font-bold py-2 px-6 rounded-xl shadow-md transition-all flex items-center gap-2 hover:shadow-lg active:scale-95 text-xs self-end sm:self-auto"
                                    >
                                        <PlusIcon className="h-4 w-4" /> Cadastrar Modelo de Treliça
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* FORMULÁRIO PADRÃO PARA DEMAIS MATERIAIS */
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {/* Bitola / Modelo / Embalagem */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                        {materialType === 'Eletrodos Treliças' ? 'Modelo / Posição' : materialType === 'Sabão' ? 'Embalagem / Apresentação' : 'Bitola (mm)'} <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={newGauge}
                                        onChange={e => setNewGauge(e.target.value)}
                                        placeholder={
                                            materialType === 'Eletrodos Treliças' 
                                                ? "Ex: Eletrodo Superior (D)" 
                                                : materialType === 'Sabão' 
                                                    ? "Ex: Saco 25kg" 
                                                    : "Ex: 5.00 ou 6.50"
                                        }
                                        className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-semibold text-slate-800 text-sm"
                                        onKeyPress={e => e.key === 'Enter' && handleAdd()}
                                    />
                                </div>

                                {/* Descrição do Produto */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                        Descrição do Produto
                                    </label>
                                    <input
                                        type="text"
                                        value={newDescription}
                                        onChange={e => setNewDescription(e.target.value)}
                                        placeholder={
                                            materialType === 'Eletrodos Treliças' 
                                                ? "Ex: Eletrodo Superior (D)" 
                                                : materialType === 'Sabão' 
                                                    ? "Ex: Condat" 
                                                    : materialType === 'CA-60' 
                                                        ? "Ex: CA-60 5,00mm (Rolo ~2000kg)" 
                                                        : "Ex: Fio Máquina 6,50mm Gerdau"
                                        }
                                        className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-slate-800 text-sm"
                                        onKeyPress={e => e.key === 'Enter' && handleAdd()}
                                    />
                                </div>

                                {/* Código do Produto */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                        Cód. Produto {materialType === 'Eletrodos Treliças' ? <span className="text-orange-500 font-bold">(ex: 1000)</span> : materialType === 'Sabão' ? <span className="text-emerald-600 font-bold">(ex: 00010)</span> : '(Opcional)'}
                                    </label>
                                    <input
                                        type="text"
                                        value={newProductCode}
                                        onChange={e => setNewProductCode(e.target.value)}
                                        placeholder={materialType === 'Eletrodos Treliças' ? "Ex: 1000" : materialType === 'Sabão' ? "Ex: 00010" : "Ex: CA60-001"}
                                        className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-slate-800 text-sm uppercase font-mono"
                                        onKeyPress={e => e.key === 'Enter' && handleAdd()}
                                    />
                                </div>

                                <div className="col-span-full flex justify-end">
                                    <button
                                        onClick={handleAdd}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl shadow-md transition-all flex items-center gap-2 hover:shadow-lg active:scale-95 text-sm"
                                    >
                                        <PlusIcon className="h-4 w-4" /> {materialType === 'Eletrodos Treliças' ? 'Cadastrar Eletrodo' : materialType === 'Sabão' ? 'Cadastrar Insumo (Sabão)' : 'Cadastrar Produto'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* BARRA DE BUSCA */}
                    <div className="px-6 py-3.5 bg-white border-b border-slate-100 flex items-center gap-3">
                        <SearchIcon className="h-5 w-5 text-slate-400 shrink-0" />
                        <input
                            type="text"
                            placeholder="Buscar por bitola, modelo, descrição, código ou especificação (ex: 5.00, H-8, H8L12, condat, 00010)..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="flex-grow outline-none text-sm text-slate-700 font-medium placeholder-slate-400"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600 text-xs font-bold">
                                Limpar
                            </button>
                        )}
                    </div>

                    {/* LISTAGEM POR MATERIAL */}
                    <div className="p-6 bg-slate-50/30">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
                            {MaterialOptions.map(material => {
                                const isFioMaquina = material === 'Fio Máquina';
                                const isCA60 = material === 'CA-60';
                                const isSabao = material === 'Sabão';
                                const isTrelica = material === 'Treliça';
                                const badgeColor = isFioMaquina 
                                    ? 'bg-amber-100 text-amber-800 border-amber-300' 
                                    : isCA60 
                                        ? 'bg-blue-100 text-blue-800 border-blue-300' 
                                        : isSabao
                                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                            : isTrelica
                                                ? 'bg-cyan-100 text-cyan-900 border-cyan-300'
                                                : 'bg-orange-100 text-orange-900 border-orange-300';
                                const items = gaugesByMaterial[material] || [];

                                return (
                                    <div key={material} className="space-y-3">
                                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate" title={material}>
                                                {isTrelica ? (
                                                    <span className="text-sm">📐</span>
                                                ) : material === 'Eletrodos Treliças' ? (
                                                    <span className="text-sm">⚡</span>
                                                ) : isSabao ? (
                                                    <span className="text-sm">🧼</span>
                                                ) : (
                                                    <ScaleIcon className="h-4 w-4 text-slate-500" />
                                                )}
                                                <span>{isTrelica ? 'Treliças' : material}</span>
                                            </h3>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black border ${badgeColor} shrink-0`}>
                                                {items.length} {items.length === 1 ? 'item' : 'itens'}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 gap-2.5">
                                            {items.map(g => {
                                                const isEditing = editingId === g.id;

                                                if (isEditing) {
                                                    if (g.materialType === 'Treliça') {
                                                        return (
                                                            <div key={g.id} className="p-3 bg-white rounded-xl border-2 border-cyan-500 shadow-md space-y-2.5 animate-fadeIn">
                                                                <div className="flex items-center justify-between border-b pb-1 text-xs font-black text-cyan-800 uppercase">
                                                                    <span>Editando Treliça</span>
                                                                    <button onClick={cancelEditing} className="text-slate-400 hover:text-slate-600">
                                                                        <XIcon className="h-4 w-4" />
                                                                    </button>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <div>
                                                                        <label className="text-[9px] font-bold text-slate-500 uppercase block">Modelo / Descrição</label>
                                                                        <input
                                                                            type="text"
                                                                            value={editingDescription}
                                                                            onChange={e => setEditingDescription(e.target.value)}
                                                                            className="w-full p-1.5 text-xs border rounded-lg bg-slate-50 font-bold"
                                                                            placeholder="Ex: H-10 LEVE"
                                                                        />
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-1.5">
                                                                        <div>
                                                                            <label className="text-[9px] font-bold text-slate-500 uppercase block">Tam (m)</label>
                                                                            <select
                                                                                value={editingTrTamanho}
                                                                                onChange={e => setEditingTrTamanho(e.target.value)}
                                                                                className="w-full p-1.5 text-xs border rounded-lg bg-slate-50 font-bold"
                                                                            >
                                                                                <option value="12">12m</option>
                                                                                <option value="6">6m</option>
                                                                                <option value="8">8m</option>
                                                                                <option value="10">10m</option>
                                                                            </select>
                                                                        </div>
                                                                        <div>
                                                                            <label className="text-[9px] font-bold text-slate-500 uppercase block">Cód. Produto</label>
                                                                            <input
                                                                                type="text"
                                                                                value={editingCode}
                                                                                onChange={e => setEditingCode(e.target.value.toUpperCase())}
                                                                                className="w-full p-1.5 text-xs border rounded-lg bg-slate-50 font-mono font-bold"
                                                                                placeholder="Ex: H10L6"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    <div className="grid grid-cols-3 gap-1 text-center">
                                                                        <div>
                                                                            <label className="text-[8px] font-bold text-slate-400 uppercase block">Sup</label>
                                                                            <input
                                                                                type="text"
                                                                                value={editingTrSuperior}
                                                                                onChange={e => setEditingTrSuperior(e.target.value)}
                                                                                className="w-full p-1 text-xs text-center border rounded bg-slate-50 font-bold"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label className="text-[8px] font-bold text-slate-400 uppercase block">Inf</label>
                                                                            <input
                                                                                type="text"
                                                                                value={editingTrInferior}
                                                                                onChange={e => setEditingTrInferior(e.target.value)}
                                                                                className="w-full p-1 text-xs text-center border rounded bg-slate-50 font-bold"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label className="text-[8px] font-bold text-slate-400 uppercase block">Sen</label>
                                                                            <input
                                                                                type="text"
                                                                                value={editingTrSenozoide}
                                                                                onChange={e => setEditingTrSenozoide(e.target.value)}
                                                                                className="w-full p-1 text-xs text-center border rounded bg-slate-50 font-bold"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[9px] font-bold text-slate-500 uppercase block">Peso Final (kg)</label>
                                                                        <input
                                                                            type="text"
                                                                            value={editingTrPesoFinal}
                                                                            onChange={e => setEditingTrPesoFinal(e.target.value)}
                                                                            className="w-full p-1.5 text-xs border rounded-lg bg-slate-50 font-black text-cyan-900"
                                                                        />
                                                                    </div>
                                                                    <div className="flex items-center justify-end gap-1.5 pt-1">
                                                                        <button
                                                                            onClick={cancelEditing}
                                                                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold transition"
                                                                        >
                                                                            Cancelar
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleUpdate(g.id)}
                                                                            className="bg-cyan-700 hover:bg-cyan-800 text-white px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                                                                        >
                                                                            <CheckCircleIcon className="h-3.5 w-3.5" /> Salvar
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <div key={g.id} className="p-3 bg-white rounded-xl border-2 border-blue-500 shadow-md space-y-2.5 animate-fadeIn">
                                                            <div className="flex items-center justify-between border-b pb-1.5 text-xs font-black text-blue-700 uppercase">
                                                                <span>Editando ({g.materialType})</span>
                                                                <button onClick={cancelEditing} className="text-slate-400 hover:text-slate-600">
                                                                    <XIcon className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                            <div className="grid grid-cols-3 gap-2">
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-slate-500 uppercase block">
                                                                        {g.materialType === 'Eletrodos Treliças' ? 'Modelo' : g.materialType === 'Sabão' ? 'Embalagem' : 'Bitola (mm)'}
                                                                    </label>
                                                                    <input
                                                                        type="text"
                                                                        value={editingGauge}
                                                                        onChange={e => setEditingGauge(e.target.value)}
                                                                        className="w-full p-1.5 text-xs border rounded-lg bg-slate-50 font-bold"
                                                                        placeholder={g.materialType === 'Eletrodos Treliças' ? "Superior (D)" : g.materialType === 'Sabão' ? "Saco 25kg" : "5.00"}
                                                                    />
                                                                </div>
                                                                <div className="col-span-2">
                                                                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Descrição</label>
                                                                    <input
                                                                        type="text"
                                                                        value={editingDescription}
                                                                        onChange={e => setEditingDescription(e.target.value)}
                                                                        className="w-full p-1.5 text-xs border rounded-lg bg-slate-50 font-bold"
                                                                        placeholder="Descrição do produto"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex-1">
                                                                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Cód. Produto</label>
                                                                    <input
                                                                        type="text"
                                                                        value={editingCode}
                                                                        onChange={e => setEditingCode(e.target.value)}
                                                                        className="w-full p-1.5 text-xs border rounded-lg bg-slate-50 font-bold uppercase font-mono"
                                                                        placeholder={g.materialType === 'Eletrodos Treliças' ? "1000" : g.materialType === 'Sabão' ? "00010" : "CA60-001"}
                                                                    />
                                                                </div>
                                                                <div className="flex items-end gap-1.5 pt-4">
                                                                    <button
                                                                        onClick={() => handleUpdate(g.id)}
                                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                                                                        title="Salvar alterações"
                                                                    >
                                                                        <CheckCircleIcon className="h-4 w-4" /> Salvar
                                                                    </button>
                                                                    <button
                                                                        onClick={cancelEditing}
                                                                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                                                                    >
                                                                        Cancelar
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                const isElectrode = g.materialType === 'Eletrodos Treliças';
                                                const isItemSabao = g.materialType === 'Sabão';
                                                const isItemTrelica = g.materialType === 'Treliça';

                                                return (
                                                    <div 
                                                        key={g.id} 
                                                        className={`group flex items-start justify-between p-3 bg-white rounded-xl border transition-all ${
                                                            isItemTrelica 
                                                                ? 'border-slate-200 hover:border-cyan-400 hover:shadow-md' 
                                                                : 'border-slate-200 hover:border-blue-300 hover:shadow-sm'
                                                        }`}
                                                    >
                                                        <div className="flex flex-col min-w-0 flex-grow pr-2">
                                                            {isItemTrelica ? (
                                                                <>
                                                                    <div className="flex items-center justify-between gap-1 mb-1">
                                                                        <span className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-900 border border-cyan-300">
                                                                            {g.productCode || 'CÓD'}
                                                                        </span>
                                                                        <span className="text-[10px] font-extrabold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                                                                            {g.tamanho || g.gauge.replace(/\D/g, '') || '12'}m
                                                                        </span>
                                                                    </div>

                                                                    <span className="font-black text-slate-800 text-xs tracking-tight truncate block mb-1" title={g.description || 'Treliça'}>
                                                                        {g.description || 'Treliça'}
                                                                    </span>

                                                                    <div className="grid grid-cols-3 gap-1 my-1 text-center bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                                                                        <div>
                                                                            <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold block">Sup</span>
                                                                            <span className="text-[10px] font-black text-slate-700">{g.superior || '-'}</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold block">Inf</span>
                                                                            <span className="text-[10px] font-black text-slate-700">{g.inferior || '-'}</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold block">Sen</span>
                                                                            <span className="text-[10px] font-black text-slate-700">{g.senozoide || '-'}</span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 bg-cyan-50/50 px-2 py-0.5 rounded border border-cyan-100 mt-0.5">
                                                                        <span className="text-[9px] text-slate-400 uppercase">Peso Barra:</span>
                                                                        <span className="text-cyan-800 font-black">{g.peso_final || '-'} kg</span>
                                                                    </div>
                                                                </>
                                                            ) : isElectrode ? (
                                                                <>
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        {g.productCode ? (
                                                                            <span className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded bg-orange-100 text-orange-900 border border-orange-300">
                                                                                Cód. {g.productCode}
                                                                            </span>
                                                                        ) : null}
                                                                        <span className="font-black text-slate-800 text-xs tracking-tight">
                                                                            {g.description || g.gauge}
                                                                        </span>
                                                                    </div>
                                                                </>
                                                            ) : isItemSabao ? (
                                                                <>
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className="font-black text-slate-800 text-sm tracking-tight flex items-center gap-1">
                                                                            <span>🧼</span> {g.gauge}
                                                                        </span>
                                                                        {g.productCode ? (
                                                                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                                                Cód. {g.productCode}
                                                                            </span>
                                                                        ) : null}
                                                                    </div>
                                                                    <span className="text-xs font-bold text-slate-700 mt-1 block truncate" title={g.description || 'Condat'}>
                                                                        {g.description || 'Sabão'}
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className="font-black text-slate-800 text-sm tracking-tight">
                                                                            {g.gauge.replace('.', ',')} mm
                                                                        </span>
                                                                        {g.productCode ? (
                                                                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                                                                {g.productCode}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-[9px] text-slate-400 italic">Sem código</span>
                                                                        )}
                                                                    </div>

                                                                    <span className="text-xs font-bold text-slate-700 mt-1 block truncate" title={g.description || `${g.materialType} ${g.gauge.replace('.', ',')} mm`}>
                                                                        {g.description || `${g.materialType} ${g.gauge.replace('.', ',')} mm`}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-1 shrink-0 pt-0.5">
                                                            <button
                                                                onClick={() => startEditing(g)}
                                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                                title="Editar Modelo e Código"
                                                            >
                                                                <PencilIcon className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    const label = isItemTrelica
                                                                        ? `${g.description || 'Treliça'} ${g.tamanho || g.gauge} (Cód. ${g.productCode})`
                                                                        : isElectrode 
                                                                            ? `${g.description || g.gauge} (Cód. ${g.productCode || g.gauge})` 
                                                                            : isItemSabao
                                                                                ? `${g.description || 'Sabão'} ${g.gauge} (Cód. ${g.productCode || '00010'})`
                                                                                : `${g.gauge.replace('.', ',')} mm (${g.description || material})`;
                                                                    if (confirm(`Deseja remover ${label}?`)) {
                                                                        onDelete(g.id);
                                                                        if (isItemTrelica) {
                                                                            removeTrelicaFromCache(g.productCode, g.description, g.tamanho);
                                                                        }
                                                                    }
                                                                }}
                                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                                                title="Excluir"
                                                            >
                                                                <TrashIcon className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {items.length === 0 && (
                                                <div className="py-8 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center gap-2 bg-white">
                                                    <span>Nenhum produto cadastrado para {material}.</span>
                                                    <span className="text-xs max-w-[280px]">
                                                        Cadastre acima ou restaure os padrões industriais:
                                                    </span>
                                                    <button
                                                        onClick={onRestoreDefaults}
                                                        className="mt-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-lg font-bold hover:bg-blue-100 transition text-xs flex items-center gap-2"
                                                    >
                                                        <ArrowPathIcon className="h-4 w-4" />
                                                        Carregar Padrões
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* DICA DE GESTÃO */}
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3 shadow-sm">
                    <div className="text-amber-600 mt-0.5 shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="text-xs sm:text-sm text-amber-900 leading-relaxed">
                        <p className="font-black mb-0.5">Catálogo Centralizado da Fábrica</p>
                        <p>
                            • <strong>Treliças:</strong> cada modelo possui suas especificações técnicas completas (diâmetro superior, inferior, senóide e peso por barra), sincronizadas com as Ordens de Produção e Suportes.<br />
                            • <strong>Sabão & Insumos:</strong> cadastrados por embalagem (ex: Saco 25kg) com código e descrição de fornecedor.<br />
                            • <strong>Eletrodos & Bitolas de Aço:</strong> controlados individualmente com códigos de rastreabilidade.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GaugesManager;
