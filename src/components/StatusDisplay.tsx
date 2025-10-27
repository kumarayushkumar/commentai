/**
 * Status message display component
 */

interface StatusDisplayProps {
  message: string
  className?: string
}

export const StatusDisplay = ({
  message,
  className = ''
}: StatusDisplayProps) => (
  <div
    className={`mt-6 py-1.5 px-3 font-medium opacity-0 transition-all ease-in-out duration-300 border-l-2 border-accent bg-green-200 ${message ? 'opacity-100' : ''} ${className}`}>
    {message}
  </div>
)
