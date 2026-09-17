# Bakes the Mixamo clips into one shared animation file (D-53).
#
#   blender -b -P scripts/assets/avatar-animations.py -- <repo-root> <fbx-dir>
#
# One file, not one per character: every clip is a set of bone rotations on the
# Mixamo skeleton, and all four characters carry that skeleton, so the same
# animation drives any of them. Juno's rig is the 33-bone subset -- the same
# names without fingers -- so her finger tracks simply find no target.
#
# The output carries the skeleton and the clips and no mesh at all.

import glob
import json
import os
import sys

import bpy

# Named for what they are used for, not what Mixamo called them.
CLIPS = {
    "Breathing Idle": "idle-breathing",
    "Happy Idle": "idle-happy",
    "Happy Idle (1)": "idle-happy-2",
    "Look Around Idle": "idle-look-around",
    "Looking Around Idle": "idle-looking-around",
    "Arm Stretching Idle": "idle-stretch",
    "Catwalk Idle Twist R": "idle-twist",
    "Waving": "wave",
    "Cheering": "cheer",
    "Cheering (1)": "cheer-2",
    "Clapping": "clap",
    "Rallying": "rally",
    "Victory": "victory",
    "Jumping": "jump",
    "Walking Left Turn": "walk-left",
    "Walking Right Turn": "walk-right",
}

# Left out on purpose: the two sitting idles put a body on a chair this product
# does not have, and Offensive Idle is a combat stance. Both are still in the
# download folder if that judgement is ever revisited.
SKIP = {"Sitting Idle", "Sitting Idle (1)", "Offensive Idle"}


def action_fcurves(action):
    """Blender 5 moved fcurves under layers/strips/channelbags."""
    if hasattr(action, "fcurves"):
        return list(action.fcurves)
    curves = []
    for layer in getattr(action, "layers", []):
        for strip in getattr(layer, "strips", []):
            for bag in getattr(strip, "channelbags", []):
                curves.extend(bag.fcurves)
    return curves


def remove_fcurve(action, fcurve):
    if hasattr(action, "fcurves") and hasattr(action.fcurves, "remove"):
        try:
            action.fcurves.remove(fcurve)
            return
        except (RuntimeError, ReferenceError):
            pass
    for layer in getattr(action, "layers", []):
        for strip in getattr(layer, "strips", []):
            for bag in getattr(strip, "channelbags", []):
                if fcurve in list(bag.fcurves):
                    bag.fcurves.remove(fcurve)
                    return


def trim(action):
    """Drop what the clip does not need, and stop it walking off the set.

    Mixamo keys a location on every bone, which only the hips actually use --
    dropping the rest is most of the file size. And one clip (Rallying) was not
    exported in place: it advances over a metre, which on a fixed camera means
    the body leaves the frame. Subtracting the net drift keeps the motion and
    loses the travel.
    """
    dropped = 0
    for fcurve in list(action_fcurves(action)):
        path = fcurve.data_path
        if not path.endswith("location"):
            continue

        if "Hips" not in path:
            remove_fcurve(action, fcurve)
            dropped += 1
            continue

        points = fcurve.keyframe_points
        if len(points) < 2:
            continue
        first = points[0].co[1]
        last = points[-1].co[1]
        drift = last - first
        if abs(drift) < 1e-4:
            continue

        start = points[0].co[0]
        span = points[-1].co[0] - start
        if span <= 0:
            continue
        for point in points:
            share = (point.co[0] - start) / span
            point.co[1] -= drift * share
            point.handle_left[1] -= drift * share
            point.handle_right[1] -= drift * share
        fcurve.update()
    return dropped


def decimate(action, tolerance=0.01):
    """Drop keyframes a straight line already accounts for.

    Mixamo keys every bone on every frame. Most of that is a slow curve sampled
    far finer than anyone can see, and the file is served over mobile data, so
    a key is kept only where dropping it would visibly bend the curve. The
    tolerance is in quaternion units, where 0.01 is about half a degree.
    """
    removed = 0
    for fcurve in action_fcurves(action):
        points = fcurve.keyframe_points
        if len(points) < 3:
            continue

        keep = [0]
        for index in range(1, len(points) - 1):
            previous = points[keep[-1]]
            following = points[index + 1]
            span = following.co[0] - previous.co[0]
            if span <= 0:
                keep.append(index)
                continue
            share = (points[index].co[0] - previous.co[0]) / span
            straight = previous.co[1] + (following.co[1] - previous.co[1]) * share
            if abs(points[index].co[1] - straight) > tolerance:
                keep.append(index)
        keep.append(len(points) - 1)

        drop = sorted(set(range(len(points))) - set(keep), reverse=True)
        for index in drop:
            points.remove(points[index])
            removed += 1
        fcurve.update()
    return removed


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    repo_root = argv[0] if argv else os.getcwd()
    fbx_dir = argv[1] if len(argv) > 1 else r"D:\Blender\mixamo\download"

    bpy.ops.wm.read_factory_settings(use_empty=True)

    rig = None
    report = {"clips": [], "skipped": []}

    for path in sorted(glob.glob(os.path.join(fbx_dir, "*.fbx"))):
        stem = os.path.splitext(os.path.basename(path))[0]
        if stem in SKIP or stem not in CLIPS:
            report["skipped"].append(stem)
            continue

        before = set(bpy.data.actions.keys())
        before_objects = set(bpy.data.objects.keys())
        bpy.ops.import_scene.fbx(filepath=path)

        added = [bpy.data.objects[k] for k in set(bpy.data.objects.keys()) - before_objects]
        imported_rig = next((o for o in added if o.type == "ARMATURE"), None)
        actions = [bpy.data.actions[k] for k in set(bpy.data.actions.keys()) - before]
        if imported_rig is None or not actions:
            report["skipped"].append(f"{stem} (no rig or action)")
            continue

        action = actions[0]
        action.name = CLIPS[stem]
        # Kept alive with no user, so the exporter still sees it after the
        # armature it arrived on is deleted.
        action.use_fake_user = True
        dropped = trim(action)
        thinned = decimate(action)

        # The first file with the full skeleton becomes the one the clips are
        # exported against; the rest only ever contribute their action.
        if rig is None and len(imported_rig.data.bones) == 65:
            rig = imported_rig
            imported_rig = None

        for obj in added:
            if obj is not imported_rig and obj is not rig:
                bpy.data.objects.remove(obj, do_unlink=True)
        if imported_rig is not None and imported_rig is not rig:
            bpy.data.objects.remove(imported_rig, do_unlink=True)

        report["clips"].append(
            {
                "name": action.name,
                "frames": [round(v, 1) for v in action.frame_range],
                "dropped_location_curves": dropped,
                "keys_removed": thinned,
            }
        )

    if rig is None:
        raise RuntimeError("no 65-bone armature found among the clips")

    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig

    out = os.path.join(repo_root, "assets", "source", "avatar-animations.glb")
    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_bake_animation=True,
        export_optimize_animation_size=True,
        export_yup=True,
        export_rest_position_armature=True,
    )

    report["bytes"] = os.path.getsize(out)
    report["path"] = out
    print("AVATAR_ANIMATIONS " + json.dumps(report))


if __name__ == "__main__":
    main()
