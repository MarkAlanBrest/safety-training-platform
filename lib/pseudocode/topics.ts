export type PseudocodeTopic = { id: string; label: string; blurb: string; focus: string };

export const DEFAULT_TOPIC = "mixed";

export const topics: PseudocodeTopic[] = [
  {
    id: "mixed",
    label: "Mixed practice",
    blurb: "A little of everything",
    focus: "Choose challenges that combine sequencing, variables, decisions, and loops, matched to how the student is doing.",
  },
  {
    id: "sequence",
    label: "Step-by-step",
    blurb: "Clear, ordered instructions",
    focus: "Sequencing: writing clear, ordered, unambiguous steps; the INPUT, process, DISPLAY pattern; and why the order of steps matters.",
  },
  {
    id: "variables",
    label: "Variables & math",
    blurb: "Storing and updating values",
    focus: "Variables: storing and updating values (SET total = total + price), arithmetic, meaningful names, and setting a starting value before using a variable.",
  },
  {
    id: "decisions",
    label: "IF / ELSE",
    blurb: "Making decisions",
    focus: "Decisions: conditions and comparisons (<, <=, >, >=, =, !=), IF / ELSE IF / ELSE chains, boundary values, and the order in which conditions are checked.",
  },
  {
    id: "boolean",
    label: "AND / OR / NOT",
    blurb: "Combining conditions",
    focus: "Boolean logic: combining conditions with AND, OR, and NOT, truth tables, parentheses, and simplifying conditions.",
  },
  {
    id: "loops",
    label: "Loops",
    blurb: "Repeating with a way to stop",
    focus: "Loops: REPEAT n TIMES, WHILE loops with a clear stopping condition, counters and running totals, avoiding infinite loops, and off-by-one mistakes.",
  },
  {
    id: "lists",
    label: "Lists",
    blurb: "Working with many values",
    focus: "Lists: FOR EACH loops over a list, sums and averages, finding the largest or smallest value, counting items that match a condition, and positions (indexes).",
  },
  {
    id: "functions",
    label: "Functions",
    blurb: "Reusable pieces",
    focus: "Functions: defining and calling functions, parameters, RETURN values, and breaking a problem into small reusable pieces.",
  },
  {
    id: "debugging",
    label: "Debugging",
    blurb: "Find and fix the bug",
    focus: "Debugging: give the student short pseudocode that contains a bug to trace and fix. Teach tracing tables, test cases, and edge cases.",
  },
];

export const findTopic = (id: unknown) => topics.find((topic) => topic.id === id);
