# Attributions

Third-party assets used in AIESEC XP, and what each licence requires of us.

## Requires attribution

**Game Icons** — https://game-icons.net — CC BY 3.0

The funnel-stage, rank and reward icons are from the Game Icons collection,
delivered through [`react-icons`](https://react-icons.github.io/react-icons/)
(MIT). CC BY 3.0 requires credit, so this notice must remain reachable from the
product — the credits line in the app footer, not only this file.

Individual icons are by contributors to game-icons.net including Lorc, Delapouite
and Skoll, licensed under CC BY 3.0. See
https://game-icons.net/about.html#authors for the full list.

## Character renders — licence unconfirmed (O-12)

`public/characters/char-walk-blue.png`, `char-curly-front.png` and
`char-hoodie-front.png` are flat renders of the same CGTrader characters
described below, produced for the STUDIO comps and now shipped as the placeholder
body every screen stands on until the 3D layer replaces them (D-47,
`components/studio/character.tsx`). They inherit the same unresolved licence
question as the models they were rendered from, and O-12 must close before they
ship to members — a render of a model licensed for editorial use only is still
editorial use only.

## Character models — licence unconfirmed (O-12)

The four member-avatar characters — `avatar-hoodie-joggers`, `avatar-tee-shorts`,
`avatar-hoodie-cargo` and `avatar-tee-skirt` — were obtained as free downloads
from [CGTrader](https://www.cgtrader.com). Three carry a Mixamo auto-rig, which
their `mixamorig:` bone naming and the export paths still packed into the source
file both record; the fourth has a 24-bone rig of separate origin.

This is the only asset class in the product that is **not** CC0, and it is the
one place D-47's "free-forever, self-hosted" guarantee is not yet demonstrably
met. CGTrader free downloads ship under more than one licence: its Royalty-Free
terms permit embedding in an application, while its Editorial terms would forbid
this use outright. The distinction is not visible in the downloaded files, so it
has to come from the source pages.

Required before these ship, per model: the CGTrader product URL, the author, and
the licence actually granted. Until then they are prototype-only.

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
