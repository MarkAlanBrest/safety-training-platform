(function () {
  if (!window.ENV?.current_user_id) return;
  if (document.getElementById("ncst-student-alerts-banner")) return;

  var script = document.currentScript;
  var appOrigin = script && script.src
    ? script.src.replace(/\/canvas-banner\.js(?:\?.*)?$/, "")
    : "";
  var configUrl = appOrigin ? appOrigin + "/api/canvas/banner-config" : "/api/canvas/banner-config";

  function isDashboardPage() {
    var path = window.location.pathname || "/";
    return path === "/" || path === "/dashboard";
  }

  function getCourseHomeId() {
    var match = (window.location.pathname || "").match(/^\/courses\/(\d+)\/?$/);
    return match ? match[1] : null;
  }

  function shouldShowBanner(config) {
    if (!config.enabled) return false;
    var showOn = config.showOn || "all";
    if (showOn === "all") return isDashboardPage() || Boolean(getCourseHomeId());
    if (showOn === "course_home") return Boolean(getCourseHomeId());
    if (showOn === "dashboard") return isDashboardPage();
    return false;
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

  function renderBanner(parts, link, teacherMessage) {
    var banner = document.createElement("div");
    banner.id = "ncst-student-alerts-banner";
    banner.setAttribute("role", "alert");
    banner.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:999999;" +
      "background:linear-gradient(90deg,#ed1c24,#ff5a1f);color:#fff;" +
      "padding:18px 24px;font-size:20px;font-weight:800;text-align:center;" +
      "box-shadow:0 6px 24px rgba(0,0,0,.35);font-family:system-ui,sans-serif;" +
      "animation:ncst-banner-pulse 1.4s ease-in-out infinite;";

    var style = document.createElement("style");
    style.textContent =
      "@keyframes ncst-banner-pulse{0%,100%{filter:brightness(1)}50%{filter:brightness(1.08)}}" +
      "#ncst-student-alerts-banner a{color:#fff;text-decoration:underline;font-weight:900}";
    document.head.appendChild(style);

    var html = "";
    if (teacherMessage) {
      html += '<div style="margin-bottom:6px">' + teacherMessage + "</div>";
    }
    if (parts.length) {
      html += parts.join(" &nbsp;|&nbsp; ");
      if (link) {
        html += ' &nbsp;—&nbsp; <a href="' + link + '">VIEW NOW</a>';
      }
    }

    banner.innerHTML = html;
    document.body.prepend(banner);
    document.body.style.marginTop = teacherMessage && parts.length ? "88px" : "64px";
  }

  fetch(configUrl)
    .then(function (response) {
      return response.ok ? response.json() : null;
    })
    .then(function (config) {
      config = config || {
        enabled: true,
        showOn: "all",
        lowGradeThreshold: 70,
        showMissing: true,
        showLowGrades: true,
        missingWorkDays: 14,
      };

      if (!shouldShowBanner(config)) return;

      var courseId = getCourseHomeId();
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
              "⚠️ " + missing.length + " MISSING ASSIGNMENT" + (missing.length === 1 ? "" : "S"),
            );
          }
          if (lowGrades.length) {
            parts.push("📉 " + lowGrades.length + " LOW GRADE" + (lowGrades.length === 1 ? "" : "S"));
          }

          if (!teacherMessage && !parts.length) return;

          var linkCourseId =
            courseId ||
            (missing[0] && missing[0].course_id) ||
            (lowGrades[0] && lowGrades[0].course_id) ||
            "";
          var link = linkCourseId ? "/courses/" + linkCourseId + "/grades" : "";

          renderBanner(parts, link, teacherMessage);
        });
      });
    });
})();
