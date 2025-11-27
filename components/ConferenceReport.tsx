import React from 'react';
import type { ConferenceData } from '../types';
import { PrinterIcon } from './icons';
import { LogoIcon } from './Logo';

interface ConferenceReportProps {
  reportData: ConferenceData;
  onClose: () => void;
}

const ConferenceReport: React.FC<ConferenceReportProps> = ({ reportData, onClose }) => {
  const totalLabelWeight = reportData.lots.reduce((acc, lot) => acc + lot.labelWeight, 0);
  const totalScaleWeight = reportData.lots.reduce((acc, lot) => acc + lot.scaleWeight, 0);
  const difference = totalScaleWeight - totalLabelWeight;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 print-modal-container">
      <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-4xl max-h-[95vh] flex flex-col print-modal-content">
        {/* Header with actions */}
        <div className="flex justify-between items-center mb-4 pb-4 border-b no-print">
          <h2 className="text-2xl font-bold text-slate-800">Relatório de Entrada de Material</h2>
          <div>
            <button
              onClick={() => window.print()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2 mr-4"
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
        <div className="overflow-y-auto print-section bg-white">
            <div className="p-4">
                <div className="flex items-center justify-between mb-6">
                    <LogoIcon className="h-16 w-16 text-slate-800" />
                    <div className="text-right">
                      <h1 className="text-2xl font-bold text-black">MSM - Gestão de Produção</h1>
                      <p className="text-lg text-slate-700">Relatório de Entrada de Material</p>
                      <p className="text-sm text-slate-500">Gerado em: {new Date().toLocaleString('pt-BR')}</p>
                    </div>
                </div>

                <div className="border rounded-lg p-4 mb-6">
                    <h3 className="text-lg font-semibold mb-3">Dados da Conferência</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div><strong>Data:</strong> {new Date(reportData.entryDate).toLocaleDateString('pt-BR')}</div>
                        <div><strong>Fornecedor:</strong> {reportData.supplier}</div>
                        <div><strong>Nota Fiscal:</strong> {reportData.nfe}</div>
                        <div><strong>Nº Conferência:</strong> {reportData.conferenceNumber}</div>
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-semibold mb-3">Itens Recebidos</h3>
                     <table className="w-full text-sm text-left text-slate-600">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-100">
                            <tr>
                                <th scope="col" className="px-4 py-3">Lote Interno</th>
                                <th scope="col" className="px-4 py-3">Lote Fornecedor</th>
                                <th scope="col" className="px-4 py-3">Corrida</th>
                                <th scope="col" className="px-4 py-3">Tipo de Material</th>
                                <th scope="col" className="px-4 py-3">Bitola</th>
                                <th scope="col" className="px-4 py-3 text-right">Peso Etiqueta (kg)</th>
                                <th scope="col" className="px-4 py-3 text-right">Peso Balança (kg)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.lots.map((lot, index) => (
                                <tr key={index} className="bg-white border-b hover:bg-slate-50">
                                    <td className="px-4 py-3 font-medium text-slate-900">{lot.internalLot}</td>
                                    <td className="px-4 py-3">{lot.supplierLot}</td>
                                    <td className="px-4 py-3">{lot.runNumber}</td>
                                    <td className="px-4 py-3">{lot.materialType}</td>
                                    <td className="px-4 py-3">{lot.bitola}</td>
                                    <td className="px-4 py-3 text-right">{lot.labelWeight.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-right font-bold">{lot.scaleWeight.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="font-semibold text-slate-900 bg-slate-50 border-t-2">
                                <th scope="row" colSpan={6} className="px-4 py-2 text-base text-right">Total Etiqueta:</th>
                                <td className="px-4 py-2 text-base text-right">{totalLabelWeight.toFixed(2)} kg</td>
                            </tr>
                            <tr className="font-semibold text-slate-900 bg-slate-50">
                                <th scope="row" colSpan={6} className="px-4 py-2 text-base text-right">Total Balança:</th>
                                <td className="px-4 py-2 text-base text-right font-bold">{totalScaleWeight.toFixed(2)} kg</td>
                            </tr>
                            <tr className="font-semibold text-slate-900 bg-slate-50">
                                <th scope="row" colSpan={6} className="px-4 py-2 text-base text-right">Diferença:</th>
                                <td className={`px-4 py-2 text-base text-right font-bold ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {difference.toFixed(2)} kg
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ConferenceReport;
