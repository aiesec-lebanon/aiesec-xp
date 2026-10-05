# 3D and icon assets

## Pipeline

```
assets/source/*.glb  ──  npm run assets:models  ──▶  public/models/*.glb
 (tracked, raw)           gltf-transform             (tracked, Draco + WebP)
```

Both ends are tracked, so a build never depends on the optimiser running.

`public/draco/` (Draco decoder from `three`) and `public/hdri/` (CC0 environment maps from
`@pmndrs/assets`) are **not** tracked: `npm run assets:vendor` regenerates them from
`node_modules` on every install.

To add a model: put the `.glb` in `assets/source/`, run `npm run assets:models [name]`, and
load it with `useModel(modelPath("<name>"))` from `lib/three/loaders.ts`.

## Character avatars

Six forms; Milo, Remi, Sami and Juno also come in three alternate palettes. They are authored
in a Blender working file (`characters_working.blend`, not in the repo because of its size;
the tracked input is the exported `.glb`). Objects are named by garment form, never colour
(`avatar-tee-shorts`), each as one mesh and one armature, 1.5 m tall, feet at the origin.

```
characters_working.blend ── avatar-export.py ──▶ assets/source/avatar-*.glb
                            npm run assets:models ──▶ public/models/avatar-*.glb
                            avatar-stills.py ──▶ public/characters/avatar-*.png (+ -portrait.png)
```

```sh
blender -b <characters_working.blend> -P scripts/assets/avatar-export.py -- .
blender -b <characters_working.blend> -P scripts/assets/avatar-variants.py -- .
blender -b <characters.blend>         -P scripts/assets/avatar-export-extra.py -- .
npm run assets:models
blender -b -P scripts/assets/avatar-stills.py -- .
blender -b -P scripts/assets/avatar-preview.py -- . <out-dir>   # visual check
```

| Script | Purpose |
|---|---|
| `avatar-export.py` | Exports the four main characters rigged (Mixamo T-pose bind), normalised to 1.5 m |
| `avatar-variants.py` | Bakes alternate palettes as repainted base-colour textures over the same mesh and rig. Palettes live in `PALETTES` there, swatches in `lib/design/character.ts`; change both together |
| `avatar-parts.py` | Per-part texel classifier used by `avatar-variants.py` |
| `avatar-export-extra.py` | Exports Nour and Lina from `characters.blend`; only bodies on Mixamo's 65-bone skeleton |
| `avatar-animations.py` | Bakes Mixamo clips into the shared clip libraries, retargeted onto the characters' rest pose, translations stripped and keyframes decimated |
| `avatar-to-mixamo.py` | Writes an unrigged T-posed FBX for Mixamo's auto-rigger |
| `avatar-stills.py` | Renders full-body and portrait stills from the shipped `.glb` |
| `avatar-preview.py` | Renders all shipped bodies side by side |
| `build-faces.py` | Builds the typefaces into `lib/design/faces/` from a pinned `google/fonts` commit |

```sh
blender -b <characters_working.blend> -P scripts/assets/avatar-animations.py -- . <mixamo-download-dir>
```

## Sources

All free forever and self-hosted; nothing is loaded from a CDN (the CSP blocks it). Credits
are in `ATTRIBUTIONS.md`.

| Source | Licence | Use |
|---|---|---|
| [Poly Haven](https://polyhaven.com) | CC0 | HDRIs |
| [Game Icons](https://game-icons.net) | CC BY 3.0 | Icons via `react-icons/gi` |
| [Mixamo](https://www.mixamo.com) | Royalty-free | Character animation |
| [Google Fonts](https://fonts.google.com) | OFL | Typefaces |
| [Blender](https://blender.org) | GPL | Authoring |
