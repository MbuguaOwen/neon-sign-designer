/**
 * font-config.js
 * Curated font library for LED neon sign design.
 * stripFactor: multiplier applied to bounding-box width to estimate LED strip length.
 *   Script/cursive fonts flow continuously → lower factor.
 *   Block/sans fonts have many separate vertical strokes → higher factor.
 */

const NEON_FONTS = [
  {
    id: 'pacifico',
    name: 'Pacifico',
    family: 'Pacifico',
    weight: 400,
    category: 'Cursive Script',
    description: 'Iconic flowing cursive — the definitive neon sign look',
    tags: ['bar', 'restaurant', 'retro', 'café', 'casual'],
    ledNotes: 'Excellent — continuous curves mimic how LED strips flow naturally',
    stripFactor: 1.6
  },
  {
    id: 'lobster',
    name: 'Lobster',
    family: 'Lobster',
    weight: 400,
    category: 'Bold Script',
    description: 'Heavy retro script — bold impact for diners and bars',
    tags: ['diner', 'bar', 'retro', 'americana', 'food'],
    ledNotes: 'Good — thick strokes suit chunky LED rope lights',
    stripFactor: 1.7
  },
  {
    id: 'dancing-script',
    name: 'Dancing Script',
    family: 'Dancing Script',
    weight: 700,
    category: 'Flowing Script',
    description: 'Natural flowing handwriting — versatile and friendly',
    tags: ['café', 'boutique', 'restaurant', 'brunch'],
    ledNotes: 'Very good — natural letterform flows suit flexible LED strips',
    stripFactor: 1.65
  },
  {
    id: 'sacramento',
    name: 'Sacramento',
    family: 'Sacramento',
    weight: 400,
    category: 'Thin Script',
    description: 'Delicate thin script — luxury, wedding, and boutique',
    tags: ['wedding', 'luxury', 'boutique', 'spa', 'elegant'],
    ledNotes: 'Note: requires thin-profile LED strips due to delicate letterforms',
    stripFactor: 1.9
  },
  {
    id: 'great-vibes',
    name: 'Great Vibes',
    family: 'Great Vibes',
    weight: 400,
    category: 'Calligraphic Script',
    description: 'Elaborate calligraphy — premium and romantic',
    tags: ['wedding', 'hotel', 'luxury', 'events', 'romantic'],
    ledNotes: 'Premium look — ensure LED minimum bend radius allows tight curves',
    stripFactor: 1.9
  },
  {
    id: 'satisfy',
    name: 'Satisfy',
    family: 'Satisfy',
    weight: 400,
    category: 'Clean Script',
    description: 'Clean cursive — contemporary minimal appeal',
    tags: ['spa', 'wellness', 'yoga', 'beauty', 'minimal'],
    ledNotes: 'Good proportions — medium thickness suits standard LED strips',
    stripFactor: 1.6
  },
  {
    id: 'bebas-neue',
    name: 'Bebas Neue',
    family: 'Bebas Neue',
    weight: 400,
    category: 'Bold Display',
    description: 'Tall all-caps block — industrial, gym, modern',
    tags: ['gym', 'office', 'industrial', 'modern', 'sports'],
    ledNotes: 'Best for channel letters — straight runs minimise LED bends',
    stripFactor: 2.2
  },
  {
    id: 'righteous',
    name: 'Righteous',
    family: 'Righteous',
    weight: 400,
    category: 'Retro Display',
    description: 'Retro rounded display — gaming, entertainment, fun',
    tags: ['gaming', 'entertainment', 'bar', 'arcade', 'sports'],
    ledNotes: 'Great — rounded corners are easy to route on acrylic',
    stripFactor: 2.0
  },
  {
    id: 'oswald',
    name: 'Oswald',
    family: 'Oswald',
    weight: 700,
    category: 'Condensed Bold',
    description: 'Condensed authoritative type — corporate and sports',
    tags: ['corporate', 'sports', 'gym', 'tech', 'events'],
    ledNotes: 'Efficient — condensed shapes mean less LED strip per letter',
    stripFactor: 2.0
  },
  {
    id: 'permanent-marker',
    name: 'Permanent Marker',
    family: 'Permanent Marker',
    weight: 400,
    category: 'Handwritten',
    description: 'Casual hand-drawn feel — studios and creative spaces',
    tags: ['studio', 'creative', 'music', 'art', 'casual'],
    ledNotes: 'Fun effect — irregular widths add character to the LED routing',
    stripFactor: 1.5
  },
  {
    id: 'boogaloo',
    name: 'Boogaloo',
    family: 'Boogaloo',
    weight: 400,
    category: 'Playful Display',
    description: 'Rounded and playful — family venues and fun brands',
    tags: ['kids', 'family', 'fun', 'entertainment', 'café'],
    ledNotes: 'Friendly curves — easy routing, good for indoor neon art',
    stripFactor: 1.8
  },
  {
    id: 'raleway',
    name: 'Raleway',
    family: 'Raleway',
    weight: 700,
    category: 'Geometric Sans',
    description: 'Elegant geometric type — fashion and luxury retail',
    tags: ['fashion', 'luxury', 'retail', 'boutique', 'hotel'],
    ledNotes: 'Clean geometric shapes make routing straightforward',
    stripFactor: 1.9
  }
];
