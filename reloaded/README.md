# SliceDrop Reloaded

Lightweight, browser-based medical imaging viewer powered by NiiVue.

<img width="1858" height="990" alt="image" src="https://github.com/user-attachments/assets/8514c290-77bc-4914-ac80-715a0ddd2293" />


## What It Does

- Drag and drop volumes, meshes, fibers, and `.nvd` scenes.
- Open remote files with `?url=<encoded-url>` and optional `&name=file.nii.gz`.
- Open examples automatically with `?example=1`, `?example=2`, or `?example=3`.
- Adjust volume, mesh, and fiber controls from the left panels.
- Save the current scene as an `.nvd`.
- Share a temporary scene link using WebRTC browser-to-browser transfer.

## Notes

- Visualization runs client-side.
- The WebSocket service is signaling only; it does not store imaging data.
- Remote URLs must allow browser access through CORS or a proxy.

## Example Links

The short links work on GitHub Pages and redirect to the viewer with an example identifier:

- [Tractography](https://slicedrop.edwardgaibor.me/reloaded/1/)
- [Axon volume with class segmentation](https://slicedrop.edwardgaibor.me/reloaded/2/)
- [Mesh statistics](https://slicedrop.edwardgaibor.me/reloaded/3/)

You can also use `https://slicedrop.edwardgaibor.me/reloaded/?example=2` directly.
Unknown example identifiers leave the landing page open. If both `url` and `example`
are provided, the remote `url` takes precedence.

## Local Run

```bash
npx http-server reloaded -p 8080
```

Then open `http://localhost:8080`.

## URL

```txt
https://slicedrop.edwardgaibor.me/reloaded/
```
