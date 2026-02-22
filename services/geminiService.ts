const API_KEY = "AIzaSyCSljOvDE1OTke6L-HO9VeHZALRMSOZDso";

export async function extractLotDataFromImage(file: File) {
    try {
        const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result?.toString();
                if (result) {
                    resolve(result.split(',')[1]);
                } else {
                    reject(new Error("Falha ao ler o arquivo"));
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        const base64Image = await base64EncodedDataPromise;

        const prompt = `Você é um robô leitor especialista em etiquetas industriais (aço, arames, trefila) e romaneios.
Sua tarefa é extrair os dados EXATOS com precisão máxima.
Regras RIGOROSAS para cada campo:
1. Lote Fornecedor (supplierLot): É o número de lote original de fábrica (fabricante). Costuma ter muitos números ou código de barras associado. Procure palavras como "Lote", "Lot", "Lote Forn".
2. Lote Interno (internalLot): Se não houver, coloque \`null\`.
3. Corrida (runNumber): Procure estritamente pelas palavras "Corrida", "Heat", "Nº Corrida" ou "Cast". Identifica a fundição do metal.
4. Fornecedor (supplier): O nome da empresa que fabricou ou enviou o material (Ex: ArcelorMittal, Gerdau, Simec, etc). Fica no topo da etiqueta ou logotipo. Ignore números como "1008" ou "1006" neste campo (esses são qualidades do aço).
5. Bitola / Diâmetro (bitola): A grossura em milímetros. Exemplo: 5.5, 6.0, 12.5. Retorne isso em formato numérico como String (ex: "5.5" ou "6.0").
6. Peso Líquido (labelWeight): O peso original na etiqueta de fábrica ou romaneio do fornecedor (KG). Ignore "Peso Bruto". Pegue APENAS o número.
7. Peso da Balança (scaleWeight): Geralmente é um peso aferido (pesado) localmente, às vezes anotado à mão na nota, impresso em etiqueta de balança local ou em ticket de pesagem da própria fábrica. Se achar, coloque aqui. Se não houver nenhum peso aferido secundário/de balança aparente diferente, preencha com \`null\` ou passe o MESMO peso do labelWeight.

[NOVAS INSTRUÇÕES GLOBAIS]
Verifique se na imagem constam também as seguintes informações gerais do documento:
- nfe: Número da Nota Fiscal (NF, NFe, Nota Fiscal Eletrônica).
- conferenceNumber: Algum número de Conferência ou Romaneio visível.

Sua resposta DEVE ser ÚNICA E EXCLUSIVAMENTE um objeto JSON válido. NÃO inclua nenhum tipo de texto antes ou depois do JSON. Não coloque crases (\`\`\`).
Se não achar alguma informação, preencha com \`null\` (sem aspas).

Formato EXATO esperado (SEMPRE UM ÚNICO OBJETO JSON com a propriedade "lots" sendo um array):
{
  "nfe": "texto ou null",
  "conferenceNumber": "texto ou null",
  "lots": [
    {
      "internalLot": "texto ou null",
      "supplierLot": "texto encontrado",
      "runNumber": "texto",
      "bitola": "texto",
      "labelWeight": 1500.5,
      "scaleWeight": 1500.5,
      "supplier": "texto do fornecedor"
    }
  ]
}`;

        const requestBody = {
            contents: [
                {
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: file.type || "image/jpeg",
                                data: base64Image
                            }
                        }
                    ]
                }
            ]
        };

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || "Erro na API do Gemini.");
        }

        const result = await response.json();

        let textResult = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

        // Limpeza de possíveis formatações markdown do retorno
        textResult = textResult.replace(/```json/g, '').replace(/```/g, '').trim();

        const parsedData = JSON.parse(textResult);

        // Suporta tanto o formato antigo (array direto) quanto o novo (objeto com NFe e lots)
        let nfe = null;
        let conferenceNumber = null;
        let dataArray = [];

        if (Array.isArray(parsedData)) {
            dataArray = parsedData;
        } else if (parsedData && parsedData.lots) {
            nfe = parsedData.nfe;
            conferenceNumber = parsedData.conferenceNumber;
            dataArray = Array.isArray(parsedData.lots) ? parsedData.lots : [];
        } else if (parsedData) {
            dataArray = [parsedData];
        }

        const lotsData = dataArray.map((data: any) => ({
            internalLot: data.internalLot,
            supplierLot: data.supplierLot,
            runNumber: data.runNumber,
            labelWeight: typeof data.labelWeight === 'number' ? data.labelWeight : (parseFloat(data.labelWeight) || null),
            scaleWeight: typeof data.scaleWeight === 'number' ? data.scaleWeight : (parseFloat(data.scaleWeight) || null),
            bitola: typeof data.bitola === 'number' ? data.bitola.toString() : (data.bitola || null),
            supplier: data.supplier
        }));

        return {
            nfe,
            conferenceNumber,
            lots: lotsData
        };

    } catch (error) {
        console.error("Erro na leitura da imagem:", error);
        throw error;
    }
}
