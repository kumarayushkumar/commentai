/** 
 * Background script for the Chrome extension
 * Handles installation, updates, and side panel interactions
 */

import { DEFAULT_PROMPT } from "./lib/constants";
import { showBackgroundNotification } from "./lib/notification";
import StorageService, { STORAGE_KEYS } from "./services/storage";

// Initialize default settings when extension is installed
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    try {
      // Set default values for the extension
      await StorageService.set({
        [STORAGE_KEYS.DEFAULT_PROMPT]: DEFAULT_PROMPT,
        [STORAGE_KEYS.EXTENSION_ACTIVE]: true,
        [STORAGE_KEYS.CUSTOM_PROMPT]: '',
      });
      showBackgroundNotification('Extension installed and ready to use!', 'success');
    } catch (error) {
      showBackgroundNotification('Failed to initialize extension settings', 'error');
    }
  } else if (details.reason === 'update') {
    try {
      // On update, ensure default prompt is current but don't override user settings
      const result = await StorageService.get([
        STORAGE_KEYS.DEFAULT_PROMPT,
        STORAGE_KEYS.EXTENSION_ACTIVE
      ]);
      
      const updates: { [key: string]: any } = {};
      
      // Update default prompt to latest version
      updates[STORAGE_KEYS.DEFAULT_PROMPT] = DEFAULT_PROMPT;
      
      // If extension active state is not set, default to true
      if (result[STORAGE_KEYS.EXTENSION_ACTIVE] === undefined) {
        updates[STORAGE_KEYS.EXTENSION_ACTIVE] = true;
      }
      
      if (Object.keys(updates).length > 0) {
        await StorageService.set(updates);
        showBackgroundNotification('Extension updated successfully!', 'success');
      }
    } catch (error) {
      showBackgroundNotification('Failed to update extension settings', 'error');
    }
  }
});

// Listen for extension icon clicks
chrome.action.onClicked.addListener((tab) => {
  if (chrome.sidePanel) {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "openSidePanel") {
    // Open the side panel
    if (chrome.sidePanel) {
      chrome.sidePanel.open({ windowId: sender.tab?.windowId });
      sendResponse({ success: true });
    } else {
      sendResponse({ 
        success: false, 
        error: "Side panel API not available" 
      });
    }
    return true; // Keep the message channel open for async response
  }
});