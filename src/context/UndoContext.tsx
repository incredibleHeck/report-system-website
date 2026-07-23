import React, { createContext, useContext, useRef, useState, ReactNode } from 'react';
import type { AssessmentScore, ReportSummary } from '../types';

export type UndoSnapshot =
  | { type: 'scores'; before: AssessmentScore[] }
  | { type: 'summaries'; before: ReportSummary[] };

interface UndoContextType {
  push: (snap: UndoSnapshot) => void;
  pop: () => UndoSnapshot | null;
  canUndo: boolean;
  clear: () => void;
}

const UndoContext = createContext<UndoContextType | undefined>(undefined);

export function UndoProvider({ children }: { children: ReactNode }) {
  const stackRef = useRef<UndoSnapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const push = (snap: UndoSnapshot) => {
    stackRef.current = [...stackRef.current.slice(-19), snap];
    setCanUndo(true);
  };

  const pop = () => {
    if (!stackRef.current.length) return null;
    const item = stackRef.current[stackRef.current.length - 1];
    stackRef.current = stackRef.current.slice(0, -1);
    setCanUndo(stackRef.current.length > 0);
    return item;
  };

  const clear = () => {
    stackRef.current = [];
    setCanUndo(false);
  };

  return (
    <UndoContext.Provider value={{ push, pop, canUndo, clear }}>
      {children}
    </UndoContext.Provider>
  );
}

export function useUndo() {
  const ctx = useContext(UndoContext);
  if (!ctx) throw new Error('useUndo must be used within UndoProvider');
  return ctx;
}
