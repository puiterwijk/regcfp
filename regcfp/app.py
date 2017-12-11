# This file is part of RegCFP
# License: MIT
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

from .models import db


app = Flask(__name__)
db.init_app(app)
migrate = Migrate(app, db)
