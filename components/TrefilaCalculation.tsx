import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ArrowLeftIcon, SaveIcon, CalculatorIcon, AdjustmentsIcon } from './icons';

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
    const [params, setParams] = useState({
        type: 'K-7 CA 60' as 'K-7 CA 60' | 'FIEIRAS BTC',
        entryDiameter: '5.5',
        finalDiameter: '3.2',
        passes: '4'
    });

    const [results, setResults] = useState<PassResult[]>([]);
    const [recipeName, setRecipeName] = useState('');

    // State to hold the current diameters for manual editing
    const [passDiameters, setPassDiameters] = useState<number[]>([]);

    const calculateDistribution = () => {
        const dIn = parseFloat(params.entryDiameter.replace(',', '.'));
        const dOut = parseFloat(params.finalDiameter.replace(',', '.'));
        let n = parseInt(params.passes);

        // Validation for Max 4 Passes
        if (n > 4) {
            alert('O número máximo de passes é 4.');
            n = 4;
            setParams(prev => ({ ...prev, passes: '4' }));
        }

        if (isNaN(dIn) || isNaN(dOut) || isNaN(n) || n <= 0) {
            alert('Por favor, verifique os parâmetros.');
            return;
        }

        // Auto-Calculation Logic (Initial Suggestion)
        // Strategy: Force Last Pass ~19%. Distribute rest evenly.

        const dFinal = dOut;
        // Last pass reduction 19% target
        // A_out = A_beforeLast * (1 - 0.19) => A_beforeLast = A_out / 0.81
        // D_beforeLast = D_out / sqrt(0.81) = D_out / 0.9
        const dBeforeLast = dFinal / 0.9;

        const calculatedDiameters: number[] = [];

        if (n === 1) {
            calculatedDiameters.push(dOut);
        } else {
            // We need to go from dIn to dBeforeLast in (n-1) passes
            // Constant reduction for first n-1 passes for simplicity as a starting point
            // r_rest = 1 - (dBeforeLast / dIn)^(2/(n-1))
            const r_rest = 1 - Math.pow(dBeforeLast / dIn, 2 / (n - 1));

            let currentD = dIn;
            // Generate n-1 intermediate diameters
            for (let i = 1; i < n; i++) {
                const prevD = currentD;
                const prevArea = Math.PI * Math.pow(prevD / 2, 2);
                const nextArea = prevArea * (1 - r_rest);
                currentD = 2 * Math.sqrt(nextArea / Math.PI);
                calculatedDiameters.push(parseFloat(currentD.toFixed(2)));
            }
            // Add final diameter
            calculatedDiameters.push(dOut);
        }

        setPassDiameters(calculatedDiameters);
        updateResults(calculatedDiameters);
    };

    const updateResults = (diameters: number[]) => {
        const dIn = parseFloat(params.entryDiameter.replace(',', '.'));
        const newResults: PassResult[] = [];

        diameters.forEach((d, index) => {
            const prevD = index === 0 ? dIn : diameters[index - 1];
            const currentD = d;

            const prevArea = Math.PI * Math.pow(prevD / 2, 2);
            const currentArea = Math.PI * Math.pow(currentD / 2, 2);

            // Avoid division by zero
            const reduction = prevArea > 0 ? ((prevArea - currentArea) / prevArea) * 100 : 0;

            const passNumber = index + 1;
            const isLastPass = passNumber === diameters.length;
            const isFirstPass = passNumber === 1;

            let status: 'Alta' | 'Ok' | 'Baixa' = 'Ok';

            // Validation Logic:
            // 1. First Pass Max 29%
            if (isFirstPass && reduction > 29.0) status = 'Alta';
            // 2. Last Pass Max 19%
            else if (isLastPass && reduction > 19.0) status = 'Alta';
            // General safety for intermediate passes (using 29% as a safe upper bound guideline for now)
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

    const handleSave = () => {
        if (!recipeName) return alert('Digite um nome para a receita.');
        // TODO: Implement save logic
        alert(`Receita "${recipeName}" salva com sucesso! (Simulação)`);
    };

    return (
        <div className="fixed inset-0 bg-slate-100 z-50 overflow-y-auto">
            <div className="max-w-7xl mx-auto p-4 md:p-8">
                <header className="flex items-center justify-between mb-8">
                    <div className="flex items-center">
                        <button onClick={onClose} className="mr-4 p-2 rounded-full bg-white shadow-sm hover:bg-slate-50 text-slate-700 transition">
                            <ArrowLeftIcon className="h-6 w-6" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-red-600 flex items-center gap-2">
                                <CalculatorIcon className="h-8 w-8" />
                                Cálculo de Trefilação
                            </h1>
                            <p className="text-slate-500">Otimização de passes e controle de área de redução</p>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Parameters */}
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm">
                            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <AdjustmentsIcon className="h-5 w-5 text-amber-500" />
                                Parâmetros
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Trefilação</label>
                                    <div className="flex p-1 bg-slate-100 rounded-lg">
                                        <button
                                            onClick={() => setParams({ ...params, type: 'K-7 CA 60' })}
                                            className={`flex-1 py-1 px-3 rounded-md text-sm font-medium transition ${params.type === 'K-7 CA 60' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            K-7 CA 60
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Diâmetro de Entrada (mm)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={params.entryDiameter}
                                        onChange={e => setParams({ ...params, entryDiameter: e.target.value })}
                                        className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Diâmetro Final (mm)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={params.finalDiameter}
                                        onChange={e => setParams({ ...params, finalDiameter: e.target.value })}
                                        className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Número de Passes (Max 4)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="4"
                                        value={params.passes}
                                        onChange={e => {
                                            const val = parseInt(e.target.value);
                                            if (val > 4) return;
                                            setParams({ ...params, passes: e.target.value })
                                        }}
                                        className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>

                                <button
                                    onClick={calculateDistribution}
                                    className="w-full bg-[#1e293b] text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-800 transition shadow-lg mt-2 flex items-center justify-center gap-2"
                                >
                                    <CalculatorIcon className="h-5 w-5" />
                                    Calcular / Resetar
                                </button>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm">
                            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <SaveIcon className="h-5 w-5 text-emerald-500" />
                                Salvar Receita
                            </h2>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Nome da Receita (Ex: Trefila 5.5 -> 3.2)"
                                    value={recipeName}
                                    onChange={e => setRecipeName(e.target.value)}
                                    className="flex-grow p-2 border border-slate-300 rounded-md text-sm"
                                />
                                <button
                                    onClick={handleSave}
                                    className="bg-emerald-500 text-white font-bold py-2 px-4 rounded-md hover:bg-emerald-600 transition"
                                >
                                    Salvar
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Visualization */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Flow Diagram */}
                        <div className="bg-white p-6 rounded-xl shadow-sm overflow-x-auto">
                            <h2 className="text-lg font-bold text-slate-800 mb-6">FLUXO DE REDUÇÃO</h2>
                            {results.length > 0 ? (
                                <div className="flex items-start min-w-max gap-4">
                                    {/* Entry */}
                                    <div className="relative">
                                        <div className="bg-[#1e293b] text-white p-4 rounded-lg w-24 h-24 flex flex-col items-center justify-center shadow-md z-10 relative">
                                            <span className="text-xs opacity-70 mb-1">Entrada</span>
                                            <span className="text-xl font-bold">{params.entryDiameter}</span>
                                            <span className="text-[10px] opacity-70">mm</span>
                                        </div>
                                    </div>

                                    {/* Passes */}
                                    {results.map((res, index) => (
                                        <div key={res.pass} className="flex items-center">
                                            <div className="h-1 w-8 bg-slate-300 mx-2" />
                                            <div className="relative group">
                                                <div className="bg-white border-2 border-slate-200 text-slate-700 p-3 rounded-lg w-24 h-24 flex flex-col items-center justify-center shadow-sm relative z-10">
                                                    <span className="text-xs text-slate-400 mb-1">Passe {res.pass}</span>
                                                    <span className="text-xl font-bold">{res.diameter.toFixed(2)}</span>
                                                    <span className="text-[10px] text-slate-400">mm</span>

                                                    {/* Trapezoid shape indicative visual could be CSS, but kept simple box for now */}
                                                </div>
                                                <div className="absolute -bottom-8 left-0 right-0 text-center">
                                                    <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded-full border ${res.status === 'Alta' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200'
                                                        }`}>
                                                        {res.reduction.toFixed(1)}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Final Target Visual (Duplicate of last if matches?) 
                                        Actually, the last block in results IS the final block.
                                        But typically Trefila flow shows Entry -> Die 1 -> Die 2 -> ... -> Final Wire
                                        Our results array has the output of each die.
                                        So results[results.length-1] IS the final wire.
                                    */}
                                </div>
                            ) : (
                                <div className="text-center py-10 text-slate-400">
                                    Preencha os parâmetros e clique em calcular para visualizar o fluxo.
                                </div>
                            )}
                        </div>

                        {/* Chart */}
                        <div className="bg-white p-6 rounded-xl shadow-sm">
                            <h2 className="text-lg font-bold text-slate-800 mb-4">Gráfico de Redução (% da Área)</h2>
                            <div className="h-64 w-full">
                                {results.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={results} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <XAxis dataKey="pass" tickLine={false} axisLine={false} tick={{ fill: '#64748B' }} label={{ value: 'Passes', position: 'insideBottom', offset: -5 }} />
                                            <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748B' }} label={{ value: '% Redução', angle: -90, position: 'insideLeft' }} domain={[0, 40]} />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                            />
                                            <ReferenceLine y={29} label="Max 1º (29%)" stroke="#EF4444" strokeDasharray="3 3" />
                                            <ReferenceLine y={19} label="Max Final (19%)" stroke="#F59E0B" strokeDasharray="3 3" />
                                            <Line type="monotone" dataKey="reduction" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-400">
                                        Gráfico indisponível
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Table */}
                        <div className="bg-white p-6 rounded-xl shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-bold text-slate-800">Tabela Detalhada (Editável)</h2>
                                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Edite os diâmetros abaixo para ajuste fino</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                                        <tr>
                                            <th className="px-6 py-3 font-semibold">Passe</th>
                                            <th className="px-6 py-3 font-semibold">Diâmetro (mm)</th>
                                            <th className="px-6 py-3 font-semibold">Redução (%)</th>
                                            <th className="px-6 py-3 font-semibold">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {results.map((res, index) => (
                                            <tr key={res.pass} className="hover:bg-slate-50">
                                                <td className="px-6 py-4 font-bold text-slate-700">#{res.pass}</td>
                                                <td className="px-6 py-4">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={passDiameters[index] || ''}
                                                        onChange={(e) => handleDiameterChange(index, e.target.value)}
                                                        className="w-24 p-1 border border-slate-300 rounded text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                    />
                                                </td>
                                                <td className="px-6 py-4 font-bold">{res.reduction.toFixed(2)}%</td>
                                                <td className="px-6 py-4">
                                                    <span className={`flex items-center gap-1 font-medium ${res.status === 'Alta' ? 'text-red-500' :
                                                            res.status === 'Baixa' ? 'text-amber-500' :
                                                                'text-emerald-500'
                                                        }`}>
                                                        {res.status === 'Ok' ? <CheckCircleIconSmall className="h-4 w-4" /> : <WarningIconSmall className="h-4 w-4" />}
                                                        {res.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {results.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                                                    Nenhum cálculo realizado.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const CheckCircleIconSmall: React.FC<{ className?: string }> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>;
const WarningIconSmall: React.FC<{ className?: string }> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;


export default TrefilaCalculation;
