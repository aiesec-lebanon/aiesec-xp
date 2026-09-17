# Renders the shipped .glb files side by side, so a rebuild can be checked
# without opening the app. Every body should come out the same height.
#
#   blender -b -P scripts/assets/avatar-preview.py -- <repo-root> <out-dir>

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


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def stage():
    scene = bpy.context.scene
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 760
    scene.render.film_transparent = False

    world = bpy.data.worlds.new("preview")
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs[0].default_value = (0.20, 0.20, 0.21, 1.0)
    bg.inputs[1].default_value = 1.0
    scene.world = world

    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = 50
    cam = bpy.data.objects.new("cam", cam_data)
    cam.rotation_euler = (1.5708, 0.0, 0.0)
    scene.collection.objects.link(cam)
    scene.camera = cam

    for loc, energy in (((2.0, -4.0, 3.0), 600.0), ((-3.0, -3.0, 2.0), 300.0), ((0.0, 4.0, 2.5), 250.0)):
        light = bpy.data.lights.new("l", "AREA")
        light.energy = energy
        light.size = 3.0
        obj = bpy.data.objects.new("l", light)
        obj.location = loc
        obj.rotation_euler = (1.1, 0.0, 0.0) if loc[1] < 0 else (-1.1, 0.0, 0.0)
        scene.collection.objects.link(obj)


def load(repo_root):
    for i, name in enumerate(NAMES):
        path = os.path.join(repo_root, "public", "models", f"{name}.glb")
        bpy.ops.import_scene.gltf(filepath=path)
        # Found by name rather than by diffing bpy.data.objects before and after:
        # the diff quietly lost one of the four, and something in this Blender's
        # configuration keeps putting a stray primitive back after every import.
        body = bpy.context.scene.objects.get(f"{name}-mesh")
        if body is None:
            raise RuntimeError(f"{name}-mesh missing after importing {path}")
        # They all export standing at the origin, so deal them along x.
        body.location.x += -1.8 + i * 1.2


def frame():
    """Pull the camera back until every character fits, from the meshes' own
    world bounds."""
    scene = bpy.context.scene
    # The last body was moved after the last import, so its matrix_world is
    # still stale here; without this the camera is framed without it and crops
    # it out of the picture entirely.
    bpy.context.view_layer.update()

    corners = []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        corners += [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    if not corners:
        return

    xs = [c.x for c in corners]
    zs = [c.z for c in corners]
    print("BOUNDS x", round(min(xs), 2), round(max(xs), 2), "z", round(min(zs), 2), round(max(zs), 2))

    width = max(xs) - min(xs)
    height = max(zs) - min(zs)
    aspect = scene.render.resolution_x / scene.render.resolution_y
    sensor = scene.camera.data.sensor_width
    lens = scene.camera.data.lens

    # Fit whichever axis is tighter, with a margin.
    need = max(width / sensor, height / (sensor / aspect))
    scene.camera.location = (
        (min(xs) + max(xs)) / 2,
        min(c.y for c in corners) - need * lens * 1.18,
        (min(zs) + max(zs)) / 2,
    )


def render(path):
    bpy.context.scene.render.filepath = path
    bpy.context.scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    repo_root = argv[0] if argv else os.getcwd()
    out_dir = argv[1] if len(argv) > 1 else repo_root
    os.makedirs(out_dir, exist_ok=True)

    clear()
    stage()
    load(repo_root)
    frame()
    render(os.path.join(out_dir, "avatars-default.png"))
    print("AVATAR_PREVIEW_OK")


if __name__ == "__main__":
    main()


# --------------------------------------------------------------------------
# Parked with the rest of the recolouring (D-52): the models ship with their
# authored materials, so there are no per-part slots to repaint. This rendered
# a second image with every part tinted, to prove recolouring worked.
#
# RECOLOUR = {
#     "skin": (0.42, 0.24, 0.13),
#     "hair": (0.86, 0.72, 0.30),
#     "shirt": (0.01, 0.62, 0.30),
#     "trouser": (0.05, 0.05, 0.06),
#     "shoe": (0.95, 0.20, 0.13),
# }
#
# def srgb_to_linear(c):
#     return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
#
# def recolour():
#     """Repaint each tintable part, the way the app does.
#
#     The importer rebuilds baseColorFactor as a multiply node in front of the
#     shader, so the colour goes there; writing it to the shader's own Base Color
#     socket silently does nothing, because that socket is linked.
#     """
#     for mat in bpy.data.materials:
#         part = next((p for p in RECOLOUR if mat.name.endswith(f"-{p}")), None)
#         if part is None or mat.node_tree is None:
#             continue
#         rgb = [srgb_to_linear(c) for c in RECOLOUR[part]]
#
#         tree = mat.node_tree
#         bsdf = next((n for n in tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
#         if bsdf is None:
#             continue
#         link = next(
#             (l for l in tree.links if l.to_node.name == bsdf.name and l.to_socket.name == "Base Color"),
#             None,
#         )
#         if link is None:
#             bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
#             continue
#
#         node = link.from_node
#         if node.type in {"MIX", "MIX_RGB"}:
#             linked = {l.to_socket.name for l in tree.links if l.to_node.name == node.name}
#             target = next(
#                 (s for s in node.inputs if s.type == "RGBA" and s.name not in linked),
#                 None,
#             )
#             if target is not None:
#                 target.default_value = (*rgb, 1.0)
#         else:
#             bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
# --------------------------------------------------------------------------
