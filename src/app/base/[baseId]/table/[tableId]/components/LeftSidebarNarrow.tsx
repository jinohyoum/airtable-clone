'use client';

import Image from 'next/image';
import { Loader, HelpCircle, Bell } from 'lucide-react';

export default function LeftSidebarNarrow() {
  return (
    <div className="w-14 bg-white border-r border-gray-200 flex flex-col items-center py-3 justify-between">
      {/* Top icons */}
      <div className="flex flex-col items-center gap-2">
        {/* Home icon (Airtable logo) */}
        <button className="w-10 h-10 flex items-center justify-center rounded hover:bg-gray-100">
          <Image
            src="/brand/airtable-logo.svg"
            alt="Airtable"
            width={22}
            height={22}
            priority
          />
        </button>

        {/* Spinner/Loading icon */}
        <button className="w-10 h-10 flex items-center justify-center rounded hover:bg-gray-100">
          <Loader className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Bottom icons */}
      <div className="flex flex-col items-center gap-2">
        {/* Help icon */}
        <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
          <HelpCircle className="w-5 h-5 text-gray-600" />
        </button>

        {/* Notification icon */}
        <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
          <Bell className="w-5 h-5 text-gray-600" />
        </button>

        {/* Profile picture */}
        <button className="w-8 h-8 flex items-center justify-center rounded-full bg-[#D97A3A] text-white font-semibold text-sm">
          J
        </button>
      </div>
    </div>
  );
}
