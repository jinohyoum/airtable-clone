'use client';

import { Plus, Grid3x3, Search, MoreHorizontal, GripVertical } from 'lucide-react';
import { useState } from 'react';

export default function Sidebar() {
  const [width, setWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(480, startWidth + (e.clientX - startX)));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <nav 
      className="relative overflow-hidden hide-print border-r border-gray-200" 
      style={{ 
        width: `${width}px`,
        transition: isResizing ? 'none' : 'width 200ms ease-in',
        backgroundColor: 'white'
      }}
    >
      <div 
        className="height-full flex flex-col border-box py1-and-quarter px1"
        style={{ width: `${width}px`, backgroundColor: 'white' }}
      >
        {/* Top section with Create button and search */}
        <div className="flex-none flex flex-col justify-start pb1">
          {/* Create new button */}
          <button
            className="pointer items-center justify-center border-box text-decoration-none focus-visible rounded-big border-none colors-foreground-default colors-background-selected-hover px1-and-half button-size-default flex width-full pl1-and-half sidebar-button"
            type="button"
            aria-disabled="false"
            aria-haspopup="true"
            aria-expanded="false"
            style={{ justifyContent: 'flex-start', backgroundColor: 'white' }}
          >
            <Plus className="w-4 h-4 flex-none mr1" />
            <span className="truncate noevents button-text-label no-user-select sidebar-text">
              Create new...
            </span>
          </button>

          {/* Search input */}
          <div className="mt-half">
            <div className="relative">
              <div style={{ width: '100%' }}>
                <div className="flex items-center relative">
                  <input
                    type="text"
                    className="ignore-baymax-defaults width-full sidebar-search-input sidebar-text"
                    placeholder="Find a view"
                    aria-label="Find a view"
                    defaultValue=""
                    style={{
                      paddingLeft: '32px',
                      paddingRight: '8px',
                      paddingTop: '6px',
                      paddingBottom: '6px',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '13px',
                      outline: 'none',
                      backgroundColor: 'white',
                    }}
                  />
                  <Search 
                    className="w-3.5 h-3.5 flex-none absolute text-gray-500" 
                    style={{ left: '8px' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* View list section */}
        <div className="flex-auto overflowy-auto overflowx-hidden light-scrollbar">
          <div className="height-full">
            <div className="colors-background-default events relative flex flex-col height-full width-full">
              <div className="flex flex-col flex-auto width-full" style={{ minHeight: '144px' }}>
                <div className="relative flex-auto">
                  <ul role="listbox" className="css-bi2s67">
                    {/* Grid view item - selected */}
                    <li
                      role="option"
                      aria-selected="true"
                      className="rounded pointer flex relative justify-center flex-col pt1 pb1 px1-and-half sidebar-view-item-selected"
                      style={{
                        backgroundColor: 'rgb(242, 244, 248)',
                      }}
                    >
                      <div className="flex items-center">
                        <div className="flex-auto flex items-center">
                          <span className="flex-inline flex-none items-center mr1">
                            <Grid3x3 
                              className="w-4 h-4 flex-none icon" 
                              style={{ color: 'rgb(22, 110, 225)' }}
                            />
                          </span>
                          <span className="font-family-default text-size-default line-height-3 font-weight-strong truncate sidebar-text" style={{ color: 'rgb(29, 31, 37)' }}>
                            Grid view
                          </span>
                        </div>
                        <div
                          tabIndex={0}
                          role="button"
                          className="flex items-center justify-center mr-half focus-visible visually-hidden solid"
                          aria-label="Menu"
                          aria-expanded="false"
                          aria-haspopup="true"
                        >
                          <MoreHorizontal className="w-4 h-4 colors-foreground-subtle" />
                        </div>
                        <div
                          tabIndex={0}
                          role="button"
                          draggable="false"
                          className="visually-hidden solid dragHandle flex items-center flex-none focus-visible quieter link-unquiet"
                          style={{ marginRight: '4px' }}
                        >
                          <GripVertical className="w-4 h-4 flex-none icon" />
                        </div>
                      </div>
                      <span
                        className="font-family-default text-size-small text-color-quieter line-height-4 font-weight-default truncate"
                        style={{ marginLeft: '24px' }}
                      ></span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resize handle */}
      <div
        tabIndex={0}
        role="separator"
        className="absolute top-0 right-0 bottom-0 colors-background-primary-control-hover cursor-col-resize background-transparent focus-visible"
        data-testid="universal-left-nav-resize-handle"
        style={{ width: '3px' }}
        onMouseDown={handleMouseDown}
      />
    </nav>
  );
}
