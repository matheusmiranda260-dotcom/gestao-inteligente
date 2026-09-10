import React, { useState } from 'react';
import type { StockGauge, MaterialType } from '../types';
import { MaterialOptions } from '../types';
import { TrashIcon, PlusIcon, CheckCircleIcon, ScaleIcon, ArrowPathIcon, PencilIcon, XIcon, SearchIcon } from './icons';

interface GaugesManagerProps {
    gauges: StockGauge[];
    onAdd: (gauge: Omit<StockGauge, 'id'>) => void;
    onDelete: (id: string) => void;
    onUpdate: (id: string, data: Partial<StockGauge>) => void;
    onRestoreDefaults: () => void;
}

const GaugesManager: React.FC<GaugesManagerProps> = ({ gauges, onAdd, onDelete, onUpdate, onRestoreDefaults }) => {
    const [newGauge, setNewGauge] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newProductCode, setNewProductCode] = useState('');
    const [materialType, setMaterialType] = useState<MaterialType>('Fio Máquina');
    
    // Editing states
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingGauge, setEditingGauge] = useState('');
    const [editingDescription, setEditingDescription] = useState('');
    const [editingCode, setEditingCode] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const handleAdd = () => {
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

        // Check if already exists an EXACT DUPLICATE (same material, same gauge, and same description or code)
        const isExactDuplicate = gauges.some(g => 
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
        const normalized = editingGauge.trim().replace(',', '.');
        const numberVal = parseFloat(normalized);
        const finalGauge = !isNaN(numberVal) && numberVal > 0 ? numberVal.toFixed(2) : undefined;

        onUpdate(id, { 
            gauge: finalGauge,
            description: editingDescription.trim() || undefined,
            productCode: editingCode.trim() || undefined 
        });
        setEditingId(null);
        setEditingGauge('');
        setEditingDescription('');
        setEditingCode('');
    };

    const startEditing = (g: StockGauge) => {
        setEditingId(g.id);
        setEditingGauge(g.gauge);
        setEditingDescription(g.description || `${g.materialType} ${g.gauge.replace('.', ',')}mm`);
        setEditingCode(g.productCode || '');
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditingGauge('');
        setEditingDescription('');
        setEditingCode('');
    };

    const gaugesByMaterial = MaterialOptions.reduce((acc, material) => {
        acc[material] = gauges
            .filter(g => g.materialType === material)
            .filter(g => {
                if (!searchTerm) return true;
                const searchLower = searchTerm.toLowerCase();
                return (
                    g.gauge.replace('.', ',').includes(searchLower) ||
                    g.gauge.includes(searchLower) ||
                    (g.description || '').toLowerCase().includes(searchLower) ||
                    (g.productCode || '').toLowerCase().includes(searchLower)
                );
            })
            .sort((a, b) => {
                const diff = parseFloat(a.gauge) - parseFloat(b.gauge);
                if (diff !== 0) return diff;
                return (a.description || '').localeCompare(b.description || '');
            });
        return acc;
    }, {} as Record<string, StockGauge[]>);

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 animate-fadeIn">
            <div className="max-w-5xl mx-auto space-y-6">
                <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Gerenciar Produtos & Bitolas</h1>
                        <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                            Cadastre materiais, bitolas e descrições detalhadas de produtos (ex: rolos de 200kg vs 2000kg).
                        </p>
                    </div>
                    <button
                        onClick={onRestoreDefaults}
                        className="bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 font-bold py-2 px-4 rounded-xl shadow-sm transition text-xs sm:text-sm flex items-center gap-2"
                        title="Carrega as bitolas industriais padrão de Fio Máquina e CA-60 caso não existam"
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
                            Cadastrar Novo Produto / Bitola
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Material */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Material <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={materialType}
                                    onChange={e => setMaterialType(e.target.value as MaterialType)}
                                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm bg-white font-semibold text-slate-800 text-sm"
                                >
                                    {MaterialOptions.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>

                            {/* Bitola */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Bitola (mm) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newGauge}
                                    onChange={e => setNewGauge(e.target.value)}
                                    placeholder="Ex: 5.00 ou 6.50"
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
                                    placeholder={materialType === 'CA-60' ? "Ex: CA-60 5,00mm (Rolo ~2000kg)" : "Ex: Fio Máquina 6,50mm Gerdau"}
                                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-slate-800 text-sm"
                                    onKeyPress={e => e.key === 'Enter' && handleAdd()}
                                />
                            </div>

                            {/* Código do Produto */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Cód. Produto (Opcional)
                                </label>
                                <input
                                    type="text"
                                    value={newProductCode}
                                    onChange={e => setNewProductCode(e.target.value)}
                                    placeholder="Ex: CA60-001"
                                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-slate-800 text-sm uppercase font-mono"
                                    onKeyPress={e => e.key === 'Enter' && handleAdd()}
                                />
                            </div>
                        </div>

                        <div className="mt-4 flex justify-end">
                            <button
                                onClick={handleAdd}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl shadow-md transition-all flex items-center gap-2 hover:shadow-lg active:scale-95 text-sm"
                            >
                                <PlusIcon className="h-4 w-4" /> Cadastrar Produto
                            </button>
                        </div>
                    </div>

                    {/* BARRA DE BUSCA */}
                    <div className="px-6 py-3.5 bg-white border-b border-slate-100 flex items-center gap-3">
                        <SearchIcon className="h-5 w-5 text-slate-400 shrink-0" />
                        <input
                            type="text"
                            placeholder="Buscar por bitola, descrição do produto ou código (ex: 5.00, rolo 2000kg, CA60-001)..."
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
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {MaterialOptions.map(material => {
                                const isFioMaquina = material === 'Fio Máquina';
                                const badgeColor = isFioMaquina ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-blue-100 text-blue-800 border-blue-300';
                                const items = gaugesByMaterial[material];

                                return (
                                    <div key={material} className="space-y-3">
                                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                            <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                                <ScaleIcon className="h-4 w-4 text-slate-500" />
                                                <span>{material}</span>
                                            </h3>
                                            <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-black border ${badgeColor}`}>
                                                {items.length} {items.length === 1 ? 'item' : 'itens'}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 gap-2.5">
                                            {items.map(g => {
                                                const isEditing = editingId === g.id;

                                                if (isEditing) {
                                                    return (
                                                        <div key={g.id} className="p-3 bg-white rounded-xl border-2 border-blue-500 shadow-md space-y-2.5 animate-fadeIn">
                                                            <div className="flex items-center justify-between border-b pb-1.5 text-xs font-black text-blue-700 uppercase">
                                                                <span>Editando Produto ({g.materialType})</span>
                                                                <button onClick={cancelEditing} className="text-slate-400 hover:text-slate-600">
                                                                    <XIcon className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                            <div className="grid grid-cols-3 gap-2">
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Bitola (mm)</label>
                                                                    <input
                                                                        type="text"
                                                                        value={editingGauge}
                                                                        onChange={e => setEditingGauge(e.target.value)}
                                                                        className="w-full p-1.5 text-xs border rounded-lg bg-slate-50 font-bold"
                                                                        placeholder="5.00"
                                                                    />
                                                                </div>
                                                                <div className="col-span-2">
                                                                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Descrição</label>
                                                                    <input
                                                                        type="text"
                                                                        value={editingDescription}
                                                                        onChange={e => setEditingDescription(e.target.value)}
                                                                        className="w-full p-1.5 text-xs border rounded-lg bg-slate-50 font-bold"
                                                                        placeholder="Ex: CA-60 5,00mm (Rolo ~2000kg)"
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
                                                                        placeholder="Ex: CA60-001"
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

                                                return (
                                                    <div 
                                                        key={g.id} 
                                                        className="group flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all"
                                                    >
                                                        <div className="flex flex-col min-w-0 flex-grow pr-2">
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
                                                        </div>

                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button
                                                                onClick={() => startEditing(g)}
                                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                                title="Editar Descrição e Código"
                                                            >
                                                                <PencilIcon className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    const desc = g.description ? ` (${g.description})` : '';
                                                                    if (confirm(`Deseja remover o produto ${g.gauge.replace('.', ',')} mm${desc} de ${material}?`)) {
                                                                        onDelete(g.id);
                                                                    }
                                                                }}
                                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                                                title="Excluir Produto"
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
                                                        Cadastre acima com sua bitola e descrição (ex: rolo 2000kg ou rolo 200kg) ou restaure os padrões:
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
                        <p className="font-black mb-0.5">Diferenciação de Materiais e Descrições</p>
                        <p>
                            • <strong>Fio Máquina</strong> e <strong>CA-60</strong> são tratados como materiais independentes, mesmo compartilhando o mesmo diâmetro (ex: 6,50mm).<br />
                            • Você pode cadastrar produtos com a <strong>mesma bitola</strong> e <strong>descrições diferentes</strong> (ex: CA-60 5,00mm Rolo 2000kg e CA-60 5,00mm Rolo 200kg).
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GaugesManager;
