'use client';

import Image from 'next/image';
import { ChevronDown, Clock, Monitor } from 'lucide-react';

export default function TopNav() {
  return (
    <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
      {/* Left section */}
      <div className="flex items-center gap-3">
        {/* Logo */}
        <div className="flex items-center">
          <Image
            src="/brand/airtable-logo.svg"
            alt="Airtable"
            width={28}
            height={28}
            priority
          />
        </div>

        {/* Base name dropdown */}
        <button className="flex items-center gap-1 px-2 py-1.5 hover:bg-gray-50 rounded text-sm font-medium">
          <span>Untitled Base</span>
          <ChevronDown className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Center tabs */}
      <div className="flex items-center gap-8">
        <button className="text-sm font-medium text-gray-900 border-b-2 border-gray-900 pb-4 pt-4">
          Data
        </button>
        <button className="text-sm font-medium text-gray-600 hover:text-gray-900 pb-4 pt-4">
          Automations
        </button>
        <button className="text-sm font-medium text-gray-600 hover:text-gray-900 pb-4 pt-4">
          Interfaces
        </button>
        <button className="text-sm font-medium text-gray-600 hover:text-gray-900 pb-4 pt-4">
          Forms
        </button>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Clock className="w-4 h-4" />
          <span>Trial: 11 days left</span>
        </div>
        <button className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium">
          <Monitor className="w-4 h-4" />
          <span>Launch</span>
        </button>
        <button className="px-4 py-1.5 bg-[#9B6B5C] hover:bg-[#8A5F52] text-white rounded text-sm font-medium">
          Share
        </button>
      </div>
    </div>
  );
}
