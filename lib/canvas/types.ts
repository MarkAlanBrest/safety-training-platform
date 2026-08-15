export type CanvasConfig = {
  baseUrl: string;
  token: string;
};

export type CanvasUser = {
  id: number;
  name: string;
  short_name: string;
  avatar_url?: string;
  primary_email?: string;
  last_login?: string | null;
};

export type CanvasCourse = {
  id: number;
  name: string;
  course_code: string;
};

export type CanvasEnrollment = {
  id: number;
  type: string;
  enrollment_state: string;
  course_id: number;
  last_activity_at?: string | null;
  last_attended_at?: string | null;
  course?: CanvasCourse;
  grades?: {
    current_score?: number | null;
    current_grade?: string | null;
    final_score?: number | null;
    final_grade?: string | null;
    current_points?: number | null;
  };
  computed_current_score?: number | null;
  computed_final_score?: number | null;
};

export type CanvasMissingSubmission = {
  id: number;
  name: string;
  course_id: number;
  due_at: string | null;
  html_url: string;
  points_possible?: number | null;
  submission?: {
    workflow_state?: string;
    missing?: boolean;
    late?: boolean;
    submitted_at?: string | null;
  };
};

export type CanvasPlannerItem = {
  plannable_id: number;
  plannable_type: string;
  plannable: {
    id: number;
    title: string;
    due_at?: string | null;
    course_id?: number;
    points_possible?: number | null;
    html_url?: string;
  };
  context_type: string;
  context_name?: string;
  html_url?: string;
};

export type CanvasAssignment = {
  id: number;
  name: string;
  due_at?: string | null;
  points_possible?: number | null;
  html_url?: string;
  published?: boolean;
  submission?: {
    id?: number;
    score?: number | null;
    excused?: boolean;
    workflow_state?: string;
    missing?: boolean;
    submitted_at?: string | null;
  } | null;
};

export type AlertSeverity = "critical" | "warning" | "info";

export type CanvasAlert = {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  courseName: string;
  courseId: number;
  dueAt: string | null;
  link: string;
  kind: "missing" | "due_soon" | "low_grade" | "assignment_low_grade" | "login" | "late";
  score?: number | null;
  grade?: string | null;
};

export type CanvasAlertSummary = {
  user: CanvasUser;
  alerts: CanvasAlert[];
  enrollments: Array<{
    courseId: number;
    courseName: string;
    courseCode: string;
    currentScore: number | null;
    currentGrade: string | null;
    finalScore: number | null;
    finalGrade: string | null;
  }>;
  counts: {
    critical: number;
    warning: number;
    info: number;
    missing: number;
    dueSoon: number;
    lowGrades: number;
  };
  fetchedAt: string;
};
