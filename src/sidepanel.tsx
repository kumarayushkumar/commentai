/**
 * Side panel component for the LinkedIn AI Comment Generator extension.
 * Provides UI for generating and managing AI-generated comment suggestions.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import './style.css'

import { DEFAULT_PROMPT } from './lib/constants'
import { setupLastPostTextWatcher } from './lib/storageEvents'
import openAIService from './services/gemini'
import StorageService, { STORAGE_KEYS } from './services/storage'

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
  const [activeTab, setActiveTab] = useState<
    'comment' | 'autoComment' | 'settings'
  >('comment')
  const [isExtensionActive, setIsExtensionActive] = useState(true)
  const [promptText, setPromptText] = useState('')
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [comments, setComments] = useState<string[]>([
    'Loading...',
    'Loading...',
    'Loading...'
  ])
  const [fetchingComments, setFetchingComments] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  // Auto comment states
  const [isAutoCommenting, setIsAutoCommenting] = useState(false)
  const [autoCommentProgress, setAutoCommentProgress] = useState({
    current: 0,
    total: 0
  })
  const [autoCommentTarget, setAutoCommentTarget] = useState(30)

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
  const autoCommentTargetRef = useRef<HTMLInputElement>(null)

  const handleTabClick = (tab: 'comment' | 'autoComment' | 'settings') => {
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

    // Listen for open settings events
    const handleOpenSettings = (e: CustomEvent) => {
      setActiveTab('settings')
    }

    // Listen for messages from background script
    const handleBackgroundMessage = (message: any) => {
      if (message.action === 'openSettingsTab') {
        setActiveTab('settings')
      }
    }

    chrome.runtime.onMessage.addListener(handleBackgroundMessage)

    document.addEventListener(
      'storage-change',
      handleStorageChange as EventListener
    )
    document.addEventListener(
      'open-settings',
      handleOpenSettings as EventListener
    )

    return () => {
      document.removeEventListener(
        'storage-change',
        handleStorageChange as EventListener
      )
      document.removeEventListener(
        'open-settings',
        handleOpenSettings as EventListener
      )
      chrome.runtime.onMessage.removeListener(handleBackgroundMessage)
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
      const result = await StorageService.getData([
        STORAGE_KEYS.CUSTOM_PROMPT,
        STORAGE_KEYS.EXTENSION_ACTIVE,
        STORAGE_KEYS.DEFAULT_PROMPT,
        STORAGE_KEYS.AUTO_COMMENT_TARGET,
        'API_KEY'
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
        await StorageService.setData({
          [STORAGE_KEYS.DEFAULT_PROMPT]: DEFAULT_PROMPT
        })
      }

      setIsExtensionActive(result[STORAGE_KEYS.EXTENSION_ACTIVE] !== false)
      setAutoCommentTarget(result[STORAGE_KEYS.AUTO_COMMENT_TARGET] || 30)
      setApiKeyInput(result['API_KEY'] || '')
    } catch (error) {
      showStatusMessage('Error loading settings')
    }
  }

  // Save settings with API key validation
  const saveSettings = async () => {
    if (isSavingSettings) return

    setIsSavingSettings(true)
    clearStatusMessage()

    try {
      // Validate API key if it's provided and changed
      if (apiKeyInput && apiKeyInput.trim() !== '') {
        showStatusMessage('Validating API key...')

        const validation = await openAIService.validateApiKey(
          apiKeyInput.trim()
        )

        if (!validation.valid) {
          showStatusMessage(validation.message)
          setIsSavingSettings(false)
          return
        }

        showStatusMessage('API key validated successfully!')
      }

      // Save all settings
      await StorageService.setData({
        [STORAGE_KEYS.CUSTOM_PROMPT]: promptInputRef.current?.value || '',
        [STORAGE_KEYS.EXTENSION_ACTIVE]:
          activeToggleRef.current?.checked ?? true,
        [STORAGE_KEYS.AUTO_COMMENT_TARGET]: parseInt(
          autoCommentTargetRef.current?.value || '30'
        ),
        API_KEY: apiKeyInput.trim()
      })

      // Update local state
      setPromptText(promptInputRef.current?.value || '')
      setIsExtensionActive(activeToggleRef.current?.checked ?? true)
      setAutoCommentTarget(
        parseInt(autoCommentTargetRef.current?.value || '30')
      )

      showStatusMessage('All settings saved successfully!')

      // Refresh comments to reflect the new settings
      if (apiKeyInput && apiKeyInput.trim() !== '') {
        setTimeout(() => {
          fetchVariants()
        }, 500)
      }
    } catch (error: any) {
      showStatusMessage(error.message || 'Error saving settings')
    } finally {
      setIsSavingSettings(false)
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
      await StorageService.setData({ [STORAGE_KEYS.CUSTOM_PROMPT]: '' })

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
      const dataFromStorage = await StorageService.getData([
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

      const generatedComments = await openAIService.generateComment({ content })

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
      showResponseStatusMessage(
        'Extension is disabled. Enable it in settings first.'
      )
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

  // Generate random delay between 5-9 seconds
  const getRandomDelay = () => {
    return Math.floor(Math.random() * (9000 - 5000 + 1)) + 5000
  }

  // Auto comment function
  const autoComment = async () => {
    if (!isExtensionActive) {
      showResponseStatusMessage(
        'Extension is disabled. Enable it in settings first.'
      )
      return
    }

    setIsAutoCommenting(true)
    setAutoCommentProgress({ current: 0, total: autoCommentTarget })

    try {
      // TODO: Implement auto comment logic
      // This is a placeholder that will be implemented in the next step
      console.log(`Starting auto comment for ${autoCommentTarget} posts...`)

      // Placeholder for demonstration
      for (let i = 1; i <= autoCommentTarget; i++) {
        if (!isAutoCommenting) break // Check if stopped

        setAutoCommentProgress({ current: i, total: autoCommentTarget })

        // TODO: Actual comment logic will go here
        // 1. Find next post
        // 2. Extract post content
        // 3. Generate comment using AI
        // 4. Post comment
        // 5. Wait random delay

        const delay = getRandomDelay()
        console.log(
          `Processed post ${i}/${autoCommentTarget}, waiting ${delay / 1000}s...`
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
      }

      showResponseStatusMessage(
        `Auto commenting complete! Processed ${autoCommentTarget} posts.`
      )
    } catch (error) {
      showResponseStatusMessage(
        'Auto commenting failed: ' + (error as Error).message
      )
    } finally {
      setIsAutoCommenting(false)
      setAutoCommentProgress({ current: 0, total: 0 })
    }
  }

  // Stop auto commenting
  const stopAutoComment = () => {
    setIsAutoCommenting(false)
    showResponseStatusMessage('Auto commenting stopped.')
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
            activeTab === 'autoComment'
              ? 'border-b-2 border-primary'
              : 'hover:bg-secondary'
          }`}
          onClick={() => handleTabClick('autoComment')}>
          Auto Comment
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
                    isExtensionActive &&
                    !comment.includes('Extension is disabled')
                      ? "bg-secondary cursor-pointer hover:bg-white hover:-translate-y-0.5 hover:shadow-md after:content-['Click_to_use'] after:absolute after:top-1 after:right-2 after:text-xs after:opacity-0 after:text-accent after:transition-opacity hover:after:opacity-100"
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

        {activeTab === 'autoComment' && (
          <div id="autoCommentTab" className="auto-comment-tab pt-4">
            <div className="flex flex-col gap-4">
              <h3 className="text-lg font-semibold">Auto Comment Mode</h3>
              <p className="text-sm text-gray-600">
                Automatically comment on {autoCommentTarget} LinkedIn posts with
                AI-generated comments.
              </p>

              {isAutoCommenting && (
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                  <p className="font-semibold text-blue-700">
                    Commenting in progress...
                  </p>
                  <p className="text-sm text-blue-600 mt-1">
                    Progress: {autoCommentProgress.current} /{' '}
                    {autoCommentProgress.total}
                  </p>
                </div>
              )}

              <div className="flex gap-4">
                {!isAutoCommenting ? (
                  <button
                    className={`flex-1 py-3 px-4 font-medium text-white cursor-pointer transition-all duration-200 ${
                      isExtensionActive
                        ? 'bg-accent hover:bg-opacity-80'
                        : 'bg-gray-300 cursor-not-allowed'
                    }`}
                    onClick={autoComment}
                    disabled={!isExtensionActive}>
                    Start Auto Comment
                  </button>
                ) : (
                  <button
                    className="flex-1 bg-red-500 text-white py-3 px-4 font-medium cursor-pointer transition-all duration-200 hover:bg-red-600"
                    onClick={stopAutoComment}>
                    Stop Auto Comment
                  </button>
                )}
              </div>

              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mt-4">
                <p className="text-sm text-yellow-700">
                  <strong>Note:</strong> The extension will wait 5-9 seconds
                  (random) between each comment to avoid being flagged by
                  LinkedIn. Make sure you're on your LinkedIn feed page before
                  starting.
                </p>
              </div>
            </div>
            <StatusDisplay message={responseStatusMessage} />
          </div>
        )}

        {activeTab === 'settings' && (
          <div
            id="settingsTab"
            className="settings-tab pt-4 flex flex-col gap-4">
            {/* Extension Active Toggle */}
            <div className="flex items-center justify-between gap-2 pb-3 border-b">
              <label className="block font-medium" htmlFor="activeToggle">
                Enable Extension
              </label>
              <input
                type="checkbox"
                id="activeToggle"
                ref={activeToggleRef}
                checked={isExtensionActive}
                onChange={(e) => setIsExtensionActive(e.target.checked)}
                className="w-5 h-5 cursor-pointer"
              />
            </div>

            {/* API Key Section */}
            <div className="flex flex-col gap-2">
              <label className="block font-medium" htmlFor="apiKey">
                Google Gemini API Key
              </label>
              <input
                type="password"
                id="apiKey"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="Enter your API key"
                className="w-full p-2 border-2 focus:outline-none focus:border-accent"
              />
              <p className="text-xs text-gray-500">
                Get your API key from{' '}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline">
                  Google AI Studio
                </a>
              </p>
            </div>

            {/* Auto Comment Target */}
            <div className="flex items-center justify-between gap-2">
              <label className="block font-medium" htmlFor="autoCommentTarget">
                Number of Auto Comments
              </label>
              <input
                type="number"
                id="autoCommentTarget"
                ref={autoCommentTargetRef}
                defaultValue={autoCommentTarget}
                min="1"
                max="100"
                className="w-20 p-2 border-2 focus:outline-none focus:border-accent"
              />
            </div>

            {/* Custom Prompt Section */}
            <div className="flex flex-col gap-2">
              <label className="block font-medium" htmlFor="customPrompt">
                Instructions:
              </label>
              <p className="text-xs mb-1 italic text-black/50">
                {promptText === DEFAULT_PROMPT
                  ? 'This is the default prompt. You can customize it to control how the AI generates comments.'
                  : "You're using a custom prompt. You can reset to the default using the button below."}
              </p>
              <textarea
                className="w-full p-3 border-2 resize-y transition-all duration-200 ease-in-out min-h-[200px]
                focus:outline-none focus:border-accent"
                id="customPrompt"
                rows={8}
                ref={promptInputRef}
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
              />
              <div className="flex justify-end">
                <button
                  className="bg-gray-700 text-white py-2 px-4 text-xs  cursor-pointer transition-all duration-200 hover:font-medium hover:bg-gray-900"
                  onClick={resetToDefault}
                  disabled={isSavingSettings}>
                  Reset Prompt
                </button>
              </div>
            </div>

            <button
              className={`w-full py-3 px-4 font-medium text-white cursor-pointer transition-all duration-200 mt-4 ${
                isSavingSettings || !apiKeyInput.trim() || !promptText.trim()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-accent hover:bg-opacity-80'
              }`}
              onClick={saveSettings}
              disabled={
                isSavingSettings || !apiKeyInput.trim() || !promptText.trim()
              }>
              {isSavingSettings ? 'Saving...' : 'Save Settings'}
            </button>

            <StatusDisplay message={statusMessage} />
          </div>
        )}
      </div>
    </div>
  )
}

export default IndexSidePanel
