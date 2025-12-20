'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Clock, Monitor } from 'lucide-react';

export default function TopNav() {
  const [savingCount, setSavingCount] = useState(0);
  const [showSaved, setShowSaved] = useState(false);
  const savedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const onSaving = (e: Event) => {
      const ce = e as CustomEvent<{ count?: number }>;
      const next = ce.detail?.count ?? 0;
      setSavingCount(next);
    };
    window.addEventListener('grid:saving', onSaving as EventListener);
    return () => window.removeEventListener('grid:saving', onSaving as EventListener);
  }, []);

  // When saving finishes, show "All changes saved" briefly (Airtable-like).
  useEffect(() => {
    // If saving resumed, hide the saved indicator and clear any pending timer.
    if (savingCount > 0) {
      setShowSaved(false);
      if (savedTimerRef.current) {
        window.clearTimeout(savedTimerRef.current);
        savedTimerRef.current = null;
      }
      return;
    }

    // savingCount === 0 → show "saved" for ~4.5s
    setShowSaved(true);
    if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
    savedTimerRef.current = window.setTimeout(() => {
      setShowSaved(false);
      savedTimerRef.current = null;
    }, 4500);

    return () => {
      if (savedTimerRef.current) {
        window.clearTimeout(savedTimerRef.current);
        savedTimerRef.current = null;
      }
    };
  }, [savingCount]);

  return (
    <div className="relative h-14 bg-white border-b border-gray-200 flex items-center px-4">
      {/* Left section with logo and base name */}
      <div className="relative z-10 flex items-center gap-3">
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
              style={{ shapeRendering: 'geometricPrecision' }}
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
            title="Untitled Base"
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
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex items-center">
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
      <div className="relative z-10 ml-auto flex items-center justify-end pr2 colors-background-default overflow-hidden">
        {savingCount > 0 && (
          <div
            className="global-status-indicator ignore-visual-diff"
            data-testid="globalStatusIndicator"
            data-global-status="saving"
            aria-live="polite"
          >
            <span className="flex-inline items-center align-items">
              <span className="flex-inline items-center align-items" style={{ width: 16 }}>
                <svg
                  width="10.8"
                  height="10.8"
                  viewBox="0 0 54 54"
                  className="animate-spin-scale animate-infinite"
                  data-testid="loading-spinner"
                  style={{ shapeRendering: 'geometricPrecision' }}
                  aria-hidden="true"
                >
                  <g>
                    <path
                      d="M10.9,48.6c-1.6-1.3-2-3.6-0.7-5.3c1.3-1.6,3.6-2.1,5.3-0.8c0.8,0.5,1.5,1.1,2.4,1.5c7.5,4.1,16.8,2.7,22.8-3.4c1.5-1.5,3.8-1.5,5.3,0c1.4,1.5,1.4,3.9,0,5.3c-8.4,8.5-21.4,10.6-31.8,4.8C13,50.1,11.9,49.3,10.9,48.6z"
                      fill="currentColor"
                      fillOpacity="1"
                    ></path>
                    <path
                      d="M53.6,31.4c-0.3,2.1-2.3,3.5-4.4,3.2c-2.1-0.3-3.4-2.3-3.1-4.4c0.2-1.1,0.2-2.2,0.2-3.3c0-8.7-5.7-16.2-13.7-18.5c-2-0.5-3.2-2.7-2.6-4.7s2.6-3.2,4.7-2.6C46,4.4,53.9,14.9,53.9,27C53.9,28.5,53.8,30,53.6,31.4z"
                      fill="currentColor"
                      fillOpacity="1"
                    ></path>
                    <path
                      d="M16.7,1.9c1.9-0.8,4.1,0.2,4.8,2.2s-0.2,4.2-2.1,5c-7.2,2.9-12,10-12,18.1c0,1.6,0.2,3.2,0.6,4.7c0.5,2-0.7,4.1-2.7,4.6c-2,0.5-4-0.7-4.5-2.8C0.3,31.5,0,29.3,0,27.1C0,15.8,6.7,5.9,16.7,1.9z"
                      fill="currentColor"
                      fillOpacity="1"
                    ></path>
                  </g>
                </svg>
              </span>
              <span className="ml-half">Saving…</span>
            </span>
          </div>
        )}

        {savingCount === 0 && showSaved && (
          <div
            className="global-status-indicator ignore-visual-diff"
            data-testid="globalStatusIndicator"
            data-global-status="saved"
            aria-live="polite"
          >
            <span className="flex-inline items-center align-items">
              <span className="flex-inline items-center align-items hide" style={{ width: 16 }} />
              <span className="ml-half">All changes saved</span>
            </span>
          </div>
        )}

        <div className="flex-inline items-center gap1">
          <div className="flex-none flex items-center gap1">
            <div
              tabIndex={0}
              role="button"
              className="flex items-baseline justify-center pointer px1-and-half pill focus-visible mx1 nowrap darken1 colors-foreground-default css-1amw26v"
              aria-label="Trial status"
            >
              Trial: 11 days left
            </div>
            <button className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium">
              <Monitor className="w-4 h-4" />
              <span>Launch</span>
            </button>
            <button
              className="px-4 py-1.5 text-white rounded text-sm font-medium"
              style={{ backgroundColor: 'rgb(4, 138, 14)' }}
            >
              Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
