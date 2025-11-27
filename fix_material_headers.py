#!/usr/bin/env python3
"""
Script para trocar "Material" por "Tipo de Material" nos cabeçalhos de tabelas
"""

import re

def fix_material_headers():
    files_to_fix = [
        r'c:\Users\GIGABYTE\Desktop\gestao-inteligente\components\TransferReport.tsx',
        r'c:\Users\GIGABYTE\Desktop\gestao-inteligente\components\StockControl.tsx',
        r'c:\Users\GIGABYTE\Desktop\gestao-inteligente\components\ProductionOrderHistoryModal.tsx',
        r'c:\Users\GIGABYTE\Desktop\gestao-inteligente\components\ProductionOrder.tsx',
        r'c:\Users\GIGABYTE\Desktop\gestao-inteligente\components\InventoryReport.tsx',
        r'c:\Users\GIGABYTE\Desktop\gestao-inteligente\components\ConferenceReport.tsx',
    ]
    
    for file_path in files_to_fix:
        try:
            # Ler o arquivo
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Trocar apenas em cabeçalhos de tabela
            content = content.replace('>Material</th>', '>Tipo de Material</th>')
            
            # Escrever o arquivo corrigido
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"✅ {file_path.split('\\\\')[-1]}")
        except Exception as e:
            print(f"❌ Erro em {file_path.split('\\\\')[-1]}: {e}")
    
    print("\n✅ Todos os cabeçalhos 'Material' foram trocados para 'Tipo de Material'!")

if __name__ == '__main__':
    fix_material_headers()
