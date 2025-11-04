/**
 * TypeScript interfaces for various configurations and settings used in the application.
 */

export interface AISettings {
  MODEL: string
  TEMPERATURE: number
  N: number
}

export interface LinkedInSelectors {
  COMMENT_BUTTON: string
  COMMENT_BOX: string
  COMMENT_INPUT: string
  POST_CONTAINER: string
  POST_CONTENT: string
  SUBMIT_COMMENT_BUTTON: string
  PROMOTED_POST: string
  LIKE_BUTTON: string
}

declare global {
  interface Window {
    chrome: typeof chrome
  }
}
