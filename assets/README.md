# 3D and icon assets

## The pipeline

```
assets/source/*.glb   ──  npm run assets:models  ──▶  public/models/*.glb
 (tracked, raw)            gltf-transform             (tracked, Draco + WebP)
```

Both ends are tracked. The source is what makes the output reproducible; the
output is what deploys, so a build never depends on the optimiser running.

Two directories are **not** tracked, because `npm run assets:vendor` regenerates
them from `node_modules` on every install and they must never drift from the
installed package versions:

- `public/draco/` — the Draco decoder, from `three`.
- `public/hdri/`  — CC0 Poly Haven environment maps, extracted from
  `@pmndrs/assets` as binaries rather than left as the base64 data URIs the
  package ships, which would otherwise land in the JS bundle.

## Adding a model

1. Export or download a `.glb` into `assets/source/`.
2. `npm run assets:models` (or `npm run assets:models <name>` for one).
3. Load it: `useModel(modelPath("<name>"))` from `lib/three/loaders.ts`, which
   already points Draco at our own decoder.

`suzi.glb` is the smoke-test fixture the `/lab` route loads; it is a CC0 model
from `@pmndrs/assets` and proves the whole chain — optimise, serve, Draco-decode
in a blob worker under the CSP — actually works.

## Character avatars

The four member avatars are authored in Blender at `D:\Blender\characters_working.blend`
(not in the repo: ~40MB of packed source textures, and the tracked input here is
the exported `.glb`). `D:\Blender\characters.blend` is the untouched original —
work on the copy, never on it.

Objects are named by **garment form, never colour** — `avatar-tee-shorts`, not
`avatar-blue-tee` — so re-authoring a character's palette does not make its name
a lie. Each character is
one mesh (`<name>-mesh`) and one armature (`<name>-rig`), normalised to 1.5m
tall, scale 1, rotation 0, feet at the origin.

### Rebuilding the avatars

```
characters_working.blend  ──  avatar-export.py  ──▶  assets/source/avatar-*.glb
                                                          │
                              npm run assets:models        ▼
                                                    public/models/avatar-*.glb
                                                          │
                              avatar-stills.py            ▼
                                             public/characters/avatar-*.png
                                             public/characters/avatar-*-portrait.png
```

```sh
blender -b D:\Blender\characters_working.blend -P scripts/assets/avatar-export.py -- .
npm run assets:models
blender -b -P scripts/assets/avatar-stills.py -- .
blender -b -P scripts/assets/avatar-preview.py -- . <out-dir>   # check the result
```

`avatar-export.py` keeps each character's authored materials (D-52). It bakes the
A-pose into the mesh and drops the rig, so the exported geometry is the body in
world coordinates — which is what makes every character come out the same size in
the app. Animation will need this run again with `export_skins`; the rig is still
in the .blend.

`avatar-stills.py` renders two images per character from the **shipped `.glb`**,
not the Blender scene, so they cannot drift from the model: a full body for the
screens that show several at once, and a square portrait used as the member's
profile picture.

`avatar-parts.py` is the parked per-part recolouring pipeline (D-52). It is kept
because restoring recolouring means running it again, not rewriting it.

## Where free assets come from

All of these are free forever, not free-tier. Credit is recorded in
`ATTRIBUTIONS.md` at the repo root and nowhere else — per D-49 no attribution is
rendered in the UI, because this is an internal tool behind the member wall.

| Source | Licence | Use |
|---|---|---|
| [Poly Haven](https://polyhaven.com) | CC0 | HDRIs, textures, models |
| [Kenney](https://kenney.nl) | CC0 | Game asset packs, isometric tiles, UI |
| [Game Icons](https://game-icons.net) | CC BY 3.0 | Icons, via `react-icons/gi` — credited in `ATTRIBUTIONS.md` |
| [Google Fonts](https://fonts.google.com) | OFL | Typefaces, self-hosted by `next/font` |
| [Blender](https://blender.org) | GPL | Authoring; exports glTF for the pipeline above |

Assets are never loaded from a CDN. Everything is fetched from our own origin —
`Architecture.md` 10 rules out third-party runtime requests, and the CSP in
`lib/security/csp.ts` blocks them regardless.
