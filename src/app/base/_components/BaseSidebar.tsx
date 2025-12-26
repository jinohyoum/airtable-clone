'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function BaseSidebar() {
  const [starredExpanded, setStarredExpanded] = useState(true);
  const [workspacesExpanded, setWorkspacesExpanded] = useState(false);

  return (
    <div 
      className="overflow-y-auto border-r bg-white"
      style={{ 
        width: '300px',
        height: '100%',
        borderRightColor: 'rgba(0, 0, 0, 0.1)',
        borderRightStyle: 'solid',
        borderRightWidth: '1px',
        paddingLeft: '12px',
        paddingRight: '12px',
        paddingTop: '12px',
        paddingBottom: '12px',
        transition: 'all 0.085s ease-in-out'
      }}
    >
      <nav className="flex flex-col" style={{ height: '100%', minHeight: '579px' }}>
        {/* Main navigation */}
        <div className="flex-auto flex flex-col" style={{ flexGrow: 1, flexShrink: 1 }}>
          {/* Home link */}
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="flex items-center hover:bg-gray-100/50 rounded focus-visible:outline-2 focus-visible:outline-blue-500 no-underline mb-1"
            style={{ 
              paddingLeft: '12px',
              paddingRight: '12px',
              backgroundColor: 'rgb(242, 244, 248)'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 16 16" className="flex-none" style={{ shapeRendering: 'geometricPrecision' }}>
              <use fill="currentColor" href="/icons/icon_definitions.svg#House"></use>
            </svg>
            <h4 className="text-[15px] font-medium leading-[22.5px] truncate text-left flex-1 m-0" style={{ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '8px' }}>
              Home
            </h4>
          </a>

          {/* Starred section */}
          <div className="flex items-center justify-between rounded hover:bg-gray-100/50">
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="w-full text-left focus-visible:outline-2 focus-visible:outline-blue-500 rounded no-underline"
              style={{ paddingLeft: '12px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px' }}
            >
              <h4 className="text-[15px] font-medium leading-[22.5px] m-0">
                <div className="flex items-center">
                  <svg width="20" height="20" viewBox="0 0 16 16" className="flex-none" style={{ shapeRendering: 'geometricPrecision' }}>
                    <use fill="currentColor" href="/icons/icon_definitions.svg#Star"></use>
                  </svg>
                  <div className="text-left flex-1 pl-2">Starred</div>
                </div>
              </h4>
            </a>
            <button
              onClick={(e) => e.preventDefault()}
              className="flex items-center pointer focus-visible:outline-2 focus-visible:outline-blue-500 rounded hover:bg-gray-200/50"
              style={{ 
                padding: '4px',
                margin: '8px',
                width: '24px',
                height: '24px'
              }}
              aria-label={starredExpanded ? "Collapse starred" : "Expand starred"}
            >
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 16 16" 
                className="flex-none transition-transform duration-[85ms] ease-in"
                style={{ 
                  shapeRendering: 'geometricPrecision',
                  transform: starredExpanded ? 'rotate(0deg)' : 'rotate(-90deg)'
                }}
              >
                <use fill="currentColor" href="/icons/icon_definitions.svg#ChevronDown"></use>
              </svg>
            </button>
          </div>

          {/* Starred items region */}
          {starredExpanded && (
            <div className="overflow-y-auto">
              <div className="relative text-left"></div>
              <div className="flex items-center truncate w-full" style={{ paddingLeft: '12px', paddingRight: '12px' }}>
                <div 
                  className="flex items-center border justify-center rounded flex-shrink-0"
                  style={{ 
                    width: '30px', 
                    height: '30px',
                    borderColor: 'rgba(0, 0, 0, 0.1)'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" className="flex-none" style={{ shapeRendering: 'geometricPrecision' }}>
                    <use fill="rgb(151, 154, 160)" href="/icons/icon_definitions.svg#Star"></use>
                  </svg>
                </div>
                <p className="text-[11px] text-gray-500 leading-[13.75px] font-normal text-left whitespace-normal m-0" style={{ marginLeft: '12px', paddingTop: '8px', paddingBottom: '8px' }}>
                  Your starred bases, interfaces, and workspaces will appear here
                </p>
              </div>
            </div>
          )}

          {/* Shared link */}
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="flex items-center hover:bg-gray-100/50 rounded focus-visible:outline-2 focus-visible:outline-blue-500 no-underline mb-1"
            style={{ paddingLeft: '12px', paddingRight: '12px' }}
          >
            <svg width="20" height="20" viewBox="0 0 16 16" className="flex-none" style={{ shapeRendering: 'geometricPrecision' }}>
              <use fill="currentColor" href="/icons/icon_definitions.svg#Share"></use>
            </svg>
            <h4 className="text-[15px] font-medium leading-[22.5px] truncate text-left flex-1 m-0" style={{ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '8px' }}>
              <div className="flex items-center">Shared</div>
            </h4>
          </a>

          {/* Workspaces section */}
          <div className="flex items-center justify-between rounded hover:bg-gray-100/50 mb-2">
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="w-full text-left focus-visible:outline-2 focus-visible:outline-blue-500 rounded no-underline"
              style={{ paddingLeft: '12px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px' }}
            >
              <h4 className="text-[15px] font-medium leading-[22.5px] m-0">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <svg width="20" height="20" viewBox="0 0 16 16" className="flex-none mr-2" style={{ shapeRendering: 'geometricPrecision' }}>
                      <use fill="currentColor" href="/icons/icon_definitions.svg#UsersThree"></use>
                    </svg>
                    Workspaces
                  </div>
                  <button
                    onClick={(e) => e.preventDefault()}
                    className="flex items-center pointer focus-visible:outline-2 focus-visible:outline-blue-500 rounded hover:bg-gray-200/50"
                    style={{ 
                      padding: '4px',
                      marginRight: '-16px'
                    }}
                    aria-label="Create a workspace"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" className="flex-none" style={{ shapeRendering: 'geometricPrecision' }}>
                      <use fill="currentColor" href="/icons/icon_definitions.svg#Plus"></use>
                    </svg>
                  </button>
                </div>
              </h4>
            </a>
            <button
              onClick={(e) => e.preventDefault()}
              className="flex items-center pointer focus-visible:outline-2 focus-visible:outline-blue-500 rounded hover:bg-gray-200/50"
              style={{ 
                padding: '4px',
                margin: '8px',
                width: '24px',
                height: '24px'
              }}
              aria-label={workspacesExpanded ? "Collapse workspaces" : "Expand workspaces"}
            >
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 16 16" 
                className="flex-none transition-transform duration-[85ms] ease-in"
                style={{ 
                  shapeRendering: 'geometricPrecision',
                  transform: workspacesExpanded ? 'rotate(0deg)' : 'rotate(-90deg)'
                }}
              >
                <use fill="currentColor" href="/icons/icon_definitions.svg#ChevronDown"></use>
              </svg>
            </button>
          </div>
        </div>

        {/* Bottom section */}
        <div>
          {/* Divider */}
          <div className="mb-4" style={{ height: '1px', position: 'relative' }}>
            <div style={{ 
              content: '""',
              display: 'block',
              height: '1px',
              backgroundColor: 'rgba(0, 0, 0, 0.1)',
              marginLeft: '12px',
              marginRight: '12px',
              position: 'relative'
            }}></div>
          </div>

          <div>
            {/* Templates and apps */}
            <button onClick={(e) => e.preventDefault()} className="block w-full hover:bg-gray-100/50 rounded focus-visible:outline-2 focus-visible:outline-blue-500 pointer">
              <p className="text-[13px] leading-[19.5px] font-normal flex items-center m-0" style={{ height: '32px', paddingLeft: '8px', paddingRight: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" className="flex-none" style={{ shapeRendering: 'geometricPrecision' }}>
                  <use fill="currentColor" href="/icons/icon_definitions.svg#BookOpen"></use>
                </svg>
                <span className="ml-1">Templates and apps</span>
              </p>
            </button>

            {/* Marketplace */}
            <a 
              href="#" 
              onClick={(e) => e.preventDefault()}
              className="block hover:bg-gray-100/50 rounded focus-visible:outline-2 focus-visible:outline-blue-500 no-underline"
            >
              <p className="text-[13px] leading-[19.5px] font-normal flex items-center m-0" style={{ height: '32px', paddingLeft: '8px', paddingRight: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" className="flex-none" style={{ shapeRendering: 'geometricPrecision' }}>
                  <use fill="currentColor" href="/icons/icon_definitions.svg#ShoppingBagOpen"></use>
                </svg>
                <span className="ml-1">Marketplace</span>
              </p>
            </a>

            {/* Import */}
            <button onClick={(e) => e.preventDefault()} className="block w-full hover:bg-gray-100/50 rounded focus-visible:outline-2 focus-visible:outline-blue-500 pointer">
              <p className="text-[13px] leading-[19.5px] font-normal flex items-center m-0" style={{ height: '32px', paddingLeft: '8px', paddingRight: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" className="flex-none" style={{ shapeRendering: 'geometricPrecision' }}>
                  <use fill="currentColor" href="/icons/icon_definitions.svg#UploadSimple"></use>
                </svg>
                <span className="ml-1">Import</span>
              </p>
            </button>

            {/* Create button */}
            <button
              onClick={(e) => e.preventDefault()}
              className="pointer items-center justify-center border-none text-white font-medium rounded-md focus-visible:outline-2 focus-visible:outline-blue-500 inline-flex w-full"
              style={{
                backgroundColor: 'rgb(22, 110, 225)',
                boxShadow: 'rgba(0, 0, 0, 0.32) 0px 0px 1px 0px, rgba(0, 0, 0, 0.08) 0px 0px 2px 0px, rgba(0, 0, 0, 0.08) 0px 1px 3px 0px',
                height: '32px',
                paddingLeft: '12px',
                paddingRight: '12px',
                marginTop: '16px',
                marginBottom: '8px',
                fontSize: '13px',
                lineHeight: '22px'
              }}
              type="button"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" className="flex-none mr-2" style={{ shapeRendering: 'geometricPrecision' }}>
                <use fill="currentColor" href="/icons/icon_definitions.svg#Plus"></use>
              </svg>
              <span className="truncate select-none">Create</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}
