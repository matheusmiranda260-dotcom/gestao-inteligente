# 🔧 CORREÇÃO: Erro ao Gerar Ordem de Produção - Trefila

## ❌ Problema Identificado

O erro ao criar ordem de produção ocorre porque:
1. A tabela `production_orders` pode não existir no Supabase
2. Ou a estrutura da tabela está incorreta
3. Ou as políticas RLS estão bloqueando a inserção

## ✅ Solução Implementada

### 1. Script SQL Criado

Criei o arquivo `supabase_production_orders_schema.sql` com:
- ✅ Estrutura completa da tabela `production_orders`
- ✅ Todos os campos necessários (incluindo campos para Trefila e Treliça)
- ✅ Índices para melhor performance
- ✅ Políticas RLS (Row Level Security) permissivas
- ✅ Trigger para atualizar `updated_at` automaticamente

### 2. Como Aplicar a Correção no Supabase

#### Passo 1: Acessar o Supabase Dashboard
1. Acesse https://supabase.com
2. Faça login na sua conta
3. Selecione o projeto **gestao-inteligente**

#### Passo 2: Executar o Script SQL
1. No menu lateral, clique em **SQL Editor**
2. Clique em **New Query**
3. **Copie TODO o conteúdo** do arquivo `supabase_production_orders_schema.sql`
4. **Cole** no editor SQL
5. Clique em **Run** (ou pressione Ctrl+Enter)
6. ✅ Aguarde a mensagem de sucesso

#### Passo 3: Verificar se Funcionou
1. No menu lateral, clique em **Table Editor**
2. Procure pela tabela **production_orders**
3. ✅ Você deve ver a tabela com todas as colunas

### 3. Estrutura da Tabela production_orders

A tabela foi criada com os seguintes campos:

```
┌─────────────────────────────┬──────────────┬─────────────┐
│ Campo                       │ Tipo         │ Obrigatório │
├─────────────────────────────┼──────────────┼─────────────┤
│ id                          │ UUID         │ ✅ Sim      │
│ order_number                │ TEXT         │ ✅ Sim      │
│ machine                     │ TEXT         │ ✅ Sim      │
│ target_bitola               │ TEXT         │ ✅ Sim      │
│ trelica_model               │ TEXT         │ ❌ Não      │
│ tamanho                     │ TEXT         │ ❌ Não      │
│ quantity_to_produce         │ INTEGER      │ ❌ Não      │
│ selected_lot_ids            │ JSONB        │ ✅ Sim      │
│ total_weight                │ NUMERIC      │ ✅ Sim      │
│ planned_output_weight       │ NUMERIC      │ ❌ Não      │
│ actual_produced_weight      │ NUMERIC      │ ❌ Não      │
│ actual_produced_quantity    │ INTEGER      │ ❌ Não      │
│ scrap_weight                │ NUMERIC      │ ❌ Não      │
│ status                      │ TEXT         │ ✅ Sim      │
│ creation_date               │ TIMESTAMPTZ  │ ✅ Sim      │
│ start_time                  │ TIMESTAMPTZ  │ ❌ Não      │
│ end_time                    │ TIMESTAMPTZ  │ ❌ Não      │
│ downtime_events             │ JSONB        │ ❌ Não      │
│ processed_lots              │ JSONB        │ ❌ Não      │
│ operator_logs               │ JSONB        │ ❌ Não      │
│ weighed_packages            │ JSONB        │ ❌ Não      │
│ pontas                      │ JSONB        │ ❌ Não      │
│ active_lot_processing       │ JSONB        │ ❌ Não      │
└─────────────────────────────┴──────────────┴─────────────┘
```

### 4. Políticas RLS (Segurança)

As seguintes políticas foram criadas para permitir acesso total:

- ✅ **SELECT**: Todos podem ler
- ✅ **INSERT**: Todos podem criar
- ✅ **UPDATE**: Todos podem atualizar
- ✅ **DELETE**: Todos podem deletar

> **Nota:** Em produção, você pode querer restringir essas políticas para validar usuários autenticados.

## 🧪 Como Testar

### Teste 1: Criar Ordem de Produção - Trefila
1. Acesse a aplicação
2. Vá em **Menu** → **Ordem de Produção - Trefila**
3. Preencha:
   - **Número da Ordem**: `OP-TEST-001`
   - **Bitola de Entrada**: Selecione uma bitola disponível
   - **Bitola a Produzir**: Selecione a bitola desejada
4. **Selecione pelo menos 1 lote** da lista
5. Clique em **Criar Ordem**
6. ✅ **Deve aparecer**: "Ordem de produção criada com sucesso!"

### Teste 2: Criar Ordem de Produção - Treliça
1. Vá em **Menu** → **Ordem de Produção - Treliça**
2. Preencha todos os campos:
   - **Número da Ordem**: `OP-TRELICA-001`
   - **Tipo de Treliça**: Selecione o modelo
   - **Tamanho**: Digite o tamanho
   - **Quantidade a Produzir**: Digite a quantidade
   - **Bitola**: Selecione a bitola
3. **Selecione os lotes** necessários (diagonal, longitudinal, sinusóide)
4. Clique em **Criar Ordem**
5. ✅ **Deve aparecer**: "Ordem de produção criada com sucesso!"

## 📊 Verificação no Console do Navegador

Se ainda houver erro após aplicar o script SQL:

1. **Abra o DevTools** (F12)
2. **Vá na aba Console**
3. **Limpe o console** (Ctrl+L)
4. **Tente criar a ordem novamente**
5. **Copie qualquer mensagem de erro** que aparecer:

```
Inserting into production_orders: { ... }
```

E depois:

```
Error inserting into production_orders: { message: "...", code: "..." }
```

## 🚨 Erros Comuns e Soluções

### Erro: "relation 'production_orders' does not exist"
**Solução:** Execute o script SQL no Supabase (Passo 2 acima)

### Erro: "null value in column 'id' violates not-null constraint"
**Solução:** Já corrigido no código - o `insertItem` gera UUID automaticamente

### Erro: "permission denied for table production_orders"
**Solução:** Execute o script SQL completo que inclui as políticas RLS

### Erro: "duplicate key value violates unique constraint"
**Solução:** O número da ordem já existe. Use um número diferente.

## 📝 Próximos Passos

1. ✅ Execute o script SQL no Supabase (~2 minutos)
2. ✅ Teste criar uma ordem de produção
3. ✅ Se funcionar, faça commit das alterações
4. ✅ Se ainda houver erro, copie a mensagem do console e me envie

## 🔗 Recursos Adicionais

- Arquivo SQL: `supabase_production_orders_schema.sql`
- Documentação Supabase: https://supabase.com/docs
- SQL Editor: https://app.supabase.com/project/[SEU_PROJECT_ID]/sql
