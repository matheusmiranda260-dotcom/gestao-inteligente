
import React, { useState } from 'react';
import type { ConferenceData } from '../types';
import { PrinterIcon } from './icons';

interface FinishedConferencesModalProps {
  conferences: ConferenceData[];
  onClose: () => void;
  onShowReport: (conference: ConferenceData) => void;
}

const FinishedConferencesModal: React.FC<FinishedConferencesModalProps> = ({ conferences, onClose, onShowReport }) => {
    const [expandedConferenceId, setExpandedConferenceId] = useState<string | null>(null);

    const toggleExpand = (conferenceNumber: string) => {
        setExpandedConferenceId(prevId => (prevId === conferenceNumber ? null : conferenceNumber));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
            <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center border-b pb-4 mb-4">
                    <h2 className="text-2xl font-bold text-slate-800">Histórico de Conferências Finalizadas</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-3xl">&times;</button>
                </div>
                <div className="flex-grow overflow-y-auto pr-2">
                    {conferences.length > 0 ? (
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-left sticky top-0">
                                <tr>
                                    <th className="p-3 font-semibold text-slate-600">Data</th>
                                    <th className="p-3 font-semibold text-slate-600">Nº Conferência</th>
                                    <th className="p-3 font-semibold text-slate-600">Fornecedor</th>
                                    <th className="p-3 font-semibold text-slate-600">Nota Fiscal</th>
                                    <th className="p-3 font-semibold text-slate-600 text-center">Nº Lotes</th>
                                    <th className="p-3 font-semibold text-slate-600 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {conferences.map((conf) => (
                                    <React.Fragment key={conf.conferenceNumber}>
                                        <tr className="hover:bg-slate-50">
                                            <td className="p-3">{new Date(conf.entryDate).toLocaleDateString('pt-BR')}</td>
                                            <td className="p-3 font-medium">{conf.conferenceNumber}</td>
                                            <td className="p-3">{conf.supplier}</td>
                                            <td className="p-3">{conf.nfe}</td>
                                            <td className="p-3 text-center">{conf.lots.length}</td>
                                            <td className="p-3 text-center">
                                                <div className="flex justify-center gap-4">
                                                    <button onClick={() => onShowReport(conf)} className="text-emerald-600 hover:underline text-xs font-semibold flex items-center gap-1" title="Reimprimir Relatório">
                                                        <PrinterIcon className="h-4 w-4"/>
                                                        <span>Reimprimir</span>
                                                    </button>
                                                    <button onClick={() => toggleExpand(conf.conferenceNumber)} className="text-slate-600 hover:underline text-xs font-semibold">
                                                        {expandedConferenceId === conf.conferenceNumber ? 'Ocultar' : 'Ver Lotes'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedConferenceId === conf.conferenceNumber && (
                                            <tr className="bg-slate-50">
                                                <td colSpan={6} className="p-4">
                                                    <h4 className="font-semibold text-slate-700 mb-2 pl-2">Lotes da Conferência: {conf.conferenceNumber}</h4>
                                                    <div className="overflow-x-auto border rounded-md bg-white">
                                                        <table className="min-w-full text-xs">
                                                            <thead className="bg-slate-100">
                                                                <tr>
                                                                    <th className="p-2 text-left font-semibold">Lote Interno</th>
                                                                    <th className="p-2 text-left font-semibold">Lote Fornecedor</th>
                                                                    <th className="p-2 text-left font-semibold">Material</th>
                                                                    <th className="p-2 text-left font-semibold">Bitola</th>
                                                                    <th className="p-2 text-right font-semibold">Peso Etiqueta (kg)</th>
                                                                    <th className="p-2 text-right font-semibold">Peso Balança (kg)</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y">
                                                                {conf.lots.map((lot, index) => (
                                                                    <tr key={index}>
                                                                        <td className="p-2">{lot.internalLot}</td>
                                                                        <td className="p-2">{lot.supplierLot}</td>
                                                                        <td className="p-2">{lot.materialType}</td>
                                                                        <td className="p-2">{lot.bitola}</td>
                                                                        <td className="p-2 text-right">{lot.labelWeight.toFixed(2)}</td>
                                                                        <td className="p-2 text-right font-bold">{lot.scaleWeight.toFixed(2)}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="text-center text-slate-500 py-10">Nenhuma conferência foi finalizada ainda.</p>
                    )}
                </div>
                <div className="flex justify-end pt-4 mt-auto border-t">
                    <button type="button" onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition">Fechar</button>
                </div>
            </div>
        </div>
    );
};

export default FinishedConferencesModal;