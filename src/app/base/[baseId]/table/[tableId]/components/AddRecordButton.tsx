'use client';

export default function AddRecordButton() {
  return (
    <div
      className="flex flex-auto focus-visible ml1"
      style={{
        bottom: '20px',
        position: 'absolute',
        borderRadius: '9999px',
        backgroundColor: 'rgb(255, 255, 255)',
        fontFamily: '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
        fontSize: '13px',
        fontWeight: 400,
        lineHeight: '18px',
        color: 'rgb(29, 31, 37)',
        userSelect: 'none',
        pointerEvents: 'all',
      }}
    >
      {/* Left button - Add record */}
      <div aria-label="Add record" role="button">
        <div
          className="relative flex items-center justify-center border colors-border-default colors-background-raised-surface animate-background-color nowrap pr1-and-half pl2 py1 colors-background-raised-control-hover-hover pointer"
          data-tutorial-selector-id="summaryBarAddRowButton"
          aria-expanded="false"
          aria-haspopup="true"
          style={{
            borderTopLeftRadius: '9999px',
            borderBottomLeftRadius: '9999px',
          }}
        >
          <span className="items-center flex" style={{ height: '18px' }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              className="flex-none icon"
              style={{ shapeRendering: 'geometricPrecision' }}
            >
              <use
                fill="currentColor"
                href="/icons/icon_definitions.svg?v=04661fff742a9043fa037c751b1c6e66#Plus"
              ></use>
            </svg>
          </span>
        </div>
      </div>

      {/* Right button - Add more */}
      <div>
        <div tabIndex={0} role="button" className="focus-visible" aria-label="Add more">
          <div
            className="relative flex items-center justify-center border-right border-top border-bottom colors-border-default colors-background-raised-surface animate-background-color nowrap pl1-and-half pr2 py1 pointer colors-background-raised-control-hover-hover"
            style={{
              borderTopRightRadius: '9999px',
              borderBottomRightRadius: '9999px',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M13.5 8V11"
                stroke="var(--colors-foreground-default)"
                strokeLinecap="round"
                strokeLinejoin="round"
              ></path>
              <path
                d="M12 9.5H15"
                stroke="var(--colors-foreground-default)"
                strokeLinecap="round"
                strokeLinejoin="round"
              ></path>
              <path
                d="M5.25 2.5V5"
                stroke="var(--colors-foreground-default)"
                strokeLinecap="round"
                strokeLinejoin="round"
              ></path>
              <path
                d="M4 3.75H6.5"
                stroke="var(--colors-foreground-default)"
                strokeLinecap="round"
                strokeLinejoin="round"
              ></path>
              <path
                d="M10.5 11.5V13.5"
                stroke="var(--colors-foreground-default)"
                strokeLinecap="round"
                strokeLinejoin="round"
              ></path>
              <path
                d="M9.5 12.5H11.5"
                stroke="var(--colors-foreground-default)"
                strokeLinecap="round"
                strokeLinejoin="round"
              ></path>
              <path
                d="M11.6515 2.35241L2.35746 11.6464C2.1622 11.8417 2.1622 12.1583 2.35746 12.3536L3.65014 13.6462C3.8454 13.8415 4.16198 13.8415 4.35725 13.6462L13.6513 4.3522C13.8465 4.15694 13.8465 3.84035 13.6513 3.64509L12.3586 2.35241C12.1633 2.15715 11.8468 2.15715 11.6515 2.35241Z"
                stroke="var(--colors-foreground-default)"
                strokeLinecap="round"
                strokeLinejoin="round"
              ></path>
              <path
                d="M9 5L11 7"
                stroke="var(--colors-foreground-default)"
                strokeLinecap="round"
                strokeLinejoin="round"
              ></path>
            </svg>
            <span className="pl1" style={{ fontSize: '13px' }}>Add…</span>
          </div>
        </div>
      </div>
    </div>
  );
}
