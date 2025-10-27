/**
 * Comment tab component for displaying and selecting AI-generated comments
 */

import { StatusDisplay } from './StatusDisplay'

interface CommentTabProps {
  comments: string[]
  isExtensionActive: boolean
  fetchingComments: boolean
  statusMessage: string
  onRefresh: () => void
  onCommentClick: (comment: string) => void
}

export const CommentTab = ({
  comments,
  isExtensionActive,
  fetchingComments,
  statusMessage,
  onRefresh,
  onCommentClick
}: CommentTabProps) => {
  if (!isExtensionActive) {
    return (
      <div id="commentTab" className="comment-tab pt-4">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-600 text-center">
            Enable extension in settings
          </p>
        </div>
      </div>
    )
  }

  return (
    <div id="commentTab" className="comment-tab pt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">AI Comment Suggestions</h3>
        <button
          className={`px-3 py-1 text-sm rounded cursor-pointer transition-all duration-200 ${
            !fetchingComments
              ? 'bg-accent text-white hover:bg-opacity-80'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          onClick={onRefresh}
          disabled={fetchingComments}>
          {fetchingComments ? 'Thinking...' : 'Refresh'}
        </button>
      </div>

      <div id="comments" className="flex flex-col gap-4">
        {comments.map((comment, index) => (
          <div
            key={index}
            className="comment-variant pt-5 p-4 transition-all duration-200 border-l-[3px] border-accent relative bg-secondary cursor-pointer hover:bg-white hover:-translate-y-0.5 hover:shadow-md after:content-['Click_to_use'] after:absolute after:top-1 after:right-2 after:text-xs after:opacity-0 after:text-accent after:transition-opacity hover:after:opacity-100"
            data-idx={index}
            onClick={() => onCommentClick(comment)}>
            {comment}
          </div>
        ))}
      </div>

      <StatusDisplay message={statusMessage} />
    </div>
  )
}
