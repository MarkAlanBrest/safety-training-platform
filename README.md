# Career Safety Training

A Next.js training platform with course-code enrollment, AI-generated lessons,
interactive assessments, learner progress tracking, and completion certificates.

## Local setup

```bash
npm install
npm run db:setup
npm run dev
```

Copy `.env.example` to `.env`, replace its placeholders with the Neon PostgreSQL
connection string, and set `ADMIN_EMAIL` / `ADMIN_PASSWORD` for the first admin
account. Use Neon's **pooled** connection string as `DATABASE_URL` on Vercel.
Then open `http://localhost:3000`. `npm run db:setup` synchronizes the schema,
creates the admin user, and installs demo courses.

## AI-generated lessons

Training Studio is available at `/admin/courses`. Create a course by uploading one
PDF for each section. The backend stores the source PDF in PostgreSQL and uses
the OpenAI Responses API to create a source-grounded lesson plan with teaching
moments, questions, scenarios, and references to useful PDF pages.

AI Classroom courses are built at `/admin/classroom/new` from PowerPoint decks.
The platform generates instructor-led activities, live chat, questions, and
final assessments.

Add `OPENAI_API_KEY` to `.env` to enable lesson generation and live student
questions. The same key enables natural instructor narration through the speech
endpoint. The classroom preview at `/training/demo` works without an API key and
falls back to the device voice when natural audio is unavailable.

## Administration

The administration area is available at `/admin/login`. After signing in, an
administrator can create training programs, manage AI classroom courses, generate
enrollment codes, view learner rosters, and remove records.

## Canvas LMS alerts

Students launch `/canvas` from an **LTI tool** in Canvas. The server uses your admin API
token to read that student's missing assignments and grades.

**Env vars:** `CANVAS_BASE_URL`, `CANVAS_API_TOKEN`, `CANVAS_LTI_CLIENT_ID`,
`NEXT_PUBLIC_APP_ORIGIN`, `CANVAS_SESSION_SECRET`

**Canvas developer key (LTI 1.3):**
- Login URL: `https://your-app.com/api/lti/login`
- Redirect URI / Target link: `https://your-app.com/api/lti/launch`
- Custom fields: `user_id` = `$Canvas.user.id` and `course_id` = `$Canvas.course.id`
  (without `course_id`, Canvas's launch payload has no reliable numeric course id and
  course-scoped features like the home page embed will fail with confusing 404s)
- Install the key account-wide or per course, then add the tool to course navigation.

For local testing without LTI, set `CANVAS_DEV_USER_ID` to a real Canvas user id.

## Database

The application uses Neon PostgreSQL through Prisma's serverless Neon adapter.
The same database can be used for local development and a Vercel deployment.
