import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wand2, Copy, Printer, CheckCircle2, History as HistoryIcon, Target, AlertTriangle, BookOpen, Zap } from 'lucide-react';
import { distillContent, DistillationResult } from '../services/geminiService';
import { cn } from '../lib/utils';

interface HistoryItem {
  id: string;
  timestamp: string;
  rawContent: string;
  examBoard: string;
  result: DistillationResult;
}

const formatBoldText = (text: string) => {
  if (!text) return text;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const content = part.slice(2, -2);
      return <strong key={index} className="text-red-600 font-black">{content}</strong>;
    }
    return part;
  });
};

export const DistillationMentor = () => {
  const [content, setContent] = useState('');
  const [examBoard, setExamBoard] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<DistillationResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('distillation_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Erro ao ler historico', e);
      }
    }
  }, []);

  const saveToHistory = (newResult: DistillationResult) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      rawContent: content,
      examBoard,
      result: newResult
    };
    const newHistory = [newItem, ...history].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem('distillation_history', JSON.stringify(newHistory));
  };

  const handleDistill = async () => {
    if (!content.trim()) return;
    setIsProcessing(true);
    setResult(null);
    try {
      const res = await distillContent(content, examBoard);
      setResult(res);
      saveToHistory(res);
    } catch (error) {
      console.error(error);
      alert('Erro ao destilar conteúdo. Verifique sua conexão ou a formatação retornada.');
    } finally {
      setIsProcessing(false);
    }
  };

  const loadFromHistory = (item: HistoryItem) => {
    setContent(item.rawContent);
    setExamBoard(item.examBoard);
    setResult(item.result);
    setShowHistory(false);
  };

  const handleCopyAnki = () => {
    if (!result?.flashcard) return;
    const text = `Frente: ${result.flashcard.frente}\nVerso: ${result.flashcard.verso}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8 print:space-y-4 print:p-0"
    >
      <header className="print:hidden">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Wand2 className="text-primary" size={32} /> 
          Mentor de Destilação
        </h1>
        <p className="text-muted-foreground mt-2">Transforme textos brutos em cápsulas de alto rendimento com neurociência e IA.</p>
      </header>

      {/* Input Section - Hidden on Print */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:hidden">
        <section className="lg:col-span-2 space-y-4 relative">
          <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Target size={20} className="text-primary" />
                Conteúdo Bruto
              </h3>
              <button 
                onClick={() => setShowHistory(!showHistory)}
                className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
              >
                <HistoryIcon size={16} /> Histórico
              </button>
            </div>

            <AnimatePresence>
              {showHistory && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 bg-muted/50 rounded-xl border border-border/50 mb-4 max-h-60 overflow-y-auto space-y-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Últimas 10 Destilações</p>
                    {history.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Nenhum histórico salvo.</p>
                    ) : (
                      history.map((item) => (
                        <button 
                          key={item.id}
                          onClick={() => loadFromHistory(item)}
                          className="w-full text-left p-3 bg-background border border-border rounded-lg hover:border-primary/50 transition-colors"
                        >
                          <p className="text-sm font-bold truncate">{item.result?.raio_x}</p>
                          <p className="text-xs text-muted-foreground mt-1">Banca: {item.examBoard || 'Geral'} • {new Date(item.timestamp).toLocaleDateString()}</p>
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <input 
              type="text"
              value={examBoard}
              onChange={(e) => setExamBoard(e.target.value)}
              placeholder="Banca Examinadora Especifica? (Ex: CESPE, FGV) - Opcional"
              className="w-full bg-muted border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20"
            />
            
            <textarea 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Cole aqui a lei, questão ou doutrina de forma bruta..."
              className="w-full h-48 bg-muted border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 resize-none"
            />
            
            <button 
              onClick={handleDistill}
              disabled={isProcessing || !content.trim()}
              className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 text-lg shadow-lg shadow-primary/20"
            >
              {isProcessing ? (
                <>
                  <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Destilando Conteúdo...
                </>
              ) : (
                <>
                  <Wand2 size={24} /> Destilar
                </>
              )}
            </button>
          </div>
        </section>

        <aside className="lg:col-span-1 border border-border bg-card rounded-2xl p-6 hidden lg:block h-fit sticky top-24">
           <h4 className="font-bold uppercase tracking-widest text-muted-foreground text-xs mb-4">Como Funciona</h4>
           <div className="space-y-4 text-sm text-foreground/80">
             <p>A IA analisa o conteúdo bruto e extrai o núcleo duro da informação eliminando tudo que é redundante.</p>
             <p><strong className="text-blue-500">Resumo:</strong> Pontos principais isolados.</p>
             <p><strong className="text-yellow-500">Armadilhas:</strong> As pegadinhas comuns da banca mapeadas.</p>
             <p><strong className="text-orange-500">Gatilhos:</strong> Mnemônicos ou associações lógicas bizarras (que ativam a memória longa).</p>
             <p><strong className="text-red-500">Flashcard:</strong> Pronto para exportar pro Anki e fixar o tema.</p>
           </div>
        </aside>
      </div>

      {/* Result Section (Printable) */}
      <AnimatePresence>
        {result && (
          <motion.section 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6 pt-4 print:pt-0 print:text-black print:[&_*]:text-black"
            style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' as any }}
          >
            <div className="flex items-center justify-between print:hidden">
              <h2 className="text-2xl font-bold">Resultado da Destilação</h2>
              <button 
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 border border-border rounded-xl font-bold transition-colors text-sm"
              >
                <Printer size={18} /> Imprimir / PDF
              </button>
            </div>

            {/* Print Header */}
            <div className="hidden print:block text-center border-b border-border/50 pb-4 mb-6">
              <h1 className="text-2xl font-black">CÉREBRO POLICIAL</h1>
              <p className="text-sm">Mentor de Destilação - Resumo Autossuficiente</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-1 print:gap-4">
              
              {/* Raio X (Ocupa 2 colunas) */}
              <div className="md:col-span-2 bg-[#1e293b]/5 border-l-4 border-slate-500 p-6 rounded-r-2xl shadow-sm print:bg-slate-100 print:border-l-4">
                <div className="flex items-center gap-2 text-slate-500 font-bold uppercase tracking-widest text-xs mb-2">
                  <Zap size={16} /> Raio X
                </div>
                <p className="text-lg font-medium print:text-slate-900">{formatBoldText(result.raio_x)}</p>
              </div>

              {/* Resumo */}
              <div className="bg-blue-500/5 border-l-4 border-blue-600 p-6 rounded-r-2xl shadow-sm print:bg-blue-50 print:border-blue-600">
                <div className="flex items-center gap-2 text-blue-600 font-bold uppercase tracking-widest text-xs mb-4">
                  <BookOpen size={16} /> Resumo
                </div>
                <ul className="space-y-2">
                  {result.resumo.map((item, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span className="text-blue-500 print:text-blue-700 font-bold">•</span>
                      <span className="print:text-slate-900">{formatBoldText(item)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Armadilhas */}
              <div className="bg-yellow-500/5 border-l-4 border-yellow-500 p-6 rounded-r-2xl shadow-sm print:bg-yellow-50 print:border-yellow-500">
                <div className="flex items-center gap-2 text-yellow-600 font-bold uppercase tracking-widest text-xs mb-2">
                  <AlertTriangle size={16} /> Armadilhas da Banca
                </div>
                <p className="print:text-slate-900">{formatBoldText(result.armadilhas)}</p>
              </div>

              {/* Gatilho Menmônico (Ocupa 2 colunas) */}
              <div className="md:col-span-2 bg-orange-500/5 border-l-4 border-orange-600 p-6 rounded-r-2xl shadow-sm print:bg-orange-50 print:border-orange-600 print:break-inside-avoid">
                <div className="flex items-center gap-2 text-orange-600 font-bold uppercase tracking-widest text-xs mb-2">
                  <Wand2 size={16} /> Gatilho de Memória
                </div>
                <p className="text-lg italic font-medium print:text-slate-900">"{formatBoldText(result.gatilho)}"</p>
              </div>

              {/* Anki / Flashcard (Ocupa 2 colunas) */}
              <div className="md:col-span-2 bg-red-500/5 border-l-4 border-red-600 p-6 rounded-r-2xl shadow-sm print:bg-red-50 print:border-red-600 print:break-inside-avoid relative group">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-red-600 font-bold uppercase tracking-widest text-xs">
                    <Target size={16} /> Flashcard (Padrão Anki)
                  </div>
                  <button 
                    onClick={handleCopyAnki}
                    className="print:hidden text-red-600 bg-red-600/10 hover:bg-red-600/20 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold transition-colors"
                  >
                    {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                    {copied ? 'Copiado!' : 'Copiar para Anki'}
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-background/80 p-4 rounded-xl border border-red-500/20 print:bg-white print:border-red-300">
                    <p className="text-[10px] font-bold text-red-500 print:text-red-700 uppercase tracking-widest mb-1">Frente (Pergunta)</p>
                    <p className="font-medium print:text-slate-900">{formatBoldText(result.flashcard.frente)}</p>
                  </div>
                  <div className="bg-background/80 p-4 rounded-xl border border-red-500/20 print:bg-white print:border-red-300">
                    <p className="text-[10px] font-bold text-red-500 print:text-red-700 uppercase tracking-widest mb-1">Verso (Resposta)</p>
                    <p className="font-medium print:text-slate-900">{formatBoldText(result.flashcard.verso)}</p>
                  </div>
                </div>
              </div>

            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
