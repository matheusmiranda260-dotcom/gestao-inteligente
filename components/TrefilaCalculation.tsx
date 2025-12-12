import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ArrowLeftIcon, SaveIcon, CalculatorIcon, AdjustmentsIcon, TrashIcon, BookOpenIcon, CheckCircleIcon, ExclamationIcon, PrinterIcon } from './icons';
import { TrefilaRecipe } from '../types';
import { insertItem, fetchTable, deleteItem } from '../services/supabaseService';
import RingStockManager from './RingStockManager';

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
    const [isLoading, setIsLoading] = useState(false);
    const [showStockManager, setShowStockManager] = useState(false);

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
        setRecipeName(recipe.name);
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

    const handlePrintRecipe = (recipe: TrefilaRecipe, e: React.MouseEvent) => {
        e.stopPropagation();
        handleLoadRecipe(recipe);
        setTimeout(() => {
            window.print();
        }, 600);
    };

    return (
        <div className="fixed inset-0 bg-slate-50 z-[100] overflow-y-auto print:static print:bg-white print:overflow-visible">
            <div className="min-h-screen flex flex-col print:min-h-0 print:block">
                {/* Header - HIDDEN ON PRINT */}
                <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm print:hidden">
                    <div className="flex items-center gap-3 md:gap-4">
                        <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition">
                            <ArrowLeftIcon className="h-5 w-5" />
                        </button>
                        <div>
                            <h1 className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2">
                                <CalculatorIcon className="h-6 w-6 text-blue-600 hidden md:block" />
                                <span className="hidden md:inline">Análise Inteligente de Trefilação</span>
                                <span className="md:hidden">Cálculo Trefila</span>
                            </h1>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowStockManager(true)}
                            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl shadow-sm transition font-bold text-sm"
                        >
                            <AdjustmentsIcon className="h-4 w-4" />
                            <span className="hidden md:inline">Gerenciar Anéis/Fieiras</span>
                            <span className="md:hidden">Anéis</span>
                        </button>
                    </div>
                </div>

                {/* PRINT ONLY HEADER */}
                <div className="hidden print:block p-8 mb-6 bg-white border-b-2 border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-2xl font-bold text-slate-900">Relatório de Trefilação</h1>
                        <div className="text-sm text-slate-500">
                            Gerado em: {new Date().toLocaleDateString()}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm border-t border-slate-200 pt-4">
                        <div>
                            <span className="block text-slate-500 text-xs uppercase font-bold">Receita</span>
                            <span className="font-bold text-slate-800 text-lg">{recipeName || 'Simulação Personalizada'}</span>
                        </div>
                        <div className="text-right">
                            <span className="block text-slate-500 text-xs uppercase font-bold">Parâmetros</span>
                            <span className="text-slate-700">
                                {params.type} • {params.entryDiameter}mm → {params.finalDiameter}mm ({params.passes} passes)
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 max-w-[1920px] w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start print:block print:p-0">

                    {/* Left Panel: Controls & Recipes - HIDDEN ON PRINT */}
                    <div className="lg:col-span-3 space-y-6 print:hidden">

                        {/* Parameters Card */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <AdjustmentsIcon className="h-5 w-5 text-blue-500" />
                                Parâmetros
                            </h2>

                            <div className="space-y-5">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded inline-block mb-2">TIPO DE MATERIAL</label>
                                    <div className="flex bg-slate-100 p-1 rounded-xl">
                                        <button className="flex-1 py-2 rounded-lg bg-white text-blue-700 shadow-sm font-semibold text-sm">K-7 CA 60</button>
                                        <button className="flex-1 py-2 rounded-lg text-slate-500 font-medium text-sm hover:bg-white/50" disabled>Outros</button>
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
                                    Calcular
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
                                    placeholder="Nome..."
                                    value={recipeName}
                                    onChange={e => setRecipeName(e.target.value)}
                                    className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-emerald-500 outline-none"
                                />
                                <button
                                    onClick={handleSaveRecipe}
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg font-semibold text-sm transition"
                                >
                                    Salvar
                                </button>
                            </div>

                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                {isLoading ? (
                                    <p className="text-center text-slate-400 text-sm py-2">Carregando...</p>
                                ) : savedRecipes.length === 0 ? (
                                    <p className="text-center text-slate-400 text-sm py-4 border-2 border-dashed border-slate-100 rounded-xl">
                                        Nenhuma receita.
                                    </p>
                                ) : (
                                    savedRecipes.map(recipe => (
                                        <div key={recipe.id}
                                            onClick={() => handleLoadRecipe(recipe)}
                                            className="group flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition cursor-pointer"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-slate-700 text-sm group-hover:text-blue-700 truncate">{recipe.name}</p>
                                                <p className="text-xs text-slate-500 group-hover:text-blue-500 truncate">
                                                    {recipe.entryDiameter}mm → {recipe.finalDiameter}mm
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => handlePrintRecipe(recipe, e)}
                                                    className="p-1.5 hover:bg-blue-100 text-slate-400 hover:text-blue-600 rounded-lg transition"
                                                    title="Imprimir Relatório"
                                                >
                                                    <PrinterIcon className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeleteRecipe(recipe.id, e)}
                                                    className="p-1.5 hover:bg-red-100 text-slate-400 hover:text-red-500 rounded-lg transition"
                                                    title="Excluir Receita"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                    </div>

                    {/* Right Panel: Results Visualization - Single View - FULL WIDTH ON PRINT */}
                    <div className="lg:col-span-9 space-y-6 print:col-span-12 print:w-full">
                        {results.length === 0 ? (
                            <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-slate-400 min-h-[400px]">
                                <CalculatorIcon className="h-20 w-20 mb-4 opacity-10" />
                                <h3 className="text-xl font-bold text-slate-500 mb-2">Pronto para calcular</h3>
                                <p className="text-slate-400">Insira os parâmetros à esquerda e clique em "Calcular" para ver a análise completa.</p>
                            </div>
                        ) : (
                            <>
                                {/* Section 1: Visual Process Flow */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                                        <AdjustmentsIcon className="h-32 w-32 text-blue-500" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 relative z-10">
                                        <AdjustmentsIcon className="h-5 w-5 text-blue-600" />
                                        Fluxo de Redução
                                    </h3>

                                    <div className="flex flex-col xl:flex-row print:flex-row items-center justify-center py-8 gap-4 xl:gap-0 print:gap-2 relative z-10 overflow-x-auto">
                                        {/* Entry Node */}
                                        <div className="flex flex-col items-center group relative cursor-default">
                                            <div className="w-28 h-28 rounded-full bg-slate-800 text-white flex flex-col items-center justify-center shadow-xl border-4 border-slate-50 ring-4 ring-slate-100 z-20 relative overflow-hidden">
                                                <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900"></div>
                                                <div className="relative z-10 flex flex-col items-center">
                                                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Entrada</span>
                                                    <span className="text-3xl font-black">{params.entryDiameter}</span>
                                                    <span className="text-[10px] text-slate-400">mm</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Process Nodes */}
                                        {results.map((res, i) => (
                                            <React.Fragment key={i}>
                                                {/* Connector */}
                                                <div className="flex flex-col items-center justify-center w-24 xl:w-32 print:w-24 relative h-16 xl:h-auto print:h-auto">
                                                    <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-200 overflow-hidden rounded-full">
                                                        <div className="h-full bg-blue-500/20 w-full animate-pulse"></div>
                                                    </div>
                                                    <div className="relative z-10 bg-white px-3 py-1.5 rounded-xl border border-blue-100 shadow-sm flex flex-col items-center min-w-[80px]">
                                                        <span className={`text-sm font-bold ${res.reduction > 29 ? 'text-red-500' : 'text-blue-600'}`}>
                                                            -{res.reduction.toFixed(1)}%
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Redução</span>
                                                    </div>
                                                </div>

                                                {/* Machine Node */}
                                                <div className="flex flex-col items-center relative group">
                                                    <div className={`w-28 h-28 rounded-3xl flex flex-col items-center justify-center shadow-lg border-4 transition-all duration-300 z-20 relative bg-white
                                                        ${res.status === 'Alta'
                                                            ? 'border-red-100 ring-4 ring-red-50 shadow-red-100'
                                                            : 'border-blue-100 ring-4 ring-blue-50 shadow-blue-100'}`
                                                    }>
                                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Passe {res.pass}</span>
                                                        <span className={`text-3xl font-black ${res.status === 'Alta' ? 'text-red-600' : 'text-slate-700'}`}>
                                                            {res.diameter.toFixed(2)}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400">mm</span>

                                                        {res.status === 'Alta' && (
                                                            <div className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1.5 shadow-lg animate-bounce">
                                                                <ExclamationIcon className="h-4 w-4" />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Ring Input Display */}
                                                    <div className="absolute -bottom-10 bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 flex items-center gap-2 border border-slate-200">
                                                        <span className="opacity-50">Anel:</span>
                                                        <span className="text-blue-700 font-bold">{passRings[i]?.output || '-'}</span>
                                                    </div>
                                                </div>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>

                                {/* Section 2: Reduction Chart */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                        <CalculatorIcon className="h-5 w-5 text-purple-600" />
                                        Performance de Redução (% de Área)
                                    </h3>
                                    <div className="h-[350px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={results} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorReduction" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1} />
                                                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                <XAxis dataKey="pass" tickLine={false} axisLine={false} tick={{ fill: '#64748B' }} label={{ value: 'Passe (Máquina)', position: 'insideBottom', offset: -5, fill: '#94a3b8' }} />
                                                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748B' }} domain={[0, 45]} />
                                                <Tooltip
                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', padding: '12px' }}
                                                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                                                />
                                                <ReferenceLine y={29} stroke="#EF4444" strokeDasharray="3 3" label={{ position: 'right', value: 'Limite Segurança (29%)', fill: '#EF4444', fontSize: 12 }} />
                                                <Line
                                                    type="monotone"
                                                    dataKey="reduction"
                                                    stroke="#3B82F6"
                                                    strokeWidth={3}
                                                    dot={{ r: 6, fill: '#3B82F6', strokeWidth: 3, stroke: '#fff' }}
                                                    activeDot={{ r: 8, stroke: '#3B82F6', strokeWidth: 4, fill: '#fff' }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Section 3: Detailed Table */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                            <BookOpenIcon className="h-5 w-5 text-emerald-600" />
                                            Dados Técnicos
                                        </h3>
                                        <div className="text-xs text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                                            Edite os diâmetros abaixo para simular
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                                        <table className="w-full text-sm text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50/80 border-b border-slate-200">
                                                    <th className="px-6 py-4 font-bold text-slate-600">PASSE</th>
                                                    <th className="px-6 py-4 font-bold text-slate-600 bg-blue-50/30 border-l border-blue-100">ANEL ENTRADA</th>
                                                    <th className="px-6 py-4 font-bold text-slate-600 bg-blue-50/30 border-r border-blue-100">ANEL SAÍDA</th>
                                                    <th className="px-6 py-4 font-bold text-slate-600">DIÂMETRO (mm)</th>
                                                    <th className="px-6 py-4 font-bold text-slate-600">REDUÇÃO (%)</th>
                                                    <th className="px-6 py-4 font-bold text-slate-600">STATUS</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {results.map((res, i) => (
                                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-4 font-bold text-slate-800">#{res.pass}</td>
                                                        <td className="px-6 py-4 bg-blue-50/10 border-l border-slate-100">
                                                            <input type="text"
                                                                className="w-full bg-transparent border-b border-dashed border-slate-300 focus:border-blue-600 outline-none text-center transition-colors"
                                                                placeholder="-"
                                                                value={passRings[i]?.entry}
                                                                onChange={e => handleRingChange(i, 'entry', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="px-6 py-4 bg-blue-50/10 border-r border-slate-100">
                                                            <input type="text"
                                                                className="w-full bg-transparent border-b border-dashed border-slate-300 focus:border-blue-600 outline-none text-center text-blue-700 font-bold transition-colors"
                                                                placeholder="-"
                                                                value={passRings[i]?.output}
                                                                onChange={e => handleRingChange(i, 'output', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <input type="number" step="0.01"
                                                                    className="w-24 bg-slate-100 hover:bg-white focus:bg-white border border-transparent focus:border-blue-300 rounded px-3 py-1.5 text-center font-bold text-slate-700 focus:ring-2 ring-blue-100 outline-none transition-all"
                                                                    value={passDiameters[i]}
                                                                    onChange={e => handleDiameterChange(i, e.target.value)}
                                                                />
                                                                <span className="text-xs text-slate-400">mm</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`font-mono font-bold ${res.reduction > 29 ? 'text-red-600' : 'text-slate-600'}`}>
                                                                {res.reduction.toFixed(2)}%
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {res.status === 'Ok'
                                                                ? <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200"><CheckCircleIcon className="h-3.5 w-3.5" /> Ideal</span>
                                                                : <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold border border-red-200 animate-pulse"><ExclamationIcon className="h-3.5 w-3.5" /> Crítico</span>
                                                            }
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {showStockManager && <RingStockManager onClose={() => setShowStockManager(false)} />}

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
                 @media print {
                     body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                 }
            `}</style>
        </div>
    );
};

export default TrefilaCalculation;
