(function () {
  if (!window.ENV?.current_user_id) return;
  if (document.getElementById("ncst-student-alerts-banner")) return;

  var script = document.currentScript;
  var configUrl = script && script.src
    ? script.src.replace(/\/canvas-banner\.js(?:\?.*)?$/, "/api/canvas/banner-config")
    : "/api/canvas/banner-config";

  function isDashboardPage() {
    var path = window.location.pathname || "/";
    return path === "/" || path === "/dashboard";
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

  fetch(configUrl)
    .then(function (response) {
      return response.ok ? response.json() : null;
    })
    .then(function (config) {
      config = config || { enabled: true, showOn: "dashboard", lowGradeThreshold: 70, showMissing: true, showLowGrades: true };

      if (!config.enabled) return;
      if (config.showOn !== "all" && !isDashboardPage()) return;

      var lowGradeThreshold = config.lowGradeThreshold || 70;

      return Promise.all([
        config.showMissing === false
          ? Promise.resolve([])
          : loadAll("/api/v1/users/self/missing_submissions?filter[]=submittable"),
        config.showLowGrades === false
          ? Promise.resolve([])
          : loadAll("/api/v1/users/self/enrollments?state[]=active&type[]=StudentEnrollment&include[]=current_points"),
      ]).then(function (data) {
        var missing = data[0] || [];
        var enrollments = data[1] || [];
        var lowGrades = enrollments.filter(function (enrollment) {
          var score =
            (enrollment.grades && enrollment.grades.current_score) != null
              ? enrollment.grades.current_score
              : enrollment.computed_current_score;
          return score != null && score < lowGradeThreshold;
        });

        if (!missing.length && !lowGrades.length) return;

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

        var parts = [];
        if (missing.length) {
          parts.push("⚠️ " + missing.length + " MISSING ASSIGNMENT" + (missing.length === 1 ? "" : "S"));
        }
        if (lowGrades.length) {
          parts.push("📉 " + lowGrades.length + " LOW GRADE" + (lowGrades.length === 1 ? "" : "S"));
        }

        var linkCourseId =
          (missing[0] && missing[0].course_id) || (lowGrades[0] && lowGrades[0].course_id) || "";
        var link = linkCourseId ? "/courses/" + linkCourseId + "/grades" : "/";

        banner.innerHTML =
          parts.join(" &nbsp;|&nbsp; ") +
          ' &nbsp;—&nbsp; <a href="' +
          link +
          '">VIEW NOW</a>';

        document.body.prepend(banner);
        document.body.style.marginTop = "64px";
      });
    });
})();
