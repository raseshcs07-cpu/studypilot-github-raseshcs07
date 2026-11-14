# StudyPilot: planning, assistant, and classroom tools

## What will change
- Generate a balanced two-week schedule that covers all of a student's subjects and unfinished topics, adds revision for every relevant upcoming exam, respects study-hour and weekly-day-off settings, and replaces only future planned sessions.
- Add a StudyPilot assistant that students can open from any signed-in page, with short scannable answers, a full-screen chat area, separate account-saved conversations, pinned chats, and two-way spoken conversation.
- Add school roles and a classroom area for separate student and teacher accounts. Only the designated owner account can appoint school admins; school admins assign teachers and students. Teachers record attendance, review student assignment submissions, and share organized study resources including notes, assignments, syllabi, topics, and questions with answers.
- Add the supplied GitHub credit link to the app.

## How it will work
- Preserve the current StudyPilot pages and account setup. Add protected classroom and assistant screens, with clear access-specific controls and student-safe views.
- Store classroom memberships, attendance, assignment work, shared resources, chat threads, chat messages, and pinned-chat state in Lovable Cloud, with row-level access rules for each user role and teacher–student assignment.
- Keep AI requests and voice-session setup on the server. Use the supported Lovable AI Gateway SDK and the workspace's approved models; render readable assistant messages and persist complete chat history per conversation.
- Update the help page with the new study, chat, and classroom flows.

## Technical details
- Add the required classroom and conversation tables through a single reviewed Cloud migration, with explicit grants, row-level security, and owner/teacher/student checks.
- Record account roles separately from editable profile fields; validate school-owner and classroom permissions in server handlers as well as database policies.
- Use dedicated `/assistant` conversation URLs so a saved conversation can be reopened or refreshed without losing its identity.
- Preserve existing AI model choices for planning and tutoring unless a new capability needs its own model; verify model availability and generated SDK types before adding calls.
- Check the preview build, lint, and the signed-in screens. Test schedules for multiple subjects/exams and review classroom access boundaries.

## Requirements supplied
- Chat history: separate conversations saved to the account.
- School roles: separate accounts, assigned by a school admin; only the named owner may appoint admins.
- GitHub credit: https://github.com/raseshcs07-cpu.
- Assistant style: concise, easy to read; spoken voice has no specified presentation preference.