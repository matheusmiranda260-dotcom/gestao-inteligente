import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Page, User, LabAnalysisEntry } from '../types';
import { ArrowLeftIcon, PlusIcon, TrashIcon, ChartBarIcon, SaveIcon, SearchIcon, FilterIcon, PrinterIcon } from './icons';
import { insertItem, deleteItem, fetchTable } from '../services/supabaseService';

interface LaboratoryProps {
    setPage: (page: Page) => void;
    currentUser: User | null;
}

const generateId = () => `lab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

const FORNECEDORES = ['Arcelor 1008', 'Gerdau 1008', 'Belgo 1008', 'Votorantim 1008'];

const Laboratory: React.FC<LaboratoryProps> = ({ setPage, currentUser }) => {
    const [entries, setEntries] = useState<LabAnalysisEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [chartType, setChartType] = useState<'resistencia' | 'alongamento' | 'relacao' | 'bitola'>('resistencia');
    const chartCanvasRef = useRef<HTMLCanvasElement>(null);

    // Form state
    const [form, setForm] = useState({
        lote: '', fornecedor: FORNECEDORES[0],
        k7_1_entrada: '', k7_1_saida: '',
        k7_2_entrada: '', k7_2_saida: '',
        k7_3_entrada: '', k7_3_saida: '',
        k7_4_entrada: '', k7_4_saida: '',
        velocidade: '',
        comprimento: '', massa: '',
        escoamento: '', resistencia: '', alongamento: '',
    });

    useEffect(() => {
        const load = async () => {
            try {
                const data = await fetchTable<LabAnalysisEntry>('lab_analysis');
                setEntries(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            } catch (e) {
                console.error('Erro ao carregar análises:', e);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    // --- CALCULATED FIELDS --- //
    const calcBitola = (massa: number | null, comprimento: number | null): number | null => {
        if (!massa || !comprimento || comprimento === 0) return null;
        return Math.sqrt(massa / comprimento) * 12.744;
    };

    const calcRelacao = (resistencia: number | null, alongamento: number | null): number | null => {
        if (!resistencia || !alongamento || alongamento === 0) return null;
        return resistencia / alongamento;
    };

    const calcK7Media = (entrada: number | null, saida: number | null): number | null => {
        if (entrada === null && saida === null) return null;
        if (entrada === null) return saida;
        if (saida === null) return entrada;
        return (entrada + saida) / 2;
    };

    // Form calculated preview
    const formBitola = calcBitola(
        form.massa ? parseFloat(form.massa) : null,
        form.comprimento ? parseFloat(form.comprimento) : null
    );
    const formRelacao = calcRelacao(
        form.resistencia ? parseFloat(form.resistencia) : null,
        form.alongamento ? parseFloat(form.alongamento) : null
    );

    // K7 médias do formulário
    const formK7Medias = [1, 2, 3, 4].map(i => {
        const ent = (form as any)[`k7_${i}_entrada`];
        const sai = (form as any)[`k7_${i}_saida`];
        return calcK7Media(
            ent ? parseFloat(ent) : null,
            sai ? parseFloat(sai) : null
        );
    });

    const parseNum = (val: string): number | null => {
        if (!val || val.trim() === '') return null;
        const num = parseFloat(val.replace(',', '.'));
        return isNaN(num) ? null : num;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.lote.trim()) {
            alert('O número do lote é obrigatório.');
            return;
        }

        const newEntry: LabAnalysisEntry = {
            id: generateId(),
            lote: form.lote,
            fornecedor: form.fornecedor,
            k7_1_entrada: parseNum(form.k7_1_entrada),
            k7_1_saida: parseNum(form.k7_1_saida),
            k7_2_entrada: parseNum(form.k7_2_entrada),
            k7_2_saida: parseNum(form.k7_2_saida),
            k7_3_entrada: parseNum(form.k7_3_entrada),
            k7_3_saida: parseNum(form.k7_3_saida),
            k7_4_entrada: parseNum(form.k7_4_entrada),
            k7_4_saida: parseNum(form.k7_4_saida),
            velocidade: parseNum(form.velocidade),
            comprimento: parseNum(form.comprimento),
            massa: parseNum(form.massa),
            escoamento: parseNum(form.escoamento),
            resistencia: parseNum(form.resistencia),
            alongamento: parseNum(form.alongamento),
            date: new Date().toISOString(),
            operator: currentUser?.username || 'N/A',
        };

        try {
            await insertItem('lab_analysis', newEntry);
            setEntries(prev => [newEntry, ...prev]);
            setForm({
                lote: '', fornecedor: FORNECEDORES[0],
                k7_1_entrada: '', k7_1_saida: '',
                k7_2_entrada: '', k7_2_saida: '',
                k7_3_entrada: '', k7_3_saida: '',
                k7_4_entrada: '', k7_4_saida: '',
                velocidade: '',
                comprimento: '', massa: '',
                escoamento: '', resistencia: '', alongamento: '',
            });
            setShowForm(false);
        } catch (err) {
            console.error('Erro ao salvar análise:', err);
            alert('Erro ao salvar no banco de dados.');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta análise?')) return;
        try {
            await deleteItem('lab_analysis', id);
            setEntries(prev => prev.filter(e => e.id !== id));
        } catch (err) {
            console.error('Erro ao excluir análise:', err);
        }
    };

    // Filtered entries
    const filteredEntries = useMemo(() => {
        if (!searchTerm.trim()) return entries;
        const term = searchTerm.toLowerCase();
        return entries.filter(e =>
            e.lote.toLowerCase().includes(term) ||
            e.fornecedor.toLowerCase().includes(term)
        );
    }, [entries, searchTerm]);

    // ---- CHART RENDERING ---- //
    useEffect(() => {
        const canvas = chartCanvasRef.current;
        if (!canvas || filteredEntries.length === 0) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        const W = rect.width;
        const H = rect.height;

        ctx.clearRect(0, 0, W, H);

        // Get data based on chartType
        const dataPoints = filteredEntries.slice().reverse().map((e, i) => {
            let value: number | null = null;
            switch (chartType) {
                case 'resistencia': value = e.resistencia; break;
                case 'alongamento': value = e.alongamento; break;
                case 'relacao': value = calcRelacao(e.resistencia, e.alongamento); break;
                case 'bitola': value = calcBitola(e.massa, e.comprimento); break;
            }
            return { label: e.lote, value, index: i };
        }).filter(d => d.value !== null && d.value > 0) as { label: string; value: number; index: number }[];

        if (dataPoints.length === 0) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = '14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Sem dados para exibir', W / 2, H / 2);
            return;
        }

        const maxVal = Math.max(...dataPoints.map(d => d.value)) * 1.15;
        const minVal = Math.min(...dataPoints.map(d => d.value)) * 0.85;
        const range = maxVal - minVal || 1;

        const padL = 60, padR = 30, padT = 30, padB = 50;
        const chartW = W - padL - padR;
        const chartH = H - padT - padB;

        // Grid lines
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        const gridLines = 5;
        for (let i = 0; i <= gridLines; i++) {
            const y = padT + (chartH / gridLines) * i;
            ctx.beginPath();
            ctx.moveTo(padL, y);
            ctx.lineTo(W - padR, y);
            ctx.stroke();

            const val = maxVal - (range / gridLines) * i;
            ctx.fillStyle = '#94a3b8';
            ctx.font = '11px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(val.toFixed(1), padL - 8, y + 4);
        }

        // Colors based on chart type
        const colorMap: Record<string, { line: string; fill: string; dot: string }> = {
            resistencia: { line: '#6366f1', fill: 'rgba(99,102,241,0.08)', dot: '#4f46e5' },
            alongamento: { line: '#10b981', fill: 'rgba(16,185,129,0.08)', dot: '#059669' },
            relacao: { line: '#f59e0b', fill: 'rgba(245,158,11,0.08)', dot: '#d97706' },
            bitola: { line: '#ef4444', fill: 'rgba(239,68,68,0.08)', dot: '#dc2626' },
        };
        const colors = colorMap[chartType];

        // Draw area fill
        if (dataPoints.length > 1) {
            ctx.beginPath();
            dataPoints.forEach((d, i) => {
                const x = padL + (chartW / (dataPoints.length - 1)) * i;
                const y = padT + chartH - ((d.value - minVal) / range) * chartH;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.lineTo(padL + chartW, padT + chartH);
            ctx.lineTo(padL, padT + chartH);
            ctx.closePath();
            ctx.fillStyle = colors.fill;
            ctx.fill();
        }

        // Draw line
        ctx.beginPath();
        ctx.strokeStyle = colors.line;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        dataPoints.forEach((d, i) => {
            const x = padL + (dataPoints.length > 1 ? (chartW / (dataPoints.length - 1)) * i : chartW / 2);
            const y = padT + chartH - ((d.value - minVal) / range) * chartH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Draw dots & labels
        dataPoints.forEach((d, i) => {
            const x = padL + (dataPoints.length > 1 ? (chartW / (dataPoints.length - 1)) * i : chartW / 2);
            const y = padT + chartH - ((d.value - minVal) / range) * chartH;

            // Dot
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
            ctx.strokeStyle = colors.dot;
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Value label
            ctx.fillStyle = '#334155';
            ctx.font = 'bold 10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(d.value.toFixed(2), x, y - 12);

            // X label
            ctx.fillStyle = '#64748b';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'center';
            const maxChars = Math.max(4, Math.floor(chartW / dataPoints.length / 7));
            const label = d.label.length > maxChars ? d.label.slice(0, maxChars) + '…' : d.label;
            ctx.save();
            ctx.translate(x, padT + chartH + 12);
            ctx.rotate(-Math.PI / 6);
            ctx.fillText(label, 0, 0);
            ctx.restore();
        });

        // Average line
        const avg = dataPoints.reduce((s, d) => s + d.value, 0) / dataPoints.length;
        const avgY = padT + chartH - ((avg - minVal) / range) * chartH;
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(padL, avgY);
        ctx.lineTo(W - padR, avgY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#f97316';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`Média: ${avg.toFixed(2)}`, padL + 5, avgY - 6);
    }, [filteredEntries, chartType]);

    const chartLabel: Record<string, string> = {
        resistencia: 'Resistência (MPa)',
        alongamento: 'Alongamento (%)',
        relacao: 'Relação (Res./Along.)',
        bitola: 'Bitola (mm)',
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-500 font-medium">Carregando dados do laboratório...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1920px] mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                            🔬
                        </div>
                        Laboratório
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Análises de qualidade — Setup e Ensaios de Tração</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className={`flex items-center gap-2 font-bold py-3 px-6 rounded-xl transition-all active:scale-95 shadow-lg ${showForm ? 'bg-slate-200 text-slate-700 shadow-slate-100 hover:bg-slate-300' : 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700'}`}
                >
                    {showForm ? (
                        <><span className="text-lg">&times;</span> Fechar Formulário</>
                    ) : (
                        <><PlusIcon className="h-5 w-5" /> Nova Análise</>
                    )}
                </button>
            </div>

            {/* Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 animate-fade-in">
                    <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                        Registrar Nova Análise
                    </h2>

                    {/* Identificação */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 pb-6 border-b border-slate-100">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nº Lote *</label>
                            <input
                                type="text"
                                value={form.lote}
                                onChange={e => setForm({ ...form, lote: e.target.value })}
                                className="w-full p-2.5 border-2 border-slate-200 rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-0 transition"
                                placeholder="Ex: 7555"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fornecedor (SAE)</label>
                            <select
                                value={form.fornecedor}
                                onChange={e => setForm({ ...form, fornecedor: e.target.value })}
                                className="w-full p-2.5 border-2 border-slate-200 rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-0 transition bg-white"
                            >
                                {FORNECEDORES.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Velocidade</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={form.velocidade}
                                onChange={e => setForm({ ...form, velocidade: e.target.value })}
                                className="w-full p-2.5 border-2 border-slate-200 rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-0 transition"
                                placeholder="m/min"
                            />
                        </div>
                    </div>

                    {/* Setup - K7s */}
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-slate-400"></div>
                        Setup — Cassetes (K7)
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                <p className="text-xs font-bold text-slate-600 mb-2 text-center">{i}° K7</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Entrada</label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={(form as any)[`k7_${i}_entrada`]}
                                            onChange={e => setForm({ ...form, [`k7_${i}_entrada`]: e.target.value })}
                                            className="w-full p-2 border border-slate-200 rounded-lg text-sm text-center font-medium focus:border-indigo-500 focus:ring-0 transition"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Saída</label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={(form as any)[`k7_${i}_saida`]}
                                            onChange={e => setForm({ ...form, [`k7_${i}_saida`]: e.target.value })}
                                            className="w-full p-2 border border-slate-200 rounded-lg text-sm text-center font-medium focus:border-indigo-500 focus:ring-0 transition"
                                        />
                                    </div>
                                </div>
                                {formK7Medias[i - 1] !== null && (
                                    <div className="mt-2 text-center">
                                        <span className="text-[10px] font-bold text-indigo-500 uppercase">Média: </span>
                                        <span className="text-sm font-black text-indigo-700">{formK7Medias[i - 1]!.toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Análise Laboratório */}
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mt-6 mb-4 flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-emerald-500"></div>
                        Análise Laboratório — Ensaio de Tração
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Comprimento</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={form.comprimento}
                                onChange={e => setForm({ ...form, comprimento: e.target.value })}
                                className="w-full p-2.5 border-2 border-slate-200 rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-0 transition"
                                placeholder="mm"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Massa</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={form.massa}
                                onChange={e => setForm({ ...form, massa: e.target.value })}
                                className="w-full p-2.5 border-2 border-slate-200 rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-0 transition"
                                placeholder="g"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1.5">Bitola (Auto) ⚡</label>
                            <div className="w-full p-2.5 border-2 border-amber-300 rounded-xl text-sm font-bold bg-amber-50 text-amber-800 text-center min-h-[42px] flex items-center justify-center">
                                {formBitola !== null ? formBitola.toFixed(2) + ' mm' : '—'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Escoamento</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={form.escoamento}
                                onChange={e => setForm({ ...form, escoamento: e.target.value })}
                                className="w-full p-2.5 border-2 border-slate-200 rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-0 transition"
                                placeholder="MPa"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Resistência</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={form.resistencia}
                                onChange={e => setForm({ ...form, resistencia: e.target.value })}
                                className="w-full p-2.5 border-2 border-slate-200 rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-0 transition"
                                placeholder="MPa"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Alongamento</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={form.alongamento}
                                onChange={e => setForm({ ...form, alongamento: e.target.value })}
                                className="w-full p-2.5 border-2 border-slate-200 rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-0 transition"
                                placeholder="%"
                            />
                        </div>
                    </div>

                    {/* Relação auto */}
                    <div className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                        <span className="text-sm font-bold text-amber-700">⚡ Relação (Auto):</span>
                        <span className="text-xl font-black text-amber-900">
                            {formRelacao !== null ? formRelacao.toFixed(4) : '—'}
                        </span>
                        <span className="text-xs text-amber-600 ml-2">= Resistência / Alongamento</span>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={() => setShowForm(false)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2.5 px-6 rounded-xl transition">
                            Cancelar
                        </button>
                        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl transition flex items-center gap-2 shadow-lg shadow-indigo-200">
                            <SaveIcon className="h-5 w-5" /> Salvar Análise
                        </button>
                    </div>
                </form>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total de Análises', value: entries.length, color: 'indigo' },
                    {
                        label: 'Média Resistência',
                        value: entries.filter(e => e.resistencia).length > 0
                            ? (entries.reduce((s, e) => s + (e.resistencia || 0), 0) /
                                entries.filter(e => e.resistencia).length).toFixed(1) + ' MPa'
                            : '—',
                        color: 'blue'
                    },
                    {
                        label: 'Média Alongamento',
                        value: entries.filter(e => e.alongamento).length > 0
                            ? (entries.reduce((s, e) => s + (e.alongamento || 0), 0) /
                                entries.filter(e => e.alongamento).length).toFixed(4)
                            : '—',
                        color: 'emerald'
                    },
                    {
                        label: 'Fornecedores',
                        value: [...new Set(entries.map(e => e.fornecedor))].length,
                        color: 'amber'
                    },
                ].map((stat, i) => (
                    <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-50">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                        <p className={`text-2xl font-black text-${stat.color}-600 tracking-tighter`}>{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Chart Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-50 p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <ChartBarIcon className="h-4 w-4 text-indigo-500" /> Gráfico de Análises
                    </h2>
                    <div className="flex gap-2 flex-wrap">
                        {(['resistencia', 'alongamento', 'relacao', 'bitola'] as const).map(type => (
                            <button
                                key={type}
                                onClick={() => setChartType(type)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${chartType === type
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                {chartLabel[type]}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="relative" style={{ height: 300 }}>
                    <canvas ref={chartCanvasRef} className="w-full h-full" style={{ width: '100%', height: '100%' }} />
                </div>
            </div>

            {/* Search */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <SearchIcon className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Buscar por lote ou fornecedor..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-indigo-500 focus:ring-0 transition"
                    />
                </div>
                <p className="text-xs text-slate-400 font-bold">{filteredEntries.length} registros</p>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-900 text-white">
                                <th colSpan={3} className="p-2 text-center text-[10px] font-bold uppercase tracking-widest border-r border-slate-700">Identificação</th>
                                <th colSpan={9} className="p-2 text-center text-[10px] font-bold uppercase tracking-widest border-r border-slate-700">Setup — Cassetes (K7)</th>
                                <th className="p-2 text-center text-[10px] font-bold uppercase tracking-widest border-r border-slate-700" rowSpan={2}>Vel.</th>
                                <th colSpan={7} className="p-2 text-center text-[10px] font-bold uppercase tracking-widest border-r border-slate-700">Análise Laboratório</th>
                                <th className="p-2 text-center text-[10px] font-bold uppercase tracking-widest" rowSpan={2}>Ações</th>
                            </tr>
                            <tr className="bg-slate-800 text-slate-300 text-[10px] uppercase tracking-wider">
                                <th className="p-2 font-semibold">Data</th>
                                <th className="p-2 font-semibold">Lote</th>
                                <th className="p-2 font-semibold border-r border-slate-700">Fornec.</th>
                                <th className="p-2 font-semibold text-center" colSpan={2}>1°K7</th>
                                <th className="p-2 font-semibold text-center" colSpan={2}>2°K7</th>
                                <th className="p-2 font-semibold text-center" colSpan={2}>3°K7</th>
                                <th className="p-2 font-semibold text-center" colSpan={2}>4°K7</th>
                                <th className="p-2 font-semibold text-center border-r border-slate-700">Média K7</th>
                                <th className="p-2 font-semibold text-center">Comp.</th>
                                <th className="p-2 font-semibold text-center">Massa</th>
                                <th className="p-2 font-semibold text-center bg-amber-900/30 text-amber-300">Bitola</th>
                                <th className="p-2 font-semibold text-center">Esc.</th>
                                <th className="p-2 font-semibold text-center">Resist.</th>
                                <th className="p-2 font-semibold text-center">Along.</th>
                                <th className="p-2 font-semibold text-center bg-amber-900/30 text-amber-300 border-r border-slate-700">Relação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredEntries.length > 0 ? filteredEntries.map(entry => {
                                const bitola = calcBitola(entry.massa, entry.comprimento);
                                const relacao = calcRelacao(entry.resistencia, entry.alongamento);

                                // K7 médias
                                const k7Values = [
                                    calcK7Media(entry.k7_1_entrada, entry.k7_1_saida),
                                    calcK7Media(entry.k7_2_entrada, entry.k7_2_saida),
                                    calcK7Media(entry.k7_3_entrada, entry.k7_3_saida),
                                    calcK7Media(entry.k7_4_entrada, entry.k7_4_saida),
                                ].filter(v => v !== null) as number[];

                                const k7Avg = k7Values.length > 0 ? k7Values.reduce((s, v) => s + v, 0) / k7Values.length : null;

                                const numCell = (v: number | null) => v !== null ? v.toFixed(2) : <span className="text-slate-300">—</span>;

                                return (
                                    <tr key={entry.id} className="hover:bg-slate-50 transition">
                                        <td className="p-2 text-xs text-slate-500 whitespace-nowrap">{new Date(entry.date).toLocaleDateString('pt-BR')}</td>
                                        <td className="p-2 font-bold text-slate-800">{entry.lote}</td>
                                        <td className="p-2 text-xs text-slate-500 border-r border-slate-100">{entry.fornecedor}</td>
                                        <td className="p-1.5 text-xs text-center text-slate-600">{numCell(entry.k7_1_entrada)}</td>
                                        <td className="p-1.5 text-xs text-center text-slate-600">{numCell(entry.k7_1_saida)}</td>
                                        <td className="p-1.5 text-xs text-center text-slate-600">{numCell(entry.k7_2_entrada)}</td>
                                        <td className="p-1.5 text-xs text-center text-slate-600">{numCell(entry.k7_2_saida)}</td>
                                        <td className="p-1.5 text-xs text-center text-slate-600">{numCell(entry.k7_3_entrada)}</td>
                                        <td className="p-1.5 text-xs text-center text-slate-600">{numCell(entry.k7_3_saida)}</td>
                                        <td className="p-1.5 text-xs text-center text-slate-600">{numCell(entry.k7_4_entrada)}</td>
                                        <td className="p-1.5 text-xs text-center text-slate-600">{numCell(entry.k7_4_saida)}</td>
                                        <td className="p-2 text-center font-bold text-indigo-600 text-xs border-r border-slate-100">{k7Avg !== null ? k7Avg.toFixed(2) : '—'}</td>
                                        <td className="p-2 text-center text-xs text-slate-600 border-r border-slate-100">{numCell(entry.velocidade)}</td>
                                        <td className="p-2 text-center text-xs text-slate-600">{numCell(entry.comprimento)}</td>
                                        <td className="p-2 text-center text-xs text-slate-600">{numCell(entry.massa)}</td>
                                        <td className="p-2 text-center font-bold text-amber-700 bg-amber-50 text-xs">{bitola !== null ? bitola.toFixed(2) : <span className="text-slate-300">0</span>}</td>
                                        <td className="p-2 text-center text-xs text-slate-600">{numCell(entry.escoamento)}</td>
                                        <td className="p-2 text-center text-xs text-slate-600">{numCell(entry.resistencia)}</td>
                                        <td className="p-2 text-center text-xs text-slate-600">{numCell(entry.alongamento)}</td>
                                        <td className="p-2 text-center font-bold text-amber-700 bg-amber-50 text-xs border-r border-slate-100">{relacao !== null ? relacao.toFixed(2) : <span className="text-slate-300">0</span>}</td>
                                        <td className="p-2 text-center">
                                            <button
                                                onClick={() => handleDelete(entry.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                                title="Excluir"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={21} className="p-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="text-4xl">🔬</span>
                                            <p className="font-medium">Nenhuma análise registrada.</p>
                                            <p className="text-xs">Clique em "Nova Análise" para começar.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Laboratory;
