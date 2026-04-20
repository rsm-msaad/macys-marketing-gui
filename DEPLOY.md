## RSM Canvas Utils

Utilities for managing Canvas/GitHub classroom workflows: creating student repositories from templates, checking repository status, and verifying GitHub accounts.

## Prerequisites

1. **UV** (Python package manager)

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

2. **just** (optional, or use make)

<https://github.com/casey/just>

3. **API Keys** in `~/.env`:

```bash
CANVAS_API_KEY="your_canvas_api_key"
GH_TOKEN="your_github_token"
```

- Canvas API: <https://rady.instructure.com/profile/settings> or <https://canvas.ucsd.edu/profile/settings>
- GitHub token: <https://github.com/settings/tokens>

## Workflow

1. **Create `config.yaml`** in your assignment directory

Course numbers are the end of your canvas course site url. For example: <https://rady.instructure.com/courses/1234> means `course_nrs` should be set to 1234. Save this `config.yaml` into your assignment directory.

```yaml
course:
  name: "rsm-mgta123"
  assignment: "assignment1"
  course_nrs:
    - 1234
    - 1235

organization:
  production: "rsm-msba-25-26"
  test: "rsm-msba-test"

maintainers:
  - "rsm-ta1"
  - "rsm-ta2"

files_to_hide: ["code-solution.ipynb", "other-file.py"]
```

2. **Get justfile and DEPLOY.md**

```bash
curl -O https://raw.githubusercontent.com/vnijs/rsm_canvas_utils/main/justfile
curl -O https://raw.githubusercontent.com/vnijs/rsm_canvas_utils/main/DEPLOY.md
```

3. **Create virtual environment and install package:**

```bash
just setup-venv
```

4. **Check your setup:**

```bash
just check-setup
```

5. **Push template repo to GitHub org (test first):**

Push your solutions as the template to the test organization first to verify everything works as expected.

```bash
just push-template-test
```

Check that all tests pass in the test organization before pushing to production.

If all looks good, you can delete the test template repository

```bash
just delete-template-test
```

6. **Verify all students have valid GitHub accounts:**

```bash
just check-gh-accounts
```

**Note on GitHub org invitations:** Invitations expire after 7 days. To check membership status and re-invite students who haven't accepted:

```bash
# Check status only (no invitations sent)
just reinvite-students-production

# Actually send re-invitations
just do-reinvite-students-production
```

7. **Create individual student repositories (test org):**

```bash
just create-repos-test
```

8. **Push template repo to production org:**

```bash
just push-template-production
```

If there are any issues, you can delete the production template repository

```bash
just delete-template-production
```

9. **Create individual student repositories (production org):**

```bash
just create-repos-production
```

10. **Monitor individual student progress:**

```bash
just check-repos-production
```

11. **Update individual student repos with template changes:**

First, manually commit and push your changes to the template repo. The update command checks ALL changed files in the template and:

- **Updates** files that students have NOT modified
- **Skips** files that students have already changed (to avoid overwriting their work)
- **Adds** new files that weren't in the original template

```bash
just update-repos-test
```

Or for production:

```bash
just update-repos-production
```

**If files are skipped** because students modified them, you'll see warnings like:

```
⚠ Skipped code.py - student has made changes
⚠ 3 file(s) skipped due to student changes
```

To update these files anyway, use the `--pr` flag to create pull requests that students can review and merge themselves:

```bash
just update-repos-pr
```

Or for production:

```bash
just update-repos-production-pr
```

12. **Delete individual student repositories (test org):**

```bash
just delete-repos-test
```

13. **Delete individual student repositories (production org):**

This is possible but at your own risk. Uncomment the relevant line below if you want to proceed.

```bash
# just delete-repos-production
```

---

## Group Assignment Workflow

For group assignments, groups must be set up in Canvas first. The workflow creates one repository per group, with all group members having admin access.

### Test Workflow (Group Assignments)

1. **Push template repo (test org):**

```bash
just push-template-test
```

2. **Create group repositories (test org):**

This creates a single "test-group" with maintainers as members for testing.

```bash
just create-group-repos-test
```

3. **Monitor group progress (test org):**

```bash
just check-group-repos-test
```

4. **Update group repos with template changes (test org):**

```bash
just update-group-repos-test
```

5. **Delete group repositories (test org):**

```bash
# just delete-group-repos-test
# just delete-template-test
```

### Production Workflow (Group Assignments)

1. **Push template repo (production org):**

```bash
just push-template-production
```

2. **Verify all students have valid GitHub accounts:**

```bash
just check-gh-accounts
```

3. **Create group repositories (production org):**

Groups are fetched from Canvas. Each group gets one private repository with:
- All group members as admins
- Maintainers (TAs/instructor) with maintain access

```bash
just create-group-repos-production
```

4. **Monitor group progress (production org):**

```bash
just check-group-repos-production
```

This saves status to `group-repo-status-{assignment}.csv`.

5. **Update group repos with template changes (production org):**

```bash
just update-group-repos-production
```

Or with pull requests for files that group members have modified:

```bash
just update-group-repos-production-pr
```

6. **Delete group repositories (production org):**

This is possible but at your own risk. Uncomment if you want to proceed.

```bash
# just delete-group-repos-production
just delete-template-production
```

---

## Command Reference

### Individual Student Repositories

| Command | Description |
|---------|-------------|
| `just push-template-test` | Push template to test org |
| `just push-template-production` | Push template to production org |
| `just delete-template-test` | Delete template from test org |
| `just delete-template-production` | Delete template from production org |
| `just check-gh-accounts` | Verify student GitHub accounts |
| `just reinvite-students-test` | Check membership status (test) |
| `just reinvite-students-production` | Check membership status (production) |
| `just do-reinvite-students-test` | Send re-invitations (test) |
| `just do-reinvite-students-production` | Send re-invitations (production) |
| `just create-repos-test` | Create student repos (test) |
| `just create-repos-production` | Create student repos (production) |
| `just check-repos-test` | Check student repo status (test) |
| `just check-repos-production` | Check student repo status (production) |
| `just update-repos-test` | Update student repos (test) |
| `just update-repos-production` | Update student repos (production) |
| `just update-repos-test-pr` | Update via PR (test) |
| `just update-repos-production-pr` | Update via PR (production) |
| `just delete-repos-test` | Delete student repos (test) |
| `just delete-repos-production` | Delete student repos (production) |

### Group Repositories

| Command | Description |
|---------|-------------|
| `just create-group-repos-test` | Create group repos (test) |
| `just create-group-repos-production` | Create group repos (production) |
| `just check-group-repos-test` | Check group repo status (test) |
| `just check-group-repos-production` | Check group repo status (production) |
| `just update-group-repos-test` | Update group repos (test) |
| `just update-group-repos-production` | Update group repos (production) |
| `just update-group-repos-test-pr` | Update via PR (test) |
| `just update-group-repos-production-pr` | Update via PR (production) |
| `just delete-group-repos-test` | Delete group repos (test) |
| `just delete-group-repos-production` | Delete group repos (production) |
