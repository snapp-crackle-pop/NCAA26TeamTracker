import * as React from 'react';

export const PlusIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const GearIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
    <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1-1 3.4l-1.1.3a1 1 0 0 0-.7.7l-.3 1.1a2 2 0 0 1-3.4 1l-.1-.1a1 1 0 0 0-1.1-.2l-1.2.5a2 2 0 0 1-2.5-1.2l-.4-1.1a1 1 0 0 0-.8-.7l-1.1-.3a2 2 0 0 1-1-3.4l.1-.1a1 1 0 0 0 .2-1.1l-.5-1.2Z" />
  </svg>
);

export const ChevronDownIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);