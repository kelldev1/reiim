import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  CalendarDays,
  CalendarClock,
  CalendarRange,
  ClipboardList,
  Timer,
  BarChart3,
  Sparkles,
  TrendingUp,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import { useBackground } from '@/lib/background';
import type { BackgroundShaderStyle } from '@/lib/background-theme';
import { useAuth } from '@/lib/auth';
import { listDevoirs, type Devoir } from '@/lib/devoirs';
import { listFriends } from '@/lib/friends';
import { SUBJECTS, METHODS } from '@/components/ui/visualize-booking';
import { Loader } from '@/components/ui/loader';

/* ------------------------------------------------------------------ helpers */

const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;

const subjectMeta = (v: string) => SUBJECTS.find((s) => s.value === v);
const methodLabel = (v: string) => METHODS.find((m) => m.value === v)?.label ?? v;

const DAY_MS = 86_400_000;
const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];
const MONTHS_ABBR = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

/* --------------------------------------------------------------------- KPIs */

type Accent = 'blue' | 'violet' | 'emerald' | 'amber';

const KpiCard: React.FC<{
  label: string;
  value: number;
  hint: string;
  accent: Accent;
  Icon: React.ComponentType<{ className?: string }>;
}> = ({ label, value, hint, accent, Icon }) => {
  // Low-opacity utilities read correctly on both the light and dark grounds.
  const accentCls = {
    blue: 'from-blue-500/20 to-blue-500/0 text-blue-500 border-blue-500/20',
    violet: 'from-violet-500/20 to-violet-500/0 text-violet-500 border-violet-500/20',
    emerald: 'from-emerald-500/20 to-emerald-500/0 text-emerald-500 border-emerald-500/20',
    amber: 'from-amber-500/20 to-amber-500/0 text-amber-500 border-amber-500/20',
  }[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative flex flex-col gap-4 rounded-2xl ui-card p-4 md:p-5 overflow-hidden"
    >
      <div
        className={`pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-br blur-3xl ${accentCls}`}
      />
      <div className="relative flex items-start justify-between">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br border ${accentCls}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full ui-chip px-2.5 py-0.5 text-[10px] font-medium">
          <div className="h-1.5 w-1.5 rounded-full bg-current opacity-40" />
          <span>{hint}</span>
        </div>
      </div>
      <div className="relative flex flex-col gap-1">
        <span className="text-xs md:text-sm font-medium text-muted">{label}</span>
        <span className="text-3xl md:text-4xl font-bold text-primary tabular-nums tracking-tight">
          {value.toLocaleString('fr-FR')}
        </span>
      </div>
    </motion.div>
  );
};

/* ------------------------------------------------------------- weekly chart */

type Week = { key: string; label: string; count: number; current: boolean };

const WeeklyBarChart: React.FC<{ weeks: Week[] }> = ({ weeks }) => {
  const max = Math.max(1, ...weeks.map((w) => w.count));
  const total = weeks.reduce((s, w) => s + w.count, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative flex h-full flex-col gap-4 rounded-2xl ui-card p-4 md:p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5 min-w-0">
          <h3 className="text-sm md:text-base font-semibold text-primary">Devoirs à venir par semaine</h3>
          <p className="text-xs text-muted">Les 8 prochaines semaines</p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full ui-chip px-3 py-1.5 shrink-0 text-[11px]">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>{total} au total</span>
        </div>
      </div>

      <div className="relative h-48 md:h-56 w-full mt-2">
        {total === 0 && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 pointer-events-none z-10">
            <div className="h-10 w-10 rounded-full ui-border border ui-soft-fill flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-muted-soft" />
            </div>
            <p className="text-sm text-muted text-center">Rien de planifié pour l'instant</p>
          </div>
        )}

        <div className="relative h-full w-full flex items-end justify-between gap-2 md:gap-3 px-1">
          {weeks.map((w, i) => (
            <div key={w.key} className="flex flex-1 flex-col items-center gap-2 h-full">
              <div className="relative flex-1 w-full flex items-end">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(w.count ? 8 : 3, (w.count / max) * 100)}%` }}
                  transition={{ delay: i * 0.05, duration: 0.5, ease: 'easeOut' }}
                  className={cn(
                    'relative w-full rounded-t-lg rounded-b-md border overflow-hidden',
                    w.current
                      ? 'bg-primary/25 border-primary/30'
                      : 'ui-soft-fill ui-border',
                  )}
                >
                  {w.count > 0 && (
                    <span className="absolute inset-x-0 top-1 text-center text-[10px] font-semibold text-primary tabular-nums">
                      {w.count}
                    </span>
                  )}
                </motion.div>
              </div>
              <div
                className={cn(
                  'text-[10px] md:text-[11px] font-medium tabular-nums',
                  w.current ? 'text-primary' : 'text-muted-soft',
                )}
              >
                {w.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

/* -------------------------------------------------------------- subject mix */

type SubjectSlice = { value: string; label: string; color: string; count: number };

const SubjectDonut: React.FC<{ subjects: SubjectSlice[]; total: number }> = ({ subjects, total }) => {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="relative flex h-full flex-col gap-4 rounded-2xl ui-card p-4 md:p-5"
    >
      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm md:text-base font-semibold text-primary">Répartition par matière</h3>
        <p className="text-xs text-muted">
          {total === 0 ? 'Aucune donnée disponible' : `${subjects.length} matière${subjects.length > 1 ? 's' : ''}`}
        </p>
      </div>

      <div className="grid grid-cols-[auto,1fr] gap-5 items-center">
        <div className="relative h-28 w-28 md:h-32 md:w-32 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r={radius} fill="none" className="text-muted-soft/25" stroke="currentColor" strokeWidth="14" />
            {subjects.map((s) => {
              const length = total > 0 ? (s.count / total) * circumference : 0;
              const node = (
                <circle
                  key={s.value}
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="14"
                  strokeDasharray={`${Math.max(0, length - 1)} ${circumference}`}
                  strokeDashoffset={-offset}
                  opacity={0.85}
                />
              );
              offset += length;
              return node;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-center">
            <span className="text-2xl font-bold text-primary tabular-nums">{total}</span>
            <span className="text-[11px] text-muted">devoir{total > 1 ? 's' : ''}</span>
          </div>
        </div>

        {subjects.length === 0 ? (
          <p className="text-xs text-muted-soft">
            Les matières de tes devoirs apparaîtront ici.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {subjects.slice(0, 5).map((s) => (
              <li key={s.value} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-xs md:text-sm text-muted truncate">{s.label}</span>
                </div>
                <span className="text-xs font-medium text-muted-soft tabular-nums">
                  {total > 0 ? Math.round((s.count / total) * 100) : 0}%
                </span>
              </li>
            ))}
            {subjects.length > 5 && (
              <li className="text-[11px] text-muted-soft">+ {subjects.length - 5} autre(s)</li>
            )}
          </ul>
        )}
      </div>
    </motion.div>
  );
};

/* ----------------------------------------------------------- upcoming list */

const UpcomingList: React.FC<{ devoirs: Devoir[]; onGoToCalendar?: () => void }> = ({
  devoirs,
  onGoToCalendar,
}) => {
  const rows = devoirs.slice(0, 6);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="relative flex h-full flex-col gap-3 rounded-2xl ui-card p-4 md:p-5 overflow-hidden"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5 min-w-0">
          <h3 className="text-sm md:text-base font-semibold text-primary">Prochains devoirs</h3>
          <p className="text-xs text-muted">
            {devoirs.length === 0
              ? 'Aucun devoir à venir'
              : `${devoirs.length} devoir${devoirs.length > 1 ? 's' : ''} planifié${devoirs.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={onGoToCalendar}
          className="inline-flex items-center gap-1.5 rounded-lg ui-chip px-3 py-1.5 text-[11px] font-medium hover:ui-soft-fill-strong hover:text-primary transition-colors shrink-0"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          <span>Calendrier</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl ui-border border ui-soft-fill py-8 md:py-10 flex flex-col items-center justify-center gap-3 mt-1">
          <div className="h-12 w-12 rounded-2xl ui-border border flex items-center justify-center ui-soft-fill-strong">
            <CalendarDays className="h-6 w-6 text-muted-soft" />
          </div>
          <div className="flex flex-col items-center gap-1 text-center px-4">
            <p className="text-sm md:text-base font-medium text-muted">Planifie ton prochain devoir</p>
            <p className="text-xs text-muted-soft max-w-sm">
              Glisse un jour dans le calendrier, choisis la matière et la méthode — il apparaîtra ici.
            </p>
          </div>
          <button
            onClick={onGoToCalendar}
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-primary/90 px-3 py-1.5 text-[11px] font-medium text-[rgb(var(--color-bg))] hover:bg-primary transition-colors"
          >
            Ouvrir le calendrier <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5 mt-1">
          {rows.map((d) => {
            const meta = subjectMeta(d.subject);
            const day = new Date(`${d.date}T00:00:00`);
            return (
              <li key={d.id}>
                <button
                  onClick={onGoToCalendar}
                  className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:ui-soft-fill"
                >
                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl ui-border border ui-soft-fill">
                    <span className="text-sm font-bold text-primary tabular-nums leading-none">
                      {day.getDate()}
                    </span>
                    <span className="text-[9px] uppercase text-muted-soft leading-none mt-0.5">
                      {MONTHS_ABBR[day.getMonth()]}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: meta?.color ?? '#8b8b8b' }}
                      />
                      <span className="truncate text-sm font-medium text-primary">
                        {meta?.label ?? d.subject}
                      </span>
                      {d.shared && (
                        <span className="shrink-0 rounded px-1 text-[9px] font-semibold uppercase text-muted-soft ui-soft-fill">
                          partagé
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-muted-soft">
                      {d.methods.map(methodLabel).join(' · ') || 'Aucune méthode'}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-soft transition-transform group-hover:translate-x-0.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </motion.div>
  );
};

/* -------------------------------------------------------------- month heatmap */

type Cell = { empty: true } | { empty: false; day: number; color?: string; isToday: boolean };

const MiniHeatmap: React.FC<{ cells: Cell[]; monthLabel: string; activeDays: number }> = ({
  cells,
  monthLabel,
  activeDays,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: 0.15 }}
    className="relative flex h-full flex-col gap-3 rounded-2xl ui-card p-4 md:p-5"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-1.5 min-w-0">
        <h3 className="text-sm md:text-base font-semibold text-primary capitalize">{monthLabel}</h3>
        <p className="text-xs text-muted">
          {activeDays === 0
            ? 'Aucun jour avec un devoir'
            : `${activeDays} jour${activeDays > 1 ? 's' : ''} avec un devoir`}
        </p>
      </div>
      <div className="flex h-9 w-9 items-center justify-center rounded-xl ui-border border ui-soft-fill">
        <CalendarRange className="h-4 w-4 text-muted-soft" />
      </div>
    </div>

    <div className="grid grid-cols-7 gap-1.5 md:gap-2">
      {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
        <div key={i} className="flex h-3 items-center justify-center text-[10px] font-medium text-muted-soft">
          {d}
        </div>
      ))}
      {cells.map((c, i) =>
        c.empty ? (
          <div key={i} className="aspect-square" />
        ) : (
          <div
            key={i}
            title={c.color ? `Le ${c.day} — devoir planifié` : `Le ${c.day}`}
            className={cn(
              'aspect-square rounded-md flex items-center justify-center text-[9px] md:text-[10px] font-medium tabular-nums',
              c.color ? 'text-primary' : 'text-muted-soft ui-soft-fill',
              c.isToday && 'ring-1 ring-primary/60',
            )}
            style={c.color ? { backgroundColor: `${c.color}59` } : undefined}
          >
            {c.day}
          </div>
        ),
      )}
    </div>
  </motion.div>
);

/* -------------------------------------------------------------- method mix */

type MethodSlice = { value: string; label: string; count: number };

const MethodsCard: React.FC<{ methods: MethodSlice[] }> = ({ methods }) => {
  const max = Math.max(1, ...methods.map((m) => m.count));
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="relative flex flex-col gap-4 rounded-2xl ui-card p-4 md:p-5"
    >
      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm md:text-base font-semibold text-primary">Méthodes d'apprentissage</h3>
        <p className="text-xs text-muted">Ce que tu utilises le plus pour travailler</p>
      </div>
      <ul className="flex flex-col gap-2.5">
        {methods.map((m) => (
          <li key={m.value} className="flex items-center gap-3">
            <span className="w-40 shrink-0 truncate text-xs md:text-sm text-muted">{m.label}</span>
            <div className="h-2 flex-1 rounded-full ui-soft-fill overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(m.count / max) * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="h-full rounded-full bg-primary/30"
              />
            </div>
            <span className="w-6 shrink-0 text-right text-xs font-medium text-muted-soft tabular-nums">
              {m.count}
            </span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
};

/* ---------------------------------------------- background customization ui */

const ColorField: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <div>
    <label className="block text-sm font-medium text-muted mb-1">{label}</label>
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-12 h-12 rounded-xl border border-white/10 bg-white/5 focus:outline-none focus:ring-2 focus:ring-primary/50"
    />
  </div>
);

const SliderField: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step, onChange }) => (
  <div>
    <label className="block text-sm font-medium text-muted mb-1">{label}</label>
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
        className="flex-1 h-1 bg-white/5 rounded-full"
      />
      <span className="text-xs text-muted-soft w-10 text-right tabular-nums">
        {step < 1 ? value.toFixed(2) : value.toFixed(0)}
      </span>
    </div>
  </div>
);

/* ------------------------------------------------------------------ screen */

interface DashboardProps {
  onGoToCalendar?: () => void;
  className?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ onGoToCalendar, className = '' }) => {
  const { user } = useAuth();
  const [customizationOpen, setCustomizationOpen] = useState(false);
  const { background, setBackground, resetBackgroundToTheme } = useBackground();

  const [devoirs, setDevoirs] = useState<Devoir[] | null>(null);
  const [friendCount, setFriendCount] = useState(0);

  useEffect(() => {
    let alive = true;
    void listDevoirs()
      .then((d) => alive && setDevoirs(d))
      .catch(() => alive && setDevoirs([]));
    void listFriends()
      .then((f) => alive && setFriendCount(f.length))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const d = useMemo(() => {
    const list = [...(devoirs ?? [])].sort((a, b) => a.date.localeCompare(b.date));
    const todayIso = isoOf(new Date());
    const in7 = isoOf(new Date(Date.now() + 7 * DAY_MS));

    const upcoming = list.filter((x) => x.date >= todayIso);
    const thisWeek = upcoming.filter((x) => x.date < in7);

    const bySubject = new Map<string, number>();
    for (const x of list) bySubject.set(x.subject, (bySubject.get(x.subject) ?? 0) + 1);
    const subjects: SubjectSlice[] = [...bySubject.entries()]
      .map(([value, count]) => ({
        value,
        count,
        label: subjectMeta(value)?.label ?? value,
        color: subjectMeta(value)?.color ?? '#8b8b8b',
      }))
      .sort((a, b) => b.count - a.count);

    const byMethod = new Map<string, number>();
    for (const x of list) for (const m of x.methods) byMethod.set(m, (byMethod.get(m) ?? 0) + 1);
    const methods: MethodSlice[] = [...byMethod.entries()]
      .map(([value, count]) => ({ value, count, label: methodLabel(value) }))
      .sort((a, b) => b.count - a.count);

    // 8 semaines à partir du lundi de la semaine en cours
    const monday = new Date();
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const weeks: Week[] = Array.from({ length: 8 }, (_, i) => {
      const start = new Date(monday.getTime() + i * 7 * DAY_MS);
      const startIso = isoOf(start);
      const endIso = isoOf(new Date(start.getTime() + 7 * DAY_MS));
      return {
        key: startIso,
        label: `${start.getDate()}/${start.getMonth() + 1}`,
        count: list.filter((x) => x.date >= startIso && x.date < endIso).length,
        current: i === 0,
      };
    });

    // grille du mois en cours (aligné lundi)
    const now = new Date();
    const y = now.getFullYear();
    const mo = now.getMonth();
    const daysInMonth = new Date(y, mo + 1, 0).getDate();
    const lead = (new Date(y, mo, 1).getDay() + 6) % 7;
    const byDate = new Map<string, Devoir>(list.map((x): [string, Devoir] => [x.date, x]));
    const cells: Cell[] = [];
    for (let i = 0; i < lead; i++) cells.push({ empty: true });
    let activeDays = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = isoOf(new Date(y, mo, day));
      const hit = byDate.get(iso);
      if (hit) activeDays++;
      cells.push({
        empty: false,
        day,
        color: hit ? subjectMeta(hit.subject)?.color ?? '#8b8b8b' : undefined,
        isToday: iso === todayIso,
      });
    }

    return {
      list,
      upcoming,
      thisWeek,
      subjects,
      methods,
      weeks,
      cells,
      activeDays,
      monthLabel: `${MONTHS_FR[mo]} ${y}`,
    };
  }, [devoirs]);

  const firstName = (user?.name ?? '').split(/\s+/)[0];
  const today = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  return (
    <div className={cn('w-full h-full overflow-y-auto', className)}>
      <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10 2xl:px-14 py-4 md:py-5 lg:py-6 flex flex-col gap-4 md:gap-5 lg:gap-6">
        {/* header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl ui-border border ui-soft-fill">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">
                {firstName ? `Bonjour ${firstName}` : "Vue d'ensemble"}
              </h1>
              <p className="text-xs md:text-sm text-muted">
                {devoirs === null
                  ? 'Chargement de ton activité…'
                  : d.list.length === 0
                    ? 'Planifie ton premier devoir pour démarrer.'
                    : `${d.upcoming.length} devoir${d.upcoming.length > 1 ? 's' : ''} à venir · ${friendCount} ami${friendCount > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl ui-chip px-3 py-2 backdrop-blur-xl w-fit">
            <CalendarDays className="h-4 w-4 text-muted opacity-60" />
            <span className="text-xs font-semibold text-primary capitalize">{today}</span>
          </div>
        </div>

        {devoirs === null ? (
          <div className="flex items-center justify-center py-24">
            <Loader variant="spinner" size={26} className="text-muted" />
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <KpiCard
                label="Devoirs planifiés"
                value={d.list.length}
                hint="au total"
                accent="blue"
                Icon={ClipboardList}
              />
              <KpiCard
                label="À venir"
                value={d.upcoming.length}
                hint="dès aujourd'hui"
                accent="violet"
                Icon={CalendarClock}
              />
              <KpiCard
                label="Cette semaine"
                value={d.thisWeek.length}
                hint="7 prochains jours"
                accent="emerald"
                Icon={Timer}
              />
              <KpiCard
                label="Crédits IA"
                value={user?.credits ?? 0}
                hint="pour l'assistant"
                accent="amber"
                Icon={Sparkles}
              />
            </div>

            {/* chart + subject mix */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 md:gap-5">
              <div className="xl:col-span-3">
                <WeeklyBarChart weeks={d.weeks} />
              </div>
              <SubjectDonut subjects={d.subjects} total={d.list.length} />
            </div>

            {/* upcoming + heatmap */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-5">
              <div className="xl:col-span-2">
                <UpcomingList devoirs={d.upcoming} onGoToCalendar={onGoToCalendar} />
              </div>
              <MiniHeatmap cells={d.cells} monthLabel={d.monthLabel} activeDays={d.activeDays} />
            </div>

            {/* method mix */}
            {d.methods.length > 0 && <MethodsCard methods={d.methods} />}
          </>
        )}

        {/* Personnalisation de l'arrière-plan */}
        <div className="w-full">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-primary">Personnalisation de l'arrière-plan</h2>
            <button
              onClick={() => setCustomizationOpen(!customizationOpen)}
              className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/70 transition-colors"
            >
              {customizationOpen ? 'Masquer' : 'Personnaliser'}
              <ChevronRight
                className={cn('h-3 w-3 ml-1 transition-transform', customizationOpen && 'rotate-90')}
              />
            </button>
          </div>

          {customizationOpen && (
            <div className="rounded-2xl ui-card p-4">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted w-20">Style :</span>
                  <select
                    value={background.shaderStyle}
                    onChange={(e) =>
                      setBackground({ shaderStyle: e.target.value as BackgroundShaderStyle })
                    }
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="fluid">Fluide</option>
                    <option value="nebula">Nébuleuse</option>
                    <option value="plasma">Plasma</option>
                    <option value="flare">Éruption</option>
                    <option value="flame">Flamme</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <ColorField
                    label="Couleur principale"
                    value={background.color1}
                    onChange={(v) => setBackground({ color1: v })}
                  />
                  <ColorField
                    label="Couleur secondaire"
                    value={background.color2}
                    onChange={(v) => setBackground({ color2: v })}
                  />
                  <ColorField
                    label="Couleur d'accent"
                    value={background.color3}
                    onChange={(v) => setBackground({ color3: v })}
                  />
                  <ColorField
                    label="Couleur de lumière"
                    value={background.color4}
                    onChange={(v) => setBackground({ color4: v })}
                  />
                </div>

                <div className="space-y-3">
                  <SliderField
                    label="Échelle"
                    value={background.scale}
                    min={0.5}
                    max={3}
                    step={0.1}
                    onChange={(v) => setBackground({ scale: v })}
                  />
                  <SliderField
                    label="Distorsion"
                    value={background.distortion}
                    min={0}
                    max={2}
                    step={0.05}
                    onChange={(v) => setBackground({ distortion: v })}
                  />
                  <SliderField
                    label="Vitesse"
                    value={background.speed}
                    min={0.1}
                    max={1}
                    step={0.01}
                    onChange={(v) => setBackground({ speed: v })}
                  />
                  <SliderField
                    label="Intensité"
                    value={background.intensity}
                    min={0.5}
                    max={3}
                    step={0.1}
                    onChange={(v) => setBackground({ intensity: v })}
                  />
                  <SliderField
                    label="Détail"
                    value={background.detail}
                    min={1}
                    max={10}
                    step={1}
                    onChange={(v) => setBackground({ detail: v })}
                  />
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  <button
                    onClick={() => resetBackgroundToTheme()}
                    className="flex-1 min-w-[80px] px-3 py-1.5 text-xs font-medium rounded-xl ui-chip hover:ui-soft-fill-strong transition-colors"
                  >
                    Thème par défaut
                  </button>
                  <button
                    onClick={() => {
                      const randomColor = () =>
                        '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
                      setBackground({
                        color1: randomColor(),
                        color2: randomColor(),
                        color3: randomColor(),
                        color4: randomColor(),
                      });
                    }}
                    className="flex-1 min-w-[80px] px-3 py-1.5 text-xs font-medium rounded-xl ui-chip hover:ui-soft-fill-strong transition-colors"
                  >
                    Couleurs aléatoires
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
