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
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-md mb-2 p-2 text-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Sparkles className="h-4 w-4 mr-1 text-primary" />
            <span className="font-medium text-primary">{column.gptName}</span>
            <span className="ml-2 text-xs text-muted-foreground">
              {column.gptInstructions && column.gptInstructions.length > 30 
                ? column.gptInstructions.substring(0, 30) + "..."
                : column.gptInstructions}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-primary/70 hover:text-primary hover:bg-primary/10 p-1 rounded-full"
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
    <div className="bg-muted/30 border border-border/50 rounded-md mb-2 p-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground flex items-center">
          <Sparkles className="h-3 w-3 mr-1 text-muted-foreground" />
          Add automation to this column
        </span>
        <Button
          size="sm"
          className="bg-primary/90 text-white text-xs px-3 py-1 h-7 rounded-full hover:bg-primary transition-colors"
          onClick={() => setIsModalOpen(true)}
        >
          Add GPT
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
