# Correções Necessárias no App.tsx

## Problema 1: editConference (Linha 327)
**Linha atual:**
```typescript
await updateItem<ConferenceData>('conferences', conferenceNumber, updatedData);
```

**Deve ser:**
```typescript
await updateItemByColumn<ConferenceData>('conferences', 'conference_number', conferenceNumber, updatedData);
```

## Problema 2: deleteConference (Linha 393)
**Linha atual:**
```typescript
await deleteItem('conferences', conferenceNumber);
```

**Deve ser:**
```typescript
await deleteItemByColumn('conferences', 'conference_number', conferenceNumber);
```

## Problema 3: Deleção ineficiente de stock_items (Linhas 322-324)
**Código atual:**
```typescript
// Delete old stock items
for (const item of conferenceStockItems) {
    await deleteItem('stock_items', item.id);
}
```

**Deve ser:**
```typescript
// Delete all old stock items associated with this conference directly from DB
await deleteItemByColumn('stock_items', 'conference_number', conferenceNumber);
```

## Problema 4: Deleção ineficiente de stock_items em deleteConference (Linhas 388-390)
**Código atual:**
```typescript
// Delete stock items
for (const item of conferenceStockItems) {
    await deleteItem('stock_items', item.id);
}
```

**Deve ser:**
```typescript
// Delete all stock items associated with this conference directly from DB
await deleteItemByColumn('stock_items', 'conference_number', conferenceNumber);
```

## Problema 5: Melhorar tratamento de erros
Adicionar `console.error` e mensagens de erro mais detalhadas nos blocos catch de ambas as funções.

**Em editConference (linha 366-368):**
```typescript
} catch (error: any) {
    console.error('Error editing conference:', error);
    showNotification(`Erro ao editar conferência: ${error.message || error}`, 'error');
}
```

**Em deleteConference (linha 402-404):**
```typescript
} catch (error: any) {
    console.error('Error deleting conference:', error);
    showNotification(`Erro ao excluir conferência: ${error.message || error}`, 'error');
}
```

## Nomes de Tabelas no Supabase
Certifique-se de que as tabelas no Supabase estão com os nomes corretos:
- `conferences` (com coluna `conference_number`)
- `stock_items` (com coluna `conference_number` como Foreign Key)
- `transfers`
- `production_orders`
- `finished_goods`
- `pontas_stock`
- `finished_goods_transfers`
- `profiles`
- `messages`
