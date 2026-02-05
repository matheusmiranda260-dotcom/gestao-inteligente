import React, { useState, useMemo } from 'react';
import type { StockItem, Page, TransferRecord, MaterialType, Bitola, StockGauge } from '../types';
import { MaterialOptions, FioMaquinaBitolaOptions, TrefilaBitolaOptions } from '../types';
import { ArrowLeftIcon, TruckIcon, CalculatorIcon, CheckCircleIcon, ExclamationIcon, ClipboardListIcon } from './icons';
import TransfersHistoryModal from './TransfersHistoryModal';
import TransferReport from './TransferReport';

interface StockTransferProps {
    stock: StockItem[];
    transfers: TransferRecord[];
    setPage: (page: Page) => void;
    createTransfer: (destinationSector: string, lotsToTransfer: Map<string, number>) => TransferRecord | null;
    gauges: StockGauge[];
}

const StockTransfer: React.FC<StockTransferProps> = ({ stock, transfers, setPage, createTransfer, gauges }) => {
    const [destinationSector, setDestinationSector] = useState('Coluna');

    interface TransferRequest {
        id: string;
        materialType: MaterialType | '';
        bitola: Bitola | '';
        targetWeight: number;
    }

    const [transferHistoryOpen, setTransferHistoryOpen] = useState(false);
    const [transferReportData, setTransferReportData] = useState<TransferRecord | null>(null);

    const [requests, setRequests] = useState<TransferRequest[]>([
        { id: Date.now().toString(), materialType: '', bitola: '', targetWeight: 0 }
    ]);

    // State for the suggestion results
    const [suggestedLots, setSuggestedLots] = useState<{ requestIndex: number; lot: StockItem; suggestQty: number; selected: boolean }[]>([]);
    const [isSuggestionCalculated, setIsSuggestionCalculated] = useState(false);

    const allBitolaOptions = useMemo(() => {
        const fmGaugesFromDB = gauges.filter(g => g.materialType === 'Fio Máquina').map(g => String(g.gauge));
        const caGaugesFromDB = gauges.filter(g => g.materialType === 'CA-60').map(g => String(g.gauge));

        const finalFM = [...new Set([...FioMaquinaBitolaOptions, ...fmGaugesFromDB])];
        const finalCA = [...new Set([...TrefilaBitolaOptions, ...caGaugesFromDB])];

        return [...new Set([...finalFM, ...finalCA])].sort((a, b) => parseFloat(a.replace(',', '.')) - parseFloat(b.replace(',', '.')));
    }, [gauges]);

    const [selectionMode, setSelectionMode] = useState<'full' | 'exact'>('full');
    const [recommendedMode, setRecommendedMode] = useState<'full' | 'exact' | null>(null);

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

    // Helper function to simulate lot selection based on a given mode
    const simulateSelection = (mode: 'full' | 'exact', currentRequests: TransferRequest[], currentStock: StockItem[]) => {
        let totalWeightAchieved = 0;
        const simUsage = new Map<string, number>(); // Track lot usage across requests for simulation

        currentRequests.forEach(req => {
            const candidates = currentStock.filter(item =>
                (item.status === 'Disponível' || item.status === 'Disponível - Suporte Treliça') &&
                item.materialType === req.materialType &&
                item.bitola === req.bitola
            );
            candidates.sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());

            let currentRequestAccumulated = 0;

            for (const lot of candidates) {
                const used = simUsage.get(lot.id) || 0;
                const available = lot.remainingQuantity - used;
                if (available <= 0.01) continue;

                const fullLotQty = available; // Always take full lot for simulation

                if (mode === 'full') {
                    // 'Para Cima' mode: Keep taking full lots until target is met or exceeded
                    // We take the lot if we still need some quantity, even if it exceeds the target
                    if (currentRequestAccumulated < req.targetWeight + 0.01) { // Check if we still need more or are just slightly over
                        currentRequestAccumulated += fullLotQty;
                        simUsage.set(lot.id, used + fullLotQty);
                    }
                } else { // mode === 'exact'
                    // 'Para Baixo' mode: Keep taking full lots ONLY if the total accumulated does not exceed the target
                    if (currentRequestAccumulated + fullLotQty <= req.targetWeight + 0.01) {
                        currentRequestAccumulated += fullLotQty;
                        simUsage.set(lot.id, used + fullLotQty);
                    } else {
                        // If adding this lot would exceed the target, stop for this request
                        break;
                    }
                }
            }
            totalWeightAchieved += currentRequestAccumulated;
        });
        return totalWeightAchieved;
    };

    // Helper function to generate the actual suggestedLots array based on a given mode
    const generateSuggestions = (mode: 'full' | 'exact') => {
        const suggestion: { requestIndex: number; lot: StockItem; suggestQty: number; selected: boolean }[] = [];
        const stockUsage = new Map<string, number>(); // Track actual lot usage for the displayed suggestion

        requests.forEach((req, index) => {
            const candidates = stock.filter(item =>
                (item.status === 'Disponível' || item.status === 'Disponível - Suporte Treliça') &&
                item.materialType === req.materialType &&
                item.bitola === req.bitola
            );
            candidates.sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());

            let currentRequestAccumulated = 0;

            for (const lot of candidates) {
                const alreadyUsed = stockUsage.get(lot.id) || 0;
                const availableInLot = lot.remainingQuantity - alreadyUsed;
                if (availableInLot <= 0.01) continue;

                let qtyToTake = 0;
                let selected = false;
                const fullLotQty = availableInLot; // Always consider taking the full lot

                if (mode === 'full') {
                    // 'Para Cima' logic: Take if we still need more (even if it exceeds)
                    if (currentRequestAccumulated < req.targetWeight + 0.01) {
                        qtyToTake = fullLotQty;
                        selected = true;
                        currentRequestAccumulated += qtyToTake;
                    }
                } else { // mode === 'exact'
                    // 'Para Baixo' logic: Take ONLY if it fits under target
                    if (currentRequestAccumulated + fullLotQty <= req.targetWeight + 0.01) {
                        qtyToTake = fullLotQty;
                        selected = true;
                        currentRequestAccumulated += qtyToTake;
                    }
                }

                // If not selected by the mode logic, it's still a candidate but with 0 qty and not selected
                if (!selected) {
                    qtyToTake = 0;
                }

                suggestion.push({
                    requestIndex: index,
                    lot,
                    suggestQty: qtyToTake,
                    selected: selected
                });

                if (selected) {
                    stockUsage.set(lot.id, alreadyUsed + fullLotQty);
                }
            }
        });
        setSuggestedLots(suggestion);
    };

    const calculateSuggestion = () => {
        // Validate
        for (const req of requests) {
            if (!req.materialType || !req.bitola || req.targetWeight <= 0) {
                alert("Por favor, preencha todos os campos de todos os materiais solicitados.");
                return;
            }
        }

        // --- Simulation Phase to determine recommended mode ---
        const sumTarget = requests.reduce((acc, r) => acc + r.targetWeight, 0);

        const sumAchievedFull = simulateSelection('full', requests, stock);
        const sumAchievedExact = simulateSelection('exact', requests, stock);

        const diffFull = Math.abs(sumAchievedFull - sumTarget);
        const diffExact = Math.abs(sumTarget - sumAchievedExact); // For 'exact', we care about being under or as close as possible without going over

        const bestMode = diffFull <= diffExact ? 'full' : 'exact';
        setRecommendedMode(bestMode);

        // Set the selection mode to the recommended one and generate suggestions
        setSelectionMode(bestMode);
        generateSuggestions(bestMode);
        setIsSuggestionCalculated(true);
    };

    const handleConfirmTransfer = () => {
        const lotsMap = new Map<string, number>();

        // Aggregate all selections
        suggestedLots.filter(s => s.selected).forEach(s => {
            // Use the displayed suggestQty (which user might have edited, or auto-calc)
            // If user manually selected a disabled row, suggestQty might be 0?
            // We should ensure if 'selected' is true, qty is valid.
            let finalQty = s.suggestQty;
            if (finalQty <= 0) {
                // Fallback: If selected but 0, take full available (or remaining of lot)
                finalQty = s.lot.remainingQuantity; // Simplification
            }

            const currentQty = lotsMap.get(s.lot.id) || 0;
            lotsMap.set(s.lot.id, currentQty + finalQty);
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

    const handleModeSwitch = (mode: 'full' | 'exact') => {
        setSelectionMode(mode);
        if (isSuggestionCalculated) {
            // If suggestions have already been calculated, re-apply the selection logic
            generateSuggestions(mode);
        }
    };

    // Calculate total weight to confirm matches across all requests
    const totalTargetWeight = requests.reduce((acc, req) => acc + req.targetWeight, 0);
    const totalSelectedWeight = suggestedLots.filter(s => s.selected).reduce((acc, s) => acc + (s.suggestQty > 0 ? s.suggestQty : s.lot.remainingQuantity), 0);

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 space-y-6">
            <div className="flex justify-between items-center mb-6 pt-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Transferência Inteligente</h1>
                        <p className="text-slate-500 text-sm">Transferência FIFO multi-material.</p>
                    </div>
                </div>
                <button
                    onClick={() => setTransferHistoryOpen(true)}
                    className="flex items-center gap-2 bg-white text-slate-700 font-semibold py-2 px-4 rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                    <ClipboardListIcon className="h-5 w-5 text-slate-500" />
                    Transferências Feitas
                </button>
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
                            <CalculatorIcon className="h-5 w-5" /> Parâmetros
                        </h2>

                        <div className="mb-6 bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Modo de Sugestão</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleModeSwitch('full')}
                                    className={`relative flex-1 py-3 px-2 text-xs font-bold rounded-md transition-all ${selectionMode === 'full' ? 'bg-[#0F3F5C] text-white shadow-md ring-2 ring-[#0F3F5C] ring-offset-1' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
                                >
                                    {recommendedMode === 'full' && (
                                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-amber-400 text-amber-900 text-[9px] px-2 py-0.5 rounded-full font-extrabold shadow-sm whitespace-nowrap z-10">
                                            MELHOR OPÇÃO
                                        </div>
                                    )}
                                    Para Cima
                                    <span className="block text-[9px] opacity-80 font-normal mt-0.5">Maior que Meta</span>
                                </button>
                                <button
                                    onClick={() => handleModeSwitch('exact')}
                                    className={`relative flex-1 py-3 px-2 text-xs font-bold rounded-md transition-all ${selectionMode === 'exact' ? 'bg-[#0F3F5C] text-white shadow-md ring-2 ring-[#0F3F5C] ring-offset-1' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
                                >
                                    {recommendedMode === 'exact' && (
                                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-amber-400 text-amber-900 text-[9px] px-2 py-0.5 rounded-full font-extrabold shadow-sm whitespace-nowrap z-10">
                                            MELHOR OPÇÃO
                                        </div>
                                    )}
                                    Para Baixo
                                    <span className="block text-[9px] opacity-80 font-normal mt-0.5">Menor que Meta</span>
                                </button>
                            </div>
                        </div>

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
                                                    {(() => {
                                                        const materialGaugesFromDB = gauges.filter(g => g.materialType === req.materialType).map(g => g.gauge);
                                                        const defaultOptions = req.materialType === 'Fio Máquina' ? FioMaquinaBitolaOptions : TrefilaBitolaOptions;
                                                        const combinedOptions = [...new Set([...defaultOptions, ...materialGaugesFromDB])].sort((a, b) => parseFloat(a.replace(',', '.')) - parseFloat(b.replace(',', '.')));
                                                        return combinedOptions.map(b => <option key={b} value={b}>{b}</option>);
                                                    })()}
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
                                                <tr key={`${item.lot.id}-${idx}`} className={`hover:bg-slate-50 ${item.selected ? 'bg-blue-50/20' : ''}`}>
                                                    <td className="p-3">
                                                        <div className="font-bold text-slate-700">{item.lot.materialType}</div>
                                                        <div className="text-xs text-slate-500">{item.lot.bitola}mm</div>
                                                    </td>
                                                    <td className="p-3 text-slate-500">{new Date(item.lot.entryDate).toLocaleDateString('pt-BR')}</td>
                                                    <td className="p-3 font-medium text-[#0F3F5C]">{item.lot.internalLot}</td>
                                                    <td className="p-3 text-right text-slate-400">{item.lot.remainingQuantity.toFixed(2)}</td>
                                                    <td className="p-3 text-right">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={item.suggestQty > 0 ? item.suggestQty : ''}
                                                            placeholder={item.selected && item.suggestQty === 0 ? item.lot.remainingQuantity.toFixed(2) : '0.00'}
                                                            disabled={!item.selected}
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value);
                                                                const newSuggestions = [...suggestedLots];
                                                                newSuggestions[idx].suggestQty = isNaN(val) ? 0 : val;
                                                                setSuggestedLots(newSuggestions);
                                                            }}
                                                            className={`w-24 p-1 text-right border rounded bg-white font-bold ${item.selected ? 'text-[#0F3F5C] border-blue-200' : 'text-slate-300 border-slate-100'}`}
                                                        />
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={item.selected}
                                                            onChange={e => {
                                                                const newSuggestions = [...suggestedLots];
                                                                newSuggestions[idx].selected = e.target.checked;
                                                                // If manually selected and 0, autofill full amount
                                                                if (e.target.checked && newSuggestions[idx].suggestQty === 0) {
                                                                    newSuggestions[idx].suggestQty = item.lot.remainingQuantity;
                                                                }
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
            {transferHistoryOpen && <TransfersHistoryModal transfers={transfers} onClose={() => setTransferHistoryOpen(false)} onShowReport={setTransferReportData} />}
            {transferReportData && <TransferReport reportData={transferReportData} onClose={() => setTransferReportData(null)} />}
        </div>
    );
};

export default StockTransfer;
