#!/usr/bin/env python3
"""
Download an image from a URL and upload it to a Mealie recipe.

Replaces Mealie's broken POST /api/recipes/{slug}/image scrape endpoint. That
endpoint uses httpx with HTTP/2; many image CDNs return a non-clean HTTP/2
stream close (PROTOCOL_ERROR) which leaves Mealie with a phantom image hash
but no actual file on disk. Python's stdlib urllib is HTTP/1.1-only, which
side-steps that whole class of bug; combined with PUT /api/recipes/{slug}/image
(multipart upload, which IS reliable in Mealie), we get a deterministic path.

Args (positional):
  1. slug          — Mealie recipe slug
  2. image_url     — source image URL
  3. mealie_url    — Mealie base URL (internal add-on hostname, e.g.
                     http://your-mealie-addon-slug:9000 — the slug is the
                     prefix of the add-on's hostname; find it in Settings →
                     Add-ons → Mealie → "Hostname", or in the add-on page URL)
  4. mealie_token  — Mealie API bearer token

HA's shell_command runs subprocess with shell=False, so env-prefix syntax
isn't available — everything has to come through argv. The script is
local-only (called from HA core), so token visibility in `ps` is a
non-concern in this homelab context.

Exit codes:
  0  uploaded successfully
  1  bad invocation / missing env
  2  download failed
  3  downloaded content too small / not an image
  4  upload returned non-2xx
  5  unexpected error
"""

from __future__ import annotations

import mimetypes
import os
import secrets
import sys
import urllib.error
import urllib.request
from urllib.parse import urlparse

# Most image CDNs return 403 for Python's default User-Agent. A common Chrome
# UA gets through cleanly without triggering anti-bot policies.
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
)

# Minimum plausible image size — anything smaller is almost certainly an error
# page, tracking pixel, or favicon, not the recipe hero shot the LLM intended.
MIN_IMAGE_BYTES = 1024

# Cap downloaded image size to avoid runaway memory if the URL returns
# something huge. 15 MB is a generous ceiling for a recipe photo.
MAX_IMAGE_BYTES = 15 * 1024 * 1024


def log(msg: str) -> None:
    """Send progress to stderr so it lands in HA logs (stdout would be parsed)."""
    print(f"[mealie-image] {msg}", file=sys.stderr)


def download_image(url: str) -> tuple[bytes, str]:
    """Fetch the URL with a browser-like UA, returning (bytes, content_type)."""
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "image/*,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        content_type = (resp.headers.get("Content-Type") or "image/jpeg").split(";")[0].strip()
        # Read with a cap. Anything beyond is truncated; we'll detect garbage
        # downstream by the size + content-type checks.
        data = resp.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise RuntimeError(f"image too large (> {MAX_IMAGE_BYTES} bytes)")
    return data, content_type


def filename_for(url: str, content_type: str) -> str:
    """Pick a sensible filename for the multipart upload field."""
    path = urlparse(url).path or ""
    candidate = os.path.basename(path) or "image"
    # If the URL has no extension, derive one from the content type so Mealie's
    # image-detection (which sniffs by extension first) doesn't choke.
    if "." not in candidate:
        ext = mimetypes.guess_extension(content_type) or ".jpg"
        candidate = f"image{ext}"
    return candidate


def upload_to_mealie(
    slug: str, data: bytes, filename: str, content_type: str,
    base_url: str, token: str,
) -> None:
    """Multipart-PUT the image bytes to Mealie's recipe image endpoint.

    Mealie's PUT schema REQUIRES both `image` (file) and `extension` (string)
    parts — the extension drives its server-side image-format detection and
    derived-thumbnail rendering. Without it, Mealie returns 422.
    """
    # Strip the leading dot from the file extension. Pull it from the filename
    # we picked (which we guaranteed has an extension above).
    ext = os.path.splitext(filename)[1].lstrip(".").lower() or "jpg"
    boundary = "----mealie-img-" + secrets.token_hex(8)
    body = b"".join([
        f"--{boundary}\r\n".encode(),
        f'Content-Disposition: form-data; name="image"; filename="{filename}"\r\n'.encode(),
        f"Content-Type: {content_type}\r\n\r\n".encode(),
        data,
        f"\r\n--{boundary}\r\n".encode(),
        b'Content-Disposition: form-data; name="extension"\r\n\r\n',
        ext.encode(),
        f"\r\n--{boundary}--\r\n".encode(),
    ])
    upload_url = f"{base_url.rstrip('/')}/api/recipes/{slug}/image"
    req = urllib.request.Request(
        upload_url,
        data=body,
        method="PUT",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Content-Length": str(len(body)),
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        status = resp.status
    if status >= 300:
        raise RuntimeError(f"Mealie returned HTTP {status}")


def main() -> int:
    if len(sys.argv) != 5:
        log(f"bad invocation: expected 4 args, got {len(sys.argv) - 1}")
        return 1

    slug = sys.argv[1].strip()
    image_url = sys.argv[2].strip()
    base_url = sys.argv[3].strip()
    token = sys.argv[4].strip()

    if not base_url or not token or not slug:
        log("slug / mealie_url / mealie_token must all be non-empty")
        return 1
    if not image_url:
        log("empty image_url — nothing to do")
        return 0  # not an error — just no image extracted

    log(f"slug={slug} url={image_url[:80]}")

    try:
        data, content_type = download_image(image_url)
    except urllib.error.HTTPError as exc:
        log(f"download HTTP {exc.code}: {exc.reason}")
        return 2
    except Exception as exc:
        log(f"download failed: {exc}")
        return 2

    if len(data) < MIN_IMAGE_BYTES:
        log(f"download too small ({len(data)} bytes) — probably not an image")
        return 3
    if not content_type.startswith("image/"):
        log(f"download not an image (content-type={content_type})")
        return 3

    filename = filename_for(image_url, content_type)

    try:
        upload_to_mealie(slug, data, filename, content_type, base_url, token)
    except urllib.error.HTTPError as exc:
        log(f"upload HTTP {exc.code}: {exc.read()[:300]!r}")
        return 4
    except Exception as exc:
        log(f"upload failed: {exc}")
        return 5

    log(f"uploaded {len(data)} bytes as {filename} ({content_type})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
