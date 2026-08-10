// Generates the per-build social preview image (Open Graph / Twitter Card).
//
// Text is rendered through sharp's `text` input rather than SVG <text> because it
// goes through Pango: word wrapping is real and the rendered height comes back, so
// blocks can be stacked without guessing glyph widths.
//
// Requires at least one sans-serif font to be installed on the host (fontconfig).
// On a bare server: sudo apt install fonts-dejavu-core

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const WIDTH = 1200;
const HEIGHT = 630;

const FONT = 'DejaVu Sans';
const COLORS = {
  base: '#050c12',
  kicker: '#78bee8',
  title: '#ffffff',
  facts: '#cdd6e4',
  muted: '#9fb0c8',
  footer: '#8ca0be',
};

// Text column on the left, round medallion on the right
const TEXT_X = 80;
const TEXT_WIDTH = 640;
const MEDALLION_DIAMETER = 330;
const MEDALLION_CENTER = { x: 950, y: 315 };

const LOADING_SCREENS_DIR = path.join(__dirname, '../frontend/public/loading_screens');
const PORTRAITS_DIR = path.join(__dirname, '../frontend/public/portraits');
const ORIGIN_ICONS_DIR = path.join(__dirname, '../frontend/public/icons/origin_original');

// Backgrounds are listed once at startup; a build always gets the same one.
let _backgrounds = null;
function getBackgrounds() {
  if (_backgrounds === null) {
    try {
      _backgrounds = fs.readdirSync(LOADING_SCREENS_DIR)
        .filter(f => f.endsWith('.webp'))
        .sort();
    } catch {
      _backgrounds = [];
    }
  }
  return _backgrounds;
}

// Pango markup is XML, so these three characters must be escaped
function escapePango(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function truncate(value, maxLength) {
  const collapsed = String(value).replace(/\s+/g, ' ').trim();
  if (collapsed.length <= maxLength) return collapsed;
  return collapsed.slice(0, maxLength - 1).trimEnd() + '…';
}

// Renders one text block and reports the height it actually occupied, so the
// caller can stack the next block underneath it.
async function renderText(text, { size, weight = 'normal', color, width, letterSpacing }) {
  const attrs = [
    `foreground='${color}'`,
    weight !== 'normal' ? `weight='${weight}'` : null,
    letterSpacing ? `letter_spacing='${letterSpacing}'` : null,
  ].filter(Boolean).join(' ');

  const { data, info } = await sharp({
    text: {
      text: `<span ${attrs}>${escapePango(text)}</span>`,
      font: `${FONT} ${size}`,
      rgba: true,
      width,
      wrap: 'word',
      align: 'left',
    },
  }).png().toBuffer({ resolveWithObject: true });

  return { input: data, width: info.width, height: info.height };
}

// Loading screen, cover-fitted then darkened by a left-weighted gradient so the
// text column stays readable whatever the artwork behind it.
async function renderBackground(seed) {
  const backgrounds = getBackgrounds();
  let base;

  if (backgrounds.length) {
    const file = backgrounds[seed % backgrounds.length];
    base = sharp(path.join(LOADING_SCREENS_DIR, file))
      .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' });
  } else {
    base = sharp({
      create: { width: WIDTH, height: HEIGHT, channels: 3, background: COLORS.base },
    });
  }

  const gradient = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
      <defs>
        <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${COLORS.base}" stop-opacity="0.95" />
          <stop offset="55%" stop-color="${COLORS.base}" stop-opacity="0.82" />
          <stop offset="100%" stop-color="${COLORS.base}" stop-opacity="0.55" />
        </linearGradient>
      </defs>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#shade)" />
    </svg>`
  );

  return base
    .composite([{ input: gradient, top: 0, left: 0 }])
    .png()
    .toBuffer();
}

// Picks the artwork for the medallion: the chosen species portrait, or the origin
// illustration as a fallback. Only 6 of 49 existing builds have a portrait set, so
// the origin fallback is what most previews will actually show; every origin in use
// has an icon, which makes the medallion present on every build.
function resolveMedallionSource(build) {
  if (build.portrait) {
    const portrait = path.join(PORTRAITS_DIR, `${path.basename(build.portrait)}.png`);
    if (fs.existsSync(portrait)) return portrait;
  }
  if (build.origin) {
    const originIcon = path.join(ORIGIN_ICONS_DIR, `${path.basename(build.origin)}.png`);
    if (fs.existsSync(originIcon)) return originIcon;
  }
  return null;
}

// Round medallion.
//
// Both sources are opaque rectangles (the wiki portraits are bust crops on a
// per-species background, the origin icons are full illustrations), so pasting one
// as-is leaves a visible rectangle over the artwork. A circular mask hides that edge
// and gives every build the same framing whatever the source aspect ratio. The crop is
// top-anchored because portraits frame the head at the top (same choice as the
// frontend's objectPosition).
async function renderMedallion(build) {
  const file = resolveMedallionSource(build);
  if (!file) return null;

  const size = MEDALLION_DIAMETER;
  const radius = size / 2;

  try {
    const square = await sharp(file)
      .resize(size, size, { fit: 'cover', position: 'top' })
      .toBuffer();

    const mask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
        <circle cx="${radius}" cy="${radius}" r="${radius}" fill="#fff" />
      </svg>`
    );

    const ring = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
        <circle cx="${radius}" cy="${radius}" r="${radius - 2}"
                fill="none" stroke="${COLORS.kicker}" stroke-opacity="0.45" stroke-width="3" />
      </svg>`
    );

    const medallion = await sharp(square)
      .composite([
        { input: mask, blend: 'dest-in' },
        { input: ring, blend: 'over' },
      ])
      .png()
      .toBuffer();

    return {
      input: medallion,
      left: MEDALLION_CENTER.x - radius,
      top: MEDALLION_CENTER.y - radius,
    };
  } catch {
    return null;
  }
}

/**
 * Renders the preview image for one build.
 * All text is expected as plain text (already decoded from the DB's HTML entities).
 * Returns a JPEG buffer.
 */
async function renderBuildOgImage(build) {
  const layers = [];

  const [background, medallion] = await Promise.all([
    renderBackground(Number(build.id) || 0),
    renderMedallion(build),
  ]);

  const BAR_TOP = 172;
  let cursor = 168;

  const kicker = await renderText('STELLARIS BUILD', {
    size: 17, weight: 'bold', color: COLORS.kicker, width: TEXT_WIDTH, letterSpacing: 3000,
  });
  layers.push({ input: kicker.input, left: TEXT_X, top: cursor });
  cursor += kicker.height + 16;

  const title = await renderText(truncate(build.name || 'Stellaris Build', 54), {
    size: 44, weight: 'bold', color: COLORS.title, width: TEXT_WIDTH,
  });
  layers.push({ input: title.input, left: TEXT_X, top: cursor });
  cursor += title.height + 22;

  const facts = [build.originName && `${build.originName} origin`, build.authorityName]
    .filter(Boolean).join('  ·  ');
  if (facts) {
    const factsBlock = await renderText(facts, {
      size: 25, color: COLORS.facts, width: TEXT_WIDTH,
    });
    layers.push({ input: factsBlock.input, left: TEXT_X, top: cursor });
    cursor += factsBlock.height + 10;
  }

  const ethics = (build.ethicsNames || []).join(', ');
  if (ethics) {
    const ethicsBlock = await renderText(truncate(ethics, 70), {
      size: 21, color: COLORS.muted, width: TEXT_WIDTH,
    });
    layers.push({ input: ethicsBlock.input, left: TEXT_X, top: cursor });
    cursor += ethicsBlock.height;
  }

  // Accent bar spans the whole text block, so it grows with a two-line title
  const barHeight = Math.max(60, cursor - BAR_TOP - 4);
  layers.push({
    input: Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="6" height="${barHeight}">
        <rect width="6" height="${barHeight}" fill="${COLORS.kicker}" />
      </svg>`
    ),
    left: TEXT_X - 26,
    top: BAR_TOP,
  });

  // Footer is pinned to the bottom rather than stacked, so builds with short and
  // long names still line up.
  const footerParts = [
    build.gameVersion ? `Stellaris ${build.gameVersion}` : null,
    build.author ? `by ${truncate(build.author, 28)}` : null,
  ].filter(Boolean);
  if (footerParts.length) {
    const footer = await renderText(footerParts.join('  ·  '), {
      size: 21, color: COLORS.footer, width: TEXT_WIDTH,
    });
    layers.push({ input: footer.input, left: TEXT_X, top: HEIGHT - 130 });
  }

  const site = await renderText('stellaris-build.com', {
    size: 20, weight: 'bold', color: COLORS.kicker, width: TEXT_WIDTH,
  });
  layers.push({ input: site.input, left: TEXT_X, top: HEIGHT - 88 });

  if (medallion) layers.push(medallion);

  return sharp(background)
    .composite(layers)
    .jpeg({ quality: 86, progressive: true })
    .toBuffer();
}

module.exports = { renderBuildOgImage, WIDTH, HEIGHT };
