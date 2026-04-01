import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { AuthProvider, useAuth } from './components/AuthProvider';
import { Edit2, Clock, PenLine, ChevronDown, History, Calendar, ClipboardList, ChevronLeft, Eye, EyeOff, RotateCcw, X, Upload } from 'lucide-react';
import { 
  LayoutDashboard, 
  BookOpen, 
  Dumbbell, 
  Timer, 
  Settings, 
  LogOut, 
  ChevronRight, 
  Trophy, 
  Target, 
  TrendingUp,
  Brain,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, updateDoc, increment, getDocs } from './lib/firestoreSupabase';
import { Subject, Topic, StudySession, TAFSession, ExerciseType } from './types';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isToday, isSameDay } from 'date-fns';

import { parseSyllabus } from './services/geminiService';

// --- Components ---

const SyllabusManager = () => {
  const { profile } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [syllabusText, setSyllabusText] = useState('');
  const [examBoard, setExamBoard] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'users', profile.uid, 'subjects'));
    return onSnapshot(q, (snapshot) => {
      const subs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Subject))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setSubjects(subs);
      if (subs.length > 0 && !selectedSubjectId) setSelectedSubjectId(subs[0].id);
    });
  }, [profile]);

  useEffect(() => {
    if (!profile || !selectedSubjectId) return;
    const q = query(collection(db, 'users', profile.uid, 'subjects', selectedSubjectId, 'topics'));
    return onSnapshot(q, (snapshot) => {
      const sortedTopics = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Topic))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setTopics(sortedTopics);
    });
  }, [profile, selectedSubjectId]);

  const handleParse = async () => {
    if (!profile || !syllabusText) return;
    setIsParsing(true);
    try {
      const parsedData = await parseSyllabus(syllabusText, examBoard);
      
      let subjectOrder = subjects.length;
      for (const item of parsedData) {
        // Create subject
        const subjectRef = await addDoc(collection(db, 'users', profile.uid, 'subjects'), {
          name: item.subjectName,
          weight: 1,
          difficulty: 1,
          color: '#3b82f6',
          order: subjectOrder++
        });

        // Create topics
        const topicsList = Array.isArray(item.topics) ? item.topics : [];
        let topicOrder = 0;
        for (const topicData of topicsList) {
          let title = 'Tópico sem nome';
          let relevance = 'média';

          if (typeof topicData === 'string') {
            title = topicData;
          } else if (topicData && typeof topicData === 'object') {
            title = topicData.title || topicData.name || topicData.nome || topicData.topico || 'Tópico sem nome';
            relevance = topicData.relevance || topicData.relevancia || 'média';
          }

          await addDoc(collection(db, 'users', profile.uid, 'subjects', subjectRef.id, 'topics'), {
            subjectId: subjectRef.id,
            title,
            theoryProgress: 0,
            questionsSolved: 0,
            correctAnswers: 0,
            studiedResumo: false,
            studiedQuestoes: false,
            studiedFlashcards: false,
            relevance,
            order: topicOrder++
          });
        }
      }
      setSyllabusText('');
      alert('Edital verticalizado com sucesso!');
    } catch (error: any) {
      console.error(error);
      alert('Erro ao processar edital: ' + (error?.message || error));
    } finally {
      setIsParsing(false);
    }
  };

  const handleClearSyllabus = async () => {
    if (!profile) return;
    if (!window.confirm('Tem certeza? Isso apagará TODAS as matérias e tópicos atuais.')) return;
    
    try {
      const subjectsSnap = await getDocs(query(collection(db, 'users', profile.uid, 'subjects')));
      for (const subjectDoc of subjectsSnap.docs) {
        const topicsSnap = await getDocs(query(collection(db, 'users', profile.uid, 'subjects', subjectDoc.id, 'topics')));
        for (const topicDoc of topicsSnap.docs) {
          await deleteDoc(doc(db, 'users', profile.uid, 'subjects', subjectDoc.id, 'topics', topicDoc.id));
        }
        await deleteDoc(doc(db, 'users', profile.uid, 'subjects', subjectDoc.id));
      }
      setSelectedSubjectId(null);
      alert('Edital limpo com sucesso!');
    } catch (error) {
      console.error(error);
      alert('Erro ao limpar edital.');
    }
  };

  const toggleTopicStatus = async (topic: Topic, field: 'studiedResumo' | 'studiedQuestoes' | 'studiedFlashcards') => {
    if (!profile || !selectedSubjectId) return;
    const topicRef = doc(db, 'users', profile.uid, 'subjects', selectedSubjectId, 'topics', topic.id);
    
    const newValue = !topic[field];
    const updateData: any = { [field]: newValue };
    
    // Auto-update theory progress if all 3 are done
    const currentResumo = field === 'studiedResumo' ? newValue : topic.studiedResumo;
    const currentQuestoes = field === 'studiedQuestoes' ? newValue : topic.studiedQuestoes;
    const currentFlashcards = field === 'studiedFlashcards' ? newValue : topic.studiedFlashcards;
    
    // Calculate progress granularly: each method is ~33%
    const count = [currentResumo, currentQuestoes, currentFlashcards].filter(Boolean).length;
    updateData.theoryProgress = Math.round((count / 3) * 100);

    // Set lastStudied when marking anything as studied
    if (newValue) {
      updateData.lastStudied = new Date().toISOString();
    }

    await updateDoc(topicRef, updateData);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Edital Verticalizado</h1>
        <p className="text-muted-foreground">Organize seu progresso tópico a tópico com inteligência artificial.</p>
      </header>

      <section className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Brain size={20} className="text-primary" />
            Importar Novo Edital
          </h3>
          {subjects.length > 0 && (
            <button 
              onClick={handleClearSyllabus}
              className="text-red-500 hover:text-red-600 text-sm font-bold flex items-center gap-1 transition-colors"
            >
              <Trash2 size={16} /> Limpar Edital Atual
            </button>
          )}
        </div>

        <input 
          type="text"
          value={examBoard}
          onChange={(e) => setExamBoard(e.target.value)}
          placeholder="Banca Examinadora (opcional, ex: CEBRASPE, VUNESP)"
          className="w-full bg-muted border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20"
        />

        <textarea 
          value={syllabusText}
          onChange={(e) => setSyllabusText(e.target.value)}
          placeholder="Cole aqui o conteúdo programático do seu edital..."
          className="w-full h-32 bg-muted border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 resize-none"
        />
        <button 
          onClick={handleParse}
          disabled={isParsing || !syllabusText}
          className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
        >
          {isParsing ? 'Processando...' : 'Processar com IA'}
        </button>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <aside className="lg:col-span-1 space-y-2">
          <h3 className="font-bold text-sm uppercase tracking-widest text-muted-foreground mb-4">Matérias</h3>
          {subjects.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedSubjectId(s.id)}
              className={cn(
                "w-full text-left px-4 py-3 rounded-xl transition-all",
                selectedSubjectId === s.id ? "bg-primary/10 text-primary font-bold border border-primary/20" : "hover:bg-muted"
              )}
            >
              {s.name}
            </button>
          ))}
        </aside>

        <div className="lg:col-span-3 space-y-4">
          <h3 className="font-bold text-sm uppercase tracking-widest text-muted-foreground mb-4">Tópicos e Progresso</h3>
          {topics.length === 0 ? (
            <div className="text-center py-12 bg-muted/30 rounded-2xl border border-dashed border-border">
              <p className="text-muted-foreground">Selecione uma matéria ou importe um edital.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topics.map(t => (
                <div key={t.id} className="bg-card border border-border p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm md:text-base flex items-center gap-2">
                      {t.title}
                      {t.relevance && (
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          t.relevance.toLowerCase() === 'alta' ? "bg-red-500/10 text-red-500" :
                          t.relevance.toLowerCase() === 'média' || t.relevance.toLowerCase() === 'media' ? "bg-yellow-500/10 text-yellow-500" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {t.relevance}
                        </span>
                      )}
                    </h4>
                    <div className="mt-2 h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${t.theoryProgress}%` }} />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => toggleTopicStatus(t, 'studiedResumo')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                        t.studiedResumo ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-muted text-muted-foreground border-transparent"
                      )}
                    >
                      Resumo
                    </button>
                    <button 
                      onClick={() => toggleTopicStatus(t, 'studiedQuestoes')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                        t.studiedQuestoes ? "bg-blue-500/10 text-blue-500 border-blue-500/20" : "bg-muted text-muted-foreground border-transparent"
                      )}
                    >
                      Questões
                    </button>
                    <button 
                      onClick={() => toggleTopicStatus(t, 'studiedFlashcards')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                        t.studiedFlashcards ? "bg-purple-500/10 text-purple-500 border-purple-500/20" : "bg-muted text-muted-foreground border-transparent"
                      )}
                    >
                      Flashcards
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200",
      active 
        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    )}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </button>
);

const XPBar = ({ xp, level }: { xp: number, level: number }) => {
  const progress = (xp % 1000) / 10; // 0-100

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between text-sm font-medium">
        <span className="text-muted-foreground">Nível {level}</span>
        <span className="text-primary">{xp % 1000} / 1000 XP</span>
      </div>
      <div className="h-3 w-full bg-muted rounded-full overflow-hidden border border-border/50">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]"
        />
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { profile } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [newGoal, setNewGoal] = useState(profile?.dailyGoalMinutes || 240);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'users', profile.uid, 'subjects'));
    return onSnapshot(q, (snapshot) => {
      const subs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Subject))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setSubjects(subs);
    });
  }, [profile]);

  // Subscribe to topics for each subject in real-time so Edital changes propagate
  useEffect(() => {
    if (!profile || subjects.length === 0) return;
    
    const unsubscribes: (() => void)[] = [];
    const topicsBySubject: Record<string, Topic[]> = {};

    subjects.forEach(s => {
      const q = query(collection(db, 'users', profile.uid, 'subjects', s.id, 'topics'));
      const unsub = onSnapshot(q, (snapshot) => {
        topicsBySubject[s.id] = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Topic))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        // Merge all topics from all subjects
        const merged = Object.values(topicsBySubject).flat();
        setAllTopics(merged);
      });
      unsubscribes.push(unsub);
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [profile, subjects]);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'users', profile.uid, 'sessions'), orderBy('startTime', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudySession)));
    });
  }, [profile]);

  const totalMinutes = sessions.reduce((acc, s) => acc + s.netTimeMinutes, 0);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const today = new Date().toISOString().split('T')[0];
  const todayMinutes = sessions
    .filter(s => s.startTime.startsWith(today))
    .reduce((acc, s) => acc + s.netTimeMinutes, 0);
  
  const dailyGoal = profile?.dailyGoalMinutes || 240;
  const dailyProgress = Math.min(100, Math.round((todayMinutes / dailyGoal) * 100));

  const totalTopics = allTopics.length;
  const syllabusProgress = totalTopics > 0 ? Math.round(allTopics.reduce((acc, t) => acc + (t.theoryProgress || 0), 0) / totalTopics) : 0;

  // Missão do Dia dinâmica: avança para a próxima disciplina não estudada hoje
  const sortedByWeight = [...subjects].sort((a, b) => b.weight - a.weight);
  const todayStudiedSubjectIds = new Set(
    sessions
      .filter(s => s.startTime.startsWith(today))
      .map(s => s.subjectId)
  );
  const nextSubject = sortedByWeight.find(s => !todayStudiedSubjectIds.has(s.id)) || null;
  const allStudiedToday = subjects.length > 0 && sortedByWeight.every(s => todayStudiedSubjectIds.has(s.id));

  const pendingReviews = allTopics
    .filter(t => t.theoryProgress > 0 && t.lastStudied)
    .sort((a, b) => new Date(a.lastStudied!).getTime() - new Date(b.lastStudied!).getTime())
    .slice(0, 5);

  // Tópicos com questões resolvidas para o Histórico
  const topicsWithQuestions = allTopics
    .filter(t => t.questionsSolved > 0)
    .sort((a, b) => (b.questionsSolved || 0) - (a.questionsSolved || 0));

  const toggleExpandSubject = (id: string) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateGoal = async () => {
    if (!profile) return;
    await updateDoc(doc(db, 'users', profile.uid), {
      dailyGoalMinutes: newGoal
    });
    setIsEditingGoal(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bem-vindo, Recruta.</h1>
          <p className="text-muted-foreground">Sua meta é a farda. O caminho é o estudo.</p>
        </div>
        <div className="bg-card border border-border p-4 rounded-2xl shadow-sm min-w-[240px]">
          <XPBar xp={profile?.xp || 0} level={profile?.level || 1} />
        </div>
      </header>

      {/* Card Total de Horas Estudadas */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-red-500/10 border border-yellow-500/20 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-yellow-500/10 text-yellow-500 rounded-xl">
            <Trophy size={28} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-yellow-500 uppercase tracking-widest mb-1">Total de Horas Estudadas para o Concurso</h2>
            <p className="text-4xl font-black">{hours}h {minutes}m</p>
            <p className="text-xs text-muted-foreground mt-1">Soma de todas as suas sessões de estudo registradas.</p>
          </div>
        </div>
      </motion.div>

      {/* Missão do Dia Dinâmica */}
      {allStudiedToday ? (
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-green-500/10 to-transparent border border-green-500/20 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div>
            <h2 className="text-sm font-bold text-green-500 uppercase tracking-widest mb-1 flex items-center gap-2">
              <CheckCircle2 size={16} /> Missão do Dia — Completa!
            </h2>
            <p className="text-2xl font-black">Parabéns, Recruta! 🎉</p>
            <p className="text-xs text-muted-foreground mt-1">Você já estudou todas as disciplinas do ciclo hoje. Descanse ou revise!</p>
          </div>
        </motion.div>
      ) : nextSubject ? (
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div>
            <h2 className="text-sm font-bold text-primary uppercase tracking-widest mb-1 flex items-center gap-2">
              <Target size={16} /> Missão do Dia
            </h2>
            <p className="text-2xl font-black">{nextSubject.name}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Próxima disciplina a estudar (Peso {nextSubject.weight}). 
              {todayStudiedSubjectIds.size > 0 && ` Você já estudou ${todayStudiedSubjectIds.size} de ${subjects.length} disciplinas hoje.`}
            </p>
          </div>
        </motion.div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Timer size={20} />
            <span className="text-sm font-semibold uppercase tracking-wider">Meta Diária</span>
          </div>
          <div className="flex items-end justify-between">
            <div className="text-4xl font-bold">{Math.floor(todayMinutes / 60)}h {todayMinutes % 60}m</div>
            <button onClick={() => setIsEditingGoal(true)} className="text-xs text-primary hover:underline">Editar</button>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden mt-2">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${dailyProgress}%` }}
              className="h-full bg-primary"
            />
          </div>
          <p className="text-[10px] text-muted-foreground text-right">{dailyProgress}% da meta de {Math.floor(dailyGoal / 60)}h</p>
        </div>

        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-green-500">
            <CheckCircle2 size={20} />
            <span className="text-sm font-semibold uppercase tracking-wider">Questões</span>
          </div>
          <div className="text-4xl font-bold">
            {sessions.reduce((acc, s) => acc + s.questionsCount, 0)}
          </div>
          <p className="text-xs text-muted-foreground">Resolvidas com foco total</p>
        </div>

        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-orange-500">
            <TrendingUp size={20} />
            <span className="text-sm font-semibold uppercase tracking-wider">Aproveitamento</span>
          </div>
          <div className="text-4xl font-bold">
            {sessions.reduce((acc, s) => acc + s.questionsCount, 0) > 0 
              ? Math.round((sessions.reduce((acc, s) => acc + s.correctCount, 0) / sessions.reduce((acc, s) => acc + s.questionsCount, 0)) * 100)
              : 0}%
          </div>
          <p className="text-xs text-muted-foreground">Média geral de acertos</p>
        </div>

        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-purple-500">
            <Target size={20} />
            <span className="text-sm font-semibold uppercase tracking-wider">Progresso Edital</span>
          </div>
          <div className="text-4xl font-bold">{syllabusProgress}%</div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden mt-2">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${syllabusProgress}%` }}
              className="h-full bg-purple-500"
            />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isEditingGoal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-card border border-border p-8 rounded-3xl shadow-2xl max-w-sm w-full space-y-6"
            >
              <h3 className="text-xl font-bold">Definir Meta Diária</h3>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Minutos de estudo por dia</label>
                <input 
                  type="number" 
                  value={newGoal}
                  onChange={(e) => setNewGoal(Number(e.target.value))}
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-2xl font-bold outline-none focus:ring-2 ring-primary/20"
                />
                <p className="text-xs text-muted-foreground">{Math.floor(newGoal / 60)} horas e {newGoal % 60} minutos</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setIsEditingGoal(false)} className="flex-1 py-3 rounded-xl border border-border font-bold hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={updateGoal} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity">Salvar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-border flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <BookOpen size={22} className="text-primary" />
              Ciclo de Estudos
            </h2>
          </div>
          <div className="p-6">
            {subjects.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Brain size={48} className="mx-auto mb-4 opacity-20" />
                <p>Nenhuma matéria configurada no ciclo.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...subjects].sort((a, b) => b.weight - a.weight).map((s, index) => {
                  const subjectTopics = allTopics.filter(t => t.subjectId === s.id);
                  const total = subjectTopics.length;
                  const progress = total > 0 ? Math.round(subjectTopics.reduce((acc, t) => acc + (t.theoryProgress || 0), 0) / total) : 0;
                  const studiedTopics = subjectTopics.filter(t => t.theoryProgress > 0);
                  const isExpanded = expandedSubjects.has(s.id);

                  return (
                    <div key={s.id} className="rounded-xl bg-muted/50 border border-border/50 overflow-hidden">
                      <button
                        onClick={() => toggleExpandSubject(s.id)}
                        className="w-full flex items-center justify-between p-4 hover:bg-muted/80 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                          <div className="text-left">
                            <p className="font-semibold">{s.name}</p>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                              <span className="text-primary mr-1 bg-primary/10 px-1.5 rounded">Ordem {index + 1}</span>
                              <span>Peso {s.weight}</span>
                              <span>•</span>
                              <span>Dif {s.difficulty}</span>
                              {studiedTopics.length > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-green-500">{studiedTopics.length}/{total} tópicos</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right space-y-1">
                            <div className="text-xs font-bold">{progress}%</div>
                            <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                className="h-full bg-primary"
                              />
                            </div>
                          </div>
                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown size={16} className="text-muted-foreground" />
                          </motion.div>
                        </div>
                      </button>
                      <AnimatePresence>
                        {isExpanded && studiedTopics.length > 0 && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 pt-1 space-y-2 border-t border-border/30">
                              {studiedTopics.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(t => (
                                <div key={t.id} className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-background/50 text-sm">
                                  <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                                  <span className="flex-1 truncate">{t.title}</span>
                                  <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{t.theoryProgress}%</span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                        {isExpanded && studiedTopics.length === 0 && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 pt-1 border-t border-border/30">
                              <p className="text-xs text-muted-foreground italic py-2">Nenhum tópico estudado ainda nesta disciplina.</p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-border">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <AlertCircle size={22} className="text-primary" />
              Revisões Pendentes
            </h2>
          </div>
          <div className="p-6">
            {pendingReviews.length === 0 ? (
              <>
                <p className="text-muted-foreground text-sm">Nenhuma revisão pendente detectada ainda.</p>
                <div className="mt-4 text-center py-8 text-muted-foreground italic">
                  "A repetição é a mãe do aprendizado."
                </div>
              </>
            ) : (
              <div className="space-y-3">
                {pendingReviews.map(t => {
                  const sub = subjects.find(s => s.id === t.subjectId);
                  return (
                    <div key={t.id} className="p-3 bg-muted/50 rounded-xl border border-border/50 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sub?.color || '#ccc' }} />
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{sub?.name || 'Matéria'}</span>
                      </div>
                      <p className="font-semibold text-sm">{t.title}</p>
                      <p className="text-xs text-muted-foreground">Último estudo: {format(parseISO(t.lastStudied!), 'dd/MM/yyyy')}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Histórico de Questões por Tópico */}
      <section className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <History size={22} className="text-primary" />
            Histórico de Questões por Tópico
          </h2>
        </div>
        <div className="p-6">
          {topicsWithQuestions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-sm">Nenhuma questão resolvida ainda. Registre suas questões na aba Estudar.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topicsWithQuestions.map(t => {
                const sub = subjects.find(s => s.id === t.subjectId);
                const erros = (t.questionsSolved || 0) - (t.correctAnswers || 0);
                const aproveitamento = t.questionsSolved > 0 ? Math.round((t.correctAnswers / t.questionsSolved) * 100) : 0;
                return (
                  <div key={t.id} className="p-4 bg-muted/50 rounded-xl border border-border/50">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sub?.color || '#ccc' }} />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{sub?.name || 'Matéria'}</span>
                        </div>
                        <p className="font-semibold text-sm truncate">{t.title}</p>
                      </div>
                      <div className="flex items-center gap-4 text-center flex-shrink-0">
                        <div>
                          <div className="text-lg font-bold">{t.questionsSolved}</div>
                          <div className="text-[9px] font-bold uppercase text-muted-foreground">Questões</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-green-500">{t.correctAnswers}</div>
                          <div className="text-[9px] font-bold uppercase text-muted-foreground">Acertos</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-red-500">{erros}</div>
                          <div className="text-[9px] font-bold uppercase text-muted-foreground">Erros</div>
                        </div>
                        <div>
                          <div className={`text-lg font-bold ${aproveitamento >= 70 ? 'text-green-500' : aproveitamento >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>{aproveitamento}%</div>
                          <div className="text-[9px] font-bold uppercase text-muted-foreground">Aprov.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </motion.div>
  );
};

const CycleManager = () => {
  const { profile } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [newName, setNewName] = useState('');
  const [newWeight, setNewWeight] = useState(1);
  const [newDifficulty, setNewDifficulty] = useState(1);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editWeight, setEditWeight] = useState(1);
  const [editDifficulty, setEditDifficulty] = useState(1);

  const startEdit = (subject: Subject) => {
    setEditingId(subject.id);
    setEditName(subject.name);
    setEditWeight(subject.weight);
    setEditDifficulty(subject.difficulty);
  };

  const saveEdit = async () => {
    if (!profile || !editingId) return;
    await updateDoc(doc(db, 'users', profile.uid, 'subjects', editingId), {
      name: editName,
      weight: editWeight,
      difficulty: editDifficulty
    });
    setEditingId(null);
  };

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'users', profile.uid, 'subjects'));
    return onSnapshot(q, (snapshot) => {
      const subs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Subject))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setSubjects(subs);
    });
  }, [profile]);

  const addSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newName) return;
    
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    const color = colors[subjects.length % colors.length];

    await addDoc(collection(db, 'users', profile.uid, 'subjects'), {
      name: newName,
      weight: newWeight,
      difficulty: newDifficulty,
      color,
      order: subjects.length
    });

    setNewName('');
    setNewWeight(1);
    setNewDifficulty(1);
  };

  const deleteSubject = async (id: string) => {
    if (!profile) return;
    await deleteDoc(doc(db, 'users', profile.uid, 'subjects', id));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Gestão do Ciclo</h1>
        <p className="text-muted-foreground">Configure suas matérias por peso e dificuldade (Método Meirelles).</p>
      </header>

      <form onSubmit={addSubject} className="bg-card border border-border p-6 rounded-2xl shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div className="space-y-2">
          <label className="text-sm font-medium">Nome da Matéria</label>
          <input 
            type="text" 
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ex: Direito Penal"
            className="w-full bg-muted border border-border rounded-xl px-4 py-2 focus:ring-2 ring-primary/20 outline-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Peso (1-5)</label>
          <input 
            type="number" 
            min="1" max="5"
            value={newWeight}
            onChange={(e) => setNewWeight(Number(e.target.value))}
            className="w-full bg-muted border border-border rounded-xl px-4 py-2 focus:ring-2 ring-primary/20 outline-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Dificuldade (1-5)</label>
          <input 
            type="number" 
            min="1" max="5"
            value={newDifficulty}
            onChange={(e) => setNewDifficulty(Number(e.target.value))}
            className="w-full bg-muted border border-border rounded-xl px-4 py-2 focus:ring-2 ring-primary/20 outline-none"
          />
        </div>
        <button type="submit" className="bg-primary text-primary-foreground font-bold py-2 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
          <Plus size={20} /> Adicionar
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...subjects].sort((a, b) => b.weight - a.weight).map((s, index) => (
          <motion.div 
            layout
            key={s.id} 
            className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4 relative group"
          >
            {editingId === s.id ? (
              <div className="space-y-3">
                <input 
                  type="text" value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-1 font-bold outline-none" 
                />
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <label className="text-xs font-bold text-muted-foreground">Peso (1-5)
                    <input type="number" min="1" max="5" value={editWeight} onChange={e => setEditWeight(Number(e.target.value))} className="w-full bg-muted border border-border rounded-lg px-2 py-1 outline-none mt-1" />
                  </label>
                  <label className="text-xs font-bold text-muted-foreground">Dificuldade (1-5)
                    <input type="number" min="1" max="5" value={editDifficulty} onChange={e => setEditDifficulty(Number(e.target.value))} className="w-full bg-muted border border-border rounded-lg px-2 py-1 outline-none mt-1" />
                  </label>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setEditingId(null)} className="flex-1 py-1.5 rounded-lg border border-border text-xs font-bold">Cancelar</button>
                  <button onClick={saveEdit} className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold">Salvar</button>
                </div>
              </div>
            ) : (
              <>
                <div className="absolute top-4 right-12 text-primary font-black text-xl opacity-20">
                  #{index + 1}
                </div>
                <div className="flex items-center gap-3 pr-8">
                  <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                  <h3 className="text-lg font-bold leading-tight">{s.name}</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm relative z-10">
                  <div className="bg-muted p-2 rounded-lg text-center">
                    <div className="text-muted-foreground text-xs uppercase font-bold">Peso</div>
                    <div className="text-lg font-bold">{s.weight}</div>
                  </div>
                  <div className="bg-muted p-2 rounded-lg text-center">
                    <div className="text-muted-foreground text-xs uppercase font-bold">Dificuldade</div>
                    <div className="text-lg font-bold">{s.difficulty}</div>
                  </div>
                </div>
                <div className="absolute top-2 right-2 flex items-center gap-2 z-20 bg-background/80 backdrop-blur p-1.5 rounded-xl border border-border shadow-sm">
                  <button onClick={() => startEdit(s)} className="text-muted-foreground hover:text-primary transition-colors p-1">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => deleteSubject(s.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                    <Trash2 size={18} />
                  </button>
                </div>
              </>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

const StudyTimer = () => {
  const { profile } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [isActive, setIsActive] = useState(false);
  const [time, setTime] = useState(0);
  const [questions, setQuestions] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [aiTip, setAiTip] = useState('');
  const [isLoadingTip, setIsLoadingLoadingTip] = useState(false);
  const [timeInputMode, setTimeInputMode] = useState<'timer' | 'manual'>('timer');
  const [manualHours, setManualHours] = useState(0);
  const [manualMinutes, setManualMinutes] = useState(0);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'users', profile.uid, 'subjects'), orderBy('order'));
    return onSnapshot(q, (snapshot) => {
      const subs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
      setSubjects(subs);
      if (subs.length > 0 && !selectedSubject) setSelectedSubject(subs[0].id);
    });
  }, [profile]);

  useEffect(() => {
    if (!profile || !selectedSubject) return;
    const q = query(collection(db, 'users', profile.uid, 'subjects', selectedSubject, 'topics'));
    return onSnapshot(q, (snapshot) => {
      const ts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Topic));
      setTopics(ts);
      if (ts.length > 0 && !selectedTopic) setSelectedTopic(ts[0].id);
    });
  }, [profile, selectedSubject]);

  useEffect(() => {
    let interval: any;
    if (isActive) {
      interval = setInterval(() => {
        setTime((t) => t + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const saveTimeSession = async () => {
    if (!profile || !selectedSubject) return;
    const netMinutes = Math.floor(time / 60);
    if (netMinutes <= 0) return;

    const xpEarned = netMinutes * 10;

    await addDoc(collection(db, 'users', profile.uid, 'sessions'), {
      userId: profile.uid,
      subjectId: selectedSubject || null,
      topicId: selectedTopic || null,
      startTime: new Date().toISOString(),
      netTimeMinutes: netMinutes,
      questionsCount: 0,
      correctCount: 0,
      xpEarned,
      type: 'timer'
    });

    await updateDoc(doc(db, 'users', profile.uid), {
      xp: increment(xpEarned),
      totalStudyTime: increment(netMinutes)
    });

    if (profile.xp + xpEarned >= profile.level * 1000) {
      await updateDoc(doc(db, 'users', profile.uid), { level: increment(1) });
    }

    setIsActive(false);
    setTime(0);
    alert('Sessão de tempo salva!');
  };

  const saveManualSession = async () => {
    if (!profile || !selectedSubject) return;
    const netMinutes = (manualHours * 60) + manualMinutes;
    if (netMinutes <= 0) return;

    const xpEarned = netMinutes * 10;

    await addDoc(collection(db, 'users', profile.uid, 'sessions'), {
      userId: profile.uid,
      subjectId: selectedSubject || null,
      topicId: selectedTopic || null,
      startTime: new Date().toISOString(),
      netTimeMinutes: netMinutes,
      questionsCount: 0,
      correctCount: 0,
      xpEarned,
      type: 'manual'
    });

    await updateDoc(doc(db, 'users', profile.uid), {
      xp: increment(xpEarned),
      totalStudyTime: increment(netMinutes)
    });

    if (profile.xp + xpEarned >= profile.level * 1000) {
      await updateDoc(doc(db, 'users', profile.uid), { level: increment(1) });
    }

    setManualHours(0);
    setManualMinutes(0);
    alert('Sessão manual salva!');
  };

  const saveQuestionsSession = async () => {
    if (!profile || !selectedSubject || questions <= 0) return;
    
    const xpEarned = correct * 5;

    await addDoc(collection(db, 'users', profile.uid, 'sessions'), {
      userId: profile.uid,
      subjectId: selectedSubject || null,
      topicId: selectedTopic || null,
      startTime: new Date().toISOString(),
      netTimeMinutes: 0,
      questionsCount: questions,
      correctCount: correct,
      xpEarned,
      type: 'questions'
    });

    if (selectedTopic) {
      const topicRef = doc(db, 'users', profile.uid, 'subjects', selectedSubject, 'topics', selectedTopic);
      await updateDoc(topicRef, {
        questionsSolved: increment(questions),
        correctAnswers: increment(correct),
        lastStudied: new Date().toISOString()
      });
    }

    await updateDoc(doc(db, 'users', profile.uid), {
      xp: increment(xpEarned)
    });

    if (profile.xp + xpEarned >= profile.level * 1000) {
      await updateDoc(doc(db, 'users', profile.uid), { level: increment(1) });
    }

    setQuestions(0);
    setCorrect(0);
    alert('Registro de questões salvo!');
  };

  const getAiTip = async () => {
    if (!selectedSubject) return;
    setIsLoadingLoadingTip(true);
    try {
      const subject = subjects.find(s => s.id === selectedSubject)?.name;
      const topic = topics.find(t => t.id === selectedTopic)?.title;
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Dê uma dica rápida e matadora de estudo para o assunto "${topic || 'Geral'}" da matéria "${subject}". Foco em concursos policiais. Seja breve (máximo 3 frases).`
      });
      setAiTip(response.text || '');
    } catch (error) {
      console.error(error);
      setAiTip('Erro ao buscar dica da IA.');
    } finally {
      setIsLoadingLoadingTip(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Sessão de Estudo</h1>
        <p className="text-muted-foreground">Foco total. Sem distrações. O tempo é seu maior ativo.</p>
      </header>

      <div className="bg-card border border-border p-6 rounded-3xl shadow-xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Matéria</label>
            <select 
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                setSelectedTopic('');
              }}
              disabled={isActive}
              className="w-full bg-muted border border-border rounded-xl px-4 py-3 font-bold appearance-none cursor-pointer focus:ring-2 ring-primary/20 outline-none disabled:opacity-50"
            >
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Assunto</label>
            <select 
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              disabled={isActive || topics.length === 0}
              className="w-full bg-muted border border-border rounded-xl px-4 py-3 font-bold appearance-none cursor-pointer focus:ring-2 ring-primary/20 outline-none disabled:opacity-50"
            >
              {topics.length === 0 ? (
                <option value="">Nenhum assunto cadastrado</option>
              ) : (
                <>
                  <option value="">Selecione um assunto</option>
                  {topics.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </>
              )}
            </select>
          </div>
        </div>

        <button 
          onClick={getAiTip}
          disabled={isLoadingTip || !selectedSubject}
          className="w-full py-2 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20 text-sm font-bold flex items-center justify-center gap-2 hover:bg-purple-500/20 transition-all"
        >
          <Brain size={16} /> {isLoadingTip ? 'Consultando IA...' : 'Dica de Estudo IA'}
        </button>

        {aiTip && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-4 bg-purple-500/5 border border-purple-500/10 rounded-xl text-sm italic text-purple-700"
          >
            "{aiTip}"
          </motion.div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Timer / Manual Section */}
        <div className="bg-card border border-border p-8 rounded-3xl shadow-xl space-y-8 flex flex-col items-center justify-center">
          {/* Seletor entre Cronômetro e Manual */}
          <div className="flex w-full bg-[#2a2a2a] rounded-2xl p-1 gap-1 border border-white/5">
            <button
              onClick={() => setTimeInputMode('timer')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                timeInputMode === 'timer'
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Clock size={18} /> Cronômetro
            </button>
            <button
              onClick={() => { setTimeInputMode('manual'); if (isActive) setIsActive(false); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                timeInputMode === 'manual'
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <PenLine size={18} /> Manual
            </button>
          </div>

          {timeInputMode === 'timer' ? (
            <>
              <div className="text-center space-y-3 py-4">
                <div className="text-6xl font-mono font-bold tracking-tighter tabular-nums text-white">
                  {formatTime(time)}
                </div>
                <div className="flex flex-col items-center">
                  <span className="w-12 h-1 bg-blue-600/30 rounded-full mb-2" />
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Tempo Decorrido</p>
                </div>
              </div>

              <div className="flex gap-4 w-full">
                {!isActive ? (
                  <button 
                    onClick={() => setIsActive(true)}
                    className="flex-1 bg-primary text-primary-foreground font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Timer size={24} /> Iniciar
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={() => setIsActive(false)}
                      className="flex-1 bg-orange-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      Pausar
                    </button>
                    <button 
                      onClick={saveTimeSession}
                      className="flex-1 bg-green-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-green-600/20 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      Salvar
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="text-center space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Adicionar Tempo Manual</p>
              </div>

              <div className="grid grid-cols-2 gap-6 w-full">
                <div className="space-y-2 text-center">
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">Horas</label>
                  <input 
                    type="number" 
                    min="0"
                    max="24"
                    value={manualHours}
                    onChange={(e) => setManualHours(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-2xl px-4 py-6 text-center text-4xl font-mono font-bold text-white outline-none focus:border-blue-500/50 transition-colors"
                  />
                </div>
                <div className="space-y-2 text-center">
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">Minutos</label>
                  <input 
                    type="number" 
                    min="0"
                    max="59"
                    value={manualMinutes}
                    onChange={(e) => setManualMinutes(Math.min(59, Math.max(0, Number(e.target.value))))}
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-2xl px-4 py-6 text-center text-4xl font-mono font-bold text-white outline-none focus:border-blue-500/50 transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-col items-center gap-2">
                <p className="text-sm font-medium text-zinc-400">
                  Tempo Resultante: <span className="font-bold text-blue-500">{manualHours}h {manualMinutes}min</span>
                </p>
                <span className="w-8 h-1 bg-zinc-800 rounded-full" />
              </div>

              <button 
                onClick={saveManualSession}
                disabled={(manualHours * 60 + manualMinutes) <= 0}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-5 rounded-2xl shadow-lg shadow-green-900/20 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-30 disabled:grayscale flex items-center justify-center gap-3 text-lg"
              >
                <CheckCircle2 size={22} /> Salvar Sessão Manual
              </button>
            </>
          )}
        </div>

        {/* Questions Section */}
        <div className="bg-card border border-border p-8 rounded-3xl shadow-xl space-y-8">
          <div className="text-center">
            <h3 className="text-lg font-bold uppercase tracking-widest text-muted-foreground">Registro de Questões</h3>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground block text-center">Resolvidas</label>
              <input 
                type="number" 
                value={questions}
                onChange={(e) => setQuestions(Number(e.target.value))}
                className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-center text-xl font-bold outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground block text-center">Acertos</label>
              <input 
                type="number" 
                value={correct}
                onChange={(e) => setCorrect(Number(e.target.value))}
                className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-center text-xl font-bold outline-none"
              />
            </div>
          </div>

          <button 
            onClick={saveQuestionsSession}
            disabled={questions <= 0}
            className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-green-600/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
          >
            Salvar Questões
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const TAFTracker = () => {
  const { profile } = useAuth();
  const [tafSessions, setTafSessions] = useState<TAFSession[]>([]);
  const [type, setType] = useState<ExerciseType>('corrida');
  const [performance, setPerformance] = useState(0);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'users', profile.uid, 'taf'), orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setTafSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TAFSession)));
    });
  }, [profile]);

  const addTAF = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || performance <= 0) return;

    const unit = type === 'corrida' ? 'km' : 'reps';

    await addDoc(collection(db, 'users', profile.uid, 'taf'), {
      userId: profile.uid,
      date: new Date().toISOString(),
      exerciseType: type,
      performance,
      unit
    });

    setPerformance(0);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="space-y-8"
    >
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Treinamento Físico (TAF)</h1>
        <p className="text-muted-foreground">O policial precisa de mente e corpo afiados. Não negligencie o TAF.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <form onSubmit={addTAF} className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4 h-fit">
          <h3 className="font-bold text-lg">Registrar Treino</h3>
          <div className="space-y-2">
            <label className="text-sm font-medium">Exercício</label>
            <select 
              value={type}
              onChange={(e) => setType(e.target.value as ExerciseType)}
              className="w-full bg-muted border border-border rounded-xl px-4 py-2 outline-none"
            >
              <option value="corrida">Corrida</option>
              <option value="barra">Barra Fixa</option>
              <option value="flexao">Flexão</option>
              <option value="abdominal">Abdominal</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Performance ({type === 'corrida' ? 'km' : 'reps'})</label>
            <input 
              type="number" 
              step="0.01"
              value={performance}
              onChange={(e) => setPerformance(Number(e.target.value))}
              className="w-full bg-muted border border-border rounded-xl px-4 py-2 outline-none"
            />
          </div>
          <button type="submit" className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl hover:opacity-90 transition-opacity">
            Salvar Treino
          </button>
        </form>

        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-bold text-lg">Histórico Recente</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tafSessions.map((s) => (
              <div key={s.id} className="bg-card border border-border p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    <Dumbbell size={20} />
                  </div>
                  <div>
                    <div className="font-bold capitalize">{s.exerciseType}</div>
                    <div className="text-xs text-muted-foreground">{format(parseISO(s.date), 'dd/MM/yyyy HH:mm')}</div>
                  </div>
                </div>
                <div className="text-xl font-black">
                  {s.performance} <span className="text-xs font-normal text-muted-foreground">{s.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const SettingsPage = () => {
  const { profile } = useAuth();
  const [isResetting, setIsResetting] = useState<string | null>(null);

  const resetSessions = async () => {
    if (!profile) return;
    if (!window.confirm('Tem certeza que deseja zerar TODAS as sessões de estudo? Isso afetará Meta Diária, Questões e Aproveitamento.')) return;
    setIsResetting('sessions');
    try {
      const sessionsSnap = await getDocs(query(collection(db, 'users', profile.uid, 'sessions')));
      for (const sessionDoc of sessionsSnap.docs) {
        await deleteDoc(doc(db, 'users', profile.uid, 'sessions', sessionDoc.id));
      }
      // Reset totalStudyTime on user profile
      await updateDoc(doc(db, 'users', profile.uid), {
        totalStudyTime: 0
      });
      alert('Sessões de estudo zeradas com sucesso!');
    } catch (error) {
      console.error(error);
      alert('Erro ao zerar sessões.');
    } finally {
      setIsResetting(null);
    }
  };

  const resetTAF = async () => {
    if (!profile) return;
    if (!window.confirm('Tem certeza que deseja zerar TODOS os registros do TAF?')) return;
    setIsResetting('taf');
    try {
      const tafSnap = await getDocs(query(collection(db, 'users', profile.uid, 'taf')));
      for (const tafDoc of tafSnap.docs) {
        await deleteDoc(doc(db, 'users', profile.uid, 'taf', tafDoc.id));
      }
      alert('Registros de TAF zerados com sucesso!');
    } catch (error) {
      console.error(error);
      alert('Erro ao zerar TAF.');
    } finally {
      setIsResetting(null);
    }
  };

  const resetXP = async () => {
    if (!profile) return;
    if (!window.confirm('Tem certeza que deseja zerar XP e Nível?')) return;
    setIsResetting('xp');
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        xp: 0,
        level: 1
      });
      alert('XP e Nível zerados com sucesso!');
    } catch (error) {
      console.error(error);
      alert('Erro ao zerar XP.');
    } finally {
      setIsResetting(null);
    }
  };

  const resetEditalProgress = async () => {
    if (!profile) return;
    if (!window.confirm('Tem certeza que deseja zerar o PROGRESSO de todos os tópicos do edital? (As matérias e tópicos serão mantidos, mas Resumo/Questões/Flashcards serão desmarcados)')) return;
    setIsResetting('edital');
    try {
      const subjectsSnap = await getDocs(query(collection(db, 'users', profile.uid, 'subjects')));
      for (const subjectDoc of subjectsSnap.docs) {
        const topicsSnap = await getDocs(query(collection(db, 'users', profile.uid, 'subjects', subjectDoc.id, 'topics')));
        for (const topicDoc of topicsSnap.docs) {
          await updateDoc(doc(db, 'users', profile.uid, 'subjects', subjectDoc.id, 'topics', topicDoc.id), {
            theoryProgress: 0,
            questionsSolved: 0,
            correctAnswers: 0,
            studiedResumo: false,
            studiedQuestoes: false,
            studiedFlashcards: false
          });
        }
      }
      alert('Progresso do edital zerado com sucesso!');
    } catch (error) {
      console.error(error);
      alert('Erro ao zerar progresso.');
    } finally {
      setIsResetting(null);
    }
  };

  const resetAll = async () => {
    if (!profile) return;
    if (!window.confirm('⚠️ ATENÇÃO: Isso vai APAGAR TUDO — sessões, TAF, edital, XP. Deseja continuar?')) return;
    if (!window.confirm('ÚLTIMA CONFIRMAÇÃO: Realmente deseja apagar TODOS os dados? Essa ação é irreversível!')) return;
    setIsResetting('all');
    try {
      // Delete sessions
      const sessionsSnap = await getDocs(query(collection(db, 'users', profile.uid, 'sessions')));
      for (const sessionDoc of sessionsSnap.docs) {
        await deleteDoc(doc(db, 'users', profile.uid, 'sessions', sessionDoc.id));
      }
      // Delete TAF
      const tafSnap = await getDocs(query(collection(db, 'users', profile.uid, 'taf')));
      for (const tafDoc of tafSnap.docs) {
        await deleteDoc(doc(db, 'users', profile.uid, 'taf', tafDoc.id));
      }
      // Delete edital (subjects + topics)
      const subjectsSnap = await getDocs(query(collection(db, 'users', profile.uid, 'subjects')));
      for (const subjectDoc of subjectsSnap.docs) {
        const topicsSnap = await getDocs(query(collection(db, 'users', profile.uid, 'subjects', subjectDoc.id, 'topics')));
        for (const topicDoc of topicsSnap.docs) {
          await deleteDoc(doc(db, 'users', profile.uid, 'subjects', subjectDoc.id, 'topics', topicDoc.id));
        }
        await deleteDoc(doc(db, 'users', profile.uid, 'subjects', subjectDoc.id));
      }
      // Reset user profile
      await updateDoc(doc(db, 'users', profile.uid), {
        xp: 0,
        level: 1,
        totalStudyTime: 0
      });
      alert('Todos os dados foram zerados com sucesso!');
    } catch (error) {
      console.error(error);
      alert('Erro ao zerar dados.');
    } finally {
      setIsResetting(null);
    }
  };

  const resetOptions = [
    {
      id: 'sessions',
      title: 'Zerar Sessões de Estudo',
      description: 'Remove todas as sessões registradas. Isso zera: Meta Diária, Questões resolvidas e Aproveitamento.',
      icon: Timer,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
      action: resetSessions
    },
    {
      id: 'edital',
      title: 'Zerar Progresso do Edital',
      description: 'Desmarca todos os Resumos, Questões e Flashcards dos tópicos. Mantém as matérias e tópicos.',
      icon: Brain,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20',
      action: resetEditalProgress
    },
    {
      id: 'taf',
      title: 'Zerar Registros de TAF',
      description: 'Remove todo o histórico de treinos físicos registrados.',
      icon: Dumbbell,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20',
      action: resetTAF
    },
    {
      id: 'xp',
      title: 'Zerar XP e Nível',
      description: 'Reseta XP para 0 e nível para 1.',
      icon: Trophy,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/20',
      action: resetXP
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie seus dados e resete registros quando necessário.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {resetOptions.map(opt => (
          <motion.div
            key={opt.id}
            whileHover={{ scale: 1.01 }}
            className={`bg-card border ${opt.borderColor} p-6 rounded-2xl shadow-sm space-y-4`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-3 ${opt.bgColor} ${opt.color} rounded-xl`}>
                <opt.icon size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg">{opt.title}</h3>
                <p className="text-xs text-muted-foreground">{opt.description}</p>
              </div>
            </div>
            <button
              onClick={opt.action}
              disabled={isResetting !== null}
              className={`w-full py-3 rounded-xl font-bold text-sm border ${opt.borderColor} ${opt.color} ${opt.bgColor} hover:opacity-80 transition-all disabled:opacity-40`}
            >
              {isResetting === opt.id ? 'Zerando...' : 'Zerar'}
            </button>
          </motion.div>
        ))}
      </div>

      <div className="pt-4 border-t border-border">
        <motion.div
          whileHover={{ scale: 1.005 }}
          className="bg-card border border-red-500/30 p-6 rounded-2xl shadow-sm space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-500/10 text-red-500 rounded-xl">
              <AlertCircle size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-red-500">Zerar TUDO</h3>
              <p className="text-xs text-muted-foreground">Remove TODOS os dados: sessões, edital completo (matérias e tópicos), TAF, XP e nível. Ação irreversível.</p>
            </div>
          </div>
          <button
            onClick={resetAll}
            disabled={isResetting !== null}
            className="w-full py-3 rounded-xl font-bold text-sm border border-red-500/30 text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-all disabled:opacity-40"
          >
            {isResetting === 'all' ? 'Zerando tudo...' : '⚠️ Zerar Todos os Dados'}
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
};

// --- Aba Rotina ---

const ROUTINE_CATEGORIES = [
  { value: 'estudo', label: 'Estudo', color: '#3b82f6', emoji: '📘' },
  { value: 'treino', label: 'Treino', color: '#f97316', emoji: '🏋️' },
  { value: 'descanso', label: 'Descanso', color: '#22c55e', emoji: '😴' },
  { value: 'alimentacao', label: 'Alimentação', color: '#eab308', emoji: '🍽️' },
  { value: 'lazer', label: 'Lazer', color: '#a855f7', emoji: '🎮' },
  { value: 'outro', label: 'Outro', color: '#6b7280', emoji: '📌' },
];

interface RoutineEvent {
  id: string;
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  category: string;
  title: string;
  description?: string;
  color: string;
}

interface TemplateBlock {
  id: string;
  title: string;
  category: string;
  startTime: string;
  endTime: string;
}

const RoutinePlanner = () => {
  const { profile } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<RoutineEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<RoutineEvent | null>(null);

  // Form
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('estudo');
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('10:00');
  const [formDescription, setFormDescription] = useState('');

  // Rotina mensal em massa
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [templateBlocks, setTemplateBlocks] = useState<TemplateBlock[]>([
    { id: '1', title: 'Estudo', category: 'estudo', startTime: '08:00', endTime: '12:00' },
    { id: '2', title: 'Treino', category: 'treino', startTime: '14:00', endTime: '15:00' },
    { id: '3', title: 'Estudo', category: 'estudo', startTime: '15:30', endTime: '18:00' },
  ]);

  const addTemplateBlock = () => {
    setTemplateBlocks(prev => [...prev, {
      id: Date.now().toString(),
      title: '',
      category: 'estudo',
      startTime: '08:00',
      endTime: '10:00',
    }]);
  };

  const removeTemplateBlock = (id: string) => {
    setTemplateBlocks(prev => prev.filter(b => b.id !== id));
  };

  const updateTemplateBlock = (id: string, field: keyof TemplateBlock, value: string) => {
    setTemplateBlocks(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const applyBulkRoutine = async () => {
    if (!profile || templateBlocks.length === 0) return;
    const validBlocks = templateBlocks.filter(b => b.title.trim());
    if (validBlocks.length === 0) { alert('Adicione pelo menos um bloco com t\u00EDtulo.'); return; }

    setIsBulkSaving(true);
    try {
      const mStart = startOfMonth(currentMonth);
      const mEnd = endOfMonth(currentMonth);
      const days = eachDayOfInterval({ start: mStart, end: mEnd });

      for (const day of days) {
        const dateStr = format(day, 'yyyy-MM-dd');
        for (const block of validBlocks) {
          const cat = ROUTINE_CATEGORIES.find(c => c.value === block.category);
          await addDoc(collection(db, 'users', profile.uid, 'routine_events'), {
            userId: profile.uid,
            date: dateStr,
            startTime: block.startTime,
            endTime: block.endTime,
            category: block.category,
            title: block.title,
            description: '',
            color: cat?.color || '#6b7280',
          });
        }
      }
      setShowBulkModal(false);
      alert(`Rotina aplicada com sucesso a ${days.length} dias do m\u00EAs!`);
    } catch (error) {
      console.error(error);
      alert('Erro ao aplicar rotina mensal.');
    } finally {
      setIsBulkSaving(false);
    }
  };

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'users', profile.uid, 'routine_events'));
    return onSnapshot(q, (snapshot: any) => {
      setEvents(snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as RoutineEvent)));
    });
  }, [profile]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart); // 0=Sun

  const openAddModal = (date: Date) => {
    setSelectedDate(date);
    setEditingEvent(null);
    setFormTitle('');
    setFormCategory('estudo');
    setFormStartTime('08:00');
    setFormEndTime('10:00');
    setFormDescription('');
    setShowModal(true);
  };

  const openEditModal = (event: RoutineEvent) => {
    setEditingEvent(event);
    setSelectedDate(new Date(event.date + 'T12:00:00'));
    setFormTitle(event.title);
    setFormCategory(event.category);
    setFormStartTime(event.startTime);
    setFormEndTime(event.endTime);
    setFormDescription(event.description || '');
    setShowModal(true);
  };

  const saveEvent = async () => {
    if (!profile || !selectedDate || !formTitle) return;
    const cat = ROUTINE_CATEGORIES.find(c => c.value === formCategory);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    if (editingEvent) {
      await updateDoc(doc(db, 'users', profile.uid, 'routine_events', editingEvent.id), {
        title: formTitle,
        category: formCategory,
        startTime: formStartTime,
        endTime: formEndTime,
        description: formDescription,
        color: cat?.color || '#6b7280',
        date: dateStr,
      });
    } else {
      await addDoc(collection(db, 'users', profile.uid, 'routine_events'), {
        userId: profile.uid,
        date: dateStr,
        startTime: formStartTime,
        endTime: formEndTime,
        category: formCategory,
        title: formTitle,
        description: formDescription,
        color: cat?.color || '#6b7280',
      });
    }
    setShowModal(false);
  };

  const deleteEvent = async (eventId: string) => {
    if (!profile) return;
    if (!window.confirm('Excluir este evento?')) return;
    await deleteDoc(doc(db, 'users', profile.uid, 'routine_events', eventId));
  };

  const eventsForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return events
      .filter(e => e.date === dateStr)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const selectedDayEvents = selectedDate ? eventsForDay(selectedDate) : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rotina de Estudos</h1>
          <p className="text-muted-foreground">Organize seu dia, semana e mês até a prova. Disciplina é liberdade.</p>
        </div>
        <button
          onClick={() => setShowBulkModal(true)}
          className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 self-start"
        >
          <Calendar size={20} /> Definir Rotina do Mês
        </button>
      </header>

      {/* Navegação do Mês */}
      <div className="flex items-center justify-between bg-card border border-border rounded-2xl p-4 shadow-sm">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-xl hover:bg-muted transition-colors">
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-xl font-bold capitalize">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-xl hover:bg-muted transition-colors">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Calendário */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-4 shadow-sm">
          {/* Header dias da semana */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map(d => (
              <div key={d} className="text-center text-xs font-bold text-muted-foreground uppercase tracking-widest py-2">{d}</div>
            ))}
          </div>
          {/* Grid de dias */}
          <div className="grid grid-cols-7 gap-1">
            {/* Espaços vazios antes do primeiro dia */}
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            {daysInMonth.map(day => {
              const dayEvents = eventsForDay(day);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const today = isToday(day);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "aspect-square rounded-xl p-1 flex flex-col items-center transition-all relative overflow-hidden border",
                    isSelected
                      ? "bg-primary/10 border-primary/40 ring-2 ring-primary/20"
                      : "border-transparent hover:bg-muted/60",
                    today && !isSelected && "bg-primary/5 border-primary/10"
                  )}
                >
                  <span className={cn(
                    "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full",
                    today && "bg-primary text-primary-foreground",
                    isSelected && !today && "text-primary"
                  )}>
                    {format(day, 'd')}
                  </span>
                  {/* Mini barras de eventos */}
                  <div className="flex flex-wrap gap-[2px] mt-auto justify-center">
                    {dayEvents.slice(0, 4).map(ev => (
                      <div
                        key={ev.id}
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: ev.color }}
                      />
                    ))}
                    {dayEvents.length > 4 && (
                      <span className="text-[8px] text-muted-foreground">+{dayEvents.length - 4}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Painel lateral: eventos do dia selecionado */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">
                {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'Selecione um dia'}
              </h3>
              {selectedDate && (
                <button
                  onClick={() => openAddModal(selectedDate)}
                  className="bg-primary text-primary-foreground p-2 rounded-xl hover:opacity-90 transition-opacity"
                >
                  <Plus size={18} />
                </button>
              )}
            </div>

            {selectedDate && selectedDayEvents.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar size={32} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">Nenhum evento neste dia.</p>
                <button
                  onClick={() => openAddModal(selectedDate)}
                  className="text-primary text-sm font-bold mt-2 hover:underline"
                >
                  + Adicionar bloco
                </button>
              </div>
            )}

            {selectedDayEvents.map(ev => {
              const cat = ROUTINE_CATEGORIES.find(c => c.value === ev.category);
              return (
                <motion.div
                  key={ev.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-3 rounded-xl border border-border/50 bg-muted/30 space-y-1 group relative"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-full min-h-[28px] rounded-full flex-shrink-0" style={{ backgroundColor: ev.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs">{cat?.emoji}</span>
                        <span className="font-bold text-sm truncate">{ev.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {ev.startTime} — {ev.endTime}
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-muted text-[10px] font-bold uppercase">{cat?.label}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditModal(ev)} className="p-1 text-muted-foreground hover:text-primary transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => deleteEvent(ev.id)} className="p-1 text-muted-foreground hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {ev.description && (
                    <p className="text-xs text-muted-foreground pl-4">{ev.description}</p>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Legenda */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Categorias</h4>
            <div className="grid grid-cols-2 gap-2">
              {ROUTINE_CATEGORIES.map(cat => (
                <div key={cat.value} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <span>{cat.emoji} {cat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Criar/Editar Evento */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-card border border-border p-8 rounded-3xl shadow-2xl max-w-md w-full space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">{editingEvent ? 'Editar Evento' : 'Novo Evento'}</h3>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-muted transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Título</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    placeholder="Ex: Direito Penal - Questões"
                    className="w-full bg-muted border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Categoria</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    className="w-full bg-muted border border-border rounded-xl px-4 py-3 outline-none"
                  >
                    {ROUTINE_CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.emoji} {cat.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Início</label>
                    <input
                      type="time"
                      value={formStartTime}
                      onChange={e => setFormStartTime(e.target.value)}
                      className="w-full bg-muted border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Término</label>
                    <input
                      type="time"
                      value={formEndTime}
                      onChange={e => setFormEndTime(e.target.value)}
                      className="w-full bg-muted border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Descrição (opcional)</label>
                  <textarea
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    placeholder="Notas adicionais..."
                    className="w-full h-20 bg-muted border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl border border-border font-bold hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={saveEvent} disabled={!formTitle} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
                  {editingEvent ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Rotina Mensal em Massa */}
      <AnimatePresence>
        {showBulkModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-card border border-border p-8 rounded-3xl shadow-2xl max-w-2xl w-full space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">Definir Rotina do Mês</h3>
                  <p className="text-sm text-muted-foreground">Monte seu template diário e aplique a todos os dias de <strong>{format(currentMonth, 'MMMM yyyy')}</strong></p>
                </div>
                <button onClick={() => setShowBulkModal(false)} className="p-2 rounded-xl hover:bg-muted transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
                <p className="text-xs text-primary font-bold uppercase tracking-widest mb-1">ℹ️ Como funciona</p>
                <p className="text-sm text-muted-foreground">Defina os blocos de horário abaixo. Ao clicar em "Aplicar", esses blocos serão criados como eventos em <strong>cada dia</strong> do mês selecionado ({format(currentMonth, 'MMMM yyyy')}).</p>
              </div>

              {/* Template Blocks */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Blocos de Horário</h4>
                  <button
                    onClick={addTemplateBlock}
                    className="text-primary text-sm font-bold flex items-center gap-1 hover:underline"
                  >
                    <Plus size={16} /> Adicionar Bloco
                  </button>
                </div>

                {templateBlocks.map((block, index) => {
                  const cat = ROUTINE_CATEGORIES.find(c => c.value === block.category);
                  return (
                    <motion.div
                      key={block.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-muted/50 border border-border/50 rounded-xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat?.color || '#6b7280' }} />
                          <span className="text-xs font-bold text-muted-foreground uppercase">Bloco {index + 1}</span>
                        </div>
                        <button
                          onClick={() => removeTemplateBlock(block.id)}
                          className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase">Título</label>
                          <input
                            type="text"
                            value={block.title}
                            onChange={e => updateTemplateBlock(block.id, 'title', e.target.value)}
                            placeholder="Ex: Estudo"
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase">Categoria</label>
                          <select
                            value={block.category}
                            onChange={e => updateTemplateBlock(block.id, 'category', e.target.value)}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none"
                          >
                            {ROUTINE_CATEGORIES.map(c => (
                              <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase">Início</label>
                          <input
                            type="time"
                            value={block.startTime}
                            onChange={e => updateTemplateBlock(block.id, 'startTime', e.target.value)}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase">Término</label>
                          <input
                            type="time"
                            value={block.endTime}
                            onChange={e => updateTemplateBlock(block.id, 'endTime', e.target.value)}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/20"
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {templateBlocks.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">Nenhum bloco definido. Clique em "Adicionar Bloco" para começar.</p>
                  </div>
                )}
              </div>

              {/* Preview */}
              {templateBlocks.filter(b => b.title.trim()).length > 0 && (
                <div className="bg-muted/30 border border-border/50 rounded-xl p-4">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Preview do Dia</p>
                  <div className="space-y-1">
                    {templateBlocks.filter(b => b.title.trim()).sort((a, b) => a.startTime.localeCompare(b.startTime)).map(block => {
                      const cat = ROUTINE_CATEGORIES.find(c => c.value === block.category);
                      return (
                        <div key={block.id} className="flex items-center gap-2 text-sm">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat?.color || '#6b7280' }} />
                          <span className="text-muted-foreground font-mono text-xs">{block.startTime}-{block.endTime}</span>
                          <span className="font-medium">{cat?.emoji} {block.title}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setShowBulkModal(false)} className="flex-1 py-3 rounded-xl border border-border font-bold hover:bg-muted transition-colors">Cancelar</button>
                <button
                  onClick={applyBulkRoutine}
                  disabled={isBulkSaving || templateBlocks.filter(b => b.title.trim()).length === 0}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isBulkSaving ? 'Aplicando...' : `Aplicar a ${eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }).length} dias`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// --- Aba Caderno de Erros ---

interface ErrorCard {
  id: string;
  userId: string;
  subjectName: string;
  topic: string;
  question: string;
  answer: string;
  difficulty: number;
  intervalDays: number;
  nextReview: string;
  totalReviews: number;
  correctReviews: number;
  createdAt: string;
}

interface ErrorCardReview {
  id: string;
  cardId: string;
  reviewedAt: string;
  result: string;
  previousInterval: number;
  newInterval: number;
}

const ErrorNotebook = () => {
  const { profile } = useAuth();
  const [cards, setCards] = useState<ErrorCard[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCard, setEditingCard] = useState<ErrorCard | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedCardHistory, setSelectedCardHistory] = useState<string | null>(null);
  const [reviewHistory, setReviewHistory] = useState<ErrorCardReview[]>([]);
  const [filterSubject, setFilterSubject] = useState('all');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkSubject, setBulkSubject] = useState('');
  const [bulkTopic, setBulkTopic] = useState('');
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [showReviewPickerModal, setShowReviewPickerModal] = useState(false);
  const [reviewSubjectFilter, setReviewSubjectFilter] = useState<string>('all');

  // Form
  const [formSubject, setFormSubject] = useState('');
  const [formTopic, setFormTopic] = useState('');
  const [formQuestion, setFormQuestion] = useState('');
  const [formAnswer, setFormAnswer] = useState('');

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'users', profile.uid, 'error_cards'));
    return onSnapshot(q, (snapshot: any) => {
      setCards(snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as ErrorCard)));
    });
  }, [profile]);

  // Carregar histórico quando um card é selecionado
  useEffect(() => {
    if (!profile || !selectedCardHistory) return;
    const q = query(collection(db, 'users', profile.uid, 'error_cards', selectedCardHistory, 'error_card_reviews'));
    return onSnapshot(q, (snapshot: any) => {
      const reviews = snapshot.docs
        .map((d: any) => ({ id: d.id, ...d.data() } as ErrorCardReview))
        .sort((a: ErrorCardReview, b: ErrorCardReview) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime());
      setReviewHistory(reviews);
    });
  }, [profile, selectedCardHistory]);

  const today = new Date().toISOString().split('T')[0];

  const allPendingCards = cards.filter(c => {
    if (!c.nextReview) return true;
    return c.nextReview <= today;
  });

  // Cards pendentes filtrados por disciplina selecionada para revisão
  const pendingCards = reviewSubjectFilter === 'all'
    ? allPendingCards
    : allPendingCards.filter(c => c.subjectName === reviewSubjectFilter);

  // Disciplinas que têm cards pendentes
  const pendingSubjects: string[] = Array.from(new Set<string>(allPendingCards.map(c => c.subjectName))).sort();
  const pendingCountBySubject: Record<string, number> = {};
  pendingSubjects.forEach(sub => {
    pendingCountBySubject[sub] = allPendingCards.filter(c => c.subjectName === sub).length;
  });

  const uniqueSubjects = [...new Set(cards.map(c => c.subjectName))].sort();

  const filteredCards = filterSubject === 'all' ? cards : cards.filter(c => c.subjectName === filterSubject);

  const groupedBySubject = filteredCards.reduce((acc, card) => {
    if (!acc[card.subjectName]) acc[card.subjectName] = [];
    acc[card.subjectName].push(card);
    return acc;
  }, {} as Record<string, ErrorCard[]>);

  const openCreateModal = () => {
    setEditingCard(null);
    setFormSubject('');
    setFormTopic('');
    setFormQuestion('');
    setFormAnswer('');
    setShowCreateModal(true);
  };

  const openEditModal = (card: ErrorCard) => {
    setEditingCard(card);
    setFormSubject(card.subjectName);
    setFormTopic(card.topic);
    setFormQuestion(card.question);
    setFormAnswer(card.answer);
    setShowCreateModal(true);
  };

  const saveCard = async () => {
    if (!profile || !formSubject || !formQuestion || !formAnswer) return;

    if (editingCard) {
      await updateDoc(doc(db, 'users', profile.uid, 'error_cards', editingCard.id), {
        subjectName: formSubject,
        topic: formTopic,
        question: formQuestion,
        answer: formAnswer,
      });
    } else {
      await addDoc(collection(db, 'users', profile.uid, 'error_cards'), {
        userId: profile.uid,
        subjectName: formSubject,
        topic: formTopic,
        question: formQuestion,
        answer: formAnswer,
        difficulty: 2,
        intervalDays: 1,
        nextReview: today,
        totalReviews: 0,
        correctReviews: 0,
      });
    }
    setShowCreateModal(false);
  };

  const saveBulkCards = async () => {
    if (!profile || !bulkText.trim() || !bulkSubject.trim()) return;
    setBulkImporting(true);
    try {
      const lines = bulkText.trim().split('\n').filter(l => l.trim());
      let created = 0;
      let errors: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Separar por ; (com ou sem espaços ao redor)
        const parts = line.split(';').map(p => p.trim());
        let question = '';
        let answer = '';
        if (parts.length >= 2) {
          question = parts[0];
          answer = parts[1];
        } else {
          errors.push(`Linha ${i + 1}: precisa ter pergunta e resposta separadas por ;`);
          continue;
        }
        if (!question || !answer) {
          errors.push(`Linha ${i + 1}: pergunta e resposta não podem estar vazias`);
          continue;
        }
        await addDoc(collection(db, 'users', profile.uid, 'error_cards'), {
          userId: profile.uid,
          subjectName: bulkSubject.trim(),
          topic: bulkTopic.trim(),
          question,
          answer,
          difficulty: 2,
          intervalDays: 1,
          nextReview: today,
          totalReviews: 0,
          correctReviews: 0,
        });
        created++;
      }
      if (errors.length > 0) {
        alert(`✅ ${created} cartões criados!\n\n⚠️ ${errors.length} linha(s) com erro:\n${errors.slice(0, 5).join('\n')}`);
      } else {
        alert(`✅ ${created} cartões criados com sucesso!`);
      }
      setBulkText('');
      setBulkSubject('');
      setBulkTopic('');
      setShowBulkModal(false);
    } catch (error: any) {
      console.error(error);
      alert('Erro ao importar cartões: ' + (error?.message || error));
    } finally {
      setBulkImporting(false);
    }
  };

  const toggleSubjectExpanded = (subjectName: string) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(subjectName)) next.delete(subjectName);
      else next.add(subjectName);
      return next;
    });
  };

  const deleteCard = async (cardId: string) => {
    if (!profile) return;
    if (!window.confirm('Excluir este cartão?')) return;
    // Deletar reviews primeiro
    const reviewsSnap = await getDocs(query(collection(db, 'users', profile.uid, 'error_cards', cardId, 'error_card_reviews')));
    for (const reviewDoc of reviewsSnap.docs) {
      await deleteDoc(doc(db, 'users', profile.uid, 'error_cards', cardId, 'error_card_reviews', reviewDoc.id));
    }
    await deleteDoc(doc(db, 'users', profile.uid, 'error_cards', cardId));
  };

  const openReviewPicker = () => {
    if (allPendingCards.length === 0) return;
    setShowReviewPickerModal(true);
  };

  const startReviewWithSubject = (subject: string) => {
    setReviewSubjectFilter(subject);
    setShowReviewPickerModal(false);
    // Precisamos calcular os cards filtrados aqui para verificar se há cards
    const filtered = subject === 'all'
      ? allPendingCards
      : allPendingCards.filter(c => c.subjectName === subject);
    if (filtered.length === 0) return;
    setReviewMode(true);
    setCurrentReviewIndex(0);
    setShowAnswer(false);
  };

  const submitReview = async (result: 'forgot' | 'hard' | 'good' | 'easy') => {
    if (!profile) return;
    const card = pendingCards[currentReviewIndex];
    if (!card) return;

    const prevInterval = card.intervalDays || 1;
    let newInterval = 1;

    switch (result) {
      case 'forgot': newInterval = 1; break;
      case 'hard': newInterval = Math.max(1, Math.round(prevInterval * 1.2)); break;
      case 'good': newInterval = Math.round(prevInterval * 2); break;
      case 'easy': newInterval = Math.round(prevInterval * 3); break;
    }

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + newInterval);
    const nextReviewStr = nextDate.toISOString().split('T')[0];

    const isCorrect = result === 'good' || result === 'easy';

    // Atualizar o card
    await updateDoc(doc(db, 'users', profile.uid, 'error_cards', card.id), {
      intervalDays: newInterval,
      nextReview: nextReviewStr,
      difficulty: result === 'forgot' ? 3 : result === 'hard' ? 2 : 1,
      totalReviews: increment(1),
      correctReviews: isCorrect ? increment(1) : increment(0),
    });

    // Salvar no histórico
    await addDoc(collection(db, 'users', profile.uid, 'error_cards', card.id, 'error_card_reviews'), {
      userId: profile.uid,
      cardId: card.id,
      reviewedAt: new Date().toISOString(),
      result,
      previousInterval: prevInterval,
      newInterval,
    });

    // Avançar para próximo card
    if (currentReviewIndex < pendingCards.length - 1) {
      setCurrentReviewIndex(currentReviewIndex + 1);
      setShowAnswer(false);
    } else {
      setReviewMode(false);
      alert('🎉 Revisão concluída! Todos os cartões pendentes foram revisados.');
    }
  };

  // Modo Revisão
  if (reviewMode && pendingCards.length > 0) {
    const card = pendingCards[currentReviewIndex];
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="space-y-8"
      >
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Modo Revisão</h1>
            <p className="text-muted-foreground">
              Cartão {currentReviewIndex + 1} de {pendingCards.length}
              {reviewSubjectFilter !== 'all' && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">{reviewSubjectFilter}</span>
              )}
            </p>
          </div>
          <button
            onClick={() => setReviewMode(false)}
            className="px-4 py-2 rounded-xl border border-border font-bold hover:bg-muted transition-colors flex items-center gap-2"
          >
            <X size={16} /> Sair
          </button>
        </header>

        {/* Barra de progresso */}
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${((currentReviewIndex + 1) / pendingCards.length) * 100}%` }}
            className="h-full bg-primary"
          />
        </div>

        {/* Card */}
        <div className="max-w-2xl mx-auto">
          <motion.div
            key={card.id + '-' + currentReviewIndex}
            initial={{ opacity: 0, rotateY: -10 }}
            animate={{ opacity: 1, rotateY: 0 }}
            className="bg-card border border-border rounded-3xl shadow-xl overflow-hidden"
          >
            {/* Badge */}
            <div className="px-6 pt-5 flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">{card.subjectName}</span>
              {card.topic && <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-bold">{card.topic}</span>}
            </div>

            {/* Pergunta */}
            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Pergunta</p>
                <p className="text-xl font-semibold leading-relaxed">{card.question}</p>
              </div>

              {/* Resposta */}
              {!showAnswer ? (
                <button
                  onClick={() => setShowAnswer(true)}
                  className="w-full py-4 rounded-2xl border-2 border-dashed border-primary/30 text-primary font-bold hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
                >
                  <Eye size={20} /> Mostrar Resposta
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-5">
                    <p className="text-xs font-bold text-green-500 uppercase tracking-widest mb-2">Resposta</p>
                    <p className="text-lg leading-relaxed">{card.answer}</p>
                  </div>

                  <p className="text-xs text-muted-foreground text-center">Como foi o seu recall?</p>

                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => submitReview('forgot')}
                      className="py-3 rounded-xl bg-red-500/10 text-red-500 font-bold text-sm hover:bg-red-500/20 transition-all border border-red-500/20"
                    >
                      😵 Esqueci
                    </button>
                    <button
                      onClick={() => submitReview('hard')}
                      className="py-3 rounded-xl bg-orange-500/10 text-orange-500 font-bold text-sm hover:bg-orange-500/20 transition-all border border-orange-500/20"
                    >
                      😤 Difícil
                    </button>
                    <button
                      onClick={() => submitReview('good')}
                      className="py-3 rounded-xl bg-blue-500/10 text-blue-500 font-bold text-sm hover:bg-blue-500/20 transition-all border border-blue-500/20"
                    >
                      😊 Bom
                    </button>
                    <button
                      onClick={() => submitReview('easy')}
                      className="py-3 rounded-xl bg-green-500/10 text-green-500 font-bold text-sm hover:bg-green-500/20 transition-all border border-green-500/20"
                    >
                      🤩 Fácil
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Caderno de Erros</h1>
          <p className="text-muted-foreground">Transforme seus erros em acertos com repetição espaçada.</p>
        </div>
        <div className="flex items-center gap-3 self-start">
          <button
            onClick={() => setShowBulkModal(true)}
            className="border border-primary text-primary font-bold px-5 py-3 rounded-xl hover:bg-primary/10 transition-all flex items-center gap-2"
          >
            <Upload size={18} /> Importar em Massa
          </button>
          <button
            onClick={openCreateModal}
            className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <Plus size={20} /> Novo Cartão
          </button>
        </div>
      </header>

      {/* Banner de revisão pendente */}
      {allPendingCards.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-orange-500/10 via-red-500/10 to-pink-500/10 border border-orange-500/20 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-500/10 text-orange-500 rounded-xl">
              <RotateCcw size={28} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-orange-500 uppercase tracking-widest mb-1">Revisão Pendente</h2>
              <p className="text-2xl font-black">{allPendingCards.length} {allPendingCards.length === 1 ? 'cartão' : 'cartões'} para revisar hoje</p>
              <p className="text-xs text-muted-foreground mt-1">
                {pendingSubjects.length > 1
                  ? `Em ${pendingSubjects.length} disciplinas • Escolha qual revisar`
                  : 'A repetição espaçada é a técnica mais eficiente para retenção de longo prazo.'}
              </p>
            </div>
          </div>
          <button
            onClick={openReviewPicker}
            className="bg-primary text-primary-foreground font-bold px-8 py-4 rounded-2xl hover:opacity-90 transition-opacity text-lg shadow-lg shadow-primary/20 flex-shrink-0"
          >
            Iniciar Revisão
          </button>
        </motion.div>
      )}

      {/* Modal Seleção de Disciplina para Revisão */}
      <AnimatePresence>
        {showReviewPickerModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => setShowReviewPickerModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-card border border-border p-8 rounded-3xl shadow-2xl max-w-md w-full space-y-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">Escolha a Disciplina</h3>
                  <p className="text-sm text-muted-foreground">Selecione qual disciplina deseja revisar</p>
                </div>
                <button onClick={() => setShowReviewPickerModal(false)} className="p-2 rounded-xl hover:bg-muted transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2">
                {/* Opção: Todas as disciplinas */}
                <button
                  onClick={() => startReviewWithSubject('all')}
                  className="w-full text-left p-4 rounded-2xl border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 text-primary rounded-xl">
                        <ClipboardList size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-base">Todas as Disciplinas</p>
                        <p className="text-xs text-muted-foreground">Revisar todos os cartões pendentes</p>
                      </div>
                    </div>
                    <span className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-black">
                      {allPendingCards.length}
                    </span>
                  </div>
                </button>

                {/* Separador */}
                {pendingSubjects.length > 1 && (
                  <div className="flex items-center gap-3 py-2">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">ou escolha uma</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}

                {/* Opções por disciplina */}
                {pendingSubjects.map(sub => (
                  <button
                    key={sub}
                    onClick={() => startReviewWithSubject(sub)}
                    className="w-full text-left p-4 rounded-2xl border border-border/50 bg-muted/30 hover:bg-muted/60 hover:border-primary/30 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-xl group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          <BookOpen size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-base group-hover:text-primary transition-colors">{sub}</p>
                          <p className="text-xs text-muted-foreground">{pendingCountBySubject[sub]} {pendingCountBySubject[sub] === 1 ? 'cartão pendente' : 'cartões pendentes'}</p>
                        </div>
                      </div>
                      <span className="px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-500 text-sm font-black">
                        {pendingCountBySubject[sub]}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filtro por disciplina */}
      {uniqueSubjects.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Filtrar:</span>
          <button
            onClick={() => setFilterSubject('all')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
              filterSubject === 'all' ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground border-transparent"
            )}
          >
            Todos ({cards.length})
          </button>
          {uniqueSubjects.map(sub => (
            <button
              key={sub}
              onClick={() => setFilterSubject(sub)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                filterSubject === sub ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground border-transparent"
              )}
            >
              {sub} ({cards.filter(c => c.subjectName === sub).length})
            </button>
          ))}
        </div>
      )}

      {/* Cards agrupados */}
      {Object.keys(groupedBySubject).length === 0 ? (
        <div className="text-center py-16 bg-muted/30 rounded-2xl border border-dashed border-border">
          <ClipboardList size={56} className="mx-auto mb-4 opacity-20" />
          <p className="text-muted-foreground text-lg font-semibold">Nenhum cartão de erro ainda.</p>
          <p className="text-sm text-muted-foreground mt-1">Crie seu primeiro cartão para começar a memorizar com eficiência.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(Object.entries(groupedBySubject) as [string, ErrorCard[]][]).map(([subjectName, subjectCards]) => {
            const isExpanded = expandedSubjects.has(subjectName);
            const pendingCount = subjectCards.filter(c => !c.nextReview || c.nextReview <= today).length;
            return (
              <section key={subjectName} className="rounded-2xl bg-card border border-border overflow-hidden">
                <button
                  onClick={() => toggleSubjectExpanded(subjectName)}
                  className="w-full flex items-center justify-between p-5 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ClipboardList size={18} className="text-primary" />
                    <div className="text-left">
                      <h3 className="font-bold text-base">{subjectName}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{subjectCards.length} {subjectCards.length === 1 ? 'cartão' : 'cartões'}</span>
                        {pendingCount > 0 && (
                          <span className="text-[10px] font-bold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                            {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown size={20} className="text-muted-foreground" />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 pt-1 border-t border-border/30">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {subjectCards.map(card => {
                            const isPending = !card.nextReview || card.nextReview <= today;
                            const aproveitamento = card.totalReviews > 0 ? Math.round((card.correctReviews / card.totalReviews) * 100) : 0;
                            return (
                              <motion.div
                                key={card.id}
                                layout
                                className={cn(
                                  "bg-muted/40 border p-5 rounded-2xl shadow-sm space-y-3 group relative",
                                  isPending ? "border-orange-500/30" : "border-border/50"
                                )}
                              >
                                {isPending && (
                                  <div className="absolute top-3 right-3">
                                    <span className="w-2.5 h-2.5 bg-orange-500 rounded-full block animate-pulse" />
                                  </div>
                                )}
                                <div>
                                  {card.topic && (
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{card.topic}</span>
                                  )}
                                  <p className="font-semibold text-sm mt-1 line-clamp-2">{card.question}</p>
                                </div>

                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-full font-bold",
                                    card.difficulty === 1 ? "bg-green-500/10 text-green-500" :
                                    card.difficulty === 3 ? "bg-red-500/10 text-red-500" :
                                    "bg-yellow-500/10 text-yellow-500"
                                  )}>
                                    {card.difficulty === 1 ? 'Fácil' : card.difficulty === 3 ? 'Difícil' : 'Médio'}
                                  </span>
                                  <span>{card.totalReviews || 0} revisões</span>
                                  {card.totalReviews > 0 && (
                                    <span className={aproveitamento >= 70 ? 'text-green-500' : aproveitamento >= 50 ? 'text-yellow-500' : 'text-red-500'}>
                                      {aproveitamento}%
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Clock size={12} />
                                  {isPending ? (
                                    <span className="text-orange-500 font-bold">Revisão pendente</span>
                                  ) : (
                                    <span>Próx: {card.nextReview}</span>
                                  )}
                                </div>

                                {/* Ações */}
                                <div className="flex items-center gap-1 pt-1 border-t border-border/50">
                                  <button
                                    onClick={() => { setSelectedCardHistory(selectedCardHistory === card.id ? null : card.id); }}
                                    className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-muted"
                                  >
                                    <History size={12} /> Histórico
                                  </button>
                                  <button
                                    onClick={() => openEditModal(card)}
                                    className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-muted"
                                  >
                                    <Edit2 size={12} /> Editar
                                  </button>
                                  <button
                                    onClick={() => deleteCard(card.id)}
                                    className="text-xs text-muted-foreground hover:text-red-500 transition-colors flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-muted"
                                  >
                                    <Trash2 size={12} /> Excluir
                                  </button>
                                </div>

                                {/* Histórico inline */}
                                <AnimatePresence>
                                  {selectedCardHistory === card.id && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="pt-2 border-t border-border/30 space-y-2">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Histórico de Revisões</p>
                                        {reviewHistory.length === 0 ? (
                                          <p className="text-xs text-muted-foreground italic">Nenhuma revisão ainda.</p>
                                        ) : (
                                          reviewHistory.slice(0, 5).map(rev => (
                                            <div key={rev.id} className="flex items-center justify-between text-xs py-1">
                                              <span className="text-muted-foreground">
                                                {rev.reviewedAt ? format(new Date(rev.reviewedAt), 'dd/MM/yy HH:mm') : '—'}
                                              </span>
                                              <span className={cn(
                                                "px-2 py-0.5 rounded-full font-bold",
                                                rev.result === 'easy' ? "bg-green-500/10 text-green-500" :
                                                rev.result === 'good' ? "bg-blue-500/10 text-blue-500" :
                                                rev.result === 'hard' ? "bg-orange-500/10 text-orange-500" :
                                                "bg-red-500/10 text-red-500"
                                              )}>
                                                {rev.result === 'easy' ? '🤩 Fácil' : rev.result === 'good' ? '😊 Bom' : rev.result === 'hard' ? '😤 Difícil' : '😵 Esqueci'}
                                              </span>
                                              <span className="text-muted-foreground">{rev.previousInterval}d → {rev.newInterval}d</span>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            );
          })}
        </div>
      )}

      {/* Modal Criar/Editar Card */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-card border border-border p-8 rounded-3xl shadow-2xl max-w-lg w-full space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">{editingCard ? 'Editar Cartão' : 'Novo Cartão de Erro'}</h3>
                <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-xl hover:bg-muted transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Disciplina</label>
                    <input
                      type="text"
                      value={formSubject}
                      onChange={e => setFormSubject(e.target.value)}
                      placeholder="Ex: Direito Penal"
                      list="subject-suggestions"
                      className="w-full bg-muted border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20"
                    />
                    <datalist id="subject-suggestions">
                      {uniqueSubjects.map(s => <option key={s} value={s} />)}
                    </datalist>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Tópico</label>
                    <input
                      type="text"
                      value={formTopic}
                      onChange={e => setFormTopic(e.target.value)}
                      placeholder="Ex: Crimes contra a pessoa"
                      className="w-full bg-muted border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Pergunta (Frente do Cartão)</label>
                  <textarea
                    value={formQuestion}
                    onChange={e => setFormQuestion(e.target.value)}
                    placeholder="Ex: Qual a diferença entre homicídio doloso e culposo?"
                    className="w-full h-24 bg-muted border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Resposta (Verso do Cartão)</label>
                  <textarea
                    value={formAnswer}
                    onChange={e => setFormAnswer(e.target.value)}
                    placeholder="Ex: O homicídio doloso é quando há intenção de matar, enquanto o culposo..."
                    className="w-full h-24 bg-muted border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowCreateModal(false)} className="flex-1 py-3 rounded-xl border border-border font-bold hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={saveCard} disabled={!formSubject || !formQuestion || !formAnswer} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
                  {editingCard ? 'Salvar' : 'Criar Cartão'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Importação em Massa */}
      <AnimatePresence>
        {showBulkModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-card border border-border p-8 rounded-3xl shadow-2xl max-w-2xl w-full space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Upload size={20} className="text-primary" />
                  Importar Flashcards em Massa
                </h3>
                <button onClick={() => setShowBulkModal(false)} className="p-2 rounded-xl hover:bg-muted transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Disciplina *</label>
                  <input
                    type="text"
                    value={bulkSubject}
                    onChange={e => setBulkSubject(e.target.value)}
                    placeholder="Ex: Direito Processual Penal"
                    list="bulk-subject-suggestions"
                    className="w-full bg-muted border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20"
                  />
                  <datalist id="bulk-subject-suggestions">
                    {uniqueSubjects.map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Tópico (opcional)</label>
                  <input
                    type="text"
                    value={bulkTopic}
                    onChange={e => setBulkTopic(e.target.value)}
                    placeholder="Ex: Lei Processual no Tempo"
                    className="w-full bg-muted border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20"
                  />
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3">
                <p className="text-sm font-bold text-primary">📋 Formato de importação</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Cada linha deve conter a <strong>Pergunta</strong> e a <strong>Resposta</strong> separadas por <strong>ponto e vírgula (;)</strong>
                </p>
                <div className="bg-background/80 rounded-xl p-3 font-mono text-xs">
                  <p className="text-muted-foreground">Formato: <span className="text-primary">Pergunta ; Resposta</span></p>
                </div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Exemplo:</p>
                <div className="bg-background/80 rounded-xl p-3 font-mono text-[11px] space-y-0.5 text-muted-foreground">
                  <p>Lei Processual no Tempo: Qual o princípio? ; Tempus Regit Actum (Art. 2º CPP)</p>
                  <p>Normas Híbridas: Como se comportam? ; Retroagem se forem benéficas ao réu</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Cole seus flashcards abaixo (um por linha)</label>
                <textarea
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  placeholder={"Pergunta ; Resposta\nPergunta ; Resposta\n..."}
                  className="w-full h-48 bg-muted border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 resize-none font-mono text-sm"
                />
                {bulkText.trim() && (
                  <p className="text-xs text-muted-foreground">
                    {bulkText.trim().split('\n').filter(l => l.trim()).length} linha(s) detectada(s)
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowBulkModal(false)} className="flex-1 py-3 rounded-xl border border-border font-bold hover:bg-muted transition-colors">Cancelar</button>
                <button
                  onClick={saveBulkCards}
                  disabled={bulkImporting || !bulkText.trim() || !bulkSubject.trim()}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {bulkImporting ? 'Importando...' : `Importar ${bulkText.trim() ? bulkText.trim().split('\n').filter(l => l.trim()).length : 0} Cartões`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// --- Main App ---

const MainApp = () => {
  const { user, signIn, signUp, logout, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsSubmitting(true);
    try {
      if (isRegistering) {
        const { error, data } = await signUp(email, password, name);
        if (error) throw error;
        // Se a confirmação de e-mail estiver desligada, signUp já faz o login!
        if (data.session) {
          // Logado com sucesso após registro
        } else {
          // Isso acontece se tiver confirmação ativada no Supabase
          setAuthError('Conta criada! Faça o login agora.');
          setIsRegistering(false); 
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
      }
    } catch (err: any) {
      setAuthError(err.message || 'Erro de autenticação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-background">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
      />
    </div>
  );

  if (!user) return (
    <div className="h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center bg-card border border-border p-8 rounded-3xl shadow-2xl">
        <div className="inline-flex p-4 bg-primary/10 text-primary rounded-3xl mb-4">
          <Brain size={48} />
        </div>
        <div className="space-y-2 mb-6">
          <h1 className="text-3xl font-black tracking-tight">CÉREBRO POLICIAL</h1>
          <p className="text-xs text-muted-foreground">A plataforma de elite para quem busca a aprovação.</p>
        </div>
        
        {authError && <div className="mb-4 text-sm text-red-500 bg-red-500/10 p-3 rounded-xl">{authError}</div>}
        
        <form onSubmit={handleAuth} className="space-y-4 text-left">
          {isRegistering && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Nome do Recruta</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full bg-muted border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20" placeholder="Ex: João da Silva"/>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase">Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-muted border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20" placeholder="voce@exemplo.com"/>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase">Senha</label>
            <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-muted border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20" placeholder="••••••••"/>
          </div>
          
          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all text-lg disabled:opacity-50 mt-2"
          >
            {isSubmitting ? 'Aguarde...' : (isRegistering ? 'Criar Conta' : 'Acessar')}
          </button>
        </form>
        
        <button onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }} className="mt-6 text-sm text-primary hover:underline">
          {isRegistering ? 'Já tem uma conta? Faça Login' : 'Não tem conta? Cadastre-se agora'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-72 border-r border-border bg-card/50 backdrop-blur-xl p-6 flex flex-col gap-8 sticky top-0 h-auto md:h-screen z-50">
        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-primary text-primary-foreground rounded-xl shadow-lg shadow-primary/20">
            <Brain size={24} />
          </div>
          <span className="text-xl font-black tracking-tighter">CÉREBRO</span>
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={BookOpen} label="Ciclo" active={activeTab === 'cycle'} onClick={() => setActiveTab('cycle')} />
          <SidebarItem icon={Brain} label="Edital" active={activeTab === 'syllabus'} onClick={() => setActiveTab('syllabus')} />
          <SidebarItem icon={Timer} label="Estudar" active={activeTab === 'study'} onClick={() => setActiveTab('study')} />
          <SidebarItem icon={Dumbbell} label="TAF" active={activeTab === 'taf'} onClick={() => setActiveTab('taf')} />
          <SidebarItem icon={Calendar} label="Rotina" active={activeTab === 'routine'} onClick={() => setActiveTab('routine')} />
          <SidebarItem icon={ClipboardList} label="Caderno de Erros" active={activeTab === 'errors'} onClick={() => setActiveTab('errors')} />
          <SidebarItem icon={Settings} label="Configurações" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>

        <div className="pt-6 border-t border-border space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-muted border border-border overflow-hidden">
              {user.photoURL && <img src={user.photoURL} alt="Avatar" referrerPolicy="no-referrer" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{user.displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="flex items-center gap-3 w-full px-4 py-2 text-sm font-medium text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut size={18} /> Sair da Plataforma
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && <Dashboard key="dash" />}
          {activeTab === 'cycle' && <CycleManager key="cycle" />}
          {activeTab === 'syllabus' && <SyllabusManager key="syllabus" />}
          {activeTab === 'study' && <StudyTimer key="study" />}
          {activeTab === 'taf' && <TAFTracker key="taf" />}
          {activeTab === 'routine' && <RoutinePlanner key="routine" />}
          {activeTab === 'errors' && <ErrorNotebook key="errors" />}
          {activeTab === 'settings' && <SettingsPage key="settings" />}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
