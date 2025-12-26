'use client';

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ViewConfigDialog from './ViewConfigDialog';

const ICON_SPRITE = '/icons/icon_definitions.svg?v=04661fff742a9043fa037c751b1c6e66';

function SpriteIcon({
  name,
  width,
  height,
  className,
  fill,
}: {
  name: string;
  width: number;
  height: number;
  className?: string;
  fill?: string;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 16 16"
      className={className ?? ''}
      style={{ shapeRendering: 'geometricPrecision' }}
      aria-hidden="true"
      focusable="false"
    >
      <use fill={fill ?? 'currentColor'} href={`${ICON_SPRITE}#${name}`} />
    </svg>
  );
}

type ViewListItem = {
  id: string;
  name: string;
  type: 'grid';
  // Placeholder for future DB-backed view configs.
  // These are not yet wired into the grid query layer.
  filters: unknown[];
  sortRules: unknown[];
  hiddenColumnIds: string[];
};

function SortableViewRow({
  view,
  selected,
  showDragHandle,
  onSelect,
}: {
  view: ViewListItem;
  selected: boolean;
  showDragHandle: boolean;
  onSelect: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
  } = useSortable({ id: view.id, disabled: !showDragHandle });

  const [isHovered, setIsHovered] = useState(false);

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    backgroundColor: selected ? 'rgba(0, 0, 0, 0.05)' : isHovered ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
    borderRadius: '3px',
    boxSizing: 'border-box',
    height: '32.25px',
  };

  return (
    <li
      ref={setNodeRef}
      role="option"
      aria-selected={selected}
      className={`rounded pointer flex relative justify-center flex-column pt1 pb1 px1-and-half width-full ${
        selected ? 'sidebar-view-item-selected' : ''
      }`}
      style={style}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect();
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center">
        <div className="flex-auto flex items-center">
          <span className="flex-inline flex-none items-center mr1">
            <span className="flex-none icon" style={{ color: 'rgb(22, 110, 225)', display: 'flex' }}>
              <SpriteIcon name="GridFeature" width={16} height={16} className="flex-none icon" />
            </span>
          </span>
          <span
            className="font-family-default text-size-default text-color-default line-height-3 font-weight-strong truncate sidebar-text"
            style={{ color: 'rgb(29, 31, 37)' }}
          >
            {view.name}
          </span>
        </div>

        <div
          tabIndex={0}
          role="button"
          className="flex items-center justify-center mr-half focus-visible visually-hidden solid"
          aria-label="Menu"
          aria-expanded="false"
          aria-haspopup="true"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <SpriteIcon name="Overflow" width={16} height={16} className="flex-none colors-foreground-subtle" />
        </div>

        <div
          ref={setActivatorNodeRef}
          draggable="false"
          className="visually-hidden solid dragHandle flex items-center flex-none focus-visible quieter link-unquiet"
          style={{ marginRight: '4px' }}
          {...attributes}
          {...listeners}
          onClick={(e) => {
            // Prevent the handle click from selecting the view.
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <SpriteIcon name="DotsSixVertical" width={16} height={16} className="flex-none icon" />
        </div>
      </div>

      <span
        className="font-family-default text-size-small text-color-quieter line-height-4 font-weight-default truncate"
        style={{ marginLeft: '24px' }}
      ></span>
    </li>
  );
}

export default function Sidebar({
  onRequestResetViewConfig,
}: {
  onRequestResetViewConfig?: () => void;
}) {
  const [width, setWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);

  const createButtonRef = useRef<HTMLButtonElement | null>(null);
  const createMenuPopoverRef = useRef<HTMLDivElement | null>(null);
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [createMenuPos, setCreateMenuPos] = useState<
    { x: number; y: number; maxH: number; maxW: number } | null
  >(null);

  // View config dialog state
  const [isViewConfigDialogOpen, setIsViewConfigDialogOpen] = useState(false);
  const [viewConfigDialogPos, setViewConfigDialogPos] = useState({ x: 0, y: 0 });
  const [defaultViewName, setDefaultViewName] = useState('Grid');

  // Views aren't persisted yet (server router not implemented).
  // Keep the sidebar UI data-driven so it can be wired to DB-backed views later.
  const [views, setViews] = useState<ViewListItem[]>(() => [
    {
      id: 'grid',
      name: 'Grid view',
      type: 'grid',
      filters: [],
      sortRules: [],
      hiddenColumnIds: [],
    },
  ]);
  const [selectedViewId, setSelectedViewId] = useState<string>('grid');

  // Function to calculate the next default view name
  const calculateNextViewName = () => {
    const gridCount = views.filter((v) => v.type === 'grid').length;
    if (gridCount === 0) return 'Grid';
    if (gridCount === 1) return 'Grid 2';
    return `Grid ${gridCount + 1}`;
  };

  // Handle opening the view config dialog
  const openViewConfigDialog = () => {
    const nextName = calculateNextViewName();
    setDefaultViewName(nextName);
    
    // Use the same position as the create menu
    if (createMenuPos) {
      setViewConfigDialogPos({ x: createMenuPos.x, y: createMenuPos.y });
    }
    
    setIsViewConfigDialogOpen(true);
    setIsCreateMenuOpen(false);
  };

  const createNewGridView = (name: string) => {
    const newId =
      typeof crypto !== 'undefined' &&
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      typeof (crypto as unknown as { randomUUID?: () => string }).randomUUID === 'function'
        ? (crypto as unknown as { randomUUID: () => string }).randomUUID()
        : `grid-${Date.now()}`;

    setViews((prev) => [
      ...prev,
      {
        id: newId,
        name,
        type: 'grid',
        filters: [],
        sortRules: [],
        hiddenColumnIds: [],
      },
    ]);

    setSelectedViewId(newId);
    setIsViewConfigDialogOpen(false);
    onRequestResetViewConfig?.();
  };

  const showDragHandle = views.length > 1;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const viewIds = useMemo(() => views.map((v) => v.id), [views]);

  // Keep popover position in sync when open.
  useEffect(() => {
    if (!isCreateMenuOpen) return;

    const compute = () => {
      const btn = createButtonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const menuW = 240;
      const x = Math.min(window.innerWidth - menuW - 8, rect.right + 8);
      const y = Math.min(window.innerHeight - 80, rect.top);
      setCreateMenuPos({
        x,
        y,
        maxH: Math.max(120, window.innerHeight - y - 16),
        maxW: Math.max(240, window.innerWidth - x - 16),
      });
    };

    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [isCreateMenuOpen]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!isCreateMenuOpen) return;

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      const pop = createMenuPopoverRef.current;
      const btn = createButtonRef.current;
      if (pop?.contains(target)) return;
      if (btn?.contains(target)) return;
      setIsCreateMenuOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      setIsCreateMenuOpen(false);
      createButtonRef.current?.focus();
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isCreateMenuOpen]);

  // Close view config dialog on outside click / Escape.
  useEffect(() => {
    if (!isViewConfigDialogOpen) return;

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      // Check if click is inside the dialog
      const dialog = document.querySelector('[data-view-config-dialog="true"]');
      if (dialog?.contains(target)) return;
      setIsViewConfigDialogOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      setIsViewConfigDialogOpen(false);
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isViewConfigDialogOpen]);

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
        backgroundColor: 'white',
        borderRight: '1px solid rgba(0, 0, 0, 0.1)',
        boxSizing: 'border-box',
        color: 'rgb(29, 31, 37)',
        fontFamily:
          '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
        fontSize: '13px',
        fontWeight: 400,
        lineHeight: '18px',
        userSelect: 'none',
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
            ref={createButtonRef}
            id="viewSidebarCreateViewButton"
            data-tutorial-selector-id="viewSidebarCreateViewButton"
            className="pointer items-center justify-center border-box text-decoration-none focus-visible rounded-big border-none colors-foreground-default colors-background-selected-hover px1-and-half button-size-default flex width-full pl1-and-half sidebar-button"
            type="button"
            aria-disabled="false"
            aria-haspopup="true"
            aria-expanded={isCreateMenuOpen ? 'true' : 'false'}
            style={{ justifyContent: 'flex-start', backgroundColor: 'white' }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsCreateMenuOpen((v) => !v);
            }}
          >
            <SpriteIcon name="Plus" width={16} height={16} className="flex-none noevents mr1" />
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
                    className="ignore-baymax-defaults width-full stroked-blue-inset-outset-focus sidebar-search-input sidebar-text"
                    placeholder="Find a view"
                    aria-label="Find a view"
                    defaultValue=""
                    style={{
                      width: '100%',
                      height: '32px',
                      paddingLeft: '36px',
                      paddingRight: '30px',
                      paddingTop: '6px',
                      paddingBottom: '6px',
                      border: '1px solid transparent',
                      borderRadius: '4px',
                      fontSize: '13px',
                      lineHeight: '18px',
                      outline: 'none',
                      backgroundColor: 'rgb(255, 255, 255)',
                      boxShadow: 'none',
                    }}
                  />
                  {/* Exact-ish Airtable placement: icon at left, cog at right */}
                  <div
                    className="absolute"
                    style={{
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                      color: 'rgb(29, 31, 37)',
                      opacity: 0.65,
                    }}
                  >
                    <SpriteIcon name="MagnifyingGlass" width={14} height={14} className="icon" />
                  </div>

                  <div
                    className="absolute flex items-center"
                    style={{
                      right: '4px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                    }}
                  >
                    <div
                      tabIndex={0}
                      role="button"
                      className="flex items-center justify-center focus-visible cursor-pointer"
                      aria-label="View list options"
                      aria-haspopup="true"
                      aria-expanded="false"
                      aria-pressed="false"
                      style={{
                        width: '28px',
                        height: '16px',
                        color: 'rgb(29, 31, 37)',
                      }}
                    >
                      <SpriteIcon name="Cog" width={16} height={16} className="flex-none icon" />
                    </div>
                  </div>
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
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                    onDragEnd={({ active, over }) => {
                      if (!over || active.id === over.id) return;

                      setViews((prev) => {
                        const oldIndex = prev.findIndex((v) => v.id === active.id);
                        const newIndex = prev.findIndex((v) => v.id === over.id);
                        if (oldIndex < 0 || newIndex < 0) return prev;
                        return arrayMove(prev, oldIndex, newIndex);
                      });
                    }}
                  >
                    <SortableContext items={viewIds} strategy={verticalListSortingStrategy}>
                      <ul role="listbox" className="css-bi2s67">
                        {views.map((view) => (
                          <SortableViewRow
                            key={view.id}
                            view={view}
                            selected={view.id === selectedViewId}
                            showDragHandle={showDragHandle}
                            onSelect={() => setSelectedViewId(view.id)}
                          />
                        ))}
                      </ul>
                    </SortableContext>
                  </DndContext>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isCreateMenuOpen && createMenuPos && (
        <div
          ref={createMenuPopoverRef}
          role="dialog"
          tabIndex={-1}
          className="baymax rounded-big focus-visible shadow-elevation-high colors-background-raised-popover light-scrollbar"
          data-element-owned-by="viewSidebarCreateViewButton"
          style={{
            position: 'fixed',
            inset: '0px auto auto 0px',
            width: 240,
            zIndex: 5,
            transform: `translate3d(${createMenuPos.x}px, ${createMenuPos.y}px, 0px)`,
            maxHeight: createMenuPos.maxH,
            maxWidth: createMenuPos.maxW,
            overflowY: 'auto',
            fontFamily:
              '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
            fontSize: 13,
            fontWeight: 400,
            lineHeight: '18px',
            color: 'rgb(29, 31, 37)',
          }}
        >
          <ul role="menu" tabIndex={-1} aria-label="Create new..." className="p1-and-half">
            <li
              id="viewSidebarCreateView-grid"
              role="menuitem"
              tabIndex={-1}
              className="rounded py1 px1 text-size-default items-center pointer width-full flex"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
              onClick={() => openViewConfigDialog()}
            >
              <SpriteIcon
                name="GridFeature"
                width={16}
                height={16}
                className="flex-none flex-none mr1 colors-foreground-default"
                fill="rgb(22, 110, 225)"
              />
              <span className="truncate flex-auto no-user-select">Grid</span>
            </li>

            <li
              id="viewSidebarCreateView-calendar"
              role="menuitem"
              tabIndex={-1}
              className="rounded py1 px1 text-size-default items-center pointer width-full flex"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
              onClick={() => setIsCreateMenuOpen(false)}
            >
              <SpriteIcon
                name="CalendarFeature"
                width={16}
                height={16}
                className="flex-none flex-none mr1 colors-foreground-default"
                fill="rgb(213, 68, 1)"
              />
              <span className="truncate flex-auto no-user-select">Calendar</span>
            </li>

            <li
              id="viewSidebarCreateView-gallery"
              role="menuitem"
              tabIndex={-1}
              className="rounded py1 px1 text-size-default items-center pointer width-full flex"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
              onClick={() => setIsCreateMenuOpen(false)}
            >
              <SpriteIcon
                name="GalleryFeature"
                width={16}
                height={16}
                className="flex-none flex-none mr1 colors-foreground-default"
                fill="rgb(124, 55, 239)"
              />
              <span className="truncate flex-auto no-user-select">Gallery</span>
            </li>

            <li
              id="viewSidebarCreateView-kanban"
              role="menuitem"
              tabIndex={-1}
              className="rounded py1 px1 text-size-default items-center pointer width-full flex"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
              onClick={() => setIsCreateMenuOpen(false)}
            >
              <SpriteIcon
                name="KanbanFeature"
                width={16}
                height={16}
                className="flex-none flex-none mr1 colors-foreground-default"
                fill="rgb(4, 138, 14)"
              />
              <span className="truncate flex-auto no-user-select">Kanban</span>
            </li>

            <li
              id="viewSidebarCreateView-timeline"
              role="menuitem"
              tabIndex={-1}
              className="rounded py1 px1 text-size-default items-center pointer width-full flex"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
              onClick={() => setIsCreateMenuOpen(false)}
            >
              <SpriteIcon
                name="TimelineFeature"
                width={16}
                height={16}
                className="flex-none flex-none mr1 colors-foreground-default"
                fill="rgb(220, 4, 59)"
              />
              <span className="truncate flex-auto no-user-select">
                Timeline
                <div className="css-1l4uiyf css-1pi0isa pill px1 flex-inline items-center flex-none text-size-small mx1">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    className="flex-none mr-half"
                    style={{ shapeRendering: 'geometricPrecision' }}
                  >
                    <use fill="currentColor" href={`${ICON_SPRITE}#AirtablePlusFill`} />
                  </svg>
                  Team
                </div>
              </span>
            </li>

            <li
              id="viewSidebarCreateView-levels"
              role="menuitem"
              tabIndex={-1}
              className="rounded py1 px1 text-size-default items-center pointer width-full flex"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
              onClick={() => setIsCreateMenuOpen(false)}
            >
              <SpriteIcon
                name="ListFeature"
                width={16}
                height={16}
                className="flex-none flex-none mr1 colors-foreground-default"
                fill="rgb(13, 82, 172)"
              />
              <span className="truncate flex-auto no-user-select">List</span>
            </li>

            <li
              id="viewSidebarCreateView-block"
              role="menuitem"
              tabIndex={-1}
              className="rounded py1 px1 text-size-default items-center pointer width-full flex"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
              onClick={() => setIsCreateMenuOpen(false)}
            >
              <SpriteIcon
                name="Gantt"
                width={16}
                height={16}
                className="flex-none flex-none mr1 colors-foreground-default"
                fill="rgb(13, 127, 120)"
              />
              <span className="truncate flex-auto no-user-select">
                Gantt
                <div className="css-1l4uiyf css-1pi0isa pill px1 flex-inline items-center flex-none text-size-small mx1">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    className="flex-none mr-half"
                    style={{ shapeRendering: 'geometricPrecision' }}
                  >
                    <use fill="currentColor" href={`${ICON_SPRITE}#AirtablePlusFill`} />
                  </svg>
                  Team
                </div>
              </span>
            </li>

            <li role="presentation" className="m1 colors-background-selected" style={{ height: 1 }} />

            <li
              id="viewSidebarCreateView-form"
              role="menuitem"
              tabIndex={-1}
              className="rounded py1 px1 text-size-default items-center pointer width-full flex"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
              onClick={() => setIsCreateMenuOpen(false)}
            >
              <SpriteIcon
                name="Form"
                width={16}
                height={16}
                className="flex-none flex-none mr1 colors-foreground-default"
                fill="rgb(221, 4, 168)"
              />
              <span className="truncate flex-auto no-user-select">Form</span>
            </li>

            <li role="presentation" className="m1 colors-background-selected" style={{ height: 1 }} />

            <li
              role="menuitem"
              tabIndex={-1}
              className="rounded py1 px1 text-size-default items-center pointer width-full flex"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
              onClick={() => setIsCreateMenuOpen(false)}
            >
              <SpriteIcon
                name="SwimlanesFeature"
                width={16}
                height={16}
                className="flex-none flex-none mr1 colors-foreground-default"
              />
              <span className="truncate flex-auto no-user-select">
                Section
                <div className="css-1l4uiyf css-1pi0isa pill px1 flex-inline items-center flex-none text-size-small mx1">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    className="flex-none mr-half"
                    style={{ shapeRendering: 'geometricPrecision' }}
                  >
                    <use fill="currentColor" href={`${ICON_SPRITE}#AirtablePlusFill`} />
                  </svg>
                  Team
                </div>
              </span>
            </li>
          </ul>
        </div>
      )}

      {/* View Config Dialog */}
      {isViewConfigDialogOpen && (
        <ViewConfigDialog
          position={viewConfigDialogPos}
          defaultName={defaultViewName}
          existingViewNames={views.map((v) => v.name)}
          onCancel={() => setIsViewConfigDialogOpen(false)}
          onCreate={(name) => createNewGridView(name)}
        />
      )}

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
