# SliceDrop Reloaded Sharing Viewer

A local-first NIfTI sharing viewer built from SliceDrop Reloaded, ES6 JavaScript, and the NiiVue library.

## Features

- Load and visualize 3D medical imaging data directly in the browser
- Support for multiple file formats:
  - Volumes: `.nii`, `.nii.gz`, DICOM
  - Meshes: `.obj`, `.vtk`, `.stl`, FreeSurfer formats
  - Fiber tracks: `.trk`, `.tko`
- Interactive visualization with:
  - Multi-planar 2D views (axial, coronal, sagittal)
  - 3D rendering with adjustable camera and lighting
  - Volume and mesh controls
  - Color mapping and opacity controls
- No server processing - all visualization happens client-side
- Temporary embedded `.nvd` scene share links using WebRTC DataChannel transfer
- Small local signaling server for room setup only

## Getting Started

### Local Development

1. Clone this repository
2. Run the sharing server from this directory:
   ```
   npm start
   ```
3. Open your browser to `http://localhost:8080`

The server serves static files and relays temporary WebSocket signaling messages. It does not store or process NIfTI files.

### Usage

- Drag and drop supported files onto the interface
- After loading data, click `Share`
- Send the temporary link to another browser while keeping the sender tab open
- The receiver opens the link and receives the embedded NiiVue scene browser-to-browser
- Open a remote file directly with `?url=<encoded-file-url>`
- For URLs without a file extension, add `&name=scan.nii.gz`
- Use the control panels on the left to adjust visualization parameters
- Try the example datasets to explore different visualization options

Example:

```
http://localhost:8080/?url=https%3A%2F%2Fdrive.google.com%2Fuc%3Fexport%3Ddownload%26id%3D1UJSh_WconBoxKFI_UJHFJNuPw6YU0WsV&name=scan.nii.gz
```

## Project Structure

- `index.html` - Main entry point
- `css/` - Stylesheets
- `js/`
  - `index.js` - Application entry point
  - `share.js` - WebRTC sharing client
  - `viewer.js` - Main viewer component
  - `*Pane.js` - Control panel components for different data types
  - `dropHandler.js` - File drag-and-drop handling
  - `utils.js` - Utility functions
- `images/` - UI assets
- `matcaps/` - Materials for 3D rendering
- `server.js` - Static file server and WebSocket signaling rooms
