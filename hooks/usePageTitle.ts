'use client';

import { useEffect } from 'react';

const SITE_NAME = "Faithlinegh";

export function usePageTitle(title: string) {
  useEffect(() => {
    // No title: keep the one the server set (from the page's metadata)
    if (!title) return;
    document.title = `${title} | ${SITE_NAME}`;
  }, [title]);
}
