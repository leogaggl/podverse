# `misc/aicasts/`

Two-voice training scripts (Claire and Tom), each walking through one Podverse feature, written
for an AI audio service. The operator asks for them with **abcaicast**. They are listening
material for people, not technical docs and not agent guidance.

Together they form one course, published as an RSS feed. Another agent turns each script into an
episode. When a script changes, it replaces the episode it published before.

- Each file opens with a header block:
  - **Version**: the date and time the file last changed. A newer version replaces the published
    episode.
  - **Episode ID**: the stable key for the published episode. It never changes, even when the
    title, number, or file name does.
  - **Changed**: what the version changed, and whether the audio must be regenerated.
  - **Description**: the RSS episode description.
  - **Status**: whether the work was built or planned when the version was written.
  - **Group**: the course unit and the part number.
  - **Sources** and **Length**.
- The top heading is the RSS title: `<Group Title> <n>: <Episode Title>`. Episodes in a group
  share the title prefix and are numbered in listening order.
- File names follow `<group-slug>-<n>-<slug>.md`.
- Check the code before relying on an older version's **Status** line.
- How to write one: [abcaicast skill](/.cursor/skills/abcaicast/SKILL.md).
