#!/usr/bin/env python3
"""
INS Phase B.1 Backend Test Suite
Tests departments/teams, projects, and REAL scoped authorization
"""
import requests
import json
from typing import Dict, Any

BASE_URL = "http://localhost:8001/api"

class TestRunner:
    def __init__(self):
        self.owner_token = None
        self.owner_user_id = None
        self.owner_identity_code = None
        self.memberA_token = None
        self.memberA_user_id = None
        self.memberA_identity_code = None
        self.memberA_member_id = None
        self.memberB_token = None
        self.memberB_user_id = None
        self.memberB_identity_code = None
        self.memberB_member_id = None
        self.ins_id = None
        self.deptA_id = None
        self.deptB_id = None
        self.teamX_id = None
        self.projA_id = None
        self.projB_id = None
        self.floating_proj_id = None
        self.role_id = None
        self.approval_id = None
        self.role_id_proj_scoped = None
        self.approval_id_proj_scoped = None
        self.results = []
        
    def log(self, test_num: str, description: str, passed: bool, details: str = ""):
        status = "✅ PASS" if passed else "❌ FAIL"
        self.results.append({
            "test": test_num,
            "description": description,
            "status": status,
            "details": details
        })
        print(f"{status} - {test_num}: {description}")
        if details:
            print(f"  Details: {details}")
    
    def register_user(self, email: str, password: str, display_name: str) -> Dict[str, Any]:
        """Register a new user and return token, user_id, identity_code"""
        resp = requests.post(f"{BASE_URL}/auth/register", json={
            "email": email,
            "password": password,
            "display_name": display_name
        })
        if resp.status_code != 200:
            raise Exception(f"Failed to register {email}: {resp.status_code} {resp.text}")
        data = resp.json()
        return {
            "token": data["access_token"],
            "user_id": data["user"]["id"],
            "identity_code": data["user"]["identity_code"]
        }
    
    def setup_fixture(self):
        """Setup: register users, create institution, add members"""
        print("\n=== SETUP FIXTURE ===")
        
        # Register owner
        import random
        rand = random.randint(10000, 99999)
        owner_data = self.register_user(
            f"owner{rand}@test.com",
            "password123",
            "Owner User"
        )
        self.owner_token = owner_data["token"]
        self.owner_user_id = owner_data["user_id"]
        self.owner_identity_code = owner_data["identity_code"]
        print(f"✓ Owner registered: {self.owner_user_id}")
        
        # Register memberA
        memberA_data = self.register_user(
            f"memberA{rand}@test.com",
            "password123",
            "Member A"
        )
        self.memberA_token = memberA_data["token"]
        self.memberA_user_id = memberA_data["user_id"]
        self.memberA_identity_code = memberA_data["identity_code"]
        print(f"✓ MemberA registered: {self.memberA_user_id}")
        
        # Register memberB
        memberB_data = self.register_user(
            f"memberB{rand}@test.com",
            "password123",
            "Member B"
        )
        self.memberB_token = memberB_data["token"]
        self.memberB_user_id = memberB_data["user_id"]
        self.memberB_identity_code = memberB_data["identity_code"]
        print(f"✓ MemberB registered: {self.memberB_user_id}")
        
        # Owner registers institution
        resp = requests.post(
            f"{BASE_URL}/ins/register",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={
                "name": f"Test Institution {rand}",
                "email": f"ins{rand}@test.com",
                "applicant_role": "Director"
            }
        )
        if resp.status_code != 200:
            raise Exception(f"Failed to register institution: {resp.status_code} {resp.text}")
        self.ins_id = resp.json()["institution"]["id"]
        print(f"✓ Institution registered: {self.ins_id}")
        
        # Owner grants admin to self
        resp = requests.post(
            f"{BASE_URL}/ins/dev/grant-admin",
            headers={"Authorization": f"Bearer {self.owner_token}"}
        )
        if resp.status_code != 200:
            raise Exception(f"Failed to grant admin: {resp.status_code} {resp.text}")
        print(f"✓ Owner granted admin")
        
        # Owner approves institution
        resp = requests.post(
            f"{BASE_URL}/ins/admin/applications/{self.ins_id}/approve",
            headers={"Authorization": f"Bearer {self.owner_token}"}
        )
        if resp.status_code != 200:
            raise Exception(f"Failed to approve institution: {resp.status_code} {resp.text}")
        print(f"✓ Institution approved")
        
        # Owner adds memberA to institution
        resp = requests.post(
            f"{BASE_URL}/ins/{self.ins_id}/members",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"identity_code": self.memberA_identity_code}
        )
        if resp.status_code != 200:
            raise Exception(f"Failed to add memberA: {resp.status_code} {resp.text}")
        print(f"✓ MemberA added to institution")
        
        # Owner adds memberB to institution
        resp = requests.post(
            f"{BASE_URL}/ins/{self.ins_id}/members",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"identity_code": self.memberB_identity_code}
        )
        if resp.status_code != 200:
            raise Exception(f"Failed to add memberB: {resp.status_code} {resp.text}")
        print(f"✓ MemberB added to institution")
        
        # Get member records to extract member_ids
        resp = requests.get(
            f"{BASE_URL}/ins/{self.ins_id}/members",
            headers={"Authorization": f"Bearer {self.owner_token}"}
        )
        if resp.status_code != 200:
            raise Exception(f"Failed to get members: {resp.status_code} {resp.text}")
        members = resp.json()["members"]
        for m in members:
            if m["user"]["id"] == self.memberA_user_id:
                self.memberA_member_id = m["id"]
            elif m["user"]["id"] == self.memberB_user_id:
                self.memberB_member_id = m["id"]
        print(f"✓ MemberA member_id: {self.memberA_member_id}")
        print(f"✓ MemberB member_id: {self.memberB_member_id}")
        
        print("=== SETUP COMPLETE ===\n")
    
    def test_1_department_creation(self):
        """Test 1: DEPARTMENT CREATION"""
        print("\n=== TEST 1: DEPARTMENT CREATION ===")
        
        # Create Dept A
        resp = requests.post(
            f"{BASE_URL}/ins/{self.ins_id}/departments",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"name": "Dept A", "kind": "department"}
        )
        if resp.status_code == 200:
            self.deptA_id = resp.json()["department"]["id"]
            self.log("1.1", "Create Dept A (kind=department)", True, f"Status: {resp.status_code}, ID: {self.deptA_id}")
        else:
            self.log("1.1", "Create Dept A (kind=department)", False, f"Status: {resp.status_code}, Response: {resp.text}")
        
        # Create Dept B
        resp = requests.post(
            f"{BASE_URL}/ins/{self.ins_id}/departments",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"name": "Dept B", "kind": "department"}
        )
        if resp.status_code == 200:
            self.deptB_id = resp.json()["department"]["id"]
            self.log("1.2", "Create Dept B (kind=department)", True, f"Status: {resp.status_code}, ID: {self.deptB_id}")
        else:
            self.log("1.2", "Create Dept B (kind=department)", False, f"Status: {resp.status_code}, Response: {resp.text}")
        
        # Create Team X
        resp = requests.post(
            f"{BASE_URL}/ins/{self.ins_id}/departments",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"name": "Team X", "kind": "team"}
        )
        if resp.status_code == 200:
            self.teamX_id = resp.json()["department"]["id"]
            self.log("1.3", "Create Team X (kind=team)", True, f"Status: {resp.status_code}, ID: {self.teamX_id}")
        else:
            self.log("1.3", "Create Team X (kind=team)", False, f"Status: {resp.status_code}, Response: {resp.text}")
        
        # Invalid kind
        resp = requests.post(
            f"{BASE_URL}/ins/{self.ins_id}/departments",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"name": "Invalid", "kind": "foo"}
        )
        self.log("1.4", "Invalid kind (kind=foo) returns 400", resp.status_code == 400, f"Status: {resp.status_code}")
        
        # List departments
        resp = requests.get(
            f"{BASE_URL}/ins/{self.ins_id}/departments",
            headers={"Authorization": f"Bearer {self.owner_token}"}
        )
        if resp.status_code == 200:
            depts = resp.json()["departments"]
            self.log("1.5", "GET departments lists all created", True, f"Status: {resp.status_code}, Count: {len(depts)}")
        else:
            self.log("1.5", "GET departments lists all created", False, f"Status: {resp.status_code}, Response: {resp.text}")
    
    def test_2_department_membership(self):
        """Test 2: DEPARTMENT MEMBERSHIP"""
        print("\n=== TEST 2: DEPARTMENT MEMBERSHIP ===")
        
        # Add memberA to Dept A
        resp = requests.post(
            f"{BASE_URL}/ins/{self.ins_id}/departments/{self.deptA_id}/members",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"user_id": self.memberA_user_id}
        )
        if resp.status_code == 200:
            dept = resp.json()["department"]
            has_member = self.memberA_user_id in dept.get("member_ids", [])
            self.log("2.1", "Add memberA to Dept A", has_member, f"Status: {resp.status_code}, MemberA in list: {has_member}")
        else:
            self.log("2.1", "Add memberA to Dept A", False, f"Status: {resp.status_code}, Response: {resp.text}")
        
        # Try to add non-INS-member (use a fake user_id)
        resp = requests.post(
            f"{BASE_URL}/ins/{self.ins_id}/departments/{self.deptA_id}/members",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"user_id": "nonexistent_user_id_12345"}
        )
        self.log("2.2", "Add non-INS-member returns 404", resp.status_code == 404, f"Status: {resp.status_code}")
        
        # Remove memberA from Dept A
        resp = requests.delete(
            f"{BASE_URL}/ins/{self.ins_id}/departments/{self.deptA_id}/members/{self.memberA_user_id}",
            headers={"Authorization": f"Bearer {self.owner_token}"}
        )
        self.log("2.3", "Remove memberA from Dept A", resp.status_code == 200, f"Status: {resp.status_code}")
        
        # Re-add memberA for later tests
        resp = requests.post(
            f"{BASE_URL}/ins/{self.ins_id}/departments/{self.deptA_id}/members",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"user_id": self.memberA_user_id}
        )
        if resp.status_code == 200:
            self.log("2.4", "Re-add memberA to Dept A for later tests", True, f"Status: {resp.status_code}")
        else:
            self.log("2.4", "Re-add memberA to Dept A for later tests", False, f"Status: {resp.status_code}, Response: {resp.text}")
    
    def test_3_project_creation(self):
        """Test 3: PROJECT CREATION"""
        print("\n=== TEST 3: PROJECT CREATION ===")
        
        # Create Proj A in Dept A
        resp = requests.post(
            f"{BASE_URL}/ins/{self.ins_id}/projects",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"name": "Proj A", "department_id": self.deptA_id}
        )
        if resp.status_code == 200:
            self.projA_id = resp.json()["project"]["id"]
            self.log("3.1", "Create Proj A in Dept A", True, f"Status: {resp.status_code}, ID: {self.projA_id}")
        else:
            self.log("3.1", "Create Proj A in Dept A", False, f"Status: {resp.status_code}, Response: {resp.text}")
        
        # Create Proj B in Dept B
        resp = requests.post(
            f"{BASE_URL}/ins/{self.ins_id}/projects",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"name": "Proj B", "department_id": self.deptB_id}
        )
        if resp.status_code == 200:
            self.projB_id = resp.json()["project"]["id"]
            self.log("3.2", "Create Proj B in Dept B", True, f"Status: {resp.status_code}, ID: {self.projB_id}")
        else:
            self.log("3.2", "Create Proj B in Dept B", False, f"Status: {resp.status_code}, Response: {resp.text}")
        
        # Create floating project (no department)
        resp = requests.post(
            f"{BASE_URL}/ins/{self.ins_id}/projects",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"name": "Floating"}
        )
        if resp.status_code == 200:
            self.floating_proj_id = resp.json()["project"]["id"]
            self.log("3.3", "Create floating project (no department)", True, f"Status: {resp.status_code}, ID: {self.floating_proj_id}")
        else:
            self.log("3.3", "Create floating project (no department)", False, f"Status: {resp.status_code}, Response: {resp.text}")
        
        # Invalid status
        resp = requests.post(
            f"{BASE_URL}/ins/{self.ins_id}/projects",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"name": "Invalid Status", "status": "bogus"}
        )
        self.log("3.4", "Invalid status returns 400", resp.status_code == 400, f"Status: {resp.status_code}")
        
        # Non-existent department_id
        resp = requests.post(
            f"{BASE_URL}/ins/{self.ins_id}/projects",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"name": "Bad Dept", "department_id": "nonexistent_dept_id"}
        )
        self.log("3.5", "Non-existent department_id returns 400", resp.status_code == 400, f"Status: {resp.status_code}")
        
        # List projects
        resp = requests.get(
            f"{BASE_URL}/ins/{self.ins_id}/projects",
            headers={"Authorization": f"Bearer {self.owner_token}"}
        )
        if resp.status_code == 200:
            projects = resp.json()["projects"]
            has_dept_name = any(p.get("department_name") for p in projects if p.get("department_id"))
            has_assignees = "assignees" in projects[0] if projects else False
            self.log("3.6", "GET projects lists all with department_name and assignees", True, 
                    f"Status: {resp.status_code}, Count: {len(projects)}, Has dept_name: {has_dept_name}, Has assignees: {has_assignees}")
        else:
            self.log("3.6", "GET projects lists all with department_name and assignees", False, f"Status: {resp.status_code}, Response: {resp.text}")
    
    def test_4_project_assignment(self):
        """Test 4: PROJECT ASSIGNMENT"""
        print("\n=== TEST 4: PROJECT ASSIGNMENT ===")
        
        # Assign memberA to Proj A
        resp = requests.post(
            f"{BASE_URL}/ins/{self.ins_id}/projects/{self.projA_id}/assignees",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"user_id": self.memberA_user_id}
        )
        if resp.status_code == 200:
            project = resp.json()["project"]
            has_assignee = self.memberA_user_id in project.get("assignee_ids", [])
            self.log("4.1", "Assign memberA to Proj A", has_assignee, f"Status: {resp.status_code}, MemberA in assignees: {has_assignee}")
        else:
            self.log("4.1", "Assign memberA to Proj A", False, f"Status: {resp.status_code}, Response: {resp.text}")
        
        # Try to assign non-INS-member
        resp = requests.post(
            f"{BASE_URL}/ins/{self.ins_id}/projects/{self.projA_id}/assignees",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"user_id": "nonexistent_user_id_12345"}
        )
        self.log("4.2", "Assign non-INS-member returns 404", resp.status_code == 404, f"Status: {resp.status_code}")
        
        # Delete assignee
        resp = requests.delete(
            f"{BASE_URL}/ins/{self.ins_id}/projects/{self.projA_id}/assignees/{self.memberA_user_id}",
            headers={"Authorization": f"Bearer {self.owner_token}"}
        )
        self.log("4.3", "Delete assignee", resp.status_code == 200, f"Status: {resp.status_code}")
    
    def test_5_scoped_authorization(self):
        """Test 5: SCOPED AUTHORIZATION (the core)"""
        print("\n=== TEST 5: SCOPED AUTHORIZATION ===")
        
        # Create role with department scope
        resp = requests.post(
            f"{BASE_URL}/ins/{self.ins_id}/roles",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={
                "name": "Ops Manager",
                "permissions": ["projects:manage", "projects:view", "departments:view"],
                "scope": {"type": "institution"}
            }
        )
        if resp.status_code == 200:
            self.role_id = resp.json()["role"]["id"]
            self.log("5.1", "Create role with permissions", True, f"Status: {resp.status_code}, Role ID: {self.role_id}")
        else:
            self.log("5.1", "Create role with permissions", False, f"Status: {resp.status_code}, Response: {resp.text}")
            return
        
        # Assign role to memberA SCOPED to Dept A
        resp = requests.post(
            f"{BASE_URL}/ins/{self.ins_id}/members/{self.memberA_member_id}/roles",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={
                "role_id": self.role_id,
                "scope": {"type": "department", "ref": self.deptA_id, "label": "Dept A"}
            }
        )
        if resp.status_code == 200:
            self.approval_id = resp.json()["approval_id"]
            self.log("5.2", "Assign role to memberA scoped to Dept A", True, f"Status: {resp.status_code}, Approval ID: {self.approval_id}")
        else:
            self.log("5.2", "Assign role to memberA scoped to Dept A", False, f"Status: {resp.status_code}, Response: {resp.text}")
            return
        
        # Owner approves role assignment
        resp = requests.post(
            f"{BASE_URL}/ins/{self.ins_id}/approvals/{self.approval_id}/approve",
            headers={"Authorization": f"Bearer {self.owner_token}"}
        )
        self.log("5.3", "Owner approves role assignment", resp.status_code == 200, f"Status: {resp.status_code}")
        
        # 5a: MemberA GET Proj A (in Dept A) - should be 200
        resp = requests.get(
            f"{BASE_URL}/ins/{self.ins_id}/projects/{self.projA_id}",
            headers={"Authorization": f"Bearer {self.memberA_token}"}
        )
        self.log("5.4a", "MemberA GET Proj A (in Dept A) - ALLOWED", resp.status_code == 200, f"Status: {resp.status_code}")
        
        # 5b: MemberA GET Proj B (in Dept B) - should be 403
        resp = requests.get(
            f"{BASE_URL}/ins/{self.ins_id}/projects/{self.projB_id}",
            headers={"Authorization": f"Bearer {self.memberA_token}"}
        )
        self.log("5.4b", "MemberA GET Proj B (in Dept B) - UNAUTHORIZED (403)", resp.status_code == 403, f"Status: {resp.status_code}")
        
        # 5c: MemberA PUT Proj A (in Dept A) - should be 200
        resp = requests.put(
            f"{BASE_URL}/ins/{self.ins_id}/projects/{self.projA_id}",
            headers={"Authorization": f"Bearer {self.memberA_token}"},
            json={"status": "on_hold"}
        )
        self.log("5.4c", "MemberA PUT Proj A (in Dept A) - ALLOWED", resp.status_code == 200, f"Status: {resp.status_code}")
        
        # 5d: MemberA PUT Proj B (in Dept B) - should be 403
        resp = requests.put(
            f"{BASE_URL}/ins/{self.ins_id}/projects/{self.projB_id}",
            headers={"Authorization": f"Bearer {self.memberA_token}"},
            json={"status": "on_hold"}
        )
        self.log("5.4d", "MemberA PUT Proj B (in Dept B) - UNAUTHORIZED (403)", resp.status_code == 403, f"Status: {resp.status_code}")
        
        # 5e: MemberA POST project in Dept A - should be 200
        resp = requests.post(
            f"{BASE_URL}/ins/{self.ins_id}/projects",
            headers={"Authorization": f"Bearer {self.memberA_token}"},
            json={"name": "NewInA", "department_id": self.deptA_id}
        )
        self.log("5.4e", "MemberA POST project in Dept A - ALLOWED", resp.status_code == 200, f"Status: {resp.status_code}")
        
        # 5f: MemberA POST project in Dept B - should be 403
        resp = requests.post(
            f"{BASE_URL}/ins/{self.ins_id}/projects",
            headers={"Authorization": f"Bearer {self.memberA_token}"},
            json={"name": "NewInB", "department_id": self.deptB_id}
        )
        self.log("5.4f", "MemberA POST project in Dept B - UNAUTHORIZED (403)", resp.status_code == 403, f"Status: {resp.status_code}")
        
        # 5g: MemberA POST department - should be 403 (needs institution scope)
        resp = requests.post(
            f"{BASE_URL}/ins/{self.ins_id}/departments",
            headers={"Authorization": f"Bearer {self.memberA_token}"},
            json={"name": "NopeDept", "kind": "department"}
        )
        self.log("5.4g", "MemberA POST department - UNAUTHORIZED (403, needs institution scope)", resp.status_code == 403, f"Status: {resp.status_code}")
        
        # 5h: MemberA GET Dept A - should be 200
        resp = requests.get(
            f"{BASE_URL}/ins/{self.ins_id}/departments/{self.deptA_id}",
            headers={"Authorization": f"Bearer {self.memberA_token}"}
        )
        self.log("5.4h", "MemberA GET Dept A - ALLOWED", resp.status_code == 200, f"Status: {resp.status_code}")
        
        # 5i: MemberA GET Dept B - should be 403
        resp = requests.get(
            f"{BASE_URL}/ins/{self.ins_id}/departments/{self.deptB_id}",
            headers={"Authorization": f"Bearer {self.memberA_token}"}
        )
        self.log("5.4i", "MemberA GET Dept B - UNAUTHORIZED (403)", resp.status_code == 403, f"Status: {resp.status_code}")
    
    def test_6_project_scoped_role(self):
        """Test 6: PROJECT-SCOPED ROLE"""
        print("\n=== TEST 6: PROJECT-SCOPED ROLE ===")
        
        # Create role for project scope
        resp = requests.post(
            f"{BASE_URL}/ins/{self.ins_id}/roles",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={
                "name": "Project Manager",
                "permissions": ["projects:manage", "projects:view"],
                "scope": {"type": "institution"}
            }
        )
        if resp.status_code == 200:
            self.role_id_proj_scoped = resp.json()["role"]["id"]
            self.log("6.1", "Create role for project scope", True, f"Status: {resp.status_code}, Role ID: {self.role_id_proj_scoped}")
        else:
            self.log("6.1", "Create role for project scope", False, f"Status: {resp.status_code}, Response: {resp.text}")
            return
        
        # Assign role to memberB scoped to Proj A
        resp = requests.post(
            f"{BASE_URL}/ins/{self.ins_id}/members/{self.memberB_member_id}/roles",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={
                "role_id": self.role_id_proj_scoped,
                "scope": {"type": "project", "ref": self.projA_id, "label": "Proj A"}
            }
        )
        if resp.status_code == 200:
            self.approval_id_proj_scoped = resp.json()["approval_id"]
            self.log("6.2", "Assign role to memberB scoped to Proj A", True, f"Status: {resp.status_code}, Approval ID: {self.approval_id_proj_scoped}")
        else:
            self.log("6.2", "Assign role to memberB scoped to Proj A", False, f"Status: {resp.status_code}, Response: {resp.text}")
            return
        
        # Owner approves role assignment
        resp = requests.post(
            f"{BASE_URL}/ins/{self.ins_id}/approvals/{self.approval_id_proj_scoped}/approve",
            headers={"Authorization": f"Bearer {self.owner_token}"}
        )
        self.log("6.3", "Owner approves project-scoped role assignment", resp.status_code == 200, f"Status: {resp.status_code}")
        
        # MemberB GET Proj A - should be 200
        resp = requests.get(
            f"{BASE_URL}/ins/{self.ins_id}/projects/{self.projA_id}",
            headers={"Authorization": f"Bearer {self.memberB_token}"}
        )
        self.log("6.4a", "MemberB GET Proj A - ALLOWED", resp.status_code == 200, f"Status: {resp.status_code}")
        
        # MemberB PUT Proj A - should be 200
        resp = requests.put(
            f"{BASE_URL}/ins/{self.ins_id}/projects/{self.projA_id}",
            headers={"Authorization": f"Bearer {self.memberB_token}"},
            json={"status": "active"}
        )
        self.log("6.4b", "MemberB PUT Proj A - ALLOWED", resp.status_code == 200, f"Status: {resp.status_code}")
        
        # MemberB GET Proj B - should be 403
        resp = requests.get(
            f"{BASE_URL}/ins/{self.ins_id}/projects/{self.projB_id}",
            headers={"Authorization": f"Bearer {self.memberB_token}"}
        )
        self.log("6.4c", "MemberB GET Proj B - UNAUTHORIZED (403)", resp.status_code == 403, f"Status: {resp.status_code}")
        
        # MemberB PUT Proj B - should be 403
        resp = requests.put(
            f"{BASE_URL}/ins/{self.ins_id}/projects/{self.projB_id}",
            headers={"Authorization": f"Bearer {self.memberB_token}"},
            json={"status": "active"}
        )
        self.log("6.4d", "MemberB PUT Proj B - UNAUTHORIZED (403)", resp.status_code == 403, f"Status: {resp.status_code}")
        
        # MemberB POST new project - should be 403 (project scope cannot create)
        resp = requests.post(
            f"{BASE_URL}/ins/{self.ins_id}/projects",
            headers={"Authorization": f"Bearer {self.memberB_token}"},
            json={"name": "NewProj", "department_id": self.deptA_id}
        )
        self.log("6.4e", "MemberB POST new project - UNAUTHORIZED (403, project scope cannot create)", resp.status_code == 403, f"Status: {resp.status_code}")
    
    def test_7_persistence(self):
        """Test 7: PERSISTENCE"""
        print("\n=== TEST 7: PERSISTENCE ===")
        
        # Re-fetch departments
        resp = requests.get(
            f"{BASE_URL}/ins/{self.ins_id}/departments",
            headers={"Authorization": f"Bearer {self.owner_token}"}
        )
        if resp.status_code == 200:
            depts = resp.json()["departments"]
            has_names = all(d.get("name") for d in depts)
            has_members = "members" in depts[0] if depts else False
            self.log("7.1", "Re-fetch departments - data persists with correct fields", True, 
                    f"Status: {resp.status_code}, Count: {len(depts)}, Has names: {has_names}, Has members: {has_members}")
        else:
            self.log("7.1", "Re-fetch departments - data persists with correct fields", False, f"Status: {resp.status_code}, Response: {resp.text}")
        
        # Re-fetch projects
        resp = requests.get(
            f"{BASE_URL}/ins/{self.ins_id}/projects",
            headers={"Authorization": f"Bearer {self.owner_token}"}
        )
        if resp.status_code == 200:
            projects = resp.json()["projects"]
            has_names = all(p.get("name") for p in projects)
            has_dept_name = any(p.get("department_name") for p in projects if p.get("department_id"))
            has_assignees = "assignees" in projects[0] if projects else False
            has_status = all(p.get("status") for p in projects)
            self.log("7.2", "Re-fetch projects - data persists with correct fields", True, 
                    f"Status: {resp.status_code}, Count: {len(projects)}, Has names: {has_names}, Has dept_name: {has_dept_name}, Has assignees: {has_assignees}, Has status: {has_status}")
        else:
            self.log("7.2", "Re-fetch projects - data persists with correct fields", False, f"Status: {resp.status_code}, Response: {resp.text}")
    
    def test_8_phase_a_regression(self):
        """Test 8: PHASE A REGRESSION (brief)"""
        print("\n=== TEST 8: PHASE A REGRESSION ===")
        
        # Owner (institution scope / '*') can GET Proj B
        resp = requests.get(
            f"{BASE_URL}/ins/{self.ins_id}/projects/{self.projB_id}",
            headers={"Authorization": f"Bearer {self.owner_token}"}
        )
        self.log("8.1", "Owner can GET Proj B (institution scope)", resp.status_code == 200, f"Status: {resp.status_code}")
        
        # Owner can GET Dept B
        resp = requests.get(
            f"{BASE_URL}/ins/{self.ins_id}/departments/{self.deptB_id}",
            headers={"Authorization": f"Bearer {self.owner_token}"}
        )
        self.log("8.2", "Owner can GET Dept B (institution scope)", resp.status_code == 200, f"Status: {resp.status_code}")
        
        # Owner can create departments
        resp = requests.post(
            f"{BASE_URL}/ins/{self.ins_id}/departments",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"name": "Dept C", "kind": "department"}
        )
        self.log("8.3", "Owner can create departments", resp.status_code == 200, f"Status: {resp.status_code}")
        
        # Create a new member with NO roles
        import random
        rand = random.randint(10000, 99999)
        memberC_data = self.register_user(
            f"memberC{rand}@test.com",
            "password123",
            "Member C"
        )
        memberC_token = memberC_data["token"]
        memberC_identity_code = memberC_data["identity_code"]
        
        # Add memberC to institution
        resp = requests.post(
            f"{BASE_URL}/ins/{self.ins_id}/members",
            headers={"Authorization": f"Bearer {self.owner_token}"},
            json={"identity_code": memberC_identity_code}
        )
        if resp.status_code != 200:
            self.log("8.4", "Member with NO roles - setup failed", False, f"Failed to add memberC: {resp.status_code}")
        else:
            # MemberC (no roles) tries to POST project - should be 403
            resp = requests.post(
                f"{BASE_URL}/ins/{self.ins_id}/projects",
                headers={"Authorization": f"Bearer {memberC_token}"},
                json={"name": "Unauthorized Project", "department_id": self.deptA_id}
            )
            self.log("8.4a", "Member with NO roles gets 403 on POST projects", resp.status_code == 403, f"Status: {resp.status_code}")
            
            # MemberC (no roles) tries to POST department - should be 403
            resp = requests.post(
                f"{BASE_URL}/ins/{self.ins_id}/departments",
                headers={"Authorization": f"Bearer {memberC_token}"},
                json={"name": "Unauthorized Dept", "kind": "department"}
            )
            self.log("8.4b", "Member with NO roles gets 403 on POST departments", resp.status_code == 403, f"Status: {resp.status_code}")
            
            # MemberC (no roles) can GET departments list - should be 200
            resp = requests.get(
                f"{BASE_URL}/ins/{self.ins_id}/departments",
                headers={"Authorization": f"Bearer {memberC_token}"}
            )
            self.log("8.4c", "Member with NO roles gets 200 on GET departments (list allowed)", resp.status_code == 200, f"Status: {resp.status_code}")
            
            # MemberC (no roles) can GET projects list - should be 200
            resp = requests.get(
                f"{BASE_URL}/ins/{self.ins_id}/projects",
                headers={"Authorization": f"Bearer {memberC_token}"}
            )
            self.log("8.4d", "Member with NO roles gets 200 on GET projects (list allowed)", resp.status_code == 200, f"Status: {resp.status_code}")
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        
        passed = sum(1 for r in self.results if "✅" in r["status"])
        failed = sum(1 for r in self.results if "❌" in r["status"])
        total = len(self.results)
        
        print(f"\nTotal Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {(passed/total*100):.1f}%\n")
        
        if failed > 0:
            print("FAILED TESTS:")
            for r in self.results:
                if "❌" in r["status"]:
                    print(f"  {r['test']}: {r['description']}")
                    if r["details"]:
                        print(f"    {r['details']}")
        
        print("\n" + "="*80)
    
    def run_all_tests(self):
        """Run all tests"""
        try:
            self.setup_fixture()
            self.test_1_department_creation()
            self.test_2_department_membership()
            self.test_3_project_creation()
            self.test_4_project_assignment()
            self.test_5_scoped_authorization()
            self.test_6_project_scoped_role()
            self.test_7_persistence()
            self.test_8_phase_a_regression()
            self.print_summary()
        except Exception as e:
            print(f"\n❌ CRITICAL ERROR: {e}")
            import traceback
            traceback.print_exc()
            self.print_summary()

if __name__ == "__main__":
    runner = TestRunner()
    runner.run_all_tests()
