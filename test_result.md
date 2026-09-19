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

## frontend:
##   - task: "Profile IA (remove standalone Identity; add About Traksha; rename Settings->Preferences)"
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
##     - "Profile IA"
##     - "Preferences screen"
##     - "Identity screen TMP vs TRK distinct presentation + INS registration + dev tool at bottom"
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
