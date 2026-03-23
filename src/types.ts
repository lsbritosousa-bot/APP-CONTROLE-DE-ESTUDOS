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
  studiedResumo: boolean;
  studiedQuestoes: boolean;
  studiedFlashcards: boolean;
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
