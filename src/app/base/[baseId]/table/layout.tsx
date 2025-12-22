'use client';

import type { ReactNode } from 'react';


import BulkInsertButton from './[tableId]/components/BulkInsertButton';
import { useParams } from 'next/navigation';
import { useDeferredValue, useMemo, useState, useRef, useEffect } from 'react';
import { api } from '~/trpc/react';
import LeftSidebarNarrow from './[tableId]/components/LeftSidebarNarrow';
import MainContent from './[tableId]/components/MainContent';
import Sidebar from './[tableId]/components/Sidebar';
import TableTabsBar from './[tableId]/components/TableTabsBar';
import TopNav from './[tableId]/components/TopNav';

export default function TableLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const tableId = params?.tableId as string | undefined;
  const utils = api.useUtils();
  const [isInserting, setIsInserting] = useState(false);
  const bulkInsertMutation = api.table.bulkInsertRows.useMutation();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const deferredSearchInput = useDeferredValue(searchInput);
  const search = useMemo(() => {
    const q = deferredSearchInput.trim();
    return q.length > 0 ? q : undefined;
  }, [deferredSearchInput]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchBarRef = useRef<HTMLDivElement>(null);

  // Focus input when search bar opens
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Close search bar when clicking outside
  useEffect(() => {
    if (!isSearchOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchBarRef.current &&
        !searchBarRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest('[aria-label="toggle view search input"]')
      ) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSearchOpen]);

  // Hide antiscroll scrollbars when search is open
  useEffect(() => {
    if (isSearchOpen) {
      document.body.classList.add('search-open');
    } else {
      document.body.classList.remove('search-open');
    }
    return () => {
      document.body.classList.remove('search-open');
    };
  }, [isSearchOpen]);

  // Handle Escape key to close search bar
  useEffect(() => {
    if (!isSearchOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isSearchOpen]);

  const handleBulkInsert = async () => {
    if (!tableId || tableId.startsWith('__creating__')) return;
    
    const totalRows = 100000;
    setIsInserting(true);

    try {
      await bulkInsertMutation.mutateAsync({
        tableId,
        count: totalRows,
      });

      utils.table.getRows.setInfiniteData({ tableId, limit: 500, search }, undefined);
      await utils.table.getRows.invalidate({ tableId, limit: 500, search });
      void utils.table.getRowCount.invalidate({ tableId, search });
    } catch (error) {
      console.error('Bulk insert error:', error);
      alert(`Failed to insert rows: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsInserting(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#FAF8F6]">
      <LeftSidebarNarrow />
      <div className="flex flex-1 flex-col overflow-hidden relative">
        <TopNav />
        <TableTabsBar />
        {/* View bar (spans to the narrow sidebar) */}
        <div
          className="flex flex-shrink-0 items-center border-b border-gray-200 bg-white relative"
          style={{
            height: '47px',
            fontFamily:
              '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
            fontSize: '13px',
            lineHeight: '18px',
            fontWeight: 400,
            color: 'rgb(29, 31, 37)',
            paddingLeft: '8px',
          }}
        >
          {/* Left: sidebar toggle + Grid view */}
          <div
            className="flex flex-auto items-center pl1-and-half pr1"
            style={{
              boxSizing: 'border-box',
              color: 'rgb(29, 31, 37)',
              fontFamily:
                '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
              fontSize: '13px',
              fontWeight: 400,
              height: '32px',
              lineHeight: '18px',
              marginBottom: 0,
              marginLeft: 0,
              marginRight: 0,
              marginTop: 0,
              minHeight: 0,
              minWidth: 0,
              paddingBottom: 0,
              paddingTop: 0,
              userSelect: 'none',
            }}
          >
            {/* Sidebar toggle button */}
            <div
              tabIndex={0}
              role="button"
              className="mr-half flex items-center justify-center focus-visible cursor-pointer"
              aria-label="Close sidebar"
              data-tutorial-selector-id="viewSidebarToggleButton"
              aria-pressed="false"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                e.currentTarget.style.borderRadius = '4px';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                className="flex-none icon"
                style={{ shapeRendering: 'geometricPrecision' }}
              >
                <use fill="currentColor" href="/icons/icon_definitions.svg#List" />
              </svg>
            </div>

            {/* View name button */}
            <h2 className="flex items-center" style={{ marginLeft: '8px' }}>
              <div
                tabIndex={0}
                role="button"
                className="flex items-center pointer colors-background-selected-hover rounded focus-visible px1"
                id="id_4b935699938b1dc90f6d249de25ecfc6"
                aria-expanded="false"
                aria-haspopup="true"
                data-tutorial-selector-id="viewTopBarMenu"
                style={{
                  height: '26px',
                  maxWidth: 'fit-content',
                }}
                aria-description="Tooltip: Grid viewCreated byJin-Oh Youm jinohy6@gmail.comEditingEveryone can edit the view configuration."
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div className="flex items-center min-width-0">
                  <span className="flex-inline flex-none items-center flex-none">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      className="flex-none icon"
                      style={{ shapeRendering: 'geometricPrecision' }}
                    >
                      <use fill="rgb(22, 110, 225)" href="/icons/icon_definitions.svg#GridFeature" />
                    </svg>
                  </span>
                  <span
                    data-testid="viewName"
                    className="strong truncate flex-auto text-size-default ml1 mr1"
                    style={{ maxWidth: '200px' }}
                  >
                    Grid view
                  </span>
                  <div data-testid="More options">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      className="flex-none mt-half"
                      style={{ shapeRendering: 'geometricPrecision' }}
                    >
                      <use fill="currentColor" href="/icons/icon_definitions.svg#ChevronDown" />
                    </svg>
                  </div>
                </div>
              </div>
            </h2>
          </div>

          {/* Right: controls container */}
          <div
            className="flex flex-auto items-center justify-end"
            style={{
              height: '100%',
              paddingRight: '8px',
              marginLeft: '2px',
            }}
          >
            <div
              className="flex items-center flex-auto overflow-hidden"
              style={{ height: '100%' }}
              data-tutorial-selector-id="viewConfigContainer"
            >
              <div
                className="flex items-center grow-1 justify-end"
                style={{ paddingLeft: '8px', paddingRight: '8px' }}
              >
                <div className="flex items-center">
                  {/* Bulk Insert Button */}
                  {tableId && !tableId.startsWith('__creating__') && (
                    <div
                      tabIndex={0}
                      role="button"
                      className="focus-visible mr1"
                      onClick={handleBulkInsert}
                      aria-label="Add 100k rows"
                      aria-disabled={isInserting}
                    >
                      <div
                        className="pointer flex items-center rounded colors-foreground-subtle"
                        data-isactive="false"
                        aria-description="Tooltip: Add 100k rows"
                        style={{
                          paddingLeft: '8px',
                          paddingRight: '8px',
                          paddingTop: '4px',
                          paddingBottom: '4px',
                          opacity: isInserting ? 0.5 : 1,
                          cursor: isInserting ? 'not-allowed' : 'pointer',
                        }}
                        onMouseEnter={(e) => {
                          if (!isInserting) {
                            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        {isInserting ? (
                          <>
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 16 16"
                              className="flex-none animate-spin"
                              style={{ shapeRendering: 'geometricPrecision' }}
                            >
                              <use fill="currentColor" href="/icons/icon_definitions.svg#SpinnerGap" />
                            </svg>
                            <div className="max-width-1 truncate ml-half">Inserting…</div>
                          </>
                        ) : (
                          <div className="max-width-1 truncate">+100k rows</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Hide fields button */}
                  <div className="flex flex-row mr1">
                    <div>
                      <div
                        role="button"
                        aria-label="Hide fields"
                        aria-haspopup="true"
                        aria-expanded="false"
                        className="focus-visible mr1"
                        tabIndex={0}
                      >
                        <div
                          className="pointer flex items-center rounded colors-foreground-subtle"
                          data-isactive="false"
                          aria-description="Tooltip: Hide fields"
                          style={{
                            paddingLeft: '8px',
                            paddingRight: '8px',
                            paddingTop: '4px',
                            paddingBottom: '4px',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            className="flex-none"
                            style={{ shapeRendering: 'geometricPrecision' }}
                          >
                            <use fill="currentColor" href="/icons/icon_definitions.svg#EyeSlash" />
                          </svg>
                          <div className="max-width-1 truncate ml-half">Hide fields</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Filter button */}
                  <div
                    tabIndex={0}
                    role="button"
                    className="collapsed focus-visible"
                    id="id_c7f6290319c67ac93b78bf99c80f47cd"
                    data-tutorial-selector-id="filterButton"
                    aria-label="Filter rows"
                  >
                    <div
                      className="pointer flex items-center rounded colors-foreground-subtle"
                      data-isactive="false"
                      aria-description="Tooltip: Filter"
                      style={{
                        paddingLeft: '8px',
                        paddingRight: '8px',
                        paddingTop: '4px',
                        paddingBottom: '4px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        className="flex-none"
                        style={{ shapeRendering: 'geometricPrecision' }}
                      >
                        <use fill="currentColor" href="/icons/icon_definitions.svg#FunnelSimple" />
                      </svg>
                      <div className="max-width-1 truncate ml-half">
                        <span data-activefiltercount="0">Filter</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Group and Sort buttons */}
                <div className="flex items-center" data-tutorial-selector-id="groupAndSortButtons">
                  {/* Group button */}
                  <div>
                    <div
                      aria-label="Group rows"
                      role="button"
                      aria-haspopup="true"
                      aria-expanded="false"
                      className="collapsed focus-visible mr1"
                      tabIndex={0}
                    >
                      <div
                        className="pointer flex items-center rounded colors-foreground-subtle"
                        data-isactive="false"
                        aria-description="Tooltip: Group"
                        style={{
                          paddingLeft: '8px',
                          paddingRight: '8px',
                          paddingTop: '4px',
                          paddingBottom: '4px',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          className="flex-none"
                          style={{ shapeRendering: 'geometricPrecision' }}
                        >
                          <use fill="currentColor" href="/icons/icon_definitions.svg#Group" />
                        </svg>
                        <div className="max-width-1 truncate ml-half">Group</div>
                      </div>
                    </div>
                  </div>

                  {/* Sort button */}
                  <div>
                    <div
                      aria-label="Sort rows"
                      role="button"
                      aria-haspopup="true"
                      aria-expanded="false"
                      className="focus-visible collapsed mr1"
                      tabIndex={0}
                    >
                      <div
                        className="pointer flex items-center rounded colors-foreground-subtle"
                        data-isactive="false"
                        aria-description="Tooltip: Sort"
                        style={{
                          paddingLeft: '8px',
                          paddingRight: '8px',
                          paddingTop: '4px',
                          paddingBottom: '4px',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          className="flex-none"
                          style={{ shapeRendering: 'geometricPrecision' }}
                        >
                          <use fill="currentColor" href="/icons/icon_definitions.svg#ArrowsDownUp" />
                        </svg>
                        <div className="max-width-1 truncate ml-half">Sort</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Color button */}
                <div
                  tabIndex={0}
                  role="button"
                  className="collapsed focus-visible mr1"
                  id="viwbTwMqnWkLGzJTN-colorConfigButton"
                  aria-label="Row colors"
                >
                  <div
                    className="pointer flex items-center rounded colors-foreground-subtle"
                    data-isactive="false"
                    aria-description="Tooltip: Color"
                    style={{
                      paddingLeft: '8px',
                      paddingRight: '8px',
                      paddingTop: '4px',
                      paddingBottom: '4px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      className="flex-none"
                      style={{ shapeRendering: 'geometricPrecision' }}
                    >
                      <use fill="currentColor" href="/icons/icon_definitions.svg#PaintBucket" />
                    </svg>
                    <div className="max-width-1 truncate ml-half">Color</div>
                  </div>
                </div>

                {/* Row height button */}
                <div>
                  <div
                    aria-label="Row height"
                    role="button"
                    aria-haspopup="true"
                    aria-expanded="false"
                    className="focus-visible mr1"
                    tabIndex={0}
                  >
                    <div
                      className="pointer flex items-center rounded colors-foreground-subtle"
                      aria-description="Tooltip: Row height"
                      style={{
                        paddingLeft: '8px',
                        paddingRight: '8px',
                        paddingTop: '4px',
                        paddingBottom: '4px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        className="flex-none"
                        style={{ shapeRendering: 'geometricPrecision' }}
                      >
                        <use fill="currentColor" href="/icons/icon_definitions.svg#RowHeightSmall" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Share and sync button */}
            <span className="flex items-center mr1">
              <div
                tabIndex={0}
                role="button"
                className="focus-visible"
                aria-label="Share and sync"
                data-testid="share-view-popover-button"
                id="id_410a58ad5c2a51f6701b7e89e38543dc"
                aria-expanded="false"
                aria-haspopup="true"
              >
                <div
                  className="pointer flex items-center rounded colors-foreground-subtle"
                  data-isactive="false"
                  aria-description="Tooltip: Share and sync"
                  style={{
                    paddingLeft: '8px',
                    paddingRight: '8px',
                    paddingTop: '4px',
                    paddingBottom: '4px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    className="flex-none"
                    style={{ shapeRendering: 'geometricPrecision' }}
                  >
                    <use fill="currentColor" href="/icons/icon_definitions.svg#ArrowSquareOut" />
                  </svg>
                  <div className="max-width-1 truncate ml-half">Share and sync</div>
                </div>
              </div>
            </span>

            {/* Search button */}
            <div
              tabIndex={0}
              role="button"
              className="flex items-center justify-center focus-visible cursor-pointer colors-foreground-subtle"
              aria-label="toggle view search input"
              aria-pressed={isSearchOpen}
              aria-description="Tooltip: Find in viewctrlf"
              style={{
                padding: '4px',
              }}
              onClick={() => {
                setIsSearchOpen(!isSearchOpen);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                e.currentTarget.style.borderRadius = '4px';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                className="flex-none icon"
                style={{ shapeRendering: 'geometricPrecision' }}
              >
                <use fill="currentColor" href="/icons/icon_definitions.svg#MagnifyingGlass" />
              </svg>
            </div>

            {/* Search dropdown bar - positioned relative to view bar */}
            {isSearchOpen && (
              <div
                ref={searchBarRef}
                tabIndex={0}
                role="button"
                className="hideOnGridViewDrag mr1 absolute colors-background-default flex flex-column findInView border colors-border-default rounded-big-bottom focus-visible"
                data-testid="find-bar"
                style={{
                  zIndex: 6,
                  width: '370px',
                  borderWidth: '1px 2px 2px',
                  borderTopColor: 'rgba(229, 231, 235, 1)',
                  borderRightColor: 'rgba(0, 0, 0, 0.1)',
                  borderBottomColor: 'rgba(0, 0, 0, 0.1)',
                  borderLeftColor: 'rgba(0, 0, 0, 0.1)',
                  borderStyle: 'solid',
                  borderTopLeftRadius: '0px',
                  borderTopRightRadius: '0px',
                  borderBottomLeftRadius: '6px',
                  borderBottomRightRadius: '6px',
                  backgroundColor: 'rgb(255, 255, 255)',
                  boxSizing: 'border-box',
                  position: 'absolute',
                  top: '100%',
                  right: '8px',
                }}
              >
            <div
              className="flex"
              style={{
                boxSizing: 'border-box',
                color: 'rgb(29, 31, 37)',
                display: 'flex',
                alignItems: 'center',
                fontFamily:
                  '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
                fontSize: '13px',
                fontWeight: 400,
                height: '38px',
                lineHeight: '18px',
                marginBottom: '0px',
                marginLeft: '0px',
                marginRight: '0px',
                marginTop: '0px',
                paddingBottom: '0px',
                paddingLeft: '0px',
                paddingRight: '0px',
                paddingTop: '0px',
                unicodeBidi: 'isolate',
                userSelect: 'none',
                width: '366px',
              }}
            >
              <input
                ref={searchInputRef}
                type="search"
                className="p1 flex-auto css-1uw7fyx"
                placeholder="Find in view..."
                autoComplete="off"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={{
                  border: '2px solid transparent',
                  background: 'transparent',
                  outline: 'none',
                  fontFamily:
                    '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
                  fontSize: '13px',
                  fontWeight: 400,
                  color: 'rgb(29, 31, 37)',
                  padding: '8px',
                  flex: '1 1 auto',
                  boxSizing: 'border-box',
                }}
              />
              <div className="small quieter noevents flex items-center flex-none pr1"></div>
              <button
                className="pointer items-center justify-center border-box text-decoration-none print-color-exact focus-visible rounded-big ignore-baymax-defaults border-none text-white font-weight-strong css-13jexyk shadow-elevation-low shadow-elevation-low-hover px1 button-size-xsmall flex-inline self-center mx-quarter"
                type="button"
                aria-disabled="false"
                style={{
                  alignItems: 'center',
                  alignSelf: 'center',
                  appearance: 'auto',
                  backgroundColor: 'rgb(29, 31, 37)',
                  borderBottomColor: 'rgb(255, 255, 255)',
                  borderBottomLeftRadius: '6px',
                  borderBottomRightRadius: '6px',
                  borderBottomStyle: 'none',
                  borderBottomWidth: '0px',
                  borderImageOutset: 0,
                  borderImageRepeat: 'stretch',
                  borderImageSlice: '100%',
                  borderImageSource: 'none',
                  borderImageWidth: 1,
                  borderLeftColor: 'rgb(255, 255, 255)',
                  borderLeftStyle: 'none',
                  borderLeftWidth: '0px',
                  borderRightColor: 'rgb(255, 255, 255)',
                  borderRightStyle: 'none',
                  borderRightWidth: '0px',
                  borderTopColor: 'rgb(255, 255, 255)',
                  borderTopLeftRadius: '6px',
                  borderTopRightRadius: '6px',
                  borderTopStyle: 'none',
                  borderTopWidth: '0px',
                  boxShadow:
                    'rgba(0, 0, 0, 0.32) 0px 0px 1px 0px, rgba(0, 0, 0, 0.08) 0px 0px 2px 0px, rgba(0, 0, 0, 0.08) 0px 1px 3px 0px',
                  boxSizing: 'border-box',
                  color: 'rgb(255, 255, 255)',
                  cursor: 'pointer',
                  display: 'flex',
                  fill: 'rgb(255, 255, 255)',
                  fontFamily:
                    '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
                  fontFeatureSettings: 'normal',
                  fontKerning: 'auto',
                  fontLanguageOverride: 'normal',
                  fontOpticalSizing: 'auto',
                  fontSize: '11px',
                  fontSizeAdjust: 'none',
                  fontStretch: '100%',
                  fontStyle: 'normal',
                  fontVariantAlternates: 'normal',
                  fontVariantCaps: 'normal',
                  fontVariantEastAsian: 'normal',
                  fontVariantEmoji: 'normal',
                  fontVariantLigatures: 'normal',
                  fontVariantNumeric: 'normal',
                  fontVariantPosition: 'normal',
                  fontVariationSettings: 'normal',
                  fontWeight: 500,
                  height: '24px',
                  justifyContent: 'center',
                  letterSpacing: 'normal',
                  lineHeight: '20px',
                  marginBottom: '0px',
                  marginLeft: '2px',
                  marginRight: '2px',
                  marginTop: '0px',
                  maxWidth: '100%',
                  paddingBlockEnd: '0px',
                  paddingBlockStart: '0px',
                  paddingBottom: '0px',
                  paddingInlineEnd: '8px',
                  paddingInlineStart: '8px',
                  paddingLeft: '8px',
                  paddingRight: '8px',
                  paddingTop: '0px',
                  printColorAdjust: 'exact',
                  textAlign: 'center',
                  textDecorationColor: 'rgb(255, 255, 255)',
                  textDecorationLine: 'none',
                  textDecorationStyle: 'solid',
                  textDecorationThickness: 'auto',
                  textIndent: '0px',
                  textRendering: 'auto',
                  textShadow: 'none',
                  textTransform: 'none',
                  userSelect: 'none',
                  width: '64.2812px',
                  wordSpacing: '0px',
                }}
              >
                <span className="truncate noevents button-text-label no-user-select">Ask Omni</span>
              </button>
              <div
                tabIndex={0}
                role="button"
                className="flex items-center pointer flex-none rounded-big colors-background-inset-control-hover my1 mr1 ml-quarter justify-center focus-visible"
                style={{
                  width: '20px',
                  height: '20px',
                  marginTop: '4px',
                  marginBottom: '4px',
                  marginRight: '8px',
                  marginLeft: '4px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 'none',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSearchOpen(false);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  className="flex-none icon"
                  style={{ shapeRendering: 'geometricPrecision' }}
                >
                  <use fill="currentColor" href="/icons/icon_definitions.svg#X" />
                </svg>
              </div>
            </div>
          </div>
        )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <Sidebar />
          <MainContent isSearchOpen={isSearchOpen} search={search} />
          {/* Keep children mounted for route completeness */}
          {children}
        </div>
      </div>
    </div>
  );
}

