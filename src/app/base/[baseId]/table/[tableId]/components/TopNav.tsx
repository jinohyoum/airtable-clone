'use client';

import { ChevronDown, Clock, Monitor } from 'lucide-react';

export default function TopNav() {
  return (
    <div className="h-14 bg-white border-b border-gray-200 flex items-center px-4">
      {/* Left section with logo and base name */}
      <div className="flex items-center gap-3">
        {/* Logo */}
        <div 
          data-testid="universal-top-nav-icon-background" 
          className="flex shrink-none items-center justify-center rounded-big" 
          style={{ width: '32px', height: '32px', backgroundColor: 'rgb(4, 138, 14)', border: 'none' }}
        >
          <div style={{ position: 'relative' }}>
            <svg 
              width="24" 
              height="20.4" 
              viewBox="0 0 200 170" 
              xmlns="http://www.w3.org/2000/svg" 
              style={{ shapeRendering: 'geometricprecision' }}
            >
              <g>
                <path 
                  fill="hsla(0, 0%, 100%, 0.95)" 
                  d="M90.0389,12.3675 L24.0799,39.6605 C20.4119,41.1785 20.4499,46.3885 24.1409,47.8515 L90.3759,74.1175 C96.1959,76.4255 102.6769,76.4255 108.4959,74.1175 L174.7319,47.8515 C178.4219,46.3885 178.4609,41.1785 174.7919,39.6605 L108.8339,12.3675 C102.8159,9.8775 96.0559,9.8775 90.0389,12.3675"
                />
                <path 
                  fill="hsla(0, 0%, 100%, 0.95)" 
                  d="M105.3122,88.4608 L105.3122,154.0768 C105.3122,157.1978 108.4592,159.3348 111.3602,158.1848 L185.1662,129.5368 C186.8512,128.8688 187.9562,127.2408 187.9562,125.4288 L187.9562,59.8128 C187.9562,56.6918 184.8092,54.5548 181.9082,55.7048 L108.1022,84.3528 C106.4182,85.0208 105.3122,86.6488 105.3122,88.4608"
                />
                <path 
                  fill="hsla(0, 0%, 100%, 0.95)" 
                  d="M88.0781,91.8464 L66.1741,102.4224 L63.9501,103.4974 L17.7121,125.6524 C14.7811,127.0664 11.0401,124.9304 11.0401,121.6744 L11.0401,60.0884 C11.0401,58.9104 11.6441,57.8934 12.4541,57.1274 C12.7921,56.7884 13.1751,56.5094 13.5731,56.2884 C14.6781,55.6254 16.2541,55.4484 17.5941,55.9784 L87.7101,83.7594 C91.2741,85.1734 91.5541,90.1674 88.0781,91.8464"
                />
              </g>
            </svg>
          </div>
        </div>

        {/* Base name dropdown */}
        <div className="flex items-center min-width-0" style={{ maxWidth: '480px' }}>
          <div 
            tabIndex={0} 
            role="button" 
            className="flex items-center huge pointer line-height-3 focus-visible-current-color rounded css-w1u7fo focus-visible"
            aria-label="Open base settings menu"
            data-tutorial-selector-id="openBaseMenuButton"
            style={{ minWidth: '0px', flex: '0 1 auto' }}
            aria-description="Tooltip: Untitled Base"
          >
            <div 
              className="truncate font-family-display-updated heading-size-small strongest" 
              style={{ 
                minWidth: '0px', 
                lineHeight: '24px', 
                flex: '0 1 auto',
                color: 'rgb(29, 31, 37)',
                fontSize: '17px',
                fontWeight: '675',
                letterSpacing: '-0.16px',
                fontFamily: '"Inter Display", -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"'
              }}
            >
              Untitled Base
            </div>
            <ChevronDown className="w-4 h-4 flex-none ml-half" />
          </div>
        </div>
      </div>

      {/* Center tabs - positioned in the center */}
      <div className="flex-1 flex justify-center">
        <ul 
          data-tutorial-selector-id="appTopBarNavigationItems" 
          className="relative flex items-stretch justify-center gap2 px1 colors-background-default"
        >
          <li>
            <a 
              aria-current="page" 
              className="relative flex height-full items-center" 
              data-tutorial-selector-id="data"
            >
              <p className="font-family-default text-size-default line-height-4 font-weight-strong py2 colors-foreground-default">
                Data
              </p>
              <div 
                className="absolute right-0 left-0 animate green" 
                style={{ bottom: '-1px', height: '2px', backgroundColor: 'rgb(4, 138, 14)' }}
              />
            </a>
          </li>
          <li>
            <a 
              className="relative flex height-full items-center" 
              data-tutorial-selector-id="automations"
            >
              <p className="font-family-default text-size-default line-height-4 font-weight-strong py2 colors-foreground-subtle colors-foreground-default-hover">
                Automations
              </p>
              <div 
                className="absolute right-0 left-0 animate green" 
                style={{ bottom: '-1px', height: '0px' }}
              />
            </a>
          </li>
          <li>
            <a 
              className="relative flex height-full items-center" 
              data-tutorial-selector-id="interfaces"
            >
              <p className="font-family-default text-size-default line-height-4 font-weight-strong py2 colors-foreground-subtle colors-foreground-default-hover">
                Interfaces
              </p>
              <div 
                className="absolute right-0 left-0 animate green" 
                style={{ bottom: '-1px', height: '0px' }}
              />
            </a>
          </li>
          <li>
            <a 
              className="relative flex height-full items-center" 
              data-tutorial-selector-id="forms"
            >
              <p className="font-family-default text-size-default line-height-4 font-weight-strong py2 colors-foreground-subtle colors-foreground-default-hover">
                Forms
              </p>
              <div 
                className="absolute right-0 left-0 animate green" 
                style={{ bottom: '-1px', height: '0px' }}
              />
            </a>
          </li>
        </ul>
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
        <button className="px-4 py-1.5 text-white rounded text-sm font-medium" style={{ backgroundColor: 'rgb(4, 138, 14)' }}>
          Share
        </button>
      </div>
    </div>
  );
}
