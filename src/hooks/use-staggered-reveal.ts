import { startTransition, useEffect, useRef, useState } from 'react';

/**
 * How long the first piece waits before the rest begin.
 *
 * A page swap is animated, and the animation is 70ms of hold and 150ms of
 * arrival. Raising the rest of the page during those is asking the browser to
 * animate and React to commit on the same thread at the same time, and the
 * animation is the one that loses — it is the half nobody can interrupt and
 * everybody can see. Waiting until the swap has landed costs nothing: what is
 * waiting is below the fold either way.
 */
const AFTER_THE_SWAP = 260;

/**
 * How many of a page's pieces may be built so far, raised one at a time.
 *
 * React commits in a single stroke. A page that builds all of itself in one
 * render is one long task however little of it can be seen, and the tap that
 * asked for the page waits out the whole of it — the overview's eighty-eight
 * rows measured 143ms of that, the dashboard's lower half 61ms, both on a
 * machine far quicker than the phone this runs on.
 *
 * Only what is on the screen has to exist by the time the screen is handed
 * over. The rest is raised a piece per task, and a task is short enough that
 * the browser can paint and answer a finger between any two of them. The work
 * is the same work; what changes is that it can be interrupted. Every piece
 * is standing within a few milliseconds either way, long before anyone can
 * scroll to the ones below the fold.
 *
 * The count comes down as well as up, so a list that has just been filtered
 * to two groups does not build all eight again in one commit the moment that
 * filter is cleared. Coming down unmounts nothing: the pieces it counts past
 * are pieces the caller has already stopped rendering.
 *
 * @param total  How many pieces there are in all.
 * @param eager  How many to build before the screen is handed over — enough
 *               to fill it, which is a question about the screen and so a
 *               question the caller answers.
 */
export function useStaggeredReveal(total: number, eager: number): number {
  const [shown, setShown] = useState(eager);

  /** Only the first step waits; after that they follow one another as fast as
   *  the thread allows. */
  const begun = useRef(false);

  useEffect(() => {
    if (shown === total) return;
    // A timer rather than `requestIdleCallback`: idle callbacks are scheduled
    // against frames, so a tab that is not drawing would never raise the count
    // at all and the rest of the page would never arrive. Landing in a later
    // task is the whole point, and any timeout does that. Non-urgent, so React
    // may slice it and keep the part it has already handed over responsive.
    const id = window.setTimeout(
      () => {
        begun.current = true;
        startTransition(() => setShown(n => (n > total ? total : n + 1)));
      },
      begun.current ? 0 : AFTER_THE_SWAP,
    );
    return () => window.clearTimeout(id);
  }, [shown, total]);

  return shown;
}
