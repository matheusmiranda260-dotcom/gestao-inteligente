
import React, { useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from 'recharts';
import { StockItem } from '../types';

interface StockDashboardProps {
    stock: StockItem[];
}

const COLORS = ['#0F3F5C', '#FF8C00', '#10B981', '#6366F1', '#EC4899', '#8B5CF6'];

const StockDashboard: React.FC<StockDashboardProps> = ({ stock }) => {
    const stockStats = useMemo(() => {
        const availableStock = stock.filter(
            (item) =>
                item.status === 'Disponível' || item.status === 'Disponível - Suporte Treliça'
        );

        const totalWeight = availableStock.reduce((acc, item) => acc + item.remainingQuantity, 0);
        const totalItems = availableStock.length;

        // Group by Material Type
        const materialGroups = availableStock.reduce((acc, item) => {
            const key = item.materialType;
            acc[key] = (acc[key] || 0) + item.remainingQuantity;
            return acc;
        }, {} as Record<string, number>);

        const materialData = Object.entries(materialGroups).map(([name, value]) => ({
            name,
            value: Number(value.toFixed(2)),
        }));

        // Group by Bitola
        const bitolaGroups = availableStock.reduce((acc, item) => {
            const key = item.bitola;
            acc[key] = (acc[key] || 0) + item.remainingQuantity;
            return acc;
        }, {} as Record<string, number>);

        const bitolaData = Object.entries(bitolaGroups)
            .map(([name, value]) => ({
                name,
                value: Number(value.toFixed(2)),
            }))
            .sort((a, b) => parseFloat(a.name) - parseFloat(b.name));

        return {
            totalWeight,
            totalItems,
            materialData,
            bitolaData,
        };
    }, [stock]);

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-slate-500 font-medium text-sm uppercase tracking-wider mb-2">
                        Peso Total Disponível
                    </h3>
                    <p className="text-3xl font-extrabold text-slate-800">
                        {stockStats.totalWeight.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })}
                        <span className="text-lg text-slate-500 ml-1">kg</span>
                    </p>
                </div>

                <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-slate-500 font-medium text-sm uppercase tracking-wider mb-2">
                        Total de Lotes
                    </h3>
                    <p className="text-3xl font-extrabold text-slate-800">
                        {stockStats.totalItems}
                    </p>
                </div>

                <div className="bg-gradient-to-br from-[#0F3F5C] to-[#0A2A3D] p-6 rounded-xl shadow-slate-300 shadow-md text-white">
                    <h3 className="text-slate-300 font-medium text-sm uppercase tracking-wider mb-2">
                        Valor Estimado
                    </h3>
                    <p className="text-sm text-slate-300 italic">
                        Visualização de dados adicionais pode ser implementada aqui.
                    </p>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar Chart - Weight by Bitola */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <span className="w-2 h-6 bg-[#FF8C00] rounded-sm"></span>
                        Peso por Bitola
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={stockStats.bitolaData}
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748B', fontSize: 12 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748B', fontSize: 12 }}
                                    tickFormatter={(value) => `${value / 1000}t`}
                                />
                                <Tooltip
                                    cursor={{ fill: '#F1F5F9' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number) => [`${value.toLocaleString('pt-BR')} kg`, 'Peso']}
                                />
                                <Bar
                                    dataKey="value"
                                    name="Peso (kg)"
                                    fill="#0F3F5C"
                                    radius={[4, 4, 0, 0]}
                                    barSize={40}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Pie Chart - Weight by Material Type */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <span className="w-2 h-6 bg-[#0F3F5C] rounded-sm"></span>
                        Distribuição por Material
                    </h3>
                    <div className="h-[300px] w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stockStats.materialData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {stockStats.materialData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number) => [`${value.toLocaleString('pt-BR')} kg`, 'Peso']}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StockDashboard;
