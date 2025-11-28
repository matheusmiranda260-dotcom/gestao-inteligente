"""
Script para aplicar o schema da tabela production_orders no Supabase automaticamente.

Como usar:
1. Instale as dependências: pip install supabase python-dotenv
2. Configure as variáveis de ambiente no arquivo .env (SUPABASE_URL e SUPABASE_KEY)
3. Execute: python apply_production_orders_schema.py
"""

import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Carrega as variáveis de ambiente
load_dotenv()

# Configuração do Supabase
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('VITE_SUPABASE_ANON_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Erro: Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não encontradas no arquivo .env")
    print("📝 Crie um arquivo .env com:")
    print("VITE_SUPABASE_URL=https://seu-projeto.supabase.co")
    print("VITE_SUPABASE_ANON_KEY=sua-chave-aqui")
    exit(1)

# Cria o cliente Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("🔗 Conectado ao Supabase!")
print(f"📍 URL: {SUPABASE_URL}")
print()

# Lê o arquivo SQL
sql_file = "supabase_production_orders_schema.sql"
try:
    with open(sql_file, 'r', encoding='utf-8') as f:
        sql_script = f.read()
except FileNotFoundError:
    print(f"❌ Erro: Arquivo {sql_file} não encontrado.")
    exit(1)

print(f"📄 Lendo arquivo: {sql_file}")
print()

# Divide o script em comandos individuais
# (Nota: O Supabase Python Client não tem método direto para executar SQL raw,
#  então você precisará executar manualmente no SQL Editor ou usar a API REST)

print("⚠️  AVISO IMPORTANTE:")
print("=" * 60)
print("O Supabase Python Client não suporta execução de SQL raw.")
print("Você precisa executar o script SQL manualmente.")
print()
print("📋 PASSOS:")
print("1. Acesse: https://app.supabase.com")
print("2. Selecione seu projeto")
print("3. Clique em 'SQL Editor' no menu lateral")
print("4. Clique em 'New Query'")
print(f"5. Copie o conteúdo do arquivo '{sql_file}'")
print("6. Cole no editor e clique em 'Run'")
print()
print("=" * 60)
print()

# Verifica se a tabela existe
try:
    result = supabase.table('production_orders').select("count", count='exact').limit(1).execute()
    print("✅ A tabela 'production_orders' JÁ EXISTE!")
    print(f"📊 Número de registros: {result.count}")
    print()
    print("ℹ️  Se você ainda está tendo problemas, execute o script SQL")
    print("   manualmente para atualizar a estrutura da tabela.")
except Exception as e:
    error_msg = str(e)
    if 'relation "production_orders" does not exist' in error_msg or '42P01' in error_msg:
        print("❌ A tabela 'production_orders' NÃO EXISTE!")
        print()
        print("🔧 VOCÊ PRECISA CRIAR A TABELA:")
        print("   Execute o script SQL manualmente seguindo os passos acima.")
    else:
        print(f"⚠️  Erro ao verificar a tabela: {error_msg}")
        print()
        print("🔧 Tente executar o script SQL manualmente.")

print()
print("📚 Documentação:")
print("   - Supabase SQL Editor: https://supabase.com/docs/guides/database/overview")
print("   - Arquivo de instruções: INSTRUCOES_CORRECAO_ORDEM_PRODUCAO.md")
