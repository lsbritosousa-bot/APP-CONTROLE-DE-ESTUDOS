import { GoogleGenAI, Type } from "@google/genai";
import { StructuredKnowledgeResult } from "../types";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const safetySettings = [
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }
];

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
      safetySettings,
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

  const rawText = response.text || '';
  try {
    let cleanedJSON = rawText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    if (!cleanedJSON.startsWith('[')) {
      const start = cleanedJSON.indexOf('[');
      const end = cleanedJSON.lastIndexOf(']');
      if (start !== -1 && end !== -1 && start < end) {
        cleanedJSON = cleanedJSON.substring(start, end + 1);
      }
    }
    return JSON.parse(cleanedJSON);
  } catch (error) {
    console.error("Erro no parse do JSON (parseSyllabus):", rawText);
    throw new Error("Erro de formatação na resposta (parseSyllabus).");
  }
};

export interface DistillationResult {
  gatilho_inicial: string;
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
- Gatilho Inicial: Toda resposta DEVE começar com a mensagem "Material recebido. Iniciando destilação de conteúdo." Contudo, como o retorno deverá ser ESTRITAMENTE em JSON, coloque essa mensagem dento do campo 'gatilho_inicial'.
- Higiene Textual: Zero enrolação. Frases curtas e diretas. SEMPRE COM ASPAS DUPLAS, para não quebrar o JSON.
- Negrito Estratégico (Alerta de Perigo): O uso de **negrito** é estritamente proibido para enfeite. Deve ser usado APENAS em prazos, exceções, palavras-chave de pegadinhas e conceitos que as bancas costumam trocar.
- Autossuficiência: O resumo deve permitir resolver questões sobre o tema sem ler o original.
${examBoard ? `- Filtro de Banca: O usuário focou na banca: **${examBoard}**. Personalize as "Armadilhas" para os vícios e padrões específicos desta banca.` : ''}

Conteúdo Bruto a ser destilado:
${text}

Retorne ESTRITAMENTE o resultado no formato JSON exigido pelo Schema. Não inclua comentários fora do JSON.
`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        safetySettings,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            gatilho_inicial: { type: Type.STRING, description: "A mensagem obrigatória de início." },
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
          required: ["gatilho_inicial", "raio_x", "resumo", "armadilhas", "gatilho", "flashcard"]
        }
      }
    });

    const rawText = response.text || '';
    
    let cleanedJSON = rawText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    if (!cleanedJSON.startsWith('{')) {
      const start = cleanedJSON.indexOf('{');
      const end = cleanedJSON.lastIndexOf('}');
      if (start !== -1 && end !== -1 && start < end) {
        cleanedJSON = cleanedJSON.substring(start, end + 1);
      }
    }

    return JSON.parse(cleanedJSON);
  } catch (error) {
    console.error("Erro em distillContent:", error);
    if (error instanceof Error && error.message.includes("JSON")) {
       throw new Error("Erro de formatação JSON na resposta da IA.");
    }
    throw error;
  }
};

export const generateStructuredKnowledge = async (
  existingKnowledge: StructuredKnowledgeResult | null,
  newText: string,
  images?: { mimeType: string; data: string }[]
): Promise<StructuredKnowledgeResult> => {
  const model = "gemini-2.5-flash";

  const prompt = `
Você é um Desenvolvedor Full-Stack Senior e Arquiteto de Conteúdo para Concursos Públicos. Seu objetivo é processar recortes de questões, textos de lei, jurisprudência, doutrina e/ou imagens e retornar um material de estudo ESTRUTURADO, Autossuficiente, Denso e Definitivo.

ATENÇÃO AO MODO ACUMULATIVO:
Se houver uma "BASE DE CONHECIMENTO EXISTENTE" abaixo, seu trabalho é LER os itens novos (NOVA INFORMAÇÃO), combinar os dados antigos com os novos, expandir o que for necessário, e retornar a Base de Dados COMPLETAMENTE ATUALIZADA no formato de saída. Não exclua os resumos anteriores, ACUMULE E ORGANIZE.

DIRETRIZES TÉCNICAS:
1. Exaustividade Absoluta (nível doutrinário).
2. Método de Feynman: Em todos os campos "feynman" requeridos, inclua analogias da vida real.
3. Pensamento Comparativo e Esquemas.

O formato de saída deve ser ESTRITAMENTE o JSON exigido pela API. Retorne TODOS os campos (Visão Geral, Esquemas, Mapa Mental em formato sereia/mermaid, Base Legal, Jurisprudência, FAQ, Pegadinhas, Estudo Ativo e Flashcards). Mantenha o JSON perfeitamente válido sem marcação adicional além do objeto raiz.

BASE DE CONHECIMENTO EXISTENTE:
${existingKnowledge ? JSON.stringify(existingKnowledge, null, 2) : "Nenhuma base anterior. Crie a base primária do zero a partir dos novos dados."}

NOVA INFORMAÇÃO (TEXTO E IMAGENS):
${newText || "Nenhum texto adicional."}
`;

  try {
    const contents: any[] = [];
    const parts: any[] = [{ text: prompt }];

    if (images && images.length > 0) {
      images.forEach(img => {
         parts.push({
           inlineData: {
             data: img.data,
             mimeType: img.mimeType
           }
         });
      });
    }
    
    contents.push({ role: "user", parts });

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        safetySettings,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            visaoGeral: {
              type: Type.OBJECT,
              properties: {
                textoDenso: { type: Type.STRING },
                divergencias: { type: Type.STRING },
                feynman: { type: Type.STRING }
              },
              required: ["textoDenso", "divergencias", "feynman"]
            },
            esquemas: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  titulo: { type: Type.STRING },
                  headers: { type: Type.ARRAY, items: { type: Type.STRING } },
                  rows: { 
                     type: Type.ARRAY, 
                     items: { type: Type.ARRAY, items: { type: Type.STRING } }
                  }
                },
                required: ["titulo", "headers", "rows"]
              }
            },
            mapaMental: { type: Type.STRING, description: "Diagrama Mermaid string válida" },
            baseLegal: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  artigo: { type: Type.STRING },
                  texto: { type: Type.STRING },
                  comentario: { type: Type.STRING },
                  feynman: { type: Type.STRING }
                },
                required: ["artigo", "texto", "comentario", "feynman"]
              }
            },
            jurisprudencia: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  origem: { type: Type.STRING },
                  tese: { type: Type.STRING },
                  texto: { type: Type.STRING },
                  feynman: { type: Type.STRING }
                },
                required: ["origem", "tese", "texto", "feynman"]
              }
            },
            pegadinhas: { type: Type.ARRAY, items: { type: Type.STRING } },
            faq: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  pergunta: { type: Type.STRING },
                  resposta: { type: Type.STRING }
                },
                required: ["pergunta", "resposta"]
              }
            },
            sintese: { type: Type.ARRAY, items: { type: Type.STRING } },
            estudoAtivo: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  enunciado: { type: Type.STRING },
                  alternativas: { type: Type.ARRAY, items: { type: Type.STRING } },
                  gabarito: { type: Type.STRING },
                  comentario: { type: Type.STRING }
                },
                required: ["enunciado", "alternativas", "gabarito", "comentario"]
              }
            },
            flashcards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  frente: { type: Type.STRING },
                  verso: { type: Type.STRING }
                },
                required: ["frente", "verso"]
              }
            }
          },
          required: [
            "visaoGeral", "esquemas", "mapaMental", "baseLegal", "jurisprudencia",
            "pegadinhas", "faq", "sintese", "estudoAtivo", "flashcards"
          ]
        }
      }
    });

    const rawText = response.text || '';
    
    let cleanedJSON = rawText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    if (!cleanedJSON.startsWith('{')) {
      const start = cleanedJSON.indexOf('{');
      const end = cleanedJSON.lastIndexOf('}');
      if (start !== -1 && end !== -1 && start < end) {
        cleanedJSON = cleanedJSON.substring(start, end + 1);
      }
    }

    return JSON.parse(cleanedJSON) as StructuredKnowledgeResult;
  } catch (error) {
    console.error("Erro em generateStructuredKnowledge:", error);
    throw new Error("Erro na geração da Base de Conhecimento Estruturada.");
  }
};

