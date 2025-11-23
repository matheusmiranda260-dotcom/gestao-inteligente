import React from 'react';
import type { TransferRecord } from '../types';
import { PrinterIcon } from './icons';
import { LogoIcon } from './Logo';

interface TransferReportProps {
  reportData: TransferRecord;
  onClose: () => void;
}

const TransferReport: React.FC<TransferReportProps> = ({ reportData, onClose }) => {
  const totalTransferredWeight = reportData.transferredLots.reduce((acc, lot) => acc + lot.transferredQuantity, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 print-modal-container">
      <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-4xl max-h-[95vh] flex flex-col print-modal-content">
        <div className="flex justify-between items-center mb-4 pb-4 border-b no-print">
          <h2 className="text-2xl font-bold text-slate-800">Relatório de Transferência</h2>
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

        <div className="overflow-y-auto print-section bg-white">
            <div className="p-4">
                <div className="flex items-center justify-between mb-6">
                    <LogoIcon className="h-16 w-16 text-slate-800" />
                    <div className="text-right">
                      <h1 className="text-2xl font-bold text-black">MSM - Gestão de Produção</h1>
                      <p className="text-lg text-slate-700">Relatório de Transferência de Material</p>
                      <p className="text-sm text-slate-500">Gerado em: {new Date().toLocaleString('pt-BR')}</p>
                    </div>
                </div>

                <div className="border rounded-lg p-4 mb-6">
                    <h3 className="text-lg font-semibold mb-3">Dados da Transferência</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div><strong>Nº Transferência:</strong> {reportData.id}</div>
                        <div><strong>Data:</strong> {new Date(reportData.date).toLocaleString('pt-BR')}</div>
                        <div><strong>Operador:</strong> {reportData.operator}</div>
                        <div><strong>Setor Destino:</strong> {reportData.destinationSector}</div>
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-semibold mb-3">Lotes Transferidos</h3>
                     <table className="w-full text-sm text-left text-slate-600">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-100">
                            <tr>
                                <th scope="col" className="px-4 py-3">Lote Interno</th>
                                <th scope="col" className="px-4 py-3">Material</th>
                                <th scope="col" className="px-4 py-3">Bitola</th>
                                <th scope="col" className="px-4 py-3 text-right">Quantidade Transferida (kg)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.transferredLots.map((lot) => (
                                <tr key={lot.lotId} className="bg-white border-b">
                                    <td className="px-4 py-3 font-medium text-slate-900">{lot.internalLot}</td>
                                    <td className="px-4 py-3">{lot.materialType}</td>
                                    <td className="px-4 py-3">{lot.bitola}</td>
                                    <td className="px-4 py-3 text-right font-bold">{lot.transferredQuantity.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="font-semibold text-slate-900 bg-slate-50 border-t-2">
                                <th scope="row" colSpan={3} className="px-4 py-2 text-base text-right">Peso Total Transferido:</th>
                                <td className="px-4 py-2 text-base text-right font-bold">{totalTransferredWeight.toFixed(2)} kg</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className="mt-20 pt-10 text-center">
                    <div className="inline-block">
                        <div className="border-t border-slate-500 w-64"></div>
                        <p className="text-sm mt-1">Assinatura Responsável Setor</p>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TransferReport;
