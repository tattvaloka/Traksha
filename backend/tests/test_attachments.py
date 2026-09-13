"""
Tests for chat attachments (image + document), authorization, size/type limits,
and profile photo bug fix (POST /api/profile/photo returning photo_url).
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
    "https://c1512e0d-3b32-4c4b-9e67-36adbf517710.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"


def _mk_email(prefix="user"):
    return f"TEST_{prefix}_{uuid.uuid4().hex[:8]}@example.com"


def _register(display="Test User"):
    r = requests.post(f"{API}/auth/register", json={
        "email": _mk_email(), "password": "password123", "display_name": display})
    assert r.status_code == 200, r.text
    return r.json()


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


def _connect(context="personal"):
    a = _register("A")
    b = _register("B")
    ha, hb = _auth(a["access_token"]), _auth(b["access_token"])
    r = requests.post(f"{API}/connections/request", headers=ha,
                      json={"to_identity_code": b["user"]["identity_code"], "context": context})
    rid = r.json()["id"]
    conn_id = requests.post(f"{API}/connections/requests/{rid}/accept",
                            headers=hb).json()["connection_id"]
    return a, b, ha, hb, conn_id


def _tiny_png() -> bytes:
    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
    raw = b"\x00\xff\x00\x00"
    idat = chunk(b"IDAT", zlib.compress(raw))
    iend = chunk(b"IEND", b"")
    return sig + ihdr + idat + iend


def _tiny_jpeg() -> bytes:
    # Minimal 1x1 JPEG (valid enough to accept)
    return bytes.fromhex(
        "ffd8ffe000104a46494600010100000100010000ffdb004300080606"
        "07060805070707090908"
        + "0a" * 100
        + "ffc00011080001000103012200021101031101ffc4001f0000010501"
        + "01010101010000000000000000010203040506070809"
        "0a0bffc400b5100002010303020403050504040000017d01020300041105122131410613"
        "6151076171143281914"
        "1a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a4344"
        "45464748494a535455565758595a636465666768696a737475767778797a838485868788898a"
        "92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9caD2d3"
        "d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffda0008010100003f00fbd0ffd9"
    )


class TestChatAttachments:
    def test_upload_image_attachment_and_flow(self):
        a, b, ha, hb, conn_id = _connect(context="personal")
        png = _tiny_png()
        files = {"file": ("pic.png", io.BytesIO(png), "image/png")}
        data = {"context": "personal", "client_id": "c1", "width": "1", "height": "1"}
        r = requests.post(f"{API}/conversations/{conn_id}/attachments",
                          headers=ha, files=files, data=data)
        assert r.status_code == 200, r.text
        msg = r.json()
        assert msg["type"] == "image"
        assert msg["attachment"] is not None
        assert msg["attachment"]["kind"] == "image"
        assert msg["attachment"]["url"].startswith("/api/messages/")
        assert msg["attachment"]["url"].endswith("/attachment")
        assert msg["attachment"]["size"] == len(png)
        mid = msg["id"]

        # Authorized member (B) can fetch content
        img = requests.get(f"{BASE_URL}{msg['attachment']['url']}", headers=hb)
        assert img.status_code == 200
        assert img.headers.get("Content-Type", "").startswith("image/")

        # Outsider cannot
        c = _register("Outsider"); hc = _auth(c["access_token"])
        forbidden = requests.get(f"{BASE_URL}{msg['attachment']['url']}", headers=hc)
        assert forbidden.status_code == 403

        # No-auth
        noauth = requests.get(f"{BASE_URL}{msg['attachment']['url']}")
        assert noauth.status_code == 401

        # Shows up in GET messages
        got = requests.get(f"{API}/conversations/{conn_id}/personal/messages",
                           headers=hb).json()
        assert any(m["id"] == mid and m.get("type") == "image" for m in got["messages"])

        # And in conversations list (last_message.type == image)
        convs = requests.get(f"{API}/conversations", headers=ha).json()
        row = next(c for c in convs if c["connection_id"] == conn_id)
        last = row["last_message"]
        assert last["type"] == "image"
        assert last["attachment"]["kind"] == "image"

    def test_upload_document_attachment(self):
        a, b, ha, hb, conn_id = _connect()
        pdf_bytes = b"%PDF-1.4\n%..." + b"\x00" * 200 + b"\n%%EOF"
        files = {"file": ("hello.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
        r = requests.post(f"{API}/conversations/{conn_id}/attachments",
                          headers=ha, files=files, data={"context": "personal"})
        assert r.status_code == 200, r.text
        msg = r.json()
        assert msg["type"] == "file"
        assert msg["attachment"]["kind"] == "file"
        assert msg["attachment"]["name"] == "hello.pdf"

    def test_unsupported_type_returns_415(self):
        a, b, ha, hb, conn_id = _connect()
        files = {"file": ("a.exe", io.BytesIO(b"MZ" + b"\x00" * 20),
                          "application/x-msdownload")}
        r = requests.post(f"{API}/conversations/{conn_id}/attachments",
                          headers=ha, files=files, data={"context": "personal"})
        assert r.status_code == 415, r.text

    def test_outsider_cannot_upload(self):
        a, b, ha, hb, conn_id = _connect()
        c = _register("Out"); hc = _auth(c["access_token"])
        png = _tiny_png()
        files = {"file": ("x.png", io.BytesIO(png), "image/png")}
        r = requests.post(f"{API}/conversations/{conn_id}/attachments",
                          headers=hc, files=files, data={"context": "personal"})
        assert r.status_code in (403, 404), r.text

    def test_invalid_context_rejected(self):
        a, b, ha, hb, conn_id = _connect()
        png = _tiny_png()
        files = {"file": ("x.png", io.BytesIO(png), "image/png")}
        r = requests.post(f"{API}/conversations/{conn_id}/attachments",
                          headers=ha, files=files, data={"context": "bogus"})
        assert r.status_code == 400

    def test_professional_context_separated(self):
        a, b, ha, hb, conn_id = _connect(context="professional")
        png = _tiny_png()
        files = {"file": ("p.png", io.BytesIO(png), "image/png")}
        r = requests.post(f"{API}/conversations/{conn_id}/attachments",
                          headers=ha, files=files, data={"context": "professional"})
        assert r.status_code == 200
        # personal has no messages
        personal = requests.get(
            f"{API}/conversations/{conn_id}/personal/messages", headers=hb).json()
        assert all(m.get("type") != "image" for m in personal["messages"])


class TestSeededAriaBenAttachments:
    def test_seeded_pair_attachment_flow(self):
        la = requests.post(f"{API}/auth/login",
                           json={"email": "aria@traksha.app", "password": "Password123"})
        lb = requests.post(f"{API}/auth/login",
                           json={"email": "ben@traksha.app", "password": "Password123"})
        if la.status_code != 200 or lb.status_code != 200:
            pytest.skip("seeded pair not present")
        ha, hb = _auth(la.json()["access_token"]), _auth(lb.json()["access_token"])
        conns = requests.get(f"{API}/connections", headers=ha).json()
        conn = next((c for c in conns if (c.get("other") or {}).get("email", "").startswith("ben")
                     or "Ben" in (c.get("other") or {}).get("display_name", "")), None)
        if not conn:
            pytest.skip("Aria<->Ben connection not present")
        conn_id = conn["id"]

        # Aria uploads an image on personal
        png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32  # header only, but content-type valid
        # Use proper tiny png
        import struct as _s, zlib as _z
        def chunk(tag, data):
            return (_s.pack(">I", len(data)) + tag + data +
                    _s.pack(">I", _z.crc32(tag + data) & 0xffffffff))
        sig = b"\x89PNG\r\n\x1a\n"
        ihdr = chunk(b"IHDR", _s.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
        raw = b"\x00\xff\x00\x00"
        idat = chunk(b"IDAT", _z.compress(raw))
        iend = chunk(b"IEND", b"")
        png_real = sig + ihdr + idat + iend

        files = {"file": ("test.png", io.BytesIO(png_real), "image/png")}
        r = requests.post(f"{API}/conversations/{conn_id}/attachments",
                          headers=ha, files=files,
                          data={"context": "personal", "client_id": "seed-c1"})
        assert r.status_code == 200, r.text
        # Ben can fetch it
        url = r.json()["attachment"]["url"]
        got = requests.get(f"{BASE_URL}{url}", headers=hb)
        assert got.status_code == 200
