# Attributions

Third-party assets used in AIESEC XP, and where each came from.

**This file is the whole of the product's attribution surface (D-49).** AIESEC XP
is internal: every viewer signs in through AIESEC OAuth2 and holds an active
position in office 182 or a descendant, there is no public route, and nothing is
distributed outside the MC. Credit is therefore recorded here, next to the source,
and never rendered in the UI — no footer credits line, no licence notice, no
about page. Anyone who can reach the product can reach this file.

If AIESEC XP is ever opened beyond the member wall, this stops being sufficient
and every line below marked *unconfirmed* has to be settled first.

## Credited here

**Game Icons** — https://game-icons.net — CC BY 3.0

The funnel-stage, rank and reward icons are from the Game Icons collection,
delivered through [`react-icons`](https://react-icons.github.io/react-icons/)
(MIT). Individual icons are by contributors to game-icons.net including Lorc,
Delapouite and Skoll. See https://game-icons.net/about.html#authors for the full
list.

## Character renders — licence unconfirmed

`public/characters/avatar-*.png` and `avatar-*-portrait.png` are renders of the four CGTrader characters
described below, produced by `scripts/assets/avatar-stills.py` from the shipped
`.glb` files and used on every screen that shows more than one body at a time
(D-52, `components/studio/character.tsx`). They inherit the same open licence
question as the models they were rendered from.

## Character models — licence unconfirmed

The four member-avatar characters — `avatar-hoodie-joggers`, `avatar-tee-shorts`,
`avatar-hoodie-cargo` and `avatar-tee-skirt` — were obtained as free downloads
from [CGTrader](https://www.cgtrader.com). Three carry a Mixamo auto-rig, which
their `mixamorig:` bone naming and the export paths still packed into the source
file both record; the fourth has a 24-bone rig of separate origin.

This is the only asset class in the product that is not CC0. CGTrader free
downloads ship under more than one licence: its Royalty-Free terms permit
embedding in an application, while its Editorial terms would forbid it. The
distinction is not visible in the downloaded files, so it would have to come from
the source pages.

D-49 accepts that as an open question rather than a blocker, because this is an
internal tool that is not distributed. Still worth recording if anyone goes back
to the source pages, and required before any external release: the CGTrader
product URL, the author and the licence actually granted, per model.

## Public domain — no attribution required

Credited anyway, because knowing where an asset came from is worth more than the
licence strictly demands.

- **Poly Haven** — https://polyhaven.com — CC0. Environment maps, reached through
  [`@pmndrs/assets`](https://github.com/pmndrs/assets) (CC0).
- **Kenney** — https://kenney.nl — CC0. Game asset packs.
- **`@pmndrs/assets`** — CC0. Also the source of `suzi.glb`, the model the `/lab`
  route uses to prove the Draco pipeline.

## Open source software

Typefaces are served under the SIL Open Font License, self-hosted at build time
by `next/font` so no request reaches Google. STUDIO uses four (D-48): Fredoka,
Figtree, Baloo 2 and Space Mono.

The 3D stack — three.js, @react-three/fiber, @react-three/drei, @pmndrs/assets,
Motion, Recharts, react-icons and glTF-Transform — is MIT or CC0.
@react-three/rapier is MIT and wraps Rapier (@dimforge), Apache-2.0. The Draco
decoder shipped from `three` is Apache-2.0 (Google).
