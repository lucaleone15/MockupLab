#!/usr/bin/env python3
"""
Downloads and optimises the CC0 assets bundled with MockupLab into public/assets/.
Sources: Poly Haven (polyhaven.com) and ambientCG (ambientcg.com), both CC0 1.0.
Requires Python 3 + Pillow. Re-run to refresh; existing files are kept.

  python3 scripts/fetch_assets.py
"""
import io, json, os, subprocess, zipfile
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets')
UA = {'User-Agent': 'MockupLab asset fetcher (CC0)'}

# Materials seen in close-up (flat lays) get a 4K colour map.
HI_RES = {'marble-white'}

# id: (source, remote id)
MATERIALS = {
    'marble-white': ('acg', 'Marble012'),
    'marble-black': ('acg', 'Marble016'),
    'travertine': ('acg', 'Travertine009'),
    'terrazzo': ('acg', 'Terrazzo009'),
    'concrete': ('acg', 'Concrete034'),
    'linen': ('acg', 'Fabric036'),
    'oak': ('ph', 'oak_veneer_01'),
    'walnut': ('ph', 'walnut_veneer'),
}
PLACES = {
    'loft': 'photo_studio_loft_hall',
    'cafe': 'comfy_cafe',
    'lounge': 'lythwood_lounge',
    'veranda': 'veranda',
    'evening': 'warm_restaurant_night',
    'atelier': 'unfinished_office',
}


def get(url):
    # curl uses the system certificate store (some Python installs have none).
    return subprocess.run(['curl', '-sSLf', '-m', '300', '-A', UA['User-Agent'], url], check=True, capture_output=True).stdout


def save_jpg(img, path, size, quality=84, mode='RGB'):
    img = img.convert(mode)
    if size and max(img.size) > size:
        img.thumbnail((size, size), Image.LANCZOS)
    img.save(path, 'JPEG', quality=quality, optimize=True, progressive=True)


def material(mid, source, rid):
    out = os.path.join(ROOT, 'materials', mid)
    if os.path.exists(os.path.join(out, 'color.jpg')):
        return
    os.makedirs(out, exist_ok=True)
    res = 4096 if mid in HI_RES else 2048
    if source == 'acg':
        z = zipfile.ZipFile(io.BytesIO(get(f'https://ambientcg.com/get?file={rid}_{res // 1024}K-JPG.zip')))
        names = z.namelist()
        pick = lambda suffix: Image.open(io.BytesIO(z.read(next(n for n in names if n.endswith(suffix)))))
        color, normal, rough = pick('_Color.jpg'), pick('_NormalGL.jpg'), pick('_Roughness.jpg')
    else:
        files = json.loads(get(f'https://api.polyhaven.com/files/{rid}'))
        load = lambda key, res: Image.open(io.BytesIO(get(files[key][res]['jpg']['url'])))
        color, normal, rough = load('Diffuse', '2k'), load('nor_gl', '1k'), load('Rough', '1k')
    save_jpg(color, os.path.join(out, 'color.jpg'), res, 84)
    save_jpg(normal, os.path.join(out, 'normal.jpg'), 1024, 90)
    save_jpg(rough, os.path.join(out, 'rough.jpg'), 1024, 88, 'L')
    save_jpg(color, os.path.join(out, 'thumb.jpg'), 160, 80)
    print('material', mid)


def place(pid, rid):
    out = os.path.join(ROOT, 'places', pid)
    if os.path.exists(os.path.join(out, 'bg.jpg')):
        return
    os.makedirs(out, exist_ok=True)
    files = json.loads(get(f'https://api.polyhaven.com/files/{rid}'))
    with open(os.path.join(out, 'env.hdr'), 'wb') as f:
        f.write(get(files['hdri']['1k']['hdr']['url']))
    bg = Image.open(io.BytesIO(get(files['tonemapped']['url'])))
    Image.MAX_IMAGE_PIXELS = None
    bg = bg.convert('RGB').resize((4096, 2048), Image.LANCZOS)
    bg.save(os.path.join(out, 'bg.jpg'), 'JPEG', quality=82, optimize=True, progressive=True)
    # thumbnail: the horizon band, where the interesting part of a room is
    thumb = bg.crop((0, 600, 4096, 1450)).resize((480, 100), Image.LANCZOS)
    thumb.save(os.path.join(out, 'thumb.jpg'), 'JPEG', quality=80)
    print('place', pid)


if __name__ == '__main__':
    for mid, (src, rid) in MATERIALS.items():
        material(mid, src, rid)
    for pid, rid in PLACES.items():
        place(pid, rid)
    print('done')
