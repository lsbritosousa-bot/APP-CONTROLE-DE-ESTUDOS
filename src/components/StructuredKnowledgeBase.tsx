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
  FolderOpen,
  Pencil
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

  const handleRenameDiscipline = async (id: string, currentName: string) => {
    if (!profile) return;
    const newName = window.prompt("Novo nome da disciplina:", currentName);
    if (!newName || newName.trim() === "" || newName === currentName) return;
    
    try {
      await updateDoc(doc(db, 'users', profile.uid, 'knowledge_disciplines', id), {
         name: newName.trim(),
         updatedAt: new Date().toISOString()
      });
    } catch(e) {
      alert("Erro ao renomear disciplina.");
    }
  };

  const handleRenameTopic = async (disciplineId: string, currentTopicName: string) => {
    if (!profile) return;
    const newTopicName = window.prompt("Novo nome do subtópico:", currentTopicName);
    if (!newTopicName || newTopicName.trim() === "" || newTopicName === currentTopicName) return;
    
    try {
      const disc = disciplines.find(d => d.id === disciplineId);
      if (!disc) return;
      
      const updatedKnowledgeData = { ...(disc.knowledgeData || {}) };
      const topicData = updatedKnowledgeData[currentTopicName];
      
      updatedKnowledgeData[newTopicName.trim()] = topicData;
      delete updatedKnowledgeData[currentTopicName];

      await updateDoc(doc(db, 'users', profile.uid, 'knowledge_disciplines', disciplineId), {
         knowledgeData: updatedKnowledgeData,
         updatedAt: new Date().toISOString()
      });

      if (selectedTopic === currentTopicName) {
         setSelectedTopic(newTopicName.trim());
      }
    } catch(e) {
      alert("Erro ao renomear subtópico.");
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
        const content = part.slice(2, -2);
        const isExample = content.toUpperCase().includes('EXEMPLO');
        
        return (
          <strong key={i} className={cn(
            "font-black mx-1",
            isExample 
              ? theme === 'dark' ? "text-[#ef4444]" : "text-[#CB1C25]"
              : theme === 'dark' ? "text-indigo-200" : "text-[#1B365D]"
          )}>
            {content}
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
                            "w-full text-left pl-5 pr-[5.5rem] py-4 rounded-2xl transition-all flex justify-between items-center text-lg font-black border-2",
                            isDiscSelected 
                              ? theme === 'dark' ? "bg-slate-800 border-indigo-500 text-indigo-400" : "bg-indigo-50 border-indigo-200 text-indigo-900" 
                              : theme === 'dark' ? "bg-slate-800/50 border-slate-700/50 hover:bg-slate-700 text-slate-300" : "bg-slate-50 border-slate-100 hover:bg-slate-100 text-slate-700"
                          )}
                        >
                          <span className="truncate">{disc.name}</span>
                          <ChevronDown size={20} className={cn("flex-shrink-0 transition-transform", isDiscSelected ? "rotate-180" : "")} />
                        </button>
                        <button 
                          onClick={() => handleDeleteDiscipline(disc.id, disc.name)}
                          className="text-red-500/50 hover:text-red-500 hover:bg-red-500/10 p-3 rounded-xl absolute right-1 top-1 hidden group-hover:flex items-center bottom-1 transition-colors backdrop-blur-md"
                          title="Apagar Disciplina"
                        >
                           <Trash2 size={20} />
                        </button>
                        <button 
                          onClick={() => handleRenameDiscipline(disc.id, disc.name)}
                          className="text-indigo-500/50 hover:text-indigo-500 hover:bg-indigo-500/10 p-3 rounded-xl absolute right-11 top-1 hidden group-hover:flex items-center bottom-1 transition-colors backdrop-blur-md"
                          title="Renomear Disciplina"
                        >
                           <Pencil size={20} />
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
                                       "w-full text-left pl-4 pr-[5.5rem] py-3 rounded-xl transition-all flex items-center gap-3 text-base font-bold",
                                       selectedTopic === topic
                                        ? "bg-indigo-600 text-white shadow-md"
                                        : theme === 'dark' ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-slate-100 border border-transparent hover:border-slate-200"
                                     )}
                                   >
                                     <FolderOpen size={16} className="flex-shrink-0" /> 
                                     <span className="truncate">{topic}</span>
                                   </button>
                                   <button 
                                     onClick={(e) => { e.stopPropagation(); handleDeleteTopic(disc.id, topic); }}
                                     className="text-red-500/30 hover:text-red-500 hover:bg-red-500/10 p-2 rounded-lg absolute right-1 top-1 hidden group-hover:flex items-center bottom-1 transition-colors"
                                     title="Apagar Subtópico"
                                   >
                                      <Trash2 size={16} />
                                   </button>
                                   <button 
                                     onClick={(e) => { e.stopPropagation(); handleRenameTopic(disc.id, topic); }}
                                     className="text-indigo-500/40 hover:text-indigo-500 hover:bg-indigo-500/10 p-2 rounded-lg absolute right-9 top-1 hidden group-hover:flex items-center bottom-1 transition-colors"
                                     title="Renomear Subtópico"
                                   >
                                      <Pencil size={16} />
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
               className={cn(
                 "p-8 md:p-14 lg:p-20 rounded-md shadow-2xl transition-colors md:mx-auto max-w-5xl text-lg leading-loose space-y-12",
                 theme === 'dark' ? 'bg-[#0f172a] shadow-black/50 text-[#CBD5E1]' : 'bg-white shadow-slate-300 text-[#1B365D]'
               )}
             >
                <header className="border-b-2 pb-6 mb-12 flex items-center justify-between" style={{ borderColor: theme === 'dark' ? '#334155' : '#E2E8F0' }}>
                   <h2 className={cn("text-3xl font-black uppercase tracking-widest", theme === 'dark' ? 'text-[#EF4444]' : 'text-[#CB1C25]')}>
                     {selectedTopic}
                   </h2>
                </header>

                {/* 1. Visão Geral */}
                <section className="space-y-6">
                  <h3 className={cn("text-2xl font-black mb-6 uppercase tracking-wider", theme === 'dark' ? 'text-[#EF4444]' : 'text-[#CB1C25]')}>
                    1. Fichas de Identificação
                  </h3>

                  {currentData.alertasEspeciais && currentData.alertasEspeciais.length > 0 && (
                    <div className="space-y-4 mb-8">
                       {currentData.alertasEspeciais.map((alerta, i) => (
                         <div key={i} className="flex gap-4 items-start bg-yellow-500/10 p-6 rounded-sm border-l-4 border-yellow-500">
                           <AlertTriangle className="flex-shrink-0 text-yellow-500 mt-1" size={28} />
                           <div>
                             <span className="font-extrabold text-lg block mb-1 uppercase text-yellow-600 dark:text-yellow-500">{alerta.tipo}</span>
                             <p className="font-medium text-lg text-yellow-800 dark:text-yellow-200 leading-relaxed">{formatBold(alerta.texto)}</p>
                           </div>
                         </div>
                       ))}
                    </div>
                  )}

                  <div className="space-y-6">
                    {currentData.visaoGeral.fichas && currentData.visaoGeral.fichas.length > 0 ? (
                       <ul className="list-disc ml-6 space-y-4 marker:text-[#1B365D] dark:marker:text-slate-400">
                         {currentData.visaoGeral.fichas.map((ficha, i) => (
                            <li key={i} className="pl-2">
                               <span className={cn("font-black mr-2", theme === 'dark' ? 'text-indigo-400' : 'text-[#1B365D]')}>{formatBold(ficha.titulo)}:</span>
                               <span>{formatBold(ficha.definicaoCurta)}</span>
                            </li>
                         ))}
                       </ul>
                    ) : (
                      <p className="whitespace-pre-wrap text-justify">
                         {formatBold(currentData.visaoGeral.textoDenso || '')}
                      </p>
                    )}

                    {currentData.visaoGeral.divergencias && (
                       <div className="mt-8 pl-6 border-l-4 border-slate-300 dark:border-slate-600 ml-2">
                         <p className="font-black mb-2 italic">Divergências Doutrinárias/Jurisprudenciais:</p>
                         <p className="text-justify">{formatBold(currentData.visaoGeral.divergencias)}</p>
                       </div>
                    )}
                    
                    {currentData.visaoGeral.feynman && (
                      <div className="mt-8 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-sm">
                        <p className="font-black flex items-center gap-2 mb-3 text-yellow-600 dark:text-yellow-500">
                          <Lightbulb size={24} /> Método de Feynman
                        </p>
                        <p className="italic text-justify">"{formatBold(currentData.visaoGeral.feynman)}"</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Mnemônicos Mágicos */}
                {currentData.mnemonicos && currentData.mnemonicos.length > 0 && (
                  <section className="space-y-6">
                     <h3 className={cn("text-2xl font-black mb-6 uppercase tracking-wider", theme === 'dark' ? 'text-[#EF4444]' : 'text-[#CB1C25]')}>
                       Mnemônicos Mágicos
                     </h3>
                     <div className="space-y-8">
                       {currentData.mnemonicos.map((m, i) => (
                          <div key={i} className="pl-6 border-l-2 border-slate-200 dark:border-slate-700">
                            <h4 className="text-3xl font-black mb-2 tracking-widest flex items-center gap-3">
                               <Brain size={28} className={theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'} /> {m.acronimo}
                            </h4>
                            <div className="font-bold mb-4 italic opacity-80">
                               "{m.fraseAtivadora}"
                            </div>
                            <ul className="list-disc ml-6 space-y-2 marker:text-[#1B365D] dark:marker:text-slate-400">
                               {m.significado.split(/[,;]/).map((item, idx) => (
                                 <li key={idx} className="pl-2">
                                    {formatBold(item.trim())}
                                 </li>
                               ))}
                            </ul>
                          </div>
                       ))}
                     </div>
                  </section>
                )}

                {/* 2. Esquemas Organizados */}
                {currentData.esquemas && currentData.esquemas.length > 0 && (
                  <section className="space-y-6">
                    <h3 className={cn("text-2xl font-black mb-6 uppercase tracking-wider", theme === 'dark' ? 'text-[#EF4444]' : 'text-[#CB1C25]')}>
                      2. Esquemas Organizados
                    </h3>
                    <div className="space-y-10">
                      {currentData.esquemas.map((esq, idx) => (
                        <div key={idx}>
                          {esq.titulo && <h4 className="font-black text-xl mb-4 underline decoration-2 underline-offset-4 decoration-slate-300">{formatBold(esq.titulo)}</h4>}
                          
                          {esq.hierarquia && esq.hierarquia.length > 0 ? (
                             <div className="space-y-6">
                               {esq.hierarquia.map((h, i) => (
                                  <div key={i} className="pl-4">
                                     <div className="font-black text-xl mb-2 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-current" />
                                        {formatBold(h.pai)}
                                     </div>
                                     <ul className="list-disc ml-10 space-y-2 border-l border-slate-200 dark:border-slate-700 pl-4 py-2 marker:text-[#1B365D] dark:marker:text-slate-400">
                                        {h.filhos.map((filho, fIdx) => (
                                           <li key={fIdx}>
                                              {formatBold(filho)}
                                           </li>
                                        ))}
                                     </ul>
                                  </div>
                               ))}
                             </div>
                          ) : (
                            esq.headers && esq.rows && (
                              <div className="overflow-x-auto my-6">
                                 <table className="table-auto w-full text-left border-collapse">
                                   <thead>
                                     <tr>
                                       {esq.headers.map((h, i) => <th key={i} className="p-4 border-b-2 border-slate-300 dark:border-slate-600 font-black">{formatBold(h)}</th>)}
                                     </tr>
                                   </thead>
                                   <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                                     {esq.rows.map((row, rI) => (
                                       <tr key={rI}>
                                         {row.map((cell, cI) => <td key={cI} className="p-4 align-top">{formatBold(cell)}</td>)}
                                       </tr>
                                     ))}
                                   </tbody>
                                 </table>
                              </div>
                            )
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 3. Base Legal Exaustiva */}
                {currentData.baseLegal && currentData.baseLegal.length > 0 && (
                  <section className="space-y-6">
                    <h3 className={cn("text-2xl font-black mb-6 uppercase tracking-wider", theme === 'dark' ? 'text-[#EF4444]' : 'text-[#CB1C25]')}>
                      3. Base Legal Exaustiva
                    </h3>
                    <div className="space-y-10">
                      {currentData.baseLegal.map((lei, idx) => (
                        <div key={idx} className="space-y-4">
                           <p className={cn("font-black text-xl", theme === 'dark' ? 'text-indigo-400' : 'text-[#1B365D]')}>{formatBold(lei.artigo)}</p>
                           <p className="leading-relaxed italic text-justify opacity-90 pl-6 border-l-2 border-slate-300 dark:border-slate-600">"{formatBold(lei.texto)}"</p>
                           <p className="font-medium text-justify mt-4"><strong className="font-black">Comentário Feroz:</strong> {formatBold(lei.comentario)}</p>
                           {lei.feynman && (
                              <p className="italic text-justify text-indigo-700 dark:text-indigo-300 mt-2 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-sm">
                                <span className="font-bold text-lg mr-2">🎯 Analóga:</span> "{formatBold(lei.feynman)}"
                              </p>
                           )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 4. Doutrina e Jurisprudência */}
                {currentData.jurisprudencia && currentData.jurisprudencia.length > 0 && (
                  <section className="space-y-6">
                    <h3 className={cn("text-2xl font-black mb-6 uppercase tracking-wider", theme === 'dark' ? 'text-[#EF4444]' : 'text-[#CB1C25]')}>
                      4. Doutrina e Jurisprudência
                    </h3>
                    <div className="space-y-10">
                      {currentData.jurisprudencia.map((jur, idx) => (
                        <div key={idx} className="space-y-4">
                          <div className="flex items-center gap-3">
                             <span className={cn("font-black text-sm px-3 py-1 bg-slate-200 dark:bg-slate-700 uppercase tracking-widest rounded-sm text-[#1B365D] dark:text-slate-200")}>{jur.origem}</span>
                             <p className={cn("font-black text-xl")}>{formatBold(jur.tese)}</p>
                          </div>
                          <p className="leading-relaxed text-justify opacity-90">{formatBold(jur.texto)}</p>
                          {jur.feynman && (
                             <p className="italic text-justify font-medium pt-2 pl-4 border-l-2 border-slate-300 dark:border-slate-600">
                               "Entendimento: {formatBold(jur.feynman)}"
                             </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 5. Pegadinhas da Banca */}
                {currentData.pegadinhas && currentData.pegadinhas.length > 0 && (
                  <section className="space-y-6">
                    <h3 className={cn("text-2xl font-black mb-6 uppercase tracking-wider", theme === 'dark' ? 'text-[#EF4444]' : 'text-[#CB1C25]')}>
                      5. Pegadinhas da Banca
                    </h3>
                    <ul className="list-none space-y-4 ml-2">
                      {currentData.pegadinhas.map((peg, idx) => (
                        <li key={idx} className="flex items-start gap-4 p-4 bg-orange-50 dark:bg-orange-950/20 rounded-sm">
                          <span className="text-xl">🚨</span>
                          <p className="font-medium text-justify text-orange-900 dark:text-orange-200">{formatBold(peg)}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* 6. FAQ */}
                {currentData.faq && currentData.faq.length > 0 && (
                  <section className="space-y-6">
                    <h3 className={cn("text-2xl font-black mb-6 uppercase tracking-wider", theme === 'dark' ? 'text-[#EF4444]' : 'text-[#CB1C25]')}>
                      6. FAQ
                    </h3>
                    <div className="space-y-6">
                      {currentData.faq.map((item, idx) => (
                        <div key={idx} className="space-y-2">
                          <p className="font-black text-lg"><span className={cn("mr-2", theme === 'dark' ? 'text-[#EF4444]' : 'text-[#CB1C25]')}>Q.</span> {formatBold(item.pergunta)}</p>
                          <p className="text-justify"><span className="font-bold mr-2 opacity-60">R.</span> {formatBold(item.resposta)}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 7. Síntese 80/20 */}
                {currentData.sintese && currentData.sintese.length > 0 && (
                  <section className="space-y-6">
                    <h3 className={cn("text-2xl font-black mb-6 uppercase tracking-wider", theme === 'dark' ? 'text-[#EF4444]' : 'text-[#CB1C25]')}>
                      7. Síntese 80/20
                    </h3>
                    <ul className="list-disc ml-6 space-y-4 marker:text-[#1B365D] dark:marker:text-slate-400">
                      {currentData.sintese.map((sint, idx) => (
                        <li key={idx} className="pl-2">
                          <span className="font-medium text-justify">{formatBold(sint)}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* 8. Estudo Ativo */}
                {currentData.estudoAtivo && currentData.estudoAtivo.length > 0 && (
                  <section className="space-y-6">
                    <h3 className={cn("text-2xl font-black mb-6 uppercase tracking-wider", theme === 'dark' ? 'text-[#EF4444]' : 'text-[#CB1C25]')}>
                      8. Estudo Ativo
                    </h3>
                    <div className="space-y-12">
                      {currentData.estudoAtivo.map((q, idx) => (
                        <div key={idx} className="space-y-6">
                          <p className="font-black text-xl text-justify">Questão {idx + 1}: <span className="font-medium">{formatBold(q.enunciado)}</span></p>
                          <div className="space-y-3 ml-4">
                            {q.alternativas.map((alt, ai) => (
                              <div key={ai} className="flex gap-4">
                                <span className="font-bold opacity-60 uppercase w-6">{['a','b','c','d','e'][ai]})</span> 
                                <span className="text-justify">{formatBold(alt)}</span>
                              </div>
                            ))}
                          </div>
                          <details className="mt-4 outline-none group border-t border-slate-200 dark:border-slate-700 pt-4">
                            <summary className="font-black cursor-pointer text-lg opacity-80 hover:opacity-100 flex items-center gap-2 w-max">
                              Ver Gabarito <ChevronDown size={20} className="group-open:rotate-180 transition-transform"/>
                            </summary>
                            <div className="mt-6">
                              <div className={cn("inline-block px-4 py-1 font-black mb-4 rounded-sm tracking-widest", theme === 'dark' ? 'bg-[#EF4444]/20 text-[#EF4444]' : 'bg-[#CB1C25]/10 text-[#CB1C25]')}>
                                GABARITO: {q.gabarito}
                              </div>
                              <p className="text-justify leading-relaxed">{formatBold(q.comentario)}</p>
                            </div>
                          </details>
                        </div>
                      ))}
                    </div>
                )}

                {/* PILARES 1 A 9 - DOUTRINADOR JURÍDICO SÊNIOR */}
                {currentData.nucleoEssencial && currentData.nucleoEssencial.fichas && currentData.nucleoEssencial.fichas.length > 0 && (
                  <section className="space-y-8 mt-16 border-t-2 pt-16" style={{ borderColor: theme === 'dark' ? '#334155' : '#E2E8F0' }}>
                     <h3 className={cn("text-3xl font-black mb-8 uppercase tracking-widest flex items-center gap-3 border-b-4 pb-4 w-max", theme === 'dark' ? 'text-indigo-400 border-indigo-500' : 'text-indigo-900 border-indigo-900')}>
                       <Target size={32} /> 1. Núcleo Essencial (Pareto 80/20)
                     </h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       {currentData.nucleoEssencial.fichas.map((ficha, i) => (
                          <div key={i} className={cn("p-6 rounded-2xl border-l-4 shadow-sm", theme === 'dark' ? 'bg-slate-800/50 border-indigo-500' : 'bg-slate-50 border-indigo-900')}>
                             <h4 className={cn("font-black text-xl mb-3", theme === 'dark' ? 'text-indigo-300' : 'text-indigo-800')}>{formatBold(ficha.titulo)}</h4>
                             <p className="text-justify leading-relaxed">{formatBold(ficha.definicaoCurta)}</p>
                          </div>
                       ))}
                     </div>
                  </section>
                )}

                {currentData.analiseDoutrinaria && (
                  <section className="space-y-8 mt-16">
                     <h3 className={cn("text-3xl font-black mb-8 uppercase tracking-widest flex items-center gap-3 border-b-4 pb-4 w-max", theme === 'dark' ? 'text-indigo-400 border-indigo-500' : 'text-indigo-900 border-indigo-900')}>
                       <Library size={32} /> 2. Análise Doutrinária Profunda
                     </h3>
                     <div className="space-y-6 text-justify leading-loose text-xl">
                       <p>{formatBold(currentData.analiseDoutrinaria.texto)}</p>
                       <div className={cn("mt-8 p-8 rounded-2xl border-2 italic shadow-inner", theme === 'dark' ? 'bg-slate-800/30 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700')}>
                         <strong className="font-black text-2xl mb-4 block normal-case not-italic flex items-center gap-2"><Brain className="text-indigo-500" /> Divergências e Reflexões:</strong>
                         {formatBold(currentData.analiseDoutrinaria.divergencias)}
                       </div>
                     </div>
                  </section>
                )}

                {currentData.quadrosSinoticos && currentData.quadrosSinoticos.length > 0 && (
                  <section className="space-y-8 mt-16">
                     <h3 className={cn("text-3xl font-black mb-8 uppercase tracking-widest flex items-center gap-3 border-b-4 pb-4 w-max", theme === 'dark' ? 'text-indigo-400 border-indigo-500' : 'text-indigo-900 border-indigo-900')}>
                       <Scale size={32} /> 3. Quadros Sinóticos Comparativos
                     </h3>
                     <div className="space-y-12">
                       {currentData.quadrosSinoticos.map((quadro, i) => (
                          <div key={i} className="overflow-hidden rounded-2xl border-2 shadow-lg" style={{ borderColor: theme === 'dark' ? '#334155' : '#E2E8F0' }}>
                             <div className={cn("p-4 font-black text-xl text-center uppercase tracking-widest", theme === 'dark' ? 'bg-slate-800 text-indigo-300' : 'bg-slate-100 text-indigo-900')}>
                               {formatBold(quadro.titulo)}
                             </div>
                             <div className="overflow-x-auto">
                                <table className="table-auto w-full text-left border-collapse">
                                   <thead>
                                     <tr>
                                       {quadro.comparativo.headers.map((h, hi) => <th key={hi} className={cn("p-5 border-b-2 font-black text-lg", theme === 'dark' ? 'border-slate-700 bg-slate-900/50 text-slate-300' : 'border-slate-300 bg-white text-slate-800')}>{formatBold(h)}</th>)}
                                     </tr>
                                   </thead>
                                   <tbody className={cn("divide-y", theme === 'dark' ? 'divide-slate-700/50 bg-slate-800/20' : 'divide-slate-200 bg-white')}>
                                      {quadro.comparativo.rows.map((row, ri) => (
                                         <tr key={ri} className="hover:bg-slate-500/5 transition-colors">
                                            {row.map((cell, ci) => <td key={ci} className="p-5 align-top leading-relaxed">{formatBold(cell)}</td>)}
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

                {currentData.literalidadeBaseLegal && currentData.literalidadeBaseLegal.length > 0 && (
                   <section className="space-y-8 mt-16">
                     <h3 className={cn("text-3xl font-black mb-8 uppercase tracking-widest flex items-center gap-3 border-b-4 pb-4 w-max", theme === 'dark' ? 'text-indigo-400 border-indigo-500' : 'text-indigo-900 border-indigo-900')}>
                       <FileCheck size={32} /> 4. Literalidade e Base Legal
                     </h3>
                     <div className="space-y-10">
                        {currentData.literalidadeBaseLegal.map((lei, idx) => (
                          <div key={idx} className="space-y-4">
                             <h4 className={cn("font-black text-2xl flex items-center gap-3", theme === 'dark' ? 'text-slate-200' : 'text-[#1B365D]')}><div className="w-4 h-4 rounded-md bg-indigo-500"></div>{formatBold(lei.artigo)}</h4>
                             <p className="leading-relaxed text-justify pl-8 border-l-4 text-xl border-slate-300 dark:border-slate-600 font-serif italic text-slate-600 dark:text-slate-400">"{formatBold(lei.texto)}"</p>
                             <div className={cn("p-6 mt-4 rounded-xl ml-8 shadow-sm flex gap-4 items-start", theme === 'dark' ? 'bg-[#1E293B] border border-slate-700 text-indigo-200' : 'bg-slate-50 border border-slate-200 text-indigo-900')}>
                                <Brain size={28} className="shrink-0 mt-1 opacity-50" />
                                <div>
                                  <strong className="font-black text-lg block mb-1 uppercase tracking-wide opacity-70">Comentário do Doutrinador:</strong>
                                  <p className="text-justify font-medium">{formatBold(lei.comentario)}</p>
                                </div>
                             </div>
                          </div>
                        ))}
                     </div>
                   </section>
                )}

                {currentData.jurisprudenciaSumulas && currentData.jurisprudenciaSumulas.length > 0 && (
                   <section className="space-y-8 mt-16">
                     <h3 className={cn("text-3xl font-black mb-8 uppercase tracking-widest flex items-center gap-3 border-b-4 pb-4 w-max", theme === 'dark' ? 'text-indigo-400 border-indigo-500' : 'text-indigo-900 border-indigo-900')}>
                       <Scale size={32} /> 5. Jurisprudência e Súmulas
                     </h3>
                     <div className="grid grid-cols-1 gap-8">
                        {currentData.jurisprudenciaSumulas.map((jur, idx) => (
                           <div key={idx} className={cn("p-8 rounded-2xl relative overflow-hidden shadow-md", theme === 'dark' ? 'bg-slate-800/40 border border-slate-700' : 'bg-white border border-slate-200')}>
                              <div className={cn("absolute top-0 right-0 px-4 py-2 text-sm font-black uppercase tracking-widest rounded-bl-2xl", theme === 'dark' ? 'bg-slate-700 text-indigo-300' : 'bg-slate-200 text-indigo-900')}>{jur.origem}</div>
                              <h4 className={cn("font-black text-2xl mb-4 pr-24 leading-tight", theme === 'dark' ? 'text-slate-100' : 'text-slate-900')}>{formatBold(jur.tese)}</h4>
                              <p className="leading-relaxed text-justify text-lg opacity-90">{formatBold(jur.texto)}</p>
                           </div>
                        ))}
                     </div>
                   </section>
                )}

                {currentData.puloDoGatoPegadinhas && currentData.puloDoGatoPegadinhas.length > 0 && (
                   <section className="space-y-8 mt-16">
                     <h3 className={cn("text-3xl font-black mb-8 uppercase tracking-widest flex items-center gap-3 border-b-4 pb-4 w-max", theme === 'dark' ? 'text-orange-500 border-orange-500' : 'text-orange-600 border-orange-600')}>
                       <AlertTriangle size={32} /> 6. O "Pulo do Gato"
                     </h3>
                     <div className="space-y-6">
                        {currentData.puloDoGatoPegadinhas.map((peg, idx) => (
                           <div key={idx} className={cn("flex gap-6 items-start p-6 md:p-8 rounded-2xl border-l-8 shadow-md", theme === 'dark' ? 'bg-orange-950/20 border-orange-500' : 'bg-orange-50 border-orange-500')}>
                              <AlertTriangle className="shrink-0 text-orange-500 mt-1" size={36} />
                              <div>
                                <span className={cn("font-black text-xl block mb-2 uppercase tracking-wide", theme === 'dark' ? 'text-orange-400' : 'text-orange-700')}>{peg.tipo}</span>
                                <p className={cn("font-medium text-xl leading-relaxed text-justify", theme === 'dark' ? 'text-orange-200' : 'text-orange-900')}>{formatBold(peg.texto)}</p>
                              </div>
                           </div>
                        ))}
                     </div>
                   </section>
                )}

                {currentData.metodoFeynman && currentData.metodoFeynman.length > 0 && (
                   <section className="space-y-8 mt-16">
                     <h3 className={cn("text-3xl font-black mb-8 uppercase tracking-widest flex items-center gap-3 border-b-4 pb-4 w-max", theme === 'dark' ? 'text-yellow-400 border-yellow-500' : 'text-yellow-600 border-yellow-600')}>
                       <Lightbulb size={32} /> 7. Método de Feynman
                     </h3>
                     <div className="grid grid-cols-1 gap-8">
                        {currentData.metodoFeynman.map((fey, idx) => (
                           <div key={idx} className={cn("p-8 rounded-3xl border-4 relative", theme === 'dark' ? 'bg-slate-900 border-yellow-500/30' : 'bg-white border-yellow-400')}>
                              <Lightbulb size={40} className="absolute -top-6 -left-6 text-yellow-500 bg-page rounded-full p-1" />
                              <h4 className="font-black text-2xl mb-4 text-yellow-700 dark:text-yellow-500 ml-4">{formatBold(fey.conceito)}</h4>
                              <p className="italic text-xl text-justify leading-relaxed ml-4 opacity-90 border-l-4 border-yellow-400 pl-4">"{formatBold(fey.analogiaSimplificada)}"</p>
                           </div>
                        ))}
                     </div>
                   </section>
                )}

                {currentData.questoesFixacao && currentData.questoesFixacao.length > 0 && (
                   <section className="space-y-8 mt-16">
                     <h3 className={cn("text-3xl font-black mb-8 uppercase tracking-widest flex items-center gap-3 border-b-4 pb-4 w-max", theme === 'dark' ? 'text-indigo-400 border-indigo-500' : 'text-indigo-900 border-indigo-900')}>
                       <Target size={32} /> 8. Questões de Alto Nível
                     </h3>
                     <div className="space-y-12">
                       {currentData.questoesFixacao.map((q, idx) => (
                         <div key={idx} className={cn("p-8 md:p-10 rounded-3xl border shadow-lg", theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200')}>
                           <p className="font-black text-2xl mb-8 leading-relaxed text-justify flex items-start gap-4">
                             <span className="shrink-0 w-12 h-12 flex items-center justify-center bg-indigo-500 text-white rounded-xl text-xl">Q{idx + 1}</span> 
                             <span className="mt-2">{formatBold(q.enunciado)}</span>
                           </p>
                           <div className="space-y-4 ml-0 md:ml-16 mb-8 text-xl">
                             {q.alternativas.map((alt, ai) => (
                               <div key={ai} className={cn("flex gap-4 p-4 rounded-xl border-2 transition-colors cursor-crosshair", theme === 'dark' ? 'border-slate-800 hover:border-slate-600 hover:bg-slate-800' : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50')}>
                                 <span className="font-black opacity-40 uppercase w-8 text-center shrink-0">{['a','b','c','d','e'][ai]})</span> 
                                 <span className="text-justify font-medium">{formatBold(alt)}</span>
                               </div>
                             ))}
                           </div>
                           <details className="outline-none group mt-10 md:ml-16">
                             <summary className="font-black cursor-pointer text-xl flex items-center justify-center p-5 rounded-2xl gap-3 w-full text-center transition-colors bg-indigo-500 text-white hover:bg-indigo-600 shadow-xl shadow-indigo-500/20">
                               Exibir Resolução do Doutrinador <ChevronDown size={28} className="group-open:rotate-180 transition-transform"/>
                             </summary>
                             <div className="mt-6 p-8 rounded-3xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50">
                               <div className="inline-block px-6 py-2 font-black mb-6 rounded-xl tracking-widest bg-indigo-600 text-white text-xl shadow-sm">
                                 GABARITO: {q.gabarito}
                               </div>
                               <p className="text-justify leading-relaxed text-xl">{formatBold(q.comentario)}</p>
                             </div>
                           </details>
                         </div>
                       ))}
                     </div>
                   </section>
                )}

                {currentData.planoRevisao && currentData.planoRevisao.length > 0 && (
                   <section className="space-y-8 mt-16 bg-gradient-to-br from-slate-900 to-[#1B365D] text-white p-10 md:p-14 rounded-3xl shadow-2xl relative overflow-hidden">
                     <div className="absolute -bottom-10 -right-10 opacity-10">
                       <Brain size={300} />
                     </div>
                     <h3 className="text-3xl font-black mb-10 uppercase tracking-widest flex items-center gap-3 pb-4 border-b-4 border-indigo-400 w-max relative z-10 text-indigo-300">
                       <Database size={32} /> 9. Plano de Revisão Ativa
                     </h3>
                     <ul className="list-disc ml-8 space-y-6 marker:text-indigo-400 relative z-10 text-xl text-slate-200">
                       {currentData.planoRevisao.map((rev, idx) => (
                         <li key={idx} className="pl-4">
                           <span className="font-medium leading-relaxed text-justify">{formatBold(rev)}</span>
                         </li>
                       ))}
                     </ul>
                   </section>
                )}

                {/* Fake Footer / Página */}
                <footer className="pt-16 pb-4 mt-16 border-t-2 flex flex-col items-center justify-center gap-4 opacity-70 border-slate-200 dark:border-slate-700 select-none">
                   <div className="w-12 h-12 rounded-full flex items-center justify-center font-black text-white bg-[#F2C94C] shadow-md text-[#1B365D] dark:text-[#1B365D]">1</div>
                   <span className="text-sm font-black tracking-widest uppercase">Mapeamento Finalizado</span>
                </footer>
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
