/**
 * Custom hook for managing comment generation and interaction
 */

import { useState } from 'react'

import { DEFAULT_PROMPT } from '../lib/constants'
import geminiService from '../services/gemini'
import StorageService, { STORAGE_KEYS } from '../services/storage'

export const useComments = () => {
  const [comments, setComments] = useState<string[]>([
    'Thinking...',
    'Thinking...',
    'Thinking...'
  ])
  const [fetchingComments, setFetchingComments] = useState(false)

  // Fetch comment variants from AI service
  const fetchVariants = async () => {
    if (fetchingComments) return

    setFetchingComments(true)
    setComments(['Thinking...', 'Thinking...', 'Thinking...'])

    const dataFromStorage = await StorageService.getData([
      STORAGE_KEYS.LAST_POST_TEXT,
      STORAGE_KEYS.CUSTOM_PROMPT,
      STORAGE_KEYS.DEFAULT_PROMPT,
      STORAGE_KEYS.EXTENSION_ACTIVE
    ])

    const isActive = dataFromStorage[STORAGE_KEYS.EXTENSION_ACTIVE] !== false
    if (!isActive) {
      setComments([])
      setFetchingComments(false)
      return
    }

    const postText = dataFromStorage[STORAGE_KEYS.LAST_POST_TEXT]
    const actualPostText = postText ? postText.split('|||')[0] : ''
    const customPromptValue = dataFromStorage[STORAGE_KEYS.CUSTOM_PROMPT]
    const defaultPromptValue =
      dataFromStorage[STORAGE_KEYS.DEFAULT_PROMPT] || DEFAULT_PROMPT
    const promptToUse = customPromptValue || defaultPromptValue

    if (!actualPostText) {
      setComments([
        'No post selected. Click on a LinkedIn post comment button first.',
        'No post selected. Click on a LinkedIn post comment button first.',
        'No post selected. Click on a LinkedIn post comment button first.'
      ])
      setFetchingComments(false)
      return
    }

    const content = `This is a linked post,\n${actualPostText}\n\n---\n${promptToUse}`

    const generatedComments = await geminiService.generateComment({ content })

    setComments(
      Array.isArray(generatedComments) && generatedComments.length > 0
        ? generatedComments
        : [
            'No comment generated',
            'No comment generated',
            'No comment generated'
          ]
    )
    setFetchingComments(false)
  }

  // Handle comment click to apply to LinkedIn
  const handleCommentClick = (
    comment: string,
    isExtensionActive: boolean,
    showMessage: (message: string) => void
  ) => {
    if (!isExtensionActive) {
      return
    }

    if (
      !comment ||
      comment.includes('No post selected') ||
      comment.includes('Error generating') ||
      comment.includes('Extension is disabled') ||
      comment.includes('No comment generated')
    ) {
      showMessage('Cannot use this comment')
      return
    }

    showMessage('Applying comment...')

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) {
        showMessage('Error: No active tab found')
        return
      }

      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: 'fillCommentBox', comment },
        () => {
          const lastError = chrome.runtime.lastError
          if (lastError) {
            showMessage(`Error: ${lastError.message}`)
            return
          }
          showMessage('Comment applied to LinkedIn!')
        }
      )
    })
  }

  return {
    comments,
    fetchingComments,
    fetchVariants,
    handleCommentClick
  }
}
