import React, { useState, useMemo } from 'react';
import type { StockItem, Page, TransferRecord, MaterialType, Bitola } from '../types';
import { MaterialOptions, FioMaquinaBitolaOptions, TrefilaBitolaOptions } from '../types';
import { ArrowLeftIcon, TruckIcon, CalculatorIcon, CheckCircleIcon, ExclamationIcon } from './icons';

interface StockTransferProps {
    stock: StockItem[];
    setPage: (page: Page) => void;
    createTransfer: (destinationSector: string, lotsToTransfer: Map<string, number>) => TransferRecord | null;
}

const StockTransfer: React.FC<StockTransferProps> = ({ stock, setPage, createTransfer }) => {
    const [destinationSector, setDestinationSector] = useState('Coluna');

    interface TransferRequest {
        id: string;
        materialType: MaterialType | '';
        bitola: Bitola | '';
        targetWeight: number;
    }

    const [requests, setRequests] = useState<TransferRequest[]>([
        { id: Date.now().toString(), materialType: '', bitola: '', targetWeight: 0 }
    ]);

    // State for the suggestion results
    const [suggestedLots, setSuggestedLots] = useState<{ requestIndex: number; lot: StockItem; suggestQty: number; selected: boolean }[]>([]);
    const [isSuggestionCalculated, setIsSuggestionCalculated] = useState(false);

    const allBitolaOptions = useMemo(() => [...new Set([...FioMaquinaBitolaOptions, ...TrefilaBitolaOptions])].sort(), []);

    const addRequest = () => {
        setRequests([...requests, { id: Date.now().toString(), materialType: '', bitola: '', targetWeight: 0 }]);
    };

    const removeRequest = (index: number) => {
        if (requests.length === 1) return;
        setRequests(requests.filter((_, i) => i !== index));
    };

    const updateRequest = (index: number, field: keyof TransferRequest, value: any) => {
        const newRequests = [...requests];
        (newRequests[index] as any)[field] = value;
        setRequests(newRequests);
    };

    const calculateSuggestion = () => {
        // Validate
        for (const req of requests) {
            if (!req.materialType || !req.bitola || req.targetWeight <= 0) {
                alert("Por favor, preencha todos os campos de todos os materiais solicitados.");
                return;
            }
        }

        const suggestion: { requestIndex: number; lot: StockItem; suggestQty: number; selected: boolean }[] = [];
        const stockUsage = new Map<string, number>(); // track consumption of lotId -> amount used

        requests.forEach((req, index) => {
            // 1. Filter available candidates matching this request
            const candidates = stock.filter(item =>
                (item.status === 'Disponível' || item.status === 'Disponível - Suporte Treliça') &&
                item.materialType === req.materialType &&
                item.bitola === req.bitola
            );

            // 2. Sort by Entry Date (FIFO) - Oldest first
            candidates.sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());

            let remainingNeeded = req.targetWeight;

            for (const lot of candidates) {
                if (remainingNeeded <= 0) break;

                const alreadyUsed = stockUsage.get(lot.id) || 0;
                const availableInLot = lot.remainingQuantity - alreadyUsed;

                if (availableInLot <= 0.01) continue; // Skip if empty or fully used

                const qtyToTake = Math.min(availableInLot, remainingNeeded);

                suggestion.push({
                    requestIndex: index,
                    lot,
                    suggestQty: qtyToTake,
                    selected: true
                });

                // Update usage tracking
                stockUsage.set(lot.id, alreadyUsed + qtyToTake);
                remainingNeeded -= qtyToTake;
            }
        });

        setSuggestedLots(suggestion);
        setIsSuggestionCalculated(true);
    };

    const handleConfirmTransfer = () => {
        const lotsMap = new Map<string, number>();

        // Aggregate all selections per lot (in case multiple requests use the same lot, though FIFO logic usually splits cleanly, but aggregation is safer)
        suggestedLots.filter(s => s.selected).forEach(s => {
            const currentQty = lotsMap.get(s.lot.id) || 0;
            lotsMap.set(s.lot.id, currentQty + s.suggestQty);
        });

        if (lotsMap.size === 0) {
            alert("Nenhum lote selecionado para transferência.");
            return;
        }

        const result = createTransfer(destinationSector, lotsMap);
        if (result) {
            setSuggestedLots([]);
            setIsSuggestionCalculated(false);
            setRequests([{ id: Date.now().toString(), materialType: '', bitola: '', targetWeight: 0 }]); // Reset form
        }
    };

    // Calculate total weight to confirm matches across all requests
    const totalTargetWeight = requests.reduce((acc, req) => acc + req.targetWeight, 0);
    const totalSelectedWeight = suggestedLots.filter(s => s.selected).reduce((acc, s) => acc + s.suggestQty, 0);

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => setPage('menu')} className="bg-white p-2 rounded-full shadow-sm hover:bg-slate-100 transition text-slate-700">
                    <ArrowLeftIcon className="h-6 w-6" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Transferência Inteligente</h1>
                    <p className="text-slate-500 text-sm">Transferência FIFO multi-material.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Configuration Panel */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h2 className="text-lg font-bold text-[#0F3F5C] mb-4 flex items-center gap-2">
                            <TruckIcon className="h-5 w-5" /> Origem & Destino
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1">Setor de Destino</label>
                                <select
                                    value={destinationSector}
                                    onChange={e => setDestinationSector(e.target.value)}
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F3F5C] outline-none bg-slate-50"
                                >
                                    <option value="Coluna">Coluna</option>
                                    <option value="CA50">CA50</option>
                                    <option value="Mediterranea">Mediterranea</option>
                                    <option value="Outros">Outros</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h2 className="text-lg font-bold text-[#0F3F5C] mb-4 flex items-center gap-2">
                            <CalculatorIcon className="h-5 w-5" /> Lista de Materiais
                        </h2>

                        <div className="space-y-6">
                            {requests.map((req, index) => (
                                <div key={req.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200 relative animate-fadeIn">
                                    <div className="absolute top-2 right-2">
                                        <button
                                            onClick={() => removeRequest(index)}
                                            className="text-slate-400 hover:text-red-500 disabled:opacity-50"
                                            disabled={requests.length === 1}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Item #{index + 1}</p>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">Material</label>
                                            <select
                                                value={req.materialType}
                                                onChange={e => updateRequest(index, 'materialType', e.target.value)}
                                                className="w-full p-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#0F3F5C] outline-none bg-white text-sm"
                                            >
                                                <option value="">Selecione...</option>
                                                {MaterialOptions.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-600 mb-1">Bitola</label>
                                                <select
                                                    value={req.bitola}
                                                    onChange={e => updateRequest(index, 'bitola', e.target.value)}
                                                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#0F3F5C] outline-none bg-white text-sm"
                                                    disabled={!req.materialType}
                                                >
                                                    <option value="">Bitola...</option>
                                                    {allBitolaOptions.map(b => <option key={b} value={b}>{b}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-600 mb-1">Qtd (kg)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={req.targetWeight || ''}
                                                    onChange={e => updateRequest(index, 'targetWeight', parseFloat(e.target.value))}
                                                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#0F3F5C] outline-none text-sm font-bold text-[#0F3F5C]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <button
                                onClick={addRequest}
                                className="w-full py-2 border-2 border-dashed border-slate-300 text-slate-500 font-semibold rounded-lg hover:border-[#0F3F5C] hover:text-[#0F3F5C] transition-colors flex items-center justify-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                                Adicionar Outro Material
                            </button>

                            <button
                                onClick={calculateSuggestion}
                                className="w-full mt-4 bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-bold py-3 px-4 rounded-lg shadow-md transition-all flex justify-center items-center gap-2"
                            >
                                <CalculatorIcon className="h-5 w-5" />
                                Buscar Sugestão FIFO
                            </button>
                        </div>
                    </div>
                </div>

                {/* Results Panel */}
                <div className="lg:col-span-2">
                    {isSuggestionCalculated ? (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
                            <h2 className="text-xl font-bold text-[#0F3F5C] mb-4 flex justify-between items-center">
                                <span>Lotes Sugeridos (FIFO)</span>
                                <span className={`text-sm px-3 py-1 rounded-full ${totalSelectedWeight >= totalTargetWeight * 0.99 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                    Total: {totalSelectedWeight.toFixed(2)} / {totalTargetWeight.toFixed(2)} kg
                                </span>
                            </h2>

                            {suggestedLots.length > 0 ? (
                                <div className="flex-grow overflow-y-auto mb-6">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0">
                                            <tr>
                                                <th className="p-3">Material</th>
                                                <th className="p-3">Data Entr.</th>
                                                <th className="p-3">Lote Interno</th>
                                                <th className="p-3 text-right">Saldo (kg)</th>
                                                <th className="p-3 text-right">Transferir (kg)</th>
                                                <th className="p-3 text-center">Incluir</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {suggestedLots.map((item, idx) => (
                                                <tr key={`${item.lot.id}-${idx}`} className="hover:bg-slate-50">
                                                    <td className="p-3">
                                                        <div className="font-bold text-slate-700">{item.lot.materialType}</div>
                                                        <div className="text-xs text-slate-500">{item.lot.bitola}mm</div>
                                                    </td>
                                                    <td className="p-3 text-slate-500">{new Date(item.lot.entryDate).toLocaleDateString('pt-BR')}</td>
                                                    <td className="p-3 font-medium text-[#0F3F5C]">{item.lot.internalLot}</td>
                                                    <td className="p-3 text-right text-slate-400">{item.lot.remainingQuantity.toFixed(2)}</td>
                                                    <td className="p-3 text-right font-bold text-[#0F3F5C] bg-blue-50/50 rounded-lg">
                                                        {item.suggestQty.toFixed(2)}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={item.selected}
                                                            onChange={e => {
                                                                const newSuggestions = [...suggestedLots];
                                                                newSuggestions[idx].selected = e.target.checked;
                                                                setSuggestedLots(newSuggestions);
                                                            }}
                                                            className="h-5 w-5 text-[#0F3F5C] rounded focus:ring-[#0F3F5C]"
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="flex-grow flex flex-col items-center justify-center text-slate-400 py-10">
                                    <ExclamationIcon className="h-12 w-12 mb-2 opacity-50" />
                                    <p>Nenhum lote compatível encontrado para os critérios.</p>
                                </div>
                            )}

                            <div className="pt-4 border-t border-slate-100 flex justify-end">
                                <button
                                    onClick={handleConfirmTransfer}
                                    disabled={suggestedLots.length === 0 || totalSelectedWeight === 0}
                                    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all flex items-center gap-2"
                                >
                                    <CheckCircleIcon className="h-5 w-5" />
                                    Confirmar Transferência em Lote
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-100/50 border-2 border-dashed border-slate-200 rounded-xl h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                            <TruckIcon className="h-16 w-16 mb-4 opacity-30" />
                            <h3 className="text-lg font-semibold text-slate-500">Aguardando Configuração</h3>
                            <p className="max-w-xs mt-2">Adicione os materiais desejados à esquerda e clique em "Buscar Sugestão".</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StockTransfer;
