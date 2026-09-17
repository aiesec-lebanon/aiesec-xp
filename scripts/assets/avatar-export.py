# Exports the four avatars, rigged, into assets/source/ (D-53).
#
#   blender -b D:\Blender\characters_working.blend -P scripts/assets/avatar-export.py -- <repo-root> [fbx-dir]
#
# The bind pose stays the Mixamo T-pose, because that is what the clips in
# avatar-animations.glb are authored against -- a body is never seen in it, since
# an idle plays from the first frame. Every character is normalised to 1.5m with
# its feet on the floor and the transform frozen into the data, so three's Box3
# reports the same size for all four.
#
# Juno comes from the Mixamo auto-rigger rather than the .blend: her original rig
# was a 24-bone skeleton of separate origin that the clips cannot drive.

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
    """Take the shine off, and unwire anything left self-lit.

    Mixamo's default roughness of 0.5 reads as wet plastic on a cloth character,
    and a missing metallic factor is read by glTF as fully metal, so both are set
    explicitly. The auto-rigger also hands back an emission texture that nothing
    asked for.
    """
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
    """1.5m tall, feet on the floor, centred -- frozen into the data.

    Left as an object transform this would be a trap: a skinned mesh's node
    transform is ignored when it is drawn but not when it is measured, so the
    sizes would disagree again.
    """
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
    """Bring in a character that was rigged outside the .blend.

    The auto-rigger returns the texture re-encoded -- same name, different
    pixels, and visibly deeper and darker than the art. The .blend still holds
    the original, so the returned material is pointed back at it.
    """
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
            # The re-encode keeps the name but lands as a second datablock, so
            # the original is whichever one was already here.
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
