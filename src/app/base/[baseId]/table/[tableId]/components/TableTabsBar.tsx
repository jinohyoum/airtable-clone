'use client';

import { ChevronDown } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '~/trpc/react';
import TableCreationDropdown from './TableCreationDropdown';

const ICON_SPRITE = '/icons/icon_definitions.svg?v=04661fff742a9043fa037c751b1c6e66';

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
  const params = useParams();
  const router = useRouter();
  const baseId = ((params?.baseId as string | undefined) ?? '').toString();
  const currentTableId = ((params?.tableId as string | undefined) ?? '').toString();
  const hasBaseId = baseId.length > 0;
  const hasCurrentTableId = currentTableId.length > 0;
  
  const popoverId = useId();
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLUListElement | null>(null);

  const tableMenuId = useId();
  const tableMenuButtonRef = useRef<HTMLDivElement | null>(null);
  const tableMenuPopoverRef = useRef<HTMLDivElement | null>(null);
  const tableMenuRef = useRef<HTMLUListElement | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number; maxH: number } | null>(
    null,
  );

  const [isTableMenuOpen, setIsTableMenuOpen] = useState(false);
  const [tableMenuPos, setTableMenuPos] = useState<
    { x: number; y: number; maxH: number; maxW: number } | null
  >(null);
  const [showRenameForm, setShowRenameForm] = useState(false);
  const [renameFormPos, setRenameFormPos] = useState<{ x: number; y: number } | null>(null);
  const [activeOverrideTableId, setActiveOverrideTableId] = useState<string | null>(null);
  const [optimisticTable, setOptimisticTable] = useState<{ id: string; name: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmPos, setDeleteConfirmPos] = useState<{ x: number; y: number } | null>(null);
  const [tableToDelete, setTableToDelete] = useState<{ id: string; name: string } | null>(null);
  const deleteConfirmRef = useRef<HTMLDivElement | null>(null);
  const pendingCreateRef = useRef<{ tempId: string; defaultName: string; prevTableId: string } | null>(
    null,
  );
  const queuedRenameRef = useRef<{ name: string; recordTerm: string } | null>(null);
  const deleteNavRef = useRef<{ fromTableId: string; toTableId: string | null } | null>(null);

  const setTablesSaving = (count: number) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('tables:saving', { detail: { count } }));
  };

  // Find the smallest positive "Table N" that isn't already taken
  const findSmallestAvailableTableName = (existingTables: Array<{ name: string }>) => {
    const existingNames = new Set(existingTables.map(t => t.name));
    let n = 1;
    while (existingNames.has(`Table ${n}`)) {
      n++;
    }
    return `Table ${n}`;
  };
  // Fetch real tables from database
  const { data: tablesData } = api.table.list.useQuery(
    { baseId: baseId ?? "" },
    { enabled: hasBaseId },
  );
  
  // Get utils for invalidating queries
  const utils = api.useUtils();
  
  // Check URL for showRename parameter and display form
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const shouldShowRename = urlParams.get('showRename') === 'true';
      
      if (shouldShowRename && tablesData && hasCurrentTableId) {
        // Remove the parameter from URL immediately
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
        
        // Wait a bit for the tab to render, then show the form
        setTimeout(() => {
          const activeTab = document.querySelector('.activeTab');
          if (activeTab) {
            const rect = activeTab.getBoundingClientRect();
            // Center the dropdown (299px width) on the tab's right edge
            const dropdownWidth = 299;
            setRenameFormPos({
              x: rect.right - dropdownWidth / 2,
              y: rect.bottom,
            });
            setShowRenameForm(true);
          }
        }, 50);
      }
    }
  }, [tablesData, currentTableId, hasCurrentTableId]);

  // Allow other UI surfaces (like the empty-state) to open the "Add or import" dropdown.
  useEffect(() => {
    const onOpen = () => {
      setIsOpen(true);
      setActiveItemIndex(0);
    };
    window.addEventListener('tables:openAddImport', onOpen as EventListener);
    return () => window.removeEventListener('tables:openAddImport', onOpen as EventListener);
  }, []);

  // Clear the active override once the URL has caught up
  useEffect(() => {
    if (activeOverrideTableId && currentTableId === activeOverrideTableId) {
      setActiveOverrideTableId(null);
    }
  }, [activeOverrideTableId, currentTableId]);

  // Keep the rename dropdown pinned under the active tab
  useEffect(() => {
    if (!showRenameForm) return;
    setTimeout(() => {
      const activeTab = document.querySelector('.activeTab');
      if (!activeTab) return;
      const rect = activeTab.getBoundingClientRect();
      // Center the dropdown (299px width) on the tab's right edge
      const dropdownWidth = 299;
      setRenameFormPos({ x: rect.right - dropdownWidth / 2, y: rect.bottom });
    }, 0);
  }, [showRenameForm, activeOverrideTableId, currentTableId, tablesData, optimisticTable]);

  // Drop the optimistic tab once it exists in the real list and we're on it
  useEffect(() => {
    if (!optimisticTable) return;
    if (!tablesData) return;
    const exists = tablesData.some((t) => t.id === optimisticTable.id);
    if (exists && currentTableId === optimisticTable.id) {
      setOptimisticTable(null);
    }
  }, [currentTableId, optimisticTable, tablesData]);
  
  // tRPC mutation for creating tables
  const createTableMutation = api.table.create.useMutation({
    onSuccess: (newTable) => {
      const pending = pendingCreateRef.current;

      // Invalidate and refetch the table list so new table appears immediately
      void utils.table.list.invalidate({ baseId });

      // Optimistically append to the cached list so the tab appears instantly
      utils.table.list.setData({ baseId }, (old) => {
        const prev = old ?? [];
        if (prev.some((t) => t.id === newTable.id)) return prev;
        return [...prev, newTable];
      });
      
      // Close the add table dropdown
      setIsOpen(false);

      // Keep the new tab selected while we navigate
      setActiveOverrideTableId(newTable.id);

      // Replace optimistic temp tab (if any) with the real one
      if (pending) {
        setOptimisticTable({ id: newTable.id, name: newTable.name });
        pendingCreateRef.current = null;
      }

      // Navigate to the new table (client-side, fast)
      void router.replace(`/base/${baseId}/table/${newTable.id}`);

      // If the user already typed a different name while creating, apply it now
      const queued = queuedRenameRef.current;
      const queuedName = queued?.name;
      if (queuedName && queuedName !== newTable.name) {
        updateTableMutation.mutate({ id: newTable.id, name: queuedName });
        queuedRenameRef.current = null;
      }
    },
  });
  
  // tRPC mutation for updating table name
  const updateTableMutation = api.table.update.useMutation({
    onMutate: async ({ id, name }) => {
      setTablesSaving(1);
      await utils.table.list.cancel({ baseId });
      const previous = utils.table.list.getData({ baseId });

      // Optimistically update the table name (only if name is provided)
      if (name) {
        utils.table.list.setData({ baseId }, (old) => {
          if (!old) return old;
          return old.map((t) => (t.id === id ? { ...t, name } : t));
        });

        // Update optimistic table state if it matches
        if (optimisticTable?.id === id) {
          setOptimisticTable({ id, name });
        }
      }

      return { previous };
    },
    onError: (error, _variables, context) => {
      console.error('Failed to update table:', error);
      if (context?.previous) {
        utils.table.list.setData({ baseId }, context.previous);
      }
      const msg =
        (error as unknown as { message?: string })?.message?.trim() ??
        'Failed to update table name. Please try again.';
      alert(msg);
    },
    onSuccess: () => {
      void utils.table.list.invalidate({ baseId });
      // Form is already closed when Save is clicked, but ensure it's closed here too
      setShowRenameForm(false);
      setRenameFormPos(null);
    },
    onSettled: () => {
      setTablesSaving(0);
    },
  });

  const deleteTableMutation = api.table.delete.useMutation({
    onMutate: async ({ id }) => {
      setTablesSaving(1);
      await utils.table.list.cancel({ baseId });
      const previous = utils.table.list.getData({ baseId });

      utils.table.list.setData({ baseId }, (old) => {
        if (!old) return old;
        return old.filter((t) => t.id !== id);
      });

      return { previous };
    },
    onError: (error, _variables, context) => {
      console.error('Failed to delete table:', error);
      if (context?.previous) {
        utils.table.list.setData({ baseId }, context.previous);
      }

      // If we optimistically navigated away from the deleted table, bring the user back.
      const nav = deleteNavRef.current;
      if (nav?.fromTableId) {
        setActiveOverrideTableId(null);
        void router.replace(`/base/${baseId}/table/${nav.fromTableId}`);
      }
      deleteNavRef.current = null;

      const msg =
        (error as unknown as { message?: string })?.message?.trim() ??
        'Failed to delete table. Please try again.';
      alert(msg);
    },
    onSuccess: () => {
      void utils.table.list.invalidate({ baseId });
    },
    onSettled: () => {
      setTablesSaving(0);
      deleteNavRef.current = null;
    },
  });

  const handleDeleteTable = (tableIdToDelete: string) => {
    if (!tableIdToDelete || deleteTableMutation.isPending) return;

    // After deletion, always navigate to the LEFT-MOST remaining table.
    // `tablesData` is ordered by createdAt asc in the backend router.
    const realTables = utils.table.list.getData({ baseId }) ?? tablesData ?? [];
    const leftMostRemainingTableId =
      realTables.find((t) => t.id !== tableIdToDelete)?.id ?? null;

    try {
      // If we just deleted the active table, optimistically move somewhere valid immediately.
      if (currentTableId === tableIdToDelete) {
        deleteNavRef.current = {
          fromTableId: tableIdToDelete,
          toTableId: leftMostRemainingTableId,
        };

        setOptimisticTable(null);
        setActiveOverrideTableId(leftMostRemainingTableId);

        if (leftMostRemainingTableId) {
          void router.replace(`/base/${baseId}/table/${leftMostRemainingTableId}`);
        } else {
          void router.replace(`/base/${baseId}/table`);
        }
      }

      deleteTableMutation.mutate({ id: tableIdToDelete });

    } catch {
      // handled in onError
    }
  };
  
  const activeTableId = activeOverrideTableId ?? currentTableId ?? '';

  // Transform database tables to UI format
  const tables = (tablesData ?? []).map((table) => ({
    id: table.id,
    name: table.name,
    isActive: table.id === activeTableId,
    isOptimistic: false,
  }));

  const tabs = useMemo(() => {
    if (!optimisticTable) return tables;
    // Avoid duplicates if the optimistic table has already landed in the query result
    if (tables.some((t) => t.id === optimisticTable.id)) return tables;
    return [
      ...tables.map((t) => ({ ...t, isActive: t.id === activeTableId })),
      {
        id: optimisticTable.id,
        name: optimisticTable.name,
        isActive: optimisticTable.id === activeTableId,
        isOptimistic: true,
      },
    ];
  }, [activeTableId, optimisticTable, tables]);

  const entries: MenuEntry[] = useMemo(
    () => [
      { kind: 'heading', label: 'Add a blank table' },
      {
        kind: 'item',
        label: createTableMutation.isPending ? 'Creating...' : 'Start from scratch',
        ariaLabel: 'Start from scratch',
        disabled: createTableMutation.isPending,
        onSelect: () => {
          // Make the tab + dropdown appear immediately (Airtable-like),
          // while the real table is created in the background.
          const existingTables = (tablesData ?? []).map((t) => ({ name: t.name }));
          if (optimisticTable) existingTables.push({ name: optimisticTable.name });
          const defaultName = findSmallestAvailableTableName(existingTables);
          const tempId = `__creating__${Date.now()}`;

          pendingCreateRef.current = { tempId, defaultName, prevTableId: currentTableId };
          queuedRenameRef.current = null;

          setIsOpen(false);
          setOptimisticTable({ id: tempId, name: defaultName });
          setActiveOverrideTableId(tempId);
          setRenameFormPos(null);
          setShowRenameForm(true);

          // Switch the main content to a lightweight "Creating…" state immediately
          void router.push(`/base/${baseId}/table/${tempId}`);

          createTableMutation.mutate(
            {
              baseId,
              name: defaultName,
              recordTerm: 'Record',
            },
            {
              onError: (err) => {
                console.error('Failed to create table:', err);
                setShowRenameForm(false);
                setRenameFormPos(null);
                setOptimisticTable(null);
                setActiveOverrideTableId(null);
                const prev = pendingCreateRef.current?.prevTableId;
                if (prev) void router.replace(`/base/${baseId}/table/${prev}`);
                pendingCreateRef.current = null;
                queuedRenameRef.current = null;
                alert('Failed to create table. Please try again.');
              },
            },
          );
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
            height="16"
            viewBox="0 0 16 16"
            style={{ shapeRendering: 'geometricPrecision' }}
            aria-hidden="true"
          >
            <use
              fill="currentColor"
              href={`${ICON_SPRITE}#Airtable`}
            />
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
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              className="flex-none mr-half"
              style={{ shapeRendering: 'geometricPrecision' }}
              aria-hidden="true"
            >
              <use
                fill="currentColor"
                href="/icons/icon_definitions.svg?v=04661fff742a9043fa037c751b1c6e66#Plus"
              />
            </svg>
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
    [
      baseId,
      router,
      createTableMutation,
      currentTableId,
      tablesData?.length,
      optimisticTable,
    ],
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
    if (!isTableMenuOpen) return;

    const tabEl = document.getElementById(`tableTab-${activeTableId}`);
    const rect = tabEl?.getBoundingClientRect();
    if (!rect) return;

    // Align popover's LEFT edge to the active table tab's LEFT edge.
    const width = 330;
    const rawX = Math.round(rect.left);
    const x = Math.max(8, Math.min(rawX, window.innerWidth - width - 8));
    const y = Math.round(rect.bottom + 8);
    const maxH = Math.max(240, Math.min(670, window.innerHeight - y - 16));
    const maxW = Math.max(width, Math.min(window.innerWidth - 16, 1295.88));
    setTableMenuPos({ x, y, maxH, maxW });
  }, [isTableMenuOpen, activeTableId]);

  // If the active table changes, close the menu (matches Airtable behavior).
  useEffect(() => {
    setIsTableMenuOpen(false);
  }, [activeTableId]);

  useEffect(() => {
    if (!isOpen) return;

    // Focus the menu container so arrow keys work immediately.
    queueMicrotask(() => {
      menuRef.current?.focus();
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isTableMenuOpen) return;

    queueMicrotask(() => {
      tableMenuRef.current?.focus();
    });
  }, [isTableMenuOpen]);

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

  useEffect(() => {
    if (!isTableMenuOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      const pop = tableMenuPopoverRef.current;
      const btn = tableMenuButtonRef.current;
      const t = e.target as Node | null;
      if (!t) return;
      if (pop?.contains(t)) return;
      if (btn?.contains(t)) return;
      setIsTableMenuOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setIsTableMenuOpen(false);
      tableMenuButtonRef.current?.focus();
    };

    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, { capture: true } as never);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isTableMenuOpen]);

  // Keep the delete confirmation dialog positioned under the active table tab
  useEffect(() => {
    if (!showDeleteConfirm || !tableToDelete) return;

    const tabEl = document.getElementById(`tableTab-${tableToDelete.id}`);
    const rect = tabEl?.getBoundingClientRect();
    if (!rect) return;

    const x = Math.round(rect.left);
    const y = Math.round(rect.bottom);
    setDeleteConfirmPos({ x, y });
  }, [showDeleteConfirm, tableToDelete, activeTableId, currentTableId]);

  useEffect(() => {
    if (!showDeleteConfirm) return;

    // Focus the Delete button when dialog opens
    queueMicrotask(() => {
      const deleteButton = deleteConfirmRef.current?.querySelector('.focusFirstInModal') as HTMLButtonElement | null;
      deleteButton?.focus();
    });

    const onPointerDown = (e: PointerEvent) => {
      const dialog = deleteConfirmRef.current;
      const t = e.target as Node | null;
      if (!t) return;
      if (dialog?.contains(t)) return;
      setShowDeleteConfirm(false);
      setTableToDelete(null);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setShowDeleteConfirm(false);
      setTableToDelete(null);
    };

    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, { capture: true } as never);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showDeleteConfirm]);

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
    <div className="relative flex items-center" style={{ backgroundColor: 'rgb(230, 252, 232)', height: '32px' }}>
      {/* Table tabs nav */}
      <nav aria-label="Tables" className="flex flex-none" id="appControlsTablesTabs" data-tutorial-selector-id="appControlsTablesTabs">
        {tabs.map((table, index) => (
          <div key={table.id} className="flex" style={{ height: '32px' }}>
            <div 
              className={`flex relative hover-container text-size-default tableTabContainer flex-none lightBase ${
                table.isActive 
                  ? 'rounded-top-right activeTab' 
                  : index === tabs.length - 1 
                    ? 'rounded-top clipRightEdge' 
                    : 'rounded-top'
              }`}
              id={`tableTab-${table.id}`}
              data-testid={`tableTab-${table.name.toLowerCase().replace(/\s+/g, '')}`}
            >
              <div 
                className={`flex flex-auto relative tab focus-visible-within-opaque tableTab flex-none pointer ${
                  table.isActive 
                    ? 'rounded-top-right strong colors-background-default' 
                    : 'rounded-top top-bar-text-dark'
                }`}
                data-tableid={table.id}
                data-tutorial-selector-id={`tableTab-${table.name.toLowerCase().replace(/\s+/g, '')}`}
              >
                <div>
                  <a
                    className={`height-full flex flex-auto items-center max-width-2 no-user-select pl1-and-half ${
                      table.isActive ? 'focus-visible' : 'focus-visible-current-color'
                    }`}
                    href={`/base/${baseId}/table/${table.id}?blocks=hide`}
                    onClick={(e) => {
                      e.preventDefault();
                      router.push(`/base/${baseId}/table/${table.id}`);
                    }}
                    onMouseEnter={() => {
                      // Prefetch table data on hover for instant switching
                      if (!table.isActive && !table.isOptimistic) {
                        void utils.table.getData.prefetch({ tableId: table.id });
                      }
                    }}
                    style={{
                      paddingRight: table.isActive ? '40px' : '12px',
                      outlineOffset: '-5px',
                      color: 'inherit',
                    }}
                  >
                    <span
                      className={table.isActive ? 'truncate-pre strong' : 'truncate-pre'}
                      aria-description={`Tooltip: ${table.name}`}
                      style={
                        table.isActive
                          ? { fontWeight: 500, color: 'rgb(29, 31, 37)', lineHeight: '18px' }
                          : undefined
                      }
                    >
                      {table.name}
                    </span>
                  </a>
                  <div
                    className="absolute top-0 bottom-0 flex items-center no-user-select"
                    style={{ right: '12px' }}
                  >
                    {table.isActive && !table.isOptimistic && (
                      <div
                        ref={tableMenuButtonRef}
                        tabIndex={0}
                        role="button"
                        className="pointer flex-none focus-visible focus-visible-opaque ml1 flex items-center colors-foreground-subtle colors-foreground-default-parent-hover table-tab-menu-trigger"
                        aria-label={`${table.name} table options`}
                        data-tutorial-selector-id="openTableMenuButton"
                        aria-haspopup="true"
                        aria-expanded={isTableMenuOpen}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          // Close "Add/import" if open.
                          setIsOpen(false);
                          setIsTableMenuOpen((v) => !v);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsOpen(false);
                            setIsTableMenuOpen((v) => !v);
                          }
                        }}
                      >
                        <ChevronDown className="w-4 h-4 flex-none icon" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {!table.isActive && <div className="css-baufhl"></div>}
          </div>
        ))}

        {/* Add or import button */}
        <div className="flex-none flex relative css-11vhnav">
          <div
            ref={buttonRef}
            tabIndex={0}
            role="button"
            className="pointer flex items-center flex-none focus-visible-opaque rounded px1-and-half top-bar-text-dark focus-visible"
            id="id_aef449bbafea42dc34427b2eed027b76"
            aria-expanded={isOpen}
            aria-haspopup="true"
            aria-label="Add or import table"
            data-tutorial-selector-id="addTableButton"
            style={{ height: 32 }}
            aria-description={
              tabs.length >= 3 ? 'Tooltip: Add or import table' : undefined
            }
            onClick={() => {
              setIsOpen((v) => {
                const next = !v;
                if (next) setActiveItemIndex(0);
                return next;
              });
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              className="flex-none flex-none my-half"
              style={{ shapeRendering: 'geometricPrecision' }}
            >
              <use
                fill="currentColor"
                href="/icons/icon_definitions.svg?v=04661fff742a9043fa037c751b1c6e66#Plus"
              />
            </svg>
            {tabs.length < 3 && (
              <p
                className="font-family-default text-size-default line-height-3 font-weight-default ml1"
              >
                Add or import
              </p>
            )}
          </div>
        </div>
      </nav>

      <div className="ml-auto flex items-center gap-2 pl-4 pr-1">
        {/* Tools (moved up from view bar) */}
        <button
          type="button"
          className="inline-flex h-8 cursor-pointer select-none items-center box-border rounded-[6px] bg-transparent px-3 py-0 font-family-default text-[13px] font-normal leading-[18px] text-[rgba(0,0,0,0.65)] hover:bg-black/[0.06]"
        >
          <span className="block pr-1">Tools</span>
          <ChevronDown className="block h-4 w-4 flex-none text-[rgba(0,0,0,0.65)]" />
        </button>
      </div>

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

      {isTableMenuOpen && tableMenuPos && (
        <div
          ref={tableMenuPopoverRef}
          role="dialog"
          tabIndex={-1}
          className="baymax rounded-big focus-visible shadow-elevation-high colors-background-raised-popover light-scrollbar"
          data-element-owned-by={`tableTab-${activeTableId}`}
          style={{
            position: 'fixed',
            inset: '0px auto auto 0px',
            width: 330,
            zIndex: 5,
            transform: `translate3d(${tableMenuPos.x}px, ${tableMenuPos.y}px, 0px)`,
            maxHeight: tableMenuPos.maxH,
            maxWidth: tableMenuPos.maxW,
            overflowY: 'auto',
            fontFamily:
              '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
            fontSize: 13,
            fontWeight: 400,
            lineHeight: '18px',
            color: 'rgb(29, 31, 37)',
          }}
        >
          <ul
            id={`${tableMenuId}-menu`}
            ref={tableMenuRef}
            role="menu"
            tabIndex={-1}
            className="p1-and-half"
          >
            <li role="presentation">
              <div
                id={`${tableMenuId}-importData`}
                role="menuitem"
                tabIndex={-1}
                className="rounded py1 px1 text-size-default items-center pointer width-full flex table-tab-menuitem"
                aria-haspopup="true"
                aria-expanded="false"
                onClick={() => {
                  // UI parity only for now; submenu not implemented yet.
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  className="flex-none flex-none mr1 colors-foreground-default"
                  aria-hidden="true"
                  style={{ shapeRendering: 'geometricPrecision' }}
                >
                  <use fill="currentColor" href={`${ICON_SPRITE}#ArrowCircleUp`} />
                </svg>
                <span className="truncate flex-auto no-user-select">Import data</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  className="flex-none flex-none ml1 colors-foreground-default"
                  style={{ shapeRendering: 'geometricPrecision', transform: 'rotate(-90deg)' }}
                  aria-hidden="true"
                >
                  <use fill="currentColor" href={`${ICON_SPRITE}#ChevronDown`} />
                </svg>
              </div>
            </li>

            <li role="presentation" className="m1 colors-background-selected" style={{ height: 1 }} />

            <li
              role="menuitem"
              tabIndex={-1}
              data-tutorial-selector-id="tableMenuItem-renameTable"
              className="rounded py1 px1 text-size-default items-center pointer width-full flex table-tab-menuitem"
              aria-disabled="false"
              onClick={() => {
                setIsTableMenuOpen(false);
                // Show the rename form using the same dropdown as table creation
                setTimeout(() => {
                  const activeTab = document.querySelector('.activeTab');
                  if (activeTab) {
                    const rect = activeTab.getBoundingClientRect();
                    const dropdownWidth = 299;
                    setRenameFormPos({
                      x: rect.right - dropdownWidth / 2,
                      y: rect.bottom,
                    });
                    setShowRenameForm(true);
                  }
                }, 50);
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                className="flex-none flex-none mr1 colors-foreground-default"
                aria-hidden="true"
                style={{ shapeRendering: 'geometricPrecision' }}
              >
                <use fill="currentColor" href={`${ICON_SPRITE}#PencilSimple`} />
              </svg>
              <span className="truncate flex-auto no-user-select">Rename table</span>
            </li>

            <li
              role="menuitem"
              tabIndex={-1}
              data-tutorial-selector-id="tableMenuItem-setTableIsHiddenFromSwitcher"
              className="rounded py1 px1 text-size-default items-center pointer width-full flex table-tab-menuitem"
              aria-disabled="false"
              onClick={() => setIsTableMenuOpen(false)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                className="flex-none flex-none mr1 colors-foreground-default"
                aria-hidden="true"
                style={{ shapeRendering: 'geometricPrecision' }}
              >
                <use fill="currentColor" href={`${ICON_SPRITE}#EyeSlash`} />
              </svg>
              <span className="truncate flex-auto no-user-select">Hide table</span>
            </li>

            <li
              role="menuitem"
              tabIndex={-1}
              className="rounded py1 px1 text-size-default items-center pointer width-full flex table-tab-menuitem"
              onClick={() => setIsTableMenuOpen(false)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                className="flex-none flex-none mr1 colors-foreground-default"
                aria-hidden="true"
                style={{ shapeRendering: 'geometricPrecision' }}
              >
                <use fill="currentColor" href={`${ICON_SPRITE}#FadersHorizontal`} />
              </svg>
              <span className="truncate flex-auto no-user-select">
                <div className="flex items-center justify-between">Manage fields</div>
              </span>
            </li>

            <li
              role="menuitem"
              tabIndex={-1}
              data-tutorial-selector-id="tableMenuItem-duplicateTable"
              className="rounded py1 px1 text-size-default items-center pointer width-full flex table-tab-menuitem"
              aria-disabled="false"
              onClick={() => setIsTableMenuOpen(false)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                className="flex-none flex-none mr1 colors-foreground-default"
                aria-hidden="true"
                style={{ shapeRendering: 'geometricPrecision' }}
              >
                <use fill="currentColor" href={`${ICON_SPRITE}#Copy`} />
              </svg>
              <span className="truncate flex-auto no-user-select">Duplicate table</span>
            </li>

            <li role="presentation" className="m1 colors-background-selected" style={{ height: 1 }} />

            <li
              role="menuitem"
              tabIndex={-1}
              data-tutorial-selector-id="tableMenuItem-dateDependencySettings"
              className="rounded py1 px1 text-size-default items-center pointer width-full flex table-tab-menuitem"
              onClick={() => setIsTableMenuOpen(false)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                className="flex-none flex-none mr1 colors-foreground-default"
                aria-hidden="true"
                style={{ shapeRendering: 'geometricPrecision' }}
              >
                <use fill="currentColor" href={`${ICON_SPRITE}#Gantt`} />
              </svg>
              <span className="truncate flex-auto no-user-select">
                <div className="flex items-center justify-between">Configure date dependencies</div>
              </span>
            </li>

            <li role="presentation" className="m1 colors-background-selected" style={{ height: 1 }} />

            <li
              role="menuitem"
              tabIndex={-1}
              data-tutorial-selector-id="tableMenuItem-editTableDescription"
              className="rounded py1 px1 text-size-default items-center pointer width-full flex table-tab-menuitem"
              aria-disabled="false"
              onClick={() => setIsTableMenuOpen(false)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                className="flex-none flex-none mr1 colors-foreground-default"
                aria-hidden="true"
                style={{ shapeRendering: 'geometricPrecision' }}
              >
                <use fill="currentColor" href={`${ICON_SPRITE}#Info`} />
              </svg>
              <span className="truncate flex-auto no-user-select">Edit table description</span>
            </li>

            <li
              role="menuitem"
              tabIndex={-1}
              data-tutorial-selector-id="tableMenuItem-editTablePermissions"
              className="rounded py1 px1 text-size-default items-center pointer width-full flex table-tab-menuitem"
              onClick={() => setIsTableMenuOpen(false)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                className="flex-none flex-none mr1 colors-foreground-default"
                aria-hidden="true"
                style={{ shapeRendering: 'geometricPrecision' }}
              >
                <use fill="currentColor" href={`${ICON_SPRITE}#Lock`} />
              </svg>
              <span className="truncate flex-auto no-user-select">
                <div className="flex items-center justify-between">Edit table permissions</div>
              </span>
            </li>

            <li role="presentation" className="m1 colors-background-selected" style={{ height: 1 }} />

            <li
              role="menuitem"
              tabIndex={-1}
              data-tutorial-selector-id="tableMenuItem-clearAllTableData"
              className="rounded py1 px1 text-size-default items-center pointer width-full flex table-tab-menuitem"
              aria-disabled="false"
              onClick={() => setIsTableMenuOpen(false)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                className="flex-none flex-none mr1 colors-foreground-default"
                aria-hidden="true"
                style={{ shapeRendering: 'geometricPrecision' }}
              >
                <use fill="currentColor" href={`${ICON_SPRITE}#X`} />
              </svg>
              <span className="truncate flex-auto no-user-select">Clear data</span>
            </li>

            <li
              role="menuitem"
              tabIndex={-1}
              data-tutorial-selector-id="tableMenuItem-deleteTable"
              className="rounded py1 px1 text-size-default items-center pointer width-full flex table-tab-menuitem"
              aria-disabled="false"
              onClick={() => {
                const tableIdToDelete = activeOverrideTableId ?? currentTableId;
                const tableName =
                  tabs.find((t) => t.id === tableIdToDelete)?.name ?? 'this table';

                if (!tableIdToDelete) return;

                // Close the menu immediately for snappy UX
                setIsTableMenuOpen(false);

                // Position the dialog relative to the active table tab (same as table menu)
                setTimeout(() => {
                  const tabEl = document.getElementById(`tableTab-${tableIdToDelete}`);
                  const rect = tabEl?.getBoundingClientRect();
                  if (!rect) return;

                  // Align dialog's LEFT edge to the active table tab's LEFT edge, touching the bottom
                  const x = Math.round(rect.left);
                  const y = Math.round(rect.bottom);
                  setDeleteConfirmPos({ x, y });
                  setTableToDelete({ id: tableIdToDelete, name: tableName });
                  setShowDeleteConfirm(true);
                }, 10);
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                className="flex-none flex-none mr1 colors-foreground-default"
                aria-hidden="true"
                style={{ shapeRendering: 'geometricPrecision' }}
              >
                <use fill="currentColor" href={`${ICON_SPRITE}#Trash`} />
              </svg>
              <span className="truncate flex-auto no-user-select">Delete table</span>
            </li>
          </ul>
        </div>
      )}

      {/* Delete Table Confirmation Dialog */}
      {showDeleteConfirm && deleteConfirmPos && tableToDelete && (
        <div
          ref={deleteConfirmRef}
          className="baymax rounded-big shadow-elevation-high strong absolute"
          style={{
            position: 'fixed',
            backgroundColor: 'rgb(255, 255, 255)',
            minWidth: '200px',
            width: 'min-content',
            maxWidth: '400px',
            top: `${deleteConfirmPos.y}px`,
            left: `${deleteConfirmPos.x}px`,
            padding: '16px',
            fontFamily:
              '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
            fontSize: '13px',
            fontWeight: 500,
            lineHeight: '18px',
            color: 'rgb(29, 31, 37)',
            zIndex: 100,
          }}
        >
          <div
            className="mb1 strong big line-height-4"
            style={{
              marginBottom: '8px',
              fontSize: '14.4px',
              fontWeight: 500,
              lineHeight: '21.6px',
            }}
          >
            Are you sure you want to delete this table?
          </div>
          <div
            className="mb2 quiet"
            style={{
              marginBottom: '16px',
              opacity: 0.75,
              fontSize: '13px',
              lineHeight: '18px',
            }}
          >
            Recently deleted tables can be restored from trash.
            <span className="flex-inline ml-half flex items-center quiet colors-foreground-subtle" style={{ marginLeft: '4px', display: 'inline-flex', verticalAlign: 'middle', pointerEvents: 'none' }}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                className="flex-none icon"
                aria-hidden="true"
                style={{ shapeRendering: 'geometricPrecision', color: 'rgb(97, 102, 112)' }}
              >
                <use fill="currentColor" href={`${ICON_SPRITE}#Question`} />
              </svg>
            </span>
          </div>
          <div className="flex items-center justify-end">
            <button
              className="pointer items-center justify-center border-box text-decoration-none print-color-exact focus-visible rounded-big ignore-baymax-defaults border-none colors-foreground-default background-transparent colors-background-selected-hover px1-and-half button-size-default flex-inline mr1 truncate"
              type="button"
              aria-disabled="false"
              style={{
                maxWidth: '192px',
                height: '32px',
                paddingLeft: '12px',
                paddingRight: '12px',
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowDeleteConfirm(false);
                setTableToDelete(null);
              }}
            >
              <span className="truncate noevents button-text-label no-user-select">Cancel</span>
            </button>
            <button
              className="pointer items-center justify-center border-box text-decoration-none print-color-exact focus-visible rounded-big ignore-baymax-defaults border-none text-white red shadow-elevation-low shadow-elevation-low-hover px1-and-half button-size-default flex-inline truncate focusFirstInModal"
              type="button"
              aria-disabled="false"
              style={{
                maxWidth: '192px',
                height: '32px',
                paddingLeft: '12px',
                paddingRight: '12px',
                boxShadow:
                  'rgba(0, 0, 0, 0.32) 0px 0px 1px 0px, rgba(0, 0, 0, 0.08) 0px 0px 2px 0px, rgba(0, 0, 0, 0.08) 0px 1px 3px 0px',
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowDeleteConfirm(false);
                if (tableToDelete) {
                  handleDeleteTable(tableToDelete.id);
                }
                setTableToDelete(null);
              }}
            >
              <span className="truncate noevents button-text-label no-user-select">Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* Table Rename Form (appears after table is created) */}
      {showRenameForm && renameFormPos && (
        <TableCreationDropdown
          tableName={tabs.find((t) => t.id === (activeOverrideTableId ?? currentTableId))?.name ?? 'Table'}
          onSave={(name: string, recordTerm: string) => {
            const activeId = activeOverrideTableId ?? currentTableId;
            const currentTable = tabs.find((t) => t.id === activeId);
            if (!activeId) return;

            // Prevent saving if name is empty or already exists
            const trimmedName = name.trim();
            if (!trimmedName) return;
            const nameExists = tabs.some((t) => t.id !== activeId && t.name === trimmedName);
            if (nameExists) return;

            // If we're still creating (temp id), queue the rename and close.
            if (activeId.startsWith('__creating__')) {
              queuedRenameRef.current = { name, recordTerm };
              setShowRenameForm(false);
              setRenameFormPos(null);
              return;
            }

            // Close the form immediately when Save is clicked
            setShowRenameForm(false);
            setRenameFormPos(null);

            // Only update if name changed
            if (currentTable && name !== currentTable.name) {
              updateTableMutation.mutate({
                id: activeId,
                name,
              });
            }
          }}
          onCancel={() => {
            setShowRenameForm(false);
            setRenameFormPos(null);
          }}
          onClickOutside={() => {
            setShowRenameForm(false);
            setRenameFormPos(null);
          }}
          position={renameFormPos}
        />
      )}

    </div>
  );
}
