'use client';

import Image from 'next/image';
import { Loader, HelpCircle, Bell } from 'lucide-react';

export default function LeftSidebarNarrow() {
  return (
    <div className="w-14 bg-white border-r border-gray-200 flex flex-col items-center py-3 justify-between">
      {/* Top icons */}
      <div className="flex flex-col items-center gap-2">
        {/* Home icon (Airtable logo) */}
        <div className="flex items-center">
          <a 
            id="appTopBarHomeButton" 
            aria-label="Back to home" 
            className="flex flex-none relative pointer circle focus-visible-white colors-border-emphasis" 
            href="/" 
            style={{ width: '24px', height: '24px' }} 
            aria-description="Tooltip: Back to home"
          >
            <div className="animate flex flex-auto items-center justify-center" style={{ transform: 'scale(1)' }}>
              <div style={{ position: 'relative', top: '2px' }}>
                <svg 
                  width="24" 
                  height="20.4" 
                  viewBox="0 0 200 170" 
                  xmlns="http://www.w3.org/2000/svg" 
                  style={{ shapeRendering: 'geometricprecision' }}
                >
                  <g>
                    <path 
                      fill="rgb(29, 31, 37)" 
                      d="M90.0389,12.3675 L24.0799,39.6605 C20.4119,41.1785 20.4499,46.3885 24.1409,47.8515 L90.3759,74.1175 C96.1959,76.4255 102.6769,76.4255 108.4959,74.1175 L174.7319,47.8515 C178.4219,46.3885 178.4609,41.1785 174.7919,39.6605 L108.8339,12.3675 C102.8159,9.8775 96.0559,9.8775 90.0389,12.3675"
                    />
                    <path 
                      fill="rgb(29, 31, 37)" 
                      d="M105.3122,88.4608 L105.3122,154.0768 C105.3122,157.1978 108.4592,159.3348 111.3602,158.1848 L185.1662,129.5368 C186.8512,128.8688 187.9562,127.2408 187.9562,125.4288 L187.9562,59.8128 C187.9562,56.6918 184.8092,54.5548 181.9082,55.7048 L108.1022,84.3528 C106.4182,85.0208 105.3122,86.6488 105.3122,88.4608"
                    />
                    <path 
                      fill="rgb(29, 31, 37)" 
                      d="M88.0781,91.8464 L66.1741,102.4224 L63.9501,103.4974 L17.7121,125.6524 C14.7811,127.0664 11.0401,124.9304 11.0401,121.6744 L11.0401,60.0884 C11.0401,58.9104 11.6441,57.8934 12.4541,57.1274 C12.7921,56.7884 13.1751,56.5094 13.5731,56.2884 C14.6781,55.6254 16.2541,55.4484 17.5941,55.9784 L87.7101,83.7594 C91.2741,85.1734 91.5541,90.1674 88.0781,91.8464"
                    />
                  </g>
                </svg>
              </div>
            </div>
          </a>
        </div>

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
