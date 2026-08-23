import React, { useState } from 'react';
import type { Page, StockItem, ProductionRecord, StockGauge } from '../types';
import ReportsTrelica from './ReportsTrelica';
import ReportsTrefila from './ReportsTrefila';
import ReportsOPTrefila from './ReportsOPTrefila';
import ReportsFechamentoOP from './ReportsFechamentoOP';
import ReportsRequisicaoTransferencia from './ReportsRequisicaoTransferencia';
import ReportsFinalTrelica from './ReportsFinalTrelica';
import ReportsMalha from './ReportsMalha';
import LabelGenerator from './LabelGenerator';

interface ReportsProps {
    stock: StockItem[];
    trefilaProduction: ProductionRecord[];
    trelicaProduction: ProductionRecord[];
    malhaProduction: ProductionRecord[];
    setPage: (page: Page) => void;
    gauges: StockGauge[];
}

const Reports: React.FC<ReportsProps> = ({ stock, trefilaProduction, trelicaProduction, malhaProduction, setPage, gauges }) => {
    const [activeTab, setActiveTab] = useState<'trelica' | 'malha' | 'trefila' | 'op_trefila' | 'fechamento_op' | 'requisicao_transferencia' | 'final_trelica' | 'gerar_etiqueta'>('trelica');

    return (
        <div className="flex flex-col h-full bg-slate-100">
            {/* Tabs de Seleção (Ocultas na Impressão) */}
            <div className="bg-white px-6 py-3 border-b border-slate-200 flex items-center gap-2 no-print shrink-0 shadow-sm z-20 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('trelica')}
                    className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${
                        activeTab === 'trelica' 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'
                    }`}
                >
                    Relatório Diário - Treliça
                </button>
                <button
                    onClick={() => setActiveTab('malha')}
                    className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${
                        activeTab === 'malha' 
                        ? 'bg-orange-600 text-white shadow-md' 
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'
                    }`}
                >
                    Relatório Diário - Malha
                </button>
                <button
                    onClick={() => setActiveTab('trefila')}
                    className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${
                        activeTab === 'trefila' 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'
                    }`}
                >
                    Relatório Diário - Trefila
                </button>
                <button
                    onClick={() => setActiveTab('op_trefila')}
                    className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${
                        activeTab === 'op_trefila' 
                        ? 'bg-emerald-600 text-white shadow-md' 
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'
                    }`}
                >
                    Ficha OP - Trefila (A4)
                </button>
                <button
                    onClick={() => setActiveTab('fechamento_op')}
                    className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${
                        activeTab === 'fechamento_op' 
                        ? 'bg-[#002060] text-white shadow-md' 
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'
                    }`}
                >
                    Fechamento de OP (Rendimento)
                </button>
                <button
                    onClick={() => setActiveTab('requisicao_transferencia')}
                    className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${
                        activeTab === 'requisicao_transferencia' 
                        ? 'bg-[#002060] text-white shadow-md' 
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'
                    }`}
                >
                    Transferência de Material
                </button>
                <button
                    onClick={() => setActiveTab('final_trelica')}
                    className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${
                        activeTab === 'final_trelica' 
                        ? 'bg-[#002060] text-white shadow-md' 
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'
                    }`}
                >
                    Relatório Final - Treliça
                </button>
                <button
                    onClick={() => setActiveTab('gerar_etiqueta')}
                    className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${
                        activeTab === 'gerar_etiqueta' 
                        ? 'bg-[#002060] text-white shadow-md' 
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'
                    }`}
                >
                    Gerar Etiqueta
                </button>
            </div>

            {/* Renderizar o Relatório Selecionado */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {activeTab === 'trelica' ? (
                    <ReportsTrelica 
                        stock={stock} 
                        trefilaProduction={trefilaProduction} 
                        trelicaProduction={trelicaProduction} 
                        setPage={setPage} 
                    />
                ) : activeTab === 'malha' ? (
                    <ReportsMalha 
                        stock={stock} 
                        trefilaProduction={trefilaProduction} 
                        malhaProduction={malhaProduction} 
                        setPage={setPage} 
                    />
                ) : activeTab === 'trefila' ? (
                    <ReportsTrefila 
                        setPage={setPage} 
                    />
                ) : activeTab === 'op_trefila' ? (
                    <ReportsOPTrefila 
                        stock={stock}
                        setPage={setPage}
                    />
                ) : activeTab === 'requisicao_transferencia' ? (
                    <ReportsRequisicaoTransferencia 
                        setPage={setPage} 
                    />
                ) : activeTab === 'final_trelica' ? (
                    <ReportsFinalTrelica 
                        stock={stock}
                        setPage={setPage}
                        gauges={gauges}
                    />
                ) : activeTab === 'fechamento_op' ? (
                    <ReportsFechamentoOP
                        stock={stock}
                        setPage={setPage}
                    />
                ) : (
                    <LabelGenerator />
                )}
            </div>
        </div>
    );
};

export default Reports;
