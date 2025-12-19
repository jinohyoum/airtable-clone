'use client';

import { Plus, Grid3x3, Search, Settings } from 'lucide-react';

export default function Sidebar() {
  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* View controls */}
      <div className="flex-1 flex flex-col p-3 gap-2.5">
        {/* Create new */}
        <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded">
          <Plus className="w-4 h-4" />
          <span>Create new...</span>
        </button>

        {/* Find a view */}
        <div className="relative">
          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Find a view"
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400"
            />
            <Settings className="w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-600" />
          </div>
        </div>

        {/* Grid view option */}
        <div className="mt-2">
          <button className="w-full flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded text-sm">
            <Grid3x3 className="w-4 h-4 text-blue-600" />
            <span className="text-blue-900 font-medium">Grid view</span>
          </button>
        </div>
      </div>
    </div>
  );
}
