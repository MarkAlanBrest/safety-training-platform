(function () {
  "use strict";

  if (!window.ENV || !window.ENV.current_user_id) return;
  if (window.__ncstCanvasMailMergeLoaded) return;
  window.__ncstCanvasMailMergeLoaded = true;

  var roles = Array.isArray(window.ENV.current_user_roles)
    ? window.ENV.current_user_roles.map(function (role) { return String(role).toLowerCase(); })
    : [];
  var teacherRoles = ["teacher", "instructor", "ta", "designer", "admin", "account_admin", "root_admin"];
  if (!roles.some(function (role) { return teacherRoles.indexOf(role) >= 0; })) return;

  var STORAGE_KEY = "ncst.canvas.savedMessages.v1";
  var ROOT_ID = "ncst-saved-messages-root";
  var BUTTON_ID = "ncst-saved-messages-button";
  var activeCompose = null;
  var selectedTemplateId = "";
  var loadedCourses = [];
  var loadedStudents = [];
  var loadedSubmissions = [];
  var previewMessages = [];
  var lastFocusedTemplateField = null;

  function id(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function firstName(name) {
    var value = String(name || "Student").trim();
    if (value.indexOf(",") >= 0) {
      var parts = value.split(",");
      return String(parts[1] || parts[0] || "Student").trim().split(/\s+/)[0] || "Student";
    }
    return value.split(/\s+/)[0] || "Student";
  }

  function defaultTemplates() {
    return [
      {
        id: id("template"),
        name: "Student progress update",
        subject: "Progress update for {{student_name}}",
        body:
          "Hi {{first_name}},\n\n" +
          "Your current grade in {{course_name}} is {{overall_grade}}.\n\n" +
          "Missing assignments ({{missing_count}}):\n{{missing_assignments}}\n\n" +
          "Please contact me if you need help making a plan.",
        updatedAt: new Date().toISOString(),
      },
    ];
  }

  function readTemplates() {
    try {
      var parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
      if (Array.isArray(parsed)) return parsed.filter(validTemplate);
    } catch (error) {
      // Start with the default template if local browser storage is unavailable or malformed.
    }
    var initial = defaultTemplates();
    writeTemplates(initial);
    return initial;
  }

  function validTemplate(template) {
    return Boolean(
      template &&
      typeof template.id === "string" &&
      typeof template.name === "string" &&
      typeof template.subject === "string" &&
      typeof template.body === "string"
    );
  }

  function writeTemplates(templates) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  }

  function getCookie(name) {
    var prefix = name + "=";
    var part = String(document.cookie || "").split(";").map(function (item) {
      return item.trim();
    }).find(function (item) {
      return item.indexOf(prefix) === 0;
    });
    return part ? decodeURIComponent(part.slice(prefix.length)) : "";
  }

  function csrfToken() {
    return getCookie("_csrf_token") || getCookie("csrf_token");
  }

  function parseNextLink(header) {
    if (!header) return "";
    var next = header.split(",").find(function (part) { return part.indexOf('rel="next"') >= 0; });
    var match = next && next.match(/<([^>]+)>/);
    return match ? match[1] : "";
  }

  async function fetchAll(url) {
    var rows = [];
    var nextUrl = url;
    while (nextUrl) {
      var response = await fetch(nextUrl, { credentials: "same-origin" });
      if (!response.ok) {
        throw new Error("Canvas returned " + response.status + " while loading data.");
      }
      var page = await response.json();
      if (Array.isArray(page)) rows = rows.concat(page);
      nextUrl = parseNextLink(response.headers.get("link"));
    }
    return rows;
  }

  function h(tag, attributes, children) {
    var element = document.createElement(tag);
    Object.keys(attributes || {}).forEach(function (key) {
      var value = attributes[key];
      if (key === "className") element.className = value;
      else if (key === "text") element.textContent = value;
      else if (key === "checked") element.checked = Boolean(value);
      else if (key === "value") element.value = value;
      else if (key.indexOf("on") === 0 && typeof value === "function") {
        element.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (value != null) element.setAttribute(key, String(value));
    });
    (children || []).forEach(function (child) {
      if (child == null) return;
      element.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return element;
  }

  function injectStyles() {
    if (document.getElementById("ncst-saved-messages-styles")) return;
    var style = document.createElement("style");
    style.id = "ncst-saved-messages-styles";
    style.textContent =
      "#" + BUTTON_ID + "{position:fixed;right:24px;bottom:28px;z-index:1000001;border:0;border-radius:999px;" +
      "padding:13px 18px;background:#b91c1c;color:#fff;font:700 14px/1 system-ui,sans-serif;cursor:pointer;" +
      "box-shadow:0 10px 28px rgba(0,0,0,.28)}" +
      "#" + BUTTON_ID + ":hover,#" + BUTTON_ID + ":focus{background:#991b1b;outline:3px solid rgba(185,28,28,.25)}" +
      "#" + ROOT_ID + "{position:fixed;inset:0;z-index:1000002;background:rgba(15,23,42,.48);font-family:system-ui,sans-serif}" +
      "#" + ROOT_ID + " *{box-sizing:border-box}" +
      ".ncst-mm-panel{position:absolute;top:0;right:0;width:min(520px,100vw);height:100%;overflow:auto;background:#fff;color:#172033;" +
      "box-shadow:-18px 0 50px rgba(0,0,0,.28);padding:22px}" +
      ".ncst-mm-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}" +
      ".ncst-mm-head h2{margin:0;font-size:24px;color:#172033}.ncst-mm-close{border:0;background:#e5e7eb;border-radius:9px;padding:8px 11px;cursor:pointer}" +
      ".ncst-mm-section{border:1px solid #d7dde7;border-radius:14px;padding:14px;margin:0 0 14px;background:#fff}" +
      ".ncst-mm-section h3{margin:0 0 10px;font-size:17px;color:#172033}.ncst-mm-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}" +
      ".ncst-mm-field{display:block;margin:0 0 10px;font-weight:700;color:#263244}.ncst-mm-field input,.ncst-mm-field textarea,.ncst-mm-field select," +
      ".ncst-mm-select{display:block;width:100%;margin-top:5px;border:1px solid #9aa5b5;border-radius:9px;padding:9px;background:#fff;color:#172033;font:400 14px/1.4 system-ui,sans-serif}" +
      ".ncst-mm-field textarea{min-height:145px;resize:vertical}.ncst-mm-btn{border:0;border-radius:9px;padding:9px 12px;background:#334155;color:#fff;font-weight:700;cursor:pointer}" +
      ".ncst-mm-btn-primary{background:#b91c1c}.ncst-mm-btn-danger{background:#7f1d1d}.ncst-mm-btn-light{background:#e5e7eb;color:#172033}" +
      ".ncst-mm-btn:disabled{opacity:.45;cursor:not-allowed}.ncst-mm-template-list{display:grid;gap:7px;margin:10px 0}" +
      ".ncst-mm-template{display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid #d7dde7;border-radius:9px;padding:9px;background:#f8fafc}" +
      ".ncst-mm-template[data-selected=true]{border-color:#b91c1c;background:#fff1f2}.ncst-mm-template button:first-child{flex:1;text-align:left}" +
      ".ncst-mm-chip{border:1px solid #cbd5e1;border-radius:999px;padding:5px 8px;background:#f8fafc;color:#334155;font:600 12px system-ui;cursor:pointer}" +
      ".ncst-mm-students{max-height:230px;overflow:auto;border:1px solid #d7dde7;border-radius:9px;margin-top:8px}" +
      ".ncst-mm-student{display:grid;grid-template-columns:26px 1fr auto;gap:8px;padding:8px 10px;border-bottom:1px solid #eef1f5;align-items:center}" +
      ".ncst-mm-student:last-child{border-bottom:0}.ncst-mm-grade{font-size:12px;color:#596579}" +
      ".ncst-mm-preview{white-space:pre-wrap;background:#f8fafc;border:1px solid #d7dde7;border-radius:9px;padding:11px;max-height:210px;overflow:auto}" +
      ".ncst-mm-status{margin:10px 0 0;padding:9px;border-radius:8px;background:#eef2ff;color:#263244;font-weight:600}" +
      ".ncst-mm-status[data-error=true]{background:#fee2e2;color:#7f1d1d}.ncst-mm-note{font-size:12px;color:#596579;margin:7px 0}";
    document.head.appendChild(style);
  }

  function findComposeDialog() {
    if ((window.location.pathname || "").indexOf("/conversations") < 0) return null;
    var dialogs = Array.prototype.slice.call(document.querySelectorAll('[role="dialog"],.ui-dialog,[aria-modal="true"]'));
    return dialogs.find(function (dialog) {
      if (dialog.closest("#" + ROOT_ID)) return false;
      var subject = findSubjectInput(dialog);
      var body = findBodyInput(dialog);
      var text = String(dialog.textContent || "").toLowerCase();
      return Boolean(subject && body && (text.indexOf("compose") >= 0 || text.indexOf("subject") >= 0));
    }) || null;
  }

  function findSubjectInput(root) {
    return root && root.querySelector(
      'input[name="subject"],input[data-testid*="subject" i],input[placeholder*="subject" i],input[aria-label*="subject" i]'
    );
  }

  function findBodyInput(root) {
    if (!root) return null;
    return root.querySelector(
      'textarea[name="body"],textarea[data-testid*="message" i],textarea[placeholder*="message" i],[contenteditable="true"][role="textbox"],iframe'
    );
  }

  function setNativeValue(element, value) {
    if (!element) return;
    var prototype = element.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    var setter = Object.getOwnPropertyDescriptor(prototype, "value");
    if (setter && setter.set) setter.set.call(element, value);
    else element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function plainTextToHtml(value) {
    return String(value || "").split(/\n{2,}/).map(function (paragraph) {
      var escaped = paragraph.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return "<p>" + escaped.replace(/\n/g, "<br>") + "</p>";
    }).join("");
  }

  function setComposeMessage(subject, body) {
    var dialog = activeCompose || findComposeDialog();
    if (!dialog) throw new Error("Open the Canvas Compose Message window first.");
    var subjectInput = findSubjectInput(dialog);
    if (!subjectInput) throw new Error("Canvas subject field was not found.");
    setNativeValue(subjectInput, subject);

    var tinymce = window.tinymce;
    var editor = tinymce && Array.isArray(tinymce.editors)
      ? tinymce.editors.find(function (item) {
          var target = item && item.getElement && item.getElement();
          var frame = item && item.iframeElement;
          return (target && dialog.contains(target)) || (frame && dialog.contains(frame));
        })
      : null;
    if (editor && editor.setContent) {
      editor.setContent(plainTextToHtml(body));
      editor.fire("input");
      editor.fire("change");
      return;
    }

    var bodyInput = findBodyInput(dialog);
    if (!bodyInput) throw new Error("Canvas message field was not found.");
    if (bodyInput.tagName === "IFRAME") {
      var frameBody = bodyInput.contentDocument && bodyInput.contentDocument.body;
      if (!frameBody) throw new Error("Canvas message editor was not ready.");
      frameBody.innerHTML = plainTextToHtml(body);
      frameBody.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (bodyInput.isContentEditable) {
      bodyInput.innerHTML = plainTextToHtml(body);
      bodyInput.dispatchEvent(new Event("input", { bubbles: true }));
      bodyInput.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      setNativeValue(bodyInput, body);
    }
  }

  function readComposeValues() {
    var dialog = activeCompose || findComposeDialog();
    var subject = findSubjectInput(dialog);
    var body = findBodyInput(dialog);
    var bodyValue = "";
    if (body) {
      if (body.tagName === "IFRAME" && body.contentDocument) bodyValue = body.contentDocument.body.innerText || "";
      else bodyValue = body.isContentEditable ? body.innerText || "" : body.value || "";
    }
    return { subject: subject ? subject.value || "" : "", body: bodyValue };
  }

  function replaceFields(text, fields) {
    return String(text || "").replace(/{{\s*([a-z_]+)\s*}}/gi, function (_, key) {
      var normalized = String(key).toLowerCase();
      return Object.prototype.hasOwnProperty.call(fields, normalized) ? fields[normalized] : "";
    });
  }

  function formatDate(value) {
    if (!value) return "No due date";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "No due date";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function gradeForEnrollment(enrollment) {
    var grades = enrollment.grades || {};
    var score = grades.current_score;
    if (score == null) score = enrollment.computed_current_score;
    return score == null || score === "" ? "Not available" : Number(score).toFixed(1).replace(/\.0$/, "") + "%";
  }

  function submissionsForStudent(studentId) {
    return loadedSubmissions.filter(function (submission) {
      return String(submission.user_id) === String(studentId) && submission.assignment_visible !== false;
    });
  }

  function fieldsForStudent(student, course) {
    var submissions = submissionsForStudent(student.id);
    var missing = submissions.filter(function (submission) {
      return submission.missing === true && submission.excused !== true;
    });
    var missingLines = missing.map(function (submission) {
      var assignment = submission.assignment || {};
      return "- " + (assignment.name || "Assignment") + " (due " + formatDate(assignment.due_at) + ")";
    });
    var assignmentLines = submissions.map(function (submission) {
      var assignment = submission.assignment || {};
      var status = submission.excused
        ? "Excused"
        : submission.missing
          ? "Missing"
          : submission.grade != null && submission.grade !== ""
            ? "Grade: " + submission.grade
            : submission.workflow_state === "submitted"
              ? "Submitted"
              : "Not submitted";
      return "- " + (assignment.name || "Assignment") + ": " + status;
    });
    return {
      student_name: student.name || student.user && student.user.name || "Student",
      first_name: firstName(student.name || student.user && student.user.name),
      course_name: course.name || "this course",
      overall_grade: gradeForEnrollment(student),
      missing_count: String(missing.length),
      missing_assignments: missingLines.length ? missingLines.join("\n") : "None",
      all_assignments: assignmentLines.length ? assignmentLines.join("\n") : "No assignments available",
      teacher_name: String(window.ENV.current_user && window.ENV.current_user.display_name || "Your instructor"),
    };
  }

  function selectedTemplate() {
    return readTemplates().find(function (template) { return template.id === selectedTemplateId; }) || null;
  }

  function selectedStudentIds(root) {
    return Array.prototype.slice.call(root.querySelectorAll('.ncst-mm-student input[type="checkbox"]:checked')).map(function (input) {
      return input.value;
    });
  }

  function setStatus(root, message, isError) {
    var status = root.querySelector(".ncst-mm-status");
    if (!status) return;
    status.textContent = message || "";
    status.hidden = !message;
    status.dataset.error = isError ? "true" : "false";
  }

  function invalidatePreview(root) {
    previewMessages = [];
    var preview = root.querySelector(".ncst-mm-preview");
    if (preview) preview.textContent = "Choose students and prepare a preview.";
  }

  function renderTemplateList(root) {
    var list = root.querySelector(".ncst-mm-template-list");
    list.replaceChildren();
    var templates = readTemplates();
    if (!selectedTemplateId && templates[0]) selectedTemplateId = templates[0].id;
    templates.forEach(function (template) {
      var row = h("div", { className: "ncst-mm-template", "data-selected": template.id === selectedTemplateId }, []);
      var choose = h("button", { className: "ncst-mm-btn ncst-mm-btn-light", type: "button", text: template.name }, []);
      choose.addEventListener("click", function () {
        selectedTemplateId = template.id;
        fillTemplateEditor(root, template);
        renderTemplateList(root);
      });
      var remove = h("button", { className: "ncst-mm-btn ncst-mm-btn-danger", type: "button", text: "Delete", title: "Delete template" }, []);
      remove.addEventListener("click", function () {
        if (!window.confirm('Delete the saved template "' + template.name + '"?')) return;
        var next = readTemplates().filter(function (item) { return item.id !== template.id; });
        writeTemplates(next);
        if (selectedTemplateId === template.id) selectedTemplateId = next[0] ? next[0].id : "";
        fillTemplateEditor(root, selectedTemplate());
        renderTemplateList(root);
      });
      row.appendChild(choose);
      row.appendChild(remove);
      list.appendChild(row);
    });
  }

  function fillTemplateEditor(root, template) {
    root.querySelector("#ncst-mm-template-id").value = template ? template.id : "";
    root.querySelector("#ncst-mm-name").value = template ? template.name : "";
    root.querySelector("#ncst-mm-subject").value = template ? template.subject : "";
    root.querySelector("#ncst-mm-body").value = template ? template.body : "";
    invalidatePreview(root);
  }

  function saveTemplate(root) {
    var templateId = root.querySelector("#ncst-mm-template-id").value || id("template");
    var name = root.querySelector("#ncst-mm-name").value.trim();
    var subject = root.querySelector("#ncst-mm-subject").value.trim();
    var body = root.querySelector("#ncst-mm-body").value.trim();
    if (!name || !subject || !body) throw new Error("Template name, subject, and message are required.");
    var templates = readTemplates();
    var record = { id: templateId, name: name, subject: subject, body: body, updatedAt: new Date().toISOString() };
    var index = templates.findIndex(function (item) { return item.id === templateId; });
    if (index >= 0) templates[index] = record;
    else templates.unshift(record);
    writeTemplates(templates);
    selectedTemplateId = templateId;
    root.querySelector("#ncst-mm-template-id").value = templateId;
    renderTemplateList(root);
    setStatus(root, "Template saved on this computer.", false);
  }

  async function loadCourses(root) {
    setStatus(root, "Loading your courses…", false);
    loadedCourses = await fetchAll("/api/v1/courses?enrollment_type=teacher&state[]=available&per_page=100");
    var select = root.querySelector("#ncst-mm-course");
    select.replaceChildren(h("option", { value: "", text: "Choose a course" }, []));
    loadedCourses.sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || "")); });
    loadedCourses.forEach(function (course) {
      select.appendChild(h("option", { value: String(course.id), text: course.name || course.course_code || String(course.id) }, []));
    });
    setStatus(root, "", false);
  }

  async function loadStudents(root, courseId) {
    loadedStudents = [];
    loadedSubmissions = [];
    previewMessages = [];
    var list = root.querySelector(".ncst-mm-students");
    list.textContent = "Loading students…";
    setStatus(root, "Loading course roster…", false);
    var query = "/api/v1/courses/" + encodeURIComponent(courseId) +
      "/enrollments?type[]=StudentEnrollment&state[]=active&include[]=current_points&per_page=100";
    loadedStudents = await fetchAll(query);
    loadedStudents = loadedStudents.filter(function (enrollment) { return enrollment.user_id && enrollment.user; });
    loadedStudents.sort(function (a, b) { return String(a.user.sortable_name || a.user.name || "").localeCompare(String(b.user.sortable_name || b.user.name || "")); });
    list.replaceChildren();
    loadedStudents.forEach(function (student) {
      student.id = student.user_id;
      student.name = student.user.name || student.user.sortable_name || "Student";
      var checkbox = h("input", { type: "checkbox", value: String(student.id), checked: true, "aria-label": "Include " + student.name }, []);
      list.appendChild(h("label", { className: "ncst-mm-student" }, [
        checkbox,
        h("span", { text: student.name }, []),
        h("span", { className: "ncst-mm-grade", text: gradeForEnrollment(student) }, []),
      ]));
    });
    setStatus(root, loadedStudents.length + " active students loaded.", false);
  }

  async function loadSubmissionData(root, courseId) {
    if (loadedSubmissions.length) return;
    setStatus(root, "Loading live assignment information…", false);
    loadedSubmissions = await fetchAll(
      "/api/v1/courses/" + encodeURIComponent(courseId) +
      "/students/submissions?student_ids[]=all&include[]=assignment&per_page=100"
    );
  }

  async function preparePreview(root) {
    var template = selectedTemplate();
    if (!template) throw new Error("Choose or save a template first.");
    var courseId = root.querySelector("#ncst-mm-course").value;
    if (!courseId) throw new Error("Choose a course.");
    var ids = selectedStudentIds(root);
    if (!ids.length) throw new Error("Select at least one student.");
    await loadSubmissionData(root, courseId);
    var course = loadedCourses.find(function (item) { return String(item.id) === String(courseId); }) || {};
    previewMessages = loadedStudents.filter(function (student) {
      return ids.indexOf(String(student.id)) >= 0;
    }).map(function (student) {
      var fields = fieldsForStudent(student, course);
      return {
        userId: String(student.id),
        studentName: fields.student_name,
        subject: replaceFields(template.subject, fields).slice(0, 255),
        body: replaceFields(template.body, fields),
      };
    });
    var first = previewMessages[0];
    root.querySelector(".ncst-mm-preview").textContent =
      "Preview for " + first.studentName + "\n\nSubject: " + first.subject + "\n\n" + first.body;
    setStatus(root, previewMessages.length + " personalized private messages prepared. Nothing has been sent.", false);
  }

  async function sendConversation(message, courseId) {
    var form = new URLSearchParams();
    form.append("recipients[]", message.userId);
    form.set("subject", message.subject);
    form.set("body", message.body);
    form.set("group_conversation", "false");
    form.set("context_code", "course_" + courseId);
    var headers = { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" };
    var token = csrfToken();
    if (token) headers["X-CSRF-Token"] = token;
    var response = await fetch("/api/v1/conversations", {
      method: "POST",
      credentials: "same-origin",
      headers: headers,
      body: form.toString(),
    });
    if (!response.ok) {
      var detail = await response.text().catch(function () { return ""; });
      throw new Error("Canvas returned " + response.status + (detail ? ": " + detail.slice(0, 180) : ""));
    }
  }

  async function sendPrepared(root) {
    if (!previewMessages.length) throw new Error("Prepare and review the messages first.");
    var courseId = root.querySelector("#ncst-mm-course").value;
    var confirmation = window.prompt(
      "This will send " + previewMessages.length + " separate private Canvas messages. Type SEND to continue.",
      ""
    );
    if (confirmation !== "SEND") {
      setStatus(root, "Send cancelled. No messages were sent.", false);
      return;
    }
    var sendButton = root.querySelector("#ncst-mm-send");
    sendButton.disabled = true;
    var sent = 0;
    var failures = [];
    for (var index = 0; index < previewMessages.length; index += 1) {
      var message = previewMessages[index];
      setStatus(root, "Sending " + (index + 1) + " of " + previewMessages.length + "…", false);
      try {
        await sendConversation(message, courseId);
        sent += 1;
      } catch (error) {
        failures.push(message.studentName + ": " + (error && error.message || "failed"));
      }
    }
    sendButton.disabled = false;
    previewMessages = [];
    if (failures.length) {
      setStatus(root, "Sent " + sent + ". Failed " + failures.length + ": " + failures.join(" | "), true);
    } else {
      setStatus(root, "Sent " + sent + " separate private Canvas messages successfully.", false);
    }
  }

  function exportTemplates() {
    var blob = new Blob([JSON.stringify(readTemplates(), null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = h("a", { href: url, download: "canvas-saved-messages.json" }, []);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function importTemplates(root, file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result || ""));
        if (!Array.isArray(parsed) || !parsed.every(validTemplate)) throw new Error("The file is not a valid template backup.");
        writeTemplates(parsed);
        selectedTemplateId = parsed[0] ? parsed[0].id : "";
        renderTemplateList(root);
        fillTemplateEditor(root, selectedTemplate());
        setStatus(root, parsed.length + " templates imported.", false);
      } catch (error) {
        setStatus(root, error && error.message || "Could not import templates.", true);
      }
    };
    reader.readAsText(file);
  }

  function insertMergeField(root, field) {
    var target = lastFocusedTemplateField || root.querySelector("#ncst-mm-body");
    var token = "{{" + field + "}}";
    var start = target.selectionStart == null ? target.value.length : target.selectionStart;
    var end = target.selectionEnd == null ? start : target.selectionEnd;
    target.value = target.value.slice(0, start) + token + target.value.slice(end);
    target.focus();
    target.selectionStart = target.selectionEnd = start + token.length;
  }

  function buildPanel() {
    injectStyles();
    var root = h("div", { id: ROOT_ID }, []);
    var panel = h("aside", { className: "ncst-mm-panel", role: "dialog", "aria-modal": "true", "aria-label": "Saved Canvas messages" }, []);
    root.addEventListener("click", function (event) { if (event.target === root) root.remove(); });

    var close = h("button", { className: "ncst-mm-close", type: "button", text: "Close" }, []);
    close.addEventListener("click", function () { root.remove(); });
    panel.appendChild(h("div", { className: "ncst-mm-head" }, [h("h2", { text: "Saved Messages" }, []), close]));

    var templateSection = h("section", { className: "ncst-mm-section" }, [h("h3", { text: "Local templates" }, [])]);
    var templateActions = h("div", { className: "ncst-mm-row" }, []);
    var newButton = h("button", { className: "ncst-mm-btn ncst-mm-btn-light", type: "button", text: "New" }, []);
    var saveCurrentButton = h("button", { className: "ncst-mm-btn ncst-mm-btn-light", type: "button", text: "Save current Compose" }, []);
    var exportButton = h("button", { className: "ncst-mm-btn ncst-mm-btn-light", type: "button", text: "Export" }, []);
    var importButton = h("button", { className: "ncst-mm-btn ncst-mm-btn-light", type: "button", text: "Import" }, []);
    var importInput = h("input", { type: "file", accept: "application/json", hidden: "hidden" }, []);
    templateActions.append(newButton, saveCurrentButton, exportButton, importButton, importInput);
    templateSection.appendChild(templateActions);
    templateSection.appendChild(h("div", { className: "ncst-mm-template-list" }, []));
    templateSection.appendChild(h("input", { id: "ncst-mm-template-id", type: "hidden" }, []));
    templateSection.appendChild(h("label", { className: "ncst-mm-field", text: "Template name" }, [h("input", { id: "ncst-mm-name", type: "text" }, [])]));
    var subjectInput = h("input", { id: "ncst-mm-subject", type: "text" }, []);
    var bodyInput = h("textarea", { id: "ncst-mm-body" }, []);
    subjectInput.addEventListener("focus", function () { lastFocusedTemplateField = subjectInput; });
    bodyInput.addEventListener("focus", function () { lastFocusedTemplateField = bodyInput; });
    templateSection.appendChild(h("label", { className: "ncst-mm-field", text: "Subject" }, [subjectInput]));
    templateSection.appendChild(h("label", { className: "ncst-mm-field", text: "Message" }, [bodyInput]));
    templateSection.appendChild(h("p", { className: "ncst-mm-note", text: "Insert a live Canvas field:" }, []));
    var chips = h("div", { className: "ncst-mm-row" }, []);
    ["first_name", "student_name", "course_name", "overall_grade", "missing_count", "missing_assignments", "all_assignments", "teacher_name"].forEach(function (field) {
      var chip = h("button", { className: "ncst-mm-chip", type: "button", text: "{{" + field + "}}" }, []);
      chip.addEventListener("click", function () { insertMergeField(root, field); });
      chips.appendChild(chip);
    });
    templateSection.appendChild(chips);
    var saveButton = h("button", { className: "ncst-mm-btn ncst-mm-btn-primary", type: "button", text: "Save template" }, []);
    var insertTemplateButton = h("button", { className: "ncst-mm-btn", type: "button", text: "Insert into Compose" }, []);
    saveButton.addEventListener("click", function () {
      try { saveTemplate(root); } catch (error) { setStatus(root, error && error.message || "Could not save template.", true); }
    });
    insertTemplateButton.addEventListener("click", function () {
      try {
        var subject = subjectInput.value.trim();
        var body = bodyInput.value.trim();
        if (!subject || !body) throw new Error("Enter a subject and message first.");
        setComposeMessage(subject, body);
        setStatus(root, "Template inserted into Canvas Compose.", false);
      } catch (error) {
        setStatus(root, error && error.message || "Could not insert into Compose.", true);
      }
    });
    templateSection.appendChild(h("div", { className: "ncst-mm-row", style: "margin-top:10px" }, [saveButton, insertTemplateButton]));
    panel.appendChild(templateSection);

    var mergeSection = h("section", { className: "ncst-mm-section" }, [h("h3", { text: "Personalize for a class" }, [])]);
    var courseSelect = h("select", { id: "ncst-mm-course", className: "ncst-mm-select" }, [h("option", { value: "", text: "Loading courses…" }, [])]);
    mergeSection.appendChild(h("label", { className: "ncst-mm-field", text: "Course" }, [courseSelect]));
    var selectAll = h("button", { className: "ncst-mm-btn ncst-mm-btn-light", type: "button", text: "Select all" }, []);
    var selectNone = h("button", { className: "ncst-mm-btn ncst-mm-btn-light", type: "button", text: "Select none" }, []);
    mergeSection.appendChild(h("div", { className: "ncst-mm-row" }, [selectAll, selectNone]));
    mergeSection.appendChild(h("div", { className: "ncst-mm-students", text: "Choose a course." }, []));
    var prepare = h("button", { className: "ncst-mm-btn ncst-mm-btn-primary", type: "button", text: "Prepare preview" }, []);
    var insert = h("button", { className: "ncst-mm-btn", type: "button", text: "Insert first preview into Compose" }, []);
    mergeSection.appendChild(h("div", { className: "ncst-mm-row", style: "margin-top:10px" }, [prepare, insert]));
    mergeSection.appendChild(h("pre", { className: "ncst-mm-preview", text: "Choose students and prepare a preview." }, []));
    var send = h("button", { id: "ncst-mm-send", className: "ncst-mm-btn ncst-mm-btn-primary", type: "button", text: "Send separate private messages" }, []);
    mergeSection.appendChild(h("div", { className: "ncst-mm-row", style: "margin-top:10px" }, [send]));
    mergeSection.appendChild(h("p", { className: "ncst-mm-note", text: "Canvas data is loaded live. Templates remain only in this browser. Each student receives a separate private conversation." }, []));
    panel.appendChild(mergeSection);
    panel.appendChild(h("div", { className: "ncst-mm-status", hidden: "hidden" }, []));
    root.appendChild(panel);
    document.body.appendChild(root);

    newButton.addEventListener("click", function () {
      selectedTemplateId = "";
      fillTemplateEditor(root, null);
      root.querySelector("#ncst-mm-name").focus();
      renderTemplateList(root);
    });
    saveCurrentButton.addEventListener("click", function () {
      var current = readComposeValues();
      selectedTemplateId = "";
      fillTemplateEditor(root, { id: "", name: "", subject: current.subject, body: current.body });
      root.querySelector("#ncst-mm-name").focus();
    });
    exportButton.addEventListener("click", exportTemplates);
    importButton.addEventListener("click", function () { importInput.click(); });
    importInput.addEventListener("change", function () {
      if (importInput.files && importInput.files[0]) importTemplates(root, importInput.files[0]);
      importInput.value = "";
    });
    courseSelect.addEventListener("change", function () {
      invalidatePreview(root);
      if (!courseSelect.value) return;
      loadStudents(root, courseSelect.value).catch(function (error) {
        setStatus(root, error && error.message || "Could not load students.", true);
      });
    });
    selectAll.addEventListener("click", function () {
      root.querySelectorAll('.ncst-mm-student input[type="checkbox"]').forEach(function (input) { input.checked = true; });
      invalidatePreview(root);
    });
    selectNone.addEventListener("click", function () {
      root.querySelectorAll('.ncst-mm-student input[type="checkbox"]').forEach(function (input) { input.checked = false; });
      invalidatePreview(root);
    });
    root.querySelector(".ncst-mm-students").addEventListener("change", function () { invalidatePreview(root); });
    subjectInput.addEventListener("input", function () { invalidatePreview(root); });
    bodyInput.addEventListener("input", function () { invalidatePreview(root); });
    prepare.addEventListener("click", function () {
      prepare.disabled = true;
      preparePreview(root).catch(function (error) {
        setStatus(root, error && error.message || "Could not prepare messages.", true);
      }).finally(function () { prepare.disabled = false; });
    });
    insert.addEventListener("click", function () {
      try {
        if (!previewMessages.length) throw new Error("Prepare a preview first.");
        setComposeMessage(previewMessages[0].subject, previewMessages[0].body);
        setStatus(root, "Inserted the first personalized preview into Canvas Compose.", false);
      } catch (error) {
        setStatus(root, error && error.message || "Could not insert into Compose.", true);
      }
    });
    send.addEventListener("click", function () {
      sendPrepared(root).catch(function (error) {
        send.disabled = false;
        setStatus(root, error && error.message || "Could not send messages.", true);
      });
    });

    renderTemplateList(root);
    fillTemplateEditor(root, selectedTemplate());
    loadCourses(root).catch(function (error) {
      setStatus(root, error && error.message || "Could not load courses.", true);
    });
  }

  function updateFloatingButton() {
    activeCompose = findComposeDialog();
    var button = document.getElementById(BUTTON_ID);
    if (!activeCompose) {
      if (button) button.remove();
      var root = document.getElementById(ROOT_ID);
      if (root) root.remove();
      return;
    }
    if (button) return;
    injectStyles();
    button = h("button", { id: BUTTON_ID, type: "button", text: "Saved Messages" }, []);
    button.addEventListener("click", function () {
      if (!document.getElementById(ROOT_ID)) buildPanel();
    });
    document.body.appendChild(button);
  }

  var observer = new MutationObserver(function () {
    window.clearTimeout(window.__ncstMailMergeObserverTimer);
    window.__ncstMailMergeObserverTimer = window.setTimeout(updateFloatingButton, 120);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("popstate", updateFloatingButton);
  window.setInterval(updateFloatingButton, 1500);
  updateFloatingButton();
})();
