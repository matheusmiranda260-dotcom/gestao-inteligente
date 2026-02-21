import React, { useState, useMemo, useCallback } from 'react';
import { Meeting, MeetingItem, User, Employee, MeetingCategory } from '../types';
import { PlusIcon, TrashIcon, CheckCircleIcon, XIcon, ClockIcon, CalendarIcon, ClipboardListIcon, PencilIcon, UserIcon, UserGroupIcon, CogIcon, WrenchScrewdriverIcon, ArchiveIcon, FilterIcon, AdjustmentsIcon, ChevronRightIcon, ChevronDownIcon, LightBulbIcon } from './icons';

interface MeetingsTasksProps {
    meetings: Meeting[];
    currentUser: User | null;
    employees: Employee[];
    categories: MeetingCategory[];
    onAddMeeting: (title: string, date: string) => void;
    onUpdateMeeting: (id: string, updates: Partial<Meeting>) => void;
    onDeleteMeeting: (id: string) => void;
    onAddCategory: (label: string) => void;
    onDeleteCategory: (id: string) => void;
}

const getCategoryIcon = (iconName?: string) => {
    switch (iconName) {
        case 'WrenchScrewdriverIcon': return <WrenchScrewdriverIcon className="h-5 w-5" />;
        case 'CogIcon': return <CogIcon className="h-5 w-5" />;
        case 'ArchiveIcon': return <ArchiveIcon className="h-5 w-5" />;
        case 'UserGroupIcon': return <UserGroupIcon className="h-5 w-5" />;
        case 'FilterIcon': return <FilterIcon className="h-5 w-5" />;
        default: return <ClipboardListIcon className="h-5 w-5" />;
    }
};

const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date(new Date().toDateString());
};

const formatDate = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const formatDateFull = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const daysRemaining = (dueDate?: string) => {
    if (!dueDate) return null;
    const now = new Date(new Date().toDateString());
    const due = new Date(dueDate);
    return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

/* ===== PDF GENERATOR ===== */
const generatePDF = (catLabel: string, pautas: { name: string; items: MeetingItem[] }[], getEmployeeName: (id: string) => string) => {
    const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const pautasHtml = pautas.map(pauta => {
        const pending = pauta.items.filter(i => !i.completed);
        const done = pauta.items.filter(i => i.completed);

        const itemRow = (item: MeetingItem, isDone: boolean) => `
            <tr class="${isDone ? 'done' : ''} ${!isDone && isOverdue(item.dueDate) ? 'overdue' : ''}">
                <td class="status">${isDone ? '✅' : '⬜'}</td>
                <td class="content">${item.content.replace(/\n/g, '<br/>')}</td>
                <td class="status-text">${isDone ? `Concluído ${item.completedAt ? formatDateFull(item.completedAt) : ''}` : isOverdue(item.dueDate) ? 'ATRASADO' : 'Pendente'}</td>
            </tr>
        `;

        return `
            <div class="pauta-section">
                <div class="pauta-header">
                    <span class="pauta-dot">●</span>
                    <h3>${pauta.name}</h3>
                    <span class="pauta-count">${done.length}/${pauta.items.length} concluídos</span>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th class="th-status"></th>
                            <th class="th-content">Item de Melhoria</th>
                            <th class="th-status-text">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pending.map(i => itemRow(i, false)).join('')}
                        ${done.map(i => itemRow(i, true)).join('')}
                    </tbody>
                </table>
                ${pauta.items.length === 0 ? '<p class="empty">Nenhum item registrado</p>' : ''}
            </div>
        `;
    }).join('');

    const totalItems = pautas.reduce((s, p) => s + p.items.length, 0);
    const totalDone = pautas.reduce((s, p) => s + p.items.filter(i => i.completed).length, 0);
    const totalPending = totalItems - totalDone;
    const totalOverdue = pautas.reduce((s, p) => s + p.items.filter(i => !i.completed && isOverdue(i.dueDate)).length, 0);

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Pautas - ${catLabel}</title>
    <style>
        @page { size: A4; margin: 20mm 15mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            color: #1e293b;
            background: #fff;
            font-size: 11px;
            line-height: 1.4;
        }
        .header {
            border-bottom: 3px solid #4f46e5;
            padding-bottom: 14px;
            margin-bottom: 20px;
        }
        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
        }
        .logo { font-size: 9px; font-weight: 800; color: #94a3b8; letter-spacing: 3px; text-transform: uppercase; }
        .date { font-size: 10px; color: #94a3b8; font-weight: 600; }
        .title { font-size: 22px; font-weight: 900; color: #1e293b; text-transform: uppercase; letter-spacing: -0.5px; }
        .subtitle { font-size: 10px; color: #6366f1; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin-top: 2px; }

        .stats-bar {
            display: flex;
            gap: 12px;
            margin-bottom: 20px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 16px;
        }
        .stat { display: flex; align-items: center; gap: 6px; }
        .stat-label { font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
        .stat-value { font-size: 16px; font-weight: 900; }
        .stat-total { color: #1e293b; }
        .stat-pending { color: #f59e0b; }
        .stat-done { color: #10b981; }
        .stat-overdue { color: #ef4444; }
        .stat-divider { width: 1px; background: #e2e8f0; margin: 0 4px; }

        .pauta-section {
            margin-bottom: 18px;
            page-break-inside: avoid;
        }
        .pauta-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: #f1f5f9;
            border-radius: 6px;
            margin-bottom: 6px;
        }
        .pauta-dot { color: #6366f1; font-size: 10px; }
        .pauta-header h3 {
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            flex: 1;
        }
        .pauta-count { font-size: 9px; font-weight: 700; color: #94a3b8; }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
        }
        th {
            background: #fff;
            font-weight: 800;
            text-transform: uppercase;
            font-size: 8px;
            letter-spacing: 1px;
            color: #94a3b8;
            padding: 6px 8px;
            text-align: left;
            border-bottom: 2px solid #e2e8f0;
        }
        td {
            padding: 7px 8px;
            border-bottom: 1px solid #f1f5f9;
            vertical-align: top;
        }
        .th-status, .status { width: 24px; text-align: center; }
        .th-content, .content { width: 75%; }
        .th-status-text, .status-text { width: 20%; }

        .content { font-weight: 600; }
        .status-text { font-size: 9px; font-weight: 700; }

        tr.done td { opacity: 0.45; }
        tr.done .content { text-decoration: line-through; }
        tr.done .status-text { color: #10b981; }
        tr.overdue .status-text { color: #ef4444; font-weight: 900; }
        tr.overdue { background: #fef2f2; }

        .empty { text-align: center; padding: 16px; color: #cbd5e1; font-weight: 600; font-size: 10px; }

        .footer {
            margin-top: 30px;
            padding-top: 12px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            font-size: 8px;
            color: #94a3b8;
            font-weight: 600;
        }

        .signatures {
            display: flex;
            justify-content: space-around;
            margin-top: 60px;
            padding-top: 10px;
        }
        .sig-block {
            text-align: center;
            width: 200px;
        }
        .sig-line {
            border-top: 1px solid #94a3b8;
            padding-top: 6px;
            font-size: 9px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-top">
            <span class="logo">MSM Gestão Inteligente</span>
            <span class="date">Emitido em ${today}</span>
        </div>
        <div class="title">${catLabel}</div>
        <div class="subtitle">Quadro Gemba — Pautas e Melhorias</div>
    </div>

    <div class="stats-bar">
        <div class="stat">
            <span class="stat-label">Total</span>
            <span class="stat-value stat-total">${totalItems}</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat">
            <span class="stat-label">Pendentes</span>
            <span class="stat-value stat-pending">${totalPending}</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat">
            <span class="stat-label">Concluídos</span>
            <span class="stat-value stat-done">${totalDone}</span>
        </div>
        ${totalOverdue > 0 ? `
        <div class="stat-divider"></div>
        <div class="stat">
            <span class="stat-label">Atrasados</span>
            <span class="stat-value stat-overdue">${totalOverdue}</span>
        </div>
        ` : ''}
    </div>

    ${pautasHtml}

    <div class="signatures">
        <div class="sig-block"><div class="sig-line">Gestor</div></div>
        <div class="sig-block"><div class="sig-line">Responsável</div></div>
        <div class="sig-block"><div class="sig-line">Líder de Equipe</div></div>
    </div>

    <div class="footer">
        <span>Documento gerado automaticamente — MSM Gestão Inteligente</span>
        <span>Quadro Gemba — ${catLabel}</span>
    </div>

    <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
    }
};

/* ===== CATEGORY MODAL ===== */
const CategoryModal: React.FC<{
    categories: MeetingCategory[];
    onClose: () => void;
    onAdd: (label: string) => void;
    onDelete: (id: string) => void;
}> = ({ categories, onClose, onAdd, onDelete }) => {
    const [newLabel, setNewLabel] = useState('');

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-zoom-in">
                <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tight">Gerenciar Grupos</h3>
                        <p className="text-slate-400 text-xs font-bold opacity-80 mt-1">Adicione ou remova áreas de melhoria</p>
                    </div>
                    <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-all">
                        <XIcon className="h-5 w-5" />
                    </button>
                </div>
                <div className="p-8 space-y-6">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && newLabel.trim()) {
                                    onAdd(newLabel.trim());
                                    setNewLabel('');
                                }
                            }}
                            placeholder="Nome do novo grupo (ex: Máquina X)"
                            className="flex-1 p-4 bg-slate-50 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white rounded-2xl font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300"
                        />
                        <button
                            onClick={() => { if (newLabel.trim()) { onAdd(newLabel.trim()); setNewLabel(''); } }}
                            className="bg-indigo-600 text-white px-6 py-4 rounded-2xl hover:bg-indigo-700 transition-all font-black text-xs uppercase tracking-widest"
                        >
                            ADD
                        </button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {categories.length === 0 && (
                            <div className="text-center py-8 text-slate-300">
                                <ClipboardListIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
                                <p className="text-xs font-black uppercase tracking-widest">Nenhum grupo criado</p>
                            </div>
                        )}
                        {categories.map(cat => (
                            <div key={cat.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-indigo-100 transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500">
                                        {getCategoryIcon(cat.icon_name)}
                                    </div>
                                    <span className="font-bold text-slate-700 text-sm">{cat.label}</span>
                                </div>
                                <button
                                    onClick={() => { if (confirm(`Excluir grupo "${cat.label}"?`)) onDelete(cat.id); }}
                                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <TrashIcon className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ===== PAUTA SECTION ===== */
const PautaSection: React.FC<{
    pautaName: string;
    items: MeetingItem[];
    employees: Employee[];
    onAddItem: (content: string, itemType?: 'improvement' | 'idea') => void;
    onToggleItem: (itemId: string) => void;
    onDeleteItem: (itemId: string) => void;
    onEditItem: (itemId: string, content: string) => void;
    onDeletePauta: () => void;
    onRenamePauta: (newName: string) => void;
    getEmployeeName: (idOrName: string) => string;
}> = ({ pautaName, items, employees, onAddItem, onToggleItem, onDeleteItem, onEditItem, onDeletePauta, onRenamePauta, getEmployeeName }) => {
    const [isOpen, setIsOpen] = useState(true);
    const [newContent, setNewContent] = useState('');
    const [newIdeaContent, setNewIdeaContent] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(pautaName);
    const [showCompleted, setShowCompleted] = useState(false);

    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editItemContent, setEditItemContent] = useState('');

    const startEditingItem = (item: MeetingItem) => {
        setEditingItemId(item.id);
        setEditItemContent(item.content);
    };

    const saveEditingItem = () => {
        if (!editingItemId || !editItemContent.trim()) return;
        onEditItem(editingItemId, editItemContent.trim());
        setEditingItemId(null);
    };

    const improvements = items.filter(i => i.itemType !== 'idea');
    const ideas = items.filter(i => i.itemType === 'idea');

    const pendingItems = improvements.filter(i => !i.completed);
    const completedItems = improvements.filter(i => i.completed);
    const total = items.length;
    const done = items.filter(i => i.completed).length;
    const overdueCount = pendingItems.filter(i => isOverdue(i.dueDate)).length;

    const handleSaveRename = () => {
        if (editName.trim() && editName.trim() !== pautaName) {
            onRenamePauta(editName.trim());
        }
        setIsEditing(false);
    };

    return (
        <div className="bg-white rounded-2xl border-2 border-slate-100 overflow-hidden transition-all hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-50/30 group/pauta">
            {/* Pauta Header */}
            <div className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-slate-50/50 transition-all">
                <div className="flex items-center gap-3 flex-1 min-w-0" onClick={() => !isEditing && setIsOpen(!isOpen)}>
                    <div className="text-slate-400 transition-transform flex-shrink-0" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                        <ChevronRightIcon className="h-4 w-4" />
                    </div>
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${done === total && total > 0 ? 'bg-emerald-500' : 'bg-indigo-500'}`}></div>

                    {isEditing ? (
                        <div className="flex items-center gap-2 flex-1">
                            <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveRename();
                                    if (e.key === 'Escape') { setIsEditing(false); setEditName(pautaName); }
                                }}
                                autoFocus
                                className="flex-1 bg-indigo-50 border-2 border-indigo-200 px-3 py-1 rounded-lg font-black text-slate-700 text-[13px] uppercase tracking-tight outline-none"
                            />
                            <button onClick={handleSaveRename} className="p-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all">
                                <CheckCircleIcon className="h-4 w-4" />
                            </button>
                            <button onClick={() => { setIsEditing(false); setEditName(pautaName); }} className="p-1 text-slate-400 hover:text-slate-600 transition-all">
                                <XIcon className="h-4 w-4" />
                            </button>
                        </div>
                    ) : (
                        <h4 className="font-black text-slate-700 uppercase tracking-tight text-[13px] truncate">{pautaName}</h4>
                    )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                    {overdueCount > 0 && (
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg bg-rose-50 text-rose-500">
                            {overdueCount} atrasado{overdueCount > 1 ? 's' : ''}
                        </span>
                    )}
                    {total > 0 && (
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${done === total && total > 0 ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-100 text-slate-400'}`}>
                            {done}/{total}
                        </span>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsEditing(true); setEditName(pautaName); }}
                        className="p-1.5 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all opacity-0 group-hover/pauta:opacity-100"
                        title="Editar pauta"
                    >
                        <PencilIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Excluir pauta "${pautaName}" e todos os seus itens?`)) onDeletePauta();
                        }}
                        className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover/pauta:opacity-100"
                        title="Excluir pauta"
                    >
                        <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Pauta Content */}
            {isOpen && (
                <div className="px-4 pb-4 space-y-2">
                    {/* Add Item Form */}
                    <div className="bg-slate-50/80 rounded-xl p-3 space-y-2 border border-slate-100">
                        <div className="relative">
                            <textarea
                                value={newContent}
                                onChange={(e) => setNewContent(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey && newContent.trim()) {
                                        e.preventDefault();
                                        onAddItem(newContent.trim());
                                        setNewContent('');
                                    }
                                }}
                                placeholder="Adicionar item de melhoria... (Shift+Enter para pular linha)"
                                className="w-full bg-white border border-slate-200 p-3 pr-10 rounded-xl font-bold text-slate-700 placeholder:text-slate-300 focus:border-indigo-500 outline-none transition-all text-[12px] min-h-[64px] resize-y custom-scrollbar"
                            />
                            <button
                                onClick={() => {
                                    if (newContent.trim()) {
                                        onAddItem(newContent.trim());
                                        setNewContent('');
                                    }
                                }}
                                className="absolute right-2 top-2 bg-indigo-600 rounded-lg flex items-center justify-center p-1.5 text-white hover:scale-110 active:scale-95 transition-all"
                            >
                                <PlusIcon className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Pending Items */}
                    {pendingItems.map(item => {
                        const days = daysRemaining(item.dueDate);
                        const overdue = isOverdue(item.dueDate);

                        if (editingItemId === item.id) {
                            return (
                                <div key={item.id} className="bg-indigo-50/50 p-3 rounded-xl border-2 border-indigo-200 mt-2">
                                    <div className="space-y-2">
                                        <textarea
                                            value={editItemContent}
                                            onChange={(e) => setEditItemContent(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    saveEditingItem();
                                                }
                                            }}
                                            autoFocus
                                            placeholder="Descreva a melhoria..."
                                            className="w-full bg-white border border-indigo-200 p-2 rounded-lg font-bold text-slate-700 text-[12px] outline-none min-h-[64px] resize-y custom-scrollbar"
                                        />
                                        <div className="flex gap-2 justify-end">
                                            <button onClick={saveEditingItem} className="bg-indigo-600 hover:bg-indigo-700 text-white p-1.5 rounded-lg transition-all flex items-center gap-1.5 px-3 text-[10px] font-black uppercase tracking-widest" title="Salvar">
                                                <CheckCircleIcon className="h-4 w-4" />
                                                Salvar
                                            </button>
                                            <button onClick={() => setEditingItemId(null)} className="bg-rose-100 hover:bg-rose-200 text-rose-600 p-1.5 rounded-lg transition-all" title="Cancelar">
                                                <XIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div key={item.id} className={`group/item flex items-start gap-3 p-3 rounded-xl transition-all ${overdue ? 'bg-rose-50/60 border border-rose-100' : 'hover:bg-slate-50 border border-transparent'}`}>
                                <button
                                    onClick={() => onToggleItem(item.id)}
                                    className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${overdue ? 'border-rose-300 hover:border-rose-500' : 'border-slate-200 hover:border-indigo-500'}`}
                                >
                                    <div className={`w-1.5 h-1.5 rounded-full scale-0 group-hover/item:scale-100 transition-all ${overdue ? 'bg-rose-500' : 'bg-indigo-500'}`} />
                                </button>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-[12px] text-slate-700 leading-snug whitespace-pre-wrap">{item.content}</p>
                                </div>
                                <div className="opacity-0 group-hover/item:opacity-100 flex items-center transition-all flex-shrink-0">
                                    <button
                                        onClick={() => startEditingItem(item)}
                                        className="text-slate-300 hover:text-indigo-500 p-1.5 transition-all"
                                        title="Editar Item"
                                    >
                                        <PencilIcon className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => onDeleteItem(item.id)}
                                        className="text-slate-300 hover:text-rose-500 p-1.5 transition-all"
                                        title="Excluir Item"
                                    >
                                        <XIcon className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {/* Completed Items — Hidden by default */}
                    {completedItems.length > 0 && (
                        <div className="pt-1">
                            <button
                                onClick={() => setShowCompleted(!showCompleted)}
                                className="flex items-center gap-2 text-[9px] font-black text-emerald-500 uppercase tracking-widest hover:text-emerald-600 transition-all w-full py-2"
                            >
                                <CheckCircleIcon className="h-3 w-3" />
                                <span>{showCompleted ? 'Ocultar' : 'Mostrar'} concluídas ({completedItems.length})</span>
                                <div className="flex-1 h-px bg-emerald-100"></div>
                                <div className="transition-transform" style={{ transform: showCompleted ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                    <ChevronDownIcon className="h-3 w-3" />
                                </div>
                            </button>
                            {showCompleted && completedItems.map(item => (
                                <div key={item.id} className="group/item flex items-start gap-3 p-2 rounded-xl transition-all mb-1 opacity-50 hover:opacity-80">
                                    <button
                                        onClick={() => onToggleItem(item.id)}
                                        className="mt-0.5 w-5 h-5 rounded-md bg-emerald-500 border-2 border-emerald-500 flex items-center justify-center flex-shrink-0"
                                    >
                                        <CheckCircleIcon className="h-3 w-3 text-white" />
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-[11px] text-slate-400 line-through leading-snug whitespace-pre-wrap">{item.content}</p>
                                        {item.completedAt && (
                                            <span className="text-[8px] font-black text-emerald-500/60 uppercase tracking-widest">
                                                Concluído em {formatDate(item.completedAt)}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => onDeleteItem(item.id)}
                                        className="opacity-0 group-hover/item:opacity-100 text-slate-300 hover:text-rose-500 p-1 transition-all flex-shrink-0"
                                    >
                                        <XIcon className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Boas Ideias Section */}
                    <div className="mt-4 pt-4 border-t-2 border-slate-100/60">
                        <h5 className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-3 flex items-center gap-1.5 px-2">
                            <LightBulbIcon className="h-4 w-4" />
                            Boas Ideias
                        </h5>

                        <div className="bg-amber-50/50 rounded-xl p-3 space-y-2 border border-amber-100/50 mb-3">
                            <div className="relative">
                                <textarea
                                    value={newIdeaContent}
                                    onChange={(e) => setNewIdeaContent(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey && newIdeaContent.trim()) {
                                            e.preventDefault();
                                            onAddItem(newIdeaContent.trim(), 'idea');
                                            setNewIdeaContent('');
                                        }
                                    }}
                                    placeholder="Deixe uma ideia genial... (Shift+Enter para pular linha)"
                                    className="w-full bg-white border border-amber-200/60 p-3 pr-10 rounded-xl font-bold text-slate-700 placeholder:text-amber-300 focus:border-amber-400 outline-none transition-all text-[12px] min-h-[56px] resize-y custom-scrollbar"
                                />
                                <button
                                    onClick={() => {
                                        if (newIdeaContent.trim()) {
                                            onAddItem(newIdeaContent.trim(), 'idea');
                                            setNewIdeaContent('');
                                        }
                                    }}
                                    className="absolute right-2 top-2 bg-amber-500 rounded-lg flex items-center justify-center p-1.5 text-white hover:scale-110 active:scale-95 transition-all shadow-md shadow-amber-500/20"
                                >
                                    <PlusIcon className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* List Ideas */}
                        <div className="space-y-1">
                            {ideas.map(idea => {
                                if (editingItemId === idea.id) {
                                    return (
                                        <div key={idea.id} className="bg-amber-50/80 p-3 rounded-xl border border-amber-200 mt-2">
                                            <div className="space-y-2">
                                                <textarea
                                                    value={editItemContent}
                                                    onChange={(e) => setEditItemContent(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            saveEditingItem();
                                                        }
                                                    }}
                                                    autoFocus
                                                    className="w-full bg-white border border-amber-200 p-2 rounded-lg font-bold text-slate-700 text-[12px] outline-none min-h-[64px] resize-y custom-scrollbar"
                                                />
                                                <div className="flex gap-2 justify-end">
                                                    <button onClick={saveEditingItem} className="bg-amber-500 hover:bg-amber-600 text-white p-1.5 rounded-lg transition-all flex items-center gap-1.5 px-3 text-[10px] font-black uppercase tracking-widest">
                                                        <CheckCircleIcon className="h-4 w-4" />
                                                        Salvar
                                                    </button>
                                                    <button onClick={() => setEditingItemId(null)} className="bg-rose-100 hover:bg-rose-200 text-rose-600 p-1.5 rounded-lg transition-all">
                                                        <XIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={idea.id} className={`group/item flex items-start gap-3 p-3 rounded-xl transition-all border border-transparent hover:bg-slate-50 ${idea.completed ? 'opacity-50' : ''}`}>
                                        <button
                                            onClick={() => onToggleItem(idea.id)}
                                            className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${idea.completed ? 'bg-amber-500 border-amber-500' : 'border-amber-200 hover:border-amber-500'}`}
                                        >
                                            <div className={`w-1.5 h-1.5 rounded-full transition-all ${idea.completed ? 'bg-white scale-100' : 'bg-amber-500 scale-0 group-hover/item:scale-100'}`} />
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-bold text-[12px] text-slate-700 leading-snug whitespace-pre-wrap ${idea.completed ? 'line-through text-slate-400' : ''}`}>{idea.content}</p>
                                        </div>
                                        <div className="opacity-0 group-hover/item:opacity-100 flex items-center transition-all flex-shrink-0">
                                            <button onClick={() => startEditingItem(idea)} className="text-slate-300 hover:text-amber-500 p-1.5 transition-all">
                                                <PencilIcon className="h-3.5 w-3.5" />
                                            </button>
                                            <button onClick={() => onDeleteItem(idea.id)} className="text-slate-300 hover:text-rose-500 p-1.5 transition-all">
                                                <XIcon className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {items.length === 0 && (
                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest text-center py-3">Sem itens de melhoria</p>
                    )}
                </div>
            )}
        </div>
    );
};

/* ===== MAIN COMPONENT ===== */
const MeetingsTasks: React.FC<MeetingsTasksProps> = ({
    meetings, currentUser, employees, categories,
    onAddMeeting, onUpdateMeeting, onDeleteMeeting,
    onAddCategory, onDeleteCategory
}) => {
    const [isManagingCategories, setIsManagingCategories] = useState(false);
    const [newPautaName, setNewPautaName] = useState<Record<string, string>>({});

    const gembaBoard = useMemo(() => {
        if (meetings.length > 0) {
            return [...meetings].sort((a, b) =>
                new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime()
            )[0];
        }
        return null;
    }, [meetings]);

    React.useEffect(() => {
        if (meetings.length === 0 && currentUser) {
            onAddMeeting('Quadro Gemba', new Date().toISOString());
        }
    }, [meetings.length, currentUser]);

    const allItems = gembaBoard?.items || [];

    const getPautasForCategory = (catId: string): string[] => {
        const catItems = allItems.filter(item =>
            item.category === catId || item.category === categories.find(c => c.id === catId)?.label
        );
        const pautas = new Set<string>();
        catItems.forEach(item => {
            if (item.pauta) pautas.add(item.pauta);
        });
        return Array.from(pautas);
    };

    const getItemsForPauta = (catId: string, pautaName: string): MeetingItem[] => {
        return allItems.filter(item =>
            (item.category === catId || item.category === categories.find(c => c.id === catId)?.label) &&
            item.pauta === pautaName &&
            item.content !== `Pauta "${pautaName}" criada`
        );
    };

    const handleAddPauta = (catId: string) => {
        const name = newPautaName[catId]?.trim();
        if (!name || !gembaBoard) return;

        const newItem: MeetingItem = {
            id: Math.random().toString(36).substring(2, 9),
            content: `Pauta "${name}" criada`,
            completed: false,
            category: catId,
            pauta: name
        };

        onUpdateMeeting(gembaBoard.id, { items: [...allItems, newItem] });
        setNewPautaName(prev => ({ ...prev, [catId]: '' }));
    };

    const handleAddItem = (catId: string, pautaName: string, content: string, itemType?: 'improvement' | 'idea') => {
        if (!gembaBoard) return;
        const newItem: MeetingItem = {
            id: Math.random().toString(36).substring(2, 9),
            content,
            completed: false,
            category: catId,
            pauta: pautaName,
            itemType
        };
        onUpdateMeeting(gembaBoard.id, { items: [...allItems, newItem] });
    };

    const toggleItem = (itemId: string) => {
        if (!gembaBoard) return;
        const newItems = allItems.map(item => {
            if (item.id === itemId) {
                return { ...item, completed: !item.completed, completedAt: !item.completed ? new Date().toISOString() : undefined };
            }
            return item;
        });
        onUpdateMeeting(gembaBoard.id, { items: newItems });
    };

    const deleteItem = (itemId: string) => {
        if (!gembaBoard) return;
        onUpdateMeeting(gembaBoard.id, { items: allItems.filter(item => item.id !== itemId) });
    };

    const handleEditItem = (itemId: string, content: string) => {
        if (!gembaBoard) return;
        const newItems = allItems.map(item => {
            if (item.id === itemId) return { ...item, content };
            return item;
        });
        onUpdateMeeting(gembaBoard.id, { items: newItems });
    };

    const deletePauta = (catId: string, pautaName: string) => {
        if (!gembaBoard) return;
        const newItems = allItems.filter(item =>
            !((item.category === catId || item.category === categories.find(c => c.id === catId)?.label) && item.pauta === pautaName)
        );
        onUpdateMeeting(gembaBoard.id, { items: newItems });
    };

    const renamePauta = (catId: string, oldName: string, newName: string) => {
        if (!gembaBoard) return;
        const newItems = allItems.map(item => {
            if ((item.category === catId || item.category === categories.find(c => c.id === catId)?.label) && item.pauta === oldName) {
                return { ...item, pauta: newName };
            }
            return item;
        });
        onUpdateMeeting(gembaBoard.id, { items: newItems });
    };

    const getEmployeeName = useCallback((idOrName: string) => {
        const emp = employees.find(e => e.id === idOrName || e.name === idOrName);
        return emp ? emp.name : idOrName;
    }, [employees]);

    const handlePrintGroup = (cat: MeetingCategory) => {
        const pautas = getPautasForCategory(cat.id).map(pName => ({
            name: pName,
            items: getItemsForPauta(cat.id, pName)
        }));
        generatePDF(cat.label, pautas, getEmployeeName);
    };

    const realItems = allItems.filter(item => item.content !== `Pauta "${item.pauta}" criada`);
    const totalItems = realItems.length;
    const completedItemsCount = realItems.filter(i => i.completed).length;
    const pendingItemsTotal = totalItems - completedItemsCount;
    const overdueItemsCount = realItems.filter(i => !i.completed && isOverdue(i.dueDate)).length;
    const completionRate = totalItems > 0 ? Math.round((completedItemsCount / totalItems) * 100) : 0;

    return (
        <div className="p-4 md:p-8 min-h-screen bg-slate-50 animate-fade-in overflow-x-hidden">
            <div className="max-w-[1800px] mx-auto">

                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-3xl flex items-center justify-center shadow-xl shadow-indigo-100 rotate-3 transform transition-transform hover:rotate-0">
                            <ClipboardListIcon className="h-9 w-9 text-white" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-slate-800 tracking-tighter uppercase leading-none mb-1">Pautas e Melhorias</h1>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Quadro Gemba — Loop Contínuo</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsManagingCategories(true)}
                            className="flex items-center gap-2 bg-white border-2 border-slate-200 text-slate-500 font-black px-6 py-4 rounded-2xl hover:border-indigo-500 hover:text-indigo-600 transition-all text-[11px] uppercase tracking-widest"
                        >
                            <AdjustmentsIcon className="h-4 w-4" />
                            Gerenciar Grupos
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white flex flex-col md:flex-row justify-between items-center gap-8 shadow-2xl relative overflow-hidden mb-10">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                    <div className="flex-1">
                        <h2 className="text-3xl font-black uppercase tracking-tighter mb-1">Quadro Gemba</h2>
                        <p className="text-indigo-300 text-[10px] font-black uppercase tracking-widest">
                            Grupo → Pauta → Itens • Pautas permanecem até serem resolvidas
                        </p>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        <div className="bg-white/5 border border-white/10 p-4 rounded-3xl min-w-[90px] text-center">
                            <p className="text-[9px] font-black text-white/40 tracking-widest uppercase mb-1">Total</p>
                            <p className="text-3xl font-black">{totalItems}</p>
                        </div>
                        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-3xl min-w-[90px] text-center">
                            <p className="text-[9px] font-black text-amber-400 tracking-widest uppercase mb-1">Pendentes</p>
                            <p className="text-3xl font-black text-amber-400">{pendingItemsTotal}</p>
                        </div>
                        {overdueItemsCount > 0 && (
                            <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-3xl min-w-[90px] text-center animate-pulse">
                                <p className="text-[9px] font-black text-rose-400 tracking-widest uppercase mb-1">Atrasados</p>
                                <p className="text-3xl font-black text-rose-400">{overdueItemsCount}</p>
                            </div>
                        )}
                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-3xl min-w-[90px] text-center">
                            <p className="text-[9px] font-black text-emerald-400 tracking-widest uppercase mb-1">Concluídas</p>
                            <p className="text-3xl font-black text-emerald-400">{completedItemsCount}</p>
                        </div>
                        <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-3xl min-w-[90px] text-center">
                            <p className="text-[9px] font-black text-indigo-400 tracking-widest uppercase mb-1">Progresso</p>
                            <p className="text-3xl font-black text-indigo-400">{completionRate}%</p>
                        </div>
                    </div>
                </div>

                {/* Board */}
                {categories.length === 0 ? (
                    <div className="bg-white rounded-[4rem] p-24 text-center border-4 border-dashed border-slate-100 overflow-hidden animate-zoom-in">
                        <div className="bg-indigo-50 w-40 h-40 rounded-[4rem] flex items-center justify-center mx-auto mb-10 rotate-12 shadow-inner group">
                            <AdjustmentsIcon className="h-20 w-20 text-indigo-200 group-hover:scale-110 group-hover:-rotate-12 transition-all duration-500" />
                        </div>
                        <h3 className="text-3xl font-black text-slate-800 uppercase tracking-tighter leading-tight max-w-md mx-auto">Crie seus grupos primeiro</h3>
                        <p className="text-slate-400 mt-6 max-w-md mx-auto font-bold leading-relaxed">
                            Clique em "Gerenciar Grupos" para adicionar áreas como Máquina Trefila, Máquina Treliça, Gestão de Peças.
                        </p>
                        <button
                            onClick={() => setIsManagingCategories(true)}
                            className="mt-12 bg-indigo-600 text-white font-black px-16 py-6 rounded-3xl hover:bg-indigo-700 transition-all hover:scale-110 active:scale-95 shadow-[0_20px_40px_-15px_rgba(79,70,229,0.3)] uppercase tracking-widest text-sm"
                        >
                            GERENCIAR GRUPOS
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 items-start pb-12 animate-slide-up">
                        {categories.map(cat => {
                            const pautas = getPautasForCategory(cat.id);
                            const catAllItems = allItems.filter(item =>
                                (item.category === cat.id || item.category === cat.label) &&
                                item.content !== `Pauta "${item.pauta}" criada`
                            );
                            const catPending = catAllItems.filter(i => !i.completed).length;
                            const catDone = catAllItems.filter(i => i.completed).length;
                            const catOverdue = catAllItems.filter(i => !i.completed && isOverdue(i.dueDate)).length;

                            return (
                                <div key={cat.id} className="bg-gradient-to-b from-white to-slate-50/50 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden transition-all hover:shadow-2xl hover:border-indigo-100">
                                    {/* Group Header */}
                                    <div className="p-6 pb-4 border-b border-slate-100">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                                                    {getCategoryIcon(cat.icon_name)}
                                                </div>
                                                <div>
                                                    <h3 className="font-black text-slate-800 uppercase tracking-tight text-[15px] leading-tight">{cat.label}</h3>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                            {pautas.length} pauta{pautas.length !== 1 ? 's' : ''}
                                                        </span>
                                                        {catOverdue > 0 && (
                                                            <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">
                                                                · {catOverdue} atrasado{catOverdue > 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handlePrintGroup(cat)}
                                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-100 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all"
                                                    title="Gerar PDF"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 9H5.25" />
                                                    </svg>
                                                    PDF
                                                </button>
                                                <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${catDone === catAllItems.length && catAllItems.length > 0 ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-100 text-slate-400'}`}>
                                                    {catDone}/{catAllItems.length}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Add Pauta */}
                                        <div className="flex gap-2 mt-4">
                                            <input
                                                type="text"
                                                value={newPautaName[cat.id] || ''}
                                                onChange={(e) => setNewPautaName(prev => ({ ...prev, [cat.id]: e.target.value }))}
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddPauta(cat.id)}
                                                placeholder="Nova pauta (ex: Organização)"
                                                className="flex-1 bg-slate-50 border border-slate-100 p-3 rounded-xl font-bold text-slate-700 placeholder:text-slate-300 focus:border-indigo-500 focus:bg-white outline-none transition-all text-[12px]"
                                            />
                                            <button
                                                onClick={() => handleAddPauta(cat.id)}
                                                className="bg-indigo-600 text-white px-4 py-3 rounded-xl hover:bg-indigo-700 transition-all font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5"
                                            >
                                                <PlusIcon className="h-3.5 w-3.5" />
                                                Pauta
                                            </button>
                                        </div>
                                    </div>

                                    {/* Pautas */}
                                    <div className="p-4 space-y-4 max-h-[650px] overflow-y-auto custom-scrollbar">
                                        {pautas.map(pautaName => (
                                            <PautaSection
                                                key={pautaName}
                                                pautaName={pautaName}
                                                items={getItemsForPauta(cat.id, pautaName)}
                                                employees={employees}
                                                onAddItem={(content, itemType) => handleAddItem(cat.id, pautaName, content, itemType)}
                                                onToggleItem={toggleItem}
                                                onDeleteItem={deleteItem}
                                                onEditItem={handleEditItem}
                                                onDeletePauta={() => deletePauta(cat.id, pautaName)}
                                                onRenamePauta={(newName) => renamePauta(cat.id, pautaName, newName)}
                                                getEmployeeName={getEmployeeName}
                                            />
                                        ))}
                                        {pautas.length === 0 && (
                                            <div className="text-center py-10 opacity-30">
                                                <ClipboardListIcon className="h-10 w-10 mx-auto mb-2" />
                                                <p className="text-[9px] font-black uppercase tracking-widest">Crie uma pauta para começar</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {isManagingCategories && (
                <CategoryModal
                    categories={categories}
                    onClose={() => setIsManagingCategories(false)}
                    onAdd={onAddCategory}
                    onDelete={onDeleteCategory}
                />
            )}
        </div>
    );
};

export default MeetingsTasks;
