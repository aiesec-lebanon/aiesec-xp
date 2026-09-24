# Builds STUDIO's typefaces (D-48) into lib/design/faces/, which next/font/local
# serves -- so a build never fetches from Google Fonts (D-67). Each family comes
# from google/fonts at one pinned commit, next to its licence.
#
#   pip install "fonttools[woff]"
#   python scripts/assets/build-faces.py

import os
import urllib.request
from io import BytesIO

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

GOOGLE_FONTS_COMMIT = "23e54b51ddffbc7713c583748e3bd86f62b1fa4a"

# (family directory in google/fonts, source file, output file, axes to pin)
FACES = [
    ("ofl/fredoka", "Fredoka[wdth,wght].ttf", "fredoka.woff2", {"wdth": 100}),
    ("ofl/figtree", "Figtree[wght].ttf", "figtree.woff2", {}),
    ("ofl/baloo2", "Baloo2[wght].ttf", "baloo2.woff2", {}),
    ("ofl/spacemono", "SpaceMono-Regular.ttf", "space-mono-regular.woff2", {}),
    ("ofl/spacemono", "SpaceMono-Bold.ttf", "space-mono-bold.woff2", {}),
]

# Google's latin and latin-ext ranges merged into one file, because next/font/local
# cannot give each file of a family its own unicode-range the way Google's CSS does.
UNICODES = (
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,"
    "U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD,"
    "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,"
    "U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,"
    "U+A720-A7FF"
)


def fetch(family_dir, name):
    url = f"https://raw.githubusercontent.com/google/fonts/{GOOGLE_FONTS_COMMIT}/{family_dir}/{name}"
    with urllib.request.urlopen(url) as response:
        return response.read()


def build(family_dir, source, pinned_axes):
    font = TTFont(BytesIO(fetch(family_dir, source)))
    if pinned_axes:
        font = instancer.instantiateVariableFont(font, pinned_axes)

    options = subset.Options()
    options.flavor = "woff2"
    # Keep every OpenType feature: the scores lean on tabular figures.
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=subset.parse_unicodes(UNICODES))
    subsetter.subset(font)
    return font, options


def main():
    root = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", ".."))
    out = os.path.join(root, "lib", "design", "faces")
    os.makedirs(out, exist_ok=True)

    for family_dir, source, target, pinned_axes in FACES:
        font, options = build(family_dir, source, pinned_axes)
        path = os.path.join(out, target)
        subset.save_font(font, path, options)
        print(f"{target} {round(os.path.getsize(path) / 1024)}kB")

    for family_dir in sorted({face[0] for face in FACES}):
        family = family_dir.split("/")[-1]
        with open(os.path.join(out, f"{family}.OFL.txt"), "wb") as licence:
            licence.write(fetch(family_dir, "OFL.txt"))


if __name__ == "__main__":
    main()
