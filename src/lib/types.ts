/**
 * TypeScript interfaces for various configurations and settings used in the application.
 */

export interface AISettings {
  MODEL: string;
  TEMPERATURE: number;
  N: number;
}

export interface LinkedInSelectors {
  COMMENT_BUTTON: string;
  COMMENT_BOX: string;
  COMMENT_INPUT: string;
  POST_CONTAINER: string;
  POST_CONTENT: string;
}