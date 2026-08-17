(function () {
  if (!window.ENV?.current_user_id) return;
  if (document.getElementById("ncst-student-alerts-popup")) return;

  var script = document.currentScript;
  var appOrigin = script && script.src
    ? script.src.replace(/\/canvas-banner\.js(?:\?.*)?$/, "")
    : "";
  var configUrl = appOrigin ? appOrigin + "/api/canvas/banner-config" : "/api/canvas/banner-config";
  var storagePrefix = "ncst-student-alerts-dismissed:";

  function isDashboardPage() {
    var path = window.location.pathname || "/";
    return path === "/" || path === "/dashboard";
  }

  function getCourseHomeId() {
    var match = (window.location.pathname || "").match(/^\/courses\/(\d+)\/?$/);
    return match ? match[1] : null;
  }

  function shouldShowPopup(config) {
    if (!config.enabled) return false;
    var showOn = config.showOn || "course_home";
    if (showOn === "all") return isDashboardPage() || Boolean(getCourseHomeId());
    if (showOn === "course_home") return Boolean(getCourseHomeId());
    if (showOn === "dashboard") return isDashboardPage();
    return false;
  }

  function wasDismissed(courseId) {
    try {
      return window.sessionStorage.getItem(storagePrefix + courseId) === "1";
    } catch (error) {
      return false;
    }
  }

  function markDismissed(courseId) {
    try {
      window.sessionStorage.setItem(storagePrefix + courseId, "1");
    } catch (error) {
      // Ignore storage failures.
    }
  }

  function loadAll(path) {
    var results = [];
    var url = path + (path.indexOf("?") >= 0 ? "&" : "?") + "per_page=50";

    function fetchPage(nextUrl) {
      return fetch(nextUrl, { credentials: "same-origin" }).then(function (response) {
        if (!response.ok) return results;
        return response.json().then(function (page) {
          results = results.concat(page);
          var link = response.headers.get("link");
          if (!link) return results;
          var match = link.split(",").find(function (part) {
            return part.indexOf('rel="next"') >= 0;
          });
          if (!match) return results;
          var urlMatch = match.match(/<([^>]+)>/);
          if (!urlMatch) return results;
          return fetchPage(urlMatch[1]);
        });
      });
    }

    return fetchPage(url).catch(function () {
      return results;
    });
  }

  function isWithinMissingWindow(dueAt, missingWorkDays) {
    if (!dueAt) return true;
    var due = new Date(dueAt).getTime();
    if (Number.isNaN(due)) return true;
    var cutoff = Date.now() - missingWorkDays * 24 * 60 * 60 * 1000;
    return due >= cutoff;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderPopup(options) {
    var overlay = document.createElement("div");
    overlay.id = "ncst-student-alerts-popup";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:999999;background:rgba(3,8,18,.72);" +
      "display:flex;align-items:center;justify-content:center;padding:24px;" +
      "font-family:system-ui,sans-serif;";

    var modal = document.createElement("div");
    modal.style.cssText =
      "width:min(560px,100%);border-radius:22px;padding:28px;color:#fff;" +
      "background:linear-gradient(180deg,#111f35 0%,#0a1424 100%);" +
      "border:1px solid rgba(255,255,255,.12);box-shadow:0 28px 80px rgba(0,0,0,.45);";

    var html = '<h2 style="margin:0 0 12px;font-size:2rem;color:#f6d27b;">Reminder</h2>';

    if (options.teacherMessage) {
      html +=
        '<p style="margin:0 0 14px;font-size:1.15rem;font-weight:800;line-height:1.5;">' +
        escapeHtml(options.teacherMessage) +
        "</p>";
    }

    if (options.parts.length) {
      html +=
        '<div style="margin:0 0 14px;padding:16px 18px;border-radius:12px;background:linear-gradient(90deg,#ed1c24,#ff5a1f);font-size:1.05rem;font-weight:800;line-height:1.5;">' +
        escapeHtml(options.parts.join(" · ")) +
        "</div>";
    }

    if (options.link) {
      html +=
        '<p style="margin:0 0 18px;"><a href="' +
        options.link +
        '" style="color:#f6d27b;font-weight:800;">View grades</a></p>';
    }

    html +=
      '<button type="button" id="ncst-student-alerts-dismiss" style="border:0;border-radius:14px;padding:14px 22px;background:linear-gradient(135deg,#ed1c24,#ff5a1f);color:#fff;font-weight:800;cursor:pointer;">Got it</button>';

    modal.innerHTML = html;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function dismiss() {
      if (options.courseId) markDismissed(options.courseId);
      overlay.remove();
    }

    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) dismiss();
    });

    var button = document.getElementById("ncst-student-alerts-dismiss");
    if (button) button.addEventListener("click", dismiss);
  }

  fetch(configUrl)
    .then(function (response) {
      return response.ok ? response.json() : null;
    })
    .then(function (config) {
      config = config || {
        enabled: true,
        showOn: "course_home",
        lowGradeThreshold: 70,
        showMissing: true,
        showLowGrades: true,
        missingWorkDays: 14,
      };

      if (!shouldShowPopup(config)) return;

      var courseId = getCourseHomeId();
      if (courseId && wasDismissed(courseId)) return;

      var courseConfigPromise = courseId && appOrigin
        ? fetch(appOrigin + "/api/course-alerts/public-config?courseId=" + encodeURIComponent(courseId))
            .then(function (response) {
              return response.ok ? response.json() : null;
            })
            .catch(function () {
              return null;
            })
        : Promise.resolve(null);

      return courseConfigPromise.then(function (courseConfig) {
        var lowGradeThreshold =
          (courseConfig && courseConfig.lowGradeThreshold) || config.lowGradeThreshold || 70;
        var missingWorkDays =
          (courseConfig && courseConfig.missingWorkDays) || config.missingWorkDays || 14;
        var showMissing =
          courseConfig && courseConfig.showMissing === false
            ? false
            : config.showMissing !== false;
        var showLowGrades =
          courseConfig && courseConfig.showLowGrades === false
            ? false
            : config.showLowGrades !== false;
        var teacherMessage = courseConfig && courseConfig.bannerMessage ? courseConfig.bannerMessage : "";

        return Promise.all([
          showMissing
            ? loadAll("/api/v1/users/self/missing_submissions?filter[]=submittable")
            : Promise.resolve([]),
          showLowGrades
            ? loadAll(
                "/api/v1/users/self/enrollments?state[]=active&type[]=StudentEnrollment&include[]=current_points",
              )
            : Promise.resolve([]),
        ]).then(function (data) {
          var missing = data[0] || [];
          var enrollments = data[1] || [];

          if (courseId) {
            var courseNumeric = Number(courseId);
            missing = missing.filter(function (item) {
              return (
                item.course_id === courseNumeric &&
                isWithinMissingWindow(item.due_at, missingWorkDays)
              );
            });
            enrollments = enrollments.filter(function (item) {
              return item.course_id === courseNumeric;
            });
          }

          var lowGrades = enrollments.filter(function (enrollment) {
            var score =
              (enrollment.grades && enrollment.grades.current_score) != null
                ? enrollment.grades.current_score
                : enrollment.computed_current_score;
            return score != null && score < lowGradeThreshold;
          });

          var parts = [];
          if (missing.length) {
            parts.push(
              missing.length + " missing assignment" + (missing.length === 1 ? "" : "s"),
            );
          }
          if (lowGrades.length) {
            parts.push(lowGrades.length + " low grade" + (lowGrades.length === 1 ? "" : "s"));
          }

          if (!teacherMessage && !parts.length) return;

          var linkCourseId =
            courseId ||
            (missing[0] && missing[0].course_id) ||
            (lowGrades[0] && lowGrades[0].course_id) ||
            "";
          var link = linkCourseId ? "/courses/" + linkCourseId + "/grades" : "";

          renderPopup({
            teacherMessage: teacherMessage,
            parts: parts,
            link: link,
            courseId: courseId || "",
          });
        });
      });
    });
})();

(function () {
  if (!window.ENV?.current_user_id) return;
  if (window.ENV?.current_user_is_student) return;

  var MARKER_ID = "ncst-email-alerts-home-button";
  var script = document.currentScript;
  var appOrigin = script && script.src
    ? script.src.replace(/\/canvas-banner\.js(?:\?.*)?$/, "")
    : "";

  function isCourseHomePage() {
    return /^\/courses\/\d+\/?$/.test(window.location.pathname || "");
  }

  function isTeacher() {
    if (window.ENV?.current_user_is_student) return false;
    var roles = window.ENV?.current_user_roles || [];
    return Boolean(
      window.ENV?.current_user_is_admin ||
      roles.indexOf("teacher") >= 0 ||
      roles.indexOf("ta") >= 0 ||
      roles.indexOf("designer") >= 0 ||
      roles.indexOf("admin") >= 0
    );
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function isStudentAlertsLink(link) {
    return /^set student alerts$/i.test(normalizeText(link.textContent));
  }

  function findStudentAlertsLink() {
    var selectors = [
      "#course_home_content a",
      "#content a",
      ".ic-app-main-content a",
      "a.btn",
      "a[href*='external_tools']",
    ];

    for (var selectorIndex = 0; selectorIndex < selectors.length; selectorIndex += 1) {
      var links = document.querySelectorAll(selectors[selectorIndex]);
      for (var linkIndex = 0; linkIndex < links.length; linkIndex += 1) {
        if (isStudentAlertsLink(links[linkIndex])) return links[linkIndex];
      }
    }

    return null;
  }

  function buildEmailAlertsHref(studentLink, courseId) {
    var href = studentLink.getAttribute("href") || "";
    if (!href) return "#";

    if (href.indexOf("placement=alert_settings") >= 0) {
      return href.replace(/placement=alert_settings/g, "placement=email_alerts");
    }
    if (href.indexOf("placement%3Dalert_settings") >= 0) {
      return href.replace(/placement%3Dalert_settings/g, "placement%3Demail_alerts");
    }

    try {
      var absolute = new URL(href, window.location.origin);
      var embedded = absolute.searchParams.get("url");
      if (embedded) {
        var launch = new URL(embedded, window.location.origin);
        launch.searchParams.set("placement", "email_alerts");
        absolute.searchParams.set("url", launch.toString());
        return absolute.pathname + absolute.search + absolute.hash;
      }
    } catch (error) {
      // Fall through to default launch URL.
    }

    if (!appOrigin || !courseId) return href;
    var launchUrl = appOrigin.replace(/\/+$/, "") + "/api/lti/launch?placement=email_alerts";
    return (
      "/courses/" +
      encodeURIComponent(courseId) +
      "/external_tools/retrieve?placement=course_home_sub_navigation&url=" +
      encodeURIComponent(launchUrl)
    );
  }

  function insertBelow(referenceNode, newNode) {
    var parent = referenceNode.parentNode;
    if (!parent) return false;

    if (window.getComputedStyle(parent).display.indexOf("flex") >= 0) {
      var breaker = document.createElement("span");
      breaker.className = "ncst-email-alerts-flex-break";
      breaker.setAttribute("aria-hidden", "true");
      breaker.style.cssText = "flex-basis:100%;width:0;height:0;overflow:hidden;";
      parent.insertBefore(breaker, referenceNode.nextSibling);
      parent.insertBefore(newNode, breaker.nextSibling);
      return true;
    }

    parent.insertBefore(newNode, referenceNode.nextSibling);
    return true;
  }

  function injectEmailAlertsButton() {
    if (!isCourseHomePage() || !isTeacher()) return;
    if (document.getElementById(MARKER_ID)) return;

    var studentLink = findStudentAlertsLink();
    if (!studentLink) return;

    var courseId = (window.location.pathname.match(/^\/courses\/(\d+)/) || [])[1];
    if (!courseId) return;

    var referenceItem = studentLink.closest("li") || studentLink;
    var clone = referenceItem.cloneNode(true);
    var emailLink = clone.tagName === "A" ? clone : clone.querySelector("a");
    if (!emailLink) return;

    emailLink.id = MARKER_ID;
    emailLink.textContent = "Email Alerts";
    emailLink.setAttribute("aria-label", "Email Alerts");
    emailLink.href = buildEmailAlertsHref(studentLink, courseId);
    emailLink.removeAttribute("data-tool-id");

    insertBelow(referenceItem, clone);
  }

  function watchForHomeButtons() {
    injectEmailAlertsButton();
    var observer = new MutationObserver(function () {
      if (!document.getElementById(MARKER_ID)) injectEmailAlertsButton();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchForHomeButtons);
  } else {
    watchForHomeButtons();
  }
})();
