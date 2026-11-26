// build.mjs — turns news.json into entry.png, a 1024x1024 newspaper front page titled THE WORLD TODAY.
// The page is laid out as HTML (written to design/front.html) and photographed with a local Chromium-based
// browser running headless. This runs on the author's machine only: main.ts copies the committed entry.png,
// so the entry itself writes the same bytes every run, with no browser and no network.
//
//   node build.mjs            (BROWSER=<path> overrides the browser)

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const news = JSON.parse(readFileSync(join(root, 'news.json'), 'utf8'));
const { dateLong, footerRegions, index, lead, stories } = news;

if (stories.length !== 5) throw new Error(`expected 5 stories, found ${stories.length}`);
if (index.length !== 6) throw new Error(`expected 6 index lines, found ${index.length}`);
if (lead.stats.length !== 3) throw new Error(`expected 3 lead numbers, found ${lead.stats.length}`);

// news.json text is HTML-ish: it carries entities (&amp;) and <strong> in the deck. Keep exactly those two
// things and escape everything else, so a stray < in the news can never become markup.
const html = (s) =>
  String(s)
    .replace(/&(?!(?:[a-z]+|#\d+);)/gi, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;(\/?)strong&gt;/g, '<$1strong>');

// The length the reader sees, for the brief's "body about 100, index about 35 characters".
const plain = (s) => String(s).replace(/<[^>]+>/g, '').replace(/&[a-z]+;|&#\d+;/gi, 'x');
for (const s of stories) {
  const n = plain(s.body).length;
  if (n < 70 || n > 130) throw new Error(`body of "${s.headline}" is ${n} characters, want about 100`);
}
for (const line of index) {
  const n = plain(line).length;
  if (n < 20 || n > 45) throw new Error(`index line "${line}" is ${n} characters, want about 35`);
}

// One accent per story theme news.json uses; an unknown theme falls back to ink.
const THEME = { mkt: '#0d6b4c', dip: '#1d4f91', law: '#6a3d8f', sci: '#b0471a', me: '#a5361f' };
const accent = (t) => THEME[t] ?? '#222';

const statsHtml = lead.stats
  .map((s) => `<div class="stat"><div class="num">${html(s.value)}</div><div class="lbl">${html(s.label)}</div></div>`)
  .join('');

const storiesHtml = stories
  .map(
    (s) => `
    <article class="story" style="--c:${accent(s.theme)}">
      <div class="kick">${html(s.kicker)}</div>
      <div class="big">${html(s.big)}</div>
      <h3>${html(s.headline)}</h3>
      <p>${html(s.body)}</p>
    </article>`,
  )
  .join('');

const indexHtml = index
  .map((line, i) => `<li><span class="n">${i + 1}</span><span>${html(line)}</span></li>`)
  .join('');

const page = `<!doctype html>
<html><head><meta charset="utf-8"><title>THE WORLD TODAY</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1024px; height: 1024px; overflow: hidden; }
  /* A column that fills the square: the story grid takes whatever height the other bands leave. */
  body { background: #f3eee2; color: #1b1a17; font-family: Georgia, 'Times New Roman', serif; padding: 22px 28px 34px;
         display: flex; flex-direction: column; }

  header { text-align: center; }
  .ear { display: flex; justify-content: space-between; font: 600 11px/1 Arial, sans-serif; letter-spacing: .14em;
         text-transform: uppercase; color: #555; border-bottom: 1px solid #1b1a17; padding-bottom: 6px; }
  h1 { font: 700 78px/1 'Times New Roman', Georgia, serif; letter-spacing: .02em; margin: 8px 0 6px; }
  .dateline { display: flex; justify-content: space-between; align-items: center; border-top: 3px double #1b1a17;
              border-bottom: 3px double #1b1a17; padding: 5px 2px; font: italic 15px/1.2 Georgia, serif; }
  .dateline b { font: 700 15px/1.2 Georgia, serif; font-style: normal; }

  .lead { display: grid; grid-template-columns: 1fr 318px; gap: 26px; padding: 20px 0 18px; border-bottom: 2px solid #1b1a17; }
  .lead .kick { font: 700 13px/1 Arial, sans-serif; letter-spacing: .12em; text-transform: uppercase; color: #a5361f; }
  .lead h2 { font: 900 64px/0.96 'Times New Roman', Georgia, serif; margin: 12px 0 16px; letter-spacing: -.01em; }
  .lead .deck { font: 21px/1.38 Georgia, serif; color: #2a2925; }
  .lead .deck strong { color: #a5361f; }
  .stats { display: grid; grid-template-rows: repeat(3, 1fr); border-left: 1px solid #1b1a17; padding-left: 22px; }
  .stat { display: flex; align-items: baseline; gap: 12px; border-bottom: 1px solid #c9c1ad; }
  .stat:last-child { border-bottom: 0; }
  .num { font: 700 54px/1.05 'Times New Roman', Georgia, serif; color: #a5361f; min-width: 140px; text-align: right; }
  .lbl { font: 700 13px/1.15 Arial, sans-serif; text-transform: uppercase; letter-spacing: .08em; color: #333; }

  .grid { flex: 1; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); padding: 16px 0;
          border-bottom: 2px solid #1b1a17; }
  .story { padding: 0 12px; border-left: 1px solid #c9c1ad; display: flex; flex-direction: column; }
  .story:first-child { border-left: 0; padding-left: 0; }
  .story:last-child { padding-right: 0; }
  .story .kick { font: 700 10.5px/1.2 Arial, sans-serif; letter-spacing: .1em; text-transform: uppercase; color: var(--c);
                 border-top: 5px solid var(--c); padding-top: 7px; }
  /* The big figure sits on a tinted band; Arial Narrow keeps "KOSPI −6.2%" inside a fifth of the page. */
  .story .big { font: 700 34px/1.1 'Arial Narrow', Arial, sans-serif; color: var(--c); margin: 12px 0 12px;
                white-space: nowrap; overflow: hidden; }
  .story h3 { font: 700 18.5px/1.16 Georgia, serif; margin-bottom: 12px; }
  .story p { font: 16.5px/1.5 Georgia, serif; color: #2a2925; }

  .index { display: grid; grid-template-columns: 112px 1fr; gap: 16px; padding: 14px 0 16px; }
  .index h4 { font: 900 22px/1 'Times New Roman', Georgia, serif; text-transform: uppercase; border-right: 1px solid #1b1a17;
              display: flex; flex-direction: column; justify-content: center; }
  .index h4 small { font: 600 10px/1.4 Arial, sans-serif; letter-spacing: .12em; color: #666; margin-top: 6px; }
  .index ol { list-style: none; display: grid; grid-template-columns: 1fr 1fr; column-gap: 30px; row-gap: 8px; }
  .index li { display: flex; gap: 10px; align-items: center; font: 17px/1.25 Georgia, serif;
              border-bottom: 1px dotted #a79f8c; padding-bottom: 6px; }
  .index .n { font: 700 13px/1 Arial, sans-serif; color: #f3eee2; background: #1b1a17; border-radius: 50%;
              width: 21px; height: 21px; display: inline-flex; align-items: center; justify-content: center; flex: none; }

  footer { position: absolute; left: 0; right: 0; bottom: 0; height: 34px; background: #1b1a17; color: #f3eee2;
           display: flex; justify-content: space-between; align-items: center; padding: 0 28px;
           font: 600 11px/1 Arial, sans-serif; letter-spacing: .12em; text-transform: uppercase; }
</style></head>
<body>
  <header>
    <div class="ear"><span>International Edition</span><span>World · Markets · Science</span><span>Daily Summary</span></div>
    <h1>THE WORLD TODAY</h1>
    <div class="dateline"><span>All the day's world news on one page</span><b>${html(dateLong)}</b><span>Six stories · One page</span></div>
  </header>

  <section class="lead">
    <div>
      <div class="kick">${html(lead.kicker)}</div>
      <h2>${html(lead.headline)}</h2>
      <p class="deck">${html(lead.deck)}</p>
    </div>
    <div class="stats">${statsHtml}</div>
  </section>

  <section class="grid">${storiesHtml}</section>

  <section class="index">
    <h4>Index<small>IN BRIEF TODAY</small></h4>
    <ol>${indexHtml}</ol>
  </section>

  <footer><span>THE WORLD TODAY</span><span>${html(footerRegions)}</span><span>${html(dateLong)}</span></footer>
</body></html>
`;

mkdirSync(join(root, 'design'), { recursive: true });
const htmlPath = join(root, 'design', 'front.html');
writeFileSync(htmlPath, page);

const candidates = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].filter(Boolean);
const browser = candidates.find((p) => existsSync(p));
if (!browser) throw new Error('no Chromium-based browser found; set BROWSER');

const out = join(root, 'entry.png');
execFileSync(browser, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--window-size=1024,1024',
  `--screenshot=${out}`,
  pathToFileURL(htmlPath).href,
], { stdio: 'ignore' });

const png = readFileSync(out);
const w = png.readUInt32BE(16);
const h = png.readUInt32BE(20);
const size = statSync(out).size;
if (w !== 1024 || h !== 1024) throw new Error(`entry.png is ${w}x${h}, want 1024x1024`);
if (size > 1048576) throw new Error(`entry.png is ${size} bytes, over 1 MiB`);
console.log(`entry.png ${w}x${h}, ${size} bytes`);
