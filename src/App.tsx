import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { AuthProvider, useAuth } from './components/AuthProvider';
import { Edit2 } from 'lucide-react';
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
import { format, parseISO } from 'date-fns';

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
    const q = query(collection(db, 'users', profile.uid, 'subjects'), orderBy('order'));
    return onSnapshot(q, (snapshot) => {
      const subs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
      setSubjects(subs);
      if (subs.length > 0 && !selectedSubjectId) setSelectedSubjectId(subs[0].id);
    });
  }, [profile]);

  useEffect(() => {
    if (!profile || !selectedSubjectId) return;
    const q = query(collection(db, 'users', profile.uid, 'subjects', selectedSubjectId, 'topics'));
    return onSnapshot(q, (snapshot) => {
      setTopics(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Topic)));
    });
  }, [profile, selectedSubjectId]);

  const handleParse = async () => {
    if (!profile || !syllabusText) return;
    setIsParsing(true);
    try {
      const parsedData = await parseSyllabus(syllabusText, examBoard);
      
      for (const item of parsedData) {
        // Create subject
        const subjectRef = await addDoc(collection(db, 'users', profile.uid, 'subjects'), {
          name: item.subjectName,
          weight: 1,
          difficulty: 1,
          color: '#3b82f6',
          order: subjects.length
        });

        // Create topics
        const topicsList = Array.isArray(item.topics) ? item.topics : [];
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
            relevance
          });
        }
      }
      setSyllabusText('');
      alert('Edital verticalizado com sucesso!');
    } catch (error) {
      console.error(error);
      alert('Erro ao processar edital.');
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
    
    if (currentResumo && currentQuestoes && currentFlashcards) {
      updateData.theoryProgress = 100;
    } else if (currentResumo || currentQuestoes || currentFlashcards) {
      updateData.theoryProgress = 50;
    } else {
      updateData.theoryProgress = 0;
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

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'users', profile.uid, 'subjects'), orderBy('order'));
    return onSnapshot(q, async (snapshot) => {
      const subs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
      setSubjects(subs);
      
      const topicsPromises = subs.map(s => getDocs(collection(db, 'users', profile.uid, 'subjects', s.id, 'topics')));
      const topicsSnapshots = await Promise.all(topicsPromises);
      const topics = topicsSnapshots.flatMap(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Topic)));
      setAllTopics(topics);
    });
  }, [profile]);

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

  const completedTopics = allTopics.filter(t => t.theoryProgress === 100).length;
  const totalTopics = allTopics.length;
  const syllabusProgress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

  const topSubject = subjects.length > 0 ? [...subjects].sort((a, b) => b.weight - a.weight)[0] : null;
  const pendingReviews = allTopics
    .filter(t => t.theoryProgress > 0 && t.lastStudied)
    .sort((a, b) => new Date(a.lastStudied!).getTime() - new Date(b.lastStudied!).getTime())
    .slice(0, 5);

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

      {topSubject && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div>
            <h2 className="text-sm font-bold text-primary uppercase tracking-widest mb-1 flex items-center gap-2">
              <Target size={16} /> Missão do Dia (Maior Peso)
            </h2>
            <p className="text-2xl font-black">{topSubject.name}</p>
            <p className="text-xs text-muted-foreground mt-1">Essa é a matéria de maior peso no seu ciclo atual (Peso {topSubject.weight}). Priorize o estudo dela hoje.</p>
          </div>
        </motion.div>
      )}

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
              <div className="space-y-4">
                {[...subjects].sort((a, b) => b.weight - a.weight).map((s, index) => {
                  const subjectTopics = allTopics.filter(t => t.subjectId === s.id);
                  const completed = subjectTopics.filter(t => t.theoryProgress === 100).length;
                  const total = subjectTopics.length;
                  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

                  return (
                    <div key={s.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border/50">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                        <div>
                          <p className="font-semibold">{s.name}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                            <span className="text-primary mr-1 bg-primary/10 px-1.5 rounded">Ordem {index + 1}</span>
                            <span>Peso {s.weight}</span>
                            <span>•</span>
                            <span>Dif {s.difficulty}</span>
                          </div>
                        </div>
                      </div>
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
    const q = query(collection(db, 'users', profile.uid, 'subjects'), orderBy('order'));
    return onSnapshot(q, (snapshot) => {
      setSubjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
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
      subjectId: selectedSubject,
      topicId: selectedTopic,
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

  const saveQuestionsSession = async () => {
    if (!profile || !selectedSubject || questions <= 0) return;
    
    const xpEarned = correct * 5;

    await addDoc(collection(db, 'users', profile.uid, 'sessions'), {
      userId: profile.uid,
      subjectId: selectedSubject,
      topicId: selectedTopic,
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
        model: "gemini-3-flash-preview",
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
        {/* Timer Section */}
        <div className="bg-card border border-border p-8 rounded-3xl shadow-xl space-y-8 flex flex-col items-center justify-center">
          <div className="text-center space-y-2">
            <div className="text-6xl font-mono font-bold tracking-tighter tabular-nums">
              {formatTime(time)}
            </div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Cronômetro de Estudo</p>
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
