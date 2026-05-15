import * as niivue from "https://unpkg.com/@niivue/niivue@0.57.0/dist/index.js";
import "./util.js";
import { initSharing } from "./share.js";

window.niivue = niivue;

//
// FILE SELECT / DROP
//
const overlay = document.getElementById("dropZoneOverlay");
const selectbutton = document.getElementById("fileInput");
const landingpage = document.getElementById("landingContainer");
const viewer = document.getElementById("viewerContainer");
const shareController = initSharing({
    loadReceivedFile: (file) => loadFiles([file], { received: true }),
});

window.shareController = shareController;

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
      onImageLoaded: () => {

        setupUi();
        nv.setVolumeRenderIllumination(-1);
        nv.volumes[0].fgcolor = {r:1,g:1,b:1};
        nv.volumes[0].bgcolor = {r:0,g:0,b:0};

        showViewer();

      },
      onOverlayLoaded: () => {

        console.log('load overlay')

      },
      onMeshLoaded: (data) => {

        setupUi();

        showViewer();

      },
      onLocationChange: (data) => {
        
      }
    });

    nv.attachTo('gl1');
    nv.setHeroImage(7 * 0.1);
    nv.opts.textHeight = 0.02;
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

    loadInitialUrl();

}

function loadExample(which) {

    loadUrl('https://fly.cs.umb.edu/data/X/example'+which+'.nvd');

}

async function loadUrl(url) {
    const fileName = getUrlFileName(url);

    if (isNvdUrl(url, fileName)) {

        niivue.NVDocument.loadFromUrl(url).then((doc) => {
            nv.loadDocument(doc);
            window.doc = doc;
        });
        
    } else if (fileName) {
        await nv.loadImages([{ url, name: fileName }]);
    } else {
        await nv.loadFromUrl(url);
    }

    showViewer();

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
        nvdoc = await niivue.NVDocument.loadFromFile(file);
      } else {
        await nv.loadFromFile(file);
      }
    }

    if (nvdoc) {
        await nv.loadDocument(nvdoc);
        console.log('Loaded scene!');
    }

    showViewer();
}

function isNiftiFile(file) {
    return file && /\.nii(\.gz)?$/i.test(file.name);
}

function showViewer() {
    //
    // SHOW VIEWER
    //
    landingpage.classList.add("hidden");
    viewer.classList.remove("hidden");

}



window.loadUrl = loadUrl;
window.loadExample = loadExample;
window.loadFiles = loadFiles;
