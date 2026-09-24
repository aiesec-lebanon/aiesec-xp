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

The member avatars are four forms in four palettes plus two further bodies
(D-59). They are authored in Blender at `D:\Blender\characters_working.blend`
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

`avatar-export.py` keeps each character's authored materials (D-52) and exports
them rigged, with Mixamo's T-pose as the bind (D-53) — that is what the clips are
authored against, and no screen shows it because a clip plays from the first
frame. Every character is normalised to 1.5m with its feet on the floor and the
transform frozen into the data, which is what makes them all come out the same
size in the app. Juno comes from the Mixamo auto-rigger rather than the .blend,
with her original texture re-linked over the one Mixamo re-encodes.

`avatar-stills.py` renders two images per character from the **shipped `.glb`**,
not the Blender scene, so they cannot drift from the model: a full body for the
screens that show several at once, and a square portrait used as the member's
profile picture.

`avatar-animations.py` bakes the Mixamo downloads into one shared clip library
(D-53). It **retargets** each clip onto one of the characters' own rigs first —
a glTF rotation channel replaces a node's local rotation rather than adding to
it, so a clip only means what it should against the rest pose it was authored
on, and Mixamo's download rig rests differently from the rigs in the .blend. It
then strips every translation channel, which is authored in the clip skeleton's
units, and decimates keyframes — without that the file is twice the size for no
visible difference.

It needs the .blend, because that is where the reference rig lives:

```sh
blender -b D:\Blender\characters_working.blend -P scripts/assets/avatar-animations.py -- . D:\Blender\mixamo\download
```

`avatar-to-mixamo.py` writes the unrigged, T-posed FBX the Mixamo auto-rigger
wants, for a character that needs a skeleton it does not already have.

`avatar-variants.py` bakes the three alternate palettes (D-59). A palette is a
repainted base-colour texture over the authored mesh, rig and UVs, so it costs no
geometry and the shared clips drive it unchanged. It imports `avatar-parts.py`'s
classifier for the per-part mask rather than copying it, and fills two gaps in it
that only show once the colours change -- the torso could not reach `trouser`,
and Milo's salmon sleeves were not claimed by his hoodie. Rerunning it is:

```sh
blender -b D:\Blender\characters_working.blend -P scripts/assets/avatar-variants.py -- .
npm run assets:models
blender -b -P scripts/assets/avatar-stills.py -- .
```

The palettes live in `PALETTES` there and their swatches in
`lib/design/character.ts`; the two are changed together.

`avatar-export-extra.py` exports the characters that live in `characters.blend`
rather than the working file -- currently Nour and Lina. It refuses anything that
is not on Mixamo's 65-bone skeleton, because that is what the clips are authored
against, which is why `characters.blend`'s 149-bone and 138-bone rigs are not
imported. It also unwires transparency and the specular map, which arrive from a
non-PBR Specular/Glossiness source meaning something else: one of them had its
own diffuse wired into Alpha and exported with ragged holes through its arms.

```sh
blender -b D:\Blender\characters.blend -P scripts/assets/avatar-export-extra.py -- .
```

`avatar-parts.py` is the parked per-part recolouring pipeline (D-52). It is kept
because restoring recolouring means running it again, not rewriting it, and
because `avatar-variants.py` reads its classifier.

## Where free assets come from

All of these are free forever, not free-tier. Credit is recorded in
`ATTRIBUTIONS.md` at the repo root and nowhere else — per D-49 no attribution is
rendered in the UI, because this is an internal tool behind the member wall.

| Source | Licence | Use |
|---|---|---|
| [Poly Haven](https://polyhaven.com) | CC0 | HDRIs, textures, models |
| [Kenney](https://kenney.nl) | CC0 | Game asset packs, isometric tiles, UI |
| [Game Icons](https://game-icons.net) | CC BY 3.0 | Icons, via `react-icons/gi` — credited in `ATTRIBUTIONS.md` |
| [Google Fonts](https://fonts.google.com) | OFL | Typefaces, built by `scripts/assets/build-faces.py` into `lib/design/faces/` (D-67) |
| [Blender](https://blender.org) | GPL | Authoring; exports glTF for the pipeline above |

Assets are never loaded from a CDN. Everything is fetched from our own origin —
`Architecture.md` 10 rules out third-party runtime requests, and the CSP in
`lib/security/csp.ts` blocks them regardless.
