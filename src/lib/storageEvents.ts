/**
 * Handles storage-related events and watchers
 */

import StorageService, { storage, STORAGE_KEYS } from "../services/storage"
import { showNotification } from "./notification";

/**
 * Get the stored API key
 * @returns {Promise<string | null>} - The stored API key
 */
export async function getApiKey(): Promise<string | null> {
  const apiKey = await StorageService.getData(STORAGE_KEYS.API_KEY)
  if(!apiKey) {
    showNotification("API key not configured. Please update in settings.", "error");
    return null
    // TODO: open settings page
  }
  return apiKey.API_KEY;
}


/** 
 * Set api key in storage
 * @param apiKey - The API key to store
 */
export async function setApiKey(apiKey: string): Promise<void> {
  await StorageService.setData({ [STORAGE_KEYS.API_KEY]: apiKey });
}

/**
 * Trigger a manual check of LAST_POST_TEXT changes
 */
export function setupLastPostTextWatcher() {
  const watchCallbacks = {
    [STORAGE_KEYS.LAST_POST_TEXT]: (change: chrome.storage.StorageChange) => {
      if (change.newValue !== undefined) {
        const event = new CustomEvent("storage-change", {
          detail: {
            key: STORAGE_KEYS.LAST_POST_TEXT,
            newValue: change.newValue,
            oldValue: change.oldValue,
            // Add timestamp to force refresh even with same content
            timestamp: Date.now()
          }
        })
        document.dispatchEvent(event)
      }
    }
  }

  storage.watch(watchCallbacks)
}
