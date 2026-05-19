# SliceDrop Reloaded

Lightweight, browser-based medical imaging viewer powered by NiiVue.

<img width="1858" height="990" alt="image" src="https://github.com/user-attachments/assets/8514c290-77bc-4914-ac80-715a0ddd2293" />


## What It Does

- Drag and drop volumes, meshes, fibers, and `.nvd` scenes.
- Open remote files with `?url=<encoded-url>` and optional `&name=file.nii.gz`.
- Adjust volume, mesh, and fiber controls from the left panels.
- Save the current scene as an `.nvd`.
- Share a temporary scene link using WebRTC browser-to-browser transfer.

## Notes

- Visualization runs client-side.
- The WebSocket service is signaling only; it does not store imaging data.
- Remote URLs must allow browser access through CORS or a proxy.

## Local Run

```bash
npx http-server reloaded -p 8080
```

Then open `http://localhost:8080`.

## URL

```txt
https://slicedrop.edwardgaibor.me/reloaded/
```
