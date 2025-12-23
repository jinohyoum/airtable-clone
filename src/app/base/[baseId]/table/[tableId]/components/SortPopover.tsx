'use client';

import { forwardRef, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { api } from '~/trpc/react';
import { getColumnIconName } from './columnIcons';

const ICON_SPRITE = '/icons/icon_definitions.svg?v=04661fff742a9043fa037c751b1c6e66';
const SORT_POPOVER_W = 428;

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
    sortRules: Array<{ columnId: string; direction: SortDirection }>;
    onChangeSortRules: (next: Array<{ columnId: string; direction: SortDirection }>) => void;
    onDraftRulesChange?: (draft: Array<{ columnId: string; direction: SortDirection }>) => void;
    onRequestClose?: () => void;
  }
>(function SortPopover(
  { tableId, isOpen, position, sortRules, onChangeSortRules, onDraftRulesChange, onRequestClose },
  ref,
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Keep forwardRef behavior (layout.tsx uses this for outside-click detection)
  // Use a callback ref so the parent ref is set immediately on mount (not after an effect).
  const setRootNode = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      if (!ref) return;
      if (typeof ref === 'function') {
        ref(node);
        return;
      }
      (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [ref],
  );

  const { data: tableMeta } = api.table.getTableMeta.useQuery(
    { tableId },
    { enabled: Boolean(isOpen && tableId && !tableId.startsWith('__creating__')) },
  );

  // Draft rules: stage edits while the popover is open; commit only when clicking "Sort".
  const [draftRules, setDraftRules] = useState(sortRules);

  // Let the toolbar reflect how many sorts are configured *while editing*,
  // even before the user clicks "Sort" to commit.
  useEffect(() => {
    if (!isOpen) return;
    onDraftRulesChange?.(draftRules);
  }, [draftRules, isOpen, onDraftRulesChange]);

  const [query, setQuery] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [panel, setPanel] = useState<'chooseField' | 'config'>('chooseField');
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [autoSort, setAutoSort] = useState(false);

  const [isAddSortMenuOpen, setIsAddSortMenuOpen] = useState(false);
  const [addSortQuery, setAddSortQuery] = useState('');
  const addSortInputRef = useRef<HTMLInputElement | null>(null);
  const addSortMenuRef = useRef<HTMLDivElement | null>(null);
  const addAnotherSortButtonRef = useRef<HTMLDivElement | null>(null);
  const [addSortMenuPos, setAddSortMenuPos] = useState<{ x: number; y: number } | null>(null);
  const addSortListboxId = useId();

  useEffect(() => {
    if (!isOpen) return;
    setDraftRules(sortRules);
    setQuery('');
    setPanel(sortRules.length > 0 ? 'config' : 'chooseField');
    setEditingRuleIndex(null);
    setAutoSort(false);
    setIsAddSortMenuOpen(false);
    setAddSortQuery('');
    setAddSortMenuPos(null);
  }, [isOpen, sortRules.length]);

  const columns = useMemo(() => tableMeta?.columns ?? [], [tableMeta]);

  const filteredColumns = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return columns;
    return columns.filter((c) => c.name.toLowerCase().includes(q));
  }, [columns, query]);

  const showNoResults = query.trim().length > 0 && filteredColumns.length === 0;

  const usedColumnIds = useMemo(() => new Set(draftRules.map((r) => r.columnId)), [draftRules]);

  const filteredColumnsForAddSort = useMemo(() => {
    const q = addSortQuery.trim().toLowerCase();
    const base = q ? columns.filter((c) => c.name.toLowerCase().includes(q)) : columns;
    // Only show columns not already used by existing sort rules.
    return base.filter((c) => !usedColumnIds.has(c.id));
  }, [columns, addSortQuery, usedColumnIds]);

  const NUDGE_RIGHT_PX = 6;
  const NUDGE_UP_PX = 2;

  const columnsById = useMemo(() => new Map(columns.map((c) => [c.id, c] as const)), [columns]);

  const closePopover = () => {
    onRequestClose?.();
  };

  const cancelAndClose = () => {
    setDraftRules(sortRules);
    closePopover();
  };

  const commitAndClose = () => {
    onChangeSortRules(draftRules);
    closePopover();
  };

  const goToChooseField = () => {
    setPanel('chooseField');
    setQuery('');
    setEditingRuleIndex(null);
    setIsAddSortMenuOpen(false);
    setAddSortQuery('');
    setAddSortMenuPos(null);
    queueMicrotask(() => inputRef.current?.focus());
  };

  const openAddSortMenuUnderButton = () => {
    const btn = addAnotherSortButtonRef.current;
    const root = rootRef.current;
    if (!btn || !root) return;

    const btnRect = btn.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();

    // Convert viewport coords -> popover-local coords (so the menu stays inside sortPopoverRef DOM)
    const x = 0; // Align left edge with the main popover so the top-right corner matches across panels.
    const y = Math.round(btnRect.bottom - rootRect.top);

    // Keep within viewport horizontally (matches Airtable-ish behavior)
    const MENU_W = SORT_POPOVER_W;
    const globalLeft = rootRect.left + x;
    const overflowRight = globalLeft + MENU_W - (window.innerWidth - 8);
    if (overflowRight > 0) {
      // If the whole sort popover is already clamped to the viewport, this should rarely happen,
      // but keep a safety clamp anyway.
      setAddSortMenuPos({ x: Math.max(8 - rootRect.left, x - overflowRight), y });
    } else {
      setAddSortMenuPos({ x, y });
    }

    setIsAddSortMenuOpen(true);
    setAddSortQuery('');
    queueMicrotask(() => addSortInputRef.current?.focus());
  };

  // Close nested menu when clicking elsewhere *inside* the sort popover.
  useEffect(() => {
    if (!isAddSortMenuOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      // If click isn't even in the sort popover, layout.tsx will close it; nothing to do here.
      if (!rootRef.current?.contains(t)) return;
      if (addSortMenuRef.current?.contains(t)) return;
      if (addAnotherSortButtonRef.current?.contains(t)) return;
      setIsAddSortMenuOpen(false);
    };

    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    return () => window.removeEventListener('pointerdown', onPointerDown, { capture: true } as never);
  }, [isAddSortMenuOpen]);

  // IMPORTANT: Keep this guard *after* all hooks to avoid hook-order mismatches when opening/closing.
  if (!isOpen || !position) return null;

  return (
    <div
      ref={setRootNode}
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
            style={{ transform: 'translateY(4px)', width: SORT_POPOVER_W }}
          >
            <div
              className="colors-background-raised-popover rounded shadow-elevation-high overflow-hidden"
              style={{ borderRadius: 3 }}
            >
              <div data-testid="view-config-sort">
                <div style={{ width: SORT_POPOVER_W, maxHeight: position.maxH }}>
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
                                    setDraftRules((prev) => {
                                      // If editing a specific row, update it; otherwise create/replace the first rule.
                                      const idx = editingRuleIndex ?? 0;
                                      const next = prev.length
                                        ? [...prev]
                                        : [{ columnId: col.id, direction: 'asc' as const }];
                                      if (prev.length === 0) return next;
                                      if (idx >= next.length) {
                                        next.push({ columnId: col.id, direction: 'asc' });
                                      } else {
                                        const cur = next[idx] ?? { columnId: col.id, direction: 'asc' as const };
                                        next[idx] = { ...cur, columnId: col.id };
                                      }
                                      return next;
                                    });
                                    setEditingRuleIndex(null);
                                    setPanel('config');
                                    setIsAddSortMenuOpen(false);
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
                            {draftRules.length === 0 ? null : (
                              <div className="pb1" style={{ opacity: 1 }}>
                                {draftRules.map((rule, idx) => {
                                  const col = columnsById.get(rule.columnId);
                                  const directionLabel = rule.direction === 'asc' ? 'A → Z' : 'Z → A';
                                  return (
                                    <div key={`${rule.columnId}-${idx}`} className="mx1 relative rounded flex justify-start mb-half">
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
                                                // Reuse the choose-field panel to pick a different column for this row.
                                                setEditingRuleIndex(idx);
                                                setPanel('chooseField');
                                                setQuery('');
                                                queueMicrotask(() => inputRef.current?.focus());
                                              }}
                                            >
                                              <div className="flex-auto truncate left-align">{col?.name ?? 'Field'}</div>
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
                                              const next = [...draftRules];
                                              const cur = next[idx];
                                              if (!cur) return;
                                              next[idx] = { ...cur, direction: cur.direction === 'asc' ? 'desc' : 'asc' };
                                              setDraftRules(next);
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
                                          const next = draftRules.filter((_, i) => i !== idx);
                                          setDraftRules(next);
                                          if (next.length === 0) {
                                            // Mirror Airtable: removing last sort returns to choose-field.
                                            // Also clear committed sortRules immediately so column highlighting disappears.
                                            onChangeSortRules([]);
                                            queueMicrotask(() => goToChooseField());
                                          }
                                        }}
                                      >
                                        <SpriteIcon name="X" className="flex-none icon" />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
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
                                  ref={addAnotherSortButtonRef}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openAddSortMenuUnderButton();
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
                                cancelAndClose();
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
                                commitAndClose();
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

      {/* Nested "Add another sort" field picker (must appear under the "+ Add another sort" button) */}
      {panel === 'config' && isAddSortMenuOpen && addSortMenuPos ? (
        <div
          ref={addSortMenuRef}
          style={{
            position: 'absolute',
            top: addSortMenuPos.y,
            left: addSortMenuPos.x,
            zIndex: 10004,
            minWidth: 428,
          }}
        >
          <div>
            <span data-focus-scope-start="true" hidden />
            <div>
              <div className="colors-background-raised-popover baymax preventGridDeselect rounded stroked1">
                <div className="flex flex-auto rounded" style={{ minHeight: 32 }}>
                  <input
                    ref={addSortInputRef}
                    autoComplete="false"
                    className="css-1uw7fyx background-transparent p1 flex-auto"
                    placeholder="Find a field"
                    type="search"
                    role="combobox"
                    aria-autocomplete="none"
                    aria-expanded="true"
                    aria-controls={`${addSortListboxId}-listbox`}
                    aria-label="Find a field"
                    value={addSortQuery}
                    onChange={(e) => setAddSortQuery(e.target.value)}
                    style={{ border: 0, height: 32 }}
                  />
                </div>
                <ul
                  id={`${addSortListboxId}-listbox`}
                  role="listbox"
                  className="overflow-auto light-scrollbar suggestionRowsContainerSelector relative"
                  style={{
                    maxHeight: 220,
                    maxWidth: 450,
                    position: 'relative',
                    width: 428,
                  }}
                >
                  {filteredColumnsForAddSort.map((col, idx) => {
                    const iconName = getColumnIconName(col.type);
                    const iconStyle =
                      iconName.toLowerCase().includes('ai') ? ({ ['--colors-foreground-accent-ai']: 'rgb(4, 138, 14)' } as React.CSSProperties) : undefined;
                    return (
                      <li
                        key={col.id}
                        id={`${addSortListboxId}-${idx}`}
                        role="option"
                        aria-disabled="false"
                        className="p1 flex items-center overflow-hidden pointer"
                        onMouseDown={(e) => {
                          // Keep focus in the input (prevents blur before click)
                          e.preventDefault();
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          // Add a new sort row (append) without affecting existing rows.
                          if (draftRules.some((r) => r.columnId === col.id)) return;
                          setDraftRules([...draftRules, { columnId: col.id, direction: 'asc' }]);
                          setIsAddSortMenuOpen(false);
                        }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          className="flex-none flex-none mr-half"
                          style={{ shapeRendering: 'geometricPrecision', ...(iconStyle ?? {}) }}
                        >
                          <use fill="currentColor" href={`${ICON_SPRITE}#${iconName}`} />
                        </svg>
                        <div>{col.name}</div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            <span data-focus-scope-end="true" hidden />
          </div>
        </div>
      ) : null}
    </div>
  );
});

export default SortPopover;


