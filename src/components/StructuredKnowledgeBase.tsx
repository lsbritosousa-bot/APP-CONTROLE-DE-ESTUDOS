import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Database,
  Brain,
  Lightbulb,
  Scale,
  AlertTriangle,
  HelpCircle,
  Target,
  FileCheck,
  Download,
  Code,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  ImageIcon,
  X,
  Moon,
  Sun,
  Library,
  FolderOpen
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from './AuthProvider';
import { db } from '../firebase';
import { collection, onSnapshot, query, addDoc, doc, updateDoc, deleteDoc } from '../lib/firestoreSupabase';
import { generateStructuredKnowledge, identifyKnowledgeTopic } from '../services/geminiService';
import { StructuredKnowledgeResult } from '../types';

interface DisciplineDoc {
  id: string;
  name: string;
  knowledgeData?: Record<string, StructuredKnowledgeResult> | null;
}

export const StructuredKnowledgeBase = () => {
  const { profile } = useAuth();
  const [disciplines, setDisciplines] = useState<DisciplineDoc[]>([]);
  const [selectedDiscipline, setSelectedDiscipline] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  
  const [inputText, setInputText] = useState('');
  const [images, setImages] = useState<{file: File, url: string}[]>([]);
  const [forcedTopic, setForcedTopic] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationSteps, setGenerationSteps] = useState('');
  const [newDisciplineName, setNewDisciplineName] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'users', profile.uid, 'knowledge_disciplines'));
    return onSnapshot(q, (snapshot) => {
      const subs = snapshot.docs.map(d => {
         const data = d.data();
         let kData = data.knowledgeData;
         
         // Retrocompatibilidade: Se existir a estrutura antiga direto na raiz
         if (kData && kData.visaoGeral) {
            kData = { "Assunto Principal": kData };
         }

         return { id: d.id, ...data, knowledgeData: kData } as DisciplineDoc;
      });

      setDisciplines(subs);
      if (subs.length > 0 && !selectedDiscipline) {
         setSelectedDiscipline(subs[0].id);
         const topics = Object.keys(subs[0].knowledgeData || {});
         if (topics.length > 0) setSelectedTopic(topics[0]);
      }
    });
  }, [profile]);

  // Se trocar a disciplina, auto-seleciona a primeira materia dela
  useEffect(() => {
    if (selectedDiscipline) {
      const disc = disciplines.find(d => d.id === selectedDiscipline);
      const topics = Object.keys(disc?.knowledgeData || {});
      if (topics.length > 0) {
         // Só troca se o topico selecionado não pertencer à disciplina (o que é normal num switch full)
         if (!topics.includes(selectedTopic || '')) {
            setSelectedTopic(topics[0]);
         }
      } else {
         setSelectedTopic(null);
      }
    }
  }, [selectedDiscipline, disciplines]);

  const handleAddDiscipline = async () => {
    if (!profile || !newDisciplineName.trim()) return;
    try {
      const docRef = await addDoc(collection(db, 'users', profile.uid, 'knowledge_disciplines'), {
        userId: profile.uid,
        name: newDisciplineName.trim(),
        knowledgeData: {},
        createdAt: new Date().toISOString()
      });
      setSelectedDiscipline(docRef.id);
      setSelectedTopic(null);
      setNewDisciplineName('');
    } catch(e) {
      alert("Erro ao criar disciplina.");
    }
  };

  const handleDeleteDiscipline = async (id: string, name: string) => {
    if (!profile) return;
    if (!window.confirm(`Apagar a disciplina "${name}" e TODA a sua base de conhecimento?`)) return;
    try {
      await deleteDoc(doc(db, 'users', profile.uid, 'knowledge_disciplines', id));
      if (selectedDiscipline === id) {
         setSelectedDiscipline(null);
         setSelectedTopic(null);
      }
    } catch(e) {
      alert("Erro ao excluir.");
    }
  };

  const handleDeleteTopic = async (disciplineId: string, topicName: string) => {
    if (!profile) return;
    if (!window.confirm(`Tem certeza que deseja apagar o subtópico "${topicName}" e todo seu conteúdo?`)) return;
    
    try {
      const disc = disciplines.find(d => d.id === disciplineId);
      if (!disc) return;
      
      const updatedKnowledgeData = { ...(disc.knowledgeData || {}) };
      delete updatedKnowledgeData[topicName];

      await updateDoc(doc(db, 'users', profile.uid, 'knowledge_disciplines', disciplineId), {
         knowledgeData: updatedKnowledgeData,
         updatedAt: new Date().toISOString()
      });

      if (selectedTopic === topicName) {
         setSelectedTopic(null);
      }
    } catch(e) {
      alert("Erro ao excluir subtópico.");
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const url = URL.createObjectURL(file);
          setImages(prev => [...prev, {file, url}]);
        }
      }
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]); 
    reader.onerror = error => reject(error);
  });

  const handleGenerate = async () => {
    if (!selectedDiscipline || (!inputText.trim() && images.length === 0) || !profile) return;
    setIsGenerating(true);
    
    try {
      const currentDisc = disciplines.find(d => d.id === selectedDiscipline);
      const existingTopics = Object.keys(currentDisc?.knowledgeData || {});

      const imagesBase64 = await Promise.all(images.map(async img => ({
         mimeType: img.file.type,
         data: await fileToBase64(img.file)
      })));

      // 1. Fase de Roteamento
      let targetTopic = forcedTopic.trim();
      if (!targetTopic) {
         setGenerationSteps('Lendo dados e Identificando Subtópico...');
         targetTopic = await identifyKnowledgeTopic(inputText, imagesBase64, existingTopics);
      }
      
      setGenerationSteps(`Processando Acúmulo no subtópico: "${targetTopic}"...`);
      const currentKnowledgeBaseOfTopic = (currentDisc?.knowledgeData || {})[targetTopic] || null;

      // 2. Fase de Geração/Fusão Específica
      const newTopicData = await generateStructuredKnowledge(currentKnowledgeBaseOfTopic, inputText, imagesBase64);

      // 3. Atualizar no DB
      const updatedKnowledgeData = {
         ...(currentDisc?.knowledgeData || {}),
         [targetTopic]: newTopicData
      };

      await updateDoc(doc(db, 'users', profile.uid, 'knowledge_disciplines', selectedDiscipline), {
         knowledgeData: updatedKnowledgeData,
         updatedAt: new Date().toISOString()
      });

      // Feedback
      setInputText('');
      setImages([]);
      setForcedTopic('');
      setSelectedTopic(targetTopic); // Direciona atenção pro tópico gerado
    } catch (e: any) {
      alert("Erro ao processar conteúdo: " + e.message);
    } finally {
      setIsGenerating(false);
      setGenerationSteps('');
    }
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const formatBold = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className={theme === 'dark' ? "text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-md mx-0.5 border border-yellow-400/20" : "text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded-md mx-0.5 border border-indigo-200"}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  const currentDisc = disciplines.find(d => d.id === selectedDiscipline);
  const currentData = (currentDisc?.knowledgeData && selectedTopic) ? currentDisc.knowledgeData[selectedTopic] : null;

  const bgPage = theme === 'dark' ? 'bg-[#0F172A]' : 'bg-slate-100';
  const bgCard = theme === 'dark' ? 'bg-[#1E293B] shadow-2xl shadow-indigo-900/10' : 'bg-white shadow-xl shadow-slate-200/50';
  const bgInput = theme === 'dark' ? 'bg-[#0F172A] border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800';
  const textHeading = theme === 'dark' ? 'text-white' : 'text-slate-900';
  const textBody = theme === 'dark' ? 'text-slate-200' : 'text-slate-700';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn("space-y-8 min-h-screen p-4 md:p-8 rounded-3xl text-xl leading-relaxed font-['Inter'] transition-colors duration-500", bgPage, textBody)}
    >
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className={cn("text-4xl lg:text-5xl font-black tracking-tight", textHeading)}>Base Estruturada</h1>
          <p className={cn("mt-2 text-xl font-medium", theme === 'dark' ? 'text-slate-400' : 'text-slate-500')}>Recorte, Cole, Acumule. Compartimentalização Instantânea.</p>
        </div>
        <div className="flex flex-wrap gap-3">
           <button 
             onClick={toggleTheme}
             className={cn("flex items-center gap-2 border-2 px-5 py-3 rounded-2xl font-bold transition-all shadow-sm", theme === 'dark' ? 'bg-slate-800 border-slate-700 text-yellow-400 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50')}
           >
             {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />} 
             {theme === 'dark' ? 'Modo Claro' : 'Modo Noturno'}
           </button>
           <button className={cn("flex items-center gap-2 border-2 px-5 py-3 rounded-2xl font-bold transition-all shadow-sm hidden sm:flex", theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50')}>
             <Code size={20} /> HTML
           </button>
        </div>
      </header>

      <div className="flex flex-col xl:flex-row gap-8">
        {/* Menu Lateral em Sanfona */}
        <aside className="xl:w-1/4 space-y-6">
          <div className={cn("p-6 rounded-3xl border-t-8 border-indigo-500 transition-colors", bgCard)}>
            <h2 className={cn("font-black text-2xl mb-6 flex items-center gap-3", textHeading)}>
              <Library className="text-indigo-500" /> Cadernos Base
            </h2>
            <div className="flex gap-2 mb-6">
              <input 
                type="text" 
                value={newDisciplineName}
                onChange={e => setNewDisciplineName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddDiscipline()}
                placeholder="Nova disciplina..."
                className={cn("w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 ring-indigo-500/20 text-lg font-medium transition-colors", bgInput)}
              />
              <button 
                onClick={handleAddDiscipline}
                className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30"
              >
                <Plus size={24} />
              </button>
            </div>
            
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              {disciplines.length === 0 ? (
                <p className={cn("text-lg italic font-medium", theme === 'dark' ? 'text-slate-500' : 'text-slate-400')}>Nenhuma disciplina na base.</p>
              ) : (
                disciplines.map(disc => {
                  const isDiscSelected = selectedDiscipline === disc.id;
                  const topics = Object.keys(disc.knowledgeData || {});

                  return (
                    <div key={disc.id} className="space-y-2">
                      <div className="flex gap-1 group relative">
                        <button
                          onClick={() => {
                             setSelectedDiscipline(disc.id);
                             if (topics.length > 0 && !topics.includes(selectedTopic||'')) {
                                setSelectedTopic(topics[0]);
                             }
                          }}
                          className={cn(
                            "w-full text-left px-5 py-4 rounded-2xl transition-all flex justify-between items-center text-lg font-black border-2",
                            isDiscSelected 
                              ? theme === 'dark' ? "bg-slate-800 border-indigo-500 text-indigo-400" : "bg-indigo-50 border-indigo-200 text-indigo-900" 
                              : theme === 'dark' ? "bg-slate-800/50 border-slate-700/50 hover:bg-slate-700 text-slate-300" : "bg-slate-50 border-slate-100 hover:bg-slate-100 text-slate-700"
                          )}
                        >
                          <span className="truncate pr-2">{disc.name}</span>
                          <ChevronDown size={20} className={cn("flex-shrink-0 transition-transform", isDiscSelected ? "rotate-180" : "")} />
                        </button>
                        <button 
                          onClick={() => handleDeleteDiscipline(disc.id, disc.name)}
                          className="text-red-500/50 hover:text-red-500 hover:bg-red-500/10 p-3 rounded-xl absolute right-1 top-1 hidden group-hover:flex items-center bottom-1 transition-colors backdrop-blur-md"
                          title="Apagar Disciplina"
                        >
                           <Trash2 size={20} />
                        </button>
                      </div>

                      {/* Renderização de Subtópicos em Sanfona */}
                      {isDiscSelected && (
                        <AnimatePresence>
                           <motion.div initial={{opacity: 0, height: 0}} animate={{opacity: 1, height: 'auto'}} exit={{opacity: 0, height: 0}} className="pl-4 space-y-1 overflow-hidden overflow-y-auto">
                              {topics.length === 0 && <p className="text-sm italic pl-2 py-2 opacity-50">Nenhum sub-tópico criado.</p>}
                              {topics.map(topic => (
                                 <div key={topic} className="flex gap-1 group relative">
                                   <button
                                     onClick={() => setSelectedTopic(topic)}
                                     className={cn(
                                       "w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 text-base font-bold",
                                       selectedTopic === topic
                                        ? "bg-indigo-600 text-white shadow-md"
                                        : theme === 'dark' ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-slate-100 border border-transparent hover:border-slate-200"
                                     )}
                                   >
                                     <FolderOpen size={16} className="flex-shrink-0" /> 
                                     <span className="truncate pr-6">{topic}</span>
                                   </button>
                                   <button 
                                     onClick={(e) => { e.stopPropagation(); handleDeleteTopic(disc.id, topic); }}
                                     className="text-red-500/30 hover:text-red-500 hover:bg-red-500/10 p-2 rounded-lg absolute right-1 top-1 hidden group-hover:flex items-center bottom-1 transition-colors"
                                     title="Apagar Subtópico"
                                   >
                                      <Trash2 size={16} />
                                   </button>
                                 </div>
                              ))}
                           </motion.div>
                        </AnimatePresence>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* Área Principal */}
        <div className="xl:w-3/4 space-y-8 min-w-0">
          
          {/* Formulário IA Global */}
          <div className={cn("p-8 md:p-10 rounded-3xl border-t-8 border-indigo-500 relative transition-colors shadow-[0_0_40px_rgba(79,70,229,0.15)]", bgCard)}>
             {!selectedDiscipline && (
                <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-md z-10 flex items-center justify-center rounded-3xl">
                  <p className="font-black text-white text-3xl px-8 py-4 bg-slate-900/80 rounded-2xl shadow-2xl">Selecione uma Disciplina para Alimentar.</p>
                </div>
             )}
             
             <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4">
               <div className="flex items-center gap-4">
                 <div className="bg-indigo-500/10 p-3 rounded-2xl">
                   <Brain size={36} className="text-indigo-500" />
                 </div>
                 <h2 className={cn("text-3xl font-black", textHeading)}>A Máquina Sugadora</h2>
               </div>
               
               <div className="flex items-center gap-3 w-full lg:w-auto">
                 <label className={cn("font-bold text-sm uppercase tracking-wide", theme === 'dark' ? 'text-slate-400' : 'text-slate-500')}>Forçar Tópico (Opcional):</label>
                 <input 
                   type="text" 
                   value={forcedTopic}
                   onChange={e => setForcedTopic(e.target.value)}
                   placeholder="Deixe a IA decidir..."
                   className={cn("border rounded-xl px-4 py-2 outline-none focus:ring-2 ring-indigo-500/20 text-base font-medium transition-colors w-full lg:w-48", bgInput)}
                 />
               </div>
             </div>
             
             <textarea 
               value={inputText}
               onChange={(e) => setInputText(e.target.value)}
               onPaste={handlePaste}
               placeholder="Escreva ou aperte 'Ctrl+V' para colar prints valiosos de questões ou lei seca... A IA classificará para você!"
               className={cn("w-full h-40 border-2 rounded-3xl p-6 outline-none focus:border-indigo-500 focus:ring-4 ring-indigo-500/20 resize-none text-xl transition-all shadow-inner", bgInput)}
               style={{ fontFamily: 'Inter, sans-serif' }}
             />

             {/* Preview de Imagens Coladas */}
             {images.length > 0 && (
               <div className="mt-6 flex gap-4 flex-wrap">
                 <AnimatePresence>
                   {images.map((img, i) => (
                      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} key={i} className="relative group">
                         <img src={img.url} alt="preview" className="h-32 w-32 object-cover rounded-2xl shadow-md border-4 border-slate-700/20" />
                         <button 
                           onClick={() => handleRemoveImage(i)}
                           className="absolute -top-3 -right-3 bg-red-600 text-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 hover:scale-110"
                         >
                           <X size={16} />
                         </button>
                      </motion.div>
                   ))}
                 </AnimatePresence>
               </div>
             )}
             
             <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-6">
               <div className={cn("text-base md:text-lg font-medium flex items-center gap-3", theme === 'dark' ? 'text-slate-400' : 'text-slate-500')}>
                 <ImageIcon size={24} className={theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} /> Identificação do assunto é 100% autônoma.
               </div>
               <button 
                 onClick={handleGenerate}
                 disabled={isGenerating || (!inputText.trim() && images.length === 0)}
                 className="w-full md:w-auto bg-indigo-600 text-white font-black text-xl px-10 py-5 rounded-3xl hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-indigo-600/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-4"
               >
                 {isGenerating ? (
                   <>
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                      <Brain size={28} />
                    </motion.div>
                    {generationSteps || 'Processando...'}
                   </>
                 ) : (
                   <>
                    <Brain size={28} /> Lançar na Base
                   </>
                 )}
               </button>
             </div>
          </div>

          {/* Resultados Renderizados no Assunto Selecionado */}
          {selectedTopic && currentData ? (
             <motion.div 
               initial={{ opacity: 0, y: 40 }}
               animate={{ opacity: 1, y: 0 }}
               className="space-y-12"
             >
                <div className="flex items-center gap-4 px-2">
                   <h2 className={cn("text-4xl font-black uppercase tracking-tight", textHeading)}>Pasta: <span className="text-indigo-500">{selectedTopic}</span></h2>
                </div>

                {/* Card 1: Visão Geral */}
                <section className={cn("p-10 rounded-3xl border-t-[10px] border-slate-800 transition-colors", bgCard)}>
                  <h3 className={cn("text-3xl font-black mb-8 flex items-center gap-4", textHeading)}>
                    <Target className="text-slate-500" size={32} /> 1. Visão Geral (O Cerne)
                  </h3>
                  <div className="prose prose-lg max-w-none space-y-6">
                    <p className={cn("font-medium whitespace-pre-wrap leading-loose", textBody)}>
                       {formatBold(currentData.visaoGeral.textoDenso)}
                    </p>
                    {currentData.visaoGeral.divergencias && (
                       <div className={cn("p-8 border-l-[6px] border-slate-500 rounded-r-2xl", theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50')}>
                         <p className={cn("font-black mb-4 text-xl", textHeading)}>Divergências Doutrinárias/Jurisprudenciais:</p>
                         <p className="leading-relaxed">{formatBold(currentData.visaoGeral.divergencias)}</p>
                       </div>
                    )}
                    {currentData.visaoGeral.feynman && (
                      <div className={cn("rounded-2xl p-8 border-2 mt-10", theme === 'dark' ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200')}>
                        <p className={cn("font-black flex items-center gap-3 mb-4 text-xl", theme === 'dark' ? 'text-emerald-400' : 'text-emerald-800')}>
                          <Lightbulb size={28} /> Método de Feynman (Para fixar agora)
                        </p>
                        <p className={cn("italic text-xl leading-relaxed font-medium", theme === 'dark' ? 'text-emerald-200' : 'text-emerald-900')}>"{formatBold(currentData.visaoGeral.feynman)}"</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Card 2: Esquemas */}
                {currentData.esquemas && currentData.esquemas.length > 0 && (
                  <section className={cn("p-10 rounded-3xl border-t-[10px] border-blue-500 transition-colors", bgCard)}>
                    <h3 className={cn("text-3xl font-black mb-8 flex items-center gap-4", textHeading)}>
                      <Database className="text-blue-500" size={32} /> 2. Esquemas e Tabelas Focais
                    </h3>
                    <div className="space-y-10">
                      {currentData.esquemas.map((esq, idx) => (
                        <div key={idx}>
                          {esq.titulo && <h4 className={cn("font-black text-2xl mb-6", textHeading)}>{formatBold(esq.titulo)}</h4>}
                          <div className={cn("overflow-x-auto rounded-3xl border-2", theme === 'dark' ? 'border-slate-700' : 'border-slate-200')}>
                             <table className="table-auto w-full text-left min-w-[600px]">
                               <thead className={theme === 'dark' ? 'bg-slate-800/80 border-b-2 border-slate-700 text-slate-300' : 'bg-slate-100 border-b-2 border-slate-200 text-slate-700'}>
                                 <tr>
                                   {esq.headers.map((h, i) => <th key={i} className="p-6 font-black text-lg">{formatBold(h)}</th>)}
                                 </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                                 {esq.rows.map((row, rI) => (
                                   <tr key={rI} className={cn("transition-colors", theme === 'dark' ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50')}>
                                     {row.map((cell, cI) => <td key={cI} className="p-6 text-lg">{formatBold(cell)}</td>)}
                                   </tr>
                                 ))}
                               </tbody>
                             </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Card 3: Base Legal */}
                {currentData.baseLegal && currentData.baseLegal.length > 0 && (
                  <section className={cn("p-10 rounded-3xl border-t-[10px] border-yellow-500/80 transition-colors", bgCard)}>
                    <h3 className={cn("text-3xl font-black mb-8 flex items-center gap-4", textHeading)}>
                      <Scale className="text-yellow-500" size={32} /> 3. Base Legal Exaustiva
                    </h3>
                    <div className="space-y-10">
                      {currentData.baseLegal.map((lei, idx) => (
                        <div key={idx} className="space-y-6">
                          <div className={cn("p-8 rounded-2xl border-l-[8px]", theme === 'dark' ? 'bg-yellow-500/10 border-yellow-500/80' : 'bg-yellow-50/50 border-yellow-400')}>
                             <p className={cn("font-black text-2xl mb-4", theme === 'dark' ? 'text-yellow-400' : 'text-yellow-900')}>{formatBold(lei.artigo)}</p>
                             <p className={cn("leading-relaxed italic text-xl", theme === 'dark' ? 'text-slate-300' : 'text-slate-800')}>"{formatBold(lei.texto)}"</p>
                          </div>
                          <p className={cn("font-medium text-lg leading-relaxed px-2", textBody)}><strong className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>Comentário Feroz:</strong> {formatBold(lei.comentario)}</p>
                          {lei.feynman && (
                            <div className={cn("rounded-2xl p-6 border-2 mx-2", theme === 'dark' ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200')}>
                              <p className={cn("font-black flex items-center gap-2 mb-2 text-lg", theme === 'dark' ? 'text-emerald-400' : 'text-emerald-800')}>💡 Analogia / Feynman</p>
                              <p className={cn("italic text-lg font-medium", theme === 'dark' ? 'text-emerald-200' : 'text-emerald-900')}>"{formatBold(lei.feynman)}"</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Card 4: Jurisprudência */}
                {currentData.jurisprudencia && currentData.jurisprudencia.length > 0 && (
                  <section className={cn("p-10 rounded-3xl border-t-[10px] border-red-500 transition-colors", bgCard)}>
                    <h3 className={cn("text-3xl font-black mb-8 flex items-center gap-4", textHeading)}>
                      <AlertTriangle className="text-red-500" size={32} /> 4. Doutrina e Jurisprudência
                    </h3>
                    <div className="space-y-10">
                      {currentData.jurisprudencia.map((jur, idx) => (
                        <div key={idx} className="space-y-6">
                          <div className={cn("p-8 rounded-3xl border-2 relative overflow-hidden", theme === 'dark' ? 'bg-red-500/5 border-red-500/20' : 'bg-red-50 border-red-200')}>
                            <div className="absolute top-0 right-0 bg-red-600 text-white font-black text-sm px-6 py-2 pb-3 rounded-bl-3xl shadow-md tracking-wider uppercase">{jur.origem}</div>
                            <p className={cn("font-black text-2xl mt-4 mb-4", theme === 'dark' ? 'text-red-400' : 'text-red-900')}>{formatBold(jur.tese)}</p>
                            <p className={cn("leading-relaxed text-xl", theme === 'dark' ? 'text-red-200/80' : 'text-red-900/80')}>{formatBold(jur.texto)}</p>
                          </div>
                          {jur.feynman && (
                            <div className={cn("rounded-2xl p-6 border-2 mx-2", theme === 'dark' ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200')}>
                              <p className={cn("italic font-bold text-xl", theme === 'dark' ? 'text-emerald-300' : 'text-emerald-900')}>🎯 Entendimento Supremo: "{formatBold(jur.feynman)}"</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Card 5: Pegadinhas */}
                {currentData.pegadinhas && currentData.pegadinhas.length > 0 && (
                  <section className={cn("p-10 rounded-3xl border-t-[10px] border-orange-500 transition-colors", bgCard)}>
                    <h3 className={cn("text-3xl font-black mb-8 flex items-center gap-4", textHeading)}>
                      <Target className="text-orange-500" size={32} /> 5. Pegadinhas da Banca
                    </h3>
                    <ul className="space-y-6">
                      {currentData.pegadinhas.map((peg, idx) => (
                        <li key={idx} className={cn("flex items-start gap-5 p-6 rounded-2xl border-2", theme === 'dark' ? 'bg-orange-500/5 border-orange-500/10' : 'bg-orange-50 border-orange-100')}>
                          <span className="text-orange-500 font-bold block text-2xl">🚨</span>
                          <p className={cn("text-xl leading-relaxed font-medium", textBody)}>{formatBold(peg)}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Card 6: FAQ */}
                {currentData.faq && currentData.faq.length > 0 && (
                  <section className={cn("p-10 rounded-3xl border-t-[10px] border-cyan-500 transition-colors", bgCard)}>
                    <h3 className={cn("text-3xl font-black mb-8 flex items-center gap-4", textHeading)}>
                      <HelpCircle className="text-cyan-500" size={32} /> 6. FAQ
                    </h3>
                    <div className="space-y-6">
                      {currentData.faq.map((item, idx) => (
                        <div key={idx} className={cn("border-2 rounded-2xl p-8", theme === 'dark' ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-slate-50/50')}>
                          <p className={cn("font-black text-2xl mb-4", textHeading)}><span className="text-cyan-500 mr-2">Q.</span> {formatBold(item.pergunta)}</p>
                          <p className={cn("text-xl leading-relaxed", textBody)}><span className="text-cyan-600 dark:text-cyan-400 font-bold mr-2">R.</span> {formatBold(item.resposta)}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Card 7: Síntese */}
                {currentData.sintese && currentData.sintese.length > 0 && (
                  <section className={cn("p-10 rounded-3xl border-t-[10px] border-pink-500 transition-colors", bgCard)}>
                    <h3 className={cn("text-3xl font-black mb-8 flex items-center gap-4", textHeading)}>
                      <FileCheck className="text-pink-500" size={32} /> 7. Síntese 80/20
                    </h3>
                    <ul className="space-y-4">
                      {currentData.sintese.map((sint, idx) => (
                        <li key={idx} className="flex gap-4">
                          <span className="text-pink-500 font-black text-2xl mt-1">•</span>
                          <span className={cn("text-xl font-semibold leading-relaxed", textBody)}>{formatBold(sint)}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Card 8: Estudo Ativo */}
                {currentData.estudoAtivo && currentData.estudoAtivo.length > 0 && (
                  <section className={cn("p-10 rounded-3xl border-t-[10px] border-lime-500 transition-colors", bgCard)}>
                    <h3 className={cn("text-3xl font-black mb-8 flex items-center gap-4", textHeading)}>
                      <Lightbulb className="text-lime-500" size={32} /> 8. Estudo Ativo
                    </h3>
                    <div className="space-y-8">
                      {currentData.estudoAtivo.map((q, idx) => (
                        <div key={idx} className={cn("p-8 rounded-3xl border-2", theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200')}>
                          <p className={cn("font-black text-2xl mb-6 whitespace-pre-wrap leading-relaxed", textHeading)}>Questão {idx + 1}: {formatBold(q.enunciado)}</p>
                          <div className="space-y-4 mb-8 ml-2">
                            {q.alternativas.map((alt, ai) => (
                              <div key={ai} className={cn("flex gap-4 p-4 rounded-xl transition-colors", theme === 'dark' ? 'hover:bg-slate-700/50' : 'hover:bg-white border border-transparent hover:border-slate-200')}>
                                <span className="font-bold text-slate-500 text-lg uppercase">{['a','b','c','d','e'][ai]})</span> 
                                <span className={cn("text-xl", textBody)}>{formatBold(alt)}</span>
                              </div>
                            ))}
                          </div>
                          <details className={cn("border-2 rounded-2xl p-6 cursor-pointer focus:outline-none transition-colors", theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200')}>
                            <summary className={cn("font-black outline-none select-none text-xl flex items-center justify-between", textHeading)}>
                              Ver Gabarito 
                              <span className="text-lime-500 text-2xl">+</span>
                            </summary>
                            <div className={cn("mt-6 pt-6 border-t font-medium text-lg", theme === 'dark' ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-700')}>
                              <div className="inline-block px-4 py-2 bg-lime-500/20 text-lime-600 dark:text-lime-400 rounded-lg font-black text-xl mb-4 border border-lime-500/30">Gabarito: {q.gabarito}</div>
                              <p className="leading-relaxed">{formatBold(q.comentario)}</p>
                            </div>
                          </details>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
             </motion.div>
          ) : (
            selectedDiscipline && currentDisc && Object.keys(currentDisc.knowledgeData || {}).length === 0 && (
              <div className="text-center p-12 opacity-50 mt-10">
                <Brain size={64} className="mx-auto mb-4" />
                <p className="text-2xl font-bold">Esta disciplina ainda está oca.</p>
                <p>Alimente a máquina acima para preencher suas pastas/gavetas de conhecimento.</p>
              </div>
            )
          )}

        </div>
      </div>
    </motion.div>
  );
}
