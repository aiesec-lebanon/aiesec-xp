# Exports characters that live in characters.blend rather than the working file.
#
#   blender -b D:\Blender\characters.blend -P scripts/assets/avatar-export-extra.py -- <repo-root>
#
# characters.blend also holds two rigs the shared clip library cannot drive --
# Claire's 149-bone Maya rig and a 138-bone one, both split across many meshes.
# Only bodies on Mixamo's 65-bone skeleton are listed here, because that is what
# `avatar-animations.glb` is authored against (D-53).

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


def opaque(mesh):
    """Unwire transparency and the specular map.

    These two arrive from a non-PBR Specular/Glossiness source, where the maps
    mean something other than what a Principled BSDF reads them as. Ch29 had a
    map on Alpha, which exported as an alpha-blended material and punched ragged
    holes through its arms, and a second one on Specular IOR Level that washed
    the whole body out. Neither is transparent or shiny by intent: they are
    cloth. `matte_material` already does the same for Emission.
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
    return {"bytes": os.path.getsize(out), "bones": len(rig.data.bones)}


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
