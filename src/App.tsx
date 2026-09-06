import { useState } from 'react';
import InteractiveCalendar from '@/components/ui/visualize-booking';
import Navbar from '@/components/ui/navbar';
import Dashboard from '@/components/ui/dashboard';
import AuraBackground from '@/components/ui/background';
import { useTheme } from '@/lib/theme';
import { BackgroundProvider, useBackground } from '@/lib/background';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const [page, setPage] = useState<'dashboard' | 'calendar'>('calendar');
  const { theme } = useTheme();
  const background = useBackground();

  return (
    <div className="relative w-screen h-screen flex flex-col overflow-hidden text-primary">
      <AuraBackground
        key={theme}
        shaderStyle={background.background.shaderStyle}
        scale={background.background.scale}
        distortion={background.background.distortion}
        speed={background.background.speed}
        intensity={background.background.intensity}
        detail={background.background.detail}
        color1={background.background.color1}
        color2={background.background.color2}
        color3={background.background.color3}
        color4={background.background.color4}
      />

      <div className="relative z-10 flex flex-col h-full w-full">
      <Navbar active={page} onNavigate={setPage} />

      <div className="relative flex-1 min-h-0 w-full overflow-hidden">
        <AnimatePresence mode="wait">
          {page === 'calendar' ? (
            <motion.div
              key="calendar-page"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="w-full h-full"
            >
              <InteractiveCalendar className="w-full h-full" />
            </motion.div>
          ) : (
            <motion.div
              key="dashboard-page"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="w-full h-full"
            >
              <Dashboard
                onGoToCalendar={() => setPage('calendar')}
                className="w-full h-full"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </div>
    </div>
  );
}

const AppWithProviders: React.FC = () => {
  return (
    <BackgroundProvider>
      <App />
    </BackgroundProvider>
  );
};

export default AppWithProviders;