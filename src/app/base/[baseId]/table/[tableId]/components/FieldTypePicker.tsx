'use client';

import { forwardRef, useEffect, useId, useState } from 'react';

const ICON_SPRITE = '/icons/icon_definitions.svg?v=04661fff742a9043fa037c751b1c6e66';

interface FieldType {
  id: string;
  name: string;
  icon: string;
  hasSubmenu?: boolean;
}

const FIELD_TYPES: FieldType[] = [
  { id: 'foreignKey', name: 'Link to another record', icon: 'ArrowRightList', hasSubmenu: true },
  { id: 'text', name: 'Single line text', icon: 'TextAlt' },
  { id: 'multilineText', name: 'Long text', icon: 'Paragraph' },
  { id: 'multipleAttachment', name: 'Attachment', icon: 'File' },
  { id: 'checkbox', name: 'Checkbox', icon: 'CheckSquare' },
  { id: 'multiSelect', name: 'Multiple select', icon: 'Multiselect' },
  { id: 'select', name: 'Single select', icon: 'CaretCircleDown' },
  { id: 'collaborator', name: 'User', icon: 'User' },
  { id: 'date', name: 'Date', icon: 'CalendarFeature' },
  { id: 'phone', name: 'Phone number', icon: 'Phone' },
  { id: 'email', name: 'Email', icon: 'EnvelopeSimple' },
  { id: 'url', name: 'URL', icon: 'Link' },
  { id: 'number', name: 'Number', icon: 'HashStraight' },
  { id: 'currency', name: 'Currency', icon: 'CurrencyDollarSimple' },
  { id: 'percentV2', name: 'Percent', icon: 'Percent' },
  { id: 'duration', name: 'Duration', icon: 'Clock' },
  { id: 'rating', name: 'Rating', icon: 'Star' },
  { id: 'formula', name: 'Formula', icon: 'Formula' },
  { id: 'rollup', name: 'Rollup', icon: 'Spiral' },
  { id: 'count', name: 'Count', icon: 'Calculator' },
  { id: 'lookup', name: 'Lookup', icon: 'Lookup' },
  { id: 'createdTime', name: 'Created time', icon: 'CalendarBlankLightning' },
  { id: 'lastModifiedTime', name: 'Last modified time', icon: 'CalendarBlankLightning' },
  { id: 'createdBy', name: 'Created by', icon: 'UserLightning' },
  { id: 'lastModifiedBy', name: 'Last modified by', icon: 'UserLightning' },
  { id: 'autoNumber', name: 'Autonumber', icon: 'Autonumber' },
  { id: 'barcode', name: 'Barcode', icon: 'Barcode' },
  { id: 'button', name: 'Button', icon: 'Cursor' },
];

const FieldTypePicker = forwardRef<
  HTMLDivElement,
  {
    isOpen: boolean;
    position: { x: number; y: number } | null;
    onClose: () => void;
    onSelect?: (fieldType: string) => void;
  }
>(function FieldTypePicker({ isOpen, position, onClose, onSelect }, ref) {
  const searchInputId = useId();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      return;
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const dialog = (ref as React.RefObject<HTMLDivElement>)?.current;
      if (dialog && !dialog.contains(target)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, ref]);

  if (!isOpen || !position) return null;

  const filteredFieldTypes = query
    ? FIELD_TYPES.filter((ft) =>
        ft.name.toLowerCase().includes(query.toLowerCase())
      )
    : FIELD_TYPES;

  return (
    <div
      ref={ref}
      className="colors-background-raised-popover rounded-big baymax z3 shadow-elevation-high border-none overflow-auto absolute"
      role="dialog"
      aria-label="Create field"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        minWidth: '400px',
        maxWidth: '900px',
        maxHeight: '584px',
        backgroundColor: 'rgb(255, 255, 255)',
        borderRadius: '6px',
        boxShadow:
          'rgba(0, 0, 0, 0.24) 0px 0px 1px 0px, rgba(0, 0, 0, 0.16) 0px 0px 2px 0px, rgba(0, 0, 0, 0.06) 0px 3px 4px 0px, rgba(0, 0, 0, 0.06) 0px 6px 8px 0px, rgba(0, 0, 0, 0.08) 0px 12px 16px 0px, rgba(0, 0, 0, 0.06) 0px 18px 32px 0px',
        fontFamily:
          '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
        fontSize: '13px',
        lineHeight: '18px',
        fontWeight: 400,
        color: 'rgb(29, 31, 37)',
      }}
    >
      <div className="col-12 relative">
        <div className="p-three-quarters" style={{ padding: '6px' }}>
          <div className="mt2" style={{ marginTop: '16px' }}>
            <div
              className="flex flex-column col-12"
              style={{
                marginTop: '-24px',
                pointerEvents: 'auto',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Sticky header */}
              <div
                className="flex flex-column sticky pt1 colors-background-raised-popover"
                style={{
                  top: 0,
                  backgroundColor: 'rgb(255, 255, 255)',
                  position: 'sticky',
                  paddingTop: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Search bar */}
                <div
                  className="flex animate items-center"
                  style={{
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <div
                    className="flex rounded-big width-full colors-background-subtler border"
                    style={{
                      borderColor: 'rgb(246, 248, 252)',
                      backgroundColor: 'rgb(246, 248, 252)',
                      borderRadius: '6px',
                      border: '1px solid rgb(246, 248, 252)',
                      display: 'flex',
                      width: '100%',
                    }}
                  >
                    <label
                      htmlFor={searchInputId}
                      className="flex m1-and-quarter"
                      style={{ margin: '10px', display: 'flex' }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        className="flex-none flex-none"
                        style={{ shapeRendering: 'geometricPrecision' }}
                      >
                        <use fill="currentColor" href={`${ICON_SPRITE}#MagnifyingGlass`} />
                      </svg>
                    </label>
                    <input
                      id={searchInputId}
                      type="text"
                      className="col-12 p-half ml-half rounded-big transparent colors-background-selected-hover colors-background-selected-focus"
                      placeholder="Find a field type"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      style={{
                        border: 0,
                        backgroundColor: 'transparent',
                        borderRadius: '6px',
                        padding: '4px',
                        marginLeft: '4px',
                        width: '100%',
                        outline: 'none',
                        fontSize: '13px',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>
                  <a
                    href="https://support.airtable.com/docs/supported-field-types-in-airtable-overview"
                    className="flex items-center flex-none m1-and-quarter ml1-and-three-quarters focus-visible"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      margin: '10px 10px 10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      color: 'inherit',
                      textDecoration: 'none',
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      className="flex-none pointer link-quiet"
                      style={{ shapeRendering: 'geometricPrecision' }}
                    >
                      <use fill="currentColor" href={`${ICON_SPRITE}#Question`} />
                    </svg>
                  </a>
                </div>
                <hr
                  className="border-bottom-none border-left-none border-right-none colors-border-subtle mx0 my-half mt1"
                  style={{
                    border: 'none',
                    borderTop: '1px inset rgba(0, 0, 0, 0.05)',
                    margin: '8px 0 4px 0',
                  }}
                />
              </div>

              {/* Content area */}
              <div
                className="flex-auto flex flex-column"
                style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto' }}
              >
                {/* Standard fields section */}
                <p
                  className="font-family-default text-size-default colors-foreground-subtle line-height-4 font-weight-default mx1-and-quarter my1"
                  style={{
                    margin: '8px 10px',
                    fontSize: '13px',
                    lineHeight: '19.5px',
                    color: 'rgb(97, 102, 112)',
                    fontWeight: 400,
                  }}
                >
                  Standard fields
                </p>
                <div className="p-half" style={{ padding: '4px' }}>
                  {filteredFieldTypes.map((fieldType) => (
                    <div
                      key={fieldType.id}
                      className="flex items-center p1 px1-and-quarter rounded-big width-full colors-background-subtler-hover colors-background-subtle-active pointer"
                      data-tutorial-selector-id={`displayTypePicker-${fieldType.id}`}
                      aria-disabled="false"
                      onClick={() => {
                        onSelect?.(fieldType.id);
                        onClose();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        width: '100%',
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        className="flex-none flex-none"
                        style={{ shapeRendering: 'geometricPrecision' }}
                      >
                        <use fill="currentColor" href={`${ICON_SPRITE}#${fieldType.icon}`} />
                      </svg>
                      <div
                        className="ml1 flex-auto flex items-center justify-between"
                        style={{
                          marginLeft: '8px',
                          flex: '1 1 auto',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div
                          className="truncate colors-foreground-default"
                          aria-disabled="false"
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: 'rgb(29, 31, 37)',
                            fontSize: '13px',
                            lineHeight: '18px',
                          }}
                        >
                          {fieldType.name}
                        </div>
                      </div>
                      {fieldType.hasSubmenu && (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          className="flex-none flex-none"
                          style={{ shapeRendering: 'geometricPrecision' }}
                        >
                          <use
                            fill="var(--palette-neutral-quieter)"
                            href={`${ICON_SPRITE}#ChevronRight`}
                          />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default FieldTypePicker;
