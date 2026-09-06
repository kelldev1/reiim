import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, LayoutGrid } from 'lucide-react';

const daysOfWeek = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export type DayType = {
  day: string;
  classNames: string;
  meetingInfo?: {
    date: string;
    time: string;
    title: string;
    participants: string[];
    location: string;
  }[];
};

interface DayProps {
  classNames: string;
  day: DayType;
  onHover: (day: string | null) => void;
  onClick: (day: string) => void;
}

const Day: React.FC<DayProps> = ({ classNames, day, onHover, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <motion.div
      className={`relative flex w-full h-full items-center justify-center ${classNames}`}
      style={{ borderRadius: 16, minHeight: '2.5rem' }}
      onClick={() => {
        // Only trigger click on actual day numbers (not padding days)
        if (!day.day.startsWith('-') && !day.day.startsWith('+')) {
          onClick(day.day);
        }
      }}
      id={`day-${day.day}`}
      whileHover={{ scale: 1.02 }}
      >
      {!day.day.startsWith('-') && !day.day.startsWith('+') && (
        <span className="text-sm md:text-xl lg:text-2xl text-primary select-none">
          {day.day}
        </span>
      )
      }
      {day.meetingInfo && (
        <motion.div
          className="absolute bottom-2 right-2 flex items-center text-primary font-medium bg-transparent"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          transition={{ duration: 0.2 }}
        >
          {day.meetingInfo.length}
        </motion.div>
      )}
    </motion.div>
  );
};

  interface CalendarGridProps {
  onHover: (day: string | null) => void;
  onClick: (day: string) => void;
  days: DayType[];
}

const CalendarGrid: React.FC<CalendarGridProps> = ({ onHover, onClick, days }) => {
  return (
    <div className="h-full grid grid-cols-7 grid-rows-7 auto-rows-fr gap-1.5 md:gap-2 lg:gap-3">
      {days.map((day, index) => (
        <Day
          key={`${day.day}-${index}`}
          classNames={day.classNames}
          day={day}
          onHover={onHover}
          onClick={onClick}
        />
      ))}
    </div>
  );
};

const LearningSelectionCard: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (subject: string, method: string) => void;
  selectedDay: string | null;
}> = ({ isOpen, onClose, onSubmit, selectedDay }) => {
  if (!isOpen || !selectedDay) return null;

  const subjects = [
    { value: 'mathématiques', label: 'Mathématiques', color: '#3b82f6' },
    { value: 'physique', label: 'Physique', color: '#ef4444' },
    { value: 'chimie', label: 'Chimie', color: '#10b981' },
    { value: 'biologie', label: 'Biologie', color: '#8b5cf6' },
    { value: 'histoire', label: 'Histoire', color: '#f59e0b' },
    { value: 'géographie', label: 'Géographie', color: '#06b6d4' },
    { value: 'langues', label: 'Langues', color: '#ec4899' },
    { value: 'programmation', label: 'Programmation', color: '#6366f1' },
    { value: 'philosophie', label: 'Philosophie', color: '#84cc16' },
    { value: 'littérature', label: 'Littérature', color: '#f97316' },
    { value: 'art', label: 'Art & Musique', color: '#d946ef' },
    { value: 'sport', label: 'Éducation physique', color: '#14b8a6' }
  ];

  const methods = [
    { value: 'vidéos', label: 'Vidéos explicatives', icon: '🎥' },
    { value: 'exercices', label: 'Exercices pratiques', icon: '✏️' },
    { value: 'lecture', label: 'Lecture & notes', icon: '📖' },
    { value: 'projets', label: 'Projets concrets', icon: '🛠️' },
    { value: 'discussion', label: 'Étude en groupe', icon: '👥' },
    { value: 'flashcards', label: 'Flashcards & mémorisation', icon: '🃏' },
    { value: 'mindmap', label: 'Cartes mentales', icon: '🧠' },
    { value: 'podcast', label: 'Podcasts & audio', icon: '🎧' },
    { value: 'simulation', label: 'Simulations & labos', icon: '🔬' },
    { value: 'lecture_active', label: 'Lecture active & synthèse', icon: '📝' }
  ];

  const [formSubject, setFormSubject] = useState('');
  const [formMethod, setFormMethod] = useState('');

  // Load existing selection for this day if any
  useEffect(() => {
    if (selectedDay) {
      const saved = localStorage.getItem('reiim-learning-selections');
      if (saved) {
        try {
          const selections = JSON.parse(saved);
          const dayKey = `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${selectedDay}`;
          const dayData = selections[dayKey];
          if (dayData) {
            setFormSubject(dayData.subject || '');
            setFormMethod(dayData.method || '');
          }
        } catch (e) {
          console.warn('Failed to load learning selection:', e);
        }
      }
    }
  }, [selectedDay]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSubject || !formMethod) {
      alert('Veuillez sélectionner une matière et une méthode d\'apprentissage');
      return;
    }

    const saved = localStorage.getItem('reiim-learning-selections');
    const selections = saved ? JSON.parse(saved) : {};
    const dayKey = `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${selectedDay}`;
    selections[dayKey] = { subject: formSubject, method: formMethod };
    localStorage.setItem('reiim-learning-selections', JSON.stringify(selections));

    onSubmit(formSubject, formMethod);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-lg shadow-xl w-full h-full relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-opacity"
        >
          ×
        </button>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 w-full h-full flex flex-col">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-[var(--foreground)]">
              📚 Planifier une activité
            </h3>
            <p className="text-[var(--foreground-muted)] text-sm">
              Pour le {selectedDay} {new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date())}
            </p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto">
            <div className="space-y-2">
              <label className="block text-[var(--foreground-muted)] font-medium text-xs mb-1">Matière</label>
              <select
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                className="w-full px-4 py-3 border border-[var(--border)]/30 bg-white/5 backdrop-blur-sm rounded-lg focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-transparent text-[var(--foreground)]"
              >
                <option value="">-- Sélectionne une matière --</option>
                {subjects.map(sub => (
                  <option key={sub.value} value={sub.value}>
                    {sub.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-[var(--foreground-muted)] font-medium text-xs mb-1">Méthode d'apprentissage</label>
              <select
                value={formMethod}
                onChange={(e) => setFormMethod(e.target.value)}
                className="w-full px-4 py-3 border border-[var(--border)]/30 bg-white/5 backdrop-blur-sm rounded-lg focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-transparent text-[var(--foreground)]"
              >
                <option value="">-- Sélectionne une méthode --</option>
                {methods.map((meth) => (
                  <option key={meth.value} value={meth.value}>
                    {meth.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="mt-6 w-full bg-gradient-to-r from-[var(--primary)]/20 to-[var(--secondary)]/20 text-[var(--foreground)] font-medium py-3 px-6 rounded-lg hover:bg-gradient-to-r from-[var(--primary)]/30 to-[var(--secondary)]/30 transition-all flex items-center justify-center gap-2"
          >
            ✓ Enregistrer
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const InteractiveCalendar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>((props, ref) => {
  const { className, ...restProps } = props;
  const [moreView, setMoreView] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showSelectionCard, setShowSelectionCard] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());


  const handleDayClick = (day: string) => {
    setSelectedDay(day);
    setShowSelectionCard(true);
  };

  const handleDayHover = (day: string | null) => {
    // We could use this for hover effects if needed
    // For now, we just need it to satisfy the Day component's onHover prop
  };

  const handleCloseCard = () => {
    setSelectedDay(null);
    setShowSelectionCard(false);
  };

  const handleSelectionSubmit = (subject: string, method: string) => {
    // This is handled in the LearningSelectionCard component via localStorage
    // We could add additional logic here if needed (e.g., update meeting info)
    console.log(`Saved learning selection for ${selectedDay}: ${subject} - ${method}`);
    setSelectedDay(null);
    setShowSelectionCard(false);
  };

  // Update the date display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Format date in French
  const formattedDate = useMemo(() => {
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'long'
    }).format(currentDate);
  }, [currentDate]);

  // Generate days for the current month with proper padding
  const generateDays = (date: Date): DayType[] => {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-11

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);

    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 (Sunday) to 6 (Saturday)

    const days: DayType[] = [];

    // Add padding days from previous month
    const prevMonthLastDate = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek; i > 0; i--) {
      const dayValue = prevMonthLastDate - i + 1;
      days.push({
        day: `-${dayValue}`,
        classNames: 'bg-white/[0.03]'
      });
    }

    // Add days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      // Highlight today
      const today = new Date();
      const isToday =
        day === today.getDate() &&
        month === today.getMonth() &&
        year === today.getFullYear();

      days.push({
        day: day.toString().padStart(2, '0'),
        classNames: isToday
          ? 'bg-white/[0.08] ring-2 ring-white/20'
          : 'bg-white/[0.06]'
      });
    }

    // Add padding days from next month to complete the grid (6 rows x 7 cols = 42 cells)
    const totalDaysSoFar = days.length;
    const remainingDays = 42 - totalDaysSoFar;

    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        day: `+${i}`,
        classNames: 'bg-white/[0.03]'
      });
    }

    return days;
  };

  // Generate days for the current date
  const DAYS = useMemo(() => generateDays(currentDate), [currentDate]);

  const sortedDays = useMemo(() => {
    return [...DAYS];
  }, [DAYS]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        ref={ref}
        className={`relative w-full h-full flex flex-col lg:flex-row items-stretch gap-4 lg:gap-8 p-3 md:p-6 lg:p-8 ${className ?? ''}`}
        {...restProps}
      >
        <motion.div layout className="w-full lg:flex-1 lg:max-w-none min-w-0 min-h-0 flex flex-col gap-4 lg:gap-6 flex-shrink-0">
          <motion.div
            key="calendar-view"
            className="flex w-full flex-col gap-4 md:gap-5 h-full"
          >
            <div className="flex w-full items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <motion.button
                  onClick={() => {
                    setCurrentDate(prev => {
                      const newDate = new Date(prev);
                      newDate.setMonth(newDate.getMonth() - 1);
                      return newDate;
                    });
                  }}
                  className="flex items-center justify-center w-8 h-8 rounded-lg ui-chip hover:ui-soft-fill-strong transition-colors"
                  aria-label="Mois précédent"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </motion.button>
                <div className="flex flex-col items-center">
                  <motion.h2 className="mb-0 md:mb-1 text-2xl md:text-4xl lg:text-5xl font-bold tracking-wider text-primary select-none">
                    Calendrier
                  </motion.h2>
                  <p className="text-sm md:text-base lg:text-xl text-muted select-none">
                    {formattedDate}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <motion.button
                  className="relative flex items-center gap-3 rounded-lg ui-chip px-1.5 py-1 text-primary"
                  onClick={() => setMoreView(!moreView)}
                  aria-label="Basculer la vue"
                >
                  <LayoutDashboard className="h-4 w-4 md:h-5 md:w-5 z-[2]" />
                  <LayoutGrid className="h-4 w-4 md:h-5 md:w-5 z-[2]" />
                  <div
                    className="absolute left-0 top-0 h-[85%] w-7 md:w-8 rounded-md ui-soft-fill-strong ui-border border transition-transform duration-300"
                    style={{
                      top: '50%',
                      transform: moreView
                        ? 'translateY(-50%) translateX(44px)'
                        : 'translateY(-50%) translateX(4px)',
                    }}
                  ></div>
                </motion.button>
                <motion.button
                  onClick={() => {
                    setCurrentDate(prev => {
                      const newDate = new Date(prev);
                      newDate.setMonth(newDate.getMonth() + 1);
                      return newDate;
                    });
                  }}
                  className="flex items-center justify-center w-8 h-8 rounded-lg ui-chip hover:ui-soft-fill-strong transition-colors"
                  aria-label="Mois suivant"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </motion.button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5 md:gap-2 lg:gap-3 flex-shrink-0">
              {daysOfWeek.map((day) => (
                <div
                  key={day}
                  className="rounded-xl ui-soft-fill-strong py-1.5 md:py-2 text-center text-[11px] md:text-sm font-semibold tracking-wider text-primary select-none"
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="flex-1 min-h-0 min-w-0 flex-shrink">
              <CalendarGrid onHover={handleDayHover} onClick={handleDayClick} days={sortedDays} />
            </div>
          </motion.div>
        </motion.div>

        {moreView && (
          <motion.div
            className="w-full lg:flex-1 lg:max-w-none min-w-0 min-h-0 flex flex-col gap-4 lg:gap-6 flex-shrink-0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              key="more-view"
              className="mt-0 md:mt-4 flex w-full flex-col gap-4 h-full"
            >
              <div className="flex w-full flex-col items-start justify-between gap-1 flex-shrink-0">
                <motion.h2 className="mb-0 md:mb-1 text-2xl md:text-4xl lg:text-5xl font-bold tracking-wider text-primary select-none">
                  Liste
                </motion.h2>
                <p className="font-medium text-muted text-xs md:text-sm">
                  Aucun élément à afficher
                </p>
              </div>
              <motion.div
                className="flex-1 min-h-0 flex flex-col items-start justify-start overflow-hidden rounded-xl ui-border border ui-card"
                layout
              >
                <AnimatePresence>
                  <motion.div
                    className="w-full h-full flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="flex flex-col items-center gap-2 px-6 text-center">
                      <div className="h-10 w-10 rounded-full ui-border border ui-soft-fill" />
                      <p className="text-sm md:text-base text-muted">
                        Aucune donnée
                      </p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            </motion.div>
          </motion.div>
        )}

        {/* Learning Selection Card */}
        <LearningSelectionCard
          isOpen={showSelectionCard}
          onClose={handleCloseCard}
          onSubmit={handleSelectionSubmit}
          selectedDay={selectedDay}
        />
      </motion.div>
    </AnimatePresence>
  );
});
InteractiveCalendar.displayName = 'InteractiveCalendar';

export default InteractiveCalendar;