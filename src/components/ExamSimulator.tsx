import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Target, Clock, CheckCircle2, XCircle, AlertTriangle, Printer, RotateCcw, Brain, Check, FileText } from 'lucide-react';
import { cn } from '../lib/utils';
import { db } from '../firebase';
import { collection, getDocs, query } from '../lib/firestoreSupabase';
import { Subject, Topic } from '../types';
import { useAuth } from './AuthProvider';
import { generateExamQuestions, ExamQuestion } from '../services/geminiService';

export const ExamSimulator = () => {
  const { profile } = useAuth();
  const [subjects, setSubjects] = useState<(Subject & { topics: Topic[] })[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Config State
  const [examBoard, setExamBoard] = useState('CEBRASPE');
  const [cargo, setCargo] = useState('Agente de Polícia');
  const [totalQuestions, setTotalQuestions] = useState(20);

  // Phases: 'setup' | 'loading' | 'exam' | 'result'
  const [phase, setPhase] = useState<'setup' | 'loading' | 'exam' | 'result'>('setup');
  
  // Exam State
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // questionId -> selected answer
  const [timeRemaining, setTimeRemaining] = useState(0); // in seconds
  const [timeSpent, setTimeSpent] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!profile) return;
      try {
        const subjectsSnap = await getDocs(query(collection(db, 'users', profile.uid, 'subjects')));
        const subs: (Subject & { topics: Topic[] })[] = [];
        
        for (const doc of subjectsSnap.docs) {
          const s = { id: doc.id, ...doc.data() } as Subject;
          const topicsSnap = await getDocs(query(collection(db, 'users', profile.uid, 'subjects', s.id, 'topics')));
          const ts = topicsSnap.docs.map(tDoc => ({ id: tDoc.id, ...tDoc.data() } as Topic));
          subs.push({ ...s, topics: ts });
        }
        setSubjects(subs);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingConfig(false);
      }
    };
    fetchData();
  }, [profile]);

  useEffect(() => {
    let timer: any;
    if (phase === 'exam') {
      timer = setInterval(() => {
        setTimeSpent(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [phase]);

  const handleStart = async () => {
    if (subjects.length === 0) {
      alert("Nenhuma disciplina encontrada no edital.");
      return;
    }
    setPhase('loading');
    setTimeSpent(0);
    setAnswers({});

    try {
      // Prepare payload
      const materias = subjects.slice(0, 5).map(s => ({
        name: s.name,
        weight: s.weight || 1,
        topics: s.topics.slice(0, 5).map(t => t.title) // Limiting payload
      }));

      const generated = await generateExamQuestions(examBoard, cargo, materias, totalQuestions);
      if (!generated || generated.length === 0) throw new Error("IA retornou array vazio.");
      setQuestions(generated);
      setPhase('exam');
    } catch (e) {
      console.error(e);
      alert("Houve um erro ao gerar o simulado. Tente novamente.");
      setPhase('setup');
    }
  };

  const handleFinish = () => {
    if (Object.keys(answers).length < questions.length) {
      if (!window.confirm("Você deixou questões em branco. Tem certeza que deseja finalizar?")) {
        return;
      }
    }
    setPhase('result');
  };

  const calculateResult = () => {
    let correct = 0;
    let wrong = 0;
    let blank = 0;

    questions.forEach((q) => {
      const userAns = answers[q.id];
      if (!userAns) {
        blank++;
        return;
      }

      if (q.tipo === 'CEBRASPE') {
        if (userAns === q.gabaritoCebraspe) correct++;
        else wrong++;
      } else {
        if (userAns === q.gabaritoMultipla) correct++;
        else wrong++;
      }
    });

    // Cebraspe scoring: 1 wrong nullifies 1 correct.
    const isCebraspe = examBoard.toUpperCase().includes('CEBRASPE');
    let netScore = correct;
    if (isCebraspe) {
      netScore = correct - wrong;
    }
    
    return { correct, wrong, blank, netScore, isCebraspe };
  };

  const handlePrint = () => {
    window.print();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  return (
    <div className="space-y-8 min-h-screen pb-12 print:pb-0">
      <header className="print:hidden">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Target className="text-emerald-500" size={32} /> 
          Simulador de Provas com IA
        </h1>
        <p className="text-muted-foreground mt-2">Gere simulados de alto nível baseados no seu edital atual.</p>
      </header>

      {phase === 'setup' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-[#141414] border border-[#10b981]/20 rounded-3xl p-8 max-w-4xl mx-auto shadow-[0_0_40px_rgba(16,185,129,0.05)] relative overflow-hidden"
        >
          {/* Glassmorphism/Neon glow */}
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />
          
          <h2 className="text-2xl font-bold mb-6 text-emerald-400">Configuração do Simulado</h2>
          
          <div className="space-y-6 relative z-10">
            {loadingConfig ? (
              <p className="text-muted-foreground animate-pulse">Carregando seus dados...</p>
            ) : subjects.length === 0 ? (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-500">
                Você precisa importar um Edital Verticalizado antes de gerar um simulado.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Banca Examinadora</label>
                    <select 
                      value={examBoard} 
                      onChange={(e) => setExamBoard(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-emerald-500/20 rounded-xl px-4 py-3 outline-none focus:ring-2 ring-emerald-500/40 text-foreground"
                    >
                      <option value="CEBRASPE">CEBRASPE (Certo/Errado)</option>
                      <option value="FGV">FGV (Múltipla Escolha)</option>
                      <option value="VUNESP">VUNESP (Múltipla Escolha)</option>
                      <option value="FCC">FCC (Múltipla Escolha)</option>
                      <option value="OUTRA">Outra</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Cargo Foco</label>
                    <input 
                      type="text" 
                      value={cargo}
                      onChange={(e) => setCargo(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-emerald-500/20 rounded-xl px-4 py-3 outline-none focus:ring-2 ring-emerald-500/40 text-foreground"
                      placeholder="Ex: Agente da Polícia Federal"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Quantidade de Questões (IA)</label>
                  <div className="flex gap-4">
                    {[10, 20, 30, 50].map((num) => (
                      <button
                        key={num}
                        onClick={() => setTotalQuestions(num)}
                        className={cn(
                          "flex-1 py-3 rounded-xl font-bold transition-all border",
                          totalQuestions === num 
                            ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                            : "bg-[#0a0a0a] border-emerald-500/10 text-muted-foreground hover:border-emerald-500/30"
                        )}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#0a0a0a] p-4 rounded-xl border border-emerald-500/10">
                  <p className="text-sm text-emerald-500/80 mb-2 font-bold uppercase tracking-widest">Disciplinas Selecionadas</p>
                  <div className="flex flex-wrap gap-2">
                    {subjects.map(s => (
                      <span key={s.id} className="text-xs bg-[#141414] border border-emerald-500/20 px-2 py-1 rounded-md text-muted-foreground">
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={handleStart}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl transition-all flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                >
                  <Target size={20} /> Iniciar Missão
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}

      {phase === 'loading' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-[#141414] border border-[#10b981]/20 rounded-3xl p-12 max-w-xl mx-auto shadow-2xl text-center space-y-6"
        >
          <div className="flex justify-center mb-6">
            <div className="relative">
              <Brain size={64} className="text-emerald-500/50 animate-pulse" />
              <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-emerald-400">Codificando Simulado...</h2>
          <p className="text-muted-foreground">A IA está varrendo seu edital e gerando questões inéditas no padrão {examBoard}. Aguarde recruta.</p>
        </motion.div>
      )}

      {phase === 'exam' && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="max-w-5xl mx-auto space-y-6"
        >
          <div className="sticky top-0 z-50 bg-[#0a0a0a]/90 backdrop-blur border-b border-emerald-500/20 py-4 flex justify-between items-center px-4 -mx-4">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
               <Clock size={20} />
               {formatTime(timeSpent)}
            </div>
            <div className="text-sm font-bold text-muted-foreground">
               Simulado: {examBoard} - {cargo}
            </div>
            <button 
              onClick={handleFinish}
              className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 border border-emerald-500/30 px-4 py-2 rounded-xl font-bold transition-colors text-sm"
            >
              Finalizar Prova
            </button>
          </div>

          <div className="space-y-8">
            {questions.map((q, idx) => (
              <div key={q.id} className="bg-[#141414] border border-emerald-500/10 p-6 rounded-2xl space-y-4">
                <div className="flex items-start justify-between gap-4">
                   <div className="flex items-center gap-2">
                     <span className="bg-emerald-500/10 text-emerald-500 font-black text-sm px-3 py-1 rounded-lg border border-emerald-500/20">
                       Q{idx + 1}
                     </span>
                     <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{q.subjectId} • {q.topicTitle}</span>
                   </div>
                </div>
                
                <p className="text-foreground leading-relaxed text-lg">{q.enunciado}</p>

                {q.tipo === 'CEBRASPE' ? (
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setAnswers(prev => ({ ...prev, [q.id]: 'CERTO' }))}
                      className={cn(
                        "flex-1 py-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all",
                        answers[q.id] === 'CERTO' 
                          ? "bg-green-500/20 border-green-500 text-green-400" 
                          : "bg-[#0a0a0a] border-border text-muted-foreground hover:border-emerald-500/30"
                      )}
                    >
                      <CheckCircle2 size={18} /> CERTO
                    </button>
                    <button 
                      onClick={() => setAnswers(prev => ({ ...prev, [q.id]: 'ERRADO' }))}
                      className={cn(
                        "flex-1 py-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all",
                        answers[q.id] === 'ERRADO' 
                          ? "bg-red-500/20 border-red-500 text-red-400" 
                          : "bg-[#0a0a0a] border-border text-muted-foreground hover:border-emerald-500/30"
                      )}
                    >
                      <XCircle size={18} /> ERRADO
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {q.alternativas?.map((alt, i) => {
                      const letter = String.fromCharCode(65 + i);
                      return (
                        <button
                          key={letter}
                          onClick={() => setAnswers(prev => ({ ...prev, [q.id]: letter }))}
                          className={cn(
                            "w-full text-left p-4 rounded-xl border flex items-start gap-3 transition-all",
                            answers[q.id] === letter 
                               ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" 
                               : "bg-[#0a0a0a] border-border text-muted-foreground hover:border-emerald-500/30"
                          )}
                        >
                          <span className="font-bold">{letter})</span>
                          <span>{alt}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

        </motion.div>
      )}

      {phase === 'result' && (() => {
        const result = calculateResult();
        const scorePercentage = Math.round((result.correct / questions.length) * 100) || 0;
        
        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="max-w-4xl mx-auto space-y-6 print:text-black print:max-w-full print:p-0"
          >
            <div className="flex justify-between items-center print:hidden">
              <h2 className="text-2xl font-bold text-emerald-400">Relatório da Missão</h2>
              <div className="flex gap-4">
                <button 
                  onClick={() => setPhase('setup')}
                  className="flex items-center gap-2 text-sm font-bold hover:text-emerald-500 transition-colors"
                >
                  <RotateCcw size={16} /> Novo Simulado
                </button>
                <button 
                  onClick={handlePrint}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                >
                  <Printer size={16} /> Exportar Relatório (PDF)
                </button>
              </div>
            </div>

            {/* HEADER IMPRESSAO */}
            <div className="hidden print:block text-center border-b border-black pb-4 mb-4">
               <h1 className="text-3xl font-black">CÉREBRO POLICIAL</h1>
               <h2 className="text-xl">Simulado Oficial - {examBoard} - {cargo}</h2>
               <p className="text-sm mt-1">Tempo de Prova: {formatTime(timeSpent)} | Data: {new Date().toLocaleDateString()}</p>
            </div>

            {/* DASHBOARD RESULTADOS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
              <div className="bg-[#141414] print:bg-white print:border-black border border-emerald-500/20 p-6 rounded-2xl text-center shadow-lg">
                 <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1 print:text-black">Aproveitamento</p>
                 <div className="text-3xl font-black text-emerald-400 print:text-emerald-700">{scorePercentage}%</div>
              </div>
              <div className="bg-[#141414] print:bg-white print:border-black border border-emerald-500/20 p-6 rounded-2xl text-center shadow-lg">
                 <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1 print:text-black">Corretas</p>
                 <div className="text-3xl font-black text-green-500">{result.correct}</div>
              </div>
              <div className="bg-[#141414] print:bg-white print:border-black border border-emerald-500/20 p-6 rounded-2xl text-center shadow-lg">
                 <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1 print:text-black">Erradas</p>
                 <div className="text-3xl font-black text-red-500">{result.wrong}</div>
              </div>
              <div className="bg-[#141414] print:bg-white print:border-black border border-emerald-500/20 p-6 rounded-2xl text-center shadow-lg">
                 <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1 print:text-black">
                   {result.isCebraspe ? 'Nota Líquida' : 'Em Branco'}
                 </p>
                 <div className="text-3xl font-black text-blue-400 print:text-blue-700">
                   {result.isCebraspe ? result.netScore : result.blank}
                 </div>
              </div>
            </div>

            {/* DETALHES DAS QUESTOES */}
            <div className="space-y-6 mt-8 print:mt-4 print:space-y-4">
              <h3 className="text-xl font-bold border-b border-border pb-2 print:border-black print:text-black">Correção Detalhada</h3>
              {questions.map((q, idx) => {
                const userAns = answers[q.id];
                const realAnswer = q.tipo === 'CEBRASPE' ? q.gabaritoCebraspe : q.gabaritoMultipla;
                const isCorrect = userAns === realAnswer;
                const isBlank = !userAns;

                return (
                  <div key={q.id} className="bg-[#141414] print:bg-white border border-border print:border-black p-6 rounded-2xl space-y-4 break-inside-avoid">
                    <div className="flex items-center gap-3 print:text-black">
                      <span className={cn(
                        "font-black text-sm px-3 py-1 rounded-lg border",
                        isBlank ? "bg-muted text-muted-foreground" :
                        isCorrect ? "bg-green-500/20 text-green-500 border-green-500/20 print:bg-green-100 print:text-green-800" : "bg-red-500/20 text-red-500 border-red-500/20 print:bg-red-100 print:text-red-800"
                      )}>
                        Q{idx + 1}
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-gray-600">{q.subjectId}</span>
                      
                      <div className="ml-auto">
                         {isBlank ? (
                           <span className="text-xs font-bold text-muted-foreground print:text-gray-600">EM BRANCO</span>
                         ) : isCorrect ? (
                           <span className="text-xs font-bold text-green-500 print:text-green-600 flex items-center gap-1"><Check size={14} /> ACERTOU</span>
                         ) : (
                           <span className="text-xs font-bold text-red-500 print:text-red-600 flex items-center gap-1"><XCircle size={14} /> ERROU</span>
                         )}
                      </div>
                    </div>

                    <p className="text-foreground print:text-black text-sm">{q.enunciado}</p>

                    <div className="bg-[#0a0a0a] print:bg-gray-50 border border-border print:border-gray-300 p-4 rounded-xl text-sm space-y-2">
                       <div className="flex gap-4">
                         <div className="print:text-black"><span className="text-muted-foreground font-bold print:text-gray-600">Sua resposta:</span> {userAns || 'Nenhuma'}</div>
                         <div className="print:text-black"><span className="text-muted-foreground font-bold print:text-gray-600">Gabarito:</span> {realAnswer}</div>
                       </div>
                       <hr className="border-border print:border-gray-300 my-2" />
                       <div>
                         <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-1 print:text-emerald-700">Comentário do Doutrinador (IA)</p>
                         <p className="text-muted-foreground print:text-gray-800">{q.comentario}</p>
                       </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        );
      })()}
    </div>
  );
};
