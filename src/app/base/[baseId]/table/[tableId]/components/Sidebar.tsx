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
import { useMemo, useState } from 'react';

function SpriteIcon({
  name,
  width,
  height,
  className,
}: {
  name: string;
  width: number;
  height: number;
  className?: string;
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
      <use fill="currentColor" href={`/icons/icon_definitions.svg#${name}`} />
    </svg>
  );
}

type ViewListItem = {
  id: string;
  name: string;
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

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    backgroundColor: selected ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
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
          tabIndex={0}
          role="button"
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

export default function Sidebar() {
  const [width, setWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);

  // Views aren't persisted yet (server router not implemented).
  // Keep the sidebar UI data-driven so it can be wired to DB-backed views later.
  const [views, setViews] = useState<ViewListItem[]>(() => [{ id: 'grid', name: 'Grid view' }]);
  const [selectedViewId, setSelectedViewId] = useState<string>('grid');

  const showDragHandle = views.length > 1;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const viewIds = useMemo(() => views.map((v) => v.id), [views]);

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
            className="pointer items-center justify-center border-box text-decoration-none focus-visible rounded-big border-none colors-foreground-default colors-background-selected-hover px1-and-half button-size-default flex width-full pl1-and-half sidebar-button"
            type="button"
            aria-disabled="false"
            aria-haspopup="true"
            aria-expanded="false"
            style={{ justifyContent: 'flex-start', backgroundColor: 'white' }}
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
