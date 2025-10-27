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
      if (!apiKey) {
        return [
          'Error generating comment variants',
          'Error generating comment variants',
          'Error generating comment variants'
        ]
      }

      const ai = new GoogleGenAI({ apiKey })

      // Generate content using the correct API structure
      const result = await ai.models.generateContent({
        model: AI_SETTINGS.MODEL,
        contents: content,
        config: {
          temperature: AI_SETTINGS.TEMPERATURE,
          candidateCount: isSingleCommentMode ? 1 : 3
        }
      })

      console.log('Gemini generateComment result:', result)

      if (!result || !result.candidates || result.candidates.length === 0) {
        return [
          'Error generating comment variants',
          'Error generating comment variants',
          'Error generating comment variants'
        ]
      }

      // Extract text from all candidates
      const comments = result.candidates
        .map((candidate) => candidate.content?.parts?.[0]?.text)
        .filter((text) => text && text.trim())

      return comments.length > 0
        ? comments
        : [
            'Error generating comment variants',
            'Error generating comment variants',
            'Error generating comment variants'
          ]
    } catch (error) {
      return [
        'Error generating comment variants',
        'Error generating comment variants',
        'Error generating comment variants'
      ]
    }
  }

  /**
   * Validate API key by making a test call to Gemini API
   * @param apiKey - The API key to validate
   * @returns {Promise<{ valid: boolean; message: string }>} - Validation result
   */
  async validateApiKey(
    apiKey: string
  ): Promise<{ valid: boolean; message: string }> {
    try {
      if (!apiKey || apiKey.trim() === '') {
        return {
          valid: false,
          message: 'API key cannot be empty'
        }
      }

      const ai = new GoogleGenAI({ apiKey })

      // Make a simple test call with minimal content
      const result = await ai.models.generateContent({
        model: AI_SETTINGS.MODEL,
        contents: 'Say "API key is valid" in one word',
        config: {
          temperature: 0.1,
          candidateCount: 1
        }
      })

      if (!result || !result.text) {
        return {
          valid: false,
          message: 'API returned no response'
        }
      }

      return {
        valid: true,
        message: 'API key is valid!'
      }
    } catch (error) {
      let errorMessage = 'Invalid API key'

      if (error instanceof Error) {
        if (
          error.message.includes('API key') ||
          error.message.includes('authentication')
        ) {
          errorMessage = 'Invalid API key. Please check your key and try again.'
        } else if (
          error.message.includes('rate limit') ||
          error.message.includes('quota')
        ) {
          errorMessage = 'API rate limit exceeded. Please try again later.'
        } else if (
          error.message.includes('network') ||
          error.message.includes('connect')
        ) {
          errorMessage = 'Network error. Please check your internet connection.'
        } else {
          errorMessage = error.message || 'Failed to validate API key'
        }
      }

      return {
        valid: false,
        message: errorMessage
      }
    }
  }
}

const geminiService = new GeminiService()
export default geminiService
