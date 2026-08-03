import {
  base,
  explain,
  text,
  tiles,
  dragdrop,
  summary,
  question,
  scenario,
  visual,
  flashcard,
  hotspot,
  tutor,
} from './course-moment-helpers.mjs';

const harassmentSections = [
  {
    title: "Interactive Format Showcase",
    estimatedMinutes: 10,
    lessonPlan: {
      sectionTitle: "Interactive Format Showcase",
      opening:
        "Start here. This example course demonstrates every Mason teaching format—including AI instructor slides, flash cards, click-to-explore images, explain and text reading, tiles, visuals, drag-to-order, scenarios, and summaries.",
      objectives: [
        "See every Mason moment type in sequence",
        "Compare explain blocks and text pages",
        "Try tiles, visuals, drag activities, and knowledge checks",
      ],
      keyFacts: [
        "Explain and text are both reading blocks, but text is its own moment type in the editor.",
        "Tiles present ideas side by side; drag-to-order activities ask learners to sequence steps.",
        "Visual moments pair narration with picture flipbooks.",
      ],
      moments: [
        explain(
          "Explain moment",
          "Explain moments carry the main teaching narrative. They work well for multi-paragraph instruction, context, and examples.\n\nIn this example course, explain blocks introduce each topic before activities and assessments reinforce the ideas.",
        ),
        text(
          "Text page moment",
          "Text pages are a separate moment type in Mason. Learners see the same reading layout, but authors can distinguish a text page from an explain block in the course editor.\n\nUse text pages when you want a clearly defined reading beat—policy language, definitions, or a focused page break in the flow.",
        ),
        tiles(
          "Tiles moment",
          "Tile grids highlight related ideas at a glance.",
          [
            { title: "Side by side", body: "Present three to six ideas in a scannable grid." },
            { title: "Short titles", body: "Each tile has a headline and a supporting sentence." },
            { title: "Great for rules", body: "Use tiles for checklists, principles, or quick comparisons." },
          ],
        ),
        visual(
          "Visual moment",
          "Visual moments pair narration with a picture flipbook. They are ideal for processes, frameworks, and step-by-step ideas.",
          "sequence",
          ["Notice", "Assess", "Act"],
          [
            ["Notice", "See the conduct and context.", "Start with observable facts rather than labels.", ["Conduct", "Context"]],
            ["Assess", "Consider power, repetition, and effect.", "The same words can land differently depending on the situation.", ["Power", "Impact"]],
            ["Act", "Use a safe reporting or support channel.", "Early action helps prevent escalation.", ["Report", "Support"]],
          ],
        ),
        dragdrop(
          "Drag-to-order moment",
          "Drag activities ask learners to put steps in the safest or most logical order.",
          "Drag these response steps into the best order.",
          [
            "Listen without blame",
            "Check immediate safety",
            "Explain support options honestly",
            "Follow the workplace process",
          ],
        ),
        flashcard(
          "Flash card moment",
          "Flip cards help learners memorize terms, definitions, and short frameworks.",
          [
            { front: "Sexual harassment", back: "Unwelcome sexual advances, requests, or verbal or physical conduct of a sexual nature." },
            { front: "Sex-based harassment", back: "Hostile remarks about a person's sex, even when the conduct is not sexual." },
            { front: "Workplace policy", back: "Often broader than the legal minimum and supports early reporting." },
          ],
        ),
        hotspot(
          "Click-to-explore moment",
          "Learners click numbered points on an image to reveal teaching notes.",
          "Click each point on the workplace scene to see what respectful conduct looks like.",
          "/course-assets/workplace-harassment/respectful-workplace.png",
          [
            { x: 28, y: 42, label: "Professional boundaries", text: "Work-appropriate interactions honor personal boundaries and avoid sexual or demeaning comments." },
            { x: 52, y: 58, label: "Inclusive conduct", text: "Everyone should be able to participate without hostility, pressure, or exclusion." },
            { x: 74, y: 36, label: "Early reporting", text: "Concerns can be raised before conduct becomes severe or frequent." },
          ],
        ),
        tutor(
          "AI instructor moment",
          "I'll guide you through this scene. Click each highlighted area, then ask me anything about what you found.",
          "Start by clicking the three areas I marked on the reporting and support image.",
          "/course-assets/workplace-harassment/reporting-support.png",
          [
            { x: 24, y: 48, label: "Safe channel", text: "Use a reporting path named in your employer policy—HR, a manager, an ethics line, or another designated contact." },
            { x: 50, y: 62, label: "Document facts", text: "Preserve relevant messages or notes without redistributing harmful material." },
            { x: 76, y: 40, label: "No retaliation", text: "Retaliation for good-faith reporting is prohibited and should be reported if it occurs." },
          ],
        ),
        text(
          "More reading, fewer quizzes",
          "Strong example courses spend most of their time teaching through reading blocks like this one. Multiple-choice checks work best at the end of a section—or in a dedicated exam—not after every concept.\n\nThe remaining sections follow that pattern: more text and interactive formats, with scenarios reserved for high-value decision practice.",
        ),
        scenario(
          "Scenario moment",
          "A coworker posts an inappropriate image in a work chat. Several people react, but one teammate goes quiet.",
          "What is the best response?",
          [
            "Ignore it because the chat is informal",
            "Forward it to another team",
            "Preserve relevant facts and use a reporting or support channel",
            "Assume silence means approval",
          ],
          2,
          "Correct. Digital workspaces are still workplace environments. Do not spread harmful material further.",
        ),
        summary(
          "Summary moment",
          "Summary moments close a section with the essential takeaway. After this showcase, the remaining sections apply every format to full harassment-prevention content.",
        ),
      ],
      summary:
        "You have now seen every Mason moment type. Continue through the course to see how they work together in a full training program.",
    },
  },
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
        text(
          "What sexual harassment can include",
          "Sexual harassment is defined by conduct and context, not by the gender of the people involved. It may be verbal, physical, or connected to unwelcome advances or requests.\n\nThe person engaging in the conduct need not be a manager, and the people involved may be of any sex. Sex-based harassment can also include hostile remarks about a person's sex even when the words are not sexual.",
        ),
        flashcard(
          "Key terms to remember",
          "Flip through these cards until the definitions feel familiar.",
          [
            { front: "Sexual harassment", back: "Unwelcome sexual advances, requests for sexual favors, or other verbal or physical conduct of a sexual nature." },
            { front: "Sex-based harassment", back: "Offensive remarks about a person's sex, even when the conduct is not sexual." },
            { front: "Unwelcome conduct", back: "Conduct that is not solicited or invited and is regarded by the recipient as undesirable or offensive." },
          ],
        ),
        tutor(
          "Explore a respectful workplace",
          "Let's look at a workplace scene together. I'll describe what to notice, then you can click each marker and ask me follow-up questions.",
          "Click each numbered point on the image. When you're done, ask me how this connects to reporting.",
          "/course-assets/workplace-harassment/respectful-workplace.png",
          [
            { x: 30, y: 45, label: "Boundaries", text: "Professional interactions respect personal boundaries and avoid sexual jokes, pressure, or humiliating comments." },
            { x: 55, y: 60, label: "Digital spaces", text: "Team chats, email, and meetings are still workplace environments." },
            { x: 72, y: 38, label: "Early action", text: "Employees can raise concerns before conduct becomes severe or frequent." },
          ],
        ),
        text(
          "Legal threshold and policy threshold",
          "Under the federal standard described by the EEOC, harassment is unlawful when it is sufficiently frequent or severe to create a hostile or offensive work environment, or when it results in a harmful employment action such as firing or demotion. Whether conduct meets that legal standard depends on the full circumstances.\n\nWorkplace rules do not need to wait for a legal violation. An isolated comment may still breach policy, warrant correction, or signal a pattern. Employees should follow the organization's conduct rules and reporting process rather than trying to make a legal determination themselves.",
        ),
        text(
          "Customers and other nonemployees",
          "A harasser may be a supervisor, coworker, customer, contractor, or other nonemployee. When a customer continues unwelcome comments after being asked to stop, the employee should not have to choose between personal safety and sales goals.\n\nUse the employer's reporting process so the organization can take appropriate action. Nonemployees can create workplace harassment concerns when their conduct affects the work environment.",
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
        text(
          "Unwelcome does not require a perfect response",
          "People respond to uncomfortable or threatening behavior in different ways. A person may object directly, move away, avoid the person, freeze, laugh nervously, or try to keep the peace. A delayed report does not automatically make earlier conduct welcome.\n\nEmployees should honor a stated or apparent boundary immediately. Do not pressure someone to explain, debate whether they are too sensitive, or treat silence as permanent permission.",
        ),
        text(
          "Work travel and digital messages",
          "Work travel, conferences, and electronic communications can be connected to the workplace. Repeated late-night messages after a clear no, unwanted contact in a hotel, or sexual comments during video meetings may all raise concerns.\n\nWhen a boundary is ignored, preserve relevant facts and use the workplace reporting process. The location or device does not make the conduct automatically outside policy.",
        ),
        text(
          "Intent does not decide the outcome alone",
          "A person may say a sexual joke was only meant to be funny. Intent can be relevant, but it does not automatically resolve the concern.\n\nWorkplace response should consider conduct, context, policy, and impact on the people involved—not intent alone.",
        ),
        hotspot(
          "Explore reporting and support",
          "Use this image to review where employees can turn when a concern arises.",
          "Click each point to learn what belongs in a strong reporting response.",
          "/course-assets/workplace-harassment/reporting-support.png",
          [
            { x: 22, y: 50, label: "Multiple channels", text: "Policies should identify more than one reporting path so employees are not forced to report to the person involved." },
            { x: 50, y: 64, label: "Facts, not labels", text: "Reports can describe what happened, who was involved, when and where it occurred, and any witnesses." },
            { x: 78, y: 42, label: "Follow-through", text: "A prompt, impartial review should address safety, retaliation, and corrective action." },
          ],
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


export const harassmentCourseDefinition = {
  title: "Workplace Sexual Harassment and Violence Prevention",
  slug: "workplace-sexual-harassment-prevention",
  description:
    "Comprehensive example course showcasing every Mason teaching moment type—including AI instructor slides, flash cards, click-to-explore images, explain, text, tiles, visual, drag-to-order, scenario, and summary—alongside U.S. workplace harassment and violence prevention training.",
  audience:
    "Employees and supervisors; requires company and jurisdiction-specific customization before deployment",
  theme: "clean",
  intensity: "comprehensive",
  estimatedMinutes: 120,
  displayMode: "webpage",
  published: true,
  sections: harassmentSections,
};
