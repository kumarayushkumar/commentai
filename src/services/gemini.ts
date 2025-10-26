/**
 * OpenAI Service for generating comments on LinkedIn posts
 * This service interacts with the OpenAI API to generate comments based on post content.
 * It handles API errors and provides user-friendly messages.
 */

import { GoogleGenAI } from '@google/genai'
import { AI_SETTINGS } from '~lib/constants'

import { getApiKey } from '~lib/storageEvents'

interface GeminiError extends Error {
  userMessage?: string
}

export class GeminiService {
  /**
   * Generate a comment for a LinkedIn post
   * @param content - The content of the LinkedIn post and prompt
   * @param isSingleCommentMode - Whether to generate a single comment or multiple
   * @returns Generated comment(s)
   */
  async generateComment({
    content,
    isSingleCommentMode = false
  }: {
    content: string
    isSingleCommentMode?: boolean
  }): Promise<string | string[]> {
    try {
      const apiKey = await getApiKey()
      if (!apiKey) return

      const ai = new GoogleGenAI({ apiKey })

      const response = await ai.models.generateContent({
        model: AI_SETTINGS.MODEL,
        contents: content,
        config: {
          temperature: AI_SETTINGS.TEMPERATURE,
          candidateCount: isSingleCommentMode ? AI_SETTINGS.N : 1,
        }
      })

      const data = response.text
      if (!response.) {
        throw new Error(data.error?.message || 'API Error')
      }

      let result = (data.choices || []).map(
        (choice: { message: { content: string } }) =>
          choice.message?.content?.trim() || ''
      )
      return result
    } catch (error) {
      const enhancedError = new Error(
        error instanceof Error ? error.message : 'Unknown error'
      ) as GeminiError

      // Format error message based on type
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          enhancedError.userMessage =
            'API key not configured. Please update your settings.'
        } else if (
          error.message.includes('rate limit') ||
          error.message.includes('quota')
        ) {
          enhancedError.userMessage =
            'API rate limit exceeded. Please try again later.'
        } else if (
          error.message.includes('network') ||
          error.message.includes('connect')
        ) {
          enhancedError.userMessage =
            'Network error. Please check your internet connection.'
        } else {
          enhancedError.userMessage = error.message || 'An error occurred'
        }
      } else {
        enhancedError.userMessage = 'An unexpected error occurred'
      }

      throw enhancedError
    }
  }
}

const geminiService = new GeminiService()
export default geminiService
