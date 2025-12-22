'use client';

import { Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { api } from '~/trpc/react';

export default function BulkInsertButton() {
  const params = useParams();
  const tableId = params?.tableId as string | undefined;
  const utils = api.useUtils();
  
  const [isInserting, setIsInserting] = useState(false);

  const bulkInsertMutation = api.table.bulkInsertRows.useMutation();

  if (!tableId || tableId.startsWith('__creating__')) {
    return null;
  }

  const handleClick = async () => {
    const totalRows = 100000;
    
    setIsInserting(true);

    try {
      // Single optimized server call - server handles all chunking internally
      const result = await bulkInsertMutation.mutateAsync({
        tableId,
        count: totalRows,
      });

      // Show success message with timing
      const durationSeconds = (result.durationMs / 1000).toFixed(2);
      const message = `Inserted ${result.inserted.toLocaleString()} rows in ${durationSeconds}s`;
      console.log(message);
      // You could also show a toast notification here if you have a toast library

      // Reset the infinite query cache completely so it starts fresh with new data
      // This clears all cached pages so the query will rebuild from scratch
      utils.table.getRows.setInfiniteData({ tableId, limit: 500, search: undefined }, undefined);
      
      // Invalidate to trigger refetch - this will fetch the first page with updated data
      // The query will automatically refetch since it's active (being used by MainContent)
      await utils.table.getRows.invalidate({ tableId, limit: 500, search: undefined });
      
      // Also invalidate the count query if it exists
      void utils.table.getRowCount.invalidate({ tableId, search: undefined });
    } catch (error) {
      console.error('Bulk insert error:', error);
      alert(`Failed to insert rows: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsInserting(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isInserting}
      className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isInserting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
          <span className="text-gray-700">Inserting…</span>
        </>
      ) : (
        <span className="text-gray-700">Add 100k+ rows</span>
      )}
    </button>
  );
}
