---
title: "camera.snapshot produces 0-byte files before video frames arrive"
category: automation-issues
date: 2026-03-26
tags: [camera, snapshot, streaming, eufy, timing]
---

# camera.snapshot produces 0-byte files before video frames arrive

## Problem

The `camera.snapshot` service produces empty (0-byte) JPEG files. The camera
entity shows a `streaming` state, but the saved file contains no image data.

## Root Cause

There is a race condition between the camera entity reporting `streaming`
state and actual video frame data being available. The camera entity
transitions to `streaming` as soon as the stream negotiation begins (RTSP
SETUP or P2P handshake), but the first decodable video frame arrives seconds
later.

Calling `camera.snapshot` during this gap captures a null frame, producing a
0-byte file. This is especially common with:
- Eufy cameras (P2P stream startup is slow)
- RTSP cameras behind go2rtc (transcoding startup delay)
- Any camera waking from idle/standby

## Solution

**In automations:**

Add a delay of at least 5 seconds after the streaming state is confirmed
before taking a snapshot:

```yaml
- wait_template: >
    {{ is_state('camera.front_door', 'streaming') }}
  timeout: "00:00:30"
- delay:
    seconds: 5
- action: camera.snapshot
  target:
    entity_id: camera.front_door
  data:
    filename: "/media/snapshots/front_door.jpg"
```

**In dashboard/frontend code:**

Wait for the `onPlaying` event on the video element rather than relying on
entity state:

```typescript
videoEl.addEventListener('playing', () => {
  // Now safe to capture frames
});
```

**Always validate file size after saving:**

```yaml
# In a Python script or shell_command
import os
if os.path.getsize(filepath) < 1000:
    os.remove(filepath)  # Discard empty/corrupt snapshot
```

## Prevention

- Never call `camera.snapshot` immediately after starting a stream.
- Use go2rtc's frame endpoint (`/api/frame.jpeg?src=SOURCE`) as an
  alternative — it waits for a decoded frame internally.
- In automated snapshot pipelines, always check file size and discard
  files under a minimum threshold (e.g., 1 KB).
