/**
 * Feedback tab component for user feedback and feature requests
 */

export const FeedbackTab = () => {
  return (
    <div id="feedbackTab" className="feedback-tab pt-4">
      <div className="flex flex-col ">
        <div className="font-medium ">
          <p className="text-base">Feedback, feature request or any suggestion.</p>
          <p className="text-base">I'd love to hear from you!</p>
        </div>
        <a
          href="https://x.com/ayushkumarkeirn"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent text-lg pt-4 hover:underline font-semibold">
          DM me on X @ayushkumarkeirn
        </a>
      </div>
    </div>
  )
}
