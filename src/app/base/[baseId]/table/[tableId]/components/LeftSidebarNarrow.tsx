'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';

export default function LeftSidebarNarrow() {
  return (
    <div className="w-14 bg-white border-r border-gray-200 flex flex-col items-center py-3 justify-between">
      {/* Top icons */}
      <div
        className="flex flex-col items-center"
        style={{
          width: '39px',
          height: '68px',
          rowGap: '16px',
          flexGrow: 0,
          flexShrink: 0,
          flexBasis: 'auto',
        }}
      >
        {/* Home icon (Airtable logo) */}
        <div className="flex items-center">
          <Link 
            id="appTopBarHomeButton" 
            aria-label="Back to home" 
            className="flex flex-none relative pointer rounded-full border-transparent group" 
            href="/" 
            style={{ width: '24px', height: '24px' }}
            aria-description="Tooltip: Back to home"
          >
            <div className="transition-all duration-[85ms] ease-in flex flex-auto items-center justify-center group-hover:opacity-0" style={{ transform: 'scale(1)' }}>
              <div style={{ position: 'relative', top: '3.5px' }}>
                <svg 
                  width="24" 
                  height="20.4" 
                  viewBox="0 0 200 170" 
                  xmlns="http://www.w3.org/2000/svg" 
                  style={{ shapeRendering: 'geometricPrecision' }}
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
            {/* Back arrow overlay */}
            <div className="transition-all duration-[85ms] ease-in absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path 
                  fillRule="evenodd" 
                  d="M5.64775 2.22725C5.86742 2.44692 5.86742 2.80308 5.64775 3.02275L3.233 5.4375H10.125C10.4357 5.4375 10.6875 5.68934 10.6875 6C10.6875 6.31066 10.4357 6.5625 10.125 6.5625H3.233L5.64775 8.97725C5.86742 9.19692 5.86742 9.55308 5.64775 9.77275C5.42808 9.99242 5.07192 9.99242 4.85225 9.77275L1.47725 6.39775C1.37176 6.29226 1.3125 6.14918 1.3125 6C1.3125 5.85082 1.37176 5.70774 1.47725 5.60225L4.85225 2.22725C5.07192 2.00758 5.42808 2.00758 5.64775 2.22725Z" 
                  fill="rgb(29, 31, 37)"
                />
              </svg>
            </div>
          </Link>
        </div>

        {/* Omni logo */}
        <button
          tabIndex={0}
          role="button"
          aria-label="Open Omni"
          className="flex items-center justify-center rounded hover:bg-gray-100"
          style={{
            width: '28px',
            height: '28px',
            background: 'transparent',
            padding: 0,
          }}
        >
          <img
            src="/brand/omni-logo.png"
            alt="Omni"
            width={36}
            height={36}
            style={{
              display: 'block',
              width: '36px',
              height: '36px',
              transform: 'translate(0px, 3.5px)',
            }}
          />
        </button>
      </div>

      {/* Bottom icons */}
      <div
        className="flex flex-col items-center"
        style={{
          width: '39px',
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 'auto',
          justifyContent: 'flex-end',
          rowGap: '6px', // gap-1.5 equivalent
        }}
      >
        {/* Help icon */}
        <button
          className="flex items-center justify-center rounded-full hover:bg-gray-100"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            flexDirection: 'row-reverse',
            cursor: 'pointer',
            color: 'rgb(29, 31, 37)',
            fontFamily:
              'apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
            fontSize: '13px',
            lineHeight: '18px',
            fontWeight: 400,
            padding: 0,
            margin: 0,
            border: 'none',
            background: 'transparent',
            position: 'relative',
            top: '-15px',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            className="flex-none"
            aria-hidden="true"
            style={{
              shapeRendering: 'geometricPrecision',
              display: 'block',
              color: 'rgb(29, 31, 37)',
            }}
          >
            <use fill="currentColor" href="/icons/icon_definitions.svg#Question" />
          </svg>
        </button>

        {/* Notification icon */}
        <button
          className="flex items-center justify-center rounded-full hover:bg-gray-100"
          style={{
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'rgb(29, 31, 37)',
            fontFamily:
              'apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
            fontSize: '13px',
            lineHeight: '18px',
            fontWeight: 400,
            padding: 0,
            margin: 0,
            border: 'none',
            background: 'transparent',
            borderRadius: '9999px',
            position: 'relative',
            flexShrink: 0,
          }}
          aria-label="Notifications"
        >
          <span
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
            }}
          >
            <span
              style={{
                position: 'relative',
                top: '-9px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '18px',
                height: '18px',
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                aria-hidden="true"
                style={{
                  width: '16px',
                  height: '16px',
                  display: 'block',
                  color: 'rgb(29, 31, 37)',
                  shapeRendering: 'geometricPrecision',
                  cursor: 'pointer',
                  flexBasis: 'auto',
                  flexGrow: 0,
                  flexShrink: 0,
                  fontFamily:
                    'apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
                  fontSize: '13px',
                  fontWeight: 400,
                  lineHeight: '18px',
                  overflow: 'hidden',
                }}
              >
                <use fill="currentColor" href="/icons/icon_definitions.svg#Bell" />
              </svg>
            </span>
          </span>
        </button>

        {/* Profile picture */}
        <button
          className="flex items-center justify-center rounded-full"
          style={{
            width: '28px',
            height: '28px',
            background: '#D97A3A',
            color: 'rgb(255, 255, 255)',
            fontFamily:
              'apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
            fontSize: '13px',
            lineHeight: '18px',
            fontWeight: 400,
            textAlign: 'center',
            padding: 0,
            margin: 0,
            cursor: 'pointer',
            border: 'none',
            position: 'relative',
            top: '-4px',
          }}
          aria-label="Account"
        >
          J
        </button>
      </div>
    </div>
  );
}
