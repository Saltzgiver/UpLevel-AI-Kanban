import { useState, useEffect, useRef, memo } from "react";
import { Table } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CSVViewerProps {
  content: string;
  maxRows?: number;
  compact?: boolean;
}

// Global render counter for debugging
let renderCount = 0;
// Track content hash to avoid unnecessary re-renders
const contentCache = new Map<string, string[][]>();

// Memoized CSV Viewer to prevent re-renders when content hasn't changed
const MemoizedCSVViewer = memo(function CSVViewerInner({ content, maxRows = 100, compact = true }: CSVViewerProps) {
  // Track component renders
  const componentId = useRef(`csv-viewer-${Math.random().toString(36).substring(2, 9)}`);
  renderCount++;
  console.log(`CSV-JITTER-DEBUG: [${componentId.current}] Render #${renderCount}`);
  
  const [parsedData, setParsedData] = useState<string[][]>([]);
  const [hasHeaders, setHasHeaders] = useState(true);
  const [contentHash, setContentHash] = useState<string>("");
  const [dimensions, setDimensions] = useState({ rows: 0, cols: 0 });
  const lastUpdateTime = useRef(Date.now());
  
  // Generate a simple hash of the content for caching
  const getContentHash = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  };
  
  useEffect(() => {
    if (!content) return;
    
    // Generate a hash to compare with cached values
    const hash = getContentHash(content);
    
    // If we've already parsed this content, use the cached result
    if (contentCache.has(hash)) {
      console.log(`CSV-JITTER-DEBUG: [${componentId.current}] Using cached parsed data for hash ${hash}`);
      setParsedData(contentCache.get(hash)!);
      setContentHash(hash);
      return;
    }
    
    // Log timing info for jitter debugging
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTime.current;
    console.log(`CSV-JITTER-DEBUG: [${componentId.current}] Parsing content, time since last update: ${timeSinceLastUpdate}ms`);
    lastUpdateTime.current = now;
    
    try {
      // Check if content is valid before trying to parse
      if (typeof content !== 'string') {
        console.error("CSV content is not a string:", typeof content);
        setParsedData([["Invalid CSV content format"]]);
        return;
      }
      
      // Handle potential base64 content
      let csvContent = content;
      if (content.startsWith("data:") && content.includes("base64,")) {
        try {
          // Extract base64 part
          const base64Part = content.split("base64,")[1];
          // Using a safer way to decode base64
          try {
            const binaryStr = window.atob(base64Part);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            csvContent = new TextDecoder().decode(bytes);
          } catch (decodeError) {
            console.error("Error decoding CSV content:", decodeError);
            csvContent = content; // Fallback to original content
          }
        } catch (e) {
          console.log("Not a valid base64 data URL, using as-is");
        }
      }
      
      // Simple CSV parser - split by lines and cells
      const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
      
      // Handle different CSV formats (comma, semicolon, tab)
      let delimiter = ',';
      // Check if semicolon is more common
      if (lines.length > 0 && lines[0].includes(';') && lines[0].split(';').length > lines[0].split(',').length) {
        delimiter = ';';
      }
      // Check if tab is more common
      if (lines.length > 0 && lines[0].includes('\t') && lines[0].split('\t').length > lines[0].split(delimiter).length) {
        delimiter = '\t';
      }
      
      const data = lines.map(line => line.split(delimiter).map(cell => {
        let trimmedCell = cell.trim();
        
        // Remove quotes if the cell is quoted
        if ((trimmedCell.startsWith('"') && trimmedCell.endsWith('"')) || 
            (trimmedCell.startsWith("'") && trimmedCell.endsWith("'"))) {
          trimmedCell = trimmedCell.substring(1, trimmedCell.length - 1);
        }
        
        return trimmedCell;
      }));
      
      // Take only the first N rows to prevent performance issues with large files
      const limitedData = data.slice(0, maxRows);
      
      // Store in cache for future reuse
      contentCache.set(hash, limitedData);
      setContentHash(hash);
      
      // Track data dimensions to help with jitter debugging
      setDimensions({
        rows: limitedData.length,
        cols: limitedData.length > 0 ? limitedData[0].length : 0
      });
      
      setParsedData(limitedData);
      console.log(`CSV-JITTER-DEBUG: [${componentId.current}] Done parsing, data size: ${limitedData.length} rows x ${limitedData.length > 0 ? limitedData[0].length : 0} cols`);
    } catch (error) {
      console.error("Error parsing CSV:", error);
      setParsedData([["Error parsing CSV file - " + (error instanceof Error ? error.message : String(error))]]);
    }
  }, [content, maxRows, componentId]);
  
  if (parsedData.length === 0) {
    return <div className="p-4 text-gray-500">No data found in CSV file</div>;
  }
  
  const headers = hasHeaders ? parsedData[0] : [];
  const rows = hasHeaders ? parsedData.slice(1) : parsedData;
  
  // Compact version for chat messages
  if (compact) {
    // If there's very little data, render an even more compact view
    const isSmallDataset = rows.length <= 3 && parsedData[0]?.length <= 3;
    
    return (
      <div className="w-full overflow-hidden rounded border border-gray-200 my-2 bg-white shadow-sm" 
           style={{ 
             width: '100%', 
             minHeight: isSmallDataset ? 'auto' : '100px',
             maxHeight: isSmallDataset ? 'auto' : '200px'
           }}>
        <div className="flex items-center justify-between bg-gray-50 px-2 py-1 border-b border-gray-100 text-[10px]">
          <div className="text-gray-500 font-medium">
            CSV Data {rows.length > 0 && `(${rows.length} rows)`}
          </div>
          {!isSmallDataset && (
            <label className="flex items-center space-x-1">
              <input 
                type="checkbox" 
                checked={hasHeaders} 
                onChange={() => setHasHeaders(!hasHeaders)}
                className="rounded border-gray-200 h-3 w-3"
              />
              <span className="text-gray-500">Headers</span>
            </label>
          )}
        </div>
        
        {/* Fixed height container to prevent layout shifts */}
        <div className="w-full" style={{ 
            height: isSmallDataset ? 'auto' : '150px',
            maxHeight: '200px', 
            overflow: 'hidden'
          }}>
          <div className="w-full h-full overflow-auto" style={{ maxWidth: '100%' }}>
            <table className="w-full table-fixed border-collapse text-left" style={{ minWidth: '250px' }}>
              <thead className="sticky top-0 z-10 bg-white border-b border-gray-100">
                <tr>
                  {hasHeaders ? (
                    headers.map((header, index) => (
                      <th key={index} 
                          className="px-2 py-1 text-[9px] font-medium text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis"
                          style={{ maxWidth: '120px', width: `${Math.min(120, Math.max(60, 80 / Math.max(1, headers.length)))}px` }}>
                        {header}
                      </th>
                    ))
                  ) : (
                    // Generate column index headers if no headers detected
                    Array.from({ length: parsedData[0]?.length || 0 }).map((_, index) => (
                      <th key={index} className="px-2 py-1 text-[9px] font-medium text-gray-600 whitespace-nowrap"
                          style={{ width: `${Math.min(120, Math.max(60, 80 / Math.max(1, parsedData[0]?.length || 1)))}px` }}>
                        {index + 1}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, rowIndex) => (
                  <tr 
                    key={rowIndex} 
                    className={rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    {row.map((cell, cellIndex) => (
                      <td 
                        key={cellIndex} 
                        className="px-2 py-1 text-[9px] text-gray-700 overflow-hidden text-ellipsis"
                        style={{ maxWidth: '120px' }}
                        title={cell} // Show full content on hover
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
  
  // Full size version for attachments/standalone view
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-500">
          Showing {rows.length} rows
          {parsedData.length > maxRows && " (limited to prevent performance issues)"}
        </div>
        <label className="flex items-center space-x-2">
          <input 
            type="checkbox" 
            checked={hasHeaders} 
            onChange={() => setHasHeaders(!hasHeaders)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-700">First row as headers</span>
        </label>
      </div>
      
      <ScrollArea className="h-[350px] rounded-md border">
        <div className="p-1">
          <Table>
            <thead className="sticky top-0 bg-white border-b">
              <tr>
                {hasHeaders ? (
                  headers.map((header, index) => (
                    <th key={index} className="px-2 py-1 text-sm font-medium text-gray-900">
                      {header}
                    </th>
                  ))
                ) : (
                  // Generate column index headers if no headers detected
                  Array.from({ length: parsedData[0]?.length || 0 }).map((_, index) => (
                    <th key={index} className="px-2 py-1 text-sm font-medium text-gray-900">
                      Column {index + 1}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr 
                  key={rowIndex} 
                  className={rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  {row.map((cell, cellIndex) => (
                    <td 
                      key={cellIndex} 
                      className="px-2 py-1 text-sm text-gray-700 border-t border-gray-200 truncate max-w-[250px]"
                      title={cell} // Show full content on hover
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </ScrollArea>
    </div>
  );
});

// Export a memo-wrapped version to ensure stability during parent re-renders
export function CSVViewer(props: CSVViewerProps) {
  // Log CSVViewer render to track jitter
  console.log("CSV-JITTER-DEBUG: [Main Wrapper] Rendering CSVViewer");
  
  // Return memoized component - this won't change references during typing
  return (
    <div className="csv-viewer-stable-container" style={{ 
      // Lock dimensions to prevent jitter
      width: "100%", 
      position: "relative",
      // Set explicit min-height to prevent layout shifts when content loads
      minHeight: props.compact ? "50px" : "200px" 
    }}>
      <MemoizedCSVViewer {...props} />
    </div>
  );
}