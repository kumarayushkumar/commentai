/**
 * LinkedIn Auto Commenter Content Script
 * This script runs on LinkedIn pages to automatically handle comment interactions
 * and integrate with the side panel for AI-generated comments.
 */

import { LINKEDIN_SELECTORS } from './lib/constants'
import { createObserver, extractPostText } from './lib/helpers'
import { showNotification } from './lib/notification'
import StorageService, { STORAGE_KEYS } from './services/storage'

;(function () {
  // Flag to track if auto-commenting is in progress
  let isAutoCommenting = false

  function initExtension() {
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
      // Skip side panel opening if auto-commenting is in progress
      if (isAutoCommenting) {
        return
      }

      // Check if extension is active
      const result = await StorageService.getData(STORAGE_KEYS.EXTENSION_ACTIVE)
      const isActive = result[STORAGE_KEYS.EXTENSION_ACTIVE] !== false

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

        // Save post text with timestamp
        const postDataWithTimestamp = `${postText}|||${Date.now()}`
        await StorageService.setData({
          [STORAGE_KEYS.LAST_POST_TEXT]: postDataWithTimestamp
        })

        // Open side panel
        chrome.runtime.sendMessage(
          {
            action: 'openSidePanel'
          },
          (response) => {
            if (chrome.runtime.lastError) {
              const errorMessage =
                chrome.runtime.lastError.message || 'Unknown error'
              // Show a more user-friendly message for connection errors
              const userMessage = errorMessage.includes('establish connection')
                ? 'Extension needs to be reloaded. Please refresh the page or restart Chrome.'
                : errorMessage
              showNotification(
                'Failed to open side panel: ' + userMessage,
                'error'
              )
            } else {
            }
          }
        )
      } else {
        showNotification('Could not find the LinkedIn post.', 'error')
      }
    }
  }

  async function initialize() {
    const storageAccessible = await StorageService.isAccessible()
    if (!storageAccessible) {
      showNotification(
        'Storage is not accessible. Please check permissions.',
        'error'
      )
      return
    }

    // Now that dependencies are loaded and storage is accessible, initialize the extension
    initExtension()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize)
  } else {
    initialize()
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'setAutoCommentingMode') {
      // Set the auto-commenting flag
      isAutoCommenting = message.enabled || false
      sendResponse({ success: true })
      return true
    } else if (message.action === 'fillCommentBox' && message.comment) {
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
      return true
    } else if (message.action === 'getNextPost') {
      // Get all posts on the page
      const posts = document.querySelectorAll(LINKEDIN_SELECTORS.POST_CONTAINER)
      const index = message.index || 0

      if (posts[index]) {
        const postElement = posts[index] as HTMLElement
        const postText = extractPostText(postElement)

        // Mark this post as active for auto-commenting
        document.querySelectorAll('.auto-comment-active').forEach((post) => {
          post.classList.remove('auto-comment-active')
        })
        postElement.classList.add('auto-comment-active')

        sendResponse({ success: true, postText })
      } else {
        sendResponse({ success: false, error: 'No more posts found' })
      }
      return true
    } else if (message.action === 'autoFillAndSubmitComment') {
      // Find the post at the specified index
      const posts = document.querySelectorAll(LINKEDIN_SELECTORS.POST_CONTAINER)
      const index = message.postIndex || 0
      const post = posts[index] as HTMLElement

      if (post) {
        // First, click the comment button to open the comment box
        const commentButton = post.querySelector(
          LINKEDIN_SELECTORS.COMMENT_BUTTON
        ) as HTMLElement

        if (commentButton) {
          commentButton.click()

          // Wait for the comment box to appear
          setTimeout(() => {
            const commentBox = post.querySelector(
              '[contenteditable="true"][role="textbox"]'
            )

            if (commentBox) {
              // Fill the comment
              commentBox.textContent = message.comment

              const inputEvent = new Event('input', { bubbles: true })
              commentBox.dispatchEvent(inputEvent)

              // Wait a bit for LinkedIn to process the input, then find and click the Post button
              setTimeout(() => {
                // Find the submit/post button using the constant
                const submitButton = post.querySelector(
                  LINKEDIN_SELECTORS.SUBMIT_COMMENT_BUTTON + ':not([disabled])'
                ) as HTMLElement

                if (submitButton) {
                  submitButton.click()
                  sendResponse({ success: true })
                } else {
                  sendResponse({
                    success: false,
                    error: 'Submit button not found or disabled'
                  })
                }
              }, 500)
            } else {
              sendResponse({ success: false, error: 'Comment box not found' })
            }
          }, 500)
        } else {
          sendResponse({ success: false, error: 'Comment button not found' })
        }
      } else {
        sendResponse({ success: false, error: 'Post not found' })
      }

      return true // Required for async sendResponse
    } else if (message.action === 'scrollToNextPost') {
      // Scroll down to load more posts
      window.scrollBy({
        top: 600, // Scroll down by 600px
        behavior: 'smooth'
      })

      sendResponse({ success: true })
      return true
    }

    return true // Required for async sendResponse
  })
})()
