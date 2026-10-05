# blender -b <characters.blend> -P scripts/assets/avatar-export-extra.py -- <repo-root>

import json
import os
import sys

import bpy

from importlib.util import module_from_spec, spec_from_file_location


def _load(stem):
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"{stem}.py")
    spec = spec_from_file_location(stem.replace("-", "_"), path)
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


export_step = _load("avatar-export")

# Source object in characters.blend -> the name it ships under, by garment form.
EXTRA = {
    "Ch03": "avatar-crop-joggers",
    "Ch29": "avatar-crop-jeans",
}

EXPECTED_BONES = 65


def fix_bone_namespace(mesh, rig):
    """Blender renames a second imported `mixamorig` to `mixamorig1:`; the clips only bind `mixamorig:`. Vertex groups must follow the bones."""
    renamed = 0
    for bone in rig.data.bones:
        namespace, _, rest = bone.name.partition(":")
        if not rest or not namespace.startswith("mixamorig") or namespace == "mixamorig":
            continue
        old = bone.name
        bone.name = f"mixamorig:{rest}"
        group = mesh.vertex_groups.get(old)
        if group is not None:
            group.name = bone.name
        renamed += 1
    return renamed


def opaque(mesh):
    """Unwire Alpha and Specular maps that came from a Specular/Glossiness source and are not meant as PBR inputs."""
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
                "Alpha",
                "Specular IOR Level",
                "Specular Tint",
            }:
                tree.links.remove(link)
        if "Alpha" in bsdf.inputs:
            bsdf.inputs["Alpha"].default_value = 1.0
        if "Specular IOR Level" in bsdf.inputs:
            bsdf.inputs["Specular IOR Level"].default_value = 0.3


def process(source, name, repo_root):
    mesh = bpy.data.objects[source]
    rig = mesh.parent
    if rig is None or rig.type != "ARMATURE":
        raise RuntimeError(f"{source}: expected a mesh parented to an armature")
    if len(rig.data.bones) != EXPECTED_BONES:
        raise RuntimeError(
            f"{source}: {len(rig.data.bones)} bones, not the {EXPECTED_BONES} the clips drive"
        )

    mesh.name = f"{name}-mesh"
    rig.name = f"{name}-rig"

    renamed = fix_bone_namespace(mesh, rig)

    export_step.matte_material(mesh)
    opaque(mesh)
    export_step.normalise(mesh, rig)
    export_step.select_only(rig, mesh)

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
    return {"bytes": os.path.getsize(out), "bones": len(rig.data.bones), "renamed_bones": renamed}


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    repo_root = os.path.abspath(argv[0] if argv else os.getcwd())
    os.makedirs(os.path.join(repo_root, "assets", "source"), exist_ok=True)

    if bpy.context.object is not None and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")

    report = {name: process(source, name, repo_root) for source, name in EXTRA.items()}
    print("AVATAR_EXTRA_REPORT " + json.dumps(report))


if __name__ == "__main__":
    main()
