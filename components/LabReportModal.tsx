import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { LabAnalysisEntry } from '../types';

interface LabReportModalProps {
    reportData: LabAnalysisEntry;
    onClose: () => void;
}

const LabReportModal: React.FC<LabReportModalProps> = ({ reportData, onClose }) => {
    const k7Entradas = [
        reportData.k7_1_entrada, reportData.k7_2_entrada,
        reportData.k7_3_entrada, reportData.k7_4_entrada
    ];
    const k7Saidas = [
        reportData.k7_1_saida, reportData.k7_2_saida,
        reportData.k7_3_saida, reportData.k7_4_saida
    ];

    const calcK7Media = (ent: number | null | undefined, sai: number | null | undefined) => {
        if (ent == null && sai == null) return null;
        if (ent == null) return Number(sai);
        if (sai == null) return Number(ent);
        return (Number(ent) + Number(sai)) / 2;
    };

    const medias = [0, 1, 2, 3].map(i => calcK7Media(k7Entradas[i], k7Saidas[i]));

    const bitolaMPNum = Number(reportData.bitola_mp?.replace(',', '.'));

    const reducoes = [0, 1, 2, 3].map(i => {
        const currentMedia = medias[i];
        if (currentMedia === null) return null;
        const prevDiameter = i === 0 ? bitolaMPNum : medias[i - 1];
        if (!prevDiameter || prevDiameter <= 0) return null;
        return (1 - Math.pow(currentMedia / prevDiameter, 2)) * 100;
    });

    const relacao = (reportData.resistencia && reportData.escoamento && Number(reportData.escoamento) > 0)
        ? (Number(reportData.resistencia) / Number(reportData.escoamento))
        : null;

    const bitolaFinal = (reportData.massa && reportData.comprimento && Number(reportData.comprimento) > 0)
        ? Math.sqrt(Number(reportData.massa) / Number(reportData.comprimento)) * 12.744
        : null;

    const n = (v: any) => (v !== null && v !== undefined && !isNaN(Number(v))) ? Number(v).toFixed(2) : '—';
    const nd = (v: any) => (v !== null && v !== undefined && !isNaN(Number(v))) ? Number(v).toFixed(4) : '—';

    const checkValue = (val: any, min: number) => {
        if (!val || isNaN(Number(val))) return { color: '', label: '—' };
        return Number(val) >= min
            ? { color: 'text-emerald-600', label: '✓ APROVADO' }
            : { color: 'text-red-500', label: '⚠ REPROVADO' };
    };

    const escStatus = checkValue(reportData.escoamento, 600);
    const resStatus = checkValue(reportData.resistencia, 660);
    const aloStatus = checkValue(reportData.alongamento, 5);
    const relStatus = checkValue(relacao, 1.05);
    const dateStr = reportData.date ? new Date(reportData.date).toLocaleDateString('pt-BR') : '—';
    const timeStr = reportData.date ? new Date(reportData.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';

    // Virtual AI Diagnosis
    const generateAiInsight = () => {
        const insights = [];
        let hasError = false;

        const esc = Number(reportData.escoamento) || 0;
        const res = Number(reportData.resistencia) || 0;
        if (esc > 0 && res > 0 && (esc < 600 || res < 660)) {
            hasError = true;
            insights.push("⚙️ Tração/Escoamento Baixos: Possível desgaste prematuro nos roletes laminadores, excesso de lubrificação causando deslizamento, ou a matéria-prima (MP) possui teor de carbono inferior ao certificado.");
        }

        const alo = Number(reportData.alongamento) || 0;
        if (alo > 0 && alo < 5) {
            hasError = true;
            insights.push("⛓️ Extrema Fragilidade (< 5%): O material está quebradiço. Fio máquina com microfissuras internas ou redução agressiva em um único passe, encruando o fio além do limite mecânico suportado.");
        }

        if (relacao !== null && relacao < 1.05) {
            hasError = true;
            insights.push("⚖️ Relação Auto Inadequada: A diferença entre escoamento e limite de resistência está extremamente curta. O fio de perdeu sua ductilidade durante a redução (encruamento severo).");
        }

        let hasAnomaly = false;
        for (let i = 1; i < medias.length; i++) {
            if (medias[i] !== null && medias[i - 1] !== null && medias[i]! > medias[i - 1]!) {
                hasAnomaly = true;
            }
        }
        if (hasAnomaly) {
            hasError = true;
            insights.push("📐 Anomalia Dimensional Grave: Detectado um aumento no diâmetro durante o fluxo de redução (o fio engrossou). Verifique imediatamente uma possível quebra no rolete ou montagem de K7 invertida.");
        }

        let hasSetupDeviant = false;
        for (let i = 1; i <= 4; i++) {
            const ideal = Number((reportData as any)[`k7_${i}_ideal`]);
            const real = medias[i - 1];
            if (ideal > 0 && real !== null && Math.abs(ideal - real) > 0.05) {
                hasSetupDeviant = true;
            }
        }
        if (hasSetupDeviant) {
            hasError = true;
            insights.push("🎯 Desvio de Setup Ideal: Um ou mais cassetes não entregaram a milimetragem planejada no Setup Ideal. Recomenda-se ajustar a aproximação dos rolos ou medir a ovalização na saída do K7 em questão.");
        }

        if (!hasError) {
            return [{ type: 'success', text: "🎉 Análise da IA: Todo o lote atendeu rigorosamente aos padrões de qualidade. Setup de laminação e propriedades mecânicas trabalharam em perfeita harmonia. Produto 100% aprovado." }];
        }

        return insights.map(i => ({ type: 'error', text: i }));
    };

    const aiInsights = generateAiInsight();

    const handleExternalAI = () => {
        const prompt = `Atue como um Engenheiro Metalúrgico Sênior, especialista em Laminação a Frio e Trefilação de fio máquina (aço baixo carbono). Estou com um problema de qualidade no meu processo.

DADOS DA MATÉRIA PRIMA:
- Bitola Fio Máquina: ${reportData.bitola_mp}mm
- Fornecedor: ${reportData.fornecedor || 'Desconhecido'}

SETUP DE REDUÇÃO (SAÍDA DOS CASSETES):
- K7-1: ${medias[0] || 'N/A'} mm
- K7-2: ${medias[1] || 'N/A'} mm
- K7-3: ${medias[2] || 'N/A'} mm
- K7-4: ${medias[3] || 'N/A'} mm

RESULTADOS DO ENSAIO FÍSICO (Falha):
- Escoamento: ${reportData.escoamento || 'N/A'} MPa (Mínimo Exigido: 600)
- Resistência: ${reportData.resistencia || 'N/A'} MPa (Mínimo Exigido: 660)
- Alongamento: ${reportData.alongamento || 'N/A'}% (Mínimo Exigido: 5%)
- Relação: ${relacao?.toFixed(3) || 'N/A'} (Mínimo: 1.05)

DIAGNÓSTICO INTERNO NOSSO SINALIZOU:
${aiInsights.map(i => i.text).join('\n')}

Por favor, faça uma análise aprofundada baseada nos números acima. 
1. O que pode estar causando essas falhas?
2. Quais ajustes de máquina (setup/espaçamento/tensão) ou análises na matéria-prima você recomenda para que eu consigo atingir os requisitos mínimos? 
`;

        navigator.clipboard.writeText(prompt).then(() => {
            alert("✅ O relatório técnico completo foi copiado para a sua área de transferência!\n\nAgora vamos abrir o ChatGPT. Basta você dar um 'Colar' (Ctrl+V) lá no chat para o assistente te ajudar!");
            window.open('https://chatgpt.com', '_blank');
        }).catch(() => {
            alert("Erro ao copiar. Seu navegador pode ter bloqueado esta ação.");
        });
    };

    const handleGoogleSearch = () => {
        const query = `problemas de laminação a frio fio maquina aço baixo carbono redução escoamento resistencia alongamento longo curto defeito de setup cassete rolos k7`;
        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
    };

    // Simple line chart component for the print version
    const ChartComponent = () => {
        const canvasRef = useRef<HTMLCanvasElement>(null);
        useEffect(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const W = 600;
            const H = 250;
            canvas.width = W;
            canvas.height = H;
            ctx.clearRect(0, 0, W, H);

            const activeStages = [
                { label: 'MP', value: bitolaMPNum || 0 },
                ...medias.map((m, i) => ({ label: `K7-${i + 1}`, value: m || 0 }))
            ].filter(s => s.value > 0);

            if (activeStages.length < 2) return;

            const padL = 40, padR = 20, padT = 30, padB = 30;
            const chartW = W - padL - padR;
            const chartH = H - padT - padB;

            const values = activeStages.map(s => s.value);
            const dataMax = Math.max(...values);
            const dataMin = Math.min(...values);
            const dataRange = dataMax - dataMin || 0.3;
            const maxVal = dataMax + dataRange * 0.1;
            const minVal = Math.max(0, dataMin - dataRange * 0.1);
            const range = maxVal - minVal || 1;

            ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
            for (let i = 0; i <= 4; i++) {
                const y = padT + (chartH / 4) * i;
                ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
                const val = maxVal - (range / 4) * i;
                ctx.fillStyle = '#64748b'; ctx.font = '12px sans-serif'; ctx.textAlign = 'right';
                ctx.fillText(val.toFixed(2), padL - 8, y + 4);
            }

            const positions = activeStages.map((s, i) => {
                const x = padL + (activeStages.length > 1 ? (chartW / (activeStages.length - 1)) * i : chartW / 2);
                const y = padT + chartH - ((s.value - minVal) / range) * chartH;
                return { x, y, ...s };
            });

            ctx.beginPath();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            positions.forEach((p, i) => {
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();

            positions.forEach(p => {
                ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                ctx.fillStyle = '#fff'; ctx.fill();
                ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();

                ctx.fillStyle = '#000'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
                ctx.fillText(p.value.toFixed(2), p.x, p.y - 10);

                ctx.fillStyle = '#475569'; ctx.font = '12px sans-serif';
                ctx.fillText(p.label, p.x, padT + chartH + 18);
            });
        }, []);

        return <canvas ref={canvasRef} className="w-full h-auto mt-4" style={{ maxWidth: '600px' }}></canvas>;
    };

    return createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] print-modal-container p-4">
            <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto print-modal-content print-section flex flex-col">
                {/* Header NO-PRINT */}
                <div className="flex justify-between items-center mb-6 no-print border-b pb-4">
                    <h2 className="text-2xl font-black text-slate-800">Visualizar Relatório</h2>
                    <div className="flex gap-3">
                        <button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl transition shadow-lg shadow-indigo-200">
                            🖨️ Imprimir PDF
                        </button>
                        <button onClick={onClose} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 px-6 rounded-xl transition">
                            Fechar
                        </button>
                    </div>
                </div>

                {/* Printable Content */}
                <div className="flex-1 bg-white text-black font-sans print-only-section">
                    <div className="border-4 border-black p-8 relative h-full flex flex-col">

                        {/* Logo / Header da Folha */}
                        <div className="flex justify-between items-center border-b-2 border-black pb-6 mb-6">
                            <div>
                                <h1 className="text-2xl font-black uppercase tracking-wider">Gestão Inteligente</h1>
                                <p className="text-sm font-bold uppercase tracking-widest text-gray-500">Laboratório e Qualidade</p>
                            </div>
                            <div className="text-right">
                                <h2 className="text-3xl font-black uppercase text-gray-800">Relatório de Ensaio</h2>
                                <p className="text-md font-bold mt-1">LOTE OFICIAL: <span className="text-xl bg-gray-200 px-2 rounded">{reportData.lote}</span></p>
                            </div>
                        </div>

                        {/* Metadados */}
                        <div className="grid grid-cols-4 gap-4 mb-8">
                            <div className="border border-black p-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Operador</p>
                                <p className="text-lg font-black uppercase">{reportData.operator || '—'}</p>
                            </div>
                            <div className="border border-black p-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Data / Hora</p>
                                <p className="text-lg font-black">{dateStr} {timeStr}</p>
                            </div>
                            <div className="border border-black p-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Bitola MP</p>
                                <p className="text-lg font-black">{reportData.bitola_mp} mm</p>
                            </div>
                            <div className="border border-black p-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Fornecedor</p>
                                <p className="text-lg font-black">{reportData.fornecedor}</p>
                            </div>
                        </div>

                        {/* Setup de Laminação - Tabela */}
                        <h3 className="text-lg font-black uppercase tracking-widest mb-3 border-b-2 border-dashed border-gray-300 pb-2">1. Setup de Laminação (Cassetes / K7)</h3>
                        <table className="w-full border-collapse border border-black text-center mb-8">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border border-black p-2 font-black uppercase text-xs w-1/5">Estágio</th>
                                    <th className="border border-black p-2 font-black uppercase text-xs w-1/5">Entrada (mm)</th>
                                    <th className="border border-black p-2 font-black uppercase text-xs w-1/5">Saída (mm)</th>
                                    <th className="border border-black p-2 font-black uppercase text-xs w-1/5">Média (mm)</th>
                                    <th className="border border-black p-2 font-black uppercase text-xs w-1/5">% Redução da Área</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[1, 2, 3, 4].map((k, i) => (
                                    <tr key={k}>
                                        <td className="border border-black p-3 font-bold bg-gray-50">{k}º K7</td>
                                        <td className="border border-black p-3">{n(k7Entradas[i])}</td>
                                        <td className="border border-black p-3">{n(k7Saidas[i])}</td>
                                        <td className="border border-black p-3 font-bold text-gray-800 bg-gray-50">{n(medias[i])}</td>
                                        <td className="border border-black p-3 font-black">
                                            {reducoes[i] !== null ? `${reducoes[i]!.toFixed(2)}%` : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Ensaios Físicos e Tração */}
                        <h3 className="text-lg font-black uppercase tracking-widest mb-3 border-b-2 border-dashed border-gray-300 pb-2">2. Resultados Laboratoriais</h3>
                        <div className="grid grid-cols-2 gap-8 mb-8">
                            <table className="w-full border-collapse border border-black text-left">
                                <tbody>
                                    <tr>
                                        <th className="border border-black p-3 bg-gray-100 font-bold uppercase text-xs w-1/2">Massa (g)</th>
                                        <td className="border border-black p-3 font-bold">{n(reportData.massa)}</td>
                                    </tr>
                                    <tr>
                                        <th className="border border-black p-3 bg-gray-100 font-bold uppercase text-xs">Comprimento (mm)</th>
                                        <td className="border border-black p-3 font-bold">{n(reportData.comprimento)}</td>
                                    </tr>
                                    <tr>
                                        <th className="border border-black p-3 bg-gray-200 font-black uppercase text-sm">Bitola Final (mm)</th>
                                        <td className="border border-black p-3 font-black text-lg bg-gray-50">{n(bitolaFinal)}</td>
                                    </tr>
                                </tbody>
                            </table>

                            <table className="w-full border-collapse border border-black text-left">
                                <thead>
                                    <tr>
                                        <th className="border border-black p-2 bg-gray-200 font-bold uppercase text-xs">Propriedade</th>
                                        <th className="border border-black p-2 bg-gray-200 font-bold uppercase text-xs text-center">Valor</th>
                                        <th className="border border-black p-2 bg-gray-200 font-bold uppercase text-xs text-center">Status Mínimo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <th className="border border-black p-2 bg-gray-100 font-bold uppercase text-xs">Escoamento <span className="text-[9px] font-normal text-gray-500 block">Mín: 600 MPa</span></th>
                                        <td className={`border border-black p-2 font-bold text-center ${escStatus.color}`}>{n(reportData.escoamento)}</td>
                                        <td className={`border border-black p-2 font-bold text-xs text-center ${escStatus.color}`}>{escStatus.label}</td>
                                    </tr>
                                    <tr>
                                        <th className="border border-black p-2 bg-gray-100 font-bold uppercase text-xs">Resistência <span className="text-[9px] font-normal text-gray-500 block">Mín: 660 MPa</span></th>
                                        <td className={`border border-black p-2 font-bold text-center ${resStatus.color}`}>{n(reportData.resistencia)}</td>
                                        <td className={`border border-black p-2 font-bold text-xs text-center ${resStatus.color}`}>{resStatus.label}</td>
                                    </tr>
                                    <tr>
                                        <th className="border border-black p-2 bg-gray-100 font-bold uppercase text-xs">Alongamento <span className="text-[9px] font-normal text-gray-500 block">Mín: 5%</span></th>
                                        <td className={`border border-black p-2 font-bold text-center ${aloStatus.color}`}>{n(reportData.alongamento)}</td>
                                        <td className={`border border-black p-2 font-bold text-xs text-center ${aloStatus.color}`}>{aloStatus.label}</td>
                                    </tr>
                                    <tr>
                                        <th className="border border-black p-2 bg-gray-100 font-black uppercase text-xs">Relação Auto <span className="text-[9px] font-normal text-gray-500 block">Mín: 1.05</span></th>
                                        <td className={`border border-black p-2 font-black text-center ${relStatus.color} bg-gray-50`}>{nd(relacao)}</td>
                                        <td className={`border border-black p-2 font-bold text-xs text-center ${relStatus.color} bg-gray-50`}>{relStatus.label}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Gráfico do Fluxo */}
                        <h3 className="text-lg font-black uppercase tracking-widest mb-2 border-b-2 border-dashed border-gray-300 pb-2">3. Fluxo de Redução</h3>
                        <div className="flex justify-center border border-black p-4 mb-8 bg-gray-50">
                            <ChartComponent />
                        </div>

                        {/* Diagnóstico de IA */}
                        <h3 className="text-lg font-black uppercase tracking-widest mb-2 border-b-2 border-dashed border-gray-300 pb-2 flex justify-between items-center">
                            <span>4. Parecer: Assistente Virtual (IA)</span>
                            <span className="text-xs font-medium text-gray-500 normal-case tracking-normal border border-gray-300 px-2 py-0.5 rounded-full">Análise Algorítmica</span>
                        </h3>
                        <div className={`p-5 mb-8 border-2 ${aiInsights.some(i => i.type === 'error') ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                            {aiInsights.map((insight, idx) => (
                                <p key={idx} className={`text-sm font-bold mb-3 last:mb-0 leading-relaxed ${insight.type === 'error' ? 'text-red-900' : 'text-emerald-900'}`}>
                                    {insight.text}
                                </p>
                            ))}

                            {/* Botoes de IA Externa - Ocultos na impressao */}
                            <div className="mt-4 flex gap-3 print:hidden">
                                {aiInsights.some(i => i.type === 'error') && (
                                    <>
                                        <button
                                            onClick={handleExternalAI}
                                            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-2"
                                        >
                                            <span className="text-lg">🤖</span> Consultar OpenAI Especialista
                                        </button>
                                        <button
                                            onClick={handleGoogleSearch}
                                            className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-2"
                                        >
                                            <span className="text-lg">🔍</span> Pesquisar Soluções na Web
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Spacer para empurrar assinaturas para baixo se houver espaço, mas aqui definimos margin top auto */}
                        <div className="mt-8 flex justify-between absolute bottom-8 left-8 right-8">
                            <div className="text-center w-64">
                                <div className="border-b border-black mb-2 pb-8"></div>
                                <p className="font-bold uppercase text-xs">Assinatura Operador</p>
                            </div>
                            <div className="text-center w-64">
                                <div className="border-b border-black mb-2 pb-8"></div>
                                <p className="font-bold uppercase text-xs">Assinatura Qualidade</p>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { margin: 0; size: A4; }
                    body * { visibility: hidden; }
                    .print-modal-container {
                        position: absolute;
                        left: 0;
                        top: 0;
                        margin: 0;
                        padding: 0;
                        background: white;
                        width: 100%;
                    }
                    .print-modal-content {
                        box-shadow: none;
                        width: 100%;
                        max-width: none;
                        margin: 0;
                        padding: 0 !important;
                    }
                    .no-print { display: none !important; }
                    .print-section, .print-section * { visibility: visible; }
                    .print-only-section { 
                        position: absolute; 
                        left: 0; 
                        top: 0;
                        width: 100%;
                        padding: 1cm;
                    }
                }
            `}} />
        </div>,
        document.body
    );
};

export default LabReportModal;
