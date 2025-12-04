import os

file_path = r'c:\Users\GIGABYTE\Desktop\gestao-inteligente\App.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Function to insert
new_function = """
    const addLotToProductionOrder = async (orderId: string, lotId: string) => {
        try {
            const order = productionOrders.find(o => o.id === orderId);
            if (!order) return;

            const stockItem = stock.find(s => s.id === lotId);
            if (!stockItem) return;

            // Update stock item
            await updateItem<StockItem>('stock_items', lotId, {
                status: 'Em Produção - Trefila',
                productionOrderIds: [...(stockItem.productionOrderIds || []), orderId]
            });

            // Update production order
            const currentLots = Array.isArray(order.selectedLotIds) ? order.selectedLotIds : [];
            const newLots = [...currentLots, lotId];
            const newTotalWeight = order.totalWeight + stockItem.remainingQuantity;

            await updateItem('production_orders', orderId, {
                selectedLotIds: newLots,
                totalWeight: newTotalWeight
            });

            // Update local state
            const updatedStock = await fetchTable<StockItem>('stock_items');
            setStock(updatedStock);
            
            setProductionOrders(prev => prev.map(o => {
                if (o.id === orderId) {
                    return {
                        ...o,
                        selectedLotIds: newLots,
                        totalWeight: newTotalWeight
                    };
                }
                return o;
            }));

            showNotification('Lote adicionado à ordem de produção!', 'success');
        } catch (error) {
            showNotification('Erro ao adicionar lote à ordem.', 'error');
        }
    };
"""

# Insert function before renderPage
if 'const renderPage = () => {' in content:
    content = content.replace('const renderPage = () => {', new_function + '\n    const renderPage = () => {')
else:
    print("Error: Could not find renderPage")

# Update machineControlProps
old_props = """            updateProducedQuantity, messages, addMessage
        };"""
new_props = """            updateProducedQuantity, messages, addMessage, addLotToProductionOrder
        };"""

if old_props in content:
    content = content.replace(old_props, new_props)
else:
    print("Error: Could not find machineControlProps end")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("App.tsx updated successfully")
