#!/usr/bin/env python3
"""
Script para corrigir bugs no App.tsx
"""

import re

def fix_app_tsx():
    file_path = r'c:\Users\GIGABYTE\Desktop\gestao-inteligente\App.tsx'
    
    # Ler o arquivo
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Correção 1: Linha 327 - updateItem para updateItemByColumn
    content = content.replace(
        "            // Update conference\n            await updateItem<ConferenceData>('conferences', conferenceNumber, updatedData);",
        "            // Update conference using conference_number column\n            await updateItemByColumn<ConferenceData>('conferences', 'conference_number', conferenceNumber, updatedData);"
    )
    
    # Correção 2: Linha 393 - deleteItem para deleteItemByColumn
    content = content.replace(
        "            // Delete conference\n            await deleteItem('conferences', conferenceNumber);",
        "            // Delete conference using conference_number column\n            await deleteItemByColumn('conferences', 'conference_number', conferenceNumber);"
    )
    
    # Correção 3: Linhas 321-324 - Deletar loop e usar deleteItemByColumn
    content = content.replace(
        "            // Delete old stock items\n            for (const item of conferenceStockItems) {\n                await deleteItem('stock_items', item.id);\n            }",
        "            // Delete all old stock items associated with this conference directly from DB\n            await deleteItemByColumn('stock_items', 'conference_number', conferenceNumber);"
    )
    
    # Correção 4: Linhas 388-390 - Deletar loop e usar deleteItemByColumn
    content = content.replace(
        "            // Delete stock items\n            for (const item of conferenceStockItems) {\n                await deleteItem('stock_items', item.id);\n            }",
        "            // Delete all stock items associated with this conference directly from DB\n            await deleteItemByColumn('stock_items', 'conference_number', conferenceNumber);"
    )
    
    # Correção 5: Melhorar erro em editConference
    content = content.replace(
        "        } catch (error) {\n            showNotification('Erro ao editar conferência.', 'error');\n        }\n    };\n\n    const deleteConference",
        "        } catch (error: any) {\n            console.error('Error editing conference:', error);\n            showNotification(`Erro ao editar conferência: ${error.message || error}`, 'error');\n        }\n    };\n\n    const deleteConference"
    )
    
    # Correção 6: Melhorar erro em deleteConference
    content = content.replace(
        "        } catch (error) {\n            showNotification('Erro ao excluir conferência.', 'error');\n        }\n    };\n    const addStockItem",
        "        } catch (error: any) {\n            console.error('Error deleting conference:', error);\n            showNotification(`Erro ao excluir conferência: ${error.message || error}`, 'error');\n        }\n    };\n    const addStockItem"
    )
    
    # Escrever o arquivo corrigido
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✅ Correções aplicadas com sucesso!")
    print("Correções feitas:")
    print("1. editConference: updateItem → updateItemByColumn")
    print("2. deleteConference: deleteItem → deleteItemByColumn")
    print("3. editConference: loop deletion → deleteItemByColumn")
    print("4. deleteConference: loop deletion → deleteItemByColumn")
    print("5. Melhorado tratamento de erros em editConference")
    print("6. Melhorado tratamento de erros em deleteConference")

if __name__ == '__main__':
    fix_app_tsx()
