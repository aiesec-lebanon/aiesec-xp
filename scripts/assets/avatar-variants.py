# blender -b <characters_working.blend> -P scripts/assets/avatar-variants.py -- <repo-root> [fbx-dir]

import importlib.util
import json
import os
import sys
import tempfile

import bpy
import numpy as np


def _load(stem):
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"{stem}.py")
    spec = importlib.util.spec_from_file_location(stem.replace("-", "_"), path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


parts = _load("avatar-parts")
export_step = _load("avatar-export")

PARTS = parts.PARTS
DETAIL = parts.DETAIL

# The authored palette ships unsuffixed; these are the alternates.
PALETTES = {
    "p2": {
        "skin": "#D9A87C",
        "hair": "#2E2119",
        "shirt": "#4C6B8A",
        "trouser": "#3F4550",
        "shoe": "#E8E4DC",
    },
    "p3": {
        "skin": "#8D5A3B",
        "hair": "#1A1412",
        "shirt": "#B5533F",
        "trouser": "#6E6A5F",
        "shoe": "#2B2B2B",
    },
    "p4": {
        "skin": "#F0C8A8",
        "hair": "#7A4A24",
        "shirt": "#E3DCCB",
        "trouser": "#35506E",
        "shoe": "#9A9186",
    },
}

MASK_SIZE = 2048

# Waistbands sit on torso bones; without this they keep the old colour once repainted.
TORSO_ALSO = ("trouser",)

# hoodie-joggers' salmon sleeves would otherwise classify as skin.
REFS_ALSO = {
    "avatar-hoodie-joggers": {"shirt": ["#D9826B", "#BA6E5C", "#DA826A"]},
}

# More rounds than avatar-parts.py: stray triangles show once a part is repainted.
SMOOTH_ROUNDS = 7

# Bounds the shading ratio so highlights on near-black parts do not blow out.
SHADE_RANGE = (0.34, 1.85)

# Softens dark baked AO that reads as dirt under light colours.
SHADE_GAMMA = 0.9


def refined(spec, name):
    refs = {part: list(hexes) for part, hexes in spec["refs"].items()}
    for part, extra in REFS_ALSO.get(name, {}).items():
        refs.setdefault(part, [])
        refs[part] += [h for h in extra if h not in refs[part]]

    rules = []
    for rule in spec["rules"]:
        rule = dict(rule)
        if "torso" in rule["regions"]:
            extra = [p for p in TORSO_ALSO if p in refs and p not in rule["parts"]]
            rule["parts"] = list(rule["parts"]) + extra
        rules.append(rule)
    return {"refs": refs, "rules": rules}


def part_mask(name, spec):
    """Classified on the .blend mesh; the mask is in UV space, so it transfers to the external FBX."""
    obj = bpy.data.objects[f"{name}-mesh"]
    mesh = obj.data
    # Removed in recent Blender, where the cache is kept up to date for you.
    if hasattr(mesh, "calc_loop_triangles"):
        mesh.calc_loop_triangles()
    base = parts.socket_image(obj.material_slots[0].material, "Base Color")

    loops, verts = parts.triangles(mesh)
    uvs = mesh.uv_layers.active.data
    uv = np.empty(len(uvs) * 2, np.float32)
    uvs.foreach_get("uv", uv)
    uv = uv.reshape(-1, 2)

    w, h = base.size
    px = np.empty(w * h * 4, np.float32)
    base.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)[:, :, :3]

    centre_uv = uv[loops].mean(1)
    xs = np.clip((centre_uv[:, 0] % 1.0) * w, 0, w - 1).astype(np.int32)
    ys = np.clip((centre_uv[:, 1] % 1.0) * h, 0, h - 1).astype(np.int32)
    colour = px[ys, xs]

    co = np.empty(len(mesh.vertices) * 3, np.float32)
    mesh.vertices.foreach_get("co", co)
    centroid = co.reshape(-1, 3)[verts].mean(1)

    label = parts.classify(obj, refined(spec, name), parts.linear_to_srgb(colour), centroid, verts)
    label = parts.smooth(verts, label, rounds=SMOOTH_ROUNDS)
    mask, order = parts.rasterise(label, loops, uv, MASK_SIZE)
    return base, px, mask, order


def repaint(px, mask, order, palette, tmp_dir, name, variant):
    """Shading is kept as a ratio to the part's own mean; unclaimed texels are copied through."""
    size = mask.shape[0]
    h, w = px.shape[:2]
    if (h, w) != (size, size):
        ys = (np.arange(size) * h // size).clip(0, h - 1)
        xs = (np.arange(size) * w // size).clip(0, w - 1)
        colour = px[ys[:, None], xs[None, :]]
    else:
        colour = px.copy()

    out = colour.copy()
    luma = (colour * parts.LUMA_WEIGHTS).sum(-1)
    applied = {}

    for i, part in enumerate(order):
        if part == DETAIL or part not in palette:
            continue
        sel = mask == i
        if not sel.any():
            continue

        mean_luma = float(luma[sel].mean())
        if mean_luma <= 1e-5:
            shade = np.ones(int(sel.sum()), np.float32)
        else:
            shade = np.clip(luma[sel] / mean_luma, *SHADE_RANGE) ** SHADE_GAMMA

        target = parts.hex_to_linear(palette[part])
        out[sel] = np.clip(shade[:, None] * target[None, :], 0.0, 1.0)
        applied[part] = palette[part]

    image = bpy.data.images.new(
        f"{name}-{variant}-basecolor", size, size, alpha=False, float_buffer=False
    )
    flat = np.ones((size, size, 4), np.float32)
    flat[:, :, :3] = out
    image.pixels.foreach_set(flat.ravel())
    image.file_format = "PNG"
    image.filepath_raw = os.path.join(tmp_dir, f"{name}-{variant}-basecolor.png")
    image.save()
    image.colorspace_settings.name = "sRGB"
    return image, applied


def set_base_image(mesh_obj, image):
    swapped = 0
    for slot in mesh_obj.material_slots:
        material = slot.material
        if material is None or not material.node_tree:
            continue
        tree = material.node_tree
        bsdf = next((n for n in tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if bsdf is None:
            continue
        for link in tree.links:
            if link.to_node.name != bsdf.name or link.to_socket.name != "Base Color":
                continue
            node = link.from_node
            if node.type == "TEX_IMAGE":
                node.image = image
                swapped += 1
            else:
                for inner in tree.links:
                    if inner.to_node.name == node.name and inner.from_node.type == "TEX_IMAGE":
                        inner.from_node.image = image
                        swapped += 1
    return swapped


def export_body(mesh_obj, rig, path):
    export_step.select_only(rig, mesh_obj)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=False,
        export_skins=True,
        export_animations=False,
        export_yup=True,
        export_rest_position_armature=True,
    )


def process(name, spec, repo_root, fbx_dir, tmp_dir):
    _, px, mask, order = part_mask(name, spec)

    if name in export_step.RIGGED_ELSEWHERE:
        for stale in (f"{name}-mesh", f"{name}-rig"):
            existing = bpy.data.objects.get(stale)
            if existing is not None:
                bpy.data.objects.remove(existing, do_unlink=True)
        mesh_obj, rig = export_step.load_external(name, fbx_dir)
    else:
        mesh_obj = bpy.data.objects[f"{name}-mesh"]
        rig = bpy.data.objects[f"{name}-rig"]

    export_step.matte_material(mesh_obj)
    export_step.normalise(mesh_obj, rig)

    report = {}
    for variant, palette in PALETTES.items():
        image, applied = repaint(px, mask, order, palette, tmp_dir, name, variant)
        if set_base_image(mesh_obj, image) == 0:
            raise RuntimeError(f"{name}: no base-colour texture node to repaint")

        # avatar-stills.py finds the body by `<model>-mesh`.
        mesh_obj.name = f"{name}-{variant}-mesh"
        rig.name = f"{name}-{variant}-rig"
        out = os.path.join(repo_root, "assets", "source", f"{name}-{variant}.glb")
        export_body(mesh_obj, rig, out)
        mesh_obj.name = f"{name}-mesh"
        rig.name = f"{name}-rig"
        report[variant] = {
            "glb": out,
            "bytes": os.path.getsize(out),
            "applied": applied,
        }

    report["coverage"] = {
        part: int((mask == i).sum())
        for i, part in enumerate(order)
    }
    return report


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    repo_root = os.path.abspath(argv[0] if argv else os.getcwd())
    fbx_dir = argv[1] if len(argv) > 1 else r"D:\Blender\mixamo\download"
    tmp_dir = tempfile.mkdtemp(prefix="avatar-variants-")
    os.makedirs(os.path.join(repo_root, "assets", "source"), exist_ok=True)

    if bpy.context.object is not None and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")

    report = {}
    for name, spec in parts.CHARACTERS.items():
        report[name] = process(name, spec, repo_root, fbx_dir, tmp_dir)
    print("AVATAR_VARIANTS_REPORT " + json.dumps(report))


if __name__ == "__main__":
    main()
