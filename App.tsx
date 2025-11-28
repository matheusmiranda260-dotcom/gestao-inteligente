import React, { useState, useEffect } from 'react';
import type { Page, User, StockItem, ConferenceData, ProductionOrderData, TransferRecord, Bitola, MachineType, PartsRequest, ShiftReport, ProductionRecord, TransferredLotInfo, ProcessedLot, DowntimeEvent, OperatorLog, TrelicaSelectedLots, WeighedPackage, FinishedProductItem, PontaItem, FinishedGoodsTransferRecord, TransferredFinishedGoodInfo, Message } from './types';
import { supabase } from './supabaseClient';
import { fetchTable, insertItem, updateItem, deleteItem, deleteItemByColumn, updateItemByColumn } from './services/supabaseService';

// Helper to generate IDs
const generateId = (prefix: string) => `${prefix.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const App: React.FC = () => {
    // Core state
    const [page, setPage] = useState<Page>('login');
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [loading, setLoading] = useState(true);

    // Data collections
    const [users, setUsers] = useState<User[]>([]);
    const [stock, setStock] = useState<StockItem[]>([]);
    const [conferences, setConferences] = useState<ConferenceData[]>([]);
    const [transfers, setTransfers] = useState<TransferRecord[]>([]);
    const [productionOrders, setProductionOrders] = useState<ProductionOrderData[]>([]);
    const [finishedGoods, setFinishedGoods] = useState<FinishedProductItem[]>([]);
    const [pontasStock, setPontasStock] = useState<PontaItem[]>([]);
    const [finishedGoodsTransfers, setFinishedGoodsTransfers] = useState<FinishedGoodsTransferRecord[]>([]);
    const [partsRequests, setPartsRequests] = useState<PartsRequest[]>([]);
    const [shiftReports, setShiftReports] = useState<ShiftReport[]>([]);
    const [trefilaProduction, setTrefilaProduction] = useState<ProductionRecord[]>([]);
    const [trelicaProduction, setTrelicaProduction] = useState<ProductionRecord[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);

    const showNotification = (msg: string, type: 'success' | 'error') => {
        setNotification({ message: msg, type });
    };

    // Session handling
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                handleUserSession(session.user);
            }
            setLoading(false);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                handleUserSession(session.user);
            } else {
                setCurrentUser(null);
                setPage('login');
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    const handleUserSession = (supabaseUser: any) => {
        const role = (supabaseUser.email?.includes('gestor') || supabaseUser.email?.includes('admin') || supabaseUser.email === 'matheusmiranda357@gmail.com') ? 'gestor' : 'user';
        const appUser: User = {
            id: supabaseUser.id,
            username: supabaseUser.email || 'Usuario',
            password: '',
            role,
            permissions: { trelica: true, trefila: true },
        };
        setCurrentUser(appUser);
        setPage('menu');
    };

    const handleLogin = async (username: string, password: string) => {
        if ((username.toLowerCase() === 'gestor' || username.toLowerCase() === 'matheusmiranda357@gmail.com') && password === '070223') {
            const adminUser: User = {
                id: 'local-admin-gestor',
                username: 'Matheus Miranda',
                password: '',
                role: 'gestor',
                permissions: { trelica: true, trefila: true },
            };
            setCurrentUser(adminUser);
            setPage('menu');
            showNotification('Login realizado com sucesso (Modo Gestor).', 'success');
            return;
        }
        const email = username.includes('@') ? username : `${username}@example.com`;
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            showNotification(`Erro ao entrar: ${error.message}`, 'error');
        } else {
            // Session will be handled by onAuthStateChange
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setCurrentUser(null);
        setPage('login');
    };

    // Messaging
    const addMessage = async (messageText: string, productionOrderId: string, machine: MachineType) => {
        if (!currentUser) return;
        const newMessage: Message = {
            id: generateId('msg'),
            timestamp: new Date().toISOString(),
            productionOrderId,
            machine,
            senderId: currentUser.id,
            senderUsername: currentUser.username,
            message: messageText,
            isRead: false,
        };
        try {
            const savedMessage = await insertItem<Message>('messages', newMessage);
            setMessages(prev => [...prev, savedMessage].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
        } catch {
            showNotification('Erro ao enviar mensagem.', 'error');
        }
    };

    const markAllMessagesAsRead = async () => {
        setMessages(prev => prev.map(m => ({ ...m, isRead: true })));
        try {
            const unread = messages.filter(m => !m.isRead);
            for (const msg of unread) {
                await updateItem('messages', msg.id, { isRead: true });
            }
        } catch (e) {
            console.error('Failed to mark messages as read', e);
        }
    };

    // User management (simplified)
    const addUser = async (data: { username: string; password: string; permissions: Partial<Record<Page, boolean>> }) => {
        const email = data.username.includes('@') ? data.username : `${data.username}@example.com`;
        const { data: result, error } = await supabase.functions.invoke('create-user', {
            body: { email, password: data.password, userData: { username: data.username, role: 'user', permissions: data.permissions } },
        });
        if (error) {
            showNotification(`Erro ao criar usuário: ${error.message}`, 'error');
            return;
        }
        const newUser: User = { id: result.user.id, username: data.username, password: '', role: 'user', permissions: data.permissions };
        setUsers(prev => [...prev, newUser]);
        showNotification('Usuário adicionado com sucesso!', 'success');
    };

    const updateUser = async (userId: string, data: Partial<User>) => {
        try {
            await updateItem<User>('profiles', userId, data);
            setUsers(prev => prev.map(u => (u.id === userId ? { ...u, ...data } : u)));
            showNotification('Usuário atualizado com sucesso!', 'success');
        } catch {
            showNotification('Erro ao atualizar usuário.', 'error');
        }
    };

    const deleteUser = async (userId: string) => {
        try {
            await deleteItem('profiles', userId);
            setUsers(prev => prev.filter(u => u.id !== userId));
            showNotification('Usuário removido com sucesso!', 'success');
        } catch {
            showNotification('Erro ao remover usuário.', 'error');
        }
    };

    // Stock control (addConference simplified)
    const addConference = async (data: ConferenceData) => {
        try {
            const savedConference = await insertItem<ConferenceData>('conferences', data);
            setConferences(prev => [...prev, savedConference]);
            const newStockItems: StockItem[] = data.lots.map(lot => ({
                id: generateId('STOCK'),
                entryDate: data.entryDate,
                supplier: data.supplier,
                nfe: data.nfe,
                conferenceNumber: data.conferenceNumber,
                internalLot: lot.internalLot,
                supplierLot: lot.supplierLot,
                runNumber: lot.runNumber,
                materialType: lot.materialType,
                bitola: lot.bitola,
                labelWeight: lot.labelWeight,
                initialQuantity: lot.scaleWeight,
                remainingQuantity: lot.scaleWeight,
                status: 'Disponível',
                history: [{ type: 'Entrada', date: new Date().toISOString(), details: { action: 'Conferência de Recebimento', weight: lot.scaleWeight } }],
            }));
            for (const item of newStockItems) {
                await insertItem<StockItem>('stock_items', item);
            }
            setStock(prev => [...prev, ...newStockItems]);
            showNotification('Conferência salva e estoque atualizado com sucesso!', 'success');
        } catch {
            showNotification('Erro ao salvar conferência.', 'error');
        }
    };

    // Transfer functions (unchanged logic)
    const createTransfer = async (destinationSector: string, lotsToTransfer: Map<string, number>) => {
        if (!currentUser) return null;
        const transferredLotsInfo: TransferredLotInfo[] = [];
        const updates: { id: string; changes: Partial<StockItem> }[] = [];
        for (const item of stock) {
            if (lotsToTransfer.has(item.id)) {
                const qty = lotsToTransfer.get(item.id)!;
                if (qty > item.remainingQuantity || qty <= 0) continue;
                const remaining = item.remainingQuantity - qty;
                const newStatus = remaining <= 0 ? 'Transferido' : item.status;
                const newHistory = [...(item.history || []), { type: `Transferência para ${destinationSector}`, date: new Date().toISOString(), details: { 'Quantidade Transferida': `${qty.toFixed(2)} kg`, Operador: currentUser.username } }];
                updates.push({ id: item.id, changes: { remainingQuantity: remaining, status: newStatus as any, history: newHistory } });
                transferredLotsInfo.push({ lotId: item.id, internalLot: item.internalLot, materialType: item.materialType, bitola: item.bitola, transferredQuantity: qty });
            }
        }
        if (transferredLotsInfo.length === 0) {
            showNotification('Nenhuma quantidade válida para transferir.', 'error');
            return null;
        }
        const newTransfer: TransferRecord = { id: generateId('transf-mp'), date: new Date().toISOString(), operator: currentUser.username, destinationSector, transferredLots: transferredLotsInfo };
        try {
            const saved = await insertItem<TransferRecord>('transfers', newTransfer);
            setTransfers(prev => [...prev, saved]);
            for (const upd of updates) {
                await updateItem<StockItem>('stock_items', upd.id, upd.changes);
            }
            const updatedStock = await fetchTable<StockItem>('stock_items');
            setStock(updatedStock);
            showNotification('Transferência realizada com sucesso!', 'success');
            return saved;
        } catch {
            showNotification('Erro ao realizar transferência.', 'error');
            return null;
        }
    };

    const createFinishedGoodsTransfer = async (data: { destinationSector: string; otherDestination?: string; items: Map<string, number> }) => {
        if (!currentUser) return null;
        const transferredItems: TransferredFinishedGoodInfo[] = [];
        const fgUpdates: { id: string; changes: Partial<FinishedProductItem> }[] = [];
        const pontaUpdates: { id: string; changes: Partial<PontaItem> }[] = [];
        for (const item of finishedGoods) {
            if (data.items.has(item.id)) {
                const qty = data.items.get(item.id)!;
                const weightPer = item.totalWeight / item.quantity;
                const transferredWeight = weightPer * qty;
                transferredItems.push({ productId: item.id, productType: item.productType, model: item.model, size: item.size, transferredQuantity: qty, totalWeight: transferredWeight });
                const newQty = item.quantity - qty;
                if (newQty > 0) {
                    fgUpdates.push({ id: item.id, changes: { quantity: newQty, totalWeight: item.totalWeight - transferredWeight } });
                } else {
                    fgUpdates.push({ id: item.id, changes: { quantity: 0, totalWeight: 0, status: 'Transferido' } });
                }
            }
        }
        for (const item of pontasStock) {
            if (data.items.has(item.id)) {
                const qty = data.items.get(item.id)!;
                const weightPer = item.totalWeight / item.quantity;
                const transferredWeight = weightPer * qty;
                transferredItems.push({ productId: item.id, productType: item.productType, model: item.model, size: item.size, transferredQuantity: qty, totalWeight: transferredWeight });
                const newQty = item.quantity - qty;
                if (newQty > 0) {
                    pontaUpdates.push({ id: item.id, changes: { quantity: newQty, totalWeight: item.totalWeight - transferredWeight } });
                } else {
                    pontaUpdates.push({ id: item.id, changes: { quantity: 0, totalWeight: 0, status: 'Transferido' } });
                }
            }
        }
        if (transferredItems.length === 0) {
            showNotification('Nenhum item válido para transferir.', 'error');
            return null;
        }
        const newTransfer: FinishedGoodsTransferRecord = { id: generateId('transf-pa'), date: new Date().toISOString(), operator: currentUser.username, destinationSector: data.destinationSector, otherDestination: data.otherDestination, transferredItems };
        try {
            const saved = await insertItem<FinishedGoodsTransferRecord>('finished_goods_transfers', newTransfer);
            setFinishedGoodsTransfers(prev => [...prev, saved]);
            for (const upd of fgUpdates) {
                await updateItem<FinishedProductItem>('finished_goods', upd.id, upd.changes);
            }
            for (const upd of pontaUpdates) {
                await updateItem<PontaItem>('pontas_stock', upd.id, upd.changes);
            }
            const updatedFG = await fetchTable<FinishedProductItem>('finished_goods');
            setFinishedGoods(updatedFG);
            const updatedPontas = await fetchTable<PontaItem>('pontas_stock');
            setPontasStock(updatedPontas);
            showNotification('Transferência de produto acabado realizada com sucesso!', 'success');
            return saved;
        } catch {
            showNotification('Erro ao realizar transferência.', 'error');
            return null;
        }
    };

    // Production order handling
    const addProductionOrder = async (orderData: Omit<ProductionOrderData, 'id' | 'status' | 'creationDate'>) => {
        try {
            const id = typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function' ? (crypto as any).randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
            const order: ProductionOrderData = { ...orderData, id, status: 'pending', creationDate: new Date().toISOString() };
            const saved = await insertItem<ProductionOrderData>('production_orders', order);
            setProductionOrders(prev => [...prev, saved]);
            // Update stock status
            if (Array.isArray(order.selectedLotIds)) {
                for (const lotId of order.selectedLotIds) {
                    const stockItem = stock.find(s => s.id === lotId);
                    if (stockItem) {
                        await updateItem<StockItem>('stock_items', lotId, { status: 'Em Produção', productionOrderIds: [...(stockItem.productionOrderIds || []), order.id] });
                    }
                }
            } else {
                const lotIds = Object.values(order.selectedLotIds).filter(Boolean);
                for (const lotId of lotIds) {
                    const stockItem = stock.find(s => s.id === lotId);
                    if (stockItem) {
                        await updateItem<StockItem>('stock_items', lotId, { status: 'Em Produção - Treliça', productionOrderIds: [...(stockItem.productionOrderIds || []), order.id] });
                    }
                }
            }
            const updatedStock = await fetchTable<StockItem>('stock_items');
            setStock(updatedStock);
            showNotification('Ordem de produção criada com sucesso!', 'success');
        } catch (e: any) {
            console.error('Error creating production order', e);
            showNotification(`Erro ao criar ordem de produção: ${e.message || e}`, 'error');
        }
    };

    const updateProductionOrder = async (id: string, updates: Partial<ProductionOrderData>) => {
        try {
            const updated = await updateItem<ProductionOrderData>('production_orders', id, updates);
            setProductionOrders(prev => prev.map(o => (o.id === id ? updated : o)));
        } catch {
            showNotification('Erro ao atualizar ordem de produção.', 'error');
        }
    };

    const deleteProductionOrder = async (orderId: string) => {
        try {
            const order = productionOrders.find(o => o.id === orderId);
            if (!order) return;
            const lotIds = Array.isArray(order.selectedLotIds) ? order.selectedLotIds : Object.values(order.selectedLotIds);
            for (const lotId of lotIds) {
                const stockItem = stock.find(s => s.id === lotId);
                if (stockItem) {
                    const newIds = (stockItem.productionOrderIds || []).filter(id => id !== orderId);
                    await updateItem<StockItem>('stock_items', lotId, { status: newIds.length === 0 ? 'Disponível' : stockItem.status, productionOrderIds: newIds.length > 0 ? newIds : undefined });
                }
            }
            await deleteItem('production_orders', orderId);
            setProductionOrders(prev => prev.filter(o => o.id !== orderId));
            const updatedStock = await fetchTable<StockItem>('stock_items');
            setStock(updatedStock);
            showNotification('Ordem de produção removida.', 'success');
        } catch {
            showNotification('Erro ao remover ordem de produção.', 'error');
        }
    };

    // Machine control (simplified startProductionOrder)
    const startProductionOrder = async (orderId: string) => {
        if (!currentUser) return;
        const now = new Date().toISOString();
        const idx = productionOrders.findIndex(o => o.id === orderId);
        if (idx === -1) return;
        const order = { ...productionOrders[idx] };
        order.status = 'in_progress';
        order.startTime = now;
        order.downtimeEvents = [...(order.downtimeEvents || []), { stopTime: now, resumeTime: null, reason: 'Aguardando Início da Produção' }];
        order.operatorLogs = [...(order.operatorLogs || []), { operator: currentUser.username, startTime: now, endTime: null }];
        try {
            await updateItem('production_orders', order.id, order);
            const newOrders = [...productionOrders];
            newOrders[idx] = order;
            setProductionOrders(newOrders);
            showNotification('Ordem de produção iniciada.', 'success');
        } catch {
            showNotification('Erro ao iniciar ordem de produção.', 'error');
        }
    };

    // Shift handling (simplified)
    const startOperatorShift = async (orderId: string) => {
        if (!currentUser) return;
        const now = new Date().toISOString();
        const order = productionOrders.find(o => o.id === orderId);
        if (!order) return;
        const updated = { ...order, operatorLogs: [...(order.operatorLogs || []), { operator: currentUser.username, startTime: now, endTime: null }] };
        if (updated.machine === 'Treliça') {
            const events = [...(updated.downtimeEvents || [])];
            for (let i = events.length - 1; i >= 0; i--) {
                if (!events[i].resumeTime) {
                    events[i].resumeTime = now;
                    break;
                }
            }
            updated.downtimeEvents = events;
        }
        try {
            await updateItem('production_orders', orderId, updated);
            setProductionOrders(prev => prev.map(o => (o.id === orderId ? updated : o)));
            showNotification('Turno iniciado.', 'success');
        } catch {
            showNotification('Erro ao iniciar turno.', 'error');
        }
    };

    const generateShiftReport = async (order: ProductionOrderData, operatorLog: OperatorLog) => {
        if (!operatorLog.endTime) return;
        const shiftStart = new Date(operatorLog.startTime);
        const shiftEnd = new Date(operatorLog.endTime);
        const shiftDowntime = (order.downtimeEvents || []).filter(e => new Date(e.stopTime) >= shiftStart && new Date(e.stopTime) < shiftEnd);
        const shiftProcessed = (order.processedLots || []).filter(l => new Date(l.endTime) >= shiftStart && new Date(l.endTime) < shiftEnd);
        const totalWeight = shiftProcessed.reduce((sum, l) => sum + (l.finalWeight || 0), 0);
        const totalScrap = 0;
        const scrapPct = totalWeight > 0 ? (totalScrap / (totalWeight + totalScrap)) * 100 : 0;
        const bitolaMm = parseFloat(order.targetBitola);
        const radiusM = (bitolaMm / 1000) / 2;
        const areaM2 = Math.PI * radiusM * radiusM;
        const steelDensity = 7850;
        const volumeM3 = totalWeight / steelDensity;
        const totalMeters = volumeM3 / areaM2;
        const report: ShiftReport = {
            id: generateId('shift'),
            date: shiftEnd.toISOString(),
            operator: operatorLog.operator,
            machine: order.machine,
            productionOrderId: order.id,
            orderNumber: order.orderNumber,
            targetBitola: order.targetBitola,
            trelicaModel: order.trelicaModel,
            tamanho: order.tamanho,
            quantityToProduce: order.quantityToProduce,
            shiftStartTime: operatorLog.startTime,
            shiftEndTime: operatorLog.endTime,
            processedLots: shiftProcessed,
            downtimeEvents: shiftDowntime,
            totalProducedWeight: totalWeight,
            totalProducedMeters: totalMeters,
            totalScrapWeight: totalScrap,
            scrapPercentage: scrapPct,
        };
        try {
            const saved = await insertItem<ShiftReport>('shift_reports', report);
            setShiftReports(prev => [...prev, saved]);
        } catch {
            showNotification('Erro ao salvar relatório de turno.', 'error');
        }
    };

    // End operator shift (simplified)
    const endOperatorShift = async (orderId: string) => {
        if (!currentUser) return;
        const order = productionOrders.find(o => o.id === orderId);
        if (!order) return;
        const now = new Date().toISOString();
        const updatedLogs = (order.operatorLogs || []).map(log => (log.operator === currentUser.username && !log.endTime ? { ...log, endTime: now } : log));
        const updatedOrder = { ...order, operatorLogs: updatedLogs };
        try {
            await updateItem('production_orders', orderId, updatedOrder);
            setProductionOrders(prev => prev.map(o => (o.id === orderId ? updatedOrder : o)));
            // Generate report for each closed log
            for (const log of updatedLogs) {
                if (log.endTime) {
                    await generateShiftReport(updatedOrder, log);
                }
            }
            showNotification('Turno finalizado.', 'success');
        } catch {
            showNotification('Erro ao finalizar turno.', 'error');
        }
    };

    // Render placeholder UI
    return (
        <div>
            <h1>Gestão Inteligente</h1>
            {/* UI components would be placed here */}
        </div>
    );
};

export default App;