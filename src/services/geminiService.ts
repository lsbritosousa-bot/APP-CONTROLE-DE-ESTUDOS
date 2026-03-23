import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const parseSyllabus = async (text: string, examBoard?: string) => {
  const model = "gemini-3-flash-preview";
  
    const prompt = `
      Você é um Arquiteto de Estudos especializado em concursos policiais.
      A sua tarefa é analisar o seguinte texto de um edital e extrair TODAS as matérias e TODOS OS SEUS RESPECTIVOS TÓPICOS de forma estritamente estruturada.
      
      REGRA MAIS IMPORTANTE E ESTRITA: INDEPENDENTEMENTE DA RELEVÂNCIA DO TÓPICO, VOCÊ DEVE EXTRAIR 100% DO CONTEÚDO PROGRAMÁTICO. NÃO RESUMA, NÃO FILTRE E NÃO OMITA ABSOLUTAMENTE NADA. Extraia TODOS os tópicos listados no texto do edital, de forma literal e um por um.
      ${examBoard ? `\n      Após garantir que TODOS os tópicos foram extraídos sem exceção, analise o perfil da banca examinadora **${examBoard}** e defina um nível de relevância estatístico de cobrança para cada tópico.` : '\n      Após garantir que TODOS os tópicos foram extraídos sem exceção, defina um nível de relevância de cobrança para cada tópico baseando-se no histórico geral de concursos policiais.'}
      
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
