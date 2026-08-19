"use client"

import * as React from "react"
import useEmblaCarousel, {
  type UseEmblaCarouselType,
} from "embla-carousel-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

type CarouselApi = UseEmblaCarouselType[1]
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>
type CarouselOptions = UseCarouselParameters[0]
type CarouselPlugin = UseCarouselParameters[1]

type CarouselProps = {
  opts?: CarouselOptions
  plugins?: CarouselPlugin
  orientation?: "horizontal" | "vertical"
  setApi?: (api: CarouselApi) => void
}

/**
 * How long a slide takes to arrive.
 *
 * Embla's `duration` is not milliseconds; it is a factor in a friction
 * integrator that runs once a frame — velocity gains `displacement/duration`
 * and is then multiplied by 0.68, so the track approaches its target and
 * never overshoots. Running that loop out at the stock 25, over one page of a
 * phone: 383ms to cover nine tenths of the distance, 700ms to cover
 * ninety-nine hundredths, and a full second before it is actually still.
 *
 * Everything else on this screen moves in 90ms out and 150ms in, on the
 * reasoning that a transition is here to say something changed rather than to
 * be watched. The slide was four times slower than that, and the long creep
 * at the end of it — a third of a second spent covering the last tenth of the
 * way — is what read as weight. Nothing was dropping frames; the movement was
 * simply still going.
 *
 * Ten puts nine tenths of the travel at 150ms and the whole of it at 183ms,
 * which is the same beat as every other arrival in the app. A caller may
 * still pass its own `duration` — this only sets the house one.
 */
const SLIDE_DURATION = 10

type CarouselContextProps = {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0]
  api: ReturnType<typeof useEmblaCarousel>[1]
  scrollPrev: () => void
  scrollNext: () => void
  canScrollPrev: boolean
  canScrollNext: boolean
} & CarouselProps

const CarouselContext = React.createContext<CarouselContextProps | null>(null)

function useCarousel() {
  const context = React.useContext(CarouselContext)

  if (!context) {
    throw new Error("useCarousel must be used within a <Carousel />")
  }

  return context
}

function Carousel({
  orientation = "horizontal",
  opts,
  setApi,
  plugins,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & CarouselProps) {
  const [carouselRef, api] = useEmblaCarousel(
    {
      duration: SLIDE_DURATION,
      ...opts,
      axis: orientation === "horizontal" ? "x" : "y",
    },
    plugins
  )
  const [canScrollPrev, setCanScrollPrev] = React.useState(false)
  const [canScrollNext, setCanScrollNext] = React.useState(false)

  const onSelect = React.useCallback((api: CarouselApi) => {
    if (!api) return
    setCanScrollPrev(api.canScrollPrev())
    setCanScrollNext(api.canScrollNext())
  }, [])

  /**
   * Move a page under a curve of our own choosing.
   *
   * Embla animates by integrating a friction model once a frame: velocity
   * gains displacement/duration and is then multiplied by a constant the
   * engine keeps to itself. That shape starts at its fastest and decays
   * towards the target, so there is no ramp into the movement at all — it is
   * the motion of something released rather than something moved, which is
   * what reads as cheap however fast it is made to run. Nor can it be given a
   * curve: duration is the only handle, and friction is not an option.
   *
   * So the arrows do not use it. The page is jumped to instantly, which puts
   * the track's transform at its final value in one go, and a CSS transition
   * carries it there under `--vt-soft` — the same decelerate every other
   * arrival on the screen is drawn with. On the compositor, too, so a phone
   * animates it without asking the main thread for anything.
   *
   * The transition is put on for the press and taken off again after, so a
   * finger on the track is never transitioned: a drag has to track the hand
   * exactly, and embla's own settle after a release has to stay its own.
   */
  const glide = React.useCallback((move: (jump: boolean) => void) => {
    const el = api?.containerNode()
    if (!el) return

    el.style.transition = "transform var(--slide, 300ms) var(--vt-soft, ease-out)"
    move(true)

    const clear = () => {
      el.style.transition = ""
      el.removeEventListener("transitionend", clear)
      el.removeEventListener("pointerdown", clear)
    }
    el.addEventListener("transitionend", clear)
    // A hand arriving mid-glide takes the rule off before it can ease a drag:
    // a finger on the track has to be followed exactly, not caught up with.
    el.addEventListener("pointerdown", clear, { passive: true })
    // A transition that never starts — the page was already there, or the tab
    // is not drawing — would otherwise leave the rule on for the next drag.
    window.setTimeout(clear, 600)
  }, [api])

  const scrollPrev = React.useCallback(() => {
    if (!api) return
    glide(jump => api.scrollPrev(jump))
  }, [api, glide])

  const scrollNext = React.useCallback(() => {
    if (!api) return
    glide(jump => api.scrollNext(jump))
  }, [api, glide])

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        scrollPrev()
      } else if (event.key === "ArrowRight") {
        event.preventDefault()
        scrollNext()
      }
    },
    [scrollPrev, scrollNext]
  )

  React.useEffect(() => {
    if (!api || !setApi) return
    setApi(api)
  }, [api, setApi])

  React.useEffect(() => {
    if (!api) return
    // Embla is the external system this effect exists to subscribe to, and it
    // already holds a position by the time we attach. Reading it once here is
    // what the subscription cannot do for us — the first "select" event only
    // arrives when the carousel next moves, which may be never.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    onSelect(api)
    api.on("reInit", onSelect)
    api.on("select", onSelect)

    return () => {
      api?.off("select", onSelect)
    }
  }, [api, onSelect])

  // Memoised: a fresh object here is a changed context, and a changed context
  // re-renders every part below — the track and each slide in it — whenever
  // anything at all re-renders the carousel. On a page carrying one of these
  // per group, that is a lot of work to spend on an unchanged value.
  const context = React.useMemo(
    () => ({
      carouselRef,
      api,
      opts,
      orientation:
        orientation || (opts?.axis === "y" ? "vertical" : "horizontal"),
      scrollPrev,
      scrollNext,
      canScrollPrev,
      canScrollNext,
    }),
    [
      carouselRef, api, opts, orientation, scrollPrev, scrollNext,
      canScrollPrev, canScrollNext,
    ]
  )

  return (
    <CarouselContext.Provider value={context}>
      <div
        onKeyDownCapture={handleKeyDown}
        className={cn("relative", className)}
        role="region"
        aria-roledescription="carousel"
        data-slot="carousel"
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  )
}

function CarouselContent({ className, ...props }: React.ComponentProps<"div">) {
  const { carouselRef, orientation } = useCarousel()
  const containerRef = React.useRef<HTMLDivElement>(null)

  // A slide is only cheap once the pages either side of it have been painted.
  //
  // They are in the tree well before anyone reaches for an arrow, but being in
  // the tree is not being painted: a page waiting its turn sits outside the
  // track's overflow, and nothing outside an overflow is drawn until it is
  // brought in. So the first press of an arrow asks the browser to paint five
  // fresh rows — an icon, a badge and a progress bar apiece — in the same
  // frames it is animating the movement, and those are the frames that drop.
  //
  // This is the whole of the difference between this carousel and the one on
  // the dashboard, which is the same component with the same options and has
  // always been smooth: its pages hold four short discipline lines where these
  // hold five full rows of the list.
  //
  // Promoting the track to its own layer is what gets them painted ahead of
  // the press, and the question is only when to ask. On the pointer going down
  // it is a fifth of a second of notice, on a phone, for three pages of rows —
  // which is the press paying for the paint after all, just slightly earlier.
  // While the card is on screen there is no hurry at all: by the time an arrow
  // can be reached, the pages behind it have long since been drawn.
  //
  // Bounded by the same observer that grants it. A page carrying one of these
  // per group cannot hold a layer open for every one of them, so the layer
  // lives exactly as long as the card is somewhere near the screen — one or
  // two groups at a time on a phone — and is given back on the way out.
  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Two reasons to hold the layer, and it is held while either stands.
    // Visibility is the one that does the work; the press is a fallback for
    // the moment before the observer has had a chance to speak, and for any
    // browser where it never does.
    let onScreen = false
    let pressed: ReturnType<typeof setTimeout> | null = null
    const sync = () => {
      el.style.willChange = onScreen || pressed ? "transform" : ""
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting
        sync()
      },
      // A margin either side, so the painting is done while the card is still
      // on its way up rather than in the moment it lands.
      { rootMargin: "300px 0px" }
    )
    io.observe(el)

    // A pointer going down on an arrow is a beat ahead of the click it
    // becomes. Released on a timer rather than on "settle", so a touch that
    // moves nothing cannot leave the layer standing for good — which is what
    // an event about movement would do.
    const root = el.closest<HTMLElement>('[data-slot="carousel"]')
    const press = (e: Event) => {
      const target = e.target as Element | null
      if (!target?.closest('[data-slot="carousel-previous"],[data-slot="carousel-next"]')) return
      if (pressed) clearTimeout(pressed)
      pressed = setTimeout(() => {
        pressed = null
        sync()
      }, 1200)
      sync()
    }
    root?.addEventListener("pointerdown", press, { passive: true })

    return () => {
      io.disconnect()
      root?.removeEventListener("pointerdown", press)
      if (pressed) clearTimeout(pressed)
      el.style.willChange = ""
    }
  }, [])

  return (
    <div
      ref={carouselRef}
      // Embla listens for `touchmove` non-passively, which on its own asks the
      // browser to check with the main thread before it may scroll the page —
      // the finger stalls for as long as React is busy elsewhere. Naming the
      // axis the carousel does not handle hands that scroll straight back to
      // the compositor, and embla steps aside on the uncancelable event it
      // gets in return. `pinch-zoom` stays: this is a performance note to the
      // browser, not a reason to take zooming away from anyone.
      className={cn(
        "overflow-hidden",
        orientation === "horizontal"
          ? "[touch-action:pan-y_pinch-zoom]"
          : "[touch-action:pan-x_pinch-zoom]"
      )}
      data-slot="carousel-content"
    >
      <div
        ref={containerRef}
        className={cn(
          "flex",
          orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
          className
        )}
        {...props}
      />
    </div>
  )
}

function CarouselItem({ className, ...props }: React.ComponentProps<"div">) {
  const { orientation } = useCarousel()

  return (
    <div
      role="group"
      aria-roledescription="slide"
      data-slot="carousel-item"
      className={cn(
        "min-w-0 shrink-0 grow-0 basis-full",
        orientation === "horizontal" ? "pl-4" : "pt-4",
        className
      )}
      {...props}
    />
  )
}

function CarouselPrevious({
  className,
  variant = "outline",
  size = "icon-sm",
  ...props
}: React.ComponentProps<typeof Button>) {
  const { orientation, scrollPrev, canScrollPrev } = useCarousel()

  return (
    <Button
      data-slot="carousel-previous"
      variant={variant}
      size={size}
      className={cn(
        "absolute touch-manipulation rounded-full",
        orientation === "horizontal"
          ? "inset-y-0 -left-12 my-auto"
          : "-top-12 left-1/2 -translate-x-1/2 rotate-90",
        className
      )}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      {...props}
    >
      <ChevronLeftIcon />
      <span className="sr-only">Previous slide</span>
    </Button>
  )
}

function CarouselNext({
  className,
  variant = "outline",
  size = "icon-sm",
  ...props
}: React.ComponentProps<typeof Button>) {
  const { orientation, scrollNext, canScrollNext } = useCarousel()

  return (
    <Button
      data-slot="carousel-next"
      variant={variant}
      size={size}
      className={cn(
        "absolute touch-manipulation rounded-full",
        orientation === "horizontal"
          ? "inset-y-0 -right-12 my-auto"
          : "-bottom-12 left-1/2 -translate-x-1/2 rotate-90",
        className
      )}
      disabled={!canScrollNext}
      onClick={scrollNext}
      {...props}
    >
      <ChevronRightIcon />
      <span className="sr-only">Next slide</span>
    </Button>
  )
}

export {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  useCarousel,
}
