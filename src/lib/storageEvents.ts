/**
 * Handles storage-related events and watchers
 */

import StorageService, { storage, STORAGE_KEYS } from '../services/storage'
import { showNotification } from './notification'

/**
 * Get the stored API key
 * @returns {Promise<string | null>} - The stored API key
 */
export async function getApiKey(): Promise<string | null> {
  const result = await StorageService.getData(STORAGE_KEYS.API_KEY)
  const apiKey = result[STORAGE_KEYS.API_KEY]

  if (!apiKey || apiKey.trim() === '') {
    showNotification(
      'API key not configured. Please configure in settings.',
      'warning'
    )

    // Dispatch event to open settings tab
    const event = new CustomEvent('open-settings', {
      detail: { reason: 'missing-api-key' }
    })
    document.dispatchEvent(event)

    return null
  }
  return apiKey
}

/**
 * Set api key in storage
 * @param apiKey - The API key to store
 */
export async function setApiKey(apiKey: string): Promise<void> {
  await StorageService.setData({ [STORAGE_KEYS.API_KEY]: apiKey })
}

/**
 * Trigger a manual check of LAST_POST_TEXT changes
 */
export function setupLastPostTextWatcher() {
  const watchCallbacks = {
    [STORAGE_KEYS.LAST_POST_TEXT]: (change: chrome.storage.StorageChange) => {
      if (change.newValue !== undefined) {
        const event = new CustomEvent('storage-change', {
          detail: {
            key: STORAGE_KEYS.LAST_POST_TEXT,
            newValue: change.newValue,
            oldValue: change.oldValue,
            timestamp: Date.now()
          }
        })
        document.dispatchEvent(event)
      }
    }
  }

  storage.watch(watchCallbacks)
}
