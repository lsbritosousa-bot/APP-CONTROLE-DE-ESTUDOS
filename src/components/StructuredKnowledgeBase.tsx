import React, { useState } from 'react';
import { motion } from 'motion/react';
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
  ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';

interface Discipline {
  id: string;
  name: string;
}

export const StructuredKnowledgeBase = () => {
  const [disciplines, setDisciplines] = useState<Discipline[]>([
    { id: '1', name: 'Direito Constitucional' },
    { id: '2', name: 'Direito Penal' },
  ]);
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('1');
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [newDisciplineName, setNewDisciplineName] = useState('');

  const handleGenerate = () => {
    if (!inputText) return;
    setIsGenerating(true);
    // Simular processamento da IA
    setTimeout(() => {
      setIsGenerating(false);
      setHasGenerated(true);
    }, 2000);
  };

  const handleAddDiscipline = () => {
    if (!newDisciplineName.trim()) return;
    const newDoc = { id: Date.now().toString(), name: newDisciplineName };
    setDisciplines([...disciplines, newDoc]);
    setSelectedDiscipline(newDoc.id);
    setNewDisciplineName('');
  };

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
          <p className="text-slate-600 mt-2 text-lg">Gere material autossuficiente, denso e definitivo.</p>
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
              {disciplines.map(disc => (
                <button
                  key={disc.id}
                  onClick={() => setSelectedDiscipline(disc.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-2xl transition-all flex justify-between items-center",
                    selectedDiscipline === disc.id 
                      ? "bg-indigo-600 text-white font-bold shadow-md" 
                      : "bg-slate-50 hover:bg-slate-100 text-slate-700"
                  )}
                >
                  <span className="truncate">{disc.name}</span>
                  {selectedDiscipline === disc.id && <ChevronRight size={18} />}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="lg:w-3/4 space-y-8">
          <div className="bg-white p-8 rounded-3xl shadow-xl border-t-8 border-indigo-500">
             <div className="flex items-center gap-3 mb-4">
               <Brain size={28} className="text-indigo-600" />
               <h2 className="text-2xl font-bold text-slate-800">Alimentar a IA</h2>
             </div>
             <p className="text-slate-600 mb-6 text-base">
               Insira leis, questões, informativos ou doutrina. A IA se encarregará de expandir, organizar e estruturar todo o conhecimento.
             </p>
             <textarea 
               value={inputText}
               onChange={(e) => setInputText(e.target.value)}
               placeholder="Cole aqui seu recorte de questão, trecho de lei ou apontamento..."
               className="w-full h-48 bg-slate-50 border-2 border-slate-200 rounded-3xl p-6 outline-none focus:border-indigo-400 focus:ring-4 ring-indigo-500/10 resize-none text-lg transition-all"
               style={{ fontFamily: 'Inter, sans-serif' }}
             />
             <div className="mt-6 flex justify-end">
               <button 
                 onClick={handleGenerate}
                 disabled={isGenerating || !inputText.trim()}
                 className="bg-indigo-600 text-white font-bold text-lg px-8 py-4 rounded-3xl hover:bg-indigo-700 shadow-xl shadow-indigo-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
               >
                 {isGenerating ? (
                   <>
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                      <Brain size={24} />
                    </motion.div>
                    Processando...
                   </>
                 ) : (
                   <>
                    <Brain size={24} /> Gerar Material Exaustivo
                   </>
                 )}
               </button>
             </div>
          </div>

          {hasGenerated && (
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-10"
            >
               {/* Card 1 */}
               <section className="bg-white p-10 rounded-3xl shadow-xl border-t-8 border-slate-800">
                 <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                   <Target className="text-slate-800" /> 1. Visão Geral & Divergências
                 </h3>
                 <div className="prose prose-slate max-w-none text-[1.1rem]">
                   <p className="mb-6 font-medium">Exemplo de texto denso em nível doutrinário gerado pela IA. Aqui é onde as confusões e detalhes são explicados de forma profunda, sem simplificações excessivas.</p>
                   <p className="mb-6">Doutrinadores como Hely Lopes Meirelles afirmam que X. Por outro lado, Di Pietro sustenta que Y. O STJ costuma adotar a corrente de Di Pietro.</p>
                   <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-200 mt-8">
                     <p className="font-bold text-emerald-800 flex items-center gap-2 mb-3">
                       <Lightbulb size={24} /> Método de Feynman (Analogia)
                     </p>
                     <p className="text-emerald-900 italic">"Pense na divergência doutrinária como uma receita de bolo: Hely quer assar a 180° e Di Pietro a 200°. Na hora da prova, lembre-se que o STJ come o bolo mais tostado (Di Pietro)."</p>
                   </div>
                 </div>
               </section>

               {/* Card 2 */}
               <section className="bg-white p-10 rounded-3xl shadow-xl border-t-8 border-blue-500">
                 <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                   <Database className="text-blue-500" /> 2. Esquematizando
                 </h3>
                 <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="table-auto w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="p-4 font-bold text-slate-700">Conceito A</th>
                          <th className="p-4 font-bold text-slate-700">Conceito B</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-100">
                          <td className="p-4 text-slate-600">Característica 1 do conceito A</td>
                          <td className="p-4 text-slate-600">Característica 1 do conceito B</td>
                        </tr>
                        <tr>
                          <td className="p-4 text-slate-600">Exceção à regra geral</td>
                          <td className="p-4 text-slate-600">Regra absoluta (não admite exceção)</td>
                        </tr>
                      </tbody>
                    </table>
                 </div>
               </section>

               {/* Card 3 */}
               <section className="bg-white p-10 rounded-3xl shadow-xl border-t-8 border-purple-500">
                 <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                   <Brain className="text-purple-500" /> 3. Mapa Mental
                 </h3>
                 <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 flex flex-col items-center justify-center min-h-[300px]">
                   <code className="text-sm font-mono text-slate-500 bg-slate-200 p-2 rounded mb-4">Suporte ao Mermaid.js será renderizado aqui</code>
                   <div className="w-full text-center italic text-slate-400">
                      graph TD;<br/>A--&gt;B;<br/>A--&gt;C;<br/>B--&gt;D;<br/>C--&gt;D;
                   </div>
                 </div>
               </section>

               {/* Card 4 */}
               <section className="bg-white p-10 rounded-3xl shadow-xl border-t-8 border-yellow-500">
                 <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                   <Scale className="text-yellow-500" /> 4. Base Legal Comentada
                 </h3>
                 <div className="space-y-6">
                   <div className="bg-yellow-50/50 p-6 rounded-2xl border-l-4 border-yellow-400">
                      <p className="font-bold text-yellow-900 mb-2">Art. 5º, XLV, CF/88</p>
                      <p className="text-slate-800 leading-relaxed italic">"Nenhuma pena passará da pessoa do condenado..."</p>
                   </div>
                   <p className="text-slate-700 font-medium">Comentário: Este é o famoso princípio da intranscendência.</p>
                   <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-200">
                     <p className="font-bold text-emerald-800 flex items-center gap-2 mb-3">
                       <Lightbulb size={24} /> Método de Feynman
                     </p>
                     <p className="text-emerald-900 italic">"Seu pai não pode ir para a cadeia no seu lugar. Mas se você deve dinheiro à vítima e morre, a dívida é paga com a herança que você deixou."</p>
                   </div>
                 </div>
               </section>

               {/* Card 5 */}
               <section className="bg-white p-10 rounded-3xl shadow-xl border-t-8 border-red-500">
                 <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                   <AlertTriangle className="text-red-500" /> 5. Doutrina e Jurisprudência
                 </h3>
                 <div className="space-y-6">
                   <div className="bg-red-50 p-6 rounded-2xl border border-red-200 relative overflow-hidden">
                     <div className="absolute top-0 right-0 bg-red-500 text-white font-bold text-xs px-3 py-1 pb-2 rounded-bl-xl">STF - Info 1234</div>
                     <p className="font-bold text-red-900 mt-2 mb-3">Tese X é Constitucional</p>
                     <p className="text-red-800 leading-relaxed">Em decisão recente, o STF firmou tese de que a prática Y não ofende o princípio Z.</p>
                   </div>
                   <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-200">
                     <p className="font-bold text-emerald-800 flex items-center gap-2 mb-3">
                       <Lightbulb size={24} /> Método de Feynman
                     </p>
                     <p className="text-emerald-900 italic">"Grave: o STF mudou de ideia em 2023. Antes não podia, agora PODE."</p>
                   </div>
                 </div>
               </section>

               {/* Card 6 */}
               <section className="bg-white p-10 rounded-3xl shadow-xl border-t-8 border-orange-500">
                 <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                   <Target className="text-orange-500" /> 6. Pegadinhas da Banca
                 </h3>
                 <ul className="space-y-4">
                   <li className="flex items-start gap-4">
                     <span className="text-orange-500 font-bold block mt-1">⚠️</span>
                     <p className="text-slate-800">Cuidado com a palavra <strong>"sempre"</strong> ao descrever o prazo X. Existem 3 exceções (A, B e C).</p>
                   </li>
                   <li className="flex items-start gap-4">
                     <span className="text-orange-500 font-bold block mt-1">⚠️</span>
                     <p className="text-slate-800">A banca Cebraspe costuma trocar os conceitos de <strong>remissão</strong> e <strong>remição</strong>.</p>
                   </li>
                 </ul>
               </section>

               {/* Card 7 */}
               <section className="bg-white p-10 rounded-3xl shadow-xl border-t-8 border-cyan-500">
                 <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                   <HelpCircle className="text-cyan-500" /> 7. FAQ (Dúvidas Complexas)
                 </h3>
                 <div className="space-y-6">
                   <div className="border border-slate-200 rounded-2xl p-6 pb-4">
                     <p className="font-bold text-slate-800 text-lg mb-2">P: Por que o conceito A não se aplica ao caso B?</p>
                     <p className="text-slate-600">R: Porque o caso B pressupõe o requisito C, o qual é incompatível com a natureza jurídica do conceito A.</p>
                   </div>
                 </div>
               </section>

               {/* Card 8 */}
               <section className="bg-white p-10 rounded-3xl shadow-xl border-t-8 border-pink-500">
                 <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                   <FileCheck className="text-pink-500" /> 8. Síntese 80/20
                 </h3>
                 <ul className="list-disc list-inside space-y-3 text-slate-700 font-medium ml-2">
                   <li>Ponto 1 ultra focalizado.</li>
                   <li>O STJ entende que NÃO é possível a aplicação.</li>
                   <li>A multa no caso de reincidência sofre o DOBRO de aumento.</li>
                 </ul>
               </section>

               {/* Card 9 */}
               <section className="bg-white p-10 rounded-3xl shadow-xl border-t-8 border-lime-500">
                 <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                   <Lightbulb className="text-lime-500" /> 9. Estudo Ativo (Questões)
                 </h3>
                 <div className="space-y-6">
                   <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                     <p className="font-bold text-slate-800 mb-4">Questão 1: (Inédita) João, servidor público, pratica o ato Y. Levando em conta o entendimento mais recente do STF, João responderá por:</p>
                     <div className="space-y-2 mb-6 ml-2">
                       <p className="text-slate-600">a) Peculato</p>
                       <p className="text-slate-600">b) Prevaricação</p>
                       <p className="text-slate-600">c) Corrupção Passiva</p>
                       <p className="text-slate-600">d) Nenhuma conduta típica</p>
                     </div>
                     <details className="bg-white border text-base border-slate-300 rounded-xl p-4 cursor-pointer">
                       <summary className="font-bold text-slate-800 outline-none">Mostrar Gabarito e Comentário</summary>
                       <div className="mt-4 text-slate-700 pt-4 border-t border-slate-200">
                         <strong>Gabarito: Letra C.</strong>
                         <p className="mt-2">Comentário: Segundo o novo informativo 1234, o ato Y configura corrupção passiva.</p>
                       </div>
                     </details>
                   </div>
                 </div>
               </section>

               {/* Card 10 */}
               <section className="bg-white p-10 rounded-3xl shadow-xl border-t-8 border-teal-500">
                 <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                   <Database className="text-teal-500" /> 10. Flashcards para Anki
                 </h3>
                 <textarea 
                   readOnly
                   className="w-full h-32 bg-slate-800 text-slate-100 font-mono text-sm rounded-2xl p-6 outline-none resize-none"
                   value={"Qual o princípio aplicável no caso X?;Princípio Y.\nA súmula 691 do STF admite mitigação?;Sim, em casos de manifesta teratologia."}
                 />
                 <p className="text-sm text-slate-500 mt-3 font-medium">Copie este texto e importe diretamente no seu deck do Anki (Campos separados por ponto e vírgula).</p>
               </section>

               {/* Card 11 */}
               <section className="bg-white p-10 rounded-3xl shadow-xl border-t-8 border-neutral-800">
                 <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                   <Target className="text-neutral-800" /> 11. Controle de Revisões
                 </h3>
                 <div className="flex flex-col md:flex-row gap-6">
                   <label className="flex items-center gap-3 bg-slate-50 p-6 rounded-2xl border border-slate-200 flex-1 cursor-pointer hover:bg-slate-100 transition-colors">
                     <input type="checkbox" className="w-6 h-6 rounded text-indigo-600 focus:ring-indigo-500" />
                     <span className="font-bold text-slate-700 text-lg">24 Horas</span>
                   </label>
                   <label className="flex items-center gap-3 bg-slate-50 p-6 rounded-2xl border border-slate-200 flex-1 cursor-pointer hover:bg-slate-100 transition-colors">
                     <input type="checkbox" className="w-6 h-6 rounded text-indigo-600 focus:ring-indigo-500" />
                     <span className="font-bold text-slate-700 text-lg">7 Dias</span>
                   </label>
                   <label className="flex items-center gap-3 bg-slate-50 p-6 rounded-2xl border border-slate-200 flex-1 cursor-pointer hover:bg-slate-100 transition-colors">
                     <input type="checkbox" className="w-6 h-6 rounded text-indigo-600 focus:ring-indigo-500" />
                     <span className="font-bold text-slate-700 text-lg">30 Dias</span>
                   </label>
                 </div>
               </section>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
