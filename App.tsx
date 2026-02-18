import React, { useState, useEffect, useMemo } from 'react'; // Refresh Trigger
import type { Page, User, Employee, StockItem, ConferenceData, ProductionOrderData, TransferRecord, Bitola, MachineType, PartsRequest, ShiftReport, ProductionRecord, TransferredLotInfo, ProcessedLot, DowntimeEvent, OperatorLog, TrelicaSelectedLots, WeighedPackage, FinishedProductItem, Ponta, PontaItem, FinishedGoodsTransferRecord, TransferredFinishedGoodInfo, KaizenProblem, InventorySession, Meeting, MeetingItem } from './types';
import { FioMaquinaBitolaOptions, TrefilaBitolaOptions } from './types';
import Login from './components/Login';
import MainMenu from './components/MainMenu';
import StockControl from './components/StockControl';
import MachineControl from './components/MachineControl';
import ProductionOrder from './components/ProductionOrder';
import ProductionOrderTrelica from './components/ProductionOrderTrelica';
import Reports from './components/Reports';
import UserManagement from './components/UserManagement';
import Notification from './components/Notification';
import Sidebar from './components/Sidebar';
import ProductionDashboard from './components/ProductionDashboard';
import { trelicaModels } from './components/ProductionOrderTrelica';
import FinishedGoods from './components/FinishedGoods';
import SparePartsManager from './components/SparePartsManager';
import ContinuousImprovement from './components/ContinuousImprovement';
import WorkInstructions from './components/WorkInstructions';
import PeopleManagement from './components/PeopleManagement';

import StockInventory from './components/StockInventory';
import StockTransfer from './components/StockTransfer';
import GaugesManager from './components/GaugesManager';
import TrefilaWeighing from './components/TrefilaWeighing';
import StickyNotes from './components/StickyNotes';
import MeetingsTasks from './components/MeetingsTasks';
import { supabase } from './supabaseClient';
import type { StockGauge, StickyNote } from './types';

import { fetchTable, insertItem, updateItem, deleteItem, deleteItemByColumn, updateItemByColumn, mapToCamelCase, fetchByColumn } from './services/supabaseService';
import { useAllRealtimeSubscriptions } from './hooks/useSupabaseRealtime';

const generateId = (prefix: string) => `${prefix.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const App: React.FC = () => {
    const [page, setPage] = useState<Page>('login');
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
    const [loading, setLoading] = useState(true);

    const [users, setUsers] = useState<User[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
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
    const [inventorySessions, setInventorySessions] = useState<InventorySession[]>([]);
    const [gauges, setGauges] = useState<StockGauge[]>([]);
    const [stickyNotes, setStickyNotes] = useState<StickyNote[]>([]);
    const [meetings, setMeetings] = useState<Meeting[]>([]);

    const [pendingKaizenCount, setPendingKaizenCount] = useState(0);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);



    useEffect(() => {
        if (currentUser?.employeeId) {
            const checkTasks = async () => {
                try {
                    const allProblems = await fetchTable<KaizenProblem>('kaizen_problems');
                    const myTasks = allProblems.filter(p => {
                        const isResponsibleId = p.responsibleIds?.includes(currentUser.employeeId!);
                        const isResponsibleName = p.responsible && currentUser.username && p.responsible.includes(currentUser.username);
                        return (isResponsibleId || isResponsibleName) && p.status !== 'Resolvido';
                    });
                    setPendingKaizenCount(myTasks.length);
                } catch (e) {
                    console.error('Error fetching pending tasks for menu', e);
                }
            };
            checkTasks();
        }
    }, [currentUser, page]); // Refresh when page changes too

    useEffect(() => {
        const loadData = async () => {
            try {
                const [
                    fetchedUsers, fetchedEmployees, fetchedStock, fetchedConferences, fetchedTransfers,
                    fetchedOrders, fetchedFinishedGoods, fetchedPontas, fetchedFGTransfers,
                    fetchedParts, fetchedReports, fetchedProductionRecords, fetchedInvSessions, fetchedGauges, fetchedNotes, fetchedMeetings
                ] = await Promise.all([
                    fetchTable<User>('app_users'),
                    fetchTable<Employee>('employees'),
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
                    fetchTable<InventorySession>('inventory_sessions').catch(() => []),
                    fetchTable<StockGauge>('stock_gauges').catch(() => []),
                    fetchTable<StickyNote>('sticky_notes').catch(() => []),
                    fetchTable<Meeting>('meetings').catch(() => [])
                ]);

                setUsers(fetchedUsers);
                setEmployees(fetchedEmployees);
                setStock(fetchedStock);
                setConferences(fetchedConferences);
                setTransfers(fetchedTransfers);
                setProductionOrders(fetchedOrders);
                setFinishedGoods(fetchedFinishedGoods);
                setPontasStock(fetchedPontas);
                setFinishedGoodsTransfers(fetchedFGTransfers);
                setPartsRequests(fetchedParts);
                setShiftReports(fetchedReports);
                setInventorySessions(fetchedInvSessions);
                setGauges(fetchedGauges || []);
                setStickyNotes(fetchedNotes || []);
                setMeetings(fetchedMeetings || []);

                // Split production records
                setTrefilaProduction(fetchedProductionRecords.filter(r => r.machine === 'Trefila'));
                setTrelicaProduction(fetchedProductionRecords.filter(r => r.machine === 'Treliça'));


            } catch (error) {
                console.error("Failed to load data from Supabase", error);
                showNotification("Erro ao carregar dados do servidor.", 'error');
            }
        };

        if (currentUser) {
            loadData();
        }
    }, [currentUser]);

    const showNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
        setNotification({ message, type });
    };

    // Supabase Realtime - Atualiza dados automaticamente quando há mudanças no banco
    // Supabase Realtime - Atualiza dados automaticamente quando há mudanças no banco
    const realtimeSetters = useMemo(() => ({
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
        setInventorySessions,
        setGauges,
        setStickyNotes,
        setMeetings,
    }), []);

    useAllRealtimeSubscriptions(realtimeSetters, !!currentUser);

    useEffect(() => {
        // Load stored user from localStorage if exists
        const storedUser = localStorage.getItem('msm_user');
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                setCurrentUser(user);
                // If we have a stored user, direct them to dashboard unless they were already on a specific page
                // (Using dashboard as safe default)
                if (page === 'login') {
                    setPage(user.role === 'gestor' || user.role === 'admin' ? 'productionDashboard' : 'menu');
                }
            } catch (e) {
                console.error("Failed to parse stored user", e);
                localStorage.removeItem('msm_user');
            }
        }

        // Check active Supabase session (for hybrid support)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                handleUserSession(session.user);
            }
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                handleUserSession(session.user);
            } else if (!_event.includes('SIGNED_IN') && !localStorage.getItem('msm_user')) {
                // Only reset if no custom session exists either
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
            role: role,
            permissions: { trelica: true, trefila: true }
        };
        setCurrentUser(appUser);
        localStorage.setItem('msm_user', JSON.stringify(appUser));
        setPage(role === 'gestor' ? 'productionDashboard' : 'menu');
    };

    const handleLogin = async (username: string, password: string): Promise<void> => {
        try {
            // 1. Try Simple Auth (app_users table)
            const { data: usersFound, error: dbError } = await supabase
                .from('app_users')
                .select('*')
                .eq('username', username)
                .single();

            if (usersFound && usersFound.password === password) {
                const appUser = mapToCamelCase(usersFound) as User;
                setCurrentUser(appUser);
                localStorage.setItem('msm_user', JSON.stringify(appUser));
                setPage(appUser.role === 'gestor' || appUser.role === 'admin' ? 'productionDashboard' : 'menu');
                showNotification(`Bem - vindo, ${appUser.username} !`, 'success');
                return;
            }

            // 2. Legacy/Admin Hardcoded Fallback
            if ((username.toLowerCase() === 'gestor' || username.toLowerCase() === 'matheusmiranda357@gmail.com') && password === '070223') {
                const adminUser: User = {
                    id: 'local-admin-gestor',
                    username: 'Matheus Miranda',
                    password: '',
                    role: 'gestor',
                    permissions: { trelica: true, trefila: true }
                };
                setCurrentUser(adminUser);
                localStorage.setItem('msm_user', JSON.stringify(adminUser));
                setPage('productionDashboard');
                showNotification('Login realizado com sucesso (Modo Gestor).', 'success');
                return;
            }

            showNotification('Usuário ou senha incorretos.', 'error');

        } catch (error: any) {
            console.error('Login error:', error);
            showNotification('Erro ao tentar realizar login. Verifique sua conexão.', 'error');
        }
    };

    const handleLogout = async (): Promise<void> => {
        localStorage.removeItem('msm_user');
        setCurrentUser(null);
        setPage('login');
    };



    // User Management
    const addUser = async (data: { username: string; password: string; permissions: Partial<Record<Page, boolean>>; role: string; employeeId?: string }) => {
        const newUser: User = {
            id: generateId('user'),
            username: data.username,
            password: data.password, // Storing simple password as requested
            role: (data.role as any) || 'user',
            permissions: data.permissions,
            employeeId: data.employeeId,
        };

        try {
            await insertItem<User>('app_users', newUser);
            setUsers(prev => [...prev, newUser]);
            showNotification('Usuário adicionado com sucesso!', 'success');
        } catch (error: any) {
            showNotification('Erro ao adicionar usuário: ' + (error.message || 'Erro desconhecido'), 'error');
        }
    };

    const updateUser = async (userId: string, data: Partial<User>) => {
        try {
            await updateItem<User>('app_users', userId, data);
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...data } : u));
            showNotification('Usuário atualizado com sucesso!', 'success');
        } catch (error) {
            showNotification('Erro ao atualizar usuário.', 'error');
        }
    };

    const deleteUser = async (userId: string) => {
        try {
            await deleteItem('app_users', userId);
            setUsers(prev => prev.filter(u => u.id !== userId));
            showNotification('Usuário removido com sucesso!', 'success');
        } catch (error) {
            showNotification('Erro ao remover usuário.', 'error');
        }
    };

    const addGauge = async (data: Omit<StockGauge, 'id'>) => {
        try {
            const saved = await insertItem<StockGauge>('stock_gauges', data as StockGauge);
            setGauges(prev => [...prev, saved]);
            showNotification('Bitola cadastrada com sucesso!', 'success');
        } catch (error) {
            console.error(error);
            showNotification('Erro ao cadastrar bitola. Verifique se a tabela stock_gauges existe.', 'error');
        }
    };

    const deleteGauge = async (id: string) => {
        try {
            await deleteItem('stock_gauges', id);
            setGauges(prev => prev.filter(g => g.id !== id));
            showNotification('Bitola removida com sucesso!', 'success');
        } catch (error) {
            showNotification('Erro ao remover bitola.', 'error');
        }
    };

    const restoreDefaultGauges = async () => {
        if (!confirm('Deseja restaurar as bitolas padrão do sistema? Isso adicionará as bitolas comuns se estiverem faltando.')) return;

        try {
            const defaults = [
                ...FioMaquinaBitolaOptions.map(g => ({ materialType: 'Fio Máquina', gauge: g })),
                ...TrefilaBitolaOptions.map(g => ({ materialType: 'CA-60', gauge: g }))
            ];

            let addedCount = 0;
            // Iterate sequentially to avoid race conditions or heavy load
            for (const item of defaults) {
                // Check if exists in local state
                if (gauges.some(g => g.materialType === item.materialType && g.gauge === item.gauge)) continue;

                try {
                    const saved = await insertItem<StockGauge>('stock_gauges', item as StockGauge);
                    setGauges(prev => [...prev, saved]);
                    addedCount++;
                } catch (e) {
                    // Constraint violation likely if parallel usage or race condition, ignore
                    console.warn('Skipping or error adding gauge', item, e);
                }
            }

            if (addedCount > 0) {
                showNotification(`${addedCount} bitolas padrão restauradas com sucesso!`, 'success');
            } else {
                showNotification('Todas as bitolas padrão já estavam cadastradas.', 'info');
            }
        } catch (error) {
            console.error(error);
            showNotification('Erro ao restaurar bitolas. Verifique se a tabela foi criada.', 'error');
        }
    };

    // Stock Control
    const addConference = async (data: ConferenceData) => {
        // Prevent duplicate conference number
        if (conferences.some(c => c.conferenceNumber === data.conferenceNumber)) {
            showNotification('Esta conferência já foi registrada!', 'error');
            return;
        }

        try {
            // Filter out 'lots' array before saving to conferences table
            // This prevents errors if the table doesn't have a JSONB 'lots' column
            const { lots, ...conferenceHeader } = data;
            await insertItem<any>('conferences', conferenceHeader);

            // Also add stock items from conference
            const newStockItems: StockItem[] = data.lots.map(lot => ({
                id: generateId('STOCK'),
                entryDate: data.entryDate,
                supplier: lot.supplier || data.supplier,
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
            showNotification('Conferência salva com sucesso!', 'success');
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
            // Filter out 'lots' array to avoid DB errors
            const { lots, ...conferenceHeader } = updatedData;
            await updateItemByColumn<any>('conferences', 'conference_number', conferenceNumber, conferenceHeader);

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

            showNotification('Conferência editada com sucesso!', 'success');
        } catch (error: any) {
            console.error('Error editing conference:', error);
            showNotification(`Erro ao editar conferência: ${error.message || error} `, 'error');
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

            // Delete conference itself
            await deleteItemByColumn('conferences', 'conference_number', conferenceNumber);

            showNotification('Conferência excluída com sucesso!', 'success');
        } catch (error: any) {
            console.error('Error deleting conference:', error);
            showNotification(`Erro ao excluir conferência: ${error.message || error} `, 'error');
        }
    };
    const addStockItem = async (item: StockItem) => {
        try {
            return await insertItem<StockItem>('stock_items', item);
        } catch (error) {
            showNotification('Erro ao adicionar item ao estoque.', 'error');
            return null;
        }
    };

    const updateStockItem = async (id: string, updates: Partial<StockItem>) => {
        try {
            await updateItem<StockItem>('stock_items', id, updates);
        } catch (error) {
            showNotification('Erro ao atualizar item do estoque.', 'error');
        }
    };
    const deleteStockItem = async (id: string) => {
        try {
            await deleteItem('stock_items', id);
            showNotification('Lote removido com sucesso!', 'success');
        } catch (error) {
            showNotification('Erro ao remover lote.', 'error');
        }
    };

    const addInventorySession = async (session: InventorySession) => {
        try {
            await insertItem<InventorySession>('inventory_sessions', session);
        } catch (error) { showNotification('Erro ao salvar sessão de inventário.', 'error'); }
    };

    const updateInventorySession = async (id: string, updates: Partial<InventorySession>) => {
        try {
            await updateItem<InventorySession>('inventory_sessions', id, updates);
        } catch (error) { showNotification('Erro ao atualizar sessão de inventário.', 'error'); }
    };

    const deleteInventorySession = async (id: string) => {
        try {
            const session = inventorySessions.find(s => s.id === id);
            if (session && session.auditedLots && session.auditedLots.length > 0) {
                for (const audited of session.auditedLots) {
                    const lot = stock.find(s => s.id === audited.lotId);
                    if (!lot) continue;

                    if (audited.systemWeight === 0 && lot.supplier === 'CADASTRADO NO INVENTÁRIO') {
                        // It was a quick-add lot, delete it
                        await deleteItem('stock_items', audited.lotId);
                    } else {
                        // Revert weight and clear audit info
                        await updateItem<StockItem>('stock_items', audited.lotId, {
                            remainingQuantity: audited.systemWeight,
                            lastAuditDate: null,
                            auditObservation: null
                        });
                    }
                }
            }

            await deleteItem('inventory_sessions', id);
            showNotification('Inventário removido e alterações revertidas.', 'success');
        } catch (error) {
            console.error(error);
            showNotification('Erro ao excluir sessão de inventário.', 'error');
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
                    type: `Transferência para ${destinationSector} `,
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
            id: String(transfers.length + 1),
            date: new Date().toISOString(),
            operator: currentUser.username,
            destinationSector,
            transferredLots: transferredLotsInfo,
        };

        try {
            // Save transfer record
            const savedTransfer = await insertItem<TransferRecord>('transfers', newTransferRecord);

            // Update stock items
            for (const update of updates) {
                await updateItem<StockItem>('stock_items', update.id, update.changes);
            }

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

            for (const update of finishedGoodsUpdates) {
                await updateItem<FinishedProductItem>('finished_goods', update.id, update.changes);
            }
            for (const update of pontasUpdates) {
                await updateItem<PontaItem>('pontas_stock', update.id, update.changes);
            }

            showNotification('Transferência de produto acabado realizada com sucesso!', 'success');
            return savedTransfer;
        } catch (error) {
            showNotification('Erro ao realizar transferência.', 'error');
            return null;
        }
    };

    const addProductionOrder = async (orderData: Omit<ProductionOrderData, 'id' | 'status' | 'creationDate'>) => {
        const newOrder: Partial<ProductionOrderData> = {
            ...orderData,
            // id is NOT set here to allow insertItem to generate a proper UUID for Supabase
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
            } else if (newOrder.machine === 'Treliça') {
                const lots = newOrder.selectedLotIds as TrelicaSelectedLots;
                const lotRoleMap = new Map<string, string>();

                const assignRole = (ids: string | string[] | undefined, role: string) => {
                    if (!ids) return;
                    if (Array.isArray(ids)) {
                        ids.forEach(id => lotRoleMap.set(String(id).trim(), role));
                    } else {
                        lotRoleMap.set(String(ids).trim(), role);
                    }
                };

                assignRole(lots.allSuperior || lots.superior, 'Superior');
                assignRole(lots.allInferiorLeft || lots.inferior1, 'Inferior Esq.');
                assignRole(lots.allInferiorRight || lots.inferior2, 'Inferior Dir.');
                assignRole(lots.allSenozoideLeft || lots.senozoide1, 'Senozoide Esq.');
                assignRole(lots.allSenozoideRight || lots.senozoide2, 'Senozoide Dir.');

                for (const [lotId, role] of lotRoleMap.entries()) {
                    const stockItem = stock.find(s => s.id === lotId);
                    if (stockItem) {
                        await updateItem<StockItem>('stock_items', lotId, {
                            status: 'Em Produção - Treliça',
                            location: role,
                            productionOrderIds: [...(stockItem.productionOrderIds || []), savedOrder.id]
                        });
                    }
                }
            }

            showNotification('Ordem de produção criada com sucesso!', 'success');
        } catch (error) {
            console.error('Error creating production order:', error);
            showNotification('Erro ao criar ordem de produção.', 'error');
        }
    };

    const updateProductionOrder = async (orderId: string, updates: Partial<ProductionOrderData>) => {
        try {
            await updateItem('production_orders', orderId, updates);
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
                    const isNowAvailable = newProductionOrderIds.length === 0;

                    await updateItem<StockItem>('stock_items', lotId, {
                        status: isNowAvailable ? 'Disponível' : stockItem.status,
                        location: isNowAvailable ? '' : stockItem.location, // Clear role if back to available
                        productionOrderIds: newProductionOrderIds.length > 0 ? newProductionOrderIds : undefined,
                    });
                }
            }

            await deleteItem('production_orders', orderId);
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

        if (orderToStartData.status === 'in_progress') {
            showNotification('Ordem já iniciada.', 'warning');
            return;
        }

        const newOrderMachine = orderToStartData.machine;

        // Find and close any existing open shift for this user/machine
        const openShiftOrderIndex = newOrders.findIndex(o =>
            o.machine === newOrderMachine &&
            (o.operatorLogs || []).some(log => log.operator === currentUser.username && !log.endTime)
        );

        try {
            // Aggressively close ANY other in_progress orders for this machine
            // to ensure the dashboard doesn't get stuck on ghost orders
            const otherInProgressOrders = newOrders.filter(o => o.machine === newOrderMachine && o.status === 'in_progress' && o.id !== orderId);

            for (const otherOrder of otherInProgressOrders) {
                const closedLogs = (otherOrder.operatorLogs || []).map(log =>
                    !log.endTime ? { ...log, endTime: now } : log
                );
                await updateItem('production_orders', otherOrder.id, {
                    status: 'completed',
                    endTime: now,
                    operatorLogs: closedLogs
                });
                // Update local list
                const idx = newOrders.findIndex(o => o.id === otherOrder.id);
                if (idx !== -1) {
                    newOrders[idx] = { ...newOrders[idx], status: 'completed', endTime: now, operatorLogs: closedLogs };
                }
            }

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

            await updateItem('production_orders', orderToStartData.id, updates);
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

        // Close ANY other open logic for this order before starting our own
        const newLogs = (order.operatorLogs || []).map(log => {
            if (!log.endTime) {
                return { ...log, endTime: now, endQuantity: order.actualProducedQuantity || 0 };
            }
            return log;
        });

        const updates: Partial<ProductionOrderData> = {
            operatorLogs: [...newLogs, {
                operator: currentUser.username,
                startTime: now,
                endTime: null,
                startQuantity: order.actualProducedQuantity || 0
            }],
        };

        // Auto-resume for administrative stops
        const newEvents = [...(order.downtimeEvents || [])];
        let lastEventIndex = -1;
        for (let i = newEvents.length - 1; i >= 0; i--) {
            if (!newEvents[i].resumeTime) {
                lastEventIndex = i;
                break;
            }
        }

        if (lastEventIndex !== -1) {
            const lastReason = newEvents[lastEventIndex].reason;
            if (lastReason === 'Final de Turno' || lastReason === 'Aguardando Início da Produção') {
                newEvents[lastEventIndex].resumeTime = now;
                updates.downtimeEvents = newEvents;
            }
        }

        // For Trefila, if no active lot processing, ensure we are in "Troca de Rolo / Preparação"
        if (order.machine === 'Trefila' && (!order.activeLotProcessing || !order.activeLotProcessing.lotId)) {
            const currentEvents = updates.downtimeEvents || [...(order.downtimeEvents || [])];
            const lastEvent = currentEvents.length > 0 ? currentEvents[currentEvents.length - 1] : null;

            // Only push if not already in a preparation state
            if (!lastEvent || lastEvent.resumeTime !== null || (lastEvent.reason !== 'Troca de Rolo / Preparação' && lastEvent.reason !== 'Setup')) {
                const updatedEvents = [...currentEvents];
                // Close previous open event if any (should already be handled but for extra safety)
                if (updatedEvents.length > 0 && !updatedEvents[updatedEvents.length - 1].resumeTime) {
                    updatedEvents[updatedEvents.length - 1].resumeTime = now;
                }

                updatedEvents.push({
                    stopTime: now,
                    resumeTime: null,
                    reason: 'Troca de Rolo / Preparação'
                });
                updates.downtimeEvents = updatedEvents;
            }
        }

        try {
            await updateItem('production_orders', orderId, updates);
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
            const stopTime = new Date(event.stopTime).getTime();
            const resumeTime = event.resumeTime ? new Date(event.resumeTime).getTime() : shiftEnd.getTime();
            const sStart = shiftStart.getTime();
            const sEnd = shiftEnd.getTime();
            // Event overlaps with shift if it starts before shift ends AND ends after shift starts
            return stopTime <= sEnd && resumeTime >= sStart && event.reason !== 'Final de Turno';
        });

        const shiftProcessedLots = (order.processedLots || []).filter(lot => {
            const lotEndTime = new Date(lot.endTime).getTime();
            const sStart = shiftStart.getTime();
            const sEnd = shiftEnd.getTime();
            return lotEndTime >= sStart && lotEndTime < sEnd;
        });

        // Trelica specific: Packages weighed during this shift
        const shiftPackages = (order.weighedPackages || []).filter(pkg => {
            const pkgTime = new Date(pkg.timestamp);
            return pkgTime >= shiftStart && pkgTime < shiftEnd;
        });

        // Pontas produced during this shift
        const orderEndedInShift = order.endTime && new Date(order.endTime) >= shiftStart && new Date(order.endTime) < shiftEnd;
        const shiftPontas = orderEndedInShift ? (order.pontas || []) : [];

        let totalProducedWeight = 0;
        let totalProducedMeters = 0;

        if (order.machine === 'Trefila') {
            totalProducedWeight = shiftProcessedLots.reduce((sum, lot) => sum + (lot.finalWeight || 0), 0);

            const bitolaMm = parseFloat(order.targetBitola);
            const steelDensityKgPerM3 = 7850;
            const radiusM = (bitolaMm / 1000) / 2;
            const areaM2 = Math.PI * Math.pow(radiusM, 2);
            const volumeM3 = totalProducedWeight / steelDensityKgPerM3;
            totalProducedMeters = areaM2 > 0 ? volumeM3 / areaM2 : 0;
        } else {
            // Trelica: sum of packages + pontas weights
            const packageWeight = shiftPackages.reduce((sum, pkg) => sum + (pkg.weight || 0), 0);
            const pontasWeight = shiftPontas.reduce((sum, p) => sum + (p.totalWeight || 0), 0);

            const packageMeters = shiftPackages.reduce((sum, pkg) => sum + (pkg.quantity * parseFloat(order.tamanho || '0')), 0);
            const pontasMeters = shiftPontas.reduce((sum, p) => sum + (p.quantity * p.size), 0);

            // If no packages weighed but pieces were reported at end of shift
            const shiftQuantity = (operatorLog.endQuantity || 0) - (operatorLog.startQuantity || 0);
            if (packageWeight === 0 && shiftQuantity > 0) {
                const modelInfo = trelicaModels.find(m => m.modelo === order.trelicaModel && m.tamanho === order.tamanho);
                if (modelInfo) {
                    const theoreticalPieceWeight = parseFloat(modelInfo.pesoFinal.replace(',', '.'));
                    totalProducedWeight = (shiftQuantity * theoreticalPieceWeight) + pontasWeight;
                    totalProducedMeters = (shiftQuantity * parseFloat(order.tamanho || '0')) + pontasMeters;
                } else {
                    totalProducedWeight = pontasWeight;
                    totalProducedMeters = pontasMeters;
                }
            } else {
                totalProducedWeight = packageWeight + pontasWeight;
                totalProducedMeters = packageMeters + pontasMeters;
            }
        }

        const totalScrapWeight = orderEndedInShift ? (order.scrapWeight || 0) : 0;
        const scrapPercentage = (totalProducedWeight + totalScrapWeight) > 0
            ? (totalScrapWeight / (totalProducedWeight + totalScrapWeight)) * 100
            : 0;

        const totalProducedQuantity = (operatorLog.endQuantity || 0) - (operatorLog.startQuantity || 0);

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
            totalProducedQuantity,
            totalProducedWeight,
            totalProducedMeters,
            totalScrapWeight,
            scrapPercentage,
        };

        try {
            await insertItem<ShiftReport>('shift_reports', report);
        } catch (error) {
            showNotification('Erro ao salvar relatório de turno.', 'error');
        }
    };


    const endOperatorShift = async (orderId: string, finalQuantity?: number) => {
        if (!currentUser) return;

        const order = productionOrders.find(o => o.id === orderId);
        if (!order) return;

        const now = new Date().toISOString();

        let operatorLog: OperatorLog | undefined;
        // Close ALL open logs for this order to avoid ghost shifts on the dashboard
        const newLogs = (order.operatorLogs || []).map(log => {
            if (!log.endTime) {
                // If it's the current user, we capture it for the report
                if (log.operator === currentUser?.username) {
                    operatorLog = {
                        ...log,
                        endTime: now,
                        endQuantity: finalQuantity !== undefined ? finalQuantity : (order.actualProducedQuantity || 0)
                    };
                    return operatorLog;
                }
                // For others, just close it
                return { ...log, endTime: now, endQuantity: order.actualProducedQuantity || 0 };
            }
            return log;
        });

        const updates: Partial<ProductionOrderData> = { operatorLogs: newLogs };

        if (finalQuantity !== undefined) {
            updates.actualProducedQuantity = finalQuantity;
            updates.lastQuantityUpdate = now;
        }

        // Automatically stop machine and mark as Shift End
        const newDowntimeEvents = [...(order.downtimeEvents || [])];
        const lastDowntime = newDowntimeEvents.length > 0 ? newDowntimeEvents[newDowntimeEvents.length - 1] : null;

        // Close any existing open event first
        if (lastDowntime && !lastDowntime.resumeTime) {
            lastDowntime.resumeTime = now;
        }

        // Always add Final de Turno to signify machine is off between shifts
        newDowntimeEvents.push({
            stopTime: now,
            resumeTime: null,
            reason: 'Final de Turno'
        });
        updates.downtimeEvents = newDowntimeEvents;

        try {
            const updatedOrder = await updateItem<ProductionOrderData>('production_orders', orderId, updates);

            if (operatorLog) {
                await generateShiftReport(updatedOrder, operatorLog);
            }

            setProductionOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
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
            await updateItem('production_orders', orderId, updates);
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

        // Close any open event
        if (lastEventIndex !== -1) {
            newEvents[lastEventIndex].resumeTime = now;
        }

        // Trefila requirement: machine must be in "Troca de Rolo" if no lot is active
        if (order.machine === 'Trefila' && (!order.activeLotProcessing || !order.activeLotProcessing.lotId)) {
            // Only add if we didn't just close a "Troca de Rolo" now, or if it's the first one
            const justClosedReason = lastEventIndex !== -1 ? (order.downtimeEvents || [])[lastEventIndex].reason : null;
            if (justClosedReason !== 'Troca de Rolo / Preparação') {
                newEvents.push({ stopTime: now, resumeTime: null, reason: 'Troca de Rolo / Preparação' });
            }
        }

        try {
            await updateItem('production_orders', orderId, { downtimeEvents: newEvents });
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
            await updateItem('production_orders', orderId, updates);
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
            await updateItem('production_orders', orderId, updates);
            showNotification('Processamento de lote finalizado.', 'success');
        } catch (error) {
            showNotification('Erro ao finalizar lote.', 'error');
        }
    };

    const completeProduction = async (orderId: string, finalData: { actualProducedQuantity?: number; scrapWeight?: number; pontas?: Ponta[] }) => {
        const now = new Date().toISOString();
        const orderToComplete = productionOrders.find(o => o.id === orderId);

        if (!orderToComplete || orderToComplete.status === 'completed') return;

        let updates: Partial<ProductionOrderData> = {};
        const stockUpdates: { id: string, changes: Partial<StockItem> }[] = [];

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

        // Close ALL open operator logs when completing the order
        const newLogs = (orderToComplete.operatorLogs || []).map(log =>
            !log.endTime ? { ...log, endTime: now, endQuantity: orderToComplete.actualProducedQuantity } : log
        );

        updates.operatorLogs = newLogs;

        if (orderToComplete.machine === 'Trefila') {
            const actualProducedWeight = (orderToComplete.processedLots || []).reduce((sum, lot) => sum + (lot.finalWeight || 0), 0);
            const totalInputWeight = (orderToComplete.processedLots || []).reduce((sum, processedLot) => {
                const originalLot = stock.find(s => s.id === processedLot.lotId);
                return sum + (originalLot?.initialQuantity || 0);
            }, 0);
            const calculatedScrapWeight = totalInputWeight - actualProducedWeight;

            updates = {
                status: 'completed',
                endTime: now,
                downtimeEvents: newEvents,
                actualProducedWeight,
                scrapWeight: calculatedScrapWeight >= 0 ? calculatedScrapWeight : 0,
            };

            for (const item of stock) {
                const processedLotData = (orderToComplete.processedLots || []).find(pLot => pLot.lotId === item.id);
                if (processedLotData) {
                    const finalWeight = processedLotData.finalWeight || 0;
                    stockUpdates.push({
                        id: item.id,
                        changes: {
                            materialType: 'CA-60',
                            bitola: orderToComplete.targetBitola,
                            labelWeight: finalWeight,
                            initialQuantity: finalWeight,
                            remainingQuantity: finalWeight,
                            status: 'Disponível',
                            productionOrderIds: (item.productionOrderIds || []).filter(id => id !== orderId),
                            history: [...(item.history || []), {
                                type: 'Transformado em CA-60',
                                date: now,
                                details: {
                                    'Ordem': orderToComplete.orderNumber,
                                    'Bitola Original': item.bitola,
                                    'Bitola Final': orderToComplete.targetBitola,
                                    'Peso Final (kg)': finalWeight.toFixed(2)
                                }
                            }]
                        }
                    });
                }
            }
        } else { // Treliça
            try {
                // Determine actual production quantity
                // Priority: 1. Modal data, 2. Current production count, 3. Planned order quantity
                let fullQty = Number(finalData.actualProducedQuantity || 0);
                if (fullQty <= 0) {
                    fullQty = Number(orderToComplete.actualProducedQuantity || 0);
                }
                if (fullQty <= 0) {
                    fullQty = Number(orderToComplete.quantityToProduce || 1); // Ultimate fallback to 1 piece to avoid 0 consumption if completed
                }

                let actualWeight = (orderToComplete.weighedPackages || []).reduce((sum, pkg) => sum + pkg.weight, 0);
                const modelInfo = trelicaModels.find(m =>
                    m.modelo.trim().toLowerCase() === orderToComplete.trelicaModel?.trim().toLowerCase() &&
                    String(m.tamanho).trim() === String(orderToComplete.tamanho).trim()
                );

                if (!modelInfo) {
                    showNotification('Erro: Modelo de treliça não encontrado no cadastro.', 'error');
                    return;
                }

                // If no packages weighed but we have production qty, estimate weight
                if ((actualWeight === 0 || isNaN(actualWeight)) && fullQty > 0) {
                    actualWeight = parseFloat(String(modelInfo.pesoFinal).replace(',', '.')) * fullQty;
                }

                updates = {
                    status: 'completed',
                    endTime: now,
                    downtimeEvents: newEvents,
                    actualProducedQuantity: fullQty,
                    pontas: finalData.pontas,
                    actualProducedWeight: actualWeight,
                };

                const latestStock = await fetchTable<StockItem>('stock_items');
                const currentStockLookup = new Map(latestStock.map(s => [String(s.id).trim(), { ...s }]));

                // Helper to normalize lot lists from old/new formats
                const getLotsArray = (ids: any, fallback?: any) => {
                    const primary = Array.isArray(ids) ? ids : (ids ? [ids] : []);
                    const secondary = Array.isArray(fallback) ? fallback : (fallback ? [fallback] : []);
                    const combined = [...primary, ...secondary]
                        .map(id => String(id || '').trim())
                        .filter(id => id.length > 0 && id !== 'undefined' && id !== 'null');
                    return [...new Set(combined)];
                };

                let lotsObj: TrelicaSelectedLots;
                const rawSelected = orderToComplete.selectedLotIds;
                if (Array.isArray(rawSelected)) {
                    lotsObj = {
                        superior: rawSelected[0] || '',
                        inferior1: rawSelected[1] || '',
                        inferior2: rawSelected[2] || '',
                        senozoide1: rawSelected[3] || '',
                        senozoide2: rawSelected[4] || '',
                        allSuperior: [rawSelected[0]].filter(Boolean),
                        allInferiorLeft: [rawSelected[1]].filter(Boolean),
                        allInferiorRight: [rawSelected[2]].filter(Boolean),
                        allSenozoideLeft: [rawSelected[3]].filter(Boolean),
                        allSenozoideRight: [rawSelected[4]].filter(Boolean)
                    };
                } else {
                    lotsObj = rawSelected as TrelicaSelectedLots;
                }

                const parseW = (s: any) => parseFloat(String(s || '0').replace(',', '.'));

                // Calculate total consumption needs
                const totalConsumed = {
                    superior: parseW(modelInfo.pesoSuperior) * fullQty,
                    inferior: parseW(modelInfo.pesoInferior) * fullQty,
                    senozoide: parseW(modelInfo.pesoSenozoide) * fullQty,
                };

                // Account for pontas (extra consumption for scrap/leftover items being created)
                const totalModelWeight = parseW(modelInfo.pesoFinal);
                if (finalData.pontas && totalModelWeight > 0) {
                    for (const ponta of finalData.pontas) {
                        totalConsumed.superior += (parseW(modelInfo.pesoSuperior) / totalModelWeight) * ponta.totalWeight;
                        totalConsumed.inferior += (parseW(modelInfo.pesoInferior) / totalModelWeight) * ponta.totalWeight;
                        totalConsumed.senozoide += (parseW(modelInfo.pesoSenozoide) / totalModelWeight) * ponta.totalWeight;
                    }
                }

                const consumedMap = new Map<string, number>();
                const dist = (lotIds: string[], weight: number) => {
                    if (lotIds.length === 0 || weight <= 0) return;
                    let remainingToDistribute = weight;

                    const items = lotIds
                        .map(id => currentStockLookup.get(id))
                        .filter((i): i is StockItem => !!i)
                        .sort((a, b) => {
                            const pA = a.status.includes('Suporte') || a.status.includes('Produção');
                            const pB = b.status.includes('Suporte') || b.status.includes('Produção');
                            if (pA && !pB) return -1;
                            if (!pA && pB) return 1;
                            return a.internalLot.localeCompare(b.internalLot, undefined, { numeric: true });
                        });

                    for (const item of items) {
                        if (remainingToDistribute <= 0.0001) break;
                        const currentBalance = parseW(item.remainingQuantity);
                        const alreadyConsumedInThisOrder = consumedMap.get(item.id) || 0;
                        const availableInThisLot = Math.max(0, currentBalance - alreadyConsumedInThisOrder);

                        const consume = Math.min(remainingToDistribute, availableInThisLot);
                        if (consume > 0) {
                            consumedMap.set(item.id, alreadyConsumedInThisOrder + consume);
                            remainingToDistribute -= consume;
                        }
                    }
                };

                // Execute distribution across all components
                dist(getLotsArray(lotsObj.allSuperior, lotsObj.superior), totalConsumed.superior);
                dist(getLotsArray(lotsObj.allInferiorLeft, lotsObj.inferior1), totalConsumed.inferior / 2);
                dist(getLotsArray(lotsObj.allInferiorRight, lotsObj.inferior2), totalConsumed.inferior / 2);
                dist(getLotsArray(lotsObj.allSenozoideLeft, lotsObj.senozoide1), totalConsumed.senozoide / 2);
                dist(getLotsArray(lotsObj.allSenozoideRight, lotsObj.senozoide2), totalConsumed.senozoide / 2);

                // Involved IDs for both status update and weight deduction
                const involved = new Set<string>();
                const lotToRole = new Map<string, string>();

                const trackRole = (ids: any, role: string) => {
                    getLotsArray(ids).forEach(id => {
                        involved.add(id);
                        lotToRole.set(id, role);
                    });
                };

                trackRole(lotsObj.allSuperior || lotsObj.superior, 'Superior');
                trackRole(lotsObj.allInferiorLeft || lotsObj.inferior1, 'Inferior Esq.');
                trackRole(lotsObj.allInferiorRight || lotsObj.inferior2, 'Inferior Dir.');
                trackRole(lotsObj.allSenozoideLeft || lotsObj.senozoide1, 'Senozoide Esq.');
                trackRole(lotsObj.allSenozoideRight || lotsObj.senozoide2, 'Senozoide Dir.');

                consumedMap.forEach((_, id) => involved.add(id));

                involved.forEach(lotId => {
                    const item = currentStockLookup.get(lotId);
                    if (item) {
                        const consumed = consumedMap.get(lotId) || 0;
                        const oldRem = parseW(item.remainingQuantity);
                        let newRem = Math.max(0, oldRem - consumed);

                        const remIds = (item.productionOrderIds || []).filter(id => id !== orderId);
                        const hasOtherActive = remIds.some(id => {
                            const o = productionOrders.find(po => po.id === id);
                            return o && (o.status === 'pending' || o.status === 'in_progress');
                        });

                        let newStatus = item.status;
                        if (newRem <= 0.05) {
                            newStatus = 'Consumido para fazer treliça';
                            newRem = 0;
                        } else if (!hasOtherActive) {
                            newStatus = 'Disponível - Suporte Treliça';
                        } else {
                            newStatus = 'Em Produção - Treliça';
                        }

                        stockUpdates.push({
                            id: item.id,
                            changes: {
                                remainingQuantity: Number(newRem.toFixed(2)),
                                labelWeight: Number(newRem.toFixed(2)),
                                productionOrderIds: remIds,
                                status: newStatus,
                                location: lotToRole.get(lotId) || item.location, // Assign support role as location
                                history: [...(item.history || []), {
                                    type: 'Consumido na Produção de Treliça',
                                    date: now,
                                    details: {
                                        'Ordem': orderToComplete.orderNumber,
                                        'Consumo': consumed.toFixed(2) + 'kg',
                                        'Saldo Anterior': oldRem.toFixed(2) + 'kg',
                                        'Saldo Novo': newRem.toFixed(2) + 'kg',
                                        'Status Novo': newStatus,
                                        'Local Novo': lotToRole.get(lotId) || item.location
                                    }
                                }]
                            }
                        });
                    }
                });
            } catch (err: any) {
                showNotification(`Erro no cálculo de treliça: ${err.message} `, 'error');
                return;
            }
        }


        try {
            const updatedOrder = await updateItem<ProductionOrderData>('production_orders', orderId, updates);
            setProductionOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));

            for (const update of stockUpdates) {
                await updateItem<StockItem>('stock_items', update.id, update.changes);
            }

            const finalStock = await fetchTable<StockItem>('stock_items');
            setStock(finalStock);

            if (orderToComplete.machine === 'Treliça') {
                if (finalData.pontas) {
                    const pontasItems: PontaItem[] = finalData.pontas.map(p => ({
                        id: generateId('ponta'), productionDate: now, productionOrderId: orderId, orderNumber: orderToComplete.orderNumber,
                        productType: 'Ponta de Treliça', model: orderToComplete.trelicaModel!, size: `${p.size} `, quantity: p.quantity, totalWeight: p.totalWeight, status: 'Disponível'
                    }));
                    for (const pi of pontasItems) await insertItem('pontas_stock', pi);
                    const allPontas = await fetchTable<PontaItem>('pontas_stock');
                    setPontasStock(allPontas.sort((a, b) => new Date(b.productionDate).getTime() - new Date(a.productionDate).getTime()));
                }
                const weight = updates.actualProducedWeight || 0;
                if (weight > 0) {
                    const fg: FinishedProductItem = {
                        id: generateId('fg'), productionDate: now, productionOrderId: orderId, orderNumber: orderToComplete.orderNumber,
                        productType: 'Treliça', model: orderToComplete.trelicaModel!, size: `${orderToComplete.tamanho!} `, quantity: finalData.actualProducedQuantity || 0,
                        totalWeight: weight, status: 'Disponível'
                    };
                    await insertItem('finished_goods', fg);
                    const allFG = await fetchTable<FinishedProductItem>('finished_goods');
                    setFinishedGoods(allFG.sort((a, b) => new Date(b.productionDate).getTime() - new Date(a.productionDate).getTime()));
                }
            }
            showNotification(`Ordem ${orderToComplete.orderNumber} finalizada com sucesso.`, 'success');
        } catch (err: any) {
            console.error('Erro fatal ao finalizar ordem:', err);
            showNotification(`Erro ao salvar finalização: ${err.message} `, 'error');
        }
    };

    const recordLotWeight = async (orderId: string, lotId: string, finalWeight: number | null, measuredGauge?: number) => {
        try {
            // Fetch the latest version of the order using fetchByColumn which handles camelCase conversion
            const orders = await fetchByColumn<ProductionOrderData>('production_orders', 'id', orderId);
            const order = orders[0];

            if (!order) {
                console.error('Order not found for weight update:', orderId);
                showNotification('Erro ao buscar dados da ordem.', 'error');
                return;
            }

            // Map and merge updates - now 'order' is already in camelCase
            const currentProcessedLots = order.processedLots || [];
            const newProcessedLots = currentProcessedLots.map((p: any) => {
                if (p.lotId === lotId) {
                    return {
                        ...p,
                        finalWeight: finalWeight !== undefined ? finalWeight : p.finalWeight,
                        measuredGauge: measuredGauge !== undefined ? measuredGauge : p.measuredGauge
                    };
                }
                return p;
            });

            // Use updateItem service which handles snake_case conversion for the database
            const updatedOrder = await updateItem<ProductionOrderData>('production_orders', orderId, {
                processedLots: newProcessedLots
            });

            setProductionOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
            showNotification('Dados do lote salvos com sucesso.', 'success');
        } catch (error: any) {
            console.error('Error updating lot weight/gauge:', error);
            showNotification('Erro ao registrar dados no banco.', 'error');
        }
    };

    const recordPackageWeight = async (orderId: string, packageData: { packageNumber: number; quantity: number; weight: number; }) => {
        const order = productionOrders.find(o => o.id === orderId);
        if (!order) return;
        const newPackage: WeighedPackage = { ...packageData, timestamp: new Date().toISOString() };
        const newWeighedPackages = [...(order.weighedPackages || []).filter(p => p.packageNumber !== packageData.packageNumber), newPackage].sort((a, b) => a.packageNumber - b.packageNumber);
        try {
            const updatedOrder = await updateItem('production_orders', orderId, { weighedPackages: newWeighedPackages });
            setProductionOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
            showNotification(`Peso do pacote #${packageData.packageNumber} registrado.`, 'success');
        } catch (error) { showNotification('Erro ao registrar pacote.', 'error'); }
    };

    const updateProducedQuantity = async (orderId: string, quantity: number) => {
        try {
            const now = new Date().toISOString();
            await updateItem('production_orders', orderId, {
                actualProducedQuantity: quantity,
                lastQuantityUpdate: now
            });
            showNotification('Contagem de peças atualizada.', 'success');
        } catch (error) { showNotification('Erro ao atualizar contagem.', 'error'); }
    };

    const addPartsRequest = async (data: Omit<PartsRequest, 'id' | 'date' | 'operator' | 'status'>) => {
        if (!currentUser) return;
        const activeOrder = productionOrders.find(o => o.status === 'in_progress');
        if (!activeOrder) return;
        const newRequest: PartsRequest = { ...data, id: generateId('part'), date: new Date().toISOString(), operator: currentUser.username, status: 'Pendente', machine: activeOrder.machine, productionOrderId: activeOrder.id };
        try {
            await insertItem<PartsRequest>('parts_requests', newRequest);
            showNotification('Solicitação de peças enviada.', 'success');
        } catch (error) { showNotification('Erro ao enviar solicitação.', 'error'); }
    };

    const logPostProductionActivity = async (activity: string) => {
        if (!currentUser) return;
        let targetOrderIndex = -1;
        let latestEndTime = 0;
        productionOrders.forEach((order, index) => {
            if (order.status === 'completed' && order.endTime) {
                const orderEndTime = new Date(order.endTime).getTime();
                const hasOpenLog = (order.operatorLogs || []).some(log => log.operator === currentUser.username && !log.endTime);
                if (hasOpenLog && orderEndTime > latestEndTime) { latestEndTime = orderEndTime; targetOrderIndex = index; }
            }
        });
        if (targetOrderIndex !== -1) {
            const targetOrder = { ...productionOrders[targetOrderIndex] };
            const logsCopy = [...(targetOrder.operatorLogs || [])];
            const logIndex = logsCopy.findIndex(log => log.operator === currentUser.username && !log.endTime);
            if (logIndex !== -1) {
                const updatedActivities = [...(logsCopy[logIndex].postProductionActivities || []), { timestamp: new Date().toISOString(), description: activity }];
                logsCopy[logIndex] = { ...logsCopy[logIndex], postProductionActivities: updatedActivities };
                try {
                    const updatedOrder = await updateItem('production_orders', targetOrder.id, { operatorLogs: logsCopy });
                    setProductionOrders(prev => prev.map(o => o.id === targetOrder.id ? updatedOrder : o));
                    showNotification('Atividade registrada.', 'success');
                } catch (error) { showNotification('Erro ao registrar atividade.', 'error'); }
            }
        }
    };

    const handleAddStickyNote = async (content: string, color: string) => {
        if (!currentUser) return;
        const newNote: StickyNote = {
            id: generateId('note'),
            content,
            color,
            author: currentUser.username,
            date: new Date().toISOString(),
            completed: false
        };
        try {
            await insertItem('sticky_notes', newNote);
            setStickyNotes(prev => [...prev, newNote]); // Update local state after successful DB insert
        } catch (e) {
            console.error('Notes error', e);
            // Fallback to local state if table doesn't exist (for UX)
            setStickyNotes(prev => [...prev, newNote]);
            showNotification('Lembrete salvo localmente (Banco offline).', 'warning');
        }
    };

    const handleDeleteStickyNote = async (id: string) => {
        try {
            await deleteItem('sticky_notes', id);
            setStickyNotes(prev => prev.filter(n => n.id !== id)); // Update local state after successful DB delete
        } catch (e) {
            console.error('Notes error', e);
            setStickyNotes(prev => prev.filter(n => n.id !== id));
            showNotification('Erro ao excluir lembrete (Excluído localmente).', 'warning');
        }
    };

    const handleToggleStickyNote = async (id: string) => {
        const note = stickyNotes.find(n => n.id === id);
        if (!note) return;
        try {
            await updateItem('sticky_notes', id, { completed: !note.completed });
            setStickyNotes(prev => prev.map(n => n.id === id ? { ...n, completed: !n.completed } : n)); // Update local state
        } catch (e) {
            console.error('Notes error', e);
            setStickyNotes(prev => prev.map(n => n.id === id ? { ...n, completed: !n.completed } : n));
            showNotification('Erro ao atualizar lembrete (Atualizado localmente).', 'warning');
        }
    };

    const handleAddMeeting = async (title: string, date: string) => {
        if (!currentUser) return;
        const newMeetingData: Partial<Meeting> = {
            title,
            meetingDate: date,
            createdAt: new Date().toISOString(),
            author: currentUser.username,
            items: []
        };
        try {
            const savedMeeting = await insertItem<Meeting>('meetings', newMeetingData);
            setMeetings(prev => [savedMeeting, ...prev]);
            showNotification('Reunião agendada com sucesso!', 'success');
        } catch (e) {
            console.error('Meeting error', e);
            showNotification('Erro ao salvar reunião no banco.', 'error');
        }
    };

    const handleUpdateMeeting = async (id: string, updates: Partial<Meeting>) => {
        try {
            const meeting = meetings.find(m => m.id === id);
            if (!meeting) return;

            // Optimistic update
            setMeetings(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));

            await updateItem('meetings', id, updates);
        } catch (e) {
            console.error('Meeting update error', e);
            showNotification('Erro ao atualizar reunião.', 'error');
        }
    };

    const handleDeleteMeeting = async (id: string) => {
        try {
            await deleteItem('meetings', id);
            setMeetings(prev => prev.filter(m => m.id !== id));
            showNotification('Reunião excluída.', 'success');
        } catch (e) {
            console.error('Meeting delete error', e);
            showNotification('Erro ao excluir reunião.', 'error');
        }
    };

    const registerProduction = async (machine: MachineType, producedWeight: number) => {
        const newRecord: ProductionRecord = { id: generateId('prod'), date: new Date().toISOString(), machine, producedWeight, consumedLots: [] };
        try {
            await insertItem<ProductionRecord>('production_records', newRecord);
            showNotification(`Produção registrada.`, 'success');
        } catch (error) { showNotification('Erro ao registrar produção.', 'error'); }
    };

    const deleteFinishedGoods = async (ids: string[]) => {
        if (!confirm('Excluir itens?')) return;
        try {
            for (const id of ids) await deleteItem('finished_goods', id);
            setFinishedGoods(prev => prev.filter(item => !ids.includes(item.id)));
            const pontasToDelete = pontasStock.filter(p => ids.includes(p.id));
            for (const p of pontasToDelete) await deleteItem('pontas_stock', p.id);
            if (pontasToDelete.length > 0) setPontasStock(prev => prev.filter(p => !ids.includes(p.id)));
            showNotification('Excluído.', 'success');
        } catch (error) { showNotification('Erro ao excluir.', 'error'); }
    };

    const deleteShiftReport = async (reportId: string) => {
        if (!confirm('Tem certeza que deseja excluir este relatório de turno?')) return;
        try {
            await deleteItem('shift_reports', reportId);
            showNotification('Relatório excluído com sucesso.', 'success');
        } catch (error) {
            showNotification('Erro ao excluir o relatório.', 'error');
        }
    };

    const renderPage = () => {
        const mcProps = {
            setPage, stock, currentUser, registerProduction, productionOrders, shiftReports,
            startProductionOrder, startOperatorShift, endOperatorShift, logDowntime,
            logResumeProduction, startLotProcessing, finishLotProcessing, recordLotWeight,
            addPartsRequest, logPostProductionActivity, completeProduction, recordPackageWeight,
            updateProducedQuantity, users, deleteShiftReport, gauges
        };

        switch (page) {
            case 'login': return <Login onLogin={handleLogin} error={notification?.type === 'error' ? notification.message : null} />;
            case 'menu': return <MainMenu setPage={setPage} onLogout={handleLogout} currentUser={currentUser} />;
            case 'stock': return <StockControl stock={stock} conferences={conferences} transfers={transfers} setPage={setPage} addConference={addConference} deleteStockItem={deleteStockItem} updateStockItem={(item) => updateStockItem(item.id, item)} createTransfer={createTransfer} editConference={editConference} deleteConference={deleteConference} productionOrders={productionOrders} initialView="list" gauges={gauges} currentUser={currentUser} />;

            case 'stock_add': return <StockControl stock={stock} conferences={conferences} transfers={transfers} setPage={setPage} addConference={addConference} deleteStockItem={deleteStockItem} updateStockItem={(item) => updateStockItem(item.id, item)} createTransfer={createTransfer} editConference={editConference} deleteConference={deleteConference} productionOrders={productionOrders} initialView="add" gauges={gauges} currentUser={currentUser} />;
            case 'stock_inventory': return <StockInventory stock={stock} setPage={setPage} updateStockItem={updateStockItem} addStockItem={addStockItem} deleteStockItem={deleteStockItem} inventorySessions={inventorySessions} addInventorySession={addInventorySession} updateInventorySession={updateInventorySession} deleteInventorySession={deleteInventorySession} currentUser={currentUser} gauges={gauges} />;
            case 'stock_transfer': return <StockTransfer stock={stock} transfers={transfers} setPage={setPage} createTransfer={createTransfer} gauges={gauges} />;
            case 'trefila': return <MachineControl machineType="Trefila" {...mcProps} initialView="dashboard" initialModal={null} />;
            case 'trefila_in_progress': return <MachineControl machineType="Trefila" {...mcProps} initialView="in_progress" initialModal={null} />;
            case 'trefila_pending': return <MachineControl machineType="Trefila" {...mcProps} initialView="pending" initialModal={null} />;
            case 'trefila_completed': return <MachineControl machineType="Trefila" {...mcProps} initialView="completed" initialModal={null} />;
            case 'trefila_reports': return <MachineControl machineType="Trefila" {...mcProps} initialView="dashboard" initialModal="reports" />;
            case 'trefila_parts': return <MachineControl machineType="Trefila" {...mcProps} initialView="dashboard" initialModal="parts" />;
            case 'trefila_weighing': return <TrefilaWeighing productionOrders={productionOrders} stock={stock} recordLotWeight={recordLotWeight} />;
            case 'trefila_rings': return <MachineControl machineType="Trefila" {...mcProps} initialView="dashboard" initialModal="rings" />;

            case 'trelica': return <MachineControl machineType="Treliça" {...mcProps} initialView="dashboard" initialModal={null} />;
            case 'trelica_in_progress': return <MachineControl machineType="Treliça" {...mcProps} initialView="in_progress" initialModal={null} />;
            case 'trelica_pending': return <MachineControl machineType="Treliça" {...mcProps} initialView="pending" initialModal={null} />;
            case 'trelica_completed': return <MachineControl machineType="Treliça" {...mcProps} initialView="completed" initialModal={null} />;
            case 'trelica_reports': return <MachineControl machineType="Treliça" {...mcProps} initialView="dashboard" initialModal="reports" />;
            case 'trelica_parts': return <MachineControl machineType="Treliça" {...mcProps} initialView="dashboard" initialModal="parts" />;

            case 'productionOrder': return <ProductionOrder setPage={setPage} stock={stock} productionOrders={productionOrders} addProductionOrder={addProductionOrder} showNotification={showNotification} updateProductionOrder={updateProductionOrder} deleteProductionOrder={deleteProductionOrder} gauges={gauges} currentUser={currentUser} />;
            case 'productionOrderTrelica': return <ProductionOrderTrelica setPage={setPage} stock={stock} productionOrders={productionOrders} addProductionOrder={addProductionOrder} showNotification={showNotification} updateProductionOrder={updateProductionOrder} deleteProductionOrder={deleteProductionOrder} gauges={gauges} currentUser={currentUser} />;
            case 'productionDashboard': return <ProductionDashboard setPage={setPage} productionOrders={productionOrders} stock={stock} currentUser={currentUser} />;
            case 'reports': return <Reports setPage={setPage} stock={stock} trefilaProduction={trefilaProduction} trelicaProduction={trelicaProduction} />;
            case 'userManagement': return <UserManagement users={users} employees={employees} addUser={addUser} updateUser={updateUser} deleteUser={deleteUser} setPage={setPage} />;
            case 'finishedGoods': return <FinishedGoods finishedGoods={finishedGoods} pontasStock={pontasStock} setPage={setPage} finishedGoodsTransfers={finishedGoodsTransfers} createFinishedGoodsTransfer={createFinishedGoodsTransfer} onDelete={deleteFinishedGoods} />;
            case 'partsManager': return <SparePartsManager />;
            case 'continuousImprovement': return <ContinuousImprovement setPage={setPage} />;
            case 'workInstructions': return <WorkInstructions setPage={setPage} />;
            case 'peopleManagement': return <PeopleManagement setPage={setPage} currentUser={currentUser} />;
            case 'gaugesManager': return <GaugesManager gauges={gauges} onAdd={addGauge} onDelete={deleteGauge} onRestoreDefaults={restoreDefaultGauges} />;
            case 'meetingsTasks':
                return <MeetingsTasks meetings={meetings} currentUser={currentUser} employees={employees} onAddMeeting={handleAddMeeting} onUpdateMeeting={handleUpdateMeeting} onDeleteMeeting={handleDeleteMeeting} />;
            default: return <Login onLogin={handleLogin} error={null} />;
        }
    };

    return (
        <div className="app-container">
            {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
            {currentUser && page !== 'login' && (
                <>
                    <div className={`sidebar-overlay ${isMobileMenuOpen ? 'active' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />
                    <Sidebar page={page} setPage={(p) => { setPage(p); setIsMobileMenuOpen(false); }} currentUser={currentUser} notificationCount={pendingKaizenCount} isMobileMenuOpen={isMobileMenuOpen} onLogout={handleLogout} />
                </>
            )}
            <main className="main-content">
                {currentUser && page !== 'login' && (
                    <header className="top-bar no-print">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setIsMobileMenuOpen(true)} className="mobile-menu-btn">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
                            </button>
                            <span className="text-slate-400 text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                                {page === 'trefila_in_progress' ? 'Produção Trefila' :
                                    page === 'trelica_in_progress' ? 'Produção Treliça' :
                                        page === 'productionDashboard' ? 'Painel de Controle' :
                                            page.charAt(0).toUpperCase() + page.slice(1).replace('_', ' ')}
                            </span>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="flex flex-col items-end">
                                <span className="text-sm font-bold text-slate-800">{currentUser?.username}</span>
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{currentUser?.role}</span>
                            </div>
                            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg></button>
                        </div>
                    </header>
                )}
                <div className={currentUser && page !== 'login' ? 'p-4' : ''}>{renderPage()}</div>
            </main>
        </div>
    );
};

export default App;
