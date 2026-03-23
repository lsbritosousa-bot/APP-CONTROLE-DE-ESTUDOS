import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const parseSyllabus = async (text: string, examBoard?: string) => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Você é um Arquiteto de Estudos especializado em concursos policiais.
    Analise o seguinte texto de um edital e extraia as matérias e seus respectivos tópicos de forma estruturada.
    ${examBoard ? `\n    Leve em grande consideração o perfil da banca examinadora **${examBoard}**. Analise o modo como a banca costuma cobrar esses assuntos em provas policiais e defina um nível de relevância estatístico de cobrança para CADA TÓPICO.` : '\n    Defina um nível de relevância de cobrança para cada tópico baseando-se no histórico geral de concursos policiais.'}
    
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

  return JSON.parse(response.text);
};
