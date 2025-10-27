/**
 * Custom hook for managing settings state and operations
 */

import type { RefObject } from 'react'
import { useState } from 'react'

import { DEFAULT_PROMPT } from '../lib/constants'
import openAIService from '../services/gemini'
import StorageService, { STORAGE_KEYS } from '../services/storage'

export const useSettings = (
  promptInputRef: RefObject<HTMLTextAreaElement>,
  activeToggleRef: RefObject<HTMLInputElement>,
  autoCommentTargetRef: RefObject<HTMLInputElement>
) => {
  const [isExtensionActive, setIsExtensionActive] = useState(true)
  const [promptText, setPromptText] = useState('')
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [autoCommentTarget, setAutoCommentTarget] = useState(30)
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  // Load settings from storage
  const loadSettings = async () => {
    const result = await StorageService.getData([
      STORAGE_KEYS.CUSTOM_PROMPT,
      STORAGE_KEYS.EXTENSION_ACTIVE,
      STORAGE_KEYS.DEFAULT_PROMPT,
      STORAGE_KEYS.AUTO_COMMENT_TARGET,
      STORAGE_KEYS.API_KEY
    ])

    if (result[STORAGE_KEYS.CUSTOM_PROMPT]) {
      setPromptText(result[STORAGE_KEYS.CUSTOM_PROMPT])
    } else if (result[STORAGE_KEYS.DEFAULT_PROMPT]) {
      setPromptText(result[STORAGE_KEYS.DEFAULT_PROMPT])
    } else {
      setPromptText(DEFAULT_PROMPT)
      await StorageService.setData({
        [STORAGE_KEYS.DEFAULT_PROMPT]: DEFAULT_PROMPT
      })
    }

    setIsExtensionActive(result[STORAGE_KEYS.EXTENSION_ACTIVE] !== false)
    setAutoCommentTarget(result[STORAGE_KEYS.AUTO_COMMENT_TARGET] || 30)
    setApiKeyInput(result[STORAGE_KEYS.API_KEY] || '')
  }

  // Save settings with API key validation
  const saveSettings = async (
    onSuccess: (message: string) => void,
    onError: (message: string) => void
  ) => {
    if (isSavingSettings) return

    setIsSavingSettings(true)

    if (apiKeyInput && apiKeyInput.trim() !== '') {
      onSuccess('Validating API key...')

      const validation = await openAIService.validateApiKey(apiKeyInput.trim())

      if (!validation.valid) {
        onError(validation.message)
        setIsSavingSettings(false)
        return false
      }

      onSuccess('API key validated successfully!')
    }

    await StorageService.setData({
      [STORAGE_KEYS.CUSTOM_PROMPT]: promptInputRef.current?.value || '',
      [STORAGE_KEYS.EXTENSION_ACTIVE]: activeToggleRef.current?.checked ?? true,
      [STORAGE_KEYS.AUTO_COMMENT_TARGET]: parseInt(
        autoCommentTargetRef.current?.value || '30'
      ),
      [STORAGE_KEYS.API_KEY]: apiKeyInput.trim()
    })

    setPromptText(promptInputRef.current?.value || '')
    setIsExtensionActive(activeToggleRef.current?.checked ?? true)
    setAutoCommentTarget(parseInt(autoCommentTargetRef.current?.value || '30'))

    onSuccess('All settings saved successfully!')
    setIsSavingSettings(false)
    return true
  }

  // Reset to default prompt
  const resetToDefault = async (onSuccess: (message: string) => void) => {
    setPromptText(DEFAULT_PROMPT)
    await StorageService.setData({ [STORAGE_KEYS.CUSTOM_PROMPT]: '' })
    onSuccess('Prompt reset to default!')
  }

  return {
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
  }
}
