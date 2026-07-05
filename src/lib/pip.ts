interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

export async function openTranslatorPictureInPicture({
  video,
  canvas,
  currentWord,
  transcript,
}: {
  video: HTMLVideoElement | null;
  canvas: HTMLCanvasElement | null;
  currentWord: string | null;
  transcript: string;
}) {
  if (window.documentPictureInPicture) {
    const pipWindow = await window.documentPictureInPicture.requestWindow({
      width: 420,
      height: 320,
    });
    pipWindow.document.body.innerHTML = "";
    const container = pipWindow.document.createElement("div");
    container.style.cssText =
      "margin:0;padding:14px;background:#0D1117;color:#F0F6FC;font:13px monospace;min-height:100vh";
    const title = pipWindow.document.createElement("div");
    title.textContent = "Gesture PiP";
    title.style.cssText =
      "font-size:11px;color:#8B949E;text-transform:uppercase;letter-spacing:.16em";
    const word = pipWindow.document.createElement("div");
    word.textContent = currentWord ?? "Listening...";
    word.style.cssText = "margin-top:12px;font-size:22px;font-weight:700";
    const text = pipWindow.document.createElement("div");
    text.textContent = transcript || "Transcript will appear here.";
    text.style.cssText = "margin-top:10px;line-height:1.5;color:#F0F6FC";
    const hint = pipWindow.document.createElement("div");
    hint.textContent = "Recognition continues in the main tab.";
    hint.style.cssText = "margin-top:14px;color:#8B949E";
    container.append(title, word, text, hint);
    pipWindow.document.body.appendChild(container);
    return;
  }

  if (video && "requestPictureInPicture" in video) {
    await video.requestPictureInPicture();
    return;
  }

  if (canvas?.captureStream) {
    const pipVideo = document.createElement("video");
    pipVideo.srcObject = canvas.captureStream(30);
    pipVideo.muted = true;
    await pipVideo.play();
    if ("requestPictureInPicture" in pipVideo) {
      await pipVideo.requestPictureInPicture();
      return;
    }
  }

  throw new Error("Picture-in-Picture is not supported in this browser.");
}
