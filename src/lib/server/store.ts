import type { AvoidanceHistoryEntry, Event, EventSummary, ID, Pairing, Participant, Presence, Round } from './types';

function now() { return Date.now(); }
function randomId(prefix = ''): ID { return prefix + Math.random().toString(36).slice(2, 10); }
function randomToken(): string { return crypto.getRandomValues(new Uint32Array(4)).join('-'); }

export const db = {
  events: new Map<ID, Event>(),
  participants: new Map<ID, Participant>(),
  presence: new Map<ID, Presence>(), // key: participantId
  rounds: new Map<ID, Round>(),
  pairings: new Map<ID, Pairing>(),
  eventRounds: new Map<ID, ID[]>(), // eventId -> roundIds
  roundPairs: new Map<ID, ID[]>(), // roundId -> pairingIds
  avoidance: new Map<string, AvoidanceHistoryEntry>(), // `${eventId}:${p1}:${p2}` sorted ids
};

export function createEvent(name: string, code: string): Event {
  const id = randomId('evt_');
  const adminKey = randomId('adm_');
  const event: Event = {
    id,
    name,
    code,
    status: 'open',
    settings: { avoidRepeatWindow: 3, oddHandling: 'waiting', hexLength: 2 },
    createdAt: now(),
    adminKey,
  };
  db.events.set(id, event);
  db.eventRounds.set(id, []);
  return event;
}

const EMOJIS = [
  { emoji: '🐶', name: 'Dog' },
  { emoji: '🐱', name: 'Cat' },
  { emoji: '🐭', name: 'Mouse' },
  { emoji: '🐹', name: 'Hamster' },
  { emoji: '🐰', name: 'Rabbit' },
  { emoji: '🦊', name: 'Fox' },
  { emoji: '🐻', name: 'Bear' },
  { emoji: '🐼', name: 'Panda' },
  { emoji: '🐨', name: 'Koala' },
  { emoji: '🐯', name: 'Tiger' },
  { emoji: '🦁', name: 'Lion' },
  { emoji: '🐮', name: 'Cow' },
  { emoji: '🐷', name: 'Pig' },
  { emoji: '🐸', name: 'Frog' },
  { emoji: '🐵', name: 'Monkey' },
  { emoji: '🐔', name: 'Chicken' },
  { emoji: '🐧', name: 'Penguin' },
  { emoji: '🐦', name: 'Bird' },
  { emoji: '🐤', name: 'Chick' },
  { emoji: '🦆', name: 'Duck' },
  { emoji: '🦅', name: 'Eagle' },
  { emoji: '🦉', name: 'Owl' },
  { emoji: '🦇', name: 'Bat' },
  { emoji: '🐺', name: 'Wolf' },
  { emoji: '🐗', name: 'Boar' },
  { emoji: '🐴', name: 'Horse' },
  { emoji: '🦄', name: 'Unicorn' },
  { emoji: '🐝', name: 'Bee' },
  { emoji: '🐛', name: 'Bug' },
  { emoji: '🦋', name: 'Butterfly' },
  { emoji: '🐌', name: 'Snail' },
  { emoji: '🐞', name: 'Ladybug' },
  { emoji: '🐢', name: 'Turtle' },
  { emoji: '🐍', name: 'Snake' },
  { emoji: '🦎', name: 'Lizard' },
  { emoji: '🦖', name: 'T-Rex' },
  { emoji: '🦕', name: 'Dinosaur' },
  { emoji: '🐙', name: 'Octopus' },
  { emoji: '🦑', name: 'Squid' },
  { emoji: '🦐', name: 'Shrimp' },
  { emoji: '🦞', name: 'Lobster' },
  { emoji: '🦀', name: 'Crab' },
  { emoji: '🐡', name: 'Blowfish' },
  { emoji: '🐠', name: 'Fish' },
  { emoji: '🐟', name: 'Goldfish' },
  { emoji: '🐬', name: 'Dolphin' },
  { emoji: '🐳', name: 'Whale' },
  { emoji: '🐋', name: 'Blue Whale' },
  { emoji: '🦈', name: 'Shark' },
  { emoji: '🐊', name: 'Crocodile' },
  { emoji: '🐅', name: 'Tiger Face' },
  { emoji: '🐆', name: 'Leopard' },
  { emoji: '🦓', name: 'Zebra' },
  { emoji: '🦍', name: 'Gorilla' },
  { emoji: '🦧', name: 'Orangutan' },
  { emoji: '🐘', name: 'Elephant' },
  { emoji: '🦛', name: 'Hippo' },
  { emoji: '🦏', name: 'Rhino' },
  { emoji: '🐪', name: 'Camel' },
  { emoji: '🐫', name: 'Two-Hump Camel' },
  { emoji: '🦒', name: 'Giraffe' },
  { emoji: '🦘', name: 'Kangaroo' },
  { emoji: '🦬', name: 'Bison' },
  { emoji: '🐃', name: 'Water Buffalo' },
  { emoji: '🐂', name: 'Ox' },
  { emoji: '🐄', name: 'Milk Cow' },
  { emoji: '🐎', name: 'Racing Horse' },
  { emoji: '🐖', name: 'Pig Face' },
  { emoji: '🐏', name: 'Ram' },
  { emoji: '🐑', name: 'Sheep' },
  { emoji: '🦙', name: 'Llama' },
  { emoji: '🐐', name: 'Goat' },
  { emoji: '🦌', name: 'Deer' },
  { emoji: '🐕', name: 'Dog Face' },
  { emoji: '🐩', name: 'Poodle' },
  { emoji: '🦮', name: 'Guide Dog' },
  { emoji: '🐕‍🦺', name: 'Service Dog' },
  { emoji: '🐈', name: 'Cat Face' },
  { emoji: '🐈‍⬛', name: 'Black Cat' },
  { emoji: '🦚', name: 'Peacock' },
  { emoji: '🦜', name: 'Parrot' },
  { emoji: '🦢', name: 'Swan' },
  { emoji: '🦩', name: 'Flamingo' },
  { emoji: '🕊', name: 'Dove' },
  { emoji: '🐇', name: 'Rabbit Face' },
  { emoji: '🦝', name: 'Raccoon' },
  { emoji: '🦨', name: 'Skunk' },
  { emoji: '🦡', name: 'Badger' },
  { emoji: '🦦', name: 'Otter' },
  { emoji: '🦥', name: 'Sloth' },
  { emoji: '🐁', name: 'Mouse Face' },
  { emoji: '🐀', name: 'Rat' },
  { emoji: '🐿', name: 'Chipmunk' },
  { emoji: '🦔', name: 'Hedgehog' },
  { emoji: '🌵', name: 'Cactus' },
  { emoji: '🌲', name: 'Pine Tree' },
  { emoji: '🌳', name: 'Tree' },
  { emoji: '🌴', name: 'Palm Tree' },
  { emoji: '🌱', name: 'Seedling' },
  { emoji: '🌿', name: 'Herb' },
  { emoji: '☘', name: 'Shamrock' },
  { emoji: '🍀', name: 'Four Leaf Clover' },
  { emoji: '🌾', name: 'Rice' },
  { emoji: '🌺', name: 'Hibiscus' },
  { emoji: '🌻', name: 'Sunflower' },
  { emoji: '🌹', name: 'Rose' },
  { emoji: '🌷', name: 'Tulip' },
  { emoji: '🌸', name: 'Cherry Blossom' },
  { emoji: '💐', name: 'Bouquet' },
  { emoji: '🍄', name: 'Mushroom' },
  { emoji: '🌰', name: 'Chestnut' },
  { emoji: '⭐', name: 'Star' },
  { emoji: '✨', name: 'Sparkles' },
  { emoji: '⚡', name: 'Lightning' },
  { emoji: '☀', name: 'Sun' },
  { emoji: '🌙', name: 'Moon' },
  { emoji: '🌈', name: 'Rainbow' },
  { emoji: '☁', name: 'Cloud' },
  { emoji: '⛅', name: 'Partly Cloudy' },
  { emoji: '⛈', name: 'Storm' },
  { emoji: '🌊', name: 'Wave' },
  { emoji: '💧', name: 'Droplet' },
  { emoji: '🔥', name: 'Fire' },
  { emoji: '❄', name: 'Snowflake' },
  { emoji: '🍎', name: 'Apple' },
  { emoji: '🍊', name: 'Orange' },
  { emoji: '🍋', name: 'Lemon' },
  { emoji: '🍌', name: 'Banana' },
  { emoji: '🍉', name: 'Watermelon' },
  { emoji: '🍇', name: 'Grapes' },
  { emoji: '🍓', name: 'Strawberry' },
  { emoji: '🍒', name: 'Cherry' },
  { emoji: '🍑', name: 'Peach' },
  { emoji: '🥭', name: 'Mango' },
  { emoji: '🍍', name: 'Pineapple' },
  { emoji: '🥥', name: 'Coconut' },
  { emoji: '🥝', name: 'Kiwi' },
  { emoji: '🍅', name: 'Tomato' },
  { emoji: '🥑', name: 'Avocado' },
  { emoji: '🌽', name: 'Corn' },
  { emoji: '🌶', name: 'Pepper' },
  { emoji: '🥒', name: 'Cucumber' },
  { emoji: '🥕', name: 'Carrot' },
  { emoji: '🥦', name: 'Broccoli' },
  { emoji: '🧄', name: 'Garlic' },
  { emoji: '🧅', name: 'Onion' },
  { emoji: '🍞', name: 'Bread' },
  { emoji: '🥐', name: 'Croissant' },
  { emoji: '🥖', name: 'Baguette' },
  { emoji: '🥨', name: 'Pretzel' },
  { emoji: '🧀', name: 'Cheese' },
  { emoji: '🍕', name: 'Pizza' },
  { emoji: '🍔', name: 'Burger' },
  { emoji: '🌭', name: 'Hot Dog' },
  { emoji: '🥪', name: 'Sandwich' },
  { emoji: '🌮', name: 'Taco' },
  { emoji: '🌯', name: 'Burrito' },
  { emoji: '🥙', name: 'Pita' },
  { emoji: '🍿', name: 'Popcorn' },
  { emoji: '🍦', name: 'Ice Cream' },
  { emoji: '🍩', name: 'Donut' },
  { emoji: '🍪', name: 'Cookie' },
  { emoji: '🎂', name: 'Cake' },
  { emoji: '🧁', name: 'Cupcake' },
  { emoji: '🍰', name: 'Shortcake' },
  { emoji: '🥧', name: 'Pie' },
  { emoji: '🍫', name: 'Chocolate' },
  { emoji: '🍬', name: 'Candy' },
  { emoji: '🍭', name: 'Lollipop' },
  { emoji: '🍮', name: 'Pudding' },
  { emoji: '🍯', name: 'Honey' },
  { emoji: '⚽', name: 'Soccer Ball' },
  { emoji: '🏀', name: 'Basketball' },
  { emoji: '🏈', name: 'Football' },
  { emoji: '⚾', name: 'Baseball' },
  { emoji: '🎾', name: 'Tennis' },
  { emoji: '🏐', name: 'Volleyball' },
  { emoji: '🏉', name: 'Rugby' },
  { emoji: '🎱', name: '8-Ball' },
  { emoji: '🏓', name: 'Ping Pong' },
  { emoji: '🏸', name: 'Badminton' },
  { emoji: '🥊', name: 'Boxing Glove' },
  { emoji: '🎯', name: 'Dart' },
  { emoji: '🎮', name: 'Game Controller' },
  { emoji: '🎲', name: 'Dice' },
  { emoji: '🎨', name: 'Palette' },
  { emoji: '🎭', name: 'Theater' },
  { emoji: '🎪', name: 'Circus' },
  { emoji: '🎸', name: 'Guitar' },
  { emoji: '🎹', name: 'Piano' },
  { emoji: '🎺', name: 'Trumpet' },
  { emoji: '🎻', name: 'Violin' },
  { emoji: '🥁', name: 'Drum' },
  { emoji: '🎤', name: 'Microphone' },
  { emoji: '🎧', name: 'Headphones' },
  { emoji: '📻', name: 'Radio' },
  { emoji: '🎬', name: 'Movie' },
  { emoji: '📚', name: 'Books' },
  { emoji: '📖', name: 'Book' },
  { emoji: '✏', name: 'Pencil' },
  { emoji: '✒', name: 'Pen' },
  { emoji: '🖊', name: 'Ballpoint Pen' },
  { emoji: '🖍', name: 'Crayon' },
  { emoji: '📝', name: 'Memo' },
  { emoji: '🔍', name: 'Magnifying Glass' },
  { emoji: '🔎', name: 'Magnifying Glass Right' },
  { emoji: '🔒', name: 'Lock' },
  { emoji: '🔓', name: 'Unlock' },
  { emoji: '🔑', name: 'Key' },
  { emoji: '🔨', name: 'Hammer' },
  { emoji: '🪓', name: 'Axe' },
  { emoji: '⛏', name: 'Pick' },
  { emoji: '🔧', name: 'Wrench' },
  { emoji: '🔩', name: 'Nut and Bolt' },
  { emoji: '⚙', name: 'Gear' },
  { emoji: '🧰', name: 'Toolbox' },
  { emoji: '🧲', name: 'Magnet' },
  { emoji: '🪜', name: 'Ladder' },
  { emoji: '⚗', name: 'Alembic' },
  { emoji: '🔬', name: 'Microscope' },
  { emoji: '🔭', name: 'Telescope' },
  { emoji: '🩺', name: 'Stethoscope' },
  { emoji: '💊', name: 'Pill' },
  { emoji: '🩹', name: 'Bandage' },
  { emoji: '🌡', name: 'Thermometer' },
  { emoji: '🧬', name: 'DNA' },
  { emoji: '🔋', name: 'Battery' },
  { emoji: '💡', name: 'Light Bulb' },
  { emoji: '🔦', name: 'Flashlight' },
  { emoji: '🕯', name: 'Candle' },
  { emoji: '🧯', name: 'Fire Extinguisher' },
  { emoji: '🎈', name: 'Balloon' },
  { emoji: '🎀', name: 'Ribbon' },
  { emoji: '🎁', name: 'Gift' },
  { emoji: '🏆', name: 'Trophy' },
  { emoji: '🥇', name: 'Gold Medal' },
  { emoji: '🥈', name: 'Silver Medal' },
  { emoji: '🥉', name: 'Bronze Medal' },
  { emoji: '⚔', name: 'Swords' },
  { emoji: '🛡', name: 'Shield' },
  { emoji: '🏹', name: 'Bow and Arrow' },
  { emoji: '🪃', name: 'Boomerang' },
  { emoji: '🎣', name: 'Fishing Pole' },
  { emoji: '🧩', name: 'Puzzle Piece' },
  { emoji: '🎰', name: 'Slot Machine' },
  { emoji: '🚀', name: 'Rocket' },
  { emoji: '🛸', name: 'UFO' },
  { emoji: '🛰', name: 'Satellite' },
  { emoji: '🌌', name: 'Milky Way' },
  { emoji: '🌠', name: 'Shooting Star' },
  { emoji: '⛺', name: 'Tent' },
  { emoji: '🏕', name: 'Camping' },
  { emoji: '🗻', name: 'Mount Fuji' },
  { emoji: '🏔', name: 'Mountain' },
  { emoji: '⛰', name: 'Mountain Peak' },
  { emoji: '🏖', name: 'Beach' },
  { emoji: '🏝', name: 'Desert Island' },
  { emoji: '🏜', name: 'Desert' },
  { emoji: '🏞', name: 'Park' },
  { emoji: '🏟', name: 'Stadium' },
  { emoji: '🏛', name: 'Classical Building' },
  { emoji: '🏗', name: 'Construction' },
  { emoji: '🧱', name: 'Brick' },
  { emoji: '🏘', name: 'Houses' },
  { emoji: '🏚', name: 'House' },
  { emoji: '🏠', name: 'Home' },
  { emoji: '🏡', name: 'Garden' },
  { emoji: '🏢', name: 'Office Building' },
  { emoji: '🏣', name: 'Post Office' },
  { emoji: '🏤', name: 'European Post Office' },
  { emoji: '🏥', name: 'Hospital' },
  { emoji: '🏦', name: 'Bank' },
  { emoji: '🏨', name: 'Hotel' },
  { emoji: '🏩', name: 'Love Hotel' },
  { emoji: '🏪', name: 'Store' },
  { emoji: '🏫', name: 'School' },
  { emoji: '🏬', name: 'Department Store' },
  { emoji: '🏭', name: 'Factory' },
  { emoji: '🏯', name: 'Castle' },
  { emoji: '🏰', name: 'European Castle' },
  { emoji: '💒', name: 'Wedding' },
  { emoji: '🗼', name: 'Tower' },
  { emoji: '🗽', name: 'Statue of Liberty' },
  { emoji: '⛪', name: 'Church' },
  { emoji: '🕌', name: 'Mosque' },
  { emoji: '🛕', name: 'Temple' },
  { emoji: '🕍', name: 'Synagogue' },
  { emoji: '⛩', name: 'Shrine' },
  { emoji: '🕋', name: 'Kaaba' },
  { emoji: '⛲', name: 'Fountain' },
  { emoji: '⛱', name: 'Umbrella' },
  { emoji: '🌁', name: 'Foggy' },
  { emoji: '🌃', name: 'Night' },
  { emoji: '🌄', name: 'Sunrise' },
  { emoji: '🌅', name: 'Sunrise Over Mountains' },
  { emoji: '🌆', name: 'Dusk' },
  { emoji: '🌇', name: 'Sunset' },
  { emoji: '🌉', name: 'Bridge at Night' },
  { emoji: '🎢', name: 'Roller Coaster' },
  { emoji: '🎡', name: 'Ferris Wheel' },
  { emoji: '🎠', name: 'Carousel' },
  { emoji: '⛲', name: 'Fountain' },
  { emoji: '⛱', name: 'Umbrella on Ground' }
];

export function generateEmojiId(eventId: ID): { emoji: string; name: string } {
  const existing = new Set(
    Array.from(db.participants.values()).filter(p => p.eventId === eventId).map(p => p.emojiId)
  );
  const available = EMOJIS.filter(e => !existing.has(e.emoji));
  if (available.length === 0) {
    throw new Error('No more unique emojis available');
  }
  const selected = available[Math.floor(Math.random() * available.length)];
  return selected;
}

export function joinEvent(eventId: ID, code: string, displayName?: string) {
  const event = db.events.get(eventId);
  if (!event) throw new Error('Event not found');
  if (event.code !== code) throw new Error('Invalid code');
  const emojiData = generateEmojiId(eventId);
  const id = randomId('usr_');
  const token = randomToken();
  const participant: Participant = { id, eventId, emojiId: emojiData.emoji, emojiName: emojiData.name, displayName, token, createdAt: now() };
  db.participants.set(id, participant);
  const presence: Presence = { participantId: id, eventId, connected: false, lastSeenAt: 0 };
  db.presence.set(id, presence);
  return { participant, token };
}

export function getEventSummary(eventId: ID): EventSummary | undefined {
  const event = db.events.get(eventId);
  if (!event) return undefined;
  const rounds = db.eventRounds.get(eventId) ?? [];
  const round = rounds.length ? db.rounds.get(rounds[rounds.length - 1]) : undefined;
  const participants = Array.from(db.participants.values()).filter(p => p.eventId === eventId);
  const list = participants.map(p => ({
    ...p,
    presence: db.presence.get(p.id)
  }));
  const connectedCount = list.filter(p => p.presence?.connected).length;
  return { event, participants: list, round, connectedCount };
}

export function upsertPresence(participantId: ID, connected: boolean, clientInfo?: Record<string, unknown>) {
  const presence = db.presence.get(participantId);
  if (!presence) return;
  presence.connected = connected;
  presence.lastSeenAt = now();
  if (clientInfo) presence.clientInfo = clientInfo;
}

export function createRound(eventId: ID, index: number, roundSeed: number): Round {
  const id = randomId('rnd_');
  const round: Round = { id, eventId, index, createdAt: now(), roundSeed };
  db.rounds.set(id, round);
  const arr = db.eventRounds.get(eventId) ?? [];
  arr.push(id);
  db.eventRounds.set(eventId, arr);
  return round;
}

export function setAvoidance(eventId: ID, p1Id: ID, p2Id: ID, roundIndex: number) {
  const [a, b] = [p1Id, p2Id].sort();
  const key = `${eventId}:${a}:${b}`;
  db.avoidance.set(key, { eventId, p1Id: a, p2Id: b, lastPairedRoundIndex: roundIndex });
}

export function getAvoidance(eventId: ID, p1Id: ID, p2Id: ID): number {
  const [a, b] = [p1Id, p2Id].sort();
  const key = `${eventId}:${a}:${b}`;
  return db.avoidance.get(key)?.lastPairedRoundIndex ?? -1_000_000;
}

export function savePairings(roundId: ID, pairs: Array<Omit<Pairing, 'id'>>): Pairing[] {
  const ids: ID[] = [];
  const list: Pairing[] = [];
  for (const p of pairs) {
    const id = randomId('pr_');
    const row: Pairing = { id, ...p } as Pairing;
    db.pairings.set(id, row);
    ids.push(id);
    list.push(row);
  }
  db.roundPairs.set(roundId, ids);
  return list;
}

export function getConnectedParticipants(eventId: ID): Participant[] {
  return Array.from(db.participants.values()).filter(p => p.eventId === eventId && (db.presence.get(p.id)?.connected ?? false));
}

export function getRoundIndex(eventId: ID): number {
  const rounds = db.eventRounds.get(eventId) ?? [];
  return rounds.length;
}
