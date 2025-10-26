/**
 * Show notification message
 * @param message - Message to display
 * @param type - Notification type: 'info', 'success', 'error', 'warning'
 * @param duration - How long to show the notification in ms
 * @returns The notification element
 */
export function showNotification(
  message: string,
  type: 'info' | 'success' | 'error' | 'warning' = 'info',
  duration: number = 3000
): HTMLDivElement {
  // Create notification element if it doesn't exist
  let notification = document.getElementById(
    'lai-notification'
  ) as HTMLDivElement

  if (!notification) {
    notification = document.createElement('div')
    notification.id = 'lai-notification'
    notification.setAttribute('role', 'alert') // ARIA role for accessibility
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 10px 20px;
      border-radius: 4px;
      z-index: 9999;
      font-family: Arial, sans-serif;
      transition: opacity 0.3s ease-in-out;
      display: flex;
      align-items: center;
      min-width: 200px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `
    document.body.appendChild(notification)
  }

  // Set notification styles based on type
  const colors = {
    info: { bg: '#0a66c2', color: 'white', icon: 'ℹ️' },
    success: { bg: '#0a8544', color: 'white', icon: '✅' },
    error: { bg: '#d93025', color: 'white', icon: '❌' },
    warning: { bg: '#f29900', color: 'black', icon: '⚠️' }
  }

  const style = colors[type] || colors.info
  notification.style.backgroundColor = style.bg
  notification.style.color = style.color

  // Set message and show notification
  notification.innerHTML = `<span style="margin-right: 8px;">${style.icon}</span> ${message}`
  notification.style.opacity = '1'

  // Add close button
  const closeBtn = document.createElement('span')
  closeBtn.innerHTML = '&times;'
  closeBtn.style.cssText = `
    margin-left: 10px;
    cursor: pointer;
    font-size: 18px;
    font-weight: bold;
  `
  closeBtn.onclick = () => {
    notification.style.opacity = '0'
  }
  notification.appendChild(closeBtn)

  // Auto-hide after duration
  const timer = setTimeout(() => {
    notification.style.opacity = '0'
  }, duration)

  // Clear timer if user closes manually
  closeBtn.addEventListener('click', () => clearTimeout(timer))

  return notification
}

/**
 * Show a Chrome notification from background script
 * @param message - Message to display
 * @param type - Notification type: 'info', 'success', 'error', 'warning'
 * @param title - Optional title for the notification
 */
export function showBackgroundNotification(
  message: string,
  type: 'info' | 'success' | 'error' | 'warning' = 'info',
  title?: string
): void {
  // Map notification types to titles
  const notificationConfig = {
    info: { title: title || 'LinkedIn AI Commenter' },
    success: { title: title || 'Success' },
    error: { title: title || 'Error' },
    warning: { title: title || 'Warning' }
  }

  const config = notificationConfig[type]

  try {
    // Use a 1x1 transparent pixel as icon to avoid download errors
    const transparentPixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: transparentPixel,
      title: config.title,
      message: message,
      priority: type === 'error' ? 2 : 1
    })
  } catch (error) {
    console.log(`[${type.toUpperCase()}] ${config.title}: ${message}`)
  }
}
