import React, { useState } from 'react';
import type { Page, User } from '../types';
import { ArrowLeftIcon, PencilIcon, TrashIcon, WarningIcon } from './icons';

interface UserManagementProps {
    users: User[];
    addUser: (data: { username: string; password: string; permissions: Partial<Record<Page, boolean>> }) => void;
    updateUser: (userId: string, data: Partial<User>) => void;
    deleteUser: (userId: string) => void;
    setPage: (page: Page) => void;
}

const manageablePages: { page: Page; label: string }[] = [
    { page: 'stock', label: 'Controle de Estoque' },
    { page: 'finishedGoods', label: 'Estoque Acabado' },
    { page: 'trefila', label: 'Produção (Trefila)' },
    { page: 'trelica', label: 'Produção (Treliça)' },
    { page: 'productionOrder', label: 'Ordem (Trefila)' },
    { page: 'productionOrderTrelica', label: 'Ordem (Treliça)' },
    { page: 'productionDashboard', label: 'Dashboard de Produção' },
    { page: 'reports', label: 'Relatórios' },
];

const UserModal: React.FC<{
    user?: User | null;
    onClose: () => void;
    onSubmit: (data: any) => void;
}> = ({ user, onClose, onSubmit }) => {
    const [username, setUsername] = useState(user?.username || '');
    const [password, setPassword] = useState('');
    const [permissions, setPermissions] = useState<Partial<Record<Page, boolean>>>(
        user?.permissions || {}
    );
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
            const dataToSubmit: Partial<User> = { permissions };
            if (password) {
                dataToSubmit.password = password;
            }
            onSubmit(dataToSubmit);
        } else {
            onSubmit({ username, password, permissions });
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
                    <div>
                        <h3 className="text-lg font-semibold text-slate-700 mb-2 border-b pb-2">Permissões de Acesso</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-4">
                            {manageablePages.map(({ page, label }) => (
                                <label key={page} className="flex items-center space-x-3 p-2 rounded-md hover:bg-slate-50">
                                    <input
                                        type="checkbox"
                                        checked={!!permissions[page]}
                                        onChange={(e) => handlePermissionChange(page, e.target.checked)}
                                        className="h-4 w-4 rounded border-slate-300 text-[#0F3F5C] focus:ring-indigo-500"
                                    />
                                    <span className="text-slate-700">{label}</span>
                                </label>
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


const UserManagement: React.FC<UserManagementProps> = ({ users, addUser, updateUser, deleteUser, setPage }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [deletingUser, setDeletingUser] = useState<User | null>(null);
    
    const manageableUsers = users.filter(u => u.role !== 'admin' && u.role !== 'gestor');

    const handleAddUser = (data: { username: string; password: string; permissions: Partial<Record<Page, boolean>> }) => {
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
            {isModalOpen && <UserModal onClose={() => setIsModalOpen(false)} onSubmit={handleAddUser} />}
            {editingUser && <UserModal user={editingUser} onClose={() => setEditingUser(null)} onSubmit={handleEditUser} />}
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

            <header className="flex items-center mb-6">
                <button onClick={() => setPage('menu')} className="mr-4 p-2 rounded-full hover:bg-slate-200 transition">
                    <ArrowLeftIcon className="h-6 w-6 text-slate-700" />
                </button>
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