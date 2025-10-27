/**
 * Custom hook for managing temporary status messages
 */

import { useCallback, useState } from 'react'

export const useStatusMessage = () => {
  const [message, setMessage] = useState('')

  const showMessage = useCallback((msg: string, duration = 3000) => {
    setMessage(msg)
    if (duration > 0) {
      setTimeout(() => setMessage(''), duration)
    }
  }, [])

  const clearMessage = useCallback(() => setMessage(''), [])

  return [message, showMessage, clearMessage] as const
}
