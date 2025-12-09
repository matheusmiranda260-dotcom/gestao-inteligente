import React from 'react';
import type { TransferRecord } from '../types';
import { PrinterIcon } from './icons';

interface TransferReportProps {
  reportData: TransferRecord;
  onClose: () => void;
}

const TransferReport: React.FC<TransferReportProps> = ({ reportData, onClose }) => {
  const totalTransferredWeight = reportData.transferredLots.reduce((acc, lot) => acc + lot.transferredQuantity, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 print-modal-container">
      <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-5xl max-h-[95vh] flex flex-col print-modal-content">
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-[#0F3F5C]/20 no-print">
          <h2 className="text-2xl font-bold text-[#0F3F5C]">Relatório de Transferência</h2>
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

        <div className="overflow-y-auto print-section bg-white">
          <div className="p-6">
            {/* Professional Header */}
            <div className="flex items-start justify-end mb-8 pb-6 border-b-2 border-[#0F3F5C]">
              <div className="text-right">
                <p className="text-2xl font-bold text-[#0F3F5C] mb-1">TRANSFERÊNCIA DE MATERIAL</p>
                <p className="text-sm text-slate-600">
                  <span className="font-semibold">Data de emissão:</span><br />
                  {new Date().toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>

            {/* Transfer Information */}
            <div className="bg-gradient-to-r from-[#e6f0f5] to-[#fff3e6] border-l-4 border-[#FF8C00] rounded-lg p-5 mb-6 shadow-sm">
              <h3 className="text-lg font-bold text-[#0F3F5C] mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#FF8C00]" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                  <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                </svg>
                Dados da Transferência
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Nº Transferência</p>
                  <p className="text-sm font-bold text-[#FF8C00]">{reportData.id}</p>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Data</p>
                  <p className="text-sm font-bold text-[#0F3F5C]">{new Date(reportData.date).toLocaleString('pt-BR')}</p>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Operador</p>
                  <p className="text-sm font-bold text-[#0F3F5C]">{reportData.operator}</p>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Setor Destino</p>
                  <p className="text-sm font-bold text-[#0F3F5C]">{reportData.destinationSector}</p>
                </div>
              </div>
            </div>

            {/* Transferred Lots Table */}
            <div className="mb-6">
              <h3 className="text-lg font-bold text-[#0F3F5C] mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#FF8C00]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
                </svg>
                Lotes Transferidos
              </h3>
              <div className="border border-[#0F3F5C]/20 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-white uppercase bg-gradient-to-r from-[#0F3F5C] to-[#1A5A7D]">
                    <tr>
                      <th scope="col" className="px-4 py-3">Lote Interno</th>
                      <th scope="col" className="px-4 py-3">Tipo de Material</th>
                      <th scope="col" className="px-4 py-3">Bitola</th>
                      <th scope="col" className="px-4 py-3 text-right">Quantidade Transferida (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.transferredLots.map((lot, index) => (
                      <tr key={lot.lotId} className={`border-b ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-[#e6f0f5] transition`}>
                        <td className="px-4 py-3 font-bold text-[#0F3F5C]">{lot.internalLot}</td>
                        <td className="px-4 py-3 text-slate-700">{lot.materialType}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{lot.bitola}</td>
                        <td className="px-4 py-3 text-right font-bold text-[#FF8C00]">{lot.transferredQuantity.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[#e6f0f5]">
                    <tr className="border-t-2 border-[#0F3F5C]">
                      <th scope="row" colSpan={3} className="px-4 py-3 text-lg text-right font-bold text-[#0F3F5C]">Peso Total Transferido:</th>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-block px-3 py-1 rounded-lg font-bold text-lg bg-[#FF8C00] text-white shadow-md">
                          {totalTransferredWeight.toFixed(2)} kg
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Signature Section */}
            <div className="mt-16 pt-10 grid grid-cols-2 gap-32 text-center">
              <div>
                <div className="border-t-2 border-[#0F3F5C] pt-2">
                  <p className="text-sm font-semibold text-slate-700">Responsável pela Transferência</p>
                  <p className="text-xs text-slate-500 mt-1">{reportData.operator}</p>
                </div>
              </div>
              <div>
                <div className="border-t-2 border-[#0F3F5C] pt-2">
                  <p className="text-sm font-semibold text-slate-700">Responsável pelo Recebimento</p>
                  <p className="text-xs text-slate-500 mt-1">{reportData.destinationSector}</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t-2 border-slate-200 text-center text-sm text-slate-500">
              <p className="text-xs mt-1">Documento gerado automaticamente • Transferência #{reportData.id}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransferReport;
