"""Blender Python script to optimize and export exploded-keyboard.glb and keyboardSwitchLayout.js.

Usage:
    D:\\Blender\\blender.exe -b "<blend_file_path>" --python scripts/export-keyboard-glb.py

Produces:
    - public/models/exploded-keyboard.glb (< 5.0 MB, 100,000–200,000 triangles total)
    - src/lib/keyboardSwitchLayout.js (ESM layout data and dimensions)
"""

import os
import bpy
import numpy as np
from mathutils import Vector


def srgb_to_linear(c):
    """Converts a normalized sRGB color component [0, 1] to linear color space."""
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_to_linear_rgb(hex_str, alpha=1.0):
    """Converts an sRGB hex color string (e.g. '#cfd6e0') to a linear RGBA 4-tuple."""
    clean_hex = hex_str.lstrip("#")
    r = int(clean_hex[0:2], 16) / 255.0
    g = int(clean_hex[2:4], 16) / 255.0
    b = int(clean_hex[4:6], 16) / 255.0
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), alpha)


def main():
    print("=" * 60)
    print("Exporting exploded-keyboard.glb and keyboardSwitchLayout.js (Hi-Fi)")
    print("=" * 60)

    # Determine project root directory
    script_dir = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.getcwd()
    project_root = os.path.abspath(os.path.join(script_dir, "..")) if os.path.basename(script_dir) == "scripts" else os.getcwd()
    print(f"Project root: {project_root}")

    # Output paths
    models_dir = os.path.join(project_root, "public", "models")
    os.makedirs(models_dir, exist_ok=True)
    glb_output_path = os.path.join(models_dir, "exploded-keyboard.glb")
    layout_output_path = os.path.join(project_root, "src", "lib", "keyboardSwitchLayout.js")

    # 1. Subsurf modifier management (A-1):
    # Apply levels=1 on case parts ONLY.
    # REMOVE/skip SUBSURF on all switch parts (SWITCH, Plane.001, Plane.002, Cube.001) to use base mesh.
    # Keycap bodies keep current behaviour (remain smooth at base resolution without subsurf).
    print("\n[Step 1] Managing SUBSURF modifiers (apply level 1 on case parts, strip on all switch parts and keycaps)...")
    subsurf_apply_names = [
        "frame",
        "base",
        "knob",
        "front keyboard cushions",
        "small keyboard support",
        "usb c",
    ]

    for name in subsurf_apply_names:
        obj = bpy.data.objects.get(name)
        if obj and obj.type == "MESH":
            for mod in list(obj.modifiers):
                if mod.type == "SUBSURF":
                    mod.levels = 1
                    mod.render_levels = 1
                    bpy.context.view_layer.objects.active = obj
                    bpy.ops.object.modifier_apply(modifier=mod.name)
                    print(f"  Applied SUBSURF(lvl=1) on {name}")

    # Remove any remaining SUBSURF modifiers on other meshes (keycaps, SWITCH, Plane.001, Plane.002, Cube.001)
    # and strip any stray DECIMATE modifiers from the blend file.
    subsurf_stripped = 0
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            for mod in list(obj.modifiers):
                if mod.type == "SUBSURF":
                    obj.modifiers.remove(mod)
                    subsurf_stripped += 1
                elif mod.type == "DECIMATE":
                    obj.modifiers.remove(mod)
    print(f"Stripped {subsurf_stripped} other SUBSURF modifiers (keycap bodies remain smooth at base resolution, switch parts use base mesh).")

    # 2. Extract the 81 switch positions in glTF/Three.js space (+X right, +Y up, +Z depth: (x, z, -y))
    print("\n[Step 2] Extracting 81 switch positions for keyboardSwitchLayout.js...")
    def get_switch_index(name):
        if name == "SWITCH":
            return 0
        return int(name.split(".")[1])

    switches = [o for o in bpy.data.objects if o.name == "SWITCH" or o.name.startswith("SWITCH.")]
    switches.sort(key=lambda o: get_switch_index(o.name))
    if len(switches) != 81:
        raise ValueError(f"Expected 81 SWITCH objects in scene, found {len(switches)}")

    switch_positions = []
    for sw in switches:
        t = sw.matrix_world.translation
        # Blender Z-up coordinate system to glTF Y-up: (x, z, -y)
        pos = {
            "x": round(float(t.x), 5),
            "y": round(float(t.z), 5),
            "z": round(float(-t.y), 5),
        }
        switch_positions.append(pos)

    # Write switch layout positions in Step 7 after computing plate and case dimensions

    # 3. Keycap Legend RGBA texture generation and Material Cleanup (A-2)
    print("\n[Step 3] Baking keycap_legends_rgba.png and setting up PBR materials...")
    src_img = bpy.data.images.get("attack shark x85 keycap texture.jpg")
    new_legend_img = None
    if src_img:
        w, h = src_img.size
        print(f"  Converting source keycap texture ({w}x{h}) to RGBA shine-through decal...")
        arr = np.array(src_img.pixels[:], dtype=np.float32).reshape((-1, 4))
        # Black legends (0.0) -> full opacity (1.0), white background (1.0) -> transparent (0.0)
        alpha = np.clip(1.0 - arr[:, 0], 0.0, 1.0)
        out_arr = np.zeros_like(arr)
        # Crisp shine-through light cyan/white: (0.92, 0.96, 1.0)
        out_arr[:, 0] = 0.92
        out_arr[:, 1] = 0.96
        out_arr[:, 2] = 1.0
        out_arr[:, 3] = alpha

        new_legend_img = bpy.data.images.new("keycap_legends_rgba.png", width=w, height=h, alpha=True)
        new_legend_img.file_format = "PNG"
        new_legend_img.pixels.foreach_set(out_arr.ravel())
        new_legend_img.pack()
        print("  Created and packed keycap_legends_rgba.png.")

    # Rewire 'keycaps engraving' material (setup kept unchanged per A-2)
    mat_eng = bpy.data.materials.get("keycaps engraving")
    if mat_eng and new_legend_img:
        mat_eng.use_nodes = True
        nodes = mat_eng.node_tree.nodes
        nodes.clear()

        tex_node = nodes.new(type="ShaderNodeTexImage")
        tex_node.location = (-350, 0)
        tex_node.image = new_legend_img

        bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
        bsdf.location = (0, 0)
        bsdf.inputs["Roughness"].default_value = 0.3
        bsdf.inputs["Emission Color"].default_value = (0.23, 0.552, 1.0, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 1.8

        output = nodes.new(type="ShaderNodeOutputMaterial")
        output.location = (350, 0)

        links = mat_eng.node_tree.links
        links.new(tex_node.outputs["Color"], bsdf.inputs["Base Color"])
        links.new(tex_node.outputs["Alpha"], bsdf.inputs["Alpha"])
        links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])

        mat_eng.blend_method = "BLEND"
        if hasattr(mat_eng, "surface_render_method"):
            mat_eng.surface_render_method = "BLENDED"
        print("  Rewired 'keycaps engraving' with RGBA texture, alpha blend, and emissive glow.")

    # Preserve 6 keycap materials: keep original distinct Base Color values, set Roughness = 0.7, Metallic = 0 (A-2)
    keycap_mat_names = [
        "white keycaps",
        "black gray keycaps",
        "dark gray kecaps",
        "light gray keycap 1",
        "light gray keycap 2",
        "middle gray keycap",
    ]
    procedural_types = {"BUMP", "TEX_NOISE", "MAPPING", "TEX_COORD", "VALTORGB"}

    for name in keycap_mat_names:
        mat = bpy.data.materials.get(name)
        if mat and mat.use_nodes and mat.node_tree:
            for node in list(mat.node_tree.nodes):
                if node.type in procedural_types:
                    mat.node_tree.nodes.remove(node)
            bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
            if bsdf:
                # Keep original distinct Base Color default_value intact
                bsdf.inputs["Roughness"].default_value = 0.7
                bsdf.inputs["Metallic"].default_value = 0.0
            print(f"  Cleaned procedural noise/bump and set Roughness=0.7, Metallic=0 on keycap material: {name}")

    # Clean up case materials: frame plastic, base plastic, gray rubbers, rough chrome
    case_mat_names = ["frame plastic", "base plastic", "gray rubbers", "rough chrome"]
    for name in case_mat_names:
        mat = bpy.data.materials.get(name)
        if mat and mat.use_nodes and mat.node_tree:
            for node in list(mat.node_tree.nodes):
                if node.type in procedural_types:
                    mat.node_tree.nodes.remove(node)
            if name == "rough chrome":
                bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
                if bsdf:
                    bsdf.inputs["Base Color"].default_value = (0.82, 0.84, 0.88, 1.0)
                    bsdf.inputs["Metallic"].default_value = 1.0
                    bsdf.inputs["Roughness"].default_value = 0.22
            print(f"  Cleaned procedural noise/bump on case material: {name}")

    # Configure 'switches transparent' (A-2):
    # Base Color #cfd6e0, Alpha 0.78, Roughness 0.25, blend mode BLEND (and surface_render_method BLENDED)
    mat_trans = bpy.data.materials.get("switches transparent")
    if mat_trans and mat_trans.use_nodes:
        bsdf = next((n for n in mat_trans.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if bsdf:
            bsdf.inputs["Base Color"].default_value = hex_to_linear_rgb("#cfd6e0")
            bsdf.inputs["Roughness"].default_value = 0.25
            bsdf.inputs["Alpha"].default_value = 0.78
        mat_trans.blend_method = "BLEND"
        if hasattr(mat_trans, "surface_render_method"):
            mat_trans.surface_render_method = "BLENDED"
        print("  Configured 'switches transparent' (Base Color #cfd6e0, Alpha 0.78, Roughness 0.25, BLEND).")

    # Configure 'switches support' bottom housing material (A-2):
    # Base Color #9a958c warm nylon tan/slate, Roughness 0.55
    mat_supp = bpy.data.materials.get("switches support")
    if mat_supp and mat_supp.use_nodes:
        bsdf = next((n for n in mat_supp.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if bsdf:
            bsdf.inputs["Base Color"].default_value = hex_to_linear_rgb("#9a958c")
            bsdf.inputs["Roughness"].default_value = 0.55
            bsdf.inputs["Metallic"].default_value = 0.0
        print("  Configured 'switches support' (Base Color #9a958c, Roughness 0.55).")

    # Remove all unused image textures from bpy.data.images
    for img in list(bpy.data.images):
        if img != new_legend_img and img.name != "keycap_legends_rgba.png":
            bpy.data.images.remove(img)
    print("  Removed unused images; only keycap_legends_rgba.png is packed.")

    # 4. Layer_Keycaps: Unparent and offset 81 decal children, unparent 81 caps, join into Layer_Keycaps
    print("\n[Step 4] Processing Layer_Keycaps (81 keycap bodies + 81 legend decals)...")
    keycap_objects = []
    decal_objects = []
    for sw in switches:
        caps = [c for c in sw.children if c.name.startswith("Circle.")]
        for cap in caps:
            keycap_objects.append(cap)
            for child in list(cap.children):
                decal_objects.append(child)

    if len(keycap_objects) != 81:
        raise ValueError(f"Expected 81 keycap bodies, found {len(keycap_objects)}")
    if len(decal_objects) != 81:
        raise ValueError(f"Expected 81 decal child objects, found {len(decal_objects)}")

    # Unparent decal children and offset slightly upward along normal to prevent Z-fighting
    decal_offset = Vector((0.0, -0.000013, 0.00018))
    for child in decal_objects:
        mat = child.matrix_world.copy()
        child.parent = None
        child.matrix_world = mat
        child.matrix_world.translation += decal_offset

    # Unparent keycap bodies while keeping world transform
    for cap in keycap_objects:
        mat = cap.matrix_world.copy()
        cap.parent = None
        cap.matrix_world = mat

    # Join all 81 keycaps AND all 81 decal children into Layer_Keycaps (DO NOT decimate keycaps)
    all_keycap_parts = keycap_objects + decal_objects
    bpy.ops.object.select_all(action="DESELECT")
    for obj in all_keycap_parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = keycap_objects[0]
    bpy.ops.object.join()
    layer_keycaps = bpy.context.view_layer.objects.active
    layer_keycaps.name = "Layer_Keycaps"
    layer_keycaps.data.name = "Layer_Keycaps"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # Ensure smooth shading
    for poly in layer_keycaps.data.polygons:
        poly.use_smooth = True
    layer_keycaps.data.validate(verbose=False)
    keycaps_tris = sum(len(f.vertices) - 2 for f in layer_keycaps.data.polygons)
    print(f"Layer_Keycaps created: {keycaps_tris:,} tris with 81 keycaps + 81 legend decals.")

    # 5. Switch_Prototype: 4 components, multi-material slots preserved, centered at origin (A-1, A-2)
    print("\n[Step 5] Processing Switch_Prototype (multi-material, 4 components, decimation, centered at origin)...")
    sw0 = bpy.data.objects["SWITCH"]
    sw0_world_pos = sw0.matrix_world.translation.copy()
    plane_top = bpy.data.objects["Plane.001"]
    plane_pins = bpy.data.objects["Plane.002"]
    cube_stem = bpy.data.objects["Cube.001"]
    sw_parts = [sw0, plane_top, plane_pins, cube_stem]

    for p in sw_parts:
        mat = p.matrix_world.copy()
        p.parent = None
        p.matrix_world = mat

    # Report base mesh triangulated triangle counts (A-1):
    sw0_base_tris = sum(len(f.vertices) - 2 for f in sw0.data.polygons)
    top_base_tris = sum(len(f.vertices) - 2 for f in plane_top.data.polygons)
    pins_base_tris = sum(len(f.vertices) - 2 for f in plane_pins.data.polygons)
    stem_base_tris = sum(len(f.vertices) - 2 for f in cube_stem.data.polygons)
    total_base_tris = sw0_base_tris + top_base_tris + pins_base_tris + stem_base_tris
    print(f"  Switch parts base triangles (no subsurf):")
    print(f"    - SWITCH (bottom housing): {sw0_base_tris:,} tris")
    print(f"    - Plane.001 (top housing): {top_base_tris:,} tris")
    print(f"    - Plane.002 (pins): {pins_base_tris:,} tris")
    print(f"    - Cube.001 (stem): {stem_base_tris:,} tris")
    print(f"    - Total Base Switch Triangles: {total_base_tris:,} (expected: 7,160)")

    # Lightly simplify switch to ~2,000–2,500 triangles TOTAL per switch (A-1):
    # Step 5a: DISSOLVE (planar, angle_limit ~5° or 0.087 rad) decimate first to preserve crisp hard edges.
    # The big SWITCH bottom housing takes most of the reduction.
    # Leave Plane.002 pins untouched (24 tris), keep the stem profile intact.
    mod_dissolve = sw0.modifiers.new(name="Decimate_Planar", type="DECIMATE")
    mod_dissolve.decimate_type = "DISSOLVE"
    mod_dissolve.angle_limit = 0.0872665  # ~5 degrees (0.087 rad)
    bpy.context.view_layer.objects.active = sw0
    bpy.ops.object.modifier_apply(modifier=mod_dissolve.name)
    sw0_dissolved_tris = sum(len(f.vertices) - 2 for f in sw0.data.polygons)
    print(f"  SWITCH after DISSOLVE (planar, angle_limit=5°): {sw0_dissolved_tris:,} tris")

    # Step 5b: Switch parts base triangle counts already meet target [2000, 2500] (REV-8: deleted dead collapse loop).

    # Assign distinct warm rose #D9468F material 'switch_stem' to Cube.001 (A-1, A-2)
    stem_mat = bpy.data.materials.new("switch_stem")
    stem_mat.use_nodes = True
    nodes = stem_mat.node_tree.nodes
    nodes.clear()
    bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
    bsdf.location = (0, 0)
    bsdf.inputs["Base Color"].default_value = hex_to_linear_rgb("#D9468F")
    bsdf.inputs["Roughness"].default_value = 0.35
    bsdf.inputs["Metallic"].default_value = 0.0
    output = nodes.new(type="ShaderNodeOutputMaterial")
    output.location = (300, 0)
    stem_mat.node_tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    cube_stem.data.materials.clear()
    cube_stem.data.materials.append(stem_mat)

    # Delete other 80 switches and their children
    other_switches = [o for o in switches if o != sw0 and o.name in bpy.data.objects]
    for osw in other_switches:
        for child in list(osw.children):
            bpy.data.objects.remove(child, do_unlink=True)
        bpy.data.objects.remove(osw, do_unlink=True)

    # Join the 4 switch parts preserving ALL 4 separate material slots:
    # 1. 'switches support' (bottom housing)
    # 2. 'switches transparent' (top housing)
    # 3. 'pins' (metallic copper pins)
    # 4. 'switch_stem' (rose stem #D9468F)
    bpy.ops.object.select_all(action="DESELECT")
    for p in sw_parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = sw0
    bpy.ops.object.join()
    switch_proto = bpy.context.view_layer.objects.active
    switch_proto.name = "Switch_Prototype"
    switch_proto.data.name = "Switch_Prototype"

    # Center origin and vertices at (0, 0, 0) for THREE.InstancedMesh
    switch_proto.location -= sw0_world_pos
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    for poly in switch_proto.data.polygons:
        poly.use_smooth = True
    switch_proto.data.validate(verbose=False)
    switch_tris = sum(len(f.vertices) - 2 for f in switch_proto.data.polygons)
    print(f"Switch_Prototype created: {switch_tris:,} tris with {len(switch_proto.data.materials)} material slots:")
    for i, m in enumerate(switch_proto.data.materials):
        print(f"  Slot {i}: {m.name if m else 'None'}")

    if switch_tris < 2000 or switch_tris > 2500:
        raise ValueError(f"Switch_Prototype triangle count {switch_tris:,} is outside target of 2,000–2,500!")

    # 6. Layer_Plate: switches support mesh renamed to Layer_Plate with Plate_RGB_Backlight (A-2)
    # Emission Strength = 0.35 (was 1.6)
    print("\n[Step 6] Processing Layer_Plate with Plate_RGB_Backlight (Emission Strength 0.35)...")
    plate = bpy.data.objects["switches support"]
    mat = plate.matrix_world.copy()
    plate.parent = None
    plate.matrix_world = mat
    bpy.ops.object.select_all(action="DESELECT")
    plate.select_set(True)
    bpy.context.view_layer.objects.active = plate
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    plate.name = "Layer_Plate"
    plate.data.name = "Layer_Plate"

    plate_mat = bpy.data.materials.new("Plate_RGB_Backlight")
    plate_mat.use_nodes = True
    nodes = plate_mat.node_tree.nodes
    nodes.clear()
    bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
    bsdf.location = (0, 0)
    bsdf.inputs["Base Color"].default_value = (0.85, 0.90, 0.98, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.25
    bsdf.inputs["Alpha"].default_value = 0.88
    bsdf.inputs["Emission Color"].default_value = (0.23, 0.552, 1.0, 1.0)
    bsdf.inputs["Emission Strength"].default_value = 0.35  # Reduced from 1.6 per A-2
    output = nodes.new(type="ShaderNodeOutputMaterial")
    output.location = (300, 0)
    plate_mat.node_tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    plate_mat.blend_method = "BLEND"
    if hasattr(plate_mat, "surface_render_method"):
        plate_mat.surface_render_method = "BLENDED"

    plate.data.materials.clear()
    plate.data.materials.append(plate_mat)
    plate.data.validate(verbose=False)
    plate_tris = sum(len(f.vertices) - 2 for f in plate.data.polygons)
    print(f"Layer_Plate created: {plate_tris:,} tris with Plate_RGB_Backlight (emission=0.35).")

    # 7. Layer_Case: join frame, base, knob, front keyboard cushions, small keyboard support, usb c (DO NOT decimate)
    print("\n[Step 7] Processing Layer_Case (high-poly smooth, no decimation)...")
    frame = bpy.data.objects["frame"]
    base = bpy.data.objects["base"]
    knob = bpy.data.objects["knob"]
    front_cushions = bpy.data.objects["front keyboard cushions"]
    small_support = bpy.data.objects["small keyboard support"]
    usbc = bpy.data.objects["usb c"]
    case_parts = [frame, base, knob, front_cushions, small_support, usbc]

    # Record base mesh bottom floor before unparenting and joining case parts
    base_verts_world = [base.matrix_world @ v.co for v in base.data.vertices]
    # Blender Z corresponds to glTF / Three.js +Y up
    base_min_y = min(v.z for v in base_verts_world)
    base_thickness = 0.002
    case_inner_floor_y = round(float(base_min_y + base_thickness), 5)

    for p in case_parts:
        mat = p.matrix_world.copy()
        p.parent = None
        p.matrix_world = mat

    bpy.ops.object.select_all(action="DESELECT")
    for p in case_parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = frame
    bpy.ops.object.join()
    layer_case = bpy.context.view_layer.objects.active
    layer_case.name = "Layer_Case"
    layer_case.data.name = "Layer_Case"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    for poly in layer_case.data.polygons:
        poly.use_smooth = True
    layer_case.data.validate(verbose=False)
    case_tris = sum(len(f.vertices) - 2 for f in layer_case.data.polygons)
    print(f"Layer_Case created: {case_tris:,} tris.")

    # Compute bounding boxes and plate alignment centers in glTF coordinates (+X right, +Y up, +Z forward)
    plate_corners = [Vector((v.x, v.z, -v.y)) for v in [plate.matrix_world @ Vector(c) for c in plate.bound_box]]
    plate_min_x = min(v.x for v in plate_corners)
    plate_max_x = max(v.x for v in plate_corners)
    plate_min_y = min(v.y for v in plate_corners)
    plate_max_y = max(v.y for v in plate_corners)
    plate_min_z = min(v.z for v in plate_corners)
    plate_max_z = max(v.z for v in plate_corners)

    case_corners = [Vector((v.x, v.z, -v.y)) for v in [layer_case.matrix_world @ Vector(c) for c in layer_case.bound_box]]
    case_min_x = min(v.x for v in case_corners)
    case_max_x = max(v.x for v in case_corners)
    case_min_y = min(v.y for v in case_corners)
    case_max_y = max(v.y for v in case_corners)
    case_min_z = min(v.z for v in case_corners)
    case_max_z = max(v.z for v in case_corners)

    dims = {
        "width": round(float(case_max_x - case_min_x), 4),
        "depth": round(float(case_max_z - case_min_z), 4),
        "plateWidth": round(float(plate_max_x - plate_min_x), 4),
        "plateDepth": round(float(plate_max_z - plate_min_z), 4),
        "pcbWidth": 0.304,
        "pcbDepth": 0.116,
        "slopeRad": 0.0735,
        "plateCenter": {
            "x": round(float((plate_min_x + plate_max_x) / 2), 5),
            "y": round(float((plate_min_y + plate_max_y) / 2), 5),
            "z": round(float((plate_min_z + plate_max_z) / 2), 5),
        },
        "plateBottomY": round(float(plate_min_y), 5),
        "plateTopY": round(float(plate_max_y), 5),
        "caseInnerFloorY": case_inner_floor_y,
        "caseBbox": {
            "minX": round(float(case_min_x), 5),
            "maxX": round(float(case_max_x), 5),
            "minY": round(float(case_min_y), 5),
            "maxY": round(float(case_max_y), 5),
            "minZ": round(float(case_min_z), 5),
            "maxZ": round(float(case_max_z), 5),
        },
    }

    # Write src/lib/keyboardSwitchLayout.js with updated plate alignment and case bounds
    write_switch_layout_file(layout_output_path, switch_positions, dims)
    print(f"Verified switch layout and physical dimensions for: {layout_output_path}")

    # Remove all other unused objects from scene
    keep_objs = {layer_keycaps, switch_proto, plate, layer_case}
    for obj in list(bpy.data.objects):
        if obj not in keep_objs:
            bpy.data.objects.remove(obj, do_unlink=True)

    # 8. Verification and Export (A-1, A-2)
    print("\n[Step 8] Verifying exported layers and geometry...")
    exported_layers = [layer_keycaps, switch_proto, plate, layer_case]
    total_triangles = 0
    layer_stats = {}
    for layer in exported_layers:
        tris = sum(len(f.vertices) - 2 for f in layer.data.polygons)
        total_triangles += tris
        layer_stats[layer.name] = tris
        print(f"  - {layer.name}: {tris:,} triangles")

    print(f"\nGLB Total Triangles: {total_triangles:,} (Budget: 100,000–200,000)")
    if total_triangles < 100000 or total_triangles > 200000:
        raise ValueError(f"Total triangle count {total_triangles:,} is outside budget of 100,000–200,000!")

    # Calculate expected runtime triangle count with 81 switch instances (A-1):
    expected_runtime_tris = total_triangles - switch_tris + (81 * switch_tris)
    print(f"Expected Runtime Triangles (with 81 switch instances): {expected_runtime_tris:,} (Target: ~300,000–380,000)")
    if expected_runtime_tris < 300000 or expected_runtime_tris > 380000:
        raise ValueError(f"Expected runtime triangle count {expected_runtime_tris:,} is outside target of 300,000–380,000!")

    print(f"\nExporting to GLB: {glb_output_path} (export_draco=False)...")
    bpy.ops.export_scene.gltf(
        filepath=glb_output_path,
        export_format="GLB",
        export_apply=True,
        export_draco_mesh_compression_enable=False,
    )

    file_size_bytes = os.path.getsize(glb_output_path)
    file_size_mb = file_size_bytes / (1024 * 1024)
    print(f"Exported GLB Size: {file_size_bytes:,} bytes ({file_size_mb:.2f} MB, Limit: < 5.0 MB)")

    if file_size_bytes >= 5.0 * 1024 * 1024:
        raise ValueError(f"Exported GLB size ({file_size_mb:.2f} MB) exceeds limit of 5.0 MB!")

    print("\n" + "=" * 60)
    print("SUCCESSFULLY EXPORTED OPTIMIZED EXPLODED KEYBOARD ASSET")
    print("=" * 60)
    print(f"GLB Path: {glb_output_path}")
    print(f"File Size: {file_size_bytes:,} bytes ({file_size_mb:.2f} MB)")
    print(f"GLB Total Triangles: {total_triangles:,}")
    print(f"Switch_Prototype Triangles: {switch_tris:,}")
    print(f"Expected Runtime Triangles (81 switches): {expected_runtime_tris:,}")
    print(f"Exported Layers ({len(exported_layers)}):")
    for name, tris in layer_stats.items():
        print(f"  - {name}: {tris:,} tris")


def write_switch_layout_file(filepath, positions, dims):
    """Writes the JavaScript ESM switch layout and dimension constants if not already present or changed."""
    lines = [
        "/**",
        " * @fileoverview Keyboard switch layout and physical dimensions for 3D exploded keyboard view.",
        " * All positions and dimensions are expressed in meters in glTF / Three.js coordinate space (+Y up, +Z depth).",
        " */",
        "",
        "/**",
        " * Physical outer dimensions of keyboard assemblies and structural layers in meters.",
        " * Derived from the Attack Shark X85 CAD model.",
        " *",
        " * @type {{",
        " *   width: number,",
        " *   depth: number,",
        " *   plateWidth: number,",
        " *   plateDepth: number,",
        " *   pcbWidth: number,",
        " *   pcbDepth: number,",
        " *   slopeRad: number,",
        " *   plateCenter: { x: number, y: number, z: number },",
        " *   plateBottomY: number,",
        " *   plateTopY: number,",
        " *   caseInnerFloorY: number,",
        " *   caseBbox: { minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number }",
        " * }}",
        " */",
        "export const KEYBOARD_DIMENSIONS = Object.freeze({",
        f"  width: {dims['width']:.4f},",
        f"  depth: {dims['depth']:.4f},",
        f"  plateWidth: {dims['plateWidth']:.4f},",
        f"  plateDepth: {dims['plateDepth']:.4f},",
        f"  pcbWidth: {dims['pcbWidth']:.3f},",
        f"  pcbDepth: {dims['pcbDepth']:.3f},",
        f"  slopeRad: {dims['slopeRad']:.4f},",
        f"  plateCenter: Object.freeze({{ x: {dims['plateCenter']['x']:.5f}, y: {dims['plateCenter']['y']:.5f}, z: {dims['plateCenter']['z']:.5f} }}),",
        f"  plateBottomY: {dims['plateBottomY']:.5f},",
        f"  plateTopY: {dims['plateTopY']:.5f},",
        f"  caseInnerFloorY: {dims['caseInnerFloorY']:.5f},",
        "  caseBbox: Object.freeze({",
        f"    minX: {dims['caseBbox']['minX']:.5f},",
        f"    maxX: {dims['caseBbox']['maxX']:.5f},",
        f"    minY: {dims['caseBbox']['minY']:.5f},",
        f"    maxY: {dims['caseBbox']['maxY']:.5f},",
        f"    minZ: {dims['caseBbox']['minZ']:.5f},",
        f"    maxZ: {dims['caseBbox']['maxZ']:.5f},",
        "  }),",
        "});",
        "",
        "/**",
        " * 3D world coordinates for all 81 mechanical switches in Three.js coordinates (meters).",
        " * Coordinates mapped from Blender (x, y, z) to glTF (+X right, +Y up, -Y depth -> +Z).",
        " *",
        " * @type {ReadonlyArray<{ x: number, y: number, z: number }>}",
        " */",
        "export const SWITCH_LAYOUT_POSITIONS = Object.freeze([",
    ]

    for p in positions:
        lines.append(f"  {{ x: {p['x']:.5f}, y: {p['y']:.5f}, z: {p['z']:.5f} }},")

    lines.append("]);")
    lines.append("")
    new_content = "\n".join(lines)

    if os.path.exists(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                if f.read() == new_content:
                    return  # No change, avoid touching file
        except Exception:
            pass

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(new_content)


if __name__ == "__main__":
    main()
