# blender -b <characters_working.blend> -P scripts/assets/avatar-to-mixamo.py -- <out-dir> [name ...]

import os
import sys

import bpy

DEFAULT = ["avatar-tee-skirt"]


def export(name, out_dir):
    mesh = bpy.data.objects[f"{name}-mesh"]

    # The auto-rigger treats an existing armature as geometry to fit around.
    for modifier in [m for m in mesh.modifiers if m.type == "ARMATURE"]:
        rig = modifier.object
        mesh.modifiers.remove(modifier)
        if rig is not None:
            bpy.data.objects.remove(rig, do_unlink=True)
    mesh.parent = None

    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh

    path = os.path.join(out_dir, f"{name}-for-mixamo.fbx")
    bpy.ops.export_scene.fbx(
        filepath=path,
        use_selection=True,
        object_types={"MESH"},
        path_mode="COPY",
        embed_textures=True,
        add_leaf_bones=False,
    )
    print(f"MIXAMO_UPLOAD {name} {path} {os.path.getsize(path)}")


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out_dir = argv[0] if argv else os.getcwd()
    names = argv[1:] or DEFAULT
    os.makedirs(out_dir, exist_ok=True)

    if bpy.context.object is not None and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")

    for name in names:
        export(name, out_dir)


if __name__ == "__main__":
    main()
