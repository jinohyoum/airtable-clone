'use client';

import { useEffect, useRef, useState } from 'react';

const ICON_SPRITE = '/icons/icon_definitions.svg?v=04661fff742a9043fa037c751b1c6e66';

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
      <use fill="currentColor" href={`${ICON_SPRITE}#${name}`} />
    </svg>
  );
}

type ViewPermission = 'collaborative' | 'personal' | 'locked';

interface ViewConfigDialogProps {
  position: { x: number; y: number };
  defaultName: string;
  existingViewNames?: string[];
  onCancel: () => void;
  onCreate: (name: string, permission: ViewPermission) => void;
}

export default function ViewConfigDialog({
  position,
  defaultName,
  existingViewNames = [],
  onCancel,
  onCreate,
}: ViewConfigDialogProps) {
  const [viewName, setViewName] = useState(defaultName);
  const [permission, setPermission] = useState<ViewPermission>('collaborative');
  const [errorMessage, setErrorMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-select the input text when the dialog opens
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.select();
      inputRef.current.focus();
    }
  }, []);

  const handleCreate = () => {
    const trimmedName = viewName.trim();
    
    if (!trimmedName) {
      setErrorMessage('Please enter a non-empty view name');
      return;
    }
    
    if (existingViewNames.includes(trimmedName)) {
      setErrorMessage('Please enter a unique view name');
      return;
    }
    
    onCreate(viewName, permission);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setViewName(newValue);
    
    const trimmedValue = newValue.trim();
    
    // Clear error if input is valid
    if (!trimmedValue) {
      setErrorMessage('Please enter a non-empty view name');
    } else if (existingViewNames.includes(trimmedValue)) {
      setErrorMessage('Please enter a unique view name');
    } else {
      setErrorMessage('');
    }
  };

  const isCreateDisabled = !viewName.trim() || existingViewNames.includes(viewName.trim());

  return (
    <div
      role="dialog"
      tabIndex={-1}
      data-view-config-dialog="true"
      className="baymax rounded-big focus-visible shadow-elevation-high colors-background-raised-popover light-scrollbar"
      style={{
        position: 'fixed',
        inset: '0px auto auto 0px',
        width: '400px',
        zIndex: 5,
        transform: `translate3d(${position.x}px, ${position.y}px, 0px)`,
        backgroundColor: 'rgb(255, 255, 255)',
        borderRadius: '6px',
        boxShadow:
          'rgba(0, 0, 0, 0.24) 0px 0px 1px 0px, rgba(0, 0, 0, 0.16) 0px 0px 2px 0px, rgba(0, 0, 0, 0.06) 0px 3px 4px 0px, rgba(0, 0, 0, 0.06) 0px 6px 8px 0px, rgba(0, 0, 0, 0.08) 0px 12px 16px 0px, rgba(0, 0, 0, 0.06) 0px 18px 32px 0px',
        color: 'rgb(29, 31, 37)',
        fontFamily:
          '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
        fontSize: '13px',
        fontWeight: 400,
        lineHeight: '18px',
      }}
    >
      <div
        className="p2"
        style={{
          padding: '16px',
        }}
      >
        {/* View name input */}
        <div
          className="flex flex-column flex-auto width-full pt1"
          style={{
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            flexShrink: 1,
            width: '100%',
            paddingTop: '8px',
          }}
        >
          <input
            ref={inputRef}
            aria-label="Update view name"
            type="text"
            className="heading-size-small line-height-3 strong text-dark flex-auto colors-background-raised-control shadow-elevation-low rounded-big"
            maxLength={256}
            value={viewName}
            onChange={handleInputChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            style={{
              appearance: 'none',
              backgroundColor: 'rgb(255, 255, 255)',
              border: isFocused ? '2px solid rgba(191, 191, 191)' : '2px solid rgba(0, 0, 0, 0)',
              borderRadius: '6px',
              boxShadow:
                'rgba(0, 0, 0, 0.32) 0px 0px 1px 0px, rgba(0, 0, 0, 0.08) 0px 0px 2px 0px, rgba(0, 0, 0, 0.08) 0px 1px 3px 0px',
              boxSizing: 'border-box',
              color: 'rgb(29, 31, 37)',
              fontSize: '17px',
              fontWeight: 500,
              height: '33.25px',
              lineHeight: '21.25px',
              outline: 'none',
              padding: '4px',
              width: '100%',
            }}
          />
          <div
            className={`text-size-small my1 pl-half ${errorMessage ? 'colors-foreground-accent-negative animate-bounce-in' : ''}`}
            style={{
              minHeight: '18px',
              fontSize: '11px',
              marginTop: '8px',
              marginBottom: '8px',
              paddingLeft: '4px',
              color: errorMessage ? 'rgb(177, 15, 65)' : 'transparent',
              animation: errorMessage ? 'bounceIn 0.24s' : 'none',
            }}
          >
            {errorMessage || '\u00A0'}
          </div>
        </div>

        {/* Who can edit section */}
        <div
          className="flex-auto strong text-size-large pb1"
          style={{
            fontSize: '15px',
            fontWeight: 500,
            paddingBottom: '8px',
          }}
        >
          Who can edit
        </div>

        {/* Radio group and description */}
        <div className="pb1" style={{ paddingBottom: '8px' }}>
          <ul
            role="radiogroup"
            tabIndex={0}
            aria-activedescendant={`permission-${permission}`}
            className="flex items-center justify-content"
            style={{
              display: 'flex',
              alignItems: 'center',
              listStyle: 'none',
              margin: 0,
              padding: 0,
            }}
          >
            {/* Collaborative */}
            <li
              id="permission-collaborative"
              className="flex mr2 pointer"
              role="radio"
              aria-checked={permission === 'collaborative'}
              aria-disabled="false"
              onClick={() => setPermission('collaborative')}
              style={{
                display: 'flex',
                marginRight: '16px',
                cursor: 'pointer',
              }}
            >
              <div
                aria-checked={permission === 'collaborative'}
                className="flex-none flex-inline items-center justify-center circle colors-background-default border-thick colors-border-default"
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  border: '2px solid rgba(0, 0, 0, 0.1)',
                  backgroundColor: 'rgb(255, 255, 255)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '4px',
                }}
              >
                <div
                  className="circle colors-background-primary-control"
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor:
                      permission === 'collaborative' ? 'rgb(22, 110, 225)' : 'transparent',
                  }}
                ></div>
              </div>
              <SpriteIcon name="UsersThree" width={16} height={16} className="flex-none flex-none mx-half" />
              <span className="mr-half" style={{ marginLeft: '4px', marginRight: '4px' }}>
                Collaborative
              </span>
            </li>

            {/* Personal */}
            <li
              id="permission-personal"
              className="flex mr2 pointer"
              role="radio"
              aria-checked={permission === 'personal'}
              aria-disabled="false"
              onClick={() => {/* disabled */}}
              style={{
                display: 'flex',
                marginRight: '16px',
                cursor: 'pointer',
              }}
            >
              <div
                aria-checked={permission === 'personal'}
                className="flex-none flex-inline items-center justify-center circle colors-background-default border-thick colors-border-default"
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  border: '2px solid rgba(0, 0, 0, 0.1)',
                  backgroundColor: 'rgb(255, 255, 255)',
                  display: 'flex',
                  alignItems: 'center',
                  marginRight: '4px',
                  justifyContent: 'center',
                }}
              >
                <div
                  className="circle"
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: permission === 'personal' ? 'rgb(22, 110, 225)' : 'transparent',
                  }}
                ></div>
              </div>
              <SpriteIcon name="User" width={16} height={16} className="flex-none flex-none mx-half" />
              <span className="mr-half" style={{ marginLeft: '4px', marginRight: '4px' }}>
                Personal
              </span>
            </li>

            {/* Locked */}
            <li
              id="permission-locked"
              className="flex mr2 pointer"
              role="radio"
              aria-checked={permission === 'locked'}
              aria-disabled="false"
              onClick={() => {/* disabled */}}
              style={{
                display: 'flex',
                marginRight: '16px',
                cursor: 'pointer',
              }}
            >
              <div
                aria-checked={permission === 'locked'}
                className="flex-none flex-inline items-center justify-center circle colors-background-default border-thick colors-border-default"
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  border: '2px solid rgba(0, 0, 0, 0.1)',
                  backgroundColor: 'rgb(255, 255, 255)',
                  display: 'flex',
                  alignItems: 'center',
                  marginRight: '4px',
                  justifyContent: 'center',
                }}
              >
                <div
                  className="circle"
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: permission === 'locked' ? 'rgb(22, 110, 225)' : 'transparent',
                  }}
                ></div>
              </div>
              <SpriteIcon name="Lock" width={16} height={16} className="flex-none flex-none mx-half" />
              <span className="mr-half" style={{ marginLeft: '4px', marginRight: '4px' }}>
                Locked
              </span>
            </li>
          </ul>
          
          {/* Description text */}
          <div
            className="quiet mt1"
            style={{
              marginTop: '8px',
              opacity: 0.75,
              color: 'rgba(129, 130, 135)',
            }}
          >
            All collaborators can edit the configuration
          </div>
        </div>

        {/* Action buttons */}
        <div
          className="flex items-center justify-end pt2"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingTop: '16px',
          }}
        >
          {/* Cancel button */}
          <button
            className="pointer items-center justify-center border-box text-decoration-none print-color-exact focus-visible rounded-big ignore-baymax-defaults border-none colors-foreground-default background-transparent colors-background-selected-hover px1-and-half button-size-default flex-inline mr1"
            type="button"
            aria-disabled="false"
            onClick={onCancel}
            style={{
              appearance: 'auto',
              backgroundColor: 'rgba(0, 0, 0, 0)',
              border: 'none',
              borderRadius: '6px',
              color: 'rgb(29, 31, 37)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 400,
              height: '32px',
              lineHeight: '22px',
              marginRight: '8px',
              padding: '0 12px',
              textAlign: 'center',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0, 0, 0, 0)';
            }}
          >
            <span
              className="truncate noevents button-text-label no-user-select"
              style={{
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              Cancel
            </span>
          </button>

          {/* Create button */}
          <button
            className="pointer items-center justify-center border-box text-decoration-none print-color-exact focus-visible rounded-big ignore-baymax-defaults border-none text-white font-weight-strong colors-background-primary-control shadow-elevation-low shadow-elevation-low-hover px1-and-half button-size-default flex-inline"
            type="button"
            aria-disabled={isCreateDisabled}
            disabled={isCreateDisabled}
            data-tutorial-selector-id="createViewConfigurationCreateViewButton"
            onClick={handleCreate}
            style={{
              appearance: 'auto',
              backgroundColor: isCreateDisabled ? 'rgba(132, 182, 237)' : 'rgb(22, 110, 225)',
              border: 'none',
              borderRadius: '6px',
              boxShadow:
                'rgba(0, 0, 0, 0.32) 0px 0px 1px 0px, rgba(0, 0, 0, 0.08) 0px 0px 2px 0px, rgba(0, 0, 0, 0.08) 0px 1px 3px 0px',
              color: 'rgb(255, 255, 255)',
              cursor: isCreateDisabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 500,
              height: '32px',
              lineHeight: '22px',
              padding: '0 12px',
              textAlign: 'center',
            }}
          >
            <span
              className="truncate noevents button-text-label no-user-select"
              style={{
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              Create new view
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
