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

Students can connect their Canvas account at `/canvas` to see missing assignments,
low grades, and due-soon work with high-visibility alerts and optional desktop
notifications.

1. Open `/canvas`.
2. Enter your school's Canvas URL (for example, `yourschool.instructure.com`).
3. Create a personal access token in Canvas under Account → Settings → Approved Integrations.
4. Paste the token to connect.

Canvas credentials are stored in an encrypted browser session cookie only. They are
not written to the database. Set `CANVAS_SESSION_SECRET` in production.

## Database

The application uses Neon PostgreSQL through Prisma's serverless Neon adapter.
The same database can be used for local development and a Vercel deployment.
