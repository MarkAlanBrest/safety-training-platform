function currentContentHeight() {
  const root = document.querySelector(".course-home-banner") as HTMLElement | null;
  const height = Math.ceil(
    Math.max(
      root?.getBoundingClientRect().height || 0,
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
    ),
  );
  return Math.max(36, height);
}

export function publishEmbedHeight(heightPx = currentContentHeight()) {
  try {
    if (window.frameElement instanceof HTMLIFrameElement) {
      window.frameElement.style.height = `${heightPx}px`;
      window.frameElement.style.minHeight = `${heightPx}px`;
      window.frameElement.style.maxHeight = "none";
    }
  } catch {
    // Cross-origin parent.
  }

  const payload = { subject: "lti.frameResize", height: heightPx };
  try {
    window.parent.postMessage(payload, "*");
    window.parent.postMessage(JSON.stringify(payload), "*");
  } catch {
    // Ignore.
  }
}

export function watchEmbedHeight() {
  const publish = () => publishEmbedHeight();
  publish();

  const observer = new ResizeObserver(() => publish());
  observer.observe(document.documentElement);
  if (document.body) observer.observe(document.body);
  const banner = document.querySelector(".course-home-banner");
  if (banner) observer.observe(banner);

  window.addEventListener("load", publish);
  return () => {
    observer.disconnect();
    window.removeEventListener("load", publish);
  };
}
