import type { ReactNode } from 'react';

import {
  ArrowUpDown,
  ChevronDown,
  EyeOff,
  Filter,
  Grid3x3,
  Group,
  Menu,
  MoreHorizontal,
  Palette,
  Search,
  Share2,
} from 'lucide-react';

import BulkInsertButton from './[tableId]/components/BulkInsertButton';
import LeftSidebarNarrow from './[tableId]/components/LeftSidebarNarrow';
import MainContent from './[tableId]/components/MainContent';
import Sidebar from './[tableId]/components/Sidebar';
import TableTabsBar from './[tableId]/components/TableTabsBar';
import TopNav from './[tableId]/components/TopNav';

export default function TableLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#FAF8F6]">
      <LeftSidebarNarrow />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav />
        <TableTabsBar />
        {/* View bar (spans to the narrow sidebar) */}
        <div className="flex h-12 flex-shrink-0 items-center border-b border-gray-200 bg-white px-3">
          {/* Left: hamburger + Grid view (no boxed button) */}
          <button className="mr-2 rounded p-1.5 hover:bg-gray-100">
            <Menu className="h-4 w-4 text-gray-600" />
          </button>
          <button className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-100">
            <Grid3x3 className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-gray-800">Grid view</span>
            <ChevronDown className="h-4 w-4 text-gray-500" />
          </button>

          <div className="flex-1" />

          {/* Right: controls */}
          <div className="flex items-center gap-0.5">
            <BulkInsertButton />
            <button className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm hover:bg-gray-100">
              <EyeOff className="h-4 w-4 text-gray-600" />
              <span className="text-gray-700">Hide fields</span>
            </button>
            <button className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm hover:bg-gray-100">
              <Filter className="h-4 w-4 text-gray-600" />
              <span className="text-gray-700">Filter</span>
            </button>
            <button className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm hover:bg-gray-100">
              <Group className="h-4 w-4 text-gray-600" />
              <span className="text-gray-700">Group</span>
            </button>
            <button className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm hover:bg-gray-100">
              <ArrowUpDown className="h-4 w-4 text-gray-600" />
              <span className="text-gray-700">Sort</span>
            </button>
            <button className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm hover:bg-gray-100">
              <Palette className="h-4 w-4 text-gray-600" />
              <span className="text-gray-700">Color</span>
            </button>
            <button className="rounded p-1.5 hover:bg-gray-100">
              <MoreHorizontal className="h-4 w-4 text-gray-600" />
            </button>
            <button className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm hover:bg-gray-100">
              <Share2 className="h-4 w-4 text-gray-600" />
              <span className="text-gray-700">Share and sync</span>
            </button>
            <button className="ml-1 rounded p-1.5 hover:bg-gray-100">
              <Search className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <Sidebar />
          <MainContent />
          {/* Keep children mounted for route completeness */}
          {children}
        </div>
      </div>
    </div>
  );
}

