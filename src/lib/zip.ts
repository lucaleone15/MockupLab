/*
 * Minimal ZIP writer (stored entries, no compression): exported images are
 * already compressed, so storing them is as small and much faster. Builds a
 * standard archive any system can open.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** MS-DOS date/time of now. */
function dosTime(d = new Date()) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

export class ZipWriter {
  private parts: BlobPart[] = [];
  private central: Uint8Array<ArrayBuffer>[] = [];
  private offset = 0;
  private names = new Set<string>();

  /** Adds a file; a name already used gets a numeric suffix. */
  async add(name: string, blob: Blob) {
    let unique = name;
    for (let i = 2; this.names.has(unique); i++) unique = name.replace(/(\.[^.]+)?$/, `-${i}$1`);
    this.names.add(unique);
    const data = new Uint8Array(await blob.arrayBuffer());
    const fileName = new TextEncoder().encode(unique);
    const crc = crc32(data);
    const { time, date } = dosTime();
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, fileName.length, true);
    local.setUint16(28, 0, true);
    this.parts.push(local.buffer, fileName, data);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, time, true);
    cd.setUint16(14, date, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, data.length, true);
    cd.setUint32(24, data.length, true);
    cd.setUint16(28, fileName.length, true);
    cd.setUint32(42, this.offset, true);
    const entry = new Uint8Array(46 + fileName.length);
    entry.set(new Uint8Array(cd.buffer), 0);
    entry.set(fileName, 46);
    this.central.push(entry);
    this.offset += 30 + fileName.length + data.length;
  }

  get size() {
    return this.names.size;
  }

  finish(): Blob {
    const cdSize = this.central.reduce((s, e) => s + e.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, this.central.length, true);
    end.setUint16(10, this.central.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, this.offset, true);
    return new Blob([...this.parts, ...this.central, end.buffer], { type: 'application/zip' });
  }
}
