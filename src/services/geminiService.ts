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

export const identifyKnowledgeTopic = async (
  text: string,
  images: { mimeType: string; data: string }[] | undefined,
  existingTopics: string[]
): Promise<string> => {
  const model = "gemini-2.5-flash";

  const prompt = `
Você é um Classificador de Assuntos para uma Base de Conhecimento Jurídico/Estudos.
Seu trabalho é ler a NOVA INFORMAÇÃO (texto e/ou imagens contendo doutrina, lei, questões).
Depois, você deve avaliar a lista de "TÓPICOS EXISTENTES" e responder com o nome do Tópico ao qual a NOVA INFORMAÇÃO pertence.
Se a nova informação engloba um dos tópicos existentes, responda exatamente com o nome daquele tópico (sem alterar a string).
Se a nova informação fala sobre um assunto COMPLETAMENTE NOVO ou que não se encaixa direito, CRIE e devolva um NOVO NOME DE TÓPICO (Curto, exato, máximo de 4 a 5 palavras). Ex: "Lei Penal no Tempo e Espaço".

TÓPICOS EXISTENTES NA BASE DESSA DISCIPLINA:
${existingTopics.length > 0 ? existingTopics.map(t => `- ${t}`).join("\\n") : "Ainda não existem tópicos. Você criará o primeiro."}

NOVA INFORMAÇÃO (TEXTO/IMAGEM):
${text || "Nenhum texto. Analise pelas imagens."}

Responda ESTRITAMENTE o NOME DO TÓPICO, sem aspas, sem explicações extras. Apenas a string final que deve representar a gaveta de salvamento dessa informação.`;

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
      config: { safetySettings }
    });

    const topicName = (response.text || "").replace(/["'\\]/g, '').trim();
    if (!topicName) return "Assuntos Gerais";
    return topicName;
  } catch (error) {
    console.error("Erro em identifyKnowledgeTopic:", error);
    return "Assuntos Diversos";
  }
};

export const generateStructuredKnowledge = async (
  existingKnowledge: StructuredKnowledgeResult | null,
  newText: string,
  images?: { mimeType: string; data: string }[]
): Promise<StructuredKnowledgeResult> => {
  const model = "gemini-2.5-flash";

  const prompt = `
Você é um Arquiteto de Conteúdo para Concursos Públicos (estilo "Projeto Missão"). 
Seu trabalho é pegar o "TEXTO BRUTO" ou as "IMAGENS" e produzir/atualizar um Material Estruturado, focado em ALTA RETENÇÃO VISUAL E SUCINTO.

REGRAS DE FORMATAÇÃO "MISSÃO" INEGOCIÁVEIS:
1. BLOCOS CURTOS ("FICHAS"): É estritamente proibido usar parágrafos longos ou "textos densos" narrativos. TODO CONCEITO deve ser quebrado em "Fichas" temáticas (um título/tópico curto + definição direta de no máximo 3 a 4 linhas).
2. MNEMÔNICOS: Sempre que identificar uma lista de itens, requisitos constitucionais ou princípios, crie um Acrônimo/Mnemônico forte para o candidato decorar, e forneça uma "frase ativadora" das letras (Ex: "PODC -> Pode Ser!").
3. ALERTAS DE CORTE: Toda pegadinha, exceção jurisprudencial, ou prazo fatal não deve ficar perdido no meio do texto. Puxe e agrupe-os em "Alertas Especiais" separados (com tipo IMPORTANTE, LEMBRE-SE ou ATENÇÃO).
4. ESQUEMAS HIERÁRQUICOS: Quando for útil dividir ou comparar, no campo "esquemas" crie árvores de chaves (O campo Pai ligado a um array de Filhos) que permitam desenhar diagramas indentados.
5. GRIFE COMPULSIVAMENTE: Use \`**palavra**\` exaustivamente para criar contraste tático visual (grifar prazos, excessões, verbos, e conjunções).

FORMATO ACUMULATIVO:
Se existir uma "BASE DE CONHECIMENTO EXISTENTE" abaixo, preserve suas ideias essenciais, integre o NOVO material com extrema organização sem excluir os velhos resumos.

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
                fichas: {
                   type: Type.ARRAY,
                   items: { type: Type.OBJECT, properties: { titulo: { type: Type.STRING }, definicaoCurta: { type: Type.STRING } }, required: ["titulo", "definicaoCurta"] }
                },
                textoDenso: { type: Type.STRING },
                divergencias: { type: Type.STRING },
                feynman: { type: Type.STRING }
              },
              required: ["fichas", "divergencias", "feynman"]
            },
            alertasEspeciais: {
              type: Type.ARRAY,
              items: { type: Type.OBJECT, properties: { tipo: { type: Type.STRING }, texto: { type: Type.STRING } }, required: ["tipo", "texto"] }
            },
            mnemonicos: {
              type: Type.ARRAY,
              items: { type: Type.OBJECT, properties: { acronimo: { type: Type.STRING }, significado: { type: Type.STRING }, fraseAtivadora: { type: Type.STRING } }, required: ["acronimo", "significado", "fraseAtivadora"] }
            },
            esquemas: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  titulo: { type: Type.STRING },
                  hierarquia: { 
                     type: Type.ARRAY, 
                     items: { type: Type.OBJECT, properties: { pai: { type: Type.STRING }, filhos: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["pai", "filhos"] }
                  },
                  headers: { type: Type.ARRAY, items: { type: Type.STRING } },
                  rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } }
                },
                required: ["titulo"]
              }
            },
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
            }
          },
          required: [
            "visaoGeral", "esquemas", "baseLegal", "jurisprudencia",
            "pegadinhas", "faq", "sintese", "estudoAtivo"
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

