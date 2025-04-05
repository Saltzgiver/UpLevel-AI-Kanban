import { Sparkles, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { AssignGPTModal } from "@/components/ui/assign-gpt-modal";
import { Column } from "@shared/schema";

interface GPTBannerProps {
  column: Column;
}

export function GPTBanner({ column }: GPTBannerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (column.gptAssigned) {
    return (
      <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded mb-2 p-2 text-sm shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Sparkles className="h-4 w-4 mr-1 text-green-600" />
            <span className="font-medium text-green-700">{column.gptName}</span>
            <span className="ml-2 text-xs text-muted-foreground">
              {column.gptInstructions && column.gptInstructions.length > 30 
                ? column.gptInstructions.substring(0, 30) + "..."
                : column.gptInstructions}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground p-1 rounded"
            onClick={() => setIsModalOpen(true)}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
        
        <AssignGPTModal
          column={column}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="bg-white border border-border rounded mb-2 p-2 text-sm shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Add custom prompt to this column</span>
        <Button
          size="sm"
          className="bg-green-600 text-white text-xs px-2 py-1 h-7 rounded hover:bg-green-700 transition-colors"
          onClick={() => setIsModalOpen(true)}
        >
          Set Prompt
        </Button>
      </div>
      
      <AssignGPTModal
        column={column}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
