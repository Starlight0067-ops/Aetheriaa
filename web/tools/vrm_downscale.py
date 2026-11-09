"""Copies a VRM/GLB while downscaling every embedded texture to a maximum size (default 1024 px).
Keeps all JSON (VRM extensions included) and rebuilds the binary chunk with updated bufferViews.
Usage: python tools/vrm_downscale.py <in.vrm> <out.vrm> [max_px]
"""
import io
import json
import struct
import sys

from PIL import Image


def main(src, dst, max_px=1024):
    data = open(src, "rb").read()
    jlen = struct.unpack("<I", data[12:16])[0]
    j = json.loads(data[20:20 + jlen])
    bin_off = 20 + jlen
    blen = struct.unpack("<I", data[bin_off:bin_off + 4])[0]
    binary = data[bin_off + 8:bin_off + 8 + blen]

    image_views = {}
    for img in j.get("images", []):
        if "bufferView" in img:
            image_views[img["bufferView"]] = img

    out = bytearray()
    shrunk = 0
    for i, bv in enumerate(j["bufferViews"]):
        chunk = binary[bv.get("byteOffset", 0):bv.get("byteOffset", 0) + bv["byteLength"]]
        if i in image_views:
            img = image_views[i]
            im = Image.open(io.BytesIO(chunk))
            if max(im.size) > max_px:
                im.thumbnail((max_px, max_px), Image.LANCZOS)
                buf = io.BytesIO()
                if img.get("mimeType") == "image/jpeg":
                    im.convert("RGB").save(buf, "JPEG", quality=92)
                else:
                    im.save(buf, "PNG", optimize=True)
                chunk = buf.getvalue()
                shrunk += 1
        while len(out) % 4:
            out.append(0)
        bv["byteOffset"] = len(out)
        bv["byteLength"] = len(chunk)
        out += chunk
    while len(out) % 4:
        out.append(0)
    j["buffers"][0]["byteLength"] = len(out)

    js = json.dumps(j, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    while len(js) % 4:
        js += b" "
    total = 12 + 8 + len(js) + 8 + len(out)
    with open(dst, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<I", len(js)) + b"JSON" + js)
        f.write(struct.pack("<I", len(out)) + b"BIN\x00" + bytes(out))
    print(f"{dst}: {len(data) // 1048576} MB -> {total // 1048576} MB, {shrunk} textures downscaled")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 1024)
