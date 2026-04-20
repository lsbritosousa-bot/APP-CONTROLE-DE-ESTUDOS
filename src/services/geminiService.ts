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
Você é um DOUTRINADOR JURÍDICO SÊNIOR e MENTOR ACADÊMICO. 
Sua função é gerar resumos de estudos estruturados com ALTA DENSIDADE TÉCNICA E ACADÊMICA a partir de textos brutos, recortes de lei, prints ou frases.

DIRETRIZES FUNDAMENTAIS DO SEU MÉTODO:
1. COMPLEMENTAÇÃO AUTOMÁTICA: Se o acadêmico enviar apenas o número de um artigo (ex: "Art. 5º, XLII") ou uma frase isolada, VOCÊ TEM OBRIGAÇÃO DE BUSCAR, TRANSCREVER a literalidade da lei associada, injetar a doutrina majoritária daquele tema e elencar a jurisprudência atualizada dos tribunais superiores (STF/STJ) a respeito. Não seja preguiçoso.
2. DENSIDADE TÉCNICA: Abandone o estilo de "dicas genéricas". Adote terminologia jurídica precisa e linguagem acadêmica sofisticada. Seu material final tem que ser 100% autossuficiente. O usuário não deve precisar ler um livro PDF para revisar esse tópico.
3. PARETO 80/20: Separe a gordura daquilo que cai em avaliações de alto desempenho e concursos difíceis. Foque a extração inicial no "cerne" da questão jurídica.
4. INTEGRAÇÃO CUMULATIVA: Se já existir conteúdo na "BASE EXISTENTE", faça o 'merge' (fusão) orgânica, elevando o nível, expandindo tabelas e jurisprudência, sem nunca perder o patrimônio intelectual que já estava consolidado no documento antigo. Atualize, não destrua.

Gere o seu retorno *ESTRITAMENTE* neste padrão JSON validando 9 PILARES DE RETENÇÃO (Crie conteúdo abrangente para preencher cada um deles de forma rica):

BASE DE CONHECIMENTO EXISTENTE:
${existingKnowledge ? JSON.stringify(existingKnowledge, null, 2) : "Nenhuma base anterior. Crie a primária do zero a partir dos novos dados."}

NOVA INFORMAÇÃO FORNECIDA:
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
            nucleoEssencial: {
              type: Type.OBJECT,
              properties: {
                fichas: {
                   type: Type.ARRAY,
                   items: { type: Type.OBJECT, properties: { titulo: { type: Type.STRING }, definicaoCurta: { type: Type.STRING } }, required: ["titulo", "definicaoCurta"] }
                }
              },
              required: ["fichas"]
            },
            analiseDoutrinaria: {
              type: Type.OBJECT,
              properties: {
                 texto: { type: Type.STRING },
                 divergencias: { type: Type.STRING }
              },
              required: ["texto", "divergencias"]
            },
            quadrosSinoticos: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  titulo: { type: Type.STRING },
                  comparativo: { 
                     type: Type.OBJECT, 
                     properties: { headers: { type: Type.ARRAY, items: { type: Type.STRING } }, rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } } }, required: ["headers", "rows"] 
                  }
                },
                required: ["titulo", "comparativo"]
              }
            },
            literalidadeBaseLegal: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  artigo: { type: Type.STRING },
                  texto: { type: Type.STRING },
                  comentario: { type: Type.STRING }
                },
                required: ["artigo", "texto", "comentario"]
              }
            },
            jurisprudenciaSumulas: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  origem: { type: Type.STRING },
                  tese: { type: Type.STRING },
                  texto: { type: Type.STRING }
                },
                required: ["origem", "tese", "texto"]
              }
            },
            puloDoGatoPegadinhas: {
              type: Type.ARRAY,
              items: { type: Type.OBJECT, properties: { tipo: { type: Type.STRING }, texto: { type: Type.STRING } }, required: ["tipo", "texto"] }
            },
            metodoFeynman: { 
              type: Type.ARRAY, 
              items: { type: Type.OBJECT, properties: { conceito: { type: Type.STRING }, analogiaSimplificada: { type: Type.STRING } }, required: ["conceito", "analogiaSimplificada"] } 
            },
            questoesFixacao: {
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
            planoRevisao: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: [
            "nucleoEssencial", "analiseDoutrinaria", "quadrosSinoticos", "literalidadeBaseLegal", 
            "jurisprudenciaSumulas", "puloDoGatoPegadinhas", "metodoFeynman", "questoesFixacao", "planoRevisao"
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

export interface ExamQuestion {
  id: string;
  subjectId: string;
  topicTitle: string;
  enunciado: string;
  tipo: 'CEBRASPE' | 'MULTIPLA_ESCOLHA';
  gabaritoCebraspe?: 'CERTO' | 'ERRADO';
  alternativas?: string[];
  gabaritoMultipla?: 'A' | 'B' | 'C' | 'D' | 'E';
  comentario: string;
}

export const generateExamQuestions = async (
  banca: string,
  cargo: string,
  source: { type: 'app'; materias: { name: string; weight: number; topics: string[] }[] } | { type: 'text'; text: string },
  totalQuestions: number
): Promise<ExamQuestion[]> => {
  const model = "gemini-2.5-flash";

  const isCebraspe = banca.toUpperCase().includes('CEBRASPE') || banca.toUpperCase().includes('CESPE');

  const subjectsContext = source.type === 'app' 
    ? JSON.stringify(source.materias) 
    : source.text;

  const prompt = `
Você é um EXAMINADOR SÊNIOR de bancas de concurso público focado na carreira policial.
Crie um simulado de concurso com um total de exatas ${totalQuestions} questões, distribuídas entre as matérias e tópicos solicitados.

Contexto do Simulado:
- Banca: ${banca}
- Cargo: ${cargo}
- Estilo da Questão: ${isCebraspe ? 'Certo ou Errado (CEBRASPE)' : 'Múltipla Escolha (5 alternativas A a E, FGV/VUNESP/FCC)'}

Matérias e Tópicos base (Você deve extrair os assuntos deste conteúdo e gerar todas as questões EXCLUSIVAMENTE sobre o que está descrito abaixo. Se for um recorte específico de uma lei ou edital, limite-se a ele):
${subjectsContext}

Diretrizes Inegociáveis:
1. O JSON retornado DEVE conter exatamente ${totalQuestions} questões (itens).
2. TIPO DA QUESTÃO: 
   - Se for CEBRASPE, use "CEBRASPE" com "gabaritoCebraspe" sendo "CERTO" ou "ERRADO". Não gere campo de alternativas.
   - Se for outra banca, use "MULTIPLA_ESCOLHA", popule "alternativas" com 5 frases curtas, e "gabaritoMultipla" sendo "A", "B", "C", "D" ou "E".
3. Mantenha os textos dos enunciados de tamanho adequado para simulados de alto nível.
4. O campo "comentario" deve explicar qual é a armadilha do examinador ou o embasamento legal.
`;

  try {
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
              id: { type: Type.STRING, description: "ID único gerado (uuid ou timestamp)" },
              subjectId: { type: Type.STRING, description: "Nome da matéria" },
              topicTitle: { type: Type.STRING, description: "Nome do tópico cobrado" },
              enunciado: { type: Type.STRING, description: "Enunciado da questão" },
              tipo: { type: Type.STRING, description: "CEBRASPE ou MULTIPLA_ESCOLHA" },
              gabaritoCebraspe: { type: Type.STRING, description: "Se CEBRASPE: CERTO ou ERRADO" },
              alternativas: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Se MULTIPLA_ESCOLHA: 5 opções de respostas" },
              gabaritoMultipla: { type: Type.STRING, description: "Se MULTIPLA_ESCOLHA: A, B, C, D ou E" },
              comentario: { type: Type.STRING, description: "Comentário do professor para ajudar nos estudos" }
            },
            required: ["id", "subjectId", "topicTitle", "enunciado", "tipo", "comentario"]
          }
        }
      }
    });

    const rawText = response.text || '';
    
    let cleanedJSON = rawText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    if (!cleanedJSON.startsWith('[')) {
      const start = cleanedJSON.indexOf('[');
      const end = cleanedJSON.lastIndexOf(']');
      if (start !== -1 && end !== -1 && start < end) {
        cleanedJSON = cleanedJSON.substring(start, end + 1);
      }
    }

    return JSON.parse(cleanedJSON) as ExamQuestion[];
  } catch (error) {
    console.error("Erro em generateExamQuestions:", error);
    throw new Error("Erro na geração do simulado com a IA.");
  }
};
