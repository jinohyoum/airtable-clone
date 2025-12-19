'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Plus,
  Type,
  User,
  Paperclip,
  Bell,
} from 'lucide-react';

function LongTextFieldIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={className}
      fill="none"
    >
      {/* "A=" */}
      <path
        d="M2.5 4.5h3M2.5 6h3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M6.2 4.3h2.2M6.2 6.2h2.2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* lines */}
      <path
        d="M2.5 9h11M2.5 11h8.5M2.5 13h10"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function MainContent() {
  const middleScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingRef = useRef<'middle' | 'bottom' | null>(null);
  const [bottomSpacerWidth, setBottomSpacerWidth] = useState<number>(0);
  const [hoveredRow, setHoveredRow] = useState<'data' | 'add' | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDataHovered = hoveredRow === 'data';
  const isAddHovered = hoveredRow === 'add';

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white overflow-hidden">
      {/* Spreadsheet grid
          - Left (checkbox + Name) is fixed
          - Middle scrolls horizontally
          - Right (+) stays fixed */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full overflow-y-auto overflow-x-hidden">
          <div className="flex min-w-0 h-full">
          {/* Left fixed pane */}
          <div className="w-[288px] flex-shrink-0 border-r border-gray-200">
            <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr className="bg-gray-50 h-10">
                  <th className="w-12 h-10 bg-gray-50 border-b border-gray-200 p-0 align-middle">
                    <div className="flex items-center justify-center h-10">
                      <input type="checkbox" className="rounded border-gray-300" />
                    </div>
                  </th>
                  <th className="min-w-[240px] h-10 bg-gray-50 border-b border-gray-200 p-0 text-left align-middle">
                    <div className="h-10 px-2 flex items-center gap-2">
                      <Type className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-xs font-semibold text-gray-700">Name</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  className={isDataHovered ? 'bg-gray-50' : ''}
                  onMouseEnter={() => setHoveredRow('data')}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <td
                    className={`w-12 h-8 border-b border-gray-200 text-center align-middle ${
                      isDataHovered ? 'bg-gray-50' : 'bg-white'
                    }`}
                  >
                    <div className="h-8 flex items-center justify-center text-xs text-gray-500 font-medium">1</div>
                  </td>
                  <td
                    className={`h-8 border-b border-gray-200 p-0 align-middle ${
                      isDataHovered ? 'bg-gray-50' : 'bg-white'
                    }`}
                  >
                    <input
                      type="text"
                      className="w-full h-8 px-2 bg-transparent outline-none text-sm focus:bg-blue-50"
                      placeholder=""
                    />
                  </td>
                </tr>
                <tr
                  className={isAddHovered ? 'bg-gray-50' : ''}
                  onMouseEnter={() => setHoveredRow('add')}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <td
                    colSpan={2}
                    className={`h-8 border-b border-gray-200 p-0 align-middle ${
                      isAddHovered ? 'bg-gray-50' : 'bg-white'
                    }`}
                  >
                    <button className="h-8 w-full flex items-center gap-1 px-2 text-gray-400 hover:text-gray-600 text-sm">
                      <Plus className="w-5 h-5" />
                    </button>
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
                <tr className="bg-gray-50 h-10">
                  <th className="min-w-[240px] h-10 border-r border-b border-gray-200 p-0 text-left bg-gray-50 align-middle">
                    <div className="h-10 px-3 flex items-center gap-2">
                      <LongTextFieldIcon className="w-4 h-4 text-gray-600" />
                      <span className="text-xs font-semibold text-gray-700">Notes</span>
                    </div>
                  </th>
                  <th className="min-w-[180px] h-10 border-r border-b border-gray-200 p-0 text-left bg-gray-50 align-middle">
                    <div className="h-10 px-2 flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-xs font-semibold text-gray-700">Assignee</span>
                    </div>
                  </th>
                  <th className="min-w-[180px] h-10 border-r border-b border-gray-200 p-0 text-left bg-gray-50 align-middle">
                    <div className="h-10 px-2 flex items-center gap-2">
                      <Bell className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-xs font-semibold text-gray-700">Status</span>
                    </div>
                  </th>
                  <th className="min-w-[180px] h-10 border-r border-b border-gray-200 p-0 text-left bg-gray-50 align-middle">
                    <div className="h-10 px-2 flex items-center gap-2">
                      <Paperclip className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-xs font-semibold text-gray-700">Attachments</span>
                    </div>
                  </th>
                  <th className="min-w-[180px] h-10 border-r border-b border-gray-200 p-0 text-left bg-gray-50 align-middle">
                    <div className="h-10 px-2 flex items-center gap-2">
                      <Paperclip className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-xs font-semibold text-gray-700">Attachment...</span>
                    </div>
                  </th>

                  {/* Add column button (scrolls with table; appears at the end) */}
                  <th className="w-28 h-10 border-r border-b border-gray-200 bg-gray-50 p-0 align-middle">
                    <button className="w-full h-10 flex items-center justify-center hover:bg-gray-100 text-gray-500">
                      <Plus className="w-4 h-4" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  className={isDataHovered ? 'bg-gray-50' : ''}
                  onMouseEnter={() => setHoveredRow('data')}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <td
                    className={`h-8 border-r border-b border-gray-200 p-0 align-middle ${
                      isDataHovered ? 'bg-gray-50' : 'bg-white'
                    }`}
                  >
                    <input
                      type="text"
                      className="w-full h-8 pl-3 pr-2 bg-transparent outline-none text-sm focus:bg-blue-50"
                      placeholder=""
                    />
                  </td>
                  <td
                    className={`h-8 border-r border-b border-gray-200 p-0 align-middle ${
                      isDataHovered ? 'bg-gray-50' : 'bg-white'
                    }`}
                  >
                    <div className="h-8" />
                  </td>
                  <td
                    className={`h-8 border-r border-b border-gray-200 p-0 align-middle ${
                      isDataHovered ? 'bg-gray-50' : 'bg-white'
                    }`}
                  >
                    <div className="h-8" />
                  </td>
                  <td
                    className={`h-8 border-r border-b border-gray-200 p-0 align-middle ${
                      isDataHovered ? 'bg-gray-50' : 'bg-white'
                    }`}
                  >
                    <div className="h-8" />
                  </td>
                  <td
                    className={`h-8 border-r border-b border-gray-200 p-0 align-middle ${
                      isDataHovered ? 'bg-gray-50' : 'bg-white'
                    }`}
                  >
                    <div className="h-8" />
                  </td>

                  {/* Add column cell */}
                  {/* No grid under the + header (Airtable-style):
                      keep only the left boundary line so the grid "stops" cleanly */}
                  <td className="w-28 h-8 border-0 bg-transparent" />
                </tr>
                <tr
                  className={isAddHovered ? 'bg-gray-50' : ''}
                  onMouseEnter={() => setHoveredRow('add')}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <td
                    colSpan={5}
                    className={`border-r border-b border-gray-200 p-0 ${
                      isAddHovered ? 'bg-gray-50' : 'bg-white'
                    }`}
                  >
                    <div className="h-8" />
                  </td>
                  {/* Empty area under +: no borders so the grid "stops" */}
                  <td className="w-28 h-8 border-0 bg-transparent p-0">
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
        <span className="text-xs text-gray-600">1 record</span>
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
