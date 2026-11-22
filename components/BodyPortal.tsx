'use client';

import { useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders children straight into <body>. Fixed bars and overlays need this:
 * the store's page-transition wrapper uses a transform, which would otherwise
 * pin `position: fixed` to the page instead of the screen.
 */
export default function BodyPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}
