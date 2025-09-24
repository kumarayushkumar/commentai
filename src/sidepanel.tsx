/**
 * Side panel component for the LinkedIn AI Comment Generator extension.
 * Provides UI for generating and managing AI-generated comment suggestions.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import './style.css'

import openAIService from './services/openai'
import StorageService, { STORAGE_KEYS } from './services/storage'
import { DEFAULT_PROMPT } from './utils/constants'
import { setupLastPostTextWatcher } from './utils/storageEvents'

// Custom hook for managing temporary status messages
const useStatusMessage = () => {
  const [message, setMessage] = useState('')

  const showMessage = useCallback((msg: string, duration = 3000) => {
    setMessage(msg)
    if (duration > 0) {
      setTimeout(() => setMessage(''), duration)
    }
  }, [])

  const clearMessage = useCallback(() => setMessage(''), [])

  return [message, showMessage, clearMessage] as const
}

// Status display component
const StatusDisplay = ({
  message,
  className = ''
}: {
  message: string
  className?: string
}) => (
  <div
    className={`mt-10 py-2 px-3 font-medium opacity-0 transition-all ease-in-out duration-300 border-l-2 border-accent bg-green-200 ${message ? 'opacity-100' : ''} ${className}`}>
    {message}
  </div>
)

function IndexSidePanel() {
  const [activeTab, setActiveTab] = useState<'comment' | 'settings'>('comment')
  const [isExtensionActive, setIsExtensionActive] = useState(true)
  const [promptText, setPromptText] = useState('')
  const [comments, setComments] = useState<string[]>([
    'Loading...',
    'Loading...',
    'Loading...'
  ])
  const [fetchingComments, setFetchingComments] = useState(false)

  // Use custom hook for status messages
  const [statusMessage, showStatusMessage, clearStatusMessage] =
    useStatusMessage()
  const [
    responseStatusMessage,
    showResponseStatusMessage,
    clearResponseStatusMessage
  ] = useStatusMessage()

  const promptInputRef = useRef<HTMLTextAreaElement>(null)
  const activeToggleRef = useRef<HTMLInputElement>(null)

  const handleTabClick = (tab: 'comment' | 'settings') => {
    setActiveTab(tab)
  }

  useEffect(() => {
    loadSettings()

    setupLastPostTextWatcher()

    // Fetch variants when side panel first opens
    fetchVariants()

    // Listen for custom storage change events
    const handleStorageChange = (e: CustomEvent) => {
      if (e.detail.key === STORAGE_KEYS.LAST_POST_TEXT) {
        // Auto-switch to comment tab when post text is saved
        setActiveTab('comment')
        // Add a small delay to ensure storage is fully updated
        setTimeout(() => fetchVariants(), 100)
      }
    }

    document.addEventListener(
      'storage-change',
      handleStorageChange as EventListener
    )

    return () => {
      document.removeEventListener(
        'storage-change',
        handleStorageChange as EventListener
      )
    }
  }, [])

  // Watch for changes in extension active state
  useEffect(() => {
    if (activeTab === 'comment') {
      fetchVariants()
    }
  }, [isExtensionActive])

  // Load settings from storage
  const loadSettings = async () => {
    try {
      const result = await StorageService.get([
        STORAGE_KEYS.CUSTOM_PROMPT,
        STORAGE_KEYS.EXTENSION_ACTIVE,
        STORAGE_KEYS.DEFAULT_PROMPT
      ])

      // If user has a custom prompt saved, use that
      if (result[STORAGE_KEYS.CUSTOM_PROMPT]) {
        setPromptText(result[STORAGE_KEYS.CUSTOM_PROMPT])
      } else if (result[STORAGE_KEYS.DEFAULT_PROMPT]) {
        // Use stored default prompt if available
        setPromptText(result[STORAGE_KEYS.DEFAULT_PROMPT])
      } else {
        // Fallback to constant default prompt
        setPromptText(DEFAULT_PROMPT)
        // Store default prompt in storage
        await StorageService.set({
          [STORAGE_KEYS.DEFAULT_PROMPT]: DEFAULT_PROMPT
        })
      }

      setIsExtensionActive(result[STORAGE_KEYS.EXTENSION_ACTIVE] !== false)
    } catch (error) {
      showStatusMessage('Error loading settings')
    }
  }

  // Save settings
  const saveSettings = async () => {
    try {
      await StorageService.set({
        [STORAGE_KEYS.CUSTOM_PROMPT]: promptInputRef.current?.value,
        [STORAGE_KEYS.EXTENSION_ACTIVE]: activeToggleRef.current?.checked
      })

      setPromptText(promptInputRef.current?.value || '')
      setIsExtensionActive(activeToggleRef.current?.checked || false)

      showStatusMessage('Settings saved!')
      
      // Refresh comments to reflect the new active state
      fetchVariants()
    } catch (error) {
      showStatusMessage('Error saving settings')
    }
  }

  // Reset to default prompt
  const resetToDefault = async () => {
    try {
      // Get the default prompt
      const defaultPrompt = DEFAULT_PROMPT

      // Update UI
      setPromptText(defaultPrompt)

      // Clear custom prompt from storage
      await StorageService.set({ [STORAGE_KEYS.CUSTOM_PROMPT]: '' })

      showStatusMessage('Prompt reset to default!')
    } catch (error) {
      showStatusMessage('Error resetting prompt')
    }
  }

  // Fetch comment variants from OpenAI
  const fetchVariants = async () => {
    // Prevent multiple simultaneous fetches
    if (fetchingComments) return

    setFetchingComments(true)
    setComments(['Loading...', 'Loading...', 'Loading...'])
    clearResponseStatusMessage() // Clear any previous status messages

    try {
      // Fetch post and prompt data
      const dataFromStorage = await StorageService.get([
        STORAGE_KEYS.LAST_POST_TEXT,
        STORAGE_KEYS.CUSTOM_PROMPT,
        STORAGE_KEYS.DEFAULT_PROMPT,
        STORAGE_KEYS.EXTENSION_ACTIVE
      ])

      // Check if extension is active
      const isActive = dataFromStorage[STORAGE_KEYS.EXTENSION_ACTIVE] !== false
      if (!isActive) {
        setComments([
          'Extension is disabled. Enable it in settings to generate comments.',
          'Extension is disabled. Enable it in settings to generate comments.',
          'Extension is disabled. Enable it in settings to generate comments.'
        ])
        setFetchingComments(false)
        return
      }

      const postText = dataFromStorage[STORAGE_KEYS.LAST_POST_TEXT]
      // Extract actual post text (remove timestamp if present)
      const actualPostText = postText ? postText.split('|||')[0] : ''
      const customPromptValue = dataFromStorage[STORAGE_KEYS.CUSTOM_PROMPT]
      const defaultPromptValue =
        dataFromStorage[STORAGE_KEYS.DEFAULT_PROMPT] || DEFAULT_PROMPT

      // Use custom prompt if it exists, otherwise use default prompt
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

      const generatedComments = await openAIService.generateComment(content)

      // Parse the response - it might return as a single string with separators
      let commentArray: string[] = []
      if (Array.isArray(generatedComments)) {
        commentArray = generatedComments
      } else if (typeof generatedComments === 'string') {
        // Split by "---" if the API returned all variants in one string
        commentArray = generatedComments
          .split(/\s*---\s*/g)
          .filter((c) => c.trim())
      }

      // Update state with comments
      setComments(
        commentArray.length > 0
          ? commentArray
          : [
              'No comment generated',
              'No comment generated',
              'No comment generated'
            ]
      )
    } catch (error: any) {
      showResponseStatusMessage(
        error.userMessage || 'Failed to generate comments'
      )
      setComments([
        'Error generating comment variants',
        'Error generating comment variants',
        'Error generating comment variants'
      ])
    } finally {
      setFetchingComments(false)
    }
  }

  // Handle comment variant click
  const handleCommentClick = (comment: string) => {
    // Check if extension is active before applying comment
    if (!isExtensionActive) {
      showResponseStatusMessage('Extension is disabled. Enable it in settings first.')
      return
    }

    if (
      !comment ||
      comment.includes('No post selected') ||
      comment.includes('Error generating') ||
      comment.includes('Extension is disabled')
    ) {
      showResponseStatusMessage('Cannot use this comment')
      return
    }

    showResponseStatusMessage('Applying comment...')

    // Send message to content script to fill the comment box
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) {
        showResponseStatusMessage('Error: No active tab found')
        return
      }

      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: 'fillCommentBox', comment },
        () => {
          const lastError = chrome.runtime.lastError
          if (lastError) {
            showResponseStatusMessage(`Error: ${lastError.message}`)
            return
          }

          showResponseStatusMessage('Comment applied to LinkedIn!')
        }
      )
    })
  }

  return (
    <div className="flex flex-col h-screen w-full">
      <div className="flex border-b border-secondary">
        <button
          className={`py-2 px-4 font-medium ${
            activeTab === 'comment'
              ? 'border-b-2 border-primary'
              : 'hover:bg-secondary'
          }`}
          onClick={() => handleTabClick('comment')}>
          Comment
        </button>
        <button
          className={`py-2 px-4 font-medium ${
            activeTab === 'settings'
              ? 'border-b-2 border-primary'
              : 'hover:bg-secondary'
          }`}
          onClick={() => handleTabClick('settings')}>
          Settings
        </button>
      </div>

      <div className="flex-1 p-4">
        {activeTab === 'comment' && (
          <div id="commentTab" className="comment-tab pt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">AI Comment Suggestions</h3>
              <button
                className={`px-3 py-1 text-sm rounded cursor-pointer transition-all duration-200 ${
                  isExtensionActive && !fetchingComments
                    ? 'bg-accent text-white hover:bg-opacity-80'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                onClick={fetchVariants}
                disabled={fetchingComments || !isExtensionActive}>
                {fetchingComments ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            <div id="comments" className="flex flex-col gap-4">
              {comments.map((comment, index) => (
                <div
                  key={index}
                  className={`comment-variant pt-5 p-4 transition-all duration-200 border-l-[3px] border-accent relative ${
                    isExtensionActive && !comment.includes('Extension is disabled')
                      ? 'bg-secondary cursor-pointer hover:bg-white hover:-translate-y-0.5 hover:shadow-md after:content-[\'Click_to_use\'] after:absolute after:top-1 after:right-2 after:text-xs after:opacity-0 after:text-accent after:transition-opacity hover:after:opacity-100'
                      : 'bg-gray-100 cursor-not-allowed opacity-60'
                  }`}
                  data-idx={index}
                  onClick={() => handleCommentClick(comment)}>
                  {comment}
                </div>
              ))}
            </div>
            <StatusDisplay message={responseStatusMessage} />
          </div>
        )}

        {activeTab === 'settings' && (
          <div
            id="settingsTab"
            className="settings-tab pt-4 flex flex-col">
            <div className="flex items-center justify-between relative gap-2">
              <label className="block font-medium" htmlFor="activeToggle">
                Enable Extension
              </label>
              <input
                type="checkbox"
                id="activeToggle"
                ref={activeToggleRef}
                checked={isExtensionActive}
                onChange={(e) => setIsExtensionActive(e.target.checked)}
              />
            </div>
            <div className='mt-4'>
              <label className="block font-medium" htmlFor="customPrompt">
                Instrudctions:
              </label>
              <p className="text-xs mb-2 italic text-black/50">
                {promptText === DEFAULT_PROMPT
                  ? 'This is the default prompt. You can customize it to control how the AI generates comments.'
                  : "You're using a custom prompt. You can reset to the default using the button below."}
              </p>
              <textarea
                className="w-full p-3 mb-2 border-2 resize-y transition-all duration-200 ease-in-out min-h-[200px]
                focus:outline-none"
                id="customPrompt"
                rows={8}
                ref={promptInputRef}
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
              />
              <div className="flex gap-4">
                <button
                  className="flex-1 bg-accent text-white py-3 px-4 cursor-pointer transition-all duration-200 text-sm"
                  id="savePrompt"
                  onClick={saveSettings}>
                  Save Prompt
                </button>
                <button
                  className="flex-1 bg-accent text-white py-3 px-4 cursor-pointer transition-all duration-200 text-sm"
                  id="resetPrompt"
                  onClick={resetToDefault}>
                  Reset to Default
                </button>
              </div>
            </div>
            <StatusDisplay message={statusMessage} />
          </div>
        )}
      </div>
    </div>
  )
}

export default IndexSidePanel
