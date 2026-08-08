import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import { embedLessonVisuals } from "./visual-frame-art.mjs";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured.");
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
import {
  explain,
  summary,
  question,
  scenario,
  visual,
} from "../lib/seed/course-moment-helpers.mjs";
import { harassmentCourseDefinition } from "../lib/seed/workplace-harassment-course.mjs";

const ladderSections = [
  {
    title: "Select the Right Ladder and Inspect It",
    estimatedMinutes: 20,
    lessonPlan: {
      sectionTitle: "Select the Right Ladder and Inspect It",
      opening:
        "Safe ladder work begins before setup. The worker must decide whether a ladder is the right access method, choose the correct ladder, and remove defective equipment from service.",
      objectives: [
        "Decide whether a ladder is appropriate for the task",
        "Select the correct type, length, material, and capacity",
        "Complete a focused pre-use inspection",
        "Remove defective ladders from service",
      ],
      keyFacts: [
        "Use ladders only for the purpose for which they were designed.",
        "Do not exceed the manufacturer's rated capacity or maximum intended load.",
        "Use nonconductive side rails where contact with exposed energized equipment is possible.",
        "Defective portable ladders must be marked or tagged and withdrawn from service until repaired.",
      ],
      moments: [
        explain(
          "First ask whether a ladder is the right tool",
          "A ladder is access equipment, not a universal work platform. Before selecting one, consider the work duration, required force, tools and materials, available handholds, nearby traffic, electrical exposure, weather, and whether a scaffold, lift, or other system would provide safer access.\n\nIf the task requires heavy two-handed work, significant side loading, extended time aloft, or movement that cannot be completed while maintaining balance, stop and choose a more suitable method.",
        ),
        visual(
          "The four-part selection check",
          "A ladder is suitable only when its type, reach, material, and capacity all match the task and environment.",
          "sequence",
          ["Type", "Reach", "Material", "Capacity"],
          [
            ["Type", "Choose self-supporting, non-self-supporting, or specialty equipment as designed.", "A stepladder and an extension ladder solve different access problems. Never improvise one into the role of another.", ["Design", "Task"]],
            ["Reach", "Select enough length without standing on prohibited steps or overextending.", "The worker should reach the work while staying within the ladder's safe climbing and standing limits.", ["Length", "Safe standing level"]],
            ["Material", "Evaluate electrical and environmental hazards.", "Where the employee or ladder could contact exposed energized equipment, OSHA construction rules require nonconductive side rails.", ["Electrical exposure", "Environment"]],
            ["Capacity", "Include the worker, clothing, tools, and materials in the load.", "Never exceed the manufacturer's rated capacity or the maximum intended load.", ["Worker", "Tools", "Materials"]],
          ],
        ),
        question(
          "What counts toward ladder load?",
          "The duty rating applies to more than body weight.",
          "Which items should be included when evaluating the load?",
          [
            "Only the worker's body weight",
            "The worker plus clothing, tools, equipment, and carried materials",
            "Only objects heavier than 25 pounds",
            "Tools but not materials",
          ],
          1,
          "Correct. Evaluate the total expected load and stay within the manufacturer's rating.",
        ),
        explain(
          "Inspect before use and after events",
          "Look at side rails, rungs or steps, feet, hardware, spreaders, locks, rope and pulleys, labels, and attachments. Check for cracks, splits, bends, corrosion, missing components, contamination, looseness, and unauthorized repairs. OSHA construction rules require periodic inspection by a competent person and inspection after an occurrence that could affect safe use.\n\nA quick pre-use check by the user remains an essential work practice. A ladder that has been dropped, struck, exposed to damaging chemicals, or otherwise affected deserves additional scrutiny before anyone climbs.",
        ),
        scenario(
          "A cracked side rail",
          "During inspection, you find a crack in a portable ladder side rail. The ladder is the only one nearby, and the task should take less than five minutes.",
          "What should you do?",
          [
            "Use it carefully for the short task",
            "Wrap the crack with tape",
            "Tag or clearly mark it defective, withdraw it from service, and obtain safe equipment",
            "Ask a coworker to hold it",
          ],
          2,
          "Correct. Structural defects require the ladder to be identified as defective and withdrawn from service until it is repaired to its original design criteria or otherwise handled under employer procedure.",
        ),
        question(
          "Electrical selection",
          "The task is near exposed energized equipment where the worker or ladder could make contact.",
          "Which ladder characteristic is required under OSHA's construction ladder rule?",
          [
            "Metal side rails",
            "Nonconductive side rails",
            "A painted wood ladder with hidden grain",
            "Any ladder if rubber shoes are worn",
          ],
          1,
          "Correct. Nonconductive side rails are required where the employee or ladder could contact exposed energized electrical equipment. Additional electrical safe-work rules may also apply.",
        ),
        question(
          "Mastery: ladder purpose",
          "A worker closes a stepladder and leans it against a wall even though the manufacturer designed it only for open, self-supporting use.",
          "What is the issue?",
          [
            "No issue if the wall is strong",
            "The ladder is not being used for its designed purpose",
            "The ladder only needs a spotter",
            "The practice is acceptable indoors",
          ],
          1,
          "Correct. Ladders must be used only for the purpose for which they were designed and according to manufacturer instructions.",
          "mastery",
        ),
        summary(
          "Selection and inspection prevent exposure",
          "Choose the access method first, then verify ladder type, length, material, and capacity. Inspect the equipment and remove defects from service before they become a fall.",
        ),
      ],
      summary:
        "The safest climb begins with choosing appropriate access equipment and refusing to use a ladder that is unsuitable, overloaded, electrically hazardous, or defective.",
    },
  },
  {
    title: "Set Up and Secure the Ladder",
    estimatedMinutes: 20,
    lessonPlan: {
      sectionTitle: "Set Up and Secure the Ladder",
      opening:
        "A sound ladder can still fail when it is placed at the wrong angle, set on unstable ground, exposed to traffic, or left unsecured.",
      objectives: [
        "Set a ladder on a stable, level support",
        "Apply the four-to-one setup rule",
        "Provide safe access at an upper landing",
        "Control traffic and displacement hazards",
      ],
      keyFacts: [
        "Non-self-supporting ladders use approximately a one-to-four horizontal-to-working-length ratio.",
        "Portable ladder side rails used for upper access must extend at least three feet above the landing, or equivalent securing and grasping provisions are required.",
        "Use ladders only on stable and level surfaces unless secured against displacement.",
        "Secure or barricade ladders exposed to doors, passageways, driveways, or workplace traffic.",
      ],
      moments: [
        explain(
          "Build the setup from the ground up",
          "Clear the area and examine the support surface before raising the ladder. The feet need stable, level support. Do not place a ladder on boxes, barrels, loose material, or makeshift blocks to gain height. Slippery surfaces require effective securing or slip-resistant feet, and those feet do not replace careful placement and securing.\n\nAt the top, both rails of a non-self-supporting ladder should be supported equally unless the ladder has a designed single-support attachment. Keep the top and bottom areas clear.",
        ),
        visual(
          "The four-to-one angle",
          "For a non-self-supporting ladder, place the base approximately one foot out for every four feet of working length from the foot to the top support.",
          "formula",
          ["Working length ÷ 4", "Base distance", "Stable climbing angle"],
          [
            ["Measure", "Estimate the working length along the ladder from its foot to the top support.", "The setup ratio uses working length, not simply the height of the building.", ["Working length"]],
            ["Divide", "Divide the working length by four.", "A sixteen-foot working length calls for a base approximately four feet from the top support line.", ["16 ÷ 4 = 4"]],
            ["Place", "Set the base at the calculated approximate horizontal distance.", "Too close increases backward tipping risk; too far increases sliding and excessive loading.", ["One out", "Four up"]],
            ["Verify", "Check stable feet, equal top support, and securing before climbing.", "The angle is one part of the setup. Surface, support, and displacement controls still matter.", ["Surface", "Support", "Secure"]],
          ],
        ),
        question(
          "Apply the ratio",
          "A non-self-supporting ladder has a working length of twenty feet.",
          "Approximately how far should the base be from the top support line?",
          ["2 feet", "5 feet", "10 feet", "20 feet"],
          1,
          "Correct. Twenty divided by four equals five, so the base belongs approximately five feet out.",
        ),
        explain(
          "Accessing an upper landing",
          "When a portable ladder is used to access an upper landing, its side rails must extend at least three feet above the landing. If that extension is not possible because of ladder length, OSHA requires the ladder to be secured at the top to a rigid support and a grasping device, such as a grabrail, to assist transition.\n\nThe transition point deserves special attention because the climber must move between the ladder and landing. Keep it clear, provide the required extension or equivalent provisions, and secure the ladder against movement.",
        ),
        scenario(
          "A ladder in a doorway",
          "The only setup location is in front of a doorway used by other crews.",
          "What control is required?",
          [
            "Place a small note on the floor",
            "Secure the ladder against displacement or barricade the area to keep traffic away",
            "Ask the climber to listen for the door",
            "Use the ladder only during busy periods",
          ],
          1,
          "Correct. Ladders exposed to workplace traffic, doorways, passageways, or driveways must be secured against displacement or protected by a barricade.",
        ),
        scenario(
          "Uneven gravel",
          "One ladder foot sinks into loose gravel. A worker proposes placing scrap wood under that foot.",
          "What is the safest decision?",
          [
            "Use the scrap if a coworker watches it",
            "Climb only halfway",
            "Create a proper stable, level support or choose another access method",
            "Lean the worker's body toward the high side",
          ],
          2,
          "Correct. Do not rely on unstable makeshift leveling. Establish proper support, secure the ladder as required, or select safer equipment.",
        ),
        question(
          "Mastery: upper access",
          "A ladder reaches an upper landing but its rails end level with the landing and cannot extend three feet.",
          "What alternative does the construction rule describe?",
          [
            "No alternative is needed",
            "Secure the top to a rigid support and provide a grasping device",
            "Have the climber jump to the landing",
            "Place a second unsecured ladder on the landing",
          ],
          1,
          "Correct. When the required rail extension is not possible because of ladder length, top securing and a grasping device are required.",
          "mastery",
        ),
        summary(
          "A setup is a control system",
          "Stable ground, the proper angle, equal top support, safe landing transition, clear access, and traffic control work together. Do not climb until the full setup is ready.",
        ),
      ],
      summary:
        "Correct ladder setup combines stable support, proper angle, secure upper access, clear surroundings, and controls against accidental displacement.",
    },
  },
  {
    title: "Climb and Work Safely",
    estimatedMinutes: 20,
    lessonPlan: {
      sectionTitle: "Climb and Work Safely",
      opening:
        "Once the ladder is selected and secured, the climber's position, movement, and load determine whether the setup remains stable.",
      objectives: [
        "Use safe climbing technique",
        "Maintain a secure grasp and balanced body position",
        "Avoid prohibited stepladder practices",
        "Control tools and loads during ascent and descent",
      ],
      keyFacts: [
        "Face the ladder while ascending or descending.",
        "Use at least one hand to grasp the ladder while progressing up or down.",
        "Do not carry an object or load that could cause loss of balance.",
        "Do not move, shift, or extend a ladder while it is occupied.",
      ],
      moments: [
        explain(
          "Face the ladder and maintain control",
          "OSHA construction rules require the user to face the ladder while ascending or descending and to use at least one hand to grasp the ladder while progressing. A practical three-points-of-contact method—two hands and one foot or two feet and one hand—helps preserve stability during climbing.\n\nKeep your belt buckle or torso centered between the side rails. If the work is beyond comfortable reach, descend and reposition the ladder. Do not twist, bounce, slide, or “walk” an occupied ladder.",
        ),
        visual(
          "A controlled climb",
          "Climbing safety is a sequence: prepare the load, face the ladder, maintain contact, and stop if balance changes.",
          "sequence",
          ["Prepare", "Face", "Contact", "Center", "Reposition"],
          [
            ["Prepare", "Use a tool belt, hoist line, or another method for loads that interfere with climbing.", "Never carry an object that could cause loss of balance and a fall.", ["Hands available", "Load controlled"]],
            ["Face", "Keep your body oriented toward the ladder.", "Facing the rungs provides better grip, foot placement, and body control.", ["Eyes on rungs", "Body aligned"]],
            ["Contact", "Use at least one hand to grasp while progressing.", "Three points of contact is a strong practical method for maintaining stability.", ["Secure grasp", "Stable feet"]],
            ["Center", "Keep your body between the rails.", "Side reaching shifts the center of gravity and can destabilize the ladder.", ["No overreach", "Balanced"]],
            ["Reposition", "Descend before moving or extending the ladder.", "A few extra setup minutes are safer than trying to shift an occupied ladder.", ["Climb down", "Reset"]],
          ],
        ),
        scenario(
          "Carrying a bulky box",
          "A worker plans to climb while holding a bulky box against the chest, leaving no hand available to grasp the ladder.",
          "What should change?",
          [
            "Climb faster",
            "Use a safe material-handling method such as a hoist or have materials transferred separately",
            "Hold the box with one knee",
            "Turn sideways while climbing",
          ],
          1,
          "Correct. Do not carry a load that could cause loss of balance. Use a method that preserves safe climbing and a secure grasp.",
        ),
        explain(
          "Stepladders have specific limits",
          "Open a stepladder fully and engage its spreader or locking device. Do not use the top or top step as a step. Do not climb rear cross-bracing unless the ladder is specifically designed and provided with steps for climbing on both front and rear sections.\n\nFollow manufacturer labels for the highest permitted standing level. Never tie ladders together for extra length unless they are specifically designed for that use.",
        ),
        scenario(
          "One more inch of reach",
          "A worker standing near the top of a stepladder cannot reach a fastener and considers stepping onto the top cap.",
          "What should the worker do?",
          [
            "Use the top cap for only a few seconds",
            "Have a coworker push the ladder closer while occupied",
            "Descend and select or reposition appropriate access equipment",
            "Stand on one foot",
          ],
          2,
          "Correct. The top or top step of a stepladder must not be used as a step. Descend and correct the access method.",
        ),
        question(
          "Occupied ladders",
          "A worker wants to extend an extension ladder two more rungs while standing on it.",
          "What rule applies?",
          [
            "It is allowed below six feet",
            "The ladder must not be moved, shifted, or extended while occupied",
            "It is allowed with a spotter",
            "It is allowed if the feet are tied",
          ],
          1,
          "Correct. Descend before moving, shifting, or extending the ladder.",
        ),
        question(
          "Mastery: climbing grasp",
          "Which technique aligns with OSHA's construction ladder rule?",
          [
            "Face away while descending",
            "Carry loads that block both hands",
            "Face the ladder and use at least one hand to grasp while progressing",
            "Slide down the side rails",
          ],
          2,
          "Correct. Face the ladder and maintain at least one-hand grasp while ascending or descending.",
          "mastery",
        ),
        summary(
          "Balance is protected one movement at a time",
          "Face the ladder, maintain a secure grasp, control tools and loads, remain centered, obey standing limits, and descend before repositioning. Never trade stable technique for speed.",
        ),
      ],
      summary:
        "Safe ladder use depends on controlled climbing, a secure grasp, balanced positioning, proper material handling, and strict adherence to ladder design limits.",
    },
  },
  {
    title: "Control Hazards, Respond to Defects, and Verify Mastery",
    estimatedMinutes: 20,
    lessonPlan: {
      sectionTitle: "Control Hazards, Respond to Defects, and Verify Mastery",
      opening:
        "Ladder safety is sustained through housekeeping, competent inspection, prompt removal of defects, effective training, and the authority to stop work when conditions change.",
      objectives: [
        "Control common environmental and work-area hazards",
        "Apply defect tagging and withdrawal requirements",
        "Explain training and retraining expectations",
        "Demonstrate ladder-safety mastery",
      ],
      keyFacts: [
        "Keep ladders free of oil, grease, and slipping hazards.",
        "A competent person must inspect for visible defects periodically and after an occurrence that could affect safe use.",
        "Repairs must restore the ladder to its original design criteria before return to use.",
        "Workers must be trained to recognize ladder and stairway hazards and know procedures that minimize them.",
      ],
      moments: [
        explain(
          "Conditions can change after setup",
          "Rain, ice, oil, mud, wind, vehicle movement, overhead work, changing electrical conditions, and nearby operations can turn an acceptable setup into an unsafe one. Reassess whenever the work area changes. Keep the ladder and the surrounding area free of slipping and tripping hazards.\n\nStop work if the ladder shifts, a component loosens, the barricade is disturbed, weather worsens, or another trade creates a new exposure. Descend, control the area, and correct the condition before continuing.",
        ),
        visual(
          "Stop, tag, isolate, correct",
          "Defect response must prevent the next person from unknowingly climbing unsafe equipment.",
          "process",
          ["Stop use", "Identify", "Isolate", "Repair or dispose", "Verify"],
          [
            ["Stop use", "End exposure as soon as damage or unsafe performance is discovered.", "Do not finish the task on equipment you know or suspect is defective.", ["Stop work", "Descend safely"]],
            ["Identify", "Tag “Do Not Use” or mark the defect clearly.", "The warning must readily identify the ladder as defective.", ["Clear warning", "Visible"]],
            ["Isolate", "Withdraw the ladder from service.", "Move or block it under employer procedure so another worker cannot use it casually.", ["Control access", "No reuse"]],
            ["Correct", "Use an authorized repair process or dispose of the ladder.", "Makeshift repairs can hide damage or change the ladder's design performance.", ["Qualified repair", "No improvisation"]],
            ["Verify", "Return it only when it meets original design criteria.", "The fact that damage looks covered is not proof that safe performance has been restored.", ["Original criteria", "Approval"]],
          ],
        ),
        scenario(
          "The ladder was struck",
          "A forklift lightly strikes a stored extension ladder. No crack is immediately obvious.",
          "What should happen before use?",
          [
            "Use it because the impact looked minor",
            "Have a competent person inspect it because the occurrence could affect safe use",
            "Paint over the contact point",
            "Use it only indoors",
          ],
          1,
          "Correct. OSHA requires inspection after any occurrence that could affect safe use. Keep the ladder out of service until it has been appropriately evaluated.",
        ),
        explain(
          "Training and retraining",
          "Under 29 CFR 1926.1060, employers must provide a training program for each employee using ladders and stairways as necessary. The program must enable employees to recognize hazards and train them in procedures to minimize those hazards. Training is to be conducted by a competent person.\n\nCovered topics include fall hazards, correct procedures for erecting, maintaining, and disassembling fall-protection systems involved; proper construction, use, placement, and care of ladders and stairways; and maximum intended loads. Retraining is required as necessary so employees maintain the required understanding and knowledge.",
        ),
        scenario(
          "Observed unsafe practice",
          "A trained worker is repeatedly seen standing on the top step of a stepladder.",
          "What is the appropriate response?",
          [
            "Assume the original training is enough",
            "Stop the unsafe use, correct the hazard, and provide retraining as necessary",
            "Wait for an injury",
            "Replace the ladder label only",
          ],
          1,
          "Correct. Unsafe performance should be corrected immediately, and retraining should be provided as necessary to restore understanding and safe practice.",
        ),
        question(
          "Mastery: setup",
          "A sixteen-foot working length is used for a non-self-supporting ladder.",
          "What approximate base distance follows the four-to-one rule?",
          ["1 foot", "2 feet", "4 feet", "8 feet"],
          2,
          "Correct. Sixteen divided by four equals an approximate four-foot base distance.",
          "mastery",
        ),
        question(
          "Mastery: defect control",
          "A rung is missing from a portable ladder.",
          "What is the correct action?",
          [
            "Skip the missing rung",
            "Mark or tag the ladder defective and withdraw it from service",
            "Use it with two workers",
            "Place it at a steeper angle",
          ],
          1,
          "Correct. A missing rung is a structural defect. Identify the ladder as defective and remove it from service until properly repaired or otherwise handled.",
          "mastery",
        ),
        question(
          "Mastery: traffic",
          "A ladder must be used where carts pass through the work area.",
          "Which control is appropriate?",
          [
            "Rely on the climber to watch the carts",
            "Secure the ladder against displacement or barricade traffic away",
            "Place tools around the feet",
            "Use a louder warning label",
          ],
          1,
          "Correct. Traffic exposure requires securing against accidental displacement or a barricade that keeps the activity away.",
          "mastery",
        ),
        summary(
          "Course close and OSHA status",
          "Select, inspect, set up, climb, and reassess as one continuous safety process. Stop work when equipment or conditions are unsafe, and ensure defects cannot expose the next worker.\n\nThis course is OSHA-aligned awareness training based primarily on 29 CFR 1926 Subpart X, especially 1926.1053 and 1926.1060. It is not an OSHA Outreach 10-hour course, does not issue an OSHA card, and does not replace employer training required for site-specific hazards. Primary references: osha.gov/laws-regs/regulations/standardnumber/1926/1926.1053, osha.gov/laws-regs/regulations/standardnumber/1926/1926.1060, and osha.gov/training/outreach.",
        ),
      ],
      summary:
        "Sustained ladder safety requires reassessment, defect control, competent inspection, and training that produces safe performance. This platform certificate is not an OSHA 10 card.",
    },
  },
];

function themeForCourse(slug) {
  if (String(slug).includes("ladder")) return "ladder";
  return "harassment";
}

function resolveSourcePptx(definition) {
  const candidates = [
    definition.sourcePptx,
    path.join(repoRoot, "lib/seed/sources", `${definition.slug}.pptx`),
    path.join(repoRoot, "course-sources", `${definition.slug}.pptx`),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const resolved = path.isAbsolute(candidate)
      ? candidate
      : path.join(repoRoot, candidate);
    if (fs.existsSync(resolved)) return resolved;
  }

  return null;
}

async function loadSourcePptx(definition) {
  const pptxPath = resolveSourcePptx(definition);
  if (!pptxPath) return null;
  return {
    path: pptxPath,
    buffer: fs.readFileSync(pptxPath),
  };
}

const courses = [
  harassmentCourseDefinition,
  {
    title: "OSHA-Aligned Ladder Safety",
    slug: "osha-aligned-ladder-safety",
    description:
      "Construction-focused ladder hazard awareness based on OSHA 29 CFR 1926 Subpart X, covering selection, inspection, setup, climbing, defect control, and training.",
    audience: "Employees who select, inspect, set up, or use portable ladders in construction-related work",
    theme: "industrial",
    intensity: "comprehensive",
    estimatedMinutes: 80,
    displayMode: "webpage",
    published: false,
    sections: ladderSections,
  },
];

async function installCourse(definition) {
  const suppressed = await prisma.seedCourseSuppression.findUnique({
    where: { slug: definition.slug },
  });
  if (suppressed) {
    return {
      title: definition.title,
      slug: definition.slug,
      skipped: "admin-deleted",
      sections: definition.sections.length,
      sourcePptx: null,
    };
  }

  const existing = await prisma.masonCourse.findUnique({
    where: { slug: definition.slug },
    select: { id: true },
  });
  if (existing) {
    return {
      title: definition.title,
      slug: definition.slug,
      skipped: "already-exists",
      sections: definition.sections.length,
      sourcePptx: null,
    };
  }

  const sourcePptx = await loadSourcePptx(definition);

  const course = await prisma.masonCourse.create({
    data: {
      title: definition.title,
      slug: definition.slug,
      description: definition.description,
      audience: definition.audience,
      theme: definition.theme,
      intensity: definition.intensity,
      estimatedMinutes: definition.estimatedMinutes,
      displayMode: definition.displayMode,
      published: definition.published,
    },
  });

  for (const [index, section] of definition.sections.entries()) {
    const lessonPlan = await embedLessonVisuals(section.lessonPlan, {
      theme: themeForCourse(definition.slug),
      pptxBuffer: sourcePptx?.buffer || null,
    });

    await prisma.masonSection.create({
      data: {
        courseId: course.id,
        title: section.title,
        position: index + 1,
        estimatedMinutes: section.estimatedMinutes,
        fileName: "Editorial course content",
        lessonPlan,
      },
    });
  }

  return {
    title: course.title,
    slug: course.slug,
    sections: definition.sections.length,
    sourcePptx: sourcePptx?.path || null,
  };
}

try {
  const installed = [];
  for (const course of courses) {
    installed.push(await installCourse(course));
  }
  console.log(JSON.stringify({ installed }, null, 2));
} finally {
  await prisma.$disconnect();
}
