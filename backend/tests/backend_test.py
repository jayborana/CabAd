"""Sawari backend API tests."""
import os
import io
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://cab-ads-platform.preview.emergentagent.com"
API = f"{BASE}/api"


def _login(identifier, password, portal):
    r = requests.post(f"{API}/auth/login", json={"identifier": identifier, "password": password, "portal": portal})
    return r


# -------- Auth --------
class TestAuth:
    def test_ops_login_success(self):
        r = _login("jayborana3@gmail.com", "demo1234", "ops")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and data["token"]
        assert data["user"]["portal"] == "ops"

    def test_business_login_success(self):
        r = _login("owner@pizzapalace.com", "demo1234", "business")
        assert r.status_code == 200, r.text
        assert r.json()["user"]["portal"] == "business"

    def test_partner_login_success(self):
        r = _login("9812340001", "1234", "partner")
        assert r.status_code == 200, r.text
        assert r.json()["user"]["portal"] == "partner"

    def test_portal_mismatch_business_on_ops(self):
        r = _login("owner@pizzapalace.com", "demo1234", "ops")
        assert r.status_code == 403, r.text

    def test_portal_mismatch_ops_on_business(self):
        r = _login("jayborana3@gmail.com", "demo1234", "business")
        assert r.status_code == 403, r.text

    def test_bad_password(self):
        r = _login("jayborana3@gmail.com", "wrongwrong", "ops")
        assert r.status_code in (400, 401), r.text

    def test_me_with_token(self):
        r = _login("jayborana3@gmail.com", "demo1234", "ops")
        tok = r.json()["token"]
        m = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {tok}"})
        assert m.status_code == 200
        assert m.json()["portal"] == "ops"


@pytest.fixture(scope="module")
def ops_token():
    r = _login("jayborana3@gmail.com", "demo1234", "ops")
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def biz_token():
    r = _login("owner@pizzapalace.com", "demo1234", "business")
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def partner_token():
    r = _login("9812340001", "1234", "partner")
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# -------- OPS endpoints --------
class TestOps:
    def test_dashboard(self, ops_token):
        r = requests.get(f"{API}/ops/dashboard", headers=_h(ops_token))
        assert r.status_code == 200, r.text
        d = r.json()
        # sanity: expect some KPI-ish keys
        assert isinstance(d, dict)

    def test_cabs(self, ops_token):
        r = requests.get(f"{API}/cabs", headers=_h(ops_token))
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_slot_availability(self, ops_token):
        r = requests.get(f"{API}/slots/availability", headers=_h(ops_token))
        assert r.status_code == 200, r.text

    def test_creatives(self, ops_token):
        r = requests.get(f"{API}/creatives", headers=_h(ops_token))
        assert r.status_code == 200, r.text

    def test_drivers(self, ops_token):
        r = requests.get(f"{API}/drivers", headers=_h(ops_token))
        assert r.status_code == 200, r.text

    def test_payouts(self, ops_token):
        r = requests.get(f"{API}/payouts", headers=_h(ops_token))
        assert r.status_code == 200, r.text

    def test_compliance_photos(self, ops_token):
        r = requests.get(f"{API}/compliance-photos", headers=_h(ops_token))
        assert r.status_code == 200, r.text

    def test_config(self):
        r = requests.get(f"{API}/config")
        assert r.status_code == 200


# -------- Business endpoints --------
class TestBusiness:
    def test_bookings_list(self, biz_token):
        r = requests.get(f"{API}/bookings", headers=_h(biz_token))
        assert r.status_code == 200, r.text

    def test_availability(self, biz_token):
        r = requests.get(f"{API}/slots/availability", headers=_h(biz_token))
        assert r.status_code == 200


# -------- Partner endpoints --------
class TestPartner:
    def test_me(self, partner_token):
        r = requests.get(f"{API}/auth/me", headers=_h(partner_token))
        assert r.status_code == 200
        assert r.json()["portal"] == "partner"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
