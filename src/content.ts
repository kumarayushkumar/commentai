/**
 * LinkedIn Auto Commenter Content Script
 * Handles comment interactions and integrates with the side panel for AI-generated comments
 */

import {
  BLUR_DELAY,
  COMMENT_BOX_WAIT,
  INPUT_PROCESS_WAIT,
  LINKEDIN_SELECTORS,
  SCROLL_DISTANCE,
  SUBMIT_WAIT
} from './lib/constants'
import { createObserver, extractPostText } from './lib/helpers'
import { showNotification } from './lib/notification'
import StorageService, { STORAGE_KEYS } from './services/storage'

// Module state
let isAutoCommenting = false
let currentUserProfileUrl = ''

/**
 * Check if extension context is still valid
 */
function isExtensionContextValid(): boolean {
  try {
    return chrome.runtime && chrome.runtime.id !== undefined
  } catch {
    return false
  }
}

/**
 * Extract and cache the current user's LinkedIn profile username
 */
function getCurrentUserProfileUrl(): string {
  if (currentUserProfileUrl) return currentUserProfileUrl

  const profileLink = document.querySelector(
    'a[href*="/in/"]'
  ) as HTMLAnchorElement
  if (profileLink?.href) {
    const match = profileLink.href.match(/\/in\/([^/?]+)/)
    if (match) {
      currentUserProfileUrl = match[1]
      return currentUserProfileUrl
    }
  }
  return ''
}

/**
 * Check if the current user has already commented on a post
 */
function hasAlreadyCommented(postElement: HTMLElement): boolean {
  const userProfileUrl = getCurrentUserProfileUrl()
  if (!userProfileUrl) return false

  const commentLinks = postElement.querySelectorAll(
    'a.comments-comment-meta__description-container, a[href*="/in/"]:has(.comments-comment-meta__description)'
  )

  for (const link of commentLinks) {
    const href = (link as HTMLAnchorElement).href
    if (href?.includes(`/in/${userProfileUrl}`)) {
      const linkText = link.textContent || ''
      const commentMeta = link.querySelector('.comments-comment-meta__data')

      if (
        linkText.includes('You') ||
        linkText.includes('• You') ||
        commentMeta?.textContent?.includes('You')
      ) {
        return true
      }
    }
  }

  return false
}

/**
 * Find the first uncommented, non-promoted post
 */
function findNextPost(): {
  post: HTMLElement | null
  skippedPromoted: boolean
} {
  const posts = document.querySelectorAll(LINKEDIN_SELECTORS.POST_CONTAINER)
  let skippedPromoted = false
  let alreadyCommentedCount = 0
  let promotedCount = 0

  for (const post of Array.from(posts)) {
    const postElement = post as HTMLElement

    // Check if already commented
    if (
      hasAlreadyCommented(postElement) ||
      postElement.dataset.autoCommented === 'true'
    ) {
      postElement.dataset.autoCommented = 'true'
      alreadyCommentedCount++
      continue
    }

    // Check if promoted
    const promotedElement = postElement.querySelector(
      LINKEDIN_SELECTORS.PROMOTED_POST
    )
    if (promotedElement?.textContent?.includes('Promoted')) {
      postElement.dataset.autoCommented = 'true'
      skippedPromoted = true
      promotedCount++
      continue
    }

    return { post: postElement, skippedPromoted }
  }

  return { post: null, skippedPromoted }
}

/**
 * Mark a post as the active target for commenting
 */
function setActivePost(postElement: HTMLElement, className: string) {
  document.querySelectorAll(`.${className}`).forEach((post) => {
    post.classList.remove(className)
  })
  postElement.classList.add(className)
}

/**
 * Fill comment box and submit with proper timing
 */
function fillAndSubmitComment(
  post: HTMLElement,
  comment: string,
  sendResponse: (response: any) => void
) {
  const commentButton = post.querySelector(
    LINKEDIN_SELECTORS.COMMENT_BUTTON
  ) as HTMLElement

  if (!commentButton) {
    sendResponse({ success: false, error: 'Post has no comment button' })
    return
  }

  commentButton.click()

  // First attempt to find comment box
  setTimeout(() => {
    let commentBox = post.querySelector(
      '[contenteditable="true"][role="textbox"]'
    )

    // If comment box not found, try clicking the comment button again
    // (sometimes the first click expands comments section instead of opening input)
    if (!commentBox) {
      commentButton.click()

      // Wait a bit longer and try again
      setTimeout(() => {
        commentBox = post.querySelector(
          '[contenteditable="true"][role="textbox"]'
        )

        if (!commentBox) {
          sendResponse({
            success: false,
            error: 'Comment box not found after retry'
          })
          return
        }

        // Proceed with filling comment
        proceedWithComment(commentBox, comment, post, sendResponse)
      }, COMMENT_BOX_WAIT)
      return
    }

    // Comment box found on first try
    proceedWithComment(commentBox, comment, post, sendResponse)
  }, COMMENT_BOX_WAIT)
}

/**
 * Helper function to fill and submit comment once comment box is found
 */
function proceedWithComment(
  commentBox: Element,
  comment: string,
  post: HTMLElement,
  sendResponse: (response: any) => void
) {
  commentBox.textContent = comment
  commentBox.dispatchEvent(new Event('input', { bubbles: true }))

  setTimeout(() => {
    setTimeout(() => {
      const submitButton = post.querySelector(
        LINKEDIN_SELECTORS.SUBMIT_COMMENT_BUTTON + ':not([disabled])'
      ) as HTMLElement

      if (!submitButton) {
        sendResponse({
          success: false,
          error: 'Comment button disabled or not ready'
        })
        return
      }

      submitButton.click()
      post.dataset.autoCommented = 'true'

      setTimeout(() => {
        const box = post.querySelector(
          '[contenteditable="true"][role="textbox"]'
        ) as HTMLElement
        box?.blur()
      }, BLUR_DELAY)

      sendResponse({ success: true })
    }, SUBMIT_WAIT)
  }, INPUT_PROCESS_WAIT)
}

/**
 * Handle manual comment button click (not during auto-commenting)
 */
async function handleCommentClick(this: HTMLElement) {
  if (isAutoCommenting) return

  if (!isExtensionContextValid()) {
    showNotification(
      'Extension was reloaded. Please refresh this page.',
      'warning'
    )
    return
  }

  const result = await StorageService.getData(STORAGE_KEYS.EXTENSION_ACTIVE)
  const isActive = result[STORAGE_KEYS.EXTENSION_ACTIVE] !== false

  if (!isActive) {
    showNotification(
      'Extension is disabled. Enable it in the side panel settings.',
      'info'
    )
    return
  }

  const postElement = this.closest(LINKEDIN_SELECTORS.POST_CONTAINER)
  if (!postElement) {
    showNotification('Could not find the LinkedIn post.', 'error')
    return
  }

  setActivePost(postElement as HTMLElement, 'active-post')

  const postText = extractPostText(postElement as HTMLElement)
  const postDataWithTimestamp = `${postText}|||${Date.now()}`

  await StorageService.setData({
    [STORAGE_KEYS.LAST_POST_TEXT]: postDataWithTimestamp
  })

  try {
    chrome.runtime.sendMessage({ action: 'openSidePanel' }, (response) => {
      if (chrome.runtime.lastError) {
        const errorMessage = chrome.runtime.lastError.message || 'Unknown error'
        const userMessage = errorMessage.includes('establish connection')
          ? 'Extension needs to be reloaded. Please refresh the page or restart Chrome.'
          : errorMessage.includes('Extension context invalidated')
            ? 'Extension was reloaded. Please refresh this page.'
            : errorMessage
        showNotification('Failed to open side panel: ' + userMessage, 'error')
      }
    })
  } catch (error) {
    showNotification(
      'Extension connection lost. Please refresh the page.',
      'error'
    )
  }
}

/**
 * Setup comment button event listeners
 */
function setupCommentListeners() {
  createObserver(document.body, () => {
    const commentButtons = document.querySelectorAll(
      LINKEDIN_SELECTORS.COMMENT_BUTTON
    )

    commentButtons.forEach((button) => {
      const buttonElement = button as HTMLElement
      if (buttonElement.dataset.autoCommentAttached) return

      buttonElement.dataset.autoCommentAttached = 'true'
      buttonElement.addEventListener('click', (event: Event) => {
        handleCommentClick.call(buttonElement, event as MouseEvent)
      })
    })
  })

  // Initial scan
  const initialButtons = document.querySelectorAll(
    LINKEDIN_SELECTORS.COMMENT_BUTTON
  )
  initialButtons.forEach((button) => {
    const buttonElement = button as HTMLElement
    if (buttonElement.dataset.autoCommentAttached) return

    buttonElement.dataset.autoCommentAttached = 'true'
    buttonElement.addEventListener('click', (event: Event) => {
      handleCommentClick.call(buttonElement, event as MouseEvent)
    })
  })
}

/**
 * Initialize extension
 */
function initExtension() {
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

  setupCommentListeners()
}

/**
 * Initialize with storage check
 */
async function initialize() {
  const storageAccessible = await StorageService.isAccessible()
  if (!storageAccessible) {
    showNotification(
      'Storage is not accessible. Please check permissions.',
      'error'
    )
    return
  }

  initExtension()
}

// Message handlers
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Check if extension context is still valid
  if (!isExtensionContextValid()) {
    sendResponse({ success: false, error: 'Extension context invalidated' })
    return true
  }

  const { action } = message

  if (action === 'setAutoCommentingMode') {
    isAutoCommenting = message.enabled || false
    sendResponse({ success: true })
    return true
  }

  if (action === 'fillCommentBox') {
    const activePost = document.querySelector('.active-post')
    if (activePost) {
      const activeCommentBox = activePost.querySelector(
        '[contenteditable="true"][role="textbox"]'
      )
      if (activeCommentBox) {
        activeCommentBox.textContent = message.comment
        activeCommentBox.dispatchEvent(new Event('input', { bubbles: true }))
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
  }

  if (action === 'getNextPost') {
    const result = findNextPost()

    if (result.post) {
      const postText = extractPostText(result.post)
      setActivePost(result.post, 'auto-comment-active')
      sendResponse({
        success: true,
        postText,
        skippedPromoted: result.skippedPromoted
      })
    } else {
      sendResponse({
        success: false,
        error: 'No more posts found',
        skippedPromoted: result.skippedPromoted
      })
    }
    return true
  }

  if (action === 'autoFillAndSubmitComment') {
    let post = document.querySelector('.auto-comment-active') as HTMLElement

    // If the active post is not found, try to find the next post again
    if (!post) {
      const result = findNextPost()
      if (result.post) {
        post = result.post
        setActivePost(post, 'auto-comment-active')
      }
    }

    if (post) {
      fillAndSubmitComment(post, message.comment, sendResponse)
    } else {
      sendResponse({ success: false, error: 'Post element not found' })
    }
    return true
  }

  if (action === 'markPostAsCommented') {
    const post = document.querySelector('.auto-comment-active') as HTMLElement
    if (post) {
      post.dataset.autoCommented = 'true'
      sendResponse({ success: true })
    } else {
      sendResponse({ success: false, error: 'No active post found' })
    }
    return true
  }

  if (action === 'scrollToNextPost') {
    window.scrollBy({ top: SCROLL_DISTANCE, behavior: 'smooth' })
    sendResponse({ success: true })
    return true
  }

  return true
})

// Detect extension context invalidation
chrome.runtime
  .connect({ name: 'content-script' })
  .onDisconnect.addListener(() => {
    if (!isExtensionContextValid()) {
      // Extension was reloaded/disabled
      isAutoCommenting = false
    }
  })

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize)
} else {
  initialize()
}
