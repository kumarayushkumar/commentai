/**
 * OpenAI Service for generating comments on LinkedIn posts
 * This service interacts with the OpenAI API to generate comments based on post content.
 * It handles API errors and provides user-friendly messages.
 */

import { GoogleGenAI } from '@google/genai'

import { AI_SETTINGS } from '~lib/constants'
import { showNotification } from '~lib/notification'
import { getApiKey } from '~lib/storageEvents'


export class GeminiService {
  /**
   * Generate a comment for a LinkedIn post
   * @param content - The content of the LinkedIn post and prompt
   * @param isSingleCommentMode - Whether to generate a single comment or multiple
   * @returns Generated comment(s) or false if error
   */
  async generateComment({
    content,
    isSingleCommentMode = false
  }: {
    content: string
    isSingleCommentMode?: boolean
  }): Promise<string | string[] | false> {
    try {
      const apiKey = await getApiKey()
      if (!apiKey) return false

      const ai = new GoogleGenAI({ apiKey })

      const count = isSingleCommentMode ? 1 : AI_SETTINGS.N

      const results: Awaited<ReturnType<typeof ai.models.generateContent>>[] = []
      for (let i = 0; i < count; i++) {
        const result = await ai.models.generateContent({
          model: AI_SETTINGS.MODEL,
          contents: content,
          config: { temperature: AI_SETTINGS.TEMPERATURE }
        })
        results.push(result)
        if (i < count - 1) await new Promise((r) => setTimeout(r, 500))
      }

      const comments = results
        .map((result) => result?.candidates?.[0]?.content?.parts?.[0]?.text ?? result?.text)
        .filter((text): text is string => !!text && !!text.trim())

      if (comments.length === 0) {
        showNotification('No response from AI. Please try again.', 'error')
        return false
      }

      return isSingleCommentMode ? comments[0] : comments
    } catch (error: any) {
      // Parse error for quota/rate limit issues
      if (error?.message) {
        try {
          const errorData = JSON.parse(error.message)

          if (errorData?.error) {
            const errorCode = errorData.error.code
            const errorStatus = errorData.error.status
            const errorMessage = errorData.error.message

            // Handle service unavailable (503)
            if (errorCode === 503 || errorStatus === 'UNAVAILABLE') {
              showNotification(
                `Gemini API is currently overloaded. Please try again in a few minutes.`,
                'error'
              )
              return false
            }

            // Handle quota exceeded (429)
            if (errorCode === 429 || errorStatus === 'RESOURCE_EXHAUSTED') {
              // Extract retry delay if available
              const retryInfo = errorData.error.details?.find((d: any) =>
                d['@type']?.includes('RetryInfo')
              )
              const retryDelay = retryInfo?.retryDelay

              if (retryDelay) {
                const seconds = parseInt(retryDelay) || 60
                const minutes = Math.ceil(seconds / 60)
                showNotification(
                  `Gemini API rate limit hit. Please wait ${minutes} minute(s) and try again.`,
                  'error'
                )
                return false
              }

              showNotification(
                `Gemini API quota exceeded. Please try again later or upgrade your plan.`,
                'error'
              )
              return false
            }

            // Handle other API errors
            if (errorMessage) {
              const shortMessage = errorMessage.split('.')[0]
              showNotification(`API Error: ${shortMessage}`, 'error')
              return false
            }
          }
        } catch (parseError) {
          // Failed to parse as JSON, continue to generic error
        }
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      showNotification(`Failed to generate comment: ${errorMessage}`, 'error')
      return false
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
