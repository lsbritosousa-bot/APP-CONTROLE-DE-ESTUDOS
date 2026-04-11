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
  ImageIcon,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from './AuthProvider';
import { db } from '../firebase';
import { collection, onSnapshot, query, addDoc, doc, updateDoc, deleteDoc } from '../lib/firestoreSupabase';
import { generateStructuredKnowledge } from '../services/geminiService';
import { StructuredKnowledgeResult } from '../types';

interface DisciplineDoc {
  id: string;
  name: string;
  knowledgeData?: StructuredKnowledgeResult | null;
}

export const StructuredKnowledgeBase = () => {
  const { profile } = useAuth();
  const [disciplines, setDisciplines] = useState<DisciplineDoc[]>([]);
  const [selectedDiscipline, setSelectedDiscipline] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [images, setImages] = useState<{file: File, url: string}[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newDisciplineName, setNewDisciplineName] = useState('');

  // Sincronizar Disciplinas do Firebase
  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'users', profile.uid, 'knowledge_disciplines'));
    return onSnapshot(q, (snapshot) => {
      const subs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DisciplineDoc));
      setDisciplines(subs);
      if (subs.length > 0 && !selectedDiscipline) setSelectedDiscipline(subs[0].id);
    });
  }, [profile]);

  const handleAddDiscipline = async () => {
    if (!profile || !newDisciplineName.trim()) return;
    try {
      const docRef = await addDoc(collection(db, 'users', profile.uid, 'knowledge_disciplines'), {
        userId: profile.uid,
        name: newDisciplineName.trim(),
        createdAt: new Date().toISOString()
      });
      setSelectedDiscipline(docRef.id);
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
      if (selectedDiscipline === id) setSelectedDiscipline(null);
    } catch(e) {
      alert("Erro ao excluir.");
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
      const imagesBase64 = await Promise.all(images.map(async img => ({
         mimeType: img.file.type,
         data: await fileToBase64(img.file)
      })));

      const currentDisc = disciplines.find(d => d.id === selectedDiscipline);
      const output = await generateStructuredKnowledge(currentDisc?.knowledgeData || null, inputText, imagesBase64);

      await updateDoc(doc(db, 'users', profile.uid, 'knowledge_disciplines', selectedDiscipline), {
         knowledgeData: output,
         updatedAt: new Date().toISOString()
      });

      setInputText('');
      setImages([]);
    } catch (e: any) {
      alert("Erro ao processar conteúdo: " + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const currentData = disciplines.find(d => d.id === selectedDiscipline)?.knowledgeData;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8 min-h-screen bg-slate-100 p-4 md:p-8 rounded-3xl text-gray-800 text-[1.1rem] leading-relaxed font-['Inter']"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Base de Conhecimento Estruturada</h1>
          <p className="text-slate-600 mt-2 text-lg">Alimente a IA e construa o material perfeito (Cumulativo e Imagens suportadas).</p>
        </div>
        <div className="flex gap-3">
           <button className="flex items-center gap-2 bg-white border-2 border-slate-200 text-slate-700 px-5 py-3 rounded-2xl font-bold hover:bg-slate-50 transition-all shadow-sm">
             <Code size={20} /> Salvar HTML
           </button>
           <button className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-600/30">
             <Download size={20} /> Baixar PDF
           </button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Menu Lateral */}
        <aside className="lg:w-1/4 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-xl border-t-8 border-indigo-500">
            <h2 className="font-bold text-xl mb-4 text-slate-800 flex items-center gap-2">
              <Database className="text-indigo-500" /> Disciplinas
            </h2>
            <div className="flex gap-2 mb-4">
              <input 
                type="text" 
                value={newDisciplineName}
                onChange={e => setNewDisciplineName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddDiscipline()}
                placeholder="Nova disciplina..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:ring-2 ring-indigo-500/20 text-base"
              />
              <button 
                onClick={handleAddDiscipline}
                className="bg-indigo-100 text-indigo-700 p-2 rounded-xl hover:bg-indigo-200 transition-colors"
              >
                <Plus size={24} />
              </button>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
              {disciplines.length === 0 ? (
                <p className="text-sm text-slate-400 italic">Nenhuma disciplina cadastrada.</p>
              ) : (
                disciplines.map(disc => (
                  <div key={disc.id} className="flex gap-1 group relative">
                    <button
                      onClick={() => setSelectedDiscipline(disc.id)}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-2xl transition-all flex justify-between items-center",
                        selectedDiscipline === disc.id 
                          ? "bg-indigo-600 text-white font-bold shadow-md" 
                          : "bg-slate-50 hover:bg-slate-100 text-slate-700"
                      )}
                    >
                      <span className="truncate pr-2">{disc.name}</span>
                      {selectedDiscipline === disc.id && <ChevronRight size={18} className="flex-shrink-0" />}
                    </button>
                    <button 
                      onClick={() => handleDeleteDiscipline(disc.id, disc.name)}
                      className="text-red-500/50 hover:text-red-500 hover:bg-red-50 p-3 rounded-xl absolute right-0 top-0 hidden group-hover:flex items-center h-full transition-colors backdrop-blur-md"
                      title="Apagar Disciplina"
                    >
                       <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        {/* Área Principal */}
        <div className="lg:w-3/4 space-y-8 min-w-0">
          
          {/* Formulário IA */}
          <div className="bg-white p-8 rounded-3xl shadow-xl border-t-8 border-indigo-500 relative">
             {!selectedDiscipline && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-3xl">
                  <p className="font-bold text-slate-500 text-lg">Selecione ou crie uma Disciplina primeiro.</p>
                </div>
             )}
             
             <div className="flex items-center gap-3 mb-4">
               <Brain size={28} className="text-indigo-600" />
               <h2 className="text-2xl font-bold text-slate-800">Alimentar Base de Dados</h2>
               {currentData && <span className="ml-auto px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full uppercase tracking-wider">Base Ativa</span>}
             </div>
             
             <p className="text-slate-600 mb-6 text-base">
               Envie textos (leis, doutrina, questões) ou dê <strong>CTRL+V em imagens/prints</strong>. A IA incluirá todo o novo contexto orgulhosamente à essa disciplina sem perder os resumos anteriores.
             </p>
             
             <textarea 
               value={inputText}
               onChange={(e) => setInputText(e.target.value)}
               onPaste={handlePaste}
               placeholder="Escreva ou Ctrl+V para colar imagens (ex: print de tabelas, texto da lei)..."
               className="w-full h-40 bg-slate-50 border-2 border-slate-200 rounded-3xl p-6 outline-none focus:border-indigo-400 focus:ring-4 ring-indigo-500/10 resize-none text-lg transition-all"
               style={{ fontFamily: 'Inter, sans-serif' }}
             />

             {/* Preview de Imagens Coladas */}
             {images.length > 0 && (
               <div className="mt-4 flex gap-4 flex-wrap">
                 <AnimatePresence>
                   {images.map((img, i) => (
                      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} key={i} className="relative group">
                         <img src={img.url} alt="preview" className="h-24 w-24 object-cover rounded-2xl shadow-sm border-2 border-slate-200" />
                         <button 
                           onClick={() => handleRemoveImage(i)}
                           className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                         >
                           <X size={14} />
                         </button>
                      </motion.div>
                   ))}
                 </AnimatePresence>
               </div>
             )}
             
             <div className="mt-6 flex items-center justify-between">
               <div className="text-sm text-slate-500 flex items-center gap-2">
                 <ImageIcon size={18} /> As imagens coladas entram no contexto de leitura.
               </div>
               <button 
                 onClick={handleGenerate}
                 disabled={isGenerating || (!inputText.trim() && images.length === 0)}
                 className="bg-indigo-600 text-white font-bold text-lg px-8 py-4 rounded-3xl hover:bg-indigo-700 shadow-xl shadow-indigo-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
               >
                 {isGenerating ? (
                   <>
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                      <Brain size={24} />
                    </motion.div>
                    Agregando Base...
                   </>
                 ) : (
                   <>
                    <Brain size={24} /> Consolidar na Base
                   </>
                 )}
               </button>
             </div>
          </div>

          {/* Resultados - Os 11 Cards com Dados Reais */}
          {currentData && (
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-10"
            >
               {/* Card 1: Visão Geral */}
               <section className="bg-white p-10 rounded-3xl shadow-xl border-t-8 border-slate-800">
                 <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                   <Target className="text-slate-800" /> 1. Visão Geral & Divergências
                 </h3>
                 <div className="prose prose-slate max-w-none text-[1.1rem]">
                   <p className="mb-6 font-medium whitespace-pre-wrap">{currentData.visaoGeral.textoDenso}</p>
                   {currentData.visaoGeral.divergencias && (
                      <div className="mb-6 p-6 bg-slate-50 border-l-4 border-slate-400 rounded-r-xl">
                        <p className="font-bold mb-2">Divergências Doutrinárias/Jurisprudenciais:</p>
                        <p>{currentData.visaoGeral.divergencias}</p>
                      </div>
                   )}
                   {currentData.visaoGeral.feynman && (
                     <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-200 mt-8">
                       <p className="font-bold text-emerald-800 flex items-center gap-2 mb-3">
                         <Lightbulb size={24} /> Método de Feynman (Simplificando)
                       </p>
                       <p className="text-emerald-900 italic">"{currentData.visaoGeral.feynman}"</p>
                     </div>
                   )}
                 </div>
               </section>

               {/* Card 2: Esquemas */}
               {currentData.esquemas && currentData.esquemas.length > 0 && (
                 <section className="bg-white p-10 rounded-3xl shadow-xl border-t-8 border-blue-500">
                   <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                     <Database className="text-blue-500" /> 2. Esquematizando
                   </h3>
                   <div className="space-y-8">
                     {currentData.esquemas.map((esq, idx) => (
                       <div key={idx}>
                         {esq.titulo && <h4 className="font-bold text-lg mb-4">{esq.titulo}</h4>}
                         <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
                            <table className="table-auto w-full text-left">
                              <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                  {esq.headers.map((h, i) => <th key={i} className="p-4 font-bold text-slate-700">{h}</th>)}
                                </tr>
                              </thead>
                              <tbody>
                                {esq.rows.map((row, rI) => (
                                  <tr key={rI} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                                    {row.map((cell, cI) => <td key={cI} className="p-4 text-slate-600">{cell}</td>)}
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

               {/* Card 3: Mapa Mental */}
               {currentData.mapaMental && (
                 <section className="bg-white p-10 rounded-3xl shadow-xl border-t-8 border-purple-500">
                   <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                     <Brain className="text-purple-500" /> 3. Mapa Mental
                   </h3>
                   <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 flex flex-col items-center justify-center min-h-[150px]">
                     <code className="text-sm font-mono text-slate-500 bg-slate-200 px-3 py-1 rounded mb-4">Código Mermaid Gerado:</code>
                     <pre className="w-full text-left bg-white p-4 rounded-xl border border-slate-200 overflow-x-auto text-sm text-slate-600">
                        {currentData.mapaMental}
                     </pre>
                   </div>
                 </section>
               )}

               {/* Card 4: Base Legal */}
               {currentData.baseLegal && currentData.baseLegal.length > 0 && (
                 <section className="bg-white p-10 rounded-3xl shadow-xl border-t-8 border-yellow-500">
                   <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                     <Scale className="text-yellow-500" /> 4. Base Legal Comentada
                   </h3>
                   <div className="space-y-8">
                     {currentData.baseLegal.map((lei, idx) => (
                       <div key={idx} className="space-y-4">
                         <div className="bg-yellow-50/50 p-6 rounded-2xl border-l-4 border-yellow-400">
                            <p className="font-bold text-yellow-900 mb-2">{lei.artigo}</p>
                            <p className="text-slate-800 leading-relaxed italic">"{lei.texto}"</p>
                         </div>
                         <p className="text-slate-700 font-medium">Comentário: {lei.comentario}</p>
                         {lei.feynman && (
                           <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-200">
                             <p className="font-bold text-emerald-800 flex items-center gap-2 mb-3">
                               <Lightbulb size={24} /> Visão Feynman
                             </p>
                             <p className="text-emerald-900 italic">"{lei.feynman}"</p>
                           </div>
                         )}
                       </div>
                     ))}
                   </div>
                 </section>
               )}

               {/* Card 5: Jurisprudência */}
               {currentData.jurisprudencia && currentData.jurisprudencia.length > 0 && (
                 <section className="bg-white p-10 rounded-3xl shadow-xl border-t-8 border-red-500">
                   <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                     <AlertTriangle className="text-red-500" /> 5. Doutrina e Jurisprudência
                   </h3>
                   <div className="space-y-8">
                     {currentData.jurisprudencia.map((jur, idx) => (
                       <div key={idx} className="space-y-4">
                         <div className="bg-red-50 p-6 rounded-2xl border border-red-200 relative overflow-hidden">
                           <div className="absolute top-0 right-0 bg-red-500 text-white font-bold text-xs px-3 py-1 pb-2 rounded-bl-xl">{jur.origem}</div>
                           <p className="font-bold text-red-900 mt-2 mb-3">{jur.tese}</p>
                           <p className="text-red-800 leading-relaxed">{jur.texto}</p>
                         </div>
                         {jur.feynman && (
                           <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-200 mt-2">
                             <p className="text-emerald-900 italic font-medium">💡 Exemplo prático: "{jur.feynman}"</p>
                           </div>
                         )}
                       </div>
                     ))}
                   </div>
                 </section>
               )}

               {/* Card 6: Pegadinhas */}
               {currentData.pegadinhas && currentData.pegadinhas.length > 0 && (
                 <section className="bg-white p-10 rounded-3xl shadow-xl border-t-8 border-orange-500">
                   <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                     <Target className="text-orange-500" /> 6. Pegadinhas da Banca
                   </h3>
                   <ul className="space-y-4">
                     {currentData.pegadinhas.map((peg, idx) => (
                       <li key={idx} className="flex items-start gap-4">
                         <span className="text-orange-500 font-bold block mt-1">⚠️</span>
                         <p className="text-slate-800">{peg}</p>
                       </li>
                     ))}
                   </ul>
                 </section>
               )}

               {/* Card 7: FAQ */}
               {currentData.faq && currentData.faq.length > 0 && (
                 <section className="bg-white p-10 rounded-3xl shadow-xl border-t-8 border-cyan-500">
                   <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                     <HelpCircle className="text-cyan-500" /> 7. FAQ (Dúvidas Complexas)
                   </h3>
                   <div className="space-y-4">
                     {currentData.faq.map((item, idx) => (
                       <div key={idx} className="border border-slate-200 rounded-2xl p-6">
                         <p className="font-bold text-slate-800 text-lg mb-2">P: {item.pergunta}</p>
                         <p className="text-slate-600">R: {item.resposta}</p>
                       </div>
                     ))}
                   </div>
                 </section>
               )}

               {/* Card 8: Síntese */}
               {currentData.sintese && currentData.sintese.length > 0 && (
                 <section className="bg-white p-10 rounded-3xl shadow-xl border-t-8 border-pink-500">
                   <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                     <FileCheck className="text-pink-500" /> 8. Síntese 80/20
                   </h3>
                   <ul className="list-disc list-inside space-y-3 text-slate-700 font-medium ml-2">
                     {currentData.sintese.map((sint, idx) => (
                       <li key={idx}>{sint}</li>
                     ))}
                   </ul>
                 </section>
               )}

               {/* Card 9: Estudo Ativo */}
               {currentData.estudoAtivo && currentData.estudoAtivo.length > 0 && (
                 <section className="bg-white p-10 rounded-3xl shadow-xl border-t-8 border-lime-500">
                   <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                     <Lightbulb className="text-lime-500" /> 9. Estudo Ativo (Questões Formadas)
                   </h3>
                   <div className="space-y-6">
                     {currentData.estudoAtivo.map((q, idx) => (
                       <div key={idx} className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                         <p className="font-bold text-slate-800 mb-4 whitespace-pre-wrap">Questão {idx + 1}: {q.enunciado}</p>
                         <div className="space-y-2 mb-6 ml-2">
                           {q.alternativas.map((alt, ai) => (
                             <p key={ai} className="text-slate-600">{['a)','b)','c)','d)','e)'][ai]} {alt}</p>
                           ))}
                         </div>
                         <details className="bg-white border text-base border-slate-300 rounded-xl p-4 cursor-pointer focus:outline-none">
                           <summary className="font-bold text-slate-800 outline-none select-none">Mostrar Gabarito e Comentário</summary>
                           <div className="mt-4 text-slate-700 pt-4 border-t border-slate-200">
                             <strong>Gabarito Oficial: {q.gabarito}</strong>
                             <p className="mt-2 text-sm">{q.comentario}</p>
                           </div>
                         </details>
                       </div>
                     ))}
                   </div>
                 </section>
               )}

               {/* Card 10: Flashcards Anki */}
               {currentData.flashcards && currentData.flashcards.length > 0 && (
                 <section className="bg-white p-10 rounded-3xl shadow-xl border-t-8 border-teal-500">
                   <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                     <Database className="text-teal-500" /> 10. Flashcards para Anki (Exportação)
                   </h3>
                   <textarea 
                     readOnly
                     className="w-full h-48 bg-slate-800 text-slate-100 font-mono text-sm leading-relaxed rounded-2xl p-6 outline-none resize-none shadow-inner"
                     value={currentData.flashcards.map(f => `${f.frente};${f.verso}`).join('\n')}
                   />
                   <p className="text-sm text-slate-500 mt-3 font-medium">Copie este texto e importe no seu deck do Anki (Campos separados por ponto e vírgula).</p>
                 </section>
               )}

               {/* Card 11: Revisão (Fixo na disciplina) */}
               <section className="bg-white p-10 rounded-3xl shadow-xl border-t-8 border-neutral-800">
                 <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                   <Target className="text-neutral-800" /> 11. Controle Automático
                 </h3>
                 <p className="text-slate-600 mb-4">Seu progresso diário nestes flashcards é controlado no Dashboard Geral da disciplina e no Caderno de Erros nativo. Atualizações automáticas realizadas com base na nova leitura de Inteligência Artificial!</p>
               </section>

            </motion.div>
          )}

        </div>
      </div>
    </motion.div>
  );
}
