'use client';

import { forwardRef, useCallback, useRef } from 'react';

const ICON_SPRITE = '/icons/icon_definitions.svg?v=04661fff742a9043fa037c751b1c6e66';
const FILTER_POPOVER_W = 327.492;
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

const FilterPopover = forwardRef<
  HTMLDivElement,
  {
    isOpen: boolean;
    position: { x: number; y: number; maxH: number } | null;
    onRequestClose?: () => void;
  }
>(function FilterPopover({ isOpen, position, onRequestClose }, ref) {
  const rootRef = useRef<HTMLDivElement | null>(null);

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

  if (!isOpen || !position) return null;

  const { x, y, maxH } = position;

  return (
    <div
      ref={setRootNode}
      role="dialog"
      tabIndex={-1}
      data-testid="view-config-filter-popover"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 5,
        maxHeight: maxH,
        maxWidth: 748.062,
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

          {/* No filter conditions message */}
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
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '13px',
                  color: 'rgb(97, 102, 112)',
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
