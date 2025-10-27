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

  // Store the current user's LinkedIn profile URL
  let currentUserProfileUrl = ''

  // Function to get current user's LinkedIn profile URL
  function getCurrentUserProfileUrl() {
    if (currentUserProfileUrl) return currentUserProfileUrl

    // Try to find the user's profile link in the navigation
    const profileLink = document.querySelector(
      'a[href*="/in/"]'
    ) as HTMLAnchorElement
    if (profileLink && profileLink.href.includes('/in/')) {
      const match = profileLink.href.match(/\/in\/([^/?]+)/)
      if (match) {
        currentUserProfileUrl = match[1] // Extract username like "ayushkumarkumar"
        return currentUserProfileUrl
      }
    }
    return ''
  }

  // Function to check if we've already commented on a post
  function hasAlreadyCommented(postElement: HTMLElement): boolean {
    const userProfileUrl = getCurrentUserProfileUrl()
    if (!userProfileUrl) return false

    // Look for comments in the post - try multiple selectors
    const commentLinks = postElement.querySelectorAll(
      'a.comments-comment-meta__description-container, a[href*="/in/"]:has(.comments-comment-meta__description)'
    )

    for (const link of commentLinks) {
      const href = (link as HTMLAnchorElement).href
      // Check if this comment is from the current user
      if (href && href.includes(`/in/${userProfileUrl}`)) {
        // Check for "You" indicator in multiple ways
        const linkText = link.textContent || ''
        if (linkText.includes('You') || linkText.includes('• You')) {
          return true
        }

        // Also check in the meta data span
        const commentMeta = link.querySelector('.comments-comment-meta__data')
        if (commentMeta && commentMeta.textContent?.includes('You')) {
          return true
        }
      }
    }

    return false
  }

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

      // Find the first post that hasn't been commented on yet
      let foundPost = null
      let foundIndex = -1

      for (let i = 0; i < posts.length; i++) {
        const postElement = posts[i] as HTMLElement

        // Check if we've already commented on this post (by checking actual comments)
        if (hasAlreadyCommented(postElement)) {
          postElement.dataset.autoCommented = 'true'
          continue
        }

        // Skip if already commented on (backup check)
        if (postElement.dataset.autoCommented === 'true') {
          continue
        }

        // Check if the post is promoted
        const promotedElement = postElement.querySelector(
          LINKEDIN_SELECTORS.PROMOTED_POST
        )
        const isPromoted = promotedElement?.textContent?.includes('Promoted')

        if (isPromoted) {
          // Mark promoted posts so we don't check them again
          postElement.dataset.autoCommented = 'true'
          continue
        }

        // Found a valid post
        foundPost = postElement
        foundIndex = i
        break
      }

      if (foundPost) {
        const postText = extractPostText(foundPost)

        // Mark this post as active for auto-commenting
        document.querySelectorAll('.auto-comment-active').forEach((post) => {
          post.classList.remove('auto-comment-active')
        })
        foundPost.classList.add('auto-comment-active')

        sendResponse({ success: true, postText, postIndex: foundIndex })
      } else {
        sendResponse({ success: false, error: 'No more posts found' })
      }
      return true
    } else if (message.action === 'autoFillAndSubmitComment') {
      // Find the post with the auto-comment-active class
      const post = document.querySelector('.auto-comment-active') as HTMLElement

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

              // Wait 500ms after filling the comment to let LinkedIn process it
              setTimeout(() => {
                // Wait another 500ms for LinkedIn to enable the submit button, then click it
                setTimeout(() => {
                  // Find the submit/post button using the constant
                  const submitButton = post.querySelector(
                    LINKEDIN_SELECTORS.SUBMIT_COMMENT_BUTTON +
                      ':not([disabled])'
                  ) as HTMLElement

                  if (submitButton) {
                    submitButton.click()

                    // Mark this post as commented
                    post.dataset.autoCommented = 'true'

                    // Close the comment box by clicking elsewhere or removing focus
                    setTimeout(() => {
                      // Try to close the comment section by clicking outside
                      const commentBox = post.querySelector(
                        '[contenteditable="true"][role="textbox"]'
                      ) as HTMLElement
                      if (commentBox) {
                        commentBox.blur()
                      }
                    }, 300)

                    sendResponse({ success: true })
                  } else {
                    sendResponse({
                      success: false,
                      error: 'Comment button disabled or not ready'
                    })
                  }
                }, 500)
              }, 500)
            } else {
              sendResponse({ success: false, error: 'Comment box not found' })
            }
          }, 500)
        } else {
          sendResponse({ success: false, error: 'Post has no comment button' })
        }
      } else {
        sendResponse({ success: false, error: 'Post element not found' })
      }

      return true // Required for async sendResponse
    } else if (message.action === 'markPostAsCommented') {
      // Mark the currently active post as commented without actually commenting
      const post = document.querySelector('.auto-comment-active') as HTMLElement
      if (post) {
        post.dataset.autoCommented = 'true'
        sendResponse({ success: true })
      } else {
        sendResponse({ success: false, error: 'No active post found' })
      }
      return true
    } else if (message.action === 'scrollToNextPost') {
      // Scroll down to load more posts - scroll more to trigger LinkedIn's infinite scroll
      window.scrollBy({
        top: 800, // Scroll down by 800px (increased from 600px)
        behavior: 'smooth'
      })

      sendResponse({ success: true })
      return true
    }

    return true // Required for async sendResponse
  })
})()
