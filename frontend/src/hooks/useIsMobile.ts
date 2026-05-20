'use client'
import { useState, useEffect } from 'react'

/**
 * Returns true when viewport < breakpoint, false when >= breakpoint.
 * Returns null on first render (before mount) so SSR and client HTML match,
 * preventing Next.js hydration mismatches.
 */
export function useIsMobile(breakpoint = 1024): boolean {
  const [isMobile, setIsMobile] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const check = () => setIsMobile(window.innerWidth < breakpoint)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])

  // Before mount: always return false (matches server render = no hamburger, no drawer)
  return mounted ? isMobile : false
}
