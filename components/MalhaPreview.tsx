import React from 'react';

interface MalhaPreviewProps {
    largura: number; // m
    comprimento: number; // m
    espacamentoTransversal: number; // cm
    espacamentoLongitudinal: number; // cm
    franjaTransversal: number; // cm
    franjaLongitudinal: number; // cm
    fiosTransversais: number;
    fiosLongitudinais: number;
}

const MalhaPreview: React.FC<MalhaPreviewProps> = ({
    largura,
    comprimento,
    espacamentoTransversal,
    espacamentoLongitudinal,
    franjaTransversal,
    franjaLongitudinal,
    fiosTransversais,
    fiosLongitudinais
}) => {
    // Conversão para cm
    const widthCm = Math.max(10, comprimento * 100);
    const heightCm = Math.max(10, largura * 100);

    // Reduzindo o padding drasticamente para que a malha ocupe mais espaço
    const paddingX = Math.max(40, widthCm * 0.08); 
    const paddingY = Math.max(40, heightCm * 0.08);

    const viewBoxWidth = widthCm + paddingX * 2;
    const viewBoxHeight = heightCm + paddingY * 2;
    const viewBox = `${-paddingX} ${-paddingY} ${viewBoxWidth} ${viewBoxHeight}`;
    
    // Espessura da linha e do texto (diminuindo o texto como solicitado)
    const maxDim = Math.max(viewBoxWidth, viewBoxHeight);
    const strokeW = Math.max(0.5, maxDim * 0.003);
    const textBaseSize = Math.max(6, maxDim * 0.015);

    const renderHorizontalWires = () => {
        const wires = [];
        for (let i = 0; i < fiosLongitudinais; i++) {
            const y = franjaTransversal + (i * espacamentoLongitudinal);
            if (y <= heightCm + 0.1) {
                wires.push(<line key={`h-${i}`} x1={0} y1={y} x2={widthCm} y2={y} stroke="#64748b" strokeWidth={strokeW} />);
            }
        }
        return wires;
    };

    const renderVerticalWires = () => {
        const wires = [];
        for (let i = 0; i < fiosTransversais; i++) {
            const x = franjaLongitudinal + (i * espacamentoTransversal);
            if (x <= widthCm + 0.1) {
                wires.push(<line key={`v-${i}`} x1={x} y1={0} x2={x} y2={heightCm} stroke="#64748b" strokeWidth={strokeW} />);
            }
        }
        return wires;
    };

    const DimLine = ({ x1, y1, x2, y2, label, labelColor = "#f97316" }: { x1: number, y1: number, x2: number, y2: number, label: string, labelColor?: string }) => {
        const isVertical = x1 === x2;
        const tickSize = textBaseSize * 0.8;
        
        // Ponto médio para o texto
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        
        return (
            <g className="dimension-line">
                {/* Linha principal */}
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={labelColor} strokeWidth={strokeW * 0.5} opacity={0.6} />
                
                {/* Ticks nas pontas */}
                {isVertical ? (
                    <>
                        <line x1={x1 - tickSize/2} y1={y1} x2={x1 + tickSize/2} y2={y1} stroke={labelColor} strokeWidth={strokeW * 0.8} />
                        <line x1={x2 - tickSize/2} y1={y2} x2={x2 + tickSize/2} y2={y2} stroke={labelColor} strokeWidth={strokeW * 0.8} />
                    </>
                ) : (
                    <>
                        <line x1={x1} y1={y1 - tickSize/2} x2={x1} y2={y1 + tickSize/2} stroke={labelColor} strokeWidth={strokeW * 0.8} />
                        <line x1={x2} y1={y2 - tickSize/2} x2={x2} y2={y2 + tickSize/2} stroke={labelColor} strokeWidth={strokeW * 0.8} />
                    </>
                )}
                
                {/* Texto */}
                <text 
                    x={mx} 
                    y={my} 
                    fill={labelColor}
                    fontSize={textBaseSize}
                    fontFamily="sans-serif"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={isVertical ? `rotate(-90 ${mx} ${my}) translate(0, -${textBaseSize * 1.2})` : `translate(0, -${textBaseSize * 1.2})`}
                >
                    {label}
                </text>
            </g>
        );
    };

    return (
        <div className="w-full h-full min-h-[300px] flex items-center justify-center bg-white rounded-xl overflow-hidden relative group">
            {/* Overlay sutil para indicar que é dinâmico */}
            <div className="absolute top-2 right-2 bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                Preview CAD Dinâmico
            </div>

            <svg 
                viewBox={viewBox} 
                className="w-full h-full drop-shadow-sm" 
                preserveAspectRatio="xMidYMid meet"
            >
                {/* Malha (Fios) */}
                <g className="wires">
                    {renderHorizontalWires()}
                    {renderVerticalWires()}
                </g>

                {/* Indicação de uma "Célula" da Malha (laranja como no original) */}
                {fiosTransversais > 1 && fiosLongitudinais > 1 && (
                    <rect 
                        x={franjaLongitudinal + (Math.floor(fiosTransversais/2) - 1) * espacamentoTransversal} 
                        y={franjaTransversal + (Math.floor(fiosLongitudinais/2) - 1) * espacamentoLongitudinal} 
                        width={espacamentoTransversal} 
                        height={espacamentoLongitudinal} 
                        fill="#f97316" 
                        opacity={0.8} 
                    />
                )}

                {/* ======================================================== */}
                {/* ANOTAÇÕES (Linhas de Cota)                             */}
                {/* ======================================================== */}
                
                {/* Comprimento (Embaixo) */}
                <DimLine 
                    x1={0} y1={heightCm + paddingY * 0.35} 
                    x2={widthCm} y2={heightCm + paddingY * 0.35} 
                    label={`Comprimento: ${comprimento.toFixed(2)}m`} 
                />

                {/* Largura (Esquerda) */}
                <DimLine 
                    x1={-paddingX * 0.45} y1={0} 
                    x2={-paddingX * 0.45} y2={heightCm} 
                    label={`Largura: ${largura.toFixed(2)}m`} 
                    labelColor="#3b82f6"
                />

                {/* Espaçamento Transversal (Topo) */}
                {fiosTransversais > 1 && (
                    <DimLine 
                        x1={franjaLongitudinal} y1={-paddingY * 0.5} 
                        x2={franjaLongitudinal + espacamentoTransversal} y2={-paddingY * 0.5} 
                        label={`Espaç. Transv. (${espacamentoTransversal}cm)`} 
                        labelColor="#10b981"
                    />
                )}

                {/* Espaçamento Longitudinal (Direita) */}
                {fiosLongitudinais > 1 && (
                    <DimLine 
                        x1={widthCm + paddingX * 0.4} y1={franjaTransversal} 
                        x2={widthCm + paddingX * 0.4} y2={franjaTransversal + espacamentoLongitudinal} 
                        label={`Espaç. Long. (${espacamentoLongitudinal}cm)`} 
                        labelColor="#8b5cf6"
                    />
                )}

                {/* Franja Longitudinal (Topo - Esquerda) */}
                {franjaLongitudinal > 0 && fiosTransversais > 0 && (
                    <DimLine 
                        x1={0} y1={-paddingY * 0.2} 
                        x2={franjaLongitudinal} y2={-paddingY * 0.2} 
                        label={`Fr. Long. (${franjaLongitudinal}cm)`} 
                        labelColor="#64748b"
                    />
                )}

                {/* Franja Transversal (Esquerda - Baixo) */}
                {franjaTransversal > 0 && fiosLongitudinais > 0 && (
                    <DimLine 
                        x1={-paddingX * 0.2} y1={heightCm - franjaTransversal} 
                        x2={-paddingX * 0.2} y2={heightCm} 
                        label={`Fr. Transv. (${franjaTransversal}cm)`} 
                        labelColor="#64748b"
                    />
                )}

            </svg>
        </div>
    );
};

export default MalhaPreview;
