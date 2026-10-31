# Interactive demo: ~90 seconds, live voice, practice desktop

You talk to the real assistant (Marcus) on the built-in practice desktop. Nothing here is scripted on the app side: the app reacts to what you say and click. Ask `main` to "start the interactive demo" before you go on. The profile is seeded so the video call starts at "Walk with me" (level 2), which is what makes the fade visible.

**Keys on the practice desktop:** `S` delivers the scam text, `G` a genuine text, `Shift+R` resets the desktop, `F` toggles fullscreen. **If the wake word is flaky in the room:** press `Cmd+Alt+Space` instead of saying "Hey Marcus". **If speech is misheard:** menu-bar item, "Type instead", and type the same line.

| Time | You say or do | What the audience sees and hears | The teaching point to land |
|---|---|---|---|
| 0:00 | To the room: "Millions of people get left behind by technology. Alongside is a helper that teaches, so one day they stop needing it." Then: **"Hey Marcus."** | Listening light, the helper greets in one short sentence and asks what you would like to do. | It listens only when called, and it is a patient person-like helper, not a search box. |
| 0:10 | **"I want to video call my granddaughter Lily."** Then click what it points at: the VideoChat icon, Lily, Start call, Join. | A numbered ring on each target, a tick after each correct click. After two clean steps the level chip drops from **Walk with me** to **Nudge me** and the rings stop. | **Help fades as you get it right.** Say: "Watch the chip: it just took a step back because I did two steps without help." |
| 0:40 | Press **`S`**, click **Open** on the notification so the full text is on screen. Say: **"Marcus, can you check this message for me?"** | A "checking" chip with progress, then about 10 s later the helper speaks two short sentences and the worrying phrases are marked in red (urgent wording, the lookalike link, the two-hour threat). It never says "safe" and points to the number on the back of your bank card. | **The marks are the lesson:** "It is teaching me how to spot this myself, not just blocking it." |
| 1:05 | **"Marcus, where is the Settings app?"** | A ring and arrow land on the Settings icon within a couple of seconds. | **Show, don't tell:** it points instead of reading out a list of steps. |
| 1:15 | **"Marcus, how am I doing?"** (or open Progress from the panel) | It names what you can do now and recalls last time; the panel shows the hints-per-task chart going down. | **The success metric is fewer hints.** Say: "Success means it makes itself unnecessary." |
| 1:25 | **"Hey Amelia, goodbye."** | The voice and accent colour change to the second helper, it says goodbye, and the session ends; the listening light goes off. | Two helpers, your choice, and **you are always in control: Stop works at any time** (`Cmd+Alt+M`). |

## Extras if you have 30 more seconds
- **"Marcus, can you open the Age UK website for me?"** (name the site: a bare "open the website" makes the model ask which one; agency is on, so it asks once on the top-right toast; click it). Teaching line: "It offers to do it or show me, and it counts how often it did it for me so dependence stays visible."
- **"Marcus, where did I save my GP letter?"** (files search over the sample folder, only if you enabled files).
- **Type instead:** menu bar, "Type instead", type "make the text bigger" (shows the dyslexia-friendly option).

## If something goes wrong (say this, then use the fallback)
- Wake word not heard: "Let me use the shortcut" and press `Cmd+Alt+Space`.
- The assistant talks over you: say "stop" or press `Cmd+Alt+M`, then start again with the shortcut.
- Scam text did not appear: press `S` again, or `Shift+R` and `S`.
- A step is not recognised: click anyway and say "done"; it re-checks the screen.
- To rerun the whole demo with the fade: ask `main` to restart the interactive demo (it re-seeds the profile).

## Honest limits to mention if asked
Voice latency is about a second; the scam result takes about ten seconds because three specialist models and Argon check it; multi-step browser control is verified for one real task only; the practice desktop is a stand-in for a real computer.
