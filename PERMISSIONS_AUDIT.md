# Permissions Audit - Current vs Desired

## ❌ ISSUES FOUND

### Current Implementation Problems:

1. **Remove Team Member** (`app/(login)/actions.ts`)
   - ❌ Checks for workspace "owner" role (doesn't exist anymore)
   - ❌ Should check organization role OR workspace admin role
   
2. **Invite Team Member** (`app/(login)/actions.ts`)
   - ❌ Checks for workspace "owner" role (doesn't exist anymore)
   - ❌ Should check organization role OR workspace admin role
   - ❌ Role options include 'owner' (should be 'admin' or 'member')

3. **Delete Workspace** (`app/api/team/delete/route.ts`)
   - ❌ Checks `isTeamOwner` (workspace owner - doesn't exist)
   - ❌ Should check organization owner/admin role

---

## ✅ DESIRED PERMISSIONS MODEL

### Organization Level:

**Owner (1 per org):**
- ✅ Create workspaces
- ✅ Delete workspaces
- ✅ Invite users to organization
- ✅ Remove users from organization
- ✅ Manage billing (to be added)
- ✅ All workspace admin permissions

**Admin (N per org):**
- ✅ Create workspaces
- ✅ Delete workspaces
- ✅ Invite users to organization
- ✅ Remove users from organization
- ❌ Cannot manage billing
- ✅ All workspace admin permissions

**Member (N per org):**
- ❌ Cannot create workspaces
- ❌ Cannot delete workspaces
- ❌ Cannot invite to organization
- ❌ Cannot manage billing
- ✅ Can be added to specific workspaces

### Workspace Level:

**Admin (N per workspace):**
- ✅ Manage workspace settings
- ✅ Add/remove workspace members
- ✅ Invite to workspace
- ✅ Add integrations
- ✅ View alerts
- ❌ Cannot delete workspace (org level only)

**Member (N per workspace):**
- ❌ Cannot manage settings
- ❌ Cannot add/remove members
- ✅ Add integrations
- ✅ View alerts
- ✅ View data

---

## 🔧 FIXES NEEDED

### 1. Update `removeTeamMember` action:
```typescript
// Should check: workspace admin OR org owner/admin
const isWorkspaceAdmin = await isWorkspaceAdmin(user.id, teamId);
const orgRole = await getOrgRole(user.id);
const canRemove = isWorkspaceAdmin || orgRole === 'owner' || orgRole === 'admin';
```

### 2. Update `inviteTeamMember` action:
```typescript
// Should check: workspace admin OR org owner/admin
// Role options: 'admin' or 'member' (no 'owner')
```

### 3. Update `deleteTeam` API:
```typescript
// Should check: org owner OR org admin
const orgRole = await getOrgRole(user.id);
if (orgRole !== 'owner' && orgRole !== 'admin') {
  return error;
}
```

---

## ✅ ALREADY CORRECT

1. **Create Workspace** - ✅ Checks org owner/admin
2. **Workspace Creation UI** - ✅ Shows for org owner/admin
3. **Team Switcher** - ✅ Shows create for org owner/admin

