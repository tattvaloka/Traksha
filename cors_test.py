#!/usr/bin/env python3
"""
CORS Fix Verification Test
Tests the CORS configuration to ensure the forbidden combination of
Access-Control-Allow-Origin: * + Access-Control-Allow-Credentials: true
has been eliminated.
"""

import requests
import secrets
import json
from datetime import datetime

# Public URL for testing
BASE_URL = "https://e5ed1e9a-897f-4712-aed1-a733a0985574.preview.emergentagent.com"
API_URL = f"{BASE_URL}/api"

# Test origin for cross-origin requests
TEST_ORIGIN = "https://app.emergent.sh"

def print_section(title):
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")

def print_headers(headers, prefix=""):
    """Print relevant CORS headers"""
    cors_headers = {
        k: v for k, v in headers.items() 
        if k.lower().startswith('access-control-')
    }
    if cors_headers:
        print(f"{prefix}CORS Headers:")
        for k, v in cors_headers.items():
            print(f"{prefix}  {k}: {v}")
    else:
        print(f"{prefix}No CORS headers found")

def check_forbidden_combination(headers, test_name):
    """Check if the forbidden CORS combination exists"""
    allow_origin = headers.get('Access-Control-Allow-Origin', '').strip()
    allow_credentials = headers.get('Access-Control-Allow-Credentials', '').strip()
    
    print(f"\n{test_name} - CORS Header Analysis:")
    print(f"  Access-Control-Allow-Origin: {allow_origin or '(not present)'}")
    print(f"  Access-Control-Allow-Credentials: {allow_credentials or '(not present)'}")
    
    # Check for the forbidden combination
    if allow_origin == '*' and allow_credentials.lower() == 'true':
        print(f"  ❌ FORBIDDEN COMBINATION DETECTED!")
        return False
    elif allow_origin == '*' and not allow_credentials:
        print(f"  ✅ VALID: Origin is * and credentials header is absent")
        return True
    elif allow_origin == '*':
        print(f"  ✅ VALID: Origin is * and credentials is not 'true'")
        return True
    else:
        print(f"  ✅ VALID: No forbidden combination")
        return True

def test_1_register():
    """Test 1: Register with cross-origin request"""
    print_section("TEST 1: POST /api/auth/register (Cross-Origin)")
    
    # Generate unique email
    unique_id = secrets.token_hex(4)
    email = f"corstest{unique_id}@test.com"
    
    payload = {
        "email": email,
        "password": "password123",
        "display_name": "CORS Test"
    }
    
    headers = {
        "Origin": TEST_ORIGIN,
        "Content-Type": "application/json"
    }
    
    print(f"Request: POST {API_URL}/auth/register")
    print(f"Origin: {TEST_ORIGIN}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(
            f"{API_URL}/auth/register",
            json=payload,
            headers=headers,
            timeout=30
        )
        
        print(f"\nResponse Status: {response.status_code}")
        print_headers(response.headers, prefix="  ")
        
        if response.status_code == 200:
            print(f"\n✅ Registration successful")
            data = response.json()
            access_token = data.get('access_token')
            print(f"Access token received: {access_token[:20]}..." if access_token else "No token")
            
            # Check CORS headers
            is_valid = check_forbidden_combination(response.headers, "Register")
            
            return {
                "success": True,
                "email": email,
                "password": "password123",
                "token": access_token,
                "cors_valid": is_valid
            }
        else:
            print(f"\n❌ Registration failed: {response.text}")
            is_valid = check_forbidden_combination(response.headers, "Register")
            return {"success": False, "cors_valid": is_valid}
            
    except Exception as e:
        print(f"\n❌ Exception: {e}")
        return {"success": False, "cors_valid": False}

def test_2_login(email, password):
    """Test 2: Login with cross-origin request"""
    print_section("TEST 2: POST /api/auth/login (Cross-Origin)")
    
    payload = {
        "email": email,
        "password": password
    }
    
    headers = {
        "Origin": TEST_ORIGIN,
        "Content-Type": "application/json"
    }
    
    print(f"Request: POST {API_URL}/auth/login")
    print(f"Origin: {TEST_ORIGIN}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(
            f"{API_URL}/auth/login",
            json=payload,
            headers=headers,
            timeout=30
        )
        
        print(f"\nResponse Status: {response.status_code}")
        print_headers(response.headers, prefix="  ")
        
        if response.status_code == 200:
            print(f"\n✅ Login successful")
            data = response.json()
            access_token = data.get('access_token')
            print(f"Access token received: {access_token[:20]}..." if access_token else "No token")
            
            # Check CORS headers
            is_valid = check_forbidden_combination(response.headers, "Login")
            
            return {
                "success": True,
                "token": access_token,
                "cors_valid": is_valid
            }
        else:
            print(f"\n❌ Login failed: {response.text}")
            is_valid = check_forbidden_combination(response.headers, "Login")
            return {"success": False, "cors_valid": is_valid}
            
    except Exception as e:
        print(f"\n❌ Exception: {e}")
        return {"success": False, "cors_valid": False}

def test_3_login_wrong_password(email):
    """Test 3: Login with wrong password (error path CORS check)"""
    print_section("TEST 3: POST /api/auth/login with WRONG password")
    
    payload = {
        "email": email,
        "password": "wrongpassword123"
    }
    
    headers = {
        "Origin": TEST_ORIGIN,
        "Content-Type": "application/json"
    }
    
    print(f"Request: POST {API_URL}/auth/login")
    print(f"Origin: {TEST_ORIGIN}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(
            f"{API_URL}/auth/login",
            json=payload,
            headers=headers,
            timeout=30
        )
        
        print(f"\nResponse Status: {response.status_code}")
        print_headers(response.headers, prefix="  ")
        
        if response.status_code == 401:
            print(f"\n✅ Expected 401 error received")
            print(f"Error message: {response.text}")
            
            # Check CORS headers on error path
            is_valid = check_forbidden_combination(response.headers, "Login Error")
            
            return {"success": True, "cors_valid": is_valid}
        else:
            print(f"\n❌ Unexpected status code: {response.status_code}")
            is_valid = check_forbidden_combination(response.headers, "Login Error")
            return {"success": False, "cors_valid": is_valid}
            
    except Exception as e:
        print(f"\n❌ Exception: {e}")
        return {"success": False, "cors_valid": False}

def test_4_options_preflight():
    """Test 4: OPTIONS preflight request"""
    print_section("TEST 4: OPTIONS /api/auth/login (Preflight)")
    
    headers = {
        "Origin": TEST_ORIGIN,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type"
    }
    
    print(f"Request: OPTIONS {API_URL}/auth/login")
    print(f"Origin: {TEST_ORIGIN}")
    print(f"Access-Control-Request-Method: POST")
    print(f"Access-Control-Request-Headers: content-type")
    
    try:
        response = requests.options(
            f"{API_URL}/auth/login",
            headers=headers,
            timeout=30
        )
        
        print(f"\nResponse Status: {response.status_code}")
        print_headers(response.headers, prefix="  ")
        
        if response.status_code == 200:
            print(f"\n✅ Preflight successful")
            
            # Check CORS headers
            is_valid = check_forbidden_combination(response.headers, "Preflight")
            
            return {"success": True, "cors_valid": is_valid}
        else:
            print(f"\n❌ Preflight failed with status: {response.status_code}")
            is_valid = check_forbidden_combination(response.headers, "Preflight")
            return {"success": False, "cors_valid": is_valid}
            
    except Exception as e:
        print(f"\n❌ Exception: {e}")
        return {"success": False, "cors_valid": False}

def test_5_authenticated_requests(token):
    """Test 5: Authenticated requests with Bearer token"""
    print_section("TEST 5: Authenticated Requests (Regression)")
    
    headers = {
        "Origin": TEST_ORIGIN,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Test 5a: GET /api/auth/me
    print("Test 5a: GET /api/auth/me")
    print(f"Request: GET {API_URL}/auth/me")
    print(f"Origin: {TEST_ORIGIN}")
    print(f"Authorization: Bearer {token[:20]}...")
    
    results = []
    
    try:
        response = requests.get(
            f"{API_URL}/auth/me",
            headers=headers,
            timeout=30
        )
        
        print(f"\nResponse Status: {response.status_code}")
        print_headers(response.headers, prefix="  ")
        
        if response.status_code == 200:
            print(f"✅ /auth/me successful")
            data = response.json()
            print(f"User: {data.get('display_name')} ({data.get('email')})")
            is_valid = check_forbidden_combination(response.headers, "/auth/me")
            results.append({"endpoint": "/auth/me", "success": True, "cors_valid": is_valid})
        else:
            print(f"❌ /auth/me failed: {response.text}")
            is_valid = check_forbidden_combination(response.headers, "/auth/me")
            results.append({"endpoint": "/auth/me", "success": False, "cors_valid": is_valid})
            
    except Exception as e:
        print(f"❌ Exception: {e}")
        results.append({"endpoint": "/auth/me", "success": False, "cors_valid": False})
    
    # Test 5b: GET /api/ins/permissions/catalog
    print("\n" + "-"*80)
    print("Test 5b: GET /api/ins/permissions/catalog")
    print(f"Request: GET {API_URL}/ins/permissions/catalog")
    print(f"Origin: {TEST_ORIGIN}")
    print(f"Authorization: Bearer {token[:20]}...")
    
    try:
        response = requests.get(
            f"{API_URL}/ins/permissions/catalog",
            headers=headers,
            timeout=30
        )
        
        print(f"\nResponse Status: {response.status_code}")
        print_headers(response.headers, prefix="  ")
        
        if response.status_code == 200:
            print(f"✅ /ins/permissions/catalog successful")
            data = response.json()
            print(f"Permissions catalog: {len(data)} permissions")
            is_valid = check_forbidden_combination(response.headers, "/ins/permissions/catalog")
            results.append({"endpoint": "/ins/permissions/catalog", "success": True, "cors_valid": is_valid})
        else:
            print(f"❌ /ins/permissions/catalog failed: {response.text}")
            is_valid = check_forbidden_combination(response.headers, "/ins/permissions/catalog")
            results.append({"endpoint": "/ins/permissions/catalog", "success": False, "cors_valid": is_valid})
            
    except Exception as e:
        print(f"❌ Exception: {e}")
        results.append({"endpoint": "/ins/permissions/catalog", "success": False, "cors_valid": False})
    
    return results

def main():
    print("\n" + "="*80)
    print("  CORS FIX VERIFICATION TEST")
    print("  Testing against:", BASE_URL)
    print("  Test Origin:", TEST_ORIGIN)
    print("="*80)
    
    all_results = []
    
    # Test 1: Register
    result1 = test_1_register()
    all_results.append(("Register", result1))
    
    if not result1.get("success"):
        print("\n❌ Registration failed, cannot continue with remaining tests")
        return
    
    email = result1.get("email")
    password = result1.get("password")
    token = result1.get("token")
    
    # Test 2: Login
    result2 = test_2_login(email, password)
    all_results.append(("Login", result2))
    
    if result2.get("success") and result2.get("token"):
        token = result2.get("token")
    
    # Test 3: Login with wrong password
    result3 = test_3_login_wrong_password(email)
    all_results.append(("Login Wrong Password", result3))
    
    # Test 4: OPTIONS preflight
    result4 = test_4_options_preflight()
    all_results.append(("OPTIONS Preflight", result4))
    
    # Test 5: Authenticated requests
    if token:
        result5 = test_5_authenticated_requests(token)
        for r in result5:
            all_results.append((r["endpoint"], r))
    else:
        print("\n⚠️  No token available, skipping authenticated requests")
    
    # Summary
    print_section("SUMMARY")
    
    print("Test Results:")
    print("-" * 80)
    
    all_cors_valid = True
    all_tests_passed = True
    
    for test_name, result in all_results:
        if isinstance(result, dict):
            success = result.get("success", False)
            cors_valid = result.get("cors_valid", False)
            
            status = "✅ PASS" if success else "❌ FAIL"
            cors_status = "✅ CORS OK" if cors_valid else "❌ CORS INVALID"
            
            print(f"{test_name:40} {status:15} {cors_status}")
            
            if not cors_valid:
                all_cors_valid = False
            if not success:
                all_tests_passed = False
    
    print("-" * 80)
    
    print("\nFinal Verdict:")
    if all_cors_valid:
        print("✅ CORS FIX VERIFIED: The forbidden combination of")
        print("   Access-Control-Allow-Origin: * + Access-Control-Allow-Credentials: true")
        print("   has been ELIMINATED from all tested endpoints.")
    else:
        print("❌ CORS FIX INCOMPLETE: The forbidden combination still exists")
        print("   in one or more responses.")
    
    if all_tests_passed:
        print("\n✅ All functional tests passed")
    else:
        print("\n⚠️  Some functional tests failed (see details above)")
    
    print("\n" + "="*80)

if __name__ == "__main__":
    main()
