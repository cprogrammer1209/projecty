# 10 — Documents
Code: `DOC` · Phase: 1 · Service: Work (files in object storage) · Status: **Draft**

## 1. Purpose
A single place for a project's files, plus one shared file storage used for attachments on tasks, issues, comments, and forum posts.

## 2. Actors
Team Member, Project Manager, Client User.

## 3. Scope
**In:** project folders, upload, download, preview, versions, check-in/out, attachments everywhere, storage quotas, Internal/External flag.
**Out:** online editing of docs/sheets/slides (out of scope), cloud storage integrations (LATER).

## 4. Key entities
| Entity | Business attributes |
|---|---|
| **Folder** | Project, name, parent folder, flag (Internal / External), created by and date |
| **Document** | Project, folder, name, description, current version, size, type (MIME), tags, flag, checked-out by, checked-out at, created by and date |
| **Version** | Document, version number, file, size, uploaded by and date, change note |
| **Attachment** | Owner item (task, issue, comment, forum post, or custom record), file, name, size, type, uploaded by and date |

## 5. User stories
| ID | Tier | Story |
|---|---|---|
| DOC-US-01 | MVP | As a member, I attach files to tasks and comments (drag and drop, multiple files at once). |
| DOC-US-02 | MVP | As a member, I download an attachment, and I preview images and PDFs in the browser. |
| DOC-US-03 | MVP | As a member, I delete an attachment I uploaded. |
| DOC-US-04 | V1 | As a member, I create folders in a project's Documents area and upload files into them. |
| DOC-US-05 | V1 | As a member, I upload a new version of a document, and I see and download earlier versions. |
| DOC-US-06 | V1 | As a member, I check out a document so others can't upload new versions until I check it back in. |
| DOC-US-07 | V1 | As a member, I move and rename files and folders. |
| DOC-US-08 | V1 | As a Manager, I flag a folder or document External so client users can see it. |
| DOC-US-09 | V1 | As a member, I see all attachments of a project (from tasks and issues) in one "All files" view. |
| DOC-US-10 | V1 | As an Admin, I see the portal's storage usage against its quota. |
| DOC-US-11 | LATER | As a member, I link files from Google Drive, Dropbox, or OneDrive. |
| DOC-US-12 | LATER | As a member, I preview Office documents in the browser. |

## 6. Business rules
- **DOC-BR-01** File access always goes through a permission check. Links to files are short-lived and never public permanent URLs.
- **DOC-BR-02** Maximum file size is 100 MB per file on the default plan. The portal storage quota is set by entitlement. An upload that exceeds the quota is rejected before it starts.
- **DOC-BR-03** Blocked file types: executables (`.exe`, `.bat`, `.sh`, and so on). Files are scanned for malware before they become downloadable (V1; MVP: type blocklist only).
- **DOC-BR-04** Checked-out documents can only receive new versions from the user who checked them out. An Admin or Manager can force check-in, which is audited.
- **DOC-BR-05** Deleting a document or folder moves it to the trash with all its versions and contents. All versions count toward the storage quota.
- **DOC-BR-06** Attachments inherit visibility from their owner item. An attachment on an internal comment is internal.
- **DOC-BR-07** Duplicate names in the same folder are auto-renamed (`report (1).pdf`) unless the user chooses "upload as new version."
- **DOC-BR-08** Copying a task copies references to the attachments (shared storage). Deleting one copy doesn't delete the file used by the other.

## 7. Acceptance criteria
- **DOC-US-06**
  - Given Ravi checked out `spec.docx`, when Asha uploads a new version, then she's blocked with "checked out by Ravi since …". After Ravi checks it in with v3, Asha sees v3.
- **DOC-BR-01**
  - Given a download link copied from Ravi's session, when it's opened 15 minutes later or by a logged-out user, then access is denied.

## 8. Permissions
Profile module "Documents": View / Upload / Edit / Delete with scope. Attachment permissions follow the owner item (whoever can edit the task can attach to it).

## 9. Business events
`DocumentUploaded`, `DocumentVersionAdded`, `DocumentCheckedOut`, `DocumentCheckedIn`, `DocumentMoved`, `DocumentTrashed`, `FolderCreated`, `AttachmentAdded`, `AttachmentRemoved`.

## 10. Notifications
New version of a document I follow (V1), a document shared with clients (to the client users, V1).

## 11. Dependencies
Projects (04). Tasks (06) use attachments from MVP, so the shared file storage is built alongside Step 6.

## 12. Open questions
- Should documents have comments and followers like tasks? Proposal: LATER.

## Change log
| Date | Change |
|---|---|
| 2026-10-25 | Initial draft |
