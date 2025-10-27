/**
 * Custom hook for managing auto comment functionality
 */

import { useRef, useState } from 'react'

import { getRandomDelay } from '~lib/helpers'

import geminiService from '../services/gemini'
import StorageService, { STORAGE_KEYS } from '../services/storage'

export const useAutoComment = () => {
  const [isAutoCommenting, setIsAutoCommenting] = useState(false)
  const [autoCommentProgress, setAutoCommentProgress] = useState({
    current: 0,
    total: 0
  })
  const stopRequestedRef = useRef(false)

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

    const data = await StorageService.getData([
      STORAGE_KEYS.CUSTOM_PROMPT,
      STORAGE_KEYS.DEFAULT_PROMPT
    ])
    const customPrompt = data[STORAGE_KEYS.CUSTOM_PROMPT]
    const defaultPrompt = data[STORAGE_KEYS.DEFAULT_PROMPT] || ''
    const promptToUse = customPrompt || defaultPrompt

    try {
      // Query the active tab to send messages to content script
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      const activeTab = tabs[0]

      if (!activeTab?.id) {
        showMessage('Error: No active tab found')
        setIsAutoCommenting(false)
        return
      }

      // Enable auto-commenting mode in content script to prevent side panel opening
      await chrome.tabs.sendMessage(activeTab.id, {
        action: 'setAutoCommentingMode',
        enabled: true
      })

      let successfulComments = 0
      let consecutiveNoPostFound = 0

      while (successfulComments < target) {
        if (stopRequestedRef.current) {
          break
        }

        setAutoCommentProgress({
          current: successfulComments,
          total: target
        })

        // Step 1: Read the next uncommented post
        const response = await chrome.tabs.sendMessage(activeTab.id, {
          action: 'getNextPost'
        })

        if (!response?.success) {
          consecutiveNoPostFound++

          // If we can't find a post, scroll to load more and try again
          if (consecutiveNoPostFound < 5) {
            // Scroll more aggressively to trigger LinkedIn's infinite scroll
            await chrome.tabs.sendMessage(activeTab.id, {
              action: 'scrollToNextPost'
            })
            // Wait longer for posts to load after scrolling
            await new Promise((resolve) => setTimeout(resolve, 3000))
            continue
          } else {
            // After 5 attempts, no more posts available
            showMessage(
              `No more posts found. Completed ${successfulComments}/${target} comments.`
            )
            break
          }
        }

        // Reset counter when we successfully find a post
        consecutiveNoPostFound = 0

        if (!response?.postText) {
          showMessage(
            `No more posts found. Completed ${successfulComments}/${target} comments.`
          )
          break
        }

        // Step 2: Generate the comment
        const content = `This is a linked post,\n${response.postText}\n\n---\n${promptToUse}`
        const generatedComments = await geminiService.generateComment({
          content,
          isSingleCommentMode: true
        })

        let comment = ''
        if (Array.isArray(generatedComments) && generatedComments.length > 0) {
          comment = generatedComments[0]
        } else if (typeof generatedComments === 'string') {
          comment = generatedComments
        }

        if (!comment || comment.includes('Error generating')) {
          showMessage(`Failed to generate comment. Skipping post...`)
          // Mark the post as commented so we skip it next time
          await chrome.tabs.sendMessage(activeTab.id, {
            action: 'markPostAsCommented'
          })
          continue
        }

        // Step 3: Submit the comment
        const submitResponse = await chrome.tabs.sendMessage(activeTab.id, {
          action: 'autoFillAndSubmitComment',
          comment
        })

        if (!submitResponse?.success) {
          // Only show message if there's a specific error, otherwise just skip silently
          if (submitResponse?.error) {
            showMessage(`Skipping post: ${submitResponse.error}`)
          }
          // Mark the post as commented so we skip it next time
          await chrome.tabs.sendMessage(activeTab.id, {
            action: 'markPostAsCommented'
          })
          continue
        }

        // Wait for the comment to be fully submitted (LinkedIn processing time)
        await new Promise((resolve) => setTimeout(resolve, 1500))

        // Step 4: Increase the comment count
        successfulComments++

        // Update progress after successful comment
        setAutoCommentProgress({
          current: successfulComments,
          total: target
        })

        // Check if we've reached the target
        if (successfulComments >= target) {
          break
        }

        // Step 5: Random delay
        const delay = getRandomDelay()
        await new Promise((resolve) => setTimeout(resolve, delay))

        // Step 6: Scroll to load more posts for next iteration
        await chrome.tabs.sendMessage(activeTab.id, {
          action: 'scrollToNextPost'
        })

        // Wait for new posts to load
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      if (!stopRequestedRef.current) {
        showMessage(
          `Auto commenting complete! Successfully commented on ${successfulComments} posts.`
        )
      } else {
        showMessage(
          `Auto commenting stopped at ${successfulComments} comments.`
        )
      }
    } catch (error) {
      showMessage('Auto commenting failed: ' + (error as Error).message)
    } finally {
      // Disable auto-commenting mode in content script
      try {
        const tabs = await chrome.tabs.query({
          active: true,
          currentWindow: true
        })
        if (tabs[0]?.id) {
          await chrome.tabs.sendMessage(tabs[0].id, {
            action: 'setAutoCommentingMode',
            enabled: false
          })
        }
      } catch (error) {
        // Ignore error if tab is closed
      }

      // Clear the last post text
      await StorageService.setData({
        [STORAGE_KEYS.LAST_POST_TEXT]: ''
      })

      setIsAutoCommenting(false)
      setAutoCommentProgress({ current: 0, total: 0 })
      stopRequestedRef.current = false
    }
  }

  const stopAutoComment = async (showMessage: (message: string) => void) => {
    stopRequestedRef.current = true
    showMessage('Stopping auto comment...')

    // Clear the last post text
    await StorageService.setData({
      [STORAGE_KEYS.LAST_POST_TEXT]: ''
    })

    // Disable auto-commenting mode in content script
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      if (tabs[0]?.id) {
        await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'setAutoCommentingMode',
          enabled: false
        })
      }
    } catch (error) {
      // Ignore error if tab is closed
    }
  }

  return {
    isAutoCommenting,
    autoCommentProgress,
    startAutoComment,
    stopAutoComment
  }
}
