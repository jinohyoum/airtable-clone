'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type ColumnsUiContextValue = {
  columnOrder: string[] | null;
  hiddenColumnIds: ReadonlySet<string>;
  ensureColumnOrder: (columnIds: string[]) => void;
  setColumnOrder: (columnIds: string[]) => void;
  setHiddenColumnIds: (next: ReadonlySet<string>) => void;
};

const ColumnsUiContext = createContext<ColumnsUiContextValue | null>(null);

export function ColumnsUiProvider({
  tableId,
  children,
}: {
  tableId: string;
  children: React.ReactNode;
}) {
  const [columnOrder, setColumnOrderState] = useState<string[] | null>(null);
  const [hiddenColumnIds, setHiddenColumnIdsState] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    setColumnOrderState(null);
    setHiddenColumnIdsState(new Set());
  }, [tableId]);

  const ensureColumnOrder = useCallback((columnIds: string[]) => {
    setColumnOrderState((prev) => {
      if (prev && prev.length > 0) return prev;
      return [...columnIds];
    });
  }, []);

  const setColumnOrder = useCallback((columnIds: string[]) => {
    setColumnOrderState([...columnIds]);
  }, []);

  const setHiddenColumnIds = useCallback((next: ReadonlySet<string>) => {
    setHiddenColumnIdsState(new Set(next));
  }, []);

  const value = useMemo<ColumnsUiContextValue>(
    () => ({
      columnOrder,
      hiddenColumnIds,
      ensureColumnOrder,
      setColumnOrder,
      setHiddenColumnIds,
    }),
    [columnOrder, hiddenColumnIds, ensureColumnOrder, setColumnOrder, setHiddenColumnIds],
  );

  return (
    <ColumnsUiContext.Provider value={value}>
      {children}
    </ColumnsUiContext.Provider>
  );
}

export function useColumnsUi() {
  const ctx = useContext(ColumnsUiContext);
  if (!ctx) throw new Error('useColumnsUi must be used within ColumnsUiProvider');
  return ctx;
}


