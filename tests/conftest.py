# This file is part of RegCFP
# License: MIT
import os
import tempfile
import pytest

from regcfp.app import app as application
from regcfp.app import db


@pytest.fixture
def app(tmpdir):
    dbfile = os.path.join(tmpdir, 'database.sqlite')
    application.testing = True
    application.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///%s' % dbfile
    with application.app_context():
        db.create_all()
    yield application.test_client()
