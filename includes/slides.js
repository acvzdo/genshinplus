(() => {
  const box = document.getElementById('slideshow');
  if (!box) return;
  const DIR = 'includes/images/slides/', TOTAL = 30, WEBP_UNTIL = 8;
  const INTERVAL = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 4500 : 2400;
  const urls = Array.from({ length: TOTAL }, (_, i) => `${DIR}${i + 1}.${i + 1 <= WEBP_UNTIL ? 'webp' : 'png'}`);

  const layers = [0, 1].map(() => { const im = document.createElement('img'); im.alt = ''; im.className = 'slide-img'; im.decoding = 'async'; box.appendChild(im); return im; });
  let idx = -1, top = 0, timer = null;

  const load = url => new Promise(res => { const p = new Image(); p.onload = () => res(true); p.onerror = () => res(false); p.src = url; });

  async function next() {
    for (let tries = 0; tries < TOTAL; tries++) {
      idx = (idx + 1) % TOTAL;
      if (await load(urls[idx])) {
        const incoming = layers[1 - top], outgoing = layers[top];
        incoming.src = urls[idx];
        incoming.classList.add('on'); outgoing.classList.remove('on');
        top = 1 - top;
        return;
      }
    }
  }

  const start = () => { if (!timer) timer = setInterval(next, INTERVAL); };
  const stop = () => { clearInterval(timer); timer = null; };
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  next().then(start);
})();
