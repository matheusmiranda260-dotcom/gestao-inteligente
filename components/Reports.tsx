
import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Sector } from 'recharts';
import type { Page, StockItem, ProductionRecord, MaterialType } from '../types';

interface ReportsProps {
    stock: StockItem[];
    trefilaProduction: ProductionRecord[];
    trelicaProduction: ProductionRecord[];
    setPage: (page: Page) => void;
}

const Reports: React.FC<ReportsProps> = ({ stock, trefilaProduction, trelicaProduction, setPage }) => {
    const today = new Date();
    const thirtyDaysAgo = new Date(new Date().setDate(today.getDate() - 30));

    const [startDate, setStartDate] = useState(thirtyDaysAgo.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

    const filteredProduction = useMemo(() => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const filterByDate = (p: ProductionRecord) => {
            const pDate = new Date(p.date);
            return pDate >= start && pDate <= end;
        };

        return {
            trefila: trefilaProduction.filter(filterByDate),
            trelica: trelicaProduction.filter(filterByDate),
        };
    }, [trefilaProduction, trelicaProduction, startDate, endDate]);


    const totalStock = useMemo(() => stock.reduce((sum, item) => sum + item.remainingQuantity, 0), [stock]);

    const productionByMachineData = useMemo(() => {
        const trefilaTotal = filteredProduction.trefila.reduce((sum, p) => sum + p.producedWeight, 0);
        const trelicaTotal = filteredProduction.trelica.reduce((sum, p) => sum + p.producedWeight, 0);
        return [
            { name: 'Trefila', Produção: trefilaTotal },
            { name: 'Treliça', Produção: trelicaTotal },
        ];
    }, [filteredProduction]);

    const stockBySupplierData = useMemo(() => {
        const supplierMap = new Map<string, number>();
        stock.forEach(item => {
            if (item.remainingQuantity > 0) {
                supplierMap.set(item.supplier, (supplierMap.get(item.supplier) || 0) + item.remainingQuantity);
            }
        });
        return Array.from(supplierMap.entries()).map(([name, value]) => ({ name, value }));
    }, [stock]);

    const stockByMaterialData = useMemo(() => {
        const materialMap = new Map<MaterialType, number>();
        stock.forEach(item => {
            if (item.remainingQuantity > 0) {
                materialMap.set(item.materialType, (materialMap.get(item.materialType) || 0) + item.remainingQuantity);
            }
        });
        return Array.from(materialMap.entries()).map(([name, value]) => ({ name, value }));
    }, [stock]);

    const COLORS = ['#334155', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    return (
        <div className="p-4 sm:p-6 md:p-8 print-modal-container">
            <header className="flex items-center justify-between mb-6 no-print pt-4">
                <div className="flex items-center">
                    <h1 className="text-3xl font-bold text-slate-800">Relatórios e Indicadores</h1>
                </div>
                <button
                    onClick={() => window.print()}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-lg transition flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                    </svg>
                    Imprimir
                </button>
            </header>

            <div className="print-section">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="text-slate-500 font-medium">Estoque Total Atual</h3>
                        <p className="text-3xl font-bold text-slate-800">{totalStock.toFixed(2)} kg</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="text-slate-500 font-medium">Produção Trefila (período)</h3>
                        <p className="text-3xl font-bold text-emerald-600">{productionByMachineData[0].Produção.toFixed(2)} kg</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="text-slate-500 font-medium">Produção Treliça (período)</h3>
                        <p className="text-3xl font-bold text-amber-600">{productionByMachineData[1].Produção.toFixed(2)} kg</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm mb-8 border border-slate-100 no-print">
                    <h2 className="text-xl font-semibold text-slate-700 mb-4">Filtro por Período</h2>
                    <div className="flex items-center gap-4">
                        <div>
                            <label htmlFor="startDate" className="block text-sm font-medium text-slate-700">Data Inicial</label>
                            <input type="date" id="startDate" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 p-2 border border-slate-300 rounded" />
                        </div>
                        <div>
                            <label htmlFor="endDate" className="block text-sm font-medium text-slate-700">Data Final</label>
                            <input type="date" id="endDate" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 p-2 border border-slate-300 rounded" />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h2 className="text-xl font-semibold text-slate-700 mb-4">Produção por Máquina</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={productionByMachineData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip formatter={(value: number) => `${value.toFixed(2)} kg`} />
                                <Legend />
                                <Bar dataKey="Produção" fill="#334155" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h2 className="text-xl font-semibold text-slate-700 mb-4">Estoque por Fornecedor</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={stockBySupplierData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                    nameKey="name"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {stockBySupplierData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => `${value.toFixed(2)} kg`} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h2 className="text-xl font-semibold text-slate-700 mb-4">Estoque por Material</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={stockByMaterialData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                    nameKey="name"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {stockByMaterialData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => `${value.toFixed(2)} kg`} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reports;