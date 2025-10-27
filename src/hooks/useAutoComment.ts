/**
 * Custom hook for managing auto comment functionality
 */

import { useRef, useState } from 'react'

import geminiService from '../services/gemini'
import StorageService, { STORAGE_KEYS } from '../services/storage'

export const useAutoComment = () => {
  const [isAutoCommenting, setIsAutoCommenting] = useState(false)
  const [autoCommentProgress, setAutoCommentProgress] = useState({
    current: 0,
    total: 0
  })
  const stopRequestedRef = useRef(false)

  const getRandomDelay = () => {
    return Math.floor(Math.random() * (9000 - 5000 + 1)) + 5000
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

      for (let i = 1; i <= target; i++) {
        if (stopRequestedRef.current) {
          showMessage(`Auto commenting stopped at ${i - 1}/${target} posts.`)
          break
        }

        setAutoCommentProgress({ current: i, total: target })
        showMessage(`Processing post ${i}/${target}...`)

        // Send message to content script to get next post
        const response = await chrome.tabs.sendMessage(activeTab.id, {
          action: 'getNextPost',
          index: i - 1
        })

        if (!response?.success || !response?.postText) {
          showMessage(
            `No more posts found. Completed ${i - 1}/${target} posts.`
          )
          break
        }

        // Generate comment for this post
        showMessage(`Generating comment for post ${i}/${target}...`)
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
          showMessage(`Failed to generate comment for post ${i}. Skipping...`)
          // Scroll to next post even if generation failed
          await chrome.tabs.sendMessage(activeTab.id, {
            action: 'scrollToNextPost'
          })
          continue
        }

        // Send comment back to content script to fill and submit
        showMessage(`Submitting comment on post ${i}/${target}...`)
        const submitResponse = await chrome.tabs.sendMessage(activeTab.id, {
          action: 'autoFillAndSubmitComment',
          comment,
          postIndex: i - 1
        })

        if (submitResponse?.success) {
          showMessage(`Comment submitted on post ${i}/${target}`)
        } else {
          showMessage(`Failed to submit comment on post ${i}/${target}`)
        }

        // Scroll to next post
        if (i < target && !stopRequestedRef.current) {
          showMessage(`Scrolling to next post...`)
          await chrome.tabs.sendMessage(activeTab.id, {
            action: 'scrollToNextPost'
          })

          // Wait random delay before processing next post
          const delay = getRandomDelay()
          showMessage(
            `Waiting ${Math.round(delay / 1000)}s before next post...`
          )
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }

      if (!stopRequestedRef.current) {
        showMessage(`Auto commenting complete! Processed ${target} posts.`)
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

      setIsAutoCommenting(false)
      setAutoCommentProgress({ current: 0, total: 0 })
      stopRequestedRef.current = false
    }
  }

  const stopAutoComment = async (showMessage: (message: string) => void) => {
    stopRequestedRef.current = true
    showMessage('Stopping auto comment...')

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
