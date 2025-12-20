'use client';

import { useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { Plus, Type } from 'lucide-react';
import { api } from '~/trpc/react';

type CellData = Record<string, string>;

export default function MainContent() {
  const params = useParams();
  const tableId = params.tableId as string;
  const isCreatingTable = tableId.startsWith('__creating__');
  
  const rootRef = useRef<HTMLDivElement | null>(null);
  const middleScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingRef = useRef<'middle' | 'bottom' | null>(null);
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

  // Prevent double-saves: saving a focused input temporarily disables it, which triggers blur.
  // That blur should NOT trigger another save (otherwise focus restoration gets lost).
  const committingCellKeyRef = useRef<string | null>(null);
  
  // Local draft map: keeps pending edits that haven't been saved yet
  // This prevents refetches from overwriting text you're typing
  // Key: "rowId-columnId", Value: draft text
  const [localDrafts, setLocalDrafts] = useState<Map<string, string>>(new Map());
  
  // Transition mask: brief skeleton on every table switch (like Airtable)
  // This signals "context change" even when data is cached
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Broadcast saving state so TopNav can render the global "Saving…" indicator.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('grid:saving', { detail: { count: savingCells.size } }),
    );
    return () => {
      // Clear on unmount so we don't leave a stale indicator visible after route changes.
      window.dispatchEvent(new CustomEvent('grid:saving', { detail: { count: 0 } }));
    };
  }, [savingCells]);
  
  // Fetch table data with stale-while-revalidate pattern
  // Shows cached data instantly while fetching fresh data in background
  const { data: tableData, isLoading } = api.table.getData.useQuery(
    { tableId },
    { 
      enabled: !isCreatingTable,
      // Stale-while-revalidate: show cached data, refetch in background
      staleTime: 1000 * 60 * 5, // Data is fresh for 5 minutes
      gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
      refetchOnMount: 'always', // Always check for updates, but show cache first
      refetchOnWindowFocus: false, // Don't refetch on window focus
    },
  );
  
  // Row creation with optimistic updates (Option B: allow rapid clicks)
  const utils = api.useUtils();
  const createRowMutation = api.table.createRow.useMutation({
    onMutate: async ({ clientRowId, afterRowId }) => {
      // Cancel outgoing refetches (so they don't overwrite our optimistic update)
      await utils.table.getData.cancel({ tableId });
      
      // Snapshot the previous value
      const previousData = utils.table.getData.getData({ tableId });
      
      // Optimistically insert the new row immediately
      const insertIndex = (() => {
        if (!previousData) return undefined;
        if (!afterRowId) return undefined;
        const idx = previousData.rows.findIndex((r) => r.id === afterRowId);
        return idx >= 0 ? idx + 1 : undefined;
      })();

      const tempRow = {
        id: `__temp__${clientRowId}`,
        order: (() => {
          if (!previousData) return 0;
          if (insertIndex === undefined) return previousData.rows.length;
          const after = previousData.rows[insertIndex - 1];
          const afterOrder = after?.order ?? -1;
          return afterOrder + 1;
        })(),
        tableId,
        clientRowId,
        createdAt: new Date(),
        updatedAt: new Date(),
        cells: (previousData?.columns ?? []).map(col => ({
          id: `__temp_cell__${col.id}__${clientRowId}`,
          rowId: `__temp__${clientRowId}`,
          columnId: col.id,
          value: '',
          createdAt: new Date(),
          updatedAt: new Date(),
          column: col,
        })),
      };
      
      utils.table.getData.setData({ tableId }, (oldData) => {
        if (!oldData) return oldData;

        const idx = insertIndex ?? oldData.rows.length;

        // If inserting into the middle, shift order values for rows after the insertion point.
        // (Server will do the same in a transaction.)
        const nextRows = oldData.rows.map((r, i) => {
          if (i >= idx) return { ...r, order: r.order + 1 };
          return r;
        });

        return {
          ...oldData,
          rows: [...nextRows.slice(0, idx), tempRow, ...nextRows.slice(idx)],
        };
      });

      // If this was created via keyboard insertion (Shift+Enter), move selection to the new row.
      if (insertIndex !== undefined && activeCell) {
        const targetRowIdx = insertIndex;
        const targetColIdx = activeCell.colIdx;
        setActiveCell({ rowIdx: targetRowIdx, colIdx: targetColIdx });
        setIsKeyboardNav(true);
        setTimeout(() => navigateToCell(targetRowIdx, targetColIdx), 0);
      }
      
      // Return context with the data we need for rollback
      return { previousData, clientRowId, insertIndex };
    },
    onSuccess: (newRow, variables, context) => {
      if (!context) return;
      
      // Replace optimistic temp row with real row from server
      // BUT preserve any cell values that were edited locally
      utils.table.getData.setData({ tableId }, (oldData) => {
        if (!oldData) return oldData;
        
        return {
          ...oldData,
          rows: oldData.rows.map(row => {
            // Replace the specific temp row that matches this clientRowId
            if (row.id === `__temp__${context.clientRowId}`) {
              // Merge: keep any cells that have local drafts or non-empty values
              const mergedCells = newRow.cells.map(newCell => {
                // Check if there's a local draft for this cell
                const draftKey = `${row.id}-${newCell.columnId}`;
                const localDraft = localDrafts.get(draftKey);
                
                if (localDraft !== undefined) {
                  // Preserve the draft value, update the draft key to use new row ID
                  setLocalDrafts(prev => {
                    const next = new Map(prev);
                    next.delete(draftKey); // Remove old temp ID key
                    next.set(`${newRow.id}-${newCell.columnId}`, localDraft); // Add with real ID
                    return next;
                  });
                  return { ...newCell, value: localDraft };
                }
                
                // Check if temp row had a value that was edited
                const tempCell = row.cells.find(c => c.columnId === newCell.columnId);
                if (tempCell && tempCell.value && !newCell.value) {
                  // Preserve the temp cell's value
                  return { ...newCell, value: tempCell.value };
                }
                
                return newCell;
              });
              
              return { ...newRow, cells: mergedCells };
            }
            return row;
          }),
        };
      });
    },
    onError: (error, _variables, context) => {
      if (!context) return;
      
      // Log error for debugging (can be removed in production)
      console.log('Row creation error:', error);
      
      // On error, refetch to see the true state
      // This handles cases where the row might have been created despite the error
      void utils.table.getData.invalidate({ tableId });
    },
  });
  
  // Cell update mutation - don't refetch on success to avoid disrupting typing
  const updateCellMutation = api.table.updateCell.useMutation({
    onError: (error) => {
      console.error('Failed to save cell:', error);
      // Only refetch on error
      void utils.table.getData.invalidate({ tableId });
    },
  });
  
  const handleCreateRow = (opts?: { afterRowId?: string }) => {
    if (isCreatingTable) return;
    
    // Generate unique client ID for this row creation
    const clientRowId = crypto.randomUUID();
    
    // Start mutation (optimistic insert happens in onMutate)
    createRowMutation.mutate({ tableId, clientRowId, afterRowId: opts?.afterRowId });
  };
  
  // Handle cell editing with local draft state
  const handleCellClick = (rowId: string, columnId: string, currentValue: string, rowIdx: number, colIdx: number) => {
    // Only set active cell on click, don't enter edit mode
    // User must type to enter edit mode
    setIsKeyboardNav(false);
    setActiveCell({ rowIdx, colIdx });
  };
  
  const handleCellChange = (rowId: string, columnId: string, newValue: string) => {
    const cellKey = `${rowId}-${columnId}`;
    
    // Update local draft immediately
    setLocalDrafts(prev => {
      const next = new Map(prev);
      next.set(cellKey, newValue);
      return next;
    });
    
    // Update edit state
    setEditValue(newValue);
    
    // Also update cache immediately so refetches don't lose data
    utils.table.getData.setData({ tableId }, (oldData) => {
      if (!oldData) return oldData;
      
      return {
        ...oldData,
        rows: oldData.rows.map(row => {
          if (row.id !== rowId) return row;
          
          return {
            ...row,
            cells: row.cells.map(cell => {
              if (cell.columnId !== columnId) return cell;
              return { ...cell, value: newValue };
            }),
          };
        }),
      };
    });
  };
  
  const handleCellSave = async (rowId: string, columnId: string, maintainFocus = true) => {
    // Only save if we're currently editing THIS cell.
    if (editingCell?.rowId !== rowId || editingCell?.columnId !== columnId) return;

    const cellKey = `${rowId}-${columnId}`;
    const newValue = editValue;

    // Mark as committing so onBlur doesn't fire a second save while we disable the input.
    committingCellKeyRef.current = cellKey;
    
    // Find the row and column indices for activeCell
    const rows = reactTable.getRowModel().rows;
    const currentRowIdx = rows.findIndex(r => r.original._id === rowId);
    const currentRow = rows[currentRowIdx];
    let currentColIdx = 0;
    
    if (currentRow) {
      const allCells = currentRow.getVisibleCells();
      currentColIdx = allCells.findIndex(c => c.column.id === columnId);
    }
    
    // Clear editing state
    setEditingCell(null);
    setEditValue('');
    
    // Set active cell so navigation knows which cell to move from
    setActiveCell({ rowIdx: currentRowIdx, colIdx: currentColIdx });
    
    // Remove from local drafts (it's now committed)
    setLocalDrafts(prev => {
      const next = new Map(prev);
      next.delete(cellKey);
      return next;
    });
    
    // Only save to server if not a temp row
    if (!rowId.startsWith('__temp__')) {
      setSavingCells(prev => new Set(prev).add(cellKey));
      
      try {
        await updateCellMutation.mutateAsync({
          rowId,
          columnId,
          value: newValue,
        });
      } catch (error) {
        console.error('Failed to save cell:', error);
        // On error, refetch to get the correct state
        void utils.table.getData.invalidate({ tableId });
      } finally {
        setSavingCells(prev => {
          const next = new Set(prev);
          next.delete(cellKey);
          return next;
        });
        
        // Refocus the input AFTER save completes so it's no longer disabled
        if (maintainFocus) {
          requestAnimationFrame(() => {
            const inputRef = cellInputRefs.current.get(cellKey);
            if (inputRef) {
              inputRef.focus();
              console.log('✅ Refocused input after save completed:', cellKey);
              console.log('Input disabled:', inputRef.disabled, 'readOnly:', inputRef.readOnly);
              console.log('Focus matches:', document.activeElement === inputRef ? 'YES' : 'NO');
            }
          });
        }

        // Allow blur saves again after commit is done
        if (committingCellKeyRef.current === cellKey) {
          committingCellKeyRef.current = null;
        }
      }
    } else {
      // For temp rows, refocus immediately since there's no async save
      if (maintainFocus) {
        requestAnimationFrame(() => {
          const inputRef = cellInputRefs.current.get(cellKey);
          if (inputRef) {
            inputRef.focus();
            console.log('✅ Refocused input (temp row):', cellKey);
          }
        });
      }

      // Allow blur saves again after commit is done
      if (committingCellKeyRef.current === cellKey) {
        committingCellKeyRef.current = null;
      }
    }
    // For temp rows, the value is already in cache, will be sent when row is created
  };
  
  const handleCellCancel = (rowId: string, columnId: string) => {
    const cellKey = `${rowId}-${columnId}`;
    
    // Remove local draft
    setLocalDrafts(prev => {
      const next = new Map(prev);
      next.delete(cellKey);
      return next;
    });
    
    setEditingCell(null);
    setEditValue('');
  };
  
  const handleCellKeyDown = (e: React.KeyboardEvent, rowId: string, columnId: string) => {
    console.log('🔑 Key pressed:', e.key, 'isEditing:', editingCell?.rowId === rowId && editingCell?.columnId === columnId);
    
    const cellKey = `${rowId}-${columnId}`;

    // Get current cell position
    const rows = reactTable.getRowModel().rows;
    const currentRowIdx = rows.findIndex(r => r.original._id === rowId);
    const currentRow = rows[currentRowIdx];
    if (!currentRow) return;
    
    const allCells = currentRow.getVisibleCells();
    const currentColIdx = allCells.findIndex(c => c.column.id === columnId);
    const isCurrentlyEditing = editingCell?.rowId === rowId && editingCell?.columnId === columnId;
    
    // Check if key is a printable character (to start editing)
    const isPrintableChar = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

    // If this cell is currently saving, don't allow starting a new edit here.
    // (But still allow navigation keys below.)
    if (!isCurrentlyEditing && isPrintableChar && savingCells.has(cellKey)) {
      e.preventDefault();
      return;
    }
    
    // If not editing and user types a printable character, enter edit mode and replace content
    if (!isCurrentlyEditing && isPrintableChar) {
      // Enter edit mode with the new character (replacing existing content)
      setEditingCell({ rowId, columnId });
      setEditValue(e.key);
      
      // Update local draft with just the new character
      setLocalDrafts(prev => new Map(prev).set(cellKey, e.key));
      
      // Prevent default to avoid the character being added twice
      e.preventDefault();
      return;
    }
    
    // Handle navigation keys - only intercept if NOT editing
    // When editing, let arrow keys work normally for cursor movement
    if (e.key === 'ArrowUp' && !isCurrentlyEditing) {
      console.log('⬆️ ArrowUp - navigating to row:', currentRowIdx - 1);
      e.preventDefault();
      setIsKeyboardNav(true);
      if (currentRowIdx > 0) {
        navigateToCell(currentRowIdx - 1, currentColIdx);
      }
    } else if (e.key === 'ArrowDown' && !isCurrentlyEditing) {
      console.log('⬇️ ArrowDown - navigating to row:', currentRowIdx + 1);
      e.preventDefault();
      setIsKeyboardNav(true);
      if (currentRowIdx < rows.length - 1) {
        navigateToCell(currentRowIdx + 1, currentColIdx);
      }
    } else if (e.key === 'ArrowLeft' && !isCurrentlyEditing) {
      console.log('⬅️ ArrowLeft - navigating to col:', currentColIdx - 1);
      e.preventDefault();
      setIsKeyboardNav(true);
      if (currentColIdx > 0) {
        navigateToCell(currentRowIdx, currentColIdx - 1);
      }
    } else if (e.key === 'ArrowRight' && !isCurrentlyEditing) {
      console.log('➡️ ArrowRight - navigating to col:', currentColIdx + 1);
      e.preventDefault();
      setIsKeyboardNav(true);
      if (currentColIdx < allCells.length - 1) {
        navigateToCell(currentRowIdx, currentColIdx + 1);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setIsKeyboardNav(true);
      if (editingCell) {
        void handleCellSave(rowId, columnId);
      }
      
      if (e.shiftKey) {
        // Shift+Tab: Move left
        if (currentColIdx > 0) {
          navigateToCell(currentRowIdx, currentColIdx - 1);
        } else if (currentRowIdx > 0) {
          // Wrap to end of previous row
          const prevRow = rows[currentRowIdx - 1];
          if (prevRow) {
            navigateToCell(currentRowIdx - 1, prevRow.getVisibleCells().length - 1);
          }
        }
      } else {
        // Tab: Move right
        if (currentColIdx < allCells.length - 1) {
          navigateToCell(currentRowIdx, currentColIdx + 1);
        } else if (currentRowIdx < rows.length - 1) {
          // Wrap to start of next row
          navigateToCell(currentRowIdx + 1, 0);
        }
      }
    } else if (e.key === 'Enter' && e.shiftKey && !isCurrentlyEditing) {
      // Shift+Enter inserts a new row below the current row (Airtable-like)
      e.preventDefault();
      setIsKeyboardNav(true);
      handleCreateRow({ afterRowId: rowId });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isCurrentlyEditing) {
        // If editing, save and exit edit mode
        void handleCellSave(rowId, columnId);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCellCancel(rowId, columnId);
    }
  };
  
  // Navigate to a specific cell by row/column index
  const navigateToCell = (rowIdx: number, colIdx: number) => {
    const rows = reactTable.getRowModel().rows;
    const targetRow = rows[rowIdx];
    if (!targetRow) return;
    
    const targetCell = targetRow.getVisibleCells()[colIdx];
    if (!targetCell) return;
    
    const rowId = targetRow.original._id;
    const columnId = targetCell.column.id;
    if (!rowId || !columnId) return;
    
    // Set active cell
    setActiveCell({ rowIdx, colIdx });
    
    // Focus the input
    const cellKey = `${rowId}-${columnId}`;
    const inputRef = cellInputRefs.current.get(cellKey);
    if (inputRef) {
      inputRef.focus();
      // Don't auto-select text on keyboard navigation; Airtable keeps the value unhighlighted.
      // If we want a caret without selection, place it at the end.
      try {
        const len = inputRef.value?.length ?? 0;
        inputRef.setSelectionRange(len, len);
      } catch {
        // Some browsers/edge cases (e.g. type changes) can throw; safe to ignore.
      }
      
      // Scroll into view
      inputRef.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  };
  
  // Show transition mask for 150-200ms on table switch
  // This is a UX pattern to signal "you changed context"
  useEffect(() => {
    if (prevTableIdRef.current !== tableId && !isCreatingTable) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 175); // Brief transition mask like Airtable
      prevTableIdRef.current = tableId;
      return () => clearTimeout(timer);
    }
  }, [tableId, isCreatingTable]);
  
  const showCreatingState = isCreatingTable;
  
  // Show transition mask on every switch, or loading state if no cached data
  const showTransitionMask = !isCreatingTable && (isTransitioning || isLoading);
  
  // Transform data for TanStack Table
  const columns = useMemo<ColumnDef<CellData>[]>(() => {
    if (!tableData) return [];
    
    return tableData.columns.map((col) => ({
      id: col.id,
      accessorKey: col.id,
      header: col.name,
      meta: {
        type: col.type,
      },
    }));
  }, [tableData]);
  
  const data = useMemo<CellData[]>(() => {
    if (!tableData) return [];
    
    return tableData.rows.map((row) => {
      const rowData: CellData = { _id: row.id };
      row.cells.forEach((cell) => {
        rowData[cell.columnId] = cell.value ?? '';
      });
      return rowData;
    });
  }, [tableData]);
  
  const reactTable = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // Keep keyboard navigation working even if focus temporarily leaves the input (e.g. during save).
  // Capture at the root so default browser behavior (horizontal scrolling, focus traversal) doesn't win.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onKeyDownCapture = (e: KeyboardEvent) => {
      if (!activeCell) return;

      // If the user is actively typing into an input/textarea/contenteditable, don't steal keys
      // EXCEPT for Tab which we always keep within the grid.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditableTarget =
        tag === 'input' ||
        tag === 'textarea' ||
        (target?.isContentEditable ?? false);

      const key = e.key;

      // Tab should never escape the grid while a cell is active.
      if (key === 'Tab') {
        e.preventDefault();
        setIsKeyboardNav(true);

        const rows = reactTable.getRowModel().rows;
        const row = rows[activeCell.rowIdx];
        if (!row) return;
        const maxCol = row.getVisibleCells().length - 1;

        if (e.shiftKey) {
          if (activeCell.colIdx > 0) navigateToCell(activeCell.rowIdx, activeCell.colIdx - 1);
          else if (activeCell.rowIdx > 0) {
            const prev = rows[activeCell.rowIdx - 1];
            if (prev) navigateToCell(activeCell.rowIdx - 1, prev.getVisibleCells().length - 1);
          }
        } else {
          if (activeCell.colIdx < maxCol) navigateToCell(activeCell.rowIdx, activeCell.colIdx + 1);
          else if (activeCell.rowIdx < rows.length - 1) navigateToCell(activeCell.rowIdx + 1, 0);
        }
        return;
      }

      // If the focus is in an editable element, let it handle arrows/enter/etc.
      if (isEditableTarget) return;

      // When focus drifts to a scroll container, arrows can scroll horizontally.
      // If we have an active cell, route navigation keys back into the grid.
      if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
        e.preventDefault();
        setIsKeyboardNav(true);

        const rows = reactTable.getRowModel().rows;
        const rowCount = rows.length;
        const next = { ...activeCell };

        if (key === 'ArrowUp') next.rowIdx = Math.max(0, activeCell.rowIdx - 1);
        if (key === 'ArrowDown') next.rowIdx = Math.min(rowCount - 1, activeCell.rowIdx + 1);
        if (key === 'ArrowLeft') next.colIdx = Math.max(0, activeCell.colIdx - 1);
        if (key === 'ArrowRight') next.colIdx = activeCell.colIdx + 1;

        // Clamp colIdx to row's visible cell count
        const row = rows[next.rowIdx];
        const maxCol = row ? row.getVisibleCells().length - 1 : 0;
        next.colIdx = Math.min(Math.max(0, next.colIdx), maxCol);

        navigateToCell(next.rowIdx, next.colIdx);
        return;
      }

      // Shift+Enter inserts a new row below the current active row even if focus isn't on an input.
      if (key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        setIsKeyboardNav(true);
        const rows = reactTable.getRowModel().rows;
        const current = rows[activeCell.rowIdx];
        const currentRowId = current?.original?._id;
        if (currentRowId) {
          handleCreateRow({ afterRowId: currentRowId });
        }
      }
    };

    root.addEventListener('keydown', onKeyDownCapture, { capture: true });
    return () => root.removeEventListener('keydown', onKeyDownCapture, { capture: true } as never);
  }, [activeCell, reactTable]);

  const syncFromMiddle = () => {
    const middle = middleScrollRef.current;
    const bottom = bottomScrollRef.current;
    if (!middle || !bottom) return;
    if (syncingRef.current === 'bottom') return;
    syncingRef.current = 'middle';
    bottom.scrollLeft = middle.scrollLeft;
    syncingRef.current = null;
  };

  const syncFromBottom = () => {
    const middle = middleScrollRef.current;
    const bottom = bottomScrollRef.current;
    if (!middle || !bottom) return;
    if (syncingRef.current === 'middle') return;
    syncingRef.current = 'bottom';
    middle.scrollLeft = bottom.scrollLeft;
    syncingRef.current = null;
  };

  useLayoutEffect(() => {
    const middle = middleScrollRef.current;
    const bottom = bottomScrollRef.current;
    if (!middle || !bottom) return;

    const update = () => {
      // We want bottom scrollbar max == middle scroll max.
      // bottomMax = spacerWidth - bottomClientWidth
      // middleMax = middleScrollWidth - middleClientWidth
      const middleMax = Math.max(0, middle.scrollWidth - middle.clientWidth);
      const spacerWidth = bottom.clientWidth + middleMax;
      setBottomSpacerWidth(spacerWidth);
    };

    update();

    // Update on size changes (viewport and content)
    const ro = new ResizeObserver(update);
    ro.observe(middle);
    ro.observe(bottom);
    const table = middle.querySelector('table');
    if (table) ro.observe(table);

    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    // Initial sync so bottom scrollbar matches current position
    syncFromMiddle();
  }, []);

  if (showCreatingState) {
    // Blank screen while creating table (no visual elements)
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ backgroundColor: '#f6f8fc' }} />
    );
  }

  if (showTransitionMask) {
    // Transition mask: completely blank screen for ~175ms to signal "context change"
    // This appears even when data is cached (like Airtable)
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ backgroundColor: '#f6f8fc' }} />
    );
  }

  return (
    <div
      ref={rootRef}
      className="flex-1 min-h-0 flex flex-col overflow-hidden"
      style={{ backgroundColor: '#f6f8fc' }}
    >
      {/* Spreadsheet grid
          - Left (checkbox + Name) is fixed
          - Middle scrolls horizontally
          - Right (+) stays fixed */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full overflow-y-auto overflow-x-hidden">
          <div className="flex min-w-0 h-full">
          {/* Left fixed pane */}
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
                      <Type className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-xs font-semibold text-gray-700">Name</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {reactTable.getRowModel().rows.map((row, idx) => {
                  const isHovered = hoveredRow === idx;
                  const isKeyboardRowActive = isKeyboardNav && activeCell?.rowIdx === idx;
                  const isRowHighlighted = isHovered || isKeyboardRowActive;
                  const firstCell = row.getVisibleCells()[0];
                  if (!firstCell) return null;
                  
                  const rowId = row.original._id;
                  if (!rowId) return null;
                  
                  const columnId = firstCell.column.id;
                  const cellKey = `${rowId}-${columnId}`;
                  const serverValue = (firstCell.getValue() as string ?? '');
                  // Use local draft if available, otherwise use server value
                  const cellValue = localDrafts.get(cellKey) ?? serverValue;
                  const isEditing = editingCell?.rowId === rowId && editingCell?.columnId === columnId;
                  const isSaving = savingCells.has(cellKey);
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
                                : 'focus:bg-blue-50'
                          }`}
                          value={isEditing ? editValue : cellValue}
                          onClick={() => handleCellClick(rowId, columnId, cellValue, idx, 0)}
                          onChange={(e) => isEditing && handleCellChange(rowId, columnId, e.target.value)}
                          onBlur={() => {
                            console.log('❌ Input blur:', cellKey);
                            // When saving, the input becomes disabled which causes blur.
                            // Avoid triggering a second save that would drop focus restoration.
                            if (committingCellKeyRef.current === cellKey) return;

                            if (isEditing) {
                              void handleCellSave(rowId, columnId, false);
                            }
                          }}
                          onFocus={() => {
                            console.log('✨ Input focus:', cellKey);
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, rowId, columnId)}
                          aria-busy={isSaving ? 'true' : 'false'}
                          readOnly={!isEditing || isSaving}
                        />
                      </td>
                    </tr>
                  );
                })}
                {/* Add row button (ghost row) */}
                <tr
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredRow('add')}
                  onMouseLeave={() => setHoveredRow(null)}
                  onClick={() => handleCreateRow()}
                  title="Insert new record in grid"
                >
                  <td
                    colSpan={2}
                    className={`h-8 border-b border-gray-200 p-0 align-middle ${
                      hoveredRow === 'add' ? 'bg-gray-50' : 'bg-white'
                    }`}
                  >
                    <div className={`h-8 flex items-center px-3 ${
                      hoveredRow === 'add' ? 'text-gray-600' : 'text-gray-400'
                    }`}>
                      <Plus className="w-4 h-4" />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Middle scrollable pane (scrollbar hidden; controlled by bottom scrollbar) */}
          <div
            ref={middleScrollRef}
            onScroll={syncFromMiddle}
            className="flex-1 min-w-0 h-full overflow-x-auto overflow-y-hidden hide-scrollbar"
          >
            <table className="min-w-[1200px]" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr className="bg-white h-8">
                  {reactTable.getHeaderGroups()[0]?.headers.slice(1).map((header) => (
                    <th
                      key={header.id}
                      className="w-[180px] h-8 border-r border-b border-gray-200 p-0 text-left bg-white align-middle"
                    >
                      <div className="h-8 px-2 flex items-center gap-2">
                        <Type className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-xs font-semibold text-gray-700">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                      </div>
                    </th>
                  ))}

                  {/* Add column button */}
                  <th className="w-28 h-8 border-r border-b border-gray-200 bg-white p-0 align-middle">
                    <button className="w-full h-8 flex items-center justify-center hover:bg-gray-100 text-gray-500">
                      <Plus className="w-4 h-4" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {reactTable.getRowModel().rows.map((row, idx) => {
                  const isHovered = hoveredRow === idx;
                  const isKeyboardRowActive = isKeyboardNav && activeCell?.rowIdx === idx;
                  const isRowHighlighted = isHovered || isKeyboardRowActive;
                  const visibleCells = row.getVisibleCells().slice(1); // Skip first column (Name)
                  const rowId = row.original._id;
                  if (!rowId) return null;
                  
                  return (
                    <tr
                      key={row.id}
                      className={isRowHighlighted ? 'bg-gray-50' : ''}
                      onMouseEnter={() => setHoveredRow(idx)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      {visibleCells.map((cell, cellIdx) => {
                        const columnId = cell.column.id;
                        const cellKey = `${rowId}-${columnId}`;
                        const serverValue = (cell.getValue() as string ?? '');
                        // Use local draft if available, otherwise use server value
                        const cellValue = localDrafts.get(cellKey) ?? serverValue;
                        const isEditing = editingCell?.rowId === rowId && editingCell?.columnId === columnId;
                        const isSaving = savingCells.has(cellKey);
                        const colIdx = cellIdx + 1; // +1 because first column (Name) is in left pane
                        const isActive = activeCell?.rowIdx === idx && activeCell?.colIdx === colIdx;
                        const isKeyboardActive = isKeyboardNav && isActive && !isEditing;
                        
                        return (
                          <td
                            key={cell.id}
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
                              key={`${tableId}-${cell.id}`}
                              type="text"
                              className={`w-full h-8 pl-3 pr-2 bg-transparent outline-none table-cell-input ${
                                isEditing
                                  ? 'bg-blue-50'
                                  : isActive
                                    ? `ring-2 ring-blue-500 ring-inset ${isKeyboardActive ? 'text-[rgb(22,110,225)] cursor-pointer' : ''}`
                                    : 'focus:bg-blue-50'
                              }`}
                              value={isEditing ? editValue : cellValue}
                              onClick={() => handleCellClick(rowId, columnId, cellValue, idx, colIdx)}
                              onChange={(e) => isEditing && handleCellChange(rowId, columnId, e.target.value)}
                              onBlur={() => {
                                console.log('❌ Input blur:', cellKey);
                                // When saving, the input becomes disabled which causes blur.
                                // Avoid triggering a second save that would drop focus restoration.
                                if (committingCellKeyRef.current === cellKey) return;

                                if (isEditing) {
                                  void handleCellSave(rowId, columnId, false);
                                }
                              }}
                              onFocus={() => {
                                console.log('✨ Input focus:', cellKey);
                              }}
                              onKeyDown={(e) => handleCellKeyDown(e, rowId, columnId)}
                              aria-busy={isSaving ? 'true' : 'false'}
                              readOnly={!isEditing || isSaving}
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
                {/* Add row button (ghost row) - right pane */}
                <tr
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredRow('add')}
                  onMouseLeave={() => setHoveredRow(null)}
                  onClick={() => handleCreateRow()}
                  title="Insert new record in grid"
                >
                  <td
                    colSpan={(tableData?.columns.length ?? 5) - 1}
                    className={`h-8 border-r border-b border-gray-200 p-0 ${
                      hoveredRow === 'add' ? 'bg-gray-50' : 'bg-white'
                    }`}
                  >
                    <div className="h-8" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          </div>
        </div>
      </div>

      {/* Bottom status bar */}
      <div className="h-9 border-t border-gray-200 flex items-center px-4 bg-gray-50 flex-shrink-0">
        <span className="text-xs text-gray-600">
          {data.length} {data.length === 1 ? 'record' : 'records'}
        </span>
      </div>

      {/* Horizontal scrollbar (separate bar under status) */}
      <div
        ref={bottomScrollRef}
        onScroll={syncFromBottom}
        className="h-4 overflow-x-auto overflow-y-hidden bg-gray-50 border-t border-gray-200 flex-shrink-0"
      >
        <div style={{ width: bottomSpacerWidth, height: 1 }} />
      </div>
    </div>
  );
}
