/**
 * Tab navigation component for the side panel
 */

interface TabNavigationProps {
  activeTab: 'comment' | 'autoComment' | 'settings' | 'feedback'
  onTabChange: (
    tab: 'comment' | 'autoComment' | 'settings' | 'feedback'
  ) => void
}

export const TabNavigation = ({
  activeTab,
  onTabChange
}: TabNavigationProps) => {
  const tabs = [
    { id: 'comment', label: 'Comment' },
    { id: 'autoComment', label: 'Auto Comment' },
    { id: 'settings', label: 'Settings' },
    { id: 'feedback', label: 'Feedback' }
  ] as const

  return (
    <div className="flex border-b border-secondary">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`py-2 px-3 font-medium ${
            activeTab === tab.id
              ? 'border-b-2 border-primary'
              : 'hover:bg-secondary'
          }`}
          onClick={() => onTabChange(tab.id)}>
          {tab.label}
        </button>
      ))}
    </div>
  )
}
