# CNCF Exams Drill

A local-only, ordered practice app for CNCF ecosystem multiple-choice exams.
The first bundled exam is CCA. There is no authentication, server-side
database, or deployment requirement.

> **Unofficial community project.** This project is not affiliated with or
> endorsed by the Cloud Native Computing Foundation, The Linux Foundation, or
> the Cilium project. Do not contribute questions reconstructed from an actual
> certification exam. All practice questions must be independently authored
> from public documentation and published exam domains.

## Features

- Full practice starts at question one and follows JSON order.
- Review includes only questions not marked as mastered.
- Answers remain editable until **Submit answer**, then become locked.
- Correctness and an explanation appear immediately after submission.
- Questions, choices, and explanations switch together between English and
  Japanese; the preference is saved.
- Questions, choices, and explanations support GitHub-flavored Markdown.
- The result screen shows the score and percentage.
- Responsive layouts and keyboard-accessible controls are included.

## Run locally

Node.js 22.13 or newer is required.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Quality checks:

```bash
npm run typecheck
npm run lint
npm test
```

## CCA question data

The bundled [`app/data/cca.json`](app/data/cca.json) contains 120 independently
authored CCA practice questions. Questions render in the exact order in this
array. Edit this file when correcting or extending the question set.

Each question uses this shape:

```json
{
  "id": "cca-001",
  "topic": "Architecture",
  "question": {
    "en": "Question text with **Markdown** support",
    "ja": "**Markdown**対応の問題文"
  },
  "choices": [
    { "id": "a", "text": { "en": "First choice", "ja": "選択肢1" } },
    { "id": "b", "text": { "en": "Second choice", "ja": "選択肢2" } },
    { "id": "c", "text": { "en": "Third choice", "ja": "選択肢3" } },
    { "id": "d", "text": { "en": "Fourth choice", "ja": "選択肢4" } }
  ],
  "correctChoiceId": "b",
  "explanation": {
    "en": "English explanation.",
    "ja": "日本語の解説。"
  }
}
```

Important authoring rules:

- Keep every question `id` unique and stable. Mastery is saved by this ID.
- Provide exactly four choices with unique IDs.
- Set `correctChoiceId` to one of those four choice IDs.
- Provide both `en` and `ja` text for every question, choice, and explanation.
- Use fenced code blocks, inline code, lists, tables, and links as needed.

[`schemas/exam.schema.json`](schemas/exam.schema.json) is referenced from the
CCA JSON file, so compatible editors can report structural mistakes while the
content is being edited. The app also validates data at startup and reports
duplicate IDs or invalid correct-answer references.

## Local persistence

Only the following values are stored in `localStorage`:

- mastered question IDs, separately namespaced by exam ID;
- the latest English/Japanese content preference.

Answers and scores are not persisted. Starting a new session always begins at
the first applicable question. The **Reset mastered questions** action clears
CCA mastery only after confirmation.

Because storage is browser-local, progress is not shared with another browser,
browser profile, or device. Clearing site data also clears the saved progress.

## License and trademarks

The code and original practice content in this repository are available under
the [MIT License](LICENSE).

CNCF, Cilium, and related names are trademarks of their respective owners. Use
of these names identifies the technologies and certifications covered by this
independent study tool and does not imply endorsement. See the
[Linux Foundation Trademark Usage Guidelines](https://www.linuxfoundation.org/trademark-usage).

## Adding another exam later

Copy the CCA JSON structure into a new file under `app/data`, give the exam and
all questions new stable IDs, then register the validated file in the exam
library UI. The storage helpers already isolate mastery by exam ID, so OTCA and
other exams will not share progress with CCA.
