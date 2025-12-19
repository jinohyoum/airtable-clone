'use client';

import { useEffect, useRef, useState } from 'react';

interface TableCreationDropdownProps {
  tableName: string;
  onSave: (tableName: string, recordTerm: string) => void;
  onCancel: () => void;
  onClickOutside: () => void;
  position?: { x: number; y: number };
}

export default function TableCreationDropdown({
  tableName,
  onSave,
  onCancel,
  onClickOutside,
  position = { x: 0, y: 0 },
}: TableCreationDropdownProps) {
  const [name, setName] = useState(tableName);
  const [recordTerm, setRecordTerm] = useState('Record');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Autofocus and select the input text
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClickOutside();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onCancel, onClickOutside]);

  const handleSave = () => {
    onSave(name, recordTerm);
  };

  return (
    <div
      ref={containerRef}
      className="table-creation-dropdown"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '299px',
        zIndex: 1000,
      }}
    >
      <div className="colors-background-default stroked1 p2 rounded max-width-1 baymax">
        {/* Table name input */}
        <div className="flex justify-center">
          <input
            ref={inputRef}
            aria-label="Table name editor"
            type="text"
            className="border-thick border-blue flex-auto big rounded-big mb2 p1"
            maxLength={255}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Record terminology section */}
        <div className="flex justify-between items-center mb1">
          <h5 className="quiet">What should each record be called?</h5>
          <span className="flex items-center quiet link-unquiet pointer focus-visible colors-foreground-subtle">
            <a
              href="https://support.airtable.com/docs/customizing-terminology-used-for-records-in-a-table"
              className="flex items-center rounded-huge focus-visible"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                className="flex-none icon"
                aria-hidden="true"
                style={{ shapeRendering: 'geometricPrecision' }}
              >
                <path
                  fill="currentColor"
                  d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM8 13a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm.75-7.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0ZM7.5 7.5a.5.5 0 0 1 1 0v3a.5.5 0 0 1-1 0v-3Z"
                />
              </svg>
            </a>
          </span>
        </div>

        {/* Record dropdown */}
        <div className="flex justify-between mb1 flex flex-auto relative">
          <div
            data-testid="autocomplete-button"
            className="flex-auto flex items-center link-unquiet focus-visible rounded-big p1 colors-background-subtle pointer"
            role="button"
            aria-expanded={isDropdownOpen}
            tabIndex={0}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsDropdownOpen(!isDropdownOpen);
              }
            }}
            style={{ 
              overflow: 'hidden',
              transition: 'none'
            }}
          >
            <div className="truncate flex-auto">{recordTerm}</div>
            <div className="flex-none flex items-center ml-half hide-print">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                className="flex-none icon"
                style={{ shapeRendering: 'geometricPrecision' }}
              >
                <path
                  d="M4.5 6L8 9.5L11.5 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Examples section */}
        <div className="small thin flex quiet">
          <div className="col-2">Examples:</div>
          <div className="flex flex-wrap col-10">
            <div className="flex items-center flex-inline mr1-and-half">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                className="flex-none ml1 mr-half"
                style={{ shapeRendering: 'geometricPrecision' }}
              >
                <path
                  d="M8 3.5v9m-4.5-4.5h9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
              Add {recordTerm.toLowerCase()}
            </div>
            <div className="flex items-center flex-inline">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                className="flex-none ml1 mr-half"
                style={{ shapeRendering: 'geometricPrecision' }}
              >
                <path
                  fill="currentColor"
                  d="M2.5 3.5h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z"
                />
                <path
                  fill="white"
                  d="m2.5 4.5 5.5 3 5.5-3"
                  stroke="white"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Send {recordTerm.toLowerCase()}s
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end mt1-and-half">
          <button
            className="pointer items-center justify-center border-box text-decoration-none print-color-exact focus-visible rounded-big ignore-baymax-defaults border-none colors-foreground-default background-transparent colors-background-selected-hover px1 button-size-small flex-inline mr1 hover"
            type="button"
            aria-disabled="false"
            onClick={onCancel}
          >
            <span className="truncate noevents button-text-label no-user-select">Cancel</span>
          </button>
          <button
            className="pointer items-center justify-center border-box text-decoration-none print-color-exact focus-visible rounded-big ignore-baymax-defaults border-none text-white font-weight-strong colors-background-primary-control shadow-elevation-low shadow-elevation-low-hover px1 button-size-small flex-inline"
            type="button"
            aria-disabled="false"
            onClick={handleSave}
          >
            <span className="truncate noevents button-text-label no-user-select">Save</span>
          </button>
        </div>
      </div>
    </div>
  );
}
