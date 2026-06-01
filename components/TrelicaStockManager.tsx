import React, { useState, useMemo } from 'react';
import type { Page, FinishedProductItem, User, FinishedGoodsTransferRecord, StockMovement, ProductionOrderData, StockItem } from '../types';
import { ArchiveIcon, SwitchHorizontalIcon, ClockIcon, CalculatorIcon, PlusIcon, PlayIcon, PauseIcon, CheckCircleIcon, ArrowLeftIcon } from './icons';
import { trelicaModels } from './ProductionOrderTrelica';

const formatPiecesAndPacksShort = (pieces: number): string => {
    const packs = Math.floor(pieces / 200);
    const rem = pieces % 200;
    if (packs === 0) return `${pieces} pçs`;
    if (rem === 0) return `${pieces} pçs (${packs} ${packs === 1 ? 'pacote' : 'pacotes'})`;
    return `${pieces} pçs (${packs} ${packs === 1 ? 'pacote' : 'pacotes'} + ${rem} pçs)`;
};

const parseObservationSector = (obsText: string) => {
    const match = obsText.match(/^\[Setor:\s*([^\]]+)\]\s*(.*)$/);
    if (match) {
        return {
            sector: match[1],
            cleanObs: match[2]
        };
    }
    return { sector: null, cleanObs: obsText };
};

interface TrelicaStockManagerProps {
    finishedGoods: FinishedProductItem[];
    setPage: (page: Page) => void;
    createFinishedGoodsTransfer: (data: { destinationSector: string; otherDestination?: string; items: Map<string, number> }) => FinishedGoodsTransferRecord | null;
    onDelete?: (ids: string[]) => void;
    onUpdateQuantity: (id: string, updates: Partial<FinishedProductItem>, movement?: StockMovement) => void;
    onAddManual: (item: Omit<FinishedProductItem, 'id' | 'status' | 'productionDate'>) => void;
    currentUser: User | null;
    productionOrders: ProductionOrderData[];
    stock: StockItem[];
    users?: User[];
    onResetStock?: (operatorName: string) => Promise<void>;
}

const TrelicaStockManager: React.FC<TrelicaStockManagerProps> = ({ 
    finishedGoods, 
    setPage, 
    onUpdateQuantity,
    onAddManual,
    currentUser,
    productionOrders = [],
    stock = [],
    users = [],
    onResetStock
}) => {
    const [activeTab, setActiveTab] = useState<'floor' | 'production' | 'ca60' | 'history'>('floor');
    const [movingItem, setMovingItem] = useState<{ model: string; size: string; type: 'transfer' | 'audit' | 'virtual_audit' | 'add_virtual' | 'dispatch' | 'view_history' } | null>(null);
    const [movementQty, setMovementQty] = useState(0);
    const [obs, setObs] = useState('');

    // Novos estados para criação de estoque manual e conferência
    const [opNumber, setOpNumber] = useState('');
    const [opStartTime, setOpStartTime] = useState('');
    const [opEndTime, setOpEndTime] = useState('');
    const [managerPassword, setManagerPassword] = useState('');
    const [pwdError, setPwdError] = useState('');
    const [destSector, setDestSector] = useState('CAA60');
    const [otherDestSector, setOtherDestSector] = useState('');
    const [historySearch, setHistorySearch] = useState('');
    const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | 'addition' | 'transfer' | 'out' | 'adjustment'>('all');
    const [historyModelFilter, setHistoryModelFilter] = useState('all');

    // Estados para Zerar Estoque
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [resetManagerPassword, setResetManagerPassword] = useState('');
    const [resetPwdError, setResetPwdError] = useState('');

    const [selectedConferModel, setSelectedConferModel] = useState<{ model: string; size: string; list: FinishedProductItem[] } | null>(null);
    const [conferringItem, setConferringItem] = useState<FinishedProductItem | null>(null);
    const [conferQty, setConferQty] = useState(0);
    const [conferJustification, setConferJustification] = useState('');

    // Filtros rápidos
    const [filterModel, setFilterModel] = useState<string>('all');
    const [filterPendingWithdrawal, setFilterPendingWithdrawal] = useState<boolean>(false);

    // --- CÁLCULO DE RESUMO GERAL DAS TRELIÇAS ---
    const overallStats = useMemo(() => {
        let totalVirtual = 0;
        let totalPhysical = 0;
        let totalPending = 0;
        let totalWeight = 0;
        
        finishedGoods.filter(i => i.productType === 'Treliça').forEach(item => {
            totalVirtual += item.quantity;
            totalPhysical += (item.physicalQuantity || 0);
            totalPending += (item.pendingTransferQuantity || 0);
            totalWeight += item.totalWeight;
        });

        return {
            totalVirtual,
            totalPhysical,
            totalPending,
            totalWeight,
            totalDiff: totalPhysical - totalVirtual - totalPending
        };
    }, [finishedGoods]);

    // --- LISTAGEM DE MODELOS (ESTOQUE CHÃO) ---
    const modelsSummary = useMemo(() => {
        return trelicaModels.map(m => {
            let virtualQty = 0;
            let physicalQty = 0;
            let pendingTransferQty = 0;
            let totalWeight = 0;
            let id = '';
            
            const relevantItems = finishedGoods.filter(
                i => i.productType === 'Treliça' && 
                i.model === m.modelo && 
                i.size.trim() === m.tamanho.trim()
            );

            const unconferredList = relevantItems.filter(i => i.isConferred === false);

            if (relevantItems.length > 0) {
                // Ordenar para garantir que o id pertença a um lote conferido (se houver algum)
                const sortedRelevant = [...relevantItems].sort((a, b) => {
                    const aConf = a.isConferred !== false ? 1 : 0;
                    const bConf = b.isConferred !== false ? 1 : 0;
                    return bConf - aConf;
                });
                id = sortedRelevant[0].id;
                relevantItems.forEach(item => {
                    virtualQty += item.quantity;
                    physicalQty += (item.physicalQuantity || 0);
                    pendingTransferQty += (item.pendingTransferQuantity || 0);
                    totalWeight += item.totalWeight;
                });
            }

            const availablePhysForTransf = relevantItems.reduce((acc, item) => {
                if (item.isConferred === false) return acc;
                return acc + ((item.physicalQuantity || 0) - (item.pendingTransferQuantity || 0));
            }, 0);

            return {
                id,
                model: m.modelo,
                size: m.tamanho,
                virtualQty,
                physicalQty,
                pendingTransferQty,
                totalWeight,
                diff: physicalQty - virtualQty - pendingTransferQty,
                theoreticalWeightPerPiece: parseFloat(m.pesoFinal.replace(',', '.')),
                unconferredList,
                hasUnconferred: unconferredList.length > 0,
                unconferredQty: unconferredList.reduce((acc, curr) => acc + curr.quantity, 0),
                availablePhysForTransf
            };
        });
    }, [finishedGoods]);

    const uniqueModels = useMemo(() => {
        const set = new Set<string>();
        trelicaModels.forEach(m => set.add(m.modelo));
        return Array.from(set).sort();
    }, []);

    const filteredModels = useMemo(() => {
        let result = modelsSummary;
        if (filterModel !== 'all') {
            result = result.filter(m => m.model === filterModel);
        }
        if (filterPendingWithdrawal) {
            result = result.filter(m => m.pendingTransferQty > 0);
        }
        return result;
    }, [modelsSummary, filterModel, filterPendingWithdrawal]);

    // --- FILTRAGEM DE ORDENS EM PRODUÇÃO (TRELIÇA) ---
    const trelicaOrders = useMemo(() => {
        return productionOrders.filter(
            o => o.machine && (o.machine.startsWith('Treliça') || o.machine === 'Treliça')
        );
    }, [productionOrders]);

    const activeOrders = useMemo(() => {
        return trelicaOrders.filter(
            o => o.status === 'in_progress' || o.status === 'Ativa' || o.status === 'active'
        );
    }, [trelicaOrders]);

    const pendingOrders = useMemo(() => {
        return trelicaOrders.filter(
            o => o.status === 'pending' || o.status === 'paused' || o.status === 'Inativa'
        );
    }, [trelicaOrders]);

    // --- FILTRAGEM DO ESTOQUE DE CA-60 ---
    const ca60Stock = useMemo(() => {
        return stock.filter(
            item => item.materialType === 'CA-60' && 
            item.status === 'Disponível' && 
            item.remainingQuantity > 0
        ).sort((a, b) => a.internalLot.localeCompare(b.internalLot, undefined, { numeric: true }));
    }, [stock]);

    const totalCa60Weight = useMemo(() => {
        return ca60Stock.reduce((acc, item) => acc + (item.remainingQuantity || 0), 0);
    }, [ca60Stock]);

    // --- HISTÓRICO GERAL DE MOVIMENTAÇÕES ---
    const globalHistory = useMemo(() => {
        let list: { model: string; size: string; movement: StockMovement }[] = [];
        finishedGoods.filter(i => i.productType === 'Treliça').forEach(item => {
            if (item.movementHistory) {
                item.movementHistory.forEach(m => {
                    list.push({
                        model: item.model,
                        size: item.size,
                        movement: m
                    });
                });
            }
        });
        
        let filtered = list;
        
        if (historyTypeFilter !== 'all') {
            filtered = filtered.filter(item => item.movement.type === historyTypeFilter);
        }
        
        if (historyModelFilter !== 'all') {
            filtered = filtered.filter(item => `${item.model} (${item.size.trim()}m)` === historyModelFilter);
        }
        
        if (historySearch.trim() !== '') {
            const query = historySearch.toLowerCase();
            filtered = filtered.filter(item => 
                item.model.toLowerCase().includes(query) ||
                item.size.toLowerCase().includes(query) ||
                (item.movement.observations || '').toLowerCase().includes(query) ||
                (item.movement.operator || '').toLowerCase().includes(query)
            );
        }
        
        return filtered.sort((a, b) => new Date(b.movement.date).getTime() - new Date(a.movement.date).getTime());
    }, [finishedGoods, historySearch, historyTypeFilter, historyModelFilter]);

    // --- HANDLER PARA EXECUÇÃO DE AJUSTES/TRANSFERÊNCIAS ---
    const handleAction = () => {
        if (!movingItem) return;

        const relevantItems = finishedGoods.filter(
            i => i.model === movingItem.model && i.size.trim() === movingItem.size.trim()
        ).sort((a, b) => {
            const aConf = a.isConferred !== false ? 1 : 0;
            const bConf = b.isConferred !== false ? 1 : 0;
            return bConf - aConf;
        });
        let targetId = relevantItems[0]?.id;

        // Validação de segurança de senha de gestor e OP para adicionar estoque virtual
        if (movingItem.type === 'add_virtual') {
            const manager = users?.find(u => (u.role === 'gestor' || u.role === 'admin') && u.password === managerPassword);
            if (!manager) {
                setPwdError('Senha do gestor incorreta ou inválida.');
                return;
            }
            if (!opNumber.trim()) {
                alert('O número da ordem de produção é obrigatório.');
                return;
            }
            if (!opStartTime || !opEndTime) {
                alert('As datas de início e término são obrigatórias.');
                return;
            }
            
            const modelConfig = trelicaModels.find(m => m.modelo === movingItem.model && m.tamanho.trim() === movingItem.size.trim());
            const weightPerPiece = modelConfig ? parseFloat(modelConfig.pesoFinal.replace(',', '.')) : 1.0;

            onAddManual({
                productType: 'Treliça',
                model: movingItem.model,
                size: movingItem.size,
                quantity: movementQty,
                physicalQuantity: movementQty, // Espelhado imediatamente
                totalWeight: weightPerPiece * movementQty,
                orderNumber: opNumber,
                productionOrderId: 'MANUAL',
                opStartTime: new Date(opStartTime).toISOString(),
                opEndTime: new Date(opEndTime).toISOString(),
                isConferred: false,
                conferralJustification: ''
            });

            setMovingItem(null);
            setMovementQty(0);
            setObs('');
            setOpNumber('');
            setOpStartTime('');
            setOpEndTime('');
            setManagerPassword('');
            setPwdError('');
            return;
        }

        // Validação na retirada
        if (movingItem.type === 'dispatch') {
            const currentItem = relevantItems[0];
            if (currentItem) {
                const pendingQty = currentItem.pendingTransferQuantity || 0;
                const physicalQty = currentItem.physicalQuantity || 0;
                if (movementQty > pendingQty) {
                    alert(`Não é possível retirar mais do que o saldo aguardando retirada (${pendingQty} pçs).`);
                    return;
                }
                if (movementQty > physicalQty) {
                    alert(`Não é possível retirar mais do que o saldo físico em pátio (${physicalQty} pçs).`);
                    return;
                }
            }
        }

        // Validação na transferência
        if (movingItem.type === 'transfer') {
            const currentItem = relevantItems[0];
            if (!currentItem || currentItem.isConferred === false) {
                alert('Erro: Nenhum lote conferido encontrado para transferência.');
                return;
            }
            const availablePhys = (currentItem.physicalQuantity || 0) - (currentItem.pendingTransferQuantity || 0);
            if (movementQty <= 0) {
                alert('A quantidade a transferir deve ser maior que zero.');
                return;
            }
            if (movementQty > availablePhys) {
                alert(`Erro: Quantidade a transferir (${movementQty} pçs) excede o saldo físico disponível (${availablePhys} pçs).`);
                return;
            }
        }

        if (!targetId) {
            onAddManual({
                productType: 'Treliça',
                model: movingItem.model,
                size: movingItem.size,
                quantity: movingItem.type === 'virtual_audit' ? movementQty : 0,
                physicalQuantity: movingItem.type === 'audit' ? movementQty : 0,
                totalWeight: 0,
                orderNumber: 'INVENTARIO',
                productionOrderId: 'MANUAL'
            });
            setMovingItem(null);
            return;
        }

        const currentItem = relevantItems[0];
        const finalSector = (movingItem.type === 'transfer' || movingItem.type === 'dispatch')
            ? (destSector === 'Outros' ? otherDestSector.trim() : destSector)
            : '';

        if ((movingItem.type === 'transfer' || movingItem.type === 'dispatch') && !finalSector) {
            alert('O setor de destino é obrigatório.');
            return;
        }

        const sectorPrefix = (movingItem.type === 'transfer' || movingItem.type === 'dispatch') ? `[Setor: ${finalSector}] ` : '';
        const defaultObs = movingItem.type === 'audit' 
            ? 'Ajuste de estoque físico' 
            : movingItem.type === 'add_virtual' 
                ? 'Entrada de estoque' 
                : movingItem.type === 'virtual_audit' 
                    ? 'Ajuste de estoque virtual' 
                    : movingItem.type === 'dispatch' 
                        ? 'Retirada física realizada' 
                        : 'Transferência reservada (Aguardando Retirada)';
        const finalObs = `${sectorPrefix}${obs.trim() || defaultObs}`;

        const movement: StockMovement = {
            id: Math.random().toString(36).substring(2, 11),
            date: new Date().toISOString(),
            type: movingItem.type === 'transfer' ? 'transfer' : movingItem.type === 'add_virtual' ? 'addition' : movingItem.type === 'dispatch' ? 'out' : 'adjustment',
            from: movingItem.type === 'transfer' ? 'virtual' : movingItem.type === 'add_virtual' ? 'production' : movingItem.type === 'virtual_audit' ? 'system' : 'physical',
            to: movingItem.type === 'transfer' ? 'physical' : (movingItem.type === 'virtual_audit' || movingItem.type === 'add_virtual') ? 'virtual' : 'out',
            quantity: movementQty,
            operator: currentUser?.username || 'Sistema',
            observations: finalObs
        };

        const updates: Partial<FinishedProductItem> = {};
        if (movingItem.type === 'transfer') {
            updates.quantity = Math.max(0, currentItem.quantity - movementQty);
            updates.pendingTransferQuantity = (currentItem.pendingTransferQuantity || 0) + movementQty;
        } else if (movingItem.type === 'virtual_audit') {
            updates.quantity = movementQty;
        } else if (movingItem.type === 'dispatch') {
            updates.physicalQuantity = Math.max(0, (currentItem.physicalQuantity || 0) - movementQty);
            updates.pendingTransferQuantity = Math.max(0, (currentItem.pendingTransferQuantity || 0) - movementQty);
        } else {
            updates.physicalQuantity = movementQty;
        }

        updates.movementHistory = [...(currentItem.movementHistory || []), movement];
        onUpdateQuantity(targetId, updates, movement);
        setMovingItem(null);
        setMovementQty(0);
        setObs('');
        setDestSector('CAA60');
        setOtherDestSector('');
    };

    const handleResetStock = async () => {
        const manager = users?.find(u => (u.role === 'gestor' || u.role === 'admin') && u.password === resetManagerPassword);
        if (!manager) {
            setResetPwdError('Senha do gestor incorreta ou inválida.');
            return;
        }

        if (onResetStock) {
            await onResetStock(manager.username);
        }

        setIsResetModalOpen(false);
        setResetManagerPassword('');
        setResetPwdError('');
    };

    const currentItemForModal = useMemo(() => {
        if (!movingItem) return null;
        const relevant = finishedGoods.filter(
            i => i.model === movingItem.model && i.size.trim() === movingItem.size.trim()
        ).sort((a, b) => {
            const aConf = a.isConferred !== false ? 1 : 0;
            const bConf = b.isConferred !== false ? 1 : 0;
            return bConf - aConf;
        });
        return relevant[0] || null;
    }, [movingItem, finishedGoods]);

    const maxQtyForModal = useMemo(() => {
        if (!movingItem || !currentItemForModal) return Infinity;
        if (movingItem.type === 'dispatch') {
            return Math.min(currentItemForModal.pendingTransferQuantity || 0, currentItemForModal.physicalQuantity || 0);
        }
        if (movingItem.type === 'transfer') {
            return currentItemForModal.isConferred !== false
                ? (currentItemForModal.physicalQuantity || 0) - (currentItemForModal.pendingTransferQuantity || 0)
                : 0;
        }
        return Infinity;
    }, [movingItem, currentItemForModal]);

    return (
        <>
            {/* Modal de Movimentação */}
            {movingItem && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white/20 animate-modal-in">
                        <div className={`p-8 ${movingItem.type === 'transfer' ? 'bg-indigo-600' : movingItem.type === 'virtual_audit' ? 'bg-slate-700' : movingItem.type === 'add_virtual' ? 'bg-emerald-500' : movingItem.type === 'dispatch' ? 'bg-amber-600' : 'bg-slate-600'} text-white`}>
                            <h3 className="text-2xl font-black flex items-center gap-3">
                                {movingItem.type === 'transfer' ? <SwitchHorizontalIcon className="h-7 w-7" /> : movingItem.type === 'add_virtual' ? <PlusIcon className="h-7 w-7" /> : movingItem.type === 'dispatch' ? <ArrowLeftIcon className="h-7 w-7" /> : movingItem.type === 'view_history' ? <ClockIcon className="h-7 w-7" /> : <CalculatorIcon className="h-7 w-7" />}
                                {movingItem.type === 'transfer' ? 'Transferir para Setor (Aguardando Retirada)' : movingItem.type === 'add_virtual' ? 'Adicionar Estoque' : movingItem.type === 'virtual_audit' ? 'Ajustar Saldo Virtual' : movingItem.type === 'dispatch' ? 'Realizar Retirada (Baixa do Reservado)' : movingItem.type === 'view_history' ? 'Histórico do Lote' : 'Ajustar Contagem Física'}
                            </h3>
                            <p className="text-white/70 font-bold uppercase text-xs tracking-widest mt-2">{movingItem.model} - {movingItem.size}m</p>
                        </div>
                        <div className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
                            {movingItem.type === 'view_history' ? (
                                <div className="space-y-4">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                                        <span>Histórico de Movimentações</span>
                                        <span className="text-[10px] text-slate-400 font-bold lowercase">({currentItemForModal?.movementHistory?.length || 0} registros)</span>
                                    </h4>
                                    {currentItemForModal && currentItemForModal.movementHistory && currentItemForModal.movementHistory.length > 0 ? (
                                        <div className="space-y-3 max-h-[45vh] overflow-y-auto custom-scrollbar pr-1">
                                            {[...currentItemForModal.movementHistory].reverse().map((m, idx) => {
                                                const parsed = parseObservationSector(m.observations || '');
                                                let typeLabel = '';
                                                let badgeColor = '';
                                                if (m.type === 'transfer') {
                                                    typeLabel = 'Transferência Setor (Reservado)';
                                                    badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-100';
                                                } else if (m.type === 'addition') {
                                                    typeLabel = 'Adição Virtual (Entrada)';
                                                    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                                                } else if (m.type === 'out') {
                                                    typeLabel = 'Retirada Física (Carregado)';
                                                    badgeColor = 'bg-amber-50 text-amber-700 border-amber-100';
                                                } else {
                                                    typeLabel = m.from === 'system' ? 'Ajuste Virtual' : 'Ajuste Físico';
                                                    badgeColor = 'bg-slate-50 text-slate-700 border-slate-200';
                                                }

                                                return (
                                                    <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs space-y-2">
                                                        <div className="flex justify-between items-start gap-2 flex-wrap">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${badgeColor}`}>
                                                                    {typeLabel}
                                                                </span>
                                                                {parsed.sector && (
                                                                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-100">
                                                                        Setor: {parsed.sector}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] text-slate-400 font-medium">
                                                                {new Date(m.date).toLocaleString('pt-BR')}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm font-bold text-slate-800">
                                                            Quantidade: <span className="text-indigo-600">{formatPiecesAndPacksShort(m.quantity)}</span>
                                                        </p>
                                                        {parsed.cleanObs && (
                                                            <p className="text-slate-600 font-medium italic bg-white p-2.5 rounded-xl border border-slate-100">
                                                                "{parsed.cleanObs}"
                                                            </p>
                                                        )}
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide">
                                                            Operador: <span className="text-slate-600">{m.operator || 'Sistema'}</span>
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400 font-bold text-center py-6">
                                            Nenhum histórico registrado para este item.
                                        </p>
                                    )}
                                    <div className="pt-4 flex">
                                        <button 
                                            onClick={() => setMovingItem(null)} 
                                            className="flex-1 py-4 font-black text-white bg-slate-600 hover:bg-slate-700 rounded-2xl shadow-lg transition-all uppercase text-xs"
                                        >
                                            Fechar
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {movingItem.type === 'dispatch' && currentItemForModal && (
                                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-semibold text-amber-800 flex justify-between">
                                            <span>Pendente Retirada: <strong>{currentItemForModal.pendingTransferQuantity || 0} pçs</strong></span>
                                            <span>Disponível no Físico: <strong>{currentItemForModal.physicalQuantity || 0} pçs</strong></span>
                                        </div>
                                    )}

                                    {movingItem.type === 'transfer' && currentItemForModal && (
                                        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs font-semibold text-indigo-800 flex justify-between animate-fade-in">
                                            <span>Disponível Físico (Galpão): <strong>{formatPiecesAndPacksShort((currentItemForModal.physicalQuantity || 0) - (currentItemForModal.pendingTransferQuantity || 0))}</strong></span>
                                            {currentItemForModal.pendingTransferQuantity > 0 && (
                                                <span className="text-[10px] text-amber-600 font-bold uppercase">(Aguardando: {currentItemForModal.pendingTransferQuantity} pçs)</span>
                                            )}
                                        </div>
                                    )}
                                    
                                    {/* Synced quantity inputs */}
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            {movingItem.type === 'transfer' ? 'Quantidade a Transferir' : movingItem.type === 'add_virtual' ? 'Quantidade a Adicionar' : movingItem.type === 'virtual_audit' ? 'Novo Saldo Virtual (Sistema)' : movingItem.type === 'dispatch' ? 'Quantidade a Retirar' : 'Nova Contagem Física Real (Galpão)'}
                                        </label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Pacotes (200 pçs)</label>
                                                <input 
                                                    type="number"
                                                    value={Math.floor(movementQty / 200)}
                                                    onChange={(e) => {
                                                        const packs = parseInt(e.target.value) || 0;
                                                        const rem = movementQty % 200;
                                                        const newQty = Math.min(packs * 200 + rem, maxQtyForModal);
                                                        setMovementQty(newQty);
                                                    }}
                                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-800 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Peças Avulsas</label>
                                                <input 
                                                    type="number"
                                                    value={movementQty % 200}
                                                    onChange={(e) => {
                                                        const rem = parseInt(e.target.value) || 0;
                                                        const packs = Math.floor(movementQty / 200);
                                                        const newQty = Math.min(packs * 200 + rem, maxQtyForModal);
                                                        setMovementQty(newQty);
                                                    }}
                                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-800 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                />
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold text-indigo-600 block mt-1">
                                            Total: <strong>{movementQty} peças</strong>
                                        </span>
                                    </div>

                                    {/* Additional fields for manual virtual stock entry */}
                                    {movingItem.type === 'add_virtual' && (
                                        <div className="space-y-4 border-t border-slate-100 pt-4">
                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Dados da Ordem de Produção (OP)</h4>
                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Nº da Ordem de Produção (OP)</label>
                                                <input 
                                                    type="text"
                                                    value={opNumber}
                                                    onChange={(e) => setOpNumber(e.target.value)}
                                                    placeholder="Ex: OP-1234"
                                                    className="w-full p-3 bg-slate-50 rounded-xl font-bold text-slate-800 border border-slate-200 outline-none"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Data/Hora Início</label>
                                                    <input 
                                                        type="datetime-local"
                                                        value={opStartTime}
                                                        onChange={(e) => setOpStartTime(e.target.value)}
                                                        className="w-full p-3 bg-slate-50 rounded-xl font-semibold text-slate-700 border border-slate-200 outline-none text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Data/Hora Término</label>
                                                    <input 
                                                        type="datetime-local"
                                                        value={opEndTime}
                                                        onChange={(e) => setOpEndTime(e.target.value)}
                                                        className="w-full p-3 bg-slate-50 rounded-xl font-semibold text-slate-700 border border-slate-200 outline-none text-xs"
                                                    />
                                                </div>
                                            </div>
                                            <div className="border-t border-slate-100 pt-4">
                                                <label className="block text-[9px] font-black text-red-500 uppercase tracking-widest mb-1">Senha de Gestor (Requerido)</label>
                                                <input 
                                                    type="password"
                                                    value={managerPassword}
                                                    onChange={(e) => {
                                                        setManagerPassword(e.target.value);
                                                        setPwdError('');
                                                    }}
                                                    placeholder="Digite a senha..."
                                                    className={`w-full p-3 bg-slate-50 rounded-xl font-black text-slate-800 border outline-none ${pwdError ? 'border-red-500' : 'border-slate-200'}`}
                                                />
                                                {pwdError && <p className="text-[10px] font-bold text-red-500 mt-1 uppercase">{pwdError}</p>}
                                            </div>
                                        </div>
                                    )}

                                    {(movingItem.type === 'transfer' || movingItem.type === 'dispatch') && (
                                        <div className="space-y-4 border-t border-slate-100 pt-4">
                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Setor de Destino</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Setor</label>
                                                    <select 
                                                        value={destSector} 
                                                        onChange={e => setDestSector(e.target.value)} 
                                                        className="w-full p-3 bg-slate-50 rounded-xl font-semibold text-slate-700 border border-slate-200 outline-none text-xs"
                                                    >
                                                        <option value="CAA60">CAA60</option>
                                                        <option value="CA50">CA50</option>
                                                        <option value="Outros">Outros</option>
                                                    </select>
                                                </div>
                                                {destSector === 'Outros' && (
                                                    <div>
                                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Especificar Setor</label>
                                                        <input 
                                                            type="text" 
                                                            value={otherDestSector} 
                                                            onChange={e => setOtherDestSector(e.target.value)} 
                                                            placeholder="Ex: CAA30"
                                                            className="w-full p-3 bg-slate-50 rounded-xl font-bold text-slate-800 border border-slate-200 outline-none text-xs"
                                                            required
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {movingItem.type !== 'add_virtual' && (
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Observações / Motivo</label>
                                                <span className="text-[9px] font-black text-red-500 uppercase tracking-widest leading-none">Obrigatório</span>
                                            </div>
                                            <textarea 
                                                value={obs} 
                                                required
                                                onChange={(e) => setObs(e.target.value)}
                                                placeholder="Ex: Auditoria mensal, erro de lançamento, quebra..."
                                                className={`w-full p-4 bg-slate-50 rounded-2xl font-medium text-slate-600 outline-none transition-all border-2 ${!obs.trim() ? 'border-red-100 focus:border-red-200' : 'border-emerald-100 focus:border-emerald-200'}`}
                                            />
                                            {!obs.trim() && <p className="text-[9px] font-bold text-red-400 mt-2 uppercase">Descreva o motivo para liberar a gravação</p>}
                                        </div>
                                    )}

                                    {/* Histórico Recente do Lote */}
                                    {currentItemForModal && currentItemForModal.movementHistory && currentItemForModal.movementHistory.length > 0 && (
                                        <div className="space-y-3 border-t border-slate-100 pt-4">
                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                                                <span>Histórico Recente</span>
                                                <span className="text-[10px] text-slate-400 font-bold lowercase">({currentItemForModal.movementHistory.length} registros)</span>
                                            </h4>
                                            <div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                                                {[...currentItemForModal.movementHistory].reverse().slice(0, 5).map((m, idx) => {
                                                    const parsed = parseObservationSector(m.observations || '');
                                                    let typeLabel = '';
                                                    let badgeColor = '';
                                                    if (m.type === 'transfer') {
                                                        typeLabel = 'Transf.';
                                                        badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-100';
                                                    } else if (m.type === 'addition') {
                                                        typeLabel = 'Adição';
                                                        badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                                                    } else if (m.type === 'out') {
                                                        typeLabel = 'Retirada';
                                                        badgeColor = 'bg-amber-50 text-amber-700 border-amber-100';
                                                    } else {
                                                        typeLabel = m.from === 'system' ? 'Aj. Virt.' : 'Aj. Fís.';
                                                        badgeColor = 'bg-slate-50 text-slate-700 border-slate-200';
                                                    }

                                                    return (
                                                        <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px] space-y-1">
                                                            <div className="flex justify-between items-center">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${badgeColor}`}>
                                                                        {typeLabel}
                                                                    </span>
                                                                    {parsed.sector && (
                                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-100">
                                                                            Setor: {parsed.sector}
                                                                        </span>
                                                                    )}
                                                                    <span className="font-bold text-slate-800">
                                                                        {formatPiecesAndPacksShort(m.quantity)}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[9px] text-slate-400 font-medium">
                                                                    {new Date(m.date).toLocaleDateString('pt-BR')} {new Date(m.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                            {parsed.cleanObs && (
                                                                <p className="text-slate-500 font-medium italic mt-0.5">
                                                                    "{parsed.cleanObs}"
                                                                </p>
                                                            )}
                                                            <p className="text-[9px] text-slate-400 font-bold uppercase">
                                                                Op: {m.operator || 'Sistema'}
                                                            </p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-4 pt-4">
                                        <button 
                                            onClick={() => { 
                                                setMovingItem(null); 
                                                setObs(''); 
                                                setOpNumber('');
                                                setOpStartTime('');
                                                setOpEndTime('');
                                                setManagerPassword('');
                                                setPwdError('');
                                                setDestSector('CAA60');
                                                setOtherDestSector('');
                                            }} 
                                            className="flex-1 py-4 font-black text-slate-400 hover:bg-slate-50 rounded-2xl transition-all uppercase text-xs"
                                        >
                                            Cancelar
                                        </button>
                                        <button 
                                            onClick={handleAction} 
                                            disabled={
                                                movingItem.type === 'add_virtual' 
                                                    ? (!managerPassword.trim() || !opNumber.trim() || !opStartTime || !opEndTime)
                                                    : (!obs.trim() || ((movingItem.type === 'transfer' || movingItem.type === 'dispatch') && destSector === 'Outros' && !otherDestSector.trim()))
                                            }
                                            className={`flex-1 py-4 font-black text-white rounded-2xl shadow-lg transition-all uppercase text-xs disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none ${movingItem.type === 'transfer' || movingItem.type === 'dispatch' ? 'bg-indigo-600' : movingItem.type === 'virtual_audit' ? 'bg-slate-700' : 'bg-emerald-600'}`}
                                        >
                                            Confirmar
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Seleção de Lote para Conferência */}
            {selectedConferModel && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-white/20 animate-modal-in">
                        <div className="p-8 bg-amber-500 text-white">
                            <h3 className="text-2xl font-black flex items-center gap-3">
                                <ClockIcon className="h-7 w-7" />
                                Lotes Pendentes de Conferência
                            </h3>
                            <p className="text-white/70 font-bold uppercase text-xs tracking-widest mt-2">
                                {selectedConferModel.model} &mdash; {selectedConferModel.size}m
                            </p>
                        </div>
                        <div className="p-8 space-y-6">
                            <p className="text-sm font-semibold text-slate-500">
                                Selecione um lote de produção para realizar a contagem física e confirmar o estoque:
                            </p>
                            <div className="max-h-[40vh] overflow-y-auto border border-slate-100 rounded-2xl divide-y">
                                {selectedConferModel.list.map(item => (
                                    <div key={item.id} className="p-4 hover:bg-slate-50 flex justify-between items-center transition-colors">
                                        <div>
                                            <p className="font-black text-slate-800 text-sm">OP #{item.orderNumber}</p>
                                            <p className="text-xs text-slate-400 font-bold mt-1">
                                                Produção: {new Date(item.productionDate).toLocaleDateString('pt-BR')}
                                            </p>
                                            <p className="text-xs text-indigo-600 font-bold mt-0.5">
                                                Qtd Virtual: {formatPiecesAndPacksShort(item.quantity)}
                                            </p>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                setConferringItem(item);
                                                setConferQty(item.quantity); // default to virtual quantity
                                                setConferJustification('');
                                                setSelectedConferModel(null);
                                            }}
                                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black uppercase transition-all shadow-md"
                                        >
                                            Conferir
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-end">
                                <button 
                                    onClick={() => setSelectedConferModel(null)} 
                                    className="py-3 px-6 font-black text-slate-400 hover:bg-slate-50 rounded-2xl transition-all uppercase text-xs"
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Conferência de Lote */}
            {conferringItem && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white/20 animate-modal-in">
                        <div className="p-8 bg-amber-500 text-white">
                            <h3 className="text-2xl font-black flex items-center gap-3">
                                <CheckCircleIcon className="h-7 w-7" />
                                Conferir Estoque
                            </h3>
                            <p className="text-white/70 font-bold uppercase text-xs tracking-widest mt-2">
                                OP #{conferringItem.orderNumber} &mdash; {conferringItem.model} - {conferringItem.size}m
                            </p>
                        </div>
                        <div className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-bold text-amber-800 space-y-1">
                                <p>Data Produção: {new Date(conferringItem.productionDate).toLocaleString('pt-BR')}</p>
                                {conferringItem.opStartTime && <p>Início OP: {new Date(conferringItem.opStartTime).toLocaleString('pt-BR')}</p>}
                                {conferringItem.opEndTime && <p>Término OP: {new Date(conferringItem.opEndTime).toLocaleString('pt-BR')}</p>}
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    Quantidade Virtual no Sistema
                                </label>
                                <div className="p-4 bg-slate-100 rounded-2xl font-black text-slate-700 text-lg">
                                    {formatPiecesAndPacksShort(conferringItem.quantity)}
                                </div>
                            </div>

                            {/* Synced Inputs for Physical Quantity */}
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Quantidade Física Real (No Galpão)
                                </label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Pacotes (200 pçs)</label>
                                        <input 
                                            type="number"
                                            value={Math.floor(conferQty / 200)}
                                            onChange={(e) => {
                                                const packs = parseInt(e.target.value) || 0;
                                                const rem = conferQty % 200;
                                                setConferQty(packs * 200 + rem);
                                            }}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-800 focus:ring-2 focus:ring-amber-500/20 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Peças Avulsas</label>
                                        <input 
                                            type="number"
                                            value={conferQty % 200}
                                            onChange={(e) => {
                                                const rem = parseInt(e.target.value) || 0;
                                                const packs = Math.floor(conferQty / 200);
                                                setConferQty(packs * 200 + rem);
                                            }}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-800 focus:ring-2 focus:ring-amber-500/20 outline-none"
                                        />
                                    </div>
                                </div>
                                <span className="text-xs font-bold text-indigo-600 block mt-1">
                                    Total: <strong>{conferQty} peças</strong>
                                </span>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Justificativa / Observações</label>
                                    <span className="text-[9px] font-black text-red-500 uppercase tracking-widest leading-none">Obrigatório</span>
                                </div>
                                <textarea 
                                    value={conferJustification} 
                                    required
                                    onChange={(e) => setConferJustification(e.target.value)}
                                    placeholder="Justifique o resultado da conferência (ex: Contagem correta, divergência de saldo, etc.)"
                                    className={`w-full p-4 bg-slate-50 rounded-2xl font-medium text-slate-600 outline-none transition-all border-2 ${!conferJustification.trim() ? 'border-red-100 focus:border-red-200' : 'border-amber-100 focus:border-amber-200'}`}
                                />
                                {!conferJustification.trim() && <p className="text-[9px] font-bold text-red-400 mt-2 uppercase">Forneça uma justificativa para confirmar</p>}
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button 
                                    onClick={() => { setConferringItem(null); setConferJustification(''); }} 
                                    className="flex-1 py-4 font-black text-slate-400 hover:bg-slate-50 rounded-2xl transition-all uppercase text-xs"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={() => {
                                        if (!conferJustification.trim()) return;
                                        
                                        const movement: StockMovement = {
                                            id: Math.random().toString(36).substring(2, 11),
                                            date: new Date().toISOString(),
                                            type: 'adjustment',
                                            from: 'physical',
                                            to: 'physical',
                                            quantity: conferQty,
                                            operator: currentUser?.username || 'Sistema',
                                            observations: `Conferência: ${conferJustification}. (Virtual: ${conferringItem.quantity} pçs, Físico: ${conferQty} pçs)`
                                        };
                                        
                                        onUpdateQuantity(conferringItem.id, {
                                            physicalQuantity: conferQty,
                                            isConferred: true,
                                            conferralJustification: conferJustification,
                                            movementHistory: [...(conferringItem.movementHistory || []), movement]
                                        }, movement);
                                        
                                        setConferringItem(null);
                                        setConferQty(0);
                                        setConferJustification('');
                                    }} 
                                    disabled={!conferJustification.trim()}
                                    className="flex-1 py-4 font-black text-white bg-amber-500 rounded-2xl shadow-lg hover:bg-amber-600 transition-all uppercase text-xs disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    Confirmar Conferência
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Zerar Estoque */}
            {isResetModalOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white/20 animate-modal-in">
                        <div className="p-8 bg-red-600 text-white">
                            <h3 className="text-2xl font-black flex items-center gap-3">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Zerar Estoque Geral
                            </h3>
                            <p className="text-white/70 font-bold uppercase text-xs tracking-widest mt-2">
                                Ação Irreversível &bull; Requer Senha de Gestor
                            </p>
                        </div>
                        <div className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
                            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs font-bold text-red-800 space-y-2">
                                <p className="uppercase tracking-wide">⚠️ Atenção:</p>
                                <p>Esta ação irá redefinir para <strong>zero (0)</strong> o estoque virtual, estoque físico e aguardando retirada de todos os modelos de Treliça cadastrados no sistema.</p>
                                <p>A ação ficará registrada no histórico com o nome do gestor responsável.</p>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">
                                    Senha do Gestor (Requerido)
                                </label>
                                <input 
                                    type="password"
                                    value={resetManagerPassword}
                                    onChange={(e) => {
                                        setResetManagerPassword(e.target.value);
                                        setResetPwdError('');
                                    }}
                                    placeholder="Digite a senha do gestor..."
                                    className={`w-full p-4 bg-slate-50 rounded-2xl font-black text-slate-800 border outline-none ${resetPwdError ? 'border-red-500' : 'border-slate-200'}`}
                                />
                                {resetPwdError && <p className="text-[10px] font-bold text-red-500 mt-1 uppercase">{resetPwdError}</p>}
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button 
                                    onClick={() => { setIsResetModalOpen(false); setResetManagerPassword(''); setResetPwdError(''); }} 
                                    className="flex-1 py-4 font-black text-slate-400 hover:bg-slate-50 rounded-2xl transition-all uppercase text-xs"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleResetStock} 
                                    disabled={!resetManagerPassword.trim()}
                                    className="flex-1 py-4 font-black text-white bg-red-600 rounded-2xl shadow-lg hover:bg-red-700 transition-all uppercase text-xs disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    Confirmar Reset
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="p-4 sm:p-6 md:p-8 space-y-8 animate-fade-in">
                {/* Cabeçalho */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-[#0A2A3D] flex items-center justify-center shadow-lg shadow-slate-200">
                                <ArchiveIcon className="h-6 w-6 text-white" />
                            </div>
                            Gestão de Treliças
                        </h1>
                        <p className="text-slate-500 font-medium mt-1 ml-15">Controle de estoque de produto acabado.</p>
                    </div>
                    <div>
                        <button
                            onClick={() => {
                                setIsResetModalOpen(true);
                                setResetManagerPassword('');
                                setResetPwdError('');
                            }}
                            className="w-full md:w-auto py-3 px-6 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black shadow-lg shadow-red-100 transition-all uppercase text-xs flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Zerar Estoque
                        </button>
                    </div>
                </header>

                {/* Painel de Filtros Rápidos */}
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-1">
                        <div className="space-y-1.5 flex-1 max-w-sm">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Filtrar por Modelo
                            </label>
                            <select 
                                value={filterModel}
                                onChange={(e) => setFilterModel(e.target.value)}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 outline-none text-xs shadow-sm transition-all"
                            >
                                <option value="all">Todos os Modelos</option>
                                {uniqueModels.map((model, idx) => (
                                    <option key={idx} value={model}>{model}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-3 pt-6 sm:pt-0">
                            <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 hover:bg-slate-100/50 rounded-xl border border-slate-200 transition-all select-none">
                                <input 
                                    type="checkbox"
                                    checked={filterPendingWithdrawal}
                                    onChange={(e) => setFilterPendingWithdrawal(e.target.checked)}
                                    className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                                <div>
                                    <span className="font-bold text-slate-700 text-xs">Apenas Aguardando Retirada</span>
                                    <p className="text-[8px] text-slate-400 uppercase font-black tracking-widest mt-0.5">Filtra itens com saldo reservado</p>
                                </div>
                            </label>
                        </div>
                    </div>
                    {/* Indicador de resultados */}
                    <div className="text-right text-xs font-black text-slate-400 uppercase tracking-widest">
                        Exibindo <span className="text-indigo-600 font-extrabold">{filteredModels.length}</span> modelos
                    </div>
                </div>

                {/* Tabela Geral de Modelos */}
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                        <h3 className="text-lg font-bold text-slate-800">Modelos de Treliça em Estoque</h3>
                        <p className="text-xs text-slate-400 mt-1">Saldo atual e conciliação por modelo e tamanho.</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-500">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b">
                                <tr>
                                    <th scope="col" className="px-6 py-4">Treliça (Modelo/Tamanho)</th>
                                    <th scope="col" className="px-6 py-4 text-center">Virtual (Sistema)</th>
                                    <th scope="col" className="px-6 py-4 text-center">Físico (Galpão)</th>
                                    <th scope="col" className="px-6 py-4 text-center">Diferença</th>
                                    <th scope="col" className="px-6 py-4 text-center">Aguardando Retirada</th>
                                    <th scope="col" className="px-6 py-4 text-right">Peso Est. (kg)</th>
                                    <th scope="col" className="px-6 py-4 text-center">Ações de Estoque</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredModels.length > 0 ? (
                                    filteredModels.map((item, idx) => (
                                    <tr key={idx} className="bg-white border-b hover:bg-slate-50/50">
                                        <td className="px-6 py-4 font-black text-slate-800">
                                            {item.model} <span className="text-slate-400 text-xs font-semibold">({item.size}m)</span>
                                        </td>
                                        <td className="px-6 py-4 text-center font-bold text-slate-700">{formatPiecesAndPacksShort(item.virtualQty)}</td>
                                        <td className="px-6 py-4 text-center font-bold text-slate-800">
                                            {formatPiecesAndPacksShort(item.physicalQty)}
                                            {item.hasUnconferred && (
                                                <span className="block mt-1 text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded w-fit mx-auto animate-pulse">
                                                    ⚠️ {formatPiecesAndPacksShort(item.unconferredQty)} aguardando conferência
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center font-bold">
                                            <span className={`px-2 py-0.5 rounded text-xs ${
                                                item.diff < 0 
                                                    ? 'bg-red-50 text-red-600' 
                                                    : item.diff > 0 
                                                        ? 'bg-emerald-50 text-emerald-600' 
                                                        : 'text-slate-400'
                                            }`}>
                                                {item.diff > 0 ? `+${item.diff}` : item.diff}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center font-bold">
                                            {item.pendingTransferQty > 0 ? (
                                                <span className="px-2.5 py-1 rounded-full text-xs bg-amber-50 text-amber-700 font-bold border border-amber-200">
                                                    {formatPiecesAndPacksShort(item.pendingTransferQty)}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300 font-medium">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right font-semibold text-slate-600">{(item.totalWeight).toFixed(0)} kg</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                                {item.hasUnconferred && (
                                                    <button 
                                                        onClick={() => {
                                                            setSelectedConferModel({ model: item.model, size: item.size, list: item.unconferredList });
                                                        }}
                                                        className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-black uppercase transition-all shadow-md"
                                                        title="Conferir lotes pendentes"
                                                    >
                                                        Conferir
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => {
                                                        setMovingItem({ model: item.model, size: item.size, type: 'add_virtual' });
                                                        setMovementQty(0);
                                                    }}
                                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-black uppercase transition-all"
                                                    title="Adicionar ao Estoque Virtual (Sistema)"
                                                >
                                                    Virtual
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        setMovingItem({ model: item.model, size: item.size, type: 'virtual_audit' });
                                                        setMovementQty(item.virtualQty);
                                                    }}
                                                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-black uppercase transition-all"
                                                    title="Ajustar Saldo Virtual (Sistema)"
                                                >
                                                    Aj. Virtual
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        setMovingItem({ model: item.model, size: item.size, type: 'audit' });
                                                        setMovementQty(item.physicalQty);
                                                    }}
                                                    className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase transition-all"
                                                    title="Ajustar Contagem Física"
                                                >
                                                    Ajustar
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        setMovingItem({ model: item.model, size: item.size, type: 'view_history' });
                                                        setMovementQty(0);
                                                    }}
                                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-[10px] font-black uppercase transition-all"
                                                    title="Ver histórico de movimentações deste lote"
                                                >
                                                    ⏱️ Hist.
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        setMovingItem({ model: item.model, size: item.size, type: 'transfer' });
                                                        setMovementQty(0);
                                                    }}
                                                    disabled={item.availablePhysForTransf <= 0}
                                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-[10px] font-black uppercase transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                                    title={item.availablePhysForTransf <= 0 ? "Sem estoque físico disponível para transferência" : "Transferir estoque físico para outro setor (Aguardando Retirada)"}
                                                >
                                                    Transf. Setor
                                                </button>
                                                {item.pendingTransferQty > 0 && (
                                                    <button 
                                                        onClick={() => {
                                                            setMovingItem({ model: item.model, size: item.size, type: 'dispatch' });
                                                            setMovementQty(0);
                                                        }}
                                                        className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase transition-all shadow-md animate-pulse"
                                                        title="Confirmar a retirada física (dar baixa no saldo aguardando retirada)"
                                                    >
                                                        Retirada
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="text-center py-16 text-slate-400 font-bold bg-slate-50/30">
                                            Nenhum modelo encontrado com os filtros selecionados.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
);
};

export default TrelicaStockManager;
