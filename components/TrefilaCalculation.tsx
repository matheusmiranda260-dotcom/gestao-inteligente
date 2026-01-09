import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, AreaChart, Area } from 'recharts';
import { ArrowLeftIcon, SaveIcon, CalculatorIcon, AdjustmentsIcon, TrashIcon, BookOpenIcon, CheckCircleIcon, ExclamationIcon, PrinterIcon, SearchIcon, PlusIcon, ChevronRightIcon } from './icons';
import { TrefilaRecipe, TrefilaRingStock } from '../types';
import { insertItem, fetchTable, deleteItem } from '../services/supabaseService';
import RingStockManager from './RingStockManager';

interface TrefilaCalculationProps {
    onClose: () => void;
    machineType?: MachineType;
    activeOrder?: ProductionOrderData;
}

interface PassResult {
    pass: number;
    diameter: number;
    reduction: number; // Percentage
    status: 'Alta' | 'Ok' | 'Baixa';
}

const RING_DEFS = [
    // Output (Not Last) - CA & RT
    { name: 'CA 3,55', min: 3.5, max: 3.99, dest: 'output', cond: 'not_last' }, // Extended to cover gap up to 4.00
    { name: 'CA 4,60', min: 4.55, max: 4.70, dest: 'output', cond: 'not_last' },
    { name: 'CA 5,50', min: 5.45, max: 5.60, dest: 'output', cond: 'not_last' },
    { name: 'RT 0', min: 4.00, max: 4.99, dest: 'output', cond: 'not_last' },
    { name: 'RT 2', min: 6.00, max: 6.99, dest: 'output', cond: 'not_last' },
    { name: 'RT 3', min: 7.00, max: 7.99, dest: 'output', cond: 'not_last' },

    // Output (Last) - PR
    { name: 'PR 3,20', min: 3.15, max: 3.30, dest: 'output', cond: 'last' },
    { name: 'PR 3,40', min: 3.35, max: 3.50, dest: 'output', cond: 'last' },
    { name: 'PR 3,70', min: 3.65, max: 3.80, dest: 'output', cond: 'last' },
    { name: 'PR 3,80', min: 3.75, max: 3.90, dest: 'output', cond: 'last' },
    { name: 'PR 4,10', min: 4.05, max: 4.20, dest: 'output', cond: 'last' },
    { name: 'PR 4,20', min: 4.15, max: 4.30, dest: 'output', cond: 'last' },
    { name: 'PR 4,40', min: 4.35, max: 4.94, dest: 'output', cond: 'last' }, // Extended heavily to cover gap up to 4.95
    { name: 'PR 5,00', min: 4.95, max: 5.10, dest: 'output', cond: 'last' },
    { name: 'PR 5,50', min: 5.45, max: 5.60, dest: 'output', cond: 'last' },
    { name: 'PR 5,60', min: 5.55, max: 5.70, dest: 'output', cond: 'last' },
    { name: 'PR 5,80', min: 5.75, max: 5.90, dest: 'output', cond: 'last' },
    { name: 'PR 6,00', min: 5.95, max: 6.10, dest: 'output', cond: 'last' },

    // Entry (Not Last) - RO
    { name: 'RO 0', min: 4.00, max: 4.99, dest: 'entry', cond: 'not_last' },
    { name: 'RO 1', min: 5.00, max: 5.99, dest: 'entry', cond: 'not_last' },
    { name: 'RO 2', min: 6.00, max: 6.99, dest: 'entry', cond: 'not_last' },
    { name: 'RO 3', min: 7.00, max: 7.99, dest: 'entry', cond: 'not_last' },

    // Entry (Last) - ROA
    { name: 'ROA 0', min: 3.49, max: 4.59, dest: 'entry', cond: 'last' }, // Extended to meet ROA 1
    { name: 'ROA 1', min: 4.60, max: 5.56, dest: 'entry', cond: 'last' },
    { name: 'ROA 2', min: 5.60, max: 6.00, dest: 'entry', cond: 'last' },
];

const TrefilaCalculation: React.FC<TrefilaCalculationProps> = ({ onClose, machineType, activeOrder }) => {
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

    // Recipe & Stock State
    const [recipeName, setRecipeName] = useState('');
    const [savedRecipes, setSavedRecipes] = useState<TrefilaRecipe[]>([]);
    const [ringStock, setRingStock] = useState<TrefilaRingStock[]>([]);

    // Fetch Recipes & Stock on Mount
    useEffect(() => {
        loadData();
    }, []);

    // Refresh stock when manager closes
    useEffect(() => {
        if (!showStockManager) loadData();
    }, [showStockManager]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [recipes, rings] = await Promise.all([
                fetchTable<TrefilaRecipe>('trefila_recipes'),
                fetchTable<TrefilaRingStock>('trefila_rings_stock')
            ]);
            console.log('Dados carregados:', { recipes: recipes?.length, rings: rings?.length });
            setSavedRecipes(recipes || []);
            setRingStock(rings || []);
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Sequential Stock Calculation
    const stockValidation = React.useMemo(() => {
        // Clone initial stock to a working map: { 'normalized_model': quantity }
        const normalize = (s: string) => s ? s.toString().toLowerCase().replace(',', '.').replace(/[\s\-\_]+/g, '').trim() : '';
        const stockMap: Record<string, number> = {};

        if (Array.isArray(ringStock)) {
            ringStock.forEach(r => {
                if (r?.model) {
                    const key = normalize(r.model);
                    stockMap[key] = (stockMap[key] || 0) + (parseInt(String(r.quantity), 10) || 0);
                }
            });
        }

        const multiplier = params.type.includes('K-7') ? 3 : 1;

        // Calculate status for each pass
        return passRings.map(pass => {
            const processRing = (ringName: string) => {
                if (!ringName || ringName === '-') return { status: 'ok' as const, available: 0, required: 0, remainingAfter: 0 };

                const key = normalize(ringName);
                const required = multiplier;
                const availableAtStart = stockMap[key] || 0;

                let status: 'ok' | 'missing' = 'ok';
                if (availableAtStart >= required) {
                    stockMap[key] = availableAtStart - required;
                } else {
                    status = 'missing';
                    // If we don't have enough, we assume we use what we can (conceptually) or just fail.
                    // For visualization, we just show what was available.
                    // stockMap[key] = 0; // Consumption logic: if missing, do we consume rest? Let's say yes.
                }

                return {
                    status,
                    available: availableAtStart,
                    required
                };
            };

            return {
                entry: processRing(pass?.entry),
                output: processRing(pass?.output)
            };
        });
    }, [passRings, ringStock, params.type]);

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

        // Auto-suggest Rings using Best Fit Logic
        const newRings = currentResult.diameters.map((dOutput, index) => {
            const isLast = index === n - 1;
            const dEntry = index === 0 ? dIn : currentResult.diameters[index - 1];

            const getBestRing = (diameter: number, dest: string, cond: string) => {
                const candidates = RING_DEFS.filter(r => r.dest === dest && r.cond === cond);
                const normalize = (s: string) => s ? s.toString().toLowerCase().replace(',', '.').replace(/[\s\-\_]+/g, '').trim() : '';

                // Helper to check if a ring model has ANY stock (simple check)
                const hasStock = (modelName: string) => {
                    if (!ringStock || ringStock.length === 0) return false;
                    const target = normalize(modelName);
                    return ringStock.some(r => r.model && normalize(r.model) === target && r.quantity > 0);
                };

                // Score candidates: Prioritize Stock first, but contained within a reasonable proximity.
                const scored = candidates.map(r => {
                    let dist = 0;
                    if (diameter < r.min) dist = r.min - diameter;      // Too small for ring
                    else if (diameter > r.max) dist = diameter - r.max; // Too big for ring

                    // Specific logic: Entry rings (RO) act as guides. A guide slightly larger is better than one smaller (jamming).
                    let physicalClash = false;
                    if (dest === 'entry' && diameter > r.max) physicalClash = true;

                    const stock = hasStock(r.name);

                    return { ...r, dist, stock, physicalClash };
                });

                // Filter out impossible matches (Physical clash) unless no other option
                const possible = scored.filter(x => !x.physicalClash || x.dist < 0.1);
                const pool = possible.length > 0 ? possible : scored;

                pool.sort((a, b) => {
                    // 1. Prioritize Stock (if distance is reasonable, e.g. < 1.0mm)
                    if (a.stock !== b.stock) {
                        // If A has stock and is reasonably close, prefer it
                        if (a.stock && a.dist < 1.0) return -1;
                        if (b.stock && b.dist < 1.0) return 1;
                    }

                    // 2. Prioritize Distance (Closer is better)
                    if (Math.abs(a.dist - b.dist) > 0.05) {
                        return a.dist - b.dist;
                    }

                    // 3. Prioritize Exact Range (Inside is better than Outside)
                    const aIn = diameter >= a.min && diameter <= a.max;
                    const bIn = diameter >= b.min && diameter <= b.max;
                    if (aIn && !bIn) return -1;
                    if (!aIn && bIn) return 1;

                    return 0;
                });

                if (pool.length === 0) return '-';
                return pool[0].name;
            };

            const entryRing = getBestRing(dEntry, 'entry', isLast ? 'last' : 'not_last');
            const outputRing = getBestRing(dOutput, 'output', isLast ? 'last' : 'not_last');

            return { entry: entryRing, output: outputRing };
        });

        setPassRings(newRings);
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

        const originalTitle = document.title;
        document.title = ' '; // Clear title to prevent browser print header

        setTimeout(() => {
            window.print();
            document.title = originalTitle;
        }, 600);
    };

    return (
        <div id="trefila-print-root" className="fixed inset-0 bg-slate-50 z-[100] overflow-y-auto print:static print:bg-white print:overflow-visible">
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
                        {!activeOrder && (
                            <button
                                onClick={() => setShowStockManager(true)}
                                className="flex items-center gap-2 px-3 md:px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl shadow-sm transition font-bold text-sm"
                            >
                                <AdjustmentsIcon className="h-4 w-4" />
                                <span className="hidden md:inline">Gerenciar Anéis/Fieiras</span>
                                <span className="md:hidden">Anéis</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* PRINT ONLY HEADER */}
                <div className="hidden print:block p-8 mb-6 bg-white border-b-2 border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-2xl font-bold text-slate-900">Relatório de Trefilação</h1>
                        <div className="text-sm text-slate-500">
                            DATA: {new Date().toLocaleDateString()}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm border-t border-slate-200 pt-4">
                        <div>
                            <span className="block text-slate-500 text-xs uppercase font-bold">Receita</span>
                            <span className="font-bold text-slate-800 text-lg">{recipeName || 'Personalizada'}</span>
                        </div>
                        <div className="text-right">
                            <span className="block text-slate-500 text-xs uppercase font-bold">Parâmetros</span>
                            <span className="text-slate-700">
                                {params.type} • {params.entryDiameter}mm → {params.finalDiameter}mm ({params.passes} passes)
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 max-w-[1920px] w-full mx-auto p-4 md:p-6 flex flex-col items-start print:block print:p-0">

                    {/* Top Header: Parameters & Recipes */}
                    <div className="w-full bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6 print:hidden flex flex-col xl:flex-row items-center justify-between gap-6">

                        {/* Left: Calculation Parameters */}
                        <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">

                            {/* Material Type */}
                            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                                <span className="text-[10px] font-bold text-slate-400 px-2">MATERIAL</span>
                                <div className="flex">
                                    <button className="px-3 py-1.5 rounded-lg bg-white text-blue-700 shadow-sm font-bold text-xs">K-7 CA 60</button>
                                </div>
                            </div>

                            <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

                            {/* Inputs Group */}
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col">
                                    <label className="text-[10px] font-bold text-slate-400 mb-0.5">ENTRADA</label>
                                    <select
                                        value={params.entryDiameter}
                                        onChange={e => setParams({ ...params, entryDiameter: e.target.value })}
                                        className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-lg p-2 outline-none focus:border-blue-500 w-24"
                                    >
                                        <option value="8.00">8.00 mm</option>
                                        <option value="7.00">7.00 mm</option>
                                        <option value="6.50">6.50 mm</option>
                                        <option value="6.35">6.35 mm</option>
                                        <option value="5.50">5.50 mm</option>
                                    </select>
                                </div>

                                <div className="text-slate-300">→</div>

                                <div className="flex flex-col">
                                    <label className="text-[10px] font-bold text-slate-400 mb-0.5">SAÍDA</label>
                                    <input
                                        type="number" step="0.01"
                                        value={params.finalDiameter}
                                        onChange={e => setParams({ ...params, finalDiameter: e.target.value })}
                                        className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-lg p-2 outline-none focus:border-blue-500 w-24"
                                    />
                                </div>
                            </div>

                            <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

                            {/* Passes & Calc */}
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col w-32">
                                    <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-0.5">
                                        <span>PASSES</span>
                                        <span className="text-blue-600">{params.passes}</span>
                                    </div>
                                    <input
                                        type="range" min="1" max="4" step="1"
                                        value={params.passes}
                                        onChange={e => setParams({ ...params, passes: e.target.value })}
                                        className="h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                </div>

                                <button
                                    onClick={calculateDistribution}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.95] flex items-center gap-2"
                                >
                                    <CalculatorIcon className="h-5 w-5" />
                                    <span>Calcular</span>
                                </button>
                            </div>
                        </div>

                        {/* Right: Recipes (Compact) */}
                        <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto border-t xl:border-t-0 xl:border-l border-slate-100 pt-4 xl:pt-0 xl:pl-6">
                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <div className="relative flex-1 md:w-48">
                                    <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Nome da receita..."
                                        value={recipeName}
                                        onChange={e => setRecipeName(e.target.value)}
                                        className="w-full pl-8 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-emerald-500 outline-none"
                                    />
                                </div>
                                <button
                                    onClick={handleSaveRecipe}
                                    disabled={!recipeName}
                                    className="bg-emerald-500 disabled:opacity-50 hover:bg-emerald-600 text-white p-2 rounded-lg font-bold transition shadow-sm"
                                    title="Salvar Receita"
                                >
                                    <PlusIcon className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Saved Recipes Dropdown */}
                            <div className="relative group z-40">
                                <button className="flex items-center gap-2 text-slate-600 hover:text-blue-600 font-medium text-sm bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
                                    <span>{savedRecipes.length} Salvas</span>
                                    <ChevronRightIcon className="h-4 w-4 rotate-90 group-hover:rotate-0 transition-transform" />
                                </button>

                                {/* Dropdown */}
                                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-100 hidden group-hover:block p-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                                    {savedRecipes.length === 0 ? (
                                        <p className="text-center text-xs text-slate-400 py-4">Nenhuma receita salva.</p>
                                    ) : (
                                        savedRecipes.map(r => (
                                            <div key={r.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg cursor-pointer group/item" onClick={() => handleLoadRecipe(r)}>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-slate-700 truncate">{r.name}</p>
                                                    <p className="text-[10px] text-slate-400">{r.entryDiameter} → {r.finalDiameter}</p>
                                                </div>
                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteRecipe(r.id, e); }} className="text-slate-300 hover:text-red-500 p-1"><TrashIcon className="h-4 w-4" /></button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Hiding the old sidebar content completely by removing it or wrapping it in hidden/comment */}
                    {/* The following div was the sidebar container, now effectively replaced by the content above and ensuring old code is removed */}
                    <div className="hidden">

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
                                <div className="text-center mt-2 text-xs text-slate-400">
                                    Status do Estoque: {ringStock.length} itens carregados.
                                    {ringStock.length === 0 && <span className="text-red-500 font-bold ml-1"> (Verifique conexão)</span>}
                                </div>

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
                    <div className="w-full space-y-6 print:w-full">
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
                                    <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2 relative z-10">
                                        <AdjustmentsIcon className="h-5 w-5 text-blue-600" />
                                        Fluxo de Redução & Performance
                                    </h3>

                                    {/* Integrated Reduction Chart */}
                                    <div className="h-[120px] w-full mb-4 relative z-10">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={results} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorReduction" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                                                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="pass" hide />
                                                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[0, 45]} />
                                                <Tooltip
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '12px', padding: '8px' }}
                                                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                                                />
                                                <ReferenceLine y={29} stroke="#EF4444" strokeDasharray="3 3" />
                                                <Area type="monotone" dataKey="reduction" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#colorReduction)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>

                                    <div className="flex flex-col xl:flex-row print:flex-row items-center justify-center pt-6 pb-28 gap-1 xl:gap-0 print:gap-2 relative z-10 overflow-x-auto no-scrollbar">
                                        {/* Entry Node */}
                                        <div className="flex flex-col items-center group relative cursor-default px-1 shrink-0">
                                            <div className="w-14 h-14 rounded-full bg-slate-800 text-white flex flex-col items-center justify-center shadow-md border-2 border-slate-50 ring-2 ring-slate-100 z-20 relative overflow-hidden">
                                                <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900"></div>
                                                <div className="relative z-10 flex flex-col items-center">
                                                    <span className="text-[8px] font-semibold text-slate-300 uppercase tracking-wider mb-0">Entrada</span>
                                                    <span className="text-base font-black leading-none">{params.entryDiameter}</span>
                                                    <span className="text-[8px] text-slate-400">mm</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Process Nodes */}
                                        {results.map((res, i) => (
                                            <React.Fragment key={i}>
                                                {/* Connector */}
                                                <div className="flex flex-col items-center justify-center w-24 xl:w-32 print:w-16 relative h-8 xl:h-auto print:h-auto shrink-0">
                                                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 overflow-hidden rounded-full">
                                                        <div className="h-full bg-blue-500/20 w-full animate-pulse"></div>
                                                    </div>
                                                    <div className="relative z-10 bg-white px-1.5 py-0.5 rounded-lg border border-blue-100 shadow-sm flex flex-col items-center min-w-[45px]">
                                                        <span className={`text-sm font-bold ${res.reduction > 29 ? 'text-red-500' : 'text-blue-600'}`}>
                                                            -{res.reduction.toFixed(1)}%
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Redução</span>
                                                    </div>
                                                </div>

                                                {/* Machine Node */}
                                                <div className="flex flex-col items-center relative group px-1 shrink-0">
                                                    <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center shadow-md border-2 transition-all duration-300 z-20 relative bg-white
                                                        ${res.status === 'Alta'
                                                            ? 'border-red-100 ring-2 ring-red-50 shadow-red-100'
                                                            : 'border-blue-100 ring-2 ring-blue-50 shadow-blue-100'}`
                                                    }>
                                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0">Passe {res.pass}</span>
                                                        <span className={`text-base font-black leading-none ${res.status === 'Alta' ? 'text-red-600' : 'text-slate-700'}`}>
                                                            {res.diameter.toFixed(2)}
                                                        </span>
                                                        <span className="text-[8px] text-slate-400">mm</span>

                                                        {res.status === 'Alta' && (
                                                            <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg animate-bounce">
                                                                <ExclamationIcon className="h-3 w-3" />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Ring Input Display */}
                                                    <div className="absolute left-1/2 -translate-x-1/2 w-[160px] bg-slate-50 p-1.5 rounded-lg text-[10px] font-medium text-slate-600 border border-slate-200 shadow-sm flex flex-col gap-0.5 z-30 -bottom-24">
                                                        {(() => {
                                                            const entryRing = passRings[i]?.entry;
                                                            const outputRing = passRings[i]?.output;
                                                            // Use sequential validation
                                                            const entryStatus = stockValidation[i]?.entry || { status: 'ok', available: 0, required: 0 };
                                                            const outputStatus = stockValidation[i]?.output || { status: 'ok', available: 0, required: 0 };

                                                            const isEntryOk = entryRing && entryRing !== '-' && entryStatus.status === 'ok';
                                                            const isOutputOk = outputRing && outputRing !== '-' && outputStatus.status === 'ok';

                                                            return (
                                                                <>
                                                                    <div
                                                                        className={`flex flex-col px-1.5 py-0.5 rounded border ${!entryRing || entryRing === '-'
                                                                            ? 'border-transparent text-slate-500'
                                                                            : entryStatus.status === 'missing'
                                                                                ? 'bg-red-50 text-red-700 border-red-100'
                                                                                : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                                            }`}>
                                                                        <div className="flex justify-between items-center w-full">
                                                                            <span className="opacity-75 mr-1 text-[9px]">Ent:</span>
                                                                            <span className="font-bold">{params.type.includes('K-7') && entryRing && entryRing !== '-' ? '3x ' : ''}{entryRing || '-'}</span>
                                                                            {entryStatus.status === 'missing' && entryRing && entryRing !== '-' && <ExclamationIcon className="h-3 w-3 ml-1 text-red-500" />}
                                                                            {entryStatus.status === 'ok' && entryRing && entryRing !== '-' && <CheckCircleIcon className="h-3 w-3 ml-1 text-emerald-500" />}
                                                                        </div>
                                                                        {entryStatus.status === 'missing' && entryRing && entryRing !== '-' && (
                                                                            <span className="text-[8px] font-medium text-right w-full opacity-80 leading-none mt-0.5">
                                                                                Est: {entryStatus.available} / Req: {entryStatus.required}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div
                                                                        className={`flex flex-col px-1.5 py-0.5 rounded border ${!outputRing || outputRing === '-'
                                                                            ? 'border-transparent text-slate-500'
                                                                            : outputStatus.status === 'missing'
                                                                                ? 'bg-red-50 text-red-700 border-red-100'
                                                                                : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                                            }`}>
                                                                        <div className="flex justify-between items-center w-full">
                                                                            <span className="opacity-75 mr-1 text-[9px]">Sai:</span>
                                                                            <span className="font-bold">{params.type.includes('K-7') && outputRing && outputRing !== '-' ? '3x ' : ''}{outputRing || '-'}</span>
                                                                            {outputStatus.status === 'missing' && outputRing && outputRing !== '-' && <ExclamationIcon className="h-3 w-3 ml-1 text-red-500" />}
                                                                            {outputStatus.status === 'ok' && outputRing && outputRing !== '-' && <CheckCircleIcon className="h-3 w-3 ml-1 text-emerald-500" />}
                                                                        </div>
                                                                        {outputStatus.status === 'missing' && outputRing && outputRing !== '-' && (
                                                                            <span className="text-[8px] font-medium text-right w-full opacity-80 leading-none mt-0.5">
                                                                                Est: {outputStatus.available} / Req: {outputStatus.required}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </React.Fragment>
                                        ))}
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
                                        <table className="w-full text-xs text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50/80 border-b border-slate-200">
                                                    <th className="px-2 py-1.5 font-bold text-slate-600">PASSE</th>
                                                    <th className="px-2 py-1.5 font-bold text-slate-600 bg-blue-50/30 border-l border-blue-100">ANEL ENTRADA</th>
                                                    <th className="px-2 py-1.5 font-bold text-slate-600 bg-blue-50/30 border-r border-blue-100">ANEL SAÍDA</th>
                                                    <th className="px-2 py-1.5 font-bold text-slate-600">DIÂMETRO (mm)</th>
                                                    <th className="px-2 py-1.5 font-bold text-slate-600">REDUÇÃO (%)</th>
                                                    <th className="px-2 py-1.5 font-bold text-slate-600">STATUS</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {results.map((res, i) => (
                                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-2 py-1.5 font-bold text-slate-800">#{res.pass}</td>
                                                        <td className="px-2 py-1.5 bg-blue-50/10 border-l border-slate-100">
                                                            <input type="text"
                                                                className={`w-full bg-transparent border-b border-dashed outline-none text-center transition-colors ${stockValidation[i]?.entry?.status === 'missing'
                                                                    ? 'border-red-400 text-red-600 font-bold bg-red-50'
                                                                    : (passRings[i]?.entry && passRings[i]?.entry !== '-' ? 'border-emerald-400 text-emerald-600 font-bold bg-emerald-50' : 'border-slate-300 focus:border-blue-600')
                                                                    }`}
                                                                placeholder="-"
                                                                value={passRings[i]?.entry}
                                                                onChange={e => handleRingChange(i, 'entry', e.target.value)}
                                                            />
                                                            {(() => {
                                                                const s = stockValidation[i]?.entry;
                                                                if (!s) return null;
                                                                const balance = s.available - s.required;

                                                                if (!passRings[i]?.entry || passRings[i]?.entry === '-') return null;

                                                                if (balance < 0) return (
                                                                    <div className="text-[10px] text-red-600 font-bold text-center mt-1">
                                                                        Falta {Math.abs(balance)} (Disp: {s.available} / Req: {s.required})
                                                                    </div>
                                                                );
                                                                if (balance === 0) return (
                                                                    <div className="text-[10px] text-emerald-600 font-bold text-center mt-1">
                                                                        Conta Exata (Disp: {s.available})
                                                                    </div>
                                                                );
                                                                return (
                                                                    <div className="text-[10px] text-blue-600 font-bold text-center mt-1">
                                                                        Sobram {balance} (Disp: {s.available})
                                                                    </div>
                                                                );
                                                            })()}
                                                        </td>
                                                        <td className="px-2 py-1.5 bg-blue-50/10 border-r border-slate-100">
                                                            <input type="text"
                                                                className={`w-full bg-transparent border-b border-dashed outline-none text-center font-bold transition-colors ${stockValidation[i]?.output?.status === 'missing'
                                                                    ? 'border-red-400 text-red-600 bg-red-50'
                                                                    : (passRings[i]?.output && passRings[i]?.output !== '-' ? 'border-emerald-400 text-emerald-600 bg-emerald-50' : 'border-slate-300 focus:border-blue-600 text-blue-700')
                                                                    }`}
                                                                placeholder="-"
                                                                value={passRings[i]?.output}
                                                                onChange={e => handleRingChange(i, 'output', e.target.value)}
                                                            />
                                                            {(() => {
                                                                const s = stockValidation[i]?.output;
                                                                if (!s) return null;
                                                                const balance = s.available - s.required;

                                                                if (!passRings[i]?.output || passRings[i]?.output === '-') return null;

                                                                if (balance < 0) return (
                                                                    <div className="text-[10px] text-red-600 font-bold text-center mt-1">
                                                                        Falta {Math.abs(balance)} (Disp: {s.available} / Req: {s.required})
                                                                    </div>
                                                                );
                                                                if (balance === 0) return (
                                                                    <div className="text-[10px] text-emerald-600 font-bold text-center mt-1">
                                                                        Conta Exata (Disp: {s.available})
                                                                    </div>
                                                                );
                                                                return (
                                                                    <div className="text-[10px] text-blue-600 font-bold text-center mt-1">
                                                                        Sobram {balance} (Disp: {s.available})
                                                                    </div>
                                                                );
                                                            })()}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <div className="flex items-center gap-1">
                                                                <input type="number" step="0.01"
                                                                    className="w-20 bg-slate-100 hover:bg-white focus:bg-white border border-transparent focus:border-blue-300 rounded px-2 py-1 text-center font-bold text-slate-700 focus:ring-2 ring-blue-100 outline-none transition-all"
                                                                    value={passDiameters[i]}
                                                                    onChange={e => handleDiameterChange(i, e.target.value)}
                                                                />
                                                                <span className="text-[10px] text-slate-400">mm</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <span className={`font-mono font-bold ${res.reduction > 29 ? 'text-red-600' : 'text-slate-600'}`}>
                                                                {res.reduction.toFixed(2)}%
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            {res.status === 'Ok'
                                                                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold border border-emerald-200"><CheckCircleIcon className="h-3 w-3" /> Ideal</span>
                                                                : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold border border-red-200 animate-pulse"><ExclamationIcon className="h-3 w-3" /> Crítico</span>
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
                     body * {
                         visibility: hidden;
                     }
                     #trefila-print-root, #trefila-print-root * {
                         visibility: visible;
                     }
                     #trefila-print-root {
                         position: absolute;
                         left: 0;
                         top: 0;
                         width: 100%;
                         margin: 0;
                         padding: 0;
                     }
                     body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                 }
            `}</style>
        </div>
    );
};

export default TrefilaCalculation;
