import { GoogleGenAI, Type } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const parseSyllabus = async (text: string, examBoard?: string) => {
  const model = "gemini-2.5-flash";
  
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

export interface DistillationResult {
  raio_x: string;
  resumo: string[];
  armadilhas: string;
  gatilho: string;
  flashcard: { frente: string; verso: string };
}

export const distillContent = async (text: string, examBoard?: string): Promise<DistillationResult> => {
  const model = "gemini-2.5-flash";
  
  const prompt = `
Role: Especialista em Microlearning, Neurociência da Aprendizagem e Mentor de Concursos Públicos.
Missão: Receber conteúdo bruto (leis, questões, doutrina) e transformá-lo em um "Resumo Autossuficiente de Alta Retenção".

Regras Inegociáveis:
- Gatilho Inicial: COMECE SEMPRE o processamento, mas como você vai retornar em JSON, apenas garanta o preenchimento correto dos campos pedidos.
- Higiene Textual: Zero enrolação. Frases curtas e diretas.
- Negrito Estratégico (Alerta de Perigo): O uso de **negrito** é estritamente proibido para enfeite. Deve ser usado APENAS em prazos, exceções, palavras-chave de pegadinhas e conceitos que as bancas costumam trocar.
- Autossuficiência: O resumo deve permitir resolver questões sobre o tema sem ler o original.
${examBoard ? `- Filtro de Banca: O usuário focou na banca: **${examBoard}**. Personalize as "Armadilhas" para os vícios e padrões específicos desta banca.` : ''}

Conteúdo Bruto a ser destilado:
${text}

Retorne ESTRITAMENTE o resultado no formato JSON exigido pelo Schema. O resumo deve ser uma lista de strings (bullet points lógicos).
`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          raio_x: { type: Type.STRING, description: "Conceito central em no máximo 2 linhas." },
          resumo: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "O núcleo duro em bullet points lógicos."
          },
          armadilhas: { type: Type.STRING, description: "Onde a banca mente (Regra X vs Mentira Y)." },
          gatilho: { type: Type.STRING, description: "Mnemônico ou associação lógica absurda." },
          flashcard: {
            type: Type.OBJECT,
            properties: {
              frente: { type: Type.STRING, description: "Pergunta formatada para Anki." },
              verso: { type: Type.STRING, description: "Resposta formatada para Anki." }
            },
            required: ["frente", "verso"],
            description: "Pergunta e Resposta formatada para Anki (Frente/Verso)."
          }
        },
        required: ["raio_x", "resumo", "armadilhas", "gatilho", "flashcard"]
      }
    }
  });

  return JSON.parse(response.text);
};
