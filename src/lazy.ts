import { useEffect, useState } from 'preact/hooks';

/** Loads a module on mount (as its own chunk) and returns it once ready, or null before that. */
export function useLazy<T>(loader: () => Promise<T>): T | null {
  const [mod, setMod] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    loader().then((m) => alive && setMod(m));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return mod;
}

/** True once `el` is near the viewport (and stays true). Falls back to true without IntersectionObserver. */
export function useNearViewport(ref: { current: Element | null }, margin = '300px'): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === 'undefined') return setNear(true);
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, near, margin]);
  return near;
}
