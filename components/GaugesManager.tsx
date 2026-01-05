import React, { useState } from 'react';
import type { StockGauge, MaterialType } from '../types';
import { MaterialOptions } from '../types';
import { ArrowLeftIcon, TrashIcon, PlusIcon, CheckCircleIcon, ScaleIcon } from './icons';

interface GaugesManagerProps {
    gauges: StockGauge[];
    onClose: () => void;
    onAdd: (gauge: Omit<StockGauge, 'id'>) => void;
    onDelete: (id: string) => void;
}

const GaugesManager: React.FC<GaugesManagerProps> = ({ gauges, onClose, onAdd, onDelete }) => {
    const [newGauge, setNewGauge] = useState('');
    const [materialType, setMaterialType] = useState<MaterialType>('Fio Máquina');

    const handleAdd = () => {
        if (!newGauge) return;

        // Normalize gauge string (comma to dot)
        const normalized = newGauge.replace(',', '.');
        const numberVal = parseFloat(normalized);
        if (isNaN(numberVal)) {
            alert('Por favor, insira um número válido para a bitola.');
            return;
        }

        const formatted = numberVal.toFixed(2);

        // Check if already exists
        const exists = gauges.some(g => g.material_type === materialType && g.gauge === formatted);
        if (exists) {
            alert('Esta bitola já está cadastrada para este material.');
            return;
        }

        onAdd({
            material_type: materialType,
            gauge: formatted
        });
        setNewGauge('');
    };

    const gaugesByMaterial = MaterialOptions.reduce((acc, material) => {
        acc[material] = gauges.filter(g => g.material_type === material).sort((a, b) => parseFloat(a.gauge) - parseFloat(b.gauge));
        return acc;
    }, {} as Record<string, StockGauge[]>);

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 animate-fadeIn">
            <div className="max-w-4xl mx-auto space-y-6">
                <header className="flex items-center gap-4">
                    <button onClick={onClose} className="bg-white p-2 rounded-full shadow-sm hover:bg-slate-100 transition text-slate-700 border border-slate-200">
                        <ArrowLeftIcon className="h-6 w-6" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Gerenciar Bitolas</h1>
                        <p className="text-slate-500 text-sm">Adicione ou remova as bitolas disponíveis para cada material.</p>
                    </div>
                </header>

                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                    <div className="p-6 bg-slate-50 border-b border-slate-200">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <PlusIcon className="h-5 w-5 text-blue-600" />
                            Cadastrar Nova Bitola
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Material</label>
                                <select
                                    value={materialType}
                                    onChange={e => setMaterialType(e.target.value as MaterialType)}
                                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm bg-white"
                                >
                                    {MaterialOptions.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Bitola (mm)</label>
                                <input
                                    type="text"
                                    value={newGauge}
                                    onChange={e => setNewGauge(e.target.value)}
                                    placeholder="Ex: 5.00"
                                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                                    onKeyPress={e => e.key === 'Enter' && handleAdd()}
                                />
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={handleAdd}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition flex items-center justify-center gap-2"
                                >
                                    <PlusIcon className="h-5 w-5" /> Adicionar
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {MaterialOptions.map(material => (
                                <div key={material} className="space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <ScaleIcon className="h-4 w-4" />
                                            {material}
                                        </h3>
                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">
                                            {gaugesByMaterial[material].length} itens
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {gaugesByMaterial[material].map(g => (
                                            <div key={g.id} className="group flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-white transition-all">
                                                <span className="font-bold text-slate-700">{g.gauge} mm</span>
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`Deseja remover a bitola ${g.gauge} para ${material}?`)) {
                                                            onDelete(g.id);
                                                        }
                                                    }}
                                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}
                                        {gaugesByMaterial[material].length === 0 && (
                                            <div className="col-span-2 py-8 text-center text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-xl">
                                                Nenhuma bitola cadastrada.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3">
                    <div className="text-amber-500 mt-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="text-sm text-amber-800">
                        <p className="font-bold mb-1">Dica de Gestão</p>
                        <p>As bitolas cadastradas aqui aparecerão automaticamente em todos os seletores do sistema (Cadastro de Lotes, Ordens de Produção e Inventário).</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GaugesManager;
