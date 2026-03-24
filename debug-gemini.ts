import { GoogleGenAI, Type } from "@google/genai";
import * as fs from 'fs';

const ai = new GoogleGenAI({ apiKey: "AIzaSyC5S0xnmqLI0Xjl40kmWv85AQrRXqbm_5U" });

const testText = "Conhecimentos Básicos:\nLíngua Portuguesa: Compreensão e intelecção de textos. Semântica. Morfologia. Sintaxe.\nInformática: Sistema Operacional Windows, Microsoft Office (Word, Excel).";

async function parseSyllabus(text: string, examBoard?: string) {
  const model = "gemini-2.5-flash";
  const prompt = `
      REGRA MAIS IMPORTANTE E ESTRITA: INDEPENDENTEMENTE DA RELEVÂNCIA DO TÓPICO, VOCÊ DEVE EXTRAIR 100% DO CONTEÚDO PROGRAMÁTICO. NÃO RESUMA, NÃO FILTRE E NÃO OMITA ABSOLUTAMENTE NADA. Extraia TODOS os tópicos listados no texto do edital, de forma literal e um por um.
      ${examBoard ? \`\n      Após garantir que TODOS os tópicos foram extraídos sem exceção, analise o perfil da banca examinadora **\${examBoard}** e defina um nível de relevância estatístico de cobrança para cada tópico.\` : '\n      Após garantir que TODOS os tópicos foram extraídos sem exceção, defina um nível de relevância de cobrança para cada tópico baseando-se no histórico geral de concursos policiais.'}
      
      Texto do Edital:
      ${text}
      
      Retorne um array de objetos, onde cada objeto representa uma matéria e contém uma lista de tópicos. Cada tópico deve ter o seu nome e sua relevância ('alta', 'média' ou 'baixa').
  `;

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

  return JSON.parse(response.text!);
}

parseSyllabus(testText, "CEBRASPE").then(console.log).catch(console.error);
