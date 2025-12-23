'use client';

import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '~/trpc/react';
import { getColumnIconName } from './columnIcons';

const ICON_SPRITE = '/icons/icon_definitions.svg?v=04661fff742a9043fa037c751b1c6e66';

type SortDirection = 'asc' | 'desc';

function SpriteIcon({
  name,
  className,
  quietest,
  style,
}: {
  name: string;
  className?: string;
  quietest?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      className={className ?? ''}
      style={{ shapeRendering: 'geometricPrecision', ...style }}
      aria-hidden="true"
      focusable="false"
    >
      <use className={quietest ? 'quietest' : undefined} fill="currentColor" href={`${ICON_SPRITE}#${name}`} />
    </svg>
  );
}

function SwitchPill({ on }: { on: boolean }) {
  return (
    <div
      as="div"
      className="mx1 pill flex flex-none animate border-box darken2 justify-start"
      style={{
        height: 12,
        width: 19.2,
        padding: 2,
        backgroundColor: on ? 'rgb(22, 110, 225)' : 'rgba(0, 0, 0, 0.1)',
        justifyContent: on ? 'flex-end' : 'flex-start',
      }}
    >
      <div
        className="white circle flex-none"
        data-testid={on ? 'switch-on' : 'switch-off'}
        style={{ width: 8, height: 8 }}
      />
    </div>
  );
}

const SortPopover = forwardRef<
  HTMLDivElement,
  {
    tableId: string;
    isOpen: boolean;
    position: { x: number; y: number; maxH: number } | null;
    onRequestClose?: () => void;
  }
>(function SortPopover({ tableId, isOpen, position, onRequestClose }, ref) {
  const { data: tableMeta } = api.table.getTableMeta.useQuery(
    { tableId },
    { enabled: Boolean(isOpen && tableId && !tableId.startsWith('__creating__')) },
  );

  const [query, setQuery] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [panel, setPanel] = useState<'chooseField' | 'config'>('chooseField');
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [direction, setDirection] = useState<SortDirection>('asc');
  const [autoSort, setAutoSort] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setPanel('chooseField');
    setSelectedColumnId(null);
    setDirection('asc');
    setAutoSort(false);
  }, [isOpen]);

  const columns = useMemo(() => tableMeta?.columns ?? [], [tableMeta]);

  const filteredColumns = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return columns;
    return columns.filter((c) => c.name.toLowerCase().includes(q));
  }, [columns, query]);

  const showNoResults = query.trim().length > 0 && filteredColumns.length === 0;

  if (!isOpen || !position) return null;

  const NUDGE_RIGHT_PX = 6;
  const NUDGE_UP_PX = 2;

  const selectedColumn = selectedColumnId ? columns.find((c) => c.id === selectedColumnId) : null;
  const directionLabel = direction === 'asc' ? 'A → Z' : 'Z → A';

  const closePopover = () => {
    onRequestClose?.();
  };

  const goToChooseField = () => {
    setPanel('chooseField');
    setSelectedColumnId(null);
    setDirection('asc');
    setQuery('');
    queueMicrotask(() => inputRef.current?.focus());
  };

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        inset: '0px auto auto 0px',
        zIndex: 10004,
        transform: `translate3d(${position.x + NUDGE_RIGHT_PX}px, ${position.y - NUDGE_UP_PX}px, 0px)`,
      }}
    >
      <div>
        <div>
          <div
            className="xs-max-width-1 baymax nowrap max-width-3"
            style={{ transform: 'translateY(4px)', width: 'min-content' }}
          >
            <div
              className="colors-background-raised-popover rounded shadow-elevation-high overflow-hidden"
              style={{ borderRadius: 3 }}
            >
              <div data-testid="view-config-sort">
                <div style={{ minWidth: 320, maxHeight: position.maxH }}>
                  {panel === 'chooseField' ? (
                    <div className="p1-and-half">
                      <div className="flex justify-between mx1 items-center">
                        <div className="flex items-center">
                          <p
                            className="font-family-default text-size-default text-color-quiet line-height-4 font-weight-strong"
                            style={{ color: 'rgb(97, 102, 112)' }}
                          >
                            Sort by
                          </p>
                          <div
                            tabIndex={0}
                            role="button"
                            className="flex items-center quiet link-unquiet pointer focus-visible colors-foreground-subtle ml-half"
                            aria-label="Learn more about sorting"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // UI parity only for now.
                            }}
                          >
                            <SpriteIcon name="Question" className="flex-none icon" />
                          </div>
                        </div>
                        <div />
                      </div>

                      <hr className="border-bottom-none colors-border-default mx1 my1" />

                      <div
                        tabIndex={-1}
                        role="button"
                        className="flex items-center px1 py-half focus-visible"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          inputRef.current?.focus();
                        }}
                      >
                        <SpriteIcon
                          name="MagnifyingGlass"
                          className="flex-none icon"
                          style={{ color: isInputFocused ? 'rgb(22, 110, 225)' : 'rgb(97, 102, 112)' }}
                        />
                        <input
                          ref={inputRef}
                          className="sort-popover-search-input flex-auto no-outline border-none placeholder-solid-quieter pl1-and-half background-transparent"
                          type="text"
                          placeholder="Find a field"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          onFocus={() => setIsInputFocused(true)}
                          onBlur={() => setIsInputFocused(false)}
                          style={{
                            border: 'none',
                            outline: 'none',
                            boxShadow: 'none',
                            background: 'transparent',
                          }}
                        />

                        {query.trim().length > 0 ? (
                          <div
                            tabIndex={0}
                            role="button"
                            aria-label="Clear search"
                            className="pointer link-unquiet-focusable quieter focus-visible"
                            onMouseDown={(e) => {
                              // Prevent input blur before click (keeps the icon in focused state).
                              e.preventDefault();
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setQuery('');
                              inputRef.current?.focus();
                            }}
                          >
                            <SpriteIcon name="X" className="flex-none icon" />
                          </div>
                        ) : null}
                      </div>

                      <div
                        className="overflow-auto light-scrollbar flex flex-column justify-center"
                        style={{
                          minHeight: 100,
                          maxHeight: 'calc(-380px + 100vh)',
                        }}
                      >
                        {showNoResults ? (
                          <div className="flex items-center justify-center">
                            <span className="quieter">No Results</span>
                          </div>
                        ) : (
                          <div className="flex-auto flex flex-column justify-start">
                            {filteredColumns.map((col) => {
                              const iconName = getColumnIconName(col.type);
                              return (
                                <div
                                  key={col.id}
                                  tabIndex={0}
                                  role="option"
                                  className="flex items-center colors-background-selected-hover px1 py-half text-blue-focus rounded pointer focus-visible"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSelectedColumnId(col.id);
                                    setDirection('asc');
                                    setPanel('config');
                                  }}
                                >
                                  <SpriteIcon name={iconName} className="flex-none flex-none mr1-and-half quiet" />
                                  <span>{col.name}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="p1-and-half">
                        <div className="flex justify-between mx1 items-center">
                          <div className="flex items-center">
                            <p className="font-family-default text-size-default text-color-quiet line-height-4 font-weight-strong">
                              Sort by
                            </p>
                            <div
                              tabIndex={0}
                              role="button"
                              className="flex items-center quiet link-unquiet pointer focus-visible colors-foreground-subtle ml-half"
                              aria-label="Learn more about sorting"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                // UI parity only for now.
                              }}
                            >
                              <SpriteIcon name="Question" className="flex-none icon" />
                            </div>
                          </div>
                          <div />
                        </div>

                        <hr className="border-bottom-none colors-border-default mx1 my1" />

                        <div className="overflow-auto light-scrollbar" style={{ minHeight: 70, maxHeight: 'calc(-380px + 100vh)' }}>
                          <ul className="pt1 flex flex-auto flex-column">
                            <div className="pb1" style={{ opacity: 1 }}>
                              <div className="mx1 relative rounded flex justify-start">
                                <div className="mr1-and-half" style={{ width: 240 }}>
                                  <div className="flex flex-auto">
                                    <div className="flex flex-auto relative baymax">
                                      <div
                                        data-testid="autocomplete-button"
                                        className="flex items-center px1 rounded text-blue-focus pointer link-quiet colors-background-raised-control colors-background-selected-hover width-full border colors-border-default pointer"
                                        role="button"
                                        aria-expanded="false"
                                        tabIndex={0}
                                        style={{ height: 28 }}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          // For now, reuse the "choose field" panel to pick a different column.
                                          setPanel('chooseField');
                                          setQuery('');
                                          queueMicrotask(() => inputRef.current?.focus());
                                        }}
                                      >
                                        <div className="flex-auto truncate left-align">{selectedColumn?.name ?? 'Field'}</div>
                                        <div className="flex-none flex items-center ml-half hide-print">
                                          <SpriteIcon name="ChevronDown" className="flex-none icon" />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="mr1-and-half flex" style={{ width: 120, height: 28 }}>
                                  <div className="flex flex-auto items-stretch selectMenu">
                                    <span
                                      role="button"
                                      aria-haspopup="true"
                                      aria-expanded="false"
                                      className="flex flex-auto truncate left-align pointer focus-container selectMenuButton pointer"
                                      tabIndex={0}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
                                      }}
                                    >
                                      <div
                                        className="flex flex-auto items-center px1 rounded text-blue-focus pointer link-quiet colors-background-raised-control colors-background-selected-hover border colors-border-default"
                                        data-testid="sort-direction-selector"
                                      >
                                        <div className="flex-auto textOverflowEllipsis">
                                          <span className="sortOrderLabel">{directionLabel}</span>
                                        </div>
                                        <SpriteIcon name="ChevronDown" className="flex-none flex-none ml-half" />
                                      </div>
                                    </span>
                                  </div>
                                </div>

                                <div
                                  tabIndex={0}
                                  role="button"
                                  className="flex pointer link-unquiet-focusable text-blue-focus items-center quieter justify-center colors-background-selected-hover rounded focus-visible"
                                  aria-label="Remove sort"
                                  style={{ width: 28, opacity: 0.5 }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    // With only 1 sort row for now, the X returns to the previous dropdown.
                                    goToChooseField();
                                  }}
                                >
                                  <SpriteIcon name="X" className="flex-none icon" />
                                </div>
                              </div>
                            </div>
                          </ul>

                          <div>
                            <div className="flex flex-auto">
                              <div className="flex flex-auto relative baymax">
                                <div
                                  data-testid="autocomplete-button"
                                  className="flex quiet items-center strong link-unquiet-focusable pointer pointer"
                                  role="button"
                                  aria-expanded="false"
                                  tabIndex={0}
                                  style={{ height: 32 }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    // Not implemented yet.
                                  }}
                                >
                                  <div className="truncate flex-auto right-align">
                                    <div className="flex items-center ml1">
                                      <SpriteIcon name="Plus" className="flex-none mr1-and-half quiet" />
                                      <p className="font-family-default text-size-default text-color-default line-height-4 font-weight-default">
                                        Add another sort
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div
                        className="justify-between flex colors-background-subtle border-top colors-border-subtle items-center px-half"
                        style={{ minHeight: 44 }}
                      >
                        <div>
                          <div
                            tabIndex={0}
                            role="button"
                            className="flex link-quiet items-center pointer p1 focus-visible"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setAutoSort((v) => !v);
                            }}
                          >
                            <SwitchPill on={autoSort} />
                            <div>Automatically sort records</div>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center m1">
                            <div
                              tabIndex={0}
                              role="button"
                              className="quiet link-unquiet-focusable pointer focus-visible p-half mr-half"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                closePopover();
                              }}
                            >
                              Cancel
                            </div>

                            <button
                              className="pointer items-center justify-center border-box text-decoration-none print-color-exact focus-visible rounded-big ignore-baymax-defaults border-none text-white font-weight-strong colors-background-primary-control shadow-elevation-low shadow-elevation-low-hover px1 button-size-small flex-inline"
                              type="button"
                              aria-disabled="false"
                              data-testid="sort-once"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                // Not implementing actual sorting yet; close for now.
                                closePopover();
                              }}
                            >
                              <span className="truncate noevents button-text-label no-user-select">Sort</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default SortPopover;


