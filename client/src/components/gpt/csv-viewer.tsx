import { useState, useEffect } from "react";
import { Table } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CSVViewerProps {
  content: string;
  maxRows?: number;
}

export function CSVViewer({ content, maxRows = 100 }: CSVViewerProps) {
  const [parsedData, setParsedData] = useState<string[][]>([]);
  const [hasHeaders, setHasHeaders] = useState(true);
  
  useEffect(() => {
    if (!content) return;
    
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
          const decoded = atob(base64Part);
          csvContent = decoded;
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
      
      setParsedData(limitedData);
    } catch (error) {
      console.error("Error parsing CSV:", error);
      setParsedData([["Error parsing CSV file - " + (error instanceof Error ? error.message : String(error))]]);
    }
  }, [content, maxRows]);
  
  if (parsedData.length === 0) {
    return <div className="p-4 text-gray-500">No data found in CSV file</div>;
  }
  
  const headers = hasHeaders ? parsedData[0] : [];
  const rows = hasHeaders ? parsedData.slice(1) : parsedData;
  
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
}