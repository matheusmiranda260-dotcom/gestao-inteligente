# DEBUG: Erro ao Criar Ordem de Produção - Treliça

## Possíveis Causas do Erro:

### 1. **Problema com a Tabela no Supabase**
A tabela `production_orders` pode não existir ou ter um nome diferente.

**Verificar:**
- Acesse o Supabase Dashboard
- Vá em "Table Editor"
- Procure pela tabela `production_orders`
- Verifique se existe e qual é o nome exato

### 2. **Problema com Campos Obrigatórios**
Alguns campos podem estar faltando ou com valores inválidos.

**Campos da ProductionOrderData:**
```typescript
{
    id: string;                              // ✅ Obrigatório
    orderNumber: string;                     // ✅ Obrigatório
    machine: MachineType;                    // ✅ Obrigatório ('Treliça')
    targetBitola: Bitola;                    // ✅ Obrigatório
    trelicaModel?: string;                   // ⚠️ Opcional (mas necessário para Treliça)
    tamanho?: string;                        // ⚠️ Opcional (mas necessário para Treliça)
    quantityToProduce?: number;              // ⚠️ Opcional (mas necessário para Treliça)
    selectedLotIds: string[] | TrelicaSelectedLots;  // ✅ Obrigatório
    totalWeight: number;                     // ✅ Obrigatório
    status: 'pending' | 'in_progress' | 'completed';  // ✅ Obrigatório
    creationDate: string;                    // ✅ Obrigatório (ISO string)
}
```

### 3. **Problema com selectedLotIds**
O campo `selectedLotIds` pode ser:
- Um array de strings: `['lot1', 'lot2']`
- Um objeto TrelicaSelectedLots: `{ diagonal: 'lot1', longitudinal: 'lot2', sinusoidal: 'lot3' }`

**Verificar:**
- Se você está selecionando os lotes corretamente
- Se todos os campos obrigatórios (diagonal, longitudinal, sinusoidal) estão preenchidos

### 4. **Problema com Conversão snake_case**
O `mapToSnakeCase` pode estar convertendo incorretamente campos complexos.

## Como Debugar:

### Passo 1: Abrir o Console do Navegador
1. Pressione **F12**
2. Vá na aba **Console**
3. Limpe o console (ícone 🚫 ou Ctrl+L)

### Passo 2: Tentar Criar a Ordem
1. Preencha todos os campos da ordem de produção
2. Clique em "Criar Ordem"
3. **COPIE A MENSAGEM DE ERRO COMPLETA** que aparece no console

A mensagem deve mostrar:
```
Error creating production order: [erro detalhado]
Order data: { id: '...', orderNumber: '...', ... }
```

### Passo 3: Verificar o Erro
Procure por mensagens como:
- `"column does not exist"` → Campo não existe na tabela
- `"null value in column"` → Campo obrigatório está vazio
- `"table does not exist"` → Tabela não existe
- `"permission denied"` → Problema de permissões no Supabase
- `"invalid input syntax"` → Tipo de dados incorreto

## Soluções Rápidas:

### Se o erro for "table does not exist":
A tabela `production_orders` não existe no Supabase. Você precisa criar a tabela.

### Se o erro for "column does not exist":
Algum campo da interface TypeScript não existe na tabela do Supabase.

### Se o erro for "null value in column":
Algum campo obrigatório não está sendo preenchido. Verifique:
- `trelicaModel` está preenchido?
- `tamanho` está preenchido?
- `quantityToProduce` está preenchido?
- Todos os lotes (diagonal, longitudinal, sinusoidal) estão selecionados?

### Se o erro for "permission denied":
As políticas RLS (Row Level Security) do Supabase estão bloqueando a inserção.
Você precisa adicionar uma política de INSERT na tabela `production_orders`.

## Próximos Passos:

1. **COPIE O ERRO COMPLETO DO CONSOLE**
2. Me envie a mensagem de erro
3. Vou identificar exatamente qual é o problema
4. Vou fornecer a solução específica
