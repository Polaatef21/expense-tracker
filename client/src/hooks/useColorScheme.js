import { useEffect, useState } from 'react';

// 'light' | 'dark', following the operating-system setting live.
// Charts use it to re-read their colors when the theme changes.
export function useColorScheme() {
  const query = '(prefers-color-scheme: dark)';
  const [scheme, setScheme] = useState(() => (window.matchMedia?.(query).matches ? 'dark' : 'light'));

  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return undefined;
    const onChange = (e) => setScheme(e.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return scheme;
}
