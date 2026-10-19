#!/usr/bin/env python3
"""
Reader and software renderer for Stellaris 3D models (binary Paradox `.mesh`
files), used to generate shipset preview images - the game itself only shows
shipsets as live 3D renders, there is no 2D picture to extract.

Binary format ("@@b@" header, same as io_pdx_mesh's Blender importer reads):
- `!` + 1-byte name length + name + type char (`i` int32, `f` float32,
  `s` string) + uint32 count + values: a property of the current object
- `[` repeated N times + null-terminated name: an object at depth N
A mesh object holds `p` (positions), `n` (normals), `u0` (UVs), `tri`
(indices) and a `material` child (`shader`, `diff` texture...). The
`.gfx` files can override the material per mesh with `meshsettings`
(shape name + index -> texture_diffuse / shader).

Rendering is a plain numpy z-buffer rasterizer: diffuse texture + one
directional light + ambient, 2x supersampled. No empire color tint (each
shipset encodes its color mask differently) and no specular/normal maps.

Only depends on numpy and Pillow.
"""

import glob
import os
import re
import struct

import numpy as np
from PIL import Image


def parse_pdx(path: str) -> dict:
    """Parses a binary Paradox asset into a {'name', 'props', 'children'} tree."""
    with open(path, 'rb') as f:
        data = f.read()
    if data[:4] != b'@@b@':
        raise ValueError(f'{path}: not a binary Paradox asset')
    pos = 4
    root = {'name': 'root', 'children': [], 'props': {}}
    stack = [(0, root)]
    while pos < len(data):
        c = data[pos]
        if c == 0x21:  # '!' property
            pos += 1
            n = data[pos]; pos += 1
            name = data[pos:pos + n].decode('latin1'); pos += n
            kind = chr(data[pos]); pos += 1
            count = struct.unpack_from('<I', data, pos)[0]; pos += 4
            if kind == 'i':
                value = np.frombuffer(data, '<i4', count, pos).copy(); pos += 4 * count
            elif kind == 'f':
                value = np.frombuffer(data, '<f4', count, pos).copy(); pos += 4 * count
            elif kind == 's':
                value = []
                for _ in range(count):
                    length = struct.unpack_from('<I', data, pos)[0]; pos += 4
                    value.append(data[pos:pos + length].rstrip(b'\0').decode('latin1')); pos += length
            else:
                raise ValueError(f'{path}: unknown property type {kind!r} at byte {pos}')
            stack[-1][1]['props'][name] = value
        elif c == 0x5B:  # '[' object
            depth = 0
            while data[pos] == 0x5B:
                depth += 1; pos += 1
            end = data.index(b'\0', pos)
            node = {'name': data[pos:end].decode('latin1'), 'children': [], 'props': {}}
            pos = end + 1
            while stack[-1][0] >= depth:
                stack.pop()
            stack[-1][1]['children'].append(node)
            stack.append((depth, node))
        else:
            raise ValueError(f'{path}: unexpected byte {c:#x} at {pos}')
    return root


def find_meshes(node: dict, out: list = None) -> list:
    """All mesh nodes, tagged with their shape name and index in it (keys of .gfx meshsettings)."""
    out = [] if out is None else out
    index = 0
    for child in node['children']:
        if child['name'] == 'mesh':
            child['shape'] = node['name']
            child['index'] = index
            index += 1
            out.append(child)
        else:
            find_meshes(child, out)
    return out


class ModelIndex:
    """Entity -> mesh file -> material overrides, scanned once from gfx/models/."""

    def __init__(self, stellaris_path: str):
        self.root = stellaris_path.rstrip('/') + '/'
        self.mesh_files = {}     # pdxmesh name (lower) -> relative .mesh path
        self.mesh_settings = {}  # relative .mesh path (lower) -> {(shape, index): settings}
        self.entities = {}       # entity name (lower) -> pdxmesh name (lower)
        models = os.path.join(self.root, 'gfx', 'models')
        for path in glob.glob(os.path.join(models, '**', '*.gfx'), recursive=True):
            text = re.sub(r'#[^\n]*', '', open(path, encoding='utf-8-sig', errors='replace').read())
            for block in re.split(r'pdxmesh\s*=\s*\{', text)[1:]:
                match = re.search(r'name\s*=\s*"([^"]+)"\s*file\s*=\s*"([^"]+\.mesh)"', block, re.I)
                if not match:
                    continue
                self.mesh_files[match.group(1).lower()] = match.group(2)
                settings = {}
                for ms in re.findall(r'meshsettings\s*=\s*\{([^}]*)\}', block, re.I):
                    kv = {k.lower(): v.strip('"') for k, v in re.findall(r'(\w+)\s*=\s*("[^"]*"|\S+)', ms)}
                    settings[(kv.get('name', '').lower(), int(kv.get('index', 0)))] = kv
                self.mesh_settings[match.group(2).lower()] = settings
        for path in glob.glob(os.path.join(models, '**', '*.asset'), recursive=True):
            text = open(path, encoding='utf-8-sig', errors='replace').read()
            for name, mesh in re.findall(r'name\s*=\s*"([^"]+)"\s*pdxmesh\s*=\s*"([^"]+)"', text, re.I):
                self.entities[name.lower()] = mesh.lower()

    def entity_mesh(self, entity: str):
        """Relative .mesh path of an entity, or None."""
        mesh = self.entities.get(entity.lower())
        return self.mesh_files.get(mesh) if mesh else None

    def load_parts(self, mesh_path: str) -> list:
        """Renderable parts of a .mesh file: (positions, normals, uvs, triangles, diffuse image)."""
        full = self.root + mesh_path
        folder = os.path.dirname(full)
        settings = self.mesh_settings.get(mesh_path.lower(), {})
        parts = []
        for mesh in find_meshes(parse_pdx(full)):
            props = mesh['props']
            material = next((c['props'] for c in mesh['children'] if c['name'] == 'material'), {})
            override = settings.get((mesh['shape'].lower(), mesh['index']), {})
            shader = override.get('shader') or material.get('shader', [''])[0]
            # Collision hulls and additive/alpha effects (glows, animated energy) are not hull surfaces
            if shader == 'Collision' or 'Additive' in shader or 'Alpha' in shader or 'tri' not in props:
                continue
            diffuse_name = override.get('texture_diffuse') or material.get('diff', [None])[0]
            texture = None
            if diffuse_name:
                for candidate in (os.path.join(folder, diffuse_name), os.path.join(self.root, 'gfx', 'models', 'ships', diffuse_name)):
                    if os.path.exists(candidate):
                        texture = Image.open(candidate).convert('RGB')
                        break
            parts.append((
                props['p'].reshape(-1, 3),
                props['n'].reshape(-1, 3) if 'n' in props else None,
                props['u0'].reshape(-1, 2) if 'u0' in props else None,
                props['tri'].reshape(-1, 3),
                texture,
            ))
        return parts


def _rotation(yaw_deg: float, pitch_deg: float) -> np.ndarray:
    y, x = np.radians(yaw_deg), np.radians(pitch_deg)
    ry = np.array([[np.cos(y), 0, np.sin(y)], [0, 1, 0], [-np.sin(y), 0, np.cos(y)]])
    rx = np.array([[1, 0, 0], [0, np.cos(x), -np.sin(x)], [0, np.sin(x), np.cos(x)]])
    return rx @ ry


def render(parts: list, size: int = 512, yaw: float = 110, pitch: float = 20, supersample: int = 2,
           light=(-0.4, 0.6, 0.7)) -> Image.Image:
    """Renders model parts into a transparent RGBA square image (model fitted to the frame).

    Default angle (yaw 110, pitch 20) matches the in-game shipset picker
    thumbnails: three-quarter side view, bow to the left.
    """
    width = size * supersample
    rot = _rotation(yaw, pitch)
    all_points = np.concatenate([p for p, *_ in parts])
    center = (all_points.min(0) + all_points.max(0)) / 2
    projected = (all_points - center) @ rot.T
    scale = (width / 2) / (np.abs(projected[:, :2]).max() * 1.08)

    color = np.zeros((width, width, 3), np.float32)
    alpha = np.zeros((width, width), np.float32)
    zbuf = np.full((width, width), np.inf, np.float32)
    light_dir = np.array(light, np.float32)
    light_dir /= np.linalg.norm(light_dir)

    for pos, nrm, uv, tri, texture in parts:
        v = (pos - center) @ rot.T
        sx = v[:, 0] * scale + width / 2
        sy = -v[:, 1] * scale + width / 2
        sz = -v[:, 2]
        normals = nrm @ rot.T if nrm is not None else None
        tex = np.asarray(texture, np.float32) / 255 if texture is not None else None
        for a, b, c in tri:
            x0, x1, x2 = sx[a], sx[b], sx[c]
            y0, y1, y2 = sy[a], sy[b], sy[c]
            area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
            if abs(area) < 1e-9:
                continue
            xmin, xmax = int(max(min(x0, x1, x2), 0)), int(min(max(x0, x1, x2) + 1, width))
            ymin, ymax = int(max(min(y0, y1, y2), 0)), int(min(max(y0, y1, y2) + 1, width))
            if xmin >= xmax or ymin >= ymax:
                continue
            gx, gy = np.meshgrid(np.arange(xmin, xmax) + 0.5, np.arange(ymin, ymax) + 0.5)
            w0 = ((x1 - gx) * (y2 - gy) - (x2 - gx) * (y1 - gy)) / area
            w1 = ((x2 - gx) * (y0 - gy) - (x0 - gx) * (y2 - gy)) / area
            w2 = 1 - w0 - w1
            inside = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
            if not inside.any():
                continue
            z = w0 * sz[a] + w1 * sz[b] + w2 * sz[c]
            zb = zbuf[ymin:ymax, xmin:xmax]
            mask = inside & (z < zb)
            if not mask.any():
                continue
            zb[mask] = z[mask]
            if normals is not None:
                nn = w0[..., None] * normals[a] + w1[..., None] * normals[b] + w2[..., None] * normals[c]
                nn /= np.linalg.norm(nn, axis=-1, keepdims=True) + 1e-9
                shade = 0.35 + 0.75 * np.clip(nn @ light_dir, 0, 1)
            else:
                shade = np.ones_like(z)
            if tex is not None and uv is not None:
                u = w0 * uv[a, 0] + w1 * uv[b, 0] + w2 * uv[c, 0]
                vv = w0 * uv[a, 1] + w1 * uv[b, 1] + w2 * uv[c, 1]
                th, tw = tex.shape[:2]
                base = tex[np.clip((vv % 1.0) * th, 0, th - 1).astype(int), np.clip((u % 1.0) * tw, 0, tw - 1).astype(int)]
            else:
                base = np.full(z.shape + (3,), 0.7, np.float32)
            color[ymin:ymax, xmin:xmax][mask] = np.clip(base[mask] * shade[mask][:, None], 0, 1)
            alpha[ymin:ymax, xmin:xmax][mask] = 1

    rgba = (np.dstack([color, alpha]) * 255).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA').resize((size, size), Image.LANCZOS)


def fit_to_canvas(image: Image.Image, width: int, height: int, margin: float = 0.04) -> Image.Image:
    """Trims transparent borders and centers the model on a width x height canvas (ships are long and flat)."""
    bbox = image.getchannel('A').getbbox()
    if bbox:
        image = image.crop(bbox)
    avail_w, avail_h = width * (1 - 2 * margin), height * (1 - 2 * margin)
    ratio = min(avail_w / image.width, avail_h / image.height)
    image = image.resize((max(1, round(image.width * ratio)), max(1, round(image.height * ratio))), Image.LANCZOS)
    canvas = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    canvas.alpha_composite(image, ((width - image.width) // 2, (height - image.height) // 2))
    return canvas
