/**
 * suggestions.js
 * Renders design suggestion cards in the "Ideas" tab.
 * Each card shows the current sign text in a pre-set font+colour combination,
 * with a CSS neon-glow simulation. Clicking applies the combo to the canvas.
 */

/**
 * 12 curated font + colour combinations, grounded in real-world neon sign usage.
 * Each entry lists which industry contexts they suit best.
 */
const SUGGESTIONS = [
  {
    fontId:   'pacifico',
    colorId:  'hot-pink',
    label:    'Classic Neon',
    usecase:  'Bar · Restaurant · Retro',
    accent:   '#FF1493'
  },
  {
    fontId:   'sacramento',
    colorId:  'ice-blue',
    label:    'Elegant Script',
    usecase:  'Wedding · Boutique · Hotel',
    accent:   '#00BFFF'
  },
  {
    fontId:   'bebas-neue',
    colorId:  'warm-white',
    label:    'Industrial Bold',
    usecase:  'Gym · Office · Modern',
    accent:   '#FFE8C0'
  },
  {
    fontId:   'lobster',
    colorId:  'red',
    label:    'Diner Retro',
    usecase:  'Diner · Americana · Food',
    accent:   '#FF3333'
  },
  {
    fontId:   'dancing-script',
    colorId:  'purple',
    label:    'Vintage Glamour',
    usecase:  'Bar · Vintage · Events',
    accent:   '#BF00FF'
  },
  {
    fontId:   'righteous',
    colorId:  'orange',
    label:    'Neon Gaming',
    usecase:  'Gaming · Arcade · Studio',
    accent:   '#FF6B1A'
  },
  {
    fontId:   'satisfy',
    colorId:  'cool-white',
    label:    'Clean & Minimal',
    usecase:  'Spa · Wellness · Yoga',
    accent:   '#E8F4FF'
  },
  {
    fontId:   'great-vibes',
    colorId:  'hot-pink',
    label:    'Romantic Luxury',
    usecase:  'Wedding · Hotel · Events',
    accent:   '#FF1493'
  },
  {
    fontId:   'oswald',
    colorId:  'yellow',
    label:    'Bold Statement',
    usecase:  'Sports · Gym · Events',
    accent:   '#FFE500'
  },
  {
    fontId:   'permanent-marker',
    colorId:  'green',
    label:    'Street Art',
    usecase:  'Studio · Music · Creative',
    accent:   '#39FF14'
  },
  {
    fontId:   'boogaloo',
    colorId:  'orange',
    label:    'Fun & Playful',
    usecase:  'Kids · Family · Café',
    accent:   '#FF6B1A'
  },
  {
    fontId:   'raleway',
    colorId:  'ice-blue',
    label:    'Premium Minimal',
    usecase:  'Fashion · Luxury · Retail',
    accent:   '#00BFFF'
  }
];

class SuggestionEngine {

  constructor(listEl, onApply) {
    this.listEl  = listEl;
    this.onApply = onApply; // callback(fontId, colorId)
    this.text    = 'OPEN';
  }

  /** Re-render all cards with updated preview text. */
  render(text) {
    this.text = text || 'OPEN';
    this.listEl.innerHTML = '';

    SUGGESTIONS.forEach((sug, i) => {
      const font  = NEON_FONTS.find(f => f.id  === sug.fontId);
      const color = NEON_COLORS.find(c => c.id === sug.colorId);
      if (!font || !color) return;

      const card = this._buildCard(sug, font, color, i);
      this.listEl.appendChild(card);
    });
  }

  _buildCard(sug, font, color, index) {
    const card = document.createElement('div');
    card.className = 'sug-card';
    card.title = `Apply: ${font.name} + ${color.name}`;

    // Neon glow CSS text-shadow simulation
    const h   = color.hex === 'linear' ? '#FF1493' : color.hex;
    const g   = color.glow || h;
    const a1  = Math.round((color.glowOpacity || 0.7) * 255).toString(16).padStart(2,'0');
    const a2  = Math.round((color.glowOpacity || 0.7) * 0.4 * 255).toString(16).padStart(2,'0');

    const shadow = [
      `0 0 4px ${h}`,
      `0 0 12px ${h}${a1}`,
      `0 0 28px ${g}${a2}`,
      `0 0 50px ${g}33`
    ].join(', ');

    const previewText = this.text.replace(/\n/g, ' ');

    card.innerHTML = `
      <div class="sug-preview" style="
        font-family: '${font.family}', cursive;
        color: ${h};
        text-shadow: ${shadow};
      ">${this._escapeHtml(previewText)}</div>
      <div class="sug-meta">
        <span class="sug-font-name">${font.name}</span>
        <span class="sug-color-name">
          <span class="sug-color-dot" style="background:${h}; box-shadow:0 0 5px ${h}"></span>
          ${color.name}
        </span>
      </div>
      <div class="sug-usecase">${sug.usecase}</div>
    `;

    card.addEventListener('click', () => {
      this.onApply(sug.fontId, sug.colorId);
      this._flashCard(card);
    });

    return card;
  }

  _flashCard(card) {
    card.style.transition = 'background 0.1s';
    card.style.background = '#2a1a2e';
    setTimeout(() => { card.style.background = ''; }, 250);
  }

  _escapeHtml(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
