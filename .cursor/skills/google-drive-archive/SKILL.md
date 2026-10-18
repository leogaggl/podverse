---
name: google-drive-archive
description: Archive unused local files to Google Drive Computer Backups, then delete them locally only after the upload checks out. Use when the operator asks to archive, back up, or move directories or files to Google Drive.
---

# Google Drive archive

Move local files the operator no longer needs onto Google Drive, then delete the local copy only
after the upload checks out. Drive is not a secret store, and space there is limited. Archive the
smallest set that preserves something which exists only on this Mac.

## Destination

Google Drive for desktop mounts under `~/Library/CloudStorage/GoogleDrive-*/My Drive`.

Everything goes under a root folder named **Computer Backups**:

`My Drive/Computer Backups/<Category>/<name>/`

Pick a category that matches the contents. Use **Repos** for repository source, **Image Backups**
for local image or video dumps, and **Other** only when no clearer category fits. Do not put files
in the Computer Backups root itself.

Listing `My Drive` can hang because files are cloud-backed. Create the destination and copy into
it; do not wait on a full directory listing of the drive. Do not list the Drive mount root either.

Never open `~/Library/CloudStorage/GoogleDrive-*/.Trash` or any Trash folder on that mount. The
operator's Drive Trash is off limits, including file names. Stay inside `My Drive/Computer Backups`.

## What qualifies

Archive a tree when it is unlikely to be used soon and the local copy is the only copy, or the
operator named that exact path in the current message.

Leave anything there is a real chance of using soon. Never archive `repos/pv`.

On a new batch, propose the set and wait for approval before copying. If the operator already named
the exact paths to archive in that message, that is the approval for those paths.

## Never upload

Scan every file first. Skip the file, and say so, when the name or a short sample shows:

- Environment files: `.env`, `.env.*`, and names ending in `.env`, except `*.example` and `*.sample`
- Private keys and signing material: `.pem`, `.p8`, `.p12`, `.pfx`, `.keystore`, `.jks`, `id_rsa`,
  `id_ed25519`
- Credential files, service-account JSON, wallet files, and API tokens
- Database dumps (`.sql`, `.dump`, `.sql.gz`, `.sql.zst`) unless the operator has said that backup
  is safe to archive. This operator has. See **Database backups**
- Customer data, session cookies, and production backups of databases that the operator has not
  included in the archive

A debug or example keystore in a sample app is still a key. Leave it out.

Do not upload commercial media (films, television, commercial cartoons) as an archive.

## Strip before upload

Do not upload files that a package manager or build can recreate:

- `node_modules`, `.npm`, `.gradle` caches, `Pods`, `vendor`, virtualenvs, `__pycache__`
- Build output: `.next`, `dist`, `build`, `DerivedData`, Android `app/build`, iOS `build`
- `.direnv`, `.turbo`, coverage reports, and bundle-analyzer output

`.git` may be included for a repository that has no remote. For a repository that already has a
remote, prefer not uploading `.git` either. GitHub (or the other remote) is the history.

## Database backups

When the operator includes database backups in an archive, put the dump files in **Database
Backups**. That covers `*.sql`, `*.sql.gz`, `*.sql.zst`, and `*.dump` files that are backups.
Schema migrations that belong to a repository follow the repository rules instead.

Environment files stored next to a dump stay off Drive. When a compressed dump and an uncompressed
copy are the same backup, upload the compressed file only.

## Clean clones

If `git status` is clean and every commit is on a remote, do not upload the checkout. Move it to
the Mac Trash after the operator approves. Restore later with `git clone`. A local-only secret
(an untracked `.env`, a key) stays in that folder and goes to the Mac Trash with it only when the
operator has said that secret can go too. Do not put that secret on Drive.

Untracked or ignored content that is not in the skip lists above is the part worth uploading.
Upload that subset, not the whole checkout.

## Verify, then delete

1. Copy the filtered set into Computer Backups. Do not move it in one step.
2. Compare file count and total bytes of the filtered local set with the destination.
3. Move the local files to the Mac Trash only after those totals match. Use
   `FileManager.trashItem` so the operator can put them back. Do not `rm` them.
4. If the check fails, leave the local files in place and report the mismatch.

A duplicate Finder copy (a folder whose name ends in ` 2` and whose relative paths match another
folder) is not uploaded. When a zip and an extracted folder hold the same backup, upload the zip
and leave the extracted folder out.
