export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string;
  xp: number;
  level: number;
  totalStudyTime: number;
  dailyGoalMinutes?: number;
  createdAt: string;
}

export interface Subject {
  id: string;
  name: string;
  weight: number;
  difficulty: number;
  color: string;
  order: number;
}

export interface Topic {
  id: string;
  subjectId: string;
  title: string;
  theoryProgress: number; // 0-100
  questionsSolved: number;
  correctAnswers: number;
  lastStudied?: string;
  nextReview?: string;
  relevance?: 'alta' | 'média' | 'baixa';
  concluido?: boolean;
  studiedResumo: boolean;
  studiedQuestoes: boolean;
  studiedFlashcards: boolean;
  order: number;
}

export interface StudySession {
  id: string;
  userId: string;
  subjectId: string;
  topicId?: string;
  startTime: string;
  endTime?: string;
  netTimeMinutes: number;
  questionsCount: number;
  correctCount: number;
  xpEarned: number;
}

export type ExerciseType = 'corrida' | 'barra' | 'flexao' | 'abdominal';

export interface TAFSession {
  id: string;
  userId: string;
  date: string;
  exerciseType: ExerciseType;
  performance: number;
  unit: string;
}

export interface KnowledgeDiscipline {
  id?: string;
  userId: string;
  name: string;
  knowledgeData?: Record<string, StructuredKnowledgeResult> | null;
  createdAt: string;
  updatedAt?: string;
}

export interface StructuredKnowledgeResult {
  // --- Retrocompatibilidade (Estilo Antigo) ---
  visaoGeral?: {
    fichas?: { titulo: string; definicaoCurta: string }[]; // Novo formato "Missão"
    textoDenso?: string; // Mantido para retrocompatibilidade
    divergencias?: string;
    feynman?: string;
  };
  alertasEspeciais?: { tipo: 'IMPORTANTE' | 'LEMBRE-SE' | 'ATENÇÃO'; texto: string }[];
  mnemonicos?: { acronimo: string; significado: string; fraseAtivadora: string }[];
  esquemas?: {
    titulo: string;
    hierarquia?: { pai: string; filhos: string[] }[]; // Novo Schema de Chaves
    headers?: string[]; // Mantido para retrocompatibilidade
    rows?: string[][]; // Mantido para retrocompatibilidade
  }[];
  baseLegal?: {
    artigo: string;
    texto: string;
    comentario: string;
    feynman: string;
  }[];
  jurisprudencia?: {
    origem: string;
    tese: string;
    texto: string;
    feynman: string;
  }[];
  pegadinhas?: string[];
  faq?: { pergunta: string; resposta: string }[];
  sintese?: string[];
  estudoAtivo?: {
    enunciado: string;
    alternativas: string[];
    gabarito: string;
    comentario: string;
  }[];

  // --- Novos 9 Pilares (Doutrinador Jurídico Sênior) ---
  nucleoEssencial?: {
    fichas: { titulo: string; definicaoCurta: string }[];
  };
  analiseDoutrinaria?: {
    texto: string;
    divergencias: string;
  };
  quadrosSinoticos?: {
    titulo: string;
    comparativo: {
      headers: string[];
      rows: string[][];
    };
  }[];
  literalidadeBaseLegal?: {
    artigo: string;
    texto: string;
    comentario: string;
  }[];
  jurisprudenciaSumulas?: {
    origem: string;
    tese: string;
    texto: string;
  }[];
  puloDoGatoPegadinhas?: { tipo: 'IMPORTANTE' | 'LEMBRE-SE' | 'ATENÇÃO'; texto: string }[];
  metodoFeynman?: { conceito: string; analogiaSimplificada: string }[];
  questoesFixacao?: {
    enunciado: string;
    alternativas: string[];
    gabarito: string;
    comentario: string;
  }[];
  planoRevisao?: string[];
}
