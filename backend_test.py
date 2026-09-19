#!/usr/bin/env python3
"""
INS Phase A Backend Test Suite
Tests the full Institution registration, verification, ownership, roles, permissions, and authorization flow.
"""

import requests
import json
import sys
import time
from typing import Dict, Optional

# Backend URL from environment
BASE_URL = "https://e5ed1e9a-897f-4712-aed1-a733a0985574.preview.emergentagent.com/api"

# Test state
owner_token = None
owner_user = None
member_token = None
member_user = None
ins_id = None
role_id = None
member_id = None
assignment_id = None
approval_id = None

# Test results
results = []


def log_test(scenario: str, passed: bool, expected: str, actual: str, details: str = ""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    results.append({
        "scenario": scenario,
        "passed": passed,
        "expected": expected,
        "actual": actual,
        "details": details
    })
    print(f"{status} - Scenario {scenario}")
    if not passed:
        print(f"  Expected: {expected}")
        print(f"  Actual: {actual}")
        if details:
            print(f"  Details: {details}")


def make_request(method: str, endpoint: str, token: Optional[str] = None, 
                 json_data: Optional[Dict] = None, expect_error: bool = False):
    """Make HTTP request and return response"""
    url = f"{BASE_URL}{endpoint}"
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        if method == "GET":
            resp = requests.get(url, headers=headers, timeout=60)
        elif method == "POST":
            resp = requests.post(url, headers=headers, json=json_data, timeout=60)
        elif method == "PUT":
            resp = requests.put(url, headers=headers, json=json_data, timeout=60)
        elif method == "DELETE":
            resp = requests.delete(url, headers=headers, timeout=60)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return resp
    except requests.exceptions.Timeout as e:
        print(f"⚠️  Request timeout: {method} {endpoint}")
        return None
    except requests.exceptions.ConnectionError as e:
        print(f"⚠️  Connection error: {method} {endpoint} - {e}")
        return None
    except Exception as e:
        print(f"⚠️  Request error: {method} {endpoint} - {e}")
        return None


def test_1_registration():
    """Test 1: REGISTRATION - POST /api/ins/register creates PENDING institution"""
    global owner_token, owner_user, ins_id
    
    print("\n=== Test 1: Institution Registration (PENDING status) ===")
    
    # First register owner user
    timestamp = int(time.time())
    owner_email = f"owner{timestamp}@test.traksha.org"
    owner_password = "password123"
    
    resp = make_request("POST", "/auth/register", json_data={
        "email": owner_email,
        "password": owner_password,
        "display_name": f"Owner User {timestamp}"
    })
    
    if not resp or resp.status_code != 200:
        log_test("1", False, "200", str(resp.status_code if resp else "No response"), 
                 "Failed to register owner user")
        return False
    
    data = resp.json()
    owner_token = data["access_token"]
    owner_user = data["user"]
    print(f"✓ Owner registered: {owner_user['identity_code']}")
    
    # Now register institution
    resp = make_request("POST", "/ins/register", token=owner_token, json_data={
        "name": "Acme Organization",
        "email": "info@acme.org",
        "applicant_role": "Director"
    })
    
    if not resp or resp.status_code != 200:
        log_test("1", False, "200", str(resp.status_code if resp else "No response"),
                 "Failed to register institution")
        return False
    
    data = resp.json()
    ins = data.get("institution", {})
    ins_id = ins.get("id")
    
    # Verify status is PENDING
    if ins.get("status") == "pending":
        log_test("1", True, "status=pending", f"status={ins.get('status')}", 
                 f"Institution {ins_id} created with PENDING status")
        print(f"✓ Institution ID: {ins_id}")
        return True
    else:
        log_test("1", False, "status=pending", f"status={ins.get('status')}", 
                 "Institution should be PENDING, not instantly approved")
        return False


def test_2_get_mine():
    """Test 2: GET /api/ins/mine returns pending institution"""
    print("\n=== Test 2: Get My Institutions (includes PENDING) ===")
    
    resp = make_request("GET", "/ins/mine", token=owner_token)
    
    if not resp or resp.status_code != 200:
        log_test("2", False, "200", str(resp.status_code if resp else "No response"),
                 "Failed to get institutions")
        return False
    
    data = resp.json()
    institutions = data.get("institutions", [])
    
    # Check if pending institution is in the list
    found = any(i.get("id") == ins_id and i.get("status") == "pending" for i in institutions)
    
    if found:
        log_test("2", True, "pending institution in list", "found", 
                 "Pending institution appears in /ins/mine")
        return True
    else:
        log_test("2", False, "pending institution in list", "not found",
                 f"Expected to find institution {ins_id} with status=pending")
        return False


def test_3_pending_access():
    """Test 3: PENDING ACCESS - non-member gets 403, owner cannot manage while pending"""
    global member_token, member_user
    
    print("\n=== Test 3: Pending Access Restrictions ===")
    
    # Register second user (member)
    timestamp = int(time.time())
    member_email = f"member{timestamp}@test.traksha.org"
    member_password = "password123"
    
    resp = make_request("POST", "/auth/register", json_data={
        "email": member_email,
        "password": member_password,
        "display_name": f"Member User {timestamp}"
    })
    
    if not resp or resp.status_code != 200:
        log_test("3a", False, "200", str(resp.status_code if resp else "No response"),
                 "Failed to register member user")
        return False
    
    data = resp.json()
    member_token = data["access_token"]
    member_user = data["user"]
    print(f"✓ Member registered: {member_user['identity_code']}")
    
    # Test 3a: Member (non-associated) tries to access institution -> 403
    resp = make_request("GET", f"/ins/{ins_id}", token=member_token)
    
    if resp and resp.status_code == 403:
        log_test("3a", True, "403", "403", 
                 "Non-associated user correctly denied access to pending institution")
    else:
        log_test("3a", False, "403", str(resp.status_code if resp else "No response"),
                 "Non-associated user should get 403 for pending institution")
    
    # Test 3b: Owner tries to update profile while pending -> should fail (400 or 403)
    resp = make_request("PUT", f"/ins/{ins_id}/profile", token=owner_token, json_data={
        "description": "Test description"
    })
    
    if resp and resp.status_code in (400, 403):
        log_test("3b", True, "400 or 403", str(resp.status_code),
                 "Owner correctly denied profile update while institution is pending")
        return True
    else:
        log_test("3b", False, "400 or 403", str(resp.status_code if resp else "No response"),
                 "Owner should not be able to update profile while institution is pending")
        return False


def test_4_verification_approval():
    """Test 4: VERIFICATION/APPROVAL - grant admin, list applications, approve"""
    print("\n=== Test 4: Verification and Approval Workflow ===")
    
    # Test 4a: Grant admin to owner user
    resp = make_request("POST", "/ins/dev/grant-admin", token=owner_token)
    
    if not resp or resp.status_code != 200:
        log_test("4a", False, "200", str(resp.status_code if resp else "No response"),
                 "Failed to grant admin")
        return False
    
    print("✓ Admin granted to owner user")
    
    # Test 4b: Non-admin (member) tries to list applications -> 403
    resp = make_request("GET", "/ins/admin/applications", token=member_token)
    
    if resp and resp.status_code == 403:
        log_test("4b", True, "403", "403",
                 "Non-admin correctly denied access to admin applications")
    else:
        log_test("4b", False, "403", str(resp.status_code if resp else "No response"),
                 "Non-admin should get 403 for admin applications")
    
    # Test 4c: Admin lists applications
    resp = make_request("GET", "/ins/admin/applications", token=owner_token)
    
    if not resp or resp.status_code != 200:
        log_test("4c", False, "200", str(resp.status_code if resp else "No response"),
                 "Admin failed to list applications")
        return False
    
    data = resp.json()
    applications = data.get("applications", [])
    found = any(app.get("id") == ins_id for app in applications)
    
    if found:
        log_test("4c", True, "pending app in list", "found",
                 "Pending application appears in admin list")
    else:
        log_test("4c", False, "pending app in list", "not found",
                 f"Expected to find application {ins_id}")
    
    # Test 4d: Approve institution
    resp = make_request("POST", f"/ins/admin/applications/{ins_id}/approve", token=owner_token)
    
    if resp and resp.status_code == 200:
        log_test("4d", True, "200", "200",
                 "Institution approved successfully")
        print("✓ Institution approved")
        return True
    else:
        log_test("4d", False, "200", str(resp.status_code if resp else "No response"),
                 "Failed to approve institution")
        return False


def test_5_ownership():
    """Test 5: OWNERSHIP - after approval, owner has is_owner=true and permissions=['*']"""
    global member_id
    
    print("\n=== Test 5: Ownership After Approval ===")
    
    # Get institution details as owner
    resp = make_request("GET", f"/ins/{ins_id}", token=owner_token)
    
    if not resp or resp.status_code != 200:
        log_test("5a", False, "200", str(resp.status_code if resp else "No response"),
                 "Failed to get institution details")
        return False
    
    data = resp.json()
    ins = data.get("institution", {})
    
    # Check is_owner
    is_owner = ins.get("is_owner", False)
    my_permissions = ins.get("my_permissions", [])
    
    if is_owner and "*" in my_permissions:
        log_test("5a", True, "is_owner=true, permissions=['*']", 
                 f"is_owner={is_owner}, permissions={my_permissions}",
                 "Owner has correct ownership and permissions")
    else:
        log_test("5a", False, "is_owner=true, permissions=['*']",
                 f"is_owner={is_owner}, permissions={my_permissions}",
                 "Owner should have is_owner=true and permissions=['*']")
    
    # Test 5b: Check owner-member record exists
    resp = make_request("GET", f"/ins/{ins_id}/members", token=owner_token)
    
    if not resp or resp.status_code != 200:
        log_test("5b", False, "200", str(resp.status_code if resp else "No response"),
                 "Failed to get members list")
        return False
    
    data = resp.json()
    members = data.get("members", [])
    
    owner_member = next((m for m in members if m.get("relationship") == "owner"), None)
    
    if owner_member:
        log_test("5b", True, "owner-member record exists", "found",
                 "Owner-member record created on approval")
        return True
    else:
        log_test("5b", False, "owner-member record exists", "not found",
                 "Expected owner-member record after approval")
        return False


def test_6_profile():
    """Test 6: PROFILE - owner can update institution profile"""
    print("\n=== Test 6: Profile Management ===")
    
    resp = make_request("PUT", f"/ins/{ins_id}/profile", token=owner_token, json_data={
        "description": "A test organization for INS Phase A testing"
    })
    
    if not resp or resp.status_code != 200:
        log_test("6", False, "200", str(resp.status_code if resp else "No response"),
                 "Failed to update profile")
        return False
    
    # Verify it persisted
    resp = make_request("GET", f"/ins/{ins_id}", token=owner_token)
    
    if resp and resp.status_code == 200:
        data = resp.json()
        ins = data.get("institution", {})
        description = ins.get("description", "")
        
        if "test organization" in description.lower():
            log_test("6", True, "profile updated and persisted", "success",
                     "Profile update persisted correctly")
            return True
        else:
            log_test("6", False, "profile updated and persisted", "not persisted",
                     f"Description not persisted: {description}")
            return False
    else:
        log_test("6", False, "200", str(resp.status_code if resp else "No response"),
                 "Failed to verify profile update")
        return False


def test_7_member_association():
    """Test 7: MEMBER ASSOCIATION - add member by identity_code"""
    global member_id
    
    print("\n=== Test 7: Member Association ===")
    
    # Test 7a: Add member with valid identity_code
    resp = make_request("POST", f"/ins/{ins_id}/members", token=owner_token, json_data={
        "identity_code": member_user["identity_code"],
        "title": "Team Member"
    })
    
    if not resp or resp.status_code != 200:
        log_test("7a", False, "200", str(resp.status_code if resp else "No response"),
                 "Failed to add member")
        return False
    
    data = resp.json()
    member = data.get("member", {})
    member_id = member.get("id")
    
    log_test("7a", True, "200", "200",
             f"Member added successfully: {member_id}")
    print(f"✓ Member ID: {member_id}")
    
    # Test 7b: Try to add bogus identity_code -> 404
    resp = make_request("POST", f"/ins/{ins_id}/members", token=owner_token, json_data={
        "identity_code": "BOGUS1234567890X",
        "title": "Fake Member"
    })
    
    if resp and resp.status_code == 404:
        log_test("7b", True, "404", "404",
                 "Bogus identity_code correctly returns 404")
        return True
    else:
        log_test("7b", False, "404", str(resp.status_code if resp else "No response"),
                 "Bogus identity_code should return 404")
        return False


def test_8_custom_role():
    """Test 8: CUSTOM ROLE - create role with permissions and scope, validate catalog"""
    global role_id
    
    print("\n=== Test 8: Custom Role Creation ===")
    
    # Test 8a: Get permissions catalog
    resp = make_request("GET", "/ins/permissions/catalog", token=owner_token)
    
    if not resp or resp.status_code != 200:
        log_test("8a", False, "200", str(resp.status_code if resp else "No response"),
                 "Failed to get permissions catalog")
        return False
    
    data = resp.json()
    permissions = data.get("permissions", [])
    scopes = data.get("scopes", [])
    
    if permissions and scopes:
        log_test("8a", True, "catalog with permissions and scopes", "found",
                 f"Catalog has {len(permissions)} permissions and {len(scopes)} scope types")
    else:
        log_test("8a", False, "catalog with permissions and scopes", "incomplete",
                 "Catalog should have permissions and scopes")
    
    # Test 8b: Create role with valid permissions and scope
    resp = make_request("POST", f"/ins/{ins_id}/roles", token=owner_token, json_data={
        "name": "Coordinator",
        "description": "Team coordinator role",
        "permissions": ["members:view", "members:invite"],
        "scope": {"type": "department", "label": "Operations"}
    })
    
    if not resp or resp.status_code != 200:
        log_test("8b", False, "200", str(resp.status_code if resp else "No response"),
                 "Failed to create role")
        return False
    
    data = resp.json()
    role = data.get("role", {})
    role_id = role.get("id")
    
    log_test("8b", True, "200", "200",
             f"Role created successfully: {role_id}")
    print(f"✓ Role ID: {role_id}")
    
    # Test 8c: Try to create role with invalid permission -> 400
    resp = make_request("POST", f"/ins/{ins_id}/roles", token=owner_token, json_data={
        "name": "Invalid Role",
        "description": "Should fail",
        "permissions": ["invalid:permission"],
        "scope": {"type": "department", "label": "Test"}
    })
    
    if resp and resp.status_code == 400:
        log_test("8c", True, "400", "400",
                 "Invalid permission correctly returns 400")
    else:
        log_test("8c", False, "400", str(resp.status_code if resp else "No response"),
                 "Invalid permission should return 400")
    
    # Test 8d: Try to create role with invalid scope type -> 400
    resp = make_request("POST", f"/ins/{ins_id}/roles", token=owner_token, json_data={
        "name": "Invalid Scope Role",
        "description": "Should fail",
        "permissions": ["members:view"],
        "scope": {"type": "invalid_scope", "label": "Test"}
    })
    
    if resp and resp.status_code == 400:
        log_test("8d", True, "400", "400",
                 "Invalid scope type correctly returns 400")
        return True
    else:
        log_test("8d", False, "400", str(resp.status_code if resp else "No response"),
                 "Invalid scope type should return 400")
        return False


def test_9_authorization_enforcement():
    """Test 9: AUTHORIZATION ENFORCEMENT - member without roles gets 403 for protected actions"""
    print("\n=== Test 9: Authorization Enforcement (Negative Tests) ===")
    
    # Test 9a: Member tries to create role -> 403
    resp = make_request("POST", f"/ins/{ins_id}/roles", token=member_token, json_data={
        "name": "Unauthorized Role",
        "description": "Should fail",
        "permissions": ["members:view"],
        "scope": {"type": "institution", "label": ""}
    })
    
    if resp and resp.status_code == 403:
        log_test("9a", True, "403", "403",
                 "Member without roles correctly denied role creation")
    else:
        log_test("9a", False, "403", str(resp.status_code if resp else "No response"),
                 "Member without roles should get 403 for role creation")
    
    # Test 9b: Member tries to add another member -> 403
    resp = make_request("POST", f"/ins/{ins_id}/members", token=member_token, json_data={
        "identity_code": "TESTCODE12345678",
        "title": "Test"
    })
    
    if resp and resp.status_code == 403:
        log_test("9b", True, "403", "403",
                 "Member without roles correctly denied member addition")
    else:
        log_test("9b", False, "403", str(resp.status_code if resp else "No response"),
                 "Member without roles should get 403 for member addition")
    
    # Test 9c: Member can view members (any active member can view) -> 200
    resp = make_request("GET", f"/ins/{ins_id}/members", token=member_token)
    
    if resp and resp.status_code == 200:
        log_test("9c", True, "200", "200",
                 "Member can view members list (allowed for all active members)")
    else:
        log_test("9c", False, "200", str(resp.status_code if resp else "No response"),
                 "Member should be able to view members list")
    
    # Test 9d: Member can view roles -> 200
    resp = make_request("GET", f"/ins/{ins_id}/roles", token=member_token)
    
    if resp and resp.status_code == 200:
        log_test("9d", True, "200", "200",
                 "Member can view roles list (allowed for all active members)")
        return True
    else:
        log_test("9d", False, "200", str(resp.status_code if resp else "No response"),
                 "Member should be able to view roles list")
        return False


def test_10_role_assignment_approval():
    """Test 10: ROLE ASSIGNMENT + APPROVAL WORKFLOW"""
    global assignment_id, approval_id
    
    print("\n=== Test 10: Role Assignment and Approval Workflow ===")
    
    # Test 10a: Assign role to member -> creates pending approval
    resp = make_request("POST", f"/ins/{ins_id}/members/{member_id}/roles", 
                       token=owner_token, json_data={
        "role_id": role_id
    })
    
    if not resp or resp.status_code != 200:
        log_test("10a", False, "200", str(resp.status_code if resp else "No response"),
                 "Failed to assign role")
        return False
    
    data = resp.json()
    assignment = data.get("assignment", {})
    assignment_id = assignment.get("assignment_id")
    approval_id = data.get("approval_id")
    
    if assignment.get("state") == "pending_approval":
        log_test("10a", True, "state=pending_approval", f"state={assignment.get('state')}",
                 f"Role assignment created with pending approval: {approval_id}")
        print(f"✓ Assignment ID: {assignment_id}")
        print(f"✓ Approval ID: {approval_id}")
    else:
        log_test("10a", False, "state=pending_approval", f"state={assignment.get('state')}",
                 "Role assignment should be pending_approval")
    
    # Test 10b: Member tries to use permission while pending -> 403
    resp = make_request("POST", f"/ins/{ins_id}/members", token=member_token, json_data={
        "identity_code": "TESTCODE12345678",
        "title": "Test"
    })
    
    if resp and resp.status_code == 403:
        log_test("10b", True, "403", "403",
                 "Member cannot use permission while role is pending approval")
    else:
        log_test("10b", False, "403", str(resp.status_code if resp else "No response"),
                 "Member should not be able to use permission while pending")
    
    # Test 10c: List approvals as owner
    resp = make_request("GET", f"/ins/{ins_id}/approvals", token=owner_token)
    
    if not resp or resp.status_code != 200:
        log_test("10c", False, "200", str(resp.status_code if resp else "No response"),
                 "Failed to list approvals")
        return False
    
    data = resp.json()
    approvals = data.get("approvals", [])
    found = any(a.get("id") == approval_id for a in approvals)
    
    if found:
        log_test("10c", True, "pending approval in list", "found",
                 "Pending approval appears in approvals list")
    else:
        log_test("10c", False, "pending approval in list", "not found",
                 f"Expected to find approval {approval_id}")
    
    # Test 10d: Approve the role assignment
    resp = make_request("POST", f"/ins/{ins_id}/approvals/{approval_id}/approve",
                       token=owner_token)
    
    if not resp or resp.status_code != 200:
        log_test("10d", False, "200", str(resp.status_code if resp else "No response"),
                 "Failed to approve role assignment")
        return False
    
    log_test("10d", True, "200", "200",
             "Role assignment approved successfully")
    print("✓ Role assignment approved")
    
    # Test 10e: Member now has permission - try to add member with bogus code -> 404 (not 403)
    resp = make_request("POST", f"/ins/{ins_id}/members", token=member_token, json_data={
        "identity_code": "BOGUS1234567890X",
        "title": "Test"
    })
    
    if resp and resp.status_code == 404:
        log_test("10e", True, "404 (permission passed, code not found)", "404",
                 "Member now has members:invite permission (404 means permission passed)")
    else:
        log_test("10e", False, "404", str(resp.status_code if resp else "No response"),
                 "Member should have permission now (404 expected, not 403)")
    
    # Test 10f: Member still cannot manage roles -> 403
    resp = make_request("POST", f"/ins/{ins_id}/roles", token=member_token, json_data={
        "name": "Test Role",
        "description": "Should fail",
        "permissions": ["members:view"],
        "scope": {"type": "institution", "label": ""}
    })
    
    if resp and resp.status_code == 403:
        log_test("10f", True, "403", "403",
                 "Member still cannot manage roles (correct)")
        return True
    else:
        log_test("10f", False, "403", str(resp.status_code if resp else "No response"),
                 "Member should not have roles:manage permission")
        return False


def test_11_scope():
    """Test 11: SCOPE - verify scope persists in role and assignment"""
    print("\n=== Test 11: Scope Persistence ===")
    
    # Get role and verify scope
    resp = make_request("GET", f"/ins/{ins_id}/roles", token=owner_token)
    
    if not resp or resp.status_code != 200:
        log_test("11a", False, "200", str(resp.status_code if resp else "No response"),
                 "Failed to get roles")
        return False
    
    data = resp.json()
    roles = data.get("roles", [])
    role = next((r for r in roles if r.get("id") == role_id), None)
    
    if role:
        scope = role.get("scope", {})
        if scope.get("type") == "department" and scope.get("label") == "Operations":
            log_test("11a", True, "scope persisted in role", 
                     f"type={scope.get('type')}, label={scope.get('label')}",
                     "Scope correctly persisted in role")
        else:
            log_test("11a", False, "scope persisted in role",
                     f"type={scope.get('type')}, label={scope.get('label')}",
                     "Scope not correctly persisted")
    else:
        log_test("11a", False, "role found", "not found",
                 f"Role {role_id} not found in roles list")
    
    # Get member and verify scope in assignment
    resp = make_request("GET", f"/ins/{ins_id}/members", token=owner_token)
    
    if not resp or resp.status_code != 200:
        log_test("11b", False, "200", str(resp.status_code if resp else "No response"),
                 "Failed to get members")
        return False
    
    data = resp.json()
    members = data.get("members", [])
    member = next((m for m in members if m.get("id") == member_id), None)
    
    if member:
        roles = member.get("roles", [])
        assignment = next((r for r in roles if r.get("assignment_id") == assignment_id), None)
        
        if assignment:
            scope = assignment.get("scope", {})
            if scope.get("type") == "department" and scope.get("label") == "Operations":
                log_test("11b", True, "scope persisted in assignment",
                         f"type={scope.get('type')}, label={scope.get('label')}",
                         "Scope correctly persisted in role assignment")
                return True
            else:
                log_test("11b", False, "scope persisted in assignment",
                         f"type={scope.get('type')}, label={scope.get('label')}",
                         "Scope not correctly persisted in assignment")
                return False
        else:
            log_test("11b", False, "assignment found", "not found",
                     f"Assignment {assignment_id} not found")
            return False
    else:
        log_test("11b", False, "member found", "not found",
                 f"Member {member_id} not found")
        return False


def test_12_revoke():
    """Test 12: REVOKE - revoke role and verify member loses permission"""
    print("\n=== Test 12: Role Revocation ===")
    
    # Revoke the role assignment
    resp = make_request("DELETE", f"/ins/{ins_id}/members/{member_id}/roles/{assignment_id}",
                       token=owner_token)
    
    if not resp or resp.status_code != 200:
        log_test("12a", False, "200", str(resp.status_code if resp else "No response"),
                 "Failed to revoke role")
        return False
    
    log_test("12a", True, "200", "200",
             "Role revoked successfully")
    print("✓ Role revoked")
    
    # Test 12b: Member tries to use permission again -> 403
    resp = make_request("POST", f"/ins/{ins_id}/members", token=member_token, json_data={
        "identity_code": "TESTCODE12345678",
        "title": "Test"
    })
    
    if resp and resp.status_code == 403:
        log_test("12b", True, "403", "403",
                 "Member correctly lost permission after revocation")
        return True
    else:
        log_test("12b", False, "403", str(resp.status_code if resp else "No response"),
                 "Member should lose permission after revocation")
        return False


def test_13_regression():
    """Test 13: REGRESSION - verify existing identity endpoints still work"""
    print("\n=== Test 13: Regression Tests (Existing Endpoints) ===")
    
    # Test 13a: POST /api/auth/register (already tested, but verify again)
    timestamp = int(time.time())
    resp = make_request("POST", "/auth/register", json_data={
        "email": f"regression{timestamp}@test.traksha.org",
        "password": "password123",
        "display_name": "Regression Test User"
    })
    
    if resp and resp.status_code == 200:
        log_test("13a", True, "200", "200", "POST /api/auth/register works")
        regression_token = resp.json()["access_token"]
    else:
        log_test("13a", False, "200", str(resp.status_code if resp else "No response"),
                 "POST /api/auth/register failed")
        return False
    
    # Test 13b: POST /api/auth/login
    resp = make_request("POST", "/auth/login", json_data={
        "email": f"regression{timestamp}@test.traksha.org",
        "password": "password123"
    })
    
    if resp and resp.status_code == 200:
        log_test("13b", True, "200", "200", "POST /api/auth/login works")
    else:
        log_test("13b", False, "200", str(resp.status_code if resp else "No response"),
                 "POST /api/auth/login failed")
    
    # Test 13c: GET /api/auth/me
    resp = make_request("GET", "/auth/me", token=regression_token)
    
    if resp and resp.status_code == 200:
        log_test("13c", True, "200", "200", "GET /api/auth/me works")
    else:
        log_test("13c", False, "200", str(resp.status_code if resp else "No response"),
                 "GET /api/auth/me failed")
    
    # Test 13d: GET /api/identity/me
    resp = make_request("GET", "/identity/me", token=regression_token)
    
    if resp and resp.status_code == 200:
        log_test("13d", True, "200", "200", "GET /api/identity/me works")
    else:
        log_test("13d", False, "200", str(resp.status_code if resp else "No response"),
                 "GET /api/identity/me failed")
    
    # Test 13e: POST /api/dev/simulate-transition (TMP->TRK)
    resp = make_request("POST", "/dev/simulate-transition", token=regression_token)
    
    if resp and resp.status_code == 200:
        log_test("13e", True, "200", "200", "POST /api/dev/simulate-transition works")
    else:
        log_test("13e", False, "200", str(resp.status_code if resp else "No response"),
                 "POST /api/dev/simulate-transition failed")
    
    # Test 13f: GET /api/search
    resp = make_request("GET", "/search?q=test&type=all", token=regression_token)
    
    if resp and resp.status_code == 200:
        log_test("13f", True, "200", "200", "GET /api/search works")
        return True
    else:
        log_test("13f", False, "200", str(resp.status_code if resp else "No response"),
                 "GET /api/search failed")
        return False


def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for r in results if r["passed"])
    failed = sum(1 for r in results if not r["passed"])
    total = len(results)
    
    print(f"\nTotal Tests: {total}")
    print(f"Passed: {passed} ✅")
    print(f"Failed: {failed} ❌")
    print(f"Success Rate: {(passed/total*100):.1f}%\n")
    
    if failed > 0:
        print("FAILED TESTS:")
        print("-" * 80)
        for r in results:
            if not r["passed"]:
                print(f"Scenario {r['scenario']}: {r['details']}")
                print(f"  Expected: {r['expected']}")
                print(f"  Actual: {r['actual']}")
                print()
    
    return failed == 0


def main():
    """Run all tests"""
    print("="*80)
    print("INS PHASE A BACKEND TEST SUITE")
    print("="*80)
    print(f"Backend URL: {BASE_URL}")
    print()
    
    try:
        # Run all tests in sequence
        test_1_registration()
        test_2_get_mine()
        test_3_pending_access()
        test_4_verification_approval()
        test_5_ownership()
        test_6_profile()
        test_7_member_association()
        test_8_custom_role()
        test_9_authorization_enforcement()
        test_10_role_assignment_approval()
        test_11_scope()
        test_12_revoke()
        test_13_regression()
        
        # Print summary
        success = print_summary()
        
        sys.exit(0 if success else 1)
        
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
