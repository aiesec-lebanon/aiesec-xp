# blender -b -P scripts/assets/avatar-preview.py -- <repo-root> <out-dir>

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
        # Found by name: something keeps re-adding a stray primitive after each import.
        body = bpy.context.scene.objects.get(f"{name}-mesh")
        if body is None:
            raise RuntimeError(f"{name}-mesh missing after importing {path}")
        body.location.x += -1.8 + i * 1.2


def frame():
    scene = bpy.context.scene
    # The last body's matrix_world is stale after it was moved.
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
