import React, { useState, useMemo, useEffect } from 'react';
import type { Page, User, Employee, UserAccessLog } from '../types';
import { ArrowLeftIcon, PencilIcon, TrashIcon, WarningIcon } from './icons';

export const AVAILABLE_MACHINES = [
    { id: 'Trefila 1', name: 'Trefila 1', short: 'TR 1', type: 'Trefila', icon: '⚡' },
    { id: 'Trefila 2', name: 'Trefila 2', short: 'TR 2', type: 'Trefila', icon: '⚡' },
    { id: 'Treliça 1', name: 'Treliça 1', short: 'TL 1', type: 'Treliça', icon: '🏗️' },
    { id: 'Treliça 2', name: 'Treliça 2', short: 'TL 2', type: 'Treliça', icon: '🏗️' },
    { id: 'Malha 1', name: 'Malha 1', short: 'ML 1', type: 'Malha', icon: '🕸️' },
];

interface UserManagementProps {
    users: User[];
    employees: Employee[];
    addUser: (data: { username: string; password: string; permissions: Partial<Record<Page, boolean>>; role: string; employeeId?: string; allowedMachines?: string[] }) => void;
    updateUser: (userId: string, data: Partial<User>) => void;
    deleteUser: (userId: string) => void;
    setPage: (page: Page) => void;
    accessLogs: UserAccessLog[];
}

const permissionCategories = [
    {
        title: '📊 Planejamento & PCP',
        permissions: [
            { page: 'pcpBoard', label: '📊 Quadro PCP (Dashboard Planejamento Semanal)' },
            { page: 'productionDashboard', label: '📈 Dashboard Geral de Produção' },
            { page: 'desbobinadeiraDashboard', label: '🌀 Dashboard Desbobinadeira' },
        ]
    },
    {
        title: '📦 Estoque',
        permissions: [
            { page: 'stock', label: 'Gestão de Lotes (Relatórios e Filtros)' },
            { page: 'stockAdd', label: 'Conferência: Adicionar Material' },
            { page: 'stockTransfer', label: 'Transferência entre Setores' },
        ]
    },
    {
        title: '🏭 Produção - Trefila',
        permissions: [
            { page: 'trefila', label: 'Dashboard Trefila (Visão Geral)' },
            { page: 'trefilaInProgress', label: 'Painel: Máquina em Operação' },
            { page: 'trefilaWeighing', label: 'Pesagem de Rolos' },
            { page: 'trefilaBitolaCheck', label: 'Aferir Bitola (Qualidade)' },
            { page: 'trefilaPending', label: 'Próximas Produções (Fila)' },
            { page: 'trefilaCompleted', label: 'Histórico de Produções' },
            { page: 'trefilaReports', label: 'Relatórios de Turno' },
            { page: 'trefilaParts', label: 'Gerenciador de Peças (Trefila)' },
            { page: 'trefilaRings', label: 'Setup de Anéis (Trocas)' },
            { page: 'productionOrder', label: 'Criar Ordem de Produção' },
        ]
    },
    {
        title: '🏗️ Produção - Treliça',
        permissions: [
            { page: 'trelica', label: 'Dashboard Treliça (Visão Geral)' },
            { page: 'trelicaInProgress', label: 'Painel: Máquina em Operação' },
            { page: 'trelicaPending', label: 'Próximas Produções (Fila)' },
            { page: 'trelicaCompleted', label: 'Histórico de Produções' },
            { page: 'trelicaReports', label: 'Relatórios de Turno' },
            { page: 'trelicaParts', label: 'Gerenciador de Peças (Treliça)' },
            { page: 'productionOrderTrelica', label: 'Criar Ordem de Produção' },
            { page: 'finishedGoods', label: 'Estoque de Produto Acabado' },
        ]
    },
    {
        title: '🕸️ Produção - Malha',
        permissions: [
            { page: 'malha', label: 'Dashboard Malha (Visão Geral)' },
            { page: 'malhaInProgress', label: 'Painel: Máquina em Operação' },
            { page: 'malhaPending', label: 'Próximas Produções (Fila)' },
            { page: 'malhaCompleted', label: 'Histórico de Produções' },
            { page: 'malhaReports', label: 'Relatórios de Turno' },
            { page: 'productionOrderMalha', label: 'Criar Ordem de Produção' },
        ]
    },
    {
        title: '🧪 Qualidade e Suporte',
        permissions: [
            { page: 'laboratory', label: '🔬 Laboratório (Ensaios e Testes)' },
            { page: 'reports', label: '📈 Relatórios e KPIs Estratégicos' },
            { page: 'continuousImprovement', label: '💡 Melhoria Contínua (Kaizen)' },
            { page: 'workInstructions', label: '📖 Instruções de Trabalho (POP)' },
        ]
    },
    {
        title: '👥 Gestão & RH',
        permissions: [
            { page: 'peopleManagement', label: 'Gestão de Pessoas' },
            { page: 'meetingsTasks', label: 'Reuniões e Tarefas (Atas)' },
            { page: 'userManagement', label: 'Controle de Usuários e Acessos' },
            { page: 'partsManager', label: 'Catálogo de Peças (Global)' },
            { page: 'gaugesManager', label: 'Configurações de Bitolas' },
        ]
    }
];

const manageablePages = permissionCategories.flatMap(c => c.permissions.map(p => p.page as Page));

const UserModal: React.FC<{
    user?: User | null;
    employees: Employee[];
    onClose: () => void;
    onSubmit: (data: any) => void;
}> = ({ user, employees, onClose, onSubmit }) => {
    const [username, setUsername] = useState(user?.username || '');
    const [password, setPassword] = useState('');
    const [permissions, setPermissions] = useState<Partial<Record<Page, boolean>>>(
        user?.permissions || {}
    );
    const [role, setRole] = useState(user?.role || 'user');
    const [employeeId, setEmployeeId] = useState(user?.employeeId || '');
    const [allowedMachines, setAllowedMachines] = useState<string[]>(() => {
        if (user?.allowedMachines && Array.isArray(user.allowedMachines)) {
            return user.allowedMachines;
        }
        return AVAILABLE_MACHINES.map(m => m.id);
    });
    const isEditing = !!user;

    const handleRoleChange = (newRole: string) => {
        setRole(newRole as any);
        if (newRole === 'viewer') {
            setPermissions({ pcpBoard: true, productionDashboard: true });
        }
    };

    const handlePermissionChange = (page: Page, isChecked: boolean) => {
        setPermissions(prev => ({ ...prev, [page]: isChecked }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isEditing && (!username || !password)) {
            alert('Nome de usuário e senha são obrigatórios.');
            return;
        }
        const effectivePerms = role === 'viewer' ? { pcpBoard: true, productionDashboard: true, ...permissions } : permissions;
        const effectiveMachines = allowedMachines.length > 0 ? allowedMachines : AVAILABLE_MACHINES.map(m => m.id);
        
        if (isEditing) {
            const dataToSubmit: Partial<User> = { 
                permissions: effectivePerms, 
                role, 
                employeeId, 
                allowedMachines: effectiveMachines 
            };
            if (password) {
                dataToSubmit.password = password;
            }
            onSubmit(dataToSubmit);
        } else {
            onSubmit({ 
                username, 
                password, 
                permissions: effectivePerms, 
                role, 
                employeeId, 
                allowedMachines: effectiveMachines 
            });
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
                <h2 className="text-2xl font-bold text-slate-800 mb-6">{isEditing ? `Editar Usuário: ${user.username}` : 'Adicionar Novo Usuário'}</h2>
                <div className="space-y-4 flex-grow overflow-y-auto pr-2">
                    {!isEditing && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700">Nome de Usuário (Login)</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="mt-1 p-2 w-full border border-slate-300 rounded-md font-semibold"
                                placeholder="Ex: pcp.leitura ou diretoria"
                                required
                            />
                        </div>
                    )}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700">Vincular Funcionário (Opcional)</label>
                        <select
                            value={employeeId}
                            onChange={(e) => setEmployeeId(e.target.value)}
                            className="mt-1 p-2 w-full border border-slate-300 rounded-md"
                        >
                            <option value="">-- Nenhum --</option>
                            {employees.filter(e => e.active).map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name} ({emp.sector || 'Sem setor'})</option>
                            ))}
                        </select>
                        <p className="text-xs text-slate-500 mt-1">Ao vincular, o usuário verá seu próprio Painel de RH.</p>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700">Função / Perfil (Role)</label>
                        <select
                            value={role}
                            onChange={(e) => handleRoleChange(e.target.value)}
                            className="mt-1 p-2 w-full border border-slate-300 rounded-md font-bold text-slate-800"
                        >
                            <option value="user">👷 Operador / Usuário (Permissões Personalizadas)</option>
                            <option value="viewer">👁️ Visualizador (Somente Leitura - Quadro PCP & Dashboard)</option>
                            <option value="gestor">👔 Gestor / Supervisor (Acesso e Edição Total)</option>
                            <option value="admin">👑 Administrador Total</option>
                        </select>
                        <p className="text-[11px] text-slate-500 mt-1">
                            {role === 'viewer'
                                ? '👁️ Perfil exclusivo para visualização na TV/Diretoria. Não permite editar, criar ou alterar dados.'
                                : role === 'gestor' || role === 'admin'
                                ? '👑 Acesso total liberado para todas as telas e configurações.'
                                : '👷 Permite marcar manualmente quais telas o operador pode acessar.'}
                        </p>
                    </div>

                    {/* Parametrização de Máquinas Permitidas para Visualização */}
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-xs">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                                <span>⚙️ Máquinas com Acesso de Visualização</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    allowedMachines.length === AVAILABLE_MACHINES.length
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-blue-100 text-blue-800'
                                }`}>
                                    {allowedMachines.length === AVAILABLE_MACHINES.length ? 'Todas (5/5)' : `${allowedMachines.length} de ${AVAILABLE_MACHINES.length}`}
                                </span>
                            </label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setAllowedMachines(AVAILABLE_MACHINES.map(m => m.id))}
                                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 cursor-pointer"
                                >
                                    Marcar Todas
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAllowedMachines([])}
                                    className="text-[10px] font-bold text-slate-500 hover:text-red-600 bg-white px-2 py-0.5 rounded border border-slate-200 cursor-pointer"
                                >
                                    Limpar
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 mb-3">
                            Selecione quais máquinas este usuário poderá visualizar no Quadro PCP e no Painel de Produção.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {AVAILABLE_MACHINES.map(mach => {
                                const isChecked = allowedMachines.includes(mach.id);
                                return (
                                    <label
                                        key={mach.id}
                                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all select-none ${
                                            isChecked 
                                                ? 'bg-white border-blue-500 shadow-xs ring-1 ring-blue-400' 
                                                : 'bg-white/60 border-slate-200 hover:bg-white text-slate-400'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setAllowedMachines(prev => [...prev, mach.id]);
                                                } else {
                                                    setAllowedMachines(prev => prev.filter(m => m !== mach.id));
                                                }
                                            }}
                                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                        />
                                        <span className="text-base">{mach.icon}</span>
                                        <div className="flex flex-col">
                                            <span className={`text-xs font-black ${isChecked ? 'text-slate-800' : 'text-slate-500'}`}>{mach.name}</span>
                                            <span className="text-[10px] text-slate-400 font-medium">Setor {mach.type}</span>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-700">{isEditing ? 'Nova Senha' : 'Senha'}</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 p-2 w-full border border-slate-300 rounded-md"
                            required={!isEditing}
                            placeholder={isEditing ? 'Deixe em branco para não alterar' : ''}
                        />
                    </div>
                    <div className="mt-6 border-t pt-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-extrabold text-[#0F3F5C] px-1">Permissões de Acesso</h3>
                            {role === 'viewer' ? (
                                <span className="text-[10px] bg-sky-100 text-sky-800 font-black px-2 py-1 rounded-full uppercase tracking-tighter">👁️ Somente Leitura PCP</span>
                            ) : role === 'user' ? (
                                <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-1 rounded-full uppercase tracking-tighter">Personalizado</span>
                            ) : (
                                <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded-full uppercase tracking-tighter">Acesso Total</span>
                            )}
                        </div>

                        {role === 'viewer' ? (
                            <div className="bg-sky-50 border border-sky-200 p-5 rounded-2xl text-center shadow-sm animate-fadeIn">
                                <div className="w-12 h-12 bg-sky-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-xl shadow-md shadow-sky-200">
                                    👁️
                                </div>
                                <p className="text-sm font-black text-sky-950">Acesso Restrito: Somente Visualização do PCP</p>
                                <p className="text-xs text-sky-800 mt-1.5 px-3 leading-relaxed font-medium">
                                    Este usuário terá permissão para <strong>consultar em tempo real o Quadro PCP e Dashboards</strong> (ideal para telas de TV e diretoria). 
                                    <br />
                                    <span className="inline-block mt-1 text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                        🚫 Todas as ações de criação (+), arrastar OP, estender lotes e edições estarão bloqueadas.
                                    </span>
                                </p>
                            </div>
                        ) : role !== 'user' ? (
                            <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl text-center">
                                <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-200">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                                </div>
                                <p className="text-sm font-bold text-emerald-800">Acesso Total Habilitado</p>
                                <p className="text-xs text-emerald-600 mt-1 px-4">Usuários com função <strong>{role === 'admin' ? 'Administrador' : 'Gestor'}</strong> possuem permissão para acessar todas as funcionalidades do sistema automaticamente.</p>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-fadeIn">
                                {permissionCategories.map((category) => (
                                    <div key={category.title} className="bg-slate-50 p-4 rounded-xl border border-slate-100 group/cat transition-all hover:shadow-md hover:bg-white overflow-hidden">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="text-sm font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                                {category.title}
                                            </h4>
                                            <div className="flex gap-2 opacity-0 group-hover/cat:opacity-100 transition-opacity">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newPerms = { ...permissions };
                                                        category.permissions.forEach(p => newPerms[p.page as Page] = true);
                                                        setPermissions(newPerms);
                                                    }}
                                                    className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded transition"
                                                >
                                                    Marcar Tudo
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newPerms = { ...permissions };
                                                        category.permissions.forEach(p => newPerms[p.page as Page] = false);
                                                        setPermissions(newPerms);
                                                    }}
                                                    className="text-[10px] font-bold text-slate-400 hover:text-red-500 bg-white px-2 py-0.5 rounded border border-slate-100 transition"
                                                >
                                                    Limpar
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2">
                                            {category.permissions.map(({ page, label }) => (
                                                <label key={page} className="flex items-center space-x-3 p-2.5 rounded-lg hover:bg-slate-50 transition-all cursor-pointer border border-transparent hover:border-slate-100 group">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!permissions[page as Page]}
                                                        onChange={(e) => handlePermissionChange(page as Page, e.target.checked)}
                                                        className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                                                    />
                                                    <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">{label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex justify-end gap-4 pt-4 mt-auto border-t">
                    <button type="button" onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition">Cancelar</button>
                    <button type="submit" className="bg-[#0F3F5C] text-white font-bold py-2 px-4 rounded-lg hover:bg-[#0A2A3D] transition">Salvar</button>
                </div>
            </form>
        </div>
    );
};


const formatDuration = (seconds?: number | null): string => {
    if (seconds === undefined || seconds === null || isNaN(seconds) || seconds <= 0) return '< 1 min';
    const mins = Math.floor(seconds / 60);
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hours > 0) {
        return `${hours}h ${remMins}m (${mins} min)`;
    }
    return `${mins} min`;
};

const formatTimeOnly = (dateStr?: string | null): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const formatDateFriendly = (dateStr?: string | null): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

const getActionIcon = (actionText: string): string => {
    const act = (actionText || '').toLowerCase();
    if (act.includes('login') || act.includes('entrou')) return '🔑';
    if (act.includes('logout') || act.includes('saiu') || act.includes('desconectou')) return '🚪';
    if (act.includes('pcp') || act.includes('quadro')) return '📊';
    if (act.includes('estoque') || act.includes('lote')) return '📦';
    if (act.includes('trefila')) return '⚡';
    if (act.includes('treliça') || act.includes('trelica')) return '🏗️';
    if (act.includes('malha')) return '🕸️';
    if (act.includes('pesagem') || act.includes('peso')) return '⚖️';
    if (act.includes('usuário') || act.includes('usuario')) return '👥';
    if (act.includes('qualidade') || act.includes('laboratório') || act.includes('laboratorio')) return '🔬';
    if (act.includes('ordem') || act.includes('op')) return '📝';
    if (act.includes('relatório') || act.includes('relatorio')) return '📈';
    return '📌';
};

const AccessHistoryModal: React.FC<{
    user: User;
    accessLogs: UserAccessLog[];
    onClose: () => void;
}> = ({ user, accessLogs, onClose }) => {
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

    const userLogs = useMemo(() => {
        return accessLogs
            .filter(log => log.userId === user.id || log.username?.toLowerCase() === user.username.toLowerCase())
            .sort((a, b) => new Date(b.loginAt).getTime() - new Date(a.loginAt).getTime());
    }, [accessLogs, user.id, user.username]);

    const activeSessions = useMemo(() => {
        const now = Date.now();
        const PRESENCE_TIMEOUT_MS = 45000; // 45 segundos para detecção rápida e precisa
        const rawActive = userLogs.filter(log => 
            log.isActive !== false &&
            !log.logoutAt &&
            log.lastActivityAt &&
            (now - new Date(log.lastActivityAt).getTime() >= -30000) &&
            (now - new Date(log.lastActivityAt).getTime() < PRESENCE_TIMEOUT_MS)
        );

        // Deduplica estritamente por dispositivo para que abas do mesmo PC contem como 1 dispositivo
        const deviceMap = new Map<string, UserAccessLog>();
        rawActive.forEach(log => {
            const key = log.deviceId || log.deviceInfo || 'single_device';
            const existing = deviceMap.get(key);
            if (!existing || new Date(log.lastActivityAt).getTime() > new Date(existing.lastActivityAt).getTime()) {
                deviceMap.set(key, log);
            }
        });

        return Array.from(deviceMap.values());
    }, [userLogs]);

    const isUserOnline = activeSessions.length > 0 || Boolean(
        user.isOnline && 
        user.lastSeenAt && 
        (Date.now() - new Date(user.lastSeenAt).getTime() >= -30000) &&
        (Date.now() - new Date(user.lastSeenAt).getTime() < 45000)
    );

    const totalDurationSeconds = useMemo(() => {
        return userLogs.reduce((acc, log) => {
            if (log.durationSeconds && log.durationSeconds > 0) {
                return acc + log.durationSeconds;
            }
            if (log.loginAt && log.logoutAt) {
                const diff = Math.round((new Date(log.logoutAt).getTime() - new Date(log.loginAt).getTime()) / 1000);
                return acc + Math.max(0, diff);
            }
            return acc;
        }, 0);
    }, [userLogs]);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden border border-slate-200">
                {/* Cabeçalho do Modal */}
                <div className="bg-gradient-to-r from-[#0F3F5C] via-[#0D354E] to-[#0A2A3D] p-5 text-white flex items-center justify-between shrink-0 shadow-md">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl shadow-inner">
                            📜
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-lg font-black tracking-wide text-white">
                                    Histórico de Sessões & Atividades
                                </h2>
                                <span className="bg-orange-500/20 text-orange-300 border border-orange-400/40 text-[11px] font-black px-2.5 py-0.5 rounded-full">
                                    {user.username}
                                </span>
                            </div>
                            <p className="text-xs text-blue-200/90 mt-0.5 font-medium">
                                Rastreamento de tempo ativo, dispositivos e páginas/operações acessadas
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-colors cursor-pointer"
                        title="Fechar"
                    >
                        <span className="text-2xl font-bold leading-none">&times;</span>
                    </button>
                </div>

                {/* Cards de Resumo Rápido */}
                <div className="bg-slate-50 border-b border-slate-200 p-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status Atual</span>
                        <div className="flex items-center gap-1.5 mt-1">
                            {isUserOnline ? (
                                <>
                                    <span className="relative flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                    </span>
                                    <span className="text-xs font-black text-emerald-700">Online Agora</span>
                                    {activeSessions.length > 1 && (
                                        <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded border border-amber-300">
                                            {activeSessions.length} PCs
                                        </span>
                                    )}
                                </>
                            ) : (
                                <>
                                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300"></span>
                                    <span className="text-xs font-bold text-slate-500">Offline</span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tempo Acumulado</span>
                        <p className="text-xs font-black text-blue-950 mt-1">
                            {formatDuration(totalDurationSeconds)}
                        </p>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total de Sessões</span>
                        <p className="text-xs font-black text-slate-800 mt-1">
                            {userLogs.length} acesso(s)
                        </p>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Perfil / Role</span>
                        <p className="text-xs font-black text-slate-800 mt-1 capitalize">
                            {user.role === 'viewer' ? '👁️ Somente PCP' : user.role === 'gestor' ? '👔 Gestor' : user.role === 'admin' ? '👑 Admin' : '👷 Operador'}
                        </p>
                    </div>
                </div>

                {/* Seção de Dispositivos Conectados em Tempo Real (se houver sessões ativas) */}
                {activeSessions.length > 0 && (
                    <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white p-4 border-b border-blue-800 shadow-inner">
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                                </span>
                                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                                    <span>⚡ Dispositivos / Computadores Ativos Agora ({activeSessions.length})</span>
                                </h3>
                            </div>
                            {activeSessions.length > 1 && (
                                <span className="text-[10px] bg-amber-400/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-full font-bold">
                                    ⚠️ Compartilhamento Simultâneo
                                </span>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {activeSessions.map((session, sIdx) => {
                                const focus = session.focusStatus || 'active';
                                const focusLabel = focus === 'active' ? '🟢 Ativo na Tela' : focus === 'background' ? '🟡 Em 2º Plano' : '⚪ Ausente';
                                const focusColor = focus === 'active' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' : focus === 'background' ? 'bg-amber-500/20 text-amber-300 border-amber-400/30' : 'bg-slate-500/20 text-slate-300 border-slate-400/30';
                                const connectedMins = Math.max(1, Math.round((Date.now() - new Date(session.loginAt).getTime()) / 60000));

                                return (
                                    <div key={session.id || sIdx} className="bg-white/10 rounded-lg p-2.5 border border-white/15 text-xs">
                                        <div className="flex items-center justify-between gap-1 mb-1.5">
                                            <span className="font-bold text-white flex items-center gap-1 truncate text-[11px]">
                                                <span>💻</span>
                                                <span className="truncate">{session.deviceInfo || `Dispositivo ${sIdx + 1}`}</span>
                                            </span>
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${focusColor} shrink-0`}>
                                                {focusLabel}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-blue-100 flex items-center justify-between gap-2">
                                            <div className="truncate">
                                                <span className="text-blue-200">Tela: </span>
                                                <span className="text-amber-300 font-bold">{session.currentPage || user.currentPage || 'Quadro PCP'}</span>
                                            </div>
                                            <span className="text-[10px] text-blue-300 shrink-0 font-medium">
                                                há {connectedMins}m
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                
                {/* Lista de Sessões com Linha do Tempo de Atividades */}
                <div className="flex-grow overflow-y-auto p-4 space-y-3.5 bg-slate-100/70">
                    {userLogs.length > 0 ? (
                        userLogs.map((log, index) => {
                            const isCurrentlyActive = user.isOnline && index === 0 && !log.logoutAt;
                            const loginDateFriendly = formatDateFriendly(log.loginAt);
                            const startTime = formatTimeOnly(log.loginAt);
                            
                            let endTime = '';
                            let durationSec = log.durationSeconds || 0;

                            if (isCurrentlyActive) {
                                endTime = 'Agora';
                                durationSec = Math.max(0, Math.round((Date.now() - new Date(log.loginAt).getTime()) / 1000));
                            } else if (log.logoutAt) {
                                endTime = formatTimeOnly(log.logoutAt);
                                if (!durationSec) {
                                    durationSec = Math.max(0, Math.round((new Date(log.logoutAt).getTime() - new Date(log.loginAt).getTime()) / 1000));
                                }
                            } else if (log.lastActivityAt && new Date(log.lastActivityAt).getTime() > new Date(log.loginAt).getTime()) {
                                endTime = formatTimeOnly(log.lastActivityAt);
                                if (!durationSec) {
                                    durationSec = Math.max(0, Math.round((new Date(log.lastActivityAt).getTime() - new Date(log.loginAt).getTime()) / 1000));
                                }
                            } else {
                                endTime = startTime;
                            }

                            const durationFormatted = formatDuration(durationSec);
                            
                            // Normalizar lista de ações
                            const rawActions = Array.isArray(log.actions) ? log.actions : [];
                            const parsedActions = rawActions.map((item: any) => {
                                if (typeof item === 'string') {
                                    return { action: item, timestamp: log.loginAt };
                                }
                                return item;
                            });

                            const isExpanded = expandedLogId === log.id || parsedActions.length <= 3;
                            const hasMultipleActions = parsedActions.length > 3;

                            return (
                                <div 
                                    key={log.id} 
                                    className={`bg-white rounded-xl border transition-all shadow-xs ${
                                        isCurrentlyActive 
                                            ? 'border-emerald-400 ring-2 ring-emerald-200/70 shadow-sm' 
                                            : 'border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    {/* Topo do Card de Sessão */}
                                    <div className={`p-3.5 border-b rounded-t-xl flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap ${
                                        isCurrentlyActive 
                                            ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-emerald-200' 
                                            : 'bg-slate-50 border-slate-200/80'
                                    }`}>
                                        <div className="flex items-center gap-2.5">
                                            {isCurrentlyActive ? (
                                                <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shadow-sm animate-pulse">
                                                    🟢
                                                </div>
                                            ) : (
                                                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm">
                                                    📅
                                                </div>
                                            )}
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs font-black text-slate-800">
                                                        {loginDateFriendly}
                                                    </span>
                                                    {isCurrentlyActive && (
                                                        <span className="text-[10px] bg-emerald-500 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-2xs">
                                                            Sessão Ativa Agora
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-600 font-semibold">
                                                    <span>🕒 <strong>{startTime}</strong> até <strong>{endTime}</strong></span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Duração Destacada */}
                                        <div className="flex items-center gap-2">
                                            <div className={`px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 shadow-2xs ${
                                                isCurrentlyActive 
                                                    ? 'bg-emerald-600 text-white shadow-emerald-200' 
                                                    : 'bg-blue-900 text-white'
                                            }`}>
                                                <span>⏱️</span>
                                                <span>{durationFormatted}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Linha do Tempo de Atividades Realizadas na Sessão */}
                                    <div className="p-3.5">
                                        {parsedActions.length > 0 ? (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                                                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                                        <span>🔍 Atividades Registradas ({parsedActions.length})</span>
                                                    </span>
                                                    {hasMultipleActions && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                                                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                                                        >
                                                            {expandedLogId === log.id ? 'Ocultar ▲' : `Ver todas as ${parsedActions.length} ações ▼`}
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="space-y-1.5 pt-1">
                                                    {(isExpanded ? parsedActions : parsedActions.slice(0, 3)).map((act: any, aIdx: number) => {
                                                        const actionTime = formatTimeOnly(act.timestamp) || startTime;
                                                        const icon = getActionIcon(act.action);
                                                        return (
                                                            <div 
                                                                key={aIdx} 
                                                                className="flex items-start gap-2.5 p-1.5 rounded-lg bg-slate-50/80 hover:bg-slate-100 border border-slate-100 transition-colors text-xs"
                                                            >
                                                                <span className="text-slate-400 font-mono font-bold text-[11px] shrink-0 pt-0.5">
                                                                    {actionTime}
                                                                </span>
                                                                <span className="shrink-0">{icon}</span>
                                                                <div className="flex-1 min-w-0">
                                                                    <span className="font-bold text-slate-800 block truncate">
                                                                        {act.action}
                                                                    </span>
                                                                    {act.details && (
                                                                        <span className="text-[11px] text-slate-500 font-medium block truncate">
                                                                            {act.details}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium p-2 bg-slate-50 rounded-lg">
                                                <span>🔑</span>
                                                <span>Sessão de acesso registrada no sistema às {startTime}.</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200">
                            <span className="text-4xl block mb-2">📜</span>
                            <p className="font-bold text-slate-600">Nenhum registro de acesso encontrado.</p>
                            <p className="text-xs text-slate-400 mt-1">Os acessos futuros deste usuário serão registrados com tempo ativo e atividades.</p>
                        </div>
                    )}
                </div>
                
                {/* Rodapé */}
                <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center shrink-0">
                    <span className="text-xs text-slate-500 font-medium">
                        Mostrando {userLogs.length} registro(s) de sessão
                    </span>
                    <button 
                        onClick={onClose} 
                        className="bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-bold py-2 px-6 rounded-xl transition shadow-sm cursor-pointer active:scale-95"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};


const UserManagement: React.FC<UserManagementProps> = ({ users, employees, addUser, updateUser, deleteUser, setPage, accessLogs }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [deletingUser, setDeletingUser] = useState<User | null>(null);
    const [viewingHistoryUser, setViewingHistoryUser] = useState<User | null>(null);
    const [tick, setTick] = useState<number>(() => Date.now());
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Ticker contínuo a cada 2 segundos para reavaliar status Online/Em 2º Plano/Offline instantaneamente
    useEffect(() => {
        const interval = setInterval(() => {
            setTick(Date.now());
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    const handleForceRefresh = () => {
        setIsRefreshing(true);
        setTick(Date.now());
        setTimeout(() => setIsRefreshing(false), 600);
    };

    // Permite gerenciar todos os usuários, mas o admin principal (id: 'admin') pode ter proteção extra se quiser
    const manageableUsers = users.filter(u => u.username !== 'admin');

    const handleAddUser = (data: { username: string; password: string; permissions: Partial<Record<Page, boolean>>; role: string; employeeId?: string; allowedMachines?: string[] }) => {
        addUser(data);
        setIsModalOpen(false);
    };

    const handleEditUser = (data: Partial<User>) => {
        if (editingUser) {
            updateUser(editingUser.id, data);
        }
        setEditingUser(null);
    };

    const handleDeleteConfirm = () => {
        if (deletingUser) {
            deleteUser(deletingUser.id);
        }
        setDeletingUser(null);
    };

    return (
        <div className="p-4 sm:p-6 md:p-8">
            {isModalOpen && <UserModal employees={employees} onClose={() => setIsModalOpen(false)} onSubmit={handleAddUser} />}
            {editingUser && <UserModal user={editingUser} employees={employees} onClose={() => setEditingUser(null)} onSubmit={handleEditUser} />}
            {viewingHistoryUser && <AccessHistoryModal user={viewingHistoryUser} accessLogs={accessLogs} onClose={() => setViewingHistoryUser(null)} />}
            {deletingUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md text-center">
                        <WarningIcon className="h-16 w-16 mx-auto text-red-500 mb-4" />
                        <p className="text-lg text-slate-700 mb-6">Tem certeza que deseja excluir o usuário <strong>{deletingUser.username}</strong>? Esta ação não pode ser desfeita.</p>
                        <div className="flex justify-center gap-4">
                            <button onClick={() => setDeletingUser(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-6 rounded-lg transition">Cancelar</button>
                            <button onClick={handleDeleteConfirm} className="bg-red-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-700 transition">Confirmar Exclusão</button>
                        </div>
                    </div>
                </div>
            )}

            <header className="flex items-center justify-between mb-6 pt-4 flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Gerenciar Usuários</h1>
                    <p className="text-xs text-slate-500 font-medium mt-1">Presença e status de engajamento em tempo real (atualizado a cada 2 segundos)</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={handleForceRefresh}
                        className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-2 px-3.5 rounded-lg transition shadow-2xs flex items-center gap-1.5 text-xs cursor-pointer active:scale-95"
                        title="Verificar status dos usuários agora"
                    >
                        <span className={`inline-block transition-transform duration-500 ${isRefreshing ? 'rotate-180' : ''}`}>🔄</span>
                        Atualizar Status
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-bold py-2 px-4 rounded-lg transition shadow-sm"
                    >
                        Adicionar Usuário
                    </button>
                </div>
            </header>

            <div className="bg-white p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-semibold text-slate-700 mb-4">Lista de Usuários</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-500">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                            <tr>
                                <th scope="col" className="px-6 py-3">Nome de Usuário</th>
                                <th scope="col" className="px-6 py-3">Função</th>
                                <th scope="col" className="px-6 py-3">Máquinas Visíveis</th>
                                <th scope="col" className="px-6 py-3">Status</th>
                                <th scope="col" className="px-6 py-3">Acessos</th>
                                <th scope="col" className="px-6 py-3">Último Acesso</th>
                                <th scope="col" className="px-6 py-3">Permissões</th>
                                <th scope="col" className="px-6 py-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {manageableUsers.map(user => {
                                const formattedLastAccess = user.lastLoginAt
                                    ? new Date(user.lastLoginAt).toLocaleString('pt-BR', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })
                                    : 'Sem registro';

                                const PRESENCE_TIMEOUT_MS = 45000; // 45 segundos de tolerância para sincronização em tempo real

                                const userActiveLogs = accessLogs.filter(log => {
                                    const isMatch = log.userId === user.id || (log.username && user.username && log.username.toLowerCase() === user.username.toLowerCase());
                                    if (!isMatch) return false;
                                    if (log.isActive === false || log.logoutAt || !log.lastActivityAt) return false;
                                    const diff = tick - new Date(log.lastActivityAt).getTime();
                                    return diff >= -30000 && diff < PRESENCE_TIMEOUT_MS;
                                });

                                // Deduplica estritamente por dispositivo físico para que várias abas no mesmo computador NÃO sejam contadas como múltiplos PCs
                                const deviceMap = new Map<string, UserAccessLog>();
                                userActiveLogs.forEach(log => {
                                    const key = log.deviceId || log.deviceInfo || 'single_device';
                                    const existing = deviceMap.get(key);
                                    if (!existing || new Date(log.lastActivityAt).getTime() > new Date(existing.lastActivityAt).getTime()) {
                                        deviceMap.set(key, log);
                                    }
                                });
                                const distinctActiveLogs = Array.from(deviceMap.values());

                                const isRealtimeOnline = distinctActiveLogs.length > 0 || Boolean(
                                    user.isOnline && 
                                    user.lastSeenAt && 
                                    (tick - new Date(user.lastSeenAt).getTime() >= -30000) &&
                                    (tick - new Date(user.lastSeenAt).getTime() < PRESENCE_TIMEOUT_MS)
                                );

                                const distinctDevicesCount = distinctActiveLogs.length > 0 
                                    ? distinctActiveLogs.length 
                                    : (isRealtimeOnline ? 1 : 0);

                                const userAllowed = user.allowedMachines;
                                const isCustomMachines = Array.isArray(userAllowed) && userAllowed.length > 0 && userAllowed.length < AVAILABLE_MACHINES.length;
                                const primaryActiveLog = distinctActiveLogs[0] || userActiveLogs[0];
                                const currentFocus = primaryActiveLog?.focusStatus || user.focusStatus || 'active';
                                const currentPageName = primaryActiveLog?.currentPage || user.currentPage || '';
                                
                                const latestActivityDate = primaryActiveLog?.lastActivityAt || user.lastSeenAt;
                                const secondsAgo = latestActivityDate ? Math.max(0, Math.round((tick - new Date(latestActivityDate).getTime()) / 1000)) : null;

                                return (
                                    <tr key={user.id} className="bg-white border-b hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900">{user.username}</td>
                                        <td className="px-6 py-4">
                                            {user.role === 'admin' ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">👑 Administrador</span>
                                            ) : user.role === 'gestor' ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">👔 Gestor</span>
                                            ) : user.role === 'viewer' ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200">👁️ Somente PCP</span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">👷 Operador</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {isCustomMachines ? (
                                                <div className="flex flex-wrap gap-1 max-w-[220px]">
                                                    {userAllowed!.map(m => (
                                                        <span key={m} className="text-[10px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded border border-blue-200 shadow-2xs">
                                                            {m.replace('Trefila ', 'TR ').replace('Treliça ', 'TL ').replace('Malha ', 'ML ')}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                    🌐 Todas (5/5)
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {isRealtimeOnline ? (
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="relative flex h-2.5 w-2.5">
                                                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                                                currentFocus === 'active' ? 'bg-emerald-400' : currentFocus === 'background' ? 'bg-amber-400' : 'bg-slate-400'
                                                            }`}></span>
                                                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                                                                currentFocus === 'active' ? 'bg-emerald-500' : currentFocus === 'background' ? 'bg-amber-500' : 'bg-slate-400'
                                                            }`}></span>
                                                        </span>
                                                        <span className={`font-bold text-xs ${
                                                            currentFocus === 'active' ? 'text-emerald-700' : currentFocus === 'background' ? 'text-amber-700' : 'text-slate-600'
                                                        }`}>
                                                            {currentFocus === 'active' ? 'Online (Ativo)' : currentFocus === 'background' ? 'Em 2º Plano' : 'Ausente'}
                                                        </span>
                                                        {secondsAgo !== null && (
                                                            <span className="text-[10px] text-slate-400 font-medium">
                                                                ({secondsAgo < 12 ? 'agora' : `há ${secondsAgo}s`})
                                                            </span>
                                                        )}
                                                    </div>
                                                    {currentPageName && (
                                                        <div className="text-[10px] text-slate-500 font-semibold mt-0.5 flex items-center gap-1 truncate max-w-[170px]" title={`Visualizando: ${currentPageName}`}>
                                                            <span>📍</span>
                                                            <span className="truncate">{currentPageName}</span>
                                                        </div>
                                                    )}
                                                    {distinctDevicesCount > 1 && (
                                                        <div className="mt-1">
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded shadow-2xs animate-pulse" title={`${distinctDevicesCount} computadores/dispositivos estão conectados simultaneamente nesta conta.`}>
                                                                ⚡ {distinctDevicesCount} PCs Conectados
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-slate-400 font-semibold text-xs">
                                                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300"></span>
                                                    Offline
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-700">{user.loginCount || 0}</td>
                                        <td className="px-6 py-4 text-xs font-semibold text-slate-500">{formattedLastAccess}</td>
                                        <td className="px-6 py-4 font-medium text-slate-600">{Object.values(user.permissions || {}).filter(Boolean).length} / {manageablePages.length}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center space-x-3">
                                                <button onClick={() => setViewingHistoryUser(user)} className="p-1 text-indigo-600 hover:text-indigo-800 transition-colors" title="Histórico de Acessos">
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                                                </button>
                                                <button onClick={() => setEditingUser(user)} className="p-1 text-slate-600 hover:text-slate-800 transition-colors" title="Editar Usuário">
                                                    <PencilIcon className="h-5 w-5" />
                                                </button>
                                                <button onClick={() => setDeletingUser(user)} className="p-1 text-red-600 hover:text-red-800 transition-colors" title="Excluir Usuário">
                                                    <TrashIcon className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {manageableUsers.length === 0 && (
                        <div className="text-center text-slate-500 py-10">
                            <p>Nenhum usuário cadastrado ainda.</p>
                            <p className="text-sm">Clique em "Adicionar Usuário" para começar.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserManagement;
