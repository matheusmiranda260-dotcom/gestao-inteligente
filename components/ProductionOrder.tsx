import React, { useState, useMemo, useEffect } from 'react';
import type { Page, StockItem, ProductionOrderData, Bitola, StockGauge, User } from '../types';
import { TrefilaBitolaOptions, FioMaquinaBitolaOptions } from '../types';
import { ArrowLeftIcon, WarningIcon, ClipboardListIcon, PencilIcon, TrashIcon, AdjustmentsIcon } from './icons';
import ProductionOrderHistoryModal from './ProductionOrderHistoryModal';
import ProductionOrderReport from './ProductionOrderReport';

interface ProductionOrderProps {
    setPage: (page: Page) => void;
    stock: StockItem[];
    productionOrders: ProductionOrderData[];
    addProductionOrder: (order: Omit<ProductionOrderData, 'id' | 'status' | 'creationDate'>) => void;
    showNotification: (message: string, type: 'success' | 'error') => void;
    updateProductionOrder: (orderId: string, data: { orderNumber?: string; targetBitola?: Bitola }) => void;
    deleteProductionOrder: (orderId: string) => void;
    gauges: StockGauge[];
    currentUser: User | null;
}

const ProductionOrder: React.FC<ProductionOrderProps> = ({ setPage, stock, productionOrders, addProductionOrder, showNotification, updateProductionOrder, deleteProductionOrder, gauges, currentUser }) => {
    const isGestor = currentUser?.role === 'admin' || currentUser?.role === 'gestor';
    const [orderNumber, setOrderNumber] = useState('');

    const initialTargetBitola = useMemo(() => {
        const trefilaGauges = gauges.filter(g => g.material_type === 'CA-60').map(g => g.gauge);
        return (trefilaGauges.length > 0 ? trefilaGauges[0] : TrefilaBitolaOptions[0]) as Bitola;
    }, [gauges]);

    const [targetBitola, setTargetBitola] = useState<Bitola>(initialTargetBitola);

    useEffect(() => {
        setTargetBitola(initialTargetBitola);
    }, [initialTargetBitola]);
    const [selectedLotIds, setSelectedLotIds] = useState<string[]>([]);
    const [inputBitolaFilter, setInputBitolaFilter] = useState<Bitola | ''>('');
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [productionReportData, setProductionReportData] = useState<ProductionOrderData | null>(null);

    const availableLots = useMemo(() => {
        return stock.filter(item =>
            item.materialType === 'Fio Máquina' &&
            item.status === 'Disponível' &&
            item.remainingQuantity > 0 &&
            (inputBitolaFilter === '' || item.bitola === inputBitolaFilter)
        )
            .sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());
    }, [stock, inputBitolaFilter]);

    const handleFilterChange = (value: Bitola | '') => {
        setInputBitolaFilter(value);
        setSelectedLotIds([]);
    };

    const handleSelectLot = (lotId: string, isChecked: boolean) => {
        const lotIndex = availableLots.findIndex(l => l.id === lotId);
        if (lotIndex === -1) return;

        if (isChecked) {
            // Enforce ascending order: Select this lot and all previous (older) lots
            const lotsToSelect = availableLots.slice(0, lotIndex + 1).map(l => l.id);
            setSelectedLotIds(lotsToSelect);
        } else {
            // Enforce ascending order: Deselect this lot and all subsequent (newer) lots
            // This effectively keeps only the lots OLDER than the current one
            const lotsToKeep = availableLots.slice(0, lotIndex).map(l => l.id);
            setSelectedLotIds(lotsToKeep);
        }
    };

    const totalSelectedWeight = useMemo(() => {
        return selectedLotIds.reduce((total, lotId) => {
            const lot = stock.find(l => l.id === lotId);
            return total + (lot ? lot.remainingQuantity : 0);
        }, 0);
    }, [selectedLotIds, stock]);

    const clearSelection = () => {
        setSelectedLotIds([]);
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!orderNumber.trim()) {
            showNotification('O número da ordem de produção é obrigatório.', 'error');
            return;
        }
        if (productionOrders.some(o => o.orderNumber.trim().toLowerCase() === orderNumber.trim().toLowerCase())) {
            showNotification(`O número de ordem "${orderNumber}" já existe.`, 'error');
            return;
        }
        if (selectedLotIds.length === 0) {
            showNotification('Selecione pelo menos um lote para a produção.', 'error');
            return;
        }

        addProductionOrder({
            orderNumber,
            machine: 'Trefila',
            targetBitola,
            selectedLotIds: selectedLotIds,
            totalWeight: totalSelectedWeight
        });

        // Reset form
        setOrderNumber('');
        setTargetBitola(TrefilaBitolaOptions[0]);
        setSelectedLotIds([]);
        setInputBitolaFilter('');
    };

    return (
        <div className="p-4 sm:p-6 md:p-8">
            {showHistoryModal && <ProductionOrderHistoryModal
                orders={productionOrders}
                stock={stock}
                onClose={() => setShowHistoryModal(false)}
                updateProductionOrder={updateProductionOrder}
                deleteProductionOrder={deleteProductionOrder}
                onShowReport={(order) => {
                    setProductionReportData(order);
                    setShowHistoryModal(false);
                }}
            />}
            {productionReportData && (
                <ProductionOrderReport
                    reportData={productionReportData}
                    stock={stock}
                    onClose={() => setProductionReportData(null)}
                />
            )}

            <header className="flex items-center justify-between mb-6 pt-4">
                <div className="flex items-center">
                    <h1 className="text-3xl font-bold text-slate-800">Ordem de Produção - Trefila</h1>
                </div>
                <div className="flex items-center gap-3">
                    {isGestor && (
                        <button
                            type="button"
                            onClick={() => setPage('gaugesManager')}
                            className="bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold py-2 px-4 rounded-lg border border-blue-200 shadow-sm transition flex items-center gap-2"
                        >
                            <AdjustmentsIcon className="h-5 w-5" />Gerenciar Bitolas
                        </button>
                    )}
                    <button
                        onClick={() => setShowHistoryModal(true)}
                        className="bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 rounded-lg border border-slate-300 transition flex items-center gap-2"
                    >
                        <ClipboardListIcon className="h-5 w-5" />
                        <span>Ver Ordens Criadas</span>
                    </button>
                </div>
            </header>

            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Form and Summary */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm">
                            <h2 className="text-xl font-semibold text-slate-700 mb-4">Dados da Ordem</h2>
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="orderNumber" className="block text-sm font-medium text-slate-700">Número da Ordem</label>
                                    <input
                                        type="text"
                                        id="orderNumber"
                                        value={orderNumber}
                                        onChange={(e) => setOrderNumber(e.target.value)}
                                        className="mt-1 p-2 w-full border border-slate-300 rounded-md"
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="inputBitolaFilter" className="block text-sm font-medium text-slate-700">Bitola de Entrada (Fio Máquina)</label>
                                    <select
                                        id="inputBitolaFilter"
                                        value={inputBitolaFilter}
                                        onChange={(e) => handleFilterChange(e.target.value as Bitola | '')}
                                        className="mt-1 p-2 w-full border border-slate-300 rounded-md bg-white"
                                    >
                                        <option value="">Selecione a bitola de entrada</option>
                                        {(() => {
                                            const materialGaugesFromDB = gauges.filter(g => g.material_type === 'Fio Máquina').map(g => g.gauge);
                                            const combinedOptions = [...new Set([...FioMaquinaBitolaOptions, ...materialGaugesFromDB])].sort((a, b) => parseFloat(a.replace(',', '.')) - parseFloat(b.replace(',', '.')));
                                            return combinedOptions.map(b => <option key={b} value={b}>{b}</option>);
                                        })()}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="targetBitola" className="block text-sm font-medium text-slate-700">Bitola a Produzir</label>
                                    <select
                                        id="targetBitola"
                                        value={targetBitola}
                                        onChange={(e) => setTargetBitola(e.target.value as Bitola)}
                                        className="mt-1 p-2 w-full border border-slate-300 rounded-md bg-white"
                                    >
                                        {(() => {
                                            const materialGaugesFromDB = gauges.filter(g => g.material_type === 'CA-60').map(g => g.gauge);
                                            const combinedOptions = [...new Set([...TrefilaBitolaOptions, ...materialGaugesFromDB])].sort((a, b) => parseFloat(a.replace(',', '.')) - parseFloat(b.replace(',', '.')));

                                            return combinedOptions
                                                .filter(b => {
                                                    if (inputBitolaFilter === '') return true;
                                                    const inputBitolaNum = parseFloat(inputBitolaFilter.replace(',', '.'));
                                                    const targetBitolaNum = parseFloat(b.replace(',', '.'));
                                                    return targetBitolaNum < inputBitolaNum;
                                                })
                                                .map(b => <option key={b} value={b}>{b}</option>);
                                        })()}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm">
                            <h2 className="text-xl font-semibold text-slate-700 mb-2">Resumo da Seleção</h2>
                            <div className="space-y-2 text-slate-600">
                                <div className="flex justify-between">
                                    <span>Lotes Selecionados:</span>
                                    <span className="font-bold">{selectedLotIds.length}</span>
                                </div>
                                <div className="flex justify-between items-baseline border-t pt-2">
                                    <span className="text-lg">Peso Total dos Lotes:</span>
                                    <span className="text-2xl font-bold text-slate-800">{totalSelectedWeight.toFixed(2)} kg</span>
                                </div>
                            </div>
                            <div className="mt-6 flex flex-col gap-3">
                                <button type="submit" className="w-full bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-bold py-3 px-4 rounded-lg transition">
                                    Criar Ordem
                                </button>
                                <button type="button" onClick={clearSelection} className="w-full bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition">
                                    Limpar Seleção
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Available Lots Table */}
                    <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm">
                        <h2 className="text-xl font-semibold text-slate-700 mb-4">Lotes Disponíveis para Consumo</h2>
                        <div className="overflow-auto max-h-[60vh]">
                            <table className="w-full text-sm text-left text-slate-500">
                                <thead className="text-xs text-slate-700 uppercase bg-slate-50 sticky top-0">
                                    <tr>
                                        <th scope="col" className="px-4 py-3 w-12"></th>
                                        <th scope="col" className="px-4 py-3">Lote Interno</th>
                                        <th scope="col" className="px-4 py-3">Fornecedor</th>
                                        <th scope="col" className="px-4 py-3">Tipo de Material</th>
                                        <th scope="col" className="px-4 py-3">Bitola</th>
                                        <th scope="col" className="px-4 py-3 text-right">Peso Etiqueta (kg)</th>
                                        <th scope="col" className="px-4 py-3 text-right">Restante (kg)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {availableLots.map(lot => (
                                        <tr key={lot.id} className="bg-white border-b hover:bg-slate-50 active:bg-slate-100 transition-colors" onClick={(e) => {
                                            if ((e.target as HTMLElement).tagName !== 'INPUT') {
                                                handleSelectLot(lot.id, !selectedLotIds.includes(lot.id));
                                            }
                                        }}>
                                            <td className="px-4 py-4 sm:py-2 text-center w-12 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedLotIds.includes(lot.id)}
                                                    onChange={(e) => handleSelectLot(lot.id, e.target.checked)}
                                                    className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 pointer-events-none"
                                                />
                                            </td>
                                            <td className="px-4 py-4 sm:py-2 font-medium text-slate-900 text-sm sm:text-xs md:text-sm">{lot.internalLot}</td>
                                            <td className="px-4 py-4 sm:py-2 text-sm sm:text-xs md:text-sm hidden sm:table-cell">{lot.supplier}</td>
                                            <td className="px-4 py-4 sm:py-2 text-sm sm:text-xs md:text-sm hidden sm:table-cell">{lot.materialType}</td>
                                            <td className="px-4 py-4 sm:py-2 font-bold text-slate-700 text-sm sm:text-xs md:text-sm">{lot.bitola}</td>
                                            <td className="px-4 py-4 sm:py-2 text-right text-slate-500 hidden md:table-cell">{lot.labelWeight.toFixed(2)}</td>
                                            <td className="px-4 py-4 sm:py-2 text-right font-bold text-blue-600 text-base sm:text-sm">{lot.remainingQuantity.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {availableLots.length === 0 && (
                                <div className="text-center text-slate-500 py-10">
                                    <WarningIcon className="h-12 w-12 mx-auto text-amber-400 mb-2" />
                                    <p>Nenhum lote com estoque disponível encontrado.</p>
                                    {inputBitolaFilter ? <p className="text-sm">Tente selecionar outra bitola de entrada ou adicione mais lotes no estoque.</p> : <p className="text-sm">Certifique-se que os lotes não estão em outra ordem de produção.</p>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default ProductionOrder;