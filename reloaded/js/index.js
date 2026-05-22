import * as niivue from "https://unpkg.com/@niivue/niivue@0.68.2/dist/index.js";
import "./util.js?v=20260518-custom-colormaps";
import { initSharing } from "./share.js?v=20260518-share-count";

window.niivue = niivue;

//
// FILE SELECT / DROP
//
const overlay = document.getElementById("dropZoneOverlay");
const selectbutton = document.getElementById("fileInput");
const landingpage = document.getElementById("landingContainer");
const viewer = document.getElementById("viewerContainer");
const sliceOrientationLabels = document.getElementById("sliceOrientationLabels");
const downloadNvdButton = document.getElementById("downloadNvdButton");
let hoveredSliceOrientation = null;
const shareController = initSharing({
    loadReceivedFile: (file) => loadFiles([file], { received: true }),
    getShareFile: () => createShareDocumentFile(),
});

window.shareController = shareController;

if (downloadNvdButton) {
    downloadNvdButton.addEventListener("click", () => downloadNvdScene());
}

if (selectbutton) {
    selectbutton.addEventListener("change", (e) => {
        loadFiles(e.target.files);
        e.target.value = "";
    });
}

window.addEventListener("dragenter", (e) => {
    e.preventDefault();
    e.stopPropagation();
    overlay.style.display = 'block';
});
window.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.x == 0 && e.y == 0) {
      overlay.style.display = 'none'; //hide when cursor leaves window
    }
});
window.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
});
window.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();

    overlay.style.display = 'none';

    console.log('files dropped', e.dataTransfer.files);

    loadFiles(e.dataTransfer.files);

});
// selectbutton.addEventListener("change", (e) => {

//     console.log('files selected', e.target.files);

//     window.eee = e;

//     var dataTransfer = new DataTransfer();

//     const mockDropEvent = {
//         preventDefault: () => {},
//         dataTransfer: {
//           files: e.target.files,
//         },
//     };

//     var de = new DragEvent('drop', mockDropEvent);

//     // var de = new DragEvent(e.type, e);
//     // // de.dataTransfer = {};
//     // window.ddd = de;
//     // de.dataTransfer.files = e.target.files;

//     document.getElementById('gl1').dispatchEvent(mockDropEvent);

//     // load(e.target.files);

// });

start();

function start() {
    //
    // START NIIVUE
    //
    const nv = new niivue.Niivue({
      backColor: [0.1, 0.1, 0.1, 1],
      show3Dcrosshair: false,
      onImageLoaded: (volume) => {

        setupUi();
        nv.setVolumeRenderIllumination(0);
        if (volume) {
          volume.fgcolor = volume.fgcolor || {r:1,g:1,b:1};
          volume.bgcolor = volume.bgcolor || {r:0,g:0,b:0};
        }

        showViewer();
        shareController.setShareAvailable(true);

      },
      onOverlayLoaded: () => {

        console.log('load overlay')

      },
      onMeshLoaded: (data) => {

        setupUi();

        showViewer();
        shareController.setShareAvailable(true);

      },
      onLocationChange: (data) => {
        
      }
    });

    nv.attachTo('gl1');
    nv.setHeroImage(7 * 0.1);
    nv.opts.fontMinPx = 18;
    nv.opts.fontSizeScaling = 0.45;
    nv.setIsOrientationTextVisible(true);
    nv.setShowAllOrientationMarkers(true);
    nv.setCornerOrientationText(false);
    // nv.opts.isOrientCube = true;
    nv.opts.isAntiAlias = true;
    nv.opts.crosshairWidth = 0.1;
    nv.opts.crosshairColor = [1.0, 1.0, 1.0, 1.0];
    nv.opts.yoke3Dto2DZoom = true
    nv.opts.multiplanarEqualSize = true;
    // nv.opts.gradientOrder = 2;
    nv.setSliceType(nv.sliceTypeMultiplanar);
    nv.opts.clipPlaneColor = [180/255, 180/255, 180/255, 0.1];
    // nv.setClipPlane([-0.12, 180, 40]);
    nv.opts.dragMode = nv.dragModes.slicer3D;

    nv.setInterpolation(true);

    window.nv = nv;
    installSliceOrientationLabels(nv);

    loadInitialUrl();

}

async function loadExample(which) {

    if (which === 1) {
        await loadNiiVueTractographyExample();
        return;
    }

    if (which === 2) {
        await loadUrl("./gfx/example_axon.nvd");
        return;
    }

    if (which === 3) {
        await loadNiiVueMeshStatisticsExample();
        return;
    }

    loadUrl('https://fly.cs.umb.edu/data/X/example'+which+'.nvd');

}

async function loadNiiVueTractographyExample() {
    const baseUrl = "https://raw.githubusercontent.com/niivue/niivue/main/packages/niivue/demos/images/";

    await nv.loadVolumes([
        {
            url: baseUrl + "sub-01_ses-01_dwi_desc-b0_dwi.nii.gz",
            name: "sub-01_ses-01_dwi_desc-b0_dwi.nii.gz",
        },
    ]);
    await nv.loadMeshes([
        {
            url: baseUrl + "sub-01_ses-01_dwi_space-RASMM_model-probCSD_algo-AFQ_tractography.trx",
            name: "sub-01_ses-01_dwi_space-RASMM_model-probCSD_algo-AFQ_tractography.trx",
            rgba255: [0, 142, 0, 255],
        },
    ]);
    nv.setClipPlane([-0.1, 180, 0]);
    showViewer();
    shareController.setShareAvailable(true);

}

async function loadNiiVueMeshStatisticsExample() {
    const baseUrl = "https://raw.githubusercontent.com/niivue/niivue/main/packages/niivue/demos/images/";
    const meshLayers = [
        {
            url: baseUrl + "BrainMesh_ICBM152.lh.curv",
            colormap: "gray",
            cal_min: 0.3,
            cal_max: 0.5,
            opacity: 0.7,
        },
        {
            url: baseUrl + "BrainMesh_ICBM152.lh.motor.mz3",
            cal_min: 1.5,
            cal_max: 5,
            colormap: "green2orange",
            colormapNegative: "green2cyan",
            useNegativeCmap: true,
            opacity: 0.7,
            colormapType: 0,
        },
    ];

    nv.setSliceType(nv.sliceTypeRender);
    nv.opts.isColorbar = true;
    await nv.loadMeshes([
        {
            url: baseUrl + "BrainMesh_ICBM152.lh.mz3",
            name: "BrainMesh_ICBM152.lh.mz3",
            layers: meshLayers,
        },
    ]);

    if (nv.meshes.length > 0) {
        const mesh = nv.meshes[nv.meshes.length - 1];
        nv.setMeshLayerProperty(mesh.id, 0, "colorbarVisible", false);
        nv.setMeshLayerProperty(mesh.id, 1, "cal_min", 9);
        nv.setMeshLayerProperty(mesh.id, 1, "cal_max", 12);
    }

    showViewer();
    shareController.setShareAvailable(true);

}

async function loadUrl(url) {
    const fileName = getUrlFileName(url);

    if (isNvdUrl(url, fileName)) {
        const doc = await loadNvdFromUrl(url);
        await loadNvdDocument(doc);
        
    } else if (fileName) {
        await nv.loadImages([{ url, name: fileName }]);
    } else {
        await nv.loadFromUrl(url);
    }

    showViewer();
    shareController.setShareAvailable(true);

}

function loadInitialUrl() {
    const params = new URLSearchParams(window.location.search);
    const url = params.get("url");

    if (!url) {
        return;
    }

    loadUrl(url).catch((error) => {
        console.error("Failed to load URL", error);
    });
}

function getUrlFileName(url) {
    const params = new URLSearchParams(window.location.search);
    const explicitName = params.get("name");

    if (explicitName) {
        return explicitName;
    }

    try {
        const parsed = new URL(url);
        const pathName = decodeURIComponent(parsed.pathname.split("/").pop() || "");

        if (hasKnownNiiVueExtension(pathName)) {
            return pathName;
        }

        if (parsed.hostname === "drive.google.com" && parsed.pathname === "/uc") {
            return "volume.nii.gz";
        }

        if (parsed.hostname === "drive.usercontent.google.com" && parsed.pathname === "/download") {
            return "volume.nii.gz";
        }

        if (isGoogleDriveApiMediaUrl(parsed)) {
            return "volume.nii.gz";
        }

        const nestedUrl = parsed.searchParams.get("url");
        if (nestedUrl) {
            return getFileNameFromRemoteUrl(nestedUrl) || "volume.nii.gz";
        }
    } catch (error) {
        if (hasKnownNiiVueExtension(url)) {
            return url.split("/").pop();
        }
    }

    return "";
}

function getFileNameFromRemoteUrl(url) {
    try {
        const parsed = new URL(url);
        const pathName = decodeURIComponent(parsed.pathname.split("/").pop() || "");

        if (hasKnownNiiVueExtension(pathName)) {
            return pathName;
        }

        if (parsed.hostname === "drive.google.com" && parsed.pathname === "/uc") {
            return "volume.nii.gz";
        }

        if (parsed.hostname === "drive.usercontent.google.com" && parsed.pathname === "/download") {
            return "volume.nii.gz";
        }

        if (isGoogleDriveApiMediaUrl(parsed)) {
            return "volume.nii.gz";
        }
    } catch (error) {
        return "";
    }

    return "";
}

function isNvdUrl(url, fileName) {
    return /\.nvd$/i.test(fileName || url.split("?")[0]);
}

function hasKnownNiiVueExtension(fileName) {
    return /\.(nvd|nii|nii\.gz|nrrd|mif|mih|mgh|mgz|mhd|v\.gz|src\.gz|sz|obj|vtk|stl|ply|gii|x3d|wrl|mz3|off|trk|tck|trx|tsf|tt\.gz|niml\.tract)$/i.test(fileName);
}

function isGoogleDriveApiMediaUrl(parsedUrl) {
    return parsedUrl.hostname === "www.googleapis.com" &&
        /^\/drive\/v3\/files\/[^/]+$/.test(parsedUrl.pathname) &&
        parsedUrl.searchParams.get("alt") === "media";
}

async function loadFiles(files, options = {}) {

    var nv = window.nv;

    if (!files || files.length === 0) {
        return;
    }

    console.log('loading files', files);

    // SORT DATA BY SIZE, LARGE FILES FIRST
    files = Array.from(files);

    const sortedFiles = files.sort((a, b) => b.size - a.size);
    const primaryShareFile = sortedFiles.find((file) => isNiftiFile(file));

    if (!options.received) {
        shareController.setLocalFile(primaryShareFile || null);
    }

    let nvdoc = null;

    //
    // LOAD DATA
    //
    for (const file of sortedFiles) {

      const filename = file.name.toLowerCase();

      if (filename.endsWith('.nvd')) {
        // this is a saved scene
        nvdoc = await loadNvdFromFile(file);
      } else {
        await nv.loadFromFile(file);
      }
    }

    if (nvdoc) {
        await loadNvdDocument(nvdoc);
    }

    showViewer();
}

function isNiftiFile(file) {
    return file && /\.nii(\.gz)?$/i.test(file.name);
}

function createShareDocumentFile() {
    if (!window.nv || (nv.volumes.length === 0 && nv.meshes.length === 0)) {
        throw new Error("No scene is loaded.");
    }

    syncSliceDropSceneMetadata();
    const data = nv.json();
    const blob = new Blob([JSON.stringify(data)], {
        type: "application/json",
    });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    return new File([blob], `slicedrop-scene-${timestamp}.nvd`, {
        type: "application/json",
    });
}

function downloadNvdScene() {
    if (!hasLoadedScene()) {
        return;
    }

    const filename = createNvdFilename();
    syncSliceDropSceneMetadata();

    if (typeof window.nv.saveDocument === "function") {
        window.nv.saveDocument(filename);
        return;
    }

    const data = window.nv.json();
    const blob = new Blob([JSON.stringify(data)], {
        type: "application/json",
    });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

function setDownloadAvailable(available) {
    if (!downloadNvdButton) {
        return;
    }

    downloadNvdButton.disabled = !available;
}

function hasLoadedScene() {
    return Boolean(
        window.nv &&
        (
            (Array.isArray(window.nv.volumes) && window.nv.volumes.length > 0) ||
            (Array.isArray(window.nv.meshes) && window.nv.meshes.length > 0)
        )
    );
}

function createNvdFilename() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    return `slicedrop-scene-${timestamp}.nvd`;
}

function syncSliceDropSceneMetadata() {
    if (!window.nv || !window.nv.document) {
        return;
    }

    const customData = parseSliceDropCustomData(window.nv.document.customData);
    customData.sliceDropReloaded = {
        version: 1,
        customColormaps: window.getSliceDropCustomColormaps
            ? window.getSliceDropCustomColormaps()
            : {},
    };
    window.nv.document.customData = JSON.stringify(customData);
}

function restoreSliceDropSceneMetadata(doc) {
    const customData = parseSliceDropCustomData(doc && doc.customData);
    const metadata = customData.sliceDropReloaded || {};
    const customColormaps = metadata.customColormaps || {};

    if (window.restoreSliceDropCustomColormaps) {
        window.restoreSliceDropCustomColormaps(window.nv, customColormaps);
    }
}

function parseSliceDropCustomData(value) {
    if (!value) {
        return {};
    }

    if (typeof value === "object") {
        return value;
    }

    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object"
            ? parsed
            : { userCustomData: value };
    } catch (error) {
        return { userCustomData: value };
    }
}

async function loadNvdFromUrl(url) {
    try {
        return await niivue.NVDocument.loadFromUrl(url);
    } catch (error) {
        return loadNvdFromArrayBuffer(await fetchArrayBuffer(url), error);
    }
}

async function loadNvdFromFile(file) {
    try {
        return await niivue.NVDocument.loadFromFile(file);
    } catch (error) {
        return loadNvdFromArrayBuffer(await file.arrayBuffer(), error);
    }
}

async function loadNvdFromArrayBuffer(arrayBuffer, originalError) {
    const dataString = niivue.NVUtilities.isArrayBufferCompressed(arrayBuffer)
        ? await niivue.NVUtilities.decompressArrayBuffer(arrayBuffer)
        : new TextDecoder().decode(arrayBuffer);
    const data = sanitizeNvdData(JSON.parse(dataString));

    console.warn("Recovered .nvd scene after sanitizing unsupported mesh data.", originalError);
    return await niivue.NVDocument.loadFromJSON(data);
}

async function fetchArrayBuffer(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch .nvd scene: ${response.status} ${response.statusText}`);
    }

    return response.arrayBuffer();
}

function sanitizeNvdData(data) {
    if (!data || typeof data !== "object") {
        return data;
    }

    if (!isStructuredClonePayload(data.meshesString)) {
        delete data.meshesString;
    }

    data.imageOptionsArray = Array.isArray(data.imageOptionsArray)
        ? data.imageOptionsArray
        : [];
    data.encodedImageBlobs = Array.isArray(data.encodedImageBlobs)
        ? data.encodedImageBlobs
        : [];

    return data;
}

function isStructuredClonePayload(value) {
    if (!value) {
        return false;
    }

    try {
        const parsed = typeof value === "string" ? JSON.parse(value) : value;
        return Array.isArray(parsed) && Array.isArray(parsed[0]);
    } catch (error) {
        return false;
    }
}

async function loadNvdDocument(doc) {
    restoreSliceDropSceneMetadata(doc);
    showViewer();
    await refreshViewerCanvas();
    await nv.loadDocument(doc);
    window.doc = doc;
    showViewer();
    await refreshViewerCanvas();
    shareController.setShareAvailable(true);
    console.log("Loaded scene!");
}

function showViewer() {
    //
    // SHOW VIEWER
    //
    landingpage.classList.add("hidden");
    viewer.classList.remove("hidden");
    setDownloadAvailable(hasLoadedScene());

}

function refreshViewerCanvas() {
    return new Promise((resolve) => {
        window.requestAnimationFrame(() => {
            if (typeof nv.resizeListener === "function") {
                nv.resizeListener();
            }

            if (typeof nv.updateGLVolume === "function") {
                nv.updateGLVolume();
            } else if (typeof nv.drawScene === "function") {
                nv.drawScene();
            }

            window.requestAnimationFrame(() => {
                if (typeof nv.resizeListener === "function") {
                    nv.resizeListener();
                }

                if (typeof nv.drawScene === "function") {
                    nv.drawScene();
                }

                resolve();
            });
        });
    });
}

function installSliceOrientationLabels(nv) {
    const drawScene = nv.drawScene.bind(nv);
    const canvas = nv.canvas;

    nv.drawScene = (...args) => {
        const result = drawScene(...args);
        updateSliceOrientationLabels(nv);
        return result;
    };

    if (canvas) {
        canvas.addEventListener("mousemove", (event) => {
            const nextHoveredSlice = getPointerSliceOrientation(nv, event);

            if (nextHoveredSlice !== hoveredSliceOrientation) {
                hoveredSliceOrientation = nextHoveredSlice;
                updateSliceOrientationLabels(nv);
            }
        });

        canvas.addEventListener("mouseleave", () => {
            if (hoveredSliceOrientation !== null) {
                hoveredSliceOrientation = null;
                updateSliceOrientationLabels(nv);
            }
        });
    }

    window.addEventListener("resize", () => {
        window.requestAnimationFrame(() => updateSliceOrientationLabels(nv));
    });
    window.requestAnimationFrame(() => updateSliceOrientationLabels(nv));
}

function updateSliceOrientationLabels(nv) {
    if (!sliceOrientationLabels || !nv.canvas || !Array.isArray(nv.screenSlices)) {
        return;
    }

    sliceOrientationLabels.replaceChildren();

    if (viewer.classList.contains("hidden") ||
        nv.opts.sliceType !== nv.sliceTypeMultiplanar ||
        hoveredSliceOrientation === null) {
        return;
    }

    const canvas = nv.canvas;
    const scaleX = canvas.width / canvas.clientWidth || 1;
    const scaleY = canvas.height / canvas.clientHeight || 1;
    const seenLabels = new Set();

    for (const slice of nv.screenSlices) {
        if (slice.axCorSag !== hoveredSliceOrientation) {
            continue;
        }

        const label = getSliceOrientationLabel(slice.axCorSag);
        const bounds = slice.leftTopWidthHeight;

        if (!label || seenLabels.has(label) || !Array.isArray(bounds)) {
            continue;
        }

        const [left, top, width, height] = bounds;

        if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
            continue;
        }

        seenLabels.add(label);

        const element = document.createElement("div");
        element.className = "slice-orientation-label";
        element.textContent = label;
        element.style.left = `${left / scaleX}px`;
        element.style.top = `${top / scaleY}px`;

        sliceOrientationLabels.appendChild(element);
    }
}

function getPointerSliceOrientation(nv, event) {
    if (!nv.canvas || !Array.isArray(nv.screenSlices)) {
        return null;
    }

    const canvas = nv.canvas;
    const rect = canvas.getBoundingClientRect();
    const scale = nv.uiData?.dpr || canvas.width / canvas.clientWidth || 1;
    const x = (event.clientX - rect.left) * scale;
    const y = (event.clientY - rect.top) * scale;

    for (const slice of nv.screenSlices) {
        const label = getSliceOrientationLabel(slice.axCorSag);
        const bounds = slice.leftTopWidthHeight;

        if (!label || !Array.isArray(bounds)) {
            continue;
        }

        const [left, top, width, height] = bounds;

        if (x >= left && y >= top && x <= left + width && y <= top + height) {
            return slice.axCorSag;
        }
    }

    return null;
}

function getSliceOrientationLabel(axCorSag) {
    if (axCorSag === 0) {
        return "Axial";
    }

    if (axCorSag === 1) {
        return "Coronal";
    }

    if (axCorSag === 2) {
        return "Sagittal";
    }

    return "";
}



window.loadUrl = loadUrl;
window.loadExample = loadExample;
window.loadFiles = loadFiles;
