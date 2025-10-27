/**
 * Custom hook for managing auto comment functionality
 */

import { useState } from 'react'

export const useAutoComment = () => {
  const [isAutoCommenting, setIsAutoCommenting] = useState(false)
  const [autoCommentProgress, setAutoCommentProgress] = useState({
    current: 0,
    total: 0
  })

  const getRandomDelay = () => {
    return Math.floor(Math.random() * (9000 - 5000 + 1)) + 5000
  }

  const startAutoComment = async (
    target: number,
    isExtensionActive: boolean,
    showMessage: (message: string) => void
  ) => {
    if (!isExtensionActive) {
      showMessage('Extension is disabled. Enable it in settings first.')
      return
    }

    setIsAutoCommenting(true)
    setAutoCommentProgress({ current: 0, total: target })

    try {
      for (let i = 1; i <= target; i++) {
        if (!isAutoCommenting) break

        setAutoCommentProgress({ current: i, total: target })

        const delay = getRandomDelay()
        await new Promise((resolve) => setTimeout(resolve, delay))
      }

      showMessage(`Auto commenting complete! Processed ${target} posts.`)
    } catch (error) {
      showMessage('Auto commenting failed: ' + (error as Error).message)
    } finally {
      setIsAutoCommenting(false)
      setAutoCommentProgress({ current: 0, total: 0 })
    }
  }

  const stopAutoComment = (showMessage: (message: string) => void) => {
    setIsAutoCommenting(false)
    showMessage('Auto commenting stopped.')
  }

  return {
    isAutoCommenting,
    autoCommentProgress,
    startAutoComment,
    stopAutoComment
  }
}
