"""
End-to-end pytest coverage for Traksha backend.

Covers: auth, identity (TMP->TRK via dev simulate), profile/privacy,
connections, QR, messaging, calls availability, safety (block/report),
Tattvaloka contributions & comments, transition ceremony.
"""

import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://traksha-identity.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def _mk_email(prefix="user"):
    return f"TEST_{prefix}_{uuid.uuid4().hex[:8]}@example.com"


def _register(display="Test User"):
    r = requests.post(f"{API}/auth/register", json={
        "email": _mk_email(), "password": "password123", "display_name": display})
    assert r.status_code == 200, r.text
    return r.json()


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def user_a():
    return _register("Alice A")


@pytest.fixture(scope="module")
def user_b():
    return _register("Bob B")


@pytest.fixture(scope="module")
def user_c():
    # third party for blocked / non-connected checks
    return _register("Carol C")


# ---------------------------------------------------------------------------
# health
# ---------------------------------------------------------------------------
def test_health_root():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---------------------------------------------------------------------------
# AUTH
# ---------------------------------------------------------------------------
class TestAuth:
    def test_register_creates_tmp_with_16char_code(self, user_a):
        u = user_a["user"]
        assert u["identity_type"] == "TMP"
        assert len(u["identity_code"]) == 16
        assert u["tmp_code"] == u["identity_code"]
        assert u["trk_code"] is None
        assert u["transition_due_at"] is not None
        assert u["day_of_journey"] == 1

    def test_register_reserved_domain_rejected(self):
        r = requests.post(f"{API}/auth/register", json={
            "email": f"x_{uuid.uuid4().hex[:6]}@bad.test",
            "password": "password123", "display_name": "X"})
        assert r.status_code in (400, 422), r.text

    def test_login_success(self, user_a):
        # Register a fresh account we know the password of
        email = _mk_email("login")
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "password123", "display_name": "L"})
        assert r.status_code == 200
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": "password123"})
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": "aarav@example.com", "password": "WRONG"})
        assert r.status_code == 401

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_returns_private_profile(self, user_a):
        r = requests.get(f"{API}/auth/me", headers=_auth(user_a["access_token"]))
        assert r.status_code == 200
        data = r.json()
        assert data["email"].startswith("test_") or "@example.com" in data["email"]
        assert "privacy" in data and "availability" in data

    def test_logout_ok(self, user_a):
        r = requests.post(f"{API}/auth/logout", headers=_auth(user_a["access_token"]))
        assert r.status_code == 200

    def test_forgot_password_returns_dev_token_and_reset_once(self):
        email = _mk_email("reset")
        requests.post(f"{API}/auth/register", json={
            "email": email, "password": "password123", "display_name": "R"})
        r = requests.post(f"{API}/auth/forgot-password", json={"email": email})
        assert r.status_code == 200
        token = r.json().get("dev_reset_token")
        assert token
        # reset works
        r2 = requests.post(f"{API}/auth/reset-password",
                           json={"token": token, "new_password": "newpassword123"})
        assert r2.status_code == 200
        # cannot reuse
        r3 = requests.post(f"{API}/auth/reset-password",
                           json={"token": token, "new_password": "anotherpass123"})
        assert r3.status_code == 400
        # login with new password works
        r4 = requests.post(f"{API}/auth/login",
                           json={"email": email, "password": "newpassword123"})
        assert r4.status_code == 200


# ---------------------------------------------------------------------------
# IDENTITY / TRANSITION
# ---------------------------------------------------------------------------
class TestIdentityTransition:
    def test_simulate_transition_creates_trk(self):
        reg = _register("Trans User")
        h = _auth(reg["access_token"])
        tmp = reg["user"]["tmp_code"]

        r = requests.post(f"{API}/dev/simulate-transition", headers=h)
        assert r.status_code == 200, r.text
        trk = r.json()["trk_code"]
        assert len(trk) == 16
        assert trk != tmp

        # second call should be 400 (idempotent: already TRK)
        r2 = requests.post(f"{API}/dev/simulate-transition", headers=h)
        assert r2.status_code == 400, r2.text

        # /transition returns ceremony
        r3 = requests.get(f"{API}/transition", headers=h)
        assert r3.status_code == 200
        j = r3.json()
        assert j["available"] is True
        assert j["tmp_code"] == tmp
        assert j["trk_code"] == trk
        assert j.get("ceremony_viewed") is False

        # complete marks viewed
        r4 = requests.post(f"{API}/transition/complete", headers=h)
        assert r4.status_code == 200
        r5 = requests.get(f"{API}/transition", headers=h)
        assert r5.json()["ceremony_viewed"] is True

        # /auth/me shows TRK now
        me = requests.get(f"{API}/auth/me", headers=h).json()
        assert me["identity_type"] == "TRK"
        assert me["trk_code"] == trk


# ---------------------------------------------------------------------------
# CONNECTIONS + MESSAGING
# ---------------------------------------------------------------------------
class TestConnectionsAndMessaging:
    def _pair(self):
        a = _register("A conn")
        b = _register("B conn")
        return a, b

    def test_request_accept_flow_and_messaging(self):
        a, b = self._pair()
        ha, hb = _auth(a["access_token"]), _auth(b["access_token"])

        r = requests.post(f"{API}/connections/request", headers=ha,
                          json={"to_identity_code": b["user"]["identity_code"], "context": "personal"})
        assert r.status_code == 200, r.text
        req_id = r.json()["id"]

        # incoming shows on b
        incoming = requests.get(f"{API}/connections/requests?direction=incoming", headers=hb).json()
        assert any(x["id"] == req_id for x in incoming)

        # accept
        r2 = requests.post(f"{API}/connections/requests/{req_id}/accept", headers=hb)
        assert r2.status_code == 200
        conn_id = r2.json()["connection_id"]

        # both list see connection
        la = requests.get(f"{API}/connections", headers=ha).json()
        lb = requests.get(f"{API}/connections", headers=hb).json()
        assert any(c["id"] == conn_id for c in la)
        assert any(c["id"] == conn_id for c in lb)

        # send personal message
        m = requests.post(f"{API}/conversations/{conn_id}/messages", headers=ha,
                          json={"text": "hello there", "context": "personal"})
        assert m.status_code == 200, m.text
        assert m.json()["text"] == "hello there"
        assert m.json()["context"] == "personal"

        # GET personal messages
        msgs = requests.get(f"{API}/conversations/{conn_id}/personal/messages", headers=hb).json()
        assert any(x["text"] == "hello there" for x in msgs["messages"])

        # professional context is separate
        m2 = requests.post(f"{API}/conversations/{conn_id}/messages", headers=ha,
                           json={"text": "work talk", "context": "professional"})
        assert m2.status_code == 200
        pro = requests.get(f"{API}/conversations/{conn_id}/professional/messages", headers=hb).json()
        assert all(x["text"] != "hello there" for x in pro["messages"])
        assert any(x["text"] == "work talk" for x in pro["messages"])

        # non-connected user cannot post
        c = _register("Outsider C")
        hc = _auth(c["access_token"])
        r3 = requests.post(f"{API}/conversations/{conn_id}/messages", headers=hc,
                           json={"text": "hi", "context": "personal"})
        assert r3.status_code == 403

    def test_decline_and_withdraw(self):
        a, b = self._pair()
        ha, hb = _auth(a["access_token"]), _auth(b["access_token"])
        # decline
        r = requests.post(f"{API}/connections/request", headers=ha,
                          json={"to_identity_code": b["user"]["identity_code"]}).json()
        rid = r["id"]
        assert requests.post(f"{API}/connections/requests/{rid}/decline", headers=hb).status_code == 200
        # withdraw
        a2, b2 = self._pair()
        ha2, hb2 = _auth(a2["access_token"]), _auth(b2["access_token"])
        r = requests.post(f"{API}/connections/request", headers=ha2,
                          json={"to_identity_code": b2["user"]["identity_code"]}).json()
        assert requests.post(f"{API}/connections/requests/{r['id']}/withdraw",
                             headers=ha2).status_code == 200


# ---------------------------------------------------------------------------
# QR
# ---------------------------------------------------------------------------
class TestQR:
    def test_create_scan_connect_flow(self):
        a = _register("QR owner")
        b = _register("QR scanner")
        ha, hb = _auth(a["access_token"]), _auth(b["access_token"])
        r = requests.post(f"{API}/qr/create", headers=ha).json()
        assert "token" in r and r["ttl_minutes"] == 5
        token = r["token"]

        # scan: preview only
        s = requests.post(f"{API}/qr/scan", headers=hb, json={"token": token})
        assert s.status_code == 200
        assert s.json()["preview"]["identity_code"] == a["user"]["identity_code"]

        # scan does NOT create connection
        conns = requests.get(f"{API}/connections", headers=ha).json()
        assert len(conns) == 0

        # connect creates pending request
        c = requests.post(f"{API}/qr/connect", headers=hb,
                          json={"token": token, "context": "personal"})
        assert c.status_code == 200
        # verify owner sees incoming
        incoming = requests.get(f"{API}/connections/requests?direction=incoming", headers=ha).json()
        assert any(x["source"] == "qr" for x in incoming)

    def test_invalid_qr_token(self):
        a = _register("QR bad")
        ha = _auth(a["access_token"])
        r = requests.post(f"{API}/qr/scan", headers=ha, json={"token": "definitely-nope"})
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# CALL AVAILABILITY
# ---------------------------------------------------------------------------
class TestCalls:
    def _connect(self):
        a = _register("Call A")
        b = _register("Call B")
        ha, hb = _auth(a["access_token"]), _auth(b["access_token"])
        rid = requests.post(f"{API}/connections/request", headers=ha,
                            json={"to_identity_code": b["user"]["identity_code"]}).json()["id"]
        requests.post(f"{API}/connections/requests/{rid}/accept", headers=hb)
        return a, b, ha, hb

    def test_can_call_false_when_off_true_after_window(self):
        a, b, ha, hb = self._connect()
        # b default availability audio_on=False
        r = requests.get(f"{API}/calls/can-call/{b['user']['identity_code']}?kind=audio",
                         headers=ha).json()
        assert r["can_call"] is False

        # a requests availability, b accepts
        rid = requests.post(f"{API}/calls/availability-request", headers=ha,
                            json={"to_identity_code": b["user"]["identity_code"],
                                  "kind": "audio"}).json()["request_id"]
        acc = requests.post(f"{API}/calls/availability-request/{rid}/accept",
                            headers=hb, json={"window_minutes": 5})
        assert acc.status_code == 200

        # now can_call should be true
        r2 = requests.get(f"{API}/calls/can-call/{b['user']['identity_code']}?kind=audio",
                          headers=ha).json()
        assert r2["can_call"] is True

    def test_availability_toggle_persists(self):
        a = _register("Avail A")
        ha = _auth(a["access_token"])
        r = requests.put(f"{API}/settings/availability", headers=ha,
                         json={"audio_on": True, "video_on": True})
        assert r.status_code == 200
        assert r.json()["availability"]["audio_on"] is True


# ---------------------------------------------------------------------------
# PRIVACY & SEARCH
# ---------------------------------------------------------------------------
class TestPrivacy:
    def test_discoverable_false_hides_from_search(self):
        # Use a very unique display name
        unique = f"ZZUNIQ{uuid.uuid4().hex[:6].upper()}"
        r = requests.post(f"{API}/auth/register", json={
            "email": _mk_email("priv"), "password": "password123", "display_name": unique})
        assert r.status_code == 200
        token = r.json()["access_token"]
        h = _auth(token)

        # Second user to run search
        s = _register("Searcher"); hs = _auth(s["access_token"])
        result = requests.get(f"{API}/search?q={unique}&type=people", headers=hs).json()
        assert any(p["display_name"] == unique for p in result["people"])

        # Hide
        requests.put(f"{API}/settings/privacy", headers=h, json={"discoverable": False})
        result2 = requests.get(f"{API}/search?q={unique}&type=people", headers=hs).json()
        assert all(p["display_name"] != unique for p in result2["people"])

    def test_public_profile_hides_email(self):
        a = _register("Priv A"); s = _register("Priv Search")
        prof = requests.get(f"{API}/profile/{a['user']['identity_code']}",
                            headers=_auth(s["access_token"])).json()
        assert "email" not in prof


# ---------------------------------------------------------------------------
# SAFETY: BLOCK + REPORT
# ---------------------------------------------------------------------------
class TestSafety:
    def test_block_severs_connection_and_hides_profile(self):
        a = _register("Blk A"); b = _register("Blk B")
        ha, hb = _auth(a["access_token"]), _auth(b["access_token"])
        rid = requests.post(f"{API}/connections/request", headers=ha,
                            json={"to_identity_code": b["user"]["identity_code"]}).json()["id"]
        conn_id = requests.post(f"{API}/connections/requests/{rid}/accept",
                                headers=hb).json()["connection_id"]

        # Block from a
        r = requests.post(f"{API}/blocks", headers=ha,
                          json={"identity_code": b["user"]["identity_code"]})
        assert r.status_code == 200

        # profile is 404 for both directions
        assert requests.get(f"{API}/profile/{b['user']['identity_code']}",
                            headers=ha).status_code == 404
        assert requests.get(f"{API}/profile/{a['user']['identity_code']}",
                            headers=hb).status_code == 404

        # messaging is 403
        m = requests.post(f"{API}/conversations/{conn_id}/messages", headers=ha,
                          json={"text": "should fail", "context": "personal"})
        assert m.status_code == 403

    def test_report_reasons_and_submit(self):
        a = _register("Rep A"); b = _register("Rep B")
        ha = _auth(a["access_token"])
        r = requests.get(f"{API}/reports/reasons", headers=ha)
        assert r.status_code == 200
        reasons = r.json()["reasons"]
        assert "harassment" in reasons
        r2 = requests.post(f"{API}/reports", headers=ha, json={
            "target_type": "user", "target_id": b["user"]["identity_code"],
            "reason": "harassment", "detail": "test"})
        assert r2.status_code == 200


# ---------------------------------------------------------------------------
# TATTVALOKA
# ---------------------------------------------------------------------------
class TestTattvaloka:
    def test_seed_contributions_present(self):
        a = _register("Tat A")
        r = requests.get(f"{API}/contributions", headers=_auth(a["access_token"]))
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_tmp_cannot_publish(self):
        a = _register("Tat TMP")
        r = requests.post(f"{API}/contributions", headers=_auth(a["access_token"]),
                          json={"title": "T", "body": "B"})
        assert r.status_code == 403

    def test_trk_can_publish_and_comment(self):
        a = _register("Tat TRK"); h = _auth(a["access_token"])
        assert requests.post(f"{API}/dev/simulate-transition", headers=h).status_code == 200
        r = requests.post(f"{API}/contributions", headers=h,
                          json={"title": "Hello", "body": "World"})
        assert r.status_code == 200, r.text
        cid = r.json()["id"]

        # comment
        cm = requests.post(f"{API}/contributions/{cid}/comments", headers=h,
                           json={"body": "great post"})
        assert cm.status_code == 200
        # list comments
        lst = requests.get(f"{API}/contributions/{cid}/comments", headers=h).json()
        assert any(x["body"] == "great post" for x in lst)
