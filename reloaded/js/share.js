import { connect as connectSocketChannel } from "https://esm.sh/itty-sockets@0.9.3";

const CHUNK_SIZE = 64 * 1024;
const BUFFER_LIMIT = 4 * 1024 * 1024;
const ENABLE_SIGNALING = true;
const CHANNEL_PREFIX = "slicedrop-reloaded";

export function initSharing({ loadReceivedFile, getShareFile }) {
  const ui = {
    panel: document.getElementById("sharePanel"),
    popover: document.getElementById("sharePopover"),
    button: document.getElementById("shareButton"),
    copyButton: document.getElementById("copyShareLink"),
    refreshButton: document.getElementById("refreshShareLink"),
    transferCount: document.getElementById("shareTransferCount"),
    transferCountValue: document.getElementById("shareTransferCountValue"),
    link: document.getElementById("shareLink"),
    status: document.getElementById("shareStatus"),
    progress: document.getElementById("shareProgress"),
    progressBar: document.getElementById("shareProgressBar"),
  };

  let localFile = null;
  let shareAvailable = false;
  let role = null;
  let roomId = getRoomIdFromLocation();
  let signalingChannel = null;
  const clientId = createRoomId();
  let senderId = null;
  const senderPeers = new Map();
  const completedReceiverIds = new Set();
  let pc = null;
  let dc = null;
  let cachedShareFilePromise = null;
  let receiveMeta = null;
  let receiveBuffers = [];
  let receiveBytes = 0;
  let transferComplete = false;
  let copyResetTimer = null;

  ui.button.addEventListener("click", () => handleShareButton());
  ui.copyButton.addEventListener("click", () => copyShareLink());
  ui.refreshButton.addEventListener("click", () => refreshShareLink());

  ui.panel.classList.add("hidden");
  collapsePopover();

  if (roomId) {
    role = "receiver";
    showPanel();
    openPopover();
    ui.button.disabled = true;

    if (ENABLE_SIGNALING) {
      setStatus("Waiting for sender...");
      connectSignaling().catch((error) => {
        setStatus(`Could not connect to signaling relay: ${error.message}`);
      });
    } else {
      setStatus("Share links are temporarily disabled. Drop a local file to view it.");
    }
  }

  function setLocalFile(file) {
    localFile = file;
    shareAvailable = Boolean(file);
    transferComplete = false;
    cachedShareFilePromise = null;
    completedReceiverIds.clear();
    resetProgress();
    updateTransferCount();
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
    roomId = createRoomId();
    transferComplete = false;
    cachedShareFilePromise = null;
    completedReceiverIds.clear();
    closeSenderPeers();
    resetProgress();
    updateTransferCount();
    ui.button.disabled = true;
    openPopover();
    setStatus("Creating share link...");

    try {
      await connectSignaling();
      const url = makeShareUrl(roomId);
      ui.link.value = url;
      ui.link.classList.remove("hidden");
      ui.copyButton.classList.remove("hidden");
      ui.refreshButton.classList.remove("hidden");
      ui.button.disabled = false;
      openPopover();
      setStatus("Link ready. Keep this tab open for attendees.");
    } catch (error) {
      ui.button.disabled = false;
      setStatus(`Could not connect to signaling relay: ${error.message}`);
    }
  }

  function connectSignaling() {
    if (signalingChannel) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      if (!roomId) {
        reject(new Error("Missing share room."));
        return;
      }

      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          closeSignaling({ announce: false });
          reject(new Error("Timed out connecting to relay"));
        }
      }, 10000);

      signalingChannel = connectSocketChannel(getChannelName(roomId), {
        as: `${role}-${clientId}`,
      });

      signalingChannel
        .on("open", () => {
          settled = true;
          clearTimeout(timeout);
          announcePresence();
          resolve();
        })
        .on("hello", (event) => handleRelayMessage(event))
        .on("signal", (event) => handleRelayMessage(event))
        .on("bye", (event) => handleRelayMessage(event))
        .on("close", () => {
          if (role === "sender" && roomId) {
            ui.button.disabled = false;
          }
        });
    });
  }

  async function handleSignalingMessage(message) {
    if (message.type === "hello") {
      if (role === "receiver" && message.role === "sender") {
        senderId = message.senderId;
        setStatus("Connected to sender. Waiting for file...");
        sendSignal({ type: "hello" }, senderId);
      }

      if (role === "sender" && message.role === "receiver") {
        setStatus(`Receiver joined. Starting transfer ${senderPeers.size + 1}...`);
        await createSenderPeer(message.senderId);
      }

      return;
    }

    if (message.type === "bye") {
      if (role === "sender") {
        closeSenderPeer(message.senderId);
        setStatus(`Receiver left. ${completedReceiverIds.size} transfer${completedReceiverIds.size === 1 ? "" : "s"} complete.`);
        return;
      }

      if (transferComplete || (senderId && message.senderId !== senderId)) {
        return;
      }

      setStatus(role === "sender" ? "Receiver disconnected." : "Sender disconnected.");
      closePeer();
      return;
    }

    if (message.type === "peer-left") {
      if (role === "sender") {
        closeSenderPeer(message.senderId);
        setStatus(`Receiver disconnected. ${completedReceiverIds.size} transfer${completedReceiverIds.size === 1 ? "" : "s"} complete.`);
        return;
      }

      if (transferComplete || (senderId && message.senderId !== senderId)) {
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
      await handlePeerSignal(message.payload, message.senderId);
    }
  }

  function createPeerConnection(peer) {
    const connection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    connection.addEventListener("icecandidate", (event) => {
      if (event.candidate) {
        sendSignal(
          { type: "signal", roomId, payload: { candidate: event.candidate } },
          peer?.receiverId || senderId,
        );
      }
    });

    connection.addEventListener("connectionstatechange", () => {
      if (connection.connectionState === "connected") {
        setStatus(role === "sender" ? "Peer connected. Sending file..." : "Peer connected. Receiving file...");
      } else if (role === "sender" && ["failed", "closed"].includes(connection.connectionState)) {
        closeSenderPeer(peer?.receiverId);
      } else if (role === "sender" && connection.connectionState === "disconnected") {
        setStatus("A receiver connection was interrupted.");
      } else if (!transferComplete && ["failed", "closed", "disconnected"].includes(connection.connectionState)) {
        setStatus("Peer connection ended.");
      }
    });

    return connection;
  }

  async function createSenderPeer(receiverId) {
    if (!receiverId || senderPeers.has(receiverId) || completedReceiverIds.has(receiverId)) {
      return;
    }

    const peer = {
      receiverId,
      pc: null,
      dc: null,
      sending: false,
      transferComplete: false,
    };

    peer.pc = createPeerConnection(peer);
    peer.dc = peer.pc.createDataChannel("nifti-file");
    setupDataChannel(peer.dc, peer);
    senderPeers.set(receiverId, peer);

    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);
    sendSignal({ type: "signal", roomId, payload: { description: peer.pc.localDescription } }, receiverId);
  }

  async function createReceiverPeer() {
    closePeer();

    pc = createPeerConnection(null);
    pc.addEventListener("datachannel", (event) => {
      dc = event.channel;
      setupDataChannel(dc);
    });
  }

  async function handlePeerSignal(payload, fromId) {
    if (role === "sender") {
      const peer = senderPeers.get(fromId);

      if (!peer) {
        return;
      }

      if (payload.description) {
        await peer.pc.setRemoteDescription(payload.description);
      }

      if (payload.candidate) {
        await peer.pc.addIceCandidate(payload.candidate);
      }

      return;
    }

    if (!pc) {
      senderId = fromId;
      await createReceiverPeer();
    }

    if (payload.description) {
      await pc.setRemoteDescription(payload.description);

      if (payload.description.type === "offer") {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal({ type: "signal", roomId, payload: { description: pc.localDescription } }, senderId || fromId);
      }
    }

    if (payload.candidate) {
      await pc.addIceCandidate(payload.candidate);
    }
  }

  function setupDataChannel(channel, peer = null) {
    channel.binaryType = "arraybuffer";

    channel.addEventListener("open", () => {
      if (role === "sender") {
        sendFile(peer);
      }
    });

    channel.addEventListener("message", (event) => {
      if (typeof event.data === "string") {
        handleControlMessage(JSON.parse(event.data), peer);
      } else {
        handleBinaryChunk(event.data);
      }
    });
  }

  async function sendFile(peer) {
    if (!peer || peer.sending || peer.transferComplete || !peer.dc || peer.dc.readyState !== "open") {
      return;
    }

    peer.sending = true;

    let fileToSend;
    try {
      setStatus("Packaging scene...");
      fileToSend = await getCachedShareFile();
    } catch (error) {
      if (!localFile) {
        setStatus(`Could not package scene: ${error.message}`);
        peer.sending = false;
        return;
      }

      fileToSend = localFile;
    }

    peer.dc.send(JSON.stringify({
      type: "meta",
      name: fileToSend.name,
      size: fileToSend.size,
      mimeType: fileToSend.type || "application/octet-stream",
    }));

    setStatus(`Sending ${fileToSend.name}...`);
    setProgress(0);

    let offset = 0;
    while (offset < fileToSend.size && peer.dc.readyState === "open") {
      await waitForBuffer(peer.dc);
      const chunk = await fileToSend.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
      peer.dc.send(chunk);
      offset += chunk.byteLength;
      setProgress(offset / fileToSend.size);
    }

    if (peer.dc.readyState === "open") {
      peer.dc.send(JSON.stringify({ type: "done" }));
      await waitForDrain(peer.dc);
      setStatus("Transfer sent. Waiting for receiver to load...");
      setProgress(1);
    }
  }

  function waitForBuffer(channel) {
    if (channel.bufferedAmount < BUFFER_LIMIT) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const timer = setInterval(() => {
        if (!channel || channel.readyState !== "open" || channel.bufferedAmount < BUFFER_LIMIT) {
          clearInterval(timer);
          resolve();
        }
      }, 50);
    });
  }

  function handleControlMessage(message, peer = null) {
    if (message.type === "received" && role === "sender") {
      if (peer) {
        peer.transferComplete = true;
        completedReceiverIds.add(peer.receiverId);
        closeSenderPeer(peer.receiverId);
      }

      const count = completedReceiverIds.size;
      updateTransferCount();
      setStatus(`Transfer complete for ${count} receiver${count === 1 ? "" : "s"}. Link remains active.`);
      setProgress(1);
      setTimeout(() => {
        collapsePopover();
        resetProgress();
      }, 800);
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
          setTimeout(() => {
            hidePanel({ force: true });
            closeSignaling();
            closePeer();
            role = null;
          }, 800);
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

  function getCachedShareFile() {
    if (!cachedShareFilePromise) {
      cachedShareFilePromise = Promise.resolve(getShareFile());
    }

    return cachedShareFilePromise;
  }

  function sendSignal(message, targetId = null) {
    if (signalingChannel) {
      signalingChannel.send({
        ...message,
        senderId: clientId,
        targetId,
        role,
        roomId,
      });
    }
  }

  function sendDataChannelMessage(message) {
    if (dc && dc.readyState === "open") {
      dc.send(JSON.stringify(message));
    }
  }

  function waitForDrain(channel = dc) {
    if (!channel || channel.readyState !== "open" || channel.bufferedAmount === 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const startedAt = Date.now();
      const timer = setInterval(() => {
        if (!channel || channel.readyState !== "open" || channel.bufferedAmount === 0 || Date.now() - startedAt > 30000) {
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

  function closeSenderPeer(receiverId) {
    const peer = senderPeers.get(receiverId);

    if (!peer) {
      return;
    }

    senderPeers.delete(receiverId);

    if (peer.dc) {
      peer.dc.close();
    }

    if (peer.pc) {
      peer.pc.close();
    }
  }

  function closeSenderPeers() {
    for (const receiverId of senderPeers.keys()) {
      closeSenderPeer(receiverId);
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

  async function refreshShareLink() {
    if (role !== "sender" || !shareAvailable) {
      return;
    }

    ui.refreshButton.disabled = true;
    ui.copyButton.disabled = true;
    resetCopyState();
    resetProgress();
    setStatus("Creating new share link...");

    closeSignaling();
    closeSenderPeers();
    completedReceiverIds.clear();
    updateTransferCount();
    cachedShareFilePromise = null;
    transferComplete = false;
    roomId = createRoomId();

    try {
      await connectSignaling();
      ui.link.value = makeShareUrl(roomId);
      ui.link.classList.remove("hidden");
      ui.copyButton.classList.remove("hidden");
      ui.refreshButton.classList.remove("hidden");
      openPopover();
      setStatus("New link ready. Previous link is stale.");
    } catch (error) {
      setStatus(`Could not refresh share link: ${error.message}`);
    } finally {
      ui.refreshButton.disabled = false;
      ui.copyButton.disabled = false;
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
    senderId = null;
    completedReceiverIds.clear();
    updateTransferCount();
    ui.link.classList.add("hidden");
    ui.copyButton.classList.add("hidden");
    ui.refreshButton.classList.add("hidden");
    ui.link.value = "";
    resetCopyState();
  }

  function updateTransferCount() {
    const count = completedReceiverIds.size;

    ui.transferCountValue.textContent = String(count);

    if (role === "sender" && roomId && count > 0) {
      ui.transferCount.classList.remove("hidden");
    } else {
      ui.transferCount.classList.add("hidden");
    }
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

  function closeSignaling(options = {}) {
    const { announce = true } = options;

    if (!signalingChannel) {
      return;
    }

    if (announce) {
      sendSignal({ type: "bye" });
    }

    signalingChannel.close();
    signalingChannel = null;
  }

  function handleRelayMessage(event) {
    const message = event && typeof event.message === "object"
      ? event.message
      : event;

    if (!message || message.senderId === undefined || message.senderId === clientId) {
      return;
    }

    if (message.targetId && message.targetId !== clientId) {
      return;
    }

    if (message.roomId !== roomId) {
      return;
    }

    handleSignalingMessage(message).catch((error) => {
      console.error("Failed to handle signaling message", error);
    });
  }

  function announcePresence() {
    sendSignal({ type: "hello" });
    setTimeout(() => sendSignal({ type: "hello" }), 750);
  }
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
  url.search = "";
  url.searchParams.set("room", roomId);
  url.hash = "";
  return url.toString();
}

function getChannelName(roomId) {
  return `${CHANNEL_PREFIX}:${roomId}`;
}

function createRoomId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
