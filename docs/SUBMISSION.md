# Submission checklist

**Hard deadline 16:00 GMT. Our target: submitted by 15:40** (20 minutes of buffer). Feature freeze 15:10. Stage demos 16:30.

What the event asks for (from the event page and the team's planning notes): the submission goes in **via GitHub or Kaggle**. *Not verified from a primary page by DOCS:* the exact form fields (track, team name box, video link), whether a demo video is required, and any IP or licence terms for submissions. **Open the event/submission page and confirm each field before 15:25.** If anything below conflicts with the event page, the event page wins.

We submit a **GitHub repository**: `https://github.com/suhaanm/deepmind-hackathon` (remote `origin`, branch `main`). If you submit through Kaggle, follow the event page's instructions and link this repo plus the README; do not duplicate the code.

## Checklist (tick as you verify; the right-hand column is how)

| # | Item | How to verify |
|---|---|---|
| 1 | **Repo is public** (it is **private** right now) | `gh repo view suhaanm/deepmind-hackathon --json visibility` prints `PUBLIC`; open the URL in a private window while logged out |
| 2 | **README** renders: pitch, problem with sourced stat, what it does, why Argon, diagrams, quickstart, limitations, credits | Open the repo page; the two mermaid diagrams must draw (if not, the text above each still stands) |
| 3 | **`.env` is not committed and is ignored** | `git check-ignore -v .env` prints a `.gitignore` rule; `git ls-files .env` prints nothing |
| 4 | **No secrets anywhere in history** | Run the scan below: it must print `0` |
| 5 | **`.env.example` has no real key** | `grep '^GEMINI_API_KEY=' .env.example` shows an empty value |
| 6 | **Builds and tests pass from a clean clone** | In a fresh folder: `git clone <repo> && cd deepmind-hackathon && npm install && npm run typecheck && npm test && npm run build` |
| 7 | **Licence file** exists | `ls LICENSE`; the team picks a licence (open point: README says `LICENSE TBD (user to confirm)`). See "Licence" below |
| 8 | **Third-party notices** complete | `THIRD_PARTY_NOTICES.md` lists every `Adapted from` file (check: `grep -rn "Adapted from" src apps scripts`); Sentient OS (AGPL) is listed as "not used" |
| 9 | **Team names** in the README | The README has a Team line; confirm every member is named (open point: names not yet supplied to DOCS) |
| 10 | **Demo video fallback recorded** (60-90 s, with sound) | Recorded with `ALONGSIDE_OVERLAY_CAPTURABLE=1 npm run dev` so arrows show; plays from the presenting laptop and the second laptop; link it in the README or the form if the event allows |
| 11 | **Nothing large or private committed** | `git ls-files | wc -l` is a few hundred; no `node_modules`, `.userdata*`, audio, screenshots of real people; `git count-objects -vH` size is modest |
| 12 | **Real-user evidence** (if you have it) is consented and trimmed | `docs/evidence/*` reviewed per `docs/USER_TEST_KIT.md`; otherwise leave it out of the repo |
| 13 | **Claims match the build** | README "Why Argon" and `docs/DEMO_SCRIPT.md` list only things that are live in the build; anything mocked is labelled |
| 14 | **Submit** on the page (GitHub link / Kaggle) and screenshot the confirmation | Save the commit SHA you submitted: `git rev-parse HEAD` |

### Read-only verification commands

```bash
cd <repo root>

# 3. .env ignored and untracked
git check-ignore -v .env
git ls-files .env                      # must print nothing

# 4. secrets: any Google API key shaped string in the working tree (excluding .env) and in every commit
grep -rIlE 'AIza[0-9A-Za-z_-]{30,}' . --exclude-dir=node_modules --exclude-dir=.git --exclude=.env
for c in $(git rev-list --all); do git grep -IlE 'AIza[0-9A-Za-z_-]{30,}' "$c"; done | wc -l    # expect 0
git log --all --name-only --pretty=format: | grep -E '(^|/)\.env($|\.)' | sort -u            # only .env.example is OK

# 6. quality gate
npm run typecheck && npm test && npm run build
```

(These print file names or counts only, never the secret.)

## Commit and push steps (for the user; DOCS does not run them)

State when this was written: one commit (`bb56f5d`, "WIP: Alongside scaffold, contracts and first modules") is already on `origin/main`; later work is uncommitted. The repo is private.

```bash
cd <repo root>

# a) See what you are about to commit; make sure .env is not in the list
git status --short
git check-ignore -v .env                       # must print a rule; if it prints nothing STOP

# b) Stage, then double-check the staged list for secrets or junk
git add -A
git diff --cached --name-only | grep -E '(^|/)\.env$' && echo "STOP: .env is staged" || echo "ok: .env not staged"
git diff --cached --name-only | grep -E 'node_modules|\.userdata|\.wav$|\.aiff$|\.log$' && echo "STOP: junk staged" || echo "ok: no junk"

# c) Commit and push
git commit -m "Alongside: final submission (docs, demo script, test kit, notices)"
git push origin main

# d) Make the repo public (required for submission) and check it
gh repo edit suhaanm/deepmind-hackathon --visibility public --accept-visibility-change-consequences
gh repo view suhaanm/deepmind-hackathon --json visibility,url
git rev-parse HEAD                              # note the SHA you submit
```

If the push is rejected (someone pushed from another machine): `git fetch origin && git status`, then `git pull --rebase origin main` and push again. Do **not** `git push --force` unless you know exactly what you are overwriting.

**If a secret was ever committed:** rotate the key first (Google AI Studio), then fix the repo. Because history is short, the safest repair is to delete and recreate the GitHub repo from a clean commit. Do not leave a leaked key live in the meantime.

**Editing after the push:** you can push again any time before 16:00; tell the form which commit you submit. Do not change the README claims after the demo run without re-checking them.

## Licence

Our own licence is an open decision for the user (`LICENSE TBD (user to confirm)`); DOCS has deliberately not added a `LICENSE` file. Constraints: we adapted MIT code from Clicky (keep its notice, done in `THIRD_PARTY_NOTICES.md`), we reused Google's example code (that repository has **no LICENSE file**, so say so, as the notices file does), and we took **nothing** from Sentient OS (AGPL-3.0), so we are free to choose. **MIT is the simplest choice**, because the code we adapted is MIT; Apache-2.0 would also be compatible with everything we included. Also check the hackathon's own IP or licence terms for submissions (the Luma page listed none). Then:

```bash
# example for MIT: copy the standard text into LICENSE with the right year and holders
printf 'MIT License\n\nCopyright (c) 2026 <team names>\n' > LICENSE   # then paste the full MIT text below this line
```

and replace the placeholder line in `README.md` ("Alongside's own code") with the chosen licence.

## What to have open at 15:25

Event submission page, this checklist, the GitHub repo URL in a logged-out window, the fallback video file, and the team's names spelled correctly.
