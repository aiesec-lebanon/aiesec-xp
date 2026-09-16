# Splits each avatar into the parts a member can recolour (D-50), and exports one
# .glb per character into assets/source/.
#
#   blender -b D:\Blender\characters_working.blend -P scripts/assets/avatar-parts.py -- <repo-root>

import json
import os
import sys
import tempfile

import bpy
import numpy as np
from mathutils import Vector

PARTS = ("skin", "hair", "shirt", "trouser", "shoe")
DETAIL = "detail"

# How far a texel may sit from the nearest reference colour, in sRGB space,
# before the triangle is handed to `detail` instead of guessed at.
MAX_REF_DISTANCE = 0.28

LUMA_PERCENTILE = 92
MASK_SIZE = 1024
LUMA_WEIGHTS = np.array([0.2126, 0.7152, 0.0722], np.float32)


def region_of(bone):
    b = bone.split(":")[-1].lower()
    if "head" in b or "neck" in b:
        return "head"
    if "toe" in b or "foot" in b:
        return "feet"
    if "upleg" in b or b.endswith("leg"):
        return "legs"
    if "hand" in b or "forearm" in b or b.endswith("arm") or "shoulder" in b:
        return "arms"
    return "torso"


# Reference colours are the cluster means of each character's own baked texture.
# `rules` narrows the candidates by body region, and by height where colour alone
# cannot tell two garments apart -- tee-skirt's socks are the same blue as its
# skirt. A garment's secondary hue is left out on purpose: listing both a shoe's
# white and its red flashes averaged the part to pink, where leaving the flashes
# to `detail` keeps them and lets the swatch repaint only the shoe.
CHARACTERS = {
    "avatar-hoodie-cargo": {
        "refs": {
            "skin": ["#F1C3A9", "#D6B396", "#D0AD95", "#E5B99E"],
            "hair": ["#947364", "#73625E", "#876A60", "#85695F"],
            "shirt": ["#7C98CD", "#6A7AA0", "#7B94C7"],
            "trouser": ["#DCC2A6", "#D4BA9C", "#C6AA8C", "#B49778"],
            "shoe": ["#839ED0", "#7C91BB"],
        },
        "rules": [
            {"regions": ["head"], "parts": ["skin", "hair"]},
            {"regions": ["torso", "arms"], "parts": ["shirt", "skin"]},
            {"regions": ["legs"], "parts": ["trouser"]},
            {"regions": ["feet"], "parts": ["shoe", "trouser"]},
        ],
    },
    "avatar-hoodie-joggers": {
        "refs": {
            "skin": ["#E4B69D", "#C69178", "#E5B297", "#DBA88D"],
            "hair": ["#655A57", "#7C645E", "#5D5754"],
            "shirt": ["#E8DDDA", "#DACBC5"],
            "trouser": ["#A79B99", "#988A86", "#817572"],
            "shoe": ["#7C6C63", "#A69B99", "#948986"],
        },
        "rules": [
            {"regions": ["head"], "parts": ["skin", "hair"]},
            {"regions": ["torso", "arms"], "parts": ["shirt", "skin"]},
            {"regions": ["legs"], "parts": ["trouser"]},
            {"regions": ["feet"], "parts": ["shoe"]},
        ],
    },
    "avatar-tee-shorts": {
        "refs": {
            "skin": ["#EAC3A2", "#E8CEB9", "#EFCBA9", "#E6B38C", "#E0B590"],
            "hair": ["#845F4A", "#9E7455", "#B38865", "#8F674D"],
            "shirt": ["#709DD0", "#6689B8", "#6D7C95", "#6D99CB"],
            "trouser": ["#8092A5", "#AFB7C1", "#5E6979"],
            "shoe": ["#E1DEDE", "#D1C7C9"],
        },
        "rules": [
            {"regions": ["head"], "parts": ["skin", "hair"]},
            {"regions": ["torso", "arms"], "parts": ["shirt", "skin"]},
            {"regions": ["legs"], "zmin": 0.30, "parts": ["trouser", "skin"]},
            {"regions": ["legs"], "parts": ["skin", "shoe"]},
            {"regions": ["feet"], "parts": ["shoe", "skin"]},
        ],
    },
    "avatar-tee-skirt": {
        "refs": {
            "skin": ["#FCE4D0", "#FAE8DA", "#FDE7D4"],
            "hair": ["#242324", "#1F1B1F", "#3E3834", "#474640"],
            "shirt": ["#F88BCA", "#EE77C1", "#F67FC5"],
            "trouser": ["#74B1DE", "#5698C2", "#7AAFDA"],
            "shoe": ["#6BACDF", "#B2D4EF"],
        },
        "rules": [
            {"regions": ["head"], "parts": ["skin", "hair"]},
            {"regions": ["torso", "arms"], "parts": ["shirt", "skin"]},
            {"regions": ["legs"], "zmin": 0.45, "parts": ["trouser", "skin"]},
            {"regions": ["legs"], "parts": ["shoe", "skin"]},
            {"regions": ["feet"], "parts": ["shoe", "skin"]},
        ],
    },
}


def srgb_to_linear(c):
    c = np.asarray(c, dtype=np.float32)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(c):
    c = np.clip(np.asarray(c, dtype=np.float32), 0.0, 1.0)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def hex_to_linear(value):
    v = value.lstrip("#")
    return srgb_to_linear(np.array([int(v[i : i + 2], 16) / 255.0 for i in (0, 2, 4)], np.float32))


def linear_to_hex(rgb):
    s = (linear_to_srgb(np.asarray(rgb, np.float32)) * 255).round().astype(int).clip(0, 255)
    return "#%02X%02X%02X" % tuple(s.tolist())


def socket_image(material, socket):
    # Compared by name, not identity: bpy hands out a fresh wrapper each access.
    tree = material.node_tree
    bsdf = next(n for n in tree.nodes if n.type == "BSDF_PRINCIPLED")
    for link in tree.links:
        if link.to_node.name == bsdf.name and link.to_socket.name == socket:
            node = link.from_node
            if node.type == "TEX_IMAGE":
                return node.image
            for inner in tree.links:
                if inner.to_node.name == node.name and inner.from_node.type == "TEX_IMAGE":
                    return inner.from_node.image
    return None


def triangles(mesh):
    tris = mesh.loop_triangles
    n = len(tris)
    loops = np.empty(n * 3, np.int32)
    tris.foreach_get("loops", loops)
    verts = np.empty(n * 3, np.int32)
    tris.foreach_get("vertices", verts)
    return loops.reshape(n, 3), verts.reshape(n, 3)


def classify(obj, spec, colour_srgb, centroid, verts):
    mesh = obj.data
    names = [g.name for g in obj.vertex_groups]
    vertex_region = np.array(
        [
            region_of(names[max(v.groups, key=lambda g: g.weight).group]) if v.groups else "torso"
            for v in mesh.vertices
        ]
    )
    region = vertex_region[verts[:, 0]]
    z = centroid[:, 2]

    # sRGB, not linear: one threshold then means roughly the same perceptual gap
    # across the range.
    refs = {
        part: linear_to_srgb(np.array([hex_to_linear(h) for h in hexes], np.float32))
        for part, hexes in spec["refs"].items()
    }

    label = np.full(len(colour_srgb), DETAIL, dtype=object)
    for rule in spec["rules"]:
        match = np.isin(region, rule["regions"]) & (label == DETAIL)
        if "zmin" in rule:
            match &= z >= rule["zmin"]
        if "zmax" in rule:
            match &= z < rule["zmax"]
        if not match.any():
            continue

        sample = colour_srgb[match]
        best = np.full(len(sample), np.inf, np.float32)
        pick = np.full(len(sample), DETAIL, dtype=object)
        for part in rule["parts"]:
            if part not in refs:
                continue
            d = np.sqrt(((sample[:, None, :] - refs[part][None, :, :]) ** 2).sum(-1)).min(1)
            closer = d < best
            best = np.where(closer, d, best)
            pick[closer] = part
        pick[best > MAX_REF_DISTANCE] = DETAIL
        label[match] = pick
    return label


def smooth(verts, label, rounds=3):
    """Majority vote over edge neighbours, to clear classifier speckle.

    `detail` is sticky: an eye or a printed logo has to survive a vote it would
    always lose on area.
    """
    n = len(label)
    shared = {}
    for f in range(n):
        a, b, c = verts[f]
        for u, v in ((a, b), (b, c), (c, a)):
            shared.setdefault((u, v) if u < v else (v, u), []).append(f)
    neighbours = [[] for _ in range(n)]
    for faces in shared.values():
        if len(faces) < 2:
            continue
        for i in faces:
            for j in faces:
                if i != j:
                    neighbours[i].append(j)

    label = label.copy()
    for _ in range(rounds):
        nxt = label.copy()
        for f in range(n):
            if label[f] == DETAIL:
                continue
            near = neighbours[f]
            if not near:
                continue
            counts = {}
            for j in near:
                if label[j] != DETAIL:
                    counts[label[j]] = counts.get(label[j], 0) + 1
            if counts:
                part, votes = max(counts.items(), key=lambda kv: kv[1])
                if votes > len(near) / 2:
                    nxt[f] = part
        label = nxt
    return label


def rasterise(label, loops, uv, size):
    """Paint each triangle's part into UV space, so the luminance map can be
    normalised per part."""
    order = [DETAIL] + list(PARTS)
    index = {p: i for i, p in enumerate(order)}
    mask = np.full((size, size), -1, np.int8)

    tri_uv = uv[loops] * size
    for f in range(len(label)):
        part = index.get(label[f], 0)
        t = tri_uv[f]
        x0 = max(int(np.floor(t[:, 0].min())), 0)
        x1 = min(int(np.ceil(t[:, 0].max())) + 1, size)
        y0 = max(int(np.floor(t[:, 1].min())), 0)
        y1 = min(int(np.ceil(t[:, 1].max())) + 1, size)
        if x1 <= x0 or y1 <= y0:
            continue
        ys, xs = np.mgrid[y0:y1, x0:x1]
        px = xs + 0.5
        py = ys + 0.5
        (ax, ay), (bx, by), (cx, cy) = t
        den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(den) < 1e-9:
            mask[y0:y1, x0:x1] = part
            continue
        w0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den
        w1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den
        inside = (w0 >= -0.02) & (w1 >= -0.02) & (w0 + w1 <= 1.02)
        block = mask[y0:y1, x0:x1]
        block[inside] = part
        mask[y0:y1, x0:x1] = block

    # Island edges bleed under filtering, so grow each part into the padding.
    for _ in range(4):
        empty = mask < 0
        if not empty.any():
            break
        for shift, axis in ((1, 0), (-1, 0), (1, 1), (-1, 1)):
            src = np.roll(mask, shift, axis=axis)
            fill = empty & (src >= 0)
            mask[fill] = src[fill]
            empty = mask < 0
    return mask, order


def luminance_map(px, mask, order, tmp_dir, name):
    """Rewrite the baked texture as a per-part-normalised luminance map, with the
    default colour each part needs to look unchanged.

    Normalising per part rather than globally is what lets near-black hair be
    tinted to anything other than another near-black.
    """
    size = mask.shape[0]
    h, w = px.shape[:2]
    if (h, w) != (size, size):
        ys = (np.arange(size) * h // size).clip(0, h - 1)
        xs = (np.arange(size) * w // size).clip(0, w - 1)
        colour = px[ys[:, None], xs[None, :]]
    else:
        colour = px

    luma = (colour * LUMA_WEIGHTS).sum(-1)
    out = np.zeros_like(luma)
    defaults = {}

    for i, part in enumerate(order):
        sel = mask == i
        if not sel.any():
            continue
        if part == DETAIL:
            continue
        values = luma[sel]
        scale = float(np.percentile(values, LUMA_PERCENTILE))
        if scale <= 1e-6:
            scale = max(float(values.max()), 1e-6)
        normalised = np.clip(values / scale, 0.0, 1.0)
        out[sel] = normalised

        mean_colour = colour[sel].reshape(-1, 3).mean(0)
        mean_luma = max(float(normalised.mean()), 1e-4)
        defaults[part] = np.clip(mean_colour / mean_luma, 0.0, 1.0)

    # Unclaimed texels fall back to a global normalisation, so the atlas padding
    # does not read as black where filtering reaches into it.
    rest = out == 0
    if rest.any():
        global_scale = max(float(np.percentile(luma, LUMA_PERCENTILE)), 1e-6)
        out[rest] = np.clip(luma[rest] / global_scale, 0.0, 1.0)

    image = bpy.data.images.new(f"{name}-luma", size, size, alpha=False, float_buffer=False)
    flat = np.empty((size, size, 4), np.float32)
    flat[:, :, 0] = out
    flat[:, :, 1] = out
    flat[:, :, 2] = out
    flat[:, :, 3] = 1.0
    image.pixels.foreach_set(flat.ravel())
    image.file_format = "PNG"
    image.filepath_raw = os.path.join(tmp_dir, f"{name}-luma.png")
    image.save()
    image.colorspace_settings.name = "sRGB"
    return image, defaults


def build_material(name, part, base_image, normal_image, colour):
    mat = bpy.data.materials.new(f"{name}-{part}")
    mat.use_nodes = True
    tree = mat.node_tree
    bsdf = next(n for n in tree.nodes if n.type == "BSDF_PRINCIPLED")

    tex = tree.nodes.new("ShaderNodeTexImage")
    tex.image = base_image
    tex.location = (-520, 260)

    if colour is None:
        tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        # The tint must reach Base Color through an explicit multiply: a socket's
        # default_value is ignored once a texture is linked, so every part would
        # export the same white factor and dedup would collapse them into one.
        mix = tree.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.location = (-240, 260)
        mix.inputs["Factor"].default_value = 1.0
        colour_in = [s for s in mix.inputs if s.type == "RGBA"]
        colour_out = next(s for s in mix.outputs if s.type == "RGBA")
        tree.links.new(tex.outputs["Color"], colour_in[0])
        colour_in[1].default_value = (float(colour[0]), float(colour[1]), float(colour[2]), 1.0)
        tree.links.new(colour_out, bsdf.inputs["Base Color"])

    if normal_image is not None:
        ntex = tree.nodes.new("ShaderNodeTexImage")
        ntex.image = normal_image
        ntex.location = (-520, -140)
        nmap = tree.nodes.new("ShaderNodeNormalMap")
        nmap.location = (-240, -140)
        tree.links.new(ntex.outputs["Color"], nmap.inputs["Color"])
        tree.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])

    bsdf.inputs["Roughness"].default_value = 0.72
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.28
    return mat


# T-pose is a rigging convention, not a way to stand. Both sides take the same
# sign: these rigs mirror the arm bones by roll, so negating one sends it up.
A_POSE = {"leftarm": 0.95, "rightarm": 0.95, "leftforearm": 0.10, "rightforearm": 0.10}


def pose_arms(rig):
    if rig is None or rig.type != "ARMATURE":
        return
    for bone in rig.pose.bones:
        angle = A_POSE.get(bone.name.split(":")[-1].lower())
        if angle is None:
            continue
        bone.rotation_mode = "XYZ"
        bone.rotation_euler.x = angle
    bpy.context.view_layer.update()


def stand_at_origin(obj):
    """Centre on x/y and put the feet on z=0; the models carry scattered
    authoring offsets, one of them a metre below the floor."""
    root = obj.parent if obj.parent is not None else obj
    bpy.context.view_layer.update()
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    root.location.x -= (min(c.x for c in corners) + max(c.x for c in corners)) / 2
    root.location.y -= (min(c.y for c in corners) + max(c.y for c in corners)) / 2
    root.location.z -= min(c.z for c in corners)
    bpy.context.view_layer.update()


def export(obj, path):
    pose_arms(obj.parent)
    stand_at_origin(obj)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    rig = obj.parent
    if rig is not None:
        rig.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=False,
        export_skins=True,
        export_animations=False,
        export_yup=True,
        # Defaults True, which would write the rest pose and discard the A-pose.
        export_rest_position_armature=False,
    )


def process(name, spec, repo_root, tmp_dir):
    obj = bpy.data.objects[f"{name}-mesh"]
    mesh = obj.data
    material = obj.material_slots[0].material
    base = socket_image(material, "Base Color")
    normal = socket_image(material, "Normal")

    loops, verts = triangles(mesh)
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

    label = classify(obj, spec, linear_to_srgb(colour), centroid, verts)
    label = smooth(verts, label)

    mask, order = rasterise(label, loops, uv, MASK_SIZE)
    luma, defaults = luminance_map(px, mask, order, tmp_dir, name)

    # Slot 0 is `detail`: whatever the classifier declined to claim.
    obj.data.materials.clear()
    slot_of = {}
    obj.data.materials.append(build_material(name, DETAIL, base, normal, None))
    slot_of[DETAIL] = 0
    for part in PARTS:
        if part not in defaults:
            continue
        slot_of[part] = len(obj.data.materials)
        obj.data.materials.append(build_material(name, part, luma, normal, defaults[part]))

    index = np.zeros(len(label), np.int32)
    for part, slot in slot_of.items():
        index[label == part] = slot

    # A quad's two triangles can disagree; the polygon takes the majority.
    tris = mesh.loop_triangles
    poly_index = np.empty(len(tris), np.int32)
    tris.foreach_get("polygon_index", poly_index)
    votes = {}
    for t in range(len(index)):
        votes.setdefault(int(poly_index[t]), []).append(int(index[t]))
    material_index = np.zeros(len(mesh.polygons), np.int32)
    for poly, vs in votes.items():
        material_index[poly] = max(set(vs), key=vs.count)
    mesh.polygons.foreach_set("material_index", material_index)
    mesh.update()

    out_path = os.path.join(repo_root, "assets", "source", f"{name}.glb")
    export(obj, out_path)

    counts = {p: int((label == p).sum()) for p in [DETAIL, *PARTS]}
    return {
        "glb": out_path,
        "bytes": os.path.getsize(out_path),
        "faces": counts,
        "defaults": {p: linear_to_hex(c) for p, c in defaults.items()},
    }


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    repo_root = argv[0] if argv else os.getcwd()
    tmp_dir = tempfile.mkdtemp(prefix="avatar-parts-")
    os.makedirs(os.path.join(repo_root, "assets", "source"), exist_ok=True)

    report = {}
    for name, spec in CHARACTERS.items():
        report[name] = process(name, spec, repo_root, tmp_dir)
    print("AVATAR_PARTS_REPORT " + json.dumps(report))


if __name__ == "__main__":
    main()
