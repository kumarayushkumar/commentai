/**
 * Settings tab component for managing extension configuration
 */

import type { RefObject } from 'react'

import { StatusDisplay } from './StatusDisplay'

interface SettingsTabProps {
  isExtensionActive: boolean
  apiKeyInput: string
  autoCommentTarget: number
  promptText: string
  defaultPrompt: string
  isSavingSettings: boolean
  statusMessage: string
  activeToggleRef: RefObject<HTMLInputElement>
  autoCommentTargetRef: RefObject<HTMLInputElement>
  promptInputRef: RefObject<HTMLTextAreaElement>
  onExtensionActiveChange: (checked: boolean) => void
  onApiKeyChange: (value: string) => void
  onPromptChange: (value: string) => void
  onSaveSettings: () => void
  onResetPrompt: () => void
}

export const SettingsTab = ({
  isExtensionActive,
  apiKeyInput,
  autoCommentTarget,
  promptText,
  defaultPrompt,
  isSavingSettings,
  statusMessage,
  activeToggleRef,
  autoCommentTargetRef,
  promptInputRef,
  onExtensionActiveChange,
  onApiKeyChange,
  onPromptChange,
  onSaveSettings,
  onResetPrompt
}: SettingsTabProps) => {
  // Form is valid if prompt is not empty (API key is optional for updates)
  const isFormValid = promptText.trim() !== ''

  return (
    <div id="settingsTab" className="settings-tab pt-4 flex flex-col gap-4">
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
          onChange={(e) => onExtensionActiveChange(e.target.checked)}
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
          onChange={(e) => onApiKeyChange(e.target.value)}
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
          {promptText === defaultPrompt
            ? 'This is the default prompt. You can customize it to control how the AI generates comments.'
            : "You're using a custom prompt. You can reset to the default using the button below."}
        </p>
        <textarea
          className="w-full p-3 border-2 resize-y transition-all duration-200 ease-in-out min-h-[200px] focus:outline-none focus:border-accent"
          id="customPrompt"
          rows={8}
          ref={promptInputRef}
          value={promptText}
          onChange={(e) => onPromptChange(e.target.value)}
        />
        <div className="flex justify-end">
          <button
            className="bg-gray-700 text-white py-2 px-4 text-xs cursor-pointer transition-all duration-200 hover:font-medium hover:bg-gray-900"
            onClick={onResetPrompt}
            disabled={isSavingSettings}>
            Reset Prompt
          </button>
        </div>
      </div>

      {/* Save Settings Button */}
      <button
        className={`w-full py-3 px-4 font-medium text-white  transition-all duration-200 mt-2 ${
          isSavingSettings || !isFormValid
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-accent hover:bg-opacity-80 cursor-pointer'
        }`}
        onClick={onSaveSettings}
        disabled={isSavingSettings || !isFormValid}>
        {isSavingSettings ? 'Saving...' : 'Save Settings'}
      </button>

      <StatusDisplay message={statusMessage} />
    </div>
  )
}
