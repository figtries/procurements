import * as React from "react"

/**
 * Below this width the sidebar becomes an off-canvas sheet. Set at `lg`
 * rather than shadcn's default `md`: on iPad portrait (768px) a pinned
 * 16rem rail leaves barely 30rem of content, which is too little for the
 * dashboard's two-column cards.
 */
const MOBILE_BREAKPOINT = 1024

/**
 * Reads a media query as an external store rather than syncing it into state
 * from an effect, so the first client render already has the right value and
 * the server render stays deterministic.
 */
export function useMediaQuery(query: string) {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    },
    [query],
  )

  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export function useIsMobile() {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
}
