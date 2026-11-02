"""Generates crisp 4096x2048 top-printed keycap legend texture atlases using authentic wasd.blend fonts.

Produces:
    - public/textures/keycaps/top-legends-60.png
    - public/textures/keycaps/top-legends-75.png
    - public/textures/keycaps/top-legends-100.png

Format: RGBA (Pure white glyphs with anti-aliased alpha on transparent background).
Zero dark halo to allow clean tinting via Three.js mat.color.
Uses exact 3D top-dish bounding-box centroids extracted from GLTF keycap geometry,
stamped with authentic glyph patches cropped directly from wasd.blend (wasd_legend.png, 10800x3600).
"""

import os
import sys
import json
import subprocess


def get_layout_legends_60():
    """Returns row-by-row legends for 60% ANSI keyboard (61 keys)."""
    return [
        # Row 1 (14 keys)
        ["ESC", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "=", "BACK"],
        # Row 2 (14 keys)
        ["TAB", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", "\\"],
        # Row 3 (13 keys)
        ["CAPS", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", "ENTER"],
        # Row 4 (12 keys)
        ["SHIFT", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "SHIFT"],
        # Row 5 (8 keys)
        ["CTRL", "WIN", "ALT", "SPACE", "ALT", "FN", "MENU", "CTRL"],
    ]


def get_layout_legends_75():
    """Returns row-by-row legends for 75% compact keyboard (81 keys)."""
    return [
        # Row 0 (F-row, 14 keys)
        ["ESC", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12", "DEL"],
        # Row 1 (15 keys)
        ["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "=", "BACK", "PGUP"],
        # Row 2 (15 keys)
        ["TAB", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", "\\", "PGDN"],
        # Row 3 (14 keys)
        ["CAPS", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", "ENTER", "HOME"],
        # Row 4 (14 keys)
        ["SHIFT", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "SHIFT", "▲", "END"],
        # Row 5 (9 keys)
        ["CTRL", "WIN", "ALT", "SPACE", "ALT", "FN", "◄", "▼", "►"],
    ]


def get_layout_legends_100():
    """Returns row-by-row legends for 100% full-size keyboard (101 keycaps)."""
    return [
        # Row 0 (17 keys: F-row + 3 top nav: PrtSc, ScrLk, Pause)
        ["ESC", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12", "DEL", "PRT", "SCR", "PAU"],
        # Row 1 (19 keys: Number row + nav + 4 numpad)
        ["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "=", "BACK", "PGUP", "NUM", "/", "*", "-"],
        # Row 2 (18 keys: Tab row + nav + 3 numpad)
        ["TAB", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", "\\", "PGDN", "NUM_7", "NUM_8", "NUM_9"],
        # Row 3 (1 key: 2u vertical Numpad +)
        ["+"],
        # Row 4 (17 keys: Caps row + nav + 3 numpad)
        ["CAPS", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", "ENTER", "HOME", "NUM_4", "NUM_5", "NUM_6"],
        # Row 5 (17 keys: Shift row + arrows + 3 numpad)
        ["SHIFT", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "SHIFT", "▲", "END", "NUM_1", "NUM_2", "NUM_3"],
        # Row 6 (1 key: 2u vertical Numpad Enter)
        ["ENT"],
        # Row 7 (11 keys: Bottom row + arrows + 2 numpad: 2u 0 and .)
        ["CTRL", "WIN", "ALT", "SPACE", "ALT", "FN", "◄", "▼", "►", "NUM_0", "NUM_DOT"],
    ]


def extract_dish_data_with_blender(project_root):
    """Extracts top-dish centroids for 60%, 75%, and 100% layouts via Blender API."""
    import bpy
    import bmesh

    layouts = [
        ("60", "public/models/keyboard-60.glb", 61),
        ("75", "public/models/exploded-keyboard.glb", 81),
        ("100", "public/models/keyboard-100.glb", 101),
    ]

    extracted = {}
    for layout_code, rel_glb, expected_keys in layouts:
        glb_path = os.path.join(project_root, rel_glb)
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=glb_path)
        obj = bpy.data.objects.get("Layer_Keycaps")
        if not obj:
            raise RuntimeError(f"Layer_Keycaps not found in {glb_path}")

        min_x = float(min(v.co.x for v in obj.data.vertices))
        max_x = float(max(v.co.x for v in obj.data.vertices))
        min_z = float(min(-v.co.y for v in obj.data.vertices))
        max_z = float(max(-v.co.y for v in obj.data.vertices))

        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0001)

        visited_verts = set()
        islands = []
        for v in bm.verts:
            if v in visited_verts:
                continue
            island_verts = []
            queue = [v]
            visited_verts.add(v)
            for qv in queue:
                island_verts.append(qv)
                for e in qv.link_edges:
                    ov = e.other_vert(qv)
                    if ov not in visited_verts:
                        visited_verts.add(ov)
                        queue.append(ov)
            islands.append(island_verts)

        keycaps = []
        for isl in islands:
            if len(isl) <= 150:
                continue
            faces = set()
            for v in isl:
                faces.update(v.link_faces)
            mat_names = [
                obj.data.materials[f.material_index].name.lower()
                for f in faces
                if f.material_index < len(obj.data.materials) and obj.data.materials[f.material_index]
            ]
            if any("engraving" in m for m in mat_names):
                continue
            top_faces = [f for f in faces if f.normal.z > 0.85]
            if len(top_faces) > 20:
                top_verts = set()
                for f in top_faces:
                    top_verts.update(f.verts)
                dish_min_x = float(min(v.co.x for v in top_verts))
                dish_max_x = float(max(v.co.x for v in top_verts))
                dish_cx = float((dish_min_x + dish_max_x) / 2.0)
                dish_cz = float((min(-v.co.y for v in top_verts) + max(-v.co.y for v in top_verts)) / 2.0)
                dish_w = float(dish_max_x - dish_min_x)
                keycaps.append({"dish_cx": round(dish_cx, 6), "dish_cz": round(dish_cz, 6), "dish_w": round(dish_w, 6)})

        sorted_kc = sorted(keycaps, key=lambda k: k["dish_cz"])
        row_clusters = []
        current_cluster = []
        last_z = None
        for k in sorted_kc:
            if last_z is None or abs(k["dish_cz"] - last_z) < 0.008:
                current_cluster.append(k)
                last_z = k["dish_cz"]
            else:
                row_clusters.append(current_cluster)
                current_cluster = [k]
                last_z = k["dish_cz"]
        if current_cluster:
            row_clusters.append(current_cluster)

        sorted_rows = []
        for r in row_clusters:
            sorted_rows.append(sorted(r, key=lambda k: k["dish_cx"]))

        extracted[layout_code] = {
            "bounds": [round(min_x, 6), round(max_x, 6), round(min_z, 6), round(max_z, 6)],
            "total_keys": len(keycaps),
            "rows": sorted_rows,
        }
        print(f"Blender extraction [{layout_code}%]: {len(keycaps)} keys across {len(sorted_rows)} rows (expected {expected_keys})")

    return extracted


_CACHED_GLYPH_REGISTRY = None


def load_glyph_registry(project_root):
    """Loads authentic 3D model glyph patches cropped directly from wasd.blend (wasd_legend.png)."""
    global _CACHED_GLYPH_REGISTRY
    if _CACHED_GLYPH_REGISTRY is not None:
        return _CACHED_GLYPH_REGISTRY

    from PIL import Image

    scratch_dir = r"C:\Users\Admin\.gemini\antigravity\brain\95729736-3db8-41b8-bc10-74a212909a42\scratch"
    wasd_path = os.path.join(scratch_dir, "wasd_legend.png")
    if not os.path.exists(wasd_path):
        wasd_path = os.path.join(project_root, "public", "textures", "keycaps", "legends-crisp-light.png")

    wasd_img = Image.open(wasd_path)
    wasd_alpha = wasd_img.split()[3]

    # Exact verified bounding boxes in 10800x3600 wasd_legend.png
    boxes = {
        # F-row & top nav
        "ESC": (342, 408, 474, 471),
        "F1": (1246, 408, 1322, 471),
        "F2": (1696, 408, 1782, 471),
        "F3": (2145, 408, 2233, 471),
        "F4": (2595, 408, 2682, 471),
        "F5": (3268, 408, 3356, 471),
        "F6": (3718, 408, 3805, 471),
        "F7": (4168, 408, 4255, 471),
        "F8": (4618, 408, 4705, 471),
        "F9": (5291, 408, 5378, 471),
        "F10": (5740, 408, 5874, 471),
        "F11": (6190, 408, 6306, 471),
        "F12": (6640, 408, 6773, 471),
        "PRT": (7218, 408, 7414, 471),
        "SCR": (7662, 408, 7870, 471),
        "PAU": (8102, 408, 8329, 562),
        # Number row & nav & numpad
        "`": (345, 994, 389, 1157),
        "~": (345, 994, 389, 1157),
        "1": (794, 970, 821, 1218),
        "2": (1243, 970, 1340, 1218),
        "3": (1693, 970, 1747, 1218),
        "4": (2142, 965, 2193, 1218),
        "5": (2593, 970, 2675, 1218),
        "6": (3042, 970, 3090, 1218),
        "7": (3492, 970, 3555, 1218),
        "8": (3942, 970, 3990, 1218),
        "9": (4392, 970, 4439, 1218),
        "0": (4842, 970, 4889, 1218),
        "-": (5290, 1042, 5348, 1199),
        "=": (5746, 984, 5794, 1197),
        "BACK": (6199, 1064, 6736, 1141),
        "BACKSPACE": (6199, 1064, 6736, 1141),
        "INS": (7210, 1064, 7422, 1218),
        "HOME": (7660, 1064, 7872, 1218),
        "PGUP": (8110, 1017, 8321, 1218),
        "NUM": (8680, 1017, 8850, 1172),
        "/": (9131, 1063, 9158, 1138),
        "*": (9581, 1063, 9613, 1095),
        "NUM_MINUS": (10032, 1109, 10059, 1119),
        # QWERTY row
        "TAB": (342, 1502, 585, 1587),
        "Q": (1019, 1422, 1106, 1521),
        "W": (1469, 1422, 1584, 1512),
        "E": (1919, 1422, 1986, 1512),
        "R": (2368, 1422, 2447, 1512),
        "T": (2818, 1422, 2890, 1512),
        "Y": (3269, 1422, 3350, 1512),
        "U": (3718, 1422, 3789, 1514),
        "I": (4168, 1422, 4181, 1512),
        "O": (4618, 1422, 4704, 1515),
        "P": (5067, 1422, 5136, 1512),
        "[": (5518, 1420, 5548, 1688),
        "]": (5967, 1420, 5997, 1688),
        "\\": (6421, 1420, 6449, 1669),
        "DEL": (7200, 1514, 7432, 1668),
        "DELETE": (7200, 1514, 7432, 1668),
        "END": (7660, 1514, 7872, 1668),
        "PGDN": (8110, 1467, 8321, 1668),
        "NUM_7": (8680, 1422, 8893, 1668),
        "NUM_8": (9130, 1422, 9190, 1668),
        "NUM_9": (9580, 1422, 9779, 1685),
        "+": (10030, 1746, 10078, 1794),
        # ASDF row
        "CAPS": (342, 1940, 847, 2049),
        "CAPSLOCK": (342, 1940, 847, 2049),
        "A": (1132, 1872, 1215, 1962),
        "S": (1581, 1872, 1653, 1965),
        "D": (2031, 1872, 2105, 1962),
        "F": (2481, 1872, 2542, 1962),
        "G": (2931, 1872, 3014, 1965),
        "H": (3380, 1872, 3451, 1962),
        "J": (3830, 1872, 3880, 1964),
        "K": (4280, 1872, 4354, 1962),
        "L": (4730, 1872, 4786, 1962),
        ";": (5186, 1888, 5199, 2131),
        "'": (5632, 1872, 5664, 2079),
        "ENTER": (6083, 1956, 6428, 2038),
        "NUM_4": (8677, 1872, 8761, 2118),
        "NUM_5": (9131, 1872, 9190, 1962),
        "NUM_6": (9580, 1872, 9664, 2118),
        # ZXCV row
        "SHIFT": (342, 2390, 623, 2499),
        "Z": (1357, 2322, 1428, 2412),
        "X": (1807, 2322, 1888, 2412),
        "C": (2256, 2322, 2336, 2415),
        "V": (2707, 2322, 2788, 2412),
        "B": (3156, 2322, 3224, 2412),
        "N": (3606, 2322, 3677, 2412),
        "M": (4055, 2322, 4142, 2412),
        ",": (4508, 2329, 4550, 2581),
        ".": (4958, 2329, 4999, 2568),
        # Bottom row & arrows & numpad bottom
        "RSHIFT": (5853, 2390, 6133, 2499),
        "▲": (7662, 2390, 7714, 2499),
        "UP": (7662, 2390, 7714, 2499),
        "NUM_1": (8680, 2322, 8817, 2568),
        "NUM_2": (9127, 2322, 9190, 2568),
        "NUM_3": (9580, 2322, 9777, 2585),
        "ENT": (10030, 2639, 10224, 2700),
        "CTRL": (347, 2863, 467, 2926),
        "WIN": (1000, 2828, 1133, 2961),
        "ALT": (1472, 2864, 1569, 2925),
        "RALT": (4846, 2864, 4943, 2925),
        "RWIN": (5499, 2828, 5632, 2961),
        "MENU": (5970, 2840, 6084, 2949),
        "FN": (6200, 2957, 6286, 3018),
        "RCTRL": (6533, 2863, 6653, 2926),
        "◄": (7211, 2867, 7320, 2922),
        "LEFT": (7211, 2867, 7320, 2922),
        "▼": (7661, 2840, 7714, 2949),
        "DOWN": (7661, 2840, 7714, 2949),
        "►": (8110, 2867, 8219, 2922),
        "RIGHT": (8110, 2867, 8219, 2922),
        "NUM_0": (8680, 2772, 8781, 3018),
        "NUM_DOT": (9580, 2849, 9694, 3018),
    }

    registry = {}
    for name, box in boxes.items():
        patch = wasd_alpha.crop(box)
        bb = patch.getbbox()
        if bb:
            registry[name] = patch.crop(bb)
        else:
            registry[name] = patch

    _CACHED_GLYPH_REGISTRY = registry
    return registry


def render_atlas(dish_data, rows_legends, out_path, img_w=4096, img_h=2048, layout_code="75", project_root=None):
    """Renders transparent RGBA atlas with clean white top-dish authentic glyphs from wasd.blend."""
    from PIL import Image

    if project_root is None:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.abspath(os.path.join(script_dir, ".."))

    registry = load_glyph_registry(project_root)

    img = Image.new("RGBA", (img_w, img_h), (0, 0, 0, 0))

    min_x, max_x, min_z, max_z = dish_data["bounds"]
    span_x = max_x - min_x
    span_z = max_z - min_z
    rows = dish_data["rows"]

    # In wasd.blend layout sheet, 1u keycap pitch is 450 px.
    # In the target atlas, a 1u keycap is (0.01905 / span_x) * img_w pixels.
    # We apply a UNIFORM scale factor across all glyphs so typographic hierarchy and relative
    # sizes (e.g. single letters vs punctuation vs minus vs dual legends) are preserved without distortion.
    pixels_per_1u = (0.01905 / span_x) * img_w
    base_scale = pixels_per_1u / 450.0

    for r_idx, row_keys in enumerate(rows):
        legends = rows_legends[r_idx] if r_idx < len(rows_legends) else [""] * len(row_keys)

        for s_idx, k in enumerate(row_keys):
            label = legends[s_idx] if s_idx < len(legends) else ""
            if not label or label == "SPACE":
                continue

            # Compute pixel center on atlas
            u = (k["dish_cx"] - min_x) / span_x
            v_inv = (k["dish_cz"] - min_z) / span_z
            px = int(round(u * (img_w - 1)))
            py = int(round(v_inv * (img_h - 1)))

            glyph_alpha = registry.get(label)
            if glyph_alpha is None:
                continue

            gw, gh = glyph_alpha.size

            # Compute keycap dish width in atlas pixels
            dish_w = k.get("dish_w", 0.01905)
            dish_w_px = (dish_w / span_x) * img_w

            # Uniform scale factor: clamped only if wide modifier word exceeds 78% of keycap dish width
            scale = base_scale
            if gw * scale > 0.78 * dish_w_px:
                scale = (0.78 * dish_w_px) / float(gw)

            sw = max(1, int(round(gw * scale)))
            sh = max(1, int(round(gh * scale)))
            scaled_alpha = glyph_alpha.resize((sw, sh), Image.Resampling.LANCZOS)

            # Pure white dye-sub glyph with anti-aliased alpha (zero dark halo!)
            white_patch = Image.new("RGBA", (sw, sh), (255, 255, 255, 255))
            white_patch.putalpha(scaled_alpha)

            tx = px - sw // 2
            ty = py - sh // 2
            img.paste(white_patch, (tx, ty), mask=white_patch)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    img.save(out_path, "PNG")
    print(f"Saved top-legend atlas [{layout_code}%]: {out_path} ({os.path.getsize(out_path):,} bytes, size={img_w}x{img_h})")


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))
    out_dir = os.path.join(project_root, "public", "textures", "keycaps")

    # If receiving pre-extracted JSON from stdin
    if "--render-from-json" in sys.argv:
        all_dish_data = json.load(sys.stdin)
        render_atlas(all_dish_data["60"], get_layout_legends_60(), os.path.join(out_dir, "top-legends-60.png"), img_w=4096, img_h=2048, layout_code="60", project_root=project_root)
        render_atlas(all_dish_data["75"], get_layout_legends_75(), os.path.join(out_dir, "top-legends-75.png"), img_w=4096, img_h=2048, layout_code="75", project_root=project_root)
        render_atlas(all_dish_data["100"], get_layout_legends_100(), os.path.join(out_dir, "top-legends-100.png"), img_w=4096, img_h=2048, layout_code="100", project_root=project_root)
        return

    # If running inside Blender, extract centroids
    if "bpy" in sys.modules:
        dish_data = extract_dish_data_with_blender(project_root)
        json_output = json.dumps(dish_data)
        print("BLENDER_DISH_DATA_START")
        print(json_output)
        print("BLENDER_DISH_DATA_END")

        if "--extract-only" not in sys.argv:
            py_bin = "python"
            py_proc = subprocess.run(
                [py_bin, __file__, "--render-from-json"],
                input=json_output,
                text=True,
                capture_output=True,
                cwd=project_root,
            )
            print(py_proc.stdout)
            if py_proc.returncode != 0:
                print(py_proc.stderr)
        return

    # If running in regular Python, extract dish centroids via Blender
    blender_bin = r"D:\Blender\blender.exe"
    if not os.path.exists(blender_bin):
        blender_bin = "blender"

    print(f"Extracting exact top-dish centroids via Blender ({blender_bin})...")
    cmd = [blender_bin, "--background", "--python", __file__, "--", "--extract-only"]
    result = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd=project_root,
    )
    if result.returncode != 0:
        print(result.stderr)
        raise RuntimeError(f"Blender extraction failed with exit code {result.returncode}")

    stdout = result.stdout
    start_tag = "BLENDER_DISH_DATA_START"
    end_tag = "BLENDER_DISH_DATA_END"
    start_idx = stdout.find(start_tag)
    end_idx = stdout.find(end_tag)
    if start_idx == -1 or end_idx == -1:
        raise RuntimeError("Failed to locate BLENDER_DISH_DATA in Blender output:\n" + stdout[:500])

    json_str = stdout[start_idx + len(start_tag):end_idx].strip()
    all_dish_data = json.loads(json_str)

    # 1. 60% Layout (61 keys)
    render_atlas(
        all_dish_data["60"],
        get_layout_legends_60(),
        os.path.join(out_dir, "top-legends-60.png"),
        img_w=4096,
        img_h=2048,
        layout_code="60",
        project_root=project_root,
    )

    # 2. 75% Layout (81 keys)
    render_atlas(
        all_dish_data["75"],
        get_layout_legends_75(),
        os.path.join(out_dir, "top-legends-75.png"),
        img_w=4096,
        img_h=2048,
        layout_code="75",
        project_root=project_root,
    )

    # 3. 100% Layout (101 keys)
    render_atlas(
        all_dish_data["100"],
        get_layout_legends_100(),
        os.path.join(out_dir, "top-legends-100.png"),
        img_w=4096,
        img_h=2048,
        layout_code="100",
        project_root=project_root,
    )


if __name__ == "__main__":
    main()
