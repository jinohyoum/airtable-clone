'use client';

import { Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { api } from '~/trpc/react';

export default function BulkInsertButton() {
  const params = useParams();
  const tableId = params?.tableId as string | undefined;
  const utils = api.useUtils();
  
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [isInserting, setIsInserting] = useState(false);

  const bulkInsertMutation = api.table.bulkInsertRows.useMutation();

  if (!tableId || tableId.startsWith('__creating__')) {
    return null;
  }

  const handleClick = async () => {
    const totalRows = 100000;
    const chunkSize = 10000; // Insert in 10k chunks for progress updates
    const numChunks = Math.ceil(totalRows / chunkSize);
    
    setIsInserting(true);
    setProgress({ current: 0, total: totalRows });

    try {
      let globalOffset = 0;
      
      // Insert in chunks to show progress
      for (let i = 0; i < numChunks; i++) {
        const chunkStart = i * chunkSize;
        const chunkEnd = Math.min(chunkStart + chunkSize, totalRows);
        const chunkCount = chunkEnd - chunkStart;

        try {
          const result = await bulkInsertMutation.mutateAsync({
            tableId,
            count: chunkCount,
            startOrderOffset: globalOffset, // Pass offset for correct ordering
          });

          // Update progress based on actual inserted count
          const inserted = result.inserted ?? chunkCount;
          globalOffset += inserted;
          setProgress({ current: chunkEnd, total: totalRows });
        } catch (chunkError) {
          console.error(`Error inserting chunk ${i + 1}/${numChunks}:`, chunkError);
          // Continue with next chunk even if one fails
          globalOffset += chunkCount;
        }
      }

      // Invalidate the rows query to refetch data
      void utils.table.getRows.invalidate({ tableId, limit: 200 });
    } catch (error) {
      console.error('Bulk insert error:', error);
      alert(`Failed to insert all rows: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsInserting(false);
      setProgress(null);
    }
  };

  const progressPercent = progress ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="relative flex items-center">
      <button
        onClick={handleClick}
        disabled={isInserting}
        className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isInserting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
            <span className="text-gray-700">
              {progress ? `${progressPercent}%` : 'Inserting…'}
            </span>
          </>
        ) : (
          <span className="text-gray-700">Add 100k+ rows</span>
        )}
      </button>
      
      {/* Progress bar - positioned below the button area */}
      {isInserting && progress && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50">
          <div className="bg-white border border-gray-200 rounded shadow-lg p-2 min-w-[200px]">
            <div className="text-xs text-gray-600 mb-1">
              Inserting rows: {progress.current.toLocaleString()} / {progress.total.toLocaleString()}
            </div>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1 text-right">
              {progressPercent}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
