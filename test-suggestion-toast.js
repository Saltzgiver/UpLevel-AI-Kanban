/**
 * SIMPLE TEST SCRIPT - SUGGESTION TOAST
 * 
 * This script directly adds a test listener to the page to show suggestion toasts
 * Run this using the import in server/index.ts
 */

// Direct DOM listening approach
document.addEventListener('DOMContentLoaded', () => {
  console.log('[TOAST TEST] Adding card move listener to document');
  
  // Add a listener to all card elements
  setInterval(() => {
    const cards = document.querySelectorAll('[data-card-id]');
    cards.forEach(card => {
      if (!card.dataset.toastListenerAdded) {
        card.dataset.toastListenerAdded = 'true';
        
        // Add the mousedown listener to detect drag start
        card.addEventListener('mousedown', (e) => {
          const cardId = card.dataset.cardId;
          console.log(`[TOAST TEST] Card ${cardId} mousedown detected, might be starting a drag`);
          
          // Set a flag in localStorage to track this card
          localStorage.setItem('lastDraggedCardId', cardId);
        });
      }
    });
    
    // Also check for mouseup to detect drag end
    document.addEventListener('mouseup', () => {
      const lastDraggedCardId = localStorage.getItem('lastDraggedCardId');
      if (lastDraggedCardId) {
        console.log(`[TOAST TEST] Mouse up detected, card ${lastDraggedCardId} might have been dropped`);
        
        // Clear the flag
        localStorage.removeItem('lastDraggedCardId');
        
        // GUARANTEED TEST: Directly show test toast without any checks or polling
        showTestToast(lastDraggedCardId);
      }
    }, { once: true });
  }, 1000);
});

function showTestToast(cardId) {
  // First, dynamically add the toast container if it doesn't exist
  let toastContainer = document.querySelector('.toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    document.body.appendChild(toastContainer);
  }
  
  // Create the toast element
  const toast = document.createElement('div');
  toast.className = 'test-toast';
  toast.style.cssText = `
    background-color: #4f46e5;
    color: white;
    padding: 16px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 400px;
    animation: slideIn 0.3s ease-out;
  `;
  
  // Add toast content
  toast.innerHTML = `
    <div>
      <div style="font-weight: bold; margin-bottom: 4px;">Prompt Assistant</div>
      <div>[GUARANTEED TEST] Suggestion available for card ${cardId}</div>
    </div>
    <button 
      style="background: transparent; border: 1px solid white; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer;"
      onclick="alert('Review button clicked for card ${cardId}')">
      Review
    </button>
  `;
  
  // Add the toast to the container
  toastContainer.appendChild(toast);
  
  // Add animation keyframes
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
  
  console.log(`[TOAST TEST] Guaranteed test toast shown for card ${cardId}`);
}