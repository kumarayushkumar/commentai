/**
 * Auto comment tab component for automated commenting
 */

import { StatusDisplay } from './StatusDisplay'

interface AutoCommentTabProps {
  autoCommentTarget: number
  isAutoCommenting: boolean
  isExtensionActive: boolean
  autoCommentProgress: { current: number; total: number }
  statusMessage: string
  onStart: () => void
  onStop: () => void
}

export const AutoCommentTab = ({
  autoCommentTarget,
  isAutoCommenting,
  isExtensionActive,
  autoCommentProgress,
  statusMessage,
  onStart,
  onStop
}: AutoCommentTabProps) => {
  if (!isExtensionActive) {
    return (
      <div id="autoCommentTab" className="auto-comment-tab pt-4">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-600 text-center">
            Enable extension in settings
          </p>
        </div>
      </div>
    )
  }

  return (
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
              className="flex-1 py-3 px-4 font-medium text-white cursor-pointer transition-all duration-200 bg-accent hover:bg-opacity-80"
              onClick={onStart}>
              Start Auto Comment
            </button>
          ) : (
            <button
              className="flex-1 bg-red-500 text-white py-3 px-4 font-medium cursor-pointer transition-all duration-200 hover:bg-red-600"
              onClick={onStop}>
              Stop Auto Comment
            </button>
          )}
        </div>

        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mt-4">
          <p className="text-sm text-yellow-700">
            <strong>Note:</strong> The extension will wait 5-9 seconds (random)
            between each comment to avoid being flagged by LinkedIn. Make sure
            you're on your LinkedIn feed page before starting.
          </p>
        </div>
      </div>

      <StatusDisplay message={statusMessage} />
    </div>
  )
}
