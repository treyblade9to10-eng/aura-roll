'use strict';
// ---- static game data: tiers, auras, variants, biomes, shop, achievements ----

const TIERS = [
  { id: 'common',       name: 'Common',       min: 0,          color: '#aab4c3', glow: 0 },
  { id: 'uncommon',     name: 'Uncommon',     min: 10,         color: '#5fe08a', glow: 0.1 },
  { id: 'rare',         name: 'Rare',         min: 100,        color: '#46b3ff', glow: 0.25 },
  { id: 'epic',         name: 'Epic',         min: 1000,       color: '#b36bff', glow: 0.4 },
  { id: 'legendary',    name: 'Legendary',    min: 10000,      color: '#ffb02e', glow: 0.55 },
  { id: 'mythic',       name: 'Mythic',       min: 100000,     color: '#ff3d6e', glow: 0.7 },
  { id: 'exalted',      name: 'Exalted',      min: 1000000,    color: '#27f0e0', glow: 0.85 },
  { id: 'transcendent', name: 'Transcendent', min: 100000000,  color: '#ffffff', glow: 1 },
];

function tierOf(odds) {
  let t = TIERS[0];
  for (const x of TIERS) if (odds >= x.min) t = x;
  return t;
}
function tierIndex(odds) { return TIERS.indexOf(tierOf(odds)); }

// layers are drawn by fx.js. c = [main, secondary, accent]
const AURAS = [
  // ---- common
  { id: 'faint',    name: 'Faint',        odds: 2,    c: ['#9aa6b8', '#cfd6e2', '#ffffff'], layers: ['glow'],                       lore: 'A soft shimmer. Everybody starts somewhere.' },
  { id: 'breeze',   name: 'Breeze',       odds: 4,    c: ['#8fd8ff', '#d6f2ff', '#ffffff'], layers: ['glow', 'wisps'],              lore: 'A gentle wind curls around you.' },
  { id: 'moss',     name: 'Moss',         odds: 6,    c: ['#4fcf6a', '#a6f2a0', '#e8ffd0'], layers: ['glow', 'leaves'],             lore: 'Smells like a damp forest.' },
  { id: 'ember',    name: 'Ember',        odds: 8,    c: ['#ff8a3d', '#ffc36b', '#fff0c0'], layers: ['glow', 'embers'],             lore: 'Tiny sparks that never quite go out.' },
  // ---- uncommon
  { id: 'frost',    name: 'Frost',        odds: 12,   c: ['#7fe3ff', '#d9f8ff', '#ffffff'], layers: ['glow', 'snow'],               lore: 'Cold enough to fog the screen.' },
  { id: 'tide',     name: 'Tide',         odds: 18,   c: ['#2f8fff', '#6fc2ff', '#c9ecff'], layers: ['glow', 'rings', 'bubbles'],   lore: 'Pulls in and out like the ocean.' },
  { id: 'static',   name: 'Static',       odds: 25,   c: ['#ffe94d', '#fff6a8', '#ffffff'], layers: ['glow', 'lightning'],          lore: 'Your hair stands up. Worth it.' },
  { id: 'blossom',  name: 'Blossom',      odds: 35,   c: ['#ff8fc7', '#ffc2e3', '#fff0f8'], layers: ['glow', 'petals'],             lore: 'Spring, but in your pocket.' },
  { id: 'rust',     name: 'Rust',         odds: 45,   c: ['#c46a38', '#8a4526', '#ffb27a'], layers: ['glow', 'shards'],             lore: 'Old metal, new attitude.' },
  // ---- rare
  { id: 'ruby',     name: 'Ruby',         odds: 120,  c: ['#ff2f55', '#ff8aa0', '#ffe0e6'], layers: ['glow', 'orbit', 'stars'],     lore: 'A gem that actually hits.' },
  { id: 'sapphire', name: 'Sapphire',     odds: 200,  c: ['#2d5bff', '#79a0ff', '#e0e9ff'], layers: ['glow', 'orbit', 'rings'],     lore: 'Deep blue and spinning.' },
  { id: 'toxic',    name: 'Toxic',        odds: 320,  c: ['#a2ff2e', '#5fd100', '#f2ffc4'], layers: ['glow', 'bubbles', 'wisps'],   lore: 'Do not lick.' },
  { id: 'gilded',   name: 'Gilded',       odds: 500,  c: ['#ffd24a', '#fff0a8', '#ffffff'], layers: ['rays', 'glow', 'stars'],      lore: 'Pure gold, pure flex.' },
  { id: 'phantom',  name: 'Phantom',      odds: 750,  c: ['#b9a6ff', '#7a5cff', '#ece6ff'], layers: ['glow', 'wisps', 'eye'],       lore: 'Something is watching from the dark.' },
  // ---- epic
  { id: 'inferno',  name: 'Inferno',      odds: 1500, c: ['#ff5a1a', '#ffb02e', '#fff2a0'], layers: ['flames', 'embers'],           lore: 'The whole screen feels hot.' },
  { id: 'glacier',  name: 'Glacier',      odds: 2200, c: ['#58d6ff', '#b8f0ff', '#ffffff'], layers: ['glow', 'shards', 'snow'],     lore: 'A wall of ancient ice.' },
  { id: 'thunder',  name: 'Thunderlord',  odds: 3200, c: ['#ffe14a', '#6aa8ff', '#ffffff'], layers: ['glow', 'lightning', 'rings'], lore: 'The sky answers when you call.' },
  { id: 'eclipse',  name: 'Eclipse',      odds: 5000, c: ['#ffcf5a', '#ff7a1a', '#ffffff'], layers: ['moon', 'rays'],               lore: 'The sun hides. You do not.' },
  { id: 'sakura',   name: 'Sakura Storm', odds: 7500, c: ['#ff7fb8', '#ffc0dd', '#ffffff'], layers: ['glow', 'petals', 'wisps'],    lore: 'A thousand petals, one direction.' },
  // ---- legendary
  { id: 'nebula',   name: 'Nebula',       odds: 12000,  c: ['#a45bff', '#ff5bd1', '#5bc8ff'], layers: ['galaxy', 'stars'],          lore: 'A tiny galaxy that follows you.' },
  { id: 'solar',    name: 'Solar Flare',  odds: 20000,  c: ['#ffb300', '#ff4d00', '#fff7c2'], layers: ['rays', 'flames', 'rings'],  lore: 'Brighter than anything nearby.' },
  { id: 'abyss',    name: 'Abyss',        odds: 35000,  c: ['#1fa0ff', '#0b2a6b', '#9be3ff'], layers: ['void', 'bubbles', 'wisps'], lore: 'Down here the light gives up.' },
  { id: 'glitch',   name: 'Glitch',       odds: 50000,  c: ['#00ffd5', '#ff2bd6', '#ffffff'], layers: ['glitch', 'glow'],           lore: 'Reality.exe has stopped responding.' },
  { id: 'jade',     name: 'Jade Dragon',  odds: 75000,  c: ['#2fe08f', '#0a7a4d', '#c7ffe3'], layers: ['serpent', 'glow', 'stars'], lore: 'It circles you. It approves.' },
  // ---- mythic
  { id: 'supernova', name: 'Supernova',   odds: 150000, c: ['#fff1b8', '#ff8a2e', '#ff2e63'], layers: ['rays', 'rings', 'flames', 'stars'], lore: 'A star died so you could look this good.' },
  { id: 'voidwalker', name: 'Voidwalker', odds: 300000, c: ['#8a3dff', '#0a0014', '#d6b3ff'], layers: ['void', 'lightning', 'wisps'],      lore: 'Space bends where you stand.' },
  { id: 'borealis', name: 'Aurora Borealis', odds: 500000, c: ['#4dffb0', '#6a7dff', '#ff7ae0'], layers: ['aurora', 'stars', 'glow'],    lore: 'The northern lights, on demand.' },
  { id: 'chronos',  name: 'Chronos',      odds: 750000, c: ['#ffd98a', '#8a6a2a', '#ffffff'], layers: ['clock', 'rings', 'stars'],        lore: 'Time slows. Your rolls do not.' },
  // ---- exalted
  { id: 'celestia', name: 'Celestia',     odds: 2000000,  c: ['#fff6c9', '#9fd8ff', '#ffffff'], layers: ['rays', 'halo', 'stars', 'wisps'],   lore: 'Heaven called. You picked up.' },
  { id: 'treyblade', name: 'Treyblade',   odds: 9010000,  c: ['#27f0e0', '#ff3d6e', '#ffe14a'], layers: ['blades', 'lightning', 'glow'],    lore: 'Forged by the one who built this place.' },
  { id: 'oblivion', name: 'Oblivion',     odds: 5000000,  c: ['#ff1744', '#12000a', '#ffd0d8'], layers: ['void', 'flames', 'eye'],           lore: 'Nothing survives the look.' },
  { id: 'prismatic', name: 'Prismatic',   odds: 10000000, c: ['#ff4d4d', '#4dff88', '#4d7dff'], layers: ['prism', 'orbit', 'stars'],         lore: 'Every color at once.' },
  { id: 'rift',     name: 'Rift',         odds: 25000000, c: ['#7df9ff', '#ff00aa', '#ffffff'], layers: ['rift', 'glitch', 'lightning'],      lore: 'A crack in the world. Do not look inside.' },
  // ---- transcendent
  { id: 'genesis',  name: 'Genesis',      odds: 100000000,  c: ['#ffffff', '#ffe9a8', '#9fe8ff'], layers: ['halo', 'rays', 'galaxy', 'stars'], lore: 'The first light. Before everything.' },
  { id: 'infinity', name: 'Infinity',     odds: 500000000,  c: ['#ff5bd1', '#5be4ff', '#fff27a'], layers: ['infinity', 'prism', 'stars'],      lore: 'It never ends. Neither will you.' },
  { id: 'singularity', name: 'Singularity', odds: 1000000000, c: ['#ffffff', '#000000', '#ffd24a'], layers: ['singularity', 'rays', 'halo'],   lore: '1 in a billion. Go touch grass. Then come back.' },

  // ---- v1.1 additions
  { id: 'firefly',  name: 'Firefly Grove', odds: 14,    c: ['#d6ff5a', '#7dffa0', '#ffffff'], layers: ['glow', 'fireflies'],              lore: 'Little lanterns that follow you home.' },
  { id: 'sandstorm', name: 'Sandstorm',    odds: 22,    c: ['#e0b060', '#a8742c', '#fff0c0'], layers: ['glow', 'wisps', 'shards'],        lore: 'Gets everywhere. Absolutely everywhere.' },
  { id: 'neon',     name: 'Neon Pulse',    odds: 38,    c: ['#ff2bd6', '#2bd9ff', '#ffffff'], layers: ['glow', 'rings', 'slashes'],       lore: 'Open 24 hours.' },
  { id: 'mirage',   name: 'Mirage',        odds: 70,    c: ['#ffcf8a', '#ff8aa8', '#ffffff'], layers: ['glow', 'wisps', 'rings'],         lore: 'Is it real? Does it matter?' },
  { id: 'hex',      name: 'Cursed Seal',   odds: 160,   c: ['#9b4dff', '#ff3d8a', '#f0d8ff'], layers: ['runes', 'glow'],                  lore: 'Do not read the inscription out loud.' },
  { id: 'comet',    name: 'Comet Trail',   odds: 280,   c: ['#8fd8ff', '#ffffff', '#ffe08a'], layers: ['glow', 'comets'],                 lore: 'Make a wish. Make several.' },
  { id: 'feather',  name: 'Angel Feather', odds: 420,   c: ['#ffffff', '#cfe8ff', '#fff3b0'], layers: ['wings', 'glow', 'sparkle'],      lore: 'One feather. The whole sky follows.' },
  { id: 'venom',    name: 'Venom',         odds: 650,   c: ['#7dff2e', '#b300ff', '#e8ffd0'], layers: ['helix', 'bubbles', 'glow'],       lore: 'Two parts poison, one part style.' },
  { id: 'samurai',  name: 'Ronin',         odds: 900,   c: ['#ff3d4d', '#ffffff', '#ffd2d6'], layers: ['slashes', 'glow'],                lore: 'A single clean cut. Then silence.' },
  { id: 'warlock',  name: 'Warlock Circle', odds: 1900, c: ['#b84dff', '#ff7a1a', '#ffe0ff'], layers: ['runes', 'flames', 'embers'],     lore: 'Step outside the circle. I dare you.' },
  { id: 'whirl',    name: 'Whirlwind',     odds: 2700,  c: ['#6fe8c8', '#c8fff0', '#ffffff'], layers: ['vortex', 'wisps', 'glow'],        lore: 'Spins up out of nowhere.' },
  { id: 'meteor',   name: 'Meteor Shower', odds: 4200,  c: ['#ffb27a', '#ff5a1a', '#fff0c8'], layers: ['comets', 'flames', 'stars'],     lore: 'Duck.' },
  { id: 'katana',   name: 'Katana Storm',  odds: 6200,  c: ['#c8d8ff', '#4d6dff', '#ffffff'], layers: ['slashes', 'wisps', 'lightning'], lore: 'You never saw the blades. Just the aftermath.' },
  { id: 'regal',    name: 'Royal Crown',   odds: 9200,  c: ['#ffd24a', '#ff9a1a', '#fff6c0'], layers: ['crown', 'rays', 'stars', 'glow'], lore: 'Heavy is the head. Shiny is the crown.' },
  { id: 'archangel', name: 'Archangel',    odds: 15000, c: ['#fff3b8', '#9fd0ff', '#ffffff'], layers: ['wings', 'halo', 'rays', 'sparkle'], lore: 'Wings wide. Judgment pending.' },
  { id: 'genome',   name: 'Genome',        odds: 26000, c: ['#4dffd0', '#ff4dc8', '#ffffff'], layers: ['helix', 'galaxy', 'stars'],       lore: 'Your code, but upgraded.' },
  { id: 'demon',    name: 'Demon Lord',    odds: 32000, c: ['#ff1f3d', '#7a0014', '#ffb0a0'], layers: ['wings', 'flames', 'eye', 'embers'], lore: 'Technically a gift. Technically.' },
  { id: 'maelstrom', name: 'Maelstrom',    odds: 46000, c: ['#2f9bff', '#0a2a6b', '#e0f4ff'], layers: ['vortex', 'lightning', 'rain', 'rings'], lore: 'The sea has opinions.' },
  { id: 'sigil',    name: 'Arcane Sigil',  odds: 62000, c: ['#4dd2ff', '#a45bff', '#ffffff'], layers: ['runes', 'rings', 'stars', 'orbit'], lore: 'Old magic. Brand new swagger.' },
  { id: 'monarch',  name: 'Shadow Monarch', odds: 90000, c: ['#7a4dff', '#12002a', '#e0d0ff'], layers: ['void', 'crown', 'wisps', 'eye'], lore: 'Arise.' },
  { id: 'phoenix',  name: 'Phoenix',       odds: 130000, c: ['#ff8a1a', '#ff2e1a', '#fff0a0'], layers: ['wings', 'flames', 'embers', 'rays'], lore: 'Burns out. Comes back louder.' },
  { id: 'cosmocomet', name: 'Cosmic Comet', odds: 210000, c: ['#7aa8ff', '#ff7ae0', '#ffffff'], layers: ['galaxy', 'comets', 'stars'],   lore: 'A hundred-year visitor. It came for you.' },
  { id: 'reaper',   name: 'Reaper',        odds: 420000, c: ['#a8ffd8', '#0a2a1f', '#ffffff'], layers: ['slashes', 'void', 'eye', 'wisps'], lore: 'Your time is up. Politely.' },
  { id: 'dragoncrown', name: "Dragon's Crown", odds: 640000, c: ['#ff4d1a', '#ffd24a', '#fff2c0'], layers: ['crown', 'serpent', 'flames', 'glow'], lore: 'The dragon picked a ruler. Hi.' },
  { id: 'hurricane', name: 'Hurricane Eye', odds: 880000, c: ['#8fe8ff', '#1f6bff', '#ffffff'], layers: ['vortex', 'rain', 'lightning', 'halo'], lore: 'Dead calm in the middle of everything.' },
  { id: 'seraph',   name: 'Seraphim',      odds: 3000000, c: ['#fff6c9', '#ffb84d', '#ffffff'], layers: ['wings', 'halo', 'rays', 'orbit', 'stars'], lore: 'Six wings. All of them judging you.' },
  { id: 'worldbreak', name: 'Worldbreaker', odds: 6500000, c: ['#ff5a1a', '#2a0a00', '#ffe0b0'], layers: ['slashes', 'rift', 'flames', 'embers'], lore: 'The ground gave up first.' },
  { id: 'gate',     name: 'Dimension Gate', odds: 15000000, c: ['#5affc8', '#a45bff', '#ffffff'], layers: ['runes', 'rift', 'prism', 'stars'], lore: 'The door only opens from your side.' },
  { id: 'hypernova', name: 'Hypernova',    odds: 40000000, c: ['#ffffff', '#6ad0ff', '#ff6ad0'], layers: ['vortex', 'rays', 'rings', 'stars', 'halo'], lore: 'Brighter than every star you have ever seen.' },
  { id: 'bigbang',  name: 'Big Bang',      odds: 250000000, c: ['#ffffff', '#ffb84d', '#6ad0ff'], layers: ['singularity', 'vortex', 'rays', 'galaxy'], lore: 'It started with you. Probably.' },
  { id: 'omniverse', name: 'Omniverse',    odds: 750000000, c: ['#ff5bd1', '#5be4ff', '#fff27a'], layers: ['infinity', 'runes', 'galaxy', 'vortex', 'stars'], lore: 'Every universe. One of you each.' },
  { id: 'architect', name: 'The Architect', odds: 2500000000, c: ['#ffffff', '#27f0e0', '#ffd24a'], layers: ['runes', 'helix', 'crown', 'halo', 'rays', 'singularity'], lore: 'Nobody built this. Except them.' },

  // ---- biome exclusives (only roll while the biome is active)
  { id: 'starlit',   name: 'Starlit',      odds: 3000,    biome: 'night',    c: ['#9fb4ff', '#e8eeff', '#ffffff'], layers: ['glow', 'stars', 'moon'],       lore: 'Only appears after dark.' },
  { id: 'nocturne',  name: 'Nocturne',     odds: 40000,   biome: 'night',    c: ['#5b6bff', '#1b1f6b', '#e0e4ff'], layers: ['aurora', 'stars', 'wisps'],   lore: 'The night itself hums.' },
  { id: 'stormborn', name: 'Stormborn',    odds: 6000,    biome: 'storm',    c: ['#7aa8ff', '#2b3a6b', '#ffffff'], layers: ['rain', 'lightning', 'glow'],  lore: 'Born in a thunderhead.' },
  { id: 'tempest',   name: 'Tempest',      odds: 200000,  biome: 'storm',    c: ['#a8d0ff', '#ffe14a', '#ffffff'], layers: ['rain', 'lightning', 'rings', 'wisps'], lore: 'Eye of the storm. You are the eye.' },
  { id: 'permafrost', name: 'Permafrost',  odds: 8000,    biome: 'blizzard', c: ['#b8f0ff', '#58c8ff', '#ffffff'], layers: ['snow', 'shards', 'glow'],     lore: 'Frozen solid since forever.' },
  { id: 'abszero',   name: 'Absolute Zero', odds: 400000, biome: 'blizzard', c: ['#e8fbff', '#3ab0ff', '#ffffff'], layers: ['snow', 'rings', 'halo', 'shards'], lore: 'Nothing moves. Nothing can.' },
  { id: 'crimson',   name: 'Crimson Moon', odds: 1000000, biome: 'bloodmoon', c: ['#ff1f3d', '#5a0010', '#ffb3bf'], layers: ['moon', 'wisps', 'eye', 'glow'], lore: 'It only rises when the sky turns red.' },
  { id: 'error404',  name: 'Error 404',    odds: 404404,  biome: 'glitched', c: ['#00ff9d', '#ff0055', '#ffffff'], layers: ['glitch', 'glitch', 'glow'],   lore: 'Aura not found.' },
  { id: 'null',      name: 'NULL',         odds: 10000000, biome: 'glitched', c: ['#ffffff', '#000000', '#00ff9d'], layers: ['glitch', 'rift', 'eye'],     lore: 'undefined is not an aura.' },
  { id: 'dreamcatch', name: 'Dreamcatcher', odds: 15000,   biome: 'night',     c: ['#9b8cff', '#ffd2ff', '#ffffff'], layers: ['fireflies', 'moon', 'orbit', 'glow'], lore: 'Catches the good ones. Lets the rest go.' },
  { id: 'snowqueen', name: 'Frost Queen',  odds: 60000,   biome: 'blizzard',  c: ['#d8f6ff', '#6ad0ff', '#ffffff'], layers: ['crown', 'snow', 'shards', 'halo'],    lore: 'Let it go. Seriously. Let it all go.' },
  { id: 'thundergod', name: 'Thunder God', odds: 1500000, biome: 'storm',     c: ['#fff27a', '#5a8aff', '#ffffff'], layers: ['lightning', 'rain', 'vortex', 'rings'], lore: 'The storm kneels.' },
  { id: 'vampire',   name: 'Nightbloom',   odds: 3500000, biome: 'bloodmoon', c: ['#ff2a4a', '#2a0010', '#ffc0c8'], layers: ['wings', 'moon', 'wisps', 'eye'],      lore: 'It blooms when the moon bleeds.' },
  { id: 'segfault',  name: 'Segfault',     odds: 1337000, biome: 'glitched',  c: ['#00ff9d', '#ff0055', '#ffffff'], layers: ['glitch', 'slashes', 'rift'],          lore: 'Core dumped. Vibes intact.' },
];
const AURA_BY_ID = {};
AURAS.forEach(a => { a.tier = tierOf(a.odds); AURA_BY_ID[a.id] = a; });

// variants: independent chance on top of every roll
const VARIANTS = [
  { id: 'normal',   name: '',          chance: 1,    mult: 1,   color: null },
  { id: 'shiny',    name: 'Shiny',     chance: 30,   mult: 3,   color: '#ffe27a' },
  { id: 'inverted', name: 'Inverted',  chance: 300,  mult: 12,  color: '#ff6bff' },
  { id: 'void',     name: 'Void',      chance: 3000, mult: 60,  color: '#7a5cff' },
];
const VARIANT_BY_ID = {};
VARIANTS.forEach(v => VARIANT_BY_ID[v.id] = v);

const BIOMES = {
  normal:    { id: 'normal',    name: 'Meadow',     luck: 1,    weight: 0,   dur: [0, 0],     sky: ['#121a2e', '#1d2a48', '#2e4670'], fx: 'none',  desc: 'Calm and quiet.' },
  night:     { id: 'night',     name: 'Night',      luck: 1.25, weight: 30,  dur: [70, 130],  sky: ['#04061a', '#0a1038', '#161e5c'], fx: 'stars', desc: 'x1.25 luck. Starlit and Nocturne can roll.' },
  storm:     { id: 'storm',     name: 'Storm',      luck: 1.5,  weight: 22,  dur: [60, 100],  sky: ['#0c1220', '#1b2540', '#2a3558'], fx: 'rain',  desc: 'x1.5 luck. Stormborn and Tempest can roll.' },
  blizzard:  { id: 'blizzard',  name: 'Blizzard',   luck: 1.5,  weight: 22,  dur: [60, 100],  sky: ['#1a2a3c', '#34506b', '#6a8aa6'], fx: 'snow',  desc: 'x1.5 luck. Permafrost and Absolute Zero can roll.' },
  bloodmoon: { id: 'bloodmoon', name: 'Blood Moon', luck: 2,    weight: 6,   dur: [45, 70],   sky: ['#1a0206', '#3a0614', '#6a0f24'], fx: 'ash',   desc: 'x2 luck. RARE. Crimson Moon can roll.' },
  glitched:  { id: 'glitched',  name: 'GLITCHED',   luck: 3,    weight: 2,   dur: [35, 55],   sky: ['#001a14', '#00382b', '#06604a'], fx: 'glitch', desc: 'x3 luck. VERY RARE. Error 404 and NULL can roll.' },
};

// shop. cost(level) -> coins
const UPGRADES = [
  { id: 'luck',  name: 'Lucky Charm',    desc: '+6% luck per level',        max: 40, base: 120,  grow: 1.55, fmt: l => '+' + (l * 6) + '% luck' },
  { id: 'speed', name: 'Quick Hands',    desc: 'Faster roll cooldown',      max: 12, base: 250,  grow: 1.75, fmt: l => rollCooldown(l).toFixed(2) + 's cooldown' },
  { id: 'coins', name: 'Coin Magnet',    desc: '+12% coins per level',      max: 30, base: 200,  grow: 1.6,  fmt: l => '+' + (l * 12) + '% coins' },
  { id: 'auto',  name: 'Auto Roll',      desc: 'Unlocks the auto-roll toggle', max: 1, base: 3000, grow: 1,  fmt: l => l ? 'Unlocked' : 'Locked' },
  { id: 'skip',  name: 'Fast Reveals',   desc: 'Skip the long build-up on lower rarities', max: 1, base: 1500, grow: 1, fmt: l => l ? 'On' : 'Off' },
];
function rollCooldown(level) { return Math.max(0.3, 1.3 * Math.pow(0.84, level)); }

const POTIONS = [
  { id: 'luck1',  name: 'Luck Potion',        desc: 'x2 luck for 3 min',  kind: 'luck',  mult: 2,  secs: 180, cost: 900,    color: '#5fe08a' },
  { id: 'luck2',  name: 'Greater Luck Potion', desc: 'x4 luck for 3 min', kind: 'luck',  mult: 4,  secs: 180, cost: 14000,  color: '#46b3ff' },
  { id: 'luck3',  name: 'Divine Luck Potion', desc: 'x10 luck for 2 min', kind: 'luck',  mult: 10, secs: 120, cost: 300000, color: '#ffb02e' },
  { id: 'speed1', name: 'Haste Potion',       desc: 'Rolls twice as fast for 3 min', kind: 'speed', mult: 2, secs: 180, cost: 1500, color: '#ff3d6e' },
];

// achievements: check(state) -> bool. reward in coins
const ACHIEVEMENTS = [
  { id: 'r10',    name: 'Getting Started',   desc: 'Roll 10 times',        reward: 50,      check: s => s.rolls >= 10 },
  { id: 'r100',   name: 'Rolling',           desc: 'Roll 100 times',       reward: 400,     check: s => s.rolls >= 100 },
  { id: 'r1000',  name: 'Addicted',          desc: 'Roll 1,000 times',     reward: 6000,    check: s => s.rolls >= 1000 },
  { id: 'r10000', name: 'Touch Grass',       desc: 'Roll 10,000 times',    reward: 120000,  check: s => s.rolls >= 10000 },
  { id: 'rare',   name: 'Now We Are Talking', desc: 'Get a Rare aura',     reward: 300,     check: s => bestTier(s) >= 2 },
  { id: 'epic',   name: 'Epic Moment',       desc: 'Get an Epic aura',     reward: 2500,    check: s => bestTier(s) >= 3 },
  { id: 'legend', name: 'Legend',            desc: 'Get a Legendary aura', reward: 25000,   check: s => bestTier(s) >= 4 },
  { id: 'mythic', name: 'Mythical',          desc: 'Get a Mythic aura',    reward: 250000,  check: s => bestTier(s) >= 5 },
  { id: 'exalt',  name: 'Exalted One',       desc: 'Get an Exalted aura',  reward: 2500000, check: s => bestTier(s) >= 6 },
  { id: 'trans',  name: 'Beyond',            desc: 'Get a Transcendent aura', reward: 50000000, check: s => bestTier(s) >= 7 },
  { id: 'shiny',  name: 'Shiny!',            desc: 'Roll a Shiny variant', reward: 1000,    check: s => anyVariant(s, 'shiny') },
  { id: 'inv',    name: 'Plot Twist',        desc: 'Roll an Inverted variant', reward: 15000, check: s => anyVariant(s, 'inverted') },
  { id: 'void',   name: 'Into the Void',     desc: 'Roll a Void variant',  reward: 500000,  check: s => anyVariant(s, 'void') },
  { id: 'c10',    name: 'Collector',         desc: 'Discover 10 auras',    reward: 800,     check: s => discovered(s) >= 10 },
  { id: 'c25',    name: 'Curator',           desc: 'Discover 25 auras',    reward: 40000,   check: s => discovered(s) >= 25 },
  { id: 'c50',    name: 'Archivist',         desc: 'Discover 50 auras',    reward: 3000000,  check: s => discovered(s) >= 50 },
  { id: 'c70',    name: 'Hoarder',           desc: 'Discover 70 auras',    reward: 40000000, check: s => discovered(s) >= 70 },
  { id: 'cAll',   name: 'Completionist',     desc: 'Discover every aura',  reward: 100000000, check: s => discovered(s) >= AURAS.length },
  { id: 'biome',  name: 'Weather Watcher',   desc: 'Roll an aura exclusive to a biome', reward: 5000, check: s => AURAS.some(a => a.biome && s.index[a.id]) },
];

function bestTier(s) {
  let b = 0;
  for (const id in s.index) { const a = AURA_BY_ID[id]; if (a) b = Math.max(b, tierIndex(a.odds)); }
  return b;
}
function anyVariant(s, v) { return Object.keys(s.inv).some(k => k.endsWith(':' + v) && s.inv[k] > 0) || !!(s.variantsSeen && s.variantsSeen[v]); }
function discovered(s) { return Object.keys(s.index).length; }
