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

  const scrollPrev = React.useCallback(() => {
    api?.scrollPrev()
  }, [api])

  const scrollNext = React.useCallback(() => {
    api?.scrollNext()
  }, [api])

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
  const { carouselRef, orientation, api } = useCarousel()
  const containerRef = React.useRef<HTMLDivElement>(null)

  // A drag is only cheap once the slides are rasterised. The container is
  // promoted to its own layer for the length of the gesture and let go again
  // when the carousel settles: a page carrying one carousel per group cannot
  // afford to hold a layer open for every one of them at rest.
  React.useEffect(() => {
    if (!api) return
    const el = containerRef.current
    if (!el) return

    const lift = () => {
      el.style.willChange = "transform"
    }
    const drop = () => {
      el.style.willChange = ""
    }

    // A finger going down anywhere on the carousel — on the track or on an
    // arrow — is the earliest warning that it is about to move, and the layer
    // wants making before the movement starts rather than in the same frame
    // as its first step. Asked for as the slide begins, the browser rasters a
    // track three pages wide while it is already animating, and that is the
    // hitch a tap on the arrow had on a phone. A pointer going down is a beat
    // ahead of the click it becomes, which is all the notice this needs.
    //
    // Arrows only. A layer is given up again on "settle", which is an event
    // about movement — so promoting on a touch that never moves anything, a
    // tap on a row of the list inside, would leave that carousel holding a
    // layer for good. An arrow is the one place a pointer going down always
    // means a slide: at either end of the track the button is disabled, and a
    // disabled button is not pressed.
    //
    // The listener sits on the carousel's own element rather than on the
    // arrows, because the arrows are outside the track — here they sit up in
    // the card's heading — and the element that holds both is given no box of
    // its own, but is still in the tree for events to pass through.
    const root = el.closest<HTMLElement>('[data-slot="carousel"]')
    const liftForArrow = (e: Event) => {
      const target = e.target as Element | null
      if (target?.closest('[data-slot="carousel-previous"],[data-slot="carousel-next"]')) lift()
    }
    root?.addEventListener("pointerdown", liftForArrow, { passive: true })

    // `select` is the fallback for every way it moves without a pointer: the
    // arrow keys, or a page asked for in code.
    api.on("pointerDown", lift)
    api.on("select", lift)
    api.on("settle", drop)
    return () => {
      root?.removeEventListener("pointerdown", liftForArrow)
      api.off("pointerDown", lift)
      api.off("select", lift)
      api.off("settle", drop)
      drop()
    }
  }, [api])

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
