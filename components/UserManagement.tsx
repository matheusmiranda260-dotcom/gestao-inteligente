import React, { useState } from 'react';
import type { Page, User, Employee } from '../types';
import { ArrowLeftIcon, PencilIcon, TrashIcon, WarningIcon } from './icons';

interface UserManagementProps {
    users: User[];
    employees: Employee[];
    addUser: (data: { username: string; password: string; permissions: Partial<Record<Page, boolean>>; employeeId?: string }) => void;
    updateUser: (userId: string, data: Partial<User>) => void;
    deleteUser: (userId: string) => void;
    setPage: (page: Page) => void;
}

const permissionCategories = [
    {
        title: '📦 Estoque',
        permissions: [
            { page: 'stock', label: 'Gestão de Lotes (Visualização)' },
            { page: 'stock_add', label: 'Adicionar ao Estoque (Conferência)' },
            { page: 'stock_transfer', label: 'Transferência entre Setores' },
            { page: 'stock_inventory', label: 'Auditoria de Inventário (Celular)' },
            { page: 'stock_map', label: 'Mapa de Estoque (Pirâmide)' },
        ]
    },
    {
        title: '🏭 Produção - Trefila',
        permissions: [
            { page: 'trefila_in_progress', label: 'Painel: Em Produção' },
            { page: 'trefila_weighing', label: 'Pesagem de Rolos' },
            { page: 'trefila_pending', label: 'Fila: Próximas Produções' },
            { page: 'trefila_completed', label: 'Histórico: Produções Finalizadas' },
            { page: 'trefila_reports', label: 'Relatórios de Turno' },
            { page: 'productionOrder', label: 'Criar Nova Ordem de Produção' },
        ]
    },
    {
        title: '🏗️ Produção - Treliça',
        permissions: [
            { page: 'trelica_in_progress', label: 'Painel: Em Produção' },
            { page: 'trelica_pending', label: 'Fila: Próximas Produções' },
            { page: 'trelica_completed', label: 'Histórico: Produções Finalizadas' },
            { page: 'trelica_reports', label: 'Relatórios de Turno' },
            { page: 'productionOrderTrelica', label: 'Criar Nova Ordem de Produção' },
            { page: 'finishedGoods', label: 'Estoque de Produto Acabado' },
        ]
    },
    {
        title: '📊 Gestão & Sistema',
        permissions: [
            { page: 'productionDashboard', label: 'Dashboard Geral de Produção' },
            { page: 'reports', label: 'Relatórios Gerenciais e KPIs' },
            { page: 'peopleManagement', label: 'Gestão de Pessoas (RH)' },
            { page: 'continuousImprovement', label: 'Melhoria Contínua (Kaizen)' },
            { page: 'workInstructions', label: 'Instruções de Trabalho (POP)' },
            { page: 'partsManager', label: 'Gerenciador de Peças (Manutenção)' },
            { page: 'gaugesManager', label: 'Configurações de Bitolas' },
            { page: 'userManagement', label: 'Controle de Usuários e Acessos' },
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
    const [employeeId, setEmployeeId] = useState(user?.employeeId || '');
    const isEditing = !!user;

    const handlePermissionChange = (page: Page, isChecked: boolean) => {
        setPermissions(prev => ({ ...prev, [page]: isChecked }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isEditing && (!username || !password)) {
            alert('Nome de usuário e senha são obrigatórios.');
            return;
        }
        if (isEditing) {
            const dataToSubmit: Partial<User> = { permissions, employeeId };
            if (password) {
                dataToSubmit.password = password;
            }
            onSubmit(dataToSubmit);
        } else {
            onSubmit({ username, password, permissions, employeeId });
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
                            <label className="block text-sm font-medium text-slate-700">Nome de Usuário</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="mt-1 p-2 w-full border border-slate-300 rounded-md"
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
                        <h3 className="text-lg font-bold text-slate-800 mb-4 px-1">Permissões de Acesso</h3>
                        <div className="space-y-6">
                            {permissionCategories.map((category) => (
                                <div key={category.title} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <h4 className="text-sm font-black text-indigo-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                        {category.title}
                                    </h4>
                                    <div className="grid grid-cols-1 gap-2">
                                        {category.permissions.map(({ page, label }) => (
                                            <label key={page} className="flex items-center space-x-3 p-2.5 rounded-lg hover:bg-white hover:shadow-sm transition-all cursor-pointer border border-transparent hover:border-slate-200 group">
                                                <input
                                                    type="checkbox"
                                                    checked={!!permissions[page as Page]}
                                                    onChange={(e) => handlePermissionChange(page as Page, e.target.checked)}
                                                    className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all"
                                                />
                                                <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
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


const UserManagement: React.FC<UserManagementProps> = ({ users, employees, addUser, updateUser, deleteUser, setPage }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [deletingUser, setDeletingUser] = useState<User | null>(null);

    // Permite gerenciar todos os usuários, mas o admin principal (id: 'admin') pode ter proteção extra se quiser
    const manageableUsers = users.filter(u => u.username !== 'admin');

    const handleAddUser = (data: { username: string; password: string; permissions: Partial<Record<Page, boolean>>; employeeId?: string }) => {
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

            <header className="flex items-center mb-6 pt-4">
                <h1 className="text-3xl font-bold text-slate-800">Gerenciar Usuários</h1>
            </header>

            <div className="mb-6 flex justify-end">
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-[#0F3F5C] hover:bg-[#0A2A3D] text-white font-bold py-2 px-4 rounded-lg transition"
                >
                    Adicionar Usuário
                </button>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-semibold text-slate-700 mb-4">Lista de Usuários</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-500">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                            <tr>
                                <th scope="col" className="px-6 py-3">Nome de Usuário</th>
                                <th scope="col" className="px-6 py-3">Função</th>
                                <th scope="col" className="px-6 py-3">Permissões</th>
                                <th scope="col" className="px-6 py-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {manageableUsers.map(user => (
                                <tr key={user.id} className="bg-white border-b hover:bg-slate-50">
                                    <td className="px-6 py-4 font-medium text-slate-900">{user.username}</td>
                                    <td className="px-6 py-4 capitalize">{user.role}</td>
                                    <td className="px-6 py-4 font-medium text-slate-600">{Object.values(user.permissions || {}).filter(Boolean).length} / {manageablePages.length}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center space-x-4">
                                            <button onClick={() => setEditingUser(user)} className="p-1 text-slate-600 hover:text-slate-800 transition-colors" title="Editar Usuário">
                                                <PencilIcon className="h-5 w-5" />
                                            </button>
                                            <button onClick={() => setDeletingUser(user)} className="p-1 text-red-600 hover:text-red-800 transition-colors" title="Excluir Usuário">
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
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