// ============================================================
// WEB APP ENTRY POINT
// ============================================================
function doGet() {
  var html = HtmlService.createHtmlOutputFromFile('Index');
  html.setTitle('Teacher Portal');
  return html;
}

// ============================================================
// CLASSROOM
// ============================================================
function getCourses() {
  var courses = [], pageToken;
  do {
    var options = { courseStates: ['ACTIVE'], teacherId: 'me' };
    if (pageToken) options.pageToken = pageToken;
    var response = Classroom.Courses.list(options);
    courses = courses.concat(response.courses || []);
    pageToken = response.nextPageToken;
  } while (pageToken);
  return courses.map(function(c) {
    return { id: c.id, name: c.name };
  });
}

function listAllCourseStudents(courseId) {
  var students = [], pageToken;
  do {
    var options = {};
    if (pageToken) options.pageToken = pageToken;
    var response = Classroom.Courses.Students.list(courseId, options);
    students = students.concat(response.students || []);
    pageToken = response.nextPageToken;
  } while (pageToken);
  return students;
}

function listAllStudentSubmissions(courseId, courseworkId, options) {
  var submissions = [], pageToken;
  do {
    var requestOptions = Object.assign({}, options || {});
    if (pageToken) requestOptions.pageToken = pageToken;
    var response = Classroom.Courses.CourseWork.StudentSubmissions.list(courseId, courseworkId, requestOptions);
    submissions = submissions.concat(response.studentSubmissions || []);
    pageToken = response.nextPageToken;
  } while (pageToken);
  return submissions;
}

function getHQSDSubmissionsForReport(courseId, courseWork) {
  if (String(courseWork.state || '').toUpperCase() === 'DRAFT') {
    return {
      submissions: [],
      status: 'Draft in Google Classroom — publish when ready before collecting student submissions.'
    };
  }
  try {
    return {
      submissions: listAllStudentSubmissions(courseId, courseWork.id),
      status: ''
    };
  } catch (error) {
    var message = String(error && error.message || error || '');
    return {
      submissions: [],
      status: message.indexOf('Precondition check failed') >= 0
        ? 'Classroom could not provide submissions. Confirm this assignment is published and belongs to the selected class.'
        : 'Submission data is temporarily unavailable for this assignment.'
    };
  }
}

// Safely creates or reuses an existing topic (handles pagination)
function getOrCreateTopic(courseId, topicName) {
  var pageToken = null;
  do {
    var response = Classroom.Courses.Topics.list(courseId, { pageToken: pageToken });
    var topics = response.topic || [];
    for (var i = 0; i < topics.length; i++) {
      if (topics[i].name.toLowerCase() === topicName.toLowerCase()) {
        return topics[i].topicId;
      }
    }
    pageToken = response.nextPageToken;
  } while (pageToken);

  var newTopic = Classroom.Courses.Topics.create({ name: topicName }, courseId);
  return newTopic.topicId;
}

function postCourseWork(courseId, topicId, title, description, materials, maxPoints, workType) {
  var body = {
    title: title,
    description: description,
    topicId: topicId,
    workType: workType || 'ASSIGNMENT',
    // Teacher Portal always stages new work for review. The teacher explicitly
    // publishes it from Google Classroom after checking dates and student view.
    state: 'DRAFT',
    materials: materials
  };
  if (maxPoints) body.maxPoints = maxPoints;
  return Classroom.Courses.CourseWork.create(body, courseId);
}

function getOrCreateInsertionLogSheet() {
  var ss = getOrCreateCriteriaSpreadsheet();
  var sheet = ss.getSheetByName('Insertion Log');
  if (!sheet) {
    sheet = ss.insertSheet('Insertion Log');
    sheet.appendRow(['insertionKey', 'courseId', 'topicId', 'resultJSON', 'insertedAt']);
  }
  return sheet;
}

function getLoggedInsertion(insertionKey) {
  if (!insertionKey) return null;
  var data = getOrCreateInsertionLogSheet().getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(insertionKey)) {
      try { return JSON.parse(data[i][3] || '{}'); } catch (e) { return { status: 'inserted' }; }
    }
  }
  return null;
}

function recordLoggedInsertion(insertionKey, courseId, topicId, result) {
  if (!insertionKey) return;
  getOrCreateInsertionLogSheet().appendRow([insertionKey, courseId, topicId, JSON.stringify(result || {}), new Date()]);
}

// Posts a teacher's already-created Drive file during the final Insert step.
// Fillable Google files become one copy per student; view-only files are posted
// as Classroom materials so they do not create unnecessary grading work.
function insertExistingDriveFile(courseId, topicId, item) {
  if (!item || !item.fileId) throw new Error('No Drive file was selected.');
  var previous = getLoggedInsertion(item.insertionKey);
  if (previous) return previous;
  var file = DriveApp.getFileById(item.fileId);
  var title = item.title || file.getName();
  var shareMode = item.shareMode === 'STUDENT_COPY' ? 'STUDENT_COPY' : 'VIEW';

  if (shareMode === 'STUDENT_COPY') {
    if (String(file.getMimeType()).indexOf('application/vnd.google-apps.') !== 0) {
      throw new Error('Make-a-copy assignments require a Google Doc, Sheet, or Slides file. Convert this file in Drive first, or post it as view only.');
    }
    var copyWork = postCourseWork(courseId, topicId, title,
      'Complete and submit your copy of the attached project guide.',
      [primaryMaterial(item.fileId, 'STUDENT_COPY')], Number(item.maxPoints) || 100);
    var copyResult = { title: title, type: 'existing', status: 'inserted', resourceId: copyWork.id };
    recordLoggedInsertion(item.insertionKey, courseId, topicId, copyResult);
    return copyResult;
  }

  var body = {
    title: title,
    description: 'Use the attached project guide as directed.',
    topicId: topicId,
    state: 'DRAFT',
    materials: [primaryMaterial(item.fileId, 'VIEW')]
  };
  var material = Classroom.Courses.CourseWorkMaterials.create(body, courseId);
  var materialResult = { title: title, type: 'existing', status: 'inserted', resourceId: material.id };
  recordLoggedInsertion(item.insertionKey, courseId, topicId, materialResult);
  return materialResult;
}

// ============================================================
// DRIVE FILES (no Cloud Console / Picker API needed — DriveApp
// is a built-in Apps Script service, works with the script's
// existing OAuth scopes)
// ============================================================
function searchDriveFiles(query) {
  var safeQuery = query.replace(/["\\]/g, ''); // basic sanitization
  var files = DriveApp.searchFiles('title contains "' + safeQuery + '" and trashed = false');
  var results = [];
  var count = 0;
  while (files.hasNext() && count < 15) {
    var f = files.next();
    results.push({ id: f.getId(), name: f.getName(), mimeType: f.getMimeType() });
    count++;
  }
  return results;
}

// Saves a base64-encoded upload from the browser into Drive so it can be read/converted.
// Flagged isTempUpload so it gets cleaned up after extraction — it's just a transport
// mechanism for getting the file's text into the AI prompts, not something meant to persist.
function saveUploadedFile(name, mimeType, base64Data) {
  var bytes = Utilities.base64Decode(base64Data);
  var blob = Utilities.newBlob(bytes, mimeType, name);
  var file = DriveApp.createFile(blob);
  return { id: file.getId(), name: file.getName(), mimeType: mimeType, isTempUpload: true };
}

// Resolves config.uploadedFiles + config.driveFiles into a single list of
// Drive file descriptors {id, name, mimeType, isTempUpload}. These are SOURCE MATERIAL
// ONLY — read for content, never posted to Classroom, never linked in the generated docs,
// and never shown to students. Files uploaded from the browser are trashed again once
// their text has been extracted; files picked from existing Drive search are left alone
// since they already existed independently of this tool.
function resolveAttachedFiles(config) {
  var attached = [];
  (config.uploadedFiles || []).forEach(function(f) {
    attached.push(saveUploadedFile(f.name, f.mimeType, f.data));
  });
  (config.driveFiles || []).forEach(function(f) {
    attached.push(f);
  });
  return attached;
}

// Primary submission/reference doc material. Use shareMode 'STUDENT_COPY' for anything
// a student needs to fill in and turn in; leave as 'VIEW' for read-only reference docs.
function primaryMaterial(fileId, shareMode) {
  return { driveFile: { driveFile: { id: fileId }, shareMode: shareMode || 'VIEW' } };
}

// ============================================================
// CONTENT EXTRACTION FROM ATTACHED FILES
// ============================================================
// Pulls real text out of whatever gets uploaded/attached (PPT, PDF, DOCX, Google Docs/
// Slides/Sheets, plain text) and folds it into the `content` that flows into every
// callClaudeFor___ function. This is the ONLY thing attached files are used for — they
// are source material for the AI, never Classroom materials, never links in the output docs.
//
// REQUIRES: the Drive API advanced service enabled (Apps Script editor > Services >
// "Drive API"). Uses v2-style Files.copy with convert/ocr — if your project's advanced
// service defaults to v3, this one function needs updating for v3 syntax.

// extractTextFromFile now returns {text, error}. Previously a failed conversion was
// swallowed silently (returned ''), which meant a PPT that failed to convert produced
// NO content at all, but the build still "succeeded" — the AI just generated from the
// item's bare title instead, giving wildly unrelated output with zero indication why.
// Now every failure is captured and surfaced in the final build status message instead.
function extractTextFromFile(f) {
  try {
    if (f.mimeType === 'application/vnd.google-apps.document') {
      return { text: DocumentApp.openById(f.id).getBody().getText(), error: null };
    }
    if (f.mimeType === 'application/vnd.google-apps.presentation') {
      return { text: extractSlidesText(f.id), error: null };
    }
    if (f.mimeType === 'application/vnd.google-apps.spreadsheet') {
      return { text: extractSheetsText(f.id), error: null };
    }
    if (f.mimeType === 'text/plain' || f.mimeType === 'text/csv') {
      return { text: DriveApp.getFileById(f.id).getBlob().getDataAsString(), error: null };
    }
    var officeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];
    if (officeTypes.indexOf(f.mimeType) !== -1) {
      return extractViaConversion(f);
    }
    return { text: '', error: 'Unsupported file type (' + f.mimeType + ') — could not be read.' };
  } catch (e) {
    return { text: '', error: e.message };
  }
}

// Maps an uploaded office/PDF mimeType to the Google-native type it should be converted
// to in order to read its text.
function getGoogleTargetMimeType(sourceMimeType) {
  if (sourceMimeType === 'application/vnd.ms-powerpoint' ||
      sourceMimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    return 'application/vnd.google-apps.presentation';
  }
  if (sourceMimeType === 'application/msword' ||
      sourceMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      sourceMimeType === 'application/pdf') {
    return 'application/vnd.google-apps.document';
  }
  return null;
}

// Converts by CREATING a new Google-native file directly from the original file's bytes
// with the target Google mimeType requested. This is the reliable way to force conversion
// regardless of whether your project's Drive advanced service is v2 or v3 — unlike
// Files.copy's "convert" flag, which v3 silently ignores, producing an unconverted copy
// and an empty read with no error. Tries the v3 method name first, falls back to v2's.
function extractViaConversion(f) {
  var targetMimeType = getGoogleTargetMimeType(f.mimeType);
  if (!targetMimeType) {
    return { text: '', error: 'No conversion path known for type ' + f.mimeType };
  }

  var blob;
  try {
    blob = DriveApp.getFileById(f.id).getBlob();
  } catch (e) {
    return { text: '', error: 'Could not read the uploaded file from Drive: ' + e.message };
  }

  var resource = { title: 'TEMP_EXTRACT_' + f.name, name: 'TEMP_EXTRACT_' + f.name, mimeType: targetMimeType };
  var created = null;
  var lastError = null;

  try {
    created = Drive.Files.create(resource, blob); // v3 advanced Drive service
  } catch (e3) {
    lastError = e3;
    try {
      created = Drive.Files.insert(resource, blob, { convert: true }); // v2 advanced Drive service
    } catch (e2) {
      lastError = e2;
    }
  }

  if (!created) {
    return {
      text: '',
      error: 'Could not convert "' + f.name + '" for reading. Make sure the Drive API ' +
        'advanced service is enabled (Apps Script editor > Services > Drive API). ' +
        'Underlying error: ' + (lastError ? lastError.message : 'unknown')
    };
  }

  var text = '';
  try {
    if (targetMimeType === 'application/vnd.google-apps.presentation') {
      text = extractSlidesText(created.id);
    } else {
      text = DocumentApp.openById(created.id).getBody().getText();
    }
  } catch (eRead) {
    return { text: '', error: 'Converted "' + f.name + '" but could not read its content: ' + eRead.message };
  } finally {
    try { Drive.Files.remove(created.id); } catch (eRemove1) {
      try { DriveApp.getFileById(created.id).setTrashed(true); } catch (eRemove2) { /* give up quietly */ }
    }
  }

  if (!text) {
    return { text: '', error: 'Converted "' + f.name + '" but it appears to have no readable text (empty or image-only slides/pages).' };
  }
  return { text: text, error: null };
}

function extractSlidesText(fileId) {
  var slides = SlidesApp.openById(fileId).getSlides();
  var lines = [];
  slides.forEach(function(slide, i) {
    lines.push('--- Slide ' + (i + 1) + ' ---');
    slide.getShapes().forEach(function(shape) {
      if (shape.getText) {
        var t = shape.getText().asString().trim();
        if (t) lines.push(t);
      }
    });
    var notesShape = slide.getNotesPage().getSpeakerNotesShape();
    if (notesShape) {
      var notesText = notesShape.getText().asString().trim();
      if (notesText) lines.push('Notes: ' + notesText);
    }
  });
  return lines.join('\n');
}

function extractSheetsText(fileId) {
  var lines = [];
  SpreadsheetApp.openById(fileId).getSheets().forEach(function(sheet) {
    sheet.getDataRange().getValues().forEach(function(row) {
      lines.push(row.join(' | '));
    });
  });
  return lines.join('\n');
}

// Extracted text from every attached file, capped so a big deck doesn't blow past
// Claude's prompt budget. Bump CAP if you regularly work with longer files.
// Returns {content, warnings} — warnings lists any file that failed to yield readable
// text, so the caller can surface that to the teacher instead of silently generating
// content that has nothing to do with what was uploaded.
function buildExtractedContentBlock(attachedFiles) {
  var CAP = 20000;
  var warnings = [];
  var chunks = (attachedFiles || []).map(function(f) {
    var result = extractTextFromFile(f);
    if (result.error) {
      warnings.push(f.name + ': ' + result.error);
    }
    return result.text ? ('=== Content from "' + f.name + '" ===\n' + result.text) : '';
  }).filter(Boolean);
  var combined = chunks.join('\n\n');
  if (combined.length > CAP) {
    combined = combined.substring(0, CAP) + '\n\n[Content truncated for length.]';
  }
  return { content: combined, warnings: warnings };
}

// Removes the Drive copies we created solely to read an uploaded file's text.
// Files the teacher picked from an existing Drive search are left untouched —
// those existed independently of this tool and aren't ours to delete.
function cleanupTempUploads(attachedFiles) {
  (attachedFiles || []).forEach(function(f) {
    if (f.isTempUpload) {
      try {
        DriveApp.getFileById(f.id).setTrashed(true);
      } catch (e) {
        // already gone or inaccessible — nothing to do
      }
    }
  });
}

// ============================================================
// SETTINGS (persisted per-user; drives AI speed, default grading
// criteria behavior, and generated-Doc accent color)
// ============================================================
var DEFAULT_SETTINGS = { aiSpeed: 'detailed', defaultAutoCriteria: true, accentColor: '#f59e0b' };

function getSettings() {
  var raw = PropertiesService.getUserProperties().getProperty('BUILDER_SETTINGS');
  if (!raw) return DEFAULT_SETTINGS;
  try {
    var parsed = JSON.parse(raw);
    return {
      aiSpeed: parsed.aiSpeed || DEFAULT_SETTINGS.aiSpeed,
      defaultAutoCriteria: parsed.defaultAutoCriteria !== undefined ? parsed.defaultAutoCriteria : DEFAULT_SETTINGS.defaultAutoCriteria,
      accentColor: parsed.accentColor || DEFAULT_SETTINGS.accentColor
    };
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings) {
  PropertiesService.getUserProperties().setProperty('BUILDER_SETTINGS', JSON.stringify({
    aiSpeed: settings.aiSpeed === 'fast' ? 'fast' : 'detailed',
    defaultAutoCriteria: !!settings.defaultAutoCriteria,
    accentColor: settings.accentColor || DEFAULT_SETTINGS.accentColor
  }));
  return getSettings();
}

// ============================================================
// CLAUDE API
// ============================================================
var MODEL_DETAILED = 'claude-sonnet-4-6';
var MODEL_FAST = 'claude-haiku-4-5-20251001';

function getClaudeApiKey() {
  var apiKey = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
  if (!apiKey) {
    throw new Error('CLAUDE_API_KEY not found in Script Properties. Please check your settings.');
  }
  return apiKey;
}

function callClaude(prompt, maxTokens, model) {
  var url = 'https://api.anthropic.com/v1/messages';
  var payload = {
    model: model || MODEL_DETAILED,
    max_tokens: maxTokens || 2500,
    messages: [{ role: 'user', content: prompt }]
  };
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': getClaudeApiKey(),
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  var response, code, text;
  for (var attempt = 0; attempt < 3; attempt++) {
    response = UrlFetchApp.fetch(url, options);
    code = response.getResponseCode();
    text = response.getContentText();
    if (code === 200) break;
    if (code !== 429 && code < 500) break;
    if (attempt < 2) Utilities.sleep(attempt === 0 ? 500 : 1500);
  }
  if (code !== 200) throw new Error('The AI service could not complete this request (HTTP ' + code + '). No grade or content was saved. Please try again.');
  try {
    var parsed = JSON.parse(text);
    if (!parsed.content || !parsed.content[0] || typeof parsed.content[0].text !== 'string') throw new Error('missing content');
    return parsed.content[0].text;
  } catch (e) {
    throw new Error('The AI service returned an unreadable response. No grade or content was saved. Please try again.');
  }
}

function stripJsonFences(raw) {
  return raw.trim().replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
}

// Quiz question generation (MC / TF / SA pipe-delimited format).
// SA lines include a private model answer (not shown to students) used later for grading.
function callClaudeToFormat(rawContent, specs, model) {
  var prompt =
    'You are an expert teacher. Take the raw content/topic below and create test questions based on the following breakdown:\n' +
    '- ' + specs.mc + ' Multiple Choice questions\n' +
    '- ' + specs.tf + ' True/False questions\n' +
    '- ' + specs.sa + ' Short Answer questions\n\n' +
    'You MUST return ONLY lines following this exact prefix schema (no markdown formatting, no extra conversational text):\n' +
    'MC: Question | Choice A | Choice B | Choice C | Choice D | Correct Letter (A/B/C/D)\n' +
    'TF: Statement | True (or False)\n' +
    'SA: Question | Model Answer (a concise ideal answer, used only for grading \u2014 never shown to students)\n\n' +
    'RAW CONTENT / TOPIC:\n' + rawContent;
  return callClaude(prompt, 2500, model);
}

function defaultStudentGradingCriteria(itemType) {
  var defaults = {
    assignment: [
      { criterion: 'Accuracy', expectation: 'Responses correctly explain the required ideas and use appropriate course vocabulary.', points: 40 },
      { criterion: 'Evidence and explanation', expectation: 'Responses support ideas with specific details, examples, or reasoning instead of unsupported statements.', points: 30 },
      { criterion: 'Completion', expectation: 'Every prompt is answered fully and follows all directions.', points: 20 },
      { criterion: 'Clarity', expectation: 'Writing is organized, readable, and expressed in complete sentences.', points: 10 }
    ],
    customassignment: [
      { criterion: 'Task requirements', expectation: 'All required parts of the assigned task are complete and follow the stated directions.', points: 40 },
      { criterion: 'Accuracy and quality', expectation: 'The work is correct, specific, and demonstrates understanding of the topic.', points: 30 },
      { criterion: 'Evidence and reasoning', expectation: 'Ideas are supported with relevant details, examples, calculations, or explanations as appropriate.', points: 20 },
      { criterion: 'Clarity and presentation', expectation: 'The submission is organized, readable, and ready to evaluate.', points: 10 }
    ],
    writing: [
      { criterion: 'Content and evidence', expectation: 'The response fully addresses the prompt and supports its main ideas with accurate, specific evidence.', points: 40 },
      { criterion: 'Reasoning and development', expectation: 'Ideas are explained clearly and show thoughtful connections rather than a list of statements.', points: 25 },
      { criterion: 'Organization', expectation: 'The response has a logical beginning, middle, and ending with effective transitions.', points: 25 },
      { criterion: 'Conventions', expectation: 'Grammar, spelling, punctuation, and sentence structure make the writing easy to understand.', points: 10 }
    ],
    research: [
      { criterion: 'Research findings', expectation: 'Every research prompt is answered with accurate, relevant information.', points: 40 },
      { criterion: 'Evidence and sources', expectation: 'Findings include specific facts or examples, and all sources used are identified.', points: 30 },
      { criterion: 'Explanation', expectation: 'The student explains why the findings matter and makes clear connections to the topic.', points: 20 },
      { criterion: 'Organization and clarity', expectation: 'Responses are complete, clearly labeled, and easy to follow.', points: 10 }
    ],
    discussion: [
      { criterion: 'Addresses the prompt', expectation: 'The response directly and completely answers the discussion question.', points: 50 },
      { criterion: 'Support', expectation: 'The response uses a relevant example, fact, or explanation to support its position.', points: 30 },
      { criterion: 'Clarity', expectation: 'The response is respectful, specific, and easy to understand.', points: 20 }
    ]
  };
  return defaults[itemType] || defaults.assignment;
}

function normalizeStudentGradingCriteria(criteria, itemType) {
  var clean = (criteria || []).map(function(row) {
    return {
      criterion: String(row.criterion || '').trim(),
      expectation: String(row.expectation || row.description || '').trim(),
      points: Number(row.points)
    };
  }).filter(function(row) {
    return row.criterion && row.expectation && isFinite(row.points) && row.points > 0;
  });
  var total = clean.reduce(function(sum, row) { return sum + row.points; }, 0);
  return clean.length >= 2 && total === 100 ? clean : defaultStudentGradingCriteria(itemType);
}

// Short-answer assignment: directions, prompts, and criteria are generated as one
// aligned student-facing package instead of disconnected question lines.
function callClaudeForPrompts(rawContent, count, model) {
  var prompt =
    'You are an expert teacher creating a student-facing short-answer assignment. Based on the material below, write exactly ' + count + ' focused prompts.\n' +
    'The directions must tell students exactly what to complete, where to write, what kind of support to include, and what to submit. ' +
    'Each prompt must ask one clear task, use student language, and require a complete-sentence explanation. Avoid vague verbs such as discuss or explore unless you state exactly what the response must contain.\n' +
    'Return ONLY valid JSON matching this schema:\n' +
    '{"instructions":"2-4 concise sentences addressed to the student","questions":["string"]}\n\n' +
    'RAW CONTENT / TOPIC:\n' + rawContent;
  var raw = stripJsonFences(callClaude(prompt, 1800, model));
  try {
    var parsed = JSON.parse(raw);
    return {
      instructions: 'Answer every prompt in the space provided. Use complete sentences and support each response with specific details or examples from the assigned material. Review the 100-point grading table, then submit the completed document.',
      questions: (parsed.questions || []).slice(0, count),
      gradingCriteria: defaultStudentGradingCriteria('assignment')
    };
  } catch (e) {
    throw new Error('The AI returned an unreadable assignment structure. Regenerate this item; nothing has been inserted.');
  }
}

// Structured sections for a visual content page
function callClaudeForContentPage(topicOrTitle, rawContent, sectionCount, model) {
  var prompt =
    'You are an expert instructional designer writing a visually structured content page for students.\n' +
    'Based on the raw content/topic below, produce exactly ' + sectionCount + ' sections.\n' +
    'Write directly for students: define unfamiliar terms, use concrete examples, and never include teacher notes, grading instructions, answer keys, or phrases such as what to look for.\n' +
    'Return ONLY valid JSON (no markdown fences, no commentary) matching this schema:\n' +
    '{"sections": [{"heading": "string", "body": "2-4 sentence explanation in plain language", "keyFact": "one short, memorable key-fact callout sentence"}]}\n\n' +
    'TOPIC: ' + topicOrTitle + '\n' +
    'RAW CONTENT:\n' + rawContent;
  var raw = stripJsonFences(callClaude(prompt, 2000, model));
  try {
    return JSON.parse(raw).sections || [];
  } catch (e) {
    throw new Error('The AI returned an unreadable content-page structure. Regenerate this item; nothing has been inserted.');
  }
}

// Study guide: now returns real structure (heading + short paragraphs + optional bullet
// list per section) instead of one long unformatted block of prose, so the built Doc
// actually looks like a study guide instead of a wall of text.
function callClaudeForStudyGuide(topicOrTitle, rawContent, model) {
  var prompt =
    'You are an expert teacher writing a student-facing study guide.\n' +
    'Based on the topic and any notes below, break the material into logical sections ' +
    '(typically 3-6, use your judgment based on how much content there is).\n' +
    'For each section provide: a short heading, 1-3 short paragraphs of plain-language explanation, ' +
    'and (only where it genuinely helps) a short bullet list of key points, terms, or steps to remember. ' +
    'Leave the bullets array empty if a section does not need one \u2014 do not force bullets into every section.\n' +
    'Define unfamiliar terms, use concrete student-relevant examples, and do not include teacher notes, grading language, or an answer key.\n' +
    'Return ONLY valid JSON (no markdown fences, no commentary) matching this schema:\n' +
    '{"sections": [{"heading": "string", "paragraphs": ["string", ...], "bullets": ["string", ...]}]}\n\n' +
    'TOPIC: ' + topicOrTitle + '\n' +
    'NOTES (may be brief or empty):\n' + (rawContent || '(none provided \u2014 rely on the topic itself)');
  var raw = stripJsonFences(callClaude(prompt, 2500, model));
  try {
    var parsed = JSON.parse(raw);
    return parsed.sections || [];
  } catch (e) {
    throw new Error('The AI returned an unreadable study-guide structure. Regenerate this item; nothing has been inserted.');
  }
}

// Writing assignment: a prompt plus an optional simple rubric
function callClaudeForWritingAssignment(topicOrTitle, rawContent, targetWords, includeRubric, model) {
  var prompt =
    'You are an expert teacher creating an essay-style writing assignment.\n' +
    'Based on the topic/notes below, write ONE clear writing prompt asking students to respond in approximately ' +
    targetWords + ' words. Provide direct student instructions and a short list of concrete submission requirements.\n' +
    'Return ONLY valid JSON (no markdown fences, no commentary) matching this schema:\n' +
    '{"instructions":"string","prompt":"string","requirements":["string"]}\n' +
    '\nTOPIC: ' + topicOrTitle + '\n' +
    'NOTES:\n' + (rawContent || '(none provided \u2014 rely on the topic itself)');
  var raw = stripJsonFences(callClaude(prompt, 1500, model));
  try {
    var parsed = JSON.parse(raw);
    parsed.instructions = 'Write a complete response to the prompt below. Address every part of the prompt, support your ideas with specific evidence or examples, organize the response logically, and proofread before submitting the completed document.';
    parsed.requirements = parsed.requirements || ['Address every part of the prompt.', 'Use specific evidence or examples.', 'Organize and proofread the final response.'];
    parsed.rubric = [];
    parsed.gradingCriteria = defaultStudentGradingCriteria('writing');
    return parsed;
  } catch (e) {
    throw new Error('The AI returned an unreadable writing-assignment structure. Regenerate this item; nothing has been inserted.');
  }
}

// Research assignment: one topic followed by distinct, actionable research prompts.
function callClaudeForResearchAssignment(topicOrTitle, rawContent, subQuestionCount, model) {
  var prompt =
    'You are an expert teacher creating a clear student-facing research assignment. Do not answer the prompts.\n' +
    'The assignment title is the research topic; do not turn it into another main question. Write exactly ' + subQuestionCount +
    ' distinct research prompts. Each prompt must begin with an actionable verb such as define, compare, explain, identify, analyze, or give examples, ' +
    'and must say exactly what evidence the student should record. Avoid overlapping prompts and do not create a vague what-to-look-for paragraph.\n' +
    'Directions must tell students to answer every labeled prompt in their own words, include specific researched details, identify the sources used, and submit the completed document.\n' +
    'Return ONLY valid JSON (no markdown fences, no commentary) matching this schema:\n' +
    '{"instructions":"3-5 concise student-facing sentences","researchPrompts":["string", ...]}\n\n' +
    'TOPIC: ' + topicOrTitle + '\n' +
    'NOTES:\n' + (rawContent || '(none provided \u2014 rely on the topic itself)');
  var raw = stripJsonFences(callClaude(prompt, 1500, model));
  try {
    var parsed = JSON.parse(raw);
    return { topic: topicOrTitle,
      instructions: 'Research the topic below and answer every labeled prompt in your own words. Include specific facts and examples from reliable sources. Record the source or sources you used, review the 100-point grading table, and submit the completed document.',
      researchPrompts: parsed.researchPrompts || [], gradingCriteria: defaultStudentGradingCriteria('research') };
  } catch (e) {
    throw new Error('The AI returned an unreadable research-assignment structure. Regenerate this item; nothing has been inserted.');
  }
}

// Custom content page: Claude designs its own section structure from free-form instructions
function callClaudeForCustomContentPage(topicOrTitle, instructions, model) {
  var prompt =
    'You are an expert instructional designer building a visually structured content page for students.\n' +
    'A teacher has given you free-form instructions describing exactly what they want. Follow them closely, ' +
    'and decide the right number of sections yourself (typically 2-6) based on what the instructions call for.\n' +
    'The finished page is for students. Use clear explanations and examples; never expose teacher notes, grading instructions, or answer keys.\n' +
    'Return ONLY valid JSON (no markdown fences, no commentary) matching this schema:\n' +
    '{"sections": [{"heading": "string", "body": "plain language explanation", "keyFact": "short memorable callout sentence, or empty string if not appropriate for this section"}]}\n\n' +
    'PAGE TITLE: ' + topicOrTitle + '\n' +
    'TEACHER INSTRUCTIONS:\n' + instructions;
  var raw = stripJsonFences(callClaude(prompt, 2500, model));
  try {
    return JSON.parse(raw).sections || [];
  } catch (e) {
    throw new Error('The AI returned an unreadable custom-content structure. Regenerate this item; nothing has been inserted.');
  }
}

// Custom assignment: Claude designs the whole assignment (intro + question set) from free-form instructions
function callClaudeForCustomAssignment(topicOrTitle, instructions, model) {
  var prompt =
    'You are an expert teacher building a student assignment. A teacher has given you free-form instructions ' +
    'describing exactly what they want this assignment to be \u2014 the type of task, question count, format, ' +
    'tone, whatever they specify. Follow them closely and use your judgment to fill in anything they left unstated.\n' +
    'Write directions directly to the student that state what to do, what to include, and what to submit. Questions or tasks must each be specific and independently understandable. ' +
    'Return ONLY valid JSON (no markdown fences, no commentary) matching this schema:\n' +
    '{"instructions":"clear student directions","questions":["string", ...]}\n\n' +
    'ASSIGNMENT TITLE: ' + topicOrTitle + '\n' +
    'TEACHER INSTRUCTIONS:\n' + instructions;
  var raw = stripJsonFences(callClaude(prompt, 2000, model));
  try {
    var parsed = JSON.parse(raw);
    return { instructions: 'Complete every labeled task below in the space provided. Follow the requirement stated in each task, include the requested details or evidence, review the 100-point grading table, and submit the completed document.',
      questions: parsed.questions || [], gradingCriteria: defaultStudentGradingCriteria('customassignment') };
  } catch (e) {
    throw new Error('The AI returned an unreadable custom-assignment structure. Regenerate this item; nothing has been inserted.');
  }
}

// Shop project: builds a student/teacher working document with an analytic rubric.
// Physical workmanship remains teacher-scored; AI only creates the blank instrument.
function callClaudeForShopProject(topicOrTitle, projectDescription, studentSectionNames, rubricCriteriaCount, model) {
  var prompt =
    'You are an experienced career-technical woodworking teacher designing a shop project assignment and rubric.\n' +
    'Create a practical document students can use throughout the project and the teacher can finish while grading the physical work.\n' +
    'Do not claim to observe or score the completed physical project. Create the blank evaluation instrument only.\n' +
    'The overview must plainly state what the student will build and the purpose of the project. Student directions must be a numbered workflow covering planning, safety approval, construction, quality checks, reflection, and exactly what to submit. ' +
    'Do not turn a shop project into a research assignment unless the teacher explicitly requests research.\n' +
    'Use exactly ' + rubricCriteriaCount + ' meaningful rubric criteria. Include safety as a criterion or safety gate whenever appropriate.\n' +
    'Create these requested student sections in this order: ' + studentSectionNames + '.\n' +
    'Each student-section prompt must say exactly what the student writes, draws, measures, checks, or attaches. Rubric descriptors must be observable, student-readable, specific, and clearly progress from Beginning to Mastery. Use measurable tolerances when the description provides them.\n' +
    'Return ONLY valid JSON (no markdown fences or commentary) matching this schema:\n' +
    '{"overview":"string","studentDirections":"string","learningTargets":["string"],"studentSections":[{"heading":"string","prompt":"specific directions for what the student enters"}],"safetyGate":"short safety requirement or empty string","rubric":[{"criterion":"string","description":"what this measures","beginning":"level 1 descriptor","developing":"level 2 descriptor","proficient":"level 3 descriptor","mastery":"level 4 descriptor"}]}\n\n' +
    'PROJECT TITLE: ' + topicOrTitle + '\n' +
    'TEACHER PROJECT DESCRIPTION:\n' + projectDescription;
  var raw = stripJsonFences(callClaude(prompt, 3500, model));
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error('The AI returned an unreadable project/rubric structure. Regenerate this item; nothing has been inserted.');
  }
}

// A single discussion prompt
function callClaudeForDiscussionPrompt(rawContent, model) {
  var prompt =
    'Based on the raw content/topic below, write ONE specific open-ended discussion question. Also write one concise sentence telling students to answer the entire prompt, support their thinking with an example or evidence, and respond respectfully. ' +
    'Return ONLY valid JSON matching {"instructions":"string","prompt":"string"}.\n\n' +
    'RAW CONTENT / TOPIC:\n' + rawContent;
  var raw = stripJsonFences(callClaude(prompt, 500, model));
  try {
    var parsed = JSON.parse(raw);
    return { instructions: 'Answer the entire discussion prompt in a complete response. Support your thinking with a specific example, fact, or explanation, use respectful language, review the grading criteria, and submit your response.',
      prompt: parsed.prompt || '', gradingCriteria: defaultStudentGradingCriteria('discussion') };
  } catch (e) {
    throw new Error('The AI returned an unreadable discussion structure. Regenerate this item; nothing has been inserted.');
  }
}

// Private grading criteria for any gradable item \u2014 the student never sees this.
function callClaudeForGradingCriteria(itemTitle, itemType, referenceMaterial, teacherNotes) {
  var prompt =
    'You are an expert teacher preparing a private grading guide. The student will never see this.\n' +
    'Assignment type: ' + itemType + '\n' +
    'Assignment title: ' + itemTitle + '\n' +
    'Here is what was assigned to the student, for your reference:\n' + referenceMaterial + '\n\n' +
    (teacherNotes ? 'The teacher added these specific notes to factor into grading:\n' + teacherNotes + '\n\n' : '') +
    'Use the exact student-facing point categories supplied in the assignment as the scoring framework. Write a clear, practical grading guide that explains full credit and partial credit for each category. ' +
    'Do not introduce new requirements that were not shown to the student. Return plain text only, no markdown symbols.';
  return callClaude(prompt, 1200).trim();
}

function validateGeneratedItemContent(item, data) {
  function requireText(value, label) {
    if (!String(value || '').trim()) throw new Error('Generated ' + label + ' was empty. Regenerate this item before inserting it.');
  }
  function requireCriteria(criteria, itemType) {
    var normalized = normalizeStudentGradingCriteria(criteria, itemType);
    if (!normalized.length) throw new Error('Generated grading criteria were incomplete. Regenerate this item before inserting it.');
    return normalized;
  }
  if (item.type === 'assignment') {
    requireText(data.instructions, 'student directions');
    if (!data.questions || data.questions.length !== Number(item.promptCount || 2)) throw new Error('The assignment did not contain the requested number of prompts. Regenerate it before inserting.');
    data.questions.forEach(function(question) { requireText(question, 'assignment prompt'); });
    data.gradingCriteria = requireCriteria(data.gradingCriteria, 'assignment');
  } else if (item.type === 'customassignment') {
    requireText(data.instructions, 'student directions');
    if (!data.questions || !data.questions.length) throw new Error('The custom assignment did not contain any student tasks. Regenerate it before inserting.');
    data.questions.forEach(function(question) { requireText(question, 'student task'); });
    data.gradingCriteria = requireCriteria(data.gradingCriteria, 'customassignment');
  } else if (item.type === 'writing') {
    requireText(data.instructions, 'student directions');
    requireText(data.prompt, 'writing prompt');
    if (!data.requirements || !data.requirements.length) throw new Error('The writing assignment did not contain submission requirements. Regenerate it before inserting.');
    data.gradingCriteria = requireCriteria(data.gradingCriteria, 'writing');
  } else if (item.type === 'research') {
    requireText(data.instructions, 'student directions');
    if (!data.researchPrompts || data.researchPrompts.length !== Number(item.subQuestionCount || 4)) throw new Error('The research assignment did not contain the requested number of research prompts. Regenerate it before inserting.');
    data.researchPrompts.forEach(function(researchPrompt) { requireText(researchPrompt, 'research prompt'); });
    data.gradingCriteria = requireCriteria(data.gradingCriteria, 'research');
  } else if (item.type === 'project') {
    requireText(data.overview, 'project overview');
    requireText(data.studentDirections, 'project directions');
    if (!data.studentSections || !data.studentSections.length) throw new Error('The project did not contain student work sections. Regenerate it before inserting.');
    if (!data.rubric || data.rubric.length !== Number(item.rubricCriteriaCount || 4)) throw new Error('The project rubric did not contain the requested number of criteria. Regenerate it before inserting.');
    data.rubric.forEach(function(row) {
      ['criterion', 'beginning', 'developing', 'proficient', 'mastery'].forEach(function(field) { requireText(row[field], 'project rubric ' + field); });
    });
  } else if (item.type === 'discussion') {
    requireText(data.instructions, 'discussion directions');
    requireText(data.prompt, 'discussion prompt');
    data.gradingCriteria = requireCriteria(data.gradingCriteria, 'discussion');
  } else if (item.type === 'contentpage') {
    if (!data || data.length !== Number(item.sectionCount || 3)) throw new Error('The content page did not contain the requested number of sections. Regenerate it before inserting.');
  } else if (item.type === 'studyguide' || item.type === 'customcontent') {
    if (!data || !data.length) throw new Error('The generated student resource was empty. Regenerate it before inserting.');
  } else if (item.type === 'quiz') {
    var expected = item.specs || { mc: 0, tf: 0, sa: 0 };
    var actual = { mc: 0, tf: 0, sa: 0 };
    (data || []).forEach(function(line) {
      var fields = String(line).split('|').map(function(value) { return value.trim(); });
      if (/^MC:/.test(line)) {
        if (fields.length < 6 || !/^[A-D]$/i.test(fields[5])) throw new Error('A generated multiple-choice question was malformed. Regenerate the test before inserting.');
        actual.mc++;
      } else if (/^TF:/.test(line)) {
        if (fields.length < 2 || !/^(true|false)$/i.test(fields[1])) throw new Error('A generated true/false question was malformed. Regenerate the test before inserting.');
        actual.tf++;
      } else if (/^SA:/.test(line)) {
        if (fields.length < 2 || !fields[1]) throw new Error('A generated short-answer question was missing its private model answer. Regenerate the test before inserting.');
        actual.sa++;
      } else {
        throw new Error('The test contained an unrecognized question line. Regenerate it before inserting.');
      }
    });
    if (actual.mc !== Number(expected.mc || 0) || actual.tf !== Number(expected.tf || 0) || actual.sa !== Number(expected.sa || 0)) {
      throw new Error('The test did not contain the requested mix of questions. Regenerate it before inserting.');
    }
  }
  return data;
}

// Grades one student's submission against stored criteria, on a consistent 0-100 scale.
function callClaudeToGrade(title, itemType, criteria, studentSubmissionText) {
  var prompt =
    'You are privately grading a student submission for a teacher. Only the "feedback" text you write will ' +
    'ever be shown to the student \u2014 speak directly to them in it. Keep the feedback warm, positive, and ' +
    'encouraging while grading accurately. Use a strengths-first, future-focused approach: begin with one ' +
    'specific success when the submission provides one, then phrase every correction or gap as a clear, ' +
    'achievable next-step suggestion. Avoid scolding, shaming, sarcasm, harsh labels, and blunt deficit ' +
    'phrasing such as "you failed," "poor work," or "you did not." If there is no clear success to name, ' +
    'start with an encouraging next step without inventing praise. End on a supportive note.\n' +
    'Assignment: ' + title + ' (type: ' + itemType + ')\n\n' +
    'GRADING CRITERIA (private, teacher-only):\n' + criteria + '\n\n' +
    'STUDENT SUBMISSION:\n' + studentSubmissionText + '\n\n' +
    'Grade this out of 100 points based on the criteria above. Return ONLY valid JSON (no markdown fences, ' +
    'no commentary) matching this schema:\n' +
    '{"grade": number (0-100), "feedback": "2-4 sentences of specific, positive, strengths-first feedback with any needed corrections expressed as actionable suggestions addressed directly to the student"}';
  var raw = stripJsonFences(callClaude(prompt, 800));
  try {
    var parsed = JSON.parse(raw);
    var grade = Number(parsed.grade);
    if (!isFinite(grade) || grade < 0 || grade > 100 || !parsed.feedback) {
      throw new Error('Missing or invalid grade/feedback fields.');
    }
    return { grade: grade, feedback: parsed.feedback };
  } catch (e) {
    throw new Error('AI returned an invalid grading suggestion. Nothing was saved. Please try again or grade manually.');
  }
}

// ============================================================
// GRADING CRITERIA STORAGE (hidden tracking Spreadsheet, never shared with students)
// ============================================================
function getOrCreateCriteriaSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty('CRITERIA_SHEET_ID');
  if (sheetId) {
    try {
      return SpreadsheetApp.openById(sheetId);
    } catch (e) {
      // spreadsheet was deleted or inaccessible \u2014 fall through and recreate
    }
  }
  var ss = SpreadsheetApp.create('Module Builder - Grading Criteria (do not share with students)');
  var sheet = ss.getSheets()[0];
  sheet.appendRow(['courseId', 'courseworkId', 'title', 'itemType', 'criteria', 'formId', 'createdAt']);
  props.setProperty('CRITERIA_SHEET_ID', ss.getId());
  return ss;
}

function getOrCreateCriteriaSheet() {
  return getOrCreateCriteriaSpreadsheet().getSheets()[0];
}

// Tracks exactly which version of each submission we've already graded (by Classroom's
// own updateTime for that submission). This lets the grader tell "already graded, nothing
// changed" apart from "someone else set a grade" (e.g. a manual zero for missing work) —
// so a late turn-in after a manual zero still gets properly graded instead of skipped forever.
function getGradedLogSheet() {
  var ss = getOrCreateCriteriaSpreadsheet();
  var sheet = ss.getSheetByName('Graded Log');
  if (!sheet) {
    sheet = ss.insertSheet('Graded Log');
    sheet.appendRow(['submissionId', 'courseworkId', 'lastGradedUpdateTime', 'grade', 'feedback', 'gradingSource', 'savedAt']);
  } else if (sheet.getLastColumn() < 7) {
    sheet.getRange(1, 1, 1, 7).setValues([['submissionId', 'courseworkId', 'lastGradedUpdateTime', 'grade', 'feedback', 'gradingSource', 'savedAt']]);
  }
  return sheet;
}

function getGradedLogMap(courseworkId) {
  var sheet = getGradedLogSheet();
  var data = sheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(courseworkId)) {
      map[data[i][0]] = {
        row: i + 1,
        updateTime: data[i][2],
        grade: data[i][3],
        feedback: data[i][4],
        gradingSource: data[i][5],
        savedAt: data[i][6]
      };
    }
  }
  return map;
}

function getAllGradedLogMaps() {
  var sheet = getGradedLogSheet();
  var data = sheet.getDataRange().getValues();
  var maps = {};
  for (var i = 1; i < data.length; i++) {
    var courseworkId = String(data[i][1]);
    if (!maps[courseworkId]) maps[courseworkId] = {};
    maps[courseworkId][data[i][0]] = {
      row: i + 1,
      updateTime: data[i][2],
      grade: data[i][3],
      feedback: data[i][4],
      gradingSource: data[i][5],
      savedAt: data[i][6]
    };
  }
  return maps;
}

function recordGradedLog(sheet, existingEntry, submissionId, courseworkId, updateTimeStr, grade, feedback, gradingSource) {
  var rowValues = [submissionId, courseworkId, updateTimeStr, grade === undefined ? '' : grade,
    feedback || '', gradingSource || '', new Date()];
  if (existingEntry) {
    sheet.getRange(existingEntry.row, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

function getGradingDraftsSheet() {
  var ss = getOrCreateCriteriaSpreadsheet();
  var sheet = ss.getSheetByName('Grading Drafts');
  if (!sheet) {
    sheet = ss.insertSheet('Grading Drafts');
    sheet.appendRow(['submissionId', 'courseworkId', 'grade', 'feedback', 'gradingSource', 'submissionUpdateTime', 'savedAt']);
  }
  return sheet;
}

function getGradingDraftMap(courseworkId) {
  var data = getGradingDraftsSheet().getDataRange().getValues();
  var map = {};
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(courseworkId)) {
      map[data[i][0]] = {
        row: i + 1, grade: data[i][2], feedback: data[i][3], gradingSource: data[i][4],
        updateTime: data[i][5], savedAt: data[i][6]
      };
    }
  }
  return map;
}

function saveGradingDraftRecord(submissionId, courseworkId, grade, feedback, gradingSource, updateTime) {
  var sheet = getGradingDraftsSheet();
  var existing = getGradingDraftMap(courseworkId)[submissionId];
  var values = [submissionId, courseworkId, grade, feedback || '', gradingSource || 'manual', updateTime || '', new Date()];
  if (existing) sheet.getRange(existing.row, 1, 1, values.length).setValues([values]);
  else sheet.appendRow(values);
}

function deleteGradingDraftRecord(submissionId, courseworkId) {
  var sheet = getGradingDraftsSheet();
  var existing = getGradingDraftMap(courseworkId)[submissionId];
  if (existing) sheet.deleteRow(existing.row);
}

function rubricCriterionKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function getOrCreateRubricScoresSheet() {
  var ss = getOrCreateCriteriaSpreadsheet();
  var sheet = ss.getSheetByName('Rubric Scores');
  if (!sheet) {
    sheet = ss.insertSheet('Rubric Scores');
    sheet.appendRow(['submissionId', 'courseworkId', 'userId', 'criterionKey', 'criterionName', 'score', 'comment', 'rubricVersion', 'savedAt']);
  }
  return sheet;
}

function getStoredRubricScores(courseworkId, submissionId) {
  var data = getOrCreateRubricScoresSheet().getDataRange().getValues();
  var scores = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(submissionId) && String(data[i][1]) === String(courseworkId)) {
      scores.push({
        criterionKey: String(data[i][3] || ''), criterionName: String(data[i][4] || ''),
        score: Number(data[i][5]), comment: String(data[i][6] || ''), rubricVersion: Number(data[i][7]) || 1
      });
    }
  }
  return scores;
}

function validateStructuredRubricScores(rubric, scores, requireComplete) {
  if (!rubric || !rubric.criteria || !rubric.criteria.length) return [];
  var supplied = {};
  (scores || []).forEach(function(entry) {
    var key = rubricCriterionKey(entry.criterionKey || entry.criterionName);
    if (key) supplied[key] = entry;
  });
  return rubric.criteria.map(function(criterion) {
    var name = normalizeRubricCriterionName(criterion.criterion || criterion.name);
    var key = rubricCriterionKey(name);
    var entry = supplied[key];
    if (!entry) {
      if (requireComplete) throw new Error('Score every rubric criterion before returning the assignment.');
      return null;
    }
    var score = Number(entry.score);
    if (!isFinite(score) || Math.floor(score) !== score || score < 1 || score > 4) {
      throw new Error('Rubric scores must be whole numbers from 1 through 4.');
    }
    return { criterionKey: key, criterionName: name, score: score, comment: String(entry.comment || '') };
  }).filter(function(entry) { return !!entry; });
}

function saveStructuredRubricScores(sub, courseworkId, rubricScores, rubricVersion) {
  var sheet = getOrCreateRubricScoresSheet();
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(sub.id) && String(data[i][1]) === String(courseworkId)) sheet.deleteRow(i + 1);
  }
  (rubricScores || []).forEach(function(entry) {
    sheet.appendRow([sub.id, courseworkId, sub.userId, entry.criterionKey, entry.criterionName,
      entry.score, entry.comment || '', rubricVersion || 1, new Date()]);
  });
}

function writeStructuredRubricScoresToSubmissionDoc(sub, rubricScores) {
  if (!rubricScores || !rubricScores.length) return { written: false, warning: '' };
  var byKey = {};
  rubricScores.forEach(function(entry) { byKey[entry.criterionKey] = entry; });
  var attachments = getSubmittedDriveAttachmentsNewestFirst(sub);
  for (var i = 0; i < attachments.length; i++) {
    try {
      var doc = DocumentApp.openById(attachments[i].driveFile.id);
      var info = findRubricTableInfo(doc);
      if (!info || info.teacherIndex < 0) continue;
      for (var r = info.headerRowIndex + 1; r < info.table.getNumRows(); r++) {
        var row = info.table.getRow(r);
        if (info.criterionIndex >= row.getNumCells() || info.teacherIndex >= row.getNumCells()) continue;
        var key = rubricCriterionKey(normalizeRubricCriterionName(row.getCell(info.criterionIndex).getText()));
        var score = byKey[key];
        if (score) row.getCell(info.teacherIndex).setText(score.score + ' / 4' + (score.comment ? ' — ' + score.comment : ''));
      }
      doc.saveAndClose();
      return { written: true, warning: '' };
    } catch (e) {
      // Try another submitted Google Doc.
    }
  }
  return { written: false, warning: 'Rubric scores were saved in Teacher Portal, but no editable submitted rubric table was found to update.' };
}

function saveGradingCriteria(courseId, courseworkId, title, itemType, criteria, formId) {
  var sheet = getOrCreateCriteriaSheet();
  sheet.appendRow([courseId, courseworkId, title, itemType, criteria, formId || '', new Date()]);
}

function getGradingCriteria(courseworkId) {
  var sheet = getOrCreateCriteriaSheet();
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][1]) === String(courseworkId)) {
      return { courseId: data[i][0], courseworkId: data[i][1], title: data[i][2], itemType: data[i][3], criteria: data[i][4], formId: data[i][5] };
    }
  }
  return null;
}

// Lets a teacher hand-edit the stored grading guide from the Grade tab (e.g.
// to fix something the AI got wrong, or tighten up what counts as full
// credit). Only affects submissions graded AFTER the edit — already-graded
// submissions aren't retroactively re-scored unless they're resubmitted.
function updateGradingCriteria(courseworkId, newCriteria) {
  var sheet = getOrCreateCriteriaSheet();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(courseworkId)) {
      sheet.getRange(i + 1, 5).setValue(newCriteria);
      return 'Updated.';
    }
  }
  throw new Error('No stored criteria found for this item — it may not have been built with this tool.');
}

function saveOrUpdateAssignmentGradingCriteria(courseId, courseworkId, title, itemType, newCriteria) {
  newCriteria = String(newCriteria || '').trim();
  if (!newCriteria) throw new Error('Grading criteria cannot be empty.');
  var sheet = getOrCreateCriteriaSheet();
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][1]) === String(courseworkId)) {
      sheet.getRange(i + 1, 3).setValue(title || data[i][2] || 'Untitled assignment');
      sheet.getRange(i + 1, 5).setValue(newCriteria);
      return 'Updated.';
    }
  }
  sheet.appendRow([courseId, courseworkId, title || 'Untitled assignment', itemType || 'assignment', newCriteria, '', new Date()]);
  return 'Created.';
}

// For the Grade tab's assignment dropdown
function getGradableCourseWork(courseId) {
  var sheet = getOrCreateCriteriaSheet();
  var data = sheet.getDataRange().getValues();
  var results = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(courseId)) {
      results.push({ courseworkId: data[i][1], title: data[i][2], itemType: data[i][3] });
    }
  }
  return results;
}

// Handles a single gradable item at build time: generates (or uses your notes for) the
// criteria and stores it, keyed to the courseWork id that was just created.
function recordGradingCriteria(courseId, item, cw, referenceMaterial, formId) {
  var criteriaText;
  if (item.autoGenCriteria) {
    criteriaText = callClaudeForGradingCriteria(item.title, item.type, referenceMaterial, item.criteriaNotes);
  } else {
    criteriaText = item.criteriaNotes || ('Grade only against the student-facing requirements and point categories in this assignment:\n' + referenceMaterial);
  }
  saveGradingCriteria(courseId, cw.id, item.title, item.type, criteriaText, formId);
}

// ============================================================
// DOCUMENT BUILDERS
// Attached source files (the PPT/PDF/etc you upload) are NEVER linked or referenced in
// these docs — they were only ever read for their text. Nothing here mentions or links
// back to them.
// ============================================================

// ------------------------------------------------------------
// Shared formatting helpers — give generated Docs real breathing room
// instead of the single-paragraph "\n\n\n" hacks the builders used to rely
// on (which produced inconsistent, easy-to-miss gaps between questions).
// ------------------------------------------------------------

var STUDENT_TEXT_COLOR = '#202124';
var STUDENT_SECONDARY_COLOR = '#4b5563';
var STUDENT_RULE_COLOR = '#6b7280';

function makeStudentTextReadable(element, bold, fontSize) {
  if (!element) return element;
  var text = element.editAsText().setForegroundColor(STUDENT_TEXT_COLOR);
  if (bold !== undefined) text.setBold(!!bold);
  if (fontSize) text.setFontSize(fontSize);
  return element;
}

function appendStudentHeading(body, text, heading, spacingBefore) {
  var paragraph = body.appendParagraph(text || '').setHeading(heading);
  if (spacingBefore) paragraph.setSpacingBefore(spacingBefore);
  makeStudentTextReadable(paragraph, true);
  return paragraph;
}

// A short-answer "write here" cue: clearly visible ruled lines with real vertical
// spacing before each one, instead of a couple of blank paragraphs.
function appendAnswerLines(body, count) {
  for (var i = 0; i < (count || 3); i++) {
    var line = body.appendParagraph('_______________________________________________________');
    line.editAsText().setForegroundColor(STUDENT_RULE_COLOR);
    line.setSpacingBefore(20);
    line.setSpacingAfter(2);
  }
}

// A bordered, fixed-height empty box for essay-length responses — reads as
// a real "write your answer here" area rather than a run of blank lines.
function appendResponseBox(body, minHeightPoints) {
  var table = body.appendTable([['']]);
  table.setBorderWidth(1);
  table.setBorderColor('#dadce0');
  var row = table.getRow(0);
  if (row.setMinimumHeight) row.setMinimumHeight(minHeightPoints || 200);
  return table;
}

function appendStudentDirections(body, instructions) {
  appendStudentHeading(body, 'Directions', DocumentApp.ParagraphHeading.HEADING2, 14);
  makeStudentTextReadable(body.appendParagraph(instructions || 'Complete every required part and submit the finished document.').setSpacingAfter(8));
}

function appendStudentGradingCriteria(body, criteria) {
  appendStudentHeading(body, 'How This Will Be Graded', DocumentApp.ParagraphHeading.HEADING2, 18);
  makeStudentTextReadable(body.appendParagraph('Use this table as a checklist before you submit. The point values total 100.').setSpacingAfter(6));
  var rows = [['Criterion', 'Full-credit work', 'Points']];
  (criteria || []).forEach(function(row) {
    rows.push([row.criterion || '', row.expectation || row.description || '', String(row.points || '')]);
  });
  var table = body.appendTable(rows).setBorderColor('#9aa6b2');
  var header = table.getRow(0);
  for (var h = 0; h < header.getNumCells(); h++) {
    header.getCell(h).setBackgroundColor('#dfe8f2');
    header.getCell(h).editAsText().setBold(true).setForegroundColor(STUDENT_TEXT_COLOR);
  }
  for (var r = 1; r < table.getNumRows(); r++) {
    for (var c = 0; c < table.getRow(r).getNumCells(); c++) {
      table.getRow(r).getCell(c).editAsText().setForegroundColor(STUDENT_TEXT_COLOR);
    }
    table.getRow(r).getCell(0).editAsText().setBold(true);
  }
  return table;
}

function formatStudentCriteriaForDescription(criteria) {
  return (criteria || []).map(function(row) {
    return row.criterion + ' (' + row.points + ' points): ' + row.expectation;
  }).join('\n');
}

// Study guide: real headings, short paragraphs, and true bulleted lists per section —
// not one long unformatted block of text.
function buildStudyGuideDoc(title, sections) {
  var doc = DocumentApp.create(title);
  var body = doc.getBody();
  appendStudentHeading(body, title, DocumentApp.ParagraphHeading.HEADING1);

  (sections || []).forEach(function(section) {
    if (section.heading) {
      appendStudentHeading(body, section.heading, DocumentApp.ParagraphHeading.HEADING2, 20);
    }
    (section.paragraphs || []).forEach(function(p) {
      if (p) makeStudentTextReadable(body.appendParagraph(p).setSpacingAfter(8));
    });
    (section.bullets || []).forEach(function(b) {
      if (b) makeStudentTextReadable(body.appendListItem(b).setGlyphType(DocumentApp.GlyphType.BULLET).setSpacingAfter(4));
    });
  });

  doc.saveAndClose();
  return doc;
}

// Written assignment: numbered short-answer prompts, each with clear
// separation from the next and real ruled lines to write on.
function buildAssignmentDoc(title, generated) {
  var doc = DocumentApp.create(title);
  var body = doc.getBody();
  appendStudentHeading(body, title, DocumentApp.ParagraphHeading.HEADING1);
  if (Array.isArray(generated)) generated = { instructions: 'Answer every prompt using complete sentences.', questions: generated.map(function(line) { return String(line).replace(/^SA:\s*/i, ''); }), gradingCriteria: defaultStudentGradingCriteria('assignment') };
  appendStudentDirections(body, generated.instructions);
  appendStudentGradingCriteria(body, normalizeStudentGradingCriteria(generated.gradingCriteria, 'assignment'));
  appendStudentHeading(body, 'Assignment Prompts', DocumentApp.ParagraphHeading.HEADING2, 18);

  var qNum = 1;
  (generated.questions || []).forEach(function(question) {
    makeStudentTextReadable(body.appendParagraph(qNum + '. ' + String(question).replace(/^SA:\s*/i, '').trim()).setSpacingBefore(20), true);
    appendAnswerLines(body, 3);
    qNum++;
  });
  doc.saveAndClose();
  return doc;
}

// Visual content page: callout-style Knowledge Builder look, tinted with the
// teacher's chosen accent color (Settings tab) instead of a fixed amber.
function buildContentPageDoc(title, sections, accentColor) {
  var doc = DocumentApp.create(title);
  var body = doc.getBody();
  appendStudentHeading(body, title, DocumentApp.ParagraphHeading.HEADING1);

  sections.forEach(function(section) {
    appendStudentHeading(body, section.heading || '', DocumentApp.ParagraphHeading.HEADING2, 20);
    if (section.body) {
      makeStudentTextReadable(body.appendParagraph(section.body).setSpacingAfter(8));
    }
    if (section.keyFact) {
      appendCalloutBox(body, '\u2728 Key Fact: ' + section.keyFact, accentColor);
    }
  });

  doc.saveAndClose();
  return doc;
}

// Custom assignment: intro + numbered questions/tasks + blank response space
function buildCustomAssignmentDoc(title, generated) {
  var doc = DocumentApp.create(title);
  var body = doc.getBody();
  appendStudentHeading(body, title, DocumentApp.ParagraphHeading.HEADING1);
  appendStudentDirections(body, generated.instructions || generated.introduction);
  appendStudentGradingCriteria(body, normalizeStudentGradingCriteria(generated.gradingCriteria, 'customassignment'));
  appendStudentHeading(body, 'Tasks', DocumentApp.ParagraphHeading.HEADING2, 18);
  (generated.questions || []).forEach(function(q, i) {
    makeStudentTextReadable(body.appendParagraph((i + 1) + '. ' + q).setSpacingBefore(20), true);
    appendAnswerLines(body, 3);
  });
  doc.saveAndClose();
  return doc;
}

// Writing assignment: prompt + expected length + optional rubric table + blank writing space
function buildWritingAssignmentDoc(title, generated, targetWords, accentColor) {
  var doc = DocumentApp.create(title);
  var body = doc.getBody();
  appendStudentHeading(body, title, DocumentApp.ParagraphHeading.HEADING1);
  appendStudentDirections(body, generated.instructions);
  makeStudentTextReadable(body.appendParagraph('Required length: approximately ' + targetWords + ' words.').setSpacingAfter(6), true);
  appendStudentHeading(body, 'Writing Prompt', DocumentApp.ParagraphHeading.HEADING2, 14);
  makeStudentTextReadable(body.appendParagraph(generated.prompt || '').setSpacingAfter(8), true);
  appendStudentHeading(body, 'Submission Requirements', DocumentApp.ParagraphHeading.HEADING3, 12);
  (generated.requirements || []).forEach(function(requirement) {
    makeStudentTextReadable(body.appendListItem(requirement).setGlyphType(DocumentApp.GlyphType.BULLET));
  });
  appendStudentGradingCriteria(body, normalizeStudentGradingCriteria(generated.gradingCriteria, 'writing'));

  appendStudentHeading(body, 'Your Response', DocumentApp.ParagraphHeading.HEADING3, 20);
  appendResponseBox(body, 220);
  doc.saveAndClose();
  return doc;
}

// Research assignment: topic + actionable prompts + response areas + source log + grading table
function buildResearchAssignmentDoc(title, generated, accentColor) {
  var doc = DocumentApp.create(title);
  var body = doc.getBody();
  appendStudentHeading(body, title, DocumentApp.ParagraphHeading.HEADING1);
  // Backward compatibility for content built before the topic/prompts redesign.
  if (!generated.researchPrompts) {
    generated = {
      topic: title,
      instructions: 'Research the topic below and answer every labeled prompt in your own words. Include specific facts and examples from reliable sources. Record the source or sources you used, then submit the completed document.',
      researchPrompts: (generated.subQuestions || []).length ? generated.subQuestions : [generated.mainQuestion || 'Research and explain the assigned topic.'],
      gradingCriteria: defaultStudentGradingCriteria('research')
    };
  }
  appendStudentDirections(body, generated.instructions);
  appendStudentHeading(body, 'Research Topic', DocumentApp.ParagraphHeading.HEADING2, 14);
  makeStudentTextReadable(body.appendParagraph(generated.topic || title).setSpacingAfter(8), true);
  appendStudentGradingCriteria(body, normalizeStudentGradingCriteria(generated.gradingCriteria, 'research'));
  appendStudentHeading(body, 'Research Prompts', DocumentApp.ParagraphHeading.HEADING2, 18);
  (generated.researchPrompts || []).forEach(function(researchPrompt, i) {
    makeStudentTextReadable(body.appendParagraph((i + 1) + '. ' + researchPrompt).setSpacingBefore(16), true);
    appendResponseBox(body, 110);
  });
  appendStudentHeading(body, 'Sources Used', DocumentApp.ParagraphHeading.HEADING2, 18);
  makeStudentTextReadable(body.appendParagraph('List the title and website, book, article, interview, or other source for each source you used.'));
  appendAnswerLines(body, 3);
  doc.saveAndClose();
  return doc;
}

// Shop project document: student planning/reflection first, then a clearly marked
// teacher evaluation area. The rubric stays in a predictable table structure so
// criterion-level HQSD data can be collected from it in a later reporting step.
function buildShopProjectDoc(title, generated, accentColor) {
  var doc = DocumentApp.create(title);
  var body = doc.getBody();
  var accent = accentColor || DEFAULT_SETTINGS.accentColor;
  var tint = lightenHex(accent);

  // Landscape gives the analytic rubric enough room while remaining printable.
  body.setPageWidth(792).setPageHeight(612);
  body.setMarginTop(36).setMarginBottom(36).setMarginLeft(36).setMarginRight(36);

  appendStudentHeading(body, title, DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph('SHOP PROJECT • STUDENT WORK + TEACHER EVALUATION')
    .editAsText().setForegroundColor('#17324d').setBold(true).setFontSize(9);
  var identity = body.appendTable([['Student name:', '', 'Class / period:', '', 'Date:', '']]);
  identity.setBorderColor('#cfd5dd');

  appendStudentHeading(body, 'Project Overview', DocumentApp.ParagraphHeading.HEADING2, 16);
  makeStudentTextReadable(body.appendParagraph(generated.overview || 'Complete the project described by your teacher.'));
  if (generated.studentDirections) {
    appendCalloutBox(body, 'Student directions: ' + generated.studentDirections, accent);
  }
  appendStudentHeading(body, 'Submission Checklist', DocumentApp.ParagraphHeading.HEADING2, 16);
  [
    'Read the project overview, safety requirement, and rubric before beginning work.',
    'Complete the planning and safety sections before starting construction.',
    'Build the project and perform the required measurements and quality checks.',
    'Complete every student reflection and self-assessment section in this document.',
    'Submit this completed document with the finished physical project.'
  ].forEach(function(step, index) {
    makeStudentTextReadable(body.appendParagraph((index + 1) + '. ' + step).setSpacingAfter(4));
  });

  if (generated.learningTargets && generated.learningTargets.length) {
    appendStudentHeading(body, 'Learning Targets', DocumentApp.ParagraphHeading.HEADING2, 16);
    generated.learningTargets.forEach(function(target) {
      if (target) makeStudentTextReadable(body.appendListItem(target).setGlyphType(DocumentApp.GlyphType.BULLET));
    });
  }

  appendStudentHeading(body, 'STUDENT SECTIONS', DocumentApp.ParagraphHeading.HEADING2, 20);
  body.appendParagraph('The student completes everything in this section before submitting the document.')
    .editAsText().setForegroundColor(STUDENT_SECONDARY_COLOR).setItalic(true);
  (generated.studentSections || []).forEach(function(section) {
    appendStudentHeading(body, section.heading || 'Student Response', DocumentApp.ParagraphHeading.HEADING3, 16);
    makeStudentTextReadable(body.appendParagraph(section.prompt || 'Enter your response below.').setSpacingAfter(5));
    appendResponseBox(body, 72);
  });

  body.appendPageBreak();
  appendStudentHeading(body, 'TEACHER EVALUATION', DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph('This section is completed by the teacher after reviewing the submitted document and physical project.')
    .editAsText().setForegroundColor('#17324d').setBold(true);
  if (generated.safetyGate) {
    appendCalloutBox(body, 'Safety requirement: ' + generated.safetyGate, '#b45309');
  }
  makeStudentTextReadable(body.appendParagraph('The rubric below shows the evidence used to grade the project. Students may add a self-score or evidence; the teacher records the official score and comments.').setSpacingAfter(8));

  var rows = [['Criterion', '1 • Beginning', '2 • Developing', '3 • Proficient', '4 • Mastery', 'Student score / evidence', 'Teacher score / comments']];
  (generated.rubric || []).forEach(function(row) {
    rows.push([
      (row.criterion || 'Criterion') + (row.description ? '\n' + row.description : ''),
      row.beginning || '', row.developing || '', row.proficient || '', row.mastery || '', '', ''
    ]);
  });
  var rubricTable = body.appendTable(rows);
  rubricTable.setBorderColor('#aeb7c2');
  var header = rubricTable.getRow(0);
  for (var h = 0; h < header.getNumCells(); h++) {
    header.getCell(h).setBackgroundColor(tint);
    header.getCell(h).editAsText().setBold(true).setForegroundColor('#17324d').setFontSize(8);
  }
  for (var r = 1; r < rubricTable.getNumRows(); r++) {
    var tableRow = rubricTable.getRow(r);
    for (var c = 0; c < tableRow.getNumCells(); c++) {
      tableRow.getCell(c).editAsText().setFontSize(8);
      tableRow.getCell(c).editAsText().setForegroundColor(STUDENT_TEXT_COLOR);
    }
    tableRow.getCell(0).editAsText().setBold(true);
  }

  appendStudentHeading(body, 'Teacher Summary', DocumentApp.ParagraphHeading.HEADING2, 18);
  body.appendTable([
    ['Strengths demonstrated', ''],
    ['Priority for improvement', ''],
    ['Required reteaching / next step', ''],
    ['Final grade', '________ / ________']
  ]).setBorderColor('#aeb7c2');

  doc.saveAndClose();
  return doc;
}

function formatProjectRubricForStorage(generated) {
  var lines = ['MANUAL PROJECT RUBRIC — teacher observation required.'];
  (generated.rubric || []).forEach(function(row) {
    lines.push((row.criterion || 'Criterion') + ': ' + (row.description || ''));
    lines.push('1 Beginning: ' + (row.beginning || ''));
    lines.push('2 Developing: ' + (row.developing || ''));
    lines.push('3 Proficient: ' + (row.proficient || ''));
    lines.push('4 Mastery: ' + (row.mastery || ''));
  });
  if (generated.safetyGate) lines.push('Safety requirement: ' + generated.safetyGate);
  return lines.join('\n');
}

function getOrCreateProjectRubricsSheet() {
  var ss = getOrCreateCriteriaSpreadsheet();
  var sheet = ss.getSheetByName('Project Rubrics');
  if (!sheet) {
    sheet = ss.insertSheet('Project Rubrics');
    sheet.appendRow(['courseworkId', 'courseId', 'title', 'rubricJSON', 'templateFileId', 'createdAt', 'version']);
  } else if (!sheet.getRange(1, 7).getValue()) {
    sheet.getRange(1, 7).setValue('version');
  }
  return sheet;
}

function saveProjectRubricDefinition(courseId, courseworkId, title, generated, templateFileId) {
  var definition = {
    title: title,
    criteria: generated.rubric || [],
    safetyGate: generated.safetyGate || '',
    studentSections: generated.studentSections || []
  };
  getOrCreateProjectRubricsSheet().appendRow([
    courseworkId, courseId, title, JSON.stringify(definition), templateFileId || '', new Date(), 1
  ]);
}

function getSavedProjectRubricDefinition(courseworkId) {
  var data = getOrCreateProjectRubricsSheet().getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(courseworkId)) {
      try {
        var definition = JSON.parse(data[i][3] || '{}');
        definition.templateFileId = data[i][4] || '';
        definition.version = Number(data[i][6]) || 1;
        return definition;
      } catch (e) {
        return null;
      }
    }
  }
  return null;
}

// Lightens a hex color toward white (for callout backgrounds) so a single
// accent color choice still reads as a soft highlight rather than a solid block.
function lightenHex(hex, amount) {
  var pct = amount === undefined ? 0.85 : amount;
  var clean = (hex || '').replace('#', '');
  if (clean.length === 3) clean = clean.split('').map(function(c) { return c + c; }).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return '#fef3e0';
  var r = parseInt(clean.substr(0, 2), 16);
  var g = parseInt(clean.substr(2, 2), 16);
  var b = parseInt(clean.substr(4, 2), 16);
  var mix = function(c) { return Math.round(c + (255 - c) * pct); };
  var toHex = function(c) { var h = c.toString(16); return h.length === 1 ? '0' + h : h; };
  return '#' + toHex(mix(r)) + toHex(mix(g)) + toHex(mix(b));
}

// A single-cell, borderless "callout" table tinted with the given accent
// color (falls back to the default amber if none is provided — keeps HQSD's
// existing callers, which don't pass a color, looking exactly as before).
function appendCalloutBox(body, text, accentColor) {
  var color = accentColor || DEFAULT_SETTINGS.accentColor;
  var table = body.appendTable([[text]]);
  table.setBorderWidth(0);
  var cell = table.getCell(0, 0);
  cell.setBackgroundColor(lightenHex(color));
  var para = cell.getChild(0).asParagraph();
  // Keep the accent in the background treatment; body text stays dark enough
  // to print clearly even when the selected accent is yellow or another light color.
  para.editAsText().setBold(true).setForegroundColor(STUDENT_TEXT_COLOR);
}

function buildQuizForm(title, rawLines) {
  var quiz = FormApp.create(title);
  quiz.setIsQuiz(true);
  quiz.setDescription('Answer every question, review your responses, and submit the form when finished. Multiple-choice and true/false items are scored automatically; written responses are reviewed using the directions in Classroom.');
  try { quiz.setCollectEmail(true); } catch (e) { /* domain policy may already enforce this */ }

  rawLines.forEach(function(line) {
    var clean = line.trim();

    if (clean.indexOf('MC:') === 0) {
      var parts = clean.substring(3).split('|').map(function(p) { return p.trim(); });
      if (parts.length >= 6) {
        var question = parts[0];
        var choices = [parts[1], parts[2], parts[3], parts[4]];
        var correctAns = parts[5].toUpperCase();
        var mcItem = quiz.addMultipleChoiceItem().setTitle(question).setPoints(5);
        var choicesList = choices.map(function(choiceText, index) {
          var letter = String.fromCharCode(65 + index);
          return mcItem.createChoice(choiceText, letter === correctAns);
        });
        mcItem.setChoices(choicesList);
      }
    } else if (clean.indexOf('TF:') === 0) {
      var tfParts = clean.substring(3).split('|').map(function(p) { return p.trim(); });
      if (tfParts.length >= 2) {
        var statement = tfParts[0];
        var isTrue = tfParts[1].toLowerCase() === 'true';
        var tfItem = quiz.addMultipleChoiceItem().setTitle(statement).setPoints(5);
        tfItem.setChoices([
          tfItem.createChoice('True', isTrue),
          tfItem.createChoice('False', !isTrue)
        ]);
      }
    } else if (clean.indexOf('SA:') === 0) {
      // Format is "SA: Question | Model Answer" — only the question becomes the Form item title;
      // the model answer travels separately into the grading criteria via the raw formattedText.
      var saParts = clean.substring(3).split('|');
      var saText = saParts[0].trim();
      quiz.addTextItem().setTitle(saText).setPoints(5);
    }
  });

  return quiz;
}

// ============================================================
// MAIN BUILD PROCESS
// ============================================================
// ============================================================
// PARSE & PREPOPULATE (called by the "Parse Files & Fill In Boxes" button)
// ============================================================
// Runs extraction on whatever files are currently attached in the browser and hands
// the raw extracted text straight back to the client to drop into the item content
// boxes — nothing is generated or posted here. This is the transparency step: the
// teacher sees exactly what text will be used before any AI generation or Classroom
// posting happens, and can edit it first.
function extractContentForPreview(payload) {
  var attachedFiles = resolveAttachedFiles(payload || {});
  try {
    var extraction = buildExtractedContentBlock(attachedFiles);
    return { content: extraction.content, warnings: extraction.warnings };
  } finally {
    cleanupTempUploads(attachedFiles);
  }
}

// Generates ONE item's AI content and returns it, parsed, without writing anything
// to Drive or Classroom. This is the "Build" screen's Generate/Build-All action —
// `content` is whatever text (item-specific, shared, or extracted-from-files) the
// client resolved for this item; `settings` controls which model is used.
function generateItemContent(item, content, settings) {
  settings = settings || getSettings();
  var model = settings.aiSpeed === 'fast' ? MODEL_FAST : MODEL_DETAILED;
  var data;

  if (item.type === 'studyguide') {
    data = callClaudeForStudyGuide(item.title, content, model);
  } else if (item.type === 'assignment') {
    data = callClaudeForPrompts(content, item.promptCount || 2, model);
  } else if (item.type === 'contentpage') {
    data = callClaudeForContentPage(item.title, content, item.sectionCount || 3, model);
  } else if (item.type === 'customcontent') {
    data = callClaudeForCustomContentPage(item.title, content, model);
  } else if (item.type === 'customassignment') {
    data = callClaudeForCustomAssignment(item.title, content, model);
  } else if (item.type === 'writing') {
    data = callClaudeForWritingAssignment(item.title, content, item.targetWords || 300, item.includeRubric, model);
  } else if (item.type === 'research') {
    data = callClaudeForResearchAssignment(item.title, content, item.subQuestionCount || 4, model);
  } else if (item.type === 'project') {
    data = callClaudeForShopProject(item.title, content,
      item.studentSections || 'Project plan, Safety plan, Self-assessment, Reflection',
      item.rubricCriteriaCount || 4, model);
  } else if (item.type === 'discussion') {
    data = callClaudeForDiscussionPrompt(content, model);
  } else if (item.type === 'quiz') {
    var formattedText = callClaudeToFormat(content, item.specs, model);
    data = formattedText.split('\n').filter(function(l) { return l.trim() !== ''; });
  } else {
    throw new Error('Unknown content item type: ' + item.type);
  }

  data = validateGeneratedItemContent(item, data);
  return { type: item.type, data: data };
}

// Takes content already generated by generateItemContent() and does the actual
// write: builds the Doc/Form, posts the courseWork, and records grading criteria
// for gradable types. This is the "Insert" screen's per-item action.
function insertBuiltItem(courseId, topicId, item, generatedData, settings) {
  var previousInsertion = getLoggedInsertion(item && item.insertionKey);
  if (previousInsertion) return previousInsertion;
  settings = settings || getSettings();
  var accentColor = settings.accentColor;
  var title = item.title;

  if (item.type === 'studyguide') {
    var doc = buildStudyGuideDoc(title, generatedData);
    postCourseWork(courseId, topicId, title, 'Review this study guide.',
      [primaryMaterial(doc.getId(), 'VIEW')]);

  } else if (item.type === 'assignment') {
    var assignDoc = buildAssignmentDoc(title, generatedData);
    var cwAssign = postCourseWork(courseId, topicId, title,
      generatedData.instructions + '\n\nOpen your copy, answer every prompt in the document, review the 100-point grading table, and submit the completed document.',
      [primaryMaterial(assignDoc.getId(), 'STUDENT_COPY')], 100);
    recordGradingCriteria(courseId, item, cwAssign, JSON.stringify(generatedData));

  } else if (item.type === 'contentpage') {
    var pageDoc = buildContentPageDoc(title, generatedData, accentColor);
    postCourseWork(courseId, topicId, title, 'Read through this content page.',
      [primaryMaterial(pageDoc.getId(), 'VIEW')]);

  } else if (item.type === 'customcontent') {
    var customPageDoc = buildContentPageDoc(title, generatedData, accentColor);
    postCourseWork(courseId, topicId, title, 'Read through this content page.',
      [primaryMaterial(customPageDoc.getId(), 'VIEW')]);

  } else if (item.type === 'customassignment') {
    var customAssignDoc = buildCustomAssignmentDoc(title, generatedData);
    var cwCustom = postCourseWork(courseId, topicId, title,
      generatedData.instructions + '\n\nComplete every labeled task in your copy, review the grading table, and submit the finished document.',
      [primaryMaterial(customAssignDoc.getId(), 'STUDENT_COPY')], 100);
    recordGradingCriteria(courseId, item, cwCustom, JSON.stringify(generatedData));

  } else if (item.type === 'writing') {
    var writingDoc = buildWritingAssignmentDoc(title, generatedData, item.targetWords || 300, accentColor);
    var cwWriting = postCourseWork(courseId, topicId, title,
      generatedData.instructions + '\n\nWrite approximately ' + (item.targetWords || 300) + ' words in your copy, check the submission requirements and grading table, and submit the finished document.',
      [primaryMaterial(writingDoc.getId(), 'STUDENT_COPY')], 100);
    recordGradingCriteria(courseId, item, cwWriting, JSON.stringify(generatedData));

  } else if (item.type === 'research') {
    var researchDoc = buildResearchAssignmentDoc(title, generatedData, accentColor);
    var cwResearch = postCourseWork(courseId, topicId, title,
      generatedData.instructions + '\n\nAnswer all ' + generatedData.researchPrompts.length + ' research prompts in your copy, list the sources used, review the grading table, and submit the finished document.',
      [primaryMaterial(researchDoc.getId(), 'STUDENT_COPY')], 100);
    recordGradingCriteria(courseId, item, cwResearch, JSON.stringify(generatedData));

  } else if (item.type === 'project') {
    var projectDoc = buildShopProjectDoc(title, generatedData, accentColor);
    var cwProject = postCourseWork(courseId, topicId, title,
      'Read the project overview, directions, safety requirement, and rubric before beginning. Complete every student section, build the assigned project, add your self-assessment/evidence, and submit the document with the finished project. The teacher completes the final rubric scores and feedback.',
      [primaryMaterial(projectDoc.getId(), 'STUDENT_COPY')], item.maxPoints || 100);
    saveGradingCriteria(courseId, cwProject.id, title, 'project',
      formatProjectRubricForStorage(generatedData), '');
    saveProjectRubricDefinition(courseId, cwProject.id, title, generatedData, projectDoc.getId());

  } else if (item.type === 'discussion') {
    var discussionDescription = generatedData.instructions + '\n\nDiscussion prompt:\n' + generatedData.prompt +
      '\n\nHow this will be graded:\n' + formatStudentCriteriaForDescription(generatedData.gradingCriteria);
    var cwDiscussion = postCourseWork(courseId, topicId, title, discussionDescription,
      undefined, 100, 'SHORT_ANSWER_QUESTION');
    recordGradingCriteria(courseId, item, cwDiscussion, JSON.stringify(generatedData));

  } else if (item.type === 'quiz') {
    var quiz = buildQuizForm(title, generatedData);
    var quizMaterials = [{ link: { url: quiz.getPublishedUrl(), title: quiz.getTitle() } }];
    var cwQuiz = postCourseWork(courseId, topicId, title,
      'Complete every question in the attached test. Review your answers before submitting. Multiple-choice and true/false questions are scored automatically; short-answer responses are reviewed for accuracy, completeness, and clear explanation.', quizMaterials, 100);
    recordGradingCriteria(courseId, item, cwQuiz, generatedData.join('\n'), quiz.getId());

  } else {
    throw new Error('Unknown content item type: ' + item.type);
  }

  var insertionResult = { title: title, type: item.type, status: 'inserted' };
  recordLoggedInsertion(item.insertionKey, courseId, topicId, insertionResult);
  return insertionResult;
}

// Resolves (or creates) the topic once for the whole module — called at the start
// of the Insert screen, before looping insertBuiltItem() over each built item.
function prepareModuleTopic(courseId, topicName) {
  return getOrCreateTopic(courseId, topicName);
}

// ============================================================
// AI GRADER
// ============================================================

// ------------------------------------------------------------
// GRADING WORKSPACE (class-wide queue and one-submission review)
// ------------------------------------------------------------
function listAllCourseWorkForGrading(courseId) {
  var items = [];
  var pageToken;
  do {
    // Draft assignments are included so their grading criteria can be reviewed
    // before students ever see the work.
    var options = { courseWorkStates: ['PUBLISHED', 'DRAFT'] };
    if (pageToken) options.pageToken = pageToken;
    var response = Classroom.Courses.CourseWork.list(courseId, options);
    items = items.concat(response.courseWork || []);
    pageToken = response.nextPageToken;
  } while (pageToken);
  return items;
}

function listTurnedInSubmissionsForGrading(courseId, courseWorkItems) {
  var submissions = [];
  var pageToken;
  try {
    do {
      var options = { states: ['TURNED_IN'] };
      if (pageToken) options.pageToken = pageToken;
      var response = Classroom.Courses.CourseWork.StudentSubmissions.list(courseId, '-', options);
      submissions = submissions.concat(response.studentSubmissions || []);
      pageToken = response.nextPageToken;
    } while (pageToken);
    return submissions;
  } catch (e) {
    // Some Classroom domains reject the documented wildcard. Fall back safely.
    (courseWorkItems || []).forEach(function(item) {
      var itemPageToken;
      do {
        var itemOptions = { states: ['TURNED_IN'] };
        if (itemPageToken) itemOptions.pageToken = itemPageToken;
        var itemResponse = Classroom.Courses.CourseWork.StudentSubmissions.list(courseId, item.id, itemOptions);
        submissions = submissions.concat(itemResponse.studentSubmissions || []);
        itemPageToken = itemResponse.nextPageToken;
      } while (itemPageToken);
    });
    return submissions;
  }
}

function getCriteriaMapForCourse(courseId) {
  var sheet = getOrCreateCriteriaSheet();
  var data = sheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(courseId)) {
      map[String(data[i][1])] = {
        courseId: data[i][0], courseworkId: data[i][1], title: data[i][2],
        itemType: data[i][3], criteria: data[i][4], formId: data[i][5]
      };
    }
  }
  return map;
}

function getGradingQueue(courseId) {
  var courseWorkItems = listAllCourseWorkForGrading(courseId);
  var courseWorkMap = {};
  courseWorkItems.forEach(function(item) { courseWorkMap[String(item.id)] = item; });
  var submissions = listTurnedInSubmissionsForGrading(courseId, courseWorkItems);
  var criteriaMap = getCriteriaMapForCourse(courseId);
  var logMaps = getAllGradedLogMaps();
  var profileCache = {};
  var queue = [];

  submissions.forEach(function(sub) {
    var courseworkId = String(sub.courseWorkId);
    var work = courseWorkMap[courseworkId];
    if (!work) return;
    var logged = logMaps[courseworkId] && logMaps[courseworkId][sub.id];
    if (logged && String(logged.updateTime) === String(sub.updateTime)) return;

    if (!profileCache[sub.userId]) {
      try {
        profileCache[sub.userId] = getStudentProfile(sub.userId);
      } catch (e) {
        profileCache[sub.userId] = { name: 'Student', email: '' };
      }
    }
    var currentGrade = sub.assignedGrade;
    if (currentGrade === undefined || currentGrade === null) currentGrade = sub.draftGrade;
    if (currentGrade === undefined || currentGrade === null) currentGrade = null;
    var isRegrade = !!logged || currentGrade !== null || countTurnIns(sub) > 1;

    queue.push({
      submissionId: sub.id,
      courseworkId: courseworkId,
      assignmentTitle: work.title || 'Untitled assignment',
      studentName: profileCache[sub.userId].name,
      currentGrade: currentGrade,
      maxPoints: Number(work.maxPoints) || 100,
      resubmitted: isRegrade,
      late: !!sub.late,
      updateTime: sub.updateTime,
      hasAiCriteria: !!(criteriaMap[courseworkId] && criteriaMap[courseworkId].criteria)
    });
  });

  queue.sort(function(a, b) {
    if (a.resubmitted !== b.resubmitted) return a.resubmitted ? -1 : 1;
    var assignmentCompare = a.assignmentTitle.localeCompare(b.assignmentTitle);
    return assignmentCompare || a.studentName.localeCompare(b.studentName);
  });

  return {
    assignments: courseWorkItems.map(function(item) {
      return { courseworkId: item.id, title: item.title || 'Untitled assignment' };
    }).sort(function(a, b) { return a.title.localeCompare(b.title); }),
    items: queue
  };
}

function getAssignmentGradingSetup(courseId, courseworkId) {
  var work = Classroom.Courses.CourseWork.get(courseId, courseworkId);
  var criteriaRow = getGradingCriteria(courseworkId);
  return {
    setupOnly: true,
    courseworkId: courseworkId,
    assignmentTitle: work.title || 'Untitled assignment',
    itemType: criteriaRow ? criteriaRow.itemType : 'assignment',
    maxPoints: Number(work.maxPoints) || 100,
    criteria: criteriaRow ? criteriaRow.criteria : '',
    criteriaEditable: true,
    canUseAi: false,
    rubric: null,
    rubricScores: []
  };
}

function getGraderAttachmentList(sub) {
  var attachments = (sub.assignmentSubmission && sub.assignmentSubmission.attachments) || [];
  return attachments.map(function(attachment) {
    if (attachment.driveFile) {
      return {
        title: attachment.driveFile.title || 'submitted file',
        url: attachment.driveFile.alternateLink || ('https://drive.google.com/open?id=' + attachment.driveFile.id),
        type: 'driveFile'
      };
    }
    if (attachment.link) return { title: attachment.link.title || 'submitted link', url: attachment.link.url, type: 'link' };
    if (attachment.youTubeVideo) return { title: attachment.youTubeVideo.title || 'submitted video', url: attachment.youTubeVideo.alternateLink, type: 'video' };
    if (attachment.form) return { title: attachment.form.title || 'submitted form', url: attachment.form.formUrl, type: 'form' };
    return null;
  }).filter(function(item) { return !!item; });
}

// Classroom keeps one StudentSubmission record through unsubmit/resubmit cycles.
// When a student adds a revised file without removing the original, both Drive
// attachments can remain on that record. Classroom places newly attached revisions
// after existing files, so prefer the last attachment. File modification time is
// intentionally not used because teacher feedback can make an older file look newer.
function getSubmittedDriveAttachmentsNewestFirst(sub) {
  var attachments = (sub.assignmentSubmission && sub.assignmentSubmission.attachments) || [];
  return attachments.map(function(attachment, index) {
    if (!attachment.driveFile || !attachment.driveFile.id) return null;
    return { attachment: attachment, index: index };
  }).filter(function(item) { return !!item; }).sort(function(a, b) {
    return b.index - a.index;
  }).map(function(item) { return item.attachment; });
}

function extractReadableSubmissionTextForGrader(sub, criteriaRow) {
  if (sub.shortAnswerSubmission && sub.shortAnswerSubmission.answer) {
    return sub.shortAnswerSubmission.answer;
  }
  if (criteriaRow && criteriaRow.itemType === 'quiz') {
    return extractQuizResponseText(sub.userId, criteriaRow.formId);
  }
  var attachments = getSubmittedDriveAttachmentsNewestFirst(sub);
  for (var i = 0; i < attachments.length; i++) {
    try {
      return DocumentApp.openById(attachments[i].driveFile.id).getBody().getText();
    } catch (e) {
      // Non-Docs and locked files still appear as links for manual grading.
    }
  }
  return null;
}

function getGradingSubmissionDetail(courseId, courseworkId, submissionId) {
  var work = Classroom.Courses.CourseWork.get(courseId, courseworkId);
  var sub = Classroom.Courses.CourseWork.StudentSubmissions.get(courseId, courseworkId, submissionId);
  var criteriaRow = getGradingCriteria(courseworkId);
  var profile = getStudentProfile(sub.userId);
  var text = extractReadableSubmissionTextForGrader(sub, criteriaRow);
  var logEntry = getGradedLogMap(courseworkId)[submissionId];
  var draftEntry = getGradingDraftMap(courseworkId)[submissionId];
  var logMatchesCurrentSubmission = !!logEntry && String(logEntry.updateTime) === String(sub.updateTime);
  var draftMatchesCurrentSubmission = !!draftEntry && String(draftEntry.updateTime) === String(sub.updateTime);
  var currentGrade = sub.assignedGrade;
  if (currentGrade === undefined || currentGrade === null) currentGrade = sub.draftGrade;
  if (currentGrade === undefined || currentGrade === null) currentGrade = null;
  if (draftMatchesCurrentSubmission && draftEntry.grade !== '' && draftEntry.grade !== null) currentGrade = Number(draftEntry.grade);
  var rubric = resolveHQSDRubricDefinition(courseId, { courseworkId: courseworkId, title: work.title }, work);
  var rubricScores = logMatchesCurrentSubmission || draftMatchesCurrentSubmission
    ? getStoredRubricScores(courseworkId, submissionId)
    : [];
  if (rubric && rubric.criteria && !rubricScores.length) {
    var documentScores = extractRubricScoresFromSubmissionDocument(sub);
    rubricScores = rubric.criteria.map(function(criterion) {
      var name = normalizeRubricCriterionName(criterion.criterion || criterion.name);
      var score = documentScores[name.toLowerCase()];
      return score === undefined ? null : {
        criterionKey: rubricCriterionKey(name), criterionName: name, score: score, comment: ''
      };
    }).filter(function(entry) { return !!entry; });
  }

  return {
    submissionId: submissionId,
    courseworkId: courseworkId,
    assignmentTitle: work.title || 'Untitled assignment',
    studentName: profile.name,
    currentGrade: currentGrade,
    maxPoints: Number(work.maxPoints) || 100,
    resubmitted: !!logEntry || currentGrade !== null || countTurnIns(sub) > 1,
    submissionText: text || '',
    attachments: getGraderAttachmentList(sub),
    criteria: criteriaRow ? criteriaRow.criteria : '',
    itemType: criteriaRow ? criteriaRow.itemType : 'assignment',
    criteriaEditable: !criteriaRow || criteriaRow.itemType !== 'project',
    canUseAi: !!(criteriaRow && criteriaRow.itemType !== 'project' && criteriaRow.criteria && text),
    savedFeedback: draftMatchesCurrentSubmission
      ? (draftEntry.feedback || '')
      : (logMatchesCurrentSubmission ? (logEntry.feedback || '') : ''),
    rubric: rubric,
    rubricScores: rubricScores
  };
}

function redactKnownStudentIdentity(text, profile) {
  var clean = String(text || '');
  var values = [];
  if (profile) {
    if (profile.name) values.push(profile.name);
    if (profile.email) values.push(profile.email);
  }
  values.forEach(function(value) {
    if (!value) return;
    var escaped = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    clean = clean.replace(new RegExp(escaped, 'gi'), '[STUDENT]');
  });
  clean = clean.replace(/(^|\n)\s*(student\s*name|name)\s*:\s*[^\n]+/gi, '$1Student name: [STUDENT]');
  clean = clean.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL REDACTED]');
  clean = clean.replace(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[PHONE REDACTED]');
  return clean;
}

function suggestGradeForSubmission(courseId, courseworkId, submissionId) {
  var criteriaRow = getGradingCriteria(courseworkId);
  if (!criteriaRow || !criteriaRow.criteria) throw new Error('No AI grading criteria are stored for this assignment.');
  if (criteriaRow.itemType === 'project') {
    throw new Error('Shop project rubrics require teacher observation and manual scoring.');
  }
  var work = Classroom.Courses.CourseWork.get(courseId, courseworkId);
  var sub = Classroom.Courses.CourseWork.StudentSubmissions.get(courseId, courseworkId, submissionId);
  var studentText = extractReadableSubmissionTextForGrader(sub, criteriaRow);
  if (!studentText) throw new Error('The submitted work does not contain readable text for AI review.');
  var profile = getStudentProfile(sub.userId);
  studentText = redactKnownStudentIdentity(studentText, profile);
  var result = callClaudeToGrade(work.title || criteriaRow.title, criteriaRow.itemType, criteriaRow.criteria, studentText);
  var maxPoints = Number(work.maxPoints) || 100;
  return {
    grade: Math.round((Number(result.grade) / 100) * maxPoints * 100) / 100,
    feedback: result.feedback || ''
  };
}

function saveGradingDecision(courseId, courseworkId, submissionId, finalGrade, finalFeedback, gradingSource, returnToStudent, rubricScores) {
  var work = Classroom.Courses.CourseWork.get(courseId, courseworkId);
  var sub = Classroom.Courses.CourseWork.StudentSubmissions.get(courseId, courseworkId, submissionId);
  var rubric = resolveHQSDRubricDefinition(courseId, { courseworkId: courseworkId, title: work.title }, work);
  var validatedRubricScores = validateStructuredRubricScores(rubric, rubricScores, !!returnToStudent);
  var maxPoints = Number(work.maxPoints) || 100;
  finalGrade = Number(finalGrade);
  if (!isFinite(finalGrade) || finalGrade < 0 || finalGrade > maxPoints) {
    throw new Error('Grade must be between 0 and ' + maxPoints + '.');
  }

  if (!returnToStudent) {
    var draftWriteBackBlocked = false;
    try {
      Classroom.Courses.CourseWork.StudentSubmissions.patch(
        { draftGrade: finalGrade }, courseId, courseworkId, submissionId, { updateMask: 'draftGrade' }
      );
    } catch (draftWriteBackError) {
      if (!isClassroomWriteBackBlocked(draftWriteBackError)) throw draftWriteBackError;
      draftWriteBackBlocked = true;
    }
    var draftSub = Classroom.Courses.CourseWork.StudentSubmissions.get(courseId, courseworkId, submissionId);
    saveGradingDraftRecord(submissionId, courseworkId, finalGrade, finalFeedback, gradingSource, draftSub.updateTime);
    if (rubric) saveStructuredRubricScores(draftSub, courseworkId, validatedRubricScores, rubric.version || 1);
    var draftRubricWrite = writeStructuredRubricScoresToSubmissionDoc(draftSub, validatedRubricScores);
    if (draftWriteBackBlocked) {
      return {
        grade: finalGrade,
        returned: false,
        writeBackBlocked: true,
        submissionLink: draftSub.alternateLink || '',
        warning: 'Draft saved in Teacher Portal only — Classroom blocked the automatic draft-grade write-back ' +
          'for this assignment (it wasn’t created through this app).'
      };
    }
    return { grade: finalGrade, returned: false, warning: draftRubricWrite.warning || '' };
  }

  var writeBackBlocked = false;
  try {
    Classroom.Courses.CourseWork.StudentSubmissions.patch(
      { assignedGrade: finalGrade, draftGrade: finalGrade }, courseId, courseworkId, submissionId,
      { updateMask: 'assignedGrade,draftGrade' }
    );
    Classroom.Courses.CourseWork.StudentSubmissions.return({}, courseId, courseworkId, submissionId);
  } catch (writeBackError) {
    if (!isClassroomWriteBackBlocked(writeBackError)) throw writeBackError;
    writeBackBlocked = true;
  }

  sub = Classroom.Courses.CourseWork.StudentSubmissions.get(courseId, courseworkId, submissionId);
  if (rubric) saveStructuredRubricScores(sub, courseworkId, validatedRubricScores, rubric.version || 1);
  var rubricWrite = writeStructuredRubricScoresToSubmissionDoc(sub, validatedRubricScores);
  var feedbackResult = appendFeedbackToSubmission(sub, '', finalFeedback, gradingSource);
  var logSheet = getGradedLogSheet();
  var logMap = getGradedLogMap(courseworkId);
  recordGradedLog(logSheet, logMap[submissionId], submissionId, courseworkId, sub.updateTime,
    finalGrade, finalFeedback, gradingSource || 'manual');
  deleteGradingDraftRecord(submissionId, courseworkId);

  if (writeBackBlocked) {
    return {
      grade: finalGrade,
      returned: false,
      writeBackBlocked: true,
      submissionLink: sub.alternateLink || '',
      feedbackWritten: feedbackResult.written,
      warning: 'Classroom would not accept an automatic grade write-back for this assignment (it wasn’t ' +
        'created through this app). Feedback was still added to the doc — paste ' + finalGrade +
        ' into the Classroom tab that just opened and click Return.'
    };
  }

  return {
    grade: finalGrade,
    returned: true,
    feedbackWritten: feedbackResult.written,
    warning: [rubricWrite.warning, feedbackResult.warning].filter(function(value) { return !!value; }).join(' ')
  };
}

// Classroom restricts grade/return writes on studentSubmissions to the Cloud project that
// created the parent courseWork item. Assignments copied in from elsewhere (not created via
// this app) reject the write with ProjectPermissionDenied — detect that so callers can
// fall back to the manual paste-and-return flow instead of failing the whole save.
function isClassroomWriteBackBlocked(err) {
  var message = (err && err.message) || String(err || '');
  return /ProjectPermissionDenied|PERMISSION_DENIED|not permitted/i.test(message);
}

// ------------------------------------------------------------
// PENDING GRADES (SpeedGrader-style review \u2014 suggest, don't post, until committed)
// ------------------------------------------------------------
function getPendingGradesSheet() {
  var ss = getOrCreateCriteriaSpreadsheet();
  var sheet = ss.getSheetByName('Pending Grades');
  if (!sheet) {
    sheet = ss.insertSheet('Pending Grades');
    sheet.appendRow(['submissionId', 'courseworkId', 'studentName', 'studentEmail', 'suggestedGrade', 'suggestedFeedback', 'resubmitted', 'excerpt', 'updateTime', 'status']);
  }
  return sheet;
}

function getPendingGradesMap(courseworkId) {
  var sheet = getPendingGradesSheet();
  var data = sheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(courseworkId)) {
      map[data[i][0]] = { row: i + 1, updateTime: data[i][8], status: data[i][9] };
    }
  }
  return map;
}

function upsertPendingGrade(sheet, existingEntry, data) {
  var rowValues = [data.submissionId, data.courseworkId, data.studentName, data.studentEmail,
    data.suggestedGrade, data.suggestedFeedback, data.resubmitted, data.excerpt, data.updateTime, data.status];
  if (existingEntry) {
    sheet.getRange(existingEntry.row, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

// For the Grade tab's review screen \u2014 only rows still awaiting a decision
function getPendingGradesForAssignment(courseworkId) {
  var sheet = getPendingGradesSheet();
  var data = sheet.getDataRange().getValues();
  var results = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(courseworkId) && data[i][9] === 'pending') {
      results.push({
        submissionId: data[i][0], studentName: data[i][2], studentEmail: data[i][3],
        suggestedGrade: data[i][4], suggestedFeedback: data[i][5], resubmitted: !!data[i][6], excerpt: data[i][7]
      });
    }
  }
  return results;
}

function getStudentProfile(userId) {
  var profile = Classroom.UserProfiles.get(userId);
  return { name: (profile.name && profile.name.fullName) || profile.emailAddress, email: profile.emailAddress };
}

// Counts how many times a submission was actually turned in, so a second (or later) turn-in
// after the first can be flagged as "Resubmitted" for the teacher to notice during review.
function countTurnIns(sub) {
  var history = sub.submissionHistory || [];
  return history.filter(function(h) { return h.stateHistory && h.stateHistory.state === 'TURNED_IN'; }).length;
}

// Runs the AI grader but stores results instead of posting them \u2014 nothing touches
// Classroom until commitGrade() or commitAllRemaining() is called.
function generateGradeSuggestions(courseId, courseworkId) {
  var criteriaRow = getGradingCriteria(courseworkId);
  if (!criteriaRow) {
    return 'No stored grading criteria for this item \u2014 it may not have been built with this tool.';
  }

  var submissions = listAllStudentSubmissions(courseId, courseworkId, { states: ['TURNED_IN'] });
  var gradedLogMap = getGradedLogMap(courseworkId); // already committed, via either workflow
  var pendingSheet = getPendingGradesSheet();
  var pendingMap = getPendingGradesMap(courseworkId);
  var count = 0;

  submissions.forEach(function(sub) {
    var loggedEntry = gradedLogMap[sub.id];
    if (loggedEntry && String(loggedEntry.updateTime) === String(sub.updateTime)) return; // already committed, unchanged

    var pendingEntry = pendingMap[sub.id];
    if (pendingEntry && pendingEntry.status === 'pending' && String(pendingEntry.updateTime) === String(sub.updateTime)) return; // suggestion already waiting, unchanged

    var studentText = extractSubmissionText(sub, criteriaRow.itemType, criteriaRow.formId);
    if (!studentText) return;

    var result = callClaudeToGrade(criteriaRow.title, criteriaRow.itemType, criteriaRow.criteria, studentText);
    var profile = getStudentProfile(sub.userId);

    upsertPendingGrade(pendingSheet, pendingEntry, {
      submissionId: sub.id,
      courseworkId: courseworkId,
      studentName: profile.name,
      studentEmail: profile.email,
      suggestedGrade: result.grade,
      suggestedFeedback: result.feedback,
      resubmitted: countTurnIns(sub) > 1,
      excerpt: studentText.length > 49000
        ? studentText.substring(0, 49000) + '\n\n[Submission exceeded 49,000 characters and was cut off for storage \u2014 an edge case for an unusually long response.]'
        : studentText, // full text, no truncation in the normal case \u2014 shown in full in the review card (scrollable)
      updateTime: sub.updateTime,
      status: 'pending'
    });
    count++;
  });

  return 'Generated ' + count + ' new/updated suggestion(s) for "' + criteriaRow.title + '".';
}

// Posts one reviewed (possibly edited) grade + feedback for real, and marks it done in
// both tracking sheets so neither workflow touches this submission version again.
function commitGrade(courseId, courseworkId, submissionId, finalGrade, finalFeedback) {
  var criteriaRow = getGradingCriteria(courseworkId);
  if (!criteriaRow) throw new Error('No grading criteria on file for this item.');
  var result = saveGradingDecision(courseId, courseworkId, submissionId, finalGrade, finalFeedback, 'AI reviewed by teacher', true, []);

  var pendingSheet = getPendingGradesSheet();
  var pendingMap = getPendingGradesMap(courseworkId);
  var pendingEntry = pendingMap[submissionId];
  if (pendingEntry) {
    pendingSheet.getRange(pendingEntry.row, 5).setValue(finalGrade);
    pendingSheet.getRange(pendingEntry.row, 6).setValue(finalFeedback);
    pendingSheet.getRange(pendingEntry.row, 10).setValue('committed');
  }

  return result;
}

// Commits every still-pending suggestion for an assignment as-is (no per-item edits)
function commitAllRemaining(courseId, courseworkId) {
  var pending = getPendingGradesForAssignment(courseworkId);
  pending.forEach(function(p) {
    commitGrade(courseId, courseworkId, p.submissionId, p.suggestedGrade, p.suggestedFeedback);
  });
  return 'Committed ' + pending.length + ' suggestion(s).';
}

function getStudentEmail(userId) {
  return Classroom.UserProfiles.get(userId).emailAddress;
}

function extractQuizResponseText(userId, formId) {
  if (!formId) return null;
  var email = getStudentEmail(userId);
  var form = FormApp.openById(formId);
  var responses = form.getResponses();
  // Forms responses are chronological; use the latest matching submission so
  // resubmissions are graded from the newest evidence.
  for (var i = responses.length - 1; i >= 0; i--) {
    if (responses[i].getRespondentEmail() === email) {
      var itemResponses = responses[i].getItemResponses();
      var lines = itemResponses.map(function(ir) {
        return ir.getItem().getTitle() + ': ' + ir.getResponse();
      });
      return lines.join('\n');
    }
  }
  return null; // student hasn't filled out the form yet (or email wasn't captured)
}

function extractSubmissionText(sub, itemType, formId) {
  if (itemType === 'discussion') {
    return sub.shortAnswerSubmission ? sub.shortAnswerSubmission.answer : null;
  }
  if (itemType === 'quiz') {
    return extractQuizResponseText(sub.userId, formId);
  }
  // doc-based: assignment, writing, research, customassignment
  var attachments = getSubmittedDriveAttachmentsNewestFirst(sub);
  for (var i = 0; i < attachments.length; i++) {
    try {
      return DocumentApp.openById(attachments[i].driveFile.id).getBody().getText();
    } catch (e) {
      // Try the next submitted attachment in case this one is not a Google Doc.
    }
  }
  return null;
}

// Appends teacher feedback into the student's own submitted Doc. The grading source is
// retained only in the private grading log and is never shown in student-facing feedback.
// Not possible for quiz/discussion since no student-owned doc exists for those types.
function appendFeedbackToSubmission(sub, itemType, feedback, gradingSource) {
  if (!feedback) return { written: false, warning: '' };
  if (itemType === 'quiz' || itemType === 'discussion') {
    return { written: false, warning: 'The grade was returned, but Google Classroom does not provide an API for posting this comment type. The comment remains saved in Teacher Portal.' };
  }
  var attachments = getSubmittedDriveAttachmentsNewestFirst(sub);
  for (var i = 0; i < attachments.length; i++) {
    try {
      var doc = DocumentApp.openById(attachments[i].driveFile.id);
      var body = doc.getBody();
      body.appendParagraph('Teacher Feedback').setHeading(DocumentApp.ParagraphHeading.HEADING3);
      body.appendParagraph(feedback).editAsText().setForegroundColor('#174ea6').setBold(true);
      doc.saveAndClose();
      return { written: true, warning: '' };
    } catch (e) {
      // Keep looking in case another attachment is an editable Google Doc.
    }
  }
  return { written: false, warning: 'The grade was returned, but no editable submitted Google Doc was available for the comment. The comment remains saved in Teacher Portal.' };
}

// Grades every newly turned-in, not-yet-graded submission for one piece of coursework.
function gradeSubmissionsForCourseWork(courseId, courseworkId) {
  var criteriaRow = getGradingCriteria(courseworkId);
  if (!criteriaRow) {
    return 'No stored grading criteria for this item \u2014 it may not have been built with this tool.';
  }

  var submissions = listAllStudentSubmissions(courseId, courseworkId, { states: ['TURNED_IN'] });
  var logSheet = getGradedLogSheet();
  var logMap = getGradedLogMap(courseworkId);
  var gradedCount = 0;

  submissions.forEach(function(sub) {
    var existingLog = logMap[sub.id];
    if (existingLog && String(existingLog.updateTime) === String(sub.updateTime)) return; // this exact version already graded

    var studentText = extractSubmissionText(sub, criteriaRow.itemType, criteriaRow.formId);
    if (!studentText) return; // nothing to grade yet (e.g. quiz form not filled out)

    var result = callClaudeToGrade(criteriaRow.title, criteriaRow.itemType, criteriaRow.criteria, studentText);

    Classroom.Courses.CourseWork.StudentSubmissions.patch(
      { assignedGrade: result.grade, draftGrade: result.grade },
      courseId, courseworkId, sub.id,
      { updateMask: 'assignedGrade,draftGrade' }
    );

    appendFeedbackToSubmission(sub, criteriaRow.itemType, result.feedback);
    // Patching the grade can change Classroom's submission updateTime. Store the
    // post-patch value so the same turn-in is not mistaken for a new resubmission.
    var gradedSub = Classroom.Courses.CourseWork.StudentSubmissions.get(courseId, courseworkId, sub.id);
    recordGradedLog(logSheet, existingLog, sub.id, courseworkId, gradedSub.updateTime);
    gradedCount++;
  });

  return 'Graded ' + gradedCount + ' new/updated submission(s) for "' + criteriaRow.title + '".';
}

// Manual "Grade Now" entry point from the Grade tab
function gradeAssignmentNow(courseId, courseworkId) {
  return gradeSubmissionsForCourseWork(courseId, courseworkId);
}

// ============================================================
// HQSD TRACKING (High-Quality Student Data reporting)
// ============================================================

function normalizeRubricCriterionName(value) {
  return String(value || '').split('\n')[0].replace(/\s+/g, ' ').trim();
}

function findRubricTableInfo(doc) {
  var tables = doc.getBody().getTables();
  for (var t = 0; t < tables.length; t++) {
    var table = tables[t];
    var headerLimit = Math.min(table.getNumRows(), 3);
    for (var headerRowIndex = 0; headerRowIndex < headerLimit; headerRowIndex++) {
      var headerRow = table.getRow(headerRowIndex);
      var headers = [];
      for (var h = 0; h < headerRow.getNumCells(); h++) {
        headers.push(headerRow.getCell(h).getText().replace(/\s+/g, ' ').trim().toLowerCase());
      }
      var criterionIndex = -1;
      var teacherIndex = -1;
      var levelIndexes = { beginning: -1, developing: -1, proficient: -1, mastery: -1 };
      headers.forEach(function(header, index) {
        if (criterionIndex < 0 && /(criterion|criteria|skill|metric)/.test(header)) criterionIndex = index;
        if (teacherIndex < 0 && /(teacher|instructor).*(score|rating|evaluation|comment)/.test(header)) teacherIndex = index;
        if (levelIndexes.beginning < 0 && /(beginning|level\s*1|^1\b)/.test(header)) levelIndexes.beginning = index;
        if (levelIndexes.developing < 0 && /(developing|level\s*2|^2\b)/.test(header)) levelIndexes.developing = index;
        if (levelIndexes.proficient < 0 && /(proficient|level\s*3|^3\b)/.test(header)) levelIndexes.proficient = index;
        if (levelIndexes.mastery < 0 && /(mastery|advanced|exemplary|level\s*4|^4\b)/.test(header)) levelIndexes.mastery = index;
      });
      var levelCount = Object.keys(levelIndexes).filter(function(key) { return levelIndexes[key] >= 0; }).length;
      if (criterionIndex >= 0 && (teacherIndex >= 0 || levelCount >= 2)) {
        return {
          table: table,
          headerRowIndex: headerRowIndex,
          criterionIndex: criterionIndex,
          teacherIndex: teacherIndex,
          levelIndexes: levelIndexes
        };
      }
    }
  }
  return null;
}

function extractRubricDefinitionFromDoc(fileId, title) {
  try {
    var doc = DocumentApp.openById(fileId);
    var info = findRubricTableInfo(doc);
    if (!info) return null;
    var criteria = [];
    for (var r = info.headerRowIndex + 1; r < info.table.getNumRows(); r++) {
      var row = info.table.getRow(r);
      if (info.criterionIndex >= row.getNumCells()) continue;
      var criterion = normalizeRubricCriterionName(row.getCell(info.criterionIndex).getText());
      if (!criterion || /total|final grade/i.test(criterion)) continue;
      var entry = { criterion: criterion, description: '' };
      Object.keys(info.levelIndexes).forEach(function(level) {
        var index = info.levelIndexes[level];
        entry[level] = index >= 0 && index < row.getNumCells() ? row.getCell(index).getText().trim() : '';
      });
      criteria.push(entry);
    }
    if (!criteria.length) return null;
    return { title: title || doc.getName(), criteria: criteria, safetyGate: '', studentSections: [], templateFileId: fileId };
  } catch (e) {
    return null;
  }
}

function getCourseWorkDriveFileIds(courseWork) {
  var ids = [];
  (courseWork.materials || []).forEach(function(material) {
    if (material.driveFile && material.driveFile.driveFile && material.driveFile.driveFile.id) {
      ids.push(material.driveFile.driveFile.id);
    }
  });
  return ids;
}

function resolveHQSDRubricDefinition(courseId, item, courseWork) {
  if (item && item.rubricSnapshot && item.rubricSnapshot.criteria && item.rubricSnapshot.criteria.length) {
    return item.rubricSnapshot;
  }
  var saved = getSavedProjectRubricDefinition(item.courseworkId);
  if (saved && saved.criteria && saved.criteria.length) return saved;
  var work = courseWork || Classroom.Courses.CourseWork.get(courseId, item.courseworkId);
  var fileIds = getCourseWorkDriveFileIds(work);
  for (var i = 0; i < fileIds.length; i++) {
    var extracted = extractRubricDefinitionFromDoc(fileIds[i], item.title);
    if (extracted) return extracted;
  }
  return null;
}

function extractRubricScoresFromSubmissionDocument(sub) {
  var attachments = getSubmittedDriveAttachmentsNewestFirst(sub);
  for (var i = 0; i < attachments.length; i++) {
    try {
      var doc = DocumentApp.openById(attachments[i].driveFile.id);
      var info = findRubricTableInfo(doc);
      if (!info || info.teacherIndex < 0) continue;
      var scores = {};
      for (var r = info.headerRowIndex + 1; r < info.table.getNumRows(); r++) {
        var row = info.table.getRow(r);
        if (info.criterionIndex >= row.getNumCells() || info.teacherIndex >= row.getNumCells()) continue;
        var criterion = normalizeRubricCriterionName(row.getCell(info.criterionIndex).getText());
        if (!criterion) continue;
        var teacherText = row.getCell(info.teacherIndex).getText();
        var match = teacherText.match(/\b([1-4])(?:\s*\/\s*4)?\b/);
        if (match) scores[criterion.toLowerCase()] = Number(match[1]);
      }
      if (Object.keys(scores).length) return scores;
    } catch (e) {
      // Try the next submitted attachment.
    }
  }
  return {};
}

function extractRubricScoresFromSubmission(sub) {
  var stored = getStoredRubricScores(sub.courseWorkId, sub.id);
  if (stored.length) {
    var result = {};
    stored.forEach(function(entry) { result[normalizeRubricCriterionName(entry.criterionName).toLowerCase()] = entry.score; });
    return result;
  }
  return extractRubricScoresFromSubmissionDocument(sub);
}

// ------------------------------------------------------------
// Sheets
// ------------------------------------------------------------
function getOrCreateHQSDGroupsSheet() {
  var ss = getOrCreateCriteriaSpreadsheet();
  var sheet = ss.getSheetByName('HQSD Groups');
  if (!sheet) {
    sheet = ss.insertSheet('HQSD Groups');
    sheet.appendRow(['groupId', 'groupName', 'courseId', 'courseName', 'createdAt', 'itemsJSON', 'topicsJSON', 'planConfigJSON']);
  } else if (!sheet.getRange(1, 7).getValue()) {
    // Backward-compatible schema upgrade for reports created before topics
    // became part of the saved report definition.
    sheet.getRange(1, 7).setValue('topicsJSON');
  }
  if (!sheet.getRange(1, 8).getValue()) sheet.getRange(1, 8).setValue('planConfigJSON');
  return sheet;
}

function getOrCreateHQSDSnapshotsSheet() {
  var ss = getOrCreateCriteriaSpreadsheet();
  var sheet = ss.getSheetByName('HQSD Snapshots');
  if (!sheet) {
    sheet = ss.insertSheet('HQSD Snapshots');
    sheet.appendRow(['snapshotId', 'groupId', 'timestamp', 'improvementNote', 'studentAveragesJSON', 'statsJSON', 'aiFindings', 'excludedJSON', 'aiRecommendations']);
  }
  return sheet;
}

// ------------------------------------------------------------
// Group management
// ------------------------------------------------------------

// Kept for compatibility with older deployed clients.
function getClassCourseWork(courseId) {
  return listAllCourseWorkForGrading(courseId).map(function(cw) {
    return { courseworkId: cw.id, title: cw.title, maxPoints: cw.maxPoints || 100 };
  });
}

// ------------------------------------------------------------
// Classroom topics are used to label assignments clearly in the HQSD picker.
// ------------------------------------------------------------
function getCourseTopics(courseId) {
  var topics = [], pageToken;
  do {
    var options = {};
    if (pageToken) options.pageToken = pageToken;
    var response = Classroom.Courses.Topics.list(courseId, options);
    topics = topics.concat(response.topic || []);
    pageToken = response.nextPageToken;
  } while (pageToken);
  return topics.map(function(t) {
    return { topicId: t.topicId, name: t.name };
  });
}

function getAllCourseWorkForHQSD(courseId) {
  var topicNames = {};
  getCourseTopics(courseId).forEach(function(topic) {
    topicNames[String(topic.topicId)] = topic.name;
  });
  var criteriaMap = getCriteriaMapForCourse(courseId);
  return listAllCourseWorkForGrading(courseId)
    .map(function(cw) {
      return {
        courseworkId: cw.id,
        title: cw.title || 'Untitled assignment',
        maxPoints: cw.maxPoints || 100,
        topicId: cw.topicId || '',
        topicName: topicNames[String(cw.topicId)] || 'No topic',
        rubricAvailable: !!(criteriaMap[String(cw.id)] && criteriaMap[String(cw.id)].itemType === 'project')
      };
    })
    .sort(function(a, b) {
      return a.topicName.localeCompare(b.topicName) || a.title.localeCompare(b.title);
    });
}

var OHIO_CONSTRUCTION_STANDARDS_SOURCE_URL =
  'https://education.ohio.gov/getattachment/Topics/Career-Tech/Career-Fields/Construction-Technologies-Career-Field/2019-Construction-Technologies-Career-Field-Technical-Content-Standards.pdf.aspx?lang=en-US';
var OHIO_CAREER_READINESS_SOURCE_URL =
  'https://education.ohio.gov/Topics/Ohio-s-Graduation-Requirements/Ohio%E2%80%99s-Graduation-Requirements/Graduation-Seals/OhioMeansJobs-Readiness-Seal';

function getOhioConstructionStandardsCatalog() {
  // Verified against Ohio's Construction Technologies Career Field Technical
  // Content Standards. AI may select from this carpentry/shop catalog but may
  // not invent or alter standard codes.
  var technical = [
    { code: '1.1.6', description: 'Explain the importance of work ethic, accountability, and responsibility and demonstrate associated behaviors in fulfilling personal, community, and workplace roles.' },
    { code: '1.1.7', description: 'Apply problem-solving and critical-thinking skills to work-related issues when making decisions and formulating solutions.' },
    { code: '1.1.9', description: 'Give and receive constructive feedback to improve work habits.' },
    { code: '1.2.3', description: 'Identify and use verbal, nonverbal, and active listening skills to communicate effectively.' },
    { code: '1.2.5', description: 'Communicate information for an intended audience and purpose.' },
    { code: '1.2.10', description: 'Use interpersonal skills to provide group leadership, promote collaboration, and work in a team.' },
    { code: '1.2.12', description: 'Use technical writing skills to complete forms and create reports.' },
    { code: '1.3.2', description: 'Follow protocols and practices necessary to maintain a clean, safe, and healthy work environment.' },
    { code: '1.3.3', description: 'Use ethical character traits consistent with workplace standards, including honesty and personal integrity.' },
    { code: '1.3.5', description: 'Access and implement safety compliance measures that contribute to continuous improvement of the organization.' },
    { code: '2.1.1', description: 'Use OSHA-defined procedures for identifying responsibilities and applying established jobsite safety practices.' },
    { code: '2.1.2', description: 'Identify and rectify or mitigate construction hazards.' },
    { code: '2.1.6', description: 'Identify the source of electrical hazards and use shutdown and established lock-out/tag-out procedures.' },
    { code: '2.1.7', description: 'Identify procedures for the handling, storage, and disposal of hazardous materials.' },
    { code: '2.1.8', description: 'Identify the location of emergency equipment, Safety Data Sheets, fire alarms, and exits.' },
    { code: '2.1.9', description: 'Select and operate fire extinguishers based on the class of fire.' },
    { code: '2.2.3', description: 'Select, use, store, maintain, and dispose of personal protective equipment appropriate to job tasks, conditions, and materials.' },
    { code: '2.2.4', description: 'Identify workplace risk factors associated with lifting, operating, and moving heavy objects and establish an ergonomics process.' },
    { code: '2.2.5', description: 'Identify, inspect, and use safety equipment appropriate for the task.' },
    { code: '2.2.7', description: 'Identify and describe hazards associated with using electronic devices on the jobsite.' },
    { code: '2.2.8', description: 'Identify and describe hazards associated with improper clothing and poor hygiene.' },
    { code: '2.4.2', description: 'Ensure the presence and functionality of safety systems and hardware.' },
    { code: '2.4.4', description: 'Perform machine adjustments, including belts and drive chains.' },
    { code: '2.4.7', description: 'Maintain instrument, machinery, and equipment cleanliness, appearance, and safety devices.' },
    { code: '2.4.9', description: 'Inspect and maintain tooling and implements.' },
    { code: '2.4.10', description: 'Document and log equipment maintenance records.' },
    { code: '3.5.1', description: 'Identify, describe, and assemble materials for floor framing.' },
    { code: '3.5.4', description: 'Lay out, cut, and install floor joists.' },
    { code: '3.5.7', description: 'Install subflooring using adhesives and fasteners.' },
    { code: '3.6.2', description: 'Lay out walls and rough openings.' },
    { code: '3.6.4', description: 'Locate partitions, determine stud layout, and strike wall lines.' },
    { code: '3.6.6', description: 'Cut and assemble wood and metal wall framing components.' },
    { code: '3.6.7', description: 'Erect and plumb partitions and walls with top and bottom plates.' },
    { code: '3.6.10', description: 'Lay out, cut, and install ceiling joists and bracing.' },
    { code: '3.7.1', description: 'Compare roof types and materials.' },
    { code: '3.7.2', description: 'Identify, describe, and assemble materials for roof framing.' },
    { code: '3.7.3', description: 'Lay out, cut, and install ridge boards and common rafters.' },
    { code: '3.8.3', description: 'Install exterior door and window units and hardware.' },
    { code: '3.8.6', description: 'Cut and install molding and frieze board.' },
    { code: '3.8.7', description: 'Case exterior openings.' },
    { code: '3.9.2', description: 'Calculate rise and run and design stairway risers, treads, carriage, stringers, and clearances.' },
    { code: '3.9.3', description: 'Lay out, cut, and install stair components.' },
    { code: '3.9.4', description: 'Install stair finish trim components.' },
    { code: '3.10.8', description: 'Prepare subfloor, install building paper, and cut and install underlayment.' },
    { code: '3.10.9', description: 'Lay out and install finished flooring.' },
    { code: '3.10.10', description: 'Install door units and door hardware.' },
    { code: '3.10.11', description: 'Install interior door and window trim.' },
    { code: '3.10.12', description: 'Apply finish coatings, including paint, stains, and varnishes.' },
    { code: '3.10.13', description: 'Install baseboard and moldings.' },
    { code: '3.10.14', description: 'Install cabinetry, shelving, and related hardware.' },
    { code: '3.11.1', description: 'Identify customer needs and develop a plan for a remodeling or restoration project.' },
    { code: '3.11.2', description: 'Identify damage, diagnose the cause of damage, and plan repair.' },
    { code: '3.11.4', description: 'Integrate new construction into an existing structure.' },
    { code: '6.1.1', description: 'Calculate surface area and volume for three-dimensional objects to a specified level of precision.' },
    { code: '6.1.2', description: 'Apply measurement scales to layout length, width, and angle measurements.' },
    { code: '6.1.3', description: 'Apply algebraic procedures and geometric concepts to reading construction documents.' },
    { code: '6.1.5', description: 'Select and use measurement tools.' },
    { code: '6.1.6', description: 'Perform calculations and conversions with fractions, decimals, and percents.' },
    { code: '6.1.7', description: 'Perform unit conversions.' },
    { code: '6.2.1', description: 'Collect and analyze project information to determine resources and tasks required to complete a project.' },
    { code: '6.2.3', description: 'Use architects’ and engineers’ scales to read and interpret construction drawings for material calculations and installation.' },
    { code: '6.2.4', description: 'Read, interpret, and organize construction drawings, models, specifications, and other contractual documents.' },
    { code: '6.3.2', description: 'Identify necessary material, time, personnel, and equipment to be used in construction projects.' },
    { code: '6.3.3', description: 'Calculate the cost of identified materials, time, personnel, and equipment used in construction projects.' },
    { code: '6.4.3', description: 'Create a schedule of construction and installation.' },
    { code: '6.5.4', description: 'Describe the walkthrough and punch-list process used to ensure conformity with plans and specifications.' },
    { code: '7.1.2', description: 'Collect and analyze data to identify required deliverables based on client specifications.' },
    { code: '7.1.3', description: 'Conceptualize design through hand drawing.' },
    { code: '7.1.4', description: 'Create a visualization of a proposed project using relevant materials and client specifications.' },
    { code: '7.1.8', description: 'Develop and present a comprehensive proposal.' },
    { code: '7.3.2', description: 'Construct scaled orthographic drawings to illustrate floor plans, section views, and cabinet elevations.' },
    { code: '7.3.6', description: 'Identify the role of CAD and Building Information Modeling in construction drafting.' }
  ];
  var careerPreparation = [
    { code: 'OMJ-RS-DRUG-FREE', label: 'Ohio Career Preparation — Drug Free', description: 'The student commits to being drug free.' },
    { code: 'OMJ-RS-RELIABILITY', label: 'Ohio Career Preparation — Reliability', description: 'The student has integrity and responsibility in professional settings.' },
    { code: 'OMJ-RS-WORK-ETHIC', label: 'Ohio Career Preparation — Work Ethic', description: 'The student has effective work habits, personal accountability, and a determination to succeed.' },
    { code: 'OMJ-RS-PUNCTUALITY', label: 'Ohio Career Preparation — Punctuality', description: 'The student arrives at commitments on time and ready to contribute.' },
    { code: 'OMJ-RS-DISCIPLINE', label: 'Ohio Career Preparation — Discipline', description: 'The student abides by guidelines, demonstrates self-control, and stays on task.' },
    { code: 'OMJ-RS-TEAMWORK', label: 'Ohio Career Preparation — Teamwork/Collaboration', description: 'The student builds collaborative relationships with others and can work as part of a team.' },
    { code: 'OMJ-RS-PROFESSIONALISM', label: 'Ohio Career Preparation — Professionalism', description: 'The student demonstrates honesty, acts appropriately and responsibly, and learns from mistakes.' },
    { code: 'OMJ-RS-LEARNING-AGILITY', label: 'Ohio Career Preparation — Learning Agility', description: 'The student desires to continuously learn new information and skills.' },
    { code: 'OMJ-RS-PROBLEM-SOLVING', label: 'Ohio Career Preparation — Critical Thinking/Problem-Solving', description: 'The student exercises strong decision-making skills, analyzes issues effectively, and thinks creatively to overcome problems.' },
    { code: 'OMJ-RS-LEADERSHIP', label: 'Ohio Career Preparation — Leadership', description: 'The student leverages the strengths of others to achieve common goals and can prioritize and delegate work.' },
    { code: 'OMJ-RS-CREATIVITY', label: 'Ohio Career Preparation — Creativity/Innovation', description: 'The student is original and inventive and communicates new ideas to others.' },
    { code: 'OMJ-RS-COMMUNICATION', label: 'Ohio Career Preparation — Oral and Written Communications', description: 'The student articulates thoughts and ideas clearly and effectively in written and oral forms.' },
    { code: 'OMJ-RS-DIGITAL-TECHNOLOGY', label: 'Ohio Career Preparation — Digital Technology', description: 'The student uses technology to solve problems, complete tasks, and accomplish goals.' },
    { code: 'OMJ-RS-GLOBAL-FLUENCY', label: 'Ohio Career Preparation — Global/Intercultural Fluency', description: 'The student values, respects, and learns from diverse groups of people.' },
    { code: 'OMJ-RS-CAREER-MANAGEMENT', label: 'Ohio Career Preparation — Career Management', description: 'The student articulates strengths, knowledge, and experiences relevant to success in a job or postsecondary education.' }
  ];
  technical.forEach(function(standard) {
    standard.label = standard.code;
    standard.sourceName = 'Ohio Construction Technologies';
    standard.sourceUrl = OHIO_CONSTRUCTION_STANDARDS_SOURCE_URL;
  });
  careerPreparation.forEach(function(standard) {
    standard.sourceName = 'OhioMeansJobs Readiness Seal professional skills';
    standard.sourceUrl = OHIO_CAREER_READINESS_SOURCE_URL;
  });
  return technical.concat(careerPreparation);
}

function suggestOhioConstructionStandards(courseId, selectedItems) {
  selectedItems = selectedItems || [];
  if (!selectedItems.length) throw new Error('Select at least one assignment first.');

  var criteriaMap = getCriteriaMapForCourse(courseId);
  var evidence = selectedItems.slice(0, 30).map(function(item) {
    var work;
    try {
      work = Classroom.Courses.CourseWork.get(courseId, item.courseworkId);
    } catch (e) {
      work = { title: item.title || 'Untitled assignment', description: '' };
    }
    var criteria = criteriaMap[String(item.courseworkId)];
    return {
      topic: item.topicName || 'No topic',
      title: work.title || item.title || 'Untitled assignment',
      directions: String(work.description || '').substring(0, 1400),
      gradingCriteria: criteria ? String(criteria.criteria || '').substring(0, 1000) : '',
      rubricEnhanced: !!item.rubricEnhanced
    };
  });

  var catalog = getOhioConstructionStandardsCatalog();
  var prompt =
    'You are matching evidence from a high-school carpentry/shop program to Ohio Construction Technologies competencies and Ohio career-preparation professional skills. ' +
    'Choose only standards that the selected assignments directly teach or measure. Do not select a standard merely because it is generally useful. ' +
    'You may use ONLY the codes in the verified catalog below. Never invent, alter, or paraphrase a code. Select 3 to 12 strong matches. ' +
    'Return only valid JSON in this form: {"matches":[{"code":"2.2.3","reason":"One short teacher-facing reason tied to the selected evidence."}]}.\n\n' +
    'SELECTED ASSIGNMENT EVIDENCE:\n' + JSON.stringify(evidence) + '\n\n' +
    'VERIFIED OHIO CATALOG:\n' + JSON.stringify(catalog);
  var settings = getSettings();
  var model = settings.aiSpeed === 'fast' ? MODEL_FAST : MODEL_DETAILED;
  var parsed;
  try {
    parsed = JSON.parse(stripJsonFences(callClaude(prompt, 1800, model)));
  } catch (e) {
    throw new Error('The AI response could not be verified against the Ohio standards catalog. Please try again.');
  }

  var byCode = {};
  catalog.forEach(function(standard) { byCode[standard.code] = standard; });
  var seen = {};
  var matches = [];
  ((parsed && parsed.matches) || []).forEach(function(match) {
    var code = String(match.code || '').trim();
    if (!byCode[code] || seen[code] || matches.length >= 12) return;
    seen[code] = true;
    matches.push({
      code: code,
      label: byCode[code].label || code,
      description: byCode[code].description,
      reason: String(match.reason || 'Directly aligns to the selected assignment evidence.').trim(),
      sourceName: byCode[code].sourceName,
      sourceUrl: byCode[code].sourceUrl
    });
  });
  return {
    standards: matches,
    sources: [
      { name: 'Ohio Construction Technologies standards', url: OHIO_CONSTRUCTION_STANDARDS_SOURCE_URL },
      { name: 'OhioMeansJobs Readiness Seal professional skills', url: OHIO_CAREER_READINESS_SOURCE_URL }
    ]
  };
}

function getCourseWorkForTopics(courseId, topicIds) {
  var selected = {};
  (topicIds || []).forEach(function(topicId) { selected[String(topicId)] = true; });
  if (Object.keys(selected).length === 0) return [];

  return getAllCourseWorkForHQSD(courseId)
    .filter(function(item) { return selected[String(item.topicId)]; });
}

function snapshotRubricDefinitionsForHQSDItems(courseId, items, existingItems) {
  var existingById = {};
  (existingItems || []).forEach(function(item) { existingById[String(item.courseworkId)] = item; });
  return (items || []).map(function(item) {
    var copy = Object.assign({}, item);
    var allowedRoles = ['Baseline', 'Midpoint', 'Final', 'Ongoing evidence'];
    if (allowedRoles.indexOf(copy.assessmentRole) < 0) copy.assessmentRole = 'Ongoing evidence';
    var existing = existingById[String(copy.courseworkId)];
    if (copy.rubricEnhanced) {
      if (existing && existing.rubricSnapshot) copy.rubricSnapshot = existing.rubricSnapshot;
      else {
        var rubric = resolveHQSDRubricDefinition(courseId, copy);
        if (rubric) copy.rubricSnapshot = JSON.parse(JSON.stringify(rubric));
      }
      if (!copy.rubricSnapshot || !copy.rubricSnapshot.criteria || !copy.rubricSnapshot.criteria.length) {
        throw new Error('“' + (copy.title || 'This assignment') + '” is marked rubric-enhanced, but no readable rubric definition was found. Attach or create the rubric first.');
      }
      copy.rubricVersion = copy.rubricSnapshot ? (copy.rubricSnapshot.version || 1) : 1;
    } else {
      delete copy.rubricSnapshot;
      delete copy.rubricVersion;
    }
    return copy;
  });
}

function inferHQSDTrackingType(items, planConfig) {
  var configured = planConfig && planConfig.trackingType;
  if (configured === 'checkpoints' || configured === 'ongoing') return configured;
  var hasCheckpointRole = (items || []).some(function(item) {
    return item.assessmentRole === 'Baseline' || item.assessmentRole === 'Midpoint' || item.assessmentRole === 'Final';
  });
  return hasCheckpointRole ? 'checkpoints' : 'ongoing';
}

function validateHQSDTrackingConfiguration(items, planConfig) {
  items = items || [];
  planConfig = planConfig || {};
  var trackingType = inferHQSDTrackingType(items, planConfig);
  planConfig.trackingType = trackingType;
  var seenIds = {};
  items.forEach(function(item) {
    var id = String(item.courseworkId || '');
    if (!id) throw new Error('Every tracked assignment must have a Classroom assignment ID.');
    if (seenIds[id]) throw new Error('The same assignment cannot be used more than once in an HQSD comparison.');
    seenIds[id] = true;
  });
  if (trackingType === 'checkpoints') {
    var counts = { Baseline: 0, Midpoint: 0, Final: 0 };
    items.forEach(function(item) {
      if (!Object.prototype.hasOwnProperty.call(counts, item.assessmentRole)) {
        throw new Error('Checkpoint domains may contain only Baseline, Midpoint, and Final assignments.');
      }
      counts[item.assessmentRole]++;
    });
    if (counts.Baseline !== 1 || counts.Final !== 1 || counts.Midpoint > 1) {
      throw new Error('A checkpoint domain requires exactly one Baseline, no more than one Midpoint, and exactly one Final assignment.');
    }
  } else {
    if (items.length < 2) throw new Error('An ongoing evidence series requires at least two separate assignments.');
    items.forEach(function(item) { item.assessmentRole = 'Ongoing evidence'; });
  }
  return { items: items, planConfig: planConfig };
}

function applyDefaultHQSDPlanConfig(courseId, courseName, items, provided) {
  provided = provided || {};
  var assignmentTitles = (items || []).map(function(item) { return item.title; }).filter(function(title) { return !!title; });
  var rubricCriteria = {};
  (items || []).forEach(function(item) {
    if (!item.rubricSnapshot || !item.rubricSnapshot.criteria) return;
    item.rubricSnapshot.criteria.forEach(function(row) {
      var name = normalizeRubricCriterionName(row.criterion || row.name);
      if (name) rubricCriteria[name] = true;
    });
  });
  var teacherAttribution = String(provided.teacherAttribution || '').trim();
  if (!teacherAttribution) {
    try {
      var teacher = Classroom.Courses.Teachers.get(courseId, 'me');
      var teacherName = teacher.profile && teacher.profile.name ? teacher.profile.name.fullName : '';
      teacherAttribution = [teacherName, courseName].filter(function(value) { return !!value; }).join(' — ');
    } catch (e) {
      teacherAttribution = courseName || 'Course teacher and assigned class';
    }
  }
  var evidenceList = assignmentTitles.length
    ? assignmentTitles.slice(0, 8).join(', ') + (assignmentTitles.length > 8 ? ', and ' + (assignmentTitles.length - 8) + ' additional tracked assignments' : '')
    : 'the selected Classroom assignments';
  var criterionNames = Object.keys(rubricCriteria);
  return {
    trackingType: inferHQSDTrackingType(items, provided),
    teacherAttribution: teacherAttribution,
    standards: String(provided.standards || '').trim() ||
      ('Aligned to the course learning standards and skill targets assessed through ' + evidenceList + '. Exact state or local standard codes may be added by the teacher when required.'),
    measurePurpose: String(provided.measurePurpose || '').trim() ||
      ('Measures student achievement and growth across the selected assignments' +
        (criterionNames.length ? ', including criterion-level evidence for ' + criterionNames.join(', ') : '') + '.'),
    protocol: String(provided.protocol || '').trim() ||
      'Assignments are administered through Google Classroom using common directions and scoring expectations. Tests and written work are scored against the published criteria; physical projects are scored by the teacher with the attached rubric. Resubmissions are reviewed as new evidence, and scores are retained for comparison over time.',
    trustworthiness: String(provided.trustworthiness || '').trim() ||
      'All students receive common directions and scoring expectations. Tests use consistent answer keys; shop projects use the same rubric dimensions and performance levels. Required accommodations are provided without changing the skill being measured. The teacher reviews all scores and AI suggestions, compares multiple evidence points, and checks for inconsistent scoring or possible bias before making instructional decisions.',
    valueAdded: String(provided.valueAdded || '').trim() || 'Not available',
    reflectionLog: String(provided.reflectionLog || ''),
    reflectionLogUpdatedAt: String(provided.reflectionLogUpdatedAt || '')
  };
}

function createHQSDGroup(name, courseId, courseName, items, topics, planConfig) {
  var sheet = getOrCreateHQSDGroupsSheet();
  var groupId = Utilities.getUuid();
  var validated = validateHQSDTrackingConfiguration(items, planConfig || {});
  items = validated.items;
  planConfig = validated.planConfig;
  items = snapshotRubricDefinitionsForHQSDItems(courseId, items);
  planConfig = applyDefaultHQSDPlanConfig(courseId, courseName, items, planConfig);
  sheet.appendRow([groupId, name, courseId, courseName, new Date(), JSON.stringify(items), JSON.stringify(topics || []), JSON.stringify(planConfig || {})]);
  return groupId;
}

function getHQSDGroups(courseId) {
  var sheet = getOrCreateHQSDGroupsSheet();
  var data = sheet.getDataRange().getValues();
  var results = [];
  for (var i = 1; i < data.length; i++) {
    if (!courseId || String(data[i][2]) === String(courseId)) {
      var parsedItems = JSON.parse(data[i][5] || '[]');
      var parsedConfig = JSON.parse(data[i][7] || '{}');
      parsedConfig.trackingType = inferHQSDTrackingType(parsedItems, parsedConfig);
      results.push({
        groupId: data[i][0], name: data[i][1], courseId: data[i][2],
        courseName: data[i][3], items: parsedItems,
        topics: JSON.parse(data[i][6] || '[]'), planConfig: parsedConfig
      });
    }
  }
  return results;
}

function getHQSDGroup(groupId) {
  var groups = getHQSDGroups(null);
  for (var i = 0; i < groups.length; i++) {
    if (groups[i].groupId === groupId) return groups[i];
  }
  return null;
}

function getHQSDReflectionLog(groupId) {
  var group = getHQSDGroup(groupId);
  if (!group) throw new Error('HQSD domain not found.');
  var config = group.planConfig || {};
  return {
    log: String(config.reflectionLog || ''),
    updatedAt: String(config.reflectionLogUpdatedAt || '')
  };
}

function saveHQSDReflectionLog(groupId, logText) {
  var sheet = getOrCreateHQSDGroupsSheet();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(groupId)) {
      var config = JSON.parse(data[i][7] || '{}');
      config.reflectionLog = String(logText || '');
      config.reflectionLogUpdatedAt = new Date().toISOString();
      sheet.getRange(i + 1, 8).setValue(JSON.stringify(config));
      return {
        log: config.reflectionLog,
        updatedAt: config.reflectionLogUpdatedAt
      };
    }
  }
  throw new Error('HQSD domain not found.');
}

function updateHQSDGroupItems(groupId, items, planConfig) {
  var sheet = getOrCreateHQSDGroupsSheet();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === groupId) {
      var existingItems = JSON.parse(data[i][5] || '[]');
      var existingConfig = JSON.parse(data[i][7] || '{}');
      var mergedConfig = Object.assign({}, existingConfig, planConfig || {});
      var validated = validateHQSDTrackingConfiguration(items, mergedConfig);
      items = validated.items;
      mergedConfig = validated.planConfig;
      items = snapshotRubricDefinitionsForHQSDItems(data[i][2], items, existingItems);
      sheet.getRange(i + 1, 6).setValue(JSON.stringify(items));
      mergedConfig = applyDefaultHQSDPlanConfig(data[i][2], data[i][3], items, mergedConfig);
      sheet.getRange(i + 1, 8).setValue(JSON.stringify(mergedConfig));
      return 'Updated.';
    }
  }
  throw new Error('Group not found.');
}

function getHQSDGroupAssignmentReview(groupId) {
  var group = getHQSDGroup(groupId);
  if (!group) throw new Error('HQSD domain not found.');

  var selectedById = {};
  group.items.forEach(function(item) { selectedById[String(item.courseworkId)] = item; });

  var currentItems = getAllCourseWorkForHQSD(group.courseId);
  var currentById = {};
  var reviewItems = currentItems.map(function(item) {
    var id = String(item.courseworkId);
    currentById[id] = true;
    item.selected = !!selectedById[id];
    item.isNew = !selectedById[id];
    item.rubricEnhanced = selectedById[id]
      ? !!selectedById[id].rubricEnhanced
      : !!item.rubricAvailable;
    item.assessmentRole = selectedById[id] ? (selectedById[id].assessmentRole || 'Ongoing evidence') : 'Ongoing evidence';
    return item;
  });

  // Preserve visibility of an assignment that moved out of its original topic;
  // the teacher can deliberately keep or remove it during review.
  group.items.forEach(function(item) {
    if (!currentById[String(item.courseworkId)]) {
      var copy = Object.assign({}, item);
      copy.selected = true;
      copy.noLongerInTopic = true;
      reviewItems.push(copy);
    }
  });

  return { legacy: false, items: reviewItems,
    planConfig: applyDefaultHQSDPlanConfig(group.courseId, group.courseName, group.items, group.planConfig || {}) };
}

// Removes the group itself only — its check-in snapshots are deliberately left in the
// "HQSD Snapshots" sheet rather than cascade-deleted. That history may be part of your
// OTES evaluation record-keeping, so it stays recoverable in the underlying spreadsheet
// even after the group stops appearing here.
function deleteHQSDGroup(groupId) {
  var sheet = getOrCreateHQSDGroupsSheet();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === groupId) {
      sheet.deleteRow(i + 1);
      return 'Deleted.';
    }
  }
  throw new Error('Group not found.');
}

// ------------------------------------------------------------
// HQSD report design system (Google Docs, exported to PDF) — a fixed
// palette independent of the teacher's Settings accentColor. That setting
// stays scoped to student-facing content Docs; these two reports are
// formal, admin-facing artifacts (OTES evaluation material) and should
// look consistent regardless of what color a teacher picked for classroom
// materials.
//
// Deliberately built as a Doc, not a Slides deck: Slides requires hand
// positioning every element by absolute coordinates, and Slides tables
// auto-grow to fit their own text — so a fixed-position layout breaks
// (overlapping elements) the moment any cell's content is longer than
// estimated, with no way to preview the result before it ships. A Doc
// auto-flows content top to bottom, so that whole class of bug can't
// happen; PDF export at the end gives a frozen, non-editable artifact.
// ------------------------------------------------------------
var HQSD_NAVY = '#0B203D';
var HQSD_STAT_COLORS = ['#2475B5', '#1CA895', '#37B5E5', '#F6B940'];
var HQSD_INK_SECONDARY = '#303A46';
var HQSD_INK_MUTED = '#718096';
var HQSD_STATUS_GOOD = '#1CA895';
var HQSD_STATUS_ALERT = '#B64A4A';
var HQSD_ACCENT = '#37B5E5';
var HQSD_SURFACE = '#F1F4F8';
var HQSD_BORDER = '#D5DEE8';

function initializeHQSDDocument(doc, reportLabel, group) {
  var body = doc.getBody();
  body.setMarginTop(34).setMarginBottom(42).setMarginLeft(38).setMarginRight(38);

  var footer = doc.getFooter() || doc.addFooter();
  var footerPara = footer.getNumChildren() > 0 ? footer.getChild(0).asParagraph() : footer.appendParagraph('\u00A0');
  footerPara.setText(reportLabel + '   |   ' + group.name + '   |   Educator working document');
  footerPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  footerPara.editAsText().setFontSize(8).setForegroundColor(HQSD_INK_MUTED).setFontFamily('Arial');
  return body;
}

function appendHQSDCoverPage(body, title, subtitle, metaLine, stats) {
  var cover = body.appendTable([['\u00A0'], ['\u00A0']]);
  cover.setBorderWidth(0);
  var cell = cover.getCell(0, 0);
  cell.setBackgroundColor(HQSD_NAVY);
  cell.setPaddingTop(42).setPaddingBottom(26).setPaddingLeft(26).setPaddingRight(26);

  var eyebrow = cell.getChild(0).asParagraph();
  eyebrow.setText('HIGH-QUALITY STUDENT DATA');
  eyebrow.setSpacingAfter(18);
  eyebrow.editAsText().setBold(true).setFontSize(9).setForegroundColor('#A8C6DF').setFontFamily('Roboto Condensed');

  var titlePara = cell.appendParagraph(title.toUpperCase());
  titlePara.setSpacingAfter(10);
  titlePara.editAsText().setBold(true).setFontSize(30).setForegroundColor('#FFFFFF').setFontFamily('Roboto Condensed');

  var subtitlePara = cell.appendParagraph(subtitle || '\u00A0');
  subtitlePara.setSpacingAfter(8);
  subtitlePara.editAsText().setFontSize(13).setForegroundColor('#D8E6F2').setFontFamily('Roboto Condensed');

  var metaPara = cell.appendParagraph(metaLine || '\u00A0');
  metaPara.editAsText().setBold(true).setFontSize(8).setForegroundColor('#A8C6DF').setFontFamily('Roboto Condensed');

  var space = cell.appendParagraph('\u00A0');
  space.setSpacingAfter(210);

  var statTable = cell.appendTable([stats.map(function() { return '\u00A0'; })]);
  statTable.setBorderWidth(0);
  stats.forEach(function(stat, index) {
    var statCell = statTable.getCell(0, index);
    statCell.setBackgroundColor('#FFFFFF');
    statCell.setPaddingTop(10).setPaddingBottom(10).setPaddingLeft(10).setPaddingRight(10);
    var value = statCell.getChild(0).asParagraph();
    value.setText(String(stat.value));
    value.editAsText().setBold(true).setFontSize(17).setForegroundColor(HQSD_NAVY).setFontFamily('Roboto Condensed');
    var label = statCell.appendParagraph(stat.label);
    label.editAsText().setFontSize(7).setForegroundColor(HQSD_INK_MUTED).setFontFamily('Roboto Condensed');
  });

  var accentCell = cover.getCell(1, 0);
  accentCell.setBackgroundColor(HQSD_STATUS_GOOD);
  accentCell.setPaddingTop(2).setPaddingBottom(2).setPaddingLeft(0).setPaddingRight(0);
  accentCell.getChild(0).asParagraph().setText('\u00A0');
  body.appendPageBreak();
  return cover;
}

function appendHQSDPageTitle(body, title, subtitle) {
  var titlePara = body.appendParagraph(title);
  titlePara.setSpacingAfter(3);
  titlePara.editAsText().setBold(true).setFontSize(22).setForegroundColor(HQSD_NAVY).setFontFamily('Roboto Condensed');
  if (subtitle) {
    var subtitlePara = body.appendParagraph(subtitle);
    subtitlePara.setSpacingAfter(12);
    subtitlePara.editAsText().setFontSize(9).setForegroundColor(HQSD_INK_MUTED).setFontFamily('Roboto Condensed');
  }
  return titlePara;
}

// Formal title block: white space, restrained type, and one narrow rule.
function appendDocBanner(body, title, subtitle, metaLine) {
  var table = body.appendTable([['\u00A0'], ['\u00A0']]);
  table.setBorderWidth(0);
  var cell = table.getCell(0, 0);
  cell.setBackgroundColor('#FFFFFF');
  cell.setPaddingTop(8).setPaddingBottom(16).setPaddingLeft(0).setPaddingRight(0);

  var eyebrowPara = cell.getChild(0).asParagraph();
  eyebrowPara.setText('HIGH-QUALITY STUDENT DATA');
  eyebrowPara.setSpacingAfter(8);
  eyebrowPara.editAsText().setBold(true).setFontSize(8).setForegroundColor(HQSD_ACCENT);

  var titlePara = cell.appendParagraph(title);
  titlePara.setSpacingAfter(4);
  titlePara.setText(title);
  titlePara.editAsText().setBold(true).setFontSize(24).setForegroundColor(HQSD_NAVY);

  if (subtitle) {
    var subPara = cell.appendParagraph(subtitle);
    subPara.setSpacingBefore(2);
    subPara.editAsText().setFontSize(12).setForegroundColor(HQSD_INK_SECONDARY);
  }
  if (metaLine) {
    var metaPara = cell.appendParagraph(metaLine);
    metaPara.setSpacingBefore(7);
    metaPara.editAsText().setFontSize(8).setForegroundColor(HQSD_INK_MUTED);
  }
  var accentCell = table.getCell(1, 0);
  accentCell.setBackgroundColor(HQSD_NAVY);
  accentCell.setPaddingTop(1).setPaddingBottom(1).setPaddingLeft(0).setPaddingRight(0);
  accentCell.getChild(0).asParagraph().setText('\u00A0');
  body.appendParagraph('\u00A0').setSpacingAfter(4);
  return table;
}

// Executive-dashboard KPI cards with narrow color caps.
function appendDocStatRow(body, stats) {
  var placeholders = stats.map(function() { return '\u00A0'; });
  var table = body.appendTable([placeholders, placeholders]);
  table.setBorderColor(HQSD_BORDER).setBorderWidth(0.5);
  for (var i = 0; i < stats.length; i++) {
    var cap = table.getCell(0, i);
    cap.setBackgroundColor(HQSD_STAT_COLORS[i % HQSD_STAT_COLORS.length]);
    cap.setPaddingTop(2).setPaddingBottom(2).setPaddingLeft(0).setPaddingRight(0);
    cap.getChild(0).asParagraph().setText('\u00A0');

    var cell = table.getCell(1, i);
    cell.setBackgroundColor('#FFFFFF');
    cell.setPaddingTop(10).setPaddingBottom(11).setPaddingLeft(10).setPaddingRight(10);
    cell.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);

    var valuePara = cell.getChild(0).asParagraph();
    valuePara.setText(String(stats[i].value));
    valuePara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    valuePara.editAsText().setBold(true).setFontSize(19).setForegroundColor(HQSD_NAVY).setFontFamily('Roboto Condensed');

    var labelPara = cell.appendParagraph(stats[i].label);
    labelPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    labelPara.editAsText().setBold(true).setFontSize(7).setForegroundColor(HQSD_INK_MUTED).setFontFamily('Roboto Condensed');
  }
  body.appendParagraph('\u00A0').setSpacingAfter(2);
  return table;
}

function appendDocSectionHeading(body, text, headingLevel) {
  body.appendParagraph('\u00A0').setSpacingBefore(10).setSpacingAfter(0);
  var table = body.appendTable([['\u00A0', text.toUpperCase()]]);
  table.setBorderWidth(0);
  table.setColumnWidth(0, 7);
  var marker = table.getCell(0, 0);
  marker.setBackgroundColor(HQSD_ACCENT);
  marker.setPaddingTop(5).setPaddingBottom(5).setPaddingLeft(0).setPaddingRight(0);
  var textCell = table.getCell(0, 1);
  textCell.setBackgroundColor('#FFFFFF');
  textCell.setPaddingTop(5).setPaddingBottom(5).setPaddingLeft(8).setPaddingRight(0);
  var paragraph = textCell.getChild(0).asParagraph();
  paragraph.editAsText().setBold(true).setFontSize(9).setForegroundColor(HQSD_NAVY).setFontFamily('Roboto Condensed');
  return paragraph;
}

function styleDocTableHeader(table) {
  table.setBorderColor('#FFFFFF').setBorderWidth(0);
  var headerRow = table.getRow(0);
  for (var c = 0; c < headerRow.getNumCells(); c++) {
    var cell = headerRow.getCell(c);
    cell.setBackgroundColor(HQSD_SURFACE);
    cell.setPaddingTop(6).setPaddingBottom(6).setPaddingLeft(6).setPaddingRight(6);
    cell.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
    cell.getChild(0).asParagraph().editAsText().setBold(true).setFontSize(8).setForegroundColor(HQSD_NAVY).setFontFamily('Roboto Condensed');
  }
  for (var r = 1; r < table.getNumRows(); r++) {
    var row = table.getRow(r);
    for (var col = 0; col < row.getNumCells(); col++) {
      var dataCell = row.getCell(col);
      dataCell.setBackgroundColor(r % 2 === 0 ? '#FAFBFC' : '#FFFFFF');
      dataCell.setPaddingTop(6).setPaddingBottom(6).setPaddingLeft(6).setPaddingRight(6);
      dataCell.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
      dataCell.getChild(0).asParagraph().editAsText().setFontSize(9).setForegroundColor(HQSD_INK_SECONDARY);
    }
  }
}

function appendHQSDNarrativeBox(body, label, text, accentColor) {
  var color = accentColor || HQSD_ACCENT;
  var table = body.appendTable([['\u00A0']]);
  table.setBorderWidth(0);
  var cell = table.getCell(0, 0);
  cell.setBackgroundColor(HQSD_SURFACE);
  cell.setPaddingTop(13).setPaddingBottom(13).setPaddingLeft(14).setPaddingRight(14);
  var labelPara = cell.getChild(0).asParagraph();
  labelPara.setText(label);
  labelPara.setSpacingAfter(4);
  labelPara.editAsText().setBold(true).setFontSize(8).setForegroundColor(color).setFontFamily('Roboto Condensed');
  var textPara = cell.appendParagraph(text || 'No narrative available.');
  textPara.editAsText().setFontSize(10).setForegroundColor(HQSD_INK_SECONDARY);
  return table;
}

function appendHQSDReportEntry(body, label, text, labelColor) {
  var heading = body.appendParagraph(label);
  heading.setSpacingBefore(10).setSpacingAfter(2);
  heading.editAsText().setBold(true).setFontSize(10).setForegroundColor(labelColor || HQSD_NAVY);
  var paragraph = body.appendParagraph(text || 'No detail available.');
  paragraph.setSpacingAfter(5);
  paragraph.editAsText().setFontSize(9).setForegroundColor(HQSD_INK_SECONDARY);
  return paragraph;
}

// Exports the finished Doc to a real PDF file in Drive and trashes the
// intermediate editable Doc, so what the teacher actually gets back is a
// frozen, printable artifact rather than a live editable document.
function convertDocToPdfAndCleanup(doc, pdfName) {
  doc.saveAndClose();
  var docId = doc.getId();
  var pdfBlob = DriveApp.getFileById(docId).getAs('application/pdf').setName(pdfName + '.pdf');
  var pdfFile = DriveApp.createFile(pdfBlob);
  DriveApp.getFileById(docId).setTrashed(true);
  return pdfFile;
}

// ------------------------------------------------------------
// Plan Report — generated once, describes what's tracked and why it's HQSD
// ------------------------------------------------------------

// Shortens text to the first sentence (or a hard character cap if no sentence
// break is found early enough) — keeps table cells scannable instead of
// dumping a full paragraph of grading criteria or a course-work description
// into a cell.
function firstSentence(text, maxLen) {
  if (!text) return '';
  var clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  var periodIdx = clean.indexOf('. ');
  var candidate = (periodIdx > 0 && periodIdx < maxLen) ? clean.substring(0, periodIdx + 1) : clean.substring(0, maxLen);
  if (candidate.length < clean.length) candidate = candidate.replace(/[.,;:\s]*$/, '') + '…';
  return candidate;
}

function callClaudeForPlanPurpose(group, itemTitles) {
  var trackingType = inferHQSDTrackingType(group.items, group.planConfig || {});
  var prompt =
    'You are helping a teacher write the "Purpose" section of a formal High-Quality Student Data tracking plan, ' +
    'read by a school administrator as part of teacher evaluation (Ohio OTES 2.0).\n' +
    'Tracking group name: ' + group.name + '\n' +
    'Course: ' + group.courseName + '\n' +
    'Tracking method: ' + (trackingType === 'checkpoints' ? 'one Baseline, optional Midpoint, and one Final checkpoint' : 'a chronological ongoing evidence series') + '\n' +
    'Assignments being tracked: ' + itemTitles.join(', ') + '\n\n' +
    'Write 2-3 sentences explaining what is being monitored and why — the instructional goal behind tracking these ' +
    'specific assignments together. Plain, professional language, no jargon. Return ONLY the paragraph text, no preamble, no markdown.';
  return callClaude(prompt, 300).trim();
}

function generateHQSDPlanReport(groupId) {
  var group = getHQSDGroup(groupId);
  if (!group) throw new Error('Group not found.');

  var studentCount = listAllCourseStudents(group.courseId).length;

  var planConfig = applyDefaultHQSDPlanConfig(group.courseId, group.courseName, group.items, group.planConfig || {});
  var trackingType = planConfig.trackingType;
  var itemDetails = group.items.map(function(item) {
    var cw = Classroom.Courses.CourseWork.get(group.courseId, item.courseworkId);
    var criteriaRow = getGradingCriteria(item.courseworkId);
    return {
      title: item.title,
      assessmentRole: item.assessmentRole || (trackingType === 'checkpoints' ? 'Checkpoint' : 'Ongoing series'),
      description: cw.description ? firstSentence(cw.description, 100) : '—',
      criteria: criteriaRow ? firstSentence(criteriaRow.criteria, 120) : '—',
      rubricEnhanced: !!item.rubricEnhanced,
      rubric: item.rubricEnhanced ? resolveHQSDRubricDefinition(group.courseId, item, cw) : null
    };
  });

  var purpose = callClaudeForPlanPurpose(group, itemDetails.map(function(d) { return d.title; }));

  var doc = DocumentApp.create('The Plan - ' + group.name);
  var body = initializeHQSDDocument(doc, 'The Plan', group);

  var planStats = [
    { value: studentCount, label: 'STUDENTS' },
    { value: group.topics ? group.topics.length : 0, label: 'TOPICS' },
    { value: group.items.length, label: 'TRACKED METRICS' },
    { value: group.items.filter(function(item) { return item.rubricEnhanced; }).length, label: 'RUBRIC-ENHANCED' }
  ];
  appendHQSDCoverPage(body, 'The Plan', group.name + ' — ' + group.courseName,
    'HQSD PLAN  |  ' + new Date().toLocaleDateString(), planStats);
  appendHQSDPageTitle(body, 'Plan Overview',
    'The instructional purpose, evidence set, and success measures for this HQSD plan.');
  appendDocStatRow(body, planStats);

  appendDocSectionHeading(body, 'Purpose');
  appendHQSDNarrativeBox(body, 'Plan Rationale', purpose || 'No purpose summary available.', HQSD_ACCENT);

  appendDocSectionHeading(body, 'HQSD Verification');
  var verificationRows = [
    ['Verification criterion', 'Plan evidence'],
    ['Tracking design', trackingType === 'checkpoints'
      ? 'Checkpoint comparison: one Baseline, an optional Midpoint, and one Final assignment.'
      : 'Ongoing evidence series: multiple comparable assignments analyzed chronologically.'],
    ['Standards alignment', planConfig.standards || 'Teacher entry needed'],
    ['Measures what is intended', planConfig.measurePurpose || 'Teacher entry needed'],
    ['Teacher / course attribution', planConfig.teacherAttribution || group.courseName],
    ['Evidence of achievement and/or growth', 'Tracked assignment results, submission history, and structured rubric criterion scores where included.'],
    ['Administration and scoring protocol', planConfig.protocol || 'Teacher entry needed'],
    ['Trustworthy results / bias safeguards', planConfig.trustworthiness || 'Teacher entry needed'],
    ['Value-added data', planConfig.valueAdded || 'Not available']
  ];
  var verificationTable = body.appendTable(verificationRows);
  styleDocTableHeader(verificationTable);

  appendDocSectionHeading(body, 'Tracked Assignments');
  if (group.topics && group.topics.length) {
    body.appendParagraph('Topics: ' + group.topics.map(function(topic) { return topic.name; }).join(', '))
      .setSpacingAfter(8).editAsText().setItalic(true).setForegroundColor(HQSD_INK_SECONDARY);
  }
  var rows = [['Assignment', trackingType === 'checkpoints' ? 'Checkpoint' : 'Series', 'Description', 'Grading Criteria']];
  itemDetails.forEach(function(d) { rows.push([d.title, d.assessmentRole, d.description, d.criteria]); });
  var table = body.appendTable(rows);
  styleDocTableHeader(table);

  appendDocSectionHeading(body, 'What I’m Looking For');
  var lookingFor = [
    'Completion & missing work — is each student actually turning work in?',
    'Class average per assignment — which specific item is hardest for the class as a whole?',
    'Students at risk — anyone missing half or more of the tracked work, scoring well below the class average, or below proficiency on a rubric criterion.',
    'Rubric growth — which observable project skills are improving across successive projects.',
    'Instructional impact — which teaching adjustments are associated with stronger results on later assignments.'
  ];
  lookingFor.splice(3, 0, trackingType === 'checkpoints'
    ? 'Checkpoint growth — each student’s Baseline performance compared directly with the Final, with the Midpoint shown when included.'
    : 'Growth over time — each student’s first graded assignment in the linked series compared with the latest.');
  lookingFor.forEach(function(line) {
    body.appendListItem(line).setGlyphType(DocumentApp.GlyphType.BULLET).setSpacingAfter(5);
  });

  var rubricDetails = itemDetails.filter(function(detail) { return detail.rubricEnhanced; });
  if (rubricDetails.length) {
    body.appendPageBreak();
    appendHQSDPageTitle(body, 'Rubric-Enhanced Measures',
      'Blank scoring instruments established in advance for consistent project evaluation.');
    rubricDetails.forEach(function(detail) {
      appendDocSectionHeading(body, detail.title);
      if (!detail.rubric || !detail.rubric.criteria || !detail.rubric.criteria.length) {
        appendHQSDNarrativeBox(body, 'Rubric Source Needed',
          'This assignment is marked rubric-enhanced, but a structured rubric could not be read from its attached Google Doc.', HQSD_STATUS_ALERT);
        return;
      }
      if (detail.rubric.safetyGate) {
        appendHQSDNarrativeBox(body, 'Safety Requirement', detail.rubric.safetyGate, HQSD_ACCENT);
      }
      var rubricRows = [['Criterion', '1 • Beginning', '2 • Developing', '3 • Proficient', '4 • Mastery']];
      detail.rubric.criteria.forEach(function(row) {
        rubricRows.push([
          row.criterion || 'Criterion', row.beginning || '—', row.developing || '—',
          row.proficient || '—', row.mastery || '—'
        ]);
      });
      var rubricTable = body.appendTable(rubricRows);
      styleDocTableHeader(rubricTable);
      for (var rr = 1; rr < rubricTable.getNumRows(); rr++) {
        for (var rc = 0; rc < rubricTable.getRow(rr).getNumCells(); rc++) {
          rubricTable.getRow(rr).getCell(rc).editAsText().setFontSize(7);
        }
      }
      body.appendParagraph('Scoring protocol: Students complete the designated reflection/evidence sections. The teacher scores each criterion from 1–4 after reviewing the submitted document and physical project. Criterion scores are retained for HQSD analysis.')
        .setSpacingBefore(7).setSpacingAfter(12).editAsText().setFontSize(9).setForegroundColor(HQSD_INK_SECONDARY);
    });
  }

  var pdfFile = convertDocToPdfAndCleanup(doc, 'The Plan - ' + group.name);
  return { docUrl: pdfFile.getUrl(), docId: pdfFile.getId() };
}

// ------------------------------------------------------------
// Data Check-In — pulls current scores, computes stats, flags outliers, gets AI findings
// ------------------------------------------------------------

// Flags two distinct kinds of "something looks off": (1) missing most of the tracked
// work — the signal for a student who dropped out, withdrew, or stopped participating,
// which a pure average-based check misses entirely since a student with ZERO grades has
// average === null and would otherwise never be compared against the class average at
// all; and (2) a graded average well below the class average. `students` should already
// have any previously-excluded students filtered out. Threshold constants are deliberately
// simple/adjustable — change MISSING_RATIO_THRESHOLD or the 20-point gap below as needed.
var MISSING_RATIO_THRESHOLD = 0.5;

function computeHQSDOutliers(students, classAverage) {
  var outliers = [];
  var flagged = {};

  students.forEach(function(s) {
    var totalItems = s.itemsGraded + s.itemsMissing;
    var missingRatio = totalItems > 0 ? s.itemsMissing / totalItems : 0;
    if (s.itemsMissing > 0 && missingRatio >= MISSING_RATIO_THRESHOLD) {
      var reason = s.itemsGraded === 0
        ? 'Missing all ' + totalItems + ' tracked assignment(s) — may have dropped, withdrawn, or stopped participating.'
        : 'Missing ' + s.itemsMissing + ' of ' + totalItems + ' tracked assignment(s) (' + Math.round(missingRatio * 100) +
          '%) — check whether they are falling behind or have withdrawn.';
      outliers.push({ userId: s.userId, name: s.name, average: s.average, reason: reason });
      flagged[s.userId] = true;
    }
  });

  if (classAverage !== null) {
    students.forEach(function(s) {
      if (flagged[s.userId] || s.average === null) return;
      if (s.average < classAverage - 20) {
        outliers.push({ userId: s.userId, name: s.name, average: s.average, reason: 'More than 20 points below class average' });
      }
    });
  }

  return outliers;
}

// ------------------------------------------------------------
// Growth & Trends — per-student change from their first graded check-in to
// their most recent one, derived entirely from stored snapshot history (no
// new data collection). Feeds both the in-app "Growth & Trends" view and the
// Year-End Report.
// ------------------------------------------------------------
var GROWTH_TREND_THRESHOLD = 5;   // +/- points to count as "improving"/"declining" vs. "flat"
var EXCELLING_ABOVE_CLASS = 15;   // points above the latest class average to flag as excelling

function computeGrowthAndTrends(history) {
  if (!history || history.length === 0) return { students: [], hasEnoughData: false, checkInCount: 0 };

  var latestClassAvg = history[history.length - 1].stats.classAverage;
  var studentMap = {};

  history.forEach(function(snap, idx) {
    (snap.studentAverages || []).forEach(function(s) {
      if (!studentMap[s.userId]) {
        studentMap[s.userId] = { userId: s.userId, name: s.name, firstAvg: null, firstIndex: null, latestAvg: null, latestIndex: null, latestMissing: 0 };
      }
      var entry = studentMap[s.userId];
      entry.name = s.name;
      if (s.average !== null) {
        if (entry.firstAvg === null) { entry.firstAvg = s.average; entry.firstIndex = idx; }
        entry.latestAvg = s.average;
        entry.latestIndex = idx;
      }
      entry.latestMissing = s.itemsMissing;
    });
  });

  var students = Object.keys(studentMap).map(function(userId) {
    var e = studentMap[userId];
    var growth = (e.firstAvg !== null && e.latestAvg !== null && e.firstIndex !== e.latestIndex)
      ? e.latestAvg - e.firstAvg : null;
    var trend = growth === null ? 'insufficient data'
      : growth > GROWTH_TREND_THRESHOLD ? 'improving'
      : growth < -GROWTH_TREND_THRESHOLD ? 'declining'
      : 'flat';
    var excelling = e.latestAvg !== null && e.latestMissing === 0 &&
      (e.latestAvg >= 90 || (latestClassAvg !== null && e.latestAvg >= latestClassAvg + EXCELLING_ABOVE_CLASS));
    return {
      userId: userId, name: e.name, firstAvg: e.firstAvg, latestAvg: e.latestAvg,
      growth: growth, trend: trend, excelling: excelling
    };
  });

  return { students: students, hasEnoughData: history.length >= 2, checkInCount: history.length };
}

// Explains who's improving/declining and where to focus — only called when
// there's actually something notable to say, so a group with no declining
// or excelling students doesn't pay for a Claude call with nothing to report.
function callClaudeForGrowthRecommendations(students) {
  var declining = students.filter(function(s) { return s.trend === 'declining'; });
  var excelling = students.filter(function(s) { return s.excelling; });
  if (declining.length === 0 && excelling.length === 0) return '';

  var prompt =
    'You are an instructional coach reviewing student growth trends across multiple data check-ins.\n\n' +
    'DECLINING (first check-in average → latest average):\n' +
    (declining.length ? declining.map(function(s) { return '- ' + s.name + ': ' + s.firstAvg + '% → ' + s.latestAvg + '% (' + s.growth + ' pts)'; }).join('\n') : 'None') + '\n\n' +
    'EXCELLING:\n' +
    (excelling.length ? excelling.map(function(s) { return '- ' + s.name + ': ' + s.latestAvg + '%'; }).join('\n') : 'None') + '\n\n' +
    'Write 2-4 sentences: who most needs attention and why, one concrete thing to try next for the declining group, and (only if ' +
    'genuinely useful) whether the excelling group suggests anything worth replicating for others. Be specific, not generic.\n' +
    'Return ONLY plain text, no markdown, no preamble.';
  return callClaude(prompt, 500).trim();
}

// Client-facing entry point for the in-app "Growth & Trends" view.
function getHQSDGrowthAndTrends(groupId) {
  var result = computeGrowthAndTrends(getHQSDSnapshotHistory(groupId));
  result.recommendations = result.hasEnoughData ? callClaudeForGrowthRecommendations(result.students) : '';
  return result;
}

function runHQSDSnapshot(groupId, improvementNote) {
  var group = getHQSDGroup(groupId);
  if (!group) throw new Error('Group not found.');

  var studentData = {}; // userId -> { name, scores: {courseworkId: {grade, maxPoints, missing}} }

  group.items.forEach(function(item) {
    var submissions = listAllStudentSubmissions(group.courseId, item.courseworkId);
    submissions.forEach(function(sub) {
      if (!studentData[sub.userId]) {
        var profile = getStudentProfile(sub.userId);
        studentData[sub.userId] = { name: profile.name, scores: {} };
      }
      var hasGrade = sub.assignedGrade !== undefined && sub.assignedGrade !== null;
      studentData[sub.userId].scores[item.courseworkId] = {
        grade: hasGrade ? sub.assignedGrade : null,
        maxPoints: item.maxPoints,
        missing: sub.state !== 'TURNED_IN' && sub.state !== 'RETURNED'
      };
    });
  });

  var studentAverages = [];
  Object.keys(studentData).forEach(function(userId) {
    var s = studentData[userId];
    var pctSum = 0, count = 0, missingCount = 0;
    group.items.forEach(function(item) {
      var sc = s.scores[item.courseworkId];
      if (sc && sc.grade !== null) {
        pctSum += (sc.grade / sc.maxPoints) * 100;
        count++;
      } else {
        missingCount++;
      }
    });
    studentAverages.push({
      userId: userId, name: s.name,
      average: count > 0 ? Math.round(pctSum / count) : null,
      itemsGraded: count, itemsMissing: missingCount
    });
  });

  var gradedAverages = studentAverages.filter(function(s) { return s.average !== null; });
  var classAverage = gradedAverages.length > 0
    ? Math.round(gradedAverages.reduce(function(sum, s) { return sum + s.average; }, 0) / gradedAverages.length)
    : null;

  var outliers = computeHQSDOutliers(studentAverages, classAverage);

  var priorSnapshot = getLatestHQSDSnapshot(groupId);
  var result = callClaudeForHQSDFindings(group, studentAverages, classAverage, outliers, improvementNote, priorSnapshot);

  var snapshotId = Utilities.getUuid();
  var snapshotSheet = getOrCreateHQSDSnapshotsSheet();
  snapshotSheet.appendRow([
    snapshotId, groupId, new Date(), improvementNote,
    JSON.stringify(studentAverages), JSON.stringify({ classAverage: classAverage, outliers: outliers }),
    result.findings, JSON.stringify([]), result.recommendations
  ]);

  return {
    snapshotId: snapshotId, classAverage: classAverage, outliers: outliers,
    findings: result.findings, recommendations: result.recommendations, studentAverages: studentAverages
  };
}

function getLatestHQSDSnapshot(groupId) {
  var sheet = getOrCreateHQSDSnapshotsSheet();
  var data = sheet.getDataRange().getValues();
  var latest = null;
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === groupId) {
      latest = {
        snapshotId: data[i][0], timestamp: data[i][2], improvementNote: data[i][3],
        studentAverages: JSON.parse(data[i][4] || '[]'), stats: JSON.parse(data[i][5] || '{}'),
        findings: data[i][6], recommendations: data[i][8] || ''
      };
    }
  }
  return latest;
}

function getHQSDSnapshotHistory(groupId) {
  var sheet = getOrCreateHQSDSnapshotsSheet();
  var data = sheet.getDataRange().getValues();
  var results = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === groupId) {
      results.push({
        snapshotId: data[i][0], timestamp: data[i][2], improvementNote: data[i][3],
        studentAverages: JSON.parse(data[i][4] || '[]'), stats: JSON.parse(data[i][5] || '{}'),
        findings: data[i][6], excluded: JSON.parse(data[i][7] || '[]'), recommendations: data[i][8] || ''
      });
    }
  }
  return results.sort(function(a, b) {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });
}

// Every exported report carries the same dated narrative history. This keeps
// the evidence trail with the report instead of requiring a separate date-range
// export or a separate growth document.
function appendHQSDHistorySection(body, groupId) {
  var history = getHQSDSnapshotHistory(groupId);
  appendDocSectionHeading(body, 'Check-In History (' + history.length + ')');

  if (history.length === 0) {
    body.appendParagraph('No data check-ins have been recorded yet. Run a check-in to begin this domain’s history.')
      .setSpacingAfter(8);
    return history;
  }

  history.forEach(function(snapshot, index) {
    var timestamp = new Date(snapshot.timestamp);
    var dateLabel = isNaN(timestamp.getTime())
      ? String(snapshot.timestamp)
      : Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'MMM d, yyyy h:mm a');
    var classAverage = snapshot.stats && snapshot.stats.classAverage !== null && snapshot.stats.classAverage !== undefined
      ? snapshot.stats.classAverage + '%' : 'not enough graded data';

    var details = [];
    if (snapshot.improvementNote) details.push('Instructional change: ' + snapshot.improvementNote);
    if (snapshot.findings) details.push('Findings: ' + snapshot.findings);
    if (snapshot.recommendations) details.push('Next steps: ' + snapshot.recommendations);
    var numericAverage = snapshot.stats ? snapshot.stats.classAverage : null;
    var accent = numericAverage === null || numericAverage === undefined ? HQSD_INK_MUTED
      : numericAverage >= 80 ? HQSD_STATUS_GOOD
      : numericAverage >= 65 ? HQSD_STAT_COLORS[3] : HQSD_STATUS_ALERT;
    appendHQSDNarrativeBox(body,
      'Check-In ' + (index + 1) + ' · ' + dateLabel + ' · Class average: ' + classAverage,
      details.join('\n') || 'No narrative was recorded for this check-in.', accent);
    body.appendParagraph('\u00A0').setSpacingAfter(0);
  });
  return history;
}

// Returns {findings, recommendations} \u2014 findings is "what the data shows"
// (including a comparison against the prior check-in), recommendations is
// the distinct "what to do next" layer, consistent with every other report.
function callClaudeForHQSDFindings(group, studentAverages, classAverage, outliers, improvementNote, priorSnapshot) {
  var prompt =
    'You are helping a teacher analyze High-Quality Student Data (HQSD) for Ohio\u2019s OTES 2.0 teacher evaluation.\n' +
    'Tracking group: ' + group.name + ' (' + group.courseName + ')\n' +
    'Class average this run: ' + (classAverage !== null ? classAverage + '%' : 'not enough graded data yet') + '\n' +
    'Number of students: ' + studentAverages.length + '\n' +
    'Flagged outliers (well below class average): ' + JSON.stringify(outliers) + '\n' +
    (improvementNote ? 'The teacher reports making this change since the last check: ' + improvementNote + '\n' : 'This is the first data check for this group.\n') +
    (priorSnapshot ? 'Previous class average was ' + (priorSnapshot.stats.classAverage !== null ? priorSnapshot.stats.classAverage + '%' : 'unavailable') + ', recorded on ' + priorSnapshot.timestamp + '.\n' : '') +
    'Write two things: (1) "findings" \u2014 3-5 sentences on what the data shows and, if there is a prior check-in, whether the teacher\u2019s ' +
    'change (if any) seems to be working; (2) "recommendations" \u2014 1-2 concrete next steps, distinct from the findings, comparing this ' +
    'check-in to the previous one where relevant.\n' +
    'Return ONLY valid JSON (no markdown fences, no commentary) matching this schema:\n' +
    '{"findings": "string", "recommendations": "string"}';
  var raw = stripJsonFences(callClaude(prompt, 1100));
  try {
    var parsed = JSON.parse(raw);
    return { findings: parsed.findings || '', recommendations: parsed.recommendations || '' };
  } catch (e) {
    return { findings: raw, recommendations: '' };
  }
}

// ------------------------------------------------------------
// Outlier exclusion / footnotes
// ------------------------------------------------------------
function setHQSDExclusion(snapshotId, userId, studentName, excluded, reason) {
  var sheet = getOrCreateHQSDSnapshotsSheet();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === snapshotId) {
      var excludedList = JSON.parse(data[i][7] || '[]');
      excludedList = excludedList.filter(function(e) { return e.userId !== userId; });
      excludedList.push({ userId: userId, name: studentName, excluded: excluded, reason: reason });
      sheet.getRange(i + 1, 8).setValue(JSON.stringify(excludedList));
      return recomputeHQSDSnapshotStats(snapshotId);
    }
  }
  throw new Error('Snapshot not found.');
}

function recomputeHQSDSnapshotStats(snapshotId) {
  var sheet = getOrCreateHQSDSnapshotsSheet();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === snapshotId) {
      var studentAverages = JSON.parse(data[i][4] || '[]');
      var excludedList = JSON.parse(data[i][7] || '[]');
      var excludedIds = excludedList.filter(function(e) { return e.excluded; }).map(function(e) { return e.userId; });
      var nonExcluded = studentAverages.filter(function(s) { return excludedIds.indexOf(s.userId) === -1; });
      var graded = nonExcluded.filter(function(s) { return s.average !== null; });
      var classAverage = graded.length > 0
        ? Math.round(graded.reduce(function(sum, s) { return sum + s.average; }, 0) / graded.length)
        : null;
      var outliers = computeHQSDOutliers(nonExcluded, classAverage);
      sheet.getRange(i + 1, 6).setValue(JSON.stringify({ classAverage: classAverage, outliers: outliers }));
      return { classAverage: classAverage, outliers: outliers };
    }
  }
  throw new Error('Snapshot not found.');
}

// Standard note surfaced anywhere a student gets flagged (at-risk or
// declining) — this tool only sees Classroom data, so it can't know about
// attendance, IEP/504 accommodations, life events, etc. Flagging is a
// starting point for a conversation, not a diagnosis.
var HQSD_CONTEXT_NOTE = 'This is based on Classroom data alone. Before drawing conclusions, consider checking context this tool ' +
  'doesn’t have access to — attendance, IEP/504 accommodations, recent life changes, or engagement in other classes.';

function getHQSDAssignmentTimestamp(courseWork) {
  if (courseWork.dueDate) {
    return new Date(courseWork.dueDate.year, courseWork.dueDate.month - 1, courseWork.dueDate.day).getTime();
  }
  return courseWork.creationTime ? new Date(courseWork.creationTime).getTime() : 0;
}

function computeGrowthFromAssignments(studentData, assignmentCount, latestClassAverage, trackingType) {
  var students = Object.keys(studentData).map(function(userId) {
    var source = studentData[userId];
    var scores = source.scores.slice().sort(function(a, b) { return a.timestamp - b.timestamp; });
    var firstScore = scores.length ? scores[0] : null;
    var latestScore = scores.length ? scores[scores.length - 1] : null;
    if (trackingType === 'checkpoints') {
      firstScore = scores.filter(function(score) { return score.role === 'Baseline'; })[0] || null;
      latestScore = scores.filter(function(score) { return score.role === 'Final'; })[0] || null;
    }
    var firstAvg = firstScore ? Math.round(firstScore.average) : null;
    var latestAvg = latestScore ? Math.round(latestScore.average) : null;
    var growth = scores.length >= 2 ? latestAvg - firstAvg : null;
    if (firstAvg === null || latestAvg === null) growth = null;
    var trend = growth === null ? 'insufficient data'
      : growth > GROWTH_TREND_THRESHOLD ? 'improving'
      : growth < -GROWTH_TREND_THRESHOLD ? 'declining' : 'flat';
    var excelling = latestAvg !== null && source.missingCount === 0 &&
      (latestAvg >= 90 || (latestClassAverage !== null && latestAvg >= latestClassAverage + EXCELLING_ABOVE_CLASS));
    return {
      userId: userId, name: source.name, firstAvg: firstAvg, latestAvg: latestAvg,
      growth: growth, trend: trend, excelling: excelling
    };
  });
  return {
    students: students,
    hasEnoughData: assignmentCount >= 2 && students.some(function(student) { return student.growth !== null; }),
    assignmentCount: assignmentCount,
    trackingType: trackingType,
    firstLabel: trackingType === 'checkpoints' ? 'Baseline' : 'First',
    latestLabel: trackingType === 'checkpoints' ? 'Final' : 'Latest'
  };
}


// ------------------------------------------------------------
// Evaluation of the Plan — one document covering every tracked assignment,
// assignment-based growth, flagged students, and targeted next steps.
// Submissions are fetched once per tracked item (not once per student),
// It scales with the number of assignments, not the number of students.
// ------------------------------------------------------------
function generateHQSDEvaluationReport(groupId, teacherReflection) {
  var group = getHQSDGroup(groupId);
  if (!group) throw new Error('HQSD domain not found.');
  var trackingType = inferHQSDTrackingType(group.items, group.planConfig || {});
  var reflectionLog = String((group.planConfig || {}).reflectionLog || '');
  // Preserve older callers long enough for an already-open portal tab to finish safely.
  if (!reflectionLog && teacherReflection) {
    if (typeof teacherReflection === 'string') {
      reflectionLog = teacherReflection;
    } else {
      reflectionLog = [
        teacherReflection.studentNeeds,
        teacherReflection.instructionalChanges,
        teacherReflection.nextSteps
      ].filter(function(entry) { return String(entry || '').trim(); }).join('\n\n');
    }
  }

  var studentData = {}; // userId -> current totals plus chronological assignment scores
  var perItemStats = [];
  var rubricMetricMap = {};
  var rubricUnavailable = [];
  var submissionUnavailable = [];
  group.items.forEach(function(item) {
    var courseWork = Classroom.Courses.CourseWork.get(group.courseId, item.courseworkId);
    var assignmentTimestamp = getHQSDAssignmentTimestamp(courseWork);
    var submissionResult = getHQSDSubmissionsForReport(group.courseId, courseWork);
    var submissions = submissionResult.submissions;
    var submissionStatus = submissionResult.status;
    if (submissionStatus) {
      submissionUnavailable.push({ title: item.title, reason: submissionStatus });
    }
    var rubricDefinition = item.rubricEnhanced
      ? resolveHQSDRubricDefinition(group.courseId, item, courseWork)
      : null;
    if (item.rubricEnhanced && (!rubricDefinition || !rubricDefinition.criteria || !rubricDefinition.criteria.length)) {
      rubricUnavailable.push(item.title);
    }
    if (rubricDefinition && rubricDefinition.criteria) {
      rubricDefinition.criteria.forEach(function(criterion) {
        var key = normalizeRubricCriterionName(criterion.criterion).toLowerCase();
        if (!key) return;
        if (!rubricMetricMap[key]) {
          rubricMetricMap[key] = {
            criterion: normalizeRubricCriterionName(criterion.criterion),
            assignments: {}, sum: 0, count: 0, proficientCount: 0, observations: {}
          };
        }
        rubricMetricMap[key].assignments[item.title] = true;
      });
    }
    var itemSum = 0, itemGraded = 0, itemMissing = 0;
    submissions.forEach(function(sub) {
      if (!studentData[sub.userId]) {
        var profile = getStudentProfile(sub.userId);
        studentData[sub.userId] = { name: profile.name, sum: 0, gradedCount: 0, missingCount: 0, lateCount: 0, scores: [] };
      }
      var s = studentData[sub.userId];
      var hasGrade = sub.assignedGrade !== undefined && sub.assignedGrade !== null;
      if (hasGrade) {
        var percentage = (sub.assignedGrade / item.maxPoints) * 100;
        s.sum += percentage;
        s.gradedCount++;
        s.scores.push({ timestamp: assignmentTimestamp, average: percentage, role: item.assessmentRole || 'Ongoing evidence' });
        itemSum += percentage;
        itemGraded++;
      } else if (sub.state !== 'TURNED_IN' && sub.state !== 'RETURNED') {
        s.missingCount++;
        itemMissing++;
      }
      if (sub.late) s.lateCount++;

      if (rubricDefinition && rubricDefinition.criteria) {
        var rubricScores = extractRubricScoresFromSubmission(sub);
        rubricDefinition.criteria.forEach(function(criterion) {
          var key = normalizeRubricCriterionName(criterion.criterion).toLowerCase();
          var score = rubricScores[key];
          if (!rubricMetricMap[key] || score === undefined || score === null) return;
          var metric = rubricMetricMap[key];
          metric.sum += score;
          metric.count++;
          if (score >= 3) metric.proficientCount++;
          if (!metric.observations[sub.userId]) metric.observations[sub.userId] = [];
          metric.observations[sub.userId].push({
            timestamp: assignmentTimestamp, score: score, role: item.assessmentRole || 'Ongoing evidence'
          });
        });
      }
    });
    perItemStats.push({
      title: item.title,
      topicName: item.topicName || '',
      assessmentRole: item.assessmentRole || 'Ongoing evidence',
      timestamp: assignmentTimestamp,
      average: itemGraded > 0 ? Math.round(itemSum / itemGraded) : null,
      gradedCount: itemGraded,
      missingCount: itemMissing,
      totalStudents: submissions.length,
      dataAvailable: !submissionStatus,
      dataStatus: submissionStatus
    });
  });
  perItemStats.sort(function(a, b) {
    if (trackingType === 'checkpoints') {
      var order = { Baseline: 0, Midpoint: 1, Final: 2 };
      return order[a.assessmentRole] - order[b.assessmentRole];
    }
    return a.timestamp - b.timestamp;
  });

  var students = Object.keys(studentData).map(function(userId) {
    var s = studentData[userId];
    return {
      userId: userId, name: s.name,
      average: s.gradedCount > 0 ? Math.round(s.sum / s.gradedCount) : null,
      gradedCount: s.gradedCount, missingCount: s.missingCount, lateCount: s.lateCount
    };
  }).sort(function(a, b) { return a.name.localeCompare(b.name); });

  var gradedStudents = students.filter(function(s) { return s.average !== null; });
  var classAverage = gradedStudents.length
    ? Math.round(gradedStudents.reduce(function(sum, s) { return sum + s.average; }, 0) / gradedStudents.length) : null;

  // Reuse the same at-risk rule used everywhere else in HQSD, fed with the shape it expects.
  var outlierInput = students.map(function(s) {
    return { userId: s.userId, name: s.name, average: s.average, itemsGraded: s.gradedCount, itemsMissing: s.missingCount };
  });
  var outliers = computeHQSDOutliers(outlierInput, classAverage);
  var flagMap = {};
  outliers.forEach(function(o) { flagMap[o.userId] = o.reason; });

  var rubricMetrics = Object.keys(rubricMetricMap).map(function(key) {
    var metric = rubricMetricMap[key];
    var studentAverages = [];
    var changes = [];
    Object.keys(metric.observations).forEach(function(userId) {
      var observations = metric.observations[userId].sort(function(a, b) { return a.timestamp - b.timestamp; });
      var average = observations.reduce(function(sum, observation) { return sum + observation.score; }, 0) / observations.length;
      studentAverages.push({ userId: userId, average: average });
      if (trackingType === 'checkpoints') {
        var baselineObservation = observations.filter(function(observation) { return observation.role === 'Baseline'; })[0];
        var finalObservation = observations.filter(function(observation) { return observation.role === 'Final'; })[0];
        if (baselineObservation && finalObservation) changes.push(finalObservation.score - baselineObservation.score);
      } else if (observations.length >= 2) {
        changes.push(observations[observations.length - 1].score - observations[0].score);
      }
    });
    var average = metric.count ? Math.round((metric.sum / metric.count) * 10) / 10 : null;
    var growth = changes.length
      ? Math.round((changes.reduce(function(sum, value) { return sum + value; }, 0) / changes.length) * 10) / 10
      : null;
    var recommendation = average === null
      ? 'Enter teacher scores in the submitted rubric’s Teacher score / comments column.'
      : average < 2.5
        ? 'Reteach this skill with a teacher model, guided practice, and a focused revision check before the next project.'
        : average < 3.25
          ? 'Use targeted feedback and a short practice task to move developing work toward consistent proficiency.'
          : 'Maintain the current approach and add an extension challenge for students already demonstrating mastery.';
    return {
      criterion: metric.criterion,
      assignments: Object.keys(metric.assignments),
      average: average,
      proficientRate: metric.count ? Math.round((metric.proficientCount / metric.count) * 100) : null,
      growth: growth,
      scoredCount: metric.count,
      studentAverages: studentAverages,
      recommendation: recommendation
    };
  }).sort(function(a, b) { return a.criterion.localeCompare(b.criterion); });

  var rubricFlagsByStudent = {};
  rubricMetrics.forEach(function(metric) {
    metric.studentAverages.forEach(function(result) {
      if (result.average >= 2.5) return;
      if (!rubricFlagsByStudent[result.userId]) rubricFlagsByStudent[result.userId] = [];
      rubricFlagsByStudent[result.userId].push(metric.criterion + ' (' + (Math.round(result.average * 10) / 10) + '/4)');
      if (!flagMap[result.userId]) flagMap[result.userId] = 'Below proficiency on rubric criteria';
    });
  });

  // Checkpoint domains compare the designated Baseline and Final. Ongoing
  // domains use the first and latest graded assignments in the linked series.
  var growth = computeGrowthFromAssignments(studentData, perItemStats.length, classAverage, trackingType);
  var growthMap = {};
  growth.students.forEach(function(g) { growthMap[g.userId] = g; });

  var totalGraded = perItemStats.reduce(function(sum, item) { return sum + item.gradedCount; }, 0);
  var totalPossible = perItemStats.reduce(function(sum, item) { return sum + item.totalStudents; }, 0);
  var completionRate = totalPossible > 0 ? Math.round((totalGraded / totalPossible) * 100) : null;
  var evaluation = totalGraded > 0
    ? callClaudeForEvaluationRecommendations(group, perItemStats, growth, outliers, rubricMetrics)
    : {
        summary: submissionUnavailable.length
          ? 'The plan is established, but Classroom submission data is not yet available for one or more tracked assignments. Publish the assignments and collect or grade student work before drawing conclusions about achievement or growth.'
          : 'The plan is established, but no graded student evidence is available yet. Generate this Evaluation again after student work has been scored.',
        metrics: []
      };
  var flaggedStudentIds = {};
  outliers.forEach(function(item) { flaggedStudentIds[item.userId] = true; });
  Object.keys(rubricFlagsByStudent).forEach(function(userId) { flaggedStudentIds[userId] = true; });

  var doc = DocumentApp.create('Evaluation of the Plan - ' + group.name);
  var body = initializeHQSDDocument(doc, 'Evaluation of the Plan', group);

  var evaluationStats = [
    { value: perItemStats.length, label: 'Tracked Metrics' },
    { value: classAverage !== null ? classAverage + '%' : '—', label: 'Class Average' },
    { value: completionRate !== null ? completionRate + '%' : '—', label: 'Completion' },
    { value: Object.keys(flaggedStudentIds).length, label: 'Flagged' }
  ];
  appendHQSDCoverPage(body, 'Evaluation of the Plan', group.name + ' — ' + group.courseName,
    'RESULTS REPORT  |  ' + new Date().toLocaleDateString(), evaluationStats);
  appendHQSDPageTitle(body, 'Executive Overview',
    'A concise view of performance, student growth, completion, and instructional priorities.');
  appendDocStatRow(body, evaluationStats);

  if (submissionUnavailable.length) {
    appendDocSectionHeading(body, 'Data Availability');
    submissionUnavailable.forEach(function(entry) {
      appendHQSDNarrativeBox(body, entry.title, entry.reason, HQSD_STATUS_ALERT);
    });
  }

  appendDocSectionHeading(body, 'Reflections and Actions Taken Log');
  var reflectionParagraph = body.appendParagraph(
    reflectionLog.trim() || 'No reflection or action entries have been recorded for this HQSD Domain.'
  );
  reflectionParagraph.setSpacingAfter(12);
  reflectionParagraph.editAsText()
    .setFontFamily('Arial')
    .setFontSize(10)
    .setForegroundColor(HQSD_INK_SECONDARY);

  appendDocSectionHeading(body, 'Overall Evaluation');
  var assessment = classAverage === null
    ? 'AWAITING DATA'
    : classAverage >= 80 && completionRate !== null && completionRate >= 85
      ? 'STRONG PERFORMANCE'
      : classAverage >= 70 && completionRate !== null && completionRate >= 75
        ? 'ON TRACK' : 'PRIORITY ACTION NEEDED';
  appendHQSDNarrativeBox(body, 'Overall Plan Assessment — ' + assessment,
    evaluation.summary || 'The available data is summarized below.', HQSD_ACCENT);

  appendDocSectionHeading(body, trackingType === 'checkpoints'
    ? 'Performance Across Checkpoints' : 'Performance Across the Ongoing Series');
  var metricRows = [['Evidence Point', 'Tracked Assignment', 'Topic', 'Average', 'Change', 'Missing']];
  var priorMetricAverage = null;
  perItemStats.forEach(function(item, itemIndex) {
    var dateLabel = item.timestamp
      ? Utilities.formatDate(new Date(item.timestamp), Session.getScriptTimeZone(), 'MMM d, yyyy') : '—';
    var change = item.average !== null && priorMetricAverage !== null
      ? item.average - priorMetricAverage : null;
    metricRows.push([
      trackingType === 'checkpoints' ? item.assessmentRole + ' · ' + dateLabel : 'Series ' + (itemIndex + 1) + ' · ' + dateLabel,
      item.title, item.topicName || '—', item.average !== null ? item.average + '%' : '—',
      change !== null ? (change >= 0 ? '+' : '') + change + ' pts' : '—',
      item.dataAvailable ? String(item.missingCount) : '—'
    ]);
    if (item.average !== null) priorMetricAverage = item.average;
  });
  var metricTable = body.appendTable(metricRows);
  styleDocTableHeader(metricTable);

  if (rubricMetrics.length || rubricUnavailable.length) {
    appendDocSectionHeading(body, 'Rubric Criterion Results');
    if (!rubricMetrics.length) {
      body.appendParagraph('Rubric-enhanced assignments are included in this plan, but no structured rubric could be read yet.').setSpacingAfter(8);
    } else {
      var rubricResultRows = [['Criterion', 'Projects', 'Average', 'Proficient+', 'Growth', 'Scores']];
      rubricMetrics.forEach(function(metric) {
        rubricResultRows.push([
          metric.criterion,
          metric.assignments.join(', '),
          metric.average !== null ? metric.average + ' / 4' : 'Awaiting scores',
          metric.proficientRate !== null ? metric.proficientRate + '%' : '—',
          metric.growth !== null ? (metric.growth >= 0 ? '+' : '') + metric.growth : '—',
          String(metric.scoredCount)
        ]);
      });
      var rubricResultTable = body.appendTable(rubricResultRows);
      styleDocTableHeader(rubricResultTable);
      rubricMetrics.forEach(function(metric) {
        appendHQSDReportEntry(body, metric.criterion,
          'Recommended action: ' + metric.recommendation,
          metric.average !== null && metric.average < 2.5 ? HQSD_STATUS_ALERT : HQSD_ACCENT);
      });
    }
    if (rubricUnavailable.length) {
      appendHQSDNarrativeBox(body, 'Rubrics Needing a Readable Template',
        rubricUnavailable.join(', ') + '. Attach a Google Doc containing a rubric table with a Criterion column and performance-level columns.', HQSD_STATUS_ALERT);
    }
  }

  appendDocSectionHeading(body, trackingType === 'checkpoints'
    ? 'Baseline-to-Final Student Growth' : 'Student Growth Across the Ongoing Series');
  if (growth.hasEnoughData) {
    var improvingCount = growth.students.filter(function(s) { return s.trend === 'improving'; }).length;
    var decliningCount = growth.students.filter(function(s) { return s.trend === 'declining'; }).length;
    var flatCount = growth.students.filter(function(s) { return s.trend === 'flat'; }).length;
    body.appendParagraph((trackingType === 'checkpoints' ? 'From Baseline to Final' : 'Across ' + growth.assignmentCount + ' linked assignments') +
      ': ' + improvingCount + ' improving, ' +
      flatCount + ' flat, and ' + decliningCount + ' declining.').setSpacingAfter(8);
  } else {
    body.appendParagraph(trackingType === 'checkpoints'
      ? 'Both the Baseline and Final must be graded to calculate student growth.'
      : 'At least two graded assignments in the linked series are needed to calculate student growth.').setSpacingAfter(8);
  }

  var rows = [['Student', 'Overall', growth.firstLabel, growth.latestLabel, 'Change', 'Missing', 'Status']];
  students.forEach(function(s) {
    var g = growthMap[s.userId];
    var growthText = g && g.growth !== null ? (g.growth >= 0 ? '+' : '') + g.growth + ' pts' : '—';
    var status = flagMap[s.userId] ? 'Flagged' : 'On track';
    rows.push([
      s.name, s.average !== null ? s.average + '%' : '—',
      g && g.firstAvg !== null ? g.firstAvg + '%' : '—', g && g.latestAvg !== null ? g.latestAvg + '%' : '—',
      growthText, String(s.missingCount), status
    ]);
  });
  var table = body.appendTable(rows);
  styleDocTableHeader(table);

  appendDocSectionHeading(body, 'Students Flagged in This Area');
  if (outliers.length === 0 && Object.keys(rubricFlagsByStudent).length === 0) {
    body.appendParagraph('No students are currently flagged in this HQSD domain.').setSpacingAfter(8);
  } else {
    var actions = callClaudeForStudentRecommendations(group, outliers);
    var actionMap = {};
    actions.forEach(function(a) { actionMap[a.name] = a.action; });

    outliers.forEach(function(o) {
      appendHQSDReportEntry(body, o.name,
        o.reason + '\nRecommended response: ' +
        (actionMap[o.name] || 'Review this student’s recent work and check in directly.'), HQSD_STATUS_ALERT);
    });
    Object.keys(rubricFlagsByStudent).forEach(function(userId) {
      var student = students.filter(function(s) { return String(s.userId) === String(userId); })[0];
      appendHQSDReportEntry(body, student ? student.name : 'Student',
        'Rubric criteria below proficiency: ' + rubricFlagsByStudent[userId].join(', ') +
        '\nRecommended response: Conference with the student, review the scored rubric evidence, and assign focused practice before the next project.',
        HQSD_STATUS_ALERT);
    });
    body.appendParagraph(HQSD_CONTEXT_NOTE).setSpacingBefore(4).setSpacingAfter(6)
      .editAsText().setItalic(true).setFontSize(9).setForegroundColor(HQSD_INK_SECONDARY);
  }

  appendDocSectionHeading(body, 'Recommendations by Tracked Metric');
  if (!evaluation.metrics || evaluation.metrics.length === 0) {
    body.appendParagraph('No metric-specific recommendations are available yet.').setSpacingAfter(8);
  } else {
    evaluation.metrics.forEach(function(metric) {
      appendHQSDReportEntry(body, metric.metric,
        (metric.finding ? metric.finding + '\n' : '') +
        'Recommended action: ' + (metric.recommendation || 'Continue monitoring this metric.'), HQSD_ACCENT);
    });
  }

  var pdfFile = convertDocToPdfAndCleanup(doc, 'Evaluation of the Plan - ' + group.name);
  return { docUrl: pdfFile.getUrl(), docId: pdfFile.getId() };
}

// Compatibility entry point for an older deployed UI. It now produces the
// unified evaluation rather than a separate all-students report.
function generateHQSDAllStudentsReport(groupId) {
  return generateHQSDEvaluationReport(groupId);
}

function callClaudeForEvaluationRecommendations(group, perItemStats, growth, outliers, rubricMetrics) {
  var improving = growth.students.filter(function(s) { return s.trend === 'improving'; }).length;
  var declining = growth.students.filter(function(s) { return s.trend === 'declining'; }).length;
  var flat = growth.students.filter(function(s) { return s.trend === 'flat'; }).length;
  var prompt =
    'You are evaluating a teacher’s High-Quality Student Data plan for Ohio OTES 2.0.\n' +
    'Plan: ' + group.name + ' (' + group.courseName + ')\n\n' +
    'TRACKING METHOD: ' + (growth.trackingType === 'checkpoints'
      ? 'Compare the designated Baseline directly with the Final; use the Midpoint only as an interim checkpoint.'
      : 'Analyze the linked assignments as one chronological ongoing evidence series.') + '\n\n' +
    'TRACKED METRICS (each assignment is a metric within this plan):\n' +
    perItemStats.map(function(item) {
      var dateLabel = item.timestamp
        ? Utilities.formatDate(new Date(item.timestamp), Session.getScriptTimeZone(), 'MMM d, yyyy') : 'date unavailable';
      return '- ' + (growth.trackingType === 'checkpoints' ? item.assessmentRole + ' — ' : '') +
        dateLabel + ' — ' + item.title + (item.topicName ? ' [' + item.topicName + ']' : '') + ': ' +
        (item.average !== null ? item.average + '% average' : 'no graded average') + ', ' +
        item.gradedCount + ' graded, ' + item.missingCount + ' missing';
    }).join('\n') + '\n\n' +
    (growth.trackingType === 'checkpoints' ? 'BASELINE-TO-FINAL GROWTH: ' : 'ONGOING SERIES HISTORY: ') +
      growth.assignmentCount + ' tracked assignments; ' + improving + ' students improving, ' +
      flat + ' flat, ' + declining + ' declining.\n' +
    'RUBRIC CRITERION RESULTS:\n' + ((rubricMetrics || []).length
      ? rubricMetrics.map(function(metric) {
          return '- ' + metric.criterion + ': ' + (metric.average !== null ? metric.average + '/4 average' : 'awaiting scores') +
            ', ' + (metric.proficientRate !== null ? metric.proficientRate + '% proficient or above' : 'proficiency unavailable');
        }).join('\n')
      : '- No rubric criterion results available yet.') + '\n' +
    'STUDENTS CURRENTLY FLAGGED IN THIS PLAN AREA: ' + outliers.length + '\n\n' +
    'Write a concise overall evaluation of how the plan is working. Then identify up to four tracked metrics that most need ' +
    'attention based on low average, missing work, or negative growth. For each one, state what the data indicates and recommend ' +
    'one concrete instructional change specifically intended to improve that metric. Do not give generic advice. Use the exact ' +
    'metric title supplied above.\n' +
    'Return ONLY valid JSON matching this schema:\n' +
    '{"summary":"string","metrics":[{"metric":"exact metric title","finding":"string","recommendation":"string"}]}';

  var raw = stripJsonFences(callClaude(prompt, 1500));
  try {
    var parsed = JSON.parse(raw);
    return { summary: parsed.summary || '', metrics: parsed.metrics || [] };
  } catch (e) {
    return { summary: raw, metrics: [] };
  }
}

// One recommended next step per flagged student — reteaching, a conference,
// parent contact, an attendance/engagement check-in, etc. Distinct from the
// missing-work/low-average *reason* (already computed by computeHQSDOutliers)
// — this is the "what to actually do about it" layer.
function callClaudeForStudentRecommendations(group, outliers) {
  // Keep student names and individual performance concerns out of external AI calls.
  // These recommendations are intentionally deterministic and teacher-reviewable.
  return (outliers || []).map(function(outlier) {
    var reason = String(outlier.reason || '').toLowerCase();
    var action;
    if (reason.indexOf('missing all') >= 0) {
      action = 'Confirm enrollment and attendance status, then contact the student directly to establish a recovery plan and first achievable submission.';
    } else if (reason.indexOf('missing') >= 0) {
      action = 'Hold a brief conference to identify the barrier, prioritize the most important missing evidence, and set a dated completion checkpoint.';
    } else {
      action = 'Review the student’s scored work and rubric evidence in a one-on-one conference, reteach the weakest skill, and check it again on the next assignment.';
    }
    return { name: outlier.name, action: action };
  });
}
