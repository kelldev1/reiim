import React, { useState, useEffect } from 'react';

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

const LearningCalendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<{ day: number; month: number; year: number } | null>(null);
  const [dayData, setDayData] = useState<Record<string, { subject: string; method: string }>>({});
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('reiim-learning-calendar');
    if (saved) {
      try {
        setDayData(JSON.parse(saved));
      } catch (e) {
        console.warn('Failed to load calendar data:', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('reiim-learning-calendar', JSON.stringify(dayData));
  }, [dayData]);

  const prevMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  };

  const nextMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  };

  const openCard = (day: number) => {
    setSelectedDay({ day, month: currentDate.getMonth(), year: currentDate.getFullYear() });
    setShowCard(true);
  };

  const closeCard = () => {
    setSelectedDay(null);
    setShowCard(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDay) return;

    const subject = (e.currentTarget.querySelector('#subject-select') as HTMLSelectElement)?.value;
    const method = (e.currentTarget.querySelector('#method-select') as HTMLSelectElement)?.value;

    if (!subject || !method) {
      alert('Veuillez sélectionner une matière et une méthode d\'apprentissage');
      return;
    }

    const dayKey = `${selectedDay.year}-${selectedDay.month + 1}-${selectedDay.day}`;
    setDayData(prev => ({
      ...prev,
      [dayKey]: { subject, method }
    }));

    closeCard();
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

    const days: JSX.Element[] = [];

    // Days from previous month
    for (let i = startingDay; i > 0; i--) {
      const day = new Date(year, month, -i + 1);
      days.push(
        <div key={`prev-${day.getDate()}`} className="flex items-center justify-center text-[var(--foreground-muted)] cursor-not-allowed">
          {day.getDate()}
        </div>
      );
    }

    // Days of current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const isToday = day === new Date().getDate() &&
                     month === new Date().getMonth() &&
                     year === new Date().getFullYear();
      const dayKey = `${year}-${month + 1}-${day}`;
      const hasEvent = !!dayData[dayKey];

      days.push(
        <div
          key={`curr-${day}`}
          className={`relative flex items-center justify-center cursor-pointer hover:bg-[var(--background-muted)] transition-colors
          ${isToday ? 'bg-[var(--primary)] text-white rounded-full' : ''}
          ${hasEvent ? 'after:content-[""] after:absolute after:-bottom-2 after:w-2 after:h-2 after:bg-[var(--secondary)] after:rounded-full' : ''}`}
          onClick={() => openCard(day)}
        >
          <span className="day-number font-medium">{day}</span>
          {isToday && (
            <span className="absolute inset-0 border-2 border-white rounded-full pointer-events-none" />
          )}
        </div>
      );
    }

    // Days from next month
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push(
        <div key={`next-${i}`} className="flex items-center justify-center text-[var(--foreground-muted)] cursor-not-allowed">
          {i}
        </div>
      );
    }

    return days;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-[var(--primary)] text-white p-4 rounded-lg">
        <h2 className="text-xl font-semibold">
          {new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(currentDate)}
        </h2>
        <div className="flex space-x-2">
          <button onClick={prevMonth} className="hover:opacity-80 transition-opacity">
            ‹
          </button>
          <button onClick={nextMonth} className="hover:opacity-80 transition-opacity">
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-[var(--foreground-muted)] font-medium text-uppercase text-xs tracking-wider">
        {[ 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim' ].map(day => (
          <div key={day} className="flex items-center justify-center">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {renderCalendar()}
      </div>

      {/* Card Modal */}
      {showCard && selectedDay && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md relative">
            <button
              onClick={closeCard}
              className="absolute top-3 right-3 text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-opacity"
            >
              ×
            </button>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  📚 Planifier une activité
                </h3>
                <p className="text-[var(--foreground-muted)] text-sm">
                  Pour le {selectedDay.day} {new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date(selectedDay.year, selectedDay.month))}
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-[var(--foreground-muted)] font-medium text-xs mb-1">Matière</label>
                <select
                  id="subject-select"
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-white text-[var(--foreground)]"
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
                  id="method-select"
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-white text-[var(--foreground)]"
                >
                  <option value="">-- Sélectionne une méthode --</option>
                  {methods.map(meth => (
                    <option key={meth.value} value={meth.value}>
                      {meth.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] text-white font-medium py-2 px-4 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                ✓ Enregistrer
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LearningCalendar;