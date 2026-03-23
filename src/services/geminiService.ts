import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const parseSyllabus = async (text: string) => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Você é um Arquiteto de Estudos especializado em concursos policiais.
    Analise o seguinte texto de um edital e extraia as matérias e seus respectivos tópicos de forma estruturada.
    
    Texto do Edital:
    ${text}
    
    Retorne um array de objetos, onde cada objeto representa uma matéria e contém uma lista de tópicos.
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
              items: { type: Type.STRING },
              description: "Lista de tópicos da matéria"
            }
          },
          required: ["subjectName", "topics"]
        }
      }
    }
  });

  return JSON.parse(response.text);
};
