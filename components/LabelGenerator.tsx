import React, { useState } from 'react';

const LabelGenerator: React.FC = () => {
    // Estados do Formulário
    const [labelWidth, setLabelWidth] = useState<number>(10);
    const [labelHeight, setLabelHeight] = useState<number>(15);
    const [quantidadePecas, setQuantidadePecas] = useState<string>('');
    const [loteLongitudinal, setLoteLongitudinal] = useState<string>('');
    const [loteVertical, setLoteVertical] = useState<string>('');
    const [tipoLote, setTipoLote] = useState<'longitudinal_vertical' | 'superior_senozoide_inferior'>('longitudinal_vertical');
    const [loteSuperior, setLoteSuperior] = useState<string>('');
    const [loteSenozoide, setLoteSenozoide] = useState<string>('');
    const [loteInferior, setLoteInferior] = useState<string>('');
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
                                        <label className="block text-xs font-bold text-slate-500 mb-2">Tipo de Lote</label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input 
                                                    type="radio" 
                                                    name="tipoLote" 
                                                    value="longitudinal_vertical" 
                                                    checked={tipoLote === 'longitudinal_vertical'}
                                                    onChange={() => setTipoLote('longitudinal_vertical')}
                                                    className="w-4 h-4 text-[#002060] focus:ring-[#002060]"
                                                />
                                                <span className="text-sm font-bold text-slate-700">Longitudinal / Vertical</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input 
                                                    type="radio" 
                                                    name="tipoLote" 
                                                    value="superior_senozoide_inferior" 
                                                    checked={tipoLote === 'superior_senozoide_inferior'}
                                                    onChange={() => setTipoLote('superior_senozoide_inferior')}
                                                    className="w-4 h-4 text-[#002060] focus:ring-[#002060]"
                                                />
                                                <span className="text-sm font-bold text-slate-700">Superior / Senozoide / Inferior</span>
                                            </label>
                                        </div>
                                    </div>

                                    {tipoLote === 'longitudinal_vertical' ? (
                                        <>
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
                                                <label className="block text-xs font-bold text-slate-500 mb-1">Lote Vertical</label>
                                                <input 
                                                    type="text"
                                                    value={loteVertical} 
                                                    onChange={(e) => setLoteVertical(e.target.value)}
                                                    placeholder="Ex: Lote 5678"
                                                    className="modern-editable-input w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#002060] transition-colors"
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 mb-1">Lote Superior</label>
                                                <input 
                                                    type="text"
                                                    value={loteSuperior} 
                                                    onChange={(e) => setLoteSuperior(e.target.value)}
                                                    placeholder="Ex: Lote A"
                                                    className="modern-editable-input w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#002060] transition-colors"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 mb-1">Lote Senozoide</label>
                                                <input 
                                                    type="text"
                                                    value={loteSenozoide} 
                                                    onChange={(e) => setLoteSenozoide(e.target.value)}
                                                    placeholder="Ex: Lote B"
                                                    className="modern-editable-input w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#002060] transition-colors"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 mb-1">Lote Inferior</label>
                                                <input 
                                                    type="text"
                                                    value={loteInferior} 
                                                    onChange={(e) => setLoteInferior(e.target.value)}
                                                    placeholder="Ex: Lote C"
                                                    className="modern-editable-input w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#002060] transition-colors"
                                                />
                                            </div>
                                        </>
                                    )}
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
                            className="bg-white border-4 border-black print-area flex flex-col"
                            style={{ 
                                width: `${labelWidth}cm`, 
                                height: `${labelHeight}cm`,
                                boxSizing: 'border-box',
                                containerType: 'size'
                            }}
                        >
                            {/* HEADER: Logo and Product */}
                            <div className="flex flex-row border-b-4 border-black items-center" style={{ height: '18cqh' }}>
                                <div className="flex items-center justify-center border-r-4 border-black h-full" style={{ width: '35cqw', padding: '1cqmin' }}>
                                    <img src="/ita-acos-logo.png" alt="Logo Grupo Ita Aços" className="object-contain w-full h-full" />
                                </div>
                                <div className="flex-1 flex items-center justify-center h-full p-2 text-center bg-black">
                                    <span className="block font-black text-white uppercase tracking-wider leading-none" style={{ fontSize: '6cqw' }}>{nomeProduto || 'PRODUTO NÃO INFORMADO'}</span>
                                </div>
                            </div>
                            
                            {/* BODY: Main Content */}
                            <div className="flex-1 flex flex-col w-full">
                                
                                {/* Row 1: Quantidade */}
                                <div className="flex flex-row border-b-4 border-black" style={{ height: '22cqh' }}>
                                    <div className="flex flex-col justify-center items-center w-full h-full bg-white">
                                        <span className="block font-black text-black uppercase tracking-widest" style={{ fontSize: '4cqw' }}>QTD. PEÇAS</span>
                                        <span className="block font-black text-black leading-none" style={{ fontSize: '15cqw', marginTop: '-1cqh' }}>{quantidadePecas || '-'}</span>
                                    </div>
                                </div>
                                
                                {/* Row 2: Lotes */}
                                {tipoLote === 'longitudinal_vertical' ? (
                                    <div className="flex flex-row border-b-4 border-black" style={{ height: '15cqh' }}>
                                        <div className="flex flex-col justify-center items-center w-1/2 h-full border-r-4 border-black p-1">
                                            <span className="block font-black text-black uppercase tracking-widest" style={{ fontSize: '3cqw' }}>LOTE LONGITUDINAL</span>
                                            <span className="block font-black text-black leading-none whitespace-pre-wrap text-center" style={{ fontSize: '6cqw' }}>{loteLongitudinal || '-'}</span>
                                        </div>
                                        <div className="flex flex-col justify-center items-center w-1/2 h-full p-1">
                                            <span className="block font-black text-black uppercase tracking-widest" style={{ fontSize: '3cqw' }}>LOTE VERTICAL</span>
                                            <span className="block font-black text-black leading-none whitespace-pre-wrap text-center" style={{ fontSize: '6cqw' }}>{loteVertical || '-'}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-row border-b-4 border-black" style={{ height: '15cqh' }}>
                                        <div className="flex flex-col justify-center items-center w-1/3 h-full border-r-4 border-black p-1">
                                            <span className="block font-black text-black uppercase tracking-widest text-center" style={{ fontSize: '2.5cqw' }}>LOTE SUPERIOR</span>
                                            <span className="block font-black text-black leading-none whitespace-pre-wrap text-center" style={{ fontSize: '5cqw' }}>{loteSuperior || '-'}</span>
                                        </div>
                                        <div className="flex flex-col justify-center items-center w-1/3 h-full border-r-4 border-black p-1">
                                            <span className="block font-black text-black uppercase tracking-widest text-center" style={{ fontSize: '2.5cqw' }}>LOTE SENOZOIDE</span>
                                            <span className="block font-black text-black leading-none whitespace-pre-wrap text-center" style={{ fontSize: '5cqw' }}>{loteSenozoide || '-'}</span>
                                        </div>
                                        <div className="flex flex-col justify-center items-center w-1/3 h-full p-1">
                                            <span className="block font-black text-black uppercase tracking-widest text-center" style={{ fontSize: '2.5cqw' }}>LOTE INFERIOR</span>
                                            <span className="block font-black text-black leading-none whitespace-pre-wrap text-center" style={{ fontSize: '5cqw' }}>{loteInferior || '-'}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Row 3: Ordem and Peso */}
                                <div className="flex flex-row border-b-4 border-black" style={{ height: '15cqh' }}>
                                    <div className="flex flex-col justify-center items-center w-1/2 h-full border-r-4 border-black p-1 bg-slate-100">
                                        <span className="block font-black text-black uppercase tracking-widest" style={{ fontSize: '3cqw' }}>ORDEM</span>
                                        <span className="block font-black text-black leading-none text-center" style={{ fontSize: '5cqw' }}>{numeroOrdem || '-'}</span>
                                    </div>
                                    <div className="flex flex-col justify-center items-center w-1/2 h-full p-1 bg-slate-100">
                                        <span className="block font-black text-black uppercase tracking-widest" style={{ fontSize: '3cqw' }}>PESO TOTAL</span>
                                        <span className="block font-black text-black leading-none text-center" style={{ fontSize: '5cqw' }}>{peso ? `${peso} kg` : '-'}</span>
                                    </div>
                                </div>

                                {/* Row 4: Operador and Data (Smaller at bottom) */}
                                <div className="flex flex-row flex-1" style={{ minHeight: '10cqh' }}>
                                    <div className="flex flex-col justify-center items-start w-3/4 h-full border-r-4 border-black" style={{ paddingLeft: '3cqw' }}>
                                        <span className="block font-black text-black uppercase tracking-widest" style={{ fontSize: '2.5cqw' }}>OPERADOR</span>
                                        <span className="block font-black text-black leading-none" style={{ fontSize: '4.5cqw' }}>{nomeOperador || '-'}</span>
                                    </div>
                                    <div className="flex flex-col justify-center items-center w-1/4 h-full">
                                        <span className="block font-black text-black uppercase tracking-widest" style={{ fontSize: '2cqw' }}>DATA</span>
                                        <span className="block font-black text-black leading-none" style={{ fontSize: '3.5cqw' }}>{dataGeracao || '-'}</span>
                                    </div>
                                </div>

                            </div>
                            
                            {/* FOOTER */}
                            <div className="flex items-center justify-center border-t-4 border-black bg-black" style={{ height: '6cqh' }}>
                                <span className="font-bold text-white tracking-widest uppercase" style={{ fontSize: '2.5cqw' }}>ITA AÇOS - GESTÃO INTELIGENTE</span>
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
