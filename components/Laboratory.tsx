import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Page, User, LabAnalysisEntry } from '../types';
import { ArrowLeftIcon, PlusIcon, TrashIcon, ChartBarIcon, SaveIcon, SearchIcon, FilterIcon, PrinterIcon, CheckCircleIcon, DocumentReportIcon } from './icons';
import { insertItem, deleteItem, fetchTable } from '../services/supabaseService';

interface LaboratoryProps {
    setPage: (page: Page) => void;
    currentUser: User | null;
}

const generateId = () => `lab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

const FORNECEDORES = ['Arcelor 1008', 'Gerdau 1008', 'Belgo 1008', 'Votorantim 1008'];
const BITOLAS_MP = ['5.5', '6.5'];

const parseLocalNum = (val: string): number | null => {
    if (!val || val.trim() === '') return null;
    const num = parseFloat(val.replace(',', '.'));
    return isNaN(num) ? null : num;
};

export const Laboratory: React.FC<LaboratoryProps> = ({ setPage, currentUser }) => {
    const [entries, setEntries] = useState<LabAnalysisEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [chartType, setChartType] = useState<'resistencia' | 'alongamento' | 'relacao' | 'bitola'>('resistencia');
    const chartCanvasRef = useRef<HTMLCanvasElement>(null);
    const summaryChartRef = useRef<HTMLCanvasElement>(null);

    // Wizard State
    // 0 = List | 1 = Fornecedor | 2 = Setup K7 | 3 = Tração | 4 = Resumo
    const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);

    const initialForm = {
        lote: '', fornecedor: FORNECEDORES[0], bitola_mp: BITOLAS_MP[0],
        k7_1_entrada: '', k7_1_saida: '',
        k7_2_entrada: '', k7_2_saida: '',
        k7_3_entrada: '', k7_3_saida: '',
        k7_4_entrada: '', k7_4_saida: '',
        velocidade: '',
        comprimento: '', massa: '',
        escoamento: '', resistencia: '', alongamento: '',
    };

    const [form, setForm] = useState(initialForm);

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

    // --- CALCULOS AUTOMATICOS --- //
    const calcBitola = (m: number | null, c: number | null) => (m && c && c > 0) ? Math.sqrt(m / c) * 12.744 : null;
    const calcRelacao = (r: number | null, a: number | null) => (r && a && a > 0) ? (r / a) : null;
    const calcK7Media = (ent: number | null, sai: number | null) => {
        if (ent === null && sai === null) return null;
        if (ent === null) return sai;
        if (sai === null) return ent;
        return (ent + sai) / 2;
    };

    const m = parseLocalNum(form.massa);
    const c = parseLocalNum(form.comprimento);
    const r = parseLocalNum(form.resistencia);
    const a = parseLocalNum(form.alongamento);
    const esc = parseLocalNum(form.escoamento);

    const formBitola = calcBitola(m, c);
    const formRelacao = calcRelacao(r, a);
    const formK7Medias = [1, 2, 3, 4].map(i => {
        const ent = parseLocalNum((form as any)[`k7_${i}_entrada`]);
        const sai = parseLocalNum((form as any)[`k7_${i}_saida`]);
        return calcK7Media(ent, sai);
    });

    // Validations per step
    const canGoToStep2 = form.lote.trim() !== '' && form.fornecedor !== '' && form.bitola_mp !== '';
    const canGoToStep3 = true; // K7 is optional strictly, but visually guided
    const canGoToStep4 = (r !== null || a !== null || esc !== null); // Some traction data

    const handleSave = async () => {
        const newEntry: LabAnalysisEntry = {
            id: generateId(),
            lote: form.lote,
            fornecedor: form.fornecedor,
            bitola_mp: form.bitola_mp,
            k7_1_entrada: parseLocalNum(form.k7_1_entrada),
            k7_1_saida: parseLocalNum(form.k7_1_saida),
            k7_2_entrada: parseLocalNum(form.k7_2_entrada),
            k7_2_saida: parseLocalNum(form.k7_2_saida),
            k7_3_entrada: parseLocalNum(form.k7_3_entrada),
            k7_3_saida: parseLocalNum(form.k7_3_saida),
            k7_4_entrada: parseLocalNum(form.k7_4_entrada),
            k7_4_saida: parseLocalNum(form.k7_4_saida),
            velocidade: parseLocalNum(form.velocidade),
            comprimento: c,
            massa: m,
            escoamento: esc,
            resistencia: r,
            alongamento: a,
            date: new Date().toISOString(),
            operator: currentUser?.username || 'N/A',
        };

        try {
            await insertItem('lab_analysis', newEntry);
            setEntries(prev => [newEntry, ...prev]);
            setForm(initialForm);
            setStep(0);
            alert('Relatório de análise salvo e gerado com sucesso!');
        } catch (err) {
            console.error('Erro ao salvar:', err);
            alert('Erro ao salvar nova análise.');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir esta análise definitivamente?')) return;
        try {
            await deleteItem('lab_analysis', id);
            setEntries(prev => prev.filter(e => e.id !== id));
        } catch (err) {
            console.error('Erro ao excluir:', err);
        }
    };

    const filteredEntries = useMemo(() => {
        if (!searchTerm.trim()) return entries;
        const t = searchTerm.toLowerCase();
        return entries.filter(e => e.lote.toLowerCase().includes(t) || e.fornecedor.toLowerCase().includes(t));
    }, [entries, searchTerm]);

    // MAIN CHART RENDER
    const drawDynamicChart = (canvasRef: React.RefObject<HTMLCanvasElement>, points: { label: string, value: number }[], metricKey: string, chartTitle: string) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
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

        if (points.length === 0) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = '14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Sem dados suficientes', W / 2, H / 2);
            return;
        }

        const maxVal = Math.max(...points.map(d => d.value)) * 1.15 || 10;
        const minVal = Math.max(0, Math.min(...points.map(d => d.value)) * 0.85);
        const range = maxVal - minVal || 1;

        const padL = 40, padR = 20, padT = 30, padB = 40;
        const chartW = W - padL - padR;
        const chartH = H - padT - padB;

        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padT + (chartH / 4) * i;
            ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
            const val = maxVal - (range / 4) * i;
            ctx.fillStyle = '#94a3b8'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
            ctx.fillText(val.toFixed(1), padL - 8, y + 4);
        }

        const colorsMap: any = {
            resistencia: '#6366f1', alongamento: '#10b981', relacao: '#f59e0b', bitola: '#ef4444', default: '#3b82f6'
        };
        const color = colorsMap[metricKey] || colorsMap.default;

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';

        points.forEach((d, i) => {
            const x = padL + (points.length > 1 ? (chartW / (points.length - 1)) * i : chartW / 2);
            const y = padT + chartH - ((d.value - minVal) / range) * chartH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        points.forEach((d, i) => {
            const x = padL + (points.length > 1 ? (chartW / (points.length - 1)) * i : chartW / 2);
            const y = padT + chartH - ((d.value - minVal) / range) * chartH;

            ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#fff'; ctx.fill();
            ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.stroke();

            ctx.fillStyle = '#334155'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(d.value.toFixed(2), x, y - 10);

            ctx.fillStyle = '#64748b'; ctx.font = '10px sans-serif';
            ctx.fillText(d.label, x, padT + chartH + 15);
        });

        // Title
        ctx.fillStyle = '#1e293b'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(chartTitle, padL, 15);
    };

    useEffect(() => {
        if (step === 0 && filteredEntries.length > 0) {
            const points = filteredEntries.slice().reverse().map(e => {
                let v = 0;
                switch (chartType) {
                    case 'resistencia': v = e.resistencia || 0; break;
                    case 'alongamento': v = e.alongamento || 0; break;
                    case 'relacao': v = calcRelacao(e.resistencia, e.alongamento) || 0; break;
                    case 'bitola': v = calcBitola(e.massa, e.comprimento) || 0; break;
                }
                return { label: e.lote, value: v };
            }).filter(d => d.value > 0);
            drawDynamicChart(chartCanvasRef, points, chartType, 'Histórico Geral');
        } else if (step === 4) {
            // Summary K7 Chart
            const pt = [1, 2, 3, 4].map(i => ({ label: `K7 ${i}`, value: formK7Medias[i - 1] || 0 })).filter(k => k.value > 0);
            drawDynamicChart(summaryChartRef, pt, 'default', 'Médias de Cassetes (Setup)');
        }
    }, [step, filteredEntries, chartType, formK7Medias]);


    if (isLoading) return <div className="p-10 text-center text-slate-500 font-bold">Carregando...</div>;


    /* =============== RENDER: WIZARD =============== */

    if (step > 0) {
        return (
            <div className="max-w-4xl mx-auto py-8">
                {/* WIZARD HEADER */}
                <div className="mb-8">
                    <button onClick={() => setStep(0)} className="text-slate-400 font-bold text-sm flex items-center gap-2 hover:text-indigo-600 mb-6 transition">
                        <ArrowLeftIcon className="h-4 w-4" /> Cancelar e Voltar
                    </button>
                    <div className="flex justify-between relative">
                        <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 -z-10 -translate-y-1/2 rounded"></div>
                        <div className="absolute top-1/2 left-0 h-1 bg-indigo-500 -z-10 -translate-y-1/2 transition-all duration-500 rounded" style={{ width: `${((step - 1) / 3) * 100}%` }}></div>
                        {[1, 2, 3, 4].map(s => (
                            <div key={s} className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border-4 transition-all ${step >= s ? 'bg-indigo-600 text-white border-indigo-100 shadow-lg shadow-indigo-200' : 'bg-slate-100 text-slate-400 border-white'}`}>
                                {s}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 md:p-12 animate-fade-in-up">
                    {/* STEP 1 */}
                    {step === 1 && (
                        <div>
                            <h2 className="text-3xl font-black text-slate-800 mb-2">1º Passo: Identificação</h2>
                            <p className="text-slate-500 text-lg mb-8">Qual a bitola da matéria prima e seu fornecedor?</p>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-600 mb-2 uppercase tracking-wide">Lote / Identificador *</label>
                                    <input autoFocus type="text" value={form.lote} onChange={e => setForm({ ...form, lote: e.target.value })} className="w-full p-4 border-2 border-slate-200 rounded-xl text-xl font-bold focus:border-indigo-500 focus:ring-0 transition" placeholder="Ex: 7555" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-600 mb-2 uppercase tracking-wide">Fornecedor (SAE)</label>
                                    <select value={form.fornecedor} onChange={e => setForm({ ...form, fornecedor: e.target.value })} className="w-full p-4 border-2 border-slate-200 rounded-xl text-xl font-bold focus:border-indigo-500 focus:ring-0 transition bg-white">
                                        {FORNECEDORES.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-600 mb-2 uppercase tracking-wide">Bitola MP (Matéria Prima)</label>
                                    <div className="flex gap-4">
                                        {BITOLAS_MP.map(b => (
                                            <button key={b} type="button" onClick={() => setForm({ ...form, bitola_mp: b })} className={`flex-1 py-4 text-xl font-bold rounded-xl border-2 transition ${form.bitola_mp === b ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
                                                {b} mm
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-12 flex justify-end">
                                <button disabled={!canGoToStep2} onClick={() => setStep(2)} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 px-10 rounded-xl text-lg transition shadow-lg shadow-indigo-200">
                                    Avançar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 2 */}
                    {step === 2 && (
                        <div>
                            <h2 className="text-3xl font-black text-slate-800 mb-2">2º Passo: Setup (Laminador)</h2>
                            <p className="text-slate-500 text-lg mb-8">Quais os valores de entrada e saída dos Cassetes (K7)?</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100">
                                        <div className="text-center font-black text-slate-700 mb-4">{i}º K7</div>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">Entrada</label>
                                                <input type="text" inputMode="decimal" value={(form as any)[`k7_${i}_entrada`]} onChange={e => setForm({ ...form, [`k7_${i}_entrada`]: e.target.value })} className="w-full p-3 border-2 border-slate-200 rounded-xl text-center font-bold focus:border-indigo-500 focus:ring-0 transition" placeholder="—" />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">Saída</label>
                                                <input type="text" inputMode="decimal" value={(form as any)[`k7_${i}_saida`]} onChange={e => setForm({ ...form, [`k7_${i}_saida`]: e.target.value })} className="w-full p-3 border-2 border-slate-200 rounded-xl text-center font-bold focus:border-indigo-500 focus:ring-0 transition" placeholder="—" />
                                            </div>
                                        </div>
                                        {formK7Medias[i - 1] !== null && (
                                            <div className="mt-4 bg-indigo-100 rounded-xl py-2 px-1 text-center border border-indigo-200">
                                                <span className="text-[10px] uppercase font-black tracking-widest text-indigo-500 block">Média</span>
                                                <span className="text-lg font-black text-indigo-700">{formK7Medias[i - 1]!.toFixed(2)}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="w-1/3 mb-4">
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">Velocidade (Opcional)</label>
                                <input type="text" inputMode="decimal" value={form.velocidade} onChange={e => setForm({ ...form, velocidade: e.target.value })} className="w-full p-4 border-2 border-slate-200 rounded-xl font-bold focus:border-indigo-500 focus:ring-0 transition" placeholder="m/min" />
                            </div>

                            <div className="mt-12 flex justify-between">
                                <button onClick={() => setStep(1)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 px-8 rounded-xl transition">Voltar</button>
                                <button onClick={() => setStep(3)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-10 rounded-xl text-lg transition shadow-lg shadow-indigo-200">Avançar para Ensaios</button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3 */}
                    {step === 3 && (
                        <div>
                            <h2 className="text-3xl font-black text-slate-800 mb-2">3º Passo: Ensaios Físicos</h2>
                            <p className="text-slate-500 text-lg mb-8">Insira os resultados de laboratório (massa, comprimento e resistência).</p>

                            <div className="bg-amber-50/50 rounded-2xl p-6 border-2 border-amber-100 mb-6">
                                <h3 className="uppercase text-xs font-black tracking-widest text-amber-600 mb-4">Massa & Comprimento</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-600 mb-2">Comprimento (mm)</label>
                                        <input type="text" inputMode="decimal" value={form.comprimento} onChange={e => setForm({ ...form, comprimento: e.target.value })} className="w-full p-4 text-center border-2 border-slate-200 rounded-xl text-xl font-bold focus:border-amber-500 focus:ring-0 transition" placeholder="199" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-600 mb-2">Massa (g)</label>
                                        <input type="text" inputMode="decimal" value={form.massa} onChange={e => setForm({ ...form, massa: e.target.value })} className="w-full p-4 text-center border-2 border-slate-200 rounded-xl text-xl font-bold focus:border-amber-500 focus:ring-0 transition" placeholder="14,101" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-black text-amber-600 mb-2">⚡ Bitola Final</label>
                                        <div className="w-full h-[64px] bg-white border-2 border-amber-300 rounded-xl flex items-center justify-center shadow-inner">
                                            <span className="text-2xl font-black text-amber-800">{formBitola !== null ? `${formBitola.toFixed(2)} mm` : '—'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-indigo-50/50 rounded-2xl p-6 border-2 border-indigo-100">
                                <h3 className="uppercase text-xs font-black tracking-widest text-indigo-600 mb-4">Tração</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-600 mb-2">Escoamento</label>
                                        <input type="text" inputMode="decimal" value={form.escoamento} onChange={e => setForm({ ...form, escoamento: e.target.value })} className="w-full p-4 text-center border-2 border-slate-200 rounded-xl text-xl font-bold focus:border-indigo-500 focus:ring-0 transition" placeholder="MPa" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-emerald-600 mb-2">Resistência *</label>
                                        <input autoFocus type="text" inputMode="decimal" value={form.resistencia} onChange={e => setForm({ ...form, resistencia: e.target.value })} className="w-full p-4 text-center border-2 border-emerald-200 bg-white rounded-xl text-xl font-bold focus:border-emerald-500 focus:ring-0 transition shadow-inner" placeholder="MPa" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-600 mb-2">Alongamento</label>
                                        <input type="text" inputMode="decimal" value={form.alongamento} onChange={e => setForm({ ...form, alongamento: e.target.value })} className="w-full p-4 text-center border-2 border-slate-200 rounded-xl text-xl font-bold focus:border-indigo-500 focus:ring-0 transition" placeholder="%" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-black text-indigo-600 mb-2">⚡ Relação (R/A)</label>
                                        <div className="w-full h-[64px] bg-white border-2 border-indigo-300 rounded-xl flex items-center justify-center shadow-inner">
                                            <span className={`text-2xl font-black transition-colors ${formRelacao === null ? 'text-slate-300' : 'text-indigo-800'}`}>
                                                {formRelacao !== null ? formRelacao.toFixed(4) : '—'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-12 flex justify-between">
                                <button onClick={() => setStep(2)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 px-8 rounded-xl transition">Voltar</button>
                                <button onClick={() => setStep(4)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-10 rounded-xl text-lg transition flex items-center gap-2 shadow-lg shadow-indigo-200">
                                    <DocumentReportIcon className="w-5 h-5" /> Gerar Relatório Final
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 4 - RELATÓRIO E SALVAR */}
                    {step === 4 && (
                        <div className="animate-fade-in">
                            <h2 className="text-3xl font-black text-slate-800 mb-2 flex items-center gap-3">
                                <CheckCircleIcon className="w-8 h-8 text-emerald-500" /> Relatório da Análise
                            </h2>
                            <p className="text-slate-500 text-lg mb-8">Revise os dados calculados e os gráficos antes de salvar definitivamente.</p>

                            <div className="bg-slate-50 rounded-2xl p-6 border-2 border-slate-200 mb-6 flex justify-between items-center">
                                <div>
                                    <p className="text-xs uppercase font-black text-slate-400">Lote Oficial</p>
                                    <p className="text-2xl font-black text-slate-800">{form.lote}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs uppercase font-black text-slate-400">MP / Fornecedor</p>
                                    <p className="text-lg font-bold text-slate-600">{form.bitola_mp}mm / {form.fornecedor}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6 mb-8">
                                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
                                    <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-1">Relação Auto</p>
                                    <p className="text-4xl font-black text-indigo-700">{formRelacao !== null ? formRelacao.toFixed(2) : '--'}</p>
                                    <p className="text-[10px] text-indigo-400 mt-2 font-medium">Resist: {form.resistencia} / Along: {form.alongamento}</p>
                                </div>
                                <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
                                    <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">Bitola Final Auto</p>
                                    <p className="text-4xl font-black text-amber-700">{formBitola !== null ? formBitola.toFixed(2) : '--'}<span className="text-xl">mm</span></p>
                                    <p className="text-[10px] text-amber-400 mt-2 font-medium">Massa: {form.massa}g / Comp: {form.comprimento}mm</p>
                                </div>
                            </div>

                            <div className="bg-white border rounded-xl p-4 shadow-sm mb-8">
                                <div className="relative w-full h-48">
                                    <canvas ref={summaryChartRef}></canvas>
                                </div>
                            </div>

                            <div className="mt-12 flex justify-between pt-6 border-t border-slate-100">
                                <button onClick={() => setStep(3)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 px-8 rounded-xl transition">Revisar Dados</button>
                                <button onClick={handleSave} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 px-10 rounded-xl text-lg transition shadow-lg shadow-emerald-200 flex items-center gap-2">
                                    <SaveIcon className="h-5 w-5" /> Salvar e Finalizar
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    /* =============== RENDER: MAIN LIST (STEP 0) =============== */
    return (
        <div className="max-w-[1920px] mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">🔬</div>
                        Controle de Laboratório
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Histórico de setup de laminadores e ensaios de tração</p>
                </div>
                <button
                    onClick={() => setStep(1)}
                    className="bg-indigo-600 text-white hover:bg-indigo-700 font-bold py-3 px-6 rounded-xl transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-indigo-200"
                >
                    <PlusIcon className="h-5 w-5" /> Iniciar Nova Análise
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Análises de Lote', value: entries.length, color: 'indigo' },
                    {
                        label: 'Média Relação',
                        value: entries.filter(e => calcRelacao(e.resistencia, e.alongamento)).length > 0
                            ? (entries.reduce((s, e) => s + (calcRelacao(e.resistencia, e.alongamento) || 0), 0) /
                                entries.filter(e => calcRelacao(e.resistencia, e.alongamento)).length).toFixed(3)
                            : '—',
                        color: 'blue'
                    },
                    {
                        label: 'Média Bitola MP 5.5',
                        value: entries.filter(e => e.massa && e.bitola_mp === '5.5').length > 0
                            ? (entries.reduce((s, e) => s + (calcBitola(e.massa, e.comprimento) || 0), 0) /
                                entries.filter(e => e.massa && e.bitola_mp === '5.5').length).toFixed(2)
                            : '—',
                        color: 'emerald'
                    },
                    {
                        label: 'Média Bitola MP 6.5',
                        value: entries.filter(e => e.massa && e.bitola_mp === '6.5').length > 0
                            ? (entries.reduce((s, e) => s + (calcBitola(e.massa, e.comprimento) || 0), 0) /
                                entries.filter(e => e.massa && e.bitola_mp === '6.5').length).toFixed(2)
                            : '—',
                        color: 'amber'
                    },
                ].map((stat, i) => (
                    <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-50">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                        <p className={`text-2xl font-black text-${stat.color}-600 tracking-tighter`}>{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-50 p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <ChartBarIcon className="h-4 w-4 text-indigo-500" /> Gráfico do Histórico
                    </h2>
                    <div className="flex gap-2 flex-wrap">
                        {(['resistencia', 'alongamento', 'relacao', 'bitola'] as const).map(type => {
                            const labels = {
                                resistencia: 'Resistência (MPa)', alongamento: 'Alongamento (%)',
                                relacao: 'Relação (Res./Along.)', bitola: 'Bitola Final (mm)'
                            };
                            return (
                                <button
                                    key={type} onClick={() => setChartType(type)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${chartType === type ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                >
                                    {labels[type]}
                                </button>
                            )
                        })}
                    </div>
                </div>
                <div className="relative" style={{ height: 300 }}>
                    <canvas ref={chartCanvasRef} className="w-full h-full" style={{ width: '100%', height: '100%' }} />
                </div>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="relative flex-1 max-w-md w-full">
                    <SearchIcon className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input type="text" placeholder="Buscar lote..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-indigo-500 focus:ring-0 shadow-sm" />
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-900 text-white">
                                <th colSpan={3} className="p-2 text-center text-[10px] font-bold uppercase tracking-widest border-r border-slate-700">Identificação</th>
                                <th colSpan={9} className="p-2 text-center text-[10px] font-bold uppercase tracking-widest border-r border-slate-700">Setup — Cassetes (K7)</th>
                                <th colSpan={7} className="p-2 text-center text-[10px] font-bold uppercase tracking-widest border-r border-slate-700">Análise Físico / Tração</th>
                                <th className="p-2 text-center text-[10px] font-bold uppercase tracking-widest" rowSpan={2}>Ações</th>
                            </tr>
                            <tr className="bg-slate-800 text-slate-300 text-[10px] uppercase tracking-wider">
                                <th className="p-2 font-semibold text-left">Lote</th>
                                <th className="p-2 font-semibold">Bitola MP</th>
                                <th className="p-2 font-semibold border-r border-slate-700">Fornecedor</th>
                                <th className="p-2 font-semibold text-center border-l border-slate-700" colSpan={2}>1°K7</th>
                                <th className="p-2 font-semibold text-center" colSpan={2}>2°K7</th>
                                <th className="p-2 font-semibold text-center" colSpan={2}>3°K7</th>
                                <th className="p-2 font-semibold text-center" colSpan={2}>4°K7</th>
                                <th className="p-2 font-semibold text-center border-r border-slate-700">Média</th>
                                <th className="p-2 font-semibold text-center mt-1 text-slate-400"><span className="text-[8px] block">Massa</span><span className="text-[8px] block">Comp.</span></th>
                                <th className="p-2 font-semibold text-center bg-amber-900/30 text-amber-300">Bitola Final</th>
                                <th className="p-2 font-semibold text-center">Esc.</th>
                                <th className="p-2 font-semibold text-center">Resist.</th>
                                <th className="p-2 font-semibold text-center">Along.</th>
                                <th className="p-2 font-semibold text-center bg-indigo-900/30 text-indigo-300 border-r border-slate-700">Relação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredEntries.map(entry => {
                                const rel = calcRelacao(entry.resistencia, entry.alongamento);
                                const bit = calcBitola(entry.massa, entry.comprimento);
                                const k7AvgArr = [
                                    calcK7Media(entry.k7_1_entrada, entry.k7_1_saida),
                                    calcK7Media(entry.k7_2_entrada, entry.k7_2_saida),
                                    calcK7Media(entry.k7_3_entrada, entry.k7_3_saida),
                                    calcK7Media(entry.k7_4_entrada, entry.k7_4_saida),
                                ].filter(v => v !== null) as number[];
                                const k7Avg = k7AvgArr.length > 0 ? k7AvgArr.reduce((a, b) => a + b, 0) / k7AvgArr.length : null;

                                const n = (v: number | null) => v !== null ? v.toFixed(2) : <span className="opacity-30">—</span>;

                                return (
                                    <tr key={entry.id} className="hover:bg-slate-50">
                                        <td className="p-3 font-bold text-slate-800 text-left">{entry.lote}</td>
                                        <td className="p-3 text-center text-emerald-600 font-bold bg-emerald-50/30">{entry.bitola_mp}</td>
                                        <td className="p-3 text-xs text-slate-500 border-r border-slate-100">{entry.fornecedor}</td>

                                        <td className="p-1 px-2 text-[11px] text-center text-slate-500 border-l border-slate-100 bg-slate-50/50">{n(entry.k7_1_entrada)}</td>
                                        <td className="p-1 px-2 text-[11px] text-center text-slate-500 bg-slate-50/50">{n(entry.k7_1_saida)}</td>
                                        <td className="p-1 px-2 text-[11px] text-center text-slate-500">{n(entry.k7_2_entrada)}</td>
                                        <td className="p-1 px-2 text-[11px] text-center text-slate-500">{n(entry.k7_2_saida)}</td>
                                        <td className="p-1 px-2 text-[11px] text-center text-slate-500 bg-slate-50/50">{n(entry.k7_3_entrada)}</td>
                                        <td className="p-1 px-2 text-[11px] text-center text-slate-500 bg-slate-50/50">{n(entry.k7_3_saida)}</td>
                                        <td className="p-1 px-2 text-[11px] text-center text-slate-500">{n(entry.k7_4_entrada)}</td>
                                        <td className="p-1 px-2 text-[11px] text-center text-slate-500">{n(entry.k7_4_saida)}</td>
                                        <td className="p-2 text-center font-bold text-indigo-500 text-xs border-r border-slate-100">{n(k7Avg)}</td>

                                        <td className="p-1 px-2 text-[10px] text-center text-slate-400 font-medium">
                                            <div className="border-b border-slate-100 pb-0.5 mb-0.5 text-center">{entry.massa ? entry.massa.toFixed(2) : '-'}</div>
                                            <div className="text-center">{entry.comprimento || '-'}</div>
                                        </td>
                                        <td className="p-2 text-center font-black text-amber-700 bg-amber-50">{n(bit)}</td>

                                        <td className="p-2 text-center text-[11px] font-bold text-slate-600">{n(entry.escoamento)}</td>
                                        <td className="p-2 text-center text-[11px] font-bold text-slate-600 border-x border-slate-100 bg-slate-50">{n(entry.resistencia)}</td>
                                        <td className="p-2 text-center text-[11px] font-bold text-slate-600">{n(entry.alongamento)}</td>

                                        <td className="p-2 text-center font-black text-indigo-700 bg-indigo-50 border-r border-slate-100">{n(rel)}</td>

                                        <td className="p-2 text-center">
                                            <button onClick={() => handleDelete(entry.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"><TrashIcon className="h-4 w-4" /></button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Laboratory;
