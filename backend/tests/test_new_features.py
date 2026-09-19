"""
Tests for the four new features requested in this iteration:
  1) Private Connection Notes
  2) Chat Context Switch (personal / professional / both = Hybrid)
  3) Contribution Drafts (TRK only)
  4) Profile Photos (upload + surfacing)
"""

import io
import os
import uuid
import struct
import zlib
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://traksha-audit.preview.emergentagent.com",
).rstrip("/")
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


def _connect(display_a="A", display_b="B", context="personal"):
    a = _register(display_a)
    b = _register(display_b)
    ha, hb = _auth(a["access_token"]), _auth(b["access_token"])
    r = requests.post(f"{API}/connections/request", headers=ha,
                      json={"to_identity_code": b["user"]["identity_code"], "context": context})
    assert r.status_code == 200, r.text
    rid = r.json()["id"]
    r2 = requests.post(f"{API}/connections/requests/{rid}/accept", headers=hb)
    assert r2.status_code == 200, r2.text
    conn_id = r2.json()["connection_id"]
    return a, b, ha, hb, conn_id


def _tiny_png() -> bytes:
    """Return a minimal valid 1x1 PNG."""
    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
    raw = b"\x00\xff\x00\x00"   # filter byte + 1 pixel RGB (red)
    idat = chunk(b"IDAT", zlib.compress(raw))
    iend = chunk(b"IEND", b"")
    return sig + ihdr + idat + iend


# ---------------------------------------------------------------------------
# 1) PRIVATE CONNECTION NOTES
# ---------------------------------------------------------------------------
class TestPrivateNotes:
    def test_save_note_persists_and_is_private(self):
        a, b, ha, hb, conn_id = _connect("NoteA", "NoteB")

        # A saves a private note about B
        r = requests.put(f"{API}/connections/{conn_id}/note", headers=ha,
                         json={"note": "Met at Bengaluru meetup 2026"})
        assert r.status_code == 200, r.text
        assert r.json()["note"] == "Met at Bengaluru meetup 2026"

        # A sees the note on the connection list
        la = requests.get(f"{API}/connections", headers=ha).json()
        row_a = next(c for c in la if c["id"] == conn_id)
        assert row_a.get("note") == "Met at Bengaluru meetup 2026"

        # A sees the note on the public profile view (nested at relationship.note)
        prof_a = requests.get(f"{API}/profile/{b['user']['identity_code']}", headers=ha).json()
        assert (prof_a.get("relationship") or {}).get("note") == "Met at Bengaluru meetup 2026"

        # B must NOT see A's note anywhere
        lb = requests.get(f"{API}/connections", headers=hb).json()
        row_b = next(c for c in lb if c["id"] == conn_id)
        assert (row_b.get("note") or "") == "", "Other user must not see the private note on connections list"

        prof_b = requests.get(f"{API}/profile/{a['user']['identity_code']}", headers=hb).json()
        b_sees = (prof_b.get("relationship") or {}).get("note")
        assert (b_sees or "") == "", "Other user must not see the private note on public profile"

    def test_update_and_clear_note(self):
        a, b, ha, hb, conn_id = _connect("NoteU", "NoteV")
        requests.put(f"{API}/connections/{conn_id}/note", headers=ha, json={"note": "v1"})
        r = requests.put(f"{API}/connections/{conn_id}/note", headers=ha, json={"note": "v2 updated"})
        assert r.status_code == 200 and r.json()["note"] == "v2 updated"

        # clear
        r2 = requests.put(f"{API}/connections/{conn_id}/note", headers=ha, json={"note": "   "})
        assert r2.status_code == 200 and r2.json()["note"] == ""
        la = requests.get(f"{API}/connections", headers=ha).json()
        row_a = next(c for c in la if c["id"] == conn_id)
        assert (row_a.get("note") or "") == ""

    def test_note_requires_membership(self):
        a, b, ha, hb, conn_id = _connect("NoteM1", "NoteM2")
        c = _register("Outsider"); hc = _auth(c["access_token"])
        r = requests.put(f"{API}/connections/{conn_id}/note", headers=hc, json={"note": "no"})
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# 2) CHAT CONTEXT SWITCH
# ---------------------------------------------------------------------------
class TestContextSwitch:
    def test_switch_to_both_creates_two_conversation_rows(self):
        a, b, ha, hb, conn_id = _connect("CtxA", "CtxB", context="personal")

        # baseline: personal only -> exactly 1 row in /api/conversations
        rows = requests.get(f"{API}/conversations", headers=ha).json()
        rows_conn = [r for r in rows if r["connection_id"] == conn_id]
        assert len(rows_conn) == 1
        assert rows_conn[0]["context"] == "personal"

        # switch to 'both'
        r = requests.put(f"{API}/connections/{conn_id}/context", headers=ha, json={"context": "both"})
        assert r.status_code == 200 and r.json()["context"] == "both"

        # now two rows (personal + professional)
        rows2 = requests.get(f"{API}/conversations", headers=ha).json()
        rows_conn2 = [r for r in rows2 if r["connection_id"] == conn_id]
        ctxs = sorted(r["context"] for r in rows_conn2)
        assert ctxs == ["personal", "professional"], f"expected both contexts, got {ctxs}"

        # GET messages returns connection_context='both' so client can show switcher
        r_msgs = requests.get(f"{API}/conversations/{conn_id}/personal/messages", headers=ha).json()
        assert r_msgs.get("connection_context") == "both"

        # switch back to professional -> single row
        r3 = requests.put(f"{API}/connections/{conn_id}/context", headers=ha,
                         json={"context": "professional"})
        assert r3.status_code == 200
        rows3 = requests.get(f"{API}/conversations", headers=ha).json()
        rows_conn3 = [r for r in rows3 if r["connection_id"] == conn_id]
        assert len(rows_conn3) == 1 and rows_conn3[0]["context"] == "professional"

    def test_invalid_context_rejected(self):
        a, b, ha, hb, conn_id = _connect("CtxX", "CtxY")
        r = requests.put(f"{API}/connections/{conn_id}/context", headers=ha,
                         json={"context": "bogus"})
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# 3) CONTRIBUTION DRAFTS
# ---------------------------------------------------------------------------
class TestDrafts:
    def test_tmp_blocked_from_creating_draft(self):
        u = _register("Draft TMP")
        h = _auth(u["access_token"])
        r = requests.post(f"{API}/drafts", headers=h, json={"title": "t", "body": "b"})
        assert r.status_code == 403

    def test_trk_full_draft_lifecycle(self):
        u = _register("Draft TRK")
        h = _auth(u["access_token"])
        assert requests.post(f"{API}/dev/simulate-transition", headers=h).status_code == 200

        # create
        r = requests.post(f"{API}/drafts", headers=h,
                          json={"title": "Draft Title", "body": "Body v1"})
        assert r.status_code == 200, r.text
        did = r.json()["id"]
        assert r.json()["status"] == "draft"

        # appears in list
        lst = requests.get(f"{API}/drafts", headers=h).json()
        assert any(d["id"] == did for d in lst)

        # reopen (get by id)
        got = requests.get(f"{API}/drafts/{did}", headers=h).json()
        assert got["title"] == "Draft Title"

        # edit
        upd = requests.put(f"{API}/drafts/{did}", headers=h,
                           json={"title": "Draft Title 2", "body": "Body v2"}).json()
        assert upd["title"] == "Draft Title 2" and upd["body"] == "Body v2"

        # not in public /contributions while status=draft
        pub = requests.get(f"{API}/contributions", headers=h).json()
        assert all(c["id"] != did for c in pub)

        # publish
        pubr = requests.post(f"{API}/drafts/{did}/publish", headers=h)
        assert pubr.status_code == 200, pubr.text
        # now visible in /contributions
        pub2 = requests.get(f"{API}/contributions", headers=h).json()
        assert any(c["id"] == did for c in pub2)
        # and disappears from /drafts
        lst2 = requests.get(f"{API}/drafts", headers=h).json()
        assert all(d["id"] != did for d in lst2)

        # publish again -> now no longer a draft, should 404
        pubr2 = requests.post(f"{API}/drafts/{did}/publish", headers=h)
        assert pubr2.status_code == 404

    def test_publish_requires_title_and_body(self):
        u = _register("Draft Empty")
        h = _auth(u["access_token"])
        requests.post(f"{API}/dev/simulate-transition", headers=h)
        r = requests.post(f"{API}/drafts", headers=h, json={"title": "", "body": ""})
        assert r.status_code == 200
        did = r.json()["id"]
        p = requests.post(f"{API}/drafts/{did}/publish", headers=h)
        assert p.status_code == 400

    def test_delete_draft(self):
        u = _register("Draft Del")
        h = _auth(u["access_token"])
        requests.post(f"{API}/dev/simulate-transition", headers=h)
        did = requests.post(f"{API}/drafts", headers=h,
                            json={"title": "x", "body": "y"}).json()["id"]
        d = requests.delete(f"{API}/drafts/{did}", headers=h)
        assert d.status_code == 200
        # gone from list
        lst = requests.get(f"{API}/drafts", headers=h).json()
        assert all(x["id"] != did for x in lst)
        # get returns 404
        assert requests.get(f"{API}/drafts/{did}", headers=h).status_code == 404

    def test_tmp_blocked_from_publish(self):
        u_tmp = _register("Pub TMP")
        h_tmp = _auth(u_tmp["access_token"])
        # A TRK user creates a draft (we need an existing draft id owned by the TMP user).
        # Simplest way: convert to TRK, create draft, then try publish as different user.
        # Instead, verify the endpoint refuses TMP outright by attempting on any id.
        r = requests.post(f"{API}/drafts/nonexistent/publish", headers=h_tmp)
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# 4) PROFILE PHOTO
# ---------------------------------------------------------------------------
class TestProfilePhoto:
    def test_upload_photo_and_surfaces(self):
        a, b, ha, hb, conn_id = _connect("PhoA", "PhoB")
        png = _tiny_png()
        files = {"file": ("me.png", io.BytesIO(png), "image/png")}
        r = requests.post(f"{API}/profile/photo", headers=ha, files=files)
        assert r.status_code == 200, r.text
        me = r.json()
        photo_url = me.get("photo_url")
        assert photo_url and photo_url.startswith("/api/files/")

        # /auth/me returns it
        me2 = requests.get(f"{API}/auth/me", headers=ha).json()
        assert me2.get("photo_url") == photo_url

        # public profile (from B looking at A) exposes photo_url
        prof = requests.get(f"{API}/profile/{a['user']['identity_code']}", headers=hb).json()
        assert prof.get("photo_url") == photo_url

        # connections list from B shows A's photo_url on the 'other' block
        lb = requests.get(f"{API}/connections", headers=hb).json()
        row = next(c for c in lb if c["id"] == conn_id)
        other = row.get("other") or {}
        assert other.get("photo_url") == photo_url, f"connection row.other should include photo_url, got {other}"

        # conversations list also carries photo_url on 'other'
        convs = requests.get(f"{API}/conversations", headers=hb).json()
        conv_row = next((c for c in convs if c["connection_id"] == conn_id), None)
        assert conv_row is not None
        assert (conv_row.get("other") or {}).get("photo_url") == photo_url

        # actual file bytes served
        img = requests.get(f"{BASE_URL}{photo_url}")
        assert img.status_code == 200
        assert img.headers.get("Content-Type", "").startswith("image/")
        assert len(img.content) > 0

    def test_reject_bad_content_type(self):
        u = _register("Pho Bad")
        h = _auth(u["access_token"])
        files = {"file": ("f.txt", io.BytesIO(b"not an image"), "text/plain")}
        r = requests.post(f"{API}/profile/photo", headers=h, files=files)
        assert r.status_code == 400

    def test_seeded_pair_note_privacy(self):
        """Sanity: seeded Aria/Ben pair — Aria's note on Ben must be private to Aria."""
        la = requests.post(f"{API}/auth/login",
                           json={"email": "aria@traksha.app", "password": "Password123"})
        lb = requests.post(f"{API}/auth/login",
                           json={"email": "ben@traksha.app", "password": "Password123"})
        if la.status_code != 200 or lb.status_code != 200:
            pytest.skip("seeded aria/ben accounts not present in this environment")
        ha = _auth(la.json()["access_token"])
        hb = _auth(lb.json()["access_token"])
        me_a = requests.get(f"{API}/auth/me", headers=ha).json()
        me_b = requests.get(f"{API}/auth/me", headers=hb).json()

        # Aria's view of Ben's profile: note should be set from seed
        prof_from_aria = requests.get(f"{API}/profile/{me_b['identity_code']}", headers=ha).json()
        aria_note = (prof_from_aria.get("relationship") or {}).get("note")
        assert aria_note, "Seed expected: Aria has a private note on Ben"

        # Ben's view of Aria's profile: must NOT see Aria's note
        prof_from_ben = requests.get(f"{API}/profile/{me_a['identity_code']}", headers=hb).json()
        ben_sees = (prof_from_ben.get("relationship") or {}).get("note")
        assert not ben_sees or ben_sees != aria_note, \
            "Ben must not see Aria's private note on Aria's profile"

        # Also check Ben's connections list does not leak Aria's note
        conns_b = requests.get(f"{API}/connections", headers=hb).json()
        for row in conns_b:
            if (row.get("other") or {}).get("identity_code") == me_a["identity_code"]:
                assert (row.get("note") or "") != aria_note, \
                    "Aria's private note leaked into Ben's /connections list"
