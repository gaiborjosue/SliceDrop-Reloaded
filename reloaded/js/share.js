const CHUNK_SIZE = 64 * 1024;
const BUFFER_LIMIT = 4 * 1024 * 1024;
const ENABLE_SIGNALING = true;
const DEFAULT_SIGNALING_URL = "wss://ws.edwardgaibor.me";

export function initSharing({ loadReceivedFile, getShareFile }) {
  const ui = {
    panel: document.getElementById("sharePanel"),
    popover: document.getElementById("sharePopover"),
    button: document.getElementById("shareButton"),
    copyButton: document.getElementById("copyShareLink"),
    link: document.getElementById("shareLink"),
    status: document.getElementById("shareStatus"),
    progress: document.getElementById("shareProgress"),
    progressBar: document.getElementById("shareProgressBar"),
  };

  let localFile = null;
  let shareAvailable = false;
  let role = null;
  let roomId = getRoomIdFromLocation();
  let ws = null;
  let pc = null;
  let dc = null;
  let receiveMeta = null;
  let receiveBuffers = [];
  let receiveBytes = 0;
  let transferComplete = false;
  let copyResetTimer = null;

  ui.button.addEventListener("click", () => handleShareButton());
  ui.copyButton.addEventListener("click", () => copyShareLink());

  ui.panel.classList.add("hidden");
  collapsePopover();

  if (roomId) {
    role = "receiver";
    showPanel();
    openPopover();
    ui.button.disabled = true;

    if (ENABLE_SIGNALING) {
      setStatus("Waiting for sender...");
      connectSignaling().then(() => sendSignal({ type: "join", roomId }));
    } else {
      setStatus("Share links are temporarily disabled. Drop a local file to view it.");
    }
  }

  function setLocalFile(file) {
    localFile = file;
    shareAvailable = Boolean(file);
    transferComplete = false;
    resetProgress();
    resetLink();

    if (!shareAvailable) {
      hidePanel();
      ui.button.disabled = true;
      setStatus("Drop a .nii or .nii.gz file to share.");
      return;
    }

    showPanel();
    collapsePopover();
    ui.button.disabled = !ENABLE_SIGNALING;
    setStatus(ENABLE_SIGNALING
      ? "Ready to share scene."
      : "Scene loaded locally. Sharing is temporarily disabled.");
  }

  function setShareAvailable(available) {
    shareAvailable = Boolean(available);

    if (!shareAvailable) {
      hidePanel();
      ui.button.disabled = true;
      return;
    }

    showPanel();
    collapsePopover();
    ui.button.disabled = !ENABLE_SIGNALING;
    setStatus(ENABLE_SIGNALING
      ? "Ready to share scene."
      : "Scene loaded locally. Sharing is temporarily disabled.");
  }

  function handleShareButton() {
    if (role === "receiver") {
      togglePopover();
      return;
    }

    if (!ui.popover.classList.contains("hidden") && ui.link.value) {
      collapsePopover();
      return;
    }

    openPopover();

    if (!ui.link.value) {
      startSenderSession();
    }
  }

  async function startSenderSession() {
    if (!ENABLE_SIGNALING) {
      setStatus("Sharing is temporarily disabled. Local viewing still works.");
      return;
    }

    if (!shareAvailable) {
      setStatus("Load a scene first.");
      return;
    }

    role = "sender";
    transferComplete = false;
    resetProgress();
    ui.button.disabled = true;
    openPopover();
    setStatus("Creating share link...");

    try {
      await connectSignaling();
      sendSignal({ type: "create" });
    } catch (error) {
      ui.button.disabled = false;
      setStatus(`Could not connect to signaling server: ${error.message}`);
    }
  }

  function connectSignaling() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      ws = new WebSocket(getSignalingUrl());

      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", () => reject(new Error("WebSocket connection failed")), { once: true });
      ws.addEventListener("message", (event) => handleSignalingMessage(JSON.parse(event.data)));
      ws.addEventListener("close", () => {
        if (role === "sender" && roomId) {
          ui.button.disabled = false;
        }
      });
    });
  }

  async function handleSignalingMessage(message) {
    if (message.type === "created") {
      roomId = message.roomId;
      const url = makeShareUrl(roomId);
      ui.link.value = url;
      ui.link.classList.remove("hidden");
      ui.copyButton.classList.remove("hidden");
      openPopover();
      setStatus("Link ready. Keep this tab open.");
      return;
    }

    if (message.type === "joined") {
      setStatus("Connected to signaling room. Waiting for file...");
      return;
    }

    if (message.type === "peer-joined") {
      setStatus("Receiver joined. Starting peer connection...");
      await createPeer(true);
      return;
    }

    if (message.type === "peer-left") {
      if (transferComplete) {
        return;
      }

      setStatus(role === "sender" ? "Receiver disconnected." : "Sender disconnected.");
      closePeer();
      return;
    }

    if (message.type === "error") {
      openPopover();
      setStatus(message.message || "Sharing error.");
      ui.button.disabled = !localFile;
      return;
    }

    if (message.type === "signal") {
      await handlePeerSignal(message.payload);
    }
  }

  async function createPeer(isOfferer) {
    closePeer();

    pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.addEventListener("icecandidate", (event) => {
      if (event.candidate) {
        sendSignal({ type: "signal", roomId, payload: { candidate: event.candidate } });
      }
    });

    pc.addEventListener("connectionstatechange", () => {
      if (pc.connectionState === "connected") {
        setStatus(role === "sender" ? "Peer connected. Sending file..." : "Peer connected. Receiving file...");
      } else if (!transferComplete && ["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        setStatus("Peer connection ended.");
      }
    });

    if (isOfferer) {
      dc = pc.createDataChannel("nifti-file");
      setupDataChannel(dc);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal({ type: "signal", roomId, payload: { description: pc.localDescription } });
    } else {
      pc.addEventListener("datachannel", (event) => {
        dc = event.channel;
        setupDataChannel(dc);
      });
    }
  }

  async function handlePeerSignal(payload) {
    if (!pc) {
      await createPeer(false);
    }

    if (payload.description) {
      await pc.setRemoteDescription(payload.description);

      if (payload.description.type === "offer") {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal({ type: "signal", roomId, payload: { description: pc.localDescription } });
      }
    }

    if (payload.candidate) {
      await pc.addIceCandidate(payload.candidate);
    }
  }

  function setupDataChannel(channel) {
    channel.binaryType = "arraybuffer";

    channel.addEventListener("open", () => {
      if (role === "sender") {
        sendFile();
      }
    });

    channel.addEventListener("message", (event) => {
      if (typeof event.data === "string") {
        handleControlMessage(JSON.parse(event.data));
      } else {
        handleBinaryChunk(event.data);
      }
    });
  }

  async function sendFile() {
    if (!dc || dc.readyState !== "open") {
      return;
    }

    let fileToSend;
    try {
      setStatus("Packaging scene...");
      fileToSend = await Promise.resolve(getShareFile());
    } catch (error) {
      if (!localFile) {
        setStatus(`Could not package scene: ${error.message}`);
        return;
      }

      fileToSend = localFile;
    }

    dc.send(JSON.stringify({
      type: "meta",
      name: fileToSend.name,
      size: fileToSend.size,
      mimeType: fileToSend.type || "application/octet-stream",
    }));

    setStatus(`Sending ${fileToSend.name}...`);
    setProgress(0);

    let offset = 0;
    while (offset < fileToSend.size && dc.readyState === "open") {
      await waitForBuffer();
      const chunk = await fileToSend.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
      dc.send(chunk);
      offset += chunk.byteLength;
      setProgress(offset / fileToSend.size);
    }

    if (dc.readyState === "open") {
      dc.send(JSON.stringify({ type: "done" }));
      await waitForDrain();
      setStatus("Transfer sent. Waiting for receiver...");
      setProgress(1);
    }
  }

  function waitForBuffer() {
    if (dc.bufferedAmount < BUFFER_LIMIT) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const timer = setInterval(() => {
        if (!dc || dc.readyState !== "open" || dc.bufferedAmount < BUFFER_LIMIT) {
          clearInterval(timer);
          resolve();
        }
      }, 50);
    });
  }

  function handleControlMessage(message) {
    if (message.type === "received" && role === "sender") {
      transferComplete = true;
      setStatus("Transfer complete.");
      setProgress(1);
      finishShareSession();
      return;
    }

    if (message.type === "meta") {
      receiveMeta = message;
      receiveBuffers = [];
      receiveBytes = 0;
      transferComplete = false;
      setStatus(`Receiving ${message.name}...`);
      setProgress(0);
    }

    if (message.type === "done" && receiveMeta) {
      if (receiveBytes !== receiveMeta.size) {
        setStatus(`Transfer incomplete (${receiveBytes} of ${receiveMeta.size} bytes).`);
        return;
      }

      const file = new File(receiveBuffers, receiveMeta.name, {
        type: receiveMeta.mimeType || "application/octet-stream",
      });

      setStatus(`Loading ${receiveMeta.name}...`);
      Promise.resolve(loadReceivedFile(file))
        .then(() => {
          transferComplete = true;
          sendDataChannelMessage({ type: "received" });
          setStatus(`Loaded ${receiveMeta.name}.`);
          setTimeout(() => hidePanel({ force: true }), 800);
        })
        .catch((error) => setStatus(`Could not load ${receiveMeta.name}: ${error.message}`));
      setProgress(1);
    }
  }

  function handleBinaryChunk(chunk) {
    if (!receiveMeta) {
      return;
    }

    receiveBuffers.push(chunk);
    receiveBytes += chunk.byteLength;
    setProgress(receiveBytes / receiveMeta.size);
  }

  function sendSignal(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  function sendDataChannelMessage(message) {
    if (dc && dc.readyState === "open") {
      dc.send(JSON.stringify(message));
    }
  }

  function waitForDrain() {
    if (!dc || dc.readyState !== "open" || dc.bufferedAmount === 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const startedAt = Date.now();
      const timer = setInterval(() => {
        if (!dc || dc.readyState !== "open" || dc.bufferedAmount === 0 || Date.now() - startedAt > 30000) {
          clearInterval(timer);
          resolve();
        }
      }, 50);
    });
  }

  function closePeer() {
    if (dc) {
      dc.close();
      dc = null;
    }

    if (pc) {
      pc.close();
      pc = null;
    }
  }

  function setStatus(message) {
    ui.status.textContent = message;
  }

  function setProgress(value) {
    ui.progress.classList.remove("hidden");
    ui.progressBar.style.width = `${Math.max(0, Math.min(1, value)) * 100}%`;
  }

  function resetProgress() {
    ui.progress.classList.add("hidden");
    ui.progressBar.style.width = "0%";
  }

  async function copyShareLink() {
    const url = ui.link.value;
    if (!url) {
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      showCopiedState();
      setStatus("Link copied. Keep this tab open.");
    } catch (error) {
      ui.link.select();
      setStatus("Copy failed. The link is selected.");
    }
  }

  return {
    setLocalFile,
    setShareAvailable,
  };

  function showPanel() {
    ui.panel.classList.remove("hidden");
  }

  function hidePanel(options = {}) {
    if (role === "receiver" && !options.force) {
      return;
    }

    ui.panel.classList.add("hidden");
    collapsePopover();
    resetLink();
  }

  function openPopover() {
    ui.popover.classList.remove("hidden");
    ui.panel.classList.add("share-panel--open");
  }

  function collapsePopover() {
    ui.popover.classList.add("hidden");
    ui.panel.classList.remove("share-panel--open");
  }

  function togglePopover() {
    if (ui.popover.classList.contains("hidden")) {
      openPopover();
    } else {
      collapsePopover();
    }
  }

  function resetLink() {
    roomId = null;
    ui.link.classList.add("hidden");
    ui.copyButton.classList.add("hidden");
    ui.link.value = "";
    resetCopyState();
  }

  function finishShareSession() {
    setTimeout(() => {
      collapsePopover();
      resetProgress();
      resetLink();
      ui.button.disabled = !shareAvailable || !ENABLE_SIGNALING;

      if (ws) {
        ws.close();
        ws = null;
      }

      closePeer();
      role = null;
    }, 800);
  }

  function showCopiedState() {
    const icon = ui.copyButton.querySelector("img");
    if (!icon) {
      return;
    }

    icon.src = "./gfx/check.svg";
    ui.copyButton.classList.add("share-panel__icon-button--success");

    clearTimeout(copyResetTimer);
    copyResetTimer = setTimeout(resetCopyState, 1400);
  }

  function resetCopyState() {
    const icon = ui.copyButton.querySelector("img");
    if (!icon) {
      return;
    }

    clearTimeout(copyResetTimer);
    copyResetTimer = null;
    icon.src = "./gfx/copy.svg";
    ui.copyButton.classList.remove("share-panel__icon-button--success");
  }
}

function getSignalingUrl() {
  const params = new URLSearchParams(window.location.search);
  const configuredUrl = params.get("signal") || window.SLICEDROP_SIGNALING_URL || DEFAULT_SIGNALING_URL;

  if (configuredUrl) {
    return configuredUrl;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

function getRoomIdFromLocation() {
  const url = new URL(window.location.href);
  const queryRoom = url.searchParams.get("room");
  if (queryRoom) {
    return queryRoom;
  }

  const pathMatch = url.pathname.match(/^\/share\/([^/]+)$/);
  return pathMatch ? decodeURIComponent(pathMatch[1]) : null;
}

function makeShareUrl(roomId) {
  const url = new URL(window.location.href);
  const signal = url.searchParams.get("signal");
  url.search = "";
  url.searchParams.set("room", roomId);

  if (signal) {
    url.searchParams.set("signal", signal);
  }

  url.hash = "";
  return url.toString();
}
