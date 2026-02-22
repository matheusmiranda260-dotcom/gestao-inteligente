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

        const prompt = `Você é um robô leitor especialista em etiquetas industriais (aço, arames, trefila).
Sua tarefa é extrair os dados EXATOS das etiquetas na imagem com precisão máxima. Extraia a informação de TODOS os lotes que encontrar.
Regras RIGOROSAS para cada campo:
1. Lote Fornecedor (supplierLot): É o número de lote original de fábrica (fabricante). Costuma ter muitos números ou código de barras associado. Procure palavras como "Lote", "Lot", "Lote Forn".
2. Lote Interno (internalLot): Normalmente é um código numérico ou curto adicionado na própria empresa no recebimento. Pode estar escrito à mão ou em etiqueta menor. Se só houver 1 (um) número de lote na etiqueta grande de fábrica, preencha apenas Lote Fornecedor (deixe o Lote Interno null).
3. Corrida (runNumber): Procure estritamente pelas palavras "Corrida", "Heat", "Nº Corrida" ou "Cast". É um código alfanumérico que identifica a fundição do metal.
4. Fornecedor (supplier): O nome da empresa que fabricou ou enviou o material (Ex: ArcelorMittal, Gerdau, Simec, etc). Fica no topo da etiqueta ou logotipo.
5. Bitola / Diâmetro (bitola): A grossura do fio de aço, arame ou vergalhão, normalmente em milímetros (mm). Procure por "Bitola", "Diam", "Size" ou "Ø". Exemplo: 5.5, 6.0, 12.5. Retorne isso em formato numérico como String (ex: "5.5" ou "6.0").
6. Peso Líquido (labelWeight): O peso (KG). Ignore "Peso Bruto". Pegue APENAS o número do "Peso Líquido" ou "Net Weight". Cuidado para não confundir o peso líquido com o peso bruto ou quantidade de peças. Use ponto para decimais (ex: 2150.5).

Sua resposta DEVE ser ÚNICA E EXCLUSIVAMENTE um array em formato JSON válido, contendo objetos. NÃO inclua nenhum tipo de texto antes ou depois do JSON. Não coloque crases (\`\`\`).
Se não achar alguma informação em um lote específico, preencha com \`null\` (sem aspas).

Formato EXATO esperado (SEMPRE um array, mesmo se só encontrar um lote):
[
  {
    "internalLot": "texto ou null",
    "supplierLot": "texto encontrado",
    "runNumber": "texto",
    "bitola": "texto",
    "labelWeight": 1500.5,
    "supplier": "texto do fornecedor"
  }
]`;

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

        // Garante que é array
        const dataArray = Array.isArray(parsedData) ? parsedData : [parsedData];

        return dataArray.map((data: any) => ({
            internalLot: data.internalLot,
            supplierLot: data.supplierLot,
            runNumber: data.runNumber,
            labelWeight: typeof data.labelWeight === 'number' ? data.labelWeight : (parseFloat(data.labelWeight) || null),
            bitola: typeof data.bitola === 'number' ? data.bitola.toString() : (data.bitola || null),
            supplier: data.supplier
        }));

    } catch (error) {
        console.error("Erro na leitura da imagem:", error);
        throw error;
    }
}
