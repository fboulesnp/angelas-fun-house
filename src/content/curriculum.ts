// Canonical curriculum index for Angela's Fun House.
// Source: Bring Science Alive! 7th Grade Integrated, Student Edition (524-page PDF).
// Printed start pages come from the table of contents; physical PDF page = printed + 36,
// verified at every lesson opener (PDF p.45, 57, ... carry each lesson's title page).

export type WingId = 'spark' | 'motion' | 'planet' | 'tomorrow';
export type LessonId =
  | 'L01' | 'L02' | 'L03' | 'L04' | 'L05' | 'L06' | 'L07' | 'L08' | 'L09' | 'L10'
  | 'L11' | 'L12' | 'L13' | 'L14' | 'L15' | 'L16' | 'L17' | 'L18' | 'L19' | 'L20'
  | 'L21' | 'L22' | 'L23' | 'L24' | 'L25' | 'L26' | 'L27' | 'L28' | 'L29';

export interface WingInfo {
  id: WingId;
  name: string;
  segment: string; // exact textbook segment title
  segmentNumber: number;
  payoff: string;
  lessons: LessonId[];
}

export interface LessonIndexEntry {
  id: LessonId;
  number: number;
  lessonTitle: string; // exact textbook lesson title
  attractionTitle: string;
  wing: WingId;
  unit: string; // textbook unit inside the segment
  printedStart: number;
  printedEnd: number;
  pdfStart: number;
  pdfEnd: number;
}

export const DOCUMENT_ID = 'BSA7-SE';
export const DOCUMENT_TITLE = 'Bring Science Alive! 7th Grade Integrated, Student Edition';
export const PRINTED_TO_PDF_OFFSET = 36;

export const WINGS: WingInfo[] = [
  {
    id: 'spark',
    name: 'The Spark & Story Wing',
    segment: 'Organisms and Nonliving Things Are Made of Atoms',
    segmentNumber: 1,
    payoff: 'Light the foundations and awaken the ancient observatory.',
    lessons: ['L01', 'L02', 'L03', 'L04', 'L05', 'L06', 'L07', 'L08', 'L09'],
  },
  {
    id: 'motion',
    name: 'The Motion & Marvel Wing',
    segment: 'Matter Cycles and Energy Flows',
    segmentNumber: 2,
    payoff: 'Restart the spectacular transformation machines.',
    lessons: ['L10', 'L11', 'L12', 'L13', 'L14', 'L15'],
  },
  {
    id: 'planet',
    name: 'The Living Planet Wing',
    segment: "The Distribution of Earth's Resources",
    segmentNumber: 3,
    payoff: 'Restore waterways, landscapes, habitats, and climate chambers.',
    lessons: ['L16', 'L17', 'L18', 'L19', 'L20', 'L21', 'L22', 'L23', 'L24'],
  },
  {
    id: 'tomorrow',
    name: 'The Tomorrow Wing',
    segment: 'Sustaining Living Systems in a Changing World',
    segmentNumber: 4,
    payoff: 'Make the house resilient and bring its grand garden to life.',
    lessons: ['L25', 'L26', 'L27', 'L28', 'L29'],
  },
];

const L = (
  n: number,
  lessonTitle: string,
  attractionTitle: string,
  wing: WingId,
  unit: string,
  printedStart: number,
  printedEnd: number,
): LessonIndexEntry => ({
  id: `L${String(n).padStart(2, '0')}` as LessonId,
  number: n,
  lessonTitle,
  attractionTitle,
  wing,
  unit,
  printedStart,
  printedEnd,
  pdfStart: printedStart + PRINTED_TO_PDF_OFFSET,
  pdfEnd: printedEnd + PRINTED_TO_PDF_OFFSET,
});

export const LESSONS: LessonIndexEntry[] = [
  L(1, 'Atoms and Elements', 'Neon Atom Midway', 'spark', 'The Composition of Matter', 8, 19),
  L(2, 'Molecules and Extended Structures', 'Molecule Masquerade', 'spark', 'The Composition of Matter', 20, 29),
  L(3, 'Substances and Their Properties', 'Mystery Material Manor', 'spark', 'The Composition of Matter', 30, 39),
  L(4, "Capturing the Sun's Energy", 'Sunbeam Conservatory', 'spark', 'Energy and Matter in Ecosystems', 42, 53),
  L(5, 'Using Stored Energy', 'Mitochondria Midnight Express', 'spark', 'Energy and Matter in Ecosystems', 54, 63),
  L(6, 'Food Webs and Trophic Pyramids', 'Food-Web Forest', 'spark', 'Energy and Matter in Ecosystems', 64, 75),
  L(7, 'Global Cycles of Matter', 'Planet Carousel', 'spark', 'Energy and Matter in Ecosystems', 76, 87),
  L(8, 'Investigating Rock Strata', 'Canyon of Clues', 'spark', 'Earth Processes Through Geologic Time', 90, 103),
  L(9, "Reconstructing Earth's History", 'Deep-Time Dream Machine', 'spark', 'Earth Processes Through Geologic Time', 104, 119),
  L(10, "Energy in Earth's Systems", 'Four-Sphere Skyworks', 'motion', "Earth's Systems", 128, 139),
  L(11, "Scales of Change on Earth's Surface", 'Glacier Clocktower', 'motion', "Earth's Systems", 140, 149),
  L(12, 'Identifying Chemical Reactions', 'Reaction Revelry', 'motion', 'Chemical Reactions', 152, 161),
  L(13, 'Atoms in Chemical Reactions', 'Conservation Clockworks', 'motion', 'Chemical Reactions', 162, 171),
  L(14, 'Energy in Chemical Reactions', 'Firelight & Frost Pavilion', 'motion', 'Chemical Reactions', 172, 181),
  L(15, 'Chemical Engineering and Society', "Inventor's Wonderworks", 'motion', 'Chemical Reactions', 182, 193),
  L(16, "Earth's Tectonic Plates", 'Pangaea Puzzle Palace', 'planet', 'Processes that Shape Earth', 202, 217),
  L(17, 'The Rock Cycle', 'Rock-Cycle Rollercoaster', 'planet', 'Processes that Shape Earth', 218, 231),
  L(18, 'The Water Cycle', 'Raindrop Royal Regatta', 'planet', 'Processes that Shape Earth', 232, 243),
  L(19, "Earth's Natural Resources", 'Resource Treasure Railway', 'planet', 'Processes that Shape Earth', 244, 259),
  L(20, 'Resources in Living Systems', 'Habitat Hide-and-Seek', 'planet', 'Resources in Ecosystems', 262, 271),
  L(21, 'Interactions Among Organisms', 'Wild Alliance Ballroom', 'planet', 'Resources in Ecosystems', 272, 283),
  L(22, 'Changing Ecosystems', 'Comeback Garden', 'planet', 'Resources in Ecosystems', 284, 293),
  L(23, 'The Motion of Particles', 'Particle Dance Party', 'planet', 'States of Matter', 296, 307),
  L(24, 'Heat, Temperature, and State Changes', 'Heatwave Ice Palace', 'planet', 'States of Matter', 308, 319),
  L(25, 'Volcanic Eruptions and Earthquakes', 'Rumble Mountain Rescue', 'tomorrow', "Earth's Natural Hazards", 328, 341),
  L(26, 'Mass Wasting, Tsunamis, and Floods', 'Stormwater Harbor', 'tomorrow', "Earth's Natural Hazards", 342, 355),
  L(27, 'Biodiversity', 'Biodiversity Lantern Festival', 'tomorrow', 'Humans and Changing Ecosystems', 358, 373),
  L(28, 'The Importance of Healthy Ecosystems', 'Living World Market', 'tomorrow', 'Humans and Changing Ecosystems', 374, 385),
  L(29, 'Engineering Solutions for Protecting Ecosystems', 'Future Garden Grand Finale', 'tomorrow', 'Humans and Changing Ecosystems', 386, 399),
];

export const LESSON_BY_ID: Record<LessonId, LessonIndexEntry> = Object.fromEntries(
  LESSONS.map((l) => [l.id, l]),
) as Record<LessonId, LessonIndexEntry>;

export const wingOf = (id: LessonId): WingInfo => WINGS.find((w) => w.lessons.includes(id))!;
