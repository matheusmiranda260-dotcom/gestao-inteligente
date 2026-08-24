import React, { useState } from 'react';

const LabelGenerator: React.FC = () => {
    // Estados do Formulário
    const [labelWidth, setLabelWidth] = useState<number>(10);
    const [labelHeight, setLabelHeight] = useState<number>(15);
    const [quantidadePecas, setQuantidadePecas] = useState<string>('');
    const [loteLongitudinal, setLoteLongitudinal] = useState<string>('');
    const [loteTransversal, setLoteTransversal] = useState<string>('');
    const [nomeProduto, setNomeProduto] = useState<string>('');
    const [numeroOrdem, setNumeroOrdem] = useState<string>('');
    const [nomeOperador, setNomeOperador] = useState<string>('');
    const [peso, setPeso] = useState<string>('');
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
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Lote Longitudinal</label>
                                        <input 
                                            type="text"
                                            value={loteLongitudinal} 
                                            onChange={(e) => setLoteLongitudinal(e.target.value)}
                                            placeholder="Ex: Lote 1234"
                                            className="modern-editable-input w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#002060] transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Lote Transversal</label>
                                        <input 
                                            type="text"
                                            value={loteTransversal} 
                                            onChange={(e) => setLoteTransversal(e.target.value)}
                                            placeholder="Ex: Lote 5678"
                                            className="modern-editable-input w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#002060] transition-colors"
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
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Peso (kg)</label>
                                        <input 
                                            type="text" 
                                            value={peso} 
                                            onChange={(e) => setPeso(e.target.value)}
                                            placeholder="Ex: 50.5"
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
                            className="bg-white border border-slate-300 shadow-sm print-area flex flex-col justify-between"
                            style={{ 
                                width: `${labelWidth}cm`, 
                                height: `${labelHeight}cm`,
                                padding: '3cqmin',
                                boxSizing: 'border-box',
                                containerType: 'size'
                            }}
                        >
                            <div className="flex justify-center border-b-2 border-black" style={{ marginBottom: '2cqh', paddingBottom: '1.5cqh' }}>
                                <img src="/ita-acos-logo.png" alt="Logo Grupo Ita Aços" className="object-contain" style={{ height: '12cqh' }} />
                            </div>
                            
                            <div className="flex-1 flex flex-col justify-center" style={{ gap: '2cqh' }}>
                                <div className="text-center">
                                    <span className="block font-black text-[#002060] uppercase tracking-wide leading-tight" style={{ fontSize: '7cqw' }}>{nomeProduto || '-'}</span>
                                </div>
                                <div className="text-center">
                                    <span className="block font-black text-black uppercase tracking-widest mb-1" style={{ fontSize: '3.5cqw' }}>Quantidade de Peças</span>
                                    <span className="block font-black text-black leading-none" style={{ fontSize: '10cqw' }}>{quantidadePecas || '-'}</span>
                                </div>
                                
                                <div className="grid grid-cols-2 text-center" style={{ gap: '2cqw', marginTop: '1cqh' }}>
                                    <div>
                                        <span className="block font-black text-black uppercase tracking-widest mb-1" style={{ fontSize: '2.5cqw' }}>Lote Longitudinal</span>
                                        <span className="block font-black text-black whitespace-pre-wrap leading-tight" style={{ fontSize: '4cqw' }}>{loteLongitudinal || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="block font-black text-black uppercase tracking-widest mb-1" style={{ fontSize: '2.5cqw' }}>Lote Transversal</span>
                                        <span className="block font-black text-black whitespace-pre-wrap leading-tight" style={{ fontSize: '4cqw' }}>{loteTransversal || '-'}</span>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 text-center border-t border-black" style={{ gap: '2cqw', marginTop: '1cqh', paddingTop: '1.5cqh' }}>
                                    <div>
                                        <span className="block font-black text-black uppercase tracking-widest mb-1" style={{ fontSize: '2.5cqw' }}>Ordem</span>
                                        <span className="block font-black text-black" style={{ fontSize: '4cqw' }}>{numeroOrdem || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="block font-black text-black uppercase tracking-widest mb-1" style={{ fontSize: '2.5cqw' }}>Data</span>
                                        <span className="block font-black text-black" style={{ fontSize: '4cqw' }}>{dataGeracao || '-'}</span>
                                    </div>
                                    <div style={{ marginTop: '0.5cqh' }}>
                                        <span className="block font-black text-black uppercase tracking-widest mb-1" style={{ fontSize: '2.5cqw' }}>Operador</span>
                                        <span className="block font-black text-black" style={{ fontSize: '4cqw' }}>{nomeOperador || '-'}</span>
                                    </div>
                                    <div style={{ marginTop: '0.5cqh' }}>
                                        <span className="block font-black text-black uppercase tracking-widest mb-1" style={{ fontSize: '2.5cqw' }}>Peso</span>
                                        <span className="block font-black text-black" style={{ fontSize: '4cqw' }}>{peso ? `${peso} kg` : '-'}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mt-auto text-center border-t border-black" style={{ paddingTop: '1.5cqh' }}>
                                <span className="font-bold text-black" style={{ fontSize: '3cqw' }}>ITA AÇOS - GESTÃO INTELIGENTE</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @page {
                    size: ${labelWidth}cm ${labelHeight}cm;
                    margin: 0mm;
                }
                @media print {
                    /* Oculta tudo por padrão, mas preserva o layout (visibility em vez de display) */
                    body * {
                        visibility: hidden;
                    }
                    /* Torna a área de impressão e seus filhos visíveis */
                    .print-area, .print-area * {
                        visibility: visible;
                    }
                    /* Posiciona a área de impressão no topo esquerdo absoluto e usa 100vw/vh para ocupar toda a pagina da impressora */
                    .print-area {
                        position: fixed !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100vw !important;
                        height: 100vh !important;
                        margin: 0 !important;
                        padding: 3cqmin !important;
                        border: none !important;
                        box-shadow: none !important;
                        background: white !important;
                        z-index: 999999 !important;
                        display: flex !important;
                    }
                    /* Evita overflow e remove margens que poderiam gerar pagina em branco */
                    html, body {
                        width: 100vw !important;
                        height: 100vh !important;
                        overflow: hidden !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                    }
                    ::-webkit-scrollbar {
                        display: none;
                    }
                }
            `}</style>
        </div>
    );
};

export default LabelGenerator;
