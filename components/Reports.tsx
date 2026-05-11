import React, { useState, useEffect, useMemo } from 'react';
import type { Page, StockItem, ProductionRecord } from '../types';
import { supabase } from '../services/supabaseService';
import html2canvas from 'html2canvas';

interface ReportsProps {
    stock: StockItem[];
    trefilaProduction: ProductionRecord[];
    trelicaProduction: ProductionRecord[];
    setPage: (page: Page) => void;
}

// Interfaces locais para estruturação do Relatório da Treliça
interface StopRow {
    id: string;
    inicio: string; // "hh:mm:ss"
    fim: string;    // "hh:mm:ss"
    motivo: string;
}

interface ShiftStats {
    horasTrabalhadas: string; // Padrão "09:00:00"
    pecasProduzidas: number;
    tamanhoPeca: number;      // Metros por peça (ex: 6 ou 12)
}

interface ProductionUpdateRow {
    id: string;
    qnt: number;
    peso: number;
    data: string; // ex: "1-04"
}

// Tipo de Notificação
interface Toast {
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    id: string;
}

const Reports: React.FC<ReportsProps> = ({ stock, setPage }) => {
    // 1. Estados de Controle da Página
    const [selectedMachine, setSelectedMachine] = useState<'Treliça 1' | 'Treliça 2'>('Treliça 1');
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        return new Date().toLocaleDateString('sv'); // Data local YYYY-MM-DD
    });
    const [loading, setLoading] = useState<boolean>(false);
    const [reportId, setReportId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [toasts, setToasts] = useState<Toast[]>([]);

    // 2. Estados dos Campos do Formulário
    const [productionOrder, setProductionOrder] = useState<string>('');
    const [operatorShiftA, setOperatorShiftA] = useState<string>('');
    const [operatorShiftB, setOperatorShiftB] = useState<string>('');
    const [productDescription, setProductDescription] = useState<string>('TRELIÇA H-12 LEVE 6 MTS');
    const [piecesToProduce, setPiecesToProduce] = useState<number>(4500);

    // Tabelas de paradas
    const [stopsShiftA, setStopsShiftA] = useState<StopRow[]>([]);
    const [stopsShiftB, setStopsShiftB] = useState<StopRow[]>([]);

    // Estatísticas dos turnos
    const [statsShiftA, setStatsShiftA] = useState<ShiftStats>({
        horasTrabalhadas: '09:00:00',
        pecasProduzidas: 0,
        tamanhoPeca: 12
    });
    const [statsShiftB, setStatsShiftB] = useState<ShiftStats>({
        horasTrabalhadas: '09:00:00',
        pecasProduzidas: 0,
        tamanhoPeca: 6
    });

    // Tabela de atualização da produção (rodapé)
    const [productionUpdates, setProductionUpdates] = useState<ProductionUpdateRow[]>([]);

    // Estado para guiar se o banco está ativo ou usando localStorage
    const [dbAvailable, setDbAvailable] = useState<boolean>(true);

    // 3. Sistema de Toasts
    const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { message, type, id }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    };

    // 4. Helpers de Cálculo de Horas e Tempos
    const timeToSeconds = (timeStr: string): number => {
        if (!timeStr) return 0;
        const parts = timeStr.trim().split(':');
        const hrs = parseInt(parts[0], 10) || 0;
        const mins = parseInt(parts[1], 10) || 0;
        const secs = parseInt(parts[2], 10) || 0;
        return hrs * 3600 + mins * 60 + secs;
    };

    const secondsToTime = (totalSeconds: number): string => {
        if (totalSeconds <= 0 || isNaN(totalSeconds)) return '00:00:00';
        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = Math.floor(totalSeconds % 60);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    };

    const calculateStopDurationSeconds = (inicio: string, fim: string): number => {
        if (!inicio || !fim) return 0;
        let diff = timeToSeconds(fim) - timeToSeconds(inicio);
        if (diff < 0) diff += 24 * 3600; // Dobra de meia-noite
        return diff;
    };

    // Formata data em português abreviado conforme a foto (ex: "qua, 1 de abril de 2026")
    const formattedProductionDate = useMemo(() => {
        if (!selectedDate) return '';
        const parts = selectedDate.split('-');
        const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        
        // Obter dia da semana abreviado
        const weekdays = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
        const dayName = weekdays[dateObj.getDay()];
        
        const day = dateObj.getDate();
        const year = dateObj.getFullYear();
        const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'long' });
        
        return `${dayName}, ${day} de ${monthName} de ${year}`;
    }, [selectedDate]);

    // 5. Cálculos em Tempo Real
    const calculatedData = useMemo(() => {
        // Soma as paradas do Turno A
        const secondsParadoA = stopsShiftA.reduce((sum, stop) => {
            return sum + calculateStopDurationSeconds(stop.inicio, stop.fim);
        }, 0);

        // Soma as paradas do Turno B
        const secondsParadoB = stopsShiftB.reduce((sum, stop) => {
            return sum + calculateStopDurationSeconds(stop.inicio, stop.fim);
        }, 0);

        // Horas totais trabalhadas
        const totalWorkedA = timeToSeconds(statsShiftA.horasTrabalhadas) || 9 * 3600;
        const totalWorkedB = timeToSeconds(statsShiftB.horasTrabalhadas) || 9 * 3600;

        // Turno A
        const percentParadoA = totalWorkedA > 0 ? (secondsParadoA / totalWorkedA) * 100 : 0;
        const secondsEfetivoA = Math.max(0, totalWorkedA - secondsParadoA);
        const percentEfetivoA = totalWorkedA > 0 ? (secondsEfetivoA / totalWorkedA) * 100 : 0;

        // Turno B
        const percentParadoB = totalWorkedB > 0 ? (secondsParadoB / totalWorkedB) * 100 : 0;
        const secondsEfetivoB = Math.max(0, totalWorkedB - secondsParadoB);
        const percentEfetivoB = totalWorkedB > 0 ? (secondsEfetivoB / totalWorkedB) * 100 : 0;

        // Produção em metros
        const metrosProduzidosA = statsShiftA.pecasProduzidas * statsShiftA.tamanhoPeca;
        const metrosProduzidosB = statsShiftB.pecasProduzidas * statsShiftB.tamanhoPeca;

        // Tempo por peça
        const tempoPorPecaSecondsA = statsShiftA.pecasProduzidas > 0 ? (secondsEfetivoA / statsShiftA.pecasProduzidas) : 0;
        const tempoPorPecaSecondsB = statsShiftB.pecasProduzidas > 0 ? (secondsEfetivoB / statsShiftB.pecasProduzidas) : 0;

        // Velocidade (metros por minuto)
        const velocidadeMinutoA = secondsEfetivoA > 0 ? (metrosProduzidosA / (secondsEfetivoA / 60)) : 0;
        const velocidadeMinutoB = secondsEfetivoB > 0 ? (metrosProduzidosB / (secondsEfetivoB / 60)) : 0;

        // Soma total das peças
        const totalPecasProduzidas = statsShiftA.pecasProduzidas + statsShiftB.pecasProduzidas;

        return {
            totalPecasProduzidas,
            turnoA: {
                tempoParadoStr: secondsToTime(secondsParadoA),
                percentParado: percentParadoA.toFixed(1).replace('.', ','),
                tempoEfetivoStr: secondsToTime(secondsEfetivoA),
                percentEfetivo: percentEfetivoA.toFixed(1).replace('.', ','),
                metrosProduzidos: metrosProduzidosA,
                tempoPorPecaStr: secondsToTime(Math.floor(tempoPorPecaSecondsA)),
                velocidadeStr: `${velocidadeMinutoA.toFixed(1).replace('.', ',')} metros/ minuto`
            },
            turnoB: {
                tempoParadoStr: secondsToTime(secondsParadoB),
                percentParado: percentParadoB.toFixed(1).replace('.', ','),
                tempoEfetivoStr: secondsToTime(secondsEfetivoB),
                percentEfetivo: percentEfetivoB.toFixed(1).replace('.', ','),
                metrosProduzidos: metrosProduzidosB,
                tempoPorPecaStr: secondsToTime(Math.floor(tempoPorPecaSecondsB)),
                velocidadeStr: `${velocidadeMinutoB.toFixed(1).replace('.', ',')} metros/ minuto`
            }
        };
    }, [stopsShiftA, stopsShiftB, statsShiftA, statsShiftB]);

    // 6. Efeito para carregar relatório do banco ou localStorage
    useEffect(() => {
        const loadReport = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('trelica_daily_reports')
                    .select('*')
                    .eq('date', selectedDate)
                    .eq('machine_type', selectedMachine)
                    .maybeSingle();

                if (error) {
                    if (error.code === '42P01') {
                        setDbAvailable(false);
                        loadLocalReport();
                    } else {
                        throw error;
                    }
                } else if (data) {
                    setDbAvailable(true);
                    setReportId(data.id);
                    setProductionOrder(data.production_order || '');
                    setOperatorShiftA(data.operator_shift_a || '');
                    setOperatorShiftB(data.operator_shift_b || '');
                    setProductDescription(data.product_description || 'TRELIÇA H-12 LEVE 6 MTS');
                    setPiecesToProduce(Number(data.pieces_to_produce ?? 4500));
                    setStopsShiftA(data.stops_shift_a || []);
                    setStopsShiftB(data.stops_shift_b || []);
                    setStatsShiftA(data.stats_shift_a || { horasTrabalhadas: '09:00:00', pecasProduzidas: 0, tamanhoPeca: 12 });
                    setStatsShiftB(data.stats_shift_b || { horasTrabalhadas: '09:00:00', pecasProduzidas: 0, tamanhoPeca: 6 });
                    setProductionUpdates(data.production_updates || []);
                    showToast(`Relatório de ${selectedMachine} carregado da nuvem.`, 'success');
                } else {
                    loadLocalReport();
                }
            } catch (err: any) {
                console.error(err);
                setDbAvailable(false);
                loadLocalReport();
            } finally {
                setLoading(false);
            }
        };

        const loadLocalReport = () => {
            const localKey = `trelica_report_${selectedMachine}_${selectedDate}`;
            const localData = localStorage.getItem(localKey);
            if (localData) {
                try {
                    const parsed = JSON.parse(localData);
                    setReportId(parsed.id || null);
                    setProductionOrder(parsed.production_order || '');
                    setOperatorShiftA(parsed.operator_shift_a || '');
                    setOperatorShiftB(parsed.operator_shift_b || '');
                    setProductDescription(parsed.product_description || 'TRELIÇA H-12 LEVE 6 MTS');
                    setPiecesToProduce(Number(parsed.pieces_to_produce ?? 4500));
                    setStopsShiftA(parsed.stops_shift_a || []);
                    setStopsShiftB(parsed.stops_shift_b || []);
                    setStatsShiftA(parsed.stats_shift_a || { horasTrabalhadas: '09:00:00', pecasProduzidas: 0, tamanhoPeca: 12 });
                    setStatsShiftB(parsed.stats_shift_b || { horasTrabalhadas: '09:00:00', pecasProduzidas: 0, tamanhoPeca: 6 });
                    setProductionUpdates(parsed.production_updates || []);
                    showToast(`Relatório carregado offline.`, 'info');
                } catch (e) {
                    resetFormToDefault();
                }
            } else {
                resetFormToDefault();
            }
        };

        loadReport();
    }, [selectedMachine, selectedDate]);

    const resetFormToDefault = () => {
        setReportId(null);
        setProductionOrder('');
        setOperatorShiftA('');
        setOperatorShiftB('');
        setProductDescription('TRELIÇA H-12 LEVE 6 MTS');
        setPiecesToProduce(4500);
        setStopsShiftA([]);
        setStopsShiftB([]);
        setStatsShiftA({ horasTrabalhadas: '09:00:00', pecasProduzidas: 0, tamanhoPeca: 12 });
        setStatsShiftB({ horasTrabalhadas: '09:00:00', pecasProduzidas: 0, tamanhoPeca: 6 });
        setProductionUpdates([]);
    };

    // Salvar relatório
    const handleSaveReport = async () => {
        setIsSaving(true);
        const reportData = {
            date: selectedDate,
            machine_type: selectedMachine,
            production_order: productionOrder,
            operator_shift_a: operatorShiftA,
            operator_shift_b: operatorShiftB,
            product_description: productDescription,
            pieces_to_produce: piecesToProduce,
            stops_shift_a: stopsShiftA,
            stops_shift_b: stopsShiftB,
            stats_shift_a: statsShiftA,
            stats_shift_b: statsShiftB,
            production_updates: productionUpdates,
        };

        const localKey = `trelica_report_${selectedMachine}_${selectedDate}`;
        localStorage.setItem(localKey, JSON.stringify({ id: reportId || `local_${Date.now()}`, ...reportData }));

        try {
            if (dbAvailable) {
                const payload = reportId ? { id: reportId, ...reportData } : reportData;
                const { data, error } = await supabase
                    .from('trelica_daily_reports')
                    .upsert(payload, { onConflict: 'date,machine_type' })
                    .select()
                    .single();

                if (error) throw error;
                if (data) {
                    setReportId(data.id);
                    localStorage.setItem(localKey, JSON.stringify(data));
                }
                showToast(`Salvo na nuvem com sucesso!`, 'success');
            } else {
                showToast(`Salvo localmente (Offline).`, 'warning');
            }
        } catch (err: any) {
            console.error(err);
            setDbAvailable(false);
            showToast(`Erro ao salvar online. Salvo offline.`, 'warning');
        } finally {
            setIsSaving(false);
        }
    };

    // Preencher exatamente com os dados da foto
    const handleLoadSampleData = () => {
        setSelectedDate('2026-04-01');
        setProductionOrder('');
        setOperatorShiftA('Adrian/ junior');
        setOperatorShiftB('Alceu/ thiago');
        setProductDescription('TRELIÇA H-12 LEVE 6 MTS');
        setPiecesToProduce(4500);

        setStopsShiftB([
            { id: 'sb-1', inicio: '15:15:00', fim: '15:28:00', motivo: 'troca de rolo inferior lado direito' },
            { id: 'sb-2', inicio: '15:33:00', fim: '15:43:00', motivo: 'alinhamento da peça' },
            { id: 'sb-3', inicio: '16:10:00', fim: '16:24:00', motivo: 'troca de rolo inferior lado esquerdo' },
            { id: 'sb-4', inicio: '16:33:00', fim: '16:45:00', motivo: 'alinhamento da peça' },
            { id: 'sb-5', inicio: '18:19:00', fim: '18:34:00', motivo: 'enrosco na calha' },
            { id: 'sb-6', inicio: '19:54:00', fim: '20:18:00', motivo: 'enrosco no pisador de dobra fixa' },
            { id: 'sb-7', inicio: '22:11:00', fim: '22:38:00', motivo: 'enrosco no pisador de dobra fixa' }
        ]);

        setStopsShiftA([
            { id: 'sa-1', inicio: '05:00:00', fim: '05:18:00', motivo: 'lubrificação' },
            { id: 'sa-2', inicio: '05:22:00', fim: '05:48:00', motivo: 'enrosco no fio sinuzoide' },
            { id: 'sa-3', inicio: '06:10:00', fim: '06:33:00', motivo: 'enrosco no pisador de dobra fixa' },
            { id: 'sa-4', inicio: '06:44:00', fim: '07:01:00', motivo: 'enrosco no pisador de dobra fixa' },
            { id: 'sa-5', inicio: '08:44:00', fim: '09:13:00', motivo: 'quebra de fio sinuzoide' },
            { id: 'sa-6', inicio: '11:10:00', fim: '11:18:00', motivo: 'enrosco no pisador de dobra fixa' }
        ]);

        setStatsShiftA({
            horasTrabalhadas: '09:00:00',
            pecasProduzidas: 488,
            tamanhoPeca: 12
        });

        setStatsShiftB({
            horasTrabalhadas: '09:00:00',
            pecasProduzidas: 493,
            tamanhoPeca: 6
        });

        setProductionUpdates([
            { id: 'pu-1', qnt: 981, peso: 3453, data: '1-04' },
            { id: 'pu-2', qnt: 981, peso: 3453, data: '' }
        ]);

        showToast('Dados do modelo da foto carregados!', 'success');
    };

    // Operações de linhas de tabelas
    const addStopRow = (shift: 'A' | 'B') => {
        const newStop: StopRow = {
            id: Math.random().toString(36).substring(2, 9),
            inicio: '00:00:00',
            fim: '00:00:00',
            motivo: ''
        };
        if (shift === 'A') setStopsShiftA([...stopsShiftA, newStop]);
        else setStopsShiftB([...stopsShiftB, newStop]);
    };

    const removeStopRow = (shift: 'A' | 'B', id: string) => {
        if (shift === 'A') setStopsShiftA(stopsShiftA.filter(r => r.id !== id));
        else setStopsShiftB(stopsShiftB.filter(r => r.id !== id));
    };

    const updateStopField = (shift: 'A' | 'B', id: string, field: keyof StopRow, value: string) => {
        const updater = (rows: StopRow[]) => rows.map(r => r.id === id ? { ...r, [field]: value } : r);
        if (shift === 'A') setStopsShiftA(updater);
        else setStopsShiftB(updater);
    };

    const addProductionUpdateRow = () => {
        const newRow: ProductionUpdateRow = {
            id: Math.random().toString(36).substring(2, 9),
            qnt: calculatedData.totalPecasProduzidas || 981,
            peso: 3453,
            data: '1-04'
        };
        setProductionUpdates([...productionUpdates, newRow]);
    };

    const removeProductionUpdateRow = (id: string) => {
        setProductionUpdates(productionUpdates.filter(r => r.id !== id));
    };

    const updateProductionUpdateField = (id: string, field: keyof ProductionUpdateRow, value: any) => {
        setProductionUpdates(productionUpdates.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const copyToClipboard = async () => {
        try {
            const element = document.getElementById('trelica-report-sheet');
            if (!element) return;
            
            showToast('Gerando imagem de alta resolução...', 'info');
            
            // Ativa o estilo de captura limpo (idêntico à impressão)
            element.classList.add('is-capturing');
            
            // Pequeno delay para garantir o repaint do navegador
            await new Promise(resolve => setTimeout(resolve, 80));
            
            const canvas = await html2canvas(element, {
                scale: 2, // Alta resolução para legibilidade perfeita no WhatsApp
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });
            
            // Remove o estilo de captura imediatamente após gerar o canvas
            element.classList.remove('is-capturing');
            
            canvas.toBlob(async (blob) => {
                if (blob) {
                    try {
                        await navigator.clipboard.write([
                            new ClipboardItem({
                                [blob.type]: blob
                            })
                        ]);
                        showToast('Imagem copiada para a área de transferência! Cole (Ctrl+V) no WhatsApp.', 'success');
                    } catch (err) {
                        console.error('Falha ao copiar:', err);
                        // Fallback: download as image
                        const link = document.createElement('a');
                        link.download = `Relatorio_Trelica_${selectedDate}.png`;
                        link.href = canvas.toDataURL();
                        link.click();
                        showToast('Baixamos o relatório como imagem! Envie o arquivo no WhatsApp.', 'info');
                    }
                }
            }, 'image/png');
        } catch (e) {
            console.error(e);
            // Garante que a classe de captura seja removida em caso de erro
            const element = document.getElementById('trelica-report-sheet');
            if (element) element.classList.remove('is-capturing');
            showToast('Erro ao gerar imagem.', 'error');
        }
    };

    return (
        <div className="p-4 sm:p-6 md:p-8 bg-slate-50 min-h-screen font-mono text-slate-800 relative select-none">
            
            {/* CSS de Alta Fidelidade com o Layout impresso da foto */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media screen {
                    .worksheet-input {
                        border: 1px solid #cbd5e1 !important;
                        background-color: #ffffff !important;
                        border-radius: 4px !important;
                        padding: 3px 6px !important;
                        font-weight: bold !important;
                        font-family: inherit !important;
                        font-size: 12px !important;
                        transition: all 0.2s;
                    }
                    .worksheet-input:focus {
                        border-color: #3b82f6 !important;
                        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15) !important;
                        background-color: #f8fafc !important;
                        outline: none !important;
                    }
                }
                @media print {
                    body {
                        background: white !important;
                        color: black !important;
                        font-family: 'Arial', 'Helvetica', sans-serif !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .print-sheet {
                        padding: 0 !important;
                        margin: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                    }
                    input {
                        border: none !important;
                        background: transparent !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        pointer-events: none !important;
                    }
                    .worksheet-input {
                        border: none !important;
                        background: transparent !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        pointer-events: none !important;
                        font-size: 12px !important;
                    }
                    .input-center {
                        text-align: center !important;
                    }
                }
                
                /* Layout Fita Preta Estilo Formulário Papel */
                .worksheet-container {
                    font-family: 'Arial', 'Helvetica', sans-serif;
                }
                .worksheet-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .worksheet-table td, .worksheet-table th {
                    border: 1px solid #1e293b;
                    padding: 5px 10px;
                    font-size: 13px;
                }
                .stops-grid-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .stops-grid-table td {
                    border: 1px solid #94a3b8;
                    padding: 3px 6px;
                    font-size: 11px;
                }
                .stats-container-box {
                    border: 1.5px solid #1e293b;
                    padding: 10px 15px;
                    font-size: 13px;
                    line-height: 1.6;
                }

                /* ESTILOS DE CAPTURA DO WHATSAPP (IDÊNTICO À IMPRESSÃO) */
                .is-capturing .no-print {
                    display: none !important;
                }
                .is-capturing {
                    padding: 24px !important;
                    margin: 0 auto !important;
                    box-shadow: none !important;
                    border: 1px solid #1e293b !important;
                }
                .is-capturing input {
                    border: none !important;
                    background: transparent !important;
                    padding: 0 !important;
                    box-shadow: none !important;
                    pointer-events: none !important;
                }
                .is-capturing .worksheet-input {
                    border: none !important;
                    background: transparent !important;
                    padding: 0 !important;
                    box-shadow: none !important;
                    pointer-events: none !important;
                    font-size: 12px !important;
                }
            `}} />

            {/* Toasts de Notificação */}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none no-print">
                {toasts.map(t => (
                    <div 
                        key={t.id} 
                        className={`p-3 rounded shadow border text-white font-bold text-xs flex items-center gap-2 pointer-events-auto max-w-sm ${
                            t.type === 'success' ? 'bg-emerald-600 border-emerald-500' :
                            t.type === 'error' ? 'bg-rose-600 border-rose-500' :
                            'bg-slate-800 border-slate-700'
                        }`}
                    >
                        <span>{t.message}</span>
                    </div>
                ))}
            </div>

            {/* Menu Admin - No Print */}
            <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 pb-4 border-b border-slate-200 no-print gap-4">
                <div>
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2 uppercase">
                        📋 Formato Ficha de Papel Treliça
                    </h1>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <button
                        onClick={handleLoadSampleData}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-1.5 px-3 rounded text-xs shadow"
                    >
                        ⭐ Carregar Modelo da Foto
                    </button>

                    <button
                        onClick={copyToClipboard}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded text-xs shadow flex items-center gap-1"
                    >
                        🟢 Copiar Imagem (Zap)
                    </button>

                    <button
                        onClick={() => window.print()}
                        className="bg-slate-700 hover:bg-slate-800 text-white font-bold py-1.5 px-3 rounded text-xs shadow"
                    >
                        🖨️ Imprimir Ficha
                    </button>

                    <button
                        onClick={handleSaveReport}
                        disabled={isSaving}
                        className="bg-slate-900 hover:bg-black text-white font-bold py-1.5 px-3 rounded text-xs shadow"
                    >
                        {isSaving ? 'Salvando...' : '💾 Salvar Relatório'}
                    </button>

                    <button
                        onClick={resetFormToDefault}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-1.5 px-2 rounded text-xs"
                    >
                        Limpar
                    </button>
                </div>
            </header>

            {/* Filtros - No Print */}
            <section className="bg-white p-4 rounded border border-slate-200 shadow-sm mb-4 flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
                <div className="flex bg-slate-100 p-1 rounded border border-slate-200 w-full sm:w-auto">
                    {(['Treliça 1', 'Treliça 2'] as const).map(machine => (
                        <button
                            key={machine}
                            onClick={() => setSelectedMachine(machine)}
                            className={`py-1 px-4 rounded font-bold text-xs transition-all ${
                                selectedMachine === machine
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            {machine}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <span className="font-bold text-slate-700 text-xs">Data:</span>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="p-1 border border-slate-300 rounded text-xs font-bold text-slate-800"
                    />
                </div>
            </section>

            {/* Ficha Técnica de Papel - ALTA FIDELIDADE */}
            {loading ? (
                <div className="bg-white p-16 border rounded shadow-sm text-center font-bold">
                    Carregando dados...
                </div>
            ) : (
                <div id="trelica-report-sheet" className="bg-white p-6 md:p-10 shadow-lg border border-slate-300 max-w-5xl mx-auto worksheet-container print-sheet">
                    
                    {/* Tabela do Cabeçalho - Idêntica à Foto */}
                    <table className="worksheet-table mb-6">
                        <tbody>
                            {/* Linha 1: Logo e Título */}
                            <tr>
                                <td style={{ width: '180px', verticalAlign: 'middle', textAlign: 'center' }} className="p-1">
                                    <div className="flex items-center justify-center bg-white">
                                        <img 
                                            src="/ita-acos-logo.png" 
                                            alt="Logo Grupo Ita Aços" 
                                            className="h-10 object-contain mx-auto" 
                                            style={{ maxHeight: '42px', display: 'block' }}
                                        />
                                    </div>
                                </td>
                                <td className="text-center font-black p-2 text-slate-900" style={{ fontSize: '15px', textTransform: 'uppercase', lineHeight: '1.2' }}>
                                    CONTROLE DE PRODUÇÃO DIARIA- SETOR LAMINAÇÃO <br />
                                    <span style={{ fontSize: '14px' }}>TRELIÇA</span>
                                </td>
                            </tr>
                            {/* Linha 2: Ordem de Produção */}
                            <tr>
                                <td colSpan={2} className="p-1">
                                    <div className="flex items-center gap-2 pl-2">
                                        <span className="font-bold text-xs text-slate-800 whitespace-nowrap">Ordem de produção :</span>
                                        <input
                                            type="text"
                                            value={productionOrder}
                                            onChange={e => setProductionOrder(e.target.value)}
                                            className="w-full worksheet-input"
                                            placeholder="Digite..."
                                        />
                                    </div>
                                </td>
                            </tr>

                            {/* Linha 3: Data de Produção */}
                            <tr>
                                <td colSpan={2} className="p-1">
                                    <div className="flex items-center gap-2 pl-2 py-1">
                                        <span className="font-bold text-xs text-slate-800 whitespace-nowrap">Data da produção:</span>
                                        <span className="font-bold text-xs text-slate-800">{formattedProductionDate}</span>
                                    </div>
                                </td>
                            </tr>

                            {/* Linha 4: Operador Turno A */}
                            <tr>
                                <td colSpan={2} className="p-1">
                                    <div className="flex items-center gap-2 pl-2">
                                        <span className="font-bold text-xs text-slate-800 whitespace-nowrap">Operador/auxiliar turno A:</span>
                                        <input
                                            type="text"
                                            value={operatorShiftA}
                                            onChange={e => setOperatorShiftA(e.target.value)}
                                            className="w-full worksheet-input"
                                            placeholder="Insira..."
                                        />
                                    </div>
                                </td>
                            </tr>

                            {/* Linha 5: Operador Turno B */}
                            <tr>
                                <td colSpan={2} className="p-1">
                                    <div className="flex items-center gap-2 pl-2">
                                        <span className="font-bold text-xs text-slate-800 whitespace-nowrap">Operador/auxiliar turno B:</span>
                                        <input
                                            type="text"
                                            value={operatorShiftB}
                                            onChange={e => setOperatorShiftB(e.target.value)}
                                            className="w-full worksheet-input"
                                            placeholder="Insira..."
                                        />
                                    </div>
                                </td>
                            </tr>                            {/* Linha 6: Descrição do produto */}
                            <tr>
                                <td colSpan={2} className="p-1">
                                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between pl-2 pr-4 gap-2 py-0.5">
                                        <div className="flex items-center gap-1.5 w-full md:w-auto">
                                            <span className="font-bold text-xs text-slate-800 whitespace-nowrap">Descrição do produto:</span>
                                            <input
                                                type="text"
                                                value={productDescription}
                                                onChange={e => setProductDescription(e.target.value)}
                                                className="w-full md:w-80 worksheet-input"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1 text-xs">
                                            <span className="font-bold text-slate-800 whitespace-nowrap">Qnt. De peças produzidas:</span>
                                            <span className="font-black text-slate-950 text-lg underline ml-1">{calculatedData.totalPecasProduzidas} peças</span>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    {/* SEÇÃO DE PARADAS LADO A LADO - IDÊNTICA À FOTO */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                        
                        {/* PARADAS TURNO A (LADO ESQUERDO) */}
                        <div className="flex flex-col">
                            <div className="flex items-center justify-between mb-1">
                                <h4 className="text-center font-bold text-xs uppercase underline tracking-wider w-full pr-8">
                                    PARADAS E SEUS MOTIVOS: TURNO A
                                </h4>
                                <button
                                    onClick={() => addStopRow('A')}
                                    className="bg-slate-800 hover:bg-black text-white font-bold text-[10px] px-2 py-0.5 rounded no-print whitespace-nowrap flex-shrink-0"
                                >
                                    + Linha A
                                </button>
                            </div>

                            <table className="stops-grid-table">
                                <tbody>
                                    {stopsShiftA.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="text-center py-4 text-slate-400 italic font-bold">
                                                Nenhuma parada no Turno A (Clique em "+ Linha A")
                                            </td>
                                        </tr>
                                    ) : (
                                        stopsShiftA.map(stop => {
                                            const durationSecs = calculateStopDurationSeconds(stop.inicio, stop.fim);
                                            return (
                                                <tr key={stop.id} className="hover:bg-slate-50">
                                                    {/* Hora Inicial (Vermelho na foto) */}
                                                    <td style={{ width: '85px', textAlign: 'center' }} className="p-0.5">
                                                        <input
                                                            type="text"
                                                            value={stop.inicio}
                                                            onChange={e => updateStopField('A', stop.id, 'inicio', e.target.value)}
                                                            className="text-center w-20 worksheet-input text-[#dc2626]"
                                                            placeholder="00:00:00"
                                                        />
                                                    </td>
                                                    {/* Hora Final (Verde na foto) */}
                                                    <td style={{ width: '85px', textAlign: 'center' }} className="p-0.5">
                                                        <input
                                                            type="text"
                                                            value={stop.fim}
                                                            onChange={e => updateStopField('A', stop.id, 'fim', e.target.value)}
                                                            className="text-center w-20 worksheet-input text-[#16a34a]"
                                                            placeholder="00:00:00"
                                                        />
                                                    </td>
                                                    {/* Motivo (Texto normal) */}
                                                    <td className="p-0.5 text-left pl-2">
                                                        <input
                                                            type="text"
                                                            value={stop.motivo}
                                                            onChange={e => updateStopField('A', stop.id, 'motivo', e.target.value)}
                                                            className="text-left w-full worksheet-input text-slate-800"
                                                            placeholder="Motivo..."
                                                        />
                                                    </td>
                                                    {/* Duração (Vermelho na foto) */}
                                                    <td style={{ width: '75px', textAlign: 'center', color: '#dc2626' }} className="p-0.5 font-bold text-center text-xs">
                                                        <div className="flex items-center justify-between px-1">
                                                            <span className="w-full text-center">{secondsToTime(durationSecs)}</span>
                                                            <button
                                                                onClick={() => removeStopRow('A', stop.id)}
                                                                className="text-rose-600 hover:text-rose-800 font-extrabold no-print ml-1"
                                                                title="Remover parada"
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* PARADAS TURNO B (LADO DIREITO) */}
                        <div className="flex flex-col">
                            <div className="flex items-center justify-between mb-1">
                                <h4 className="text-center font-bold text-xs uppercase underline tracking-wider w-full pr-8">
                                    PARADAS E SEUS MOTIVOS: TURNO B
                                </h4>
                                <button
                                    onClick={() => addStopRow('B')}
                                    className="bg-slate-800 hover:bg-black text-white font-bold text-[10px] px-2 py-0.5 rounded no-print whitespace-nowrap flex-shrink-0"
                                >
                                    + Linha B
                                </button>
                            </div>

                            <table className="stops-grid-table">
                                <tbody>
                                    {stopsShiftB.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="text-center py-4 text-slate-400 italic font-bold">
                                                Nenhuma parada no Turno B (Clique em "+ Linha B")
                                            </td>
                                        </tr>
                                    ) : (
                                        stopsShiftB.map(stop => {
                                            const durationSecs = calculateStopDurationSeconds(stop.inicio, stop.fim);
                                            return (
                                                <tr key={stop.id} className="hover:bg-slate-50">
                                                    {/* Hora Inicial (Vermelho na foto) */}
                                                    <td style={{ width: '85px', textAlign: 'center' }} className="p-0.5">
                                                        <input
                                                            type="text"
                                                            value={stop.inicio}
                                                            onChange={e => updateStopField('B', stop.id, 'inicio', e.target.value)}
                                                            className="text-center w-20 worksheet-input text-[#dc2626]"
                                                            placeholder="00:00:00"
                                                        />
                                                    </td>
                                                    {/* Hora Final (Verde na foto) */}
                                                    <td style={{ width: '85px', textAlign: 'center' }} className="p-0.5">
                                                        <input
                                                            type="text"
                                                            value={stop.fim}
                                                            onChange={e => updateStopField('B', stop.id, 'fim', e.target.value)}
                                                            className="text-center w-20 worksheet-input text-[#16a34a]"
                                                            placeholder="00:00:00"
                                                        />
                                                    </td>
                                                    {/* Motivo (Texto normal) */}
                                                    <td className="p-0.5 text-left pl-2">
                                                        <input
                                                            type="text"
                                                            value={stop.motivo}
                                                            onChange={e => updateStopField('B', stop.id, 'motivo', e.target.value)}
                                                            className="text-left w-full worksheet-input text-slate-800"
                                                            placeholder="Motivo..."
                                                        />
                                                    </td>
                                                    {/* Duração (Vermelho na foto) */}
                                                    <td style={{ width: '75px', textAlign: 'center', color: '#dc2626' }} className="p-0.5 font-bold text-center text-xs">
                                                        <div className="flex items-center justify-between px-1">
                                                            <span className="w-full text-center">{secondsToTime(durationSecs)}</span>
                                                            <button
                                                                onClick={() => removeStopRow('B', stop.id)}
                                                                className="text-rose-600 hover:text-rose-800 font-extrabold no-print ml-1"
                                                                title="Remover parada"
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                    </div>

                    {/* SEÇÃO DE ESTATÍSTICA DO DIA LADO A LADO - IDÊNTICA À FOTO */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                        
                        {/* ESTATÍSTICA DO DIA TURNO A */}
                        <div className="stats-container-box">
                            <h4 className="text-center font-bold text-xs uppercase underline tracking-wider mb-3">
                                ESTATÍSTICA DO DIA: TURNO A
                            </h4>
                            <div className="space-y-1.5 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-800">Horas (Turno trabalhados):</span>
                                    <input
                                        type="text"
                                        value={statsShiftA.horasTrabalhadas}
                                        onChange={e => setStatsShiftA({ ...statsShiftA, horasTrabalhadas: e.target.value })}
                                        className="font-bold text-center text-slate-900 w-24 worksheet-input text-xs"
                                    />
                                </div>
                                
                                <div className="flex justify-between items-center text-[#dc2626] font-bold">
                                    <span>Tempo de maquina (parada) :</span>
                                    <div className="flex gap-4">
                                        <span>{calculatedData.turnoA.tempoParadoStr}</span>
                                        <span className="w-12 text-right">{calculatedData.turnoA.percentParado}%</span>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center text-[#16a34a] font-bold">
                                    <span>Tempo de maquina (Efetivo) :</span>
                                    <div className="flex gap-4">
                                        <span>{calculatedData.turnoA.tempoEfetivoStr}</span>
                                        <span className="w-12 text-right">{calculatedData.turnoA.percentEfetivo}%</span>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-800">Quant. de peças produzidas:</span>
                                    <div className="flex items-center gap-1 justify-end font-bold text-slate-900">
                                        <input
                                            type="number"
                                            value={statsShiftA.pecasProduzidas || ''}
                                            onChange={e => setStatsShiftA({ ...statsShiftA, pecasProduzidas: parseInt(e.target.value, 10) || 0 })}
                                            className="w-16 worksheet-input text-xs font-bold text-center mr-1"
                                            placeholder="Qnt."
                                        />
                                        <span>peças de</span>
                                        <input
                                            type="number"
                                            value={statsShiftA.tamanhoPeca || ''}
                                            onChange={e => setStatsShiftA({ ...statsShiftA, tamanhoPeca: parseFloat(e.target.value) || 0 })}
                                            className="w-16 worksheet-input text-xs font-bold text-center mr-1"
                                            placeholder="Tam."
                                        />
                                        <span>metros</span>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center font-bold">
                                    <span className="text-slate-800">Quant. de metros produzidos:</span>
                                    <span className="text-slate-950 text-right">{statsShiftA.pecasProduzidas * statsShiftA.tamanhoPeca} metros</span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-800">Tempo por peça:</span>
                                    <span className="font-bold text-slate-900 text-right">{calculatedData.turnoA.tempoPorPecaStr}</span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-800">Velocidade:</span>
                                    <span className="font-bold text-slate-900 text-right">{calculatedData.turnoA.velocidadeStr}</span>
                                </div>
                            </div>
                        </div>

                        {/* ESTATÍSTICA DO DIA TURNO B */}
                        <div className="stats-container-box">
                            <h4 className="text-center font-bold text-xs uppercase underline tracking-wider mb-3">
                                ESTATÍSTICA DO DIA: TURNO B
                            </h4>
                            <div className="space-y-1.5 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-800">Horas (Turno trabalhados):</span>
                                    <input
                                        type="text"
                                        value={statsShiftB.horasTrabalhadas}
                                        onChange={e => setStatsShiftB({ ...statsShiftB, horasTrabalhadas: e.target.value })}
                                        className="font-bold text-center text-slate-900 w-24 worksheet-input text-xs"
                                    />
                                </div>
                                
                                <div className="flex justify-between items-center text-[#dc2626] font-bold">
                                    <span>Tempo de maquina (parada) :</span>
                                    <div className="flex gap-4">
                                        <span>{calculatedData.turnoB.tempoParadoStr}</span>
                                        <span className="w-12 text-right">{calculatedData.turnoB.percentParado}%</span>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center text-[#16a34a] font-bold">
                                    <span>Tempo de maquina (Efetivo) :</span>
                                    <div className="flex gap-4">
                                        <span>{calculatedData.turnoB.tempoEfetivoStr}</span>
                                        <span className="w-12 text-right">{calculatedData.turnoB.percentEfetivo}%</span>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-800">Quant. de peças produzidas:</span>
                                    <div className="flex items-center gap-1 justify-end font-bold text-slate-900">
                                        <input
                                            type="number"
                                            value={statsShiftB.pecasProduzidas || ''}
                                            onChange={e => setStatsShiftB({ ...statsShiftB, pecasProduzidas: parseInt(e.target.value, 10) || 0 })}
                                            className="w-16 worksheet-input text-xs font-bold text-center mr-1"
                                            placeholder="Qnt."
                                        />
                                        <span>peças de</span>
                                        <input
                                            type="number"
                                            value={statsShiftB.tamanhoPeca || ''}
                                            onChange={e => setStatsShiftB({ ...statsShiftB, tamanhoPeca: parseFloat(e.target.value) || 0 })}
                                            className="w-16 worksheet-input text-xs font-bold text-center mr-1"
                                            placeholder="Tam."
                                        />
                                        <span>metros</span>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center font-bold">
                                    <span className="text-slate-800">Quant. de metros produzidos:</span>
                                    <span className="text-slate-950 text-right">{statsShiftB.pecasProduzidas * statsShiftB.tamanhoPeca} metros</span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-800">Tempo por peça:</span>
                                    <span className="font-bold text-slate-900 text-right">{calculatedData.turnoB.tempoPorPecaStr}</span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-800">Velocidade:</span>
                                    <span className="font-bold text-slate-900 text-right">{calculatedData.turnoB.velocidadeStr}</span>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* SEÇÃO RODAPÉ: ATUALIZAÇÃO DA PRODUÇÃO - IDÊNTICA À FOTO */}
                    <div className="border-1.5 border-[#1e293b] p-4 text-center rounded bg-white" style={{ border: '1.5px solid #1e293b' }}>
                        <h4 className="text-center font-bold text-xs uppercase underline tracking-wider mb-1">
                            ATUALIZAÇÃO DA PRODUÇÃO:
                        </h4>
                        <div className="flex items-center justify-center gap-1.5 font-bold text-xs mb-3 text-center w-full">
                            <span>Qntidade de peças a produzir:</span>
                            <input
                                type="number"
                                value={piecesToProduce}
                                onChange={e => setPiecesToProduce(parseInt(e.target.value, 10) || 0)}
                                className="w-20 text-center worksheet-input"
                            />
                            <span>treliças</span>
                            <button
                                onClick={addProductionUpdateRow}
                                className="bg-slate-800 hover:bg-black text-white text-[9px] py-0.5 px-2 rounded-md ml-3 no-print"
                            >
                                + Registrar Peso
                            </button>
                        </div>

                        {/* Tabela de Lotes com case e estilo IDÊNTICOS à foto */}
                        <div className="max-w-xl mx-auto overflow-x-auto">
                            <table className="w-full text-center" style={{ borderCollapse: 'collapse', border: '1px solid #1e293b' }}>
                                <thead>
                                    <tr className="bg-slate-50 font-bold" style={{ fontSize: '12px' }}>
                                        <th style={{ border: '1px solid #1e293b', padding: '4px' }}>Qnt.</th>
                                        <th style={{ border: '1px solid #1e293b', padding: '4px' }}>peso</th>
                                        <th style={{ border: '1px solid #1e293b', padding: '4px' }}>media</th>
                                        <th style={{ border: '1px solid #1e293b', padding: '4px' }}>Data</th>
                                        <th style={{ border: '1px solid #1e293b', padding: '2px' }} className="no-print">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productionUpdates.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-3 text-slate-400 italic font-bold border border-slate-300 text-xs">
                                                Nenhum lote registrado. Clique em "+ Registrar Peso"
                                            </td>
                                        </tr>
                                    ) : (
                                        productionUpdates.map(row => {
                                            const weightAverage = row.qnt > 0 ? (row.peso / row.qnt) : 0;
                                            return (
                                                <tr key={row.id} style={{ fontSize: '12px' }}>
                                                    <td style={{ border: '1px solid #1e293b', padding: '3px' }}>
                                                        <input
                                                            type="number"
                                                            value={row.qnt || ''}
                                                            onChange={e => updateProductionUpdateField(row.id, 'qnt', parseInt(e.target.value, 10) || 0)}
                                                            className="text-center w-full worksheet-input"
                                                        />
                                                    </td>
                                                    <td style={{ border: '1px solid #1e293b', padding: '3px' }}>
                                                        <input
                                                            type="number"
                                                            value={row.peso || ''}
                                                            onChange={e => updateProductionUpdateField(row.id, 'peso', parseFloat(e.target.value) || 0)}
                                                            className="text-center w-full worksheet-input"
                                                        />
                                                    </td>
                                                    <td style={{ border: '1px solid #1e293b', padding: '3px' }} className="font-bold text-slate-900">
                                                        {weightAverage > 0 ? weightAverage.toFixed(2).replace('.', ',') : ''}
                                                    </td>
                                                    <td style={{ border: '1px solid #1e293b', padding: '3px' }}>
                                                        <input
                                                            type="text"
                                                            value={row.data}
                                                            onChange={e => updateProductionUpdateField(row.id, 'data', e.target.value)}
                                                            className="text-center w-full worksheet-input"
                                                            placeholder="Ex: 1-04"
                                                        />
                                                    </td>
                                                    <td style={{ border: '1px solid #1e293b', padding: '3px' }} className="no-print">
                                                        <button
                                                            onClick={() => removeProductionUpdateRow(row.id)}
                                                            className="text-rose-600 hover:text-rose-800 font-bold hover:bg-rose-50 px-1 rounded text-xs"
                                                            title="Remover"
                                                        >
                                                            ×
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
};

export default Reports;