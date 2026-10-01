export type PseudocodeTopic = { id: string; label: string; icon: string; blurb: string; focus: string };

export const DEFAULT_TOPIC = "basics";

export const topics: PseudocodeTopic[] = [
  {
    id: "basics",
    icon: "✏️",
    label: "Start writing pseudocode",
    blurb: "The basic idea, one step at a time",
    focus:
      "First steps for students who have never written pseudocode. Teach the basic idea: pseudocode is a list of clear steps a robot follows exactly, in order, one action per line. " +
      "Keep challenges very short and simple (3-6 lines): turn a plain-English robot task into steps, such as start, close the claw, drive forward for 2 seconds, stop, open the claw. " +
      "Use only simple commands (WAIT FOR START, DRIVE, TURN, STOP, WAIT, SET claw servo, RUN intake). No variables, IF, loops, or functions yet. " +
      "Accept plain-English lines as long as each step is clear and specific, then gently show the matching command style. " +
      "Good ideas to practice: being specific (how far, how fast, how long), putting steps in the right order, remembering to stop, and fixing steps that are vague or out of order. " +
      "Requirements should be about order, specific numbers, one action per line, and stopping.",
  },
  {
    id: "mixed",
    icon: "🤖",
    label: "Mixed practice",
    blurb: "A little of everything",
    focus: "Choose robot challenges that combine sequencing, variables, sensor decisions, and loops, matched to how the student is doing.",
  },
  {
    id: "sequence",
    icon: "🏁",
    label: "Autonomous steps",
    blurb: "Ordered robot instructions",
    focus: "Sequencing an autonomous routine: WAIT FOR START, then clear, ordered steps (drive, turn, run the intake, move the claw or lift) with explicit stops. Why order matters, such as stopping before releasing a game piece.",
  },
  {
    id: "variables",
    icon: "🔢",
    label: "Variables & math",
    blurb: "Power, distance, counts",
    focus: "Variables on a robot: motor power (-1 to 1), target distances, game pieces scored, encoder ticks to distance (ticks per revolution and wheel circumference), scaling joystick values, and updating a count with SET count = count + 1.",
  },
  {
    id: "decisions",
    icon: "📡",
    label: "Sensor decisions",
    blurb: "IF / ELSE with sensors",
    focus: "Decisions from sensors: IF / ELSE IF / ELSE with distance, color, and touch sensors or the IMU heading; comparisons like <, <=, >=; boundary values (what happens at exactly 15 cm); and the order in which conditions are checked.",
  },
  {
    id: "boolean",
    icon: "🔀",
    label: "AND / OR / NOT",
    blurb: "Buttons and limit switches",
    focus: "Boolean logic on a robot: combining gamepad buttons, limit switches, and sensor checks with AND, OR, and NOT (for example, run the lift up only if the button is pressed AND the top limit switch is NOT pressed). Truth tables and parentheses.",
  },
  {
    id: "loops",
    icon: "🔁",
    label: "Loops & timeouts",
    blurb: "Repeat until done, safely",
    focus: "Loops on a robot: WHILE active AND a sensor condition AND timer < limit, re-reading the sensor inside the loop, stopping motors after the loop, REPEAT n TIMES for repeated moves, and why a stale sensor reading or missing timeout makes the robot run forever.",
  },
  {
    id: "teleop",
    icon: "🎮",
    label: "TeleOp & gamepad",
    blurb: "Driver control",
    focus: "TeleOp: the main loop that runs while active, reading gamepad1 and gamepad2 every pass, tank and arcade driving from joysticks, mecanum drive math, button toggles that change only on a new press, slow mode, and showing values on telemetry.",
  },
  {
    id: "functions",
    icon: "🧩",
    label: "Functions",
    blurb: "Reusable robot moves",
    focus: "Functions for robot moves: driveFor(seconds, power), turnToHeading(degrees), scorePiece(), with parameters and RETURN values (such as returning whether the target was reached). Breaking an autonomous routine into small reusable pieces.",
  },
  {
    id: "states",
    icon: "🚦",
    label: "State machines",
    blurb: "Steps that don't block",
    focus: "State machines: using a state variable (such as INTAKING, LIFTING, SCORING, DONE) and IF / ELSE IF checks inside a loop so the robot can do several things without getting stuck, moving to the next state when a sensor, timer, or button says so.",
  },
  {
    id: "debugging",
    icon: "🐞",
    label: "Debugging",
    blurb: "Find and fix the robot bug",
    focus: "Debugging robot logic: give the student short robot pseudocode with a realistic bug (a sensor never re-read, a missing stop, a wrong comparison at the boundary, a loop with no timeout, a toggle that flickers) to trace and fix. Teach tracing tables and test cases such as a sensor stuck at one value.",
  },
];

export const findTopic = (id: unknown) => topics.find((topic) => topic.id === id);
