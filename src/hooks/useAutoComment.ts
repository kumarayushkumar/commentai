/**
 * Custom hook for managing auto comment functionality
 */

import { useRef, useState } from 'react'

import { getRandomDelay } from '~lib/helpers'

import geminiService from '../services/gemini'
import StorageService, { STORAGE_KEYS } from '../services/storage'

const MAX_RETRY_ATTEMPTS = 5
const SCROLL_WAIT_TIME = 3000
const POST_SUBMIT_WAIT_TIME = 1500
const POST_SCROLL_WAIT_TIME = 1000

export const useAutoComment = () => {
  const [isAutoCommenting, setIsAutoCommenting] = useState(false)
  const [autoCommentProgress, setAutoCommentProgress] = useState({
    current: 0,
    total: 0
  })
  const stopRequestedRef = useRef(false)

  const sendMessageToTab = async (
    tabId: number,
    action: string,
    data?: any
  ) => {
    try {
      return await chrome.tabs.sendMessage(tabId, { action, ...data })
    } catch (error) {
      const errorMsg = (error as Error).message || ''
      if (errorMsg.includes('Receiving end does not exist')) {
        throw new Error(
          'Content script not loaded. Please refresh the LinkedIn page and try again.'
        )
      }
      throw error
    }
  }

  const setAutoCommentingMode = async (enabled: boolean) => {
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      if (tabs[0]?.id) {
        await sendMessageToTab(tabs[0].id, 'setAutoCommentingMode', { enabled })
      }
    } catch (error) {
      // Ignore error if tab is closed
    }
  }

  const cleanupAutoComment = async () => {
    await setAutoCommentingMode(false)
    await StorageService.setData({ [STORAGE_KEYS.LAST_POST_TEXT]: '' })
    setIsAutoCommenting(false)
    setAutoCommentProgress({ current: 0, total: 0 })
    stopRequestedRef.current = false
  }

  const startAutoComment = async (
    target: number,
    isExtensionActive: boolean,
    showMessage: (message: string) => void
  ) => {
    if (!isExtensionActive) {
      showMessage('Extension is disabled. Enable it in settings first.')
      return
    }

    setIsAutoCommenting(true)
    stopRequestedRef.current = false
    setAutoCommentProgress({ current: 0, total: target })

    try {
      // Get prompt
      const data = await StorageService.getData([
        STORAGE_KEYS.CUSTOM_PROMPT,
        STORAGE_KEYS.DEFAULT_PROMPT
      ])
      const promptToUse =
        data[STORAGE_KEYS.CUSTOM_PROMPT] ||
        data[STORAGE_KEYS.DEFAULT_PROMPT] ||
        ''

      if (!promptToUse) {
        showMessage(
          'Error: No prompt configured. Please set a prompt in settings.'
        )
        await cleanupAutoComment()
        return
      }

      // Get active tab
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      const activeTab = tabs[0]

      if (!activeTab?.id) {
        showMessage('Error: No active tab found')
        await cleanupAutoComment()
        return
      }

      // Check if the active tab is LinkedIn
      if (!activeTab.url?.includes('linkedin.com')) {
        showMessage(
          'Error: Please navigate to LinkedIn feed. Auto-commenting only works on LinkedIn posts.'
        )
        await cleanupAutoComment()
        return
      }

      // Verify content script is loaded by sending a test message
      try {
        await sendMessageToTab(activeTab.id, 'setAutoCommentingMode', {
          enabled: false
        })
      } catch (error) {
        showMessage(
          'Error: Please refresh the LinkedIn page and try again. Content script not loaded.'
        )
        await cleanupAutoComment()
        return
      }

      await setAutoCommentingMode(true)

      let successfulComments = 0
      let consecutiveNoPostFound = 0
      let stoppedDueToError = false

      while (successfulComments < target && !stopRequestedRef.current) {
        setAutoCommentProgress({ current: successfulComments, total: target })

        // Get next post
        const response = await sendMessageToTab(activeTab.id, 'getNextPost')

        // Check if we skipped a promoted post
        if (response?.skippedPromoted) {
          showMessage('Skipping promoted post...')
        }

        if (!response?.success) {
          consecutiveNoPostFound++

          if (consecutiveNoPostFound < MAX_RETRY_ATTEMPTS) {
            await sendMessageToTab(activeTab.id, 'scrollToNextPost')
            await new Promise((resolve) =>
              setTimeout(resolve, SCROLL_WAIT_TIME)
            )
            continue
          }

          showMessage(
            `No more posts found. Completed ${successfulComments}/${target} comments.`
          )
          break
        }

        consecutiveNoPostFound = 0

        if (!response?.postText || response.postText.trim() === '') {
          showMessage('Skipping post with no text content...')
          // Mark this post as commented to skip it
          await sendMessageToTab(activeTab.id, 'markPostAsCommented')
          continue
        }

        // Generate comment
        const content = `${promptToUse}\n LinkedIn Post: \n${response.postText}`

        const generatedComments = await geminiService.generateComment({
          content,
          isSingleCommentMode: true
        })

        // Check if generation failed
        if (generatedComments === false) {
          // Don't mark the post - allow retry later
          stoppedDueToError = true
          break
        }

        const comment = Array.isArray(generatedComments)
          ? generatedComments[0]
          : typeof generatedComments === 'string'
            ? generatedComments
            : ''

        if (!comment) {
          showMessage('Failed to generate comment. Skipping post...')
          // Don't mark the post - allow retry later
          continue
        }

        // Submit comment
        const submitResponse = await sendMessageToTab(
          activeTab.id,
          'autoFillAndSubmitComment',
          { comment }
        )

        if (!submitResponse?.success) {
          const errorMsg = submitResponse?.error || 'Unknown error'
          showMessage(`Skipping post: ${errorMsg}`)
          // Mark post as commented to skip it
          await sendMessageToTab(activeTab.id, 'markPostAsCommented')
          continue
        }

        // Wait for LinkedIn to process the submission
        await new Promise((resolve) =>
          setTimeout(resolve, POST_SUBMIT_WAIT_TIME)
        )

        // Wait before liking the post
        await new Promise((resolve) => setTimeout(resolve, 500))

        // Like the post after commenting
        const likeResponse = await sendMessageToTab(activeTab.id, 'likePost')
        if (likeResponse?.success && !likeResponse?.alreadyLiked) {
          showMessage('Commented and liked post')
        }

        successfulComments++
        setAutoCommentProgress({ current: successfulComments, total: target })

        if (successfulComments >= target) {
          break
        }

        // Delay and scroll for next post
        const delay = getRandomDelay()
        await new Promise((resolve) => setTimeout(resolve, delay))
        await sendMessageToTab(activeTab.id, 'scrollToNextPost')
        await new Promise((resolve) =>
          setTimeout(resolve, POST_SCROLL_WAIT_TIME)
        )
      }

      const message = stoppedDueToError
        ? `Auto commenting stopped at ${successfulComments} comments due to API error. Check notifications for details.`
        : stopRequestedRef.current
          ? `Auto commenting stopped at ${successfulComments} comments.`
          : `Auto commenting complete! Successfully commented on ${successfulComments} posts.`

      showMessage(message)
    } catch (error) {
      showMessage('Auto commenting failed: ' + (error as Error).message)
    } finally {
      await cleanupAutoComment()
    }
  }

  const stopAutoComment = async (showMessage: (message: string) => void) => {
    stopRequestedRef.current = true
    showMessage('Stopping auto comment...')
    await StorageService.setData({ [STORAGE_KEYS.LAST_POST_TEXT]: '' })
    await setAutoCommentingMode(false)
  }

  return {
    isAutoCommenting,
    autoCommentProgress,
    startAutoComment,
    stopAutoComment
  }
}
