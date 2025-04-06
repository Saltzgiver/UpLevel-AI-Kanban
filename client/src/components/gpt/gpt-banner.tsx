import { Sparkles, Edit, Plus } from "lucide-react";
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
      <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-100 rounded-lg mb-3 p-3 text-sm shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Sparkles className="h-5 w-5 mr-2 text-green-600" />
            <span className="font-semibold text-green-700">GPT Assistant</span>
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
        
        <div className="mt-1 pl-7 text-xs text-gray-600">
          {column.gptInstructions && column.gptInstructions.length > 60 
            ? column.gptInstructions.substring(0, 60) + "..."
            : column.gptInstructions || "Write a paragraph about this"}
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
    <div className="bg-muted/50 border border-border/70 border-dashed rounded-lg mb-3 px-3 py-2 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Sparkles className="h-4 w-4 mr-2 text-muted-foreground/60" />
          <span className="text-muted-foreground text-xs">GPT not assigned</span>
        </div>
        
        <Button
          size="sm"
          className="bg-primary text-white text-xs py-1 px-3 h-7 rounded-md hover:bg-primary/90 transition-colors"
          onClick={() => setIsModalOpen(true)}
        >
          Automate
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
