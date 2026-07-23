import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { DatabaseProvider } from './context/DatabaseContext.tsx';
import { UndoProvider } from './context/UndoContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DatabaseProvider>
      <AuthProvider>
        <UndoProvider>
          <App />
        </UndoProvider>
      </AuthProvider>
    </DatabaseProvider>
  </StrictMode>,
);
