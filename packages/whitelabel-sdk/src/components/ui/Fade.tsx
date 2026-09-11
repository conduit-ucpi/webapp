import { useRef, ReactNode } from 'react';
import { motion, useInView } from 'framer-motion';

interface FadeProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export default function Fade({ children, delay = 0, className = '' }: FadeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.4, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}
