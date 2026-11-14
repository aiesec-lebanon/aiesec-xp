# Attributions

Third-party assets used in AIESEC XP, and where each came from.

**This file is the whole of the product's attribution surface (D-49).** Credit is
recorded here, next to the source, and never rendered in the UI — no footer
credits line, no licence notice, no about page.

AIESEC XP has public pages (`/login`, `/unauthorized`, `/tv`; D-89) and a public
repository, so licences that restrict redistribution are met in how the assets
are stored and served, not by keeping the product behind the member wall (D-91).

## Credited here

**Game Icons** — https://game-icons.net — CC BY 3.0

The funnel-stage, rank and reward icons are from the Game Icons collection,
delivered through [`react-icons`](https://react-icons.github.io/react-icons/)
(MIT). Individual icons are by contributors to game-icons.net including Lorc,
Delapouite and Skoll. See https://game-icons.net/about.html#authors for the full
list.

## Character models — CGTrader, Royalty Free (no AI)

The member-avatar bodies come from [CGTrader](https://www.cgtrader.com). Three
carry a Mixamo auto-rig, which their `mixamorig:` bone naming and the export
paths still packed into the source file both record; the fourth has a 24-bone rig
of separate origin.

| Listing | Licence |
| --- | --- |
| [Cute Cartoon Boy Character Rigged Animated 3D Kid Game Character](https://www.cgtrader.com/3d-models/character/child/cute-cartoon-boy-character-rigged-animated-3d-kid-game-character) | Royalty Free License (no AI) |
| [Stylized Cartoon Boy 3D Kid Character Rigged and Animated](https://www.cgtrader.com/3d-models/character/child/stylized-cartoon-boy-3d-kid-character-rigged-and-animated) | Royalty Free License (no AI) |

Every CGTrader model used is under this licence, as the listings showed it on
2026-11-14. They were free downloads when obtained and are paid listings now. A
licence is granted when the model is acquired, so a later price change does not
take it back. The account's download history is the proof of that, so keep it.
The authors aren't recorded here; CGTrader doesn't require credit.

What the licence allows, from the listing and the
[Terms and Conditions](https://www.cgtrader.com/pages/terms-and-conditions)
(§20, §21A, §21B):

- **Allowed:** use in our own projects, including commercial ones; modifying and
  combining with other assets; backups and sharing within the team.
- **Not allowed:** redistributing, reselling or re-uploading the file; any
  machine-learning or generative-AI use, including as training input.
- **Condition for apps:** the model is licensed only built into a larger work it
  can't be extracted from, and the buyer must take "all commercially reasonable
  measures to prevent the end user from gaining access to the Product".

How AIESEC XP meets that (D-91):

- **The repository holds no usable copy.** The raw and optimised `.glb` files are
  gitignored and were purged from git history. Only AES-256-GCM copies under
  `MODEL_KEY`, which exists only in the deployment environment and on the
  authoring machine, are tracked (`assets/sealed/`).
- **No page exposes the file.** `/api/models/[name]` answers only a same-origin
  `fetch` from one of our pages, re-encrypted. The browser decrypts it in memory
  and parses it directly, so there is no `.glb` URL to open or save, including
  on the public `/login` page.
- **Renders are a permitted use.** `public/characters/*.png`, rendered from the
  models by `scripts/assets/avatar-stills.py`, and any video made from them stay
  public.
- **No AI use.** The models must not be given to an AI or ML tool as input or
  training data. Blender scripting of our own files is not that.

What this can't do: anything a browser renders can be pulled out by someone
determined to read the client code or capture the GPU buffers. The licence asks
for reasonable measures, not the impossible, and this is the same protection
games ship with.

## Character animation — Mixamo

The clips in `avatar-animations` and `avatar-animations-social` are from
[Mixamo](https://www.mixamo.com) (Adobe), which grants royalty-free use of its
animations, including commercially, to anyone with a free Adobe account. Juno's
skeleton is also Mixamo's, from its auto-rigger.

Adobe allows the animations built into a project, but not handed out as
standalone animation files, so the clip libraries are sealed and served exactly
like the CGTrader models. Nothing is fetched from Adobe at runtime.

## Public domain — no attribution required

Credited anyway, because knowing where an asset came from is worth more than the
licence strictly demands.

- **Poly Haven** — https://polyhaven.com — CC0. Environment maps, reached through
  [`@pmndrs/assets`](https://github.com/pmndrs/assets) (CC0).
- **Kenney** — https://kenney.nl — CC0. Game asset packs.
- **`@pmndrs/assets`** — CC0. Also the source of `suzi.glb`, the model the `/lab`
  route uses to prove the Draco pipeline.

## Open source software

Typefaces are served under the SIL Open Font License, built from `google/fonts`
into `lib/design/faces/` with each family's `OFL.txt` beside it, so no request
reaches Google at build time or runtime (D-67). STUDIO uses four (D-48):
Fredoka, Figtree, Baloo 2 and Space Mono.

The 3D stack — three.js, @react-three/fiber, @react-three/drei, @pmndrs/assets,
Motion, Recharts, react-icons and glTF-Transform — is MIT or CC0.
@react-three/rapier is MIT and wraps Rapier (@dimforge), Apache-2.0. The Draco
decoder shipped from `three` is Apache-2.0 (Google).
