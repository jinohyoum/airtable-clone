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
  
  // Row creation
  const utils = api.useUtils();
  const createRowMutation = api.table.createRow.useMutation({
    onSuccess: () => {
      void utils.table.getData.invalidate({ tableId });
    },
  });
  
  const handleCreateRow = () => {
    if (isCreatingTable) return;
    createRowMutation.mutate({ tableId });
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
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ backgroundColor: '#f6f8fc' }}>
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="h-full overflow-y-auto overflow-x-hidden">
            <div className="p-6 text-sm text-gray-600">Creating table…</div>
            <div className="px-6">
              <div className="h-8 w-64 rounded bg-gray-200/70" />
              <div className="mt-4 space-y-2">
                <div className="h-8 w-full rounded bg-gray-200/50" />
                <div className="h-8 w-full rounded bg-gray-200/50" />
                <div className="h-8 w-full rounded bg-gray-200/50" />
                <div className="h-8 w-full rounded bg-gray-200/50" />
              </div>
            </div>
          </div>
        </div>
      </div>
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
                          key={`${tableId}-${row.id}-name`}
                          type="text"
                          className="w-full h-8 px-2 bg-transparent outline-none focus:bg-blue-50 table-cell-input"
                          defaultValue={firstCell ? (firstCell.getValue() as string ?? '') : ''}
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
                  
                  return (
                    <tr
                      key={row.id}
                      className={isHovered ? 'bg-gray-50' : ''}
                      onMouseEnter={() => setHoveredRow(idx)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      {visibleCells.map((cell) => (
                        <td
                          key={cell.id}
                          className={`w-[180px] h-8 border-r border-b border-gray-200 p-0 align-middle ${
                            isHovered ? 'bg-gray-50' : 'bg-white'
                          }`}
                        >
                          <input
                            key={`${tableId}-${cell.id}`}
                            type="text"
                            className="w-full h-8 pl-3 pr-2 bg-transparent outline-none focus:bg-blue-50 table-cell-input"
                            defaultValue={(cell.getValue() as string ?? '')}
                          />
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
