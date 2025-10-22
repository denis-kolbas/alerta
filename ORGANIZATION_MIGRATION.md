# Organization Hierarchy Migration

## Overview
This migration introduces an organization-based hierarchy where organizations own workspaces (teams).

## Changes

### Database Structure
```
Before:
User → Team (with subscription)

After:
User → Organization (with subscription) → Workspace (team)
```

### Key Changes
1. **New Tables:**
   - `organizations` - Top-level billing entity
   - `organization_members` - User membership in organizations

2. **Updated Tables:**
   - `teams` - Now has `organization_id`, removed subscription fields
   - `team_members` - Role 'owner' changed to 'admin'

3. **Subscription Fields:**
   - Moved from `teams` to `organizations`
   - Fields: stripe_customer_id, stripe_subscription_id, plan_name, subscription_status

### Roles

**Organization Level:**
- `owner` - Created the organization, manages billing
- `admin` - Can create workspaces, invite users
- `member` - Can access assigned workspaces

**Workspace Level:**
- `admin` - Full workspace control (no 'owner' role)
- `member` - View/use workspace

### Migration Process

The migration automatically:
1. Creates `organizations` and `organization_members` tables
2. For each existing team:
   - Creates an organization with the same name
   - Migrates subscription data to organization
   - Converts team members to organization members
   - Links team to organization
   - Changes 'owner' role to 'admin' in team_members

### Running the Migration

```bash
./run-org-migration.sh
```

Or manually:
```bash
psql $DATABASE_URL -f migrations/add_organizations.sql
```

### Code Changes

1. **Signup Flow:**
   - Now creates organization + first workspace
   - User becomes organization owner + workspace admin
   - Form field changed from "Company Name" to "Organization Name"

2. **Workspace Creation:**
   - Creates workspace within user's organization
   - Creator automatically becomes workspace admin

3. **Schema Updates:**
   - Added `organizations` and `organizationMembers` to schema
   - Updated `teams` to reference organization
   - Added proper relations

### Testing After Migration

1. Sign up new user → Should create organization + workspace
2. Create workspace → Should be linked to organization
3. Check existing data → All teams should have organization_id
4. Verify roles → No 'owner' role in team_members, only 'admin'

### Rollback

If needed, you can rollback by:
1. Restoring from backup
2. Or manually reversing the changes (not recommended)

### Notes

- Organization names are permanent (cannot be changed)
- Organizations cannot be deleted
- All existing functionality remains the same
- Payment flows unchanged (still on organization level)
