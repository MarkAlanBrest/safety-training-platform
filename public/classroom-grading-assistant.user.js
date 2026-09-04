// ==UserScript==
// @name         Google Classroom Grading Assistant
// @namespace    https://github.com/MarkAlanBrest/google-classroom-grading-assistant
// @version      1.3.5
// @description  AI-assisted grading for Google Classroom with assignment-specific rubrics, submission review, suggested grades and comments, and insertion into Classroom's grade box.
// @author       MarkAlanBrest
// @homepageURL  https://career-toolkit-ruby.vercel.app/
// @supportURL   https://career-toolkit-ruby.vercel.app/
// @updateURL    https://career-toolkit-ruby.vercel.app/classroom-grading-assistant.user.js
// @downloadURL  https://career-toolkit-ruby.vercel.app/classroom-grading-assistant.user.js
// @match        https://classroom.google.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @connect      api.anthropic.com
// @connect      docs.google.com
// @connect      googleusercontent.com
// @connect      drive.usercontent.google.com
// @connect      accounts.google.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  if (window.__GRADING_ASSISTANT__) return;
  window.__GRADING_ASSISTANT__ = true;
  if (window.top !== window.self) return;

  // ── DISABLE / UNINSTALL ─────────────────────────────────────────────────
  if (typeof GM_registerMenuCommand === 'function') {
    if (GM_getValue('ga_disabled', false)) {
      GM_registerMenuCommand('▶ Enable Grading Assistant', () => {
        GM_setValue('ga_disabled', false);
        window.location.reload();
      });
      return;
    }
    GM_registerMenuCommand('⏸ Disable Grading Assistant', () => {
      GM_setValue('ga_disabled', true);
      window.location.reload();
    });
  } else if (GM_getValue('ga_disabled', false)) {
    return;
  }

  // ── CONSTANTS ────────────────────────────────────────────────────────────
  const CLAUDE_MODEL = 'claude-sonnet-4-6';
  const CLAUDE_MAX_TOKENS = 1500;
  const ASSIGNMENT_SETTINGS_KEY = 'ga_assignment_settings_v1';
  // Confirmed against a real Classroom grading page (aria-label="Grade" on
  // the score <input>) — this is the one selector we know is real. Everything
  // else (submission link, student name) is best-effort/heuristic and shown
  // in the UI so failures are visible rather than silent.
  const GRADE_INPUT_SELECTOR = 'input[aria-label="Grade"]';

  // ── STATE ────────────────────────────────────────────────────────────────
  const state = {
    claudeKey: GM_getValue('ga_claude_key', ''),
    assignment: null,
    pageUrl: window.location.href,
    startupError: '',
    rubric: '',
    maxPoints: 100,
    detectedFile: null, // { id, url, type }
    submissionText: '',
    fetching: false,
    fetchError: '',
    grading: false,
    gradeError: '',
    suggestedGrade: '',
    suggestedComments: '',
    insertError: '',
    inserted: false,
  };

  function detectAssignmentContext() {
    // Most grading URLs use /c/{courseId}/a/{courseWorkId}/.... Classroom can
    // also keep a different shell URL while opening the grading interface, so
    // fall back to the current/canonical assignment links rendered in the DOM.
    const candidates = [window.location.href, document.referrer];
    document.querySelectorAll('link[rel="canonical"][href], a[aria-current="page"][href], a[href*="/c/"][href*="/a/"], iframe[src*="/c/"][src*="/a/"]')
      .forEach((node) => candidates.push(node.href || node.src || ''));

    let match = null;
    for (const candidate of candidates) {
      const decoded = safeDecodeUrl(candidate);
      const found = decoded.match(/\/c\/([^/?#]+)\/a\/([^/?#]+)/i) ||
        decoded.match(/\/g\/tg\/([^/?#]+)\/([^/?#]+)/i);
      if (found) {
        match = found;
        break;
      }
    }
    if (!match) return null;
    const courseId = safeDecodeComponent(match[1]);
    const assignmentId = safeDecodeComponent(match[2]);
    return {
      courseId,
      assignmentId,
      key: courseId + ':' + assignmentId,
      title: detectAssignmentTitle(),
    };
  }

  function safeDecodeUrl(value) {
    try { return decodeURIComponent(String(value || '')); } catch (error) { return String(value || ''); }
  }

  function safeDecodeComponent(value) {
    try { return decodeURIComponent(value); } catch (error) { return value; }
  }

  function detectAssignmentTitle() {
    const headings = [...document.querySelectorAll('h1, h2, [role="heading"]')];
    const candidate = headings.map((node) => (node.textContent || '').trim())
      .find((text) => text && text.length < 250 && !/^(student work|grading assistant)$/i.test(text));
    if (candidate) return candidate;
    return String(document.title || '').replace(/\s*-\s*Google Classroom\s*$/i, '').trim() || 'Current assignment';
  }

  function getAssignmentSettingsMap() {
    const saved = GM_getValue(ASSIGNMENT_SETTINGS_KEY, {});
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  }

  function saveCurrentAssignmentSettings() {
    if (!state.assignment) return;
    const settings = getAssignmentSettingsMap();
    settings[state.assignment.key] = {
      rubric: state.rubric,
      maxPoints: state.maxPoints,
      title: state.assignment.title,
      courseId: state.assignment.courseId,
      assignmentId: state.assignment.assignmentId,
      updatedAt: new Date().toISOString(),
    };
    GM_setValue(ASSIGNMENT_SETTINGS_KEY, settings);
  }

  function detectClassroomMaxPoints() {
    const gradeInput = document.querySelector(GRADE_INPUT_SELECTOR);
    const max = gradeInput && Number(gradeInput.getAttribute('max'));
    return Number.isFinite(max) && max > 0 ? max : 100;
  }

  function loadCurrentAssignmentSettings() {
    state.assignment = detectAssignmentContext();
    state.pageUrl = window.location.href;
    if (!state.assignment) {
      state.rubric = '';
      state.maxPoints = 100;
      return;
    }

    const settings = getAssignmentSettingsMap();
    const saved = settings[state.assignment.key];
    if (saved) {
      state.rubric = String(saved.rubric || '');
      state.maxPoints = Number(saved.maxPoints) || 100;
      return;
    }

    // Migrate the old global rubric once, to the assignment open during the
    // upgrade. New assignments start blank to prevent criteria carry-over.
    const legacyRubric = GM_getValue('ga_rubric', '');
    const legacyMigrated = GM_getValue('ga_legacy_rubric_migrated', false);
    if (legacyRubric && !legacyMigrated) {
      state.rubric = String(legacyRubric);
      state.maxPoints = Number(GM_getValue('ga_max_points', 100)) || 100;
      saveCurrentAssignmentSettings();
      GM_setValue('ga_legacy_rubric_migrated', true);
      return;
    }

    state.rubric = '';
    state.maxPoints = detectClassroomMaxPoints();
  }

  function resetSubmissionForAssignmentChange() {
    state.detectedFile = null;
    state.submissionText = '';
    state.fetchError = '';
    state.gradeError = '';
    state.suggestedGrade = '';
    state.suggestedComments = '';
    state.insertError = '';
    state.inserted = false;
  }

  function syncAssignmentContext() {
    const next = detectAssignmentContext();
    const previousKey = state.assignment && state.assignment.key;
    const nextKey = next && next.key;
    if (previousKey === nextKey) {
      if (state.pageUrl !== window.location.href) {
        state.assignment = next;
        state.pageUrl = window.location.href;
        resetSubmissionForAssignmentChange();
        render();
        return;
      }
      if (state.assignment && next) state.assignment.title = next.title;
      return;
    }
    loadCurrentAssignmentSettings();
    resetSubmissionForAssignmentChange();
    render();
  }

  // ── GM/NETWORK HELPERS ───────────────────────────────────────────────────
  function gmFetch(opts) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: opts.method || 'GET',
        url: opts.url,
        headers: opts.headers || {},
        data: opts.body,
        timeout: opts.timeout || 60000,
        anonymous: opts.anonymous === true,
        redirect: opts.redirect || 'follow',
        cookiePartition: opts.cookiePartition,
        onload: (res) => resolve(res),
        onerror: (res) => reject(new Error('Network error contacting ' + opts.url +
          (res && res.status ? ' (HTTP ' + res.status + ')' : ''))),
        ontimeout: () => reject(new Error('Request timed out — please try again.')),
      });
    });
  }

  function stripMarkdownFence(text) {
    return String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  }

  // ── CLAUDE ───────────────────────────────────────────────────────────────
  async function callClaude(prompt, maxTokens) {
    if (!state.claudeKey) throw new Error('No Claude API key set — add it in Setup.');
    const res = await gmFetch({
      method: 'POST',
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': state.claudeKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens || CLAUDE_MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
      }),
      timeout: 60000,
    });
    let data = {};
    try { data = JSON.parse(res.responseText || '{}'); } catch (e) { /* non-JSON body */ }
    if (res.status < 200 || res.status >= 300) {
      throw new Error((data && data.error && data.error.message) || ('Claude API error (HTTP ' + res.status + ')'));
    }
    return (data.content && data.content[0] && data.content[0].text) || '';
  }

  function buildGradingPrompt() {
    return 'You are grading a student\'s submission against the rubric/answer key below. Grade accurately, but make the private comment sound warm, positive, and encouraging. Use a strengths-first, future-focused approach: name one specific success when the work provides one, then express every correction or gap as a clear, achievable next-step suggestion. Avoid scolding, shaming, sarcasm, harsh labels, and blunt deficit phrasing such as "you failed," "poor work," or "you did not." If there is no clear success to name, begin with an encouraging next step without inventing praise.\n\n' +
      'RUBRIC / ANSWER KEY (out of ' + state.maxPoints + ' points):\n"""\n' + state.rubric + '\n"""\n\n' +
      'STUDENT SUBMISSION:\n"""\n' + state.submissionText + '\n"""\n\n' +
      'Return ONLY valid JSON (no markdown fences, no commentary) matching exactly this shape:\n' +
      '{"grade": number, "comments": string}\n' +
      '- grade: a number from 0 to ' + state.maxPoints + '.\n' +
      '- comments: 1-2 short sentences, no more than 45 words total. Give specific, positive, strengths-first feedback suitable for a private comment. Briefly connect it to the rubric, phrase anything that needs improvement as an actionable suggestion, and end supportively.';
  }

  async function gradeSubmission() {
    state.grading = true;
    state.gradeError = '';
    render();
    try {
      if (!state.rubric.trim()) throw new Error('Add a rubric/answer key first.');
      // Classroom often changes the selected student without changing the page
      // URL. Always reload the visible submission immediately before grading so
      // text cached for the previous student or turn-in can never be reused.
      await fetchSubmission();
      if (!state.submissionText.trim()) {
        throw new Error(state.fetchError || 'The student submission could not be loaded.');
      }
      const raw = await callClaude(buildGradingPrompt(), CLAUDE_MAX_TOKENS);
      const cleaned = stripMarkdownFence(raw);
      let result;
      try {
        result = JSON.parse(cleaned);
      } catch (e) {
        throw new Error('The AI response wasn\'t valid JSON. Try again. (' + e.message + ')');
      }
      state.suggestedGrade = String(result.grade != null ? result.grade : '');
      state.suggestedComments = result.comments || '';
      state.inserted = false;
    } catch (e) {
      state.gradeError = e.message || String(e);
    } finally {
      state.grading = false;
      render();
    }
  }

  // ── SUBMISSION DETECTION + FETCH ─────────────────────────────────────────
  // Best-effort: scan links/iframes on the grading page for a Docs/Drive file
  // ID. Only Google Docs export (plain text) is auto-fetched; other file
  // types are detected but left for the teacher to open/paste manually,
  // since their export endpoints aren't as uniform.
  function detectSubmissionFile() {
    // The selected/current attachment is commonly rendered in a visible preview
    // iframe. Prefer that over links elsewhere on the page (which can include an
    // earlier attachment), then prefer later DOM entries because Classroom appends
    // newly attached revisions after existing files.
    const previewCandidates = [...document.querySelectorAll('iframe[src]')]
      .filter((frame) => isVisible(frame))
      .map((frame) => frame.src)
      .reverse();
    const linkCandidates = [...document.querySelectorAll('a[href]')]
      .filter((link) => isVisible(link) && !isAssistantElement(link))
      .map((link) => link.href)
      .reverse();
    const candidates = [...new Set([...previewCandidates, ...linkCandidates])];
    for (const url of candidates) {
      const m = url.match(/\/document\/d\/([-\w]{20,})/);
      if (m) return { id: m[1], url, type: 'doc' };
    }
    for (const url of candidates) {
      const m = url.match(/\/(?:presentation|spreadsheets)\/d\/([-\w]{20,})/) || url.match(/\/file\/d\/([-\w]{20,})/);
      if (m) return { id: m[1], url, type: 'other' };
    }
    return null;
  }

  async function fetchSubmission() {
    state.fetchError = '';
    state.detectedFile = null;
    state.submissionText = '';
    state.fetching = true;
    render();
    try {
      const file = detectSubmissionFile();
      state.detectedFile = file;
      if (!file) {
        throw new Error('No Google Doc/Drive link found on this page — paste the submission text manually below.');
      }
      if (file.type !== 'doc') {
        throw new Error('Detected a non-Doc file (Slides/Sheets/upload) — open it yourself and paste the text below; auto-fetch only supports Google Docs right now.');
      }
      const sourceUrl = new URL(file.url, window.location.href);
      const pathAccount = window.location.pathname.match(/\/u\/(\d+)/);
      const authuser = sourceUrl.searchParams.get('authuser') || (pathAccount && pathAccount[1]) || '';
      const exportUrl = new URL('https://docs.google.com/document/d/' + file.id + '/export');
      exportUrl.searchParams.set('format', 'txt');
      if (authuser) exportUrl.searchParams.set('authuser', authuser);
      const resourceKey = sourceUrl.searchParams.get('resourcekey');
      if (resourceKey) exportUrl.searchParams.set('resourcekey', resourceKey);
      const res = await gmFetch({
        url: exportUrl.toString(),
        timeout: 30000,
        anonymous: false,
        redirect: 'follow',
        cookiePartition: { topLevelSite: 'https://classroom.google.com' },
      });
      if (res.status < 200 || res.status >= 300) {
        throw new Error('Could not fetch the doc (HTTP ' + res.status + ') — you may need to open it once yourself first, or paste the text manually.');
      }
      state.submissionText = res.responseText || '';
    } catch (e) {
      state.fetchError = e.message || String(e);
    } finally {
      state.fetching = false;
      render();
    }
  }

  function isVisible(element) {
    return !!(element && (element.getClientRects().length || element.offsetParent));
  }

  function privateCommentLabel(element) {
    return [
      element.getAttribute('aria-label'),
      element.getAttribute('placeholder'),
      element.getAttribute('data-tooltip'),
    ].filter(Boolean).join(' ');
  }

  function searchableDocuments() {
    const documents = [document];
    document.querySelectorAll('iframe').forEach((frame) => {
      try {
        if (frame.contentDocument && frame.contentDocument.documentElement) documents.push(frame.contentDocument);
      } catch (error) { /* Cross-origin document preview; ignore it. */ }
    });
    return documents;
  }

  function isAssistantElement(element) {
    return !!(element && element.ownerDocument === document && element.closest('#ga-overlay'));
  }

  function findPrivateCommentField() {
    const fields = searchableDocuments().flatMap((doc) =>
      [...doc.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]')]
    );
    const directlyLabeled = fields.find((element) => {
      if (!isVisible(element) || isAssistantElement(element)) return false;
      return /(?:add\s+(?:a\s+)?)?private comments?/i.test(privateCommentLabel(element));
    });
    if (directlyLabeled) return directlyLabeled;

    const labeledContainers = searchableDocuments().flatMap((doc) =>
      [...doc.querySelectorAll('[role="textbox"], [aria-label], [data-tooltip]')]
    );
    for (const container of labeledContainers) {
      if (!isVisible(container) || isAssistantElement(container)) continue;
      if (!/(?:add\s+(?:a\s+)?)?private comments?/i.test(privateCommentLabel(container))) continue;
      if (container.matches('textarea, input[type="text"], [contenteditable="true"]')) return container;
      const editable = container.querySelector('textarea, input[type="text"], [contenteditable="true"]');
      if (editable && isVisible(editable)) return editable;
    }

    // Newer Classroom builds sometimes put the accessible label on a nearby
    // container instead of the editable node itself.
    const contextual = fields.filter((element) => {
      if (!isVisible(element) || isAssistantElement(element)) return false;
      let container = element.parentElement;
      for (let level = 0; container && level < 6; level++, container = container.parentElement) {
        const text = String(container.textContent || '').trim();
        if (text.length < 2000 && /private comments?/i.test(text)) return true;
      }
      return false;
    });
    if (contextual.length === 1) return contextual[0];

    const visibleFields = fields.filter((element) => isVisible(element) && !isAssistantElement(element));
    return visibleFields.length === 1 ? visibleFields[0] : null;
  }

  function classroomControls() {
    return searchableDocuments().flatMap((doc) =>
      [...doc.querySelectorAll('button, [role="button"], [role="tab"], [role="radio"], [tabindex="0"]')]
    ).filter((element) => isVisible(element) && !isAssistantElement(element));
  }

  function controlLabel(element) {
    const parts = [
      privateCommentLabel(element),
      element.getAttribute('title'),
      element.textContent || '',
    ].filter(Boolean).map((value) => String(value).replace(/\s+/g, ' ').trim());
    return parts.filter((value, index, all) => all.indexOf(value) === index).join(' ');
  }

  async function waitForPrivateCommentField(attempts) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      const field = findPrivateCommentField();
      if (field) return field;
    }
    return null;
  }

  function privateCommentDiagnostics() {
    const labels = classroomControls().map(controlLabel).filter((label) =>
      /comment|grading|marking|feedback/i.test(label)
    ).filter((label, index, all) => all.indexOf(label) === index).slice(0, 8);
    return labels.length ? ' Nearby controls: ' + labels.join(' | ') : '';
  }

  async function revealPrivateCommentField() {
    let field = findPrivateCommentField();
    if (field) return field;

    // The current /g/tg grading interface can hide comments behind a
    // Grading/Marking tab. Open it before looking for the comment composer.
    let controls = classroomControls();
    const gradingTab = controls.find((element) =>
      /^(?:grading|marking|feedback)$/i.test(controlLabel(element))
    );
    if (gradingTab) {
      gradingTab.click();
      field = await waitForPrivateCommentField(6);
      if (field) return field;
    }

    controls = classroomControls();
    const opener = controls.find((element) => {
      const label = controlLabel(element);
      return /(?:add\s+(?:a\s+)?)?private comments?/i.test(label);
    });
    if (opener) opener.click();
    return waitForPrivateCommentField(12);
  }

  async function insertPrivateComment(comment) {
    if (!String(comment || '').trim()) throw new Error('There is no suggested comment to insert.');
    const field = await revealPrivateCommentField();
    if (!field) throw new Error('Could not find Classroom\'s Add private comment field.' + privateCommentDiagnostics());
    field.focus();
    const ownerWindow = field.ownerDocument.defaultView || window;

    if (field.tagName === 'TEXTAREA' || field.tagName === 'INPUT') {
      const prototype = field.tagName === 'TEXTAREA'
        ? ownerWindow.HTMLTextAreaElement.prototype
        : ownerWindow.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, 'value').set;
      setter.call(field, comment);
      field.dispatchEvent(new ownerWindow.Event('input', { bubbles: true }));
      field.dispatchEvent(new ownerWindow.Event('change', { bubbles: true }));
    } else {
      const selection = ownerWindow.getSelection();
      const range = field.ownerDocument.createRange();
      range.selectNodeContents(field);
      selection.removeAllRanges();
      selection.addRange(range);
      const inserted = field.ownerDocument.execCommand && field.ownerDocument.execCommand('insertText', false, comment);
      if (!inserted) {
        field.textContent = comment;
        field.dispatchEvent(new ownerWindow.InputEvent('input', {
          bubbles: true,
          inputType: 'insertText',
          data: comment,
        }));
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
    const insertedText = field.tagName === 'TEXTAREA' || field.tagName === 'INPUT'
      ? field.value
      : field.textContent;
    if (!String(insertedText || '').includes(String(comment).trim())) {
      throw new Error('Classroom found the Private comments field but did not accept the inserted text.');
    }
  }

  // Fills Classroom's native grade and private-comment fields. It deliberately
  // does not post the comment or return the work; the teacher reviews first.
  async function insertGradeAndComment() {
    state.insertError = '';
    let gradeInserted = false;
    try {
      const input = document.querySelector(GRADE_INPUT_SELECTOR);
      if (!input) throw new Error('Could not find the grade box on this page (selector: ' + GRADE_INPUT_SELECTOR + ').');
      // Wiz/Angular-style controlled inputs ignore a plain `.value =` set —
      // go through the native setter so the framework's own change detection
      // picks it up, same trick used for React-controlled inputs.
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(input, state.suggestedGrade);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.focus();
      input.blur();
      gradeInserted = true;
      await insertPrivateComment(state.suggestedComments);
      state.inserted = true;
    } catch (e) {
      state.insertError = (gradeInserted ? 'Grade inserted, but the private comment was not: ' : '') + (e.message || String(e));
      state.inserted = false;
    }
    render();
    if (state.inserted) setTimeout(closeOverlay, 500);
  }

  // ── UI ───────────────────────────────────────────────────────────────────
  const CSS = `
  #ga-fab{position:fixed;right:22px;bottom:86px;z-index:99998;width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#7C3AED,#5B21B6);color:#fff;border:none;box-shadow:0 6px 16px rgba(124,58,237,0.4);cursor:pointer;font-size:22px;display:flex;align-items:center;justify-content:center;transition:transform .15s;}
  #ga-fab:hover{transform:scale(1.07);}
  #ga-overlay{position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,0.6);backdrop-filter:blur(4px);display:flex;justify-content:center;align-items:flex-start;overflow-y:auto;padding:30px 20px;font-family:'Google Sans',Roboto,system-ui,-apple-system,sans-serif;}
  #ga-panel{background:#F8FAFC;border-radius:20px;max-width:820px;width:100%;box-shadow:0 25px 50px rgba(0,0,0,0.25);overflow:hidden;display:flex;flex-direction:column;max-height:calc(100vh - 60px);}
  .ga-topbar{background:linear-gradient(135deg,#7C3AED,#5B21B6);color:#fff;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;}
  .ga-topbar h1{margin:0;font-size:18px;font-weight:700;}
  .ga-close{background:rgba(255,255,255,0.15);border:none;color:#fff;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:13px;}
  .ga-close:hover{background:rgba(255,255,255,0.25);}
  .ga-body{flex:1;overflow-y:auto;padding:20px 24px 24px;}
  .ga-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,0.04);}
  .ga-h2{font-size:16px;font-weight:700;color:#1E293B;margin:0 0 4px;}
  .ga-desc{font-size:13px;color:#64748B;margin:0 0 12px;}
  .ga-label{display:block;font-size:13px;font-weight:600;color:#1E293B;margin-bottom:4px;}
  .ga-input,.ga-textarea{width:100%;padding:9px 12px;border:1px solid #CBD5E1;border-radius:8px;font-size:13px;color:#1E293B;background:#fff;box-sizing:border-box;font-family:inherit;}
  .ga-input:focus,.ga-textarea:focus{outline:none;border-color:#7C3AED;box-shadow:0 0 0 3px rgba(124,58,237,0.12);}
  .ga-textarea{resize:vertical;min-height:90px;}
  .ga-btn{display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:none;transition:transform .15s;}
  .ga-btn:hover{transform:translateY(-1px);}
  .ga-btn:disabled{opacity:0.5;cursor:not-allowed;transform:none;}
  .ga-btn-primary{background:linear-gradient(135deg,#7C3AED,#5B21B6);color:#fff;}
  .ga-btn-secondary{background:#fff;color:#475569;border:1px solid #CBD5E1;}
  .ga-btn-success{background:linear-gradient(135deg,#188038,#0d652d);color:#fff;}
  .ga-btn-row{display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;}
  .ga-banner{padding:10px 14px;border-radius:8px;font-size:12px;margin-top:10px;}
  .ga-banner-ok{background:#E6F4EA;color:#188038;}
  .ga-banner-warn{background:#FEF7E0;color:#B06000;}
  .ga-banner-err{background:#FCE8E6;color:#C5221F;}
  .ga-preview{max-height:160px;overflow-y:auto;white-space:pre-wrap;font-size:12px;color:#334155;background:#F8FAFC;border:1px solid #e5e7eb;border-radius:8px;padding:10px;}
  `;

  function openOverlay() {
    if (document.getElementById('ga-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'ga-overlay';
    setHTML(overlay,
      '<div id="ga-panel">' +
      '  <div class="ga-topbar"><h1>Grading Assistant</h1><button class="ga-close" id="ga-close">Close</button></div>' +
      '  <div class="ga-body"></div>' +
      '</div>');
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });
    document.body.appendChild(overlay);
    overlay.querySelector('#ga-close').addEventListener('click', closeOverlay);
    render();
  }

  function closeOverlay() {
    const overlay = document.getElementById('ga-overlay');
    if (overlay) overlay.remove();
  }

  function render() {
    const overlay = document.getElementById('ga-overlay');
    if (!overlay) return;
    const body = overlay.querySelector('.ga-body');
    if (!state.claudeKey) renderSetup(body);
    else renderMain(body);
  }

  function renderSetup(body) {
    setHTML(body,
      '<div class="ga-card">' +
      '  <div class="ga-h2">Claude API key</div>' +
      '  <div class="ga-desc">Used to grade submissions against your rubric. Get one at console.anthropic.com — billed to your own account.</div>' +
      '  <input type="password" class="ga-input" id="ga-claude-key" placeholder="sk-ant-...">' +
      '  <div class="ga-btn-row"><button class="ga-btn ga-btn-primary" id="ga-setup-go" disabled>Continue</button></div>' +
      '</div>');
    const keyInput = body.querySelector('#ga-claude-key');
    const goBtn = body.querySelector('#ga-setup-go');
    keyInput.addEventListener('input', (e) => { goBtn.disabled = !e.target.value.trim(); });
    goBtn.addEventListener('click', () => {
      state.claudeKey = keyInput.value.trim();
      GM_setValue('ga_claude_key', state.claudeKey);
      render();
    });
  }

  function renderMain(body) {
    const assignmentReady = !!state.assignment;
    const assignmentSummary = assignmentReady
      ? '<div class="ga-banner ga-banner-ok"><strong>Assignment:</strong> ' + escapeHtml(state.assignment.title) +
        '<br><span title="' + escapeAttr(state.assignment.key) + '">Criteria matched to assignment ID: ' +
        escapeHtml(state.assignment.assignmentId) + '</span></div>'
      : '<div class="ga-banner ga-banner-err">' + escapeHtml(state.startupError || 'Assignment not detected on this Classroom screen. Current path: ' + window.location.pathname) + '</div>';
    setHTML(body,
      assignmentSummary +
      '<div class="ga-card">' +
      '  <div class="ga-h2">Rubric / Answer Key</div>' +
      '  <div class="ga-desc">Saved only for the assignment identified above and reused for its students.</div>' +
      '  <textarea class="ga-textarea" id="ga-rubric" placeholder="Paste your rubric, answer key, or grading criteria..." ' + (assignmentReady ? '' : 'disabled') + '>' + escapeHtml(state.rubric) + '</textarea>' +
      '  <div class="ga-label" style="margin-top:10px;">Points possible</div>' +
      '  <input type="number" class="ga-input" id="ga-max-points" value="' + state.maxPoints + '" style="max-width:120px;" ' + (assignmentReady ? '' : 'disabled') + '>' +
      '</div>' +

      '<div class="ga-card">' +
      '  <div class="ga-h2">AI Suggestion</div>' +
      '  <div class="ga-desc">The student submission is loaded privately in the background and is not displayed here.</div>' +
      '  <div class="ga-btn-row">' +
      '    <button class="ga-btn ga-btn-primary" id="ga-grade" ' + (state.grading || !assignmentReady ? 'disabled' : '') + '>' + (state.grading ? 'Grading…' : '✨ Grade with AI') + '</button>' +
      '  </div>' +
      (state.fetchError ? '<div class="ga-banner ga-banner-warn">' + escapeHtml(state.fetchError) + '</div>' : '') +
      (state.gradeError ? '<div class="ga-banner ga-banner-err">' + escapeHtml(state.gradeError) + '</div>' : '') +
      (state.suggestedGrade !== '' || state.suggestedComments ?
        '<div class="ga-label" style="margin-top:12px;">Suggested grade (out of ' + state.maxPoints + ')</div>' +
        '<input type="number" class="ga-input" id="ga-suggested-grade" value="' + escapeAttr(state.suggestedGrade) + '" style="max-width:120px;">' +
        '<div class="ga-label" style="margin-top:10px;">Comments</div>' +
        '<textarea class="ga-textarea" id="ga-suggested-comments">' + escapeHtml(state.suggestedComments) + '</textarea>' +
        '<div class="ga-btn-row">' +
        '  <button class="ga-btn ga-btn-secondary" id="ga-copy-comments">📋 Copy comments</button>' +
        '  <button class="ga-btn ga-btn-success" id="ga-insert-grade">' + (state.inserted ? '✓ Grade & comment inserted' : '⬇ Insert grade & private comment') + '</button>' +
        '</div>' +
        (state.insertError ? '<div class="ga-banner ga-banner-err">' + escapeHtml(state.insertError) + '</div>' : '') +
        (state.inserted ? '<div class="ga-banner ga-banner-ok">Grade and private comment filled. Review them in Classroom before posting or returning the work.</div>' : '')
        : '') +
      '</div>');

    body.querySelector('#ga-rubric').addEventListener('input', (e) => {
      state.rubric = e.target.value;
      saveCurrentAssignmentSettings();
    });
    body.querySelector('#ga-max-points').addEventListener('input', (e) => {
      state.maxPoints = parseInt(e.target.value, 10) || 100;
      saveCurrentAssignmentSettings();
    });
    body.querySelector('#ga-grade').addEventListener('click', gradeSubmission);
    const gradeInput = body.querySelector('#ga-suggested-grade');
    if (gradeInput) gradeInput.addEventListener('input', (e) => { state.suggestedGrade = e.target.value; });
    const commentsInput = body.querySelector('#ga-suggested-comments');
    if (commentsInput) commentsInput.addEventListener('input', (e) => { state.suggestedComments = e.target.value; });
    const copyBtn = body.querySelector('#ga-copy-comments');
    if (copyBtn) copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(state.suggestedComments).then(() => {
        copyBtn.textContent = '✓ Copied';
        setTimeout(() => { copyBtn.textContent = '📋 Copy comments'; }, 1500);
      });
    });
    const insertBtn = body.querySelector('#ga-insert-grade');
    if (insertBtn) insertBtn.addEventListener('click', insertGradeAndComment);
  }

  // Same Trusted Types handling proven out in the Topic Builder script —
  // Google Classroom rejects raw-string .innerHTML assignment, so route
  // through a registered policy.
  let ttPolicy = null;
  let ttPolicyAttempted = false;
  function getTrustedTypesPolicy() {
    if (ttPolicyAttempted) return ttPolicy;
    ttPolicyAttempted = true;
    if (!window.trustedTypes || !window.trustedTypes.createPolicy) return null;
    const candidateNames = ['ga-html', 'grading-assistant-html', 'default'];
    for (const name of candidateNames) {
      try {
        ttPolicy = window.trustedTypes.createPolicy(name, { createHTML: (s) => s, createScriptURL: (s) => s });
        return ttPolicy;
      } catch (e) { /* try next name */ }
    }
    return null;
  }

  function setHTML(el, html) {
    while (el.firstChild) el.removeChild(el.firstChild);
    const policy = getTrustedTypesPolicy();
    if (policy) {
      el.innerHTML = policy.createHTML(html);
      return;
    }
    throw new Error('This page blocks HTML rendering (Trusted Types) and no policy name was accepted.');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  // ── FAB + SPA watchdog ───────────────────────────────────────────────────
  function injectFab() {
    if (document.getElementById('ga-fab')) return;
    const btn = document.createElement('button');
    btn.id = 'ga-fab';
    btn.title = 'Grading Assistant';
    btn.textContent = '📝';
    btn.addEventListener('click', () => {
      try {
        openOverlay();
      } catch (err) {
        window.prompt('Grading Assistant hit an error. Copy this and share it:', (err && err.stack) || String(err));
      }
    });
    document.body.appendChild(btn);
  }

  function init() {
    try {
      loadCurrentAssignmentSettings();
      state.startupError = '';
    } catch (error) {
      // Assignment detection must never prevent the launcher from appearing.
      state.assignment = null;
      state.rubric = '';
      state.maxPoints = 100;
      state.startupError = 'Assignment detection failed: ' + ((error && error.message) || String(error));
    }
    if (typeof GM_addStyle === 'function') {
      GM_addStyle(CSS);
    } else {
      const el = document.createElement('style');
      el.textContent = CSS;
      (document.head || document.documentElement).appendChild(el);
    }
    injectFab();
    new MutationObserver(() => {
      injectFab();
      syncAssignmentContext();
    }).observe(document.body, { childList: true, subtree: false });
    setInterval(() => {
      injectFab();
      syncAssignmentContext();
    }, 1500);
  }

  function waitAndLaunch(tries) {
    if (document.body) { init(); return; }
    if (tries > 40) return;
    setTimeout(() => waitAndLaunch(tries + 1), 250);
  }
  waitAndLaunch(0);
})();
