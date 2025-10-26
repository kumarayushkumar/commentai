/**
 * Constants for the LinkedIn Auto Commenter Extension
 * This file contains settings for AI model, LinkedIn DOM selectors, and default prompt.
 */

import type { AISettings, LinkedInSelectors } from "./types";

/**
 * AI model settings
 * These control the behavior of the OpenAI API requests
 */
export const AI_SETTINGS: AISettings = {
  MODEL: "gemini-2.0-flash",
  TEMPERATURE: 0.4,
  N: 3,
};

/**
 * LinkedIn DOM selectors
 * Update these if LinkedIn changes their HTML structure
 */
export const LINKEDIN_SELECTORS: LinkedInSelectors = {
  COMMENT_BUTTON: 'button[aria-label="Comment"].artdeco-button--tertiary',
  COMMENT_BOX: ".comments-comment-box-comment__text-editor",
  COMMENT_INPUT: '[data-test-ql-editor-contenteditable="true"]',
  POST_CONTAINER: ".feed-shared-update-v2, .scaffold-finite-scroll__content",
  POST_CONTENT:
    ".feed-shared-update-v2__description, .update-components-text, [data-test-feed-shared-text]",
};

/**
 * Default prompt template
 * This is used when the user hasn't set a custom prompt
 */
export const DEFAULT_PROMPT =
  "Give a comment that is valuable, knowledge, or any additional points I can add to the post, and in last a small conversation starter question\n\n" +
  "Follow these instructions strictly\n" +
  "1. The comment length must be 3-4 lines max and 6-8 words in a line\n" +
  "2. There should not be praise for the post like people do on LinkedIn\n" +
  "3. This comment must sound like it's written by a human, not AI, using simple English words\n" +
  "4. Use my tone of talking, a little humour, and happiness\n" +
  '5. You can add words like "I think, like, you should, you can, etc" to make it more human\n';
