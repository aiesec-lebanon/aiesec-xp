# blender -b <characters_working.blend> -P scripts/assets/avatar-animations.py -- <repo-root> <fbx-dir>

import glob
import json
import os
import sys
import tempfile

import bpy

CLIPS = {
    # Ambient
    "Breathing Idle": "idle-breathing",
    "Happy Idle": "idle-happy",
    "Happy Idle (1)": "idle-happy-2",
    "Look Around Idle": "idle-look-around",
    "Arm Stretching Idle": "idle-stretch",
    "Neck Stretching": "idle-neck-stretch",
    "Bored": "idle-bored",
    # Transitions
    "Start Walking": "walk-start",
    "Walking": "walk",
    "Stop Walking": "walk-stop",
    "Left Turn 90": "turn-left",
    "Right Turn 90": "turn-right",
    # Addressed to the member
    "Waving": "wave",
    "Acknowledging": "acknowledge",
    "Standing Thumbs Up": "thumbs-up",
    "Salute": "salute",
    "Disappointed": "disappointed",
    "Pointing": "point",
    # Celebration
    "Cheering": "cheer",
    "Cheering (1)": "cheer-2",
    "Clapping": "clap",
    "Rallying": "rally",
    "Victory": "victory",
    "Hip Hop Dancing": "dance",
    "Silly Dancing": "dance-silly",
    "Silly Dancing (1)": "dance-silly-2",
    # Ambient idles that imply props the set does not have
    "Sitting Idle": "idle-sitting",
    "Sitting Idle (1)": "idle-sitting-2",
    "Warrior Idle": "idle-warrior",
    # One-shot played on save, not cycled
    "Catwalk Idle Twist R": "idle-catwalk",
    # Between two bodies standing near each other
    "Talking": "talk",
    "Talking (1)": "talk-2",
    "Talking (2)": "talk-3",
    "Talking (3)": "talk-4",
    "Agreeing": "agree",
    "Look Over Shoulder": "glance",
    "Telling A Secret": "secret",
}

# Superseded or duplicate clips.
SKIP = {
    # A turning cycle veers against the straight-line walk.
    "Walking Left Turn",
    "Walking Right Turn",
    "Looking Around Idle",
    "Arm Stretching",
    "Offensive Idle",
    "Jumping",
}

# Any rig works: all share a rest pose and only rotation is exported.
REFERENCE_RIG = "avatar-hoodie-cargo-rig"

# Split so pages that only need the core clips do not download the social ones.
LIBRARIES = {
    "avatar-animations": [
        "idle-breathing", "idle-happy", "idle-happy-2", "idle-look-around", "idle-stretch",
        "idle-neck-stretch", "idle-sitting", "idle-sitting-2", "idle-warrior",
        "walk", "walk-start", "walk-stop", "turn-left", "turn-right",
        "wave", "cheer", "cheer-2", "clap", "rally", "victory",
    ],
    "avatar-animations-social": [
        "idle-bored", "acknowledge", "thumbs-up", "salute", "disappointed", "point",
        "talk", "talk-2", "talk-3", "talk-4", "agree", "glance", "secret",
        "dance", "dance-silly", "dance-silly-2", "idle-catwalk",
    ],
}


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
    """Mixamo translations are in its own units and throw the hips far off once bound to our skeletons."""
    dropped = 0
    for fcurve in list(action_fcurves(action)):
        if fcurve.data_path.endswith("location"):
            remove_fcurve(action, fcurve)
            dropped += 1
    return dropped


def decimate(action, tolerance=0.01):
    """Drop keys a straight line already accounts for; tolerance 0.01 is about half a degree."""
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


def retarget(target, source, frame_start, frame_end):
    """Copy Rotation, not Copy Transforms: the skeletons differ in scale, so matching positions tears limbs."""
    for bone in target.pose.bones:
        if bone.name not in source.pose.bones:
            continue
        bone.rotation_mode = "QUATERNION"
        constraint = bone.constraints.new("COPY_ROTATION")
        constraint.target = source
        constraint.subtarget = bone.name
        constraint.target_space = "WORLD"
        constraint.owner_space = "WORLD"

    bpy.ops.object.select_all(action="DESELECT")
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.select_all(action="SELECT")
    bpy.ops.nla.bake(
        frame_start=int(frame_start),
        frame_end=int(frame_end),
        only_selected=False,
        visual_keying=True,
        clear_constraints=True,
        clear_parents=False,
        use_current_action=False,
        bake_types={"POSE"},
    )
    bpy.ops.object.mode_set(mode="OBJECT")

    baked = target.animation_data.action
    target.animation_data.action = None
    return baked


def write_library(source, path, names):
    """Orphaned accessors left behind are pruned by `npm run assets:models`."""
    with open(source, "rb") as handle:
        blob = handle.read()

    json_length = int.from_bytes(blob[12:16], "little")
    document = json.loads(blob[20 : 20 + json_length])
    rest = blob[20 + json_length :]

    wanted = set(names)
    document["animations"] = [a for a in document.get("animations", []) if a.get("name") in wanted]
    kept = [a["name"] for a in document["animations"]]

    encoded = json.dumps(document, separators=(",", ":")).encode("utf-8")
    encoded += b" " * ((4 - len(encoded) % 4) % 4)
    header = b"glTF" + (2).to_bytes(4, "little") + (12 + 8 + len(encoded) + len(rest)).to_bytes(4, "little")
    with open(path, "wb") as handle:
        handle.write(header + len(encoded).to_bytes(4, "little") + b"JSON" + encoded + rest)
    return kept


def rotation_only(path):
    """The exporter writes TRS channels regardless of the action; a zeroed translation overrides rest offsets."""
    with open(path, "rb") as handle:
        blob = handle.read()

    json_length = int.from_bytes(blob[12:16], "little")
    document = json.loads(blob[20 : 20 + json_length])
    rest = blob[20 + json_length :]

    removed = 0
    for animation in document.get("animations", []):
        keep = [c for c in animation["channels"] if c["target"]["path"] == "rotation"]
        removed += len(animation["channels"]) - len(keep)
        animation["channels"] = keep

    encoded = json.dumps(document, separators=(",", ":")).encode("utf-8")
    encoded += b" " * ((4 - len(encoded) % 4) % 4)
    header = b"glTF" + (2).to_bytes(4, "little") + (12 + 8 + len(encoded) + len(rest)).to_bytes(4, "little")
    with open(path, "wb") as handle:
        handle.write(header + len(encoded).to_bytes(4, "little") + b"JSON" + encoded + rest)
    return removed


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    # A relative path resolves against Blender's working directory, not the shell's.
    repo_root = os.path.abspath(argv[0] if argv else os.getcwd())
    fbx_dir = argv[1] if len(argv) > 1 else r"D:\Blender\mixamo\download"

    if bpy.context.object is not None and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")

    rig = bpy.data.objects[REFERENCE_RIG]
    report = {"clips": [], "skipped": [], "reference": REFERENCE_RIG}

    for path in sorted(glob.glob(os.path.join(fbx_dir, "*.fbx"))):
        stem = os.path.splitext(os.path.basename(path))[0]
        if stem in SKIP or stem not in CLIPS:
            report["skipped"].append(stem)
            continue

        before_actions = set(bpy.data.actions.keys())
        before_objects = set(bpy.data.objects.keys())
        bpy.ops.import_scene.fbx(filepath=path)

        added = [bpy.data.objects[k] for k in set(bpy.data.objects.keys()) - before_objects]
        source = next((o for o in added if o.type == "ARMATURE"), None)
        actions = [bpy.data.actions[k] for k in set(bpy.data.actions.keys()) - before_actions]
        if source is None or not actions:
            report["skipped"].append(f"{stem} (no rig or action)")
            continue

        original = actions[0]
        start, end = original.frame_range
        baked = retarget(rig, source, start, end)
        baked.name = CLIPS[stem]
        baked.use_fake_user = True

        dropped = trim(baked)
        thinned = decimate(baked)

        for obj in added:
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.actions.remove(original)

        report["clips"].append(
            {
                "name": baked.name,
                "frames": [round(v, 1) for v in baked.frame_range],
                "dropped_location_curves": dropped,
                "keys_removed": thinned,
            }
        )

    if not report["clips"]:
        raise RuntimeError("no clips were retargeted")

    # ACTIONS mode exports every action, including the .blend's bindpose actions.
    wanted = {clip["name"] for clip in report["clips"]}
    for action in list(bpy.data.actions):
        if action.name not in wanted:
            bpy.data.actions.remove(action)

    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig

    out = os.path.join(tempfile.gettempdir(), "avatar-animations-all.glb")
    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_bake_animation=False,
        export_optimize_animation_size=True,
        export_yup=True,
        export_rest_position_armature=True,
    )

    report["channels_removed"] = rotation_only(out)

    report["libraries"] = {}
    for name, clips in LIBRARIES.items():
        path = os.path.join(repo_root, "assets", "source", f"{name}.glb")
        kept = write_library(out, path, clips)
        report["libraries"][name] = {"clips": len(kept), "bytes": os.path.getsize(path)}
        missing = sorted(set(clips) - set(kept))
        if missing:
            report["libraries"][name]["missing"] = missing

    os.remove(out)
    print("AVATAR_ANIMATIONS " + json.dumps(report))


if __name__ == "__main__":
    main()
