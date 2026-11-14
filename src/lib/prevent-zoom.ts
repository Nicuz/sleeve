const blockDocumentGesture = (event: Event) => {
  event.preventDefault();
};

export function installZoomGuards(doc: Document = document) {
  doc.addEventListener('gesturestart', blockDocumentGesture, { passive: false });
  doc.addEventListener('gesturechange', blockDocumentGesture, {
    passive: false,
  });
}
