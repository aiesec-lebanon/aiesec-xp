# blender -b <characters_working.blend> -P scripts/assets/avatar-export.py -- <repo-root> [fbx-dir]

import json
import os
import sys

import bpy
from mathutils import Vector

NAMES = [
    "avatar-hoodie-joggers",
    "avatar-tee-shorts",
    "avatar-hoodie-cargo",
    "avatar-tee-skirt",
]

RIGGED_ELSEWHERE = {"avatar-tee-skirt": "avatar-tee-skirt-for-mixamo.fbx"}

TARGET_HEIGHT = 1.5


def select_only(*objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def matte_material(mesh):
    """Mixamo roughness 0.5 reads as plastic and glTF treats a missing metallic as metal; also drops a stray emission map."""
    for slot in mesh.material_slots:
        material = slot.material
        if material is None or not material.node_tree:
            continue
        tree = material.node_tree
        bsdf = next((n for n in tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if bsdf is None:
            continue

        for link in list(tree.links):
            if link.to_node.name == bsdf.name and link.to_socket.name in {
                "Emission Color",
                "Emission",
            }:
                tree.links.remove(link)
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = 0.0

        bsdf.inputs["Roughness"].default_value = 1.0
        bsdf.inputs["Metallic"].default_value = 0.0


def normalise(mesh, rig):
    """Frozen into the data: a skinned mesh's node transform is ignored when drawn but not when measured."""
    bpy.context.view_layer.update()
    corners = [mesh.matrix_world @ Vector(c) for c in mesh.bound_box]
    height = max(c.z for c in corners) - min(c.z for c in corners)
    if height > 0:
        rig.scale *= TARGET_HEIGHT / height

    bpy.context.view_layer.update()
    corners = [mesh.matrix_world @ Vector(c) for c in mesh.bound_box]
    rig.location.x -= (min(c.x for c in corners) + max(c.x for c in corners)) / 2
    rig.location.y -= (min(c.y for c in corners) + max(c.y for c in corners)) / 2
    rig.location.z -= min(c.z for c in corners)

    select_only(rig, mesh)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def load_external(name, fbx_dir):
    """The auto-rigger re-encodes the texture darker, so materials are pointed back at the .blend's original image."""
    originals = {image.name: image for image in bpy.data.images}

    before = set(bpy.data.objects.keys())
    bpy.ops.import_scene.fbx(filepath=os.path.join(fbx_dir, RIGGED_ELSEWHERE[name]))
    added = [bpy.data.objects[k] for k in set(bpy.data.objects.keys()) - before]

    mesh = next(o for o in added if o.type == "MESH")
    rig = next(o for o in added if o.type == "ARMATURE")
    mesh.name = f"{name}-mesh"
    rig.name = f"{name}-rig"

    for slot in mesh.material_slots:
        material = slot.material
        if material is None or not material.node_tree:
            continue
        for node in material.node_tree.nodes:
            if node.type != "TEX_IMAGE" or node.image is None:
                continue
            stem = node.image.name.split(".")[0]
            original = originals.get(stem)
            if original is not None and original is not node.image:
                node.image = original

    return mesh, rig


def process(name, repo_root, fbx_dir):
    if name in RIGGED_ELSEWHERE:
        for stale in (f"{name}-mesh", f"{name}-rig"):
            existing = bpy.data.objects.get(stale)
            if existing is not None:
                bpy.data.objects.remove(existing, do_unlink=True)
        mesh, rig = load_external(name, fbx_dir)
    else:
        mesh = bpy.data.objects[f"{name}-mesh"]
        rig = bpy.data.objects[f"{name}-rig"]

    matte_material(mesh)
    normalise(mesh, rig)

    select_only(rig, mesh)
    out = os.path.join(repo_root, "assets", "source", f"{name}.glb")
    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format="GLB",
        use_selection=True,
        export_apply=False,
        export_skins=True,
        export_animations=False,
        export_yup=True,
        export_rest_position_armature=True,
    )

    corners = [mesh.matrix_world @ Vector(c) for c in mesh.bound_box]
    return {
        "bytes": os.path.getsize(out),
        "bones": len(rig.data.bones),
        "height": round(max(c.z for c in corners) - min(c.z for c in corners), 3),
        "feet_z": round(min(c.z for c in corners), 3),
    }


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    repo_root = argv[0] if argv else os.getcwd()
    fbx_dir = argv[1] if len(argv) > 1 else r"D:\Blender\mixamo\download"
    os.makedirs(os.path.join(repo_root, "assets", "source"), exist_ok=True)

    if bpy.context.object is not None and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")

    report = {name: process(name, repo_root, fbx_dir) for name in NAMES}
    print("AVATAR_EXPORT_REPORT " + json.dumps(report))


if __name__ == "__main__":
    main()
