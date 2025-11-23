import React, { useState } from 'react';
import type { ProductionOrderData } from '../types';

interface PartsRequestModalProps {
  order: ProductionOrderData;
  onClose: () => void;
  onSubmit: (data: { partDescription: string; quantity: number; priority: 'Normal' | 'Urgente'; }) => void;
}

const PartsRequestModal: React.FC<PartsRequestModalProps> = ({ order, onClose, onSubmit }) => {
  const [partDescription, setPartDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [priority, setPriority] = useState<'Normal' | 'Urgente'>('Normal');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (partDescription.trim() && quantity > 0) {
      onSubmit({ partDescription, quantity, priority });
    } else {
        alert("Preencha a descrição da peça e a quantidade.")
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-xl w-full max-w-lg">
        <div className="border-b pb-4 mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Solicitar Peças de Manutenção</h2>
            <p className="text-sm text-slate-500">Ordem de Produção: {order.orderNumber}</p>
        </div>
        
        <div className="space-y-4">
            <div>
                <label htmlFor="partDescription" className="block text-sm font-medium text-slate-700">Descrição da Peça / Suprimento</label>
                <textarea
                    id="partDescription"
                    value={partDescription}
                    onChange={(e) => setPartDescription(e.target.value)}
                    className="mt-1 p-2 w-full border border-slate-300 rounded-md h-24"
                    placeholder="Ex: Matriz de 6mm, óleo de refrigeração..."
                    required
                    autoFocus
                />
            </div>
             <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="quantity" className="block text-sm font-medium text-slate-700">Quantidade</label>
                    <input
                        type="number"
                        id="quantity"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(parseInt(e.target.value, 10))}
                        className="mt-1 p-2 w-full border border-slate-300 rounded-md"
                        required
                    />
                </div>
                <div>
                    <label htmlFor="priority" className="block text-sm font-medium text-slate-700">Prioridade</label>
                    <select
                        id="priority"
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as 'Normal' | 'Urgente')}
                        className="mt-1 p-2 w-full border border-slate-300 rounded-md bg-white"
                    >
                        <option value="Normal">Normal</option>
                        <option value="Urgente">Urgente</option>
                    </select>
                </div>
            </div>
        </div>
        
        <div className="flex justify-end gap-4 pt-6 mt-6 border-t">
          <button type="button" onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg transition">Cancelar</button>
          <button type="submit" className="bg-slate-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-800 transition">Enviar Solicitação</button>
        </div>
      </form>
    </div>
  );
};

export default PartsRequestModal;