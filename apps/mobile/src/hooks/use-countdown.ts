import { useEffect, useState } from 'react';

/** Simple seconds countdown (e.g. "Resend code in 42s"). */
export function useCountdown(seconds: number) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return { left, start: () => setLeft(seconds) };
}
