# Exports the four avatars as they were authored, into assets/source/.
#
#   blender -b D:\Blender\characters_working.blend -P scripts/assets/avatar-export.py -- <repo-root>
#
# Each character keeps its authored colour (D-52); only the surface response is
# corrected, because the sources ship Mixamo's glossy defaults. The A-pose is
# baked into the mesh
# and the rig is dropped, so the exported geometry is the body in world
# coordinates: three's Box3 then measures what is actually drawn, which is what
# makes every character come out the same size. Animation will need this run
# again with the armature kept -- the rig is still in the .blend.

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

# Arms down. Both sides take the same sign: these rigs mirror the arm bones by
# roll, so negating one would send it up.
A_POSE = {"leftarm": 0.95, "rightarm": 0.95, "leftforearm": 0.10, "rightforearm": 0.10}

TARGET_HEIGHT = 1.5


def select_only(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def pose_arms(rig):
    for bone in rig.pose.bones:
        angle = A_POSE.get(bone.name.split(":")[-1].lower())
        if angle is None:
            continue
        bone.rotation_mode = "XYZ"
        bone.rotation_euler.x = angle
    bpy.context.view_layer.update()


def bake_pose(mesh):
    """Freeze the posed body into the mesh and drop the rig."""
    modifier = next((m for m in mesh.modifiers if m.type == "ARMATURE"), None)
    if modifier is None:
        return
    rig = modifier.object
    select_only(mesh)
    bpy.ops.object.modifier_apply(modifier=modifier.name)

    mesh.parent = None
    if rig is not None:
        bpy.data.objects.remove(rig, do_unlink=True)


def matte_material(mesh):
    """Take the shine off, and unwire anything the source left self-lit.

    Three of the four arrive at Mixamo's default roughness of 0.5, which reads as
    wet plastic on a cloth character. The fourth carries no metallic value at
    all, and glTF reads a missing metallic factor as 1.0 -- fully metal -- so
    both are set explicitly rather than left to a default.

    One of the four also routes its base colour into Emission, which makes it
    self-lit and washed out next to the rest whatever the scene lighting does.
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
            if link.to_node.name == bsdf.name and link.to_socket.name == "Emission Color":
                tree.links.remove(link)
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = 0.0

        bsdf.inputs["Roughness"].default_value = 1.0
        bsdf.inputs["Metallic"].default_value = 0.0


def stand_at_origin(mesh):
    """Centre on x/y, feet on z=0, normalised height -- then freeze it into the
    geometry so the exported coordinates need no transform to be correct."""
    bpy.context.view_layer.update()
    corners = [mesh.matrix_world @ Vector(c) for c in mesh.bound_box]
    height = max(c.z for c in corners) - min(c.z for c in corners)
    if height > 0:
        mesh.scale *= TARGET_HEIGHT / height

    bpy.context.view_layer.update()
    corners = [mesh.matrix_world @ Vector(c) for c in mesh.bound_box]
    mesh.location.x -= (min(c.x for c in corners) + max(c.x for c in corners)) / 2
    mesh.location.y -= (min(c.y for c in corners) + max(c.y for c in corners)) / 2
    mesh.location.z -= min(c.z for c in corners)

    select_only(mesh)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def export(mesh, path):
    select_only(mesh)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=False,
        export_skins=False,
        export_animations=False,
        export_yup=True,
    )


def process(name, repo_root):
    mesh = bpy.data.objects[f"{name}-mesh"]
    bake_pose(mesh)
    matte_material(mesh)
    stand_at_origin(mesh)

    out = os.path.join(repo_root, "assets", "source", f"{name}.glb")
    export(mesh, out)

    corners = [mesh.matrix_world @ Vector(c) for c in mesh.bound_box]
    return {
        "bytes": os.path.getsize(out),
        "height": round(max(c.z for c in corners) - min(c.z for c in corners), 3),
        "width": round(max(c.x for c in corners) - min(c.x for c in corners), 3),
        "feet_z": round(min(c.z for c in corners), 3),
    }


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    repo_root = argv[0] if argv else os.getcwd()
    os.makedirs(os.path.join(repo_root, "assets", "source"), exist_ok=True)

    if bpy.context.object is not None and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")

    for name in NAMES:
        rig = bpy.data.objects.get(f"{name}-rig")
        if rig is not None:
            pose_arms(rig)

    report = {name: process(name, repo_root) for name in NAMES}
    print("AVATAR_EXPORT_REPORT " + json.dumps(report))


if __name__ == "__main__":
    main()
