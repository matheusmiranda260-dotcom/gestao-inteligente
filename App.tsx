import React, { useState, useEffect, useMemo } from 'react';
import type { Page, User, StockItem, ConferenceData, ProductionOrderData, TransferRecord, Bitola, MachineType, PartsRequest, ShiftReport, ProductionRecord, TransferredLotInfo, ProcessedLot, DowntimeEvent, OperatorLog, TrelicaSelectedLots, WeighedPackage, FinishedProductItem, Ponta, PontaItem, FinishedGoodsTransferRecord, TransferredFinishedGoodInfo, Message } from './types';
import Login from './components/Login';
import MainMenu from './components/MainMenu';
import StockControl from './components/StockControl';
import MachineControl, { MachineSelection } from './components/MachineControl';
import ProductionOrder from './components/ProductionOrder';
import ProductionOrderTrelica from './components/ProductionOrderTrelica';
import Reports from './components/Reports';
import UserManagement from './components/UserManagement';
import Notification from './components/Notification';
import ProductionDashboard from './components/ProductionDashboard';
import { trelicaModels } from './components/ProductionOrderTrelica';
import FinishedGoods from './components/FinishedGoods';
import SparePartsManager from './components/SparePartsManager';
import { supabase } from './supabaseClient';

import { fetchTable, insertItem, updateItem, deleteItem, deleteItemByColumn, updateItemByColumn } from './services/supabaseService';
import { useAllRealtimeSubscriptions } from './hooks/useSupabaseRealtime';
import RealtimeStatus from './components/RealtimeStatus';
const generateId = (prefix: string) => `${prefix.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const App: React.FC = () => {
    const [page, setPage] = useState<Page>('login');
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [loading, setLoading] = useState(true);

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

    useEffect(() => {
        const loadData = async () => {
            try {
                const [
                    fetchedUsers, fetchedStock, fetchedConferences, fetchedTransfers,
                    fetchedOrders, fetchedFinishedGoods, fetchedPontas, fetchedFGTransfers,
                    fetchedParts, fetchedReports, fetchedProductionRecords, fetchedMessages
                ] = await Promise.all([
                    fetchTable<User>('profiles'),
                    fetchTable<StockItem>('stock_items'),
                    fetchTable<ConferenceData>('conferences'),
                    fetchTable<TransferRecord>('transfers'),
                    fetchTable<ProductionOrderData>('production_orders'),
                    fetchTable<FinishedProductItem>('finished_goods'),
                    fetchTable<PontaItem>('pontas_stock'),
                    fetchTable<FinishedGoodsTransferRecord>('finished_goods_transfers'),
                    fetchTable<PartsRequest>('parts_requests'),
                    fetchTable<ShiftReport>('shift_reports'),
                    fetchTable<ProductionRecord>('production_records'),
                    fetchTable<Message>('messages')
                ]);

                setUsers(fetchedUsers);
                setStock(fetchedStock);
                setConferences(fetchedConferences);
                setTransfers(fetchedTransfers);
                setProductionOrders(fetchedOrders);
                setFinishedGoods(fetchedFinishedGoods);
                setPontasStock(fetchedPontas);
                setFinishedGoodsTransfers(fetchedFGTransfers);
                setPartsRequests(fetchedParts);
                setShiftReports(fetchedReports);

                // Split production records
                setTrefilaProduction(fetchedProductionRecords.filter(r => r.machine === 'Trefila'));
                setTrelicaProduction(fetchedProductionRecords.filter(r => r.machine === 'Treliça'));

                setMessages(fetchedMessages);
            } catch (error) {
                console.error("Failed to load data from Supabase", error);
                showNotification("Erro ao carregar dados do servidor.", 'error');
            }
        };

        if (currentUser) {
            loadData();
        }
    }, [currentUser]);

    const showNotification = (message: string, type: 'success' | 'error') => {
        setNotification({ message, type });
    };

    // Supabase Realtime - Atualiza dados automaticamente quando há mudanças no banco
    useAllRealtimeSubscriptions({
        setStock,
        setConferences,
        setProductionOrders,
        setTransfers,
        setFinishedGoods,
        setPontasStock,
        setFinishedGoodsTransfers,
        setPartsRequests,
        setShiftReports,
        setTrefilaProduction,
        setTrelicaProduction,
        setMessages,
    }, !!currentUser);

    useEffect(() => {
        // Check active session
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
        // Map Supabase user to App User
        // For now, we'll determine role based on email or metadata
        // Defaulting to 'gestor' for the first user for testing purposes if email contains 'gestor'
        const role = (supabaseUser.email?.includes('gestor') || supabaseUser.email?.includes('admin') || supabaseUser.email === 'matheusmiranda357@gmail.com') ? 'gestor' : 'user';

        const appUser: User = {
            id: supabaseUser.id,
            username: supabaseUser.email || 'Usuario',
            password: '', // Not needed locally
            role: role,
            permissions: { trelica: true, trefila: true } // Default permissions
        };
        setCurrentUser(appUser);
        setPage('menu');
    };

    const handleLogin = async (username: string, password: string): Promise<void> => {
        // Hardcoded bypass for the requested user "gestor"
        // Hardcoded bypass for the requested user
        if ((username.toLowerCase() === 'gestor' || username.toLowerCase() === 'matheusmiranda357@gmail.com') && password === '070223') {
            const adminUser: User = {
                id: 'local-admin-gestor',
                username: 'Matheus Miranda',
                password: '',
                role: 'gestor',
                permissions: { trelica: true, trefila: true }
            };
            setCurrentUser(adminUser);
            setPage('menu');
            showNotification('Login realizado com sucesso (Modo Gestor).', 'success');
            return;
        }

        // Expect username to be email for Supabase
        const email = username.includes('@') ? username : `${username}@example.com`; // Fallback for legacy usernames

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            showNotification(`Erro ao entrar: ${error.message}`, 'error');
        }
    };

    const handleLogout = async (): Promise<void> => {
        await supabase.auth.signOut();
        setCurrentUser(null);
        setPage('login');
    };

    // Messaging System
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
        } catch (error) {
            showNotification('Erro ao enviar mensagem.', 'error');
        }
    };

    const markAllMessagesAsRead = async () => {
        setMessages(prev => prev.map(m => ({ ...m, isRead: true })));

        try {
            const unreadMessages = messages.filter(m => !m.isRead);
            for (const msg of unreadMessages) {
                await updateItem('messages', msg.id, { isRead: true });
            }
        } catch (error) {
            console.error("Failed to mark messages as read", error);
        }
    };

    // User Management
    const addUser = async (data: { username: string; password: string; permissions: Partial<Record<Page, boolean>> }) => {
        const email = data.username.includes('@') ? data.username : `${data.username}@example.com`;

        const { data: result, error } = await supabase.functions.invoke('create-user', {
            body: {
                email,
                password: data.password,
                userData: {
                    username: data.username,
                    role: 'user',
                    permissions: data.permissions
                }
            }
        });

        if (error) {
            showNotification(`Erro ao criar usuário: ${error.message}`, 'error');
            return;
        }

        // Optimistically update local state or fetch users again (if we had a list users function)
        // For now, we add to local state to reflect immediately in UI, although real source of truth is Supabase
        const newUser: User = {
            id: result.user.id,
            username: data.username,
            password: '', // Don't store password
            role: 'user',
            permissions: data.permissions,
        };
        setUsers(prev => [...prev, newUser]);
        showNotification('Usuário adicionado com sucesso!', 'success');
    };

    const updateUser = async (userId: string, data: Partial<User>) => {
        try {
            await updateItem<User>('profiles', userId, data);
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...data } : u));
            showNotification('Usuário atualizado com sucesso!', 'success');
        } catch (error) {
            showNotification('Erro ao atualizar usuário.', 'error');
        }
    };

    const deleteUser = async (userId: string) => {
        try {
            await deleteItem('profiles', userId);
            setUsers(prev => prev.filter(u => u.id !== userId));
            showNotification('Usuário removido com sucesso!', 'success');
        } catch (error) {
            showNotification('Erro ao remover usuário.', 'error');
        }
    };

    // Stock Control
    const addConference = async (data: ConferenceData) => {
        try {
            const savedConference = await insertItem<ConferenceData>('conferences', data);
            setConferences(prev => [...prev, savedConference]);

            // Also add stock items from conference
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
                history: [{
                    type: 'Entrada',
                    date: new Date().toISOString(),
                    details: {
                        action: 'Conferência de Recebimento',
                        weight: lot.scaleWeight
                    }
                }]
            }));

            for (const item of newStockItems) {
                await insertItem<StockItem>('stock_items', item);
            }
            setStock(prev => [...prev, ...newStockItems]);
            showNotification('Conferência salva e estoque atualizado com sucesso!', 'success');
        } catch (error) {
            showNotification('Erro ao salvar conferência.', 'error');
        }
    };

    const editConference = async (conferenceNumber: string, updatedData: ConferenceData) => {
        try {
            // Find the conference
            const conference = conferences.find(c => c.conferenceNumber === conferenceNumber);
            if (!conference) {
                showNotification('Conferência não encontrada.', 'error');
                return;
            }

            // Get all stock items from this conference
            const conferenceStockItems = stock.filter(item => item.conferenceNumber === conferenceNumber);

            // Check if any lot is in use (not Disponível or Disponível - Suporte Treliça)
            const lotsInUse = conferenceStockItems.filter(item =>
                item.status !== 'Disponível' &&
                item.status !== 'Disponível - Suporte Treliça'
            );

            if (lotsInUse.length > 0) {
                showNotification('Não é possível editar: alguns lotes estão em uso na produção.', 'error');
                return;
            }

            // Delete all old stock items associated with this conference directly from DB
            await deleteItemByColumn('stock_items', 'conference_number', conferenceNumber);

            // Update conference using conference_number column
            await updateItemByColumn<ConferenceData>('conferences', 'conference_number', conferenceNumber, updatedData);

            // Create new stock items
            const newStockItems: StockItem[] = updatedData.lots.map(lot => ({
                id: generateId('STOCK'),
                entryDate: updatedData.entryDate,
                supplier: updatedData.supplier,
                nfe: updatedData.nfe,
                conferenceNumber: updatedData.conferenceNumber,
                internalLot: lot.internalLot,
                supplierLot: lot.supplierLot,
                runNumber: lot.runNumber,
                materialType: lot.materialType,
                bitola: lot.bitola,
                labelWeight: lot.labelWeight,
                initialQuantity: lot.scaleWeight,
                remainingQuantity: lot.scaleWeight,
                status: 'Disponível',
                history: [{
                    type: 'Entrada (Editada)',
                    date: new Date().toISOString(),
                    details: {
                        action: 'Conferência Editada',
                        weight: lot.scaleWeight
                    }
                }]
            }));

            for (const item of newStockItems) {
                await insertItem<StockItem>('stock_items', item);
            }

            // Refresh data
            const updatedStock = await fetchTable<StockItem>('stock_items');
            setStock(updatedStock);
            const updatedConferences = await fetchTable<ConferenceData>('conferences');
            setConferences(updatedConferences);

            showNotification('Conferência editada com sucesso!', 'success');
        } catch (error: any) {
            console.error('Error editing conference:', error);
            showNotification(`Erro ao editar conferência: ${error.message || error}`, 'error');
        }
    };

    const deleteConference = async (conferenceNumber: string) => {
        try {
            // Get all stock items from this conference
            const conferenceStockItems = stock.filter(item => item.conferenceNumber === conferenceNumber);

            // Check if any lot is in use
            const lotsInUse = conferenceStockItems.filter(item =>
                item.status !== 'Disponível' &&
                item.status !== 'Disponível - Suporte Treliça'
            );

            if (lotsInUse.length > 0) {
                showNotification('Não é possível excluir: alguns lotes estão em uso na produção.', 'error');
                return;
            }

            // Delete all stock items associated with this conference directly from DB
            await deleteItemByColumn('stock_items', 'conference_number', conferenceNumber);

            // Delete conference using conference_number column
            await deleteItemByColumn('conferences', 'conference_number', conferenceNumber);

            // Refresh data
            const updatedStock = await fetchTable<StockItem>('stock_items');
            setStock(updatedStock);
            const updatedConferences = await fetchTable<ConferenceData>('conferences');
            setConferences(updatedConferences);

            showNotification('Conferência excluída com sucesso!', 'success');
        } catch (error: any) {
            console.error('Error deleting conference:', error);
            showNotification(`Erro ao excluir conferência: ${error.message || error}`, 'error');
        }
    };
    const addStockItem = async (item: StockItem) => {
        try {
            const savedItem = await insertItem<StockItem>('stock_items', item);
            setStock(prev => [...prev, savedItem]);
        } catch (error) {
            showNotification('Erro ao adicionar item ao estoque.', 'error');
        }
    };

    const updateStockItem = async (id: string, updates: Partial<StockItem>) => {
        try {
            const updatedItem = await updateItem<StockItem>('stock_items', id, updates);
            setStock(prev => prev.map(item => item.id === id ? updatedItem : item));
        } catch (error) {
            showNotification('Erro ao atualizar item do estoque.', 'error');
        }
    };
    const deleteStockItem = async (id: string) => {
        try {
            await deleteItem('stock_items', id);
            setStock(prev => prev.filter(item => item.id !== id));
            showNotification('Lote removido com sucesso!', 'success');
        } catch (error) {
            showNotification('Erro ao remover lote.', 'error');
        }
    };

    const createTransfer = async (destinationSector: string, lotsToTransfer: Map<string, number>): Promise<TransferRecord | null> => {
        if (!currentUser) return null;

        const transferredLotsInfo: TransferredLotInfo[] = [];
        const updates: { id: string, changes: Partial<StockItem> }[] = [];

        // Calculate updates first
        for (const item of stock) {
            if (lotsToTransfer.has(item.id)) {
                const transferQty = lotsToTransfer.get(item.id)!;
                if (transferQty > item.remainingQuantity || transferQty <= 0) continue;

                const remaining = item.remainingQuantity - transferQty;
                const newStatus = remaining <= 0 ? 'Transferido' : item.status;

                const newHistory = [...(item.history || []), {
                    type: `Transferência para ${destinationSector}`,
                    date: new Date().toISOString(),
                    details: {
                        'Quantidade Transferida': `${transferQty.toFixed(2)} kg`,
                        'Operador': currentUser.username,
                    }
                }];

                updates.push({
                    id: item.id,
                    changes: {
                        remainingQuantity: remaining,
                        status: newStatus as any,
                        history: newHistory
                    }
                });

                transferredLotsInfo.push({
                    lotId: item.id,
                    internalLot: item.internalLot,
                    materialType: item.materialType,
                    bitola: item.bitola,
                    transferredQuantity: transferQty,
                });
            }
        }

        if (transferredLotsInfo.length === 0) {
            showNotification('Nenhuma quantidade válida para transferir.', 'error');
            return null;
        }

        const newTransferRecord: TransferRecord = {
            id: generateId('transf-mp'),
            date: new Date().toISOString(),
            operator: currentUser.username,
            destinationSector,
            transferredLots: transferredLotsInfo,
        };

        try {
            // Save transfer record
            const savedTransfer = await insertItem<TransferRecord>('transfers', newTransferRecord);
            setTransfers(prev => [...prev, savedTransfer]);

            // Update stock items
            for (const update of updates) {
                await updateItem<StockItem>('stock_items', update.id, update.changes);
            }

            // Refresh stock
            const updatedStock = await fetchTable<StockItem>('stock_items');
            setStock(updatedStock);

            showNotification('Transferência realizada com sucesso!', 'success');
            return savedTransfer;
        } catch (error) {
            showNotification('Erro ao realizar transferência.', 'error');
            return null;
        }
    };

    const createFinishedGoodsTransfer = async (data: { destinationSector: string; otherDestination?: string; items: Map<string, number> }): Promise<FinishedGoodsTransferRecord | null> => {
        if (!currentUser) return null;

        const transferredItems: TransferredFinishedGoodInfo[] = [];
        const finishedGoodsUpdates: { id: string, changes: Partial<FinishedProductItem> }[] = [];
        const pontasUpdates: { id: string, changes: Partial<PontaItem> }[] = [];

        // Process Finished Goods
        for (const item of finishedGoods) {
            if (data.items.has(item.id)) {
                const transferQty = data.items.get(item.id)!;
                const weightPerPiece = item.totalWeight / item.quantity;
                const transferredWeight = weightPerPiece * transferQty;

                transferredItems.push({
                    productId: item.id,
                    productType: item.productType,
                    model: item.model,
                    size: item.size,
                    transferredQuantity: transferQty,
                    totalWeight: transferredWeight,
                });

                const newQuantity = item.quantity - transferQty;
                if (newQuantity > 0) {
                    finishedGoodsUpdates.push({
                        id: item.id,
                        changes: {
                            quantity: newQuantity,
                            totalWeight: item.totalWeight - transferredWeight
                        }
                    });
                } else {
                    finishedGoodsUpdates.push({
                        id: item.id,
                        changes: {
                            quantity: 0,
                            totalWeight: 0,
                            status: 'Transferido'
                        }
                    });
                }
            }
        }

        // Process Pontas
        for (const item of pontasStock) {
            if (data.items.has(item.id)) {
                const transferQty = data.items.get(item.id)!;
                const weightPerPiece = item.totalWeight / item.quantity;
                const transferredWeight = weightPerPiece * transferQty;

                transferredItems.push({
                    productId: item.id,
                    productType: item.productType,
                    model: item.model,
                    size: item.size,
                    transferredQuantity: transferQty,
                    totalWeight: transferredWeight,
                });

                const newQuantity = item.quantity - transferQty;
                if (newQuantity > 0) {
                    pontasUpdates.push({
                        id: item.id,
                        changes: {
                            quantity: newQuantity,
                            totalWeight: item.totalWeight - transferredWeight
                        }
                    });
                } else {
                    pontasUpdates.push({
                        id: item.id,
                        changes: {
                            quantity: 0,
                            totalWeight: 0,
                            status: 'Transferido'
                        }
                    });
                }
            }
        }

        if (transferredItems.length === 0) {
            showNotification('Nenhum item válido para transferir.', 'error');
            return null;
        }

        const newTransferRecord: FinishedGoodsTransferRecord = {
            id: generateId('transf-pa'),
            date: new Date().toISOString(),
            operator: currentUser.username,
            destinationSector: data.destinationSector,
            otherDestination: data.otherDestination,
            transferredItems,
        };

        try {
            const savedTransfer = await insertItem<FinishedGoodsTransferRecord>('finished_goods_transfers', newTransferRecord);
            setFinishedGoodsTransfers(prev => [...prev, savedTransfer]);

            for (const update of finishedGoodsUpdates) {
                await updateItem<FinishedProductItem>('finished_goods', update.id, update.changes);
            }
            for (const update of pontasUpdates) {
                await updateItem<PontaItem>('pontas_stock', update.id, update.changes);
            }

            const updatedFG = await fetchTable<FinishedProductItem>('finished_goods');
            setFinishedGoods(updatedFG);
            const updatedPontas = await fetchTable<PontaItem>('pontas_stock');
            setPontasStock(updatedPontas);
            showNotification('Transferência de produto acabado realizada com sucesso!', 'success');
            return savedTransfer;
        } catch (error) {
            showNotification('Erro ao realizar transferência.', 'error');
            return null;
        }
    };

    const addProductionOrder = async (orderData: Omit<ProductionOrderData, 'id' | 'status' | 'creationDate'>) => {
        const newOrder: ProductionOrderData = {
            ...orderData,
            id: generateId('op'),
            status: 'pending',
            creationDate: new Date().toISOString(),
            downtimeEvents: [],
            processedLots: [],
            operatorLogs: [],
            weighedPackages: [],
            pontas: []
        };

        try {
            const savedOrder = await insertItem<ProductionOrderData>('production_orders', newOrder);
            setProductionOrders(prev => [...prev, savedOrder]);

            // Update stock items status
            if (newOrder.machine === 'Trefila') {
                const lotIds = newOrder.selectedLotIds as string[];
                for (const lotId of lotIds) {
                    const stockItem = stock.find(s => s.id === lotId);
                    if (stockItem) {
                        await updateItem<StockItem>('stock_items', lotId, {
                            status: 'Em Produção - Trefila',
                            productionOrderIds: [...(stockItem.productionOrderIds || []), savedOrder.id]
                        });
                    }
                }
                const updatedStock = await fetchTable<StockItem>('stock_items');
                setStock(updatedStock);
            } else if (newOrder.machine === 'Treliça') {
                const lots = newOrder.selectedLotIds as TrelicaSelectedLots;

                let lotIds: string[] = [];
                if (lots.allSuperior && lots.allInferiorLeft && lots.allInferiorRight && lots.allSenozoideLeft && lots.allSenozoideRight) {
                    lotIds = [
                        ...lots.allSuperior,
                        ...lots.allInferiorLeft,
                        ...lots.allInferiorRight,
                        ...lots.allSenozoideLeft,
                        ...lots.allSenozoideRight
                    ];
                } else if (lots.allSuperior && lots.allInferior && lots.allSenozoide) {
                    lotIds = [...lots.allSuperior, ...lots.allInferior, ...lots.allSenozoide];
                } else {
                    lotIds = [lots.superior, lots.inferior1, lots.inferior2, lots.senozoide1, lots.senozoide2];
                }
                const uniqueLotIds = [...new Set(lotIds)];
                for (const lotId of uniqueLotIds) {
                    const stockItem = stock.find(s => s.id === lotId);
                    if (stockItem) {
                        await updateItem<StockItem>('stock_items', lotId, {
                            status: 'Em Produção - Treliça',
                            productionOrderIds: [...(stockItem.productionOrderIds || []), savedOrder.id]
                        });
                    }
                }
                const updatedStock = await fetchTable<StockItem>('stock_items');
                setStock(updatedStock);
            }

            showNotification('Ordem de produção criada com sucesso!', 'success');
        } catch (error) {
            showNotification('Erro ao criar ordem de produção.', 'error');
        }
    };

    const updateProductionOrder = async (orderId: string, updates: Partial<ProductionOrderData>) => {
        try {
            await updateItem('production_orders', orderId, updates);
            setProductionOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o));
            showNotification('Ordem de produção atualizada com sucesso!', 'success');
        } catch (error) {
            showNotification('Erro ao atualizar ordem de produção.', 'error');
        }
    };

    const deleteProductionOrder = async (orderId: string) => {
        try {
            const orderToDelete = productionOrders.find(o => o.id === orderId);
            if (!orderToDelete) return;

            let lotIds: string[] = [];
            if (orderToDelete.machine === 'Treliça' && !Array.isArray(orderToDelete.selectedLotIds)) {
                const lots = orderToDelete.selectedLotIds as TrelicaSelectedLots;
                if (lots.allSuperior && lots.allInferior && lots.allSenozoide) {
                    lotIds = [...lots.allSuperior, ...lots.allInferior, ...lots.allSenozoide];
                } else {
                    lotIds = [lots.superior, lots.inferior1, lots.inferior2, lots.senozoide1, lots.senozoide2];
                }
            } else {
                lotIds = Array.isArray(orderToDelete.selectedLotIds) ? orderToDelete.selectedLotIds : Object.values(orderToDelete.selectedLotIds) as string[];
            }

            // Update related stock items first
            for (const lotId of lotIds) {
                const stockItem = stock.find(s => s.id === lotId);
                if (stockItem) {
                    const newProductionOrderIds = (stockItem.productionOrderIds || []).filter(id => id !== orderId);
                    await updateItem<StockItem>('stock_items', lotId, {
                        status: newProductionOrderIds.length === 0 ? 'Disponível' : stockItem.status,
                        productionOrderIds: newProductionOrderIds.length > 0 ? newProductionOrderIds : undefined,
                    });
                }
            }

            await deleteItem('production_orders', orderId);
            setProductionOrders(prev => prev.filter(o => o.id !== orderId));

            // Refresh stock after updates
            const updatedStock = await fetchTable<StockItem>('stock_items');
            setStock(updatedStock);

            showNotification('Ordem de produção removida.', 'success');
        } catch (error) {
            showNotification('Erro ao remover ordem de produção.', 'error');
        }
    };

    // Machine Control Trefila
    const startProductionOrder = async (orderId: string) => {
        if (!currentUser) return;
        const now = new Date().toISOString();

        const newOrders = [...productionOrders];
        const newOrderIndex = newOrders.findIndex(o => o.id === orderId);
        if (newOrderIndex === -1) return;

        const orderToStartData = newOrders[newOrderIndex];
        const newOrderMachine = orderToStartData.machine;

        // Find and close any existing open shift for this user/machine
        const openShiftOrderIndex = newOrders.findIndex(o =>
            o.machine === newOrderMachine &&
            (o.operatorLogs || []).some(log => log.operator === currentUser.username && !log.endTime)
        );

        try {
            if (openShiftOrderIndex !== -1) {
                const openShiftOrder = { ...newOrders[openShiftOrderIndex] };
                openShiftOrder.operatorLogs = (openShiftOrder.operatorLogs || []).map(log =>
                    (log.operator === currentUser.username && !log.endTime) ? { ...log, endTime: now } : log
                );

                await updateItem('production_orders', openShiftOrder.id, { operatorLogs: openShiftOrder.operatorLogs });
                newOrders[openShiftOrderIndex] = openShiftOrder;
            }

            // Start the new order
            const updates: Partial<ProductionOrderData> = {
                status: 'in_progress',
                startTime: now,
                downtimeEvents: [...(orderToStartData.downtimeEvents || []), {
                    stopTime: now,
                    resumeTime: null,
                    reason: 'Aguardando Início da Produção'
                }]
            };

            if (openShiftOrderIndex !== -1) {
                updates.operatorLogs = [...(orderToStartData.operatorLogs || []), {
                    operator: currentUser.username,
                    startTime: now,
                    endTime: null
                }];
            }

            const updatedOrder = await updateItem('production_orders', orderToStartData.id, updates);
            newOrders[newOrderIndex] = updatedOrder;

            setProductionOrders(newOrders);
            showNotification('Ordem de produção iniciada.', 'success');
        } catch (error) {
            showNotification('Erro ao iniciar ordem de produção.', 'error');
        }
    };

    const startOperatorShift = async (orderId: string) => {
        if (!currentUser) return;
        const now = new Date().toISOString();

        const order = productionOrders.find(o => o.id === orderId);
        if (!order) return;

        const updates: Partial<ProductionOrderData> = {
            operatorLogs: [...(order.operatorLogs || []), { operator: currentUser.username, startTime: now, endTime: null }],
        };

        // For Treliça, automatically resume production when shift starts
        if (order.machine === 'Treliça') {
            const newEvents = [...(order.downtimeEvents || [])];
            let lastEventIndex = -1;
            for (let i = newEvents.length - 1; i >= 0; i--) {
                if (!newEvents[i].resumeTime) {
                    lastEventIndex = i;
                    break;
                }
            }
            if (lastEventIndex !== -1) {
                newEvents[lastEventIndex].resumeTime = now;
            }
            updates.downtimeEvents = newEvents;
        }

        try {
            const updatedOrder = await updateItem('production_orders', orderId, updates);
            setProductionOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
            showNotification('Turno iniciado.', 'success');
        } catch (error) {
            showNotification('Erro ao iniciar turno.', 'error');
        }
    };

    const generateShiftReport = async (order: ProductionOrderData, operatorLog: OperatorLog) => {
        if (!operatorLog.endTime) return;
        const shiftStart = new Date(operatorLog.startTime);
        const shiftEnd = new Date(operatorLog.endTime);

        const shiftDowntimeEvents = (order.downtimeEvents || []).filter(event => {
            const stop = new Date(event.stopTime);
            return stop >= shiftStart && stop < shiftEnd;
        });

        const shiftProcessedLots = (order.processedLots || []).filter(lot => {
            const end = new Date(lot.endTime);
            return end >= shiftStart && end < shiftEnd;
        });

        const totalProducedWeight = shiftProcessedLots.reduce((sum, lot) => sum + (lot.finalWeight || 0), 0);

        const totalScrapWeight = 0; // Simplified
        const scrapPercentage = totalProducedWeight > 0 ? (totalScrapWeight / (totalProducedWeight + totalScrapWeight)) * 100 : 0;

        const weightKg = totalProducedWeight;
        const bitolaMm = parseFloat(order.targetBitola);
        const steelDensityKgPerM3 = 7850;
        const radiusM = (bitolaMm / 1000) / 2;
        const areaM2 = Math.PI * Math.pow(radiusM, 2);
        const volumeM3 = weightKg / steelDensityKgPerM3;
        const totalProducedMeters = volumeM3 / areaM2;

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
            processedLots: shiftProcessedLots,
            downtimeEvents: shiftDowntimeEvents,
            totalProducedWeight,
            totalProducedMeters,
            totalScrapWeight,
            scrapPercentage,
        };

        try {
            const savedReport = await insertItem<ShiftReport>('shift_reports', report);
            setShiftReports(prev => [...prev, savedReport]);
        } catch (error) {
            showNotification('Erro ao salvar relatório de turno.', 'error');
        }
    };


    const endOperatorShift = async (orderId: string) => {
        if (!currentUser) return;

        const order = productionOrders.find(o => o.id === orderId);
        if (!order) return;

        let operatorLog: OperatorLog | undefined;
        const newLogs = [...(order.operatorLogs || [])];
        let lastLogIndex = -1;
        for (let i = newLogs.length - 1; i >= 0; i--) {
            if (newLogs[i].operator === currentUser?.username && !newLogs[i].endTime) {
                lastLogIndex = i;
                break;
            }
        }
        if (lastLogIndex !== -1) {
            newLogs[lastLogIndex].endTime = new Date().toISOString();
            operatorLog = newLogs[lastLogIndex];
        }

        const updates: Partial<ProductionOrderData> = { operatorLogs: newLogs };

        try {
            const updatedOrder = await updateItem('production_orders', orderId, updates);
            setProductionOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));

            if (operatorLog) {
                await generateShiftReport(updatedOrder, operatorLog);
            }
            showNotification('Turno finalizado.', 'success');
        } catch (error) {
            showNotification('Erro ao finalizar turno.', 'error');
        }
    };

    const logDowntime = async (orderId: string, reason: string) => {
        const now = new Date().toISOString();
        const order = productionOrders.find(o => o.id === orderId);
        if (!order) return;

        const newEvents = [...(order.downtimeEvents || [])];
        let lastEventIndex = -1;
        for (let i = newEvents.length - 1; i >= 0; i--) {
            if (!newEvents[i].resumeTime) {
                lastEventIndex = i;
                break;
            }
        }
        if (lastEventIndex !== -1) {
            newEvents[lastEventIndex].resumeTime = now;
        }
        newEvents.push({ stopTime: now, resumeTime: null, reason });

        const updates: Partial<ProductionOrderData> = { downtimeEvents: newEvents };

        try {
            const updatedOrder = await updateItem('production_orders', orderId, updates);
            setProductionOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
            showNotification('Parada registrada.', 'success');
        } catch (error) {
            showNotification('Erro ao registrar parada.', 'error');
        }
    };

    const logResumeProduction = async (orderId: string) => {
        const now = new Date().toISOString();
        const order = productionOrders.find(o => o.id === orderId);
        if (!order) return;

        const newEvents = [...(order.downtimeEvents || [])];
        let lastEventIndex = -1;
        for (let i = newEvents.length - 1; i >= 0; i--) {
            if (!newEvents[i].resumeTime) {
                lastEventIndex = i;
                break;
            }
        }
        if (lastEventIndex !== -1) {
            newEvents[lastEventIndex].resumeTime = now;
        }
        if ((!order.activeLotProcessing || !order.activeLotProcessing.lotId) && order.machine === 'Trefila') {
            newEvents.push({ stopTime: now, resumeTime: null, reason: 'Troca de Rolo / Preparação' });
        }

        const updates: Partial<ProductionOrderData> = { downtimeEvents: newEvents };

        try {
            const updatedOrder = await updateItem('production_orders', orderId, updates);
            setProductionOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
            showNotification('Produção retomada.', 'success');
        } catch (error) {
            showNotification('Erro ao retomar produção.', 'error');
        }
    };

    const startLotProcessing = async (orderId: string, lotId: string) => {
        const now = new Date().toISOString();
        const order = productionOrders.find(o => o.id === orderId);
        if (!order) return;

        const newEvents = [...(order.downtimeEvents || [])];
        let lastEventIndex = -1;
        for (let i = newEvents.length - 1; i >= 0; i--) {
            if (!newEvents[i].resumeTime) {
                lastEventIndex = i;
                break;
            }
        }
        if (lastEventIndex !== -1) {
            newEvents[lastEventIndex].resumeTime = now;
        }

        const updates: Partial<ProductionOrderData> = {
            activeLotProcessing: { lotId, startTime: now },
            downtimeEvents: newEvents
        };

        try {
            const updatedOrder = await updateItem('production_orders', orderId, updates);
            setProductionOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
            showNotification('Processamento de lote iniciado.', 'success');
        } catch (error) {
            showNotification('Erro ao iniciar lote.', 'error');
        }
    };

    const finishLotProcessing = async (orderId: string, lotId: string) => {
        const now = new Date().toISOString();
        const order = productionOrders.find(o => o.id === orderId);
        if (!order || order.activeLotProcessing?.lotId !== lotId) return;

        const processedLot: ProcessedLot = {
            lotId,
            finalWeight: null,
            startTime: order.activeLotProcessing.startTime,
            endTime: now,
        };
        const newDowntime: DowntimeEvent = {
            stopTime: now,
            resumeTime: null,
            reason: 'Troca de Rolo / Preparação'
        };

        const updates: Partial<ProductionOrderData> = {
            activeLotProcessing: { lotId: '', startTime: '' },
            processedLots: [...(order.processedLots || []), processedLot],
            downtimeEvents: [...(order.downtimeEvents || []), newDowntime]
        };

        try {
            const updatedOrder = await updateItem('production_orders', orderId, updates);
            setProductionOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
            showNotification('Processamento de lote finalizado.', 'success');
        } catch (error) {
            showNotification('Erro ao finalizar lote.', 'error');
        }
    };

    const completeProduction = async (orderId: string, finalData: { actualProducedQuantity?: number; scrapWeight?: number; pontas?: Ponta[] }) => {
        const now = new Date().toISOString();

        const orderToComplete = productionOrders.find(o => o.id === orderId);
        window.alert(`DEBUG: completeProduction INICIADO. ID: ${orderId}\nEncontrado: ${!!orderToComplete}\nMáquina: ${orderToComplete?.machine}`);

        if (!orderToComplete || orderToComplete.status === 'completed') {
            window.alert('DEBUG: Ordem não encontrada ou já completa.');
            return;
        }

        let updates: Partial<ProductionOrderData>;

        // Common completion logic
        const newEvents = [...(orderToComplete.downtimeEvents || [])];
        let lastEventIndex = -1;
        for (let i = newEvents.length - 1; i >= 0; i--) {
            if (!newEvents[i].resumeTime) {
                lastEventIndex = i;
                break;
            }
        }
        if (lastEventIndex !== -1) {
            newEvents[lastEventIndex].resumeTime = now;
        }

        if (orderToComplete.machine === 'Trefila') {
            const actualProducedWeight = (orderToComplete.processedLots || []).reduce((sum, lot) => sum + (lot.finalWeight || 0), 0);
            const totalInputWeight = (orderToComplete.processedLots || []).reduce((sum, processedLot) => {
                const originalLot = stock.find(s => s.id === processedLot.lotId);
                return sum + (originalLot?.labelWeight || 0);
            }, 0);
            const calculatedScrapWeight = totalInputWeight - actualProducedWeight;

            updates = {
                status: 'completed',
                endTime: now,
                downtimeEvents: newEvents,
                actualProducedWeight,
                scrapWeight: calculatedScrapWeight >= 0 ? calculatedScrapWeight : 0,
            };
        } else { // Treliça
            let actualProducedWeight = (orderToComplete.weighedPackages || []).reduce((sum, pkg) => sum + pkg.weight, 0);

            // Fallback: Use theoretical weight if no packages were weighed
            if ((actualProducedWeight === 0 || isNaN(actualProducedWeight)) && finalData.actualProducedQuantity && finalData.actualProducedQuantity > 0) {
                const modelInfo = trelicaModels.find(m => m.modelo === orderToComplete.trelicaModel && m.tamanho === orderToComplete.tamanho);
                if (modelInfo) {
                    actualProducedWeight = parseFloat(modelInfo.pesoFinal.replace(',', '.')) * finalData.actualProducedQuantity;
                }
            }

            updates = {
                status: 'completed',
                endTime: now,
                downtimeEvents: newEvents,
                actualProducedQuantity: finalData.actualProducedQuantity,
                pontas: finalData.pontas,
                actualProducedWeight,
            };
        }

        const completedOrder = { ...orderToComplete, ...updates } as ProductionOrderData;

        try {
            // 1. Update Production Order in Supabase
            const updatedOrder = await updateItem<ProductionOrderData>('production_orders', completedOrder.id, updates);
            setProductionOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));

            // 2. Update Stock in Supabase and Local State
            const stockUpdates: { id: string, changes: Partial<StockItem> }[] = [];

            if (completedOrder.machine === 'Trefila') {
                for (const item of stock) {
                    const processedLotData = (completedOrder.processedLots || []).find(pLot => pLot.lotId === item.id);
                    if (processedLotData) {
                        const finalWeight = processedLotData.finalWeight || 0;
                        stockUpdates.push({
                            id: item.id,
                            changes: {
                                materialType: 'CA-60', bitola: completedOrder.targetBitola, labelWeight: finalWeight,
                                initialQuantity: finalWeight, remainingQuantity: finalWeight, status: 'Disponível', productionOrderIds: undefined,
                                history: [...(item.history || []), {
                                    type: 'Transformado em CA-60', date: now,
                                    details: { 'Ordem': completedOrder.orderNumber, 'Bitola Original': item.bitola, 'Bitola Final': completedOrder.targetBitola, 'Peso Final (kg)': finalWeight.toFixed(2) }
                                }]
                            }
                        });
                    }
                }
            } else if (completedOrder.machine === 'Treliça' || completedOrder.machine === 'Trelica') {
                console.log('Finalizando Ordem Treliça:', completedOrder);

                const fullPiecesQty = completedOrder.actualProducedQuantity || 0;
                let lots: TrelicaSelectedLots;

                if (Array.isArray(completedOrder.selectedLotIds)) {
                    const arr = completedOrder.selectedLotIds as string[];
                    lots = {
                        superior: arr[0] || '',
                        inferior1: arr[1] || '',
                        inferior2: arr[2] || '',
                        senozoide1: arr[3] || '',
                        senozoide2: arr[4] || '',
                        allSuperior: arr[0] ? [arr[0]] : [],
                        allInferiorLeft: arr[1] ? [arr[1]] : [],
                        allInferiorRight: arr[2] ? [arr[2]] : [],
                        allSenozoideLeft: arr[3] ? [arr[3]] : [],
                        allSenozoideRight: arr[4] ? [arr[4]] : [],
                    };
                } else {
                    lots = completedOrder.selectedLotIds as TrelicaSelectedLots;
                }

                // Debug lots
                console.log('Lotes Selecionados para Consumo:', lots);

                const consumedMap = new Map<string, number>();

                // Find model info to calculate weights - Relaxed comparison
                const modelInfo = trelicaModels.find(m =>
                    m.modelo === completedOrder.trelicaModel &&
                    String(m.tamanho) === String(completedOrder.tamanho)
                );

                console.log('Modelo encontrado:', modelInfo ? 'Sim' : 'Não', modelInfo);

                if (!modelInfo && fullPiecesQty > 0) {
                    showNotification(`Erro CRÍTICO: Modelo de treliça não encontrado. (${completedOrder.trelicaModel} - ${completedOrder.tamanho})`, 'error');
                }

                if (modelInfo) {
                    const parse = (s: string) => parseFloat(s.replace(',', '.'));
                    const consumedFull = {
                        superior: parse(modelInfo.pesoSuperior) * fullPiecesQty,
                        inferior: parse(modelInfo.pesoInferior) * fullPiecesQty,
                        senozoide: parse(modelInfo.pesoSenozoide) * fullPiecesQty,
                    };

                    // Calculate Pontas Consumption
                    const consumedPontas = { superior: 0, inferior: 0, senozoide: 0 };
                    if (completedOrder.pontas) {
                        for (const ponta of completedOrder.pontas) {
                            const totalModelWeight = parse(modelInfo.pesoFinal);
                            if (totalModelWeight > 0) {
                                consumedPontas.superior += (parse(modelInfo.pesoSuperior) / totalModelWeight) * ponta.totalWeight;
                                consumedPontas.inferior += (parse(modelInfo.pesoInferior) / totalModelWeight) * ponta.totalWeight;
                                consumedPontas.senozoide += (parse(modelInfo.pesoSenozoide) / totalModelWeight) * ponta.totalWeight;
                            }
                        }
                    }

                    const totalConsumed = {
                        superior: consumedFull.superior + consumedPontas.superior,
                        inferior: consumedFull.inferior + consumedPontas.inferior,
                        senozoide: consumedFull.senozoide + consumedPontas.senozoide,
                    };

                    console.log('Total Consumido Calculado:', totalConsumed);

                    if (fullPiecesQty > 0 && (totalConsumed.superior + totalConsumed.inferior + totalConsumed.senozoide) <= 0.001) {
                        showNotification('Aviso: Quantidade produzida > 0 mas consumo calculado é 0.', 'error');
                    }

                    const distributeConsumption = (lotIds: string[] | undefined, totalWeight: number) => {
                        if (!lotIds || lotIds.length === 0) return;
                        let remainingWeight = totalWeight;
                        for (const lotId of lotIds) {
                            if (remainingWeight <= 0.0001) break;
                            const stockItem = stock.find(s => s.id === lotId);
                            if (!stockItem) {
                                console.warn('Lote não encontrado no estoque:', lotId);
                                showNotification(`Aviso: Lote ID ${lotId} não encontrado no estoque carregado.`, 'error');
                                continue;
                            }

                            const alreadyConsumed = consumedMap.get(lotId) || 0;
                            const available = Math.max(0, stockItem.remainingQuantity - alreadyConsumed);
                            const toConsume = Math.min(remainingWeight, available);

                            if (toConsume > 0) {
                                consumedMap.set(lotId, alreadyConsumed + toConsume);
                                remainingWeight -= toConsume;
                            }
                        }
                        // Force remaining on last lot if needed
                        if (remainingWeight > 0.0001 && lotIds.length > 0) {
                            const lastLotId = lotIds[lotIds.length - 1];
                            consumedMap.set(lastLotId, (consumedMap.get(lastLotId) || 0) + remainingWeight);
                        }
                    };

                    // Distribute logic
                    const superiorLots = lots.allSuperior || (lots.superior ? [lots.superior] : []);
                    distributeConsumption(superiorLots, totalConsumed.superior);

                    const halfInferiorWeight = totalConsumed.inferior / 2;
                    const halfSenozoideWeight = totalConsumed.senozoide / 2;

                    if (lots.allInferiorLeft && lots.allInferiorRight) {
                        distributeConsumption(lots.allInferiorLeft, halfInferiorWeight);
                        distributeConsumption(lots.allInferiorRight, halfInferiorWeight);
                    } else if (lots.allInferior) {
                        distributeConsumption(lots.allInferior, totalConsumed.inferior);
                    } else {
                        distributeConsumption([lots.inferior1].filter(Boolean), halfInferiorWeight);
                        distributeConsumption([lots.inferior2].filter(Boolean), halfInferiorWeight);
                    }

                    if (lots.allSenozoideLeft && lots.allSenozoideRight) {
                        distributeConsumption(lots.allSenozoideLeft, halfSenozoideWeight);
                        distributeConsumption(lots.allSenozoideRight, halfSenozoideWeight);
                    } else if (lots.allSenozoide) {
                        distributeConsumption(lots.allSenozoide, totalConsumed.senozoide);
                    } else {
                        distributeConsumption([lots.senozoide1].filter(Boolean), halfSenozoideWeight);
                        distributeConsumption([lots.senozoide2].filter(Boolean), halfSenozoideWeight);
                    }

                    console.log('Consumed Map Final:', Object.fromEntries(consumedMap));

                    // Collect involved IDs
                    const allInvolvedLotIds = [
                        ...(lots.allSuperior || []),
                        ...(lots.superior ? [lots.superior] : []),
                        ...(lots.allInferiorLeft || []),
                        ...(lots.allInferiorRight || []),
                        ...(lots.allInferior || []),
                        ...(lots.inferior1 ? [lots.inferior1] : []),
                        ...(lots.inferior2 ? [lots.inferior2] : []),
                        ...(lots.allSenozoideLeft || []),
                        ...(lots.allSenozoideRight || []),
                        ...(lots.allSenozoide || []),
                        ...(lots.senozoide1 ? [lots.senozoide1] : []),
                        ...(lots.senozoide2 ? [lots.senozoide2] : []),
                    ];
                    const uniqueInvolvedLotIds = [...new Set(allInvolvedLotIds)].filter(Boolean);

                    if (uniqueInvolvedLotIds.length === 0) {
                        showNotification('Aviso: Nenhum lote foi identificado para consumo.', 'error');
                    }

                    for (const lotId of uniqueInvolvedLotIds) {
                        const stockItem = stock.find(s => s.id === lotId);
                        if (stockItem) {
                            const consumedQty = consumedMap.get(stockItem.id) || 0;
                            const newRemainingQty = Math.max(0, stockItem.remainingQuantity - consumedQty);
                            const remainingOrderIds = (stockItem.productionOrderIds || []).filter(id => id !== orderId);

                            const hasOtherActiveOrders = remainingOrderIds.some(otherId => {
                                const otherOrder = productionOrders.find(o => o.id === otherId);
                                return otherOrder && (otherOrder.status === 'pending' || otherOrder.status === 'in_progress');
                            });

                            console.log(`Atualizando lote ${stockItem.internalLot} (ID: ${stockItem.id}): Consumido=${consumedQty}, Restante=${newRemainingQty}`);

                            // Determine status explicitly
                            let newStatus: any = 'Disponível - Suporte Treliça';
                            if (newRemainingQty <= 0.01) {
                                newStatus = 'Consumido para fazer treliça';
                            } else if (hasOtherActiveOrders) {
                                newStatus = stockItem.status; // Keep current status if active elsewhere
                            }

                            const historyEntry = consumedQty > 0 ? {
                                type: 'Consumido na Produção de Treliça',
                                date: now,
                                details: { 'Ordem': completedOrder.orderNumber, 'Qtd Consumida': consumedQty.toFixed(2) }
                            } : null;

                            const newHistory = historyEntry ? [...(stockItem.history || []), historyEntry] : stockItem.history;

                            stockUpdates.push({
                                id: stockItem.id,
                                changes: {
                                    remainingQuantity: newRemainingQty,
                                    labelWeight: newRemainingQty,
                                    productionOrderIds: remainingOrderIds.length > 0 ? remainingOrderIds : undefined,
                                    status: newStatus,
                                    history: newHistory
                                }
                            });
                        } else {
                            console.warn('Lote envolvido não encontrado no cadastro de estoque:', lotId);
                            showNotification(`Aviso: Lote ID ${lotId} não encontrado no estoque para atualização.`, 'error');
                        }
                    }
                }
            }

            console.log('Stock updates to be applied:', stockUpdates);

            for (const update of stockUpdates) {
                await updateItem<StockItem>('stock_items', update.id, update.changes);
            }
            // Refresh stock
            const updatedStock = await fetchTable<StockItem>('stock_items');
            setStock(updatedStock);


            // 3. Create Pontas (Treliça)
            if (completedOrder.machine === 'Treliça') {
                const newPontaItems: PontaItem[] = (completedOrder.pontas || []).map(ponta => ({
                    id: generateId('ponta'),
                    productionDate: now,
                    productionOrderId: completedOrder.id,
                    orderNumber: completedOrder.orderNumber,
                    productType: 'Ponta de Treliça',
                    model: completedOrder.trelicaModel!,
                    size: `${ponta.size}`,
                    quantity: ponta.quantity,
                    totalWeight: ponta.totalWeight,
                    status: 'Disponível',
                }));

                if (newPontaItems.length > 0) {
                    for (const item of newPontaItems) {
                        await insertItem<PontaItem>('pontas_stock', item);
                    }
                    setPontasStock(prev => [...prev, ...newPontaItems].sort((a, b) => new Date(b.productionDate).getTime() - new Date(a.productionDate).getTime()));
                }
            }

            // 4. Create Finished Goods (Treliça)
            // Calculate final weight with fallback BEFORE checking if we should create the item
            let finalFinishedWeight = completedOrder.actualProducedWeight || 0;

            const isTrelica = completedOrder.machine === 'Treliça' || completedOrder.machine === 'Trelica';

            if (isTrelica && finalFinishedWeight <= 0 && completedOrder.actualProducedQuantity && completedOrder.actualProducedQuantity > 0) {
                const modelInfo = trelicaModels.find(m => m.modelo === completedOrder.trelicaModel && String(m.tamanho) === String(completedOrder.tamanho));
                if (modelInfo) {
                    finalFinishedWeight = parseFloat(modelInfo.pesoFinal.replace(',', '.')) * completedOrder.actualProducedQuantity;
                }
            }

            // Now check if we have a valid weight to proceed
            if (isTrelica && finalFinishedWeight > 0) {
                const newFinishedProduct: FinishedProductItem = {
                    id: generateId('fg'),
                    productionDate: now,
                    productionOrderId: completedOrder.id,
                    orderNumber: completedOrder.orderNumber,
                    productType: 'Treliça',
                    model: completedOrder.trelicaModel || 'Desconhecido',
                    size: completedOrder.tamanho || '0',
                    quantity: completedOrder.actualProducedQuantity || 0,
                    totalWeight: finalFinishedWeight || 0,
                    status: 'Disponível',
                };

                try {
                    await insertItem<FinishedProductItem>('finished_goods', newFinishedProduct);
                    setFinishedGoods(prev => [...prev, newFinishedProduct].sort((a, b) => new Date(b.productionDate).getTime() - new Date(a.productionDate).getTime()));
                    // Ensure we are redirecting or notifying correctly if needed
                } catch (fgError: any) {
                    console.error('Erro ao salvar Produto Acabado:', fgError);
                    showNotification('Aviso: Ordem finalizada, mas houve erro ao salvar no Estoque de Produto Acabado: ' + (fgError.message || 'Erro desconhecido'), 'error');
                }
            } else {
                if (isTrelica) {
                    console.warn('Ignorando criação de Produto Acabado: Peso produzido é 0 ou inválido.', completedOrder);
                    showNotification('Aviso: Produto Acabado não criado. Peso calculado é 0 ou inválido.', 'error');
                }
            }

            console.log('Stock updates to be applied:', stockUpdates);
            for (const update of stockUpdates) {
                // Se ainda houver quantidade restante, marca como suporte; caso contrário, marca como usado para fazer treliça
                const changes = {
                    ...update.changes,
                    status: ((update.changes.remainingQuantity && update.changes.remainingQuantity > 0)
                        ? 'Disponível - Suporte Treliça'
                        : 'Consumido para fazer treliça') as any,
                };
                await updateItem<StockItem>('stock_items', update.id, changes);
            }

            showNotification(`Ordem ${completedOrder.orderNumber} finalizada com sucesso.`, 'success');

        } catch (error: any) {
            console.error('Erro fatal ao finalizar ordem:', error);
            showNotification('Erro ao finalizar ordem de produção: ' + (error.message || 'Erro desconhecido'), 'error');
        }
    };


    const recordLotWeight = async (orderId: string, lotId: string, finalWeight: number, measuredGauge?: number) => {
        const order = productionOrders.find(o => o.id === orderId);
        if (!order) return;

        const newProcessedLots = (order.processedLots || []).map(p =>
            p.lotId === lotId ? { ...p, finalWeight, measuredGauge } : p
        );
        const updates: Partial<ProductionOrderData> = { processedLots: newProcessedLots };

        try {
            const updatedOrder = await updateItem('production_orders', orderId, updates);
            setProductionOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
            showNotification('Peso do lote registrado com sucesso.', 'success');
        } catch (error) {
            showNotification('Erro ao registrar peso do lote.', 'error');
        }
    };

    const recordPackageWeight = async (orderId: string, packageData: { packageNumber: number; quantity: number; weight: number; }) => {
        const now = new Date().toISOString();
        const order = productionOrders.find(o => o.id === orderId);
        if (!order) return;

        const newPackage: WeighedPackage = { ...packageData, timestamp: now };
        const existingPackages = order.weighedPackages || [];
        const otherPackages = existingPackages.filter(p => p.packageNumber !== packageData.packageNumber);
        const newWeighedPackages = [...otherPackages, newPackage].sort((a, b) => a.packageNumber - b.packageNumber);

        const updates: Partial<ProductionOrderData> = { weighedPackages: newWeighedPackages };

        try {
            const updatedOrder = await updateItem('production_orders', orderId, updates);
            setProductionOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
            showNotification(`Peso do pacote #${packageData.packageNumber} registrado com sucesso.`, 'success');
        } catch (error) {
            showNotification('Erro ao registrar pacote.', 'error');
        }
    };

    const updateProducedQuantity = async (orderId: string, quantity: number) => {
        try {
            await updateItem('production_orders', orderId, { actualProducedQuantity: quantity });
            setProductionOrders(prev => prev.map(o => {
                if (o.id === orderId) {
                    return { ...o, actualProducedQuantity: quantity };
                }
                return o;
            }));
            showNotification('Contagem de peças atualizada.', 'success');
        } catch (error) {
            showNotification('Erro ao atualizar contagem.', 'error');
        }
    };

    const addPartsRequest = async (data: Omit<PartsRequest, 'id' | 'date' | 'operator' | 'status'>) => {
        if (!currentUser) return;
        const activeOrder = productionOrders.find(o => o.status === 'in_progress');
        if (!activeOrder) return;
        const newRequest: PartsRequest = {
            ...data,
            id: generateId('part'),
            date: new Date().toISOString(),
            operator: currentUser.username,
            status: 'Pendente',
            machine: activeOrder.machine,
            productionOrderId: activeOrder.id,
        };
        try {
            const savedRequest = await insertItem<PartsRequest>('parts_requests', newRequest);
            setPartsRequests(prev => [...prev, savedRequest]);
            showNotification('Solicitação de peças enviada.', 'success');
        } catch (error) {
            showNotification('Erro ao enviar solicitação de peças.', 'error');
        }
    };

    const logPostProductionActivity = async (activity: string) => {
        if (!currentUser) return;

        let targetOrderIndex = -1;
        let latestEndTime = 0;

        productionOrders.forEach((order, index) => {
            if (order.status === 'completed' && order.endTime) {
                const orderEndTime = new Date(order.endTime).getTime();
                const hasOpenLog = (order.operatorLogs || []).some(log => log.operator === currentUser.username && !log.endTime);

                if (hasOpenLog && orderEndTime > latestEndTime) {
                    latestEndTime = orderEndTime;
                    targetOrderIndex = index;
                }
            }
        });

        if (targetOrderIndex !== -1) {
            const targetOrder = { ...productionOrders[targetOrderIndex] };
            const logsCopy = [...(targetOrder.operatorLogs || [])];
            const logIndex = logsCopy.findIndex(log => log.operator === currentUser.username && !log.endTime);

            if (logIndex !== -1) {
                const updatedLog = { ...logsCopy[logIndex] };
                if (!updatedLog.postProductionActivities) {
                    updatedLog.postProductionActivities = [];
                }
                updatedLog.postProductionActivities.push({
                    timestamp: new Date().toISOString(),
                    description: activity
                });
                logsCopy[logIndex] = updatedLog;

                try {
                    const updatedOrder = await updateItem('production_orders', targetOrder.id, { operatorLogs: logsCopy });
                    setProductionOrders(prev => {
                        const newOrders = [...prev];
                        newOrders[targetOrderIndex] = updatedOrder;
                        return newOrders;
                    });
                    showNotification('Atividade registrada com sucesso.', 'success');
                } catch (error) {
                    showNotification('Erro ao registrar atividade.', 'error');
                }
            }
        }
    };

    // Machine Control Treliça
    const registerProduction = async (machine: MachineType, producedWeight: number) => {
        const newRecord: ProductionRecord = {
            id: generateId('prod'),
            date: new Date().toISOString(),
            machine,
            producedWeight,
            consumedLots: [], // Simplified for this implementation
        };
        try {
            const savedRecord = await insertItem<ProductionRecord>('production_records', newRecord);
            if (machine === 'Trefila') {
                setTrefilaProduction(prev => [...prev, savedRecord]);
            } else {
                setTrelicaProduction(prev => [...prev, savedRecord]);
            }
            showNotification(`Produção de ${producedWeight.toFixed(2)} kg registrada para ${machine}.`, 'success');
        } catch (error) {
            showNotification('Erro ao registrar produção.', 'error');
        }
    };

    const deleteFinishedGoods = async (ids: string[]) => {
        if (!confirm('Tem certeza que deseja excluir os itens selecionados?')) return;

        try {
            for (const id of ids) {
                await deleteItem('finished_goods', id);
            }
            setFinishedGoods(prev => prev.filter(item => !ids.includes(item.id)));

            // Check if any ID is in pontasStock and delete if necessary
            const pontasToDelete = pontasStock.filter(p => ids.includes(p.id));
            if (pontasToDelete.length > 0) {
                for (const p of pontasToDelete) {
                    await deleteItem('pontas_stock', p.id);
                }
                setPontasStock(prev => prev.filter(p => !ids.includes(p.id)));
            }
            showNotification('Itens excluídos com sucesso.', 'success');
        } catch (error: any) {
            console.error('Error deleting finished goods:', error);
            showNotification('Erro ao excluir itens: ' + error.message, 'error');
        }
    };

    const renderPage = () => {
        const machineControlProps = {
            setPage, stock, currentUser, registerProduction, productionOrders, shiftReports,
            startProductionOrder, startOperatorShift, endOperatorShift, logDowntime,
            logResumeProduction, startLotProcessing, finishLotProcessing, recordLotWeight,
            addPartsRequest, logPostProductionActivity, completeProduction, recordPackageWeight,
            updateProducedQuantity, messages, addMessage
        };

        switch (page) {
            case 'login':
                return <Login onLogin={handleLogin} error={notification?.type === 'error' ? notification.message : null} />;
            case 'menu':
                return <MainMenu setPage={setPage} onLogout={handleLogout} currentUser={currentUser} messages={messages} markAllMessagesAsRead={markAllMessagesAsRead} addMessage={addMessage} />;
            case 'stock':
                return <StockControl stock={stock} conferences={conferences} transfers={transfers} setPage={setPage} addConference={addConference} deleteStockItem={deleteStockItem} updateStockItem={(item) => updateStockItem(item.id, item)} createTransfer={createTransfer} editConference={editConference} deleteConference={deleteConference} />;
            case 'trefila':
                return <MachineControl machineType="Trefila" {...machineControlProps} />;
            case 'trelica':
                return <MachineControl machineType="Treliça" {...machineControlProps} users={users} />;
            case 'machineSelection':
                return <MachineSelection setPage={setPage} />;
            case 'productionOrder':
                return <ProductionOrder setPage={setPage} stock={stock} productionOrders={productionOrders} addProductionOrder={addProductionOrder} showNotification={showNotification} updateProductionOrder={updateProductionOrder} deleteProductionOrder={deleteProductionOrder} />;
            case 'productionOrderTrelica':
                return <ProductionOrderTrelica setPage={setPage} stock={stock} productionOrders={productionOrders} addProductionOrder={addProductionOrder} showNotification={showNotification} updateProductionOrder={updateProductionOrder} deleteProductionOrder={deleteProductionOrder} />;
            case 'productionDashboard':
                return <ProductionDashboard setPage={setPage} productionOrders={productionOrders} stock={stock} currentUser={currentUser} />;
            case 'reports':
                return <Reports setPage={setPage} stock={stock} trefilaProduction={trefilaProduction} trelicaProduction={trelicaProduction} />;
            case 'userManagement':
                return <UserManagement users={users} addUser={addUser} updateUser={updateUser} deleteUser={deleteUser} setPage={setPage} />;
            case 'finishedGoods':
                return <FinishedGoods finishedGoods={finishedGoods} pontasStock={pontasStock} setPage={setPage} finishedGoodsTransfers={finishedGoodsTransfers} createFinishedGoodsTransfer={createFinishedGoodsTransfer} onDelete={deleteFinishedGoods} />;
            case 'partsManager':
                return <SparePartsManager onBack={() => setPage('menu')} />;
            default:
                return <Login onLogin={handleLogin} error={null} />;
        }
    };

    return (
        <div className="bg-slate-100 min-h-screen">
            {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
            {renderPage()}
            <RealtimeStatus />
        </div>
    );
};

export default App;