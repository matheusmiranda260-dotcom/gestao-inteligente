import React from 'react';
import { createPortal } from 'react-dom';
import type { ConferenceData } from '../types';
import { PrinterIcon } from './icons';

interface ConferenceReportProps {
  reportData: ConferenceData;
  onClose: () => void;
}

const ConferenceReport: React.FC<ConferenceReportProps> = ({ reportData, onClose }) => {
  const totalLabelWeight = reportData.lots.reduce((acc, lot) => acc + lot.labelWeight, 0);
  const totalScaleWeight = reportData.lots.reduce((acc, lot) => acc + lot.scaleWeight, 0);
  const difference = totalScaleWeight - totalLabelWeight;
  const differencePercentage = totalLabelWeight > 0 ? ((difference / totalLabelWeight) * 100) : 0;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] print-modal-container">
      <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-5xl max-h-[95vh] flex flex-col print-modal-content">
        {/* Header with actions */}
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-[#0F3F5C]/20 no-print">
          <h2 className="text-2xl font-bold text-[#0F3F5C]">Relatório de Entrada de Material</h2>
          <div className="flex gap-3">
            <button
              onClick={() => window.print()}
              className="bg-gradient-to-r from-[#FF8C00] to-[#FFA333] hover:from-[#E67E00] hover:to-[#FF8C00] text-white font-bold py-2 px-4 rounded-lg transition-all shadow-md flex items-center justify-center gap-2"
              title="Imprimir / Salvar PDF"
            >
              <PrinterIcon className="h-5 w-5" />
              <span>Imprimir</span>
            </button>
            <button
              onClick={onClose}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition"
            >
              Fechar
            </button>
          </div>
        </div>

        {/* Printable Content */}
        <div className="overflow-y-auto print-section bg-white flex flex-col h-full font-sans text-black">
          <div className="p-4 w-full h-full flex flex-col">

            {/* 1. Centered Title */}
            <h1 className="text-xl md:text-2xl font-bold text-black uppercase text-center mb-6 tracking-wide">
              CONFERÊNCIA DE MATÉRIA PRIMA - SETOR LAMINAÇÃO
            </h1>

            {/* 2. Three Boxes Header */}
            <div className="flex gap-4 mb-6">
              <div className="flex-1 border-2 border-slate-900 px-2 py-1">
                <span className="font-bold text-[10px] text-black block">Data:</span>
                <span className="font-bold text-black text-lg text-center block w-full">
                  {new Date(reportData.entryDate).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <div className="flex-1 border-2 border-slate-900 px-2 py-1">
                <span className="font-bold text-[10px] text-black block">Numero da NF:</span>
                <span className="font-bold text-black text-lg text-center block w-full">
                  {reportData.nfe}
                </span>
              </div>
              <div className="flex-1 border-2 border-slate-900 px-2 py-1">
                <span className="font-bold text-[10px] text-black uppercase block">NUMERO DA CONFERÊNCIA</span>
                <span className="font-bold text-black text-lg text-center block w-full">
                  {reportData.conferenceNumber}
                </span>
              </div>
            </div>

            {/* 3. Table - Exact Column Order & Style */}
            <div className="flex-grow">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="text-sm text-black uppercase font-black border-y-2 border-slate-900">
                  <tr>
                    <th className="px-2 py-2 text-center border-l border-r border-slate-400 w-12">Qnt.</th>
                    <th className="px-2 py-2 text-center border-r border-slate-400">Lote fornecedor</th>
                    <th className="px-2 py-2 text-center border-r border-slate-400">Lote interno</th>
                    <th className="px-2 py-2 text-center border-r border-slate-400 w-24">Bitola(mm)</th>
                    <th className="px-2 py-2 text-center border-r border-slate-400">FORNECEDOR</th>
                    <th className="px-2 py-2 text-center border-r border-slate-400">Corrida</th>
                    <th className="px-2 py-2 text-center border-r border-slate-400 w-32">Peso etiqueta</th>
                    <th className="px-2 py-2 text-center border-r border-slate-400 w-32">Peso balança</th>
                    <th className="px-2 py-2 text-center border-r border-slate-400 w-28">DIFERENÇA</th>
                  </tr>
                </thead>
                <tbody className="text-black border-b-2 border-slate-900">
                  {reportData.lots.map((lot, index) => {
                    const lotDiff = (lot.scaleWeight || 0) - (lot.labelWeight || 0);
                    const lotPercent = lot.labelWeight ? (lotDiff / lot.labelWeight) * 100 : 0;
                    const displaySupplier = lot.supplier || reportData.supplier;

                    return (
                      <tr key={index} className="border-b border-slate-300">
                        <td className="px-2 py-2 text-center border-l border-r border-slate-400 font-bold text-base">{index + 1}</td>
                        <td className="px-2 py-2 text-center border-r border-slate-400 font-mono font-bold text-base">{lot.supplierLot}</td>
                        <td className="px-2 py-2 text-center border-r border-slate-400 font-black text-lg text-[#0F3F5C]">{lot.internalLot}</td>
                        <td className="px-2 py-2 text-center border-r border-slate-400 font-black text-lg">{lot.bitola}</td>
                        <td className="px-2 py-2 text-center border-r border-slate-400 uppercase truncate max-w-[120px] font-bold text-sm" title={displaySupplier}>{displaySupplier}</td>
                        <td className="px-2 py-2 text-center border-r border-slate-400 font-mono font-bold text-base">{lot.runNumber}</td>
                        <td className="px-2 py-2 text-center border-r border-slate-400 font-bold text-lg">{lot.labelWeight.toFixed(0)}</td>
                        <td className="px-2 py-2 text-center border-r border-slate-400 font-black text-lg">{lot.scaleWeight.toFixed(0)}</td>
                        <td className="px-2 py-2 text-center border-r border-slate-400 font-black text-lg">
                          <span className="block">
                            {lotDiff > 0 ? '+' : ''}{lotDiff.toFixed(0)}
                          </span>
                          {lotDiff !== 0 && (
                            <span className="block text-xs">
                              ({lotPercent > 0 ? '+' : ''}{lotPercent.toFixed(1)}%)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="font-bold text-black">
                  {/* Spacer Row */}
                  <tr>
                    <td colSpan={9} className="h-4"></td> {/* Added Space */}
                  </tr>
                  <tr className="text-base">
                    <td colSpan={6} className="px-2 py-2 text-right uppercase font-black text-sm">Total:</td>
                    <td className="px-2 py-2 text-center font-black">{totalLabelWeight.toFixed(0)}</td>
                    <td className="px-2 py-2 text-center font-black">{totalScaleWeight.toFixed(0)}</td>
                    <td className="px-2 py-2 text-center whitespace-nowrap font-black">
                      <span className="block">
                        {difference > 0 ? '+' : ''}{difference.toFixed(0)}
                      </span>
                      {difference !== 0 && (
                        <span className="block text-xs">
                          ({differencePercentage > 0 ? '+' : ''}{differencePercentage.toFixed(1)}%)
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 4. Signatures & Footer */}
            <div className="mt-8">
              <div className="mb-4">
                <span className="font-bold text-xs uppercase text-slate-700 block mb-6">CONFERENTE:</span>
                <div className="border-b-2 border-slate-900 w-full mb-1"></div>
              </div>
              <div className="mb-8">
                <span className="font-bold text-xs uppercase text-slate-700 block mb-6">ENCARREGADO:</span>
                <div className="border-b-2 border-slate-900 w-full mb-1"></div>
              </div>

              <div className="text-center pt-8">
                <p className="text-xs text-slate-500 font-medium">Sistema de Gestões inteligente MSM</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};

export default ConferenceReport;
