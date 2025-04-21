/**
 * WebSocket Connection Test Script
 * 
 * This script tests the WebSocket connection to the server
 * and verifies that the typing indicator functionality works.
 */

const WebSocket = require('ws');

async function testWebSocketConnection() {
  try {
    // Get the host from the environment or use localhost with port 5000 by default
    const host = process.env.HOST || 'localhost:5000';
    const wsUrl = `ws://${host}/ws`;
    
    console.log(`Connecting to WebSocket at ${wsUrl}...`);
    
    const ws = new WebSocket(wsUrl);
    
    ws.on('open', () => {
      console.log('✅ WebSocket connection established');
      
      // Subscribe to updates for a test card
      const testCardId = 92; // Use an existing card ID from your database
      const subscribePayload = JSON.stringify({
        type: 'subscribe',
        cardId: testCardId,
      });
      
      console.log(`Sending subscription for card ${testCardId}...`);
      ws.send(subscribePayload);
      
      // After 2 seconds, send a test typing indicator
      setTimeout(() => {
        const typingPayload = JSON.stringify({
          type: 'typing',
          cardId: testCardId,
          gptName: 'Test AI',
          gptColor: 'Mint',
          isTyping: true
        });
        
        console.log('Sending typing indicator...');
        ws.send(typingPayload);
        
        // After 3 more seconds, turn off the typing indicator
        setTimeout(() => {
          const stopTypingPayload = JSON.stringify({
            type: 'typing',
            cardId: testCardId,
            gptName: 'Test AI',
            gptColor: 'Mint',
            isTyping: false
          });
          
          console.log('Sending stop typing indicator...');
          ws.send(stopTypingPayload);
          
          // Close the connection after 1 more second
          setTimeout(() => {
            console.log('Test completed, closing connection');
            ws.close();
          }, 1000);
        }, 3000);
      }, 2000);
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        console.log('📥 Received message:', message);
      } catch (error) {
        console.log('📥 Received raw message:', data.toString());
      }
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });
    
    ws.on('close', (code, reason) => {
      console.log(`🔌 WebSocket connection closed with code ${code}${reason ? ': ' + reason : ''}`);
    });
    
  } catch (error) {
    console.error('Error in test script:', error);
  }
}

// Run the test
testWebSocketConnection();