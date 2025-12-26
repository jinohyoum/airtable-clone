'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
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
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '~/trpc/react';
import { useColumnsUi } from './ColumnsUiContext';
import { getColumnIconName } from './columnIcons';

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
      style={{ shapeRendering: 'geometricPrecision' }}
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

// Map UI operator labels to DB operator types
type DbOperator =
  | 'isEmpty'
  | 'isNotEmpty'
  | 'contains'
  | 'notContains'
  | 'equals'
  | 'notEquals'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual';

function mapOperatorToDbType(uiOperator: string, columnType?: string): DbOperator {
  if (columnType === 'number') {
    const mapping: Record<string, DbOperator> = {
      '=': 'equals',
      '≠': 'notEquals',
      '<': 'lessThan',
      '>': 'greaterThan',
      '≤': 'lessThanOrEqual',
      '≥': 'greaterThanOrEqual',
      'is empty': 'isEmpty',
      'is not empty': 'isNotEmpty',
    };
    return mapping[uiOperator] ?? 'equals';
  }

  const mapping: Record<string, DbOperator> = {
    'contains...': 'contains',
    'contains': 'contains',
    'does not contain': 'notContains',
    'is...': 'equals',
    'is': 'equals',
    'is not...': 'notContains',
    'is empty': 'isEmpty',
    'is not empty': 'isNotEmpty',
    '>': 'greaterThan',
    '<': 'lessThan',
    '=': 'equals',
  };
  return mapping[uiOperator] ?? 'contains';
}

// Map DB operator types back to UI labels
function mapDbTypeToOperator(dbType: string, columnType?: string): string {
  if (columnType === 'number') {
    const mapping: Record<string, string> = {
      equals: '=',
      notEquals: '≠',
      lessThan: '<',
      greaterThan: '>',
      lessThanOrEqual: '≤',
      greaterThanOrEqual: '≥',
      isEmpty: 'is empty',
      isNotEmpty: 'is not empty',
    };
    return mapping[dbType] ?? '=';
  }

  const mapping: Record<string, string> = {
    contains: 'contains...',
    notContains: 'does not contain',
    equals: 'is...',
    isEmpty: 'is empty',
    isNotEmpty: 'is not empty',
    greaterThan: '>',
    lessThan: '<',
  };
  return mapping[dbType] ?? 'contains...';
}

function SortableFilterRow({
  id,
  condition,
  idx,
  totalConditions,
  columns,
  onRemove,
  setConditions, // Add setConditions here
}: {
  id: string;
  condition: FilterCondition;
  idx: number;
  totalConditions: number;
  columns: Array<{ id: string; name: string; type: string }>;
  onRemove: () => void;
  setConditions: React.Dispatch<React.SetStateAction<FilterCondition[]>>; // Define the type
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [isFocused, setIsFocused] = useState(false);
  const [showOperatorDropdown, setShowOperatorDropdown] = useState(false);
  const [operatorType, setOperatorType] = useState('or');
  const operatorButtonRef = useRef<HTMLSpanElement>(null);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [columnSearchValue, setColumnSearchValue] = useState('');
  const columnButtonRef = useRef<HTMLDivElement>(null);
  const [isColumnFieldSelected, setIsColumnFieldSelected] = useState(false);
  const columnDropdownRef = useRef<HTMLDivElement>(null);
  const [showOperatorSelectorDropdown, setShowOperatorSelectorDropdown] = useState(false);
  const [operatorSearchValue, setOperatorSearchValue] = useState('');
  const operatorSelectorButtonRef = useRef<HTMLDivElement>(null);
  const [isOperatorFieldSelected, setIsOperatorFieldSelected] = useState(false);
  const operatorSelectorDropdownRef = useRef<HTMLDivElement>(null);

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const column = columns.find((c) => c.id === condition.columnId);
  const columnName = column?.name ?? 'Select field';
  const isNumberColumn = column?.type === 'number';

  // Filter columns based on search
  const filteredColumns = columns.filter((col) =>
    col.name.toLowerCase().includes(columnSearchValue.toLowerCase())
  );

  const operatorOptions = useMemo(() => {
    return isNumberColumn
      ? ['=', '≠', '<', '>', '≤', '≥', 'is empty', 'is not empty']
      : ['contains...', 'does not contain', 'is...', 'is not...', 'is empty', 'is not empty'];
  }, [isNumberColumn]);

  // Ensure current operator is valid for the selected column type
  useEffect(() => {
    const defaultOp = isNumberColumn ? '=' : 'contains...';
    if (operatorOptions.includes(condition.operator)) return;
    setConditions((prev) => prev.map((c) => (c.id === condition.id ? { ...c, operator: defaultOp } : c)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condition.columnId, isNumberColumn]);

  // Filter operators based on search
  const filteredOperators = operatorOptions.filter((op) =>
    op.toLowerCase().includes(operatorSearchValue.toLowerCase())
  );

  useEffect(() => {
    if (!showColumnDropdown && !isColumnFieldSelected) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const clickedOutsideButton = !columnButtonRef.current?.contains(target);
      const clickedOutsideDropdown = !columnDropdownRef.current?.contains(target);

      if (clickedOutsideButton && clickedOutsideDropdown) {
        setShowColumnDropdown(false);
        setIsColumnFieldSelected(false);
      }
    }
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [showColumnDropdown, isColumnFieldSelected]);

  useEffect(() => {
    if (!showOperatorSelectorDropdown && !isOperatorFieldSelected) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const clickedOutsideButton = !operatorSelectorButtonRef.current?.contains(target);
      const clickedOutsideDropdown = !operatorSelectorDropdownRef.current?.contains(target);

      if (clickedOutsideButton && clickedOutsideDropdown) {
        setShowOperatorSelectorDropdown(false);
        setIsOperatorFieldSelected(false);
      }
    }
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [showOperatorSelectorDropdown, isOperatorFieldSelected]);

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
              style={{ width: '100%', height: '100%', position: 'relative' }}
              aria-label={operatorType}
            >
              <span
                ref={operatorButtonRef}
                role="button"
                aria-haspopup="true"
                aria-expanded={showOperatorDropdown}
                className="rounded flex items-center flex-auto pointer"
                tabIndex={0}
                onClick={() => setShowOperatorDropdown(!showOperatorDropdown)}
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
                  <div>{operatorType}</div>
                  <SpriteIcon name="ChevronDown" width={16} height={16} className="flex-none flex-none" />
                </div>
              </span>
              {showOperatorDropdown && operatorButtonRef.current && (
                <div
                  style={{
                    position: 'fixed',
                    top: `${operatorButtonRef.current.getBoundingClientRect().bottom}px`,
                    left: `${operatorButtonRef.current.getBoundingClientRect().left}px`,
                    zIndex: 10005,
                    minWidth: '56px',
                  }}
                >
                  <div>
                    <div>
                      <ul
                        className="hdropdown selectMenuList menu"
                        role="menu"
                        style={{
                          maxHeight: '200px',
                          backgroundColor: 'rgb(255, 255, 255)',
                          borderRadius: '3px',
                          border: '1px solid rgba(0, 0, 0, 0.1)',
                          overflowX: 'hidden',
                          overflowY: 'auto',
                          padding: 0,
                          margin: 0,
                          listStyle: 'none',
                          position: 'relative',
                          zIndex: 1,
                        }}
                      >
                        <li
                          tabIndex={0}
                          role="menuitem"
                          aria-disabled="false"
                          onClick={() => {
                            setOperatorType('and');
                            setShowOperatorDropdown(false);
                          }}
                          style={{
                            boxSizing: 'border-box',
                            cursor: 'pointer',
                            fontSize: '13px',
                            lineHeight: '18px',
                            height: '36px',
                            paddingTop: '9px',
                            paddingBottom: '6px',
                            paddingLeft: '6px',
                            paddingRight: '20px',
                            listStyle: 'none',
                          }}
                        >
                          and
                        </li>
                        <li
                          tabIndex={0}
                          role="menuitem"
                          aria-disabled="false"
                          onClick={() => {
                            setOperatorType('or');
                            setShowOperatorDropdown(false);
                          }}
                          style={{
                            boxSizing: 'border-box',
                            cursor: 'pointer',
                            fontSize: '13px',
                            lineHeight: '18px',
                            height: '36px',
                            paddingTop: '9px',
                            paddingBottom: '6px',
                            paddingLeft: '6px',
                            paddingRight: '20px',
                            listStyle: 'none',
                          }}
                        >
                          or
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
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
              {operatorType}
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
                      position: 'relative',
                    }}
                  >
                    <div className="flex flex-auto">
                      <div className="flex flex-auto relative">
                        <div
                          ref={columnButtonRef}
                          data-testid="autocomplete-button"
                          className="flex items-center rounded pointer"
                          role="button"
                          aria-expanded={showColumnDropdown}
                          tabIndex={0}
                          onClick={() => {
                            if (showColumnDropdown) {
                              setShowColumnDropdown(false);
                              setIsColumnFieldSelected(false);
                            } else {
                              setShowColumnDropdown(true);
                              setIsColumnFieldSelected(true);
                            }
                          }}
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
                              color: isColumnFieldSelected ? 'rgba(10, 110, 220)' : 'inherit',
                            }}
                          >
                            {columnName}
                          </div>
                          <div className="flex-none flex items-center" style={{ marginLeft: '4px' }}>
                            <SpriteIcon name="ChevronDown" width={16} height={16} />
                          </div>
                        </div>
                        {showColumnDropdown && columnButtonRef.current && (
                          <div
                            ref={columnDropdownRef}
                            style={{
                              position: 'fixed',
                              top: `${columnButtonRef.current.getBoundingClientRect().bottom + 4}px`,
                              left: `${columnButtonRef.current.getBoundingClientRect().left}px`,
                              zIndex: 10004,
                            }}
                          >
                            <span data-focus-scope-start="true" hidden></span>
                            <div>
                              <div
                                className="colors-background-raised-popover baymax preventGridDeselect rounded shadow-elevation-medium p1-and-half"
                                style={{
                                  backgroundColor: 'rgb(255, 255, 255)',
                                  borderRadius: '3px',
                                  boxShadow:
                                    'rgba(0, 0, 0, 0.24) 0px 0px 1px 0px, rgba(0, 0, 0, 0.08) 0px 0px 2px 0px, rgba(0, 0, 0, 0.08) 0px 2px 4px 0px',
                                  padding: '12px',
                                }}
                              >
                                <div className="flex flex-auto rounded" style={{ minHeight: '32px' }}>
                                <input
                                  autoComplete="false"
                                  className="css-1uw7fyx background-transparent p1 flex-auto"
                                  placeholder="Find a field"
                                  type="search"
                                  role="combobox"
                                  aria-autocomplete="none"
                                  aria-expanded="true"
                                  aria-label="Find a field"
                                  value={columnSearchValue}
                                  onChange={(e) => setColumnSearchValue(e.target.value)}
                                  style={{
                                    border: '0px',
                                    height: '32px',
                                    backgroundColor: 'transparent',
                                    padding: '8px',
                                    width: '100%',
                                    fontSize: '13px',
                                    lineHeight: '18px',
                                    borderRadius: '2px',
                                    outline: 'none',
                                  }}
                                />
                              </div>
                              <ul
                                role="listbox"
                                className="overflow-auto light-scrollbar suggestionRowsContainerSelector relative"
                                style={{
                                  maxHeight: '220px',
                                  maxWidth: '450px',
                                  position: 'relative',
                                  overflowX: 'auto',
                                  overflowY: 'auto',
                                  padding: 0,
                                  margin: 0,
                                  listStyle: 'none',
                                }}
                              >
                                {filteredColumns.map((col, colIdx) => {
                                  const iconName = getColumnIconName(col.type);
                                  return (
                                    <li
                                      key={col.id}
                                      role="option"
                                      aria-disabled="false"
                                      className={`rounded p1 flex items-center overflow-hidden pointer ${
                                        col.id === condition.columnId ? 'colors-background-selected' : ''
                                      }`}
                                      onClick={() => {
                                        setConditions((prev) =>
                                          prev.map((c) => {
                                            if (c.id !== condition.id) return c;
                                            const defaultOp = col.type === 'number' ? '=' : 'contains...';
                                            return { ...c, columnId: col.id, operator: defaultOp };
                                          })
                                        );
                                        setShowColumnDropdown(false);
                                        setColumnSearchValue('');
                                      }}
                                      style={{
                                        borderRadius: '3px',
                                        padding: '8px',
                                        height: '34px',
                                        cursor: 'pointer',
                                        overflow: 'hidden',
                                        backgroundColor:
                                          col.id === condition.columnId ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
                                      }}
                                    >
                                      <SpriteIcon
                                        name={iconName}
                                        width={16}
                                        height={16}
                                        className="flex-none flex-none mr-half"
                                      />
                                      <div style={{ fontSize: '13px', lineHeight: '18px' }}>{col.name}</div>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          </div>
                          <span data-focus-scope-end="true" hidden></span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Operator selector */}
                  <div
                    className="self-stretch flex items-stretch"
                    style={{
                      borderRight: '1px solid rgba(0, 0, 0, 0.1)',
                      width: '50%',
                      position: 'relative',
                    }}
                  >
                    <div className="flex flex flex-auto relative">
                      <div
                        ref={operatorSelectorButtonRef}
                        data-testid="autocomplete-button"
                        className="flex items-center rounded pointer"
                        role="button"
                        aria-expanded={showOperatorSelectorDropdown}
                        tabIndex={0}
                        onClick={() => {
                          if (showOperatorSelectorDropdown) {
                            setShowOperatorSelectorDropdown(false);
                            setIsOperatorFieldSelected(false);
                          } else {
                            setShowOperatorSelectorDropdown(true);
                            setIsOperatorFieldSelected(true);
                          }
                        }}
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
                            color: isOperatorFieldSelected ? 'rgba(10, 110, 220)' : 'inherit',
                          }}
                        >
                          {condition.operator === 'does not contain'
                            ? 'does not con...'
                            : condition.operator}
                        </div>
                        <div className="flex-none flex items-center" style={{ marginLeft: '4px' }}>
                          <SpriteIcon name="ChevronDown" width={16} height={16} />
                        </div>
                      </div>
                      {showOperatorSelectorDropdown && operatorSelectorButtonRef.current && (
                        <div
                          ref={operatorSelectorDropdownRef}
                          style={{
                            position: 'fixed',
                            top: `${operatorSelectorButtonRef.current.getBoundingClientRect().bottom + 4}px`,
                            left: `${operatorSelectorButtonRef.current.getBoundingClientRect().left}px`,
                            zIndex: 10004,
                            minWidth: '124px',
                          }}
                        >
                          <span data-focus-scope-start="true" hidden></span>
                          <div>
                            <div
                              className="colors-background-raised-popover baymax preventGridDeselect rounded shadow-elevation-medium p1-and-half"
                              style={{
                                backgroundColor: 'rgb(255, 255, 255)',
                                borderRadius: '3px',
                                boxShadow:
                                  'rgba(0, 0, 0, 0.24) 0px 0px 1px 0px, rgba(0, 0, 0, 0.08) 0px 0px 2px 0px, rgba(0, 0, 0, 0.08) 0px 2px 4px 0px',
                                padding: '12px',
                              }}
                            >
                              <div className="flex flex-auto rounded" style={{ minHeight: '32px' }}>
                                <input
                                  autoComplete="false"
                                  className="css-1uw7fyx background-transparent p1 flex-auto"
                                  placeholder="Find an operator"
                                  type="search"
                                  role="combobox"
                                  aria-autocomplete="none"
                                  aria-expanded="true"
                                  aria-label="Find an operator"
                                  value={operatorSearchValue}
                                  onChange={(e) => setOperatorSearchValue(e.target.value)}
                                  style={{
                                    border: '0px',
                                    height: '32px',
                                    backgroundColor: 'transparent',
                                    padding: '8px',
                                    width: '100%',
                                    fontSize: '13px',
                                    lineHeight: '18px',
                                    borderRadius: '2px',
                                    outline: 'none',
                                  }}
                                />
                              </div>
                              <ul
                                role="listbox"
                                className="overflow-auto light-scrollbar suggestionRowsContainerSelector relative"
                                style={{
                                  maxHeight: '220px',
                                  maxWidth: '450px',
                                  position: 'relative',
                                  overflowX: 'auto',
                                  overflowY: 'auto',
                                  padding: 0,
                                  margin: 0,
                                  listStyle: 'none',
                                }}
                              >
                                {filteredOperators.map((op, opIdx) => (
                                  <li
                                    key={op}
                                    role="option"
                                    className={`rounded p1 flex items-center overflow-hidden pointer ${
                                      op === condition.operator ? 'colors-background-selected' : ''
                                    }`}
                                    onClick={() => {
                                      setConditions((prev) =>
                                        prev.map((c) => (c.id === condition.id ? { ...c, operator: op } : c))
                                      );
                                      setShowOperatorSelectorDropdown(false);
                                      setOperatorSearchValue('');
                                    }}
                                    style={{
                                      borderRadius: '3px',
                                      padding: '8px',
                                      height: '34px',
                                      cursor: 'pointer',
                                      overflow: 'hidden',
                                      backgroundColor:
                                        op === condition.operator ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
                                    }}
                                  >
                                    {op}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          <span data-focus-scope-end="true" hidden></span>
                        </div>
                      )}
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
                  {condition.operator !== 'is empty' && condition.operator !== 'is not empty' && (
                    <span className="relative flex flex-auto" data-testid="textInputWithDebounce">
                      {/* Add state for managing focus and typing */}
                      <input
                        type="text"
                        placeholder={condition.value ? '' : 'Enter a value'} // Update placeholder logic
                        className="px1 truncate"
                        aria-label="Filter comparison value"
                        name="textInputWithDebounce"
                        value={condition.value}
                        onChange={(e) => {
                          const updatedValue = e.target.value;
                          setConditions((prev) =>
                            prev.map((c) => (c.id === condition.id ? { ...c, value: updatedValue } : c))
                          );
                        }}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        style={{
                          border: isFocused ? '2.4px solid rgba(10, 110, 220)' : '0px',
                          backgroundColor: 'transparent',
                          width: isFocused ? 'calc(100% - 4.8px)' : 'calc(100% - 4px)',
                          padding: '4px',
                          fontSize: '13px',
                          lineHeight: '18px',
                          outline: 'none',
                        }}
                      />
                    </span>
                  )}
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
                  className="flex-none self-stretch justify-center flex items-center dragHandle"
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
    filters: Array<{
      id: string;
      columnId: string;
      operator: string;
      value?: string;
    }>;
    onChangeFilters: (filters: Array<{
      id: string;
      columnId: string;
        operator:
          | 'isEmpty'
          | 'isNotEmpty'
          | 'contains'
          | 'notContains'
          | 'equals'
          | 'notEquals'
          | 'greaterThan'
          | 'lessThan'
          | 'greaterThanOrEqual'
          | 'lessThanOrEqual';
      value?: string;
    }>) => void;
    onDraftFiltersChange: (filters: Array<{
      id: string;
      columnId: string;
        operator:
          | 'isEmpty'
          | 'isNotEmpty'
          | 'contains'
          | 'notContains'
          | 'equals'
          | 'notEquals'
          | 'greaterThan'
          | 'lessThan'
          | 'greaterThanOrEqual'
          | 'lessThanOrEqual';
      value?: string;
    }>) => void;
    onRequestClose?: () => void;
  }
>(function FilterPopover({ tableId, isOpen, position, filters, onChangeFilters, onDraftFiltersChange, onRequestClose }, ref) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [isAddConditionActive, setIsAddConditionActive] = useState(false);
  const didInitConditionsRef = useRef(false);

  const { data: tableMeta } = api.table.getTableMeta.useQuery(
    { tableId },
    { enabled: Boolean(isOpen && tableId && !tableId.startsWith('__creating__')) },
  );
  
  // Initialize local conditions from parent filters only when opening (or when table changes).
  // IMPORTANT: do not rehydrate on every parent `filters` change while open, or it will overwrite typing.
  useEffect(() => {
    if (!isOpen) {
      didInitConditionsRef.current = false;
      return;
    }
    if (didInitConditionsRef.current) return;

    // Wait for table meta so we can map operators correctly for Number vs Text.
    if (!tableMeta) return;

    const typeById = new Map(tableMeta.columns.map((c) => [c.id, c.type] as const));

    setConditions(
      filters.map((f) => ({
        id: f.id,
        columnId: f.columnId,
        operator: mapDbTypeToOperator(f.operator, typeById.get(f.columnId)),
        value: f.value ?? '',
      })),
    );
    didInitConditionsRef.current = true;
  }, [isOpen, tableId, tableMeta]);

  // Notify parent of draft changes and auto-apply filters
  useEffect(() => {
    if (isOpen && conditions.length >= 0) {
      const typeById = tableMeta ? new Map(tableMeta.columns.map((c) => [c.id, c.type] as const)) : null;
      const mappedFilters = conditions.map((c) => ({
        id: c.id,
        columnId: c.columnId,
        operator: mapOperatorToDbType(c.operator, typeById?.get(c.columnId)),
        value: c.value || undefined,
      }));
      
      onDraftFiltersChange(mappedFilters);
      
      // Auto-apply filters with minimal debounce for instant filtering
      const timer = setTimeout(() => {
        onChangeFilters(mappedFilters);
      }, 150);
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conditions, isOpen]);

  const { columnOrder, ensureColumnOrder } = useColumnsUi();

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

  const columns = useMemo(() => {
    if (!tableMeta) return [];
    const byId = new Map(tableMeta.columns.map((c) => [c.id, c] as const));
    return orderedIds
      .map((id) => byId.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
  }, [tableMeta, orderedIds]);

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
      operator: 'contains...',
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

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    setConditions((items) => {
      const oldIndex = items.findIndex((item) => item.id === activeId);
      const newIndex = items.findIndex((item) => item.id === overId);
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
              {/* Remove functionality from the info button */}
              <span
                style={{
                  marginLeft: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  opacity: 0.75,
                  color: 'rgb(97, 102, 112)',
                  cursor: 'default', // Change cursor to indicate no functionality
                }}
              >
                <SpriteIcon name="Question" width={16} height={16} />
              </span>
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
                            setConditions={setConditions} // Pass setConditions here
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
