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
    const parts = text.split(/(\**.*?\**)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const content = part.slice(2, -2);
        const isExample = content.toUpperCase().includes('EXEMPLO');
        
        return (
          <strong key={i} className={cn(
            "font-black mx-1 inline-block",
            isExample 
              ? "text-[#F87171] bg-red-500/10 px-2 rounded" 
              : "text-indigo-300 bg-indigo-500/10 px-2 rounded"
          )}>
            {content}
          </strong>
        );
      }
      return part;
    });
  };
\nconst currentDisc = disciplines.find(d => d.id === selectedDiscipline);
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
                className="p-8 md:p-14 lg:p-20 rounded-[2.5rem] shadow-2xl transition-all duration-500 md:mx-auto max-w-5xl text-lg leading-loose space-y-16 border border-slate-800/80 bg-[#0B1121] shadow-[0_20px_60px_rgba(0,0,0,0.6)] text-slate-300"
              >
                 <header className="border-b border-slate-800 pb-10 mb-16 flex items-center justify-between">
                    <h2 className="text-4xl md:text-5xl font-black uppercase tracking-widest text-[#818CF8] flex items-center gap-4">
                      <Brain size={48} className="text-[#818CF8] opacity-80"/>
                      {selectedTopic}
                    </h2>
                 </header>

                 {/* 1. Visão Geral */}
                 <section className="space-y-8 bg-[#0F172A] p-8 md:p-10 rounded-3xl border border-slate-800/80">
                   <h3 className="text-2xl font-black mb-8 uppercase tracking-wider text-rose-500 flex items-center gap-3">
                     <Target size={28} /> 1. Fichas de Identificação
                   </h3>

                   {currentData.alertasEspeciais && currentData.alertasEspeciais.length > 0 && (
                     <div className="space-y-6 mb-8">
                        {currentData.alertasEspeciais.map((alerta: any, i: number) => (
                          <div key={i} className="flex gap-5 items-start bg-yellow-500/10 p-8 rounded-2xl border-l-4 border-yellow-500 backdrop-blur-md shadow-lg shadow-yellow-500/5">
                            <AlertTriangle className="flex-shrink-0 text-yellow-500 mt-1" size={32} />
                            <div>
                              <span className="font-extrabold text-xl block mb-2 uppercase text-yellow-500 tracking-wide">{alerta.tipo}</span>
                              <p className="font-medium text-lg text-yellow-100 leading-relaxed">{formatBold(alerta.texto)}</p>
                            </div>
                          </div>
                        ))}
                     </div>
                   )}

                   <div className="space-y-8">
                     {currentData.visaoGeral.fichas && currentData.visaoGeral.fichas.length > 0 ? (
                        <ul className="list-disc ml-8 space-y-6 marker:text-[#818CF8] marker:text-xl">
                          {currentData.visaoGeral.fichas.map((ficha: any, i: number) => (
                             <li key={i} className="pl-4">
                                <span className="font-black mr-3 text-indigo-300 text-xl">{formatBold(ficha.titulo)}:</span>
                                <span className="text-slate-200">{formatBold(ficha.definicaoCurta)}</span>
                             </li>
                          ))}
                        </ul>
                     ) : (
                       <p className="whitespace-pre-wrap text-justify text-slate-300 text-xl leading-relaxed">
                          {formatBold(currentData.visaoGeral.textoDenso || '')}
                       </p>
                     )}

                     {currentData.visaoGeral.divergencias && (
                        <div className="mt-10 p-8 bg-[#1E293B] rounded-2xl border-l-4 border-slate-500 shadow-inner">
                          <p className="font-black mb-3 italic flex items-center gap-2 text-slate-200 text-xl"><Brain className="text-slate-400"/> Divergências Doutrinárias/Jurisprudenciais:</p>
                          <p className="text-justify text-slate-400 leading-relaxed text-lg">{formatBold(currentData.visaoGeral.divergencias)}</p>
                        </div>
                     )}
                     
                     {currentData.visaoGeral.feynman && (
                       <div className="mt-10 p-8 bg-yellow-950/20 rounded-2xl border border-yellow-900/40">
                         <p className="font-black flex items-center gap-3 mb-4 text-yellow-500 text-xl">
                           <Lightbulb size={28} /> Método de Feynman
                         </p>
                         <p className="italic text-justify text-yellow-100/90 leading-relaxed text-lg border-l-2 border-yellow-700/50 pl-6">"{formatBold(currentData.visaoGeral.feynman)}"</p>
                       </div>
                     )}
                   </div>
                 </section>

                 {/* Mnemônicos Mágicos */}
                 {currentData.mnemonicos && currentData.mnemonicos.length > 0 && (
                   <section className="space-y-8 p-8 md:p-10 bg-[#064E3B]/20 rounded-3xl border border-[#064E3B]/40">
                      <h3 className="text-2xl font-black mb-8 uppercase tracking-wider text-emerald-400 flex items-center gap-3">
                        <Brain size={28} /> Mnemônicos Mágicos
                      </h3>
                      <div className="space-y-12">
                        {currentData.mnemonicos.map((m: any, i: number) => (
                           <div key={i} className="p-8 bg-[#022C22]/40 rounded-2xl border border-emerald-900/30 shadow-lg shadow-emerald-900/5">
                             <h4 className="text-3xl lg:text-4xl font-black mb-3 tracking-widest text-emerald-400">
                                {m.acronimo}
                             </h4>
                             <div className="font-bold mb-6 italic text-emerald-200/70 text-xl">
                                "{m.fraseAtivadora}"
                             </div>
                             <ul className="list-disc ml-8 space-y-4 marker:text-emerald-600">
                                {m.significado.split(/[,;]/).map((item: string, idx: number) => (
                                  <li key={idx} className="pl-4 text-lg text-slate-200 font-medium">
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
                   <section className="space-y-8 p-8 md:p-10 bg-[#0F172A] rounded-3xl border border-slate-800/80">
                     <h3 className="text-2xl font-black mb-8 uppercase tracking-wider text-rose-500 flex items-center gap-3">
                       <Database size={28} /> 2. Esquemas Organizados
                     </h3>
                     <div className="space-y-16">
                       {currentData.esquemas.map((esq: any, idx: number) => (
                         <div key={idx} className="space-y-6">
                           {esq.titulo && <h4 className="font-black text-2xl mb-6 text-slate-200 flex items-center gap-3"><ChevronRight className="text-rose-500"/>{formatBold(esq.titulo)}</h4>}
                           
                           {esq.hierarquia && esq.hierarquia.length > 0 ? (
                              <div className="space-y-8 bg-[#1E293B]/50 p-8 rounded-2xl border border-slate-700/50">
                                {esq.hierarquia.map((h: any, i: number) => (
                                   <div key={i} className="pl-4">
                                      <div className="font-black text-2xl mb-4 flex items-center gap-3 text-indigo-300">
                                         <div className="w-3 h-3 rounded-full bg-[#818CF8] shadow-[0_0_10px_rgba(129,140,248,0.8)]" />
                                         {formatBold(h.pai)}
                                      </div>
                                      <ul className="list-none ml-6 space-y-3 border-l-2 border-slate-700 pl-6 py-2">
                                         {h.filhos.map((filho: string, fIdx: number) => (
                                            <li key={fIdx} className="relative text-slate-300 text-lg">
                                               <span className="absolute -left-[1.95rem] top-4 w-4 h-0.5 bg-slate-700"></span>
                                               <span className="bg-[#1E293B] px-5 py-3 rounded-xl inline-block border border-slate-700/50 shadow-sm">{formatBold(filho)}</span>
                                            </li>
                                         ))}
                                      </ul>
                                   </div>
                                ))}
                              </div>
                           ) : (
                             esq.headers && esq.rows && (
                               <div className="overflow-x-auto rounded-2xl border border-slate-700/80 shadow-xl">
                                  <table className="table-auto w-full text-left border-collapse">
                                    <thead>
                                      <tr className="bg-[#1E293B]">
                                        {esq.headers.map((h: string, i: number) => <th key={i} className="p-6 border-b border-slate-700 font-black text-[#818CF8] uppercase tracking-wider text-sm">{formatBold(h)}</th>)}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#1E293B] bg-[#0F172A]/80">
                                      {esq.rows.map((row: string[], rI: number) => (
                                        <tr key={rI} className="hover:bg-[#1E293B]/50 transition-colors">
                                          {row.map((cell: string, cI: number) => <td key={cI} className="p-6 align-top text-slate-300 whitespace-pre-wrap">{formatBold(cell)}</td>)}
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
                   <section className="space-y-8 p-8 md:p-10 bg-[#0F172A] rounded-3xl border border-slate-800/80">
                     <h3 className="text-2xl font-black mb-8 uppercase tracking-wider text-rose-500 flex items-center gap-3">
                       <FileCheck size={28} /> 3. Base Legal Exaustiva
                     </h3>
                     <div className="space-y-12">
                       {currentData.baseLegal.map((lei: any, idx: number) => (
                         <div key={idx} className="space-y-6">
                            <h4 className="font-black text-2xl text-[#818CF8] flex items-center gap-4"><div className="w-2 h-8 bg-[#818CF8] rounded-full"></div>{formatBold(lei.artigo)}</h4>
                            <p className="leading-relaxed italic text-justify opacity-90 pl-8 border-l-2 border-[#1E293B] font-serif text-xl text-slate-300">"{formatBold(lei.texto)}"</p>
                            <div className="p-8 bg-[#1E293B]/50 rounded-2xl ml-8 border border-slate-800">
                               <p className="font-medium text-justify text-lg"><strong className="font-black text-rose-400 opacity-90 uppercase tracking-widest text-sm mb-3 block">Comentário Feroz</strong> <span className="text-slate-200">{formatBold(lei.comentario)}</span></p>
                            </div>
                            {lei.feynman && (
                               <p className="italic text-justify text-indigo-300 mt-4 bg-[#312E81]/30 p-8 rounded-2xl border border-[#312E81]/50 ml-8 text-lg">
                                 <span className="font-black text-[#818CF8] block mb-3">🎯 Simplificando:</span> "{formatBold(lei.feynman)}"
                               </p>
                            )}
                         </div>
                       ))}
                     </div>
                   </section>
                 )}

                 {/* 4. Doutrina e Jurisprudência */}
                 {currentData.jurisprudencia && currentData.jurisprudencia.length > 0 && (
                   <section className="space-y-8 p-8 md:p-10 bg-[#0F172A] rounded-3xl border border-slate-800/80">
                     <h3 className="text-2xl font-black mb-8 uppercase tracking-wider text-rose-500 flex items-center gap-3">
                       <Scale size={28} /> 4. Doutrina e Jurisprudência
                     </h3>
                     <div className="space-y-12">
                       {currentData.jurisprudencia.map((jur: any, idx: number) => (
                         <div key={idx} className="space-y-6 bg-[#1E293B]/40 p-10 rounded-3xl border border-slate-800">
                           <div className="flex items-center gap-4 mb-4">
                              <span className="font-black text-xs px-4 py-2 bg-[#0B1121] uppercase tracking-widest rounded-lg text-indigo-300 border border-slate-700">{jur.origem}</span>
                           </div>
                           <p className="font-black text-2xl text-slate-100">{formatBold(jur.tese)}</p>
                           <p className="leading-relaxed text-justify text-slate-300 text-lg">{formatBold(jur.texto)}</p>
                           {jur.feynman && (
                              <p className="italic text-justify font-medium pt-5 pl-6 border-l-2 border-[#1E293B] text-yellow-100/80 text-lg mt-8 bg-slate-900/50 p-4 rounded-xl">
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
                   <section className="space-y-8 p-8 md:p-10 bg-orange-950/20 rounded-3xl border border-orange-900/40">
                     <h3 className="text-2xl font-black mb-8 uppercase tracking-wider text-orange-500 flex items-center gap-3">
                       <AlertTriangle size={28} /> 5. Pegadinhas da Banca
                     </h3>
                     <ul className="list-none space-y-6">
                       {currentData.pegadinhas.map((peg: string, idx: number) => (
                         <li key={idx} className="flex items-start gap-6 p-8 bg-[#0B1121]/60 border border-orange-900/30 rounded-2xl shadow-lg shadow-orange-900/5 hover:border-orange-500/50 transition-colors">
                           <span className="text-2xl bg-orange-500/20 p-3 rounded-full border border-orange-500/50 text-orange-500 block shrink-0">🚨</span>
                           <p className="font-medium text-justify text-orange-50 text-xl leading-relaxed mt-1">{formatBold(peg)}</p>
                         </li>
                       ))}
                     </ul>
                   </section>
                 )}

                 {/* 6. FAQ */}
                 {currentData.faq && currentData.faq.length > 0 && (
                   <section className="space-y-8 p-8 md:p-10 bg-[#0F172A] rounded-3xl border border-slate-800/80">
                     <h3 className="text-2xl font-black mb-8 uppercase tracking-wider text-rose-500 flex items-center gap-3">
                       <HelpCircle size={28} /> 6. FAQ
                     </h3>
                     <div className="space-y-8">
                       {currentData.faq.map((item: any, idx: number) => (
                         <div key={idx} className="space-y-6 p-10 bg-[#1E293B]/50 rounded-3xl border border-slate-800">
                           <p className="font-black text-xl text-slate-100 flex items-start gap-4"><span className="text-rose-500 px-3 py-1 bg-rose-500/10 rounded-lg shrink-0">P.</span> {formatBold(item.pergunta)}</p>
                           <p className="text-justify text-slate-300 text-lg leading-relaxed flex items-start gap-4"><span className="font-black text-[#818CF8] px-3 py-1 bg-[#818CF8]/10 rounded-lg shrink-0">R.</span> {formatBold(item.resposta)}</p>
                         </div>
                       ))}
                     </div>
                   </section>
                 )}

                 {/* 7. Síntese 80/20 */}
                 {currentData.sintese && currentData.sintese.length > 0 && (
                   <section className="space-y-8 p-8 md:p-10 bg-[#312E81]/20 rounded-3xl border border-[#312E81]/40">
                     <h3 className="text-2xl font-black mb-8 uppercase tracking-wider text-[#818CF8] flex items-center gap-3">
                       <Brain size={28} /> 7. Síntese 80/20
                     </h3>
                     <ul className="list-disc ml-8 space-y-6 marker:text-[#818CF8] marker:text-xl">
                       {currentData.sintese.map((sint: string, idx: number) => (
                         <li key={idx} className="pl-4">
                           <span className="font-medium text-justify text-slate-200 text-xl leading-relaxed">{formatBold(sint)}</span>
                         </li>
                       ))}
                     </ul>
                   </section>
                 )}

                 {/* 8. Estudo Ativo */}
                 {currentData.estudoAtivo && currentData.estudoAtivo.length > 0 && (
                   <section className="space-y-8 p-8 md:p-10 bg-[#0F172A] rounded-3xl border border-slate-800/80">
                     <h3 className="text-2xl font-black mb-10 uppercase tracking-wider text-rose-500 flex items-center gap-3">
                       <Target size={28} /> 8. Estudo Ativo
                     </h3>
                     <div className="space-y-16">
                       {currentData.estudoAtivo.map((q: any, idx: number) => (
                         <div key={idx} className="space-y-10 bg-[#1E293B]/40 p-8 md:p-12 rounded-[2.5rem] border border-slate-800 shadow-xl">
                           <p className="font-black text-2xl text-justify text-slate-100 flex items-start gap-6">
                              <span className="bg-[#4F46E5] w-14 h-14 flex items-center justify-center rounded-[1rem] text-white shrink-0 shadow-lg shadow-[#4F46E5]/30">{idx + 1}</span> 
                              <span className="mt-2">{formatBold(q.enunciado)}</span>
                           </p>
                           <div className="space-y-5 ml-0 md:ml-[5.5rem]">
                             {q.alternativas.map((alt: string, ai: number) => (
                               <div key={ai} className="flex gap-5 p-6 rounded-2xl border border-slate-700/50 bg-[#0F172A] hover:bg-[#1E293B] hover:border-slate-600 transition-colors cursor-crosshair group">
                                 <span className="font-black opacity-40 uppercase w-8 text-center shrink-0 text-xl group-hover:text-[#818CF8] group-hover:opacity-100 transition-colors">{['a','b','c','d','e'][ai]})</span> 
                                 <span className="text-justify text-slate-300 text-xl">{formatBold(alt)}</span>
                               </div>
                             ))}
                           </div>
                           <details className="mt-8 outline-none group border-t border-slate-800/80 pt-10 ml-0 md:ml-[5.5rem]">
                             <summary className="font-black cursor-pointer text-xl opacity-90 hover:opacity-100 flex items-center gap-3 w-max select-none text-[#818CF8] bg-[#4F46E5]/10 px-8 py-5 rounded-2xl border border-[#4F46E5]/30 transition-colors hover:bg-[#4F46E5]/20 hover:-translate-y-1 active:translate-y-0">
                               Confirmar Gabarito <ChevronDown size={24} className="group-open:rotate-180 transition-transform"/>
                             </summary>
                             <div className="mt-8 bg-[#0B1121]/80 p-10 rounded-[2rem] border border-slate-800 shadow-inner">
                               <div className="inline-flex items-center gap-3 px-6 py-3 font-black mb-8 rounded-xl tracking-widest bg-rose-500/10 text-rose-400 text-lg border border-rose-500/20">
                                 <Target size={24} /> GABARITO: {q.gabarito}
                               </div>
                               <p className="text-justify leading-relaxed text-slate-300 text-xl">{formatBold(q.comentario)}</p>
                             </div>
                           </details>
                         </div>
                       ))}
                     </div>
                   </section>
                 )}

                 {/* PILARES 1 A 9 - DOUTRINADOR JURÍDICO SÊNIOR */}
                 {currentData.nucleoEssencial && currentData.nucleoEssencial.fichas && currentData.nucleoEssencial.fichas.length > 0 && (
                   <section className="space-y-10 mt-24 border-t-4 border-slate-800/80 pt-20">
                      <h3 className="text-3xl font-black mb-12 uppercase tracking-widest flex items-center gap-5 text-[#818CF8]">
                        <div className="p-4 bg-[#818CF8]/10 rounded-2xl"><Target size={36} /></div> 
                        1. Núcleo Essencial (Pareto 80/20)
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {currentData.nucleoEssencial.fichas.map((ficha: any, i: number) => (
                           <div key={i} className="p-10 rounded-[2rem] bg-[#0F172A] border border-slate-800 shadow-lg hover:border-slate-600 transition-colors">
                              <h4 className="font-black text-2xl mb-5 text-slate-100 border-l-4 border-[#818CF8] pl-5">{formatBold(ficha.titulo)}</h4>
                              <p className="text-justify leading-relaxed text-slate-300 text-lg">{formatBold(ficha.definicaoCurta)}</p>
                           </div>
                        ))}
                      </div>
                   </section>
                 )}

                 {currentData.analiseDoutrinaria && (
                   <section className="space-y-10 mt-20">
                      <h3 className="text-3xl font-black mb-12 uppercase tracking-widest flex items-center gap-5 text-[#818CF8]">
                        <div className="p-4 bg-[#818CF8]/10 rounded-2xl"><Library size={36} /></div> 
                        2. Análise Doutrinária Profunda
                      </h3>
                      <div className="space-y-8 text-justify leading-loose text-xl text-slate-200">
                        <p className="p-8 bg-[#0F172A] rounded-3xl border border-slate-800/80">{formatBold(currentData.analiseDoutrinaria.texto)}</p>
                        <div className="mt-12 p-10 rounded-[2.5rem] italic shadow-inner bg-[#1E293B]/40 border border-slate-700">
                          <strong className="font-black text-2xl mb-8 normal-case not-italic flex items-center gap-4 text-slate-100"><Brain className="text-rose-400" size={36}/> Divergências e Reflexões:</strong>
                          <span className="text-slate-300 text-xl leading-relaxed">{formatBold(currentData.analiseDoutrinaria.divergencias)}</span>
                        </div>
                      </div>
                   </section>
                 )}

                 {currentData.quadrosSinoticos && currentData.quadrosSinoticos.length > 0 && (
                   <section className="space-y-10 mt-20">
                      <h3 className="text-3xl font-black mb-12 uppercase tracking-widest flex items-center gap-5 text-[#818CF8]">
                        <div className="p-4 bg-[#818CF8]/10 rounded-2xl"><Scale size={36} /></div> 
                        3. Quadros Sinóticos Comparativos
                      </h3>
                      <div className="space-y-16">
                        {currentData.quadrosSinoticos.map((quadro: any, i: number) => (
                           <div key={i} className="overflow-hidden rounded-[2.5rem] border border-slate-700 shadow-2xl bg-[#0F172A]">
                              <div className="p-8 font-black text-2xl text-center uppercase tracking-widest bg-[#1E293B] text-[#818CF8] border-b border-slate-700">
                                {formatBold(quadro.titulo)}
                              </div>
                              <div className="overflow-x-auto">
                                 <table className="table-auto w-full text-left border-collapse">
                                    <thead>
                                      <tr>
                                        {quadro.comparativo.headers.map((h: string, hi: number) => <th key={hi} className="p-8 border-b border-slate-700 bg-slate-900/80 text-slate-100 font-black text-[1rem] uppercase tracking-widest">{formatBold(h)}</th>)}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800 bg-[#0B1121]/50">
                                       {quadro.comparativo.rows.map((row: string[], ri: number) => (
                                          <tr key={ri} className="hover:bg-slate-800/50 transition-colors">
                                             {row.map((cell: string, ci: number) => <td key={ci} className="p-8 align-top leading-relaxed text-slate-300 text-lg whitespace-pre-wrap">{formatBold(cell)}</td>)}
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
                    <section className="space-y-10 mt-20">
                      <h3 className="text-3xl font-black mb-12 uppercase tracking-widest flex items-center gap-5 text-[#818CF8]">
                        <div className="p-4 bg-[#818CF8]/10 rounded-2xl"><FileCheck size={36} /></div> 
                        4. Literalidade e Base Legal
                      </h3>
                      <div className="space-y-12">
                         {currentData.literalidadeBaseLegal.map((lei: any, idx: number) => (
                           <div key={idx} className="space-y-8 bg-[#0F172A] p-10 rounded-[2.5rem] border border-slate-800">
                              <h4 className="font-black text-2xl flex items-center gap-5 text-slate-100"><div className="w-5 h-5 rounded-lg bg-[#818CF8] shadow-[0_0_15px_rgba(129,140,248,0.6)]"></div>{formatBold(lei.artigo)}</h4>
                              <div className="leading-relaxed text-justify pl-10 border-l-4 text-xl border-slate-600 font-serif italic text-slate-300 bg-slate-900/40 py-6 pr-8 rounded-r-3xl">"{formatBold(lei.texto)}"</div>
                              <div className="p-8 mt-8 rounded-[2rem] ml-10 flex gap-6 items-start bg-[#1E293B]/40 border border-slate-700">
                                 <Brain size={36} className="shrink-0 mt-2 text-slate-400" />
                                 <div>
                                   <strong className="font-black text-sm block mb-4 uppercase tracking-widest text-slate-400">Comentário do Doutrinador</strong>
                                   <p className="text-justify font-medium text-slate-200 text-xl leading-relaxed">{formatBold(lei.comentario)}</p>
                                 </div>
                              </div>
                           </div>
                         ))}
                      </div>
                    </section>
                 )}

                 {currentData.jurisprudenciaSumulas && currentData.jurisprudenciaSumulas.length > 0 && (
                    <section className="space-y-10 mt-20">
                      <h3 className="text-3xl font-black mb-12 uppercase tracking-widest flex items-center gap-5 text-[#818CF8]">
                        <div className="p-4 bg-[#818CF8]/10 rounded-2xl"><Scale size={36} /></div> 
                        5. Jurisprudência e Súmulas
                      </h3>
                      <div className="grid grid-cols-1 gap-12">
                         {currentData.jurisprudenciaSumulas.map((jur: any, idx: number) => (
                            <div key={idx} className="p-12 rounded-[2.5rem] relative overflow-hidden shadow-2xl bg-[#0F172A] border border-slate-700">
                               <div className="absolute top-0 right-0 px-8 py-4 text-sm font-black uppercase tracking-widest rounded-bl-[2rem] bg-[#818CF8]/20 text-[#818CF8] border-b border-l border-[#818CF8]/30 backdrop-blur-md">{jur.origem}</div>
                               <h4 className="font-black text-3xl mb-8 pr-32 leading-tight text-slate-100">{formatBold(jur.tese)}</h4>
                               <p className="leading-relaxed text-justify text-xl text-slate-300">{formatBold(jur.texto)}</p>
                            </div>
                         ))}
                      </div>
                    </section>
                 )}

                 {currentData.puloDoGatoPegadinhas && currentData.puloDoGatoPegadinhas.length > 0 && (
                    <section className="space-y-10 mt-20">
                      <h3 className="text-3xl font-black mb-12 uppercase tracking-widest flex items-center gap-5 text-orange-400">
                        <div className="p-4 bg-orange-500/10 rounded-2xl"><AlertTriangle size={36} /></div> 
                        6. O "Pulo do Gato"
                      </h3>
                      <div className="space-y-10">
                         {currentData.puloDoGatoPegadinhas.map((peg: any, idx: number) => (
                            <div key={idx} className="flex gap-8 items-start p-10 md:p-12 rounded-[2.5rem] shadow-2xl bg-gradient-to-br from-orange-950/40 to-slate-900 border border-orange-900/50 hover:border-orange-500/50 transition-colors">
                               <div className="p-5 bg-orange-500/20 rounded-2xl shrink-0 border border-orange-500/30">
                                 <AlertTriangle className="text-orange-500" size={40} />
                               </div>
                               <div>
                                 <span className="font-black text-xl block mb-4 uppercase tracking-widest text-orange-400">{peg.tipo}</span>
                                 <p className="font-medium text-xl leading-relaxed text-justify text-orange-50">{formatBold(peg.texto)}</p>
                               </div>
                            </div>
                         ))}
                      </div>
                    </section>
                 )}

                 {currentData.metodoFeynman && currentData.metodoFeynman.length > 0 && (
                    <section className="space-y-10 mt-20">
                      <h3 className="text-3xl font-black mb-12 uppercase tracking-widest flex items-center gap-5 text-yellow-400">
                        <div className="p-4 bg-yellow-500/10 rounded-2xl"><Lightbulb size={36} /></div> 
                        7. Método de Feynman
                      </h3>
                      <div className="grid grid-cols-1 gap-12">
                         {currentData.metodoFeynman.map((fey: any, idx: number) => (
                            <div key={idx} className="p-12 rounded-[3rem] relative mt-8 bg-[#0F172A] border border-yellow-500/30 shadow-[0_15px_50px_rgba(234,179,8,0.08)]">
                               <div className="absolute -top-10 -left-6 md:-left-10 bg-[#0B1121] p-5 rounded-full border-2 border-yellow-500/40 shadow-[0_0_30px_rgba(234,179,8,0.3)]">
                                 <Lightbulb size={48} className="text-yellow-400" />
                               </div>
                               <h4 className="font-black text-3xl mb-8 text-yellow-400 ml-6 md:ml-12">{formatBold(fey.conceito)}</h4>
                               <p className="italic text-2xl text-justify leading-relaxed ml-6 md:ml-12 border-l-4 border-yellow-500/60 pl-8 text-yellow-100/90 font-serif">"{formatBold(fey.analogiaSimplificada)}"</p>
                            </div>
                         ))}
                      </div>
                    </section>
                 )}

                 {currentData.questoesFixacao && currentData.questoesFixacao.length > 0 && (
                    <section className="space-y-10 mt-20">
                      <h3 className="text-3xl font-black mb-12 uppercase tracking-widest flex items-center gap-5 text-[#818CF8]">
                        <div className="p-4 bg-[#818CF8]/10 rounded-2xl"><Target size={36} /></div> 
                        8. Questões de Alto Nível
                      </h3>
                      <div className="space-y-16">
                        {currentData.questoesFixacao.map((q: any, idx: number) => (
                          <div key={idx} className="p-10 md:p-14 rounded-[3rem] shadow-2xl bg-[#0F172A] border border-slate-700">
                            <p className="font-black text-2xl mb-12 leading-relaxed flex items-start gap-6 text-slate-100">
                              <span className="shrink-0 w-16 h-16 flex items-center justify-center bg-[#818CF8]/20 text-[#818CF8] rounded-2xl text-3xl border border-[#818CF8]/30 backdrop-blur-md shadow-lg shadow-indigo-500/10">Q{idx + 1}</span> 
                              <span className="mt-3">{formatBold(q.enunciado)}</span>
                            </p>
                            <div className="space-y-5 ml-0 md:ml-24 mb-12 text-xl">
                              {q.alternativas.map((alt: string, ai: number) => (
                                <div key={ai} className="flex gap-6 p-6 rounded-2xl border border-slate-700 bg-[#1E293B]/50 hover:border-[#818CF8]/50 hover:bg-[#1E293B] transition-all cursor-crosshair group">
                                  <span className="font-black opacity-30 uppercase w-8 text-center shrink-0 group-hover:text-[#818CF8] group-hover:opacity-100 transition-colors text-2xl mt-0.5">{['a','b','c','d','e'][ai]})</span> 
                                  <span className="text-justify font-medium text-slate-300 group-hover:text-slate-100 transition-colors leading-relaxed">{formatBold(alt)}</span>
                                </div>
                              ))}
                            </div>
                            <details className="outline-none group mt-12 md:ml-24">
                              <summary className="font-black cursor-pointer text-xl flex items-center justify-center p-6 rounded-2xl gap-4 w-full text-center transition-all bg-[#4F46E5] text-white hover:bg-indigo-600 shadow-[0_15px_40px_rgba(79,70,229,0.3)] hover:-translate-y-1">
                                Exibir Resolução Profunda <ChevronDown size={28} className="group-open:rotate-180 transition-transform"/>
                              </summary>
                              <div className="mt-10 p-10 rounded-3xl bg-[#0B1121] border border-slate-800 shadow-inner">
                                <div className="inline-flex items-center gap-4 px-8 py-4 font-black mb-10 rounded-2xl tracking-widest bg-rose-500/10 text-rose-400 text-2xl border border-rose-500/20">
                                  <Target size={32} /> GABARITO: {q.gabarito}
                                </div>
                                <p className="text-justify leading-relaxed text-slate-300 text-xl">{formatBold(q.comentario)}</p>
                              </div>
                            </details>
                          </div>
                        ))}
                      </div>
                    </section>
                 )}

                 {currentData.planoRevisao && currentData.planoRevisao.length > 0 && (
                    <section className="space-y-12 mt-24 relative overflow-hidden bg-gradient-to-br from-[#1E1B4B] via-[#0F172A] to-[#1E3A8A] p-12 md:p-20 rounded-[4rem] shadow-[0_30px_60px_rgba(0,0,0,0.6)] border border-indigo-900/50">
                      <div className="absolute -bottom-20 -right-20 opacity-[0.05] pointer-events-none">
                        <Brain size={500} />
                      </div>
                      <h3 className="text-4xl font-black mb-14 uppercase tracking-widest flex items-center gap-5 relative z-10 text-indigo-200">
                        <div className="p-5 bg-indigo-500/20 rounded-[2rem] border border-indigo-500/30 backdrop-blur-md"><Database size={40} className="text-indigo-300"/></div> 
                        9. Plano de Revisão Ativa
                      </h3>
                      <ul className="list-disc ml-14 space-y-10 marker:text-indigo-400 relative z-10 text-2xl text-slate-200">
                        {currentData.planoRevisao.map((rev: string, idx: number) => (
                          <li key={idx} className="pl-6">
                            <span className="font-medium leading-relaxed text-justify drop-shadow-md">{formatBold(rev)}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                 )}

                 {/* Premium Footer Spacer */}
                 <footer className="pt-32 pb-12 flex flex-col items-center justify-center gap-8 opacity-50 select-none">
                    <div className="w-20 h-20 rounded-[2rem] flex items-center justify-center border-2 border-slate-700 bg-[#0F172A] text-slate-500 shadow-inner">
                      <Brain size={36} />
                    </div>
                    <span className="text-sm font-black tracking-widest uppercase text-slate-500">Documento Classificado • Acesso Restrito</span>
                 </footer>
              </motion.div>
           ) : (selectedDiscipline && currentDisc && Object.keys(currentDisc.knowledgeData || {}).length === 0 && (
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
