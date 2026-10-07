const rtcConfig = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

export function createPeerConnection({
  targetId,
  socket,
  roomCode,
  onDataChannel,
  onConnectionStateChange,
}) {
  const peer = new RTCPeerConnection(rtcConfig);

  // Store ICE candidates that arrive too early
  peer.pendingIceCandidates = [];

  // Send ICE candidates with classroom information
  peer.onicecandidate = (event) => {
    console.log("ICE candidate:", event.candidate);
    if (event.candidate) {
      socket.emit("webrtc-ice-candidate", {
        target: targetId,
        candidate: event.candidate,
        roomCode,
      });
    }
  };

  peer.onconnectionstatechange = () => {
    console.log(
      `WebRTC connection with ${targetId}:`,
      peer.connectionState
    );

    onConnectionStateChange?.(peer.connectionState);
  };

  peer.ondatachannel = (event) => {
    console.log("DataChannel received from:", targetId);
    onDataChannel?.(event.channel);
  };

  return peer;
}

// Safely add an ICE candidate
export async function addIceCandidateSafely(peer, candidate) {
  if (!peer.remoteDescription) {
    peer.pendingIceCandidates.push(candidate);
    return;
  }

  await peer.addIceCandidate(candidate);
}

// Process candidates received before remote description was ready
export async function flushPendingIceCandidates(peer) {
  while (
    peer.pendingIceCandidates.length > 0 &&
    peer.remoteDescription
  ) {
    const candidate = peer.pendingIceCandidates.shift();
    await peer.addIceCandidate(candidate);
  }
}