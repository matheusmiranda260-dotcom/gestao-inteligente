import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ArrowLeftIcon, SaveIcon, CalculatorIcon, AdjustmentsIcon, TrashIcon, BookOpenIcon, CheckCircleIcon, ExclamationIcon } from './icons';
import { TrefilaRecipe } from '../types';
import { insertItem, fetchTable, deleteItem } from '../services/supabaseService';

interface TrefilaCalculationProps {
    onClose: () => void;
}

interface PassResult {
    pass: number;
    diameter: number;
    reduction: number; // Percentage
    status: 'Alta' | 'Ok' | 'Baixa';
}

const TrefilaCalculation: React.FC<TrefilaCalculationProps> = ({ onClose }) => {
    // UI State
    const [activeTab, setActiveTab] = useState<'fluxo' | 'tabela' | 'grafico'>('fluxo');
    const [isLoading, setIsLoading] = useState(false);

    // Calculation State
    const [params, setParams] = useState({
        type: 'K-7 CA 60' as 'K-7 CA 60',
        entryDiameter: '5.5',
        finalDiameter: '3.2',
        passes: '4'
    });
    const [results, setResults] = useState<PassResult[]>([]);
    const [passDiameters, setPassDiameters] = useState<number[]>([]);
    const [passRings, setPassRings] = useState<{ entry: string; output: string }[]>([]);
    const [suggestion, setSuggestion] = useState<string | null>(null);

    // Recipe State
    const [recipeName, setRecipeName] = useState('');
    const [savedRecipes, setSavedRecipes] = useState<TrefilaRecipe[]>([]);

    // Fetch Recipes on Mount
    useEffect(() => {
        loadRecipes();
    }, []);

    const loadRecipes = async () => {
        setIsLoading(true);
        try {
            const data = await fetchTable<TrefilaRecipe>('trefila_recipes');
            setSavedRecipes(data || []);
        } catch (error) {
            console.error("Erro ao carregar receitas:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Simulation Logic (Unchanged core logic)
    const runSimulation = (n: number, dIn: number, dOut: number) => {
        if (n <= 0) return null;
        const targetRatio = Math.pow(dOut / dIn, 2);

        const getRatioFromReductions = (rStart: number, rEnd: number, steps: number) => {
            let currentRatio = 1;
            for (let i = 0; i < steps; i++) {
                const r = steps === 1 ? rStart : rStart - ((rStart - rEnd) / (steps - 1)) * i;
                currentRatio *= (1 - r);
            }
            return currentRatio;
        };

        const solveForStart = (targetVal: number, rEndFixed: number) => {
            let low = rEndFixed + 0.001;
            let high = 0.90;
            for (let k = 0; k < 30; k++) {
                const mid = (low + high) / 2;
                const ratio = getRatioFromReductions(mid, rEndFixed, n);
                if (ratio < targetVal) high = mid; else low = mid;
            }
            return (low + high) / 2;
        };

        const solveForEnd = (targetVal: number, rStartFixed: number) => {
            let low = 0.001;
            let high = rStartFixed - 0.001;
            if (high < low) high = low;
            for (let k = 0; k < 30; k++) {
                const mid = (low + high) / 2;
                const ratio = getRatioFromReductions(rStartFixed, mid, n);
                if (ratio < targetVal) high = mid; else low = mid;
            }
            return (low + high) / 2;
        };

        let bestRStart = 0;
        let bestREnd = 0.19;

        if (n === 1) {
            bestREnd = 1 - targetRatio;
            bestRStart = 1 - targetRatio;
        } else {
            const startAttempt = solveForStart(targetRatio, 0.19);
            if (startAttempt > 0.29) {
                bestRStart = 0.29;
                bestREnd = solveForEnd(targetRatio, 0.29);
            } else if (Math.abs(startAttempt - 0.19) < 0.002 || startAttempt < 0.19) {
                let found = false;
                let searchEnd = 0.18;
                for (; searchEnd > 0.01; searchEnd -= 0.01) {
                    const s = solveForStart(targetRatio, searchEnd);
                    if (s > searchEnd + 0.01) {
                        bestRStart = s;
                        bestREnd = searchEnd;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    bestRStart = 1 - Math.pow(targetRatio, 1 / n);
                    bestREnd = bestRStart;
                }
            } else {
                bestRStart = startAttempt;
                bestREnd = 0.19;
            }
        }

        const calculatedDiameters: number[] = [];
        const calculatedReductions: number[] = [];
        let currentD = dIn;
        let prevArea = Math.PI * Math.pow(currentD / 2, 2);

        for (let i = 0; i < n; i++) {
            const r = n === 1 ? bestRStart : bestRStart - ((bestRStart - bestREnd) / (n - 1)) * i;
            if (i === n - 1) {
                calculatedDiameters.push(dOut);
            } else {
                const nextArea = prevArea * (1 - r);
                const nextD = 2 * Math.sqrt(nextArea / Math.PI);
                calculatedDiameters.push(parseFloat(nextD.toFixed(2)));
                currentD = nextD;
                prevArea = nextArea;
            }
            calculatedReductions.push(r * 100);
        }
        return { diameters: calculatedDiameters, reductions: calculatedReductions };
    };

    const calculateDistribution = () => {
        const dIn = parseFloat(params.entryDiameter.replace(',', '.'));
        const dOut = parseFloat(params.finalDiameter.replace(',', '.'));
        if (isNaN(dIn) || isNaN(dOut)) { alert('Verifique os parâmetros.'); return; }
        setSuggestion(null);

        let n = parseInt(params.passes);
        if (n <= 0) n = 4;
        if (n > 4) { setParams(prev => ({ ...prev, passes: '4' })); n = 4; }

        const currentResult = runSimulation(n, dIn, dOut);
        if (!currentResult) return;

        setPassDiameters(currentResult.diameters);
        // Preserve existing ring values if pass count is same, else reset
        if (passRings.length !== n) {
            setPassRings(Array(n).fill({ entry: '', output: '' }));
        }
        updateResults(currentResult.diameters);
    };

    const updateResults = (diameters: number[]) => {
        const dIn = parseFloat(params.entryDiameter.replace(',', '.'));
        const newResults: PassResult[] = [];

        diameters.forEach((d, index) => {
            const prevD = index === 0 ? dIn : diameters[index - 1];
            const currentD = d;
            const prevArea = Math.PI * Math.pow(prevD / 2, 2);
            const currentArea = Math.PI * Math.pow(currentD / 2, 2);
            const reduction = prevArea > 0 ? ((prevArea - currentArea) / prevArea) * 100 : 0;
            const passNumber = index + 1;
            let status: 'Alta' | 'Ok' | 'Baixa' = 'Ok';

            if (passNumber === 1 && reduction > 29.0) status = 'Alta';
            else if (passNumber === diameters.length && reduction > 19.0) status = 'Alta';
            else if (reduction > 29.0) status = 'Alta';

            newResults.push({
                pass: passNumber,
                diameter: parseFloat(currentD.toFixed(2)),
                reduction: parseFloat(reduction.toFixed(2)),
                status
            });
        });
        setResults(newResults);
    };

    const handleDiameterChange = (index: number, value: string) => {
        const newDiameters = [...passDiameters];
        const val = parseFloat(value);
        if (!isNaN(val)) {
            newDiameters[index] = val;
            setPassDiameters(newDiameters);
            updateResults(newDiameters);
        }
    };

    const handleRingChange = (index: number, type: 'entry' | 'output', value: string) => {
        const newRings = [...passRings];
        if (!newRings[index]) newRings[index] = { entry: '', output: '' };
        newRings[index] = { ...newRings[index], [type]: value };
        setPassRings(newRings);
    };

    const handleSaveRecipe = async () => {
        if (!recipeName) return alert('Digite um nome para a receita.');

        try {
            const newRecipe = {
                name: recipeName,
                type: params.type,
                entryDiameter: parseFloat(params.entryDiameter),
                finalDiameter: parseFloat(params.finalDiameter),
                passes: parseInt(params.passes),
                passDiameters: passDiameters,
                passRings: passRings
            };

            const saved = await insertItem<TrefilaRecipe>('trefila_recipes', newRecipe as any);
            setSavedRecipes([...savedRecipes, saved]);
            setRecipeName('');
            alert('Receita salva com sucesso!');
        } catch (error) {
            alert('Erro ao salvar receita. Verifique se a tabela foi criada.');
            console.error(error);
        }
    };

    const handleLoadRecipe = (recipe: TrefilaRecipe) => {
        setParams({
            type: recipe.type as 'K-7 CA 60',
            entryDiameter: recipe.entryDiameter.toString(),
            finalDiameter: recipe.finalDiameter.toString(),
            passes: recipe.passes.toString()
        });
        setPassDiameters(recipe.passDiameters);
        setPassRings(recipe.passRings || []);
        updateResults(recipe.passDiameters);
        setRecipeName(recipe.name); // Optional: preload name
        setActiveTab('tabela'); // Switch to table view to see details
    };

    const handleDeleteRecipe = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Tem certeza que deseja excluir esta receita?')) {
            try {
                await deleteItem('trefila_recipes', id);
                setSavedRecipes(savedRecipes.filter(r => r.id !== id));
            } catch (error) {
                alert('Erro ao excluir receita.');
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-50 z-[100] overflow-y-auto">
            <div className="min-h-screen flex flex-col">
                {/* Header */}
                <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
                    <div className="flex items-center gap-4">
                        <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition">
                            <ArrowLeftIcon className="h-5 w-5" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <CalculatorIcon className="h-6 w-6 text-blue-600" />
                                Cálculo de Trefilação
                            </h1>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {/* Actions could go here */}
                    </div>
                </div>

                <div className="flex-1 max-w-[1600px] w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                    {/* Left Panel: Controls & Recipes */}
                    <div className="lg:col-span-4 space-y-6">

                        {/* Parameters Card */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <AdjustmentsIcon className="h-5 w-5 text-blue-500" />
                                Parâmetros de Processo
                            </h2>

                            <div className="space-y-5">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded inline-block mb-2">TIPO DE MATERIAL</label>
                                    <div className="flex bg-slate-100 p-1 rounded-xl">
                                        <button className="flex-1 py-2 rounded-lg bg-white text-blue-700 shadow-sm font-semibold text-sm">K-7 CA 60</button>
                                        <button className="flex-1 py-2 rounded-lg text-slate-500 font-medium text-sm hover:bg-white/50" disabled>Outros (Em breve)</button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="group">
                                        <label className="block text-sm font-semibold text-slate-600 mb-1.5">Entrada (mm)</label>
                                        <select
                                            value={params.entryDiameter}
                                            onChange={e => setParams({ ...params, entryDiameter: e.target.value })}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none font-medium text-slate-800 transition-all"
                                        >
                                            <option value="8.00">8.00 mm</option>
                                            <option value="7.00">7.00 mm</option>
                                            <option value="6.50">6.50 mm</option>
                                            <option value="6.35">6.35 mm</option>
                                            <option value="5.50">5.50 mm</option>
                                        </select>
                                    </div>
                                    <div className="group">
                                        <label className="block text-sm font-semibold text-slate-600 mb-1.5">Saída (mm)</label>
                                        <input
                                            type="number" step="0.01"
                                            value={params.finalDiameter}
                                            onChange={e => setParams({ ...params, finalDiameter: e.target.value })}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none font-medium text-slate-800 transition-all"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-600 mb-1.5">Passes (Max 4)</label>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="range" min="1" max="4" step="1"
                                            value={params.passes}
                                            onChange={e => setParams({ ...params, passes: e.target.value })}
                                            className="flex-grow h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                        />
                                        <span className="text-xl font-bold text-blue-600 w-8 text-center">{params.passes}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={calculateDistribution}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <CalculatorIcon className="h-5 w-5" />
                                    Calcular Distribuição
                                </button>

                                {suggestion && (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-start gap-2">
                                        <ExclamationIcon className="h-5 w-5 shrink-0" />
                                        <span>{suggestion}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Save & Load Recipes */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <BookOpenIcon className="h-5 w-5 text-emerald-500" />
                                Receitas Salvas
                            </h2>

                            <div className="flex gap-2 mb-4">
                                <input
                                    type="text"
                                    placeholder="Nome da nova receita..."
                                    value={recipeName}
                                    onChange={e => setRecipeName(e.target.value)}
                                    className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-emerald-500 outline-none"
                                />
                                <button
                                    onClick={handleSaveRecipe}
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold text-sm transition"
                                >
                                    Salvar
                                </button>
                            </div>

                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                {isLoading ? (
                                    <p className="text-center text-slate-400 text-sm py-2">Carregando...</p>
                                ) : savedRecipes.length === 0 ? (
                                    <p className="text-center text-slate-400 text-sm py-4 border-2 border-dashed border-slate-100 rounded-xl">
                                        Nenhuma receita salva.
                                    </p>
                                ) : (
                                    savedRecipes.map(recipe => (
                                        <div key={recipe.id}
                                            onClick={() => handleLoadRecipe(recipe)}
                                            className="group flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition cursor-pointer"
                                        >
                                            <div>
                                                <p className="font-bold text-slate-700 text-sm group-hover:text-blue-700">{recipe.name}</p>
                                                <p className="text-xs text-slate-500 group-hover:text-blue-500">
                                                    {recipe.entryDiameter}mm → {recipe.finalDiameter}mm ({recipe.passes} passes)
                                                </p>
                                            </div>
                                            <button
                                                onClick={(e) => handleDeleteRecipe(recipe.id, e)}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 text-slate-400 hover:text-red-500 rounded-lg transition"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                    </div>

                    {/* Right Panel: Results Visualization */}
                    <div className="lg:col-span-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 min-h-[600px] flex flex-col">

                        {/* Tab Switcher */}
                        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit mb-6">
                            {[
                                { id: 'fluxo', label: 'Fluxo Visual', icon: AdjustmentsIcon },
                                { id: 'tabela', label: 'Tabela Técnica', icon: BookOpenIcon },
                                { id: 'grafico', label: 'Gráfico de Redução', icon: CalculatorIcon }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === tab.id
                                            ? 'bg-white text-blue-600 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    {/* @ts-ignore */}
                                    <tab.icon className="h-4 w-4" />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Content Area */}

                        {results.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl m-4">
                                <CalculatorIcon className="h-12 w-12 mb-2 opacity-20" />
                                <p>Execute o cálculo para visualizar os resultados.</p>
                            </div>
                        ) : (
                            <div className="flex-1">
                                {activeTab === 'fluxo' && (
                                    <div className="h-full flex flex-col justify-center overflow-x-auto p-4">
                                        <div className="flex items-center min-w-max gap-4 mx-auto">
                                            {/* Entry Node */}
                                            <div className="flex flex-col items-center">
                                                <div className="w-24 h-24 rounded-full bg-slate-800 text-white flex flex-col items-center justify-center shadow-lg border-4 border-slate-100 z-10">
                                                    <span className="text-xs opacity-70">Entrada</span>
                                                    <span className="text-xl font-bold">{params.entryDiameter}</span>
                                                    <span className="text-[10px] opacity-70">mm</span>
                                                </div>
                                            </div>

                                            {/* Process Nodes */}
                                            {results.map((res, i) => (
                                                <div key={i} className="flex items-center">
                                                    {/* Connector */}
                                                    <div className="w-16 h-1 bg-slate-200 relative">
                                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                                                            <span className={`text-[10px] font-bold ${res.reduction > 29 ? 'text-red-500' : 'text-blue-500'}`}>
                                                                -{res.reduction.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Node */}
                                                    <div className="flex flex-col items-center gap-2 relative group">
                                                        <div className={`w-24 h-24 rounded-2xl flex flex-col items-center justify-center shadow-md border-2 transition-transform hover:scale-105 z-10 ${res.status === 'Alta' ? 'bg-red-50 border-red-200' : 'bg-white border-blue-100'
                                                            }`}>
                                                            <span className="text-xs text-slate-400 mb-1">Passe {res.pass}</span>
                                                            <span className="text-2xl font-bold text-slate-700">{res.diameter.toFixed(2)}</span>
                                                            <span className="text-[10px] text-slate-400">mm</span>
                                                        </div>
                                                        <div className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                                            {passRings[i]?.output || '-'}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'tabela' && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200">
                                                    <th className="px-6 py-4 font-bold text-slate-600">PASSE</th>
                                                    <th className="px-6 py-4 font-bold text-slate-600 bg-blue-50/50">ANEL ENTRADA</th>
                                                    <th className="px-6 py-4 font-bold text-slate-600 bg-blue-50/50">ANEL SAÍDA</th>
                                                    <th className="px-6 py-4 font-bold text-slate-600">DIÂMETRO (mm)</th>
                                                    <th className="px-6 py-4 font-bold text-slate-600">REDUÇÃO (%)</th>
                                                    <th className="px-6 py-4 font-bold text-slate-600">STATUS</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {results.map((res, i) => (
                                                    <tr key={i} className="hover:bg-slate-50">
                                                        <td className="px-6 py-4 font-bold text-slate-800">#{res.pass}</td>
                                                        <td className="px-6 py-4 bg-blue-50/20">
                                                            <input type="text"
                                                                className="w-full bg-transparent border-b border-dashed border-blue-300 focus:border-blue-600 outline-none text-center"
                                                                placeholder="-"
                                                                value={passRings[i]?.entry}
                                                                onChange={e => handleRingChange(i, 'entry', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="px-6 py-4 bg-blue-50/20">
                                                            <input type="text"
                                                                className="w-full bg-transparent border-b border-dashed border-blue-300 focus:border-blue-600 outline-none text-center text-blue-700 font-medium"
                                                                placeholder="-"
                                                                value={passRings[i]?.output}
                                                                onChange={e => handleRingChange(i, 'output', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <input type="number" step="0.01"
                                                                className="w-20 bg-slate-100 rounded px-2 py-1 text-center font-bold text-slate-700 focus:bg-white focus:ring-2 ring-blue-200 outline-none"
                                                                value={passDiameters[i]}
                                                                onChange={e => handleDiameterChange(i, e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="px-6 py-4 font-mono text-slate-600">
                                                            {res.reduction.toFixed(2)}%
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {res.status === 'Ok'
                                                                ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold"><CheckCircleIcon className="h-3 w-3" /> OK</span>
                                                                : <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold"><ExclamationIcon className="h-3 w-3" /> Alta</span>
                                                            }
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <div className="mt-4 p-4 bg-blue-50 rounded-xl text-blue-800 text-xs flex items-center gap-2">
                                            <ExclamationIcon className="h-4 w-4" />
                                            Dica: Edite os diâmetros diretamente na tabela para simular ajustes finos.
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'grafico' && (
                                    <div className="h-[400px] w-full p-4">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={results}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                                <XAxis dataKey="pass" tickLine={false} axisLine={false} tick={{ fill: '#64748B' }} />
                                                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748B' }} domain={[0, 40]} />
                                                <Tooltip
                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}
                                                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                                                />
                                                <ReferenceLine y={29} stroke="#EF4444" strokeDasharray="3 3" label={{ position: 'right', value: 'Max (29%)', fill: '#EF4444', fontSize: 12 }} />
                                                <Line type="monotone" dataKey="reduction" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Custom Styles for hidden scrollbar but functional */}
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 4px;
                }
            `}</style>
        </div>
    );
};

export default TrefilaCalculation;
