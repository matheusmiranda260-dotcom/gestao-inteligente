import React from 'react';
import type { TransferRecord } from '../types';
import { PrinterIcon } from './icons';

interface TransfersHistoryModalProps {
  transfers: TransferRecord[];
  onClose: () => void;
  onShowReport: (transfer: TransferRecord) => void;
}

const TransfersHistoryModal: React.FC<TransfersHistoryModalProps> = ({ transfers, onClose, onShowReport }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
            <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center border-b pb-4 mb-4">
                    <h2 className="text-2xl font-bold text-slate-800">Histórico de Transferências de Material</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-3xl">&times;</button>
                </div>
                <div className="flex-grow overflow-y-auto pr-2">
                    {transfers.length > 0 ? (
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-left sticky top-0">
                                <tr>
                                    <th className="p-3 font-semibold text-slate-600">Nº Transferência</th>
                                    <th className="p-3 font-semibold text-slate-600">Data</th>
                                    <th className="p-3 font-semibold text-slate-600">Operador</th>
                                    <th className="p-3 font-semibold text-slate-600">Setor Destino</th>
                                    <th className="p-3 font-semibold text-slate-600 text-center">Nº Lotes</th>
                                    <th className="p-3 font-semibold text-slate-600 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {transfers.map((transfer) => (
                                    <tr key={transfer.id} className="hover:bg-slate-50">
                                        <td className="p-3 font-medium text-slate-900">{transfer.id}</td>
                                        <td className="p-3">{new Date(transfer.date).toLocaleString('pt-BR')}</td>
                                        <td className="p-3">{transfer.operator}</td>
                                        <td className="p-3">{transfer.destinationSector}</td>
                                        <td className="p-3 text-center">{transfer.transferredLots.length}</td>
                                        <td className="p-3 text-center">
                                            <button onClick={() => onShowReport(transfer)} className="text-emerald-600 hover:underline text-xs font-semibold flex items-center justify-center gap-1 mx-auto" title="Ver Relatório de Transferência">
                                                <PrinterIcon className="h-4 w-4"/>
                                                <span>Ver Relatório</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="text-center text-slate-500 py-10">Nenhuma transferência foi realizada ainda.</p>
                    )}
                </div>
                <div className="flex justify-end pt-4 mt-auto border-t">
                    <button type="button" onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition">Fechar</button>
                </div>
            </div>
        </div>
    );
};

export default TransfersHistoryModal;