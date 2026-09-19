#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
## user_problem_statement: >
  Restructure Profile → Preferences → Identity architecture (Traksha).
  Profile = Edit Profile, My Connection QR, About Traksha, Preferences (no standalone Identity).
  Preferences = Account, Identity, Privacy, Safety, Communication, Contact Us, Sign Out.
  Identity screen must show visually distinct TMP (provisional) vs TRK (established) states,
  lifecycle/history, "Register an Institution (INS)" (begins verification flow, not instant),
  and Developer Tool (Simulate transition) at the bottom. Notifications must NOT be in Preferences.
  Also restored missing .env and fixed web render/robustness (nav-ready guard, non-blocking fonts,
  bootstrap timeout, asyncRoutes:false, expo SDK 57 version alignment).

## backend:
##   - task: "INS Phase A: registration, verification/approval, ownership, profile, members, custom roles, permissions, scope, role assignment approval, authorization enforcement"
##     implemented: true
##     working: true
##     file: "backend/server.py"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: false
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Implemented full INS Phase A. Collections: institutions, ins_members, ins_roles, ins_permissions (seeded catalog), ins_approvals. Endpoints (all /api): GET /ins/permissions/catalog; POST /ins/register (creates PENDING app + approval record, NOT instant activation); GET /ins/mine; POST /ins/dev/grant-admin (dev verifier); GET /ins/admin/applications; POST /ins/admin/applications/{id}/approve|reject (sets owner + owner-member on approve); GET /ins/{id}; PUT /ins/{id}/profile; GET/POST /ins/{id}/members, DELETE /ins/{id}/members/{mid}; GET/POST/PUT/DELETE /ins/{id}/roles(/{rid}); POST/DELETE /ins/{id}/members/{mid}/roles(/{aid}) for nominate/revoke; GET /ins/{id}/approvals; POST /ins/{id}/approvals/{aid}/approve|reject. Authorization service resolve_authority + require_perm enforces Institution->Role->Permission->Scope. Ownership grants '*'; members get aggregated perms from ACTIVE role assignments only. Curl smoke test passed all 12 scenarios (non-member 403, pending-role 403, post-approval permission granted, role mgmt restricted). Needs formal retest."
##         -working: true
##         -agent: "testing"
##         -comment: "✅ ALL 13 SCENARIOS PASSED. Comprehensive backend testing completed successfully. (1) REGISTRATION: Institution created with PENDING status (not instant). (2) GET /ins/mine: Pending institution correctly listed. (3) PENDING ACCESS: Non-member gets 403, owner cannot update profile while pending (403). (4) VERIFICATION/APPROVAL: Dev grant-admin works, non-admin gets 403 for admin endpoints, admin can list/approve applications. (5) OWNERSHIP: After approval, owner has is_owner=true and permissions=['*'], owner-member record created. (6) PROFILE: Owner can update institution profile after approval. (7) MEMBER ASSOCIATION: Add member by identity_code works (200), bogus code returns 404. (8) CUSTOM ROLE: Permissions catalog available, role creation with permissions and scope works, invalid permission returns 400, invalid scope type returns 400. (9) AUTHORIZATION ENFORCEMENT: Member without roles gets 403 for protected actions (role creation, member addition), can view members/roles (200). (10) ROLE ASSIGNMENT + APPROVAL: Assignment creates pending approval, member cannot use permission while pending (403), approval list works, approve works, member gains permission after approval (404 not 403 for bogus code = permission passed), member still cannot manage roles (403). (11) SCOPE: Scope persists in role definition and role assignment. (12) REVOKE: Role revocation works (200), member loses permission after revocation (403). (13) REGRESSION: All existing identity endpoints work (register, login, /auth/me, /identity/me, simulate-transition, search). Backend authorization correctly enforces Institution->Role->Permission->Scope hierarchy. Ownership grants all permissions; members only get permissions from ACTIVE role assignments."

##     implemented: true
##     working: true
##     file: "app/(app)/profile.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: false
##     status_history:
##         -working: true
##         -agent: "testing"
##         -comment: "✓ PASS - Profile screen shows correct navigation: Edit profile, My connection QR, About Traksha, Preferences. NO standalone Identity item present. Architecture correct."
##   - task: "Preferences screen (Account/Identity/Privacy/Safety/Communication/Contact Us/Sign Out; no Notifications/INS/About)"
##     implemented: true
##     working: true
##     file: "app/settings/index.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: false
##     status_history:
##         -working: true
##         -agent: "testing"
##         -comment: "✓ PASS - Preferences screen shows correct items: Account, Identity, Privacy, Safety, Communication, Contact us, Sign out. NO Notifications, NO About Traksha, NO Institutions. Architecture correct."
##   - task: "Contact Us screen (email + phone actionable)"
##     implemented: true
##     working: true
##     file: "app/settings/contact.tsx"
##     status_history:
##         -working: true
##         -agent: "testing"
##         -comment: "✓ PASS - Contact Us screen displays email (Write2us@tattvashila.org) and phone (+91 92446 22322). Both are actionable with proper testIDs."
##   - task: "Identity screen TMP vs TRK distinct presentation + INS registration + dev tool at bottom"
##     implemented: true
##     working: false
##     file: "app/settings/identity.tsx"
##     priority: "high"
##     needs_retesting: false
##     status_history:
##         -working: false
##         -agent: "testing"
##         -comment: "✗ PARTIAL - TMP state: Shows PROVISIONAL IDENTITY, TMP code, Identity history, Register INS button, Simulate transition button. Developer tool is correctly positioned BELOW Register INS. However, missing 'Day N of 45' lifecycle text display (only shows progress bar). TRK state: Shows ESTABLISHED IDENTITY, Established member, TRK code, Transition complete. Developer tool correctly removed. CRITICAL ISSUE: TRK presentation lacks strong visual distinction - missing colored status strip at top, shield icon not rendering visibly. TMP and TRK look too similar in visual hierarchy."
##   - task: "Register an Institution (INS) intent/verification screen (no instant creation)"
##     implemented: true
##     working: false
##     file: "app/settings/register-institution.tsx"
##     status_history:
##         -working: false
##         -agent: "testing"
##         -comment: "✗ PARTIAL - Screen shows title 'Register an Institution', has form fields (name, email, role), and submit button. However, missing prominent 'Not instant' indicator and 'verification' messaging that should be clearly visible to users. The verification flow concept is present but not sufficiently communicated in the UI."

## metadata:
##   created_by: "main_agent"
##   version: "2.0"
##   run_ui: true

## test_plan:
##   current_focus:
##     - "INS Phase A: registration, verification/approval, ownership, profile, members, custom roles, permissions, scope, role assignment approval, authorization enforcement"
##   test_all: false
##   test_priority: "high_first"

## agent_communication:
##     -agent: "main"
##     -message: >
##        Verify on WEB preview. Register a NEW account (becomes TMP) to see the provisional
##        Identity presentation. Then use Identity -> Developer Tool -> Simulate transition to
##        become TRK and confirm the established presentation is visibly stronger/distinct.
##        Verify: Profile shows Edit Profile / My Connection QR / About Traksha / Preferences and
##        NO standalone Identity; Preferences shows Account/Identity/Privacy/Safety/Communication/
##        Contact Us/Sign Out and NO Notifications and NO About; Identity has Register an Institution
##        (INS) which opens a verification screen (does NOT instantly create INS); Developer Tool is
##        BELOW the INS registration. Report any screen that renders blank.
##     -agent: "testing"
##     -message: >
##        Testing completed. PASSED: Profile IA (✓ correct navigation, NO standalone Identity), 
##        Preferences screen (✓ correct items, NO Notifications/About/INS), Contact Us (✓ email/phone actionable).
##        FAILED: Identity screen - TMP state missing visible 'Day N of 45' text (only progress bar shows). 
##        TRK state lacks strong visual distinction - missing colored status strip, shield icon not prominent.
##        TMP and TRK presentations look too similar. Register Institution screen missing prominent 
##        'Not instant' and 'verification' messaging. Developer tool positioning is correct (below INS button).
##        No blank screens detected. All core navigation and architecture requirements met.
##     -agent: "testing"
##     -message: >
##        INS Phase A backend testing COMPLETE - ALL 13 SCENARIOS PASSED ✅. Tested full flow with 2 users (owner + member):
##        Registration creates PENDING institution (not instant), pending access restrictions enforced (403 for non-members and profile updates),
##        verification/approval workflow works (dev grant-admin, admin-only endpoints, approve transitions to approved status),
##        ownership correctly established after approval (is_owner=true, permissions=['*'], owner-member record created),
##        profile management works post-approval, member association by identity_code works (404 for bogus codes),
##        custom roles with permissions and scope work (catalog available, validation enforces valid permissions/scopes),
##        authorization enforcement works (members without roles get 403 for protected actions, can view members/roles),
##        role assignment + approval workflow complete (pending approval created, permissions not usable while pending, approval grants permissions),
##        scope persists in roles and assignments, revocation works (member loses permissions), and all existing identity endpoints
##        remain functional (register, login, /auth/me, /identity/me, simulate-transition, search). Backend correctly enforces
##        Institution->Role->Permission->Scope->Approval->Person hierarchy. Role != Permission != Ownership verified.
##        Backend enforces authorization (not relying on frontend). No issues found.
