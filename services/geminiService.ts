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

        const prompt = `Você é um leitor inteligente de etiquetas industriais e notas de materiais de produção.
Analise a imagem desta etiqueta com muita atenção. Tente extrair as seguintes informações:
1. Lote Interno (Pode estar sob o nome de Lote, Lote Produto, Lote Master, etc)
2. Lote Fornecedor (Pode estar como Lote Forn, Lote Origem, Lote Fabricante, ou simplesmente outro código de lote)
3. Corrida (Normalmente um código alfanumérico com a descrição Corrida)
4. Fornecedor (Nome da empresa, fabricante)
5. Peso Líquido / Peso da Etiqueta em Kg (O peso em kg)

Sua resposta DEVE ser ÚNICA E EXCLUSIVAMENTE um objeto JSON válido. Não inclua NADA mais em sua resposta (sem blocos de código markdown, sem texto "Aqui está o JSON"). 
Se você não encontrar um dado específico, coloque \`null\` para ele.
Para o peso, forneça APENAS o NÚMERO, utilizando ponto (.) para casas decimais no padrão (ex: 2150.80).

Formato EXATO esperado:
{
  "internalLot": "texto encontrado",
  "supplierLot": "texto encontrado",
  "runNumber": "texto",
  "labelWeight": 1500.5,
  "supplier": "texto do fornecedor"
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

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
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

        const data = JSON.parse(textResult);

        return {
            internalLot: data.internalLot,
            supplierLot: data.supplierLot,
            runNumber: data.runNumber,
            labelWeight: typeof data.labelWeight === 'number' ? data.labelWeight : null,
            supplier: data.supplier
        };

    } catch (error) {
        console.error("Erro na leitura da imagem:", error);
        throw error;
    }
}
