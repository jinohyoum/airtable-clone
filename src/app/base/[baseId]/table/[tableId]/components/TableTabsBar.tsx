'use client';

import { ChevronDown, Plus } from 'lucide-react';

export default function TableTabsBar() {
  return (
    <div className="h-12 bg-[#FDF6F0] border-b border-gray-200 flex items-center px-4 gap-2">
      {/* Table 1 tab */}
      <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm font-medium hover:bg-gray-50">
        <span>Table 1</span>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>

      {/* Table 2 tab */}
      <button className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/50 rounded text-sm text-gray-700">
        <span>Table 2</span>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>

      {/* Add or import button */}
      <button className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/50 rounded text-sm text-gray-700">
        <Plus className="w-4 h-4" />
        <span>Add or import</span>
      </button>

      <div className="flex-1" />

      {/* Tools (moved up from view bar) */}
      <button className="flex items-center gap-1.5 px-2 py-1 hover:bg-white/50 rounded text-sm text-gray-700">
        <span>Tools</span>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>
    </div>
  );
}
