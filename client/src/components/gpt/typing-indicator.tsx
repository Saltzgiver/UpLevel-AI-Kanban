import React, { useEffect, useState, useRef } from 'react';
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
  
  // Add a ref to track connection status - preventing unnecessary reconnections
  const isConnectedRef = useRef(false);
  // Add a ref to track connection attempts to avoid excessive reconnections
  const connectionAttemptsRef = useRef(0);

  // Function to establish WebSocket connection
  const connectWebSocket = () => {
    // Only connect if not already connected
    if (isConnectedRef.current) return;
    
    // Limit reconnection attempts
    if (connectionAttemptsRef.current > 3) {
      console.warn('[TypingIndicator] Too many connection attempts, giving up');
      return;
    }
    
    connectionAttemptsRef.current += 1;
    
    // Initialize WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;
    
    console.log(`🔌 [TypingIndicator] Connecting to WebSocket at ${wsUrl}`);
    
    try {
      const newSocket = new WebSocket(wsUrl);

      newSocket.onopen = () => {
        console.log(`✅ [TypingIndicator] WebSocket connection established`);
        isConnectedRef.current = true;
        
        // Reset reconnection counter on successful connection
        connectionAttemptsRef.current = 0;
        
        // Subscribe to updates for this card
        try {
          const subscribePayload = JSON.stringify({
            type: 'subscribe',
            cardId: cardId,
          });
          console.log(`📤 [TypingIndicator] Sending subscription:`, subscribePayload);
          newSocket.send(subscribePayload);
        } catch (sendError) {
          console.error(`❌ [TypingIndicator] Error sending subscription:`, sendError);
        }
      };

      newSocket.onmessage = (event) => {
        try {
          console.log(`📥 [TypingIndicator] Received message:`, event.data);
          const data = JSON.parse(event.data);
          
          // Handle subscription confirmation
          if (data.type === 'subscribed' && data.cardId === cardId) {
            console.log(`✅ [TypingIndicator] Successfully subscribed to card ${cardId}`);
          }
          
          // Handle typing status updates
          if (data.type === 'typing' && data.cardId === cardId) {
            console.log(`🔄 [TypingIndicator] Received typing update:`, data);
            setIsTyping(data.isTyping);
            
            if (data.gptName) {
              setAiName(data.gptName);
            }
            
            if (data.gptColor) {
              setAiColor(data.gptColor);
            }
          }
        } catch (error) {
          console.error(`❌ [TypingIndicator] Error processing WebSocket message:`, error);
        }
      };

      newSocket.onerror = (error) => {
        console.error(`❌ [TypingIndicator] WebSocket error:`, error);
        isConnectedRef.current = false;
      };

      newSocket.onclose = (event) => {
        console.log(`🔌 [TypingIndicator] WebSocket connection closed`, event.code, event.reason);
        isConnectedRef.current = false;
        
        // Attempt to reconnect after a short delay if the connection was lost unexpectedly
        if (event.code !== 1000) { // 1000 is normal closure
          console.log('🔄 [TypingIndicator] Attempting to reconnect...');
          setTimeout(connectWebSocket, 3000);
        }
      };

      setSocket(newSocket);
    } catch (error) {
      console.error(`❌ [TypingIndicator] Error creating WebSocket:`, error);
      isConnectedRef.current = false;
    }
  };

  useEffect(() => {
    // Establish WebSocket connection when component mounts
    connectWebSocket();
    
    // For testing purposes, manually trigger typing status after a short delay
    const testTimer = setTimeout(() => {
      console.log(`🧪 [TypingIndicator] Testing indicator by setting to true`);
      setIsTyping(true);
      setAiName('Test AI');
      setAiColor('Mint');
      
      // Clear test after a few seconds
      setTimeout(() => {
        setIsTyping(false);
      }, 5000);
    }, 1000);

    // Clean up WebSocket connection when component unmounts
    return () => {
      clearTimeout(testTimer);
      if (socket && socket.readyState === WebSocket.OPEN) {
        console.log(`🔌 [TypingIndicator] Closing WebSocket connection`);
        socket.close();
      }
      isConnectedRef.current = false;
    };
  }, [cardId]);

  // Don't render anything if not typing
  if (!isTyping) return null;

  // Handle color styles based on AI color
  let bgColor = "bg-gray-100";
  let textColor = "text-gray-600";
  
  if (aiColor) {
    // Apply color classes based on the AI's color theme if available
    switch (aiColor) {
      case "Peach":
        bgColor = "bg-[#FEE9D7]";
        textColor = "text-[#E25B3D]";
        break;
      case "Sky":
        bgColor = "bg-[#E1F2FE]";
        textColor = "text-[#2E7EC9]";
        break;
      case "Lavender":
        bgColor = "bg-[#F6E6FF]";
        textColor = "text-[#C235D1]";
        break;
      case "Mint":
        bgColor = "bg-[#DDFFE7]";
        textColor = "text-[#1A9E5E]";
        break;
      case "Aqua":
        bgColor = "bg-[#E0F9FF]";
        textColor = "text-[#3992B0]";
        break;
    }
  }

  return (
    <div className={`flex items-start ${className}`}>
      <div className={`flex items-center gap-2 p-2.5 ${bgColor} rounded-lg max-w-[80%] animate-pulse-gentle transition-opacity`}>
        <div className="relative h-4 w-10">
          <span className={`absolute left-0 w-2 h-2 rounded-full bg-current animate-typing1 opacity-70 ${textColor}`}></span>
          <span className={`absolute left-3 w-2 h-2 rounded-full bg-current animate-typing2 opacity-70 ${textColor}`}></span>
          <span className={`absolute left-6 w-2 h-2 rounded-full bg-current animate-typing3 opacity-70 ${textColor}`}></span>
        </div>
        <span className={`text-sm font-medium ${textColor}`}>
          {aiName} is thinking...
        </span>
      </div>
    </div>
  );
}