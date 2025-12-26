'use client';

import type { ReactNode } from 'react';


import BulkInsertButton from './[tableId]/components/BulkInsertButton';
import { useParams } from 'next/navigation';
import { forwardRef, useDeferredValue, useMemo, useState, useRef, useEffect, useCallback, useTransition } from 'react';
import { api } from '~/trpc/react';
import LeftSidebarNarrow from './[tableId]/components/LeftSidebarNarrow';
import MainContent from './[tableId]/components/MainContent';
import Sidebar from './[tableId]/components/Sidebar';
import { ColumnsUiProvider, useColumnsUi } from './[tableId]/components/ColumnsUiContext';
import HideFieldsPopover from './[tableId]/components/HideFieldsPopover';
import SortPopover from './[tableId]/components/SortPopover';
import FilterPopover from './[tableId]/components/FilterPopover';
import TableTabsBar from './[tableId]/components/TableTabsBar';
import TopNav from './[tableId]/components/TopNav';

type ViewFilterCondition = {
  id: string;
  columnId: string;
  operator: 'isEmpty' | 'isNotEmpty' | 'contains' | 'notContains' | 'equals' | 'greaterThan' | 'lessThan';
  value?: string;
};

type ViewSortRule = { columnId: string; direction: 'asc' | 'desc' };

function normalizeViewFilters(raw: unknown): ViewFilterCondition[] {
  if (!Array.isArray(raw)) return [];
  const out: ViewFilterCondition[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const columnId = typeof r.columnId === 'string' ? r.columnId : '';
    const operator = r.operator as ViewFilterCondition['operator'];
    const value = typeof r.value === 'string' ? r.value : undefined;
    const id = typeof r.id === 'string' && r.id.length > 0 ? r.id : `${Date.now()}-${Math.random()}`;
    if (!columnId) continue;
    if (!(
      operator === 'isEmpty' ||
      operator === 'isNotEmpty' ||
      operator === 'contains' ||
      operator === 'notContains' ||
      operator === 'equals' ||
      operator === 'greaterThan' ||
      operator === 'lessThan'
    )) {
      continue;
    }
    out.push({ id, columnId, operator, value });
  }
  return out;
}

function normalizeViewSortRules(raw: unknown): ViewSortRule[] {
  if (!Array.isArray(raw)) return [];
  const out: ViewSortRule[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const columnId = typeof r.columnId === 'string' ? r.columnId : '';
    const direction = r.direction === 'desc' ? 'desc' : 'asc';
    if (!columnId) continue;
    out.push({ columnId, direction });
  }
  return out;
}

function normalizeHiddenColumns(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string');
}

function useDebouncedEffect(effect: () => void, deps: unknown[], delayMs: number) {
  useEffect(() => {
    const handle = window.setTimeout(() => effect(), delayMs);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delayMs]);
}

function ViewConfigAutosaver({
  tableId,
  activeViewId,
  search,
  sortRules,
  filters,
  isApplyingViewRef,
}: {
  tableId: string;
  activeViewId: string | null;
  search: string;
  sortRules: ViewSortRule[];
  filters: ViewFilterCondition[];
  isApplyingViewRef: React.MutableRefObject<boolean>;
}) {
  const { hiddenColumnIds } = useColumnsUi();
  const utils = api.useUtils();
  const updateView = api.table.updateView.useMutation({
    onMutate: async (input) => {
      // Keep the local views list in sync so switching views reapplies the latest config.
      await utils.table.getViews.cancel({ tableId });
      const previous = utils.table.getViews.getData({ tableId });

      utils.table.getViews.setData({ tableId }, (old) => {
        if (!old) return old;
        return old.map((v) => {
          if (v.id !== input.viewId) return v;
          return {
            ...v,
            search: input.search ?? v.search,
            filters: input.filters ?? v.filters,
            sortRules: input.sortRules ?? v.sortRules,
            hiddenColumns: input.hiddenColumns ?? v.hiddenColumns,
          };
        });
      });

      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) {
        utils.table.getViews.setData({ tableId }, ctx.previous);
      }
    },
  });

  const hiddenColumns = useMemo(() => Array.from(hiddenColumnIds), [hiddenColumnIds]);

  const latestRef = useRef({
    tableId,
    activeViewId,
    search,
    sortRules,
    filters,
    hiddenColumns,
  });
  useEffect(() => {
    latestRef.current = { tableId, activeViewId, search, sortRules, filters, hiddenColumns };
  }, [tableId, activeViewId, search, sortRules, filters, hiddenColumns]);

  // Flush immediately when the user switches views (or any code requests it).
  useEffect(() => {
    const onFlush = () => {
      const v = latestRef.current;
      if (!v.activeViewId) return;
      if (!v.tableId || v.tableId.startsWith('__creating__')) return;
      if (isApplyingViewRef.current) return;

      updateView.mutate({
        viewId: v.activeViewId,
        search: v.search.trim(),
        sortRules: v.sortRules.map((r) => ({ columnId: r.columnId, direction: r.direction })),
        filters: v.filters.map((f) => ({
          id: f.id,
          columnId: f.columnId,
          operator: f.operator,
          value: f.value,
        })),
        hiddenColumns: v.hiddenColumns,
      });
    };

    window.addEventListener('views:flushActive', onFlush as EventListener);
    return () => window.removeEventListener('views:flushActive', onFlush as EventListener);
  }, [updateView, isApplyingViewRef]);

  const signature = useMemo(() => {
    const normalizedHidden = [...hiddenColumns].sort();
    const normalizedFilters = [...filters]
      .map((f) => ({ id: f.id, columnId: f.columnId, operator: f.operator, value: f.value ?? '' }))
      .sort((a, b) => `${a.columnId}:${a.operator}:${a.value}`.localeCompare(`${b.columnId}:${b.operator}:${b.value}`));
    const normalizedSort = [...sortRules]
      .map((r) => ({ columnId: r.columnId, direction: r.direction }))
      .sort((a, b) => `${a.columnId}:${a.direction}`.localeCompare(`${b.columnId}:${b.direction}`));
    return JSON.stringify({
      tableId,
      viewId: activeViewId,
      search: search.trim(),
      hiddenColumns: normalizedHidden,
      filters: normalizedFilters,
      sortRules: normalizedSort,
    });
  }, [activeViewId, tableId, search, hiddenColumns, filters, sortRules]);

  useDebouncedEffect(
    () => {
      if (!activeViewId) return;
      if (!tableId || tableId.startsWith('__creating__')) return;
      if (isApplyingViewRef.current) return;

      updateView.mutate({
        viewId: activeViewId,
        search: search.trim(),
        sortRules: sortRules.map((r) => ({ columnId: r.columnId, direction: r.direction })),
        filters: filters.map((f) => ({
          id: f.id,
          columnId: f.columnId,
          operator: f.operator,
          value: f.value,
        })),
        hiddenColumns,
      });
    },
    [signature],
    500,
  );

  return null;
}

const HideFieldsButton = forwardRef<
  HTMLDivElement,
  {
    isOpen: boolean;
    onToggle: () => void;
  }
>(function HideFieldsButton({ isOpen, onToggle }, ref) {
  const { hiddenColumnIds } = useColumnsUi();
  const hiddenCount = hiddenColumnIds.size;
  const isActive = hiddenCount > 0;
  const label = isActive
    ? `${hiddenCount} hidden field${hiddenCount === 1 ? '' : 's'}`
    : 'Hide fields';

  return (
    <div
      ref={ref}
      role="button"
      aria-label="Hide fields"
      aria-haspopup="true"
      aria-expanded={isOpen}
      className="focus-visible mr1"
      tabIndex={0}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }
      }}
    >
      <div
        className="pointer flex items-center rounded colors-foreground-subtle"
        data-isactive={isActive ? 'true' : 'false'}
        aria-description="Tooltip: Hide fields"
        style={{
          paddingLeft: '8px',
          paddingRight: '8px',
          paddingTop: '4px',
          paddingBottom: '4px',
          backgroundColor: isActive ? 'rgb(196, 236, 255)' : 'transparent',
          color: isActive ? 'rgb(29, 31, 37)' : undefined,
          borderRadius: isActive ? '4px' : undefined,
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = isActive
            ? 'rgb(196, 236, 255)'
            : 'transparent';
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          className="flex-none"
          style={{ shapeRendering: 'geometricPrecision' }}
        >
          <use fill="currentColor" href="/icons/icon_definitions.svg#EyeSlash" />
        </svg>
        <div className="max-width-1 truncate ml-half">{label}</div>
      </div>
    </div>
  );
});

export default function TableLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const tableId = params?.tableId as string | undefined;
  const hasTableId = Boolean(tableId && tableId.length > 0);
  const utils = api.useUtils();
  const [isInserting, setIsInserting] = useState(false);

  const { data: views, isLoading: isLoadingViews } = api.table.getViews.useQuery(
    { tableId: tableId ?? '' },
    { enabled: hasTableId && !Boolean(tableId?.startsWith('__creating__')) },
  );
  const createViewMutation = api.table.createView.useMutation();

  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  // Remember the last selected view per table while the user switches tabs.
  // (Session-only; falls back to first view if the remembered id no longer exists.)
  const lastSelectedViewIdByTableIdRef = useRef<Record<string, string>>({});
  const [viewSwitchSeq, setViewSwitchSeq] = useState(0);
  const isApplyingViewRef = useRef(false);
  
  // Fetch table metadata to get column names for filter button
  const { data: tableMeta } = api.table.getTableMeta.useQuery(
    { tableId: tableId ?? "" },
    { 
      enabled: hasTableId,
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
    },
  );
  const bulkInsertMutation = api.table.bulkInsertRows.useMutation();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const deferredSearchInput = useDeferredValue(searchInput);
  const deferredSearch = useMemo(() => {
    const q = deferredSearchInput.trim();
    return q.length > 0 ? q : undefined;
  }, [deferredSearchInput]);
  const immediateSearch = useMemo(() => {
    const q = searchInput.trim();
    return q.length > 0 ? q : undefined;
  }, [searchInput]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchBarRef = useRef<HTMLDivElement>(null);

  const [isHideFieldsOpen, setIsHideFieldsOpen] = useState(false);
  const [hideFieldsPos, setHideFieldsPos] = useState<{ x: number; y: number; maxH: number } | null>(
    null,
  );
  const hideFieldsButtonRef = useRef<HTMLDivElement | null>(null);
  const hideFieldsPopoverRef = useRef<HTMLDivElement | null>(null);

  const [isSortOpen, setIsSortOpen] = useState(false);
  const [sortPos, setSortPos] = useState<{ x: number; y: number; maxH: number } | null>(null);
  const sortButtonRef = useRef<HTMLDivElement | null>(null);
  const sortPopoverRef = useRef<HTMLDivElement | null>(null);
  const [sortRules, setSortRules] = useState<Array<{ columnId: string; direction: 'asc' | 'desc' }>>([]);
  const [draftSortRules, setDraftSortRules] = useState<Array<{ columnId: string; direction: 'asc' | 'desc' }>>([]);

  const sortCountForButton = isSortOpen ? draftSortRules.length : sortRules.length;
  const isSortActiveForButton = sortCountForButton > 0;

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterPos, setFilterPos] = useState<{ x: number; y: number; maxH: number } | null>(null);
  const filterButtonRef = useRef<HTMLDivElement | null>(null);
  const filterPopoverRef = useRef<HTMLDivElement | null>(null);
  
  // Filter state
  const [filters, setFilters] = useState<ViewFilterCondition[]>([]);
  const [draftFilters, setDraftFilters] = useState<ViewFilterCondition[]>([]);

  // Match Ctrl+F search behavior: keep typing responsive by deferring the value that drives grid fetching.
  const deferredFilters = useDeferredValue(filters);

  // During a view switch, we want the rows query to react immediately (showing the same
  // loading/transition state users see when applying filter/sort). We normally defer for typing.
  const isViewSwitching = useMemo(() => {
    if (viewSwitchSeq === 0) return false;
    const searchCaughtUp = deferredSearchInput === searchInput;
    const filtersCaughtUp = deferredFilters === filters;
    return !(searchCaughtUp && filtersCaughtUp);
  }, [viewSwitchSeq, deferredSearchInput, searchInput, deferredFilters, filters]);

  useEffect(() => {
    if (viewSwitchSeq === 0) return;
    const searchCaughtUp = deferredSearchInput === searchInput;
    const filtersCaughtUp = deferredFilters === filters;
    if (searchCaughtUp && filtersCaughtUp) setViewSwitchSeq(0);
  }, [viewSwitchSeq, deferredSearchInput, searchInput, deferredFilters, filters]);

  const search = isViewSwitching ? immediateSearch : deferredSearch;
  const effectiveFiltersForQuery = isViewSwitching ? filters : deferredFilters;

  // Keep filter UI typing responsive by scheduling filter application as a transition.
  const [, startFilterTransition] = useTransition();
  const filtersRef = useRef<ViewFilterCondition[]>([]);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const filterCountForButton = isFilterOpen ? draftFilters.length : filters.length;
  const isFilterActiveForButton = filterCountForButton > 0;
  
  // Get unique field names for active filters.
  // Note: some operators (e.g. isEmpty/isNotEmpty) are meaningful without a typed value.
  const filteredFieldNames = useMemo(() => {
    const activeFilters = isFilterOpen ? draftFilters : filters;
    if (!tableMeta || activeFilters.length === 0) return [];
    
    const filtersWithValues = activeFilters.filter((f) => {
      if (f.operator === 'isEmpty' || f.operator === 'isNotEmpty') return true;
      return Boolean(f.value && f.value.trim().length > 0);
    });
    const uniqueColumnIds = new Set(filtersWithValues.map(f => f.columnId));
    const columnMap = new Map(tableMeta.columns.map(c => [c.id, c.name]));
    
    return Array.from(uniqueColumnIds)
      .map(id => columnMap.get(id))
      .filter((name): name is string => Boolean(name));
  }, [isFilterOpen, draftFilters, filters, tableMeta]);
  
  const filterButtonText = useMemo(() => {
    if (!isFilterActiveForButton) return 'Filter';
    if (filteredFieldNames.length === 0) return 'Filter';
    return `Filtered by ${filteredFieldNames.join(', ')}`;
  }, [isFilterActiveForButton, filteredFieldNames]);

  const applyFilters = useCallback(
    (next: ViewFilterCondition[]) => {
      // Normalize and stable-serialize to detect no-op updates.
      const normalized = (next ?? [])
        .filter(Boolean)
        .map((f) => ({ id: f.id, columnId: f.columnId, operator: f.operator, value: f.value }));

      const prevSignature = JSON.stringify(filtersRef.current);
      const nextSignature = JSON.stringify(normalized);
      if (prevSignature === nextSignature) return;

      // Schedule the expensive grid refetch/render work as non-urgent.
      startFilterTransition(() => {
        setFilters(normalized);
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('grid:filterSaving', {
            detail: { active: true, signature: nextSignature },
          }),
        );
      }
    },
    [startFilterTransition],
  );

  const applyDraftFilters = useCallback(
    (next: ViewFilterCondition[]) => {
      // Draft updates happen during typing; keep them low priority as well.
      const normalized = (next ?? [])
        .filter(Boolean)
        .map((f) => ({ id: f.id, columnId: f.columnId, operator: f.operator, value: f.value }));
      startFilterTransition(() => {
        setDraftFilters(normalized);
      });
    },
    [startFilterTransition],
  );

  const applySortRules = (next: Array<{ columnId: string; direction: 'asc' | 'desc' }>) => {
    // Always create new references to ensure React detects the change
    const normalized = (next ?? [])
      .filter(Boolean)
      .map((r) => ({ columnId: r.columnId, direction: r.direction })); // new objects

    setSortRules((prev) => {
      console.log("same ref?", prev === next);
      return normalized; // new array reference guaranteed
    });

    // Trigger global "Saving…" UI while the grid refetches sorted rows.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('grid:sortSaving', {
          detail: { active: true, signature: JSON.stringify(normalized) },
        }),
      );
    }
  };

  // Focus input when search bar opens
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Handle Ctrl+F to open search
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        setIsSearchOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Hide antiscroll scrollbars when search is open
  useEffect(() => {
    if (isSearchOpen) {
      document.body.classList.add('search-open');
    } else {
      document.body.classList.remove('search-open');
    }
    return () => {
      document.body.classList.remove('search-open');
    };
  }, [isSearchOpen]);

  // Close hide-fields popover when table changes
  useEffect(() => {
    setIsHideFieldsOpen(false);
    setHideFieldsPos(null);
    setIsSortOpen(false);
    setSortPos(null);
    setSortRules([]);
    setIsFilterOpen(false);
    setFilterPos(null);
    setFilters([]);
    setIsSearchOpen(false);
    setSearchInput('');
    // Reset the active view when switching tables; the "Choose an initial view" effect
    // will immediately select either the remembered view for this table or the first view.
    setActiveViewId(null);
  }, [tableId]);

  // Keep per-table memory in sync.
  useEffect(() => {
    if (!tableId) return;
    if (!activeViewId) return;
    // Guard against transient states during table switches where `tableId` updates
    // before `activeViewId`/`views` have caught up.
    if (!views || !views.some((v) => v.id === activeViewId)) return;
    lastSelectedViewIdByTableIdRef.current[tableId] = activeViewId;
  }, [tableId, activeViewId, views]);

  // Choose an initial view for the table.
  useEffect(() => {
    if (!hasTableId || !views) return;
    if (views.length === 0) return;

    const rememberedViewId = tableId ? lastSelectedViewIdByTableIdRef.current[tableId] : null;

    // Prefer restoring the last selected view for this table.
    if (rememberedViewId && views.some((v) => v.id === rememberedViewId)) {
      if (activeViewId !== rememberedViewId) setActiveViewId(rememberedViewId);
      return;
    }

    // If the current active view doesn't exist anymore, fall back to the first.
    if (!activeViewId || !views.some((v) => v.id === activeViewId)) {
      setActiveViewId(views[0]!.id);
    }
  }, [hasTableId, tableId, views, activeViewId]);

  // If a table has no views (older data), create a default Grid View.
  useEffect(() => {
    if (!hasTableId || !tableId) return;
    if (tableId.startsWith('__creating__')) return;
    if (isLoadingViews) return;
    if (!views) return;
    if (views.length > 0) return;
    if (createViewMutation.isPending) return;

    void createViewMutation
      .mutateAsync({ tableId, name: 'Grid View' })
      .then((created) => {
        setActiveViewId(created.id);
        void utils.table.getViews.invalidate({ tableId });
      })
      .catch(() => {
        // Best-effort: keep UI usable even if default view creation fails.
      });
  }, [hasTableId, tableId, isLoadingViews, views, createViewMutation, utils]);

  const activeView = useMemo(() => {
    if (!views || !activeViewId) return null;
    return views.find((v) => v.id === activeViewId) ?? null;
  }, [views, activeViewId]);

  // Apply the selected view's saved config to UI state.
  useEffect(() => {
    if (!activeView) return;
    isApplyingViewRef.current = true;

    setSearchInput(activeView.search ?? '');
    const nextSort = normalizeViewSortRules(activeView.sortRules);
    setSortRules(nextSort);
    setDraftSortRules(nextSort);
    const nextFilters = normalizeViewFilters(activeView.filters);
    setFilters(nextFilters);
    setDraftFilters(nextFilters);

    // Hidden columns are applied via ColumnsUiContext syncer below.

    // Allow autosave effects to run after the apply settles.
    const t = window.setTimeout(() => {
      isApplyingViewRef.current = false;
    }, 0);
    return () => window.clearTimeout(t);
  }, [activeView]);

  // Position hide-fields popover under the button when opened
  useEffect(() => {
    if (!isHideFieldsOpen) return;
    const btn = hideFieldsButtonRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const width = 320; // 20rem
    const offsetRight = 12; // nudge to the right so the popover sits slightly past the button edge
    const desiredX = Math.round(rect.right + offsetRight - width);
    const x = Math.max(8, Math.min(desiredX, window.innerWidth - width - 8));
    const y = Math.round(rect.bottom + 4); // slightly higher so it hugs the button more closely
    const maxH = Math.max(236, Math.min(670, window.innerHeight - y - 16));
    setHideFieldsPos({ x, y, maxH });
  }, [isHideFieldsOpen]);

  // Close hide-fields popover on outside click / Escape
  useEffect(() => {
    if (!isHideFieldsOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (hideFieldsPopoverRef.current?.contains(t)) return;
      if (hideFieldsButtonRef.current?.contains(t)) return;

      // Ensure hidden fields (and other view config) is persisted even if the user
      // closes the popover quickly.
      window.dispatchEvent(new CustomEvent('views:flushActive'));
      setIsHideFieldsOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;

      // Same rationale as outside click: flush before closing.
      window.dispatchEvent(new CustomEvent('views:flushActive'));
      setIsHideFieldsOpen(false);
      hideFieldsButtonRef.current?.focus();
    };

    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, { capture: true } as never);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isHideFieldsOpen]);

  // Position sort popover under the button when opened
  useEffect(() => {
    if (!isSortOpen) return;
    const btn = sortButtonRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const width = 452;
    const offsetRight = 0;
    const desiredX = Math.round(rect.right + offsetRight - width);
    const x = Math.max(8, Math.min(desiredX, window.innerWidth - width - 8));
    const y = Math.round(rect.bottom + 4);
    const maxH = Math.max(236, Math.min(670, window.innerHeight - y - 16));
    setSortPos({ x, y, maxH });
  }, [isSortOpen]);

  // Close sort popover on outside click / Escape
  useEffect(() => {
    if (!isSortOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (sortPopoverRef.current?.contains(t)) return;
      if (sortButtonRef.current?.contains(t)) return;
      setIsSortOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setIsSortOpen(false);
      sortButtonRef.current?.focus();
    };

    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, { capture: true } as never);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isSortOpen]);

  // Position filter popover under the button when opened
  useEffect(() => {
    if (!isFilterOpen) return;
    const btn = filterButtonRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const width = 328;
    const offsetRight = 0;
    const desiredX = Math.round(rect.right + offsetRight - width);
    const x = Math.max(8, Math.min(desiredX, window.innerWidth - width - 8));
    const y = Math.round(rect.bottom + 4);
    const maxH = Math.max(236, Math.min(670, window.innerHeight - y - 16));
    setFilterPos({ x, y, maxH });
  }, [isFilterOpen]);

  // Close filter popover on outside click / Escape
  useEffect(() => {
    if (!isFilterOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (filterPopoverRef.current?.contains(t)) return;
      if (filterButtonRef.current?.contains(t)) return;
      setIsFilterOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setIsFilterOpen(false);
      filterButtonRef.current?.focus();
    };

    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, { capture: true } as never);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isFilterOpen]);

  const handleBulkInsert = async () => {
    if (!tableId || tableId.startsWith('__creating__')) return;
    
    const totalRows = 100000;
    setIsInserting(true);

    try {
      await bulkInsertMutation.mutateAsync({
        tableId,
        count: totalRows,
      });

      // Invalidate queries with current filters
      const normalizedFilters = filters.map(f => ({
        columnId: f.columnId,
        operator: f.operator,
        value: f.value,
      }));
      
      utils.table.getRows.setInfiniteData({ tableId, limit: 500, search, filters: normalizedFilters }, undefined);
      await utils.table.getRows.invalidate({ tableId, limit: 500, search, filters: normalizedFilters });
      void utils.table.getRowCount.invalidate({ tableId, search, filters: normalizedFilters });
    } catch (error) {
      console.error('Bulk insert error:', error);
      alert(`Failed to insert rows: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsInserting(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#FAF8F6]">
      <LeftSidebarNarrow />
      <div className="flex flex-1 flex-col overflow-hidden relative">
        <TopNav />
        <TableTabsBar />
        {hasTableId ? (
          <ColumnsUiProvider tableId={tableId ?? ''}>
            {/* Apply view hiddenColumns to ColumnsUi state */}
            <ViewHiddenColumnsApplier
              activeViewId={activeViewId}
              hiddenColumns={normalizeHiddenColumns(activeView?.hiddenColumns)}
              isApplyingViewRef={isApplyingViewRef}
            />
            {/* Debounced autosave of view config */}
            <ViewConfigAutosaver
              tableId={tableId ?? ''}
              activeViewId={activeViewId}
              search={searchInput}
              sortRules={sortRules}
              filters={filters}
              isApplyingViewRef={isApplyingViewRef}
            />
            {/* View bar (spans to the narrow sidebar) */}
            <div
              className="flex flex-shrink-0 items-center border-b border-gray-200 bg-white relative"
              style={{
                height: '47px',
                fontFamily:
                  '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
                fontSize: '13px',
                lineHeight: '18px',
                fontWeight: 400,
                color: 'rgb(29, 31, 37)',
                paddingLeft: '8px',
              }}
            >
              {/* Left: sidebar toggle + Grid view */}
              <div
                className="flex flex-auto items-center pl1-and-half pr1"
                style={{
                  boxSizing: 'border-box',
                  color: 'rgb(29, 31, 37)',
                  fontFamily:
                    '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
                  fontSize: '13px',
                  fontWeight: 400,
                  height: '32px',
                  lineHeight: '18px',
                  marginBottom: 0,
                  marginLeft: 0,
                  marginRight: 0,
                  marginTop: 0,
                  minHeight: 0,
                  minWidth: 0,
                  paddingBottom: 0,
                  paddingTop: 0,
                  userSelect: 'none',
                }}
              >
                {/* Sidebar toggle button */}
                <div
                  tabIndex={0}
                  role="button"
                  className="mr-half flex items-center justify-center focus-visible cursor-pointer"
                  aria-label="Close sidebar"
                  data-tutorial-selector-id="viewSidebarToggleButton"
                  aria-pressed="false"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                    e.currentTarget.style.borderRadius = '4px';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    className="flex-none icon"
                    style={{ shapeRendering: 'geometricPrecision' }}
                  >
                    <use fill="currentColor" href="/icons/icon_definitions.svg#List" />
                  </svg>
                </div>

                {/* View name button */}
                <h2 className="flex items-center" style={{ marginLeft: '8px' }}>
                  <div
                    tabIndex={0}
                    role="button"
                    className="flex items-center pointer colors-background-selected-hover rounded focus-visible px1"
                    id="id_4b935699938b1dc90f6d249de25ecfc6"
                    aria-expanded="false"
                    aria-haspopup="true"
                    data-tutorial-selector-id="viewTopBarMenu"
                    style={{
                      height: '26px',
                      maxWidth: 'fit-content',
                    }}
                    aria-description="Tooltip: Grid viewCreated byJin-Oh Youm jinohy6@gmail.comEditingEveryone can edit the view configuration."
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div className="flex items-center min-width-0">
                      <span className="flex-inline flex-none items-center flex-none">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          className="flex-none icon"
                          style={{ shapeRendering: 'geometricPrecision' }}
                        >
                          <use
                            fill="rgb(22, 110, 225)"
                            href="/icons/icon_definitions.svg#GridFeature"
                          />
                        </svg>
                      </span>
                      <span
                        data-testid="viewName"
                        className="strong truncate flex-auto text-size-default ml1 mr1"
                        style={{ maxWidth: '200px' }}
                      >
                        {activeView?.name ?? 'Grid view'}
                      </span>
                      <div data-testid="More options">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          className="flex-none mt-half"
                          style={{ shapeRendering: 'geometricPrecision' }}
                        >
                          <use
                            fill="currentColor"
                            href="/icons/icon_definitions.svg#ChevronDown"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </h2>
              </div>

              {/* Right: controls container */}
              <div
                className="flex flex-auto items-center justify-end"
                style={{
                  height: '100%',
                  paddingRight: '8px',
                  marginLeft: '2px',
                }}
              >
                <div
                  className="flex items-center flex-auto overflow-hidden"
                  style={{ height: '100%' }}
                  data-tutorial-selector-id="viewConfigContainer"
                >
                  <div
                    className="flex items-center grow-1 justify-end"
                    style={{ paddingLeft: '8px', paddingRight: '8px' }}
                  >
                    <div
                      className="flex items-center"
                      style={{ marginLeft: '-4px' }} // shift hide/filter/group/sort/color cluster slightly left
                    >
                      {/* Bulk Insert Button */}
                      {tableId && !tableId.startsWith('__creating__') && (
                        <div
                          tabIndex={0}
                          role="button"
                          className="focus-visible mr1"
                          onClick={handleBulkInsert}
                          aria-label="Add 100k rows"
                          aria-disabled={isInserting}
                        >
                          <div
                            className="pointer flex items-center rounded colors-foreground-subtle"
                            data-isactive="false"
                            aria-description="Tooltip: Add 100k rows"
                            style={{
                              paddingLeft: '8px',
                              paddingRight: '8px',
                              paddingTop: '4px',
                              paddingBottom: '4px',
                              opacity: isInserting ? 0.5 : 1,
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => {
                              if (!isInserting) {
                                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            {isInserting ? (
                              <>
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 16 16"
                                  className="flex-none animate-spin"
                                  style={{ shapeRendering: 'geometricPrecision' }}
                                >
                                  <use
                                    fill="currentColor"
                                    href="/icons/icon_definitions.svg#SpinnerGap"
                                  />
                                </svg>
                                <div className="max-width-1 truncate ml-half">Inserting…</div>
                              </>
                            ) : (
                              <div className="max-width-1 truncate">+100k rows</div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Hide fields button */}
                      <div className="flex flex-row mr-half">
                        <div>
                          <HideFieldsButton
                            ref={hideFieldsButtonRef}
                            isOpen={isHideFieldsOpen}
                            onToggle={() => setIsHideFieldsOpen((v) => !v)}
                          />
                        </div>
                      </div>

                      <HideFieldsPopover
                        ref={hideFieldsPopoverRef}
                        tableId={tableId ?? ''}
                        isOpen={isHideFieldsOpen}
                        position={hideFieldsPos}
                      />

                      {/* Filter button */}
                      <div
                        tabIndex={0}
                        role="button"
                        className="collapsed focus-visible"
                        id="id_c7f6290319c67ac93b78bf99c80f47cd"
                        data-tutorial-selector-id="filterButton"
                        aria-label="Filter rows"
                        aria-haspopup="true"
                        aria-expanded={isFilterOpen}
                        ref={filterButtonRef}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsFilterOpen((v) => !v);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsFilterOpen((v) => !v);
                          }
                        }}
                      >
                        <div
                          className="pointer flex items-center rounded colors-foreground-subtle"
                          data-isactive={isFilterActiveForButton ? 'true' : 'false'}
                          aria-description="Tooltip: Filter"
                          style={{
                            paddingLeft: '8px',
                            paddingRight: '8px',
                            paddingTop: '4px',
                            paddingBottom: '4px',
                            backgroundColor: filteredFieldNames.length > 0 ? 'rgb(207, 245, 209)' : 'transparent',
                            color: filteredFieldNames.length > 0 ? 'rgb(29, 31, 37)' : undefined,
                            borderRadius: filteredFieldNames.length > 0 ? '4px' : undefined,
                          }}
                          onMouseEnter={(e) => {
                            if (filteredFieldNames.length === 0) {
                              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = filteredFieldNames.length > 0 ? 'rgb(207, 245, 209)' : 'transparent';
                          }}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            className="flex-none"
                            style={{ shapeRendering: 'geometricPrecision' }}
                          >
                            <use
                              fill="currentColor"
                              href="/icons/icon_definitions.svg#FunnelSimple"
                            />
                          </svg>
                          <div className="max-width-1 truncate ml-half">
                            {filterButtonText}
                          </div>
                        </div>
                      </div>

                      <FilterPopover
                        ref={filterPopoverRef}
                        tableId={tableId ?? ''}
                        isOpen={isFilterOpen}
                        position={filterPos}
                        filters={filters}
                        onChangeFilters={applyFilters}
                        onDraftFiltersChange={applyDraftFilters}
                        onRequestClose={() => {
                          setIsFilterOpen(false);
                          setFilterPos(null);
                          setDraftFilters(filters);
                        }}
                      />
                    </div>

                    {/* Group and Sort buttons */}
                    <div
                      className="flex items-center"
                      data-tutorial-selector-id="groupAndSortButtons"
                    >
                      {/* Group button */}
                      <div>
                        <div
                          aria-label="Group rows"
                          role="button"
                          aria-haspopup="true"
                          aria-expanded="false"
                          className="collapsed focus-visible mr-half"
                          tabIndex={0}
                        >
                          <div
                            className="pointer flex items-center rounded colors-foreground-subtle"
                            data-isactive="false"
                            aria-description="Tooltip: Group"
                            style={{
                              paddingLeft: '8px',
                              paddingRight: '8px',
                              paddingTop: '4px',
                              paddingBottom: '4px',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 16 16"
                              className="flex-none"
                              style={{ shapeRendering: 'geometricPrecision' }}
                            >
                              <use
                                fill="currentColor"
                                href="/icons/icon_definitions.svg#Group"
                              />
                            </svg>
                            <div className="max-width-1 truncate ml-half">Group</div>
                          </div>
                        </div>
                      </div>

                      {/* Sort button */}
                      <div>
                        <div
                          aria-label="Sort rows"
                          role="button"
                          aria-haspopup="true"
                          aria-expanded={isSortOpen}
                          className="focus-visible collapsed mr-half"
                          tabIndex={0}
                          ref={sortButtonRef}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsSortOpen((v) => !v);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsSortOpen((v) => !v);
                            }
                          }}
                        >
                          <div
                            className="pointer flex items-center rounded colors-foreground-subtle"
                            data-isactive={isSortActiveForButton ? 'true' : 'false'}
                            aria-description={`Tooltip: ${
                              isSortActiveForButton
                                ? `Sorted by ${sortCountForButton} field${sortCountForButton === 1 ? '' : 's'}`
                                : 'Sort'
                            }`}
                            style={{
                              paddingLeft: '8px',
                              paddingRight: '8px',
                              paddingTop: '4px',
                              paddingBottom: '4px',
                              backgroundColor: isSortActiveForButton ? 'rgb(255, 224, 204)' : 'transparent',
                              color: isSortActiveForButton ? 'rgb(29, 31, 37)' : undefined,
                              // "More square" active pill
                              borderRadius: isSortActiveForButton ? '4px' : undefined,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor =
                                isSortActiveForButton ? 'rgb(255, 224, 204)' : 'rgba(0, 0, 0, 0.05)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                isSortActiveForButton ? 'rgb(255, 224, 204)' : 'transparent';
                            }}
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 16 16"
                              className="flex-none"
                              style={{ shapeRendering: 'geometricPrecision' }}
                            >
                              <use
                                fill="currentColor"
                                href="/icons/icon_definitions.svg#ArrowsDownUp"
                              />
                            </svg>
                            <div className="max-width-1 truncate ml-half">
                              {isSortActiveForButton
                                ? `Sorted by ${sortCountForButton} field${sortCountForButton === 1 ? '' : 's'}`
                                : 'Sort'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <SortPopover
                        ref={sortPopoverRef}
                        tableId={tableId ?? ''}
                        isOpen={isSortOpen}
                        position={sortPos}
                        sortRules={sortRules}
                        onChangeSortRules={applySortRules}
                        onDraftRulesChange={setDraftSortRules}
                        onRequestClose={() => {
                          setIsSortOpen(false);
                          setSortPos(null);
                          setDraftSortRules(sortRules);
                        }}
                      />

                      {/* Color button */}
                      <div
                        tabIndex={0}
                        role="button"
                        className="collapsed focus-visible mr-half"
                        id="viwbTwMqnWkLGzJTN-colorConfigButton"
                        aria-label="Row colors"
                      >
                        <div
                          className="pointer flex items-center rounded colors-foreground-subtle"
                          data-isactive="false"
                          aria-description="Tooltip: Color"
                          style={{
                            paddingLeft: '8px',
                            paddingRight: '8px',
                            paddingTop: '4px',
                            paddingBottom: '4px',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            className="flex-none"
                            style={{ shapeRendering: 'geometricPrecision' }}
                          >
                            <use
                              fill="currentColor"
                              href="/icons/icon_definitions.svg#PaintBucket"
                            />
                          </svg>
                          <div className="max-width-1 truncate ml-half">Color</div>
                        </div>
                      </div>
                    </div>

                    {/* Row height button */}
                    <div>
                      <div
                        aria-label="Row height"
                        role="button"
                        aria-haspopup="true"
                        aria-expanded="false"
                        className="focus-visible mr-half"
                        tabIndex={0}
                        style={{ marginLeft: '8px' }}
                      >
                        <div
                          className="pointer flex items-center rounded colors-foreground-subtle"
                          aria-description="Tooltip: Row height"
                          style={{
                            paddingLeft: '8px',
                            paddingRight: '8px',
                            paddingTop: '4px',
                            paddingBottom: '4px',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            className="flex-none"
                            style={{ shapeRendering: 'geometricPrecision' }}
                          >
                            <use
                              fill="currentColor"
                              href="/icons/icon_definitions.svg#RowHeightSmall"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Share and sync button */}
                <span className="flex items-center mr1">
                  <div
                    tabIndex={0}
                    role="button"
                    className="focus-visible"
                    aria-label="Share and sync"
                    data-testid="share-view-popover-button"
                    id="id_410a58ad5c2a51f6701b7e89e38543dc"
                    aria-expanded="false"
                    aria-haspopup="true"
                  >
                    <div
                      className="pointer flex items-center rounded colors-foreground-subtle"
                      data-isactive="false"
                      aria-description="Tooltip: Share and sync"
                      style={{
                        paddingLeft: '8px',
                        paddingRight: '8px',
                        paddingTop: '4px',
                        paddingBottom: '4px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        className="flex-none"
                        style={{ shapeRendering: 'geometricPrecision' }}
                      >
                        <use
                          fill="currentColor"
                          href="/icons/icon_definitions.svg#ArrowSquareOut"
                        />
                      </svg>
                      <div className="max-width-1 truncate ml-half">Share and sync</div>
                    </div>
                  </div>
                </span>

                {/* Search button */}
                <div
                  tabIndex={0}
                  role="button"
                  className="flex items-center justify-center focus-visible cursor-pointer colors-foreground-subtle"
                  aria-label="toggle view search input"
                  aria-pressed={isSearchOpen}
                  aria-description="Tooltip: Find in viewctrlf"
                  style={{
                    padding: '4px',
                    marginLeft: '6px', // bring magnifier slightly left
                  }}
                  onClick={() => {
                    setIsSearchOpen(!isSearchOpen);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                    e.currentTarget.style.borderRadius = '4px';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    className="flex-none icon"
                    style={{ shapeRendering: 'geometricPrecision' }}
                  >
                    <use
                      fill="currentColor"
                      href="/icons/icon_definitions.svg#MagnifyingGlass"
                    />
                  </svg>
                </div>

                {/* Search dropdown bar - positioned relative to view bar */}
                {isSearchOpen && (
                  <div
                    ref={searchBarRef}
                    tabIndex={0}
                    role="button"
                    className="hideOnGridViewDrag mr1 absolute colors-background-default flex flex-column findInView border colors-border-default rounded-big-bottom focus-visible"
                    data-testid="find-bar"
                    style={{
                      zIndex: 6,
                      width: '370px',
                      borderWidth: '1px 2px 2px',
                      borderTopColor: 'rgba(229, 231, 235, 1)',
                      borderRightColor: 'rgba(0, 0, 0, 0.1)',
                      borderBottomColor: 'rgba(0, 0, 0, 0.1)',
                      borderLeftColor: 'rgba(0, 0, 0, 0.1)',
                      borderStyle: 'solid',
                      borderTopLeftRadius: '0px',
                      borderTopRightRadius: '0px',
                      borderBottomLeftRadius: '6px',
                      borderBottomRightRadius: '6px',
                      backgroundColor: 'rgb(255, 255, 255)',
                      boxSizing: 'border-box',
                      position: 'absolute',
                      top: '100%',
                      right: '8px',
                    }}
                  >
                    <div
                      className="flex"
                      style={{
                        boxSizing: 'border-box',
                        color: 'rgb(29, 31, 37)',
                        display: 'flex',
                        alignItems: 'center',
                        fontFamily:
                          '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
                        fontSize: '13px',
                        fontWeight: 400,
                        height: '38px',
                        lineHeight: '18px',
                        marginBottom: '0px',
                        marginLeft: '0px',
                        marginRight: '0px',
                        marginTop: '0px',
                        paddingBottom: '0px',
                        paddingLeft: '0px',
                        paddingRight: '0px',
                        paddingTop: '0px',
                        unicodeBidi: 'isolate',
                        userSelect: 'none',
                        width: '366px',
                      }}
                    >
                      <input
                        ref={searchInputRef}
                        type="search"
                        className="p1 flex-auto css-1uw7fyx"
                        placeholder="Find in view..."
                        autoComplete="off"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        style={{
                          border: '2px solid transparent',
                          background: 'transparent',
                          outline: 'none',
                          fontFamily:
                            '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
                          fontSize: '13px',
                          fontWeight: 400,
                          color: 'rgb(29, 31, 37)',
                          padding: '8px',
                          flex: '1 1 auto',
                          boxSizing: 'border-box',
                        }}
                      />
                      <div className="small quieter noevents flex items-center flex-none pr1"></div>
                      <button
                        className="pointer items-center justify-center border-box text-decoration-none print-color-exact focus-visible rounded-big ignore-baymax-defaults border-none text-white font-weight-strong css-13jexyk shadow-elevation-low shadow-elevation-low-hover px1 button-size-xsmall flex-inline self-center mx-quarter"
                        type="button"
                        aria-disabled="false"
                        style={{
                          alignItems: 'center',
                          alignSelf: 'center',
                          appearance: 'auto',
                          backgroundColor: 'rgb(29, 31, 37)',
                          borderBottomColor: 'rgb(255, 255, 255)',
                          borderBottomLeftRadius: '6px',
                          borderBottomRightRadius: '6px',
                          borderBottomStyle: 'none',
                          borderBottomWidth: '0px',
                          borderImageOutset: 0,
                          borderImageRepeat: 'stretch',
                          borderImageSlice: '100%',
                          borderImageSource: 'none',
                          borderImageWidth: 1,
                          borderLeftColor: 'rgb(255, 255, 255)',
                          borderLeftStyle: 'none',
                          borderLeftWidth: '0px',
                          borderRightColor: 'rgb(255, 255, 255)',
                          borderRightStyle: 'none',
                          borderRightWidth: '0px',
                          borderTopColor: 'rgb(255, 255, 255)',
                          borderTopLeftRadius: '6px',
                          borderTopRightRadius: '6px',
                          borderTopStyle: 'none',
                          borderTopWidth: '0px',
                          boxShadow:
                            'rgba(0, 0, 0, 0.32) 0px 0px 1px 0px, rgba(0, 0, 0, 0.08) 0px 0px 2px 0px, rgba(0, 0, 0, 0.08) 0px 1px 3px 0px',
                          boxSizing: 'border-box',
                          color: 'rgb(255, 255, 255)',
                          cursor: 'pointer',
                          display: 'flex',
                          fill: 'rgb(255, 255, 255)',
                          fontFamily:
                            '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
                          fontFeatureSettings: 'normal',
                          fontKerning: 'auto',
                          fontLanguageOverride: 'normal',
                          fontOpticalSizing: 'auto',
                          fontSize: '11px',
                          fontSizeAdjust: 'none',
                          fontStretch: '100%',
                          fontStyle: 'normal',
                          fontVariantAlternates: 'normal',
                          fontVariantCaps: 'normal',
                          fontVariantEastAsian: 'normal',
                          fontVariantEmoji: 'normal',
                          fontVariantLigatures: 'normal',
                          fontVariantNumeric: 'normal',
                          fontVariantPosition: 'normal',
                          fontVariationSettings: 'normal',
                          fontWeight: 500,
                          height: '24px',
                          justifyContent: 'center',
                          letterSpacing: 'normal',
                          lineHeight: '20px',
                          marginBottom: '0px',
                          marginLeft: '2px',
                          marginRight: '2px',
                          marginTop: '0px',
                          maxWidth: '100%',
                          paddingBlockEnd: '0px',
                          paddingBlockStart: '0px',
                          paddingBottom: '0px',
                          paddingInlineEnd: '8px',
                          paddingInlineStart: '8px',
                          paddingLeft: '8px',
                          paddingRight: '8px',
                          paddingTop: '0px',
                          printColorAdjust: 'exact',
                          textAlign: 'center',
                          textDecorationColor: 'rgb(255, 255, 255)',
                          textDecorationLine: 'none',
                          textDecorationStyle: 'solid',
                          textDecorationThickness: 'auto',
                          textIndent: '0px',
                          textRendering: 'auto',
                          textShadow: 'none',
                          textTransform: 'none',
                          userSelect: 'none',
                          width: '64.2812px',
                          wordSpacing: '0px',
                        }}
                      >
                        <span className="truncate noevents button-text-label no-user-select">
                          Ask Omni
                        </span>
                      </button>
                      <div
                        tabIndex={0}
                        role="button"
                        className="flex items-center pointer flex-none rounded-big colors-background-inset-control-hover my1 mr1 ml-quarter justify-center focus-visible"
                        style={{
                          width: '20px',
                          height: '20px',
                          marginTop: '4px',
                          marginBottom: '4px',
                          marginRight: '8px',
                          marginLeft: '4px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flex: 'none',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSearchInput('');
                          setIsSearchOpen(false);
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 16 16"
                          className="flex-none icon"
                          style={{ shapeRendering: 'geometricPrecision' }}
                        >
                          <use fill="currentColor" href="/icons/icon_definitions.svg#X" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 overflow-hidden">
              <Sidebar
                tableId={tableId ?? ''}
                views={views ?? []}
                activeViewId={activeViewId}
                onSelectView={(nextViewId) => {
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('views:flushActive'));
                  }
                  setViewSwitchSeq((n) => n + 1);
                  if (tableId) {
                    lastSelectedViewIdByTableIdRef.current[tableId] = nextViewId;
                  }
                  setActiveViewId(nextViewId);
                }}
                onCreatedView={(created) => {
                  if (tableId) {
                    lastSelectedViewIdByTableIdRef.current[tableId] = created.id;
                  }
                  setActiveViewId(created.id);
                  // New view should start clean; applying view handles the rest.
                }}
                isLoadingViews={isLoadingViews}
              />
              <MainContent
                isSearchOpen={isSearchOpen}
                search={search}
                sortRules={sortRules}
                filters={effectiveFiltersForQuery}
              />
              {/* Keep children mounted for route completeness */}
              {children}
            </div>
          </ColumnsUiProvider>
        ) : (
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <Sidebar
              tableId={''}
              views={[]}
              activeViewId={null}
              onSelectView={() => null}
              onCreatedView={() => null}
              isLoadingViews={false}
            />
            <div
              className="flex min-h-0 flex-1 items-center justify-center"
              style={{ backgroundColor: '#f6f8fc' }}
            >
              <div className="max-w-md text-center px-6">
                <div className="text-[14px] font-semibold text-gray-800 mb-2">This base has no tables yet</div>
                <div className="text-[13px] text-gray-600 mb-4">
                  Create a blank table or import data to get started.
                </div>
                <button
                  type="button"
                  className="rounded-md bg-gray-900 text-white px-4 py-2 text-[13px] hover:bg-gray-800"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('tables:openAddImport'));
                  }}
                >
                  Add or import
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ViewHiddenColumnsApplier({
  activeViewId,
  hiddenColumns,
  isApplyingViewRef,
}: {
  activeViewId: string | null;
  hiddenColumns: string[];
  isApplyingViewRef: React.MutableRefObject<boolean>;
}) {
  const { hiddenColumnIds, setHiddenColumnIds } = useColumnsUi();
  const hiddenColumnIdsRef = useRef<ReadonlySet<string>>(hiddenColumnIds);

  useEffect(() => {
    hiddenColumnIdsRef.current = hiddenColumnIds;
  }, [hiddenColumnIds]);

  // Important: `hiddenColumns` is often a freshly-created array on each render.
  // Use a stable signature to avoid re-applying the server state and overwriting
  // local/optimistic UI changes before autosave runs.
  const hiddenColumnsSignature = useMemo(() => JSON.stringify([...hiddenColumns].sort()), [hiddenColumns]);
  const hiddenColumnsFromSignature = useMemo<string[]>(
    () => {
      try {
        const parsed = JSON.parse(hiddenColumnsSignature);
        return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
      } catch {
        return [];
      }
    },
    [hiddenColumnsSignature],
  );

  useEffect(() => {
    if (!activeViewId) return;

    const current = Array.from(hiddenColumnIdsRef.current).sort();
    if (JSON.stringify(current) === hiddenColumnsSignature) return;

    isApplyingViewRef.current = true;
    setHiddenColumnIds(new Set(hiddenColumnsFromSignature));
    const t = window.setTimeout(() => {
      isApplyingViewRef.current = false;
    }, 0);
    return () => window.clearTimeout(t);
  }, [activeViewId, hiddenColumnsSignature, hiddenColumnsFromSignature, setHiddenColumnIds, isApplyingViewRef]);

  return null;
}

