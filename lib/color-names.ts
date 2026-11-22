/**
 * Shade lookup for colour names an admin types ("Coffee Brown", "Baby Pink",
 * "Army Green"). Used by the product editor so a new colour starts with a
 * sensible swatch instead of grey. Fashion names first, then common words.
 */

const NAMED: Record<string, string> = {
  // Neutrals
  black: '#000000', 'jet black': '#0A0A0A', white: '#FFFFFF', 'off white': '#F5F2EA', 'off-white': '#F5F2EA',
  ivory: '#FFFFF0', cream: '#FFFDD0', bone: '#E3DAC9', ecru: '#C2B280', beige: '#D2B48C', sand: '#C2B280',
  stone: '#B8AE9C', taupe: '#8B7D6B', nude: '#D9B79C', 'skin tone': '#D9B79C', latte: '#C5A585', mocha: '#7B5B47',
  camel: '#C19A6B', tan: '#D2B48C', khaki: '#C3B091', champagne: '#F1E3C8', oatmeal: '#D8CBB5',
  grey: '#9CA3AF', gray: '#9CA3AF', 'light grey': '#D1D5DB', 'light gray': '#D1D5DB', 'dark grey': '#4B5563',
  'dark gray': '#4B5563', charcoal: '#36454F', ash: '#B2BEB5', silver: '#C0C0C0', 'blue black': '#23283C',
  // Browns
  brown: '#7B4B2A', 'chocolate': '#5C3317', 'chocolate brown': '#5C3317', coffee: '#6F4E37', 'coffee brown': '#6F4E37',
  'dark brown': '#4A2C1D', 'light brown': '#A67B5B', caramel: '#AF6F3A', cinnamon: '#9B5A2E', rust: '#B7410E',
  cognac: '#9A463D', chestnut: '#954535', walnut: '#5D432C', espresso: '#3C2A21', bronze: '#8C6A3F',
  // Reds and pinks
  red: '#D7263D', 'wine': '#722F37', 'wine red': '#722F37', burgundy: '#6F1B27', maroon: '#800000', 'cherry': '#990F02',
  'brick red': '#A23B2C', scarlet: '#E0312B', coral: '#FF7F66', salmon: '#FA8072', pink: '#EC4899',
  'baby pink': '#F4C2C2', 'light pink': '#F8C8DC', 'hot pink': '#FF3E9B', fuchsia: '#C2187A', magenta: '#C2187A',
  'dusty pink': '#D8A7A9', 'dusty rose': '#C9919A', rose: '#E8A0A8', blush: '#F2C4C0', peach: '#FFC3A0',
  'rose gold': '#B76E79', 'old rose': '#C08081',
  // Oranges and yellows
  orange: '#F97316', 'burnt orange': '#C46A35', tangerine: '#F28500', apricot: '#FBCEB1', amber: '#FFB000',
  yellow: '#F4D03F', 'butter yellow': '#F2E8A8', 'lemon': '#F3E35A', 'lemon yellow': '#F3E35A', mustard: '#D4A017',
  gold: '#D4AF37', 'golden': '#D4AF37', 'pale yellow': '#FAF3B0',
  // Greens
  green: '#2E8B57', 'army green': '#4B5320', olive: '#708238', 'olive green': '#708238', 'khaki green': '#8A865D',
  'forest green': '#228B22', 'bottle green': '#006A4E', 'emerald': '#009B77', 'emerald green': '#009B77',
  'mint': '#AAF0D1', 'mint green': '#AAF0D1', sage: '#9CAF88', 'sage green': '#9CAF88', 'lime': '#9ACD32',
  'lime green': '#9ACD32', 'dark green': '#1F4D2B', 'light green': '#90EE90', teal: '#14B8A6', 'jade': '#00A86B',
  // Blues
  blue: '#2F6FDF', navy: '#1F2A44', 'navy blue': '#1F2A44', 'royal blue': '#2B4BCB', 'baby blue': '#ADCCEC',
  'sky blue': '#87CEEB', 'light blue': '#ADD8E6', 'powder blue': '#B0E0E6', 'denim': '#4F6D8F', 'denim blue': '#4F6D8F',
  'cobalt': '#0047AB', 'cobalt blue': '#0047AB', turquoise: '#40E0D0', aqua: '#00C2C7', 'dark blue': '#1B2A5C',
  'midnight blue': '#191970', 'ice blue': '#D6ECF3', 'steel blue': '#4682B4',
  // Purples
  purple: '#7E3FBF', lilac: '#C8A2C8', lavender: '#B57EDC', violet: '#8F5BD6', plum: '#6B3E5A', mauve: '#B784A7',
  'dark purple': '#4B2A5C', eggplant: '#614051', grape: '#6F2DA8', orchid: '#DA70D6',
  // Metallic and misc
  'multi': '#B8A99A', 'multicolour': '#B8A99A', 'multicolor': '#B8A99A', 'leopard': '#C49A5E', 'animal print': '#C49A5E',
  'clear': '#F3F4F6', transparent: '#F3F4F6',
};

const KEYS = Object.keys(NAMED).sort((a, b) => b.length - a.length);

/** Lower-case, single spaces, no trailing punctuation. */
function normalise(name: string): string {
  return name.toLowerCase().replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Best-guess shade for a colour name, or null when the name means nothing to us.
 * "Coffee Brown" matches exactly; "Dark Coffee Brown" and "Navy Blue Stripes"
 * fall back to the longest known name inside them.
 */
export function shadeForColorName(name: string): string | null {
  const n = normalise(name);
  if (!n) return null;
  if (NAMED[n]) return NAMED[n];
  const words = ` ${n} `;
  for (const key of KEYS) {
    if (words.includes(` ${key} `)) return NAMED[key];
  }
  return null;
}

/** Split "Black, White and Navy Blue" or one name per line into separate colour names. */
export function splitColorNames(input: string): string[] {
  return input
    .split(/[,\n;]|\s+&\s+|\s+\/\s+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/\b\w/g, c => c.toUpperCase()));
}
