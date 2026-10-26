---
name: Conversation attachments
description: Where uploaded files are preserved after a conversation is moved into a project.
---

After a conversation is transitioned into a project, original uploaded files may be preserved under `.local/conversation-workspace/files/attached_assets/` instead of the project-root `attached_assets/`.

**Why:** The project handoff preserves conversation files in a nested path; assuming they remain at the project root can cause a frontend implementation to miss the provided source.

**How to apply:** When a task depends on uploaded files after a conversation move, check the preserved conversation-workspace path before concluding that an attachment is unavailable.
