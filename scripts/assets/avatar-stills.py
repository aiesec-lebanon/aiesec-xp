# Renders one transparent still per character into public/characters/, from the
# same .glb the 3D stage loads (D-50) -- so the two are the same character.
#
#   blender -b -P scripts/assets/avatar-stills.py -- <repo-root>

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

WIDTH = 560
HEIGHT = 780
MARGIN = 1.10


def stage():
    scene = bpy.context.scene
    scene.render.resolution_x = WIDTH
    scene.render.resolution_y = HEIGHT
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"

    world = bpy.data.worlds.new("stills")
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    # Dim: brighter and the darker parts wash out to grey.
    bg.inputs[0].default_value = (1.0, 0.96, 0.92, 1.0)
    bg.inputs[1].default_value = 0.22
    scene.world = world

    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam = bpy.data.objects.new("cam", cam_data)
    cam.rotation_euler = (1.5708, 0.0, 0.0)
    scene.collection.objects.link(cam)
    scene.camera = cam

    key = bpy.data.lights.new("key", "AREA")
    key.energy = 340.0
    key.size = 4.0
    key_obj = bpy.data.objects.new("key", key)
    key_obj.location = (1.6, -3.0, 2.6)
    key_obj.rotation_euler = (0.85, 0.0, 0.5)
    scene.collection.objects.link(key_obj)

    fill = bpy.data.lights.new("fill", "AREA")
    fill.energy = 110.0
    fill.size = 5.0
    fill_obj = bpy.data.objects.new("fill", fill)
    fill_obj.location = (-2.4, -2.6, 1.4)
    fill_obj.rotation_euler = (1.25, 0.0, -0.7)
    scene.collection.objects.link(fill_obj)

    rim = bpy.data.lights.new("rim", "AREA")
    rim.energy = 150.0
    rim.size = 3.0
    rim_obj = bpy.data.objects.new("rim", rim)
    rim_obj.location = (0.0, 3.0, 2.4)
    rim_obj.rotation_euler = (-1.0, 0.0, 0.0)
    scene.collection.objects.link(rim_obj)


STAGE_OBJECTS = {"cam", "key", "fill", "rim"}


def clear_models():
    """Leave only the camera and the lights. Allow-list, because a background
    Blender still reads the user's startup file and whatever sits in it."""
    for obj in list(bpy.data.objects):
        if obj.name not in STAGE_OBJECTS:
            bpy.data.objects.remove(obj, do_unlink=True)


def render_one(repo_root, name):
    clear_models()
    bpy.ops.import_scene.gltf(filepath=os.path.join(repo_root, "public", "models", f"{name}.glb"))
    bpy.context.view_layer.update()

    # Posed vertices, not obj.bound_box, which still reports the authored T-pose.
    depsgraph = bpy.context.evaluated_depsgraph_get()
    corners = []
    # Named explicitly and everything else hidden: deleting strays is not enough,
    # something here puts a primitive back at the origin after every import.
    body = bpy.context.scene.objects[f"{name}-mesh"]
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH" and obj.name != body.name:
            obj.hide_render = True

    evaluated = body.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    corners += [evaluated.matrix_world @ v.co for v in mesh.vertices]
    evaluated.to_mesh_clear()

    # Aimed at what is visible, not at the origin: the models carry offsets.
    mid_x = (min(c.x for c in corners) + max(c.x for c in corners)) / 2
    mid_z = (min(c.z for c in corners) + max(c.z for c in corners)) / 2
    height = max(c.z for c in corners) - min(c.z for c in corners)

    cam = bpy.context.scene.camera
    cam.location = (mid_x, min(c.y for c in corners) - 6.0, mid_z)
    # ortho_scale covers the render's larger dimension, which here is the height.
    cam.data.ortho_scale = height * MARGIN

    out = os.path.join(repo_root, "public", "characters", f"{name}.png")
    bpy.context.scene.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print(f"STILL {name} {os.path.getsize(out)}")


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    repo_root = argv[0] if argv else os.getcwd()
    os.makedirs(os.path.join(repo_root, "public", "characters"), exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    stage()
    for name in NAMES:
        render_one(repo_root, name)
    print("AVATAR_STILLS_OK")


if __name__ == "__main__":
    main()
