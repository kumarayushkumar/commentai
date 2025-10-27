/**
 * Storage handler for Plasmo extension storage
 */

import { Storage } from '@plasmohq/storage'

import { showNotification } from '~lib/notification'

export interface StorageKeys {
  EXTENSION_ACTIVE: string
  IS_SINGLE_COMMENT_MODE: string
  DEFAULT_PROMPT: string
  LAST_POST_TEXT: string
  CUSTOM_PROMPT: string
  API_KEY: string
  AUTO_COMMENT_TARGET: string
}

// Define storage keys upfront for consistency and maintainability
export const STORAGE_KEYS: StorageKeys = {
  EXTENSION_ACTIVE: 'extensionActive',
  IS_SINGLE_COMMENT_MODE: 'isSingleCommentMode',
  DEFAULT_PROMPT: 'defaultPrompt',
  LAST_POST_TEXT: 'lastPostText',
  CUSTOM_PROMPT: 'customPrompt',
  API_KEY: 'API_KEY',
  AUTO_COMMENT_TARGET: 'autoCommentTarget'
}

// Initialize the Plasmo storage
export const storage = new Storage({
  area: 'sync'
})

class StorageService {
  /**
   * Get data from storage
   * @param keys - Keys to retrieve
   * @returns Storage data
   */
  static async getData(
    keys: string | string[]
  ): Promise<{ [key: string]: any }> {
    try {
      const result: { [key: string]: any } = {}

      if (Array.isArray(keys)) {
        // Handle array of keys
        await Promise.all(
          keys.map(async (key) => {
            try {
              result[key] = await storage.get(key)
            } catch (e) {
              result[key] = undefined
            }
          })
        )
      } else {
        // Handle single key
        try {
          result[keys] = await storage.get(keys)
        } catch (e) {
          result[keys] = undefined
        }
      }

      return result
    } catch (error) {
      return {}
    }
  }

  /**
   * Save data to storage
   * @param data - Data to save
   */
  static async setData(data: { [key: string]: any }): Promise<void> {
    try {
      if (!(await this.isAccessible())) {
        return
      }
      await Promise.all(
        Object.entries(data).map(([key, value]) => storage.set(key, value))
      )
    } catch (error) {
    }
  }

  /**
   * Check if storage is accessible
   * @returns Whether storage is accessible
   */
  static async isAccessible(): Promise<boolean> {
    try {
      await storage.get('test')
      return true
    } catch (error) {
      showNotification('Storage is not accessible.', 'error')
      return false
    }
  }
}

export default StorageService
