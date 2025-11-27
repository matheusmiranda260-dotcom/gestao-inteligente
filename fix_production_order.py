#!/usr/bin/env python3
"""
Script para adicionar logging de erro em addProductionOrder
"""

def fix_production_order_error():
    file_path = r'c:\Users\GIGABYTE\Desktop\gestao-inteligente\App.tsx'
    
    # Ler o arquivo
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Adicionar logging de erro em addProductionOrder
    content = content.replace(
        "        } catch (error) {\n            showNotification('Erro ao criar ordem de produção.', 'error');\n        }\n    };\n\n    const updateProductionOrder",
        "        } catch (error: any) {\n            console.error('Error creating production order:', error);\n            console.error('Order data:', order);\n            showNotification(`Erro ao criar ordem de produção: ${error.message || error}`, 'error');\n        }\n    };\n\n    const updateProductionOrder"
    )
    
    # Escrever o arquivo corrigido
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✅ Logging de erro adicionado em addProductionOrder!")

if __name__ == '__main__':
    fix_production_order_error()
