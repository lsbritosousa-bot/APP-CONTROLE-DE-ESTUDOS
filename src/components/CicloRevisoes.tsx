import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from './AuthProvider';
import { db } from '../firebase';
import { collection, onSnapshot, query } from '../lib/firestoreSupabase';
import { Subject } from '../types';
import { cn } from '../lib/utils';
import {
  RotateCcw, CheckCircle2, Clock, Plus, Trash2,
  TrendingUp, Target, Calendar, X, Zap, BookOpen, AlertTriangle,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

type RevisionStatus = 'pending' | 'done' | 'overdue';
type RevisionType = 'R24h' | 'R7d' | 'R30d';

interface RevisionItem {
  id: string;
  type: RevisionType;
  dueDate: string;
  completedAt?: string;
  questionsTotal?: number;
  questionsCorrect?: number;
  accuracy?: number;
  status: RevisionStatus;
}

interface ReviewCycle {
  id: string;
  subjectId: string;
  subjectName: string;
  topicName: string;
  studyDate: string;
  createdAt: string;
  revisions: [RevisionItem, RevisionItem, RevisionItem];
  inRecovery: boolean;
  lastAccuracy?: number;
}

type QModalMode = 'complete' | 'recovery';

interface QModalState {
  cycleId: string;
  revId?: string;
  mode: QModalMode;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'study_reviews_cycle';

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function addDaysToDate(date: string, days: number): string {
  return format(addDays(parseISO(date + 'T00:00:00'), days), 'yyyy-MM-dd');
}

function refreshStatuses(cycle: ReviewCycle): ReviewCycle {
  const today = getToday();
  return {
    ...cycle,
    revisions: cycle.revisions.map(r => {
      if (r.status === 'done') return r;
      if (r.dueDate <= today) return { ...r, status: 'overdue' as RevisionStatus };
      return r;
    }) as [RevisionItem, RevisionItem, RevisionItem]
  };
}

function loadCycles(): ReviewCycle[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as ReviewCycle[]).map(refreshStatuses);
  } catch {
    return [];
  }
}

function saveCycles(cycles: ReviewCycle[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cycles));
}

const TYPE_LABELS: Record<RevisionType, string> = {
  R24h: '24h — Estudo Ativo (Resumos)',
  R7d: '7 dias — Consolidação (Flashcards)',
  R30d: '30 dias — Engenharia Reversa (Questões)',
};

const TYPE_COLORS: Record<RevisionType, string> = {
  R24h: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  R7d: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  R30d: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const RevTypeBadge = ({ type }: { type: RevisionType }) => (
  <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border', TYPE_COLORS[type])}>
    {type}
  </span>
);

const StatusBadge = ({ status, accuracy }: { status: RevisionStatus | 'recovery'; accuracy?: number }) => {
  if (status === 'done') return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-500 border border-green-500/20">
      {accuracy !== undefined ? `✓ ${accuracy}%` : '✓ Feito'}
    </span>
  );
  if (status === 'overdue') return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
      ⏰ Atrasada
    </span>
  );
  if (status === 'recovery') return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
      🔴 Recuperação
    </span>
  );
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border border-border">
      ⏳ Agendada
    </span>
  );
};

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  variant?: 'primary' | 'green' | 'red' | 'yellow';
}

const MetricCard = ({ icon: Icon, label, value, sub, variant = 'primary' }: MetricCardProps) => {
  const iconBg = { primary: 'bg-primary/10', green: 'bg-green-500/10', red: 'bg-red-500/10', yellow: 'bg-yellow-500/10' }[variant];
  const textColor = { primary: 'text-primary', green: 'text-green-500', red: 'text-red-500', yellow: 'text-yellow-500' }[variant];
  return (
    <div className="bg-card border border-border p-5 rounded-2xl space-y-3">
      <div className={cn('inline-flex p-2 rounded-xl', iconBg)}>
        <Icon size={18} className={textColor} />
      </div>
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
        <p className={cn('text-3xl font-black mt-0.5', textColor)}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const CicloRevisoes = () => {
  const { profile } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'urgent' | 'today' | 'done'>('urgent');

  // Scheduler form
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formTopicName, setFormTopicName] = useState('');
  const [formStudyDate, setFormStudyDate] = useState(getToday());
  const [showForm, setShowForm] = useState(true);

  // Q-entry modal
  const [qModal, setQModal] = useState<QModalState | null>(null);
  const [qTotal, setQTotal] = useState('');
  const [qCorrect, setQCorrect] = useState('');

  // Table expand
  const [expandedCycleId, setExpandedCycleId] = useState<string | null>(null);

  // Load subjects from Firestore
  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'users', profile.uid, 'subjects'));
    return onSnapshot(q, (snapshot) => {
      const subs = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as Subject))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setSubjects(subs);
      if (subs.length > 0) setFormSubjectId(prev => prev || subs[0].id);
    });
  }, [profile]);

  // Load from localStorage on mount
  useEffect(() => {
    setCycles(loadCycles());
  }, []);

  const persistCycles = (newCycles: ReviewCycle[]) => {
    const refreshed = newCycles.map(refreshStatuses);
    setCycles(refreshed);
    saveCycles(refreshed);
  };

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleStartCycle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSubjectId || !formTopicName.trim()) return;
    const subject = subjects.find(s => s.id === formSubjectId);
    if (!subject) return;
    const today = getToday();
    const r24Due = addDaysToDate(formStudyDate, 1);
    const r7Due  = addDaysToDate(formStudyDate, 7);
    const r30Due = addDaysToDate(formStudyDate, 30);
    const cycleId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newCycle: ReviewCycle = {
      id: cycleId,
      subjectId: subject.id,
      subjectName: subject.name,
      topicName: formTopicName.trim(),
      studyDate: formStudyDate,
      createdAt: new Date().toISOString(),
      inRecovery: false,
      revisions: [
        { id: `${cycleId}_r24`, type: 'R24h', dueDate: r24Due, status: r24Due < today ? 'overdue' : 'pending' },
        { id: `${cycleId}_r7`,  type: 'R7d',  dueDate: r7Due,  status: r7Due  < today ? 'overdue' : 'pending' },
        { id: `${cycleId}_r30`, type: 'R30d', dueDate: r30Due, status: r30Due < today ? 'overdue' : 'pending' },
      ]
    };
    persistCycles([...cycles, newCycle]);
    setFormTopicName('');
    setFormStudyDate(today);
  };

  const handleComplete = (cycleId: string, rev: RevisionItem) => {
    if (rev.type === 'R30d') {
      setQModal({ cycleId, revId: rev.id, mode: 'complete' });
      setQTotal(''); setQCorrect('');
    } else {
      const updated = cycles.map(c => c.id !== cycleId ? c : {
        ...c,
        revisions: c.revisions.map(r =>
          r.id !== rev.id ? r : { ...r, status: 'done' as RevisionStatus, completedAt: getToday() }
        ) as [RevisionItem, RevisionItem, RevisionItem]
      });
      persistCycles(updated);
    }
  };

  const handleOpenQModal = (cycleId: string, rev: RevisionItem) => {
    setQModal({ cycleId, revId: rev.id, mode: 'complete' });
    setQTotal(''); setQCorrect('');
  };

  const handleOpenRecovery = (cycleId: string) => {
    setQModal({ cycleId, mode: 'recovery' });
    setQTotal(''); setQCorrect('');
  };

  const computeQResult = () => {
    const total   = Math.max(0, parseInt(qTotal)   || 0);
    const correct = Math.max(0, Math.min(total, parseInt(qCorrect) || 0));
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { total, correct, accuracy };
  };

  const handleSaveQModal = () => {
    if (!qModal) return;
    const { total, correct, accuracy } = computeQResult();
    const failsThreshold = accuracy < 80;

    if (qModal.mode === 'recovery') {
      const updated = cycles.map(c =>
        c.id !== qModal.cycleId ? c : { ...c, inRecovery: failsThreshold, lastAccuracy: accuracy }
      );
      persistCycles(updated);
    } else {
      const updated = cycles.map(c => {
        if (c.id !== qModal.cycleId) return c;
        return {
          ...c,
          inRecovery: failsThreshold,
          lastAccuracy: accuracy,
          revisions: c.revisions.map(r =>
            r.id !== qModal.revId ? r : {
              ...r,
              status: 'done' as RevisionStatus,
              completedAt: getToday(),
              questionsTotal: total,
              questionsCorrect: correct,
              accuracy
            }
          ) as [RevisionItem, RevisionItem, RevisionItem]
        };
      });
      persistCycles(updated);
    }
    setQModal(null);
  };

  const handleDeleteCycle = (cycleId: string) => {
    if (!window.confirm('Remover este ciclo de revisão?')) return;
    persistCycles(cycles.filter(c => c.id !== cycleId));
  };

  // ── Computed ────────────────────────────────────────────────────────────────

  const today = getToday();

  const allFlatRevisions = useMemo(() =>
    cycles.flatMap(c => c.revisions.map(r => ({ ...r, cycle: c }))),
    [cycles]
  );

  const urgentRevisions = useMemo(() =>
    allFlatRevisions.filter(r => r.status === 'overdue'),
    [allFlatRevisions]
  );

  const recoveryCycles = useMemo(() =>
    cycles.filter(c => c.inRecovery),
    [cycles]
  );

  const todayRevisions = useMemo(() =>
    allFlatRevisions.filter(r => r.dueDate === today && r.status === 'pending'),
    [allFlatRevisions, today]
  );

  const doneTodayRevisions = useMemo(() =>
    allFlatRevisions.filter(r => r.completedAt === today),
    [allFlatRevisions, today]
  );

  const metrics = useMemo(() => {
    const done    = allFlatRevisions.filter(r => r.status === 'done');
    const overdue = allFlatRevisions.filter(r => r.status === 'overdue');
    const withAcc = done.filter(r => r.accuracy !== undefined);
    const avgRetention = withAcc.length > 0
      ? Math.round(withAcc.reduce((s, r) => s + (r.accuracy ?? 0), 0) / withAcc.length)
      : 0;
    const totalScheduled = done.length + overdue.length;
    const onTime = done.filter(r => r.completedAt && r.completedAt <= r.dueDate).length;
    const consistencyIdx = totalScheduled > 0 ? Math.round((onTime / totalScheduled) * 100) : 0;
    return {
      avgRetention,
      consistencyIdx,
      totalDone: done.length,
      pendingToday: todayRevisions.length,
      inRecovery: recoveryCycles.length,
    };
  }, [allFlatRevisions, todayRevisions, recoveryCycles]);

  const urgentCount = urgentRevisions.length + recoveryCycles.length;

  // live accuracy preview
  const qPreview = useMemo(() => {
    const t = parseInt(qTotal) || 0;
    const c = parseInt(qCorrect) || 0;
    if (t <= 0) return null;
    const acc = Math.round((Math.min(c, t) / t) * 100);
    return { acc, ok: acc >= 80 };
  }, [qTotal, qCorrect]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      {/* Header */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <span className="inline-flex p-2 bg-primary/10 text-primary rounded-xl">
            <RotateCcw size={24} />
          </span>
          Ciclo de Revisões
        </h1>
        <p className="text-muted-foreground mt-1">
          Repetição Espaçada + Engenharia Reversa — metodologia dos aprovados de alto rendimento.
        </p>
      </header>

      {/* ── Mini-Dashboard ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={TrendingUp}
          label="Taxa de Retenção Média (Gh)"
          value={`${metrics.avgRetention}%`}
          sub="Média de acerto nas questões"
          variant={metrics.avgRetention >= 80 ? 'green' : metrics.avgRetention >= 60 ? 'yellow' : 'red'}
        />
        <MetricCard
          icon={Target}
          label="Índice de Consistência (Ic)"
          value={`${metrics.consistencyIdx}%`}
          sub="Revisões concluídas no prazo"
          variant={metrics.consistencyIdx >= 80 ? 'green' : metrics.consistencyIdx >= 50 ? 'yellow' : 'red'}
        />
        <MetricCard
          icon={CheckCircle2}
          label="Concluídas / Pendentes Hoje"
          value={`${metrics.totalDone} / ${metrics.pendingToday}`}
          sub="Total concluídas e pendentes hoje"
          variant="primary"
        />
        <MetricCard
          icon={AlertTriangle}
          label="Em Recuperação Ativa"
          value={metrics.inRecovery}
          sub="Assuntos com acerto < 80%"
          variant={metrics.inRecovery > 0 ? 'red' : 'green'}
        />
      </div>

      {/* ── Layout Principal ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Agendador de Novo Assunto */}
        <div className="xl:col-span-1">
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <button
              onClick={() => setShowForm(v => !v)}
              className="w-full flex items-center justify-between p-5 hover:bg-muted/40 transition-colors"
            >
              <h3 className="font-bold flex items-center gap-2 text-sm">
                <Plus size={16} className="text-primary" />
                Iniciar Novo Ciclo
              </h3>
              {showForm
                ? <ChevronUp size={16} className="text-muted-foreground" />
                : <ChevronDown size={16} className="text-muted-foreground" />
              }
            </button>

            <AnimatePresence>
              {showForm && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <form onSubmit={handleStartCycle} className="px-5 pb-5 space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Matéria</label>
                      {subjects.length > 0 ? (
                        <select
                          value={formSubjectId}
                          onChange={e => setFormSubjectId(e.target.value)}
                          className="w-full bg-muted border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 text-sm"
                        >
                          {subjects.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="bg-muted/50 border border-dashed border-border rounded-xl p-3 text-xs text-muted-foreground text-center">
                          Cadastre matérias na aba "Ciclo" primeiro.
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Assunto Estudado</label>
                      <input
                        type="text"
                        value={formTopicName}
                        onChange={e => setFormTopicName(e.target.value)}
                        placeholder="Ex: Teoria Geral do Crime"
                        className="w-full bg-muted border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 text-sm"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Data do Estudo Inicial</label>
                      <input
                        type="date"
                        value={formStudyDate}
                        onChange={e => setFormStudyDate(e.target.value)}
                        className="w-full bg-muted border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 text-sm"
                      />
                    </div>

                    {formStudyDate && (
                      <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-1 text-xs text-muted-foreground">
                        <p className="font-bold text-primary text-[11px] uppercase tracking-widest mb-2">Revisões geradas automaticamente:</p>
                        <p>📖 <span className="font-semibold text-foreground">R24h</span> — {addDaysToDate(formStudyDate, 1)}</p>
                        <p>🃏 <span className="font-semibold text-foreground">R7d</span>  — {addDaysToDate(formStudyDate, 7)}</p>
                        <p>🎯 <span className="font-semibold text-foreground">R30d</span> — {addDaysToDate(formStudyDate, 30)}</p>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={!formTopicName.trim() || !formSubjectId}
                      className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      <RotateCcw size={16} /> Iniciar Ciclo
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Painel Ativo de Revisões */}
        <div className="xl:col-span-2 space-y-4">
          {/* Sub-tabs */}
          <div className="flex gap-2 bg-muted/60 rounded-xl p-1">
            {(
              [
                { key: 'urgent', label: '🔴 Urgentes', count: urgentCount, activeCls: 'bg-red-500/20 text-red-400' },
                { key: 'today',  label: '🟡 Hoje',     count: todayRevisions.length, activeCls: 'bg-yellow-500/20 text-yellow-400' },
                { key: 'done',   label: '🟢 Concluídas', count: doneTodayRevisions.length, activeCls: 'bg-green-500/20 text-green-400' },
              ] as const
            ).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveSubTab(tab.key)}
                className={cn(
                  'flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                  activeSubTab === tab.key ? tab.activeCls + ' shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={cn(
                    'text-white px-1.5 py-0.5 rounded-full text-[9px]',
                    tab.key === 'urgent' ? 'bg-red-500' : tab.key === 'today' ? 'bg-yellow-500' : 'bg-green-500'
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="space-y-3 min-h-[200px]">
            <AnimatePresence mode="wait">

              {/* URGENTES */}
              {activeSubTab === 'urgent' && (
                <motion.div key="urgent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                  {urgentRevisions.length === 0 && recoveryCycles.length === 0 && (
                    <div className="text-center py-12 bg-muted/30 rounded-2xl border border-dashed border-border">
                      <CheckCircle2 size={32} className="text-green-500 mx-auto mb-2" />
                      <p className="text-sm font-medium text-muted-foreground">Nenhum item urgente! 🎉</p>
                    </div>
                  )}
                  {recoveryCycles.map(c => (
                    <motion.div key={`rec_${c.id}`} layout className="bg-red-500/5 border border-red-500/30 p-4 rounded-2xl">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">{c.subjectName}</span>
                            <StatusBadge status="recovery" />
                          </div>
                          <p className="font-semibold text-sm">{c.topicName}</p>
                          {c.lastAccuracy !== undefined && (
                            <p className="text-xs text-red-400 mt-1">Último acerto: {c.lastAccuracy}% — meta: ≥ 80%</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleOpenRecovery(c.id)}
                          className="shrink-0 px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold hover:bg-red-500/30 transition-colors whitespace-nowrap"
                        >
                          Registrar Questões
                        </button>
                      </div>
                    </motion.div>
                  ))}
                  {urgentRevisions.map(r => (
                    <motion.div key={r.id} layout className="bg-orange-500/5 border border-orange-500/30 p-4 rounded-2xl">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{r.cycle.subjectName}</span>
                            <RevTypeBadge type={r.type} />
                            <StatusBadge status="overdue" />
                          </div>
                          <p className="font-semibold text-sm">{r.cycle.topicName}</p>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Clock size={10} /> {TYPE_LABELS[r.type]} — venceu em {r.dueDate}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button onClick={() => handleComplete(r.cycle.id, r)} className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-bold hover:bg-primary/20 transition-colors">
                            Concluir
                          </button>
                          <button onClick={() => handleOpenQModal(r.cycle.id, r)} className="px-3 py-1.5 bg-muted text-muted-foreground border border-border rounded-lg text-xs font-bold hover:bg-muted/80 transition-colors">
                            + Questões
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {/* HOJE */}
              {activeSubTab === 'today' && (
                <motion.div key="today" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                  {todayRevisions.length === 0 && (
                    <div className="text-center py-12 bg-muted/30 rounded-2xl border border-dashed border-border">
                      <Calendar size={32} className="text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm font-medium text-muted-foreground">Nenhuma revisão para hoje.</p>
                    </div>
                  )}
                  {todayRevisions.map(r => (
                    <motion.div key={r.id} layout className="bg-yellow-500/5 border border-yellow-500/20 p-4 rounded-2xl">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{r.cycle.subjectName}</span>
                            <RevTypeBadge type={r.type} />
                          </div>
                          <p className="font-semibold text-sm">{r.cycle.topicName}</p>
                          <p className="text-xs text-muted-foreground mt-1">{TYPE_LABELS[r.type]}</p>
                        </div>
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button onClick={() => handleComplete(r.cycle.id, r)} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:opacity-90 transition-opacity">
                            Concluir
                          </button>
                          <button onClick={() => handleOpenQModal(r.cycle.id, r)} className="px-3 py-1.5 bg-muted text-muted-foreground border border-border rounded-lg text-xs font-bold hover:bg-muted/80 transition-colors">
                            + Questões
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {/* CONCLUÍDAS HOJE */}
              {activeSubTab === 'done' && (
                <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                  {doneTodayRevisions.length === 0 && (
                    <div className="text-center py-12 bg-muted/30 rounded-2xl border border-dashed border-border">
                      <BookOpen size={32} className="text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm font-medium text-muted-foreground">Nenhuma revisão concluída hoje.</p>
                    </div>
                  )}
                  {doneTodayRevisions.map(r => (
                    <motion.div key={r.id} layout className="bg-green-500/5 border border-green-500/20 p-4 rounded-2xl">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{r.cycle.subjectName}</span>
                            <RevTypeBadge type={r.type} />
                            <StatusBadge status="done" accuracy={r.accuracy} />
                          </div>
                          <p className="font-semibold text-sm">{r.cycle.topicName}</p>
                          {r.questionsTotal !== undefined && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {r.questionsCorrect}/{r.questionsTotal} acertos ({r.accuracy}%)
                              {r.accuracy !== undefined && r.accuracy < 80 && (
                                <span className="text-red-400 ml-1">⚠ abaixo da meta</span>
                              )}
                            </p>
                          )}
                        </div>
                        <CheckCircle2 size={20} className="text-green-500 shrink-0" />
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Tabela de Controle Geral ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Zap size={18} className="text-primary" />
            Controle Geral do Ciclo
          </h2>
          <span className="text-xs text-muted-foreground">{cycles.length} assunto(s) monitorado(s)</span>
        </div>

        {cycles.length === 0 ? (
          <div className="text-center py-16 bg-muted/20 rounded-2xl border border-dashed border-border">
            <RotateCcw size={36} className="text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold text-muted-foreground">Nenhum ciclo iniciado ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">Use o formulário acima para começar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...cycles].reverse().map(cycle => {
              const isExpanded = expandedCycleId === cycle.id;
              const nextPending = cycle.revisions.find(r => r.status !== 'done');
              return (
                <motion.div key={cycle.id} layout className={cn(
                  'bg-card border rounded-2xl overflow-hidden',
                  cycle.inRecovery ? 'border-red-500/30' : 'border-border'
                )}>
                  <button
                    onClick={() => setExpandedCycleId(isExpanded ? null : cycle.id)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{cycle.subjectName}</span>
                        {cycle.inRecovery && <StatusBadge status="recovery" />}
                        {!cycle.inRecovery && nextPending && (
                          <span className={cn(
                            'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                            nextPending.dueDate === today
                              ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                              : nextPending.status === 'overdue'
                              ? 'bg-red-500/10 text-red-500 border-red-500/20'
                              : 'bg-muted text-muted-foreground border-border'
                          )}>
                            {nextPending.dueDate === today
                              ? '⚡ Disponível hoje'
                              : nextPending.status === 'overdue'
                              ? '⏰ Atrasada'
                              : `Próx: ${nextPending.dueDate}`}
                          </span>
                        )}
                        {!cycle.inRecovery && !nextPending && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-500 border border-green-500/20">
                            ✅ Ciclo Completo
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-sm mt-0.5 truncate">{cycle.topicName}</p>
                      <p className="text-xs text-muted-foreground">Estudo: {cycle.studyDate}</p>
                    </div>

                    {/* Progress dots */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {cycle.revisions.map(r => (
                        <span key={r.id} title={`${r.type}: ${r.status}`} className={cn(
                          'w-2.5 h-2.5 rounded-full',
                          r.status === 'done'
                            ? (r.accuracy !== undefined && r.accuracy < 80 ? 'bg-orange-500' : 'bg-green-500')
                            : r.status === 'overdue'
                            ? 'bg-red-500'
                            : r.dueDate === today
                            ? 'bg-yellow-400'
                            : 'bg-muted-foreground/30'
                        )} />
                      ))}
                    </div>

                    {isExpanded
                      ? <ChevronUp size={16} className="text-muted-foreground shrink-0" />
                      : <ChevronDown size={16} className="text-muted-foreground shrink-0" />
                    }
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-2 border-t border-border/50 pt-3">
                          {cycle.revisions.map(r => (
                            <div key={r.id} className="flex flex-wrap items-center gap-2 bg-muted/30 rounded-xl p-3">
                              <RevTypeBadge type={r.type} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium">{TYPE_LABELS[r.type]}</p>
                                <p className="text-[10px] text-muted-foreground">Vence: {r.dueDate}</p>
                              </div>
                              <StatusBadge status={r.status} accuracy={r.accuracy} />
                              {r.status !== 'done' && (
                                <button
                                  onClick={() => handleComplete(cycle.id, r)}
                                  className="px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg text-[10px] font-bold hover:bg-primary/20 transition-colors"
                                >
                                  Concluir
                                </button>
                              )}
                            </div>
                          ))}
                          <div className="flex justify-end pt-1">
                            <button
                              onClick={() => handleDeleteCycle(cycle.id)}
                              className="flex items-center gap-1 text-xs text-red-500/50 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={12} /> Remover ciclo
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Q Entry Modal ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {qModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => setQModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-border p-8 rounded-3xl shadow-2xl max-w-sm w-full space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Target size={18} className="text-primary" />
                  {qModal.mode === 'recovery' ? 'Recuperação Ativa' : 'Registrar Questões'}
                </h3>
                <button onClick={() => setQModal(null)} className="p-2 rounded-xl hover:bg-muted transition-colors">
                  <X size={18} />
                </button>
              </div>

              {qModal.mode === 'recovery' && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">
                  ⚠️ Resolva um bloco de questões. Se atingir ≥ 80%, este assunto sairá da recuperação.
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Questões Resolvidas</label>
                  <input
                    type="number" min="0"
                    value={qTotal}
                    onChange={e => setQTotal(e.target.value)}
                    placeholder="Ex: 20"
                    className="w-full bg-muted border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 text-sm"
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Acertos</label>
                  <input
                    type="number" min="0"
                    value={qCorrect}
                    onChange={e => setQCorrect(e.target.value)}
                    placeholder="Ex: 16"
                    className="w-full bg-muted border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary/20 text-sm"
                  />
                </div>

                {qPreview !== null && (
                  <div className={cn(
                    'rounded-xl p-3 text-center font-bold text-sm',
                    qPreview.ok ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                  )}>
                    Taxa de acerto: {qPreview.acc}%
                    {qPreview.ok ? ' ✅ Acima da meta!' : ' ⚠️ Entrará em recuperação'}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setQModal(null)} className="flex-1 py-3 rounded-xl border border-border font-bold hover:bg-muted transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleSaveQModal}
                  disabled={!qTotal || !qCorrect}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  Salvar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
