'use client';

import { forwardRef, useEffect, useState } from 'react';

const ICON_SPRITE = '/icons/icon_definitions.svg?v=04661fff742a9043fa037c751b1c6e66';

interface FieldConfigDialogProps {
  isOpen: boolean;
  position: { x: number; y: number } | null;
  fieldType: { id: string; name: string; icon: string } | null;
  onClose: () => void;
  onCreate?: (config: { name: string; defaultValue: string }) => void;
}

const FieldConfigDialog = forwardRef<HTMLDivElement, FieldConfigDialogProps>(
  function FieldConfigDialog({ isOpen, position, fieldType, onClose, onCreate }, ref) {
    const [fieldName, setFieldName] = useState('');
    const [defaultValue, setDefaultValue] = useState('');

    useEffect(() => {
      if (!isOpen) {
        setFieldName('');
        setDefaultValue('');
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

    if (!isOpen || !position || !fieldType) return null;

    return (
      <div
        className="baymax"
        role="dialog"
        tabIndex={-1}
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          zIndex: 10004,
          maxHeight: '597px',
          maxWidth: '440px',
        }}
      >
        <div
          ref={ref}
          className="colors-background-raised-popover rounded-big baymax z3 shadow-elevation-high border-none overflow-auto absolute"
          aria-label="Create field"
          role="dialog"
          style={{
            minWidth: '400px',
            maxWidth: '900px',
            maxHeight: 'inherit',
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
            <div className="px2 py1">
              {/* Field name row */}
              <div className="mb1">
                <div className="flex flex-row items-center gap1 width-full">
                  <div>
                    <div
                      tabIndex={0}
                      role="button"
                      className="flex items-center justify-center focus-visible cursor-pointer shadow-elevation-low shadow-elevation-low-hover css-fitwu4"
                      data-testid="field-agent-config-header-convert-toggle"
                      aria-pressed="false"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        className="flex-none icon"
                        style={{ shapeRendering: 'geometricPrecision' }}
                      >
                        <use fill="currentColor" href={`${ICON_SPRITE}#UserCircled`} />
                      </svg>
                    </div>
                  </div>
                  <div style={{ width: '100%' }}>
                    <input
                      type="text"
                      className="css-bao0pl ignore-baymax-defaults width-full stroked-blue-inset-outset-focus"
                      aria-label="Field name (optional)"
                      placeholder="Field name (optional)"
                      value={fieldName}
                      onChange={(e) => setFieldName(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Field type selector */}
              <div className="flex animate" style={{ height: '32px' }}>
                <div className="flex flex-auto">
                  <div
                    className="flex-auto flex items-center flex items-center px1 pointer animate rounded-big overflow-hidden colors-background-raised-control border-none focus-visible-stroked-inset-blue-focus outline-offset-0 shadow-elevation-low shadow-elevation-low-hover"
                    tabIndex={0}
                    role="button"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      className="flex-none flex-none mr1"
                      style={{ shapeRendering: 'geometricPrecision' }}
                    >
                      <use fill="currentColor" href={`${ICON_SPRITE}#${fieldType.icon}`} />
                    </svg>
                    <div className="flex-auto flex items-center">
                      <div
                        className="truncate"
                        style={{
                          color: 'rgb(29, 31, 37)',
                          fontSize: '13px',
                          lineHeight: '18px',
                          fontWeight: 400,
                        }}
                      >
                        {fieldType.name}
                      </div>
                    </div>
                    <div className="quieter sm-vh-show flex-none flex items-center px-half">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        className="flex-none icon"
                        style={{ shapeRendering: 'geometricPrecision' }}
                      >
                        <use fill="currentColor" href={`${ICON_SPRITE}#Question`} />
                      </svg>
                    </div>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      className="flex-none flex-none quiet"
                      style={{ shapeRendering: 'geometricPrecision' }}
                    >
                      <use fill="currentColor" href={`${ICON_SPRITE}#ChevronDown`} />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Field type options */}
            <div className="animate-opacity-fade-in animate-slow pb-half">
              <div className="relative">
                <div className="quiet mt-half px2 sm-vh-hide max-width-2 mb2">
                  <span>Enter text, or prefill each new cell with a default value.</span>
                </div>
                <div className="typeOptionsContainer relative">
                  <div className="px2 pb-half">
                    <label>
                      <div
                        className="text-dark quiet"
                        style={{
                          fontSize: '13px',
                          lineHeight: '18px',
                          fontWeight: 400,
                        }}
                      >
                        Default
                      </div>
                      <input
                        className="p1 mt1 width-full colors-background-raised-control rounded-big border-thick border-transparent stroked-blue-inset-outset-focus shadow-elevation-low shadow-elevation-low-hover"
                        type="text"
                        placeholder="Enter default value (optional)"
                        value={defaultValue}
                        onChange={(e) => setDefaultValue(e.target.value)}
                        style={{
                          height: '32px',
                          width: '100%',
                          fontSize: '13px',
                          lineHeight: '18px',
                          fontWeight: 400,
                          fontFamily: 'inherit',
                          color: 'rgb(29, 31, 37)',
                          outline: 'none',
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="pt1 pb2 px2 flex items-center justify-between">
              <button
                className="pointer items-center justify-center border-box text-decoration-none print-color-exact focus-visible rounded-big ignore-baymax-defaults border-none colors-foreground-default background-transparent colors-background-selected-hover px1-and-half button-size-default flex-inline flex flex-none items-center"
                type="button"
                aria-disabled="false"
                aria-label="Add description"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  className="flex-none noevents mr1"
                  style={{ shapeRendering: 'geometricPrecision' }}
                >
                  <use fill="currentColor" href={`${ICON_SPRITE}#Plus`} />
                </svg>
                <span className="truncate noevents button-text-label no-user-select">
                  Add description
                </span>
              </button>
              <div className="flex items-baseline justify-end ml-auto">
                <button
                  className="pointer items-center justify-center border-box text-decoration-none print-color-exact focus-visible rounded-big ignore-baymax-defaults border-none colors-foreground-default background-transparent colors-background-selected-hover px1-and-half button-size-default flex-inline"
                  type="button"
                  aria-disabled="false"
                  id="columnDialogCancelButton"
                  onClick={onClose}
                >
                  <span className="truncate noevents button-text-label no-user-select">Cancel</span>
                </button>
                <span>
                  <button
                    className="pointer items-center justify-center border-box text-decoration-none print-color-exact focus-visible rounded-big ignore-baymax-defaults border-none text-white font-weight-strong colors-background-primary-control shadow-elevation-low shadow-elevation-low-hover px1-and-half button-size-default flex-inline ml1 flex flex-none items-center"
                    type="button"
                    aria-disabled="false"
                    data-tutorial-selector-id="columnDialogCreateButton"
                    data-testid="column-dialog-create-button"
                  >
                    <span className="truncate noevents button-text-label no-user-select">
                      Create field
                    </span>
                  </button>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export default FieldConfigDialog;
