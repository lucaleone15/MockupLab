# scripts/showcase-sizes.py — phone-sized copies of the landing stills: 1280 px wide (720 for portrait ones).
from PIL import Image
import os
for f in ['hero-still.webp', 'studio-ui.jpg', 'devices-phones.webp', 'devices-print.webp', 'studio-podium.webp',
          'motion-still.webp', 'social-post.webp', 'clients-pack.webp']:
    path = os.path.join('public/showcase', f)
    im = Image.open(path)
    w, h = im.size
    W = 1280 if w > h else 720
    if w <= W:
        continue
    out = path.rsplit('.', 1)[0] + '-%d.webp' % W
    im.convert('RGB').resize((W, round(h * W / w)), Image.LANCZOS).save(out, 'WEBP', quality=80, method=6)
    print('saved', os.path.basename(out))
