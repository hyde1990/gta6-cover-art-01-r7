// Fixed scenes for screenshots: ?shot=editor shows the editor with a sample
// photo loaded; ?shot=cover shows the cover alone at the export size the
// query names. `photo` picks the procedural sample (samples/<photo>.jpg)
// and `caption` / `sub` the two caption lines. window.__shotReady is set
// once the cover has painted, so the screenshot driver can wait on it.
export async function runShot(shot, query, api) {
  const photo = query.get('photo') ?? 'pier';
  const caption = query.get('caption') ?? 'SIMIAN CITY';
  const sub = query.get('sub') ?? 'Cyber Jungle Nights';
  const layout = query.get('layout') ?? 'slash';
  const size = query.get('size') ?? 'square';
  api.setSize(size);
  api.setLayout(layout);
  api.setCaption(caption, sub);
  if (shot === 'cover') document.body.classList.add('shot-cover');
  await api.loadSample(`samples/${photo}.jpg`);
  api.redraw();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
