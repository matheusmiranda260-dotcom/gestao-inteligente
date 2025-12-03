import React from 'react';
import type { ConferenceData } from '../types';
import { PrinterIcon } from './icons';
import MSMLogo from './MSMLogo';

interface ConferenceReportProps {
  reportData: ConferenceData;
  onClose: () => void;
}

const ConferenceReport: React.FC<ConferenceReportProps> = ({ reportData, onClose }) => {
  const totalLabelWeight = reportData.lots.reduce((acc, lot) => acc + lot.labelWeight, 0);
  const totalScaleWeight = reportData.lots.reduce((acc, lot) => acc + lot.scaleWeight, 0);
  const difference = totalScaleWeight - totalLabelWeight;
  const differencePercentage = totalLabelWeight > 0 ? ((difference / totalLabelWeight) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 print-modal-container">
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
        <div className="overflow-y-auto print-section bg-white">
          <div className="p-6">
            {/* Professional Header with MSM Logo */}
            <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-[#0F3F5C]">
              <div className="flex items-center gap-4">
                <MSMLogo size="lg" showText={false} />
                <div>
                  <h1 className="text-3xl font-bold text-[#0F3F5C]">MSM INDÚSTRIA</h1>
                  <p className="text-sm text-[#FF8C00] font-semibold">Sistema de Gestão de Produção</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-[#0F3F5C] mb-1">ENTRADA DE MATERIAL</p>
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

            {/* Conference Information */}
            <div className="bg-gradient-to-r from-[#e6f0f5] to-[#fff3e6] border-l-4 border-[#FF8C00] rounded-lg p-5 mb-6 shadow-sm">
              <h3 className="text-lg font-bold text-[#0F3F5C] mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#FF8C00]" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                </svg>
                Dados da Conferência
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Data</p>
                  <p className="text-sm font-bold text-[#0F3F5C]">{new Date(reportData.entryDate).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Fornecedor</p>
                  <p className="text-sm font-bold text-[#0F3F5C]">{reportData.supplier}</p>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Nota Fiscal</p>
                  <p className="text-sm font-bold text-[#0F3F5C]">{reportData.nfe}</p>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Nº Conferência</p>
                  <p className="text-sm font-bold text-[#FF8C00]">{reportData.conferenceNumber}</p>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-6">
              <h3 className="text-lg font-bold text-[#0F3F5C] mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#FF8C00]" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                </svg>
                Itens Recebidos
              </h3>
              <div className="border border-[#0F3F5C]/20 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-white uppercase bg-gradient-to-r from-[#0F3F5C] to-[#1A5A7D]">
                    <tr>
                      <th scope="col" className="px-4 py-3">Lote Interno</th>
                      <th scope="col" className="px-4 py-3">Lote Fornecedor</th>
                      <th scope="col" className="px-4 py-3">Corrida</th>
                      <th scope="col" className="px-4 py-3">Tipo</th>
                      <th scope="col" className="px-4 py-3">Bitola</th>
                      <th scope="col" className="px-4 py-3 text-right">Peso Etiqueta (kg)</th>
                      <th scope="col" className="px-4 py-3 text-right">Peso Balança (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.lots.map((lot, index) => (
                      <tr key={index} className={`border-b ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-[#e6f0f5] transition`}>
                        <td className="px-4 py-3 font-bold text-[#0F3F5C]">{lot.internalLot}</td>
                        <td className="px-4 py-3 text-slate-700">{lot.supplierLot}</td>
                        <td className="px-4 py-3 text-slate-700">{lot.runNumber}</td>
                        <td className="px-4 py-3 text-slate-700">{lot.materialType}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{lot.bitola}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{lot.labelWeight.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-bold text-[#FF8C00]">{lot.scaleWeight.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[#e6f0f5]">
                    <tr className="border-t-2 border-[#0F3F5C]">
                      <th scope="row" colSpan={6} className="px-4 py-3 text-base text-right text-slate-700 font-semibold">Total Etiqueta:</th>
                      <td className="px-4 py-3 text-base text-right font-bold text-slate-900">{totalLabelWeight.toFixed(2)} kg</td>
                    </tr>
                    <tr className="border-t border-slate-300">
                      <th scope="row" colSpan={6} className="px-4 py-3 text-base text-right text-slate-700 font-semibold">Total Balança:</th>
                      <td className="px-4 py-3 text-base text-right font-bold text-[#FF8C00]">{totalScaleWeight.toFixed(2)} kg</td>
                    </tr>
                    <tr className="border-t-2 border-[#0F3F5C] bg-white">
                      <th scope="row" colSpan={6} className="px-4 py-3 text-lg text-right font-bold text-[#0F3F5C]">Diferença:</th>
                      <td className="px-4 py-3 text-right">
                        <div className={`inline-block px-3 py-1 rounded-lg font-bold text-lg ${difference >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {difference >= 0 ? '+' : ''}{difference.toFixed(2)} kg
                        </div>
                        <div className={`text-xs mt-1 ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ({differencePercentage >= 0 ? '+' : ''}{differencePercentage.toFixed(2)}%)
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t-2 border-slate-200 text-center text-sm text-slate-500">
              <p className="font-semibold">MSM Indústria - Sistema de Gestão de Produção</p>
              <p className="text-xs mt-1">Documento gerado automaticamente • Conferência #{reportData.conferenceNumber}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConferenceReport;
