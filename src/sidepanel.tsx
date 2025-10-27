/**
 * Refactored Side panel component for the LinkedIn AI Comment Generator extension.
 * Provides UI for generating and managing AI-generated comment suggestions.
 */

import { useEffect, useRef, useState } from 'react'

import './style.css'

import { AutoCommentTab } from './components/AutoCommentTab'
import { CommentTab } from './components/CommentTab'
import { FeedbackTab } from './components/FeedbackTab'
import { SettingsTab } from './components/SettingsTab'
import { TabNavigation } from './components/TabNavigation'
import { useAutoComment } from './hooks/useAutoComment'
import { useComments } from './hooks/useComments'
import { useSettings } from './hooks/useSettings'
import { useStatusMessage } from './hooks/useStatusMessage'
import { DEFAULT_PROMPT } from './lib/constants'
import { setupLastPostTextWatcher } from './lib/storageEvents'
import StorageService, { STORAGE_KEYS } from './services/storage'

function IndexSidePanel() {
  // Refs
  const promptInputRef = useRef<HTMLTextAreaElement>(null)
  const activeToggleRef = useRef<HTMLInputElement>(null)
  const autoCommentTargetRef = useRef<HTMLInputElement>(null)

  const [activeTab, setActiveTab] = useState<
    'comment' | 'autoComment' | 'settings' | 'feedback'
  >('comment')

  const [statusMessage, showStatusMessage, clearStatusMessage] =
    useStatusMessage()

  const [responseStatusMessage, showResponseStatusMessage] = useStatusMessage()

  const {
    isExtensionActive,
    setIsExtensionActive,
    promptText,
    setPromptText,
    apiKeyInput,
    setApiKeyInput,
    autoCommentTarget,
    isSavingSettings,
    loadSettings,
    saveSettings,
    resetToDefault
  } = useSettings(promptInputRef, activeToggleRef, autoCommentTargetRef)

  const { comments, fetchingComments, fetchVariants, handleCommentClick } =
    useComments()

  const {
    isAutoCommenting,
    autoCommentProgress,
    startAutoComment,
    stopAutoComment
  } = useAutoComment()

  // Initialize on mount
  useEffect(() => {
    loadSettings()
    setupLastPostTextWatcher()
    fetchVariants()

    // Listen for storage changes
    const handleStorageChange = (e: CustomEvent) => {
      if (e.detail.key === STORAGE_KEYS.LAST_POST_TEXT) {
        setActiveTab('comment')
        setTimeout(() => fetchVariants(), 100)
      }
    }

    // Listen for settings open events
    const handleOpenSettings = () => setActiveTab('settings')

    // Listen for background messages
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

    // Cleanup function: clear last post text when side panel is closed
    return () => {
      chrome.runtime.onMessage.removeListener(handleBackgroundMessage)
      document.removeEventListener(
        'storage-change',
        handleStorageChange as EventListener
      )
      document.removeEventListener(
        'open-settings',
        handleOpenSettings as EventListener
      )

      StorageService.setData({
        [STORAGE_KEYS.LAST_POST_TEXT]: ''
      })
    }
  }, [])

  // Watch for extension active state changes
  useEffect(() => {
    if (activeTab === 'comment') {
      fetchVariants()
    }
  }, [isExtensionActive])

  // Handlers
  const handleExtensionActiveChange = async (checked: boolean) => {
    setIsExtensionActive(checked)
    // Save immediately to storage
    await StorageService.setData({
      [STORAGE_KEYS.EXTENSION_ACTIVE]: checked
    })
  }

  const handleSaveSettings = async () => {
    const success = await saveSettings(showStatusMessage, showStatusMessage)
    if (success && apiKeyInput.trim() !== '') {
      setTimeout(() => {
        fetchVariants()
      }, 500)
    }
  }

  const handleResetPrompt = async () => {
    await resetToDefault(showStatusMessage)
  }

  const handleRefreshComments = () => {
    fetchVariants()
  }

  const handleCommentSelect = (comment: string) => {
    handleCommentClick(comment, isExtensionActive, showResponseStatusMessage)
  }

  const handleStartAutoComment = () => {
    startAutoComment(
      autoCommentTarget,
      isExtensionActive,
      showResponseStatusMessage
    )
  }

  const handleStopAutoComment = () => {
    stopAutoComment(showResponseStatusMessage)
  }

  return (
    <div className="flex flex-col h-screen w-full">
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 p-4">
        {activeTab === 'comment' && (
          <CommentTab
            comments={comments}
            isExtensionActive={isExtensionActive}
            fetchingComments={fetchingComments}
            statusMessage={responseStatusMessage}
            onRefresh={handleRefreshComments}
            onCommentClick={handleCommentSelect}
          />
        )}

        {activeTab === 'autoComment' && (
          <AutoCommentTab
            autoCommentTarget={autoCommentTarget}
            isAutoCommenting={isAutoCommenting}
            isExtensionActive={isExtensionActive}
            autoCommentProgress={autoCommentProgress}
            statusMessage={responseStatusMessage}
            onStart={handleStartAutoComment}
            onStop={handleStopAutoComment}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            isExtensionActive={isExtensionActive}
            apiKeyInput={apiKeyInput}
            autoCommentTarget={autoCommentTarget}
            promptText={promptText}
            defaultPrompt={DEFAULT_PROMPT}
            isSavingSettings={isSavingSettings}
            statusMessage={statusMessage}
            activeToggleRef={activeToggleRef}
            autoCommentTargetRef={autoCommentTargetRef}
            promptInputRef={promptInputRef}
            onExtensionActiveChange={handleExtensionActiveChange}
            onApiKeyChange={setApiKeyInput}
            onPromptChange={setPromptText}
            onSaveSettings={handleSaveSettings}
            onResetPrompt={handleResetPrompt}
          />
        )}

        {activeTab === 'feedback' && <FeedbackTab />}
      </div>
    </div>
  )
}

export default IndexSidePanel
