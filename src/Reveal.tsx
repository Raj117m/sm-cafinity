import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export function Reveal({children,index,className}:{children:ReactNode;index:number;className:string}) {
  const element = useRef<HTMLElement>(null);
  useEffect(() => {
    const node = element.current;
    if (!node || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    node.classList.add('reveal-pending');
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      node.style.transitionDelay = `${Math.min(index % 3, 2) * 65}ms`;
      node.classList.remove('reveal-pending');
      observer.disconnect();
    }, { threshold: 0.01, rootMargin: '0px 0px 65px 0px' });
    observer.observe(node);
    const showOnFocus = () => node.classList.remove('reveal-pending');
    node.addEventListener('focusin', showOnFocus);
    return () => { observer.disconnect(); node.removeEventListener('focusin', showOnFocus); };
  }, [index]);
  return <article ref={element} className={`${className} scroll-reveal`}>{children}</article>;
}
