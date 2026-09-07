import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ThemeProvider } from './lib/theme';

// NOTE: React.StrictMode is intentionally omitted — its dev-only double-mount
// makes framer-motion v10 freeze entering elements on their `initial` state
// (blank pages). Production was never affected; this keeps dev usable too.
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>,
);
