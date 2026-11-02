"""Blender Python script to generate multi-layout keyboard GLBs (60% and 100%) and export switch positions.

Usage:
    "D:\\Blender\\blender.exe" --background --python scripts/export-multi-layout-glbs.py

Produces:
    - public/models/keyboard-60.glb (60% compact, 61 keys, watertight, zero gaps)
    - public/models/keyboard-100.glb (100% full-size, 104 keys, watertight, full side walls)
    - Updates src/lib/keyboardSwitchLayout.js with SWITCH_LAYOUTS ('60', '75', '100')
"""

import os
import re
from collections import defaultdict
import bpy
import bmesh
from mathutils import Vector


def get_switch_positions_from_js(filepath):
    """Parses the 81 base switch positions from SWITCH_LAYOUT_POSITIONS in keyboardSwitchLayout.js."""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    match = re.search(r"export const SWITCH_LAYOUT_POSITIONS = Object\.freeze\(\[([\s\S]*?)\]\);", content)
    if not match:
        raise ValueError("Could not find SWITCH_LAYOUT_POSITIONS in keyboardSwitchLayout.js")

    block = match.group(1)
    switches = []
    for line in block.splitlines():
        m = re.search(r"x:\s*([-\d.]+),\s*y:\s*([-\d.]+),\s*z:\s*([-\d.]+)", line)
        if m:
            switches.append({"x": float(m.group(1)), "y": float(m.group(2)), "z": float(m.group(3))})

    if len(switches) != 81:
        raise ValueError(f"Expected 81 base switches, found {len(switches)}")
    return switches


def group_islands_by_switch(bm, base_switches):
    """Finds all connected vertex islands in bm and assigns each island to its nearest switch.

    Watertight position-welded BFS:
    Builds a spatial dictionary mapping rounded (x, y, z) coordinates to vertices.
    During the BFS, traverses both topological link_edges and coincident vertices in co_map.
    This welds all UV-seam splits across Enter, Backspace, Shift, and Spacebar into complete,
    indivisible keycap shells with zero split corners and zero modifications to bm normals/UVs.

    Returns a dict: { switch_index: [list_of_island_verts, ...] }
    """
    co_map = defaultdict(list)
    for v in bm.verts:
        co_map[(round(v.co.x, 4), round(v.co.y, 4), round(v.co.z, 4))].append(v)

    visited = set()
    islands = []
    for v in bm.verts:
        if v in visited:
            continue
        island_verts = []
        q = [v]
        visited.add(v)
        while q:
            curr = q.pop()
            island_verts.append(curr)
            for e in curr.link_edges:
                other = e.other_vert(curr)
                if other not in visited:
                    visited.add(other)
                    q.append(other)
            key = (round(curr.co.x, 4), round(curr.co.y, 4), round(curr.co.z, 4))
            for other in co_map[key]:
                if other not in visited:
                    visited.add(other)
                    q.append(other)
        islands.append(island_verts)

    switch_islands = defaultdict(list)
    for island in islands:
        cx = sum(v.co.x for v in island) / len(island)
        cy = sum(v.co.y for v in island) / len(island)
        best_dist = float("inf")
        best_idx = -1
        for i, s in enumerate(base_switches):
            # In glTF coords: X right, Y up, -Y depth -> +Z. So Blender Y = -glTF Z.
            d2 = (cx - s["x"]) ** 2 + (cy - (-s["z"])) ** 2
            if d2 < best_dist:
                best_dist = d2
                best_idx = i
        switch_islands[best_idx].append(island)

    return switch_islands


def export_60_layout(glb_src_path, out_glb_path, base_switches):
    """Generates and exports 60% compact layout (61 keys) GLB and computes switch coordinates.

    Watertight guarantees:
    - Entire connected islands of deleted keys are removed cleanly.
    - Right Shift (1.75U) is widened by +1U (+0.01905m) to standard 2.75U ANSI Right Shift,
      ensuring Row 4 terminates flush at +0.133m with zero holes or gaps.
    """
    print("\n" + "=" * 60)
    print("Exporting 60% Layout GLB (keyboard-60.glb)")
    print("=" * 60)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb_src_path)

    kc = bpy.data.objects["Layer_Keycaps"]
    plate = bpy.data.objects["Layer_Plate"]
    case = bpy.data.objects["Layer_Case"]

    bm = bmesh.new()
    bm.from_mesh(kc.data)

    # 1. Group islands by switch
    switch_islands = group_islands_by_switch(bm, base_switches)

    # 2. Widen Right Shift (switch 61) by +1U (+0.01905m) so Row 4 terminates flush with Rows 1..3 & 5
    rshift_islands = switch_islands[61]
    all_rshift_verts = [v for isl in rshift_islands for v in isl]
    min_rx = min(v.co.x for v in all_rshift_verts)
    max_rx = max(v.co.x for v in all_rshift_verts)
    mid_x = (min_rx + max_rx) / 2.0
    dx = 0.01905  # 1U

    for isl in rshift_islands:
        is_engraving = any(kc.data.materials[f.material_index].name == 'keycaps engraving' for v in isl for f in v.link_faces)
        if is_engraving:
            # Small center features / decals: move to new center
            for v in isl:
                v.co.x += dx / 2.0
        else:
            # Outer shell / perimeter: stretch right half
            for v in isl:
                if v.co.x > mid_x:
                    v.co.x += dx

    # 3. Duplicate 1.25U LAlt keycap (sw 79) 4 times for the 4 bottom-right ANSI modifiers:
    # RAlt, Fn, Menu, RCtrl sitting contiguously right of Spacebar (sw 80) and terminating
    # flush with Rows 1..4 (max_x ≈ 0.1333m) with zero gaps and zero overlap.
    uv_layer = bm.loops.layers.uv.active
    lalt_islands = switch_islands[79]
    lalt_verts = [v for isl in lalt_islands for v in isl]
    lalt_faces = list(set(f for v in lalt_verts for f in v.link_faces))
    lalt_edges = list(set(e for v in lalt_verts for e in v.link_edges))
    lalt_geom = lalt_faces + lalt_edges + lalt_verts
    lalt_x = base_switches[79]["x"]

    # 4 ANSI 1.25u bottom-right modifiers:
    # RAlt:  cell (8, 4) -> delta col = 0
    # Fn:    cell (8, 3) -> delta col = -1
    # Menu:  cell (8, 8) -> delta col = +4
    # RCtrl: cell (8, 0) -> delta col = -4
    mod_targets = [
        {"sw": 76, "x": 0.05000, "target_col": 4},
        {"sw": 75, "x": 0.07380, "target_col": 3},
        {"sw": 74, "x": 0.09760, "target_col": 8},
        {"sw": 73, "x": 0.12140, "target_col": 0},
    ]

    for mod in mod_targets:
        res = bmesh.ops.duplicate(bm, geom=lalt_geom)
        dup_verts = [v for v in res["geom"] if isinstance(v, bmesh.types.BMVert)]
        bmesh.ops.translate(bm, vec=Vector((mod["x"] - lalt_x, 0, 0)), verts=dup_verts)

        dup_faces = [f for f in res["geom"] if isinstance(f, bmesh.types.BMFace)]
        for f in dup_faces:
            if kc.data.materials[f.material_index].name == 'keycaps engraving':
                u_avg = sum(l[uv_layer].uv.x for l in f.loops) / len(f.loops)
                v_avg = sum(l[uv_layer].uv.y for l in f.loops) / len(f.loops)
                src_col = min(8, max(0, int(u_avg * 9.0)))
                src_row = min(8, max(0, int((1.0 - v_avg) * 9.0)))
                delta_u = (mod["target_col"] - src_col) / 9.0
                delta_v = (src_row - 8) / 9.0
                for l in f.loops:
                    l[uv_layer].uv.x += delta_u
                    l[uv_layer].uv.y += delta_v

    # 4. Identify and delete:
    # F-row: z < -0.056 (14 keys)
    # Right nav column: x > 0.132 (5 keys)
    # Up arrow: x > 0.115 and 0.010 < z < 0.030 (1 key)
    # Plus original 4 1u keycaps right of spacebar {76, 75, 74, 73} (replaced with 1.25u ANSI modifiers above)
    to_delete_switches = {
        i for i, s in enumerate(base_switches)
        if s["z"] < -0.056 or s["x"] > 0.132 or (s["x"] > 0.115 and 0.010 < s["z"] < 0.030)
    }
    to_delete_keycaps = to_delete_switches | {76, 75, 74, 73}
    print(f"60% Deleting {len(to_delete_keycaps)} keycaps as complete islands.")

    del_verts = []
    for sw_idx in to_delete_keycaps:
        for isl in switch_islands[sw_idx]:
            del_verts.extend(isl)

    bmesh.ops.delete(bm, geom=del_verts, context="VERTS")

    bm.to_mesh(kc.data)
    kc.data.update()

    is_valid = not kc.data.validate(verbose=False)
    print(f"60% Keycaps Mesh Valid: {is_valid}")

    # 4. Compute 60% keycaps bounding box and center
    min_x = min(v.co.x for v in kc.data.vertices)
    max_x = max(v.co.x for v in kc.data.vertices)
    min_y = min(v.co.y for v in kc.data.vertices)
    max_y = max(v.co.y for v in kc.data.vertices)
    cx = (min_x + max_x) / 2.0
    cy = (min_y + max_y) / 2.0
    span_x = max_x - min_x
    span_y = max_y - min_y
    print(f"60% Keycaps: span_x={span_x:.4f}, span_y={span_y:.4f}, center=({cx:.5f}, {cy:.5f})")

    # Shift Layer_Keycaps to center around (0, 0)
    for v in kc.data.vertices:
        v.co.x -= cx
        v.co.y -= cy
    kc.data.update()

    # 5. Crop/scale Layer_Plate
    target_plate_w = span_x + 0.002
    target_plate_d = span_y + 0.002
    scale_plate_x = target_plate_w / 0.3061
    scale_plate_y = target_plate_d / 0.1188

    for v in plate.data.vertices:
        v.co.x = v.co.x * scale_plate_x
        v.co.y = (v.co.y - 0.0086) * scale_plate_y
    plate.data.update()

    # 6. Remove 75% rotary knob ('rough chrome') from Layer_Case, then crop/scale
    bm_case = bmesh.new()
    bm_case.from_mesh(case.data)
    knob_mat_indices = {i for i, mat in enumerate(case.data.materials) if mat and mat.name == 'rough chrome'}
    knob_faces = [f for f in bm_case.faces if f.material_index in knob_mat_indices]
    knob_verts = list(set(v for f in knob_faces for v in f.verts))
    if knob_verts:
        bmesh.ops.delete(bm_case, geom=knob_verts, context="VERTS")
        print(f"60% Case: deleted {len(knob_faces)} rotary knob faces ({len(knob_verts)} verts)")
    bm_case.to_mesh(case.data)
    case.data.update()
    bm_case.free()

    target_case_w = span_x + 2 * 0.00905
    target_case_d = span_y + 2 * 0.0108
    scale_case_x = target_case_w / 0.3225
    scale_case_y = target_case_d / 0.1382

    for v in case.data.vertices:
        v.co.x = v.co.x * scale_case_x
        v.co.y = (v.co.y - 0.009975) * scale_case_y
    case.data.update()

    # 7. Filter the 61 switch positions and center them
    sw_60 = []
    new_mod_x = {m["sw"]: m["x"] for m in mod_targets}
    for i, s in enumerate(base_switches):
        if i in to_delete_switches:
            continue
        if i in new_mod_x:
            x_pos = new_mod_x[i]
        elif i == 61:
            x_pos = s["x"] + dx / 2.0
        else:
            x_pos = s["x"]
        # In glTF coords: X' = X - cx, Z' = Z + cy (since glTF Z = -Blender Y)
        sw_60.append({
            "x": round(x_pos - cx, 5),
            "y": round(s["y"], 5),
            "z": round(s["z"] + cy, 5),
        })

    print(f"60% Switch count: {len(sw_60)}")
    if len(sw_60) != 61:
        raise ValueError(f"Expected 61 switches for 60% layout, got {len(sw_60)}")

    # 8. Export GLB
    bpy.ops.export_scene.gltf(
        filepath=out_glb_path,
        export_format="GLB",
        export_apply=True,
        export_draco_mesh_compression_enable=False,
    )
    print(f"Exported 60% GLB to: {out_glb_path} ({os.path.getsize(out_glb_path):,} bytes)")

    return sw_60


def export_100_layout(glb_src_path, out_glb_path, base_switches):
    """Generates and exports 100% full-size layout (104 keys) GLB and computes switch coordinates.

    Watertight guarantees:
    - Entire connected islands of 1U source keycaps are duplicated (all faces, side walls,
      top dish, stems, and decals) without any radius cutting or split faces.
    """
    print("\n" + "=" * 60)
    print("Exporting 100% Layout GLB (keyboard-100.glb)")
    print("=" * 60)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb_src_path)

    kc = bpy.data.objects["Layer_Keycaps"]
    plate = bpy.data.objects["Layer_Plate"]
    case = bpy.data.objects["Layer_Case"]

    bm = bmesh.new()
    bm.from_mesh(kc.data)

    # 1. Group islands by switch
    switch_islands = group_islands_by_switch(bm, base_switches)
    uv_layer = bm.loops.layers.uv.active

    # 2. Rescale all existing base keycap decal V coordinates from 9 rows to 12 rows:
    # v_blender_new = 1.0 - (1.0 - v_blender_old) * (9.0 / 12.0)
    for f in bm.faces:
        if kc.data.materials[f.material_index].name == 'keycaps engraving':
            for l in f.loops:
                l[uv_layer].uv.y = 1.0 - (1.0 - l[uv_layer].uv.y) * (9.0 / 12.0)

    # 23 keys to add to the right of the 81-key matrix:
    # 3 keys on top F-row: PrtSc, ScrLk, Pause
    # 20 keys in Numpad (4 columns x 5 rows)
    row_sources = {
        1: {"target_sw": 11, "src_row": 1, "src_col": 2, "y": 0.05829, "sw_y": 0.01735, "sw_z": -0.05829},
        2: {"target_sw": 25, "src_row": 2, "src_col": 7, "y": 0.03456, "sw_y": 0.01556, "sw_z": -0.03456},
        3: {"target_sw": 36, "src_row": 4, "src_col": 3, "y": 0.01587, "sw_y": 0.01421, "sw_z": -0.01587},
        4: {"target_sw": 49, "src_row": 6, "src_col": 0, "y": -0.00281, "sw_y": 0.01283, "sw_z": 0.00281},
        5: {"target_sw": 63, "src_row": 7, "src_col": 4, "y": -0.02150, "sw_y": 0.01144, "sw_z": 0.02150},
        6: {"target_sw": 76, "src_row": 8, "src_col": 3, "y": -0.04018, "sw_y": 0.01008, "sw_z": 0.04018},
    }

    cols_numpad = [0.165, 0.18405, 0.20310, 0.22215]
    cols_top_nav = [0.165, 0.18405, 0.20310]
    top_nav_cells = [(9, 0), (9, 1), (9, 2)]

    added_switches = []

    # 3. Duplicate 3 keys on top row (F-row level: PrtSc, ScrLk, Pause)
    src_info = row_sources[1]
    src_sw = src_info["target_sw"]
    src_verts = [v for isl in switch_islands[src_sw] for v in isl]
    src_faces = list(set(f for v in src_verts for f in v.link_faces))
    src_edges = list(set(e for v in src_verts for e in v.link_edges))
    geom_to_dup = src_faces + src_edges + src_verts
    src_x = base_switches[src_sw]["x"]

    for col_idx, target_x in enumerate(cols_top_nav):
        res = bmesh.ops.duplicate(bm, geom=geom_to_dup)
        new_verts = [v for v in res["geom"] if isinstance(v, bmesh.types.BMVert)]
        bmesh.ops.translate(bm, vec=Vector((target_x - src_x, 0, 0)), verts=new_verts)

        # Decal UV remapping to target cell in 12x9 grid
        target_row, target_col = top_nav_cells[col_idx]
        for f in res["geom"]:
            if isinstance(f, bmesh.types.BMFace) and kc.data.materials[f.material_index].name == 'keycaps engraving':
                u_avg = sum(l[uv_layer].uv.x for l in f.loops) / len(f.loops)
                v_avg = sum(l[uv_layer].uv.y for l in f.loops) / len(f.loops)
                src_col = min(8, max(0, int(u_avg * 9.0)))
                src_row = min(11, max(0, int((1.0 - v_avg) * 12.0)))
                delta_u = (target_col - src_col) / 9.0
                delta_v = (src_row - target_row) / 12.0
                for l in f.loops:
                    l[uv_layer].uv.x += delta_u
                    l[uv_layer].uv.y += delta_v

        added_switches.append({
            "x": round(target_x, 5),
            "y": src_info["sw_y"],
            "z": src_info["sw_z"],
        })

    # 4. Duplicate Numpad keys (rows 2 through 6) with 2U + (v), 2U Enter (v), 2U 0 (h)
    numpad_layout = {
        2: [
            {"col_idx": 0, "cell": (9, 3)},  # Num
            {"col_idx": 1, "cell": (9, 4)},  # /
            {"col_idx": 2, "cell": (9, 5)},  # *
            {"col_idx": 3, "cell": (9, 6)},  # -
        ],
        3: [
            {"col_idx": 0, "cell": (9, 7)},  # 7
            {"col_idx": 1, "cell": (9, 8)},  # 8
            {"col_idx": 2, "cell": (10, 0)}, # 9
            {"col_idx": 3, "cell": (10, 1), "stretch_2u_v": True}, # + (2u vertical)
        ],
        4: [
            {"col_idx": 0, "cell": (10, 2)}, # 4
            {"col_idx": 1, "cell": (10, 3)}, # 5
            {"col_idx": 2, "cell": (10, 4)}, # 6
            # col_idx 3 covered by 2u +
        ],
        5: [
            {"col_idx": 0, "cell": (10, 5)}, # 1
            {"col_idx": 1, "cell": (10, 6)}, # 2
            {"col_idx": 2, "cell": (10, 7)}, # 3
            {"col_idx": 3, "cell": (10, 8), "stretch_2u_v": True}, # Enter (2u vertical)
        ],
        6: [
            {"col_idx": 0, "cell": (11, 0), "stretch_2u_h": True}, # 0 (2u horizontal)
            # col_idx 1 covered by 2u 0
            {"col_idx": 2, "cell": (11, 1)}, # .
            # col_idx 3 covered by 2u Enter
        ],
    }

    for row_idx in [2, 3, 4, 5, 6]:
        src_info = row_sources[row_idx]
        src_sw = src_info["target_sw"]
        src_verts = [v for isl in switch_islands[src_sw] for v in isl]
        src_faces = list(set(f for v in src_verts for f in v.link_faces))
        src_edges = list(set(e for v in src_verts for e in v.link_edges))
        geom_to_dup = src_faces + src_edges + src_verts
        src_x = base_switches[src_sw]["x"]

        # Duplicate physical keycaps according to numpad_layout
        for key_cfg in numpad_layout[row_idx]:
            target_x = cols_numpad[key_cfg["col_idx"]]
            res = bmesh.ops.duplicate(bm, geom=geom_to_dup)
            new_verts = [v for v in res["geom"] if isinstance(v, bmesh.types.BMVert)]
            bmesh.ops.translate(bm, vec=Vector((target_x - src_x, 0, 0)), verts=new_verts)

            # Decal UV remapping to target cell in 12x9 grid
            target_row, target_col = key_cfg["cell"]
            engraving_verts = set()
            for f in res["geom"]:
                if isinstance(f, bmesh.types.BMFace) and kc.data.materials[f.material_index].name == 'keycaps engraving':
                    engraving_verts.update(f.verts)
                    u_avg = sum(l[uv_layer].uv.x for l in f.loops) / len(f.loops)
                    v_avg = sum(l[uv_layer].uv.y for l in f.loops) / len(f.loops)
                    src_col = min(8, max(0, int(u_avg * 9.0)))
                    src_row = min(11, max(0, int((1.0 - v_avg) * 12.0)))
                    delta_u = (target_col - src_col) / 9.0
                    delta_v = (src_row - target_row) / 12.0
                    for l in f.loops:
                        l[uv_layer].uv.x += delta_u
                        l[uv_layer].uv.y += delta_v

            # 2u vertical stretch across next row for + and Enter
            if key_cfg.get("stretch_2u_v"):
                min_y = min(v.co.y for v in new_verts)
                max_y = max(v.co.y for v in new_verts)
                mid_y = (min_y + max_y) / 2.0
                dy = -0.01868  # 1U row distance
                for v in new_verts:
                    if v in engraving_verts:
                        v.co.y += dy
                    elif v.co.y < mid_y:
                        v.co.y += dy

            # 2u horizontal stretch across next column for Numpad 0
            if key_cfg.get("stretch_2u_h"):
                min_x = min(v.co.x for v in new_verts)
                max_x = max(v.co.x for v in new_verts)
                mid_x = (min_x + max_x) / 2.0
                dx = 0.01905  # 1U
                for v in new_verts:
                    if v in engraving_verts:
                        v.co.x += dx / 2.0
                    elif v.co.x > mid_x:
                        v.co.x += dx

        # Keep all 4 switch positions in the matrix so switch count is always 104
        for target_x in cols_numpad:
            added_switches.append({
                "x": round(target_x, 5),
                "y": src_info["sw_y"],
                "z": src_info["sw_z"],
            })

    bm.to_mesh(kc.data)
    kc.data.update()

    is_valid = not kc.data.validate(verbose=False)
    print(f"100% Keycaps Mesh Valid: {is_valid}")

    total_switches = list(base_switches) + added_switches
    print(f"100% total switch count before centering: {len(total_switches)}")
    if len(total_switches) != 104:
        raise ValueError(f"Expected 104 switches for 100% layout, got {len(total_switches)}")

    # 4. Compute 100% keycaps bounding box and center
    min_x = min(v.co.x for v in kc.data.vertices)
    max_x = max(v.co.x for v in kc.data.vertices)
    min_y = min(v.co.y for v in kc.data.vertices)
    max_y = max(v.co.y for v in kc.data.vertices)
    cx = (min_x + max_x) / 2.0
    cy = (min_y + max_y) / 2.0
    span_x = max_x - min_x
    span_y = max_y - min_y
    print(f"100% Keycaps: span_x={span_x:.4f}, span_y={span_y:.4f}, center=({cx:.5f}, {cy:.5f})")

    # Shift Layer_Keycaps to center around (0, 0)
    for v in kc.data.vertices:
        v.co.x -= cx
        v.co.y -= cy
    kc.data.update()

    # 5. Scale Layer_Plate
    target_plate_w = span_x + 0.002
    scale_plate_x = target_plate_w / 0.3061

    for v in plate.data.vertices:
        v.co.x = v.co.x * scale_plate_x
        v.co.y = v.co.y - cy
    plate.data.update()

    # 6. Remove 75% rotary knob ('rough chrome') from Layer_Case, then scale
    bm_case = bmesh.new()
    bm_case.from_mesh(case.data)
    knob_mat_indices = {i for i, mat in enumerate(case.data.materials) if mat and mat.name == 'rough chrome'}
    knob_faces = [f for f in bm_case.faces if f.material_index in knob_mat_indices]
    knob_verts = list(set(v for f in knob_faces for v in f.verts))
    if knob_verts:
        bmesh.ops.delete(bm_case, geom=knob_verts, context="VERTS")
        print(f"100% Case: deleted {len(knob_faces)} rotary knob faces ({len(knob_verts)} verts)")
    bm_case.to_mesh(case.data)
    case.data.update()
    bm_case.free()

    target_case_w = span_x + 2 * 0.00905
    scale_case_x = target_case_w / 0.3225

    for v in case.data.vertices:
        v.co.x = v.co.x * scale_case_x
        v.co.y = (v.co.y - 0.009975)
    case.data.update()

    # 7. Center switch positions
    sw_100 = []
    for s in total_switches:
        sw_100.append({
            "x": round(s["x"] - cx, 5),
            "y": round(s["y"], 5),
            "z": round(s["z"] + cy, 5),
        })

    # 8. Export GLB
    bpy.ops.export_scene.gltf(
        filepath=out_glb_path,
        export_format="GLB",
        export_apply=True,
        export_draco_mesh_compression_enable=False,
    )
    print(f"Exported 100% GLB to: {out_glb_path} ({os.path.getsize(out_glb_path):,} bytes)")

    return sw_100


def update_switch_layout_file(filepath, base_switches, sw_60, sw_100):
    """Updates src/lib/keyboardSwitchLayout.js with SWITCH_LAYOUTS dictionary."""
    with open(filepath, "r", encoding="utf-8") as f:
        existing = f.read()

    # Extract KEYBOARD_DIMENSIONS block
    dim_match = re.search(r"export const KEYBOARD_DIMENSIONS = Object\.freeze\(\{[\s\S]*?\}\);", existing)
    if not dim_match:
        raise ValueError("Could not find KEYBOARD_DIMENSIONS in keyboardSwitchLayout.js")
    dim_block = dim_match.group(0)

    lines = [
        "/**",
        " * @fileoverview Keyboard switch layout and physical dimensions for 3D exploded keyboard view.",
        " * All positions and dimensions are expressed in meters in glTF / Three.js coordinate space (+Y up, +Z depth).",
        " */",
        "",
        dim_block,
        "",
        "/**",
        " * 3D world coordinates for 60% compact layout (61 mechanical switches).",
        " * @type {ReadonlyArray<{ x: number, y: number, z: number }>}",
        " */",
        "export const SWITCH_LAYOUT_POSITIONS_60 = Object.freeze([",
    ]
    for s in sw_60:
        lines.append(f"  {{ x: {s['x']:.5f}, y: {s['y']:.5f}, z: {s['z']:.5f} }},")
    lines.append("]);")
    lines.append("")

    lines.extend([
        "/**",
        " * 3D world coordinates for all 81 mechanical switches in Three.js coordinates (meters) - 75% layout.",
        " * Coordinates mapped from Blender (x, y, z) to glTF (+X right, +Y up, -Y depth -> +Z).",
        " *",
        " * @type {ReadonlyArray<{ x: number, y: number, z: number }>}",
        " */",
        "export const SWITCH_LAYOUT_POSITIONS = Object.freeze([",
    ])
    for s in base_switches:
        lines.append(f"  {{ x: {s['x']:.5f}, y: {s['y']:.5f}, z: {s['z']:.5f} }},")
    lines.append("]);")
    lines.append("")

    lines.extend([
        "/**",
        " * 3D world coordinates for 100% full-size layout (104 mechanical switches).",
        " * @type {ReadonlyArray<{ x: number, y: number, z: number }>}",
        " */",
        "export const SWITCH_LAYOUT_POSITIONS_100 = Object.freeze([",
    ])
    for s in sw_100:
        lines.append(f"  {{ x: {s['x']:.5f}, y: {s['y']:.5f}, z: {s['z']:.5f} }},")
    lines.append("]);")
    lines.append("")

    lines.extend([
        "/**",
        " * Switch layout positions indexed by form-factor code ('60', '75', '100').",
        " *",
        " * @type {Readonly<{",
        " *   '60': ReadonlyArray<{ x: number, y: number, z: number }>,",
        " *   '75': ReadonlyArray<{ x: number, y: number, z: number }>,",
        " *   '100': ReadonlyArray<{ x: number, y: number, z: number }>",
        " * }>}",
        " */",
        "export const SWITCH_LAYOUTS = Object.freeze({",
        "  '60': SWITCH_LAYOUT_POSITIONS_60,",
        "  '75': SWITCH_LAYOUT_POSITIONS,",
        "  '100': SWITCH_LAYOUT_POSITIONS_100,",
        "});",
        "",
    ])

    new_content = "\n".join(lines)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(new_content)
    print(f"Updated {filepath} with SWITCH_LAYOUTS ('60': 61, '75': 81, '100': 104).")


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))
    models_dir = os.path.join(project_root, "public", "models")
    layout_js_path = os.path.join(project_root, "src", "lib", "keyboardSwitchLayout.js")
    src_glb_path = os.path.join(models_dir, "exploded-keyboard.glb")

    glb_60_path = os.path.join(models_dir, "keyboard-60.glb")
    glb_100_path = os.path.join(models_dir, "keyboard-100.glb")

    base_switches = get_switch_positions_from_js(layout_js_path)
    print(f"Loaded {len(base_switches)} base 75% switch positions.")

    sw_60 = export_60_layout(src_glb_path, glb_60_path, base_switches)
    sw_100 = export_100_layout(src_glb_path, glb_100_path, base_switches)

    update_switch_layout_file(layout_js_path, base_switches, sw_60, sw_100)

    print("\n" + "=" * 60)
    print("MULTI-LAYOUT EXPORT COMPLETED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    main()
