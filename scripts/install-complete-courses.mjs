import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import { embedVisualFrameImages } from "./visual-frame-art.mjs";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured.");
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});

function base(kind, phase, title, narration, extra = {}) {
  return {
    kind,
    phase,
    title,
    narration,
    prompt: null,
    choices: null,
    correctAnswer: null,
    feedback: null,
    pageNumber: null,
    ...extra,
  };
}

function explain(title, narration) {
  return base("explain", "learn", title, narration);
}

function summary(title, narration) {
  return base("summary", "learn", title, narration);
}

function text(title, narration) {
  return base("text", "learn", title, narration);
}

function tiles(title, narration, tileList) {
  return base("tiles", "learn", title, narration, { tiles: tileList });
}

function dragdrop(title, narration, prompt, dragItems, phase = "activity") {
  return base("dragdrop", phase, title, narration, { prompt, dragItems });
}

function question(title, narration, prompt, choices, correctAnswer, feedback, phase = "activity") {
  return base("question", phase, title, narration, {
    prompt,
    choices,
    correctAnswer,
    feedback,
  });
}

function scenario(title, narration, prompt, choices, correctAnswer, feedback, phase = "activity") {
  return base("scenario", phase, title, narration, {
    prompt,
    choices,
    correctAnswer,
    feedback,
  });
}

function visual(title, narration, visualType, visualItems, frames) {
  return base("visual", "learn", title, narration, {
    cue: null,
    visualAction: "spotlight",
    focusX: 50,
    focusY: 50,
    focusScale: 1.35,
    visualType,
    visualItems,
    explainerStyle: "flipbook",
    explainerFrames: frames.map(
      ([frameTitle, caption, frameNarration, labels], index, allFrames) => ({
        title: frameTitle,
        caption,
        narration: frameNarration,
        visualItems: labels,
        focusX: 20 + (index % 3) * 30,
        focusY: 35 + Math.floor(index / 3) * 25,
        focusScale: 1.4 + index * 0.12,
      }),
    ),
  });
}

const harassmentSections = [
  {
    title: "A Respectful Workplace and the Legal Baseline",
    estimatedMinutes: 20,
    lessonPlan: {
      sectionTitle: "A Respectful Workplace and the Legal Baseline",
      opening:
        "A respectful workplace is built through daily choices, clear boundaries, and early action. This section explains the federal baseline for sexual harassment and the broader standard employees should follow under workplace policy.",
      objectives: [
        "Describe sexual harassment and sex-based harassment",
        "Distinguish the legal threshold from workplace policy expectations",
        "Recognize who may engage in or experience harassment",
        "Respond appropriately when conduct raises concern",
      ],
      keyFacts: [
        "Unwelcome sexual advances, requests for sexual favors, and other verbal or physical conduct of a sexual nature may constitute sexual harassment.",
        "Sex-based harassment can include offensive remarks about a person's sex even when the conduct is not sexual.",
        "Workplace policy may prohibit conduct before it becomes severe or frequent enough to violate federal law.",
        "A harasser may be a supervisor, coworker, customer, contractor, or other nonemployee.",
      ],
      moments: [
        explain(
          "The standard begins with respect",
          "Federal law prohibits employment discrimination because of sex. Sexual harassment can include unwelcome sexual advances, requests for sexual favors, and verbal or physical conduct of a sexual nature. Sex-based harassment can also include hostile remarks about a person's sex even when the words are not sexual.\n\nA strong workplace policy is intentionally broader than the minimum legal threshold. Employees should not wait for behavior to become extreme before raising a concern. Early reporting gives the organization an opportunity to stop conduct, support affected people, and prevent escalation.",
        ),
        text(
          "How workplace policy extends the baseline",
          "Federal law sets a minimum standard, but most employers expect employees to act sooner. Your organization may prohibit conduct that is offensive, repeated, or disruptive even when it has not yet become severe enough to violate federal law.\n\nThat broader standard matters in practice. Employees should focus on respectful conduct, early intervention, and the reporting paths named in company policy—not on guessing whether a courtroom would agree.",
        ),
        visual(
          "From respectful conduct to prohibited conduct",
          "Not every uncomfortable exchange is identical, but every employee can use the same response framework: notice the conduct, consider its effect and context, and act through a safe workplace channel.",
          "sequence",
          ["Respect boundaries", "Notice warning signs", "Report concerns early", "Prevent escalation"],
          [
            ["Respect", "Professional interactions honor personal boundaries.", "Start with conduct that is work-appropriate, inclusive, and responsive when someone sets a boundary.", ["Professional", "Inclusive", "Boundary-aware"]],
            ["Recognize", "Repeated comments, sexual content, pressure, or targeted hostility are warning signs.", "Look at the words, actions, setting, power relationships, repetition, and effect on the people involved.", ["Conduct", "Context", "Impact"]],
            ["Respond", "Use a safe option: set a boundary, seek help, document facts, or report.", "The affected employee does not have to confront the person directly. Use the reporting path that feels safe and appropriate.", ["Safety first", "Multiple options", "Facts"]],
            ["Prevent", "Prompt organizational action can stop misconduct before it grows.", "Managers and designated contacts should receive concerns, protect against retaliation, and activate the employer's response process.", ["Prompt action", "No retaliation", "Follow policy"]],
          ],
        ),
        tiles(
          "Four response habits",
          "Use the same habits whether the conduct feels minor or severe.",
          [
            { title: "Respect", body: "Honor boundaries and keep interactions work-appropriate." },
            { title: "Recognize", body: "Notice warning signs, power differences, and workplace effect." },
            { title: "Respond", body: "Use a safe channel—do not redistribute harmful material." },
            { title: "Prevent", body: "Raise concerns early so the organization can act before escalation." },
          ],
        ),
        question(
          "What can sexual harassment include?",
          "Sexual harassment is defined by conduct and context, not by the gender of the people involved.",
          "Which statement is accurate?",
          [
            "It only involves physical touching",
            "It can include unwelcome sexual advances, requests, or verbal or physical sexual conduct",
            "It only applies when a manager is involved",
            "It only applies between people of different sexes",
          ],
          1,
          "Correct. Sexual harassment may be verbal, physical, or connected to unwelcome advances or requests. The people involved may be of any sex, and the person engaging in the conduct need not be a manager.",
        ),
        scenario(
          "A sexual image in the team chat",
          "A coworker posts a sexually explicit meme in a work group chat. Another coworker reacts with a laughing emoji, while one person stops participating in the conversation.",
          "What is the best response?",
          [
            "Ignore it because the chat is informal",
            "Forward it to another team for their opinion",
            "Do not redistribute it; preserve relevant facts and use a reporting or support channel",
            "Assume everyone approved because one person laughed",
          ],
          2,
          "Correct. Digital workspaces are still workplace environments. Do not amplify the material. Preserve only what is reasonably needed under policy and raise the concern through an appropriate channel.",
        ),
        explain(
          "Legal threshold and policy threshold",
          "Under the federal standard described by the EEOC, harassment is unlawful when it is sufficiently frequent or severe to create a hostile or offensive work environment, or when it results in a harmful employment action such as firing or demotion. Whether conduct meets that legal standard depends on the full circumstances.\n\nWorkplace rules do not need to wait for a legal violation. An isolated comment may still breach policy, warrant correction, or signal a pattern. Employees should follow the organization's conduct rules and reporting process rather than trying to make a legal determination themselves.",
        ),
        scenario(
          "A customer's repeated comments",
          "A customer repeatedly comments on an employee's body after the employee asks the customer to stop. The employee worries that reporting the customer will hurt sales.",
          "Which principle applies?",
          [
            "Customers cannot create a workplace harassment concern",
            "The employee must continue serving the customer without support",
            "Nonemployees can engage in harassment, and the concern should be reported",
            "The comments are acceptable because they happen during a sale",
          ],
          2,
          "Correct. A harasser may be a customer, client, vendor, contractor, or other nonemployee. Employees should use the employer's reporting process so the organization can take appropriate action.",
        ),
        dragdrop(
          "Put early action in order",
          "Arrange these steps from noticing a concern to organizational follow-through.",
          "Drag these actions into the safest order.",
          [
            "Notice conduct, context, and effect on the work environment",
            "Preserve relevant facts without spreading harmful material",
            "Use a safe reporting or support channel",
            "Allow the designated process to review and respond",
          ],
        ),
        question(
          "Mastery: the right standard",
          "Apply both the legal baseline and the organization's preventive expectations.",
          "A worker says, “It happened only once, so I cannot report it.” What is the best response?",
          [
            "Correct—single incidents can never matter",
            "Report only if a coworker agrees",
            "Concerns may be reported early even when the employee is unsure whether conduct is unlawful",
            "Wait until the conduct affects pay",
          ],
          2,
          "Correct. Employees are not expected to decide whether conduct satisfies a legal test. Early reporting can help the employer respond before behavior escalates.",
          "mastery",
        ),
        summary(
          "The habit to carry forward",
          "Respect boundaries, pay attention to conduct and context, and raise concerns early. The goal is prevention and a workplace where people can perform their jobs without sex-based hostility, pressure, or intimidation.",
        ),
      ],
      summary:
        "Sexual harassment and sex-based harassment can involve many forms of unwelcome conduct and many workplace relationships. Follow policy and report concerns early rather than waiting for conduct to become severe.",
    },
  },
  {
    title: "Recognizing Harassment in Real Workplaces",
    estimatedMinutes: 20,
    lessonPlan: {
      sectionTitle: "Recognizing Harassment in Real Workplaces",
      opening:
        "Harassment is not limited to a single phrase or setting. Recognizing it requires attention to conduct, context, power, repetition, and the effect on the work environment.",
      objectives: [
        "Recognize job-linked demands and hostile-environment warning signs",
        "Apply the concept of unwelcome conduct",
        "Identify harassment risks in digital and off-site work",
        "Avoid assumptions based only on intent",
      ],
      keyFacts: [
        "A job benefit or threat must never be conditioned on submission to sexual conduct.",
        "Context includes frequency, severity, power differences, audience, and effect.",
        "Work-related messages, travel, events, and remote channels can be part of the work environment.",
        "A person may communicate that conduct is unwelcome through words or behavior.",
      ],
      moments: [
        explain(
          "Two patterns employees should recognize",
          "One pattern links sexual cooperation to a job decision: a person with workplace power offers a benefit, threatens a consequence, or makes employment treatment depend on accepting sexual conduct. No one should have to trade personal boundaries for an assignment, schedule, evaluation, promotion, or continued employment.\n\nAnother pattern involves conduct that contributes to a hostile work environment. The analysis considers the entire situation, including severity, frequency, power, whether conduct was threatening or humiliating, and how it affected the employee's ability to work.",
        ),
        text(
          "Unwelcome conduct can show up in many ways",
          "Pressure for dates, sexual jokes, unwanted touching, explicit images, humiliating comments, and exclusion after a boundary is set can all raise concerns. The setting may be a break room, a customer visit, a video meeting, or a direct message.\n\nEmployees do not need to classify the conduct perfectly before reporting. Focus on what happened, who was involved, and whether boundaries were ignored.",
        ),
        visual(
          "Conduct, context, and impact",
          "Do not evaluate a concern by looking at one word in isolation. A responsible assessment considers what happened, the surrounding circumstances, and its workplace effect.",
          "comparison",
          ["Conduct", "Context", "Impact", "Pattern"],
          [
            ["Conduct", "Identify the words, images, requests, gestures, contact, or decisions.", "Begin with observable facts rather than labels or conclusions.", ["What was said", "What was done"]],
            ["Context", "Consider power, location, audience, frequency, and prior boundaries.", "The same words can carry different significance depending on workplace power and surrounding events.", ["Power", "Setting", "Repetition"]],
            ["Impact", "Consider whether the behavior interfered with work or created intimidation or hostility.", "Intent may be relevant, but it does not erase the effect or remove the need to respond.", ["Work effect", "Safety", "Dignity"]],
            ["Pattern", "Connect related events instead of dismissing each one alone.", "Employees should report facts they know. The employer is responsible for reviewing the overall information.", ["Related events", "Escalation", "Review"]],
          ],
        ),
        tiles(
          "Three lenses for every concern",
          "Look at the whole situation—not one comment in isolation.",
          [
            { title: "Conduct", body: "What was said, shown, requested, or done?" },
            { title: "Context", body: "Who held power? How often? Where? Were boundaries ignored?" },
            { title: "Impact", body: "Did the behavior interfere with work, safety, or dignity?" },
          ],
        ),
        scenario(
          "The schedule offer",
          "A supervisor tells an employee that a preferred schedule could be arranged if the employee agrees to go on a date. The employee declines, and the supervisor removes the employee from desirable shifts.",
          "What makes this especially serious?",
          [
            "The conversation happened after work hours",
            "A workplace benefit and later job treatment were linked to a personal sexual or romantic request",
            "The employee did not submit a written objection",
            "Scheduling is never an employment issue",
          ],
          1,
          "Correct. A supervisor must not condition workplace benefits or decisions on acceptance of sexual or romantic conduct. The employee should use a safe reporting channel, including one outside the supervisor's chain when available.",
        ),
        explain(
          "Unwelcome does not require a perfect response",
          "People respond to uncomfortable or threatening behavior in different ways. A person may object directly, move away, avoid the person, freeze, laugh nervously, or try to keep the peace. A delayed report does not automatically make earlier conduct welcome.\n\nEmployees should honor a stated or apparent boundary immediately. Do not pressure someone to explain, debate whether they are “too sensitive,” or treat silence as permanent permission.",
        ),
        scenario(
          "Work travel and direct messages",
          "During a work conference, a colleague sends repeated late-night messages asking a coworker to come to the colleague's hotel room. The coworker says no and asks for the messages to stop, but they continue.",
          "Which response is most appropriate?",
          [
            "Treat it as unrelated to work because it happened at a hotel",
            "Delete everything and say nothing",
            "Stop contacting the coworker, preserve relevant facts, and report through the workplace process",
            "Continue if the messages use a personal phone",
          ],
          2,
          "Correct. Work travel and electronic communications can be connected to the workplace. A clear boundary must be respected, and repeated conduct should be reported.",
        ),
        question(
          "Intent and effect",
          "A person says a sexual joke was “only meant to be funny.”",
          "What is the sound workplace response?",
          [
            "Intent ends the inquiry",
            "Consider the conduct, context, policy, and impact—not intent alone",
            "Require the affected person to confront everyone publicly",
            "Allow the joke if some employees laughed",
          ],
          1,
          "Correct. Intent does not automatically resolve the concern. Workplace response should consider the full context and apply policy consistently.",
        ),
        dragdrop(
          "Put the review sequence in order",
          "Match the assessment flow to how concerns should be examined.",
          "Drag these steps into the most logical order.",
          [
            "Identify the observable conduct",
            "Consider power, setting, frequency, and prior boundaries",
            "Assess effect on work, safety, and dignity",
            "Report facts through a safe channel for review",
          ],
        ),
        question(
          "Mastery: digital conduct",
          "Apply the course principles to a remote team.",
          "Repeated sexual comments during video meetings are:",
          [
            "Outside workplace rules because employees are at home",
            "Potential workplace conduct that should be addressed and may be reported",
            "Acceptable if they are not written",
            "Only a concern for the meeting host",
          ],
          1,
          "Correct. Remote meetings and work communication tools are workplace environments. The same conduct expectations apply.",
          "mastery",
        ),
        summary(
          "Recognize the whole situation",
          "Look for job-linked pressure, repeated or severe conduct, ignored boundaries, power differences, and spillover into work. Report facts through a safe channel rather than trying to investigate the matter yourself.",
        ),
      ],
      summary:
        "Recognizing harassment requires more than spotting certain words. Employees should assess observable conduct and report concerns so the organization can examine context, impact, power, and patterns.",
    },
  },
  {
    title: "Reporting, Response, and Protection from Retaliation",
    estimatedMinutes: 20,
    lessonPlan: {
      sectionTitle: "Reporting, Response, and Protection from Retaliation",
      opening:
        "A policy works only when employees know where to go, managers know what to do, and everyone understands that retaliation is prohibited.",
      objectives: [
        "Use appropriate internal reporting channels",
        "Explain a manager's duty after receiving a concern",
        "Recognize retaliation and preserve confidentiality appropriately",
        "Describe a prompt, impartial organizational response",
      ],
      keyFacts: [
        "Employees should have accessible reporting paths, including an alternative outside the immediate chain of command.",
        "Managers must follow the employer's escalation process rather than investigating privately.",
        "Retaliation for reporting concerns or participating in a process is prohibited.",
        "Confidentiality should be protected to the extent possible, but absolute secrecy cannot be promised.",
      ],
      moments: [
        explain(
          "Report through a safe channel",
          "Employees should review the organization's policy and know the available reporting options. A good process identifies more than one contact so an employee is not forced to report to the person involved. Options may include a manager, human resources, an ethics line, an owner, or another designated official.\n\nA report does not need legal terminology. Useful information includes what happened, who was involved, when and where it occurred, possible witnesses, relevant messages or documents, and any immediate safety or work concerns.",
        ),
        text(
          "What to include in a report",
          "You do not need legal terminology. Useful facts include what happened, who was involved, when and where it occurred, possible witnesses, relevant messages or documents, and any immediate safety concern.\n\nA report can be written or verbal. Choose the channel that feels safest when more than one option is available.",
        ),
        visual(
          "What happens after a concern is raised",
          "The exact process depends on company policy, but an effective response follows a reliable path from receiving the concern through corrective and preventive action.",
          "process",
          ["Receive", "Protect", "Review", "Act", "Follow up"],
          [
            ["Receive", "Listen without blame and identify immediate needs.", "Thank the person for speaking up, avoid promises about outcomes, and document the concern accurately.", ["Listen", "No blame", "Accurate facts"]],
            ["Protect", "Address immediate safety, retaliation, and work-continuity concerns.", "Interim measures should be tailored and should not punish the person who raised the concern.", ["Safety", "No retaliation", "Fair measures"]],
            ["Review", "Use a prompt, thorough, and impartial process.", "The designated function—not an untrained manager acting alone—should gather and assess relevant information.", ["Prompt", "Thorough", "Impartial"]],
            ["Act", "Take appropriate corrective and preventive action based on findings.", "Responses should be consistent, effective, and designed to stop misconduct and prevent recurrence.", ["Correct", "Prevent", "Consistent"]],
            ["Follow up", "Check that retaliation has not occurred and that measures are working.", "Continued monitoring helps ensure the workplace is safe and the response remains effective.", ["Monitor", "Support", "Effectiveness"]],
          ],
        ),
        tiles(
          "Reporting essentials",
          "Keep reports factual, limited, and timely.",
          [
            { title: "Channels", body: "Know more than one contact outside the immediate chain when possible." },
            { title: "Facts", body: "Describe conduct, context, dates, and witnesses—not conclusions alone." },
            { title: "Safety", body: "Flag immediate danger, retaliation concerns, or work-continuity needs." },
            { title: "Privacy", body: "Share information only with people who need it under policy." },
          ],
        ),
        scenario(
          "A manager receives a concern",
          "An employee tells a supervisor that a coworker has been sending unwanted sexual messages but asks the supervisor to keep it completely secret.",
          "What should the supervisor do?",
          [
            "Promise secrecy and take no action",
            "Confront the coworker immediately without telling anyone else",
            "Explain that information will be limited as much as possible and promptly follow the employer's reporting process",
            "Tell the employee to solve it directly",
          ],
          2,
          "Correct. A manager should not promise absolute confidentiality or conduct a private investigation. The manager should explain the limits, address immediate needs, and promptly notify the designated organizational contact.",
        ),
        explain(
          "Protection from retaliation",
          "Retaliation can undermine any reporting system. Workplace policy and federal law protect people from adverse treatment because they raised a good-faith concern, opposed discrimination, participated in an investigation, or provided information.\n\nWarning signs can include sudden exclusion, schedule or duty changes without a legitimate reason, threats, intimidation, heightened scrutiny applied selectively, or pressure to withdraw a report. Not every workplace change is retaliation, but concerns should be reported promptly for review.",
        ),
        dragdrop(
          "Put the organizational response in order",
          "Arrange the steps an effective response typically follows.",
          "Drag these actions into the safest order.",
          [
            "Receive the concern and address immediate needs",
            "Protect against retaliation and safety risks",
            "Review through a prompt, impartial process",
            "Take corrective and preventive action",
            "Follow up and monitor effectiveness",
          ],
        ),
        scenario(
          "After participating as a witness",
          "A worker provides truthful information during an investigation. The next week, a team lead tells coworkers not to include that worker in meetings because the worker is “not loyal.”",
          "What should happen?",
          [
            "Nothing, because the worker was only a witness",
            "The exclusion should be reported as possible retaliation",
            "The worker should withdraw the information",
            "Coworkers should publicly argue with the team lead",
          ],
          1,
          "Correct. Witnesses and participants are also protected. The organization should review the exclusion and take steps to prevent retaliation.",
        ),
        question(
          "External rights and internal reporting",
          "Internal reporting processes do not eliminate external rights.",
          "Which statement is most accurate?",
          [
            "An employee must wait for an internal case to finish before learning about external options",
            "Internal policy is the only possible avenue",
            "Employees may have rights through the EEOC or state/local agencies, with deadlines that vary",
            "Only managers can contact an enforcement agency",
          ],
          2,
          "Correct. Employees may have external rights and filing deadlines. Federal and state coverage and deadlines vary, so employees should consult current official information or qualified counsel rather than relying on this general course.",
        ),
        question(
          "Mastery: receiving a report",
          "A supervisor receives a vague statement that “something inappropriate” happened.",
          "What is the best first response?",
          [
            "Dismiss it until the employee uses legal terms",
            "Listen, clarify immediate safety needs, and follow the reporting process",
            "Email the whole department for witnesses",
            "Promise a specific disciplinary outcome",
          ],
          1,
          "Correct. Employees do not need legal terminology. The supervisor should listen, address immediate needs, avoid outcome promises, and promptly escalate under policy.",
          "mastery",
        ),
        summary(
          "A trustworthy reporting culture",
          "Know the channels, report facts, protect people from retaliation, and let the designated process do its work. Prompt, impartial response is an organizational responsibility—not a burden the affected employee must carry alone.",
        ),
      ],
      summary:
        "Effective prevention requires accessible reporting, trained managers, prompt impartial review, appropriate corrective action, and active protection against retaliation.",
    },
  },
  {
    title: "Bystander Action, Supervisor Duties, and Final Practice",
    estimatedMinutes: 20,
    lessonPlan: {
      sectionTitle: "Bystander Action, Supervisor Duties, and Final Practice",
      opening:
        "Everyone contributes to workplace culture. Bystanders can interrupt risk safely, while supervisors have an added responsibility to act when they observe or receive information about possible harassment.",
      objectives: [
        "Choose a safe bystander response",
        "Apply supervisor escalation responsibilities",
        "Avoid common mistakes that silence reporting",
        "Demonstrate course mastery through realistic scenarios",
      ],
      keyFacts: [
        "Bystander action should prioritize safety and the preferences of the affected person.",
        "Employees can direct, distract, delegate, delay support, or document consistent with policy.",
        "Supervisors should not promise secrecy, investigate alone, or wait for a formal written complaint.",
        "This general federal course must be supplemented for applicable state, local, industry, and company requirements.",
      ],
      moments: [
        explain(
          "Bystanders have options",
          "A bystander does not have to make a dramatic public confrontation. Depending on safety, authority, and the affected person's preferences, a bystander might redirect the conversation, check in privately, ask the conduct to stop, seek help from a manager or designated contact, or report what the bystander observed.\n\nDocumentation should be factual and handled carefully. Do not circulate humiliating material or conduct a personal investigation. Preserve information only in a lawful, policy-consistent way and provide it to the appropriate channel.",
        ),
        text(
          "Choose the safest useful option",
          "Bystander action does not require a dramatic confrontation. The right choice depends on safety, authority, and the affected person's preferences.\n\nWhen in doubt, prioritize safety, limit the spread of harmful material, and connect the affected person with support or a reporting channel.",
        ),
        visual(
          "Five practical bystander choices",
          "Choose the safest useful option rather than doing nothing simply because direct confrontation feels risky.",
          "sequence",
          ["Direct", "Distract", "Delegate", "Delay", "Document"],
          [
            ["Direct", "Name the boundary when it is safe: “That comment is not appropriate here.”", "A calm, brief statement can interrupt conduct without starting a debate.", ["Clear", "Calm", "Safe"]],
            ["Distract", "Change the situation or create an exit.", "A work question, meeting break, or invitation to step away can interrupt the moment and reduce exposure.", ["Interrupt", "Create space"]],
            ["Delegate", "Bring in a person with responsibility or authority.", "A manager, HR contact, security professional, or designated official may be better positioned to act.", ["Get help", "Use channels"]],
            ["Delay", "Check in afterward and offer support.", "Ask what the person needs, explain available options, and respect that person's choices unless policy requires escalation.", ["Listen", "Support", "Options"]],
            ["Document", "Record objective facts and preserve relevant information appropriately.", "Documentation should support a proper process, not become gossip or online redistribution.", ["Facts", "Privacy", "Policy"]],
          ],
        ),
        tiles(
          "Five bystander choices",
          "Remember: Direct, Distract, Delegate, Delay, Document.",
          [
            { title: "Direct", body: "Name the boundary calmly when it is safe." },
            { title: "Distract", body: "Interrupt the moment or create an exit." },
            { title: "Delegate", body: "Bring in a manager, HR contact, or security." },
            { title: "Delay", body: "Check in afterward and offer support." },
            { title: "Document", body: "Record objective facts in a policy-consistent way." },
          ],
        ),
        scenario(
          "A meeting comment",
          "During a meeting, a senior employee makes a sexual comment about a junior employee. The junior employee becomes quiet, and the meeting leader moves on.",
          "What is a constructive bystander response?",
          [
            "Repeat the comment later as a joke",
            "Check in with the junior employee and use an appropriate reporting or support channel",
            "Post about the incident publicly",
            "Assume silence means approval",
          ],
          1,
          "Correct. A private check-in and appropriate escalation can support the affected employee without spreading the conduct further.",
        ),
        explain(
          "Supervisors carry added responsibility",
          "Supervisors represent the organization in daily work. When they observe possible misconduct or receive a concern, they should act promptly under policy—even if the employee asks them to “forget it,” does not use the word harassment, or provides incomplete information.\n\nA supervisor should not retaliate, blame the reporter, demand confrontation, promise a result, or conduct an off-the-books inquiry. The supervisor should document accurately, protect information, address immediate needs, and notify the designated function.",
        ),
        dragdrop(
          "Put supervisor first steps in order",
          "Arrange a manager's initial response when receiving a concern.",
          "Drag these actions into the safest order.",
          [
            "Listen without blame and clarify immediate safety needs",
            "Explain any limits on confidentiality honestly",
            "Document accurate facts",
            "Promptly notify the designated organizational contact",
          ],
        ),
        scenario(
          "The informal disclosure",
          "An employee tells a supervisor, “I do not want to file anything, but a coworker keeps touching my shoulders after I asked them to stop.”",
          "What should the supervisor do?",
          [
            "Ignore it because the employee used the word informal",
            "Tell the employee to tolerate it",
            "Explain the supervisor's responsibility and promptly follow company policy",
            "Ask the entire team to vote on whether the conduct is serious",
          ],
          2,
          "Correct. A manager should explain the limits of confidentiality and follow the employer's process. The employee need not complete a formal legal complaint before the organization responds.",
        ),
        question(
          "Mastery: retaliation",
          "An employee reports unwanted sexual messages. A manager then removes the employee from a high-visibility project because the report was “disruptive.”",
          "What is the primary concern?",
          [
            "No concern if the messages stopped",
            "Possible retaliation linked to the report",
            "The employee should apologize",
            "Project assignments can never be reviewed",
          ],
          1,
          "Correct. An adverse change linked to protected reporting may be retaliation and should be reviewed immediately.",
          "mastery",
        ),
        question(
          "Mastery: policy and law",
          "A coworker says conduct cannot be corrected unless it already violates federal law.",
          "Which response is correct?",
          [
            "Workplace policy may set a broader conduct standard and support early intervention",
            "Only a court can ask an employee to stop",
            "Employers must allow all isolated conduct",
            "Policy never applies to customers",
          ],
          0,
          "Correct. Prevention depends on addressing inappropriate conduct early, consistent with policy, rather than waiting for a legal threshold to be reached.",
          "mastery",
        ),
        summary(
          "Course close and legal note",
          "Every employee can support a respectful workplace by honoring boundaries, recognizing warning signs, using reporting channels, supporting coworkers, and rejecting retaliation. Supervisors must act promptly under company policy.\n\nThis course provides general U.S. federal information based primarily on current EEOC resources. It is not legal advice and does not replace company policy or state and local training requirements. Employers should have qualified counsel review the course and add organization-specific contacts, procedures, and jurisdictional requirements before deployment. Primary references: eeoc.gov/sexual-harassment, eeoc.gov/harassment, and eeoc.gov/employers/small-business/5-how-can-i-prevent-harassment.",
        ),
      ],
      summary:
        "Employees and supervisors should use safe, prompt action to prevent and address harassment. This general course requires company-specific reporting details and jurisdiction-specific legal review before deployment.",
    },
  },
];

harassmentSections[3].title = "Bystander Action and Supervisor Duties";
harassmentSections[3].lessonPlan.sectionTitle = "Bystander Action and Supervisor Duties";

harassmentSections.push(
  {
    title: "Sexual Violence, Consent, and Survivor Support",
    estimatedMinutes: 22,
    lessonPlan: {
      sectionTitle: "Sexual Violence, Consent, and Survivor Support",
      opening:
        "This section addresses sexual violence directly and may be difficult for some learners. You may pause when needed. If anyone is in immediate danger, contact 911 or local emergency services. In the United States, confidential support is available 24/7 through RAINN at 800-656-HOPE or by texting HOPE to 64673.",
      objectives: [
        "Define consent as freely given and recognize when it is absent",
        "Recognize forms of sexual violence connected to work",
        "Respond to a disclosure without blame or pressure",
        "Connect a person with safety, workplace, and confidential support options",
      ],
      keyFacts: [
        "Sexual violence is sexual activity when consent is not obtained or freely given.",
        "Consent cannot be assumed from silence, a past relationship, flirting, clothing, alcohol use, or a prior yes.",
        "Freezing, delayed reporting, fragmented memory, or continued contact do not prove that conduct was welcome.",
        "Support the person's choices, explain any policy-based reporting duty honestly, and do not conduct your own investigation.",
      ],
      moments: [
        explain(
          "Consent must be freely given",
          "Consent is a voluntary, informed, and specific agreement. It can be withdrawn. A person who is asleep, unconscious, incapacitated, coerced, threatened, or unable to understand the situation cannot freely consent. A prior relationship or prior consent does not create ongoing permission.\n\nSexual violence can include completed or attempted sexual acts without freely given consent, unwanted sexual touching, and non-contact sexual abuse. Technology may also be used for sexual coercion, stalking, threats, or sharing intimate material without permission. When conduct is connected to employment, work travel, a company event, housing, transportation, or work communications, workplace safety and reporting processes may apply in addition to criminal or civil options.",
        ),
        text(
          "When conduct is connected to work",
          "Sexual violence can affect the workplace when it occurs during work travel, company events, housing, transportation, or work communications. Survivors may need both workplace and community support.\n\nIf anyone is in immediate danger, contact 911 or local emergency services. In the United States, confidential support is available 24/7 through RAINN at 800-656-HOPE or by texting HOPE to 64673.",
        ),
        visual(
          "What consent requires",
          "Consent is more than the absence of a no. Use the same four-part test every time: freely given, specific, reversible, and given by someone who is capable of choosing.",
          "sequence",
          ["Freely given", "Specific", "Reversible", "Capable"],
          [
            ["Freely given", "No coercion, threats, manipulation, or misuse of workplace power.", "A yes obtained through fear, job pressure, or intoxication is not freely given consent.", ["No pressure", "No threats", "No power abuse"]],
            ["Specific", "Agreement to one act is not agreement to another.", "Consent must match the actual conduct. Do not assume permission carries over to new situations.", ["One act at a time", "Clear agreement"]],
            ["Reversible", "Anyone may change their mind at any time.", "If consent is withdrawn or becomes uncertain, stop immediately and check in.", ["Can stop", "Can change mind"]],
            ["Capable", "The person must be awake, aware, and able to choose.", "Sleep, unconsciousness, severe intoxication, or incapacitation remove the ability to consent.", ["Awake", "Aware", "Able to choose"]],
          ],
        ),
        tiles(
          "Consent: what to remember",
          "Consent is active, specific, and reversible.",
          [
            { title: "Freely given", body: "No coercion, threat, manipulation, or misuse of workplace power." },
            { title: "Specific", body: "Agreement to one act is not agreement to another." },
            { title: "Reversible", body: "Anyone may change their mind at any time." },
            { title: "Capable", body: "The person must be awake, aware, and able to choose." },
            { title: "Communicated", body: "Do not treat silence, freezing, or lack of resistance as a yes." },
            { title: "Ongoing", body: "Pay attention and stop when consent is withdrawn or uncertain." },
          ],
        ),
        scenario(
          "A disclosure after work travel",
          "A coworker says that during a work trip a colleague entered their room and touched them sexually after they said no. They appear shaken and say, “Please do not tell everyone.”",
          "What is the best first response?",
          [
            "Ask detailed questions to decide whether the account is believable",
            "Listen, affirm that it was not their fault, ask about immediate safety, and explain available support and any reporting duty",
            "Contact the accused person for their version before doing anything else",
            "Tell coworkers so they can protect themselves",
          ],
          1,
          "Correct. Listen without blame, prioritize immediate safety, protect privacy, explain options and policy limits honestly, and activate the appropriate trained response process.",
        ),
        explain(
          "A trauma-informed first response",
          "A calm first response can reduce harm. Thank the person for telling you. Say that what happened is not their fault. Ask what they need right now and whether they are safe. Offer choices instead of taking control away. Do not demand a complete timeline, question why they did not leave, or ask why they waited.\n\nDo not promise absolute confidentiality if your role or policy requires escalation. Explain clearly who must be told and why, share information only with people who need it, and involve trained personnel. Preserve relevant messages or records when safe and lawful, but do not pressure the person to collect evidence or report to law enforcement. Those choices belong to the affected person except where law or policy creates a specific duty.",
        ),
        visual(
          "A survivor-centered first response",
          "When someone discloses sexual violence, your first job is support—not investigation. Follow a calm path that protects safety, dignity, and choice.",
          "process",
          ["Listen", "Safety", "Options", "Privacy", "Follow up"],
          [
            ["Listen", "Thank the person and respond without blame.", "Say that what happened is not their fault. Do not demand a complete timeline or question their choices.", ["No blame", "Believe", "Patient"]],
            ["Safety", "Ask about immediate safety and urgent needs.", "If there is an active threat, contact emergency services and activate site security procedures.", ["Immediate danger", "Medical needs"]],
            ["Options", "Explain support paths honestly.", "Share workplace, confidential, and community resources. Do not pressure a specific next step.", ["RAINN", "Workplace", "911"]],
            ["Privacy", "Share information only with people who need it.", "Explain any limits on confidentiality under policy. Do not circulate the disclosure.", ["Need to know", "Policy limits"]],
            ["Follow up", "Check back and watch for retaliation.", "Offer continued support and confirm that interim measures are working.", ["Check in", "No retaliation"]],
          ],
        ),
        dragdrop(
          "Put the first response in order",
          "Arrange a supportive response from first step to follow-through.",
          "Drag these actions into the safest order.",
          [
            "Check immediate safety and urgent medical needs",
            "Listen without blame and thank the person for speaking up",
            "Explain support choices and any limits on confidentiality",
            "Follow the designated workplace process and protect privacy",
            "Check back about support and possible retaliation",
          ],
        ),
        scenario(
          "When danger is immediate",
          "An employee receives a message from a former partner threatening to come to the worksite with a weapon.",
          "What should happen first?",
          [
            "Wait to see whether the person arrives",
            "Post the message in the team chat",
            "Contact 911 or local emergency services and activate site emergency/security procedures",
            "Ask the employee to confront the person",
          ],
          2,
          "Correct. Treat a specific, immediate threat as an emergency. Contact emergency services and follow site security procedures rather than investigating or confronting the person.",
        ),
        question(
          "Mastery: consent",
          "Apply the course definition of freely given consent.",
          "Which statement is accurate?",
          [
            "Silence is consent unless the person says no twice",
            "Past consent applies to future encounters",
            "Consent can be withdrawn and cannot be freely given through coercion or incapacitation",
            "Workplace authority has no effect on whether a choice is free",
          ],
          2,
          "Correct. Consent must be freely given, specific, ongoing, and capable of being withdrawn.",
          "mastery",
        ),
        summary(
          "Safety, dignity, and choice",
          "Sexual violence is never the survivor's fault. Respond without blame, prioritize immediate safety, protect privacy, explain options honestly, and connect the person with trained help. U.S. confidential support is available from RAINN at 800-656-HOPE and by text at 64673; emergencies require 911 or local emergency services.",
        ),
      ],
      summary:
        "Consent must be freely given. A survivor-centered response listens without blame, protects safety and privacy, preserves choice, and connects the person with appropriate support and reporting paths.",
    },
  },
  {
    title: "Final Review and Certification Exam",
    estimatedMinutes: 15,
    lessonPlan: {
      sectionTitle: "Final Review and Certification Exam",
      opening:
        "Review the core responsibilities, then complete the 12-question certification exam. You must answer at least 10 of 12 questions correctly to meet the 80% passing standard and earn your certificate.",
      objectives: [
        "Integrate prevention, recognition, reporting, and response principles",
        "Demonstrate safe decisions in realistic workplace situations",
        "Earn a course completion certificate by scoring 80% or higher",
      ],
      keyFacts: [
        "Respect boundaries and act before concerning conduct escalates.",
        "Use safe reporting channels; employees do not need to make a legal determination first.",
        "Supervisors must promptly follow policy and must not promise secrecy or investigate alone.",
        "Retaliation against reporters, witnesses, and participants is prohibited.",
      ],
      moments: [
        text(
          "How to approach the exam",
          "You will answer twelve scenario and knowledge-check questions drawn from the full course. Read each question carefully and choose the safest, most policy-consistent response.\n\nPassing requires at least ten correct answers (80%). Feedback appears after submission. This is a closed-coaching assessment.",
        ),
        tiles(
          "Exam topics at a glance",
          "The assessment integrates prevention, recognition, reporting, bystander action, consent, and supervisor response.",
          [
            { title: "Prevention", body: "Respect boundaries and raise concerns early." },
            { title: "Recognition", body: "Conduct, context, impact, and digital/off-site settings." },
            { title: "Response", body: "Reporting channels, retaliation, and survivor support." },
            { title: "Leadership", body: "Supervisor duties and organizational follow-through." },
          ],
        ),
        dragdrop(
          "Put your reporting readiness in order",
          "Before you begin, confirm you understand the reporting flow.",
          "Drag these steps into the safest order.",
          [
            "Know your organization's reporting channels",
            "Report facts through a safe channel",
            "Protect confidentiality to the extent possible",
            "Watch for and report possible retaliation",
          ],
        ),
        question("Final 1", "Federal and workplace standards.", "Which conduct may constitute sexual harassment?", ["Only physical assault", "Unwelcome sexual advances, requests, or verbal or physical sexual conduct", "Only conduct by executives", "Only conduct reported the same day"], 1, "Sexual harassment is not limited to physical conduct or supervisors.", "mastery"),
        question("Final 2", "Consent.", "Which statement best describes consent?", ["A prior yes applies indefinitely", "Silence always means yes", "It must be freely given, specific, ongoing, and reversible", "It is unnecessary between coworkers who are dating"], 2, "Consent must be freely given and may be withdrawn.", "mastery"),
        scenario("Final 3", "A supervisor offers a promotion in exchange for a date.", "What is the primary concern?", ["There is none if the offer is verbal", "A job benefit is being linked to a romantic or sexual request", "Dating is required before promotion", "The employee must reject the offer publicly"], 1, "Workplace benefits must never be conditioned on sexual or romantic cooperation.", "mastery"),
        question("Final 4", "Digital conduct.", "Repeated sexual messages in a work chat are:", ["Outside policy because they are online", "Potential workplace conduct that should be addressed", "Acceptable after business hours", "Only a concern if every recipient objects"], 1, "Work communication channels are workplace environments.", "mastery"),
        scenario("Final 5", "A coworker discloses unwanted sexual touching.", "What is the best initial response?", ["Question why they waited", "Promise that nobody will ever be told", "Listen without blame, check safety, and explain support and reporting options", "Contact the accused person yourself"], 2, "A supportive response centers safety, dignity, choice, and honest limits on confidentiality.", "mastery"),
        question("Final 6", "Bystander action.", "Which is a valid bystander option?", ["Direct, distract, delegate, delay, or document safely", "Publish the incident online", "Investigate everyone personally", "Do nothing unless asked in writing"], 0, "Bystanders can choose among several safe actions.", "mastery"),
        scenario("Final 7", "A customer repeatedly comments on an employee's body after being asked to stop.", "What should the employee understand?", ["Customers cannot create a workplace concern", "The conduct may be reported through workplace channels", "Sales goals override boundaries", "Only the customer can report it"], 1, "Customers and other nonemployees can engage in workplace harassment.", "mastery"),
        scenario("Final 8", "A manager receives an informal disclosure.", "What should the manager do?", ["Wait for legal terminology", "Promise secrecy", "Address immediate needs and promptly follow the employer's escalation process", "Run a private investigation"], 2, "Managers should respond promptly under policy and use trained channels.", "mastery"),
        question("Final 9", "Retaliation.", "Who may be protected from retaliation?", ["Only the person who filed the first report", "Reporters, witnesses, and people who participate in the process", "Only managers", "Nobody if the concern is not proven"], 1, "Protection extends to good-faith reporting, opposition, and participation.", "mastery"),
        scenario("Final 10", "An employee receives a credible threat that someone is coming to the workplace with a weapon.", "What is the first priority?", ["Confront the person", "Contact emergency services and follow site emergency procedures", "Wait for a manager meeting", "Share the threat broadly on social media"], 1, "Immediate threats require emergency response, not personal investigation.", "mastery"),
        question("Final 11", "Trauma responses.", "Which statement is accurate?", ["A delayed report proves consent", "Freezing or fragmented recall can occur and does not prove conduct was welcome", "A survivor must confront the person", "Only physical injury matters"], 1, "People respond to trauma differently; avoid blame and credibility assumptions based on response style.", "mastery"),
        question("Final 12", "Policy and prevention.", "When may an employee raise a concern?", ["Only after a court finds a violation", "Only after the same event happens three times", "Early, even when unsure whether the legal threshold has been met", "Only through the immediate supervisor"], 2, "Early reporting supports prevention, and accessible policies should provide more than one channel.", "mastery"),
      ],
      summary:
        "Passing this assessment confirms completion of this general U.S. workplace awareness course. Employer-specific policy, reporting contacts, and jurisdiction-specific requirements must also be provided.",
    },
  },
);

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

const courses = [
  {
    title: "Workplace Sexual Harassment and Violence Prevention",
    slug: "workplace-sexual-harassment-prevention",
    description:
      "Comprehensive example course showcasing every Mason teaching moment type—explain, text, tiles, visual, drag-to-order, scenario, question, and summary—alongside serious U.S. workplace training on sexual harassment and violence prevention, consent, bystander action, reporting, survivor support, retaliation, supervisor response, and final certification.",
    audience: "Employees and supervisors; requires company and jurisdiction-specific customization before deployment",
    theme: "clean",
    intensity: "comprehensive",
    estimatedMinutes: 110,
    displayMode: "webpage",
    published: false,
    sections: harassmentSections,
  },
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
  const course = await prisma.masonCourse.upsert({
    where: { slug: definition.slug },
    create: {
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
    update: {
      title: definition.title,
      description: definition.description,
      audience: definition.audience,
      theme: definition.theme,
      intensity: definition.intensity,
      estimatedMinutes: definition.estimatedMinutes,
      displayMode: definition.displayMode,
      updatedAt: new Date(),
    },
  });

  for (const [index, section] of definition.sections.entries()) {
    const lessonPlan = embedVisualFrameImages(
      section.lessonPlan,
      themeForCourse(definition.slug),
    );

    await prisma.masonSection.upsert({
      where: {
        courseId_position: {
          courseId: course.id,
          position: index + 1,
        },
      },
      create: {
        courseId: course.id,
        title: section.title,
        position: index + 1,
        estimatedMinutes: section.estimatedMinutes,
        fileName: "Editorial course content",
        lessonPlan,
      },
      update: {
        title: section.title,
        estimatedMinutes: section.estimatedMinutes,
        fileName: "Editorial course content",
        lessonPlan,
        updatedAt: new Date(),
      },
    });
  }

  return {
    title: course.title,
    slug: course.slug,
    sections: definition.sections.length,
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
