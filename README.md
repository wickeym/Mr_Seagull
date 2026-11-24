# Mr. Seagull

A 2.5D beach-bombing arcade game. Play in the browser:

**https://wickeym.github.io/Mr_Seagull/**

## Controls

- **WASD / arrows** or the left stick — move and change height
- **Q / E** or Slow / Fast — throttle
- **Space / Drop** — tap to poop, hold for a jumbo
- Phone: landscape, fullscreen

Release when the ring lights up. Jumbos can splash nearby targets for two ammo.
Low fries refill two shots, and umbrellas along the beach give you a reason to climb.
Direct jumbo hits can trigger a brief slow-motion close-up. Reduced-motion settings skip it.

```bash
npm install
npm run dev
```

## Terminal playtest

Run `npm run playtest` for a top-down ASCII view of the same game. The map shows
the gull (`@`), its landing reticle (`+`), road, traffic, and hazards. Rows are
distance ahead of the gull, and the contact list includes altitude or velocity
where applicable.

Enter a number of frames to advance and the keys to hold for those frames.
Each frame is 1/60 second. `RELEASE WINDOW` shows when a target is on track
to meet the drop. For a repeatable first chain reaction, enter `restart 42`,
then `10, 23 j, 95` to charge and release a jumbo over the opening car.
Use `help` for controls and `quit` to exit.

## Sound credits

- [Cartoon Splat](https://pixabay.com/sound-effects/film-special-effects-cartoon-splat-310479/) and [Wet Splat Impact](https://pixabay.com/sound-effects/film-special-effects-wet-splat-impact-567197/) by Universfield.
- [Fart 4](https://pixabay.com/sound-effects/film-special-effects-fart-4-228244/) by aPebble.

These sound effects are used under the [Pixabay Content License](https://pixabay.com/service/license-summary/).
