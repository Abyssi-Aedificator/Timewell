# Timewell

**Make every minute count.**

Timewell is a lightweight timer app for focused work and well-earned breaks. Set a duration or choose the time you want to finish, give your session a title, and track your progress throughout the day.

No account, dependencies, or build step required. Your sessions and preferences stay in your browser.

## Features

- **Focus and break timers** with pause, resume, and an extra-minute button.
- **Quick presets** for 15, 25, 45, or 60 minutes, plus custom hours, minutes, and seconds.
- **Count down to a time** using an Android-style clock dial or keyboard entry, with AM/PM controls. Selecting **Set** starts the timer immediately.
- **Session titles** that appear in your completed session history.
- **Daily progress** showing focus time, completed focus sessions, breaks, and a configurable focus goal.
- **History management** with individual session deletion, clear-all, and JSON export.
- **Completion alerts** with an optional chime and desktop notifications.
- **Tablet-friendly layouts** with balanced columns, larger touch controls, and landscape-aware dialogs.
- **Three interfaces:** Classic, Material 3, and Liquid Glass.
- **Light, dark, and system themes**, with PlayDex's 22 Theme Colour choices.
- **Offline support** after the app has been loaded successfully, and installation where supported.
- **A fresh start at 00:00** whenever you open or reload the app; history and preferences stay saved.

## Getting started

### Run locally

Clone the repository and serve it with Python:

```sh
git clone https://github.com/Abyssi-Aedificator/Timewell.git
cd Timewell
python -m http.server 8080
```

Open [localhost:8080](http://localhost:8080) in your browser. Any static web server can serve the app; there is nothing to install or compile.

### Host with GitHub Pages

Publish the repository root using GitHub Pages or another static host. Keep the HTML, JavaScript, stylesheets, manifest, service worker, and icons together. Relative asset paths support hosting under a subpath such as `/Timewell/`.

Use HTTPS or localhost for service workers and notification permissions. The manifest uses a stable `/Timewell/` app identity so other apps on the same origin can be installed separately; keep this identity unchanged when updating Timewell.

## Using the timer

1. Optionally enter a **Session title**, such as Reading or Project planning.
2. Choose **Focus** or **Break**.
3. Select a preset or enter a custom duration, then press **Start timer**. Alternatively, open **Or set a time to count down to**, select the end time, and press **Set** to start immediately.
4. Pause and resume as needed. **+1 min** extends the countdown.
5. When the timer finishes, the session appears under **History > Your sessions**.

For example, choosing **11 PM** at **10 PM** starts a one-hour countdown. An end time that has already passed uses tomorrow. Pausing the countdown or adding a minute changes its finish time.

**Reset** clears the timer to `00:00` and clears the duration and end-time selections. Resetting an active session asks for confirmation; it does not save an unfinished session.

### Daily focus goal

In **Today, so far**, select **Set daily goal** to choose a target from 1 to 1,440 minutes. Only completed focus sessions contribute to focus time and the goal. Breaks have their own count. Deleting a session updates the totals.

### Appearance

Choose an interface, theme, and Theme Colour in **Settings**:

| Interface | Appearance | Theme Colour choices |
| --- | --- | --- |
| Classic | Navy surfaces, rounded cards, and accent details | Both colour groups |
| Material 3 | Tonal surfaces, pill buttons, and Material controls | First colour group, using Material tonal palettes |
| Liquid Glass | Translucent panels, frosted blur, and a colour-tinted backdrop | Both colour groups |

Grey adapts to light and dark themes. Liquid Glass respects reduced-transparency preferences and uses opaque surfaces when backdrop blur is unavailable. The design and colour palettes are shared with PlayDex.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| Space | Start or pause the timer |
| R | Reset the timer |

Shortcuts apply on the Timer tab when focus is outside a control and no dialog is open. The clock dial supports arrow keys for precise selection, and the picker also offers numeric keyboard entry.

## Data and notifications

Sessions, timer state, and preferences use this browser's local storage. They are not synced across devices or browsers. Clearing site data removes them. Use **History > Export history** to download a JSON copy of your sessions; importing that file is not currently supported.

While the page remains open, the countdown uses a deadline to keep time even when browser updates are delayed. Opening or reloading the app resets the timer to 00:00, including a previously running or paused timer. A closed or suspended browser cannot reliably play sounds or deliver an alarm at the scheduled time. Desktop notifications require permission, and the completion chime depends on browser audio support.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | App layout and shared component styles |
| `app.js` | Countdown, session history, goals, and local storage |
| `time-picker.js` | Clock-dial and keyboard time picker |
| `responsive.css` | Tablet layouts, touch targets, and landscape dialogs |
| `themes.css` | Material 3 and Liquid Glass styles |
| `themes.js` | Theme Colour presets, tonal palettes, and contrast handling |
| `sw.js` | Scoped offline cache |
| `manifest.webmanifest` | Installable app metadata |
| `icon.svg` and PNG icons | App icons |
| `changelog.txt` | User-facing changes |

## License

Licensed under the [GNU General Public License v3.0](LICENSE).
