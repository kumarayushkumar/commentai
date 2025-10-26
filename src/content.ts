/**
 * LinkedIn Auto Commenter Content Script
 * This script runs on LinkedIn pages to automatically handle comment interactions
 * and integrate with the side panel for AI-generated comments.
 */

import { LINKEDIN_SELECTORS } from './lib/constants'
import { createObserver, extractPostText } from './lib/helpers'
import { showNotification } from './lib/notification'
import StorageService, { STORAGE_KEYS } from './services/storage'

declare global {
  interface Window {
    chrome: typeof chrome
  }
}

;(function () {
  function initLinkedInAutoCommenter() {
    // Track URL changes to reinitialize on navigation
    let lastUrl = location.href
    createObserver(
      document,
      () => {
        const currentUrl = location.href
        if (currentUrl !== lastUrl) {
          lastUrl = currentUrl
          setupCommentListeners()
        }
      },
      { subtree: true, childList: true },
      200
    )

    // Initial setup
    setupCommentListeners()

    // Setup listeners for comment buttons
    function setupCommentListeners() {
      // Create observer for dynamically loaded comment buttons
      createObserver(document.body, () => {
        const commentButtons = document.querySelectorAll(
          LINKEDIN_SELECTORS.COMMENT_BUTTON
        )
        attachEventListeners(commentButtons)
      })

      // Initial scan for comment buttons
      const initialButtons = document.querySelectorAll(
        LINKEDIN_SELECTORS.COMMENT_BUTTON
      )
      attachEventListeners(initialButtons)
    }

    // Attach event listeners to comment buttons
    function attachEventListeners(buttons: NodeListOf<Element>) {
      buttons.forEach((button) => {
        // Prevent duplicate listeners
        if ((button as HTMLElement).dataset.autoCommentAttached) return
        ;(button as HTMLElement).dataset.autoCommentAttached = 'true'

        button.addEventListener('click', (event: Event) => {
          handleCommentClick.call(button as HTMLElement, event as MouseEvent)
        })
      })
    }

    // Handle comment button click
    async function handleCommentClick(this: HTMLElement, event: MouseEvent) {
      try {
        // Check if extension is active
        let isActive = true
        try {
          const result = await StorageService.getData(
            STORAGE_KEYS.EXTENSION_ACTIVE
          )
          isActive = result[STORAGE_KEYS.EXTENSION_ACTIVE] !== false
        } catch (storageError: any) {
          if (
            storageError.message &&
            (storageError.message.includes('Extension context invalidated') ||
              storageError.message.includes('Storage get error'))
          ) {
            showNotification(
              'Extension was updated or reloaded. Please refresh the page.',
              'warning'
            )
            return
          }
        }

        if (!isActive) {
          showNotification(
            'Extension is disabled. Enable it in the side panel settings.',
            'info'
          )
          return
        }

        // Find post element and mark it as active
        const postElement = this.closest(LINKEDIN_SELECTORS.POST_CONTAINER)
        if (postElement) {
          // Remove active class from any previously active post
          document.querySelectorAll('.active-post').forEach((post) => {
            post.classList.remove('active-post')
          })

          // Add active class to the current post
          postElement.classList.add('active-post')

          // Extract text from the active post
          const postText = extractPostText(postElement as HTMLElement)

          try {
            // Check if API key is configured
            let hasApiKey = false
            try {
              const apiKeyResult = await StorageService.getData('API_KEY')
              hasApiKey = !!(apiKeyResult && apiKeyResult['API_KEY'])
            } catch (error) {
              console.error('Error checking API key:', error)
            }

            // Save post text with timestamp
            const postDataWithTimestamp = `${postText}|||${Date.now()}`
            await StorageService.setData({
              LAST_POST_TEXT: postDataWithTimestamp
            })

            // Open side panel
            chrome.runtime.sendMessage(
              {
                action: 'openSidePanel',
                openSettings: !hasApiKey // Signal to open settings if no API key
              },
              (response) => {
                if (chrome.runtime.lastError) {
                  const errorMessage =
                    chrome.runtime.lastError.message || 'Unknown error'
                  // Show a more user-friendly message for connection errors
                  const userMessage = errorMessage.includes(
                    'establish connection'
                  )
                    ? 'Extension needs to be reloaded. Please refresh the page or restart Chrome.'
                    : errorMessage
                  showNotification(
                    'Failed to open side panel: ' + userMessage,
                    'error'
                  )
                } else if (!hasApiKey) {
                  showNotification(
                    'Please configure your API key in settings',
                    'warning'
                  )
                } else {
                  showNotification('Check side panel for comments', 'info')
                }
              }
            )
          } catch (saveError: any) {
            showNotification('Error saving post text. Try again.', 'error')
          }
        } else {
          showNotification('Could not find the LinkedIn post.', 'error')
        }
      } catch (error: any) {
        showNotification('Error handling comment button click', 'error')
      }
    }
  }

  async function initialize() {
    try {
      const storageAccessible = await StorageService.isAccessible()
      if (!storageAccessible) {
        showNotification(
          'Storage is not accessible. Please check permissions.',
          'error'
        )
        return
      }

      // Now that dependencies are loaded and storage is accessible, initialize the extension
      initLinkedInAutoCommenter()
    } catch (error) {
      showNotification(
        'Failed to initialize extension. Please refresh the page.',
        'error'
      )
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize)
  } else {
    initialize()
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'fillCommentBox' && message.comment) {
      // Find the active post marked by the side panel
      const activePost = document.querySelector('.active-post')

      if (activePost) {
        const activeCommentBox = activePost.querySelector(
          '[contenteditable="true"][role="textbox"]'
        )

        if (activeCommentBox) {
          activeCommentBox.textContent = message.comment

          const event = new Event('input', { bubbles: true })
          activeCommentBox.dispatchEvent(event)

          ;(activeCommentBox as HTMLElement).focus()
        }
      } else {
        showNotification(
          'No active post found. Please select a post first.',
          'error'
        )
      }

      sendResponse({ success: true })
    }
  })
})()
