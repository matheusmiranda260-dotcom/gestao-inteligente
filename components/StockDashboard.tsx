
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

const COLORS = ['#00E5FF', '#FF8C00', '#F59E0B', '#3B82F6', '#10B981', '#6366F1'];

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
            value: Number((value as number).toFixed(2)),
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
                value: Number((value as number).toFixed(2)),
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
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card p-6">
                    <h3 className="text-[#00E5FF] font-medium text-sm uppercase tracking-wider mb-2">
                        Peso Total Disponível
                    </h3>
                    <p className="text-3xl font-extrabold text-white">
                        {stockStats.totalWeight.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })}
                        <span className="text-lg text-slate-400 ml-1">kg</span>
                    </p>
                </div>

                <div className="card p-6">
                    <h3 className="text-[#FF8C00] font-medium text-sm uppercase tracking-wider mb-2">
                        Total de Lotes
                    </h3>
                    <p className="text-3xl font-extrabold text-white">
                        {stockStats.totalItems}
                    </p>
                </div>

                <div className="bg-gradient-to-br from-[#0A2A3D] to-[#020F18] p-6 rounded-xl shadow-lg border border-[#00E5FF]/20 text-white relative overflow-hidden group">
                    <div className="absolute inset-0 bg-[#00E5FF]/5 group-hover:bg-[#00E5FF]/10 transition-colors"></div>
                    <h3 className="text-slate-300 font-medium text-sm uppercase tracking-wider mb-2 relative z-10">
                        Valor Estimado
                    </h3>
                    <p className="text-sm text-slate-400 italic relative z-10">
                        Visualização de dados adicionais pode ser implementada aqui.
                    </p>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar Chart - Weight by Bitola */}
                <div className="card p-6">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <span className="w-2 h-6 bg-[#FF8C00] rounded-sm shadow-[0_0_10px_#FF8C00]"></span>
                        Peso por Bitola
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={stockStats.bitolaData}
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94A3B8', fontSize: 12 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94A3B8', fontSize: 12 }}
                                    tickFormatter={(value) => `${value / 1000}t`}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ backgroundColor: '#0A2A3D', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                                    formatter={(value: number) => [`${value.toLocaleString('pt-BR')} kg`, 'Peso']}
                                />
                                <Bar
                                    dataKey="value"
                                    name="Peso (kg)"
                                    fill="#00E5FF"
                                    radius={[4, 4, 0, 0]}
                                    barSize={40}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Pie Chart - Weight by Material Type */}
                <div className="card p-6">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <span className="w-2 h-6 bg-[#00E5FF] rounded-sm shadow-[0_0_10px_#00E5FF]"></span>
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
                                    stroke="none"
                                >
                                    {stockStats.materialData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0A2A3D', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                                    formatter={(value: number) => [`${value.toLocaleString('pt-BR')} kg`, 'Peso']}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ color: '#fff' }} formatter={(value) => <span style={{ color: '#94A3B8' }}>{value}</span>} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StockDashboard;
