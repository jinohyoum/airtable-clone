'use client';

import { ChevronDown, Plus } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import TableCreationDropdown from './TableCreationDropdown';

type MenuEntry =
  | { kind: 'heading'; label: string }
  | { kind: 'divider' }
  | {
      kind: 'item';
      label: string;
      ariaLabel?: string;
      leftIcon?: React.ReactNode;
      right?: React.ReactNode;
      disabled?: boolean;
      onSelect?: () => void;
    };

export default function TableTabsBar() {
  const popoverId = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLUListElement | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number; maxH: number } | null>(
    null,
  );
  const [showTableCreation, setShowTableCreation] = useState(false);
  const [tableCreationPos, setTableCreationPos] = useState<{ x: number; y: number } | null>(null);
  const [tables, setTables] = useState([
    { id: 1, name: 'Table 1', isActive: true },
    { id: 2, name: 'Table 2', isActive: false },
  ]);
  const [creatingTableId, setCreatingTableId] = useState<number | null>(null);
  const nextTableIdRef = useRef(3); // Start from 3 since we have Table 1 and 2
  const tableButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const entries: MenuEntry[] = useMemo(
    () => [
      { kind: 'heading', label: 'Add a blank table' },
      {
        kind: 'item',
        label: 'Start from scratch',
        ariaLabel: 'Start from scratch',
        onSelect: () => {
          // Create a new table tab with unique ID
          const newTableId = nextTableIdRef.current;
          const tableNumber = tables.length + 1; // Based on how many tables exist
          const newTable = {
            id: newTableId,
            name: `Table ${tableNumber}`,
            isActive: false,
          };
          
          nextTableIdRef.current += 1; // Increment for next table's unique ID
          
          setTables((prev) => [...prev, newTable]);
          setCreatingTableId(newTableId);
          
          // Wait for the new tab to render, then position the dropdown below it
          setTimeout(() => {
            const newTableBtn = tableButtonRefs.current.get(newTableId);
            if (!newTableBtn) return;
            
            const rect = newTableBtn.getBoundingClientRect();
            // Center the dropdown (299px wide) with the right edge of the table tab
            const dropdownWidth = 299;
            setTableCreationPos({
              x: Math.round(rect.right - dropdownWidth / 2),
              y: Math.round(rect.bottom + 8),
            });
            setShowTableCreation(true);
          }, 10);
        },
      },
      { kind: 'divider' },
      { kind: 'heading', label: 'Build with Omni' },
      {
        kind: 'item',
        label: 'New table',
        onSelect: () => {
          // TODO: wire to omni flow
        },
      },
      {
        kind: 'item',
        label: 'New table with web data',
        right: (
          <div className="css-1l4uiyf css-xeatqr pill px1 flex-inline items-center flex-none text-size-small ml1">
            Beta
          </div>
        ),
        onSelect: () => {
          // TODO: wire to omni web data flow
        },
      },
      { kind: 'divider' },
      { kind: 'heading', label: 'Add from other sources' },
      {
        kind: 'item',
        label: 'Airtable base',
        ariaLabel: 'Airtable base',
        leftIcon: (
          <svg
            width="16"
            height="13.6"
            viewBox="0 0 200 170"
            xmlns="http://www.w3.org/2000/svg"
            style={{ shapeRendering: 'geometricPrecision' }}
            aria-hidden="true"
          >
            <g>
              <path
                fill="rgb(255, 186, 5)"
                d="M90.0389,12.3675 L24.0799,39.6605 C20.4119,41.1785 20.4499,46.3885 24.1409,47.8515 L90.3759,74.1175 C96.1959,76.4255 102.6769,76.4255 108.4959,74.1175 L174.7319,47.8515 C178.4219,46.3885 178.4609,41.1785 174.7919,39.6605 L108.8339,12.3675 C102.8159,9.8775 96.0559,9.8775 90.0389,12.3675"
              />
              <path
                fill="rgb(57, 202, 255)"
                d="M105.3122,88.4608 L105.3122,154.0768 C105.3122,157.1978 108.4592,159.3348 111.3602,158.1848 L185.1662,129.5368 C186.8512,128.8688 187.9562,127.2408 187.9562,125.4288 L187.9562,59.8128 C187.9562,56.6918 184.8092,54.5548 181.9082,55.7048 L108.1022,84.3528 C106.4182,85.0208 105.3122,86.6488 105.3122,88.4608"
              />
              <path
                fill="rgb(220, 4, 59)"
                d="M88.0781,91.8464 L66.1741,102.4224 L63.9501,103.4974 L17.7121,125.6524 C14.7811,127.0664 11.0401,124.9304 11.0401,121.6744 L11.0401,60.0884 C11.0401,58.9104 11.6441,57.8934 12.4541,57.1274 C12.7921,56.7884 13.1751,56.5094 13.5731,56.2884 C14.6781,55.6254 16.2541,55.4484 17.5941,55.9784 L87.7101,83.7594 C91.2741,85.1734 91.5541,90.1674 88.0781,91.8464"
              />
              <path
                fill="rgba(0, 0, 0, 0.25)"
                d="M88.0781,91.8464 L66.1741,102.4224 L12.4541,57.1274 C12.7921,56.7884 13.1751,56.5094 13.5731,56.2884 C14.6781,55.6254 16.2541,55.4484 17.5941,55.9784 L87.7101,83.7594 C91.2741,85.1734 91.5541,90.1674 88.0781,91.8464"
              />
            </g>
          </svg>
        ),
      },
      {
        kind: 'item',
        label: 'CSV file',
        ariaLabel: 'CSV file',
        leftIcon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            aria-hidden="true"
            style={{ shapeRendering: 'geometricPrecision' }}
            className="text-gray-700"
          >
            <path
              fill="currentColor"
              d="M4 1h5.25L13 4.75V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1Zm5 1.5V5h2.5L9 2.5Z"
              opacity="0.9"
            />
            <path
              fill="currentColor"
              d="M4.25 10.25c0-1.1.75-1.85 1.85-1.85.62 0 1.12.23 1.47.68l-.62.45c-.18-.25-.46-.38-.85-.38-.62 0-1.02.43-1.02 1.1 0 .67.4 1.1 1.02 1.1.4 0 .68-.14.87-.42l.62.44c-.36.48-.86.73-1.49.73-1.1 0-1.85-.75-1.85-1.85Zm4.15 1.8V8.45h.82v3.6h-.82Zm1.83-.46.6-.46c.18.25.42.38.74.38.28 0 .46-.11.46-.29 0-.2-.17-.27-.54-.38l-.25-.08c-.6-.19-.92-.48-.92-1.04 0-.64.5-1.07 1.25-1.07.54 0 .95.19 1.2.56l-.58.43c-.16-.2-.35-.29-.62-.29-.26 0-.41.12-.41.28 0 .18.14.25.48.35l.27.08c.73.22.97.53.97 1.08 0 .68-.55 1.1-1.32 1.1-.66 0-1.13-.25-1.33-.62Z"
            />
          </svg>
        ),
      },
      {
        kind: 'item',
        label: 'Google Calendar',
        ariaLabel: 'Google Calendar',
        leftIcon: (
          // This matches the Airtable UI style of using a tiny inline image icon.
          <Image
            alt="Google Calendar logo"
            width={16}
            height={16}
            unoptimized
            src={
              'data:image/svg+xml;utf8,%3Csvg width=%2216%22 height=%2216%22 viewBox=%220 0 16 16%22 fill=%22none%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath d=%22M11.4211 14.5003L14.5 11.4214H11.4211V14.5003Z%22 fill=%22%23EA4335%22/%3E%3Cpath d=%22M14.5 4.57861H11.4211V11.4207H14.5V4.57861Z%22 fill=%22%23FBBC04%22/%3E%3Cpath d=%22M11.4211 11.4214H4.57895V14.5003H11.4211V11.4214Z%22 fill=%22%2334A853%22/%3E%3Cpath d=%22M1.5 11.4214V13.474C1.5 14.0411 1.95928 14.5003 2.52632 14.5003H4.57895V11.4214H1.5Z%22 fill=%22%23188038%22/%3E%3Cpath d=%22M14.5 4.57895V2.52632C14.5 1.95928 14.0407 1.5 13.4737 1.5H11.4211V4.57895H14.5Z%22 fill=%22%231967D2%22/%3E%3Cpath d=%22M11.4211 1.5H2.52632C1.95928 1.5 1.5 1.95928 1.5 2.52632V11.4211H4.57895V4.57895H11.4211V1.5Z%22 fill=%22%234285F4%22/%3E%3C/svg%3E'
            }
          />
        ),
      },
      {
        kind: 'item',
        label: 'Google Sheets',
        ariaLabel: 'Google Sheets',
        leftIcon: (
          <Image
            alt="Google Sheets icon"
            width={16}
            height={16}
            unoptimized
            src={
              'data:image/svg+xml;utf8,%3Csvg width=%2216%22 height=%2216%22 viewBox=%220 0 16 16%22 fill=%22none%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath d=%22M12.333 15H3.66699C3.40178 15 3.14742 14.8946 2.95989 14.7071C2.77235 14.5196 2.66699 14.2652 2.66699 14V2C2.66699 1.73478 2.77235 1.48043 2.95989 1.29289C3.14742 1.10536 3.40178 1 3.66699 1H9.99999L13.333 4.333V14C13.333 14.2652 13.2276 14.5196 13.0401 14.7071C12.8526 14.8946 12.5982 15 12.333 15Z%22 fill=%22%2343A047%22/%3E%3Cpath d=%22M13.333 4.333H10V1L13.333 4.333Z%22 fill=%22%23C8E6C9%22/%3E%3Cpath d=%22M10 4.3335L13.333 7.6675V4.3335H10Z%22 fill=%22%232E7D32%22/%3E%3Cpath d=%22M10.333 7.66699H5V12.333H11V7.66699H10.333ZM5.667 8.33299H7V8.99999H5.667V8.33299ZM5.667 9.66699H7V10.333H5.667V9.66699ZM5.667 11H7V11.667H5.667V11ZM10.333 11.667H7.667V11H10.333V11.667ZM10.333 10.333H7.667V9.66699H10.333V10.333ZM10.333 8.99999H7.667V8.33299H10.333V8.99999Z%22 fill=%22%23E8F5E9%22/%3E%3C/svg%3E'
            }
          />
        ),
      },
      {
        kind: 'item',
        label: 'Microsoft Excel',
        ariaLabel: 'Microsoft Excel',
        leftIcon: (
          <Image
            alt="Microsoft Excel icon"
            width={16}
            height={16}
            unoptimized
            src={
              'data:image/svg+xml;utf8,%3Csvg width=%2216%22 height=%2216%22 viewBox=%220 0 16 16%22 fill=%22none%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Crect x=%224.5%22 y=%222.125%22 width=%2210.5%22 height=%2212.25%22 rx=%220.875%22 fill=%22%232FB776%22/%3E%3Cpath d=%22M4.5 11.3125H15V13.5C15 13.9832 14.6082 14.375 14.125 14.375H5.375C4.89175 14.375 4.5 13.9832 4.5 13.5V11.3125Z%22 fill=%22%232A6043%22/%3E%3Crect x=%229.75%22 y=%228.25%22 width=%225.25%22 height=%223.0625%22 fill=%22%23229C5B%22/%3E%3Crect x=%229.75%22 y=%225.1875%22 width=%225.25%22 height=%223.0625%22 fill=%22%2327AE68%22/%3E%3Cpath d=%22M4.5 3C4.5 2.51675 4.89175 2.125 5.375 2.125H9.75V5.1875H4.5V3Z%22 fill=%22%231D854F%22/%3E%3Crect x=%224.5%22 y=%225.1875%22 width=%225.25%22 height=%223.0625%22 fill=%22%23197B43%22/%3E%3Crect x=%224.5%22 y=%228.25%22 width=%225.25%22 height=%223.0625%22 fill=%22%231B5B38%22/%3E%3Crect x=%221%22 y=%224.3125%22 width=%227.875%22 height=%227.875%22 rx=%220.875%22 fill=%22%23185A30%22/%3E%3Cpath d=%22M6.6875 10.4375L5.45468 8.20625L6.63338 6.0625H5.67118L4.94351 7.43125L4.22788 6.0625H3.23561L4.42032 8.20625L3.1875 10.4375H4.1497L4.92547 8.9875L5.69523 10.4375H6.6875Z%22 fill=%22white%22/%3E%3C/svg%3E'
            }
          />
        ),
      },
      {
        kind: 'item',
        label: 'Salesforce',
        ariaLabel: 'Salesforce',
        leftIcon: (
          <Image
            alt="Salesforce logo"
            width={16}
            height={16}
            unoptimized
            src={
              'data:image/svg+xml;utf8,%3Csvg width=%2216%22 height=%2216%22 viewBox=%220 0 16 16%22 fill=%22none%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath fill-rule=%22evenodd%22 clip-rule=%22evenodd%22 d=%22M6.6174 3.64849C7.13009 3.1144 7.84436 2.78275 8.63392 2.78275C9.68349 2.78275 10.5995 3.36814 11.0871 4.23718C11.5235 4.04228 11.9961 3.94183 12.4739 3.9424C14.3671 3.9424 15.9017 5.49057 15.9017 7.40066C15.9017 9.31075 14.3671 10.8589 12.4739 10.8589C12.2424 10.8589 12.0167 10.8358 11.7984 10.7918C11.3691 11.5575 10.5503 12.0751 9.61096 12.0751C9.21775 12.0751 8.84575 11.9847 8.51479 11.8227C8.07931 12.8471 7.06488 13.565 5.88279 13.565C4.65183 13.565 3.60244 12.7859 3.19983 11.6935C3.02045 11.7314 2.8376 11.7504 2.65427 11.7504C1.18836 11.7506 7.37231e-06 10.5499 7.37231e-06 9.06866C-0.00109238 8.59925 0.120866 8.13775 0.353723 7.73016C0.586581 7.32258 0.922205 6.98314 1.32714 6.7457C1.15915 6.35861 1.07271 5.94106 1.07322 5.51909C1.07322 3.81544 2.45601 2.43457 4.16175 2.43457C4.63692 2.43402 5.1058 2.54329 5.53177 2.75387C5.95775 2.96444 6.32929 3.27061 6.6174 3.64849Z%22 fill=%22%2300A1E0%22/%3E%3C/svg%3E'
            }
          />
        ),
        right: (
          <div className="css-1l4uiyf css-1pi0isa pill px1 flex-inline items-center flex-none text-size-small ml1">
            <Plus className="flex-none mr-half" style={{ width: 12, height: 12 }} />
            Business
          </div>
        ),
      },
      {
        kind: 'item',
        label: 'Smartsheet',
        ariaLabel: 'Smartsheet',
        leftIcon: (
          <Image
            alt="Smartsheet icon"
            width={16}
            height={16}
            unoptimized
            src={
              'data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22220%22 height=%22220%22 version=%221.0%22 viewBox=%220 0 165 165%22%3E%3Cpath d=%22M19 76.7c0 40.1-.5 75.7-1 79.3-.5 3.5-.7 6.6-.5 6.9 1 .9 26.5-5 39-9 21.4-6.8 43.7-17.7 55.5-27 2.7-2.1 5.3-3.9 5.7-3.9.4 0 2.4 3 4.3 6.8 4.5 8.6 11.9 16.5 15.1 16 5.4-.7 5.4-1 5.6-68.8l.3-62.5-2.6 3c-4 4.7-18.5 26.9-25.4 39-7.2 12.5-24.9 48.3-30.9 62.5-2.3 5.4-4.2 8.8-4.5 8-.3-.8-2-5.6-3.7-10.5C67 90.6 52.8 69 44.8 69c-3 0-.5-3.5 4.6-6.5 4.8-2.8 9.4-3.2 13.5-1.1 3.7 2 10.2 9.2 13.6 15.2 1.6 2.7 3.7 6.4 4.8 8.2l2 3.4 6.6-12.9c10.8-20.9 25.3-41.1 42.6-59.3 4.4-4.7 8.7-9.3 9.4-10.3 1.3-1.6-1.8-1.7-60.8-1.7H19v72.7z%22/%3E%3C/svg%3E'
            }
          />
        ),
      },
      {
        kind: 'item',
        label: '26 more sources...',
        ariaLabel: '26 more sources...',
        leftIcon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            aria-hidden="true"
            style={{ shapeRendering: 'geometricPrecision' }}
            className="text-gray-700"
          >
            <path
              fill="currentColor"
              d="M2.5 3.25A1.75 1.75 0 0 1 4.25 1.5h8A1.75 1.75 0 0 1 14 3.25v9.5A1.75 1.75 0 0 1 12.25 14.5h-8A1.75 1.75 0 0 1 2.5 12.75v-9.5Zm1.75-.5a.5.5 0 0 0-.5.5v9.5a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5v-9.5a.5.5 0 0 0-.5-.5h-8Z"
            />
            <path
              fill="currentColor"
              d="M5 5h6v1H5V5Zm0 2h6v1H5V7Zm0 2h4v1H5V9Z"
              opacity="0.9"
            />
          </svg>
        ),
        right: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            aria-hidden="true"
            style={{ shapeRendering: 'geometricPrecision' }}
            className="text-gray-500"
          >
            <path
              fill="currentColor"
              d="M6.25 3.5 10.75 8l-4.5 4.5-.9-.9L9.05 8 5.35 4.4l.9-.9Z"
            />
          </svg>
        ),
      },
    ],
    [],
  );

  const itemEntries = useMemo(
    () =>
      entries
        .map((e, i) => ({ e, i }))
        .filter((x): x is { e: Extract<MenuEntry, { kind: 'item' }>; i: number } => x.e.kind === 'item'),
    [entries],
  );

  const activeEntry = itemEntries[activeItemIndex]?.e;
  const activeDomId = `${popoverId}-item-${itemEntries[activeItemIndex]?.i ?? 0}`;

  useEffect(() => {
    if (!isOpen) return;

    const btn = buttonRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const x = Math.round(rect.left);
    const y = Math.round(rect.bottom + 8);
    const maxH = Math.max(240, Math.min(670, window.innerHeight - y - 16));
    setPopoverPos({ x, y, maxH });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    // Focus the menu container so arrow keys work immediately.
    queueMicrotask(() => {
      menuRef.current?.focus();
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      const pop = popoverRef.current;
      const btn = buttonRef.current;
      const t = e.target as Node | null;
      if (!t) return;
      if (pop?.contains(t)) return;
      if (btn?.contains(t)) return;
      setIsOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setIsOpen(false);
      buttonRef.current?.focus();
    };

    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, { capture: true } as never);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    const max = itemEntries.length - 1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveItemIndex((v) => (v >= max ? 0 : v + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveItemIndex((v) => (v <= 0 ? max : v - 1));
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      setActiveItemIndex(0);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      setActiveItemIndex(max);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeEntry?.disabled) return;
      activeEntry?.onSelect?.();
      setIsOpen(false);
      buttonRef.current?.focus();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      buttonRef.current?.focus();
      return;
    }
  };

  return (
    <div className="relative flex items-center px-4 gap-2 border-b border-gray-200" style={{ backgroundColor: 'rgb(255, 236, 227)', height: '32px' }}>
      {/* Dynamic table tabs */}
      {tables.map((table) => (
        <button
          key={table.id}
          ref={(el) => {
            if (el) {
              tableButtonRefs.current.set(table.id, el);
            } else {
              tableButtonRefs.current.delete(table.id);
            }
          }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${
            table.isActive
              ? 'bg-white border border-gray-300 font-medium'
              : 'hover:bg-white/50 text-gray-700'
          }`}
        >
          <span>{table.name}</span>
          <ChevronDown className="w-4 h-4 text-gray-500" />
        </button>
      ))}

      {/* Add button */}
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${popoverId}-menu` : undefined}
        onClick={() => {
          setIsOpen((v) => {
            const next = !v;
            if (next) setActiveItemIndex(0);
            return next;
          });
        }}
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/50 rounded text-sm text-gray-700"
      >
        <Plus className="w-4 h-4" />
      </button>

      <div className="flex-1" />

      {/* Tools (moved up from view bar) */}
      <button className="flex items-center gap-1.5 px-2 py-1 hover:bg-white/50 rounded text-sm text-gray-700">
        <span>Tools</span>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>

      {isOpen && popoverPos && (
        <div
          ref={popoverRef}
          role="dialog"
          tabIndex={-1}
          className="light-scrollbar fixed z-50 w-[280px] min-w-[280px] max-w-[940px] overflow-y-auto rounded-xl bg-white text-gray-900 shadow-2xl ring-1 ring-black/5 focus:outline-none"
          style={{
            inset: '0px auto auto 0px',
            transform: `translate3d(${popoverPos.x}px, ${popoverPos.y}px, 0px)`,
            maxHeight: popoverPos.maxH,
          }}
        >
          <ul
            id={`${popoverId}-menu`}
            ref={menuRef}
            role="menu"
            tabIndex={-1}
            aria-activedescendant={activeDomId}
            onKeyDown={onMenuKeyDown}
            className="p-2"
          >
            {entries.map((entry, idx) => {
              if (entry.kind === 'heading') {
                return (
                  <li
                    key={`h-${idx}`}
                    role="presentation"
                    className="mx-1 mb-1 mt-2 truncate text-[12px] leading-4 text-gray-500 first:mt-0"
                  >
                    {entry.label}
                  </li>
                );
              }

              if (entry.kind === 'divider') {
                return (
                  <li
                    key={`d-${idx}`}
                    role="presentation"
                    className="mx-1 my-1 h-px bg-gray-200"
                    style={{ height: 1 }}
                  />
                );
              }

              const itemPos = itemEntries.findIndex((x) => x.i === idx);
              const isActive = itemPos === activeItemIndex;

              return (
                <li
                  key={`i-${idx}`}
                  id={`${popoverId}-item-${idx}`}
                  role="menuitem"
                  tabIndex={-1}
                  aria-label={entry.ariaLabel ?? entry.label}
                  aria-disabled={entry.disabled ? 'true' : 'false'}
                  className={[
                    'flex w-full cursor-pointer items-center rounded-md px-2 py-2 text-[14px] leading-5',
                    isActive ? 'bg-gray-100' : 'hover:bg-gray-50',
                    entry.disabled ? 'cursor-not-allowed opacity-50' : '',
                  ].join(' ')}
                  onMouseEnter={() => {
                    if (itemPos >= 0) setActiveItemIndex(itemPos);
                  }}
                  onMouseMove={() => {
                    if (itemPos >= 0 && activeItemIndex !== itemPos) setActiveItemIndex(itemPos);
                  }}
                  onClick={() => {
                    if (entry.disabled) return;
                    entry.onSelect?.();
                    setIsOpen(false);
                    buttonRef.current?.focus();
                  }}
                >
                  {entry.leftIcon ? (
                    <div className="mr-2 flex items-center text-gray-500">{entry.leftIcon}</div>
                  ) : null}

                  <span className="flex min-w-0 flex-1 items-center justify-between">
                    <span className="truncate">{entry.label}</span>
                    {entry.right ? <span className="ml-2 flex items-center">{entry.right}</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Table Creation Dropdown */}
      {showTableCreation && tableCreationPos && creatingTableId !== null && (
        <TableCreationDropdown
          tableName={tables.find((t) => t.id === creatingTableId)?.name ?? ''}
          position={tableCreationPos}
          onSave={(tableName, recordTerm) => {
            console.log('Creating table:', tableName, 'with record term:', recordTerm);
            // Update the table name
            setTables((prevTables) =>
              prevTables.map((t) => (t.id === creatingTableId ? { ...t, name: tableName } : t)),
            );
            setShowTableCreation(false);
            setCreatingTableId(null);
            // TODO: Create table in database
          }}
          onCancel={() => {
            // Remove the table if cancelled
            setTables((prevTables) => prevTables.filter((t) => t.id !== creatingTableId));
            setShowTableCreation(false);
            setCreatingTableId(null);
          }}
          onClickOutside={() => {
            // Just close the dropdown, keep the table with its current name
            setShowTableCreation(false);
            setCreatingTableId(null);
            // TODO: Create table in database with default name
          }}
        />
      )}
    </div>
  );
}
