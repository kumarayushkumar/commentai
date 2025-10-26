/**
 * Extract post text from LinkedIn post
 * @param postElement - The post container element
 * @returns Extracted post text
 */
export function extractPostText(postElement: HTMLElement | null): string {
  if (!postElement) return '';
  
  const postContent = postElement.querySelector(
    '.feed-shared-update-v2__description, ' + 
    '.update-components-text, ' + 
    '[data-test-feed-shared-text]'
  );
  
  let postText = postContent ? postContent.textContent?.trim() || '' : '';
  
  // Remove "...more" or "See more" if present
  postText = postText.replace(/(\u2026more|\.{3}more|See more)/gi, '').replace(/^\s+|\s+$/g, '');
  
  return postText;
}

/**
 * Debounce function to limit function calls
 * @param func - The function to debounce
 * @param wait - Milliseconds to wait
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number = 300
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return function(this: any, ...args: Parameters<T>): void {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

/**
 * Create a mutation observer with debounced callback
 * @param target - Element to observe
 * @param callback - Callback function
 * @param options - Observer options
 * @param debounceTime - Debounce time in ms
 * @returns The created observer
 */
export function createObserver(
  target: Node,
  callback: MutationCallback,
  options: MutationObserverInit = { subtree: true, childList: true },
  debounceTime: number = 100
): MutationObserver {
  const observer = new MutationObserver(debounce(callback, debounceTime));
  observer.observe(target, options);
  return observer;
}
