/**
 * color-config.js
 * LED strip colour inventory with glow simulation values.
 * Hex values are chosen to closely match real LED output on camera.
 */

const NEON_COLORS = [
  {
    id: 'warm-white',
    name: 'Warm White',
    hex: '#FFE8C0',
    glow: '#FFB347',
    glowOpacity: 0.6,
    description: 'Warm White — cosy & most popular',
    inventory: true
  },
  {
    id: 'cool-white',
    name: 'Cool White',
    hex: '#E8F4FF',
    glow: '#a0d0ff',
    glowOpacity: 0.5,
    description: 'Cool White — crisp, clean, modern',
    inventory: true
  },
  {
    id: 'hot-pink',
    name: 'Hot Pink',
    hex: '#FF1493',
    glow: '#FF1493',
    glowOpacity: 0.75,
    description: 'Hot Pink — vibrant, iconic neon look',
    inventory: true
  },
  {
    id: 'ice-blue',
    name: 'Ice Blue',
    hex: '#00BFFF',
    glow: '#00BFFF',
    glowOpacity: 0.7,
    description: 'Ice Blue — cool, tech, wedding',
    inventory: true
  },
  {
    id: 'red',
    name: 'Red',
    hex: '#FF3333',
    glow: '#FF0000',
    glowOpacity: 0.75,
    description: 'Red — bold, diner, attention-grabbing',
    inventory: true
  },
  {
    id: 'orange',
    name: 'Orange',
    hex: '#FF6B1A',
    glow: '#FF5500',
    glowOpacity: 0.7,
    description: 'Orange — warm, energetic, food & sport',
    inventory: true
  },
  {
    id: 'yellow',
    name: 'Yellow',
    hex: '#FFE500',
    glow: '#FFD700',
    glowOpacity: 0.65,
    description: 'Yellow — sunny, playful, high-visibility',
    inventory: true
  },
  {
    id: 'green',
    name: 'Green',
    hex: '#39FF14',
    glow: '#39FF14',
    glowOpacity: 0.75,
    description: 'Green — electric, gaming, eco brands',
    inventory: true
  },
  {
    id: 'purple',
    name: 'Purple',
    hex: '#BF00FF',
    glow: '#9900CC',
    glowOpacity: 0.75,
    description: 'Purple — luxe, mystical, vintage bar',
    inventory: true
  },
  {
    id: 'rgb-multi',
    name: 'RGB',
    hex: 'linear',  // special: rendered as gradient swatch
    glow: '#FF1493',
    glowOpacity: 0.6,
    description: 'RGB Colour-Change — app-controlled, versatile',
    inventory: true
  }
];

/**
 * Build a CSS background value for a colour swatch.
 * The 'rgb-multi' colour renders as a rainbow gradient.
 */
function swatchBackground(color) {
  if (color.id === 'rgb-multi') {
    return 'linear-gradient(135deg, #ff0000, #ff7700, #ffff00, #00ff00, #0000ff, #ff00ff)';
  }
  return color.hex;
}
