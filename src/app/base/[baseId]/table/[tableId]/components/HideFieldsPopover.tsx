'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties } from 'react';
import { forwardRef, useEffect, useId, useMemo, useState } from 'react';
import { api } from '~/trpc/react';
import { useColumnsUi } from './ColumnsUiContext';
import { getColumnIconName } from './columnIcons';

const ICON_SPRITE = '/icons/icon_definitions.svg?v=04661fff742a9043fa037c751b1c6e66';

function SpriteIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      className={className ?? ''}
      style={{ shapeRendering: 'geometricPrecision' }}
      aria-hidden="true"
      focusable="false"
    >
      <use fill="currentColor" href={`${ICON_SPRITE}#${name}`} />
    </svg>
  );
}

function SwitchPill({ on }: { on: boolean }) {
  return (
    <div
      className="pill flex flex-none animate border-box"
      style={{
        height: 8,
        width: 12.8,
        padding: 2,
        backgroundColor: on ? 'var(--palette-green-green)' : 'rgba(0, 0, 0, 0.18)',
        justifyContent: on ? 'flex-end' : 'flex-start',
      }}
    >
      <div
        className="white circle flex-none"
        data-testid={on ? 'switch-on' : 'switch-off'}
        style={{ width: 4, height: 4 }}
      />
    </div>
  );
}

function SortableFieldRow({
  id,
  name,
  iconName,
  checked,
  disabled,
  onToggle,
}: {
  id: string;
  name: string;
  iconName: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: CSSProperties = {
    opacity: 1,
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} className="baymax mt1 mb-half" style={style}>
      <div className="baymax flex items-center">
        <div
          tabIndex={0}
          role="checkbox"
          className="flex items-center flex-auto px-half rounded pointer colors-background-selected-hover focus-visible"
          aria-checked={checked ? 'true' : 'false'}
          aria-disabled={disabled ? 'true' : 'false'}
          aria-description={`Tooltip: ${name}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (disabled) return;
            onToggle();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (disabled) return;
              onToggle();
            }
          }}
        >
          <SwitchPill on={checked} />
          <SpriteIcon name={iconName} className="flex-none flex-none ml2 mr1" />
          <div className="flex-auto truncate">{name}</div>
        </div>

        <div
          ref={setActivatorNodeRef}
          className="flex items-center quieter link-unquiet dragHandle focus-visible"
          {...attributes}
          {...listeners}
        >
          <SpriteIcon name="DotsSixVertical" className="flex-none icon" />
        </div>
      </div>
    </div>
  );
}

const HideFieldsPopover = forwardRef<
  HTMLDivElement,
  {
    tableId: string;
    isOpen: boolean;
    position: { x: number; y: number; maxH: number } | null;
  }
>(function HideFieldsPopover({ tableId, isOpen, position }, ref) {
  const { data: tableMeta } = api.table.getTableMeta.useQuery(
    { tableId },
    { enabled: Boolean(isOpen && tableId && !tableId.startsWith('__creating__')) },
  );

  const { columnOrder, hiddenColumnIds, ensureColumnOrder, setColumnOrder, setHiddenColumnIds } =
    useColumnsUi();

  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
  }, [isOpen]);

  const defaultIds = useMemo(() => tableMeta?.columns.map((c) => c.id) ?? [], [tableMeta]);

  useEffect(() => {
    if (!tableMeta) return;
    ensureColumnOrder(defaultIds);
  }, [tableMeta, defaultIds, ensureColumnOrder]);

  const orderedIds = useMemo(() => {
    const base = columnOrder ?? defaultIds;
    // Keep any new columns appended; drop ids that no longer exist
    const existing = new Set(defaultIds);
    const normalized = base.filter((id) => existing.has(id));
    for (const id of defaultIds) {
      if (!normalized.includes(id)) normalized.push(id);
    }
    return normalized;
  }, [columnOrder, defaultIds]);

  const orderedColumns = useMemo(() => {
    if (!tableMeta) return [];
    const byId = new Map(tableMeta.columns.map((c) => [c.id, c] as const));
    return orderedIds
      .map((id) => byId.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
  }, [tableMeta, orderedIds]);

  const primaryColumnId = tableMeta?.columns?.[0]?.id ?? null;

  const filteredColumns = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orderedColumns;
    return orderedColumns.filter((c) => c.name.toLowerCase().includes(q));
  }, [orderedColumns, query]);

  const filteredColumnsWithoutPrimary = useMemo(() => {
    if (!primaryColumnId) return filteredColumns;
    return filteredColumns.filter((c) => c.id !== primaryColumnId);
  }, [filteredColumns, primaryColumnId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!isOpen || !position) return null;

  return (
    <div
      ref={ref}
      role="dialog"
      tabIndex={-1}
      className="baymax rounded-big focus-visible shadow-elevation-high colors-background-raised-popover"
      style={{
        position: 'fixed',
        inset: '0px auto auto 0px',
        zIndex: 20,
        transform: `translate3d(${position.x}px, ${position.y}px, 0px)`,
        minWidth: '20rem',
        width: '20rem',
        maxHeight: position.maxH,
        overflow: 'hidden',
        color: 'rgb(29, 31, 37)',
        fontFamily:
          '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
        fontSize: 13,
        fontWeight: 400,
        lineHeight: '18px',
        whiteSpace: 'nowrap',
      }}
    >
      <div className="clearfix" style={{ minWidth: '20rem' }}>
        <div className="mt1 mx2 border-bottom-thick colors-border-default flex items-center">
          <input
            type="text"
            placeholder="Find a field"
            className="flex-auto small px0 py1 background-transparent"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ border: 0 }}
          />
          <div
            tabIndex={0}
            role="button"
            className="flex items-center quiet link-unquiet pointer focus-visible colors-foreground-subtle"
            aria-label="Learn more about hiding fields"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // UI parity only for now.
            }}
          >
            <SpriteIcon name="Question" className="flex-none icon" />
          </div>
        </div>

        <div
          className="overflow-auto px2 light-scrollbar pt1 pb1"
          style={{ minHeight: 100, maxHeight: 'calc(-380px + 100vh)' }}
        >
          <ul className="">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              // Prevent dragging from auto-scrolling the window (which can create a scrollbar/jump).
              autoScroll={false}
              // Keep the drag interaction constrained like Airtable:
              // - vertical-only sorting
              // - prevent drifting outside the list area (which can trigger window-edge scrolling)
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              onDragEnd={(event) => {
                const { active, over } = event;
                if (!over) return;
                if (active.id === over.id) return;
                const oldIndex = orderedIds.indexOf(String(active.id));
                const newIndex = orderedIds.indexOf(String(over.id));
                if (oldIndex < 0 || newIndex < 0) return;
                setColumnOrder(arrayMove(orderedIds, oldIndex, newIndex));
              }}
              onDragCancel={() => {
                // no-op
              }}
            >
              <SortableContext
                items={filteredColumnsWithoutPrimary.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                {filteredColumnsWithoutPrimary.map((col) => {
                  const isHidden = hiddenColumnIds.has(col.id);
                  const checked = !isHidden;
                  const iconName = getColumnIconName(col.type);
                  return (
                    <SortableFieldRow
                      key={col.id}
                      id={col.id}
                      name={col.name}
                      iconName={iconName}
                      checked={checked}
                      onToggle={() => {
                        const next = new Set(hiddenColumnIds);
                        if (next.has(col.id)) next.delete(col.id);
                        else next.add(col.id);
                        setHiddenColumnIds(next);
                      }}
                    />
                  );
                })}
              </SortableContext>
            </DndContext>
          </ul>
        </div>

        <div className="my1">
          <div className="flex small px2 strong my1 mxn1 hide-fields-footer-row">
            <div
              tabIndex={0}
              role="button"
              className="col-6 mx1 focus-visible link-unquiet pointer rounded center darken1 py-half block hide-fields-footer-button"
              onClick={() => {
                const next = new Set<string>();
                for (const id of orderedIds) {
                  if (primaryColumnId && id === primaryColumnId) continue;
                  next.add(id);
                }
                setHiddenColumnIds(next);
              }}
            >
              Hide all
            </div>
            <div
              tabIndex={0}
              role="button"
              className="col-6 mx1 focus-visible link-unquiet pointer rounded center darken1 py-half block hide-fields-footer-button"
              onClick={() => {
                setHiddenColumnIds(new Set());
              }}
            >
              Show all
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default HideFieldsPopover;


