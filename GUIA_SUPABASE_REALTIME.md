# Guia de Implementação do Supabase Realtime

Este documento explica como ativar a funcionalidade de Supabase Realtime no seu projeto para que os dados sejam atualizados automaticamente em tempo real.

## Arquivos Criados

O hook `useSupabaseRealtime.ts` já foi criado em `hooks/useSupabaseRealtime.ts`. Este hook gerencia todas as subscriptions do Realtime automaticamente.

## Passo 1: Adicionar Import no App.tsx

Abra o arquivo `App.tsx` e adicione esta linha de import após os outros imports (aproximadamente linha 17):

```typescript
import { useAllRealtimeSubscriptions } from './hooks/useSupabaseRealtime';
```

## Passo 2: Adicionar Chamada do Hook no App.tsx

Procure a função `showNotification` no `App.tsx` (aproximadamente linha 91). Logo após a definição dela, adicione o seguinte código:

```typescript
    // Supabase Realtime - Atualiza dados automaticamente quando há mudanças no banco
    useAllRealtimeSubscriptions({
        setStock,
        setConferences,
        setProductionOrders,
        setTransfers,
        setFinishedGoods,
        setPontasStock,
        setFinishedGoodsTransfers,
        setPartsRequests,
        setShiftReports,
        setTrefilaProduction,
        setTrelicaProduction,
        setMessages,
    }, !!currentUser);
```

## Passo 3: Habilitar Realtime no Supabase

Para que o Realtime funcione, você precisa habilitar as publicações (replication) para cada tabela no Supabase:

1. Acesse o Dashboard do Supabase
2. Vá em **Database** → **Replication**
3. Para cada tabela que você quer monitorar, habilite a publicação:
   - `stock_items`
   - `conferences`
   - `production_orders`
   - `transfers`
   - `finished_goods`
   - `pontas_stock`
   - `finished_goods_transfers`
   - `parts_requests`
   - `shift_reports`
   - `production_records`
   - `messages`

Alternativamente, você pode executar este SQL no Editor SQL do Supabase:

```sql
-- Habilitar Realtime para todas as tabelas
alter publication supabase_realtime add table stock_items;
alter publication supabase_realtime add table conferences;
alter publication supabase_realtime add table production_orders;
alter publication supabase_realtime add table transfers;
alter publication supabase_realtime add table finished_goods;
alter publication supabase_realtime add table pontas_stock;
alter publication supabase_realtime add table finished_goods_transfers;
alter publication supabase_realtime add table parts_requests;
alter publication supabase_realtime add table shift_reports;
alter publication supabase_realtime add table production_records;
alter publication supabase_realtime add table messages;
```

## Como Funciona

Após implementar:

1. **INSERT**: Quando um novo registro é inserido no banco de dados, ele aparece automaticamente na interface sem precisar recarregar a página.

2. **UPDATE**: Quando um registro é atualizado, a mudança aparece imediatamente em todos os clientes conectados.

3. **DELETE**: Quando um registro é deletado, ele desaparece automaticamente da interface.

## Verificação

Para verificar se o Realtime está funcionando:

1. Abra o Console do navegador (F12)
2. Procure por mensagens como:
   - `[Realtime] Iniciando subscriptions...`
   - `[Realtime] stock_items status: SUBSCRIBED`
   - `[Realtime] production_orders - INSERT: ...`

## Benefícios

- **Tempo Real**: Alterações são visíveis instantaneamente
- **Sem Reload**: Não precisa recarregar a página para ver mudanças
- **Multi-usuário**: Vários usuários veem as mesmas mudanças ao mesmo tempo
- **Automático**: Após configurado, funciona automaticamente

## Troubleshooting

Se os dados não estiverem atualizando em tempo real:

1. Verifique se a tabela está na publicação do Realtime
2. Verifique se as políticas de RLS permitem SELECT
3. Verifique o console do navegador para erros
4. Certifique-se de que o usuário está logado (as subscriptions só são ativadas quando `currentUser` existe)
