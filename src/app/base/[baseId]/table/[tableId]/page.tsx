import TopNav from './components/TopNav';
import LeftSidebarNarrow from './components/LeftSidebarNarrow';
import TableTabsBar from './components/TableTabsBar';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import { ChevronDown, EyeOff, Filter, Group, ArrowUpDown, Palette, Share2, Search, MoreHorizontal, Grid3x3, Menu } from 'lucide-react';

export default async function TablePage({
  params,
}: {
  params: Promise<{ baseId: string; tableId: string }>;
}) {
  const { baseId, tableId } = await params;

  return (
    <div className="h-screen flex bg-[#FAF8F6] overflow-hidden">
      <LeftSidebarNarrow />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopNav />
        <TableTabsBar />
        {/* View bar (spans to the narrow sidebar) */}
        <div className="h-12 bg-white border-b border-gray-200 flex items-center px-3 flex-shrink-0">
          {/* Left: hamburger + Grid view (no boxed button) */}
          <button className="p-1.5 hover:bg-gray-100 rounded mr-2">
            <Menu className="w-4 h-4 text-gray-600" />
          </button>
          <button className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded text-sm">
            <Grid3x3 className="w-4 h-4 text-blue-600" />
            <span className="font-medium text-gray-800">Grid view</span>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>

          <div className="flex-1" />

          {/* Right: controls */}
          <div className="flex items-center gap-0.5">
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-gray-100 rounded text-sm">
              <EyeOff className="w-4 h-4 text-gray-600" />
              <span className="text-gray-700">Hide fields</span>
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-gray-100 rounded text-sm">
              <Filter className="w-4 h-4 text-gray-600" />
              <span className="text-gray-700">Filter</span>
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-gray-100 rounded text-sm">
              <Group className="w-4 h-4 text-gray-600" />
              <span className="text-gray-700">Group</span>
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-gray-100 rounded text-sm">
              <ArrowUpDown className="w-4 h-4 text-gray-600" />
              <span className="text-gray-700">Sort</span>
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-gray-100 rounded text-sm">
              <Palette className="w-4 h-4 text-gray-600" />
              <span className="text-gray-700">Color</span>
            </button>
            <button className="p-1.5 hover:bg-gray-100 rounded">
              <MoreHorizontal className="w-4 h-4 text-gray-600" />
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-gray-100 rounded text-sm">
              <Share2 className="w-4 h-4 text-gray-600" />
              <span className="text-gray-700">Share and sync</span>
            </button>
            <button className="p-1.5 hover:bg-gray-100 rounded ml-1">
              <Search className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          <Sidebar />
          <MainContent />
        </div>
      </div>
    </div>
  );
}
