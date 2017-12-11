# This file is part of RegCFP
# License: MIT
def test_main(app):
    resp = app.get('/')
    assert resp.status_code == 404
