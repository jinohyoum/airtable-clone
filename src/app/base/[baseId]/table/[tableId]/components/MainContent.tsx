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
  
  const middleScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingRef = useRef<'middle' | 'bottom' | null>(null);
  const prevTableIdRef = useRef<string>(tableId);
  const [bottomSpacerWidth, setBottomSpacerWidth] = useState<number>(0);
  const [hoveredRow, setHoveredRow] = useState<number | 'add' | null>(null);
  
  // Active cell for keyboard navigation (row index, column index)
  const [activeCell, setActiveCell] = useState<{ rowIdx: number; colIdx: number } | null>(null);
  const cellInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  
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
    onMutate: async ({ clientRowId }) => {
      // Cancel outgoing refetches (so they don't overwrite our optimistic update)
      await utils.table.getData.cancel({ tableId });
      
      // Snapshot the previous value
      const previousData = utils.table.getData.getData({ tableId });
      
      // Optimistically insert the new row immediately
      const tempRow = {
        id: `__temp__${clientRowId}`,
        order: (previousData?.rows.length ?? 0),
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
        return {
          ...oldData,
          rows: [...oldData.rows, tempRow],
        };
      });
      
      // Return context with the data we need for rollback
      return { previousData, clientRowId };
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
  
  const handleCreateRow = () => {
    if (isCreatingTable) return;
    
    // Generate unique client ID for this row creation
    const clientRowId = crypto.randomUUID();
    
    // Start mutation (optimistic insert happens in onMutate)
    createRowMutation.mutate({ tableId, clientRowId });
  };
  
  // Handle cell editing with local draft state
  const handleCellClick = (rowId: string, columnId: string, currentValue: string, rowIdx: number, colIdx: number) => {
    // Only set active cell on click, don't enter edit mode
    // User must type to enter edit mode
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
    if (!editingCell || editingCell.rowId !== rowId || editingCell.columnId !== columnId) return;

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
      if (currentRowIdx > 0) {
        navigateToCell(currentRowIdx - 1, currentColIdx);
      }
    } else if (e.key === 'ArrowDown' && !isCurrentlyEditing) {
      console.log('⬇️ ArrowDown - navigating to row:', currentRowIdx + 1);
      e.preventDefault();
      if (currentRowIdx < rows.length - 1) {
        navigateToCell(currentRowIdx + 1, currentColIdx);
      }
    } else if (e.key === 'ArrowLeft' && !isCurrentlyEditing) {
      console.log('⬅️ ArrowLeft - navigating to col:', currentColIdx - 1);
      e.preventDefault();
      if (currentColIdx > 0) {
        navigateToCell(currentRowIdx, currentColIdx - 1);
      }
    } else if (e.key === 'ArrowRight' && !isCurrentlyEditing) {
      console.log('➡️ ArrowRight - navigating to col:', currentColIdx + 1);
      e.preventDefault();
      if (currentColIdx < allCells.length - 1) {
        navigateToCell(currentRowIdx, currentColIdx + 1);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
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
      inputRef.select(); // Select all text for easy editing
      
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
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden" style={{ backgroundColor: '#f6f8fc' }}>
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
                  
                  return (
                    <tr
                      key={row.id}
                      className={isHovered ? 'bg-gray-50' : ''}
                      onMouseEnter={() => setHoveredRow(idx)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <td
                        className={`w-[44px] h-8 border-b border-gray-200 text-center align-middle ${
                          isHovered ? 'bg-gray-50' : 'bg-white'
                        }`}
                      >
                        <div className="h-8 flex items-center justify-center text-xs text-gray-500 font-medium">
                          {idx + 1}
                        </div>
                      </td>
                      <td
                        className={`w-[180px] h-8 border-b border-gray-200 p-0 align-middle ${
                          isHovered ? 'bg-gray-50' : 'bg-white'
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
                            isEditing ? 'bg-blue-50' : isActive ? 'ring-2 ring-blue-500 ring-inset' : 'focus:bg-blue-50'
                          }`}
                          value={isEditing ? editValue : cellValue}
                          onClick={() => handleCellClick(rowId, columnId, cellValue, idx, 0)}
                          onChange={(e) => isEditing && handleCellChange(rowId, columnId, e.target.value)}
                          onBlur={(e) => {
                            console.log('❌ Input blur:', cellKey);
                            // When saving, the input becomes disabled which causes blur.
                            // Avoid triggering a second save that would drop focus restoration.
                            if (committingCellKeyRef.current === cellKey) return;

                            if (isEditing) {
                              void handleCellSave(rowId, columnId, false);
                            }
                          }}
                          onFocus={(e) => {
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
                  onClick={handleCreateRow}
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
                  const visibleCells = row.getVisibleCells().slice(1); // Skip first column (Name)
                  const rowId = row.original._id;
                  if (!rowId) return null;
                  
                  return (
                    <tr
                      key={row.id}
                      className={isHovered ? 'bg-gray-50' : ''}
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
                        
                        return (
                          <td
                            key={cell.id}
                            className={`w-[180px] h-8 border-r border-b border-gray-200 p-0 align-middle ${
                              isHovered ? 'bg-gray-50' : 'bg-white'
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
                                isEditing ? 'bg-blue-50' : isActive ? 'ring-2 ring-blue-500 ring-inset' : 'focus:bg-blue-50'
                              }`}
                              value={isEditing ? editValue : cellValue}
                              onClick={() => handleCellClick(rowId, columnId, cellValue, idx, colIdx)}
                              onChange={(e) => isEditing && handleCellChange(rowId, columnId, e.target.value)}
                              onBlur={(e) => {
                                console.log('❌ Input blur:', cellKey);
                                // When saving, the input becomes disabled which causes blur.
                                // Avoid triggering a second save that would drop focus restoration.
                                if (committingCellKeyRef.current === cellKey) return;

                                if (isEditing) {
                                  void handleCellSave(rowId, columnId, false);
                                }
                              }}
                              onFocus={(e) => {
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
                  onClick={handleCreateRow}
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
