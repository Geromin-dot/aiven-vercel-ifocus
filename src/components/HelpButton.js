"use client";

/**
 * HelpButton Component
 * Renders a refined, calm, non-jumping SVG question mark icon button
 * that triggers the iFocus Feature Guide for a specific feature/topic.
 */
export default function HelpButton({ 
  topic = 'pomodoro', 
  title = 'View Feature Guide',
  size = 14,
  className = '',
  style = {} 
}) {
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ifocus_open_guide', { detail: { topic } }));
    }
  };

  return (
    <button
      type="button"
      className={`feature-help-btn ${className}`}
      onClick={handleClick}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        border: '1px solid rgba(46, 125, 50, 0.22)',
        background: 'rgba(46, 125, 50, 0.07)',
        color: '#2e7d32',
        cursor: 'pointer',
        padding: 0,
        flexShrink: 0,
        transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
        ...style
      }}
      aria-label={title}
    >
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2.2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.8" strokeLinecap="round" />
      </svg>
    </button>
  );
}

