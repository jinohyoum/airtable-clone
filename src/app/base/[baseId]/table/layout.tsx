'use client';

import type { ReactNode } from 'react';


import BulkInsertButton from './[tableId]/components/BulkInsertButton';
import { useParams } from 'next/navigation';
import { useState } from 'react';
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

  const handleBulkInsert = async () => {
    if (!tableId || tableId.startsWith('__creating__')) return;
    
    const totalRows = 100000;
    setIsInserting(true);

    try {
      await bulkInsertMutation.mutateAsync({
        tableId,
        count: totalRows,
      });

      utils.table.getRows.setInfiniteData({ tableId, limit: 500 }, undefined);
      await utils.table.getRows.invalidate({ tableId, limit: 500 });
      void utils.table.getRowCount.invalidate({ tableId });
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
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav />
        <TableTabsBar />
        {/* View bar (spans to the narrow sidebar) */}
        <div
          className="flex flex-shrink-0 items-center border-b border-gray-200 bg-white"
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
              aria-pressed="false"
              aria-description="Tooltip: Find in viewctrlf"
              style={{
                padding: '4px',
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
          </div>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <Sidebar />
          <MainContent />
          {/* Keep children mounted for route completeness */}
          {children}
        </div>
      </div>
    </div>
  );
}

