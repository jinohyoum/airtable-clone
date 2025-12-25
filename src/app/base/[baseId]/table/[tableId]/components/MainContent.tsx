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
import { useColumnsUi } from './ColumnsUiContext';
import { getColumnIconName } from './columnIcons';
import FieldTypePicker from './FieldTypePicker';

const ICON_SPRITE = '/icons/icon_definitions.svg?v=04661fff742a9043fa037c751b1c6e66';

type CellData = Record<string, string>;

export default function MainContent({
  isSearchOpen = false,
  search,
  sortRules,
  filters,
}: {
  isSearchOpen?: boolean;
  search?: string;
  sortRules?: Array<{ columnId: string; direction: 'asc' | 'desc' }>;
  filters?: Array<{
    id: string;
    columnId: string;
    operator: 'isEmpty' | 'isNotEmpty' | 'contains' | 'notContains' | 'equals' | 'greaterThan' | 'lessThan';
    value?: string;
  }>;
}) {
  const params = useParams();
  const tableId = ((params.tableId as string | undefined) ?? '').toString();
  const hasTableId = tableId.length > 0;
  const isCreatingTable = hasTableId ? tableId.startsWith('__creating__') : false;

  // sortRules is already normalized in applySortRules, so use it directly
  const normalizedSortRules = sortRules?.length ? sortRules : undefined;

  // Normalize filters for API (map to the shape expected by the router)
  const normalizedFilters = useMemo(() => {
    if (!filters || filters.length === 0) return undefined;
    return filters.map(f => ({
      columnId: f.columnId,
      operator: f.operator,
      value: f.value,
    }));
  }, [filters]);

  const sortSignature = useMemo(() => JSON.stringify(normalizedSortRules ?? []), [normalizedSortRules]);
  const filterSignature = useMemo(() => JSON.stringify(normalizedFilters ?? []), [normalizedFilters]);

  // tRPC utils + rows query key are used throughout (including in early effects), so define them up-front.
  const utils = api.useUtils();
  const rowsQueryInput = useMemo(
    () => ({ 
      tableId, 
      limit: 500 as const, 
      search, 
      sortRules: normalizedSortRules,
      filters: normalizedFilters,
    }),
    // Use the stringified signatures so identical-content new references don't retrigger.
    [tableId, search, sortSignature, filterSignature],
  );

  // When the user applies Sort in the toolbar, we want to trigger the global "Saving…" UI
  // while the grid refetches rows for the new sort.
  const [sortSaving, setSortSaving] = useState<{ active: boolean; signature: string }>({
    active: false,
    signature: '[]',
  });

  // Track filter saving state (similar to sort)
  const [filterSaving, setFilterSaving] = useState<{ active: boolean; signature: string }>({
    active: false,
    signature: '[]',
  });

  const sortedColumnIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of normalizedSortRules ?? []) ids.add(r.columnId);
    return ids;
  }, [normalizedSortRules]);

  // Track filtered columns (only those with non-empty values)
  const filteredColumnIds = useMemo(() => {
    const ids = new Set<string>();
    for (const f of normalizedFilters ?? []) {
      if (f.value && f.value.trim().length > 0) {
        ids.add(f.columnId);
      }
    }
    return ids;
  }, [normalizedFilters]);

  // When creating a row while sort is active, we keep it visible where it was created
  // (so the user's focus doesn't "teleport"), and only refetch to re-sort once focus leaves that row.
  const pendingResortAfterCreateRef = useRef<{ rowId: string; sortSignature: string } | null>(null);

  const SORTED_HEADER_BG = 'rgb(255, 251, 249)';
  const SORTED_COLUMN_BG = 'rgb(255, 242, 235)';
  const FILTERED_HEADER_BG = 'rgba(249, 254, 250)';
  const FILTERED_COLUMN_BG = 'rgba(236, 251, 237)';
  const SEARCH_CELL_BG = 'rgba(255, 243, 213)';
  const SEARCH_ROW_NUMBER_BG = 'rgba(255, 243, 213)';
  const SEARCH_FILTER_OVERLAP_BG = 'rgba(236, 230, 172)';
  
  // Helper function to check if a cell value contains the search term
  const cellMatchesSearch = useCallback((cellValue: string, searchTerm?: string): boolean => {
    if (!searchTerm || searchTerm.trim().length === 0) return false;
    const normalizedValue = (cellValue ?? '').toLowerCase();
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return normalizedValue.includes(normalizedSearch);
  }, []);

  // Helper function to check if any cell in a row contains the search term
  const rowMatchesSearch = useCallback((row: typeof allRows[0], searchTerm?: string): boolean => {
    if (!searchTerm || searchTerm.trim().length === 0) return false;
    if (!row) return false;
    return row.cells.some(cell => cellMatchesSearch(cell.value ?? '', searchTerm));
  }, [cellMatchesSearch]);
  
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
  // Track when we enter edit mode via double-click (to select all text)
  const doubleClickEditRef = useRef<string | null>(null);

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

  // Field type picker state
  const [fieldTypePickerOpen, setFieldTypePickerOpen] = useState(false);
  const [fieldTypePickerPosition, setFieldTypePickerPosition] = useState<{ x: number; y: number } | null>(null);
  const fieldTypePickerRef = useRef<HTMLDivElement>(null);

  // Broadcast saving state so TopNav can render the global "Saving…" indicator.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Include non-cell mutations (like row creation) so the global indicator matches Airtable-like UX.
    const count =
      new Set<string>([...pendingCells, ...savingCells]).size +
      rowCreatesInFlight.size +
      rowDeletesInFlight.size +
      // Sorting and filtering aren't server mutations, but Airtable shows the same global "Saving…" while refetching.
      (sortSaving.active ? 1 : 0) +
      (filterSaving.active ? 1 : 0);
    window.dispatchEvent(
      new CustomEvent('grid:saving', { detail: { count } }),
    );
    return () => {
      // Clear on unmount so we don't leave a stale indicator visible after route changes.
      window.dispatchEvent(new CustomEvent('grid:saving', { detail: { count: 0 } }));
    };
  }, [pendingCells, savingCells, rowCreatesInFlight, rowDeletesInFlight, sortSaving.active, filterSaving.active]);

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

  const { columnOrder, hiddenColumnIds, ensureColumnOrder, setColumnOrder, setHiddenColumnIds } = useColumnsUi();

  const mapUiFieldTypeToDbType = useCallback((fieldTypeId: string): string => {
    switch (fieldTypeId) {
      case 'text':
        return 'singleLineText';
      case 'multilineText':
        return 'longText';
      case 'number':
        return 'number';
      default:
        // Keep safe default. (Project scope is mainly Text + Number.)
        return 'singleLineText';
    }
  }, []);

  const isOptimisticColumnId = useCallback((columnId: string) => {
    return columnId.startsWith('__creating_col__');
  }, []);

  const upsertRowCell = useCallback(
    (
      row: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        cells: Array<{ columnId: string; value?: string; [key: string]: unknown }>;
      },
      columnId: string,
      value: string,
    ) => {
      const idx = row.cells.findIndex((c) => c.columnId === columnId);
      if (idx >= 0) {
        const nextCells = row.cells.map((c) => (c.columnId === columnId ? { ...c, value } : c));
        return { ...row, cells: nextCells };
      }

      const col = tableMeta?.columns?.find((c) => c.id === columnId);
      if (!col) return row;

      return {
        ...row,
        cells: [
          ...row.cells,
          {
            id: `${row.id}-${columnId}`,
            value,
            rowId: row.id,
            columnId,
            column: col,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          },
        ],
      };
    },
    [tableMeta],
  );

  const createColumnMutation = api.table.createColumn.useMutation({
    onMutate: async (variables) => {
      await utils.table.getTableMeta.cancel({ tableId: variables.tableId });
      const previous = utils.table.getTableMeta.getData({ tableId: variables.tableId });

      const tempId = `__creating_col__${Date.now()}`;
      const now = new Date();
      const trimmedName = variables.name?.trim();
      const trimmedDefault = variables.defaultValue?.trim();

      const existingNames = new Set(previous?.columns?.map((c) => c.name) ?? []);
      let optimisticName = trimmedName && trimmedName.length > 0 ? trimmedName : undefined;
      if (!optimisticName) {
        let i = (previous?.columns?.length ?? 0) + 1;
        while (existingNames.has(`Field ${i}`)) i++;
        optimisticName = `Field ${i}`;
      }

      const nextOrder =
        previous?.columns?.reduce((m, c) => Math.max(m, c.order), -1) != null
          ? (previous?.columns?.reduce((m, c) => Math.max(m, c.order), -1) ?? -1) + 1
          : 0;

      const options = trimmedDefault && trimmedDefault.length > 0
        ? JSON.stringify({ defaultValue: trimmedDefault })
        : null;

      if (previous) {
        utils.table.getTableMeta.setData({ tableId: variables.tableId }, (old) => {
          if (!old) return old;
          return {
            ...old,
            columns: [
              ...old.columns,
              {
                id: tempId,
                tableId: variables.tableId,
                name: optimisticName!,
                type: variables.type,
                order: nextOrder,
                options,
                createdAt: now,
                updatedAt: now,
              } as (typeof old.columns)[number],
            ],
          };
        });

        // Keep any user-defined column order stable; append the new column.
        if (columnOrder && !columnOrder.includes(tempId)) {
          setColumnOrder([...columnOrder, tempId]);
        }
      }

      return { previous, tempId };
    },
    onError: (err, variables, ctx) => {
      console.error('Failed to create column:', err);
      if (ctx?.previous) {
        utils.table.getTableMeta.setData({ tableId: variables.tableId }, ctx.previous);
      }
      if (ctx?.tempId) {
        // Clean up any UI-only references
        if (columnOrder?.includes(ctx.tempId)) {
          setColumnOrder(columnOrder.filter((id) => id !== ctx.tempId));
        }
        if (hiddenColumnIds.has(ctx.tempId)) {
          const next = new Set(hiddenColumnIds);
          next.delete(ctx.tempId);
          setHiddenColumnIds(next);
        }
      }
    },
    onSuccess: (created, variables, ctx) => {
      // Replace optimistic temp column with the real one.
      if (ctx?.tempId) {
        utils.table.getTableMeta.setData({ tableId: variables.tableId }, (old) => {
          if (!old) return old;
          return {
            ...old,
            columns: old.columns.map((c) => (c.id === ctx.tempId ? created : c)),
          };
        });

        if (columnOrder?.includes(ctx.tempId)) {
          setColumnOrder(columnOrder.map((id) => (id === ctx.tempId ? created.id : id)));
        }
        if (hiddenColumnIds.has(ctx.tempId)) {
          const next = new Set(hiddenColumnIds);
          next.delete(ctx.tempId);
          next.add(created.id);
          setHiddenColumnIds(next);
        }
      }

      // Make the new column behave like existing ones immediately:
      // - add a corresponding cell object to all currently loaded rows in the cache
      //   (avoids refetch + ensures updates work against row.cells).
      let defaultValue = '';
      if (typeof created.options === 'string' && created.options) {
        try {
          const parsed = JSON.parse(created.options) as unknown;
          const dv = (parsed as { defaultValue?: unknown } | null)?.defaultValue;
          if (typeof dv === 'string') defaultValue = dv;
        } catch {
          // ignore invalid JSON
        }
      }

      utils.table.getRows.setInfiniteData(rowsQueryInput, (old) => {
        if (!old) return old;
        return {
          pages: old.pages.map((page) => ({
            ...page,
            rows: page.rows.map((r) => {
              // Only patch loaded rows; avoid duplicates.
              if (r.cells.some((c) => c.columnId === created.id)) return r;
              return {
                ...r,
                cells: [
                  ...r.cells,
                  {
                    id: `${r.id}-${created.id}`,
                    value: defaultValue,
                    rowId: r.id,
                    columnId: created.id,
                    column: created,
                    createdAt: r.createdAt,
                    updatedAt: r.updatedAt,
                  },
                ],
              };
            }),
          })),
          pageParams: old.pageParams,
        };
      });
    },
    onSettled: async (_data, _err, variables) => {
      // Keep meta in sync with server (also updates timestamps/order precisely).
      await utils.table.getTableMeta.invalidate({ tableId: variables.tableId });
    },
  });

  useEffect(() => {
    if (!tableMeta) return;
    ensureColumnOrder(tableMeta.columns.map((c) => c.id));
  }, [tableMeta, ensureColumnOrder]);

  const primaryColumnId = tableMeta?.columns?.[0]?.id ?? null;

  const orderedColumnIds = useMemo(() => {
    if (!tableMeta) return [];
    const defaultIds = tableMeta.columns.map((c) => c.id);
    const base = columnOrder ?? defaultIds;
    const existing = new Set(defaultIds);
    const normalized = base.filter((id) => existing.has(id));
    for (const id of defaultIds) {
      if (!normalized.includes(id)) normalized.push(id);
    }
    return normalized;
  }, [tableMeta, columnOrder]);

  const displayColumns = useMemo(() => {
    if (!tableMeta) return [];
    const byId = new Map(tableMeta.columns.map((c) => [c.id, c] as const));
    const ordered = orderedColumnIds
      .map((id) => byId.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    // Airtable behavior: primary field cannot be hidden; hide-all hides everything except primary.
    return ordered.filter((c) => (primaryColumnId ? c.id === primaryColumnId : true) || !hiddenColumnIds.has(c.id));
  }, [tableMeta, orderedColumnIds, hiddenColumnIds, primaryColumnId]);

  // Fetch total row count from database (for accurate record count display)
  const { data: rowCountData, error: rowCountError } = api.table.getRowCount.useQuery(
    { tableId: tableId ?? "", search, filters: normalizedFilters },
    { enabled: hasTableId && !isCreatingTable },
  );
  
  // Infinite query for rows with cursor-based paging
  const {
    data: rowPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingRows,
    isFetching: isFetchingRows,
    error: rowsError,
  } = api.table.getRows.useInfiniteQuery(
    { 
      tableId: tableId ?? "",
      limit: 500, // Fetch 500 rows per page for smoother scrolling
      search,
      sortRules: normalizedSortRules,
      filters: normalizedFilters,
    },
    {
      enabled: hasTableId && !isCreatingTable,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      staleTime: 30_000, // 30 seconds
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
    },
  );

  // Listen for "sort applied" events from the toolbar.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onSortSaving = (e: Event) => {
      const ce = e as CustomEvent<{ active?: boolean; signature?: string }>;
      const active = Boolean(ce.detail?.active);
      const signature = ce.detail?.signature ?? '[]';
      setSortSaving({ active, signature });
    };
    window.addEventListener('grid:sortSaving', onSortSaving as EventListener);
    return () => window.removeEventListener('grid:sortSaving', onSortSaving as EventListener);
  }, []);

  // Listen for "filter applied" events from the toolbar.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onFilterSaving = (e: Event) => {
      const ce = e as CustomEvent<{ active?: boolean; signature?: string }>;
      const active = Boolean(ce.detail?.active);
      const signature = ce.detail?.signature ?? '[]';
      setFilterSaving({ active, signature });
    };
    window.addEventListener('grid:filterSaving', onFilterSaving as EventListener);
    return () => window.removeEventListener('grid:filterSaving', onFilterSaving as EventListener);
  }, []);

  // When committed sort rules change, reset pagination and refetch deterministically.
  // We watch `rowsQueryInput` (which uses `sortSignature`) so this only runs when
  // the effective sort content actually changes.
  useEffect(() => {
    if (!hasTableId || isCreatingTable) return;
    // Reset to page 1 for the new sort (avoids mixing cursors/pages from old sort)
    utils.table.getRows.setInfiniteData(rowsQueryInput, () => undefined);
    // Mark this query as stale and refetch even if staleTime hasn't expired
    void utils.table.getRows.invalidate(rowsQueryInput);
  }, [rowsQueryInput, hasTableId, isCreatingTable, utils]);

  // Turn off sort "saving" once the rows query finishes fetching for the same sort signature.
  useEffect(() => {
    if (!sortSaving.active) return;
    // Only clear if we're on the same sort config that triggered the saving state.
    if (sortSaving.signature !== sortSignature) return;
    if (isFetchingRows) return;
    setSortSaving((prev) => (prev.active ? { ...prev, active: false } : prev));
  }, [sortSaving.active, sortSaving.signature, sortSignature, isFetchingRows]);

  // Turn off filter "saving" once the rows query finishes fetching for the same filter signature.
  useEffect(() => {
    if (!filterSaving.active) return;
    // Only clear if we're on the same filter config that triggered the saving state.
    if (filterSaving.signature !== filterSignature) return;
    if (isFetchingRows) return;
    setFilterSaving((prev) => (prev.active ? { ...prev, active: false } : prev));
  }, [filterSaving.active, filterSaving.signature, filterSignature, isFetchingRows]);

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

  // If a row was created while sort is active, refetch after the user leaves that row
  // so it can move to its correct sorted position.
  // NOTE: this effect must appear *after* allRows is declared to avoid TDZ errors in the dep array.
  useEffect(() => {
    const pending = pendingResortAfterCreateRef.current;
    if (!pending) return;
    // If sorts changed since the create, drop the pending behavior.
    if (pending.sortSignature !== sortSignature) {
      pendingResortAfterCreateRef.current = null;
      return;
    }
    const activeRowId = activeCell ? allRows[activeCell.rowIdx]?.id : null;
    // Once focus leaves the created row (or focus is cleared), refetch and clear.
    if (!activeRowId || activeRowId !== pending.rowId) {
      // Reconcile with server ordering in the background (handles moving across page boundaries).
      void utils.table.getRows.invalidate(rowsQueryInput);
      pendingResortAfterCreateRef.current = null;
    }
  }, [activeCell, allRows, sortSignature, utils, rowsQueryInput]);
  
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

  // When search or sort changes, reset selection and scroll to the top so infinite paging + virtual rows start from row 0.
  useEffect(() => {
    setEditingCell(null);
    setActiveCell(null);
    setIsKeyboardNav(false);
    pendingRowFocusRef.current = null;
    rootRef.current?.scrollTo({ top: 0 });
  }, [search, tableId, sortSignature]);

  // Fallback: Focus pending row cell if it wasn't focused in onMutate
  // This only runs if the direct focus in onMutate didn't work (e.g., row not rendered yet)
  useEffect(() => {
    const pending = pendingRowFocusRef.current;
    if (!pending || !tableMeta || !activeCell) return;
    
    // Only focus if the activeCell matches the pending row index (ensures we focus the correct row)
    if (activeCell.rowIdx !== pending.rowIdx) return;
    
    const targetColumn = displayColumns[pending.colIdx];
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
  const cancelledCreateClientRowIdsRef = useRef<Set<string>>(new Set());
  const skipDeleteOptimisticRowIdsRef = useRef<Set<string>>(new Set());
  const createRowMutation = api.table.createRow.useMutation({
    onMutate: async ({ clientRowId, afterRowId }) => {
      console.log('onMutate called:', { clientRowId, afterRowId });
      
      const hasSearchFilter = Boolean(search && search.trim().length > 0);
      const hasSort = Boolean(normalizedSortRules && normalizedSortRules.length > 0);

      // Cancel outgoing refetches - must match the query key exactly
      await utils.table.getRows.cancel(rowsQueryInput);
      
      // Get the cached data - must match the query key exactly including limit
      const previousPages = utils.table.getRows.getInfiniteData(rowsQueryInput);
      const currentCount = utils.table.getRowCount.getData({ tableId, search });
      
      console.log('previousPages:', previousPages ? `exists with ${previousPages.pages.length} pages` : 'null');
      console.log('tableMeta:', tableMeta ? 'exists' : 'null');
      
      // Optimistically update the row count immediately (before server responds)
      if (!hasSearchFilter && currentCount) {
        utils.table.getRowCount.setData({ tableId, search }, { count: currentCount.count + 1 });
      }
      
      // If a search filter is active, a new empty row likely won't match; skip optimistic insertion.
      // We *do* allow optimistic insertion when sort is active so Shift+Enter feels instant.
      // We'll immediately refetch after the server responds to place the row into its true sorted position.
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
      utils.table.getRows.setInfiniteData(rowsQueryInput, (oldData) => {
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
        const targetColumn = displayColumns[targetColIdx];
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
        void utils.table.getRows.invalidate(rowsQueryInput);
        void utils.table.getRowCount.invalidate({ tableId, search });
        return;
      }
      
      // Find the current active cell to maintain focus after replacing temp row
      const currentActiveCell = activeCell;
      const wasOnNewRow = currentActiveCell && 
        utils.table.getRows.getInfiniteData(rowsQueryInput)?.pages
          .flatMap(p => p.rows)
          .some((r, idx) => r.id === `__temp__${context.clientRowId}` && idx === currentActiveCell.rowIdx);
      
      // Replace optimistic temp row with real row from server
      utils.table.getRows.setInfiniteData(rowsQueryInput, (oldData) => {
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
            const targetColumn = displayColumns[currentActiveCell.colIdx];
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
      
      // When sort is active, defer re-sorting until focus leaves the created row
      // (prevents the row from jumping away while the user is still interacting with it).
      if (normalizedSortRules && normalizedSortRules.length > 0) {
        pendingResortAfterCreateRef.current = { rowId: newRow.id, sortSignature };
      }
    },
    onError: (error, _variables, context) => {
      if (!context) return;
      console.log('Row creation error:', error);
      
      // Rollback optimistic count update on error
      if (context.previousCount) {
        utils.table.getRowCount.setData({ tableId, search }, context.previousCount);
      }
      
      void utils.table.getRows.invalidate(rowsQueryInput);
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
    const targetColumn = displayColumns[colIdx];
    if (!targetColumn) return;
    setActiveCell({ rowIdx, colIdx });
  }, [allRows, tableMeta, displayColumns]);

  // Cell update mutation
  const updateCellMutation = api.table.updateCell.useMutation({
    onSuccess: (_updatedCell, variables) => {
      // Update the cache with the new cell value
      // The mutation returns a simple object, so we update the cache directly
      utils.table.getRows.setInfiniteData(rowsQueryInput, (oldData) => {
        if (!oldData) return oldData;
        const newData = {
          pages: oldData.pages.map(page => ({
            ...page,
            rows: page.rows.map(row => {
              if (row.id !== variables.rowId) return row;
              return upsertRowCell(row, variables.columnId, variables.value);
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
      void utils.table.getRows.invalidate(rowsQueryInput);
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
        await utils.table.getRows.cancel(rowsQueryInput);
      }

      const previousPages = utils.table.getRows.getInfiniteData(rowsQueryInput);
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
        utils.table.getRows.setInfiniteData(rowsQueryInput, (oldData) => {
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
          rowsQueryInput,
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

        utils.table.getRows.setInfiniteData(rowsQueryInput, (oldData) => {
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

  const handleCellDoubleClick = useCallback((
    e: React.MouseEvent,
    rowId: string,
    columnId: string,
    currentValue: string
  ) => {
    e.preventDefault(); // Stop native dblclick selection behavior

    // Don't allow editing optimistic placeholder columns.
    if (isOptimisticColumnId(columnId)) return;

    const cellKey = `${rowId}-${columnId}`;
    doubleClickEditRef.current = cellKey; // Mark this cell for caret positioning on focus
    setEditingCell({ rowId, columnId });
    setEditValue(currentValue);
  }, [isOptimisticColumnId]);

  const scheduleAutosave = useCallback((rowId: string, columnId: string, value: string) => {
    const cellKey = `${rowId}-${columnId}`;
    if (rowId.startsWith('__temp__')) return;
    if (isOptimisticColumnId(columnId)) return;

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
          void utils.table.getRows.invalidate(rowsQueryInput);
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
  }, [updateCellMutation, utils, rowsQueryInput, isOptimisticColumnId]);
  
  const handleCellChange = useCallback((rowId: string, columnId: string, newValue: string) => {
    const cellKey = `${rowId}-${columnId}`;

    // Don't autosave optimistic placeholder columns.
    if (isOptimisticColumnId(columnId)) {
      // Still keep local draft so the user doesn't lose typing while the column is being created.
      setLocalDrafts(prev => {
        const next = new Map(prev);
        next.set(cellKey, newValue);
        return next;
      });
      setEditValue(newValue);
      return;
    }
    
    // Update local draft immediately
    setLocalDrafts(prev => {
      const next = new Map(prev);
      next.set(cellKey, newValue);
      return next;
    });
    
    setEditValue(newValue);
    
    // Update cache immediately - ensure we always return the full structure
    utils.table.getRows.setInfiniteData(rowsQueryInput, (oldData) => {
      if (!oldData) return oldData;
      
      return {
        pages: oldData.pages.map(page => ({
          ...page,
          rows: page.rows.map(row => {
          if (row.id !== rowId) return row;
          
          return upsertRowCell(row, columnId, newValue);
        }),
        })),
        pageParams: oldData.pageParams,
      };
    });

    scheduleAutosave(rowId, columnId, newValue);
  }, [utils, rowsQueryInput, scheduleAutosave, isOptimisticColumnId, upsertRowCell]);
  
  const handleCellSave = useCallback(async (rowId: string, columnId: string, maintainFocus = true) => {
    if (editingCell?.rowId !== rowId || editingCell?.columnId !== columnId) return;
    if (isOptimisticColumnId(columnId)) {
      // Column isn't real yet; keep draft and exit edit mode.
      setEditingCell(null);
      setEditValue('');
      return;
    }

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
      const allColumns = displayColumns;
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
    utils.table.getRows.setInfiniteData(rowsQueryInput, (oldData) => {
      if (!oldData) return oldData;
      return {
        pages: oldData.pages.map(page => ({
          ...page,
          rows: page.rows.map(row => {
            if (row.id !== rowId) return row;
            return upsertRowCell(row, columnId, newValue);
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
        void utils.table.getRows.invalidate(rowsQueryInput);
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

      // If this column is part of the active sort, refetch so the row repositions after blur/commit.
      if (sortedColumnIds.has(columnId)) {
        void utils.table.getRows.invalidate(rowsQueryInput);
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
  }, [
    editingCell,
    editValue,
    allRows,
    tableMeta,
    updateCellMutation,
    utils,
    tableId,
    sortedColumnIds,
    rowsQueryInput,
  ]);
  
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
    
    const allColumns = displayColumns;
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

      utils.table.getRows.setInfiniteData(rowsQueryInput, (oldData) => {
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
      } else {
        // Enter edit mode with cursor at end (same as double-click)
        const cell = currentRow.cells.find(c => c.columnId === columnId);
        const serverValue = cell?.value ?? '';
        const cellValue = localDraftsRef.current.get(cellKey) ?? serverValue;
        
        // Mark for cursor positioning at end (same as double-click)
        doubleClickEditRef.current = cellKey;
        setEditingCell({ rowId, columnId });
        setEditValue(cellValue);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCellCancel(rowId, columnId);
    } else if (e.key === 'Backspace' && !isCurrentlyEditing) {
      // Clear cell value when Backspace is pressed on a clicked (not editing) cell
      e.preventDefault();
      const emptyValue = '';
      const cellKey = `${rowId}-${columnId}`;
      
      // Update local draft
      setLocalDrafts(prev => new Map(prev).set(cellKey, emptyValue));
      
      // Update cache optimistically
      utils.table.getRows.setInfiniteData(rowsQueryInput, (oldData) => {
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
                  return { ...cell, value: emptyValue };
                }),
              };
            }),
          })),
          pageParams: oldData.pageParams,
        };
      });
      
      // Schedule autosave
      scheduleAutosave(rowId, columnId, emptyValue);
    }
  }, [allRows, tableMeta, editingCell, committingCells, utils, rowsQueryInput, scheduleAutosave, handleCellSave, handleCellCancel, handleCreateRow, displayColumns, isOptimisticColumnId, upsertRowCell]);
  
  const focusRafRef = useRef<number | null>(null);
  const invalidateTimerRef = useRef<number | null>(null);

  const scheduleInvalidate = useCallback(() => {
    if (invalidateTimerRef.current != null) {
      window.clearTimeout(invalidateTimerRef.current);
    }
    invalidateTimerRef.current = window.setTimeout(() => {
      invalidateTimerRef.current = null;
      void utils.table.getRows.invalidate(rowsQueryInput);
      void utils.table.getRowCount.invalidate({ tableId, search });
    }, 150);
  }, [utils, rowsQueryInput, tableId, search]);

  // Handle focus and text selection when entering edit mode via double-click
  useEffect(() => {
    if (!editingCell) return;
    const cellKey = `${editingCell.rowId}-${editingCell.columnId}`;
    const shouldSelectAll = doubleClickEditRef.current === cellKey;
    
    if (shouldSelectAll) {
      // Clear the ref so it only applies once
      doubleClickEditRef.current = null;
      
      // Use requestAnimationFrame to ensure the input is rendered and focused
      requestAnimationFrame(() => {
        const inputRef = cellInputRefs.current.get(cellKey);
        if (inputRef) {
          inputRef.focus();
          // Place cursor at the end (no highlight)
          try {
            const len = inputRef.value.length;
            // Some input types (e.g. number) may throw on selection APIs
            inputRef.setSelectionRange(len, len);
          } catch {
            // Ignore selection errors for non-text inputs.
          }
        }
      });
    }
  }, [editingCell]);

  // Keep DOM focus in sync with the current activeCell selection, without spamming smooth scroll.
  useEffect(() => {
    if (!activeCell) return;
    const { rowIdx, colIdx } = activeCell;
    const targetRow = allRows[rowIdx];
    if (!targetRow || !tableMeta) return;

    const targetColumn = displayColumns[colIdx];
    if (!targetColumn) return;

    const rowId = targetRow.id;
    const columnId = targetColumn.id;
    const cellKey = `${rowId}-${columnId}`;

    // Skip focus if we're editing this cell (it's handled by the editingCell effect)
    if (editingCell?.rowId === rowId && editingCell?.columnId === columnId) return;

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
  }, [activeCell, allRows, tableMeta, displayColumns]);
  
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
    
    return displayColumns.map((col) => ({
      id: col.id,
      accessorKey: col.id,
      header: col.name,
      meta: {
        type: col.type,
      },
    }));
  }, [tableMeta, displayColumns]);
  
  const data = useMemo<CellData[]>(() => {
    const defaultByColumnId = new Map<string, string>();
    if (tableMeta?.columns) {
      for (const c of tableMeta.columns) {
        if (!c.options) continue;
        try {
          const parsed = JSON.parse(c.options) as unknown;
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
          const dv = (parsed as { defaultValue?: unknown }).defaultValue;
          if (typeof dv !== 'string') continue;
          const trimmed = dv.trim();
          if (trimmed.length > 0) defaultByColumnId.set(c.id, trimmed);
        } catch {
          // ignore invalid JSON
        }
      }
    }

    return allRows.map((row) => {
      const rowData: CellData = { _id: row.id };

      // Prefer the server-provided cells for speed, but fall back to column defaults
      // if a new column was added (optimistic meta update) without refetching rows.
      for (const cell of row.cells) {
        rowData[cell.columnId] = cell.value ?? '';
      }
      for (const col of displayColumns) {
        if (rowData[col.id] === undefined) {
          rowData[col.id] = defaultByColumnId.get(col.id) ?? '';
        }
      }

      return rowData;
    });
  }, [allRows, tableMeta, displayColumns]);
  
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
          if (
            editingCell?.rowId === currentRowId &&
            editingCell?.columnId === displayColumns[activeCell.colIdx]?.id
          ) {
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

        const maxCol = (displayColumns.length ?? 1) - 1;

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

      // Enter key: enter edit mode with cursor at end (when not already editing)
      if (key === 'Enter') {
        e.preventDefault();
        setIsKeyboardNav(true);
        const current = allRows[activeCell.rowIdx];
        const targetColumn = displayColumns[activeCell.colIdx];
        if (!current || !targetColumn) return;
        
        const rowId = current.id;
        const columnId = targetColumn.id;
        const cellKey = `${rowId}-${columnId}`;
        
        // Check if already editing this cell
        const isCurrentlyEditing = editingCell?.rowId === rowId && editingCell?.columnId === columnId;
        if (isCurrentlyEditing) return;
        
        // Get current cell value (from localDrafts or server)
        const cell = current.cells.find(c => c.columnId === columnId);
        const serverValue = cell?.value ?? '';
        const cellValue = localDraftsRef.current.get(cellKey) ?? serverValue;
        
        // Mark for cursor positioning at end (same as double-click)
        doubleClickEditRef.current = cellKey;
        setEditingCell({ rowId, columnId });
        setEditValue(cellValue);
        return;
      }

      if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
        e.preventDefault();
        setIsKeyboardNav(true);

        const rowCount = allRows.length;
        const next = { ...activeCell };

        if (key === 'ArrowUp') next.rowIdx = Math.max(0, activeCell.rowIdx - 1);
        if (key === 'ArrowDown') next.rowIdx = Math.min(rowCount - 1, activeCell.rowIdx + 1);
        if (key === 'ArrowLeft') next.colIdx = Math.max(0, activeCell.colIdx - 1);
        if (key === 'ArrowRight') next.colIdx = activeCell.colIdx + 1;

        const maxCol = (displayColumns.length ?? 1) - 1;
        next.colIdx = Math.min(Math.max(0, next.colIdx), maxCol);

        navigateToCell(next.rowIdx, next.colIdx);
        return;
      }
    };

    root.addEventListener('keydown', onKeyDownCapture, { capture: true });
    return () => root.removeEventListener('keydown', onKeyDownCapture, { capture: true } as never);
  }, [activeCell, allRows, tableMeta, displayColumns, navigateToCell, handleCreateRow, editingCell, handleCellSave]);

  // Clicking outside the grid should clear the active cell selection.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      const target = e.target as Node | null;
      if (!root || !target) return;
      if (root.contains(target)) return;
      setActiveCell(null);
      setIsKeyboardNav(false);
    };

    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    return () => window.removeEventListener('pointerdown', onPointerDown, { capture: true } as never);
  }, []);

  const setGridScrollLeft = (scrollLeft: number) => {
    // Store as a negative length so the header can translate by this value.
    rootRef.current?.style.setProperty('--grid-scroll-left-neg', `${-scrollLeft}px`);
  };

  const syncFromMiddle = () => {
    const middle = middleScrollRef.current;
    const bottom = bottomScrollRef.current;
    if (!middle || !bottom) return;
    if (syncingRef.current === 'bottom') return;
    syncingRef.current = 'middle';
    
    const scrollPos = middle.scrollLeft;
    const bottomMax = Math.max(0, bottom.scrollWidth - bottom.clientWidth);
    bottom.scrollLeft = Math.min(scrollPos, bottomMax);

    setGridScrollLeft(scrollPos);
    syncingRef.current = null;
  };

  const syncFromBottom = () => {
    const middle = middleScrollRef.current;
    const bottom = bottomScrollRef.current;
    if (!middle || !bottom) return;
    if (syncingRef.current === 'middle') return;
    syncingRef.current = 'bottom';
    
    const scrollPos = bottom.scrollLeft;
    const middleMax = Math.max(0, middle.scrollWidth - middle.clientWidth);
    middle.scrollLeft = Math.min(scrollPos, middleMax);

    setGridScrollLeft(scrollPos);
    syncingRef.current = null;
  };

  useLayoutEffect(() => {
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
    const table = middle.querySelector('table');
    if (table) ro.observe(table);

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

  // Keep column widths stable when hiding fields.
  // We size the middle (scrollable) tables to the sum of their fixed column widths
  // so the browser doesn't redistribute extra space across the remaining columns.
  const DATA_COLUMN_WIDTH_PX = 180;
  const ADD_COLUMN_WIDTH_PX = 94;
  const middleColumnCount = Math.max(0, displayColumns.length - 1);
  const middleTableWidthPx = `${middleColumnCount * DATA_COLUMN_WIDTH_PX + ADD_COLUMN_WIDTH_PX}px`;

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
      onMouseDown={(e) => {
        // Only focus root if clicking on background, not on cells or other interactive elements
        const target = e.target as HTMLElement;
        const isCellInput = target.closest('.table-cell-input');
        const isInteractive = target.closest('button, a, input[type="checkbox"], [role="button"]');
        if (!isCellInput && !isInteractive) {
          rootRef.current?.focus();
        }
      }}
      onClick={(e) => {
        // Clear active cell when clicking on background (not on cells or other interactive elements)
        const target = e.target as HTMLElement;
        const isCellInput = target.closest('.table-cell-input');
        const isInteractive = target.closest('button, a, input[type="checkbox"], [role="button"], th');
        if (!isCellInput && !isInteractive) {
          setActiveCell(null);
          setIsKeyboardNav(false);
        }
      }}
      className="flex-1 min-h-0 flex flex-col overflow-hidden outline-none"
      style={{ backgroundColor: '#f6f8fc', ['--grid-scroll-left-neg' as never]: '0px' }}
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
          <div className="w-[264px] flex-shrink-0 border-r border-gray-200 bg-[rgb(242,242,242)]">
            <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr className="bg-white h-8">
                  <th className="w-[84px] h-8 bg-white border-b border-b-[rgb(209,209,209)] p-0 align-middle">
                    <div className="staticCellContainer">
                      <div className="rowNumber rowNumber--header">
                        <div className="checkbox flex items-center justify-center text-white" aria-hidden="true">
                          <svg
                            width="9"
                            height="9"
                            viewBox="0 0 16 16"
                            style={{ shapeRendering: 'geometricPrecision' }}
                            className="flex-none icon"
                          >
                            <use fill="currentColor" href={`${ICON_SPRITE}#CheckBold`} />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </th>
                  <th
                    className="w-[180px] h-8 bg-white border-b border-gray-200 p-0 text-left align-middle"
                    style={{
                      backgroundColor: filteredColumnIds.has(displayColumns[0]?.id ?? '') 
                        ? FILTERED_HEADER_BG 
                        : sortedColumnIds.has(displayColumns[0]?.id ?? '') 
                          ? SORTED_HEADER_BG 
                          : undefined,
                    }}
                  >
                    <div className="h-8 px-2 flex items-center gap-2">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        style={{ shapeRendering: 'geometricPrecision' }}
                        className="flex-none primaryDisplayTypeIcon"
                      >
                        <use
                          fill="currentColor"
                          href={`${ICON_SPRITE}#${getColumnIconName(displayColumns[0]?.type ?? 'singleLineText')}`}
                        />
                      </svg>
                      <span
                        className="text-[13px] font-semibold leading-4"
                        style={{
                          color: 'lab(27.1134 -0.956401 -12.3224)',
                          height: '16px',
                          lineHeight: '16px',
                        }}
                      >
                        {displayColumns[0]?.name ?? 'Name'}
                      </span>
                    </div>
                  </th>
                </tr>
              </thead>
            </table>
          </div>
          {/* Middle header (other columns) */}
          <div
            className="flex-1 min-w-0 overflow-x-hidden"
            onWheel={(e) => {
              const middle = middleScrollRef.current;
              if (!middle) return;

              // Support trackpads (deltaX) and Shift+wheel (deltaY) for horizontal scrolling.
              const delta = e.deltaX !== 0 ? e.deltaX : e.shiftKey ? e.deltaY : 0;
              if (delta === 0) return;

              middle.scrollLeft += delta;
              // Ensure the translated header stays in lock-step even before the scroll event fires.
              setGridScrollLeft(middle.scrollLeft);
              e.preventDefault();
            }}
          >
            <div
              style={{
                transform: 'translateX(var(--grid-scroll-left-neg, 0px))',
                willChange: 'transform',
              }}
            >
              <table
                style={{
                  borderCollapse: 'separate',
                  borderSpacing: 0,
                  width: middleTableWidthPx,
                  tableLayout: 'fixed',
                }}
              >
                <thead>
                  <tr className="bg-white h-8">
                    {displayColumns.slice(1).map((col) => (
                      <th
                        key={col.id}
                        className="w-[180px] h-8 border-r border-b border-gray-200 p-0 text-left bg-white align-middle"
                        style={{
                          backgroundColor: filteredColumnIds.has(col.id) 
                            ? FILTERED_HEADER_BG 
                            : sortedColumnIds.has(col.id) 
                              ? SORTED_HEADER_BG 
                              : undefined,
                        }}
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
                    <th className="w-[94px] h-8 border-r border-b border-gray-200 bg-white p-0 align-middle">
                      <button 
                        className="w-full h-8 flex items-center justify-center hover:bg-gray-100 text-gray-500"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setFieldTypePickerPosition({
                            x: rect.right - 400, // Align right edge with button's right edge (400px is dialog minWidth)
                            y: rect.bottom + 4,
                          });
                          setFieldTypePickerOpen(true);
                        }}
                      >
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
          <div className="w-[264px] flex-shrink-0 border-r border-gray-200">
            <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <tbody>
                      {virtualItems.map((virtualRow) => {
                        const idx = virtualRow.index;
                        const row = rowByIndex(idx);
                        const firstColumn = displayColumns[0];
                        if (!firstColumn) return null;

                        // Render placeholder if row not loaded yet
                        if (!row) {
                          return (
                            <tr
                              key={`placeholder-${idx}`}
                              className="bg-white"
                            >
                              <td className="w-[84px] h-8 border-b border-gray-200 p-0 align-middle bg-white">
                                <div className="staticCellContainer">
                                  <div className="rowNumber">
                                    <div className="grabby" aria-hidden="true" />
                                    <div className="numberText" data-rownumberlength="1">{idx + 1}</div>
                                    <div className="checkbox" aria-hidden="true" />
                                  </div>
                                  <div className="rowColorContainer" aria-label="Row color container">
                                    <div className="rowColor" />
                                  </div>
                                  <div className="expandButtonContainer">
                                    <div className="expandRowCell flex" aria-hidden="true" />
                                  </div>
                                </div>
                              </td>
                              <td
                                className="w-[180px] h-8 border-b border-gray-200 p-0 align-middle bg-white"
                                style={{
                                  backgroundColor: filteredColumnIds.has(firstColumn.id)
                                    ? FILTERED_COLUMN_BG
                                    : sortedColumnIds.has(firstColumn.id)
                                      ? SORTED_COLUMN_BG
                                      : undefined,
                                }}
                              >
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
                  
                  // Check if cell matches search
                  const cellMatches = cellMatchesSearch(cellValue, search);
                  // Check if row matches search (any cell in the row)
                  const rowMatches = rowMatchesSearch(row, search);
                  
                  return (
                    <tr
                      key={row.id}
                      className={isRowHighlighted ? 'bg-gray-50' : ''}
                      onMouseEnter={() => setHoveredRow(idx)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <td
                        className={`w-[84px] h-8 border-b border-gray-200 p-0 align-middle ${
                          isRowHighlighted ? 'bg-gray-50' : 'bg-white'
                        }`}
                        style={{
                          backgroundColor: rowMatches ? SEARCH_ROW_NUMBER_BG : undefined,
                        }}
                      >
                        <div className="staticCellContainer">
                          <div className="rowNumber">
                            <div className="grabby" aria-hidden="true" />
                            <div
                              className="numberText"
                              data-rownumberlength={(idx + 1).toString().length}
                            >
                              {idx + 1}
                            </div>
                            <div className="checkbox" aria-hidden="true" />
                          </div>
                          <div className="rowColorContainer" aria-label="Row color container">
                            <div className="rowColor" />
                          </div>
                          <div className="expandButtonContainer">
                            <div className="expandRowCell flex" aria-hidden="true" />
                          </div>
                        </div>
                      </td>
                      <td
                        className={`w-[180px] h-8 border-b border-gray-200 p-0 align-middle ${
                          isRowHighlighted ? 'bg-gray-50' : 'bg-white'
                        }`}
                        style={{
                          backgroundColor: cellMatches && filteredColumnIds.has(columnId)
                            ? SEARCH_FILTER_OVERLAP_BG
                            : cellMatches
                              ? SEARCH_CELL_BG
                              : filteredColumnIds.has(columnId)
                                ? FILTERED_COLUMN_BG
                                : sortedColumnIds.has(columnId)
                                  ? SORTED_COLUMN_BG
                                  : undefined,
                        }}
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
                          className={`w-full h-8 p-[6px] bg-transparent outline-none table-cell-input ${
                            isEditing
                              ? 'bg-blue-50'
                              : ''
                          } ${
                            isActive
                              ? `ring-2 ring-blue-500 ring-inset ${!isEditing ? 'text-[rgb(22,110,225)] cursor-pointer' : ''}`
                              : ''
                          }`}
                          value={isEditing ? editValue : cellValue}
                          onClick={() => handleCellClick(rowId, columnId, cellValue, idx, 0)}
                          onMouseDownCapture={(e) => {
                            // Prevent the browser's native word selection that happens during dblclick
                            if (e.detail === 2) e.preventDefault();
                          }}
                          onDoubleClick={(e) => handleCellDoubleClick(e, rowId, columnId, cellValue)}
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
                          className={`w-[84px] h-[31px] p-0 align-middle ${
                            hoveredRow === 'add' ? 'bg-gray-50' : 'bg-white'
                          }`}
                        >
                          <div
                            className="dataRow ghost leftPane rowInsertionEnabled"
                            data-tutorial-selector-id="ghostRowLeftPane"
                            aria-label="Insert new record in grid"
                            title="You can also insert a new record anywhere by pressing Shift-Enter"
                          >
                            <div className="rowNumber">
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                className="flex-none icon"
                                style={{ shapeRendering: 'geometricPrecision' }}
                              >
                                <use fill="currentColor" href={`${ICON_SPRITE}#Plus`} />
                              </svg>
                            </div>
                          </div>
                        </td>
                        <td
                          className={`w-[180px] h-[31px] p-0 align-middle ${
                            hoveredRow === 'add' ? 'bg-gray-50' : 'bg-white'
                          }`}
                        >
                          <div className="h-[31px]" />
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
            <table
              style={{
                borderCollapse: 'separate',
                borderSpacing: 0,
                width: middleTableWidthPx,
                tableLayout: 'fixed',
              }}
            >
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
                              {displayColumns.slice(1).map((col) => (
                                <td
                                  key={col.id}
                                  className="w-[180px] h-8 border-r border-b border-gray-200 p-0 align-middle bg-white"
                                  style={{
                                    backgroundColor: filteredColumnIds.has(col.id)
                                      ? FILTERED_COLUMN_BG
                                      : sortedColumnIds.has(col.id)
                                        ? SORTED_COLUMN_BG
                                        : undefined,
                                  }}
                                >
                                  <div className="h-8 pl-3 pr-2 flex items-center text-gray-300">
                                    {/* Empty placeholder */}
                                  </div>
                                </td>
                              ))}
                              {/* Add column cell */}
                              <td 
                                className="w-[94px] h-8 border-0 bg-transparent"
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
                  
                  // Check if row matches search (any cell in the row)
                  const rowMatches = rowMatchesSearch(row, search);
                  
                  return (
                    <tr
                      key={row.id}
                      className={isRowHighlighted ? 'bg-gray-50' : ''}
                      onMouseEnter={() => setHoveredRow(idx)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                            {displayColumns.slice(1).map((col, cellIdx) => {
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
                        
                        // Check if cell matches search
                        const cellMatches = cellMatchesSearch(cellValue, search);
                        
                        return (
                          <td
                                  key={columnId}
                            className={`w-[180px] h-8 border-r border-b border-gray-200 p-0 align-middle ${
                              isRowHighlighted ? 'bg-gray-50' : 'bg-white'
                            }`}
                            style={{
                              backgroundColor: cellMatches && filteredColumnIds.has(columnId)
                                ? SEARCH_FILTER_OVERLAP_BG
                                : cellMatches
                                  ? SEARCH_CELL_BG
                                  : filteredColumnIds.has(columnId)
                                    ? FILTERED_COLUMN_BG
                                    : sortedColumnIds.has(columnId)
                                      ? SORTED_COLUMN_BG
                                      : undefined,
                            }}
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
                                  : ''
                              } ${
                                isActive
                                  ? `ring-2 ring-blue-500 ring-inset ${!isEditing ? 'text-[rgb(22,110,225)] cursor-pointer' : ''}`
                                  : ''
                              }`}
                              value={isEditing ? editValue : cellValue}
                              onClick={() => handleCellClick(rowId, columnId, cellValue, idx, colIdx)}
                              onMouseDownCapture={(e) => {
                                // Prevent the browser's native word selection that happens during dblclick
                                if (e.detail === 2) e.preventDefault();
                              }}
                              onDoubleClick={(e) => handleCellDoubleClick(e, rowId, columnId, cellValue)}
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
                        className="w-[94px] h-8 border-0 bg-transparent"
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
                  <table
                    style={{
                      borderCollapse: 'separate',
                      borderSpacing: 0,
                      width: middleTableWidthPx,
                      tableLayout: 'fixed',
                    }}
                  >
                    <tbody>
                      <tr
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredRow('add')}
                        onMouseLeave={() => setHoveredRow(null)}
                        onClick={() => handleCreateRow()}
                        title="Insert new record in grid"
                      >
                        {displayColumns.slice(1).map((col) => (
                          <td
                            key={col.id}
                            className={`w-[180px] h-8 p-0 align-middle ${
                              hoveredRow === 'add' ? 'bg-gray-50' : 'bg-white'
                            }`}
                          >
                            <div className="h-8 pl-3 pr-2" />
                          </td>
                        ))}
                        <td className="w-[94px] h-8 border-0 bg-transparent" />
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

      {/* Field Type Picker Dialog */}
      <FieldTypePicker
        ref={fieldTypePickerRef}
        isOpen={fieldTypePickerOpen}
        position={fieldTypePickerPosition}
        onClose={() => {
          setFieldTypePickerOpen(false);
          setFieldTypePickerPosition(null);
        }}
        onCreate={({ fieldTypeId, name, defaultValue }) => {
          if (!tableId || isCreatingTable) return;
          const dbType = mapUiFieldTypeToDbType(fieldTypeId);
          createColumnMutation.mutate({
            tableId,
            type: dbType,
            name: name?.trim() ? name.trim() : undefined,
            defaultValue: defaultValue?.trim() ? defaultValue.trim() : undefined,
          });
          setFieldTypePickerOpen(false);
          setFieldTypePickerPosition(null);
        }}
      />
    </div>
  );
}
