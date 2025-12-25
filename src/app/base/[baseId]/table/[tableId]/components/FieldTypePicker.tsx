'use client';

import { forwardRef, useEffect, useId, useRef, useState } from 'react';
import FieldConfigDialog from './FieldConfigDialog';

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
    onCreate?: (args: { fieldTypeId: string; name: string; defaultValue: string }) => void;
  }
>(function FieldTypePicker({ isOpen, position, onClose, onSelect, onCreate }, ref) {
  const PICKER_W = 400;
  const PANEL_GAP = 8;

  const searchInputId = useId();
  const [query, setQuery] = useState('');
  const [selectedFieldType, setSelectedFieldType] = useState<FieldType | null>(null);
  const [configDialogPosition, setConfigDialogPosition] = useState<{ x: number; y: number } | null>(null);
  const [isTypePickerOpenFromConfig, setIsTypePickerOpenFromConfig] = useState(false);
  const [dockConfigRight, setDockConfigRight] = useState(false);
  const configDialogRef = useRef<HTMLDivElement>(null);

  const computeConfigDialogPosition = () => {
    if (!position) return null;
    return {
      x: position.x + (dockConfigRight ? PICKER_W + PANEL_GAP : 0),
      y: position.y,
    };
  };

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedFieldType(null);
      setConfigDialogPosition(null);
      setIsTypePickerOpenFromConfig(false);
      setDockConfigRight(false);
      return;
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const picker = (ref as React.RefObject<HTMLDivElement>)?.current;
      const config = configDialogRef.current;
      const isInsidePicker = picker ? picker.contains(target) : false;
      const isInsideConfig = config ? config.contains(target) : false;

      if (!isInsidePicker && !isInsideConfig) {
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

  useEffect(() => {
    if (!isOpen) return;
    if (!selectedFieldType) return;
    const nextPos = computeConfigDialogPosition();
    if (nextPos) setConfigDialogPosition(nextPos);
  }, [isOpen, selectedFieldType, position, dockConfigRight]);

  if (!isOpen || !position) return null;

  const filteredFieldTypes = query
    ? FIELD_TYPES.filter((ft) =>
        ft.name.toLowerCase().includes(query.toLowerCase())
      )
    : FIELD_TYPES;

  const showConfig = Boolean(selectedFieldType && configDialogPosition);
  const showPicker = !selectedFieldType || isTypePickerOpenFromConfig;

  return (
    <>
      {showPicker ? (
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
                        className="flex rounded-big width-full colors-background-subtler border field-type-picker-search"
                        style={{
                          backgroundColor: 'rgb(246, 248, 252)',
                          borderRadius: '6px',
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
                    {!isTypePickerOpenFromConfig ? (
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
                    ) : null}
                    <div className="p-half" style={{ padding: '4px' }}>
                      {filteredFieldTypes.map((fieldType) => (
                        (() => {
                          const isInert = fieldType.id === 'foreignKey';
                          return (
                        <div
                          key={fieldType.id}
                          className="flex items-center p1 px1-and-quarter rounded-big width-full colors-background-subtler-hover colors-background-subtle-active pointer"
                          data-tutorial-selector-id={`displayTypePicker-${fieldType.id}`}
                          aria-disabled={isInert ? 'true' : 'false'}
                          onClick={() => {
                            if (isInert) return;
                            if (selectedFieldType && isTypePickerOpenFromConfig) {
                              // Switch field type, then return to the config UI (second UI)
                              // in its original anchored position.
                              setSelectedFieldType(fieldType);
                              setIsTypePickerOpenFromConfig(false);
                              setDockConfigRight(false);
                              if (position) {
                                setConfigDialogPosition({ x: position.x, y: position.y });
                              }
                              return;
                            }

                            // Initial selection: open config.
                            setSelectedFieldType(fieldType);
                            const nextPos = computeConfigDialogPosition();
                            if (nextPos) setConfigDialogPosition(nextPos);

                            // Preserve the existing external callback (if any) without changing the UI flow.
                            onSelect?.(fieldType.id);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            cursor: isInert ? 'default' : 'pointer',
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
                          );
                        })()
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showConfig ? (
        <FieldConfigDialog
          ref={configDialogRef}
          isOpen={true}
          position={configDialogPosition}
          fieldType={selectedFieldType}
          ignoreOutsideClicks={isTypePickerOpenFromConfig}
          onCreate={(config) => {
            if (!selectedFieldType) return;
            onCreate?.({
              fieldTypeId: selectedFieldType.id,
              name: config.name,
              defaultValue: config.defaultValue,
            });
          }}
          onOpenFieldTypePicker={() => {
            // When reopening the type picker from the config dropdown:
            // - keep the original picker anchored in the same spot
            // - hide the "Standard fields" label
            // - dock the config dialog to the right to avoid overlap
            setDockConfigRight(true);
            setIsTypePickerOpenFromConfig(true);
            const nextPos = position
              ? { x: position.x + PICKER_W + PANEL_GAP, y: position.y }
              : null;
            if (nextPos) setConfigDialogPosition(nextPos);
          }}
          onClose={() => {
            setSelectedFieldType(null);
            setConfigDialogPosition(null);
            setIsTypePickerOpenFromConfig(false);
            setDockConfigRight(false);
            onClose();
          }}
        />
      ) : null}
    </>
  );
});

export default FieldTypePicker;
