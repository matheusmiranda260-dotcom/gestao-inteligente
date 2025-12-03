"""
Script para atualizar todas as cores do projeto para a identidade MSM
Cores MSM:
- Azul: #0F3F5C (substituindo indigo)
- Laranja: #FF8C00 (substituindo purple/secondary)
- Verde: mantido para OK/sucesso
"""

import os
import re

# Cores MSM
MSM_BLUE = '#0F3F5C'
MSM_BLUE_BG = 'bg-[#0F3F5C]'
MSM_BLUE_TEXT = 'text-[#0F3F5C]'
MSM_ORANGE = '#FF8C00'
MSM_ORANGE_BG = 'bg-[#FF8C00]'
MSM_ORANGE_TEXT = 'text-[#FF8C00]'

# Mapeamento de substituições
replacements = {
    # Indigo para MSM Blue
    'bg-indigo-600': MSM_BLUE_BG,
    'bg-indigo-700': 'bg-[#0A2A3D]',  # Azul mais escuro
    'bg-indigo-50': 'bg-[#e6f0f5]',   # Azul muito claro
    'text-indigo-600': MSM_BLUE_TEXT,
    'text-indigo-700': 'text-[#0A2A3D]',
    'text-indigo-900': MSM_BLUE_TEXT,
    'border-indigo-200': 'border-[#0F3F5C]/20',
    'hover:bg-indigo-700': 'hover:bg-[#0A2A3D]',
    'hover:bg-indigo-50': 'hover:bg-[#e6f0f5]',
    
    # Purple para MSM Orange  
    'bg-purple-50': 'bg-[#fff3e6]',
    'bg-purple-700': MSM_ORANGE_TEXT,
    'text-purple-700': MSM_ORANGE_TEXT,
    'border-purple-200': f'border-{MSM_ORANGE}/20',
    'border-purple-200': 'border-[#FF8C00]/20',
    
    # Blue para MSM Blue (alguns específicos)
    'bg-blue-100': 'bg-[#e6f0f5]',
    'bg-blue-50': 'bg-[#e6f0f5]',
    'text-blue-700': MSM_BLUE_TEXT,
    'text-blue-800': MSM_BLUE_TEXT,
    'border-blue-200': 'border-[#0F3F5C]/20',
    'bg-blue-500': MSM_BLUE_BG,
    'bg-blue-600': MSM_BLUE_BG,
    'hover:bg-blue-700': 'hover:bg-[#0A2A3D]',
    
    # Primary para MSM Blue
    'text-primary-600': MSM_BLUE_TEXT,
}

def update_file(filepath):
    """Atualiza as cores em um arquivo"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Aplicar substituições
        for old, new in replacements.items():
            content = content.replace(old, new)
        
        # Se houve mudanças, salvar
        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False
    except Exception as e:
        print(f"Erro ao processar {filepath}: {e}")
        return False

def main():
    """Atualiza todos os arquivos .tsx e .ts no diretório components"""
    components_dir = r'c:\Users\GIGABYTE\Desktop\gestao-inteligente\components'
    
    updated_files = []
    
    for filename in os.listdir(components_dir):
        if filename.endswith('.tsx') or filename.endswith('.ts'):
            filepath = os.path.join(components_dir, filename)
            if update_file(filepath):
                updated_files.append(filename)
                print(f'✓ Atualizado: {filename}')
    
    print(f'\n{len(updated_files)} arquivos atualizados!')
    if updated_files:
        print('\nArquivos modificados:')
        for f in updated_files:
            print(f'  - {f}')

if __name__ == '__main__':
    main()
