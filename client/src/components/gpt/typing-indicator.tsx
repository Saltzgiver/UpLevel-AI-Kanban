import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

// Define interface for WebSocket payload
interface TypingPayload {
  type: 'typing';
  cardId: number;
  gptName: string;
  gptColor: string | null;
  isTyping: boolean;
}

interface TypingIndicatorProps {
  cardId: number;
  className?: string;
}

export function TypingIndicator({ cardId, className = '' }: TypingIndicatorProps) {
  const [isTyping, setIsTyping] = useState(false);
  const [aiName, setAiName] = useState<string>('AI');
  const [aiColor, setAiColor] = useState<string | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    // Initialize WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log(`[TypingIndicator] Connecting to WebSocket at ${wsUrl}`);
    const newSocket = new WebSocket(wsUrl);

    newSocket.onopen = () => {
      console.log(`[TypingIndicator] WebSocket connection established`);
      // Subscribe to updates for this card
      newSocket.send(JSON.stringify({
        type: 'subscribe',
        cardId: cardId,
      }));
    };

    newSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'typing' && data.cardId === cardId) {
          console.log(`[TypingIndicator] Received typing update:`, data);
          setIsTyping(data.isTyping);
          
          if (data.gptName) {
            setAiName(data.gptName);
          }
          
          if (data.gptColor) {
            setAiColor(data.gptColor);
          }
        }
      } catch (error) {
        console.error(`[TypingIndicator] Error processing WebSocket message:`, error);
      }
    };

    newSocket.onerror = (error) => {
      console.error(`[TypingIndicator] WebSocket error:`, error);
    };

    newSocket.onclose = () => {
      console.log(`[TypingIndicator] WebSocket connection closed`);
    };

    setSocket(newSocket);

    // Clean up WebSocket connection when component unmounts
    return () => {
      if (newSocket.readyState === WebSocket.OPEN) {
        newSocket.close();
      }
    };
  }, [cardId]);

  // Don't render anything if not typing
  if (!isTyping) return null;

  return (
    <div className={`flex items-start ${className}`}>
      <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg max-w-[80%]">
        <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
        <span className="text-sm text-gray-600">
          {aiName} is typing...
        </span>
      </div>
    </div>
  );
}