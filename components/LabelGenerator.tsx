import React, { useState } from 'react';

const LabelGenerator: React.FC = () => {
    // Estados do Formulário
    const [labelWidth, setLabelWidth] = useState<number>(10);
    const [labelHeight, setLabelHeight] = useState<number>(15);
    const [quantidadePecas, setQuantidadePecas] = useState<string>('');
    const [lotesUsados, setLotesUsados] = useState<string>('');
    const [nomeProduto, setNomeProduto] = useState<string>('');
    const [numeroOrdem, setNumeroOrdem] = useState<string>('');
    const [nomeOperador, setNomeOperador] = useState<string>('');
    const [dataGeracao, setDataGeracao] = useState<string>(() => {
        const today = new Date();
        return today.toLocaleDateString('pt-BR');
    });
    
    // Função para acionar a impressão do navegador
    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="flex flex-col h-full bg-slate-100 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-6">
                    
                    {/* Controles de Geração de Etiqueta (Não imprimíveis) */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden no-print">
                        <div className="bg-[#002060] px-6 py-4 border-b border-[#001030]">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                Gerador de Etiquetas
                            </h2>
                            <p className="text-slate-200 text-sm mt-1">Configure e imprima etiquetas customizadas para os lotes.</p>
                        </div>
                        
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Dimensões */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">Dimensões da Etiqueta (cm)</h3>
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Largura (cm)</label>
                                            <input 
                                                type="number" 
                                                value={labelWidth} 
                                                onChange={(e) => setLabelWidth(Number(e.target.value))}
                                                className="modern-editable-input w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#002060] transition-colors"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Altura (cm)</label>
                                            <input 
                                                type="number" 
                                                value={labelHeight} 
                                                onChange={(e) => setLabelHeight(Number(e.target.value))}
                                                className="modern-editable-input w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#002060] transition-colors"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Dados da Etiqueta */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">Dados da Etiqueta</h3>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Nome do Produto</label>
                                        <input 
                                            type="text" 
                                            value={nomeProduto} 
                                            onChange={(e) => setNomeProduto(e.target.value)}
                                            placeholder="Ex: Q61 MALHA 15X15"
                                            className="modern-editable-input w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#002060] transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Quantidade de Peças</label>
                                        <input 
                                            type="text" 
                                            value={quantidadePecas} 
                                            onChange={(e) => setQuantidadePecas(e.target.value)}
                                            placeholder="Ex: 120"
                                            className="modern-editable-input w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#002060] transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Lotes Usados</label>
                                        <textarea 
                                            value={lotesUsados} 
                                            onChange={(e) => setLotesUsados(e.target.value)}
                                            placeholder="Ex: Lote 1234, Lote 5678..."
                                            rows={2}
                                            className="modern-editable-input w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#002060] transition-colors resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Número da Ordem</label>
                                        <input 
                                            type="text" 
                                            value={numeroOrdem} 
                                            onChange={(e) => setNumeroOrdem(e.target.value)}
                                            placeholder="Ex: OP-12345"
                                            className="modern-editable-input w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#002060] transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Nome do Operador</label>
                                        <input 
                                            type="text" 
                                            value={nomeOperador} 
                                            onChange={(e) => setNomeOperador(e.target.value)}
                                            placeholder="Ex: João Silva"
                                            className="modern-editable-input w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#002060] transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Data</label>
                                        <input 
                                            type="text" 
                                            value={dataGeracao} 
                                            onChange={(e) => setDataGeracao(e.target.value)}
                                            className="modern-editable-input w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#002060] transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex justify-end">
                                <button 
                                    onClick={handlePrint}
                                    className="px-6 py-2.5 bg-[#002060] hover:bg-slate-800 text-white text-sm font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2 uppercase tracking-wide"
                                >
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                    Imprimir Etiqueta
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Preview da Etiqueta (E área de impressão) */}
                    <div className="mt-8 flex flex-col items-center pb-12">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 no-print">Pré-visualização da Etiqueta</h3>
                        
                        {/* Wrapper for the actual label */}
                        <div 
                            className="bg-white border border-slate-300 shadow-sm print-area flex flex-col"
                            style={{ 
                                width: `${labelWidth}cm`, 
                                height: `${labelHeight}cm`,
                                padding: '1cm',
                                boxSizing: 'border-box'
                            }}
                        >
                            <div className="flex justify-center mb-6 border-b-2 border-slate-800 pb-4">
                                <img src="/ita-acos-logo.png" alt="Logo Grupo Ita Aços" className="h-16 object-contain" />
                            </div>
                            
                            <div className="flex-1 flex flex-col justify-center gap-6">
                                <div className="text-center">
                                    <span className="block text-2xl font-black text-[#002060] uppercase tracking-wide">{nomeProduto || '-'}</span>
                                </div>
                                <div className="text-center">
                                    <span className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Quantidade de Peças</span>
                                    <span className="block text-4xl font-black text-slate-900">{quantidadePecas || '-'}</span>
                                </div>
                                
                                <div className="text-center mt-4">
                                    <span className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Lotes Usados</span>
                                    <span className="block text-xl font-bold text-slate-800 whitespace-pre-wrap">{lotesUsados || '-'}</span>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4 mt-2 text-center border-t border-slate-200 pt-4">
                                    <div>
                                        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Ordem</span>
                                        <span className="block text-sm font-bold text-slate-800">{numeroOrdem || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Data</span>
                                        <span className="block text-sm font-bold text-slate-800">{dataGeracao || '-'}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Operador</span>
                                        <span className="block text-sm font-bold text-slate-800">{nomeOperador || '-'}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mt-auto text-center border-t border-slate-200 pt-2">
                                <span className="text-xs font-medium text-slate-400">ITA AÇOS - GESTÃO INTELIGENTE</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Estilos Globais de Impressão Específicos para a Etiqueta */}
            <style>{`
                @media print {
                    @page {
                        size: ${labelWidth}cm ${labelHeight}cm;
                        margin: 0;
                    }
                    /* Esconde todos os outros elementos do corpo */
                    body > *:not(.print-area-wrapper) {
                        display: none !important;
                    }
                    /* Força o LabelGenerator e seus pais a não esconderem o conteúdo */
                    html, body, #root, .flex-col, .flex-1 {
                        height: auto !important;
                        overflow: visible !important;
                        position: static !important;
                    }
                    /* Força ocultar as barras laterais e cabeçalhos */
                    header, aside, .sidebar {
                        display: none !important;
                    }
                    body * {
                        visibility: hidden;
                    }
                    .print-area, .print-area * {
                        visibility: visible;
                    }
                    .print-area {
                        position: fixed;
                        left: 0;
                        top: 0;
                        width: ${labelWidth}cm !important;
                        height: ${labelHeight}cm !important;
                        margin: 0;
                        padding: 0.5cm !important;
                        border: none !important;
                        box-shadow: none !important;
                        background: white !important;
                        z-index: 999999 !important;
                        display: flex !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default LabelGenerator;
