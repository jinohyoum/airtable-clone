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
import { forwardRef, useCallback, useMemo, useRef, useState } from 'react';
import { api } from '~/trpc/react';

const ICON_SPRITE = '/icons/icon_definitions.svg?v=04661fff742a9043fa037c751b1c6e66';
const FILTER_POPOVER_W = 590;
const FILTER_POPOVER_BOX_SHADOW =
  'rgba(0, 0, 0, 0.24) 0px 0px 1px 0px, rgba(0, 0, 0, 0.16) 0px 0px 2px 0px, rgba(0, 0, 0, 0.06) 0px 3px 4px 0px, rgba(0, 0, 0, 0.06) 0px 6px 8px 0px, rgba(0, 0, 0, 0.08) 0px 12px 16px 0px, rgba(0, 0, 0, 0.06) 0px 18px 32px 0px';

function SpriteIcon({
  name,
  width = 16,
  height = 16,
  className,
}: {
  name: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 16 16"
      className={className ?? 'flex-none icon'}
      style={{ shapeRendering: 'geometricprecision' }}
      aria-hidden="true"
    >
      <use fill="currentColor" href={`${ICON_SPRITE}#${name}`} />
    </svg>
  );
}

type FilterCondition = {
  id: string;
  columnId: string;
  operator: string;
  value: string;
};

function SortableFilterRow({
  id,
  condition,
  idx,
  totalConditions,
  columns,
  onRemove,
}: {
  id: string;
  condition: FilterCondition;
  idx: number;
  totalConditions: number;
  columns: Array<{ id: string; name: string }>;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const column = columns.find((c) => c.id === condition.columnId);
  const columnName = column?.name ?? 'Select field';

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        position: 'absolute',
        left: 0,
        width: '100%',
        top: `${idx * 2.5}rem`,
        height: '2.5rem',
        transition: isDragging ? transition : 'transform linear',
      }}
      aria-label={`${idx === 0 ? '' : 'or '}${idx + 1}: ${columnName} contains ${condition.value || 'an unset filter value'}`}
      data-filterid={condition.id}
    >
      <div className="flex" style={{ height: '100%' }}>
        {/* Left label */}
        <div
          className="flex items-center"
          style={{
            width: '4.5rem',
            paddingLeft: '8px',
            paddingRight: '8px',
            visibility: isDragging ? 'hidden' : 'visible',
          }}
        >
          {idx === 0 ? (
            <div
              className="flex items-center flex-auto"
              style={{
                paddingLeft: '8px',
                paddingRight: '8px',
                width: '100%',
                height: '100%',
              }}
              data-testid="filter-prefix-label"
            >
              Where
            </div>
          ) : idx === 1 ? (
            <div
              className="width-full height-full"
              style={{ width: '100%', height: '100%' }}
              aria-label="or"
            >
              <span
                role="button"
                aria-haspopup="true"
                aria-expanded="false"
                className="rounded flex items-center flex-auto pointer"
                tabIndex={0}
                style={{
                  paddingLeft: '8px',
                  paddingRight: '8px',
                  backgroundColor: 'rgb(255, 255, 255)',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  borderRadius: '3px',
                  width: '100%',
                  height: '100%',
                }}
              >
                <div
                  className="flex-auto flex items-center justify-between pointer"
                  style={{
                    fontSize: '13px',
                    lineHeight: '18px',
                  }}
                >
                  <div>or</div>
                  <SpriteIcon name="ChevronDown" width={16} height={16} className="flex-none flex-none" />
                </div>
              </span>
            </div>
          ) : (
            <div
              className="flex items-center flex-auto"
              style={{
                paddingLeft: '8px',
                paddingRight: '8px',
                width: '100%',
                height: '100%',
              }}
              data-testid="filter-prefix-label"
            >
              or
            </div>
          )}
        </div>

        {/* Filter controls */}
        <div
          className="flex-auto flex items-center"
          style={{
            paddingRight: '0.5rem',
            height: '2rem',
            transition: 'height 200ms',
          }}
        >
          <div data-filterid={condition.id} className="flex items-stretch">
            <div
              className="flex items-stretch"
              style={{
                border: '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: '3px',
                backgroundColor: 'rgb(255, 255, 255)',
                boxSizing: 'content-box',
              }}
            >
              <div
                className="flex-auto flex items-stretch"
                style={{
                  width: '390px',
                  maxWidth: '390px',
                  height: '30px',
                }}
              >
                {/* Column selector + operator */}
                <div
                  className="flex-none flex items-stretch"
                  style={{ width: '250px' }}
                >
                  {/* Column selector */}
                  <div
                    className="self-stretch flex items-stretch"
                    style={{
                      borderRight: '1px solid rgba(0, 0, 0, 0.1)',
                      width: '50%',
                      maxWidth: 'none',
                    }}
                  >
                    <div className="flex flex-auto">
                      <div className="flex flex-auto relative">
                        <div
                          data-testid="autocomplete-button"
                          className="flex items-center rounded pointer"
                          role="button"
                          aria-expanded="false"
                          tabIndex={0}
                          style={{
                            paddingLeft: '8px',
                            paddingRight: '8px',
                            width: '100%',
                          }}
                        >
                          <div
                            className="truncate flex-auto"
                            style={{
                              textAlign: 'left',
                              fontSize: '13px',
                              lineHeight: '18px',
                            }}
                          >
                            {columnName}
                          </div>
                          <div className="flex-none flex items-center" style={{ marginLeft: '4px' }}>
                            <SpriteIcon name="ChevronDown" width={16} height={16} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Operator selector */}
                  <div
                    className="self-stretch flex items-stretch"
                    style={{
                      borderRight: '1px solid rgba(0, 0, 0, 0.1)',
                      width: '50%',
                    }}
                  >
                    <div className="flex flex flex-auto relative">
                      <div
                        data-testid="autocomplete-button"
                        className="flex items-center rounded pointer"
                        role="button"
                        aria-expanded="false"
                        tabIndex={0}
                        style={{
                          paddingLeft: '8px',
                          paddingRight: '8px',
                          width: '100%',
                        }}
                      >
                        <div
                          className="truncate flex-auto"
                          style={{
                            textAlign: 'left',
                            fontSize: '13px',
                            lineHeight: '18px',
                          }}
                        >
                          {condition.operator}
                        </div>
                        <div className="flex-none flex items-center" style={{ marginLeft: '4px' }}>
                          <SpriteIcon name="ChevronDown" width={16} height={16} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Value input */}
                <div
                  className="flex-auto self-stretch flex items-stretch overflow-hidden"
                  style={{
                    borderRight: '1px solid rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <span className="relative flex flex-auto" data-testid="textInputWithDebounce">
                    <input
                      type="text"
                      placeholder="Enter a value"
                      className="px1 truncate"
                      aria-label="Filter comparison value"
                      name="textInputWithDebounce"
                      value={condition.value}
                      readOnly
                      style={{
                        border: '0px',
                        backgroundColor: 'transparent',
                        width: '100%',
                        paddingTop: '4px',
                        paddingBottom: '4px',
                        fontSize: '13px',
                        lineHeight: '18px',
                      }}
                    />
                  </span>
                </div>
              </div>

              {/* Delete + drag buttons */}
              <div className="flex flex-none self-stretch">
                <div
                  tabIndex={0}
                  role="button"
                  className="flex-none self-stretch justify-center flex items-center pointer"
                  aria-label={`Remove item ${idx + 1}`}
                  onClick={onRemove}
                  style={{
                    width: '2rem',
                    height: 'auto',
                    borderRight: '1px solid rgba(0, 0, 0, 0.1)',
                    cursor: 'pointer',
                  }}
                >
                  <SpriteIcon name="Trash" width={16} height={16} />
                </div>

                <div
                  tabIndex={0}
                  role="button"
                  aria-disabled="false"
                  className="flex-none self-stretch justify-center flex items-center dragHandle"
                  aria-roledescription="sortable"
                  style={{
                    width: '2rem',
                    height: 'auto',
                    cursor: 'grab',
                  }}
                  {...attributes}
                  {...listeners}
                >
                  <SpriteIcon name="DotsSixVertical" width={16} height={16} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


const FilterPopover = forwardRef<
  HTMLDivElement,
  {
    tableId: string;
    isOpen: boolean;
    position: { x: number; y: number; maxH: number } | null;
    onRequestClose?: () => void;
  }
>(function FilterPopover({ tableId, isOpen, position, onRequestClose }, ref) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [conditions, setConditions] = useState<FilterCondition[]>([]);  const [isAddConditionActive, setIsAddConditionActive] = useState(false);
  const { data: tableMeta } = api.table.getTableMeta.useQuery(
    { tableId },
    { enabled: Boolean(isOpen && tableId && !tableId.startsWith('__creating__')) },
  );

  const columns = useMemo(() => tableMeta?.columns ?? [], [tableMeta]);

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

  const handleAddCondition = useCallback(() => {
    const newCondition: FilterCondition = {
      id: `flt${Date.now()}${Math.random().toString(36).substring(2, 9)}`,
      columnId: columns[0]?.id ?? '',
      operator: 'contains',
      value: '',
    };
    setConditions((prev) => [...prev, newCondition]);
  }, [columns]);

  const handleRemoveCondition = useCallback((id: string) => {
    setConditions((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback((event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setConditions((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  }, []);

  if (!isOpen || !position) return null;

  const { x, y, maxH } = position;
  const hasConditions = conditions.length > 0;
  const containerHeight = hasConditions ? conditions.length * 2.5 : 0;

  // Calculate left offset to keep right edge aligned when conditions are shown
  // The filter conditions UI is wider (390px + 10.5rem + 32px padding)
  // The no-conditions UI is narrower
  // We need to shift left when conditions appear
  const conditionsWidth = 390 + (10.5 * 16) + 32; // 390px + 10.5rem (168px) + 32px padding = 590px
  const noConditionsWidth = 328; // approximate width of "No filter conditions are applied" text + padding
  const leftOffset = hasConditions ? -(conditionsWidth - noConditionsWidth) : 0;

  return (
    <div
      ref={setRootNode}
      role="dialog"
      tabIndex={-1}
      data-testid="view-config-filter-popover"
      style={{
        position: 'fixed',
        left: x + leftOffset,
        top: y,
        zIndex: 5,
        maxHeight: maxH,
        maxWidth: 1010.57,
      }}
    >
      <div
        style={{
          width: 'min-content',
          maxWidth: '1152px',
          whiteSpace: 'nowrap',
        }}
      >
        <div
          style={{
            backgroundColor: 'rgb(255, 255, 255)',
            borderRadius: '3px',
            boxShadow: FILTER_POPOVER_BOX_SHADOW,
            overflow: 'hidden',
          }}
        >
          {/* Empty background section */}
          <div
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.05)',
              fontSize: '11px',
              opacity: 0.75,
              padding: '0 16px',
              overflowX: 'auto',
              overflowY: 'auto',
              overflowWrap: 'break-word',
              whiteSpace: 'pre-wrap',
              height: 0,
            }}
          />

          {/* Header or no conditions message */}
          {!hasConditions ? (
            <div
              style={{
                display: 'flex',
                padding: '16px 16px 0 16px',
              }}
            >
              <div
                style={{
                  opacity: 0.5,
                  fontSize: '13px',
                  lineHeight: '18px',
                }}
              >
                No filter conditions are applied
              </div>
              <div
                tabIndex={0}
                role="button"
                aria-label="Learn more about filtering your views"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  opacity: 0.75,
                  color: 'rgb(97, 102, 112)',
                  marginLeft: '8px',
                  cursor: 'pointer',
                }}
              >
                <SpriteIcon name="Question" width={16} height={16} />
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: '16px 16px 12px 16px',
                color: 'rgb(97, 102, 112)',
                fontSize: '13px',
                lineHeight: '18px',
              }}
            >
              In this view, show records
            </div>
          )}

          {/* Filter conditions list */}
          {hasConditions && (
            <div
              className="existingFilterContainer light-scrollbar"
              style={{
                padding: '0 16px 0 16px',
                maxHeight: '425px',
                overflowX: 'auto',
                overflowY: 'auto',
              }}
            >
              <div>
                <div
                  className="relative"
                  style={{
                    width: 'calc(390px + 10.5rem)',
                    height: `${containerHeight}rem`,
                    color: 'rgb(29, 31, 37)',
                    fill: 'rgb(29, 31, 37)',
                  }}
                >
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                    >
                      <SortableContext items={conditions.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                        {conditions.map((condition, idx) => (
                          <SortableFilterRow
                            key={condition.id}
                            id={condition.id}
                            condition={condition}
                            idx={idx}
                            totalConditions={conditions.length}
                            columns={columns}
                            onRemove={() => handleRemoveCondition(condition.id)}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </div>
                </div>
            </div>
          )}

          {/* Action buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginRight: '16px',
              }}
            >
              {/* Add condition button */}
              <div
                tabIndex={0}
                role="button"
                aria-label="Add condition"
                className="focusFirstInModal"
                onClick={(e) => {
                  handleAddCondition();
                  setIsAddConditionActive(true);
                }}
                onBlur={() => {
                  setIsAddConditionActive(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '13px',
                  color: isAddConditionActive ? 'rgba(10, 110, 220)' : 'rgb(97, 102, 112)',
                  fontWeight: 500,
                  cursor: 'pointer',
                  marginRight: '16px',
                }}
              >
                <SpriteIcon name="Plus" width={12} height={12} className="flex-none flex-none" />
                <span style={{ marginLeft: '4px' }}>Add condition</span>
              </div>

              {/* Add condition group section */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div
                  tabIndex={0}
                  role="button"
                  aria-label="Add condition group"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '13px',
                    color: 'rgb(97, 102, 112)',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <SpriteIcon name="Plus" width={12} height={12} className="flex-none flex-none" />
                  <span style={{ marginLeft: '4px' }}>Add condition group</span>
                </div>

                {/* Help link */}
                <span
                  style={{
                    marginLeft: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    opacity: 0.75,
                    color: 'rgb(97, 102, 112)',
                    cursor: 'pointer',
                  }}
                >
                  <a
                    href="https://support.airtable.com/docs/advanced-filtering-using-conditions"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: '14px',
                    }}
                    title="Learn more about advanced filtering"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <SpriteIcon name="Question" width={16} height={16} />
                  </a>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default FilterPopover;
