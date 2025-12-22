'use client';

import { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback, useReducer } from 'react';
import { useParams } from 'next/navigation';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { api } from '~/trpc/react';

const ICON_SPRITE = '/icons/icon_definitions.svg?v=04661fff742a9043fa037c751b1c6e66';

// Map column types to icon names from the sprite
function getColumnIconName(columnType: string): string {
  switch (columnType) {
    case 'longText':
      return 'Paragraph';
    case 'user':
      return 'User';
    case 'singleSelect':
      return 'CaretCircleDown';
    case 'attachment':
      return 'File';
    case 'singleLineText':
    default:
      return 'TextAlt';
  }
}

type CellData = Record<string, string>;

export default function MainContent({
  isSearchOpen = false,
  search,
}: {
  isSearchOpen?: boolean;
  search?: string;
}) {
  const params = useParams();
  const tableId = ((params.tableId as string | undefined) ?? '').toString();
  const hasTableId = tableId.length > 0;
  const isCreatingTable = hasTableId ? tableId.startsWith('__creating__') : false;
  
  const rootRef = useRef<HTMLDivElement | null>(null);
  const middleHeaderScrollRef = useRef<HTMLDivElement | null>(null);
  const middleScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingRef = useRef<'middle' | 'bottom' | 'header' | null>(null);
  const prevTableIdRef = useRef<string>(tableId);
  const [bottomSpacerWidth, setBottomSpacerWidth] = useState<number>(0);
  const [hoveredRow, setHoveredRow] = useState<number | 'add' | null>(null);
  
  // Active cell for keyboard navigation (row index, column index)
  const [activeCell, setActiveCell] = useState<{ rowIdx: number; colIdx: number } | null>(null);
  const cellInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Track whether the current active cell came from keyboard navigation (arrows/tab)
  // so we can show "hover-like" styling only for keyboard, not mouse.
  const [isKeyboardNav, setIsKeyboardNav] = useState(false);
  
  // Cell editing state with local draft
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnId: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set());
  // Cells with unsaved local changes (turns on immediately when typing; used for global "Saving…" UX).
  const [pendingCells, setPendingCells] = useState<Set<string>>(new Set());
  // Cells with an in-flight *explicit commit* (blur/enter). Used only to prevent double-commit edge cases.
  // IMPORTANT: autosave must NOT lock typing, so autosave does not use this.
  const [committingCells, setCommittingCells] = useState<Set<string>>(new Set());
  // Track row creation inflight by clientRowId so global "Saving…" reflects row inserts too (supports rapid clicks).
  const [rowCreatesInFlight, setRowCreatesInFlight] = useState<Set<string>>(new Set());
  // Track row deletions inflight so global "Saving…" reflects deletes as well.
  const [rowDeletesInFlight, setRowDeletesInFlight] = useState<Set<string>>(new Set());
  // Track the most recent row creation that needs focus (using ref to avoid stale closures)
  const pendingRowFocusRef = useRef<{ rowId: string; colIdx: number; rowIdx: number } | null>(null);

  // Prevent double-saves: saving a focused input temporarily disables it, which triggers blur.
  // That blur should NOT trigger another save (otherwise focus restoration gets lost).
  const committingCellKeyRef = useRef<string | null>(null);

  // Autosave (debounced) per cell. We keep a simple version counter so we only clear "pending"
  // when the latest value has been persisted.
  const autosaveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const autosaveVersionRef = useRef<Map<string, number>>(new Map());
  
  // Local draft map: keeps pending edits that haven't been saved yet
  // This prevents refetches from overwriting text you're typing
  // Key: "rowId-columnId", Value: draft text
  const [localDrafts, setLocalDrafts] = useState<Map<string, string>>(new Map());
  // Use a ref to access current localDrafts in callbacks without stale closures
  const localDraftsRef = useRef<Map<string, string>>(new Map());
  
  // Keep ref in sync with state
  useEffect(() => {
    localDraftsRef.current = localDrafts;
  }, [localDrafts]);
  
  // Transition mask: brief skeleton on every table switch (like Airtable)
  // This signals "context change" even when data is cached
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Broadcast saving state so TopNav can render the global "Saving…" indicator.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Include non-cell mutations (like row creation) so the global indicator matches Airtable-like UX.
    const count =
      new Set<string>([...pendingCells, ...savingCells]).size +
      rowCreatesInFlight.size +
      rowDeletesInFlight.size;
    window.dispatchEvent(
      new CustomEvent('grid:saving', { detail: { count } }),
    );
    return () => {
      // Clear on unmount so we don't leave a stale indicator visible after route changes.
      window.dispatchEvent(new CustomEvent('grid:saving', { detail: { count: 0 } }));
    };
  }, [pendingCells, savingCells, rowCreatesInFlight, rowDeletesInFlight]);

  // Simple force-update hook used by the virtualizer's onChange scheduler to avoid flushSync.
  const forceUpdate = useReducer((x) => x + 1, 0)[1] as () => void;
  const virtualizerRafIdRef = useRef<number | null>(null);

  // Cleanup any pending autosave timers on unmount / table switch.
  useEffect(() => {
    return () => {
      autosaveTimersRef.current.forEach((t) => clearTimeout(t));
      autosaveTimersRef.current.clear();
    };
  }, [tableId]);
  
  // Fetch table metadata (columns) separately
  const { data: tableMeta } = api.table.getTableMeta.useQuery(
    { tableId: tableId ?? "" },
    { 
      enabled: hasTableId && !isCreatingTable,
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
    },
  );

  // Fetch total row count from database (for accurate record count display)
  const { data: rowCountData, error: rowCountError } = api.table.getRowCount.useQuery(
    { tableId: tableId ?? "", search },
    { enabled: hasTableId && !isCreatingTable },
  );
  
  // Infinite query for rows with cursor-based paging
  const {
    data: rowPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingRows,
    error: rowsError,
  } = api.table.getRows.useInfiniteQuery(
    { 
      tableId: tableId ?? "",
      limit: 500, // Fetch 500 rows per page for smoother scrolling
      search,
    },
    {
      enabled: hasTableId && !isCreatingTable,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      staleTime: 30_000, // 30 seconds
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
    },
  );

  // Get total count from first page (for virtualizer)
  const totalCount = useMemo(() => {
    return rowPages?.pages?.[0]?.totalCount ?? 0;
  }, [rowPages]);

  // Flatten all pages into a single rows array
  const allRows = useMemo(() => {
    if (!rowPages) return [];
    const rows = rowPages.pages.flatMap((page) => page.rows);
    console.log('allRows recalculated:', rows.length, 'rows');
    return rows;
  }, [rowPages]);
  
  // Helper to get row by index (returns null if not loaded yet)
  const rowByIndex = useCallback((index: number) => {
    return allRows[index] ?? null;
  }, [allRows]);
  
  // Debug: log when rowPages changes
  useEffect(() => {
    if (rowPages) {
      const totalRows = rowPages.pages.reduce((sum, p) => sum + p.rows.length, 0);
      console.log('rowPages changed:', totalRows, 'total rows across', rowPages.pages.length, 'pages');
    }
  }, [rowPages]);

  // When search changes, reset selection and scroll to the top so infinite paging + virtual rows start from row 0.
  useEffect(() => {
    setEditingCell(null);
    setActiveCell(null);
    setIsKeyboardNav(false);
    pendingRowFocusRef.current = null;
    rootRef.current?.scrollTo({ top: 0 });
  }, [search, tableId]);

  // Fallback: Focus pending row cell if it wasn't focused in onMutate
  // This only runs if the direct focus in onMutate didn't work (e.g., row not rendered yet)
  useEffect(() => {
    const pending = pendingRowFocusRef.current;
    if (!pending || !tableMeta || !activeCell) return;
    
    // Only focus if the activeCell matches the pending row index (ensures we focus the correct row)
    if (activeCell.rowIdx !== pending.rowIdx) return;
    
    const targetColumn = tableMeta.columns[pending.colIdx];
    if (!targetColumn) return;
    
    const cellKey = `${pending.rowId}-${targetColumn.id}`;
    
    // Use queueMicrotask + requestAnimationFrame to ensure this runs after render
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        const inputRef = cellInputRefs.current.get(cellKey);
        
        // Only focus if ref exists and we haven't already focused (check if still pending)
        if (inputRef && pendingRowFocusRef.current?.rowId === pending.rowId) {
          inputRef.focus();
          try {
            const len = inputRef.value?.length ?? 0;
            inputRef.setSelectionRange(len, len);
          } catch {
            // Ignore
          }
          inputRef.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
          pendingRowFocusRef.current = null; // Clear after successful focus
        }
      });
    });
  }, [allRows, activeCell, tableMeta]); // Only run when allRows changes (row actually appears)

  // Determine if we're loading (first load)
  const isLoading = isLoadingRows && allRows.length === 0;
  
  // Row creation with optimistic updates (Option B: allow rapid clicks)
  const utils = api.useUtils();
  const cancelledCreateClientRowIdsRef = useRef<Set<string>>(new Set());
  const skipDeleteOptimisticRowIdsRef = useRef<Set<string>>(new Set());
  const createRowMutation = api.table.createRow.useMutation({
    onMutate: async ({ clientRowId, afterRowId }) => {
      console.log('onMutate called:', { clientRowId, afterRowId });
      
      const hasSearchFilter = Boolean(search && search.trim().length > 0);

      // Cancel outgoing refetches - must match the query key exactly
      await utils.table.getRows.cancel({ tableId, limit: 500, search });
      
      // Get the cached data - must match the query key exactly including limit
      const previousPages = utils.table.getRows.getInfiniteData({ tableId, limit: 500, search });
      const currentCount = utils.table.getRowCount.getData({ tableId, search });
      
      console.log('previousPages:', previousPages ? `exists with ${previousPages.pages.length} pages` : 'null');
      console.log('tableMeta:', tableMeta ? 'exists' : 'null');
      
      // Optimistically update the row count immediately (before server responds)
      if (!hasSearchFilter && currentCount) {
        utils.table.getRowCount.setData({ tableId, search }, { count: currentCount.count + 1 });
      }
      
      // If a search filter is active, a new empty row likely won't match; skip optimistic insertion.
      if (hasSearchFilter || !previousPages || !tableMeta) {
        console.warn('Cannot do optimistic update - missing data');
        return { previousPages: undefined, clientRowId, previousCount: currentCount };
      }
      
      // Create temp row
      const tempRow = {
        id: `__temp__${clientRowId}`,
        order: 0, // Will be calculated properly by server
        tableId,
        clientRowId,
        searchText: '',
        values: {} as Record<string, string>,
        createdAt: new Date(),
        updatedAt: new Date(),
        cells: tableMeta.columns.map(col => ({
          id: `__temp_cell__${col.id}__${clientRowId}`,
          rowId: `__temp__${clientRowId}`,
          columnId: col.id,
          value: '',
          createdAt: new Date(),
          updatedAt: new Date(),
          column: col,
        })),
      };
      
      // Find the insert position
      let insertPageIdx = 0;
      let insertRowIdx = previousPages.pages[0]?.rows.length ?? 0;
      
      if (afterRowId) {
        // Find the page and row index of the afterRow
        for (let pIdx = 0; pIdx < previousPages.pages.length; pIdx++) {
          const page = previousPages.pages[pIdx];
          if (!page) continue;
          const rowIdx = page.rows.findIndex((r) => r.id === afterRowId);
          if (rowIdx >= 0) {
            insertPageIdx = pIdx;
            insertRowIdx = rowIdx + 1;
            break;
          }
        }
      }
      
      // Insert the temp row optimistically
      // We MUST use the updater function form to ensure React Query detects the change
      // Must match the query key exactly including limit
      utils.table.getRows.setInfiniteData({ tableId, limit: 500, search }, (oldData) => {
        if (!oldData) {
          console.warn('No oldData in setInfiniteData for row creation');
          return oldData;
        }
        
        // Get current totalCount from first page
        const currentTotalCount = oldData.pages[0]?.totalCount ?? 0;
        
        // Create completely new arrays at every level to ensure React Query detects changes
        const newPages = oldData.pages.map((page, pIdx) => {
          if (pIdx !== insertPageIdx) {
            // Still create new page object for consistency
            return { ...page, rows: [...page.rows] };
          }
          
          // Create new rows array and insert temp row
          const newRows = [...page.rows];
          newRows.splice(insertRowIdx, 0, tempRow);
          
          return {
            ...page,
            rows: newRows,
            nextCursor: page.nextCursor,
            // Update totalCount on first page to reflect new row
            totalCount: pIdx === 0 ? currentTotalCount + 1 : page.totalCount,
          };
        });
        
        const result = {
          pages: newPages,
          pageParams: oldData.pageParams ? [...oldData.pageParams] : [],
        };
        
        console.log('Row creation optimistic update:', {
          oldRowCount: oldData.pages.reduce((sum, p) => sum + p.rows.length, 0),
          newRowCount: newPages.reduce((sum, p) => sum + p.rows.length, 0),
          insertPageIdx,
          insertRowIdx,
          totalCount: newPages[0]?.totalCount,
        });
        
        // Return new object to ensure React Query detects the change
        return result;
      });
      
      

      // Update the selection to the new row immediately after cache update
      // Since we're inserting after the current row, the new row is at activeCell.rowIdx + 1
      if (afterRowId && activeCell) {
        // The new row is inserted right after the current row, so its index is current + 1
        const newRowIdx = activeCell.rowIdx + 1;
        const targetColIdx = activeCell.colIdx;
        const tempRowId = `__temp__${clientRowId}`;
        
        // Update active cell immediately - this ensures the row is highlighted correctly
        setActiveCell({ rowIdx: newRowIdx, colIdx: targetColIdx });
        setIsKeyboardNav(true);
        
        // Set pending focus ref with the exact row index to ensure we focus the correct row
        // Using ref ensures we track the most recent row creation even if multiple happen quickly
        pendingRowFocusRef.current = { rowId: tempRowId, colIdx: targetColIdx, rowIdx: newRowIdx };
        
        // Try to focus after render completes - use queueMicrotask to avoid flushSync issues
        const targetColumn = tableMeta?.columns[targetColIdx];
        if (targetColumn) {
          const cellKey = `${tempRowId}-${targetColumn.id}`;
          
          // Use queueMicrotask to ensure this runs after the current render cycle
          queueMicrotask(() => {
            requestAnimationFrame(() => {
              const inputRef = cellInputRefs.current.get(cellKey);
              if (inputRef && pendingRowFocusRef.current?.rowId === tempRowId) {
                inputRef.focus();
                try {
                  const len = inputRef.value?.length ?? 0;
                  inputRef.setSelectionRange(len, len);
                } catch {
                  // Ignore
                }
                inputRef.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                pendingRowFocusRef.current = null; // Clear after successful focus
              }
            });
          });
        }
      }
      
      return { previousPages, clientRowId, previousCount: currentCount };
    },
    onSuccess: (newRow, variables, context) => {
      if (!context) return;

      // If the user deleted/cancelled the optimistic temp row before the server responded,
      // don't resurrect it. Instead, delete the newly-created server row.
      if (cancelledCreateClientRowIdsRef.current.has(context.clientRowId)) {
        cancelledCreateClientRowIdsRef.current.delete(context.clientRowId);
        // Skip optimistic delete bookkeeping for this server row (we already adjusted UI when cancelling).
        skipDeleteOptimisticRowIdsRef.current.add(newRow.id);
        deleteRowMutation.mutate({ rowId: newRow.id });
        return;
      }

      // If we skipped optimistic insertion (e.g. search filter active), just refetch.
      if (!context.previousPages) {
        void utils.table.getRows.invalidate({ tableId, limit: 500, search });
        void utils.table.getRowCount.invalidate({ tableId, search });
        return;
      }
      
      // Find the current active cell to maintain focus after replacing temp row
      const currentActiveCell = activeCell;
      const wasOnNewRow = currentActiveCell && 
        utils.table.getRows.getInfiniteData({ tableId, limit: 500, search })?.pages
          .flatMap(p => p.rows)
          .some((r, idx) => r.id === `__temp__${context.clientRowId}` && idx === currentActiveCell.rowIdx);
      
      // Replace optimistic temp row with real row from server
      utils.table.getRows.setInfiniteData({ tableId, limit: 500, search }, (oldData) => {
        if (!oldData) return oldData;
        
        return {
          pages: oldData.pages.map(page => ({
            ...page,
            rows: page.rows.map(row => {
            if (row.id === `__temp__${context.clientRowId}`) {
                // Merge: keep any cells that have local drafts
              const mergedCells = newRow.cells.map(newCell => {
                const draftKey = `${row.id}-${newCell.columnId}`;
                  const localDraft = localDraftsRef.current.get(draftKey);
                
                if (localDraft !== undefined) {
                    // Update draft key to use new row ID
                  setLocalDrafts(prev => {
                    const next = new Map(prev);
                      next.delete(draftKey);
                      next.set(`${newRow.id}-${newCell.columnId}`, localDraft);
                    return next;
                  });
                  return { ...newCell, value: localDraft };
                }
                
                  // Preserve temp cell's value if it was edited
                const tempCell = row.cells.find(c => c.columnId === newCell.columnId);
                const cellValue = newCell.value ?? "";
                if (tempCell?.value && !cellValue) {
                  return { ...newCell, value: tempCell.value };
                }
                
                return { ...newCell, value: cellValue };
              });
              
              return { ...newRow, searchText: newRow.searchText ?? '', cells: mergedCells };
            }
            return row;
          }),
          })),
          pageParams: oldData.pageParams,
        };
      });
      
      // Maintain focus on the new row after replacing temp row with real row
      // The row index should stay the same, just the row ID changes
      if (currentActiveCell && wasOnNewRow) {
        // Update the pending focus ref to use the real row ID
        if (pendingRowFocusRef.current?.rowId === `__temp__${context.clientRowId}`) {
          pendingRowFocusRef.current = {
            rowId: newRow.id,
            colIdx: currentActiveCell.colIdx,
            rowIdx: currentActiveCell.rowIdx,
          };
        }
        
        // Use queueMicrotask to ensure this runs after render cycle
        queueMicrotask(() => {
          requestAnimationFrame(() => {
            const targetColumn = tableMeta?.columns[currentActiveCell.colIdx];
            if (targetColumn) {
              const cellKey = `${newRow.id}-${targetColumn.id}`;
              const inputRef = cellInputRefs.current.get(cellKey);
              
              if (inputRef) {
                inputRef.focus();
                try {
                  const len = inputRef.value?.length ?? 0;
                  inputRef.setSelectionRange(len, len);
                } catch {
                  // Ignore
                }
              }
            }
          });
        });
      }
      
      // Don't invalidate here - the optimistic update should make it appear immediately
      // Only invalidate if there's a mismatch (which shouldn't happen with proper optimistic updates)
    },
    onError: (error, _variables, context) => {
      if (!context) return;
      console.log('Row creation error:', error);
      
      // Rollback optimistic count update on error
      if (context.previousCount) {
        utils.table.getRowCount.setData({ tableId, search }, context.previousCount);
      }
      
      void utils.table.getRows.invalidate({ tableId, limit: 500, search });
      void utils.table.getRowCount.invalidate({ tableId, search });
    },
    onSettled: (_data, _error, variables) => {
      setRowCreatesInFlight(prev => {
        const next = new Set(prev);
        if (variables?.clientRowId) next.delete(variables.clientRowId);
        return next;
      });
      if (variables?.clientRowId) {
        cancelledCreateClientRowIdsRef.current.delete(variables.clientRowId);
      }
    },
  });
  
  // Navigate to a specific cell by row/column index (updates activeCell; focus is synced in an effect)
  const navigateToCell = useCallback((rowIdx: number, colIdx: number) => {
    const targetRow = allRows[rowIdx];
    if (!targetRow || !tableMeta) return;
    const targetColumn = tableMeta.columns[colIdx];
    if (!targetColumn) return;
    setActiveCell({ rowIdx, colIdx });
  }, [allRows, tableMeta]);

  // Cell update mutation
  const updateCellMutation = api.table.updateCell.useMutation({
    onSuccess: (_updatedCell, variables) => {
      // Update the cache with the new cell value
      // The mutation returns a simple object, so we update the cache directly
      utils.table.getRows.setInfiniteData({ tableId, limit: 500, search }, (oldData) => {
        if (!oldData) return oldData;
        const newData = {
          pages: oldData.pages.map(page => ({
            ...page,
            rows: page.rows.map(row => {
              if (row.id !== variables.rowId) return row;
              // Update the specific cell value
              const updatedCells = row.cells.map(cell => {
                if (cell.columnId === variables.columnId) {
                  return {
                    ...cell,
                    value: variables.value,
                  };
                }
                return cell;
              });
              return {
                ...row,
                cells: updatedCells,
              };
            }),
          })),
          pageParams: oldData.pageParams,
        };
        
        // Now that cache is updated, we can safely remove the local draft
        const cellKey = `${variables.rowId}-${variables.columnId}`;
        setTimeout(() => {
          setLocalDrafts(prev => {
            const next = new Map(prev);
            next.delete(cellKey);
            return next;
          });
        }, 100);
        
        return newData;
      });
    },
    onError: (error) => {
      console.error('Failed to save cell:', error);
      void utils.table.getRows.invalidate({ tableId, limit: 500, search });
    },
  });

  const deleteRowMutation = api.table.deleteRow.useMutation({
    onMutate: async ({ rowId }) => {
      const skipOptimistic = skipDeleteOptimisticRowIdsRef.current.has(rowId);
      if (skipOptimistic) {
        // Consume the flag so it doesn't leak to future deletes.
        skipDeleteOptimisticRowIdsRef.current.delete(rowId);
      }

      const hasSearchFilter = Boolean(search && search.trim().length > 0);

      // Cancel outgoing refetches for rows so we can optimistically update
      if (!skipOptimistic) {
        await utils.table.getRows.cancel({ tableId, limit: 500, search });
      }

      const previousPages = utils.table.getRows.getInfiniteData({ tableId, limit: 500, search });
      const currentCount = utils.table.getRowCount.getData({ tableId, search });

      const rowExistsInCache = Boolean(
        previousPages?.pages?.some((p) => p.rows.some((r) => r.id === rowId)),
      );

      // Optimistically update the row count immediately (before server responds)
      if (!skipOptimistic && currentCount && (!hasSearchFilter || rowExistsInCache)) {
        utils.table.getRowCount.setData(
          { tableId, search },
          { count: Math.max(0, currentCount.count - 1) },
        );
      }

      if (!previousPages) {
        return { previousPages: undefined, previousCount: currentCount };
      }

      // Optimistically remove the row from the infinite query cache
      if (!skipOptimistic) {
        utils.table.getRows.setInfiniteData({ tableId, limit: 500, search }, (oldData) => {
          if (!oldData) return oldData;

          const newPages = oldData.pages.map((page, pageIdx) => {
            const newRows = page.rows.filter((r) => r.id !== rowId);
            const currentTotal = page.totalCount ?? 0;

            return {
              ...page,
              rows: newRows,
              // Keep totalCount in sync on the first page so virtualizer + footer stay accurate
              totalCount: pageIdx === 0 ? Math.max(0, currentTotal - 1) : page.totalCount,
            };
          });

          return {
            pages: newPages,
            pageParams: oldData.pageParams ? [...oldData.pageParams] : [],
          };
        });
      }

      // Clear any local drafts for this row so we don't leak stale entries
      if (!skipOptimistic) {
        setLocalDrafts((prev) => {
          const next = new Map(prev);
          for (const key of prev.keys()) {
            if (key.startsWith(`${rowId}-`)) {
              next.delete(key);
            }
          }
          return next;
        });
      }

      return { previousPages, previousCount: currentCount };
    },
    onError: (error, _variables, context) => {
      console.error('Row delete error:', error);
      if (context?.previousPages) {
        utils.table.getRows.setInfiniteData(
          { tableId, limit: 500, search },
          context.previousPages,
        );
      }
      if (context?.previousCount) {
        utils.table.getRowCount.setData({ tableId, search }, context.previousCount);
      }
    },
    onSettled: (_data, _error, variables) => {
      if (variables?.rowId) {
        setRowDeletesInFlight((prev) => {
          const next = new Set(prev);
          next.delete(variables.rowId);
          return next;
        });
      }

      scheduleInvalidate();
    },
  });
  
  const handleCreateRow = useCallback((opts?: { afterRowId?: string }) => {
    if (isCreatingTable) return;
    
    const clientRowId = crypto.randomUUID();
    setRowCreatesInFlight(prev => new Set(prev).add(clientRowId));
    
    createRowMutation.mutate({ tableId, clientRowId, afterRowId: opts?.afterRowId });
  }, [isCreatingTable, tableId, createRowMutation]);

  const handleDeleteRow = useCallback(
    (rowId: string, rowIdx: number, colIdx: number) => {
      if (!rowId) return;
      // If this is an optimistic temp row (created via Shift+Enter), delete it client-side
      // and cancel the pending create by deleting the server row when it arrives.
      if (rowId.startsWith('__temp__')) {
        const clientRowId = rowId.slice('__temp__'.length);
        cancelledCreateClientRowIdsRef.current.add(clientRowId);
        setRowCreatesInFlight((prev) => {
          const next = new Set(prev);
          next.delete(clientRowId);
          return next;
        });

        // Remove from cache (and keep totalCount + rowCount consistent).
        const hasSearchFilter = Boolean(search && search.trim().length > 0);
        const currentCount = utils.table.getRowCount.getData({ tableId, search });
        if (!hasSearchFilter && currentCount) {
          utils.table.getRowCount.setData(
            { tableId, search },
            { count: Math.max(0, currentCount.count - 1) },
          );
        }

        utils.table.getRows.setInfiniteData({ tableId, limit: 500, search }, (oldData) => {
          if (!oldData) return oldData;
          const currentTotal = oldData.pages[0]?.totalCount ?? 0;

          // Only decrement totalCount if the row actually existed in cached rows.
          const existed = oldData.pages.some((p) => p.rows.some((r) => r.id === rowId));

          return {
            pages: oldData.pages.map((page, pageIdx) => ({
              ...page,
              rows: page.rows.filter((r) => r.id !== rowId),
              totalCount:
                pageIdx === 0
                  ? Math.max(0, (page.totalCount ?? currentTotal) - (existed ? 1 : 0))
                  : page.totalCount,
            })),
            pageParams: oldData.pageParams ? [...oldData.pageParams] : [],
          };
        });

        // Clear drafts for the temp row.
        setLocalDrafts((prev) => {
          const next = new Map(prev);
          for (const key of prev.keys()) {
            if (key.startsWith(`${rowId}-`)) next.delete(key);
          }
          return next;
        });

        // Clear pending focus if it was pointing at this temp row.
        if (pendingRowFocusRef.current?.rowId === rowId) {
          pendingRowFocusRef.current = null;
        }

        // Move selection/focus to a stable row.
        const hasMoreThanOneRow = allRows.length > 1;
        if (hasMoreThanOneRow) {
          const nextRowIdx = rowIdx > 0 ? rowIdx - 1 : 0;
          setActiveCell({ rowIdx: nextRowIdx, colIdx });
        } else {
          setActiveCell(null);
          requestAnimationFrame(() => {
            rootRef.current?.focus();
          });
        }

        return;
      }

      // Prevent duplicate deletes for the same row while one is in flight.
      if (rowDeletesInFlight.has(rowId)) return;

      setRowDeletesInFlight((prev) => {
        const next = new Set(prev);
        next.add(rowId);
        return next;
      });

      // Decide which row to move selection/focus to after this row is removed.
    const hasMoreThanOneRow = allRows.length > 1;
    if (hasMoreThanOneRow) {
      const nextRowIdx = rowIdx > 0 ? rowIdx - 1 : 0;
      setActiveCell({ rowIdx: nextRowIdx, colIdx });
    } else {
        // No rows left after delete → clear active cell and keep focus inside grid.
        setActiveCell(null);
        requestAnimationFrame(() => {
          rootRef.current?.focus();
        });
      }

      deleteRowMutation.mutate({ rowId });
    },
    [allRows.length, deleteRowMutation, rowDeletesInFlight, search, tableId, utils],
  );
  
  // Handle cell editing with local draft state
  const handleCellClick = useCallback((rowId: string, columnId: string, currentValue: string, rowIdx: number, colIdx: number) => {
    setIsKeyboardNav(false);
    setActiveCell({ rowIdx, colIdx });
  }, []);

  const scheduleAutosave = useCallback((rowId: string, columnId: string, value: string) => {
    const cellKey = `${rowId}-${columnId}`;
    if (rowId.startsWith('__temp__')) return;

    setPendingCells((prev) => (prev.has(cellKey) ? prev : new Set(prev).add(cellKey)));

    const nextVersion = (autosaveVersionRef.current.get(cellKey) ?? 0) + 1;
    autosaveVersionRef.current.set(cellKey, nextVersion);

    const existing = autosaveTimersRef.current.get(cellKey);
    if (existing) clearTimeout(existing);

    const t = setTimeout(() => {
      void (async () => {
        setSavingCells((prev) => new Set(prev).add(cellKey));
        try {
          await updateCellMutation.mutateAsync({
            rowId,
            columnId,
            value,
          });

          const latestVersion = autosaveVersionRef.current.get(cellKey) ?? nextVersion;
          if (latestVersion === nextVersion) {
            setPendingCells((prev) => {
              const next = new Set(prev);
              next.delete(cellKey);
              return next;
            });
            // DO NOT remove local draft immediately - keep it to ensure cell stays visible
            // The value will persist in local draft until cache is confirmed updated
          }
        } catch (error) {
          console.error('Failed to autosave cell:', error);
          void utils.table.getRows.invalidate({ tableId, limit: 500, search });
        } finally {
          setSavingCells((prev) => {
            const next = new Set(prev);
            next.delete(cellKey);
            return next;
          });
        }
      })();
    }, 500);

    autosaveTimersRef.current.set(cellKey, t);
  }, [updateCellMutation, utils, tableId, search]);
  
  const handleCellChange = useCallback((rowId: string, columnId: string, newValue: string) => {
    const cellKey = `${rowId}-${columnId}`;
    
    // Update local draft immediately
    setLocalDrafts(prev => {
      const next = new Map(prev);
      next.set(cellKey, newValue);
      return next;
    });
    
    setEditValue(newValue);
    
    // Update cache immediately - ensure we always return the full structure
    utils.table.getRows.setInfiniteData({ tableId, limit: 500, search }, (oldData) => {
      if (!oldData) return oldData;
      
      return {
        pages: oldData.pages.map(page => ({
          ...page,
          rows: page.rows.map(row => {
          if (row.id !== rowId) return row;
          
          return {
            ...row,
            cells: row.cells.map(cell => {
              if (cell.columnId !== columnId) return cell;
              return { ...cell, value: newValue };
            }),
          };
        }),
        })),
        pageParams: oldData.pageParams,
      };
    });

    scheduleAutosave(rowId, columnId, newValue);
  }, [utils, tableId, search, scheduleAutosave]);
  
  const handleCellSave = useCallback(async (rowId: string, columnId: string, maintainFocus = true) => {
    if (editingCell?.rowId !== rowId || editingCell?.columnId !== columnId) return;

    const cellKey = `${rowId}-${columnId}`;
    const newValue = editValue;

    committingCellKeyRef.current = cellKey;

    const pendingTimer = autosaveTimersRef.current.get(cellKey);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      autosaveTimersRef.current.delete(cellKey);
    }
    
    // Find current position
    const currentRowIdx = allRows.findIndex(r => r.id === rowId);
    const currentRow = allRows[currentRowIdx];
    let currentColIdx = 0;
    
    if (currentRow && tableMeta) {
      const allColumns = tableMeta.columns;
      currentColIdx = allColumns.findIndex(c => c.id === columnId);
    }
    
    // IMPORTANT: Keep local draft - it ensures the cell value is always visible
    // The local draft will be removed AFTER save succeeds and cache is confirmed updated
    // Do NOT delete the local draft here!
    
    // Clear editing state
    setEditingCell(null);
    setEditValue('');
    setActiveCell({ rowIdx: currentRowIdx, colIdx: currentColIdx });
    
    // Update cache - ensure we always return the full structure
    utils.table.getRows.setInfiniteData({ tableId, limit: 500, search }, (oldData) => {
      if (!oldData) return oldData;
      return {
        pages: oldData.pages.map(page => ({
          ...page,
          rows: page.rows.map(row => {
            if (row.id !== rowId) return row;
            return {
              ...row,
              cells: row.cells.map(cell => {
                if (cell.columnId !== columnId) return cell;
                return { ...cell, value: newValue };
              }),
            };
          }),
        })),
        pageParams: oldData.pageParams,
      };
    });
    
    if (!rowId.startsWith('__temp__')) {
      setPendingCells(prev => new Set(prev).add(cellKey));
      setCommittingCells(prev => new Set(prev).add(cellKey));
      setSavingCells(prev => new Set(prev).add(cellKey));
      
      try {
        await updateCellMutation.mutateAsync({
          rowId,
          columnId,
          value: newValue,
        });
        
        // DO NOT remove local draft immediately after save
        // Keep it until we're certain the cache has the updated value
        // This ensures the cell value is always visible
        // The local draft will be cleared on next successful refetch or after a delay
      } catch (error) {
        console.error('Failed to save cell:', error);
        void utils.table.getRows.invalidate({ tableId, limit: 500, search });
      } finally {
        setCommittingCells(prev => {
          const next = new Set(prev);
          next.delete(cellKey);
          return next;
        });
        setSavingCells(prev => {
          const next = new Set(prev);
          next.delete(cellKey);
          return next;
        });
        setPendingCells(prev => {
          const next = new Set(prev);
          next.delete(cellKey);
          return next;
        });
        
        if (maintainFocus) {
          requestAnimationFrame(() => {
            const inputRef = cellInputRefs.current.get(cellKey);
            if (inputRef) inputRef.focus();
          });
        }

        if (committingCellKeyRef.current === cellKey) {
          committingCellKeyRef.current = null;
        }
      }
    } else {
      // For temp rows, keep the draft
      if (maintainFocus) {
        requestAnimationFrame(() => {
          const inputRef = cellInputRefs.current.get(cellKey);
          if (inputRef) inputRef.focus();
        });
      }

      if (committingCellKeyRef.current === cellKey) {
        committingCellKeyRef.current = null;
      }
    }
  }, [editingCell, editValue, allRows, tableMeta, updateCellMutation, utils, tableId]);
  
  const handleCellCancel = useCallback((rowId: string, columnId: string) => {
    const cellKey = `${rowId}-${columnId}`;

    const pendingTimer = autosaveTimersRef.current.get(cellKey);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      autosaveTimersRef.current.delete(cellKey);
    }
    setPendingCells(prev => {
      const next = new Set(prev);
      next.delete(cellKey);
      return next;
    });
    
    setLocalDrafts(prev => {
      const next = new Map(prev);
      next.delete(cellKey);
      return next;
    });
    
    setEditingCell(null);
    setEditValue('');
  }, []);
  
  const handleCellKeyDown = useCallback((e: React.KeyboardEvent, rowId: string, columnId: string) => {
    const cellKey = `${rowId}-${columnId}`;

    const currentRowIdx = allRows.findIndex(r => r.id === rowId);
    const currentRow = allRows[currentRowIdx];
    if (!currentRow || !tableMeta) return;
    
    const allColumns = tableMeta.columns;
    const currentColIdx = allColumns.findIndex(c => c.id === columnId);
    const isCurrentlyEditing = editingCell?.rowId === rowId && editingCell?.columnId === columnId;
    
    const isPrintableChar = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

    if (!isCurrentlyEditing && isPrintableChar && committingCells.has(cellKey)) {
      e.preventDefault();
      return;
    }
    
    if (!isCurrentlyEditing && isPrintableChar) {
      setEditingCell({ rowId, columnId });
      setEditValue(e.key);
      
      setLocalDrafts(prev => new Map(prev).set(cellKey, e.key));

      utils.table.getRows.setInfiniteData({ tableId, limit: 500 }, (oldData) => {
        if (!oldData) return oldData;
        return {
          pages: oldData.pages.map(page => ({
            ...page,
            rows: page.rows.map(row => {
            if (row.id !== rowId) return row;
            return {
              ...row,
              cells: row.cells.map(cell => {
                if (cell.columnId !== columnId) return cell;
                return { ...cell, value: e.key };
              }),
            };
          }),
          })),
          pageParams: oldData.pageParams,
        };
      });

      scheduleAutosave(rowId, columnId, e.key);
      
      e.preventDefault();
      return;
    }
    
    // Navigation keys
    if (e.key === 'ArrowUp' && !isCurrentlyEditing) {
      e.preventDefault();
      setIsKeyboardNav(true);
      if (currentRowIdx > 0) {
        navigateToCell(currentRowIdx - 1, currentColIdx);
      }
    } else if (e.key === 'ArrowDown' && !isCurrentlyEditing) {
      e.preventDefault();
      setIsKeyboardNav(true);
      if (currentRowIdx < allRows.length - 1) {
        navigateToCell(currentRowIdx + 1, currentColIdx);
      }
    } else if (e.key === 'ArrowLeft' && !isCurrentlyEditing) {
      e.preventDefault();
      setIsKeyboardNav(true);
      if (currentColIdx > 0) {
        navigateToCell(currentRowIdx, currentColIdx - 1);
      }
    } else if (e.key === 'ArrowRight' && !isCurrentlyEditing) {
      e.preventDefault();
      setIsKeyboardNav(true);
      if (currentColIdx < allColumns.length - 1) {
        navigateToCell(currentRowIdx, currentColIdx + 1);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setIsKeyboardNav(true);
      if (editingCell) {
        void handleCellSave(rowId, columnId);
      }
      
      if (e.shiftKey) {
        if (currentColIdx > 0) {
          navigateToCell(currentRowIdx, currentColIdx - 1);
        }
      } else {
        if (currentColIdx < allColumns.length - 1) {
          navigateToCell(currentRowIdx, currentColIdx + 1);
        }
      }
    } else if (e.key === 'Enter' && e.shiftKey) {
      // Shift+Enter should create a new row, even while editing
      // The global handler will take care of saving the cell and creating the row
      e.preventDefault();
      // Let the global handler process this
      return;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isCurrentlyEditing) {
        void handleCellSave(rowId, columnId);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCellCancel(rowId, columnId);
    }
  }, [allRows, tableMeta, editingCell, committingCells, utils, tableId, scheduleAutosave, handleCellSave, handleCellCancel, handleCreateRow]);
  
  const focusRafRef = useRef<number | null>(null);
  const invalidateTimerRef = useRef<number | null>(null);

  const scheduleInvalidate = useCallback(() => {
    if (invalidateTimerRef.current != null) {
      window.clearTimeout(invalidateTimerRef.current);
    }
    invalidateTimerRef.current = window.setTimeout(() => {
      invalidateTimerRef.current = null;
      void utils.table.getRows.invalidate({ tableId, limit: 500, search });
      void utils.table.getRowCount.invalidate({ tableId, search });
    }, 150);
  }, [utils, tableId, search]);

  // Keep DOM focus in sync with the current activeCell selection, without spamming smooth scroll.
  useEffect(() => {
    if (!activeCell) return;
    const { rowIdx, colIdx } = activeCell;
    const targetRow = allRows[rowIdx];
    if (!targetRow || !tableMeta) return;

    const targetColumn = tableMeta.columns[colIdx];
    if (!targetColumn) return;

    const rowId = targetRow.id;
    const columnId = targetColumn.id;
    const cellKey = `${rowId}-${columnId}`;

    if (focusRafRef.current != null) {
      cancelAnimationFrame(focusRafRef.current);
    }

    // Defer focus until after the DOM has been updated for this render.
    focusRafRef.current = requestAnimationFrame(() => {
      focusRafRef.current = null;
      const inputRef = cellInputRefs.current.get(cellKey);
      if (!inputRef) return;
      inputRef.focus();
      try {
        const len = inputRef.value?.length ?? 0;
        inputRef.setSelectionRange(len, len);
      } catch {
        // Ignore selection errors for non-text inputs.
      }

      // Keep scrolling cheap and synchronous to avoid virtualizer/flushSync issues.
      inputRef.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
    });

    return () => {
      if (focusRafRef.current != null) {
        cancelAnimationFrame(focusRafRef.current);
        focusRafRef.current = null;
      }
    };
  }, [activeCell, allRows, tableMeta]);
  
  // Show transition mask on table switch
  useEffect(() => {
    if (prevTableIdRef.current !== tableId && !isCreatingTable) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 175);
      prevTableIdRef.current = tableId;
      return () => clearTimeout(timer);
    }
  }, [tableId, isCreatingTable]);
  
  const showCreatingState = isCreatingTable;
  const showTransitionMask = !isCreatingTable && (isTransitioning || isLoading);
  
  // Transform data for TanStack Table
  const columns = useMemo<ColumnDef<CellData>[]>(() => {
    if (!tableMeta) return [];
    
    return tableMeta.columns.map((col) => ({
      id: col.id,
      accessorKey: col.id,
      header: col.name,
      meta: {
        type: col.type,
      },
    }));
  }, [tableMeta]);
  
  const data = useMemo<CellData[]>(() => {
    return allRows.map((row) => {
      const rowData: CellData = { _id: row.id };
      row.cells.forEach((cell) => {
        rowData[cell.columnId] = cell.value ?? '';
      });
      return rowData;
    });
  }, [allRows]);
  
  const reactTable = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // Reference to the scrollable body container for virtualization
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Clean up any pending virtualizer animation frame on unmount.
  useEffect(() => {
    return () => {
      if (virtualizerRafIdRef.current != null) {
        cancelAnimationFrame(virtualizerRafIdRef.current);
        virtualizerRafIdRef.current = null;
      }
    };
  }, []);

  // Set up row virtualizer with totalCount (not just loaded rows)
  const rowVirtualizer = useVirtualizer({
    count: totalCount || allRows.length, // Use totalCount if available, fallback to loaded count
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 32, // 32px = h-8 (fixed height for smoother scrolling)
    overscan: 30, // Render 30 extra rows above/below viewport for smoother scrolling
    onChange: (_instance, sync) => {
      // Avoid React 18 "flushSync during render" by scheduling updates.
      if (sync) {
        if (virtualizerRafIdRef.current != null) {
          cancelAnimationFrame(virtualizerRafIdRef.current);
        }
        virtualizerRafIdRef.current = requestAnimationFrame(() => {
          virtualizerRafIdRef.current = null;
          forceUpdate();
        });
      } else {
        queueMicrotask(() => {
          forceUpdate();
        });
      }
    },
  });

  // Prefetch next page when user scrolls close to the loaded edge
  // This ensures seamless scrolling - fetch before user hits the bottom
  const PREFETCH_THRESHOLD = 60; // Fetch when within 60 rows of loaded edge
  useEffect(() => {
    const virtualItems = rowVirtualizer.getVirtualItems();
    if (virtualItems.length === 0) return;

    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;

    const loadedCount = allRows.length;
    
    // Prefetch if we're within threshold of loaded edge and there's more data
    if (
      lastItem.index >= loadedCount - PREFETCH_THRESHOLD &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      void fetchNextPage();
    }
  }, [rowVirtualizer, allRows.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Keep keyboard navigation working
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onKeyDownCapture = (e: KeyboardEvent) => {
      if (!activeCell) return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditableTarget =
        tag === 'input' ||
        tag === 'textarea' ||
        (target?.isContentEditable ?? false);

      const key = e.key;

      // Shift+Enter should always work to create a new row, even if an input is focused
      if (key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        setIsKeyboardNav(true);
        const current = allRows[activeCell.rowIdx];
        const currentRowId = current?.id;
        if (currentRowId) {
          // If currently editing, save the cell first before creating a new row
          if (editingCell?.rowId === currentRowId && editingCell?.columnId === tableMeta?.columns[activeCell.colIdx]?.id) {
            void handleCellSave(editingCell.rowId, editingCell.columnId, false); // Save without maintaining focus
          }
          handleCreateRow({ afterRowId: currentRowId });
        }
        return; // Prevent further processing for Shift+Enter
      }

      // Ctrl+Backspace → delete the currently active row (optimistic)
      if ((key === 'Backspace' || key === 'Delete') && e.ctrlKey) {
        e.preventDefault();
        const currentRowIdx = activeCell.rowIdx;
        const current = allRows[currentRowIdx];
        const currentRowId = current?.id;
        if (currentRowId) {
          handleDeleteRow(currentRowId, currentRowIdx, activeCell.colIdx);
        }
        return;
      }

      if (key === 'Tab') {
        e.preventDefault();
        setIsKeyboardNav(true);

        const maxCol = (tableMeta?.columns.length ?? 1) - 1;

        if (e.shiftKey) {
          if (activeCell.colIdx > 0) navigateToCell(activeCell.rowIdx, activeCell.colIdx - 1);
        } else {
          if (activeCell.colIdx < maxCol) navigateToCell(activeCell.rowIdx, activeCell.colIdx + 1);
        }
        return;
      }

      // If the focus is in an editable element, let it handle arrows/enter/etc.
      // This check is now *after* Shift+Enter and Tab to ensure they are always handled by the grid.
      if (isEditableTarget) return;

      if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
        e.preventDefault();
        setIsKeyboardNav(true);

        const rowCount = allRows.length;
        const next = { ...activeCell };

        if (key === 'ArrowUp') next.rowIdx = Math.max(0, activeCell.rowIdx - 1);
        if (key === 'ArrowDown') next.rowIdx = Math.min(rowCount - 1, activeCell.rowIdx + 1);
        if (key === 'ArrowLeft') next.colIdx = Math.max(0, activeCell.colIdx - 1);
        if (key === 'ArrowRight') next.colIdx = activeCell.colIdx + 1;

        const maxCol = (tableMeta?.columns.length ?? 1) - 1;
        next.colIdx = Math.min(Math.max(0, next.colIdx), maxCol);

        navigateToCell(next.rowIdx, next.colIdx);
        return;
      }
    };

    root.addEventListener('keydown', onKeyDownCapture, { capture: true });
    return () => root.removeEventListener('keydown', onKeyDownCapture, { capture: true } as never);
  }, [activeCell, allRows, tableMeta, navigateToCell, handleCreateRow, editingCell, handleCellSave]);

  const syncFromMiddle = () => {
    const middleHeader = middleHeaderScrollRef.current;
    const middle = middleScrollRef.current;
    const bottom = bottomScrollRef.current;
    if (!middle || !bottom) return;
    if (syncingRef.current === 'bottom' || syncingRef.current === 'header') return;
    syncingRef.current = 'middle';
    
    const scrollPos = middle.scrollLeft;
    const bottomMax = Math.max(0, bottom.scrollWidth - bottom.clientWidth);
    bottom.scrollLeft = Math.min(scrollPos, bottomMax);
    
    if (middleHeader) {
      const headerMax = Math.max(0, middleHeader.scrollWidth - middleHeader.clientWidth);
      middleHeader.scrollLeft = Math.min(scrollPos, headerMax);
    }
    syncingRef.current = null;
  };

  const syncFromBottom = () => {
    const middleHeader = middleHeaderScrollRef.current;
    const middle = middleScrollRef.current;
    const bottom = bottomScrollRef.current;
    if (!middle || !bottom) return;
    if (syncingRef.current === 'middle' || syncingRef.current === 'header') return;
    syncingRef.current = 'bottom';
    
    const scrollPos = bottom.scrollLeft;
    const middleMax = Math.max(0, middle.scrollWidth - middle.clientWidth);
    middle.scrollLeft = Math.min(scrollPos, middleMax);
    
    if (middleHeader) {
      const headerMax = Math.max(0, middleHeader.scrollWidth - middleHeader.clientWidth);
      middleHeader.scrollLeft = Math.min(scrollPos, headerMax);
    }
    syncingRef.current = null;
  };

  const syncFromHeader = () => {
    const middleHeader = middleHeaderScrollRef.current;
    const middle = middleScrollRef.current;
    const bottom = bottomScrollRef.current;
    if (!middleHeader || !middle || !bottom) return;
    if (syncingRef.current === 'middle' || syncingRef.current === 'bottom') return;
    syncingRef.current = 'header';
    
    const scrollPos = middleHeader.scrollLeft;
    const middleMax = Math.max(0, middle.scrollWidth - middle.clientWidth);
    middle.scrollLeft = Math.min(scrollPos, middleMax);
    
    const bottomMax = Math.max(0, bottom.scrollWidth - bottom.clientWidth);
    bottom.scrollLeft = Math.min(scrollPos, bottomMax);
    
    syncingRef.current = null;
  };

  useLayoutEffect(() => {
    const middleHeader = middleHeaderScrollRef.current;
    const middle = middleScrollRef.current;
    const bottom = bottomScrollRef.current;
    if (!middle || !bottom) return;

    const update = () => {
      const middleMax = Math.max(0, middle.scrollWidth - middle.clientWidth);
      const spacerWidth = bottom.clientWidth + middleMax;
      setBottomSpacerWidth(spacerWidth);
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(middle);
    ro.observe(bottom);
    if (middleHeader) ro.observe(middleHeader);
    const table = middle.querySelector('table');
    if (table) ro.observe(table);
    const headerTable = middleHeader?.querySelector('table');
    if (headerTable) ro.observe(headerTable);

    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    syncFromMiddle();
  }, []);

  if (showCreatingState) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ backgroundColor: '#f6f8fc' }} />
    );
  }

  if (showTransitionMask) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ backgroundColor: '#f6f8fc' }} />
    );
  }

  if (!tableMeta) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ backgroundColor: '#f6f8fc' }} />
    );
  }

  const loadError = rowsError ?? rowCountError;
  const loadErrorMessage =
    loadError instanceof Error ? loadError.message : "Unknown error";

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start ?? 0 : 0;
  const paddingBottom = virtualItems.length > 0
    ? totalHeight - (virtualItems[virtualItems.length - 1]?.end ?? 0)
    : 0;

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onMouseDown={() => rootRef.current?.focus()}
      className="flex-1 min-h-0 flex flex-col overflow-hidden"
      style={{ backgroundColor: '#f6f8fc' }}
    >
      {loadError ? (
        <div className="px-3 py-2 text-sm border-b border-red-200 bg-red-50 text-red-700">
          Failed to load rows. Check your database connection (DATABASE_URL).{" "}
          <span className="font-mono text-xs">{loadErrorMessage}</span>
        </div>
      ) : null}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Fixed Header Row */}
        <div className="flex flex-shrink-0">
          {/* Left header (checkbox + Name) */}
          <div className="w-[224px] flex-shrink-0 border-r border-gray-200">
            <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr className="bg-white h-8">
                  <th className="w-[44px] h-8 bg-white border-b border-gray-200 p-0 align-middle">
                    <div className="flex items-center justify-center h-8">
                      <input type="checkbox" className="rounded border-gray-300" />
                    </div>
                  </th>
                  <th className="w-[180px] h-8 bg-white border-b border-gray-200 p-0 text-left align-middle">
                    <div className="h-8 px-2 flex items-center gap-2">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        style={{ shapeRendering: 'geometricPrecision' }}
                        className="flex-none primaryDisplayTypeIcon"
                      >
                        <use fill="currentColor" href={`${ICON_SPRITE}#TextAlt`} />
                      </svg>
                      <span 
                        className="text-xs font-semibold leading-4"
                        style={{ 
                          color: 'lab(27.1134 -0.956401 -12.3224)',
                          height: '16px',
                          lineHeight: '16px',
                          fontFamily: 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'
                        }}
                      >
                        Name
                      </span>
                    </div>
                  </th>
                </tr>
              </thead>
            </table>
          </div>
          {/* Middle header (other columns) */}
          <div
            ref={middleHeaderScrollRef}
            onScroll={syncFromHeader}
            className={`flex-1 min-w-0 ${isSearchOpen ? 'overflow-x-hidden' : 'overflow-x-auto'} hide-scrollbar`}
          >
            <table className="min-w-[1200px]" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr className="bg-white h-8">
                  {tableMeta.columns.slice(1).map((col) => (
                    <th
                      key={col.id}
                      className="w-[180px] h-8 border-r border-b border-gray-200 p-0 text-left bg-white align-middle"
                    >
                      <div className="h-8 px-2 flex items-center gap-2">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          style={{ shapeRendering: 'geometricPrecision' }}
                          className="flex-none primaryDisplayTypeIcon"
                        >
                          <use fill="currentColor" href={`${ICON_SPRITE}#${getColumnIconName(col.type)}`} />
                        </svg>
                        <span 
                          className="text-xs font-semibold leading-4"
                          style={{ 
                            color: 'lab(27.1134 -0.956401 -12.3224)',
                            height: '16px',
                            lineHeight: '16px',
                            fontFamily: 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'
                          }}
                        >
                          {col.name}
                        </span>
                      </div>
                    </th>
                  ))}
                  {/* Add column button */}
                  <th className="w-28 h-8 border-r border-b border-gray-200 bg-white p-0 align-middle">
                    <button className="w-full h-8 flex items-center justify-center hover:bg-gray-100 text-gray-500">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        style={{ shapeRendering: 'geometricPrecision' }}
                        className="flex-none icon"
                      >
                        <use fill="currentColor" href={`${ICON_SPRITE}#Plus`} />
                      </svg>
                    </button>
                  </th>
                </tr>
              </thead>
            </table>
          </div>
        </div>

        {/* Scrollable Body - VIRTUALIZED */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
        >
          <div className="flex min-w-0" style={{ height: `${totalHeight}px`, position: 'relative' }}>
            {/* Virtualized rows wrapper */}
            <div 
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${paddingTop}px)`,
              }}
            >
          <div className="flex min-w-0">
          {/* Left body (Name cells) */}
          <div className="w-[224px] flex-shrink-0 border-r border-gray-200">
            <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <tbody>
                      {virtualItems.map((virtualRow) => {
                        const idx = virtualRow.index;
                        const row = rowByIndex(idx);
                        const firstColumn = tableMeta.columns[0];
                        if (!firstColumn) return null;

                        // Render placeholder if row not loaded yet
                        if (!row) {
                          return (
                            <tr
                              key={`placeholder-${idx}`}
                              className="bg-white"
                            >
                              <td className="w-[44px] h-8 border-b border-gray-200 text-center align-middle bg-white">
                                <div className="h-8 flex items-center justify-center text-xs text-gray-400 font-medium">
                                  {idx + 1}
                                </div>
                              </td>
                              <td className="w-[180px] h-8 border-b border-gray-200 p-0 align-middle bg-white">
                                <div className="h-8 px-2 flex items-center text-gray-300">
                                  {/* Empty placeholder */}
                                </div>
                              </td>
                            </tr>
                          );
                        }

                  const isHovered = hoveredRow === idx;
                  const isKeyboardRowActive = isKeyboardNav && activeCell?.rowIdx === idx;
                  const isRowHighlighted = isHovered || isKeyboardRowActive;
                  
                        const rowId = row.id;
                        const columnId = firstColumn.id;
                  const cellKey = `${rowId}-${columnId}`;
                        
                        const cell = row.cells.find(c => c.columnId === columnId);
                        const serverValue = cell?.value ?? '';
                  const cellValue = localDrafts.get(cellKey) ?? serverValue;
                        
                  const isEditing = editingCell?.rowId === rowId && editingCell?.columnId === columnId;
                  const isSaving = savingCells.has(cellKey) || pendingCells.has(cellKey);
                  const isCommitting = committingCells.has(cellKey);
                  const isActive = activeCell?.rowIdx === idx && activeCell?.colIdx === 0;
                  const isKeyboardActive = isKeyboardNav && isActive && !isEditing;
                  
                  return (
                    <tr
                      key={row.id}
                      className={isRowHighlighted ? 'bg-gray-50' : ''}
                      onMouseEnter={() => setHoveredRow(idx)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <td
                        className={`w-[44px] h-8 border-b border-gray-200 text-center align-middle ${
                          isRowHighlighted ? 'bg-gray-50' : 'bg-white'
                        }`}
                      >
                        <div className="h-8 flex items-center justify-center text-xs text-gray-500 font-medium">
                          {idx + 1}
                        </div>
                      </td>
                      <td
                        className={`w-[180px] h-8 border-b border-gray-200 p-0 align-middle ${
                          isRowHighlighted ? 'bg-gray-50' : 'bg-white'
                        }`}
                      >
                        <input
                          ref={(el) => {
                            if (el) {
                              cellInputRefs.current.set(cellKey, el);
                            } else {
                              cellInputRefs.current.delete(cellKey);
                            }
                          }}
                          key={`${tableId}-${row.id}-name`}
                          type="text"
                          className={`w-full h-8 px-2 bg-transparent outline-none table-cell-input ${
                            isEditing
                              ? 'bg-blue-50'
                              : isActive
                                ? `ring-2 ring-blue-500 ring-inset ${isKeyboardActive ? 'text-[rgb(22,110,225)] cursor-pointer' : ''}`
                                : ''
                          }`}
                          value={isEditing ? editValue : cellValue}
                          onClick={() => handleCellClick(rowId, columnId, cellValue, idx, 0)}
                          onChange={(e) => isEditing && handleCellChange(rowId, columnId, e.target.value)}
                          onBlur={() => {
                            if (committingCellKeyRef.current === cellKey) return;
                            if (isEditing) {
                              void handleCellSave(rowId, columnId, false);
                            }
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowId, columnId)}
                          aria-busy={isSaving ? 'true' : 'false'}
                          readOnly={!isEditing || isCommitting}
                        />
                      </td>
                    </tr>
                  );
                })}
                    </tbody>
                  </table>
                  {/* Add row button at the end - always visible */}
                  <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                    <tbody>
                      <tr
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredRow('add')}
                        onMouseLeave={() => setHoveredRow(null)}
                        onClick={() => handleCreateRow()}
                        title="Insert new record in grid"
                      >
                        <td
                          className={`w-[44px] h-8 border-b border-gray-200 text-center align-middle ${
                            hoveredRow === 'add' ? 'bg-gray-50' : 'bg-white'
                          }`}
                        >
                          <div className="h-8 flex items-center justify-center text-gray-500">
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 16 16"
                              className="flex-none icon"
                              style={{ shapeRendering: 'geometricPrecision' }}
                            >
                              <use
                                fill="currentColor"
                                href={`${ICON_SPRITE}#Plus`}
                              />
                            </svg>
                          </div>
                        </td>
                        <td
                          className={`w-[180px] h-8 border-b border-gray-200 p-0 align-middle ${
                            hoveredRow === 'add' ? 'bg-gray-50' : 'bg-white'
                          }`}
                        >
                          <div className="h-8" />
                        </td>
                      </tr>
                    </tbody>
                  </table>
          </div>

                {/* Middle body (other cells) */}
          <div
            ref={middleScrollRef}
            onScroll={syncFromMiddle}
            className={`flex-1 min-w-0 ${isSearchOpen ? 'overflow-x-hidden' : 'overflow-x-auto'} overflow-y-hidden hide-scrollbar`}
          >
            <table className="min-w-[1200px]" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <tbody>
                      {virtualItems.map((virtualRow) => {
                        const idx = virtualRow.index;
                        const row = rowByIndex(idx);

                        // Render placeholder if row not loaded yet
                        if (!row) {
                          return (
                            <tr
                              key={`placeholder-${idx}`}
                              className="bg-white"
                            >
                              {tableMeta.columns.slice(1).map((col) => (
                                <td
                                  key={col.id}
                                  className="w-[180px] h-8 border-r border-b border-gray-200 p-0 align-middle bg-white"
                                >
                                  <div className="h-8 pl-3 pr-2 flex items-center text-gray-300">
                                    {/* Empty placeholder */}
                                  </div>
                                </td>
                              ))}
                              {/* Add column cell */}
                              <td 
                                className="w-28 h-8 border-0 bg-transparent"
                                onMouseEnter={(e) => {
                                  e.stopPropagation();
                                  setHoveredRow(null);
                                }}
                              />
                            </tr>
                          );
                        }

                  const isHovered = hoveredRow === idx;
                  const isKeyboardRowActive = isKeyboardNav && activeCell?.rowIdx === idx;
                  const isRowHighlighted = isHovered || isKeyboardRowActive;
                        const rowId = row.id;
                  
                  return (
                    <tr
                      key={row.id}
                      className={isRowHighlighted ? 'bg-gray-50' : ''}
                      onMouseEnter={() => setHoveredRow(idx)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                            {tableMeta.columns.slice(1).map((col, cellIdx) => {
                              const columnId = col.id;
                        const cellKey = `${rowId}-${columnId}`;
                              
                              const cell = row.cells.find(c => c.columnId === columnId);
                              const serverValue = cell?.value ?? '';
                        const cellValue = localDrafts.get(cellKey) ?? serverValue;
                              
                        const isEditing = editingCell?.rowId === rowId && editingCell?.columnId === columnId;
                        const isSaving = savingCells.has(cellKey) || pendingCells.has(cellKey);
                        const isCommitting = committingCells.has(cellKey);
                              const colIdx = cellIdx + 1;
                        const isActive = activeCell?.rowIdx === idx && activeCell?.colIdx === colIdx;
                        const isKeyboardActive = isKeyboardNav && isActive && !isEditing;
                        
                        return (
                          <td
                                  key={columnId}
                            className={`w-[180px] h-8 border-r border-b border-gray-200 p-0 align-middle ${
                              isRowHighlighted ? 'bg-gray-50' : 'bg-white'
                            }`}
                          >
                            <input
                              ref={(el) => {
                                if (el) {
                                  cellInputRefs.current.set(cellKey, el);
                                } else {
                                  cellInputRefs.current.delete(cellKey);
                                }
                              }}
                                    key={`${tableId}-${rowId}-${columnId}`}
                              type="text"
                              className={`w-full h-8 pl-3 pr-2 bg-transparent outline-none table-cell-input ${
                                isEditing
                                  ? 'bg-blue-50'
                                  : isActive
                                    ? `ring-2 ring-blue-500 ring-inset ${isKeyboardActive ? 'text-[rgb(22,110,225)] cursor-pointer' : ''}`
                                    : ''
                              }`}
                              value={isEditing ? editValue : cellValue}
                              onClick={() => handleCellClick(rowId, columnId, cellValue, idx, colIdx)}
                              onChange={(e) => isEditing && handleCellChange(rowId, columnId, e.target.value)}
                              onBlur={() => {
                                if (committingCellKeyRef.current === cellKey) return;
                                if (isEditing) {
                                  void handleCellSave(rowId, columnId, false);
                                }
                              }}
                              onKeyDown={(e) => handleCellKeyDown(e, rowId, columnId)}
                              aria-busy={isSaving ? 'true' : 'false'}
                              readOnly={!isEditing || isCommitting}
                            />
                          </td>
                        );
                      })}

                      {/* Add column cell */}
                      <td 
                        className="w-28 h-8 border-0 bg-transparent"
                        onMouseEnter={(e) => {
                          e.stopPropagation();
                          setHoveredRow(null);
                        }}
                      />
                    </tr>
                  );
                })}
                    </tbody>
                  </table>
                  {/* Add row button at the end - always visible */}
                  <table className="min-w-[1200px]" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                    <tbody>
                      <tr
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredRow('add')}
                        onMouseLeave={() => setHoveredRow(null)}
                        onClick={() => handleCreateRow()}
                        title="Insert new record in grid"
                      >
                        {tableMeta.columns.slice(1).map((col) => (
                          <td
                            key={col.id}
                            className={`w-[180px] h-8 border-r border-b border-gray-200 p-0 align-middle ${
                              hoveredRow === 'add' ? 'bg-gray-50' : 'bg-white'
                            }`}
                          >
                            <div className="h-8 pl-3 pr-2" />
                          </td>
                        ))}
                        <td className="w-28 h-8 border-0 bg-transparent" />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
          </div>
          </div>
        </div>
      </div>

      {/* Bottom status bar */}
      <div className="h-9 border-t border-gray-200 flex items-center px-4 bg-gray-50 flex-shrink-0">
        <span className="text-xs text-gray-600">
          {rowCountData?.count ?? allRows.length} {(rowCountData?.count ?? allRows.length) === 1 ? 'record' : 'records'}
          {isFetchingNextPage && ' • Loading more...'}
        </span>
      </div>

      {/* Horizontal scrollbar */}
      <div
        ref={bottomScrollRef}
        onScroll={syncFromBottom}
        className={`h-4 ${isSearchOpen ? 'overflow-x-hidden' : 'overflow-x-auto'} overflow-y-hidden bg-gray-50 border-t border-gray-200 flex-shrink-0`}
      >
        <div style={{ width: bottomSpacerWidth, height: 1 }} />
      </div>
    </div>
  );
}
