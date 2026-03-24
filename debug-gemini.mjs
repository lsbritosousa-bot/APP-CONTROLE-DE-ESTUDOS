import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "AIzaSyBawTJNOeekrg5PP9qMhPucvSpfqG12llk" });

const testText = "Conhecimentos Básicos:\nLíngua Portuguesa: Compreensão e intelecção de textos. Semântica. Morfologia. Sintaxe.\nInformática: Sistema Operacional Windows, Microsoft Office (Word, Excel).";

async function run() {
  try {
    const model = "gemini-3-flash-preview";
    const prompt = `
        REGRA MAIS IMPORTANTE E ESTRITA: INDEPENDENTEMENTE DA RELEVÂNCIA DO TÓPICO, VOCÊ DEVE EXTRAIR 100% DO CONTEÚDO PROGRAMÁTICO. NÃO RESUMA, NÃO FILTRE E NÃO OMITA ABSOLUTAMENTE NADA. Extraia TODOS os tópicos listados no texto do edital, de forma literal e um por um.
        
        Texto do Edital:
        ${testText}
        
        Retorne um array de objetos, onde cada objeto representa uma matéria e contém uma lista de tópicos. Cada tópico deve ter o seu nome e sua relevância ('alta', 'média' ou 'baixa').
    `;

    console.log("Generating content...");
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              subjectName: { type: Type.STRING, description: "Nome da matéria (ex: Direito Penal)" },
              topics: { 
                type: Type.ARRAY, 
                items: { 
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: "Título do tópico" },
                    relevance: { type: Type.STRING, description: "Relevância da cobrança: 'alta', 'média' ou 'baixa'" }
                  },
                  required: ["title", "relevance"]
                },
                description: "Lista de tópicos da matéria com sua relevância"
              }
            },
            required: ["subjectName", "topics"]
          }
        }
      }
    });

    console.log("Raw response text length:", response.text?.length);
    console.log("Raw response output:", response.text);
    const parsed = JSON.parse(response.text);
    console.log("Parsed successfully!");
  } catch (e) {
    console.log("Caught Error:");
    console.error(e);
  }
}
run();
