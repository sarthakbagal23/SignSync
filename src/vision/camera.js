// getUserMedia + <video> handling. Mirroring happens in CSS (#mirror) so the
// video and the overlay canvas always flip together.
export async function startCamera(videoEl, { width = 640, height = 480 } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw Object.assign(
      new Error("This browser does not expose a camera API."),
      { userFacing: true } // ponytail: only userFacing messages print raw to the UI
    );
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: width }, height: { ideal: height }, facingMode: "user" },
      audio: false,
    });
  } catch (err) {
    const msg =
      err.name === "NotAllowedError"
        ? "Camera permission was denied. Allow camera access in your browser, then reload."
        : err.name === "NotFoundError"
          ? "No camera was found on this device."
          : `Camera failed to start (${err.name ?? "unknown"}).`;
    throw Object.assign(new Error(msg, { cause: err }), { userFacing: true });
  }

  videoEl.srcObject = stream;
  await videoEl.play();
  return stream;
}
