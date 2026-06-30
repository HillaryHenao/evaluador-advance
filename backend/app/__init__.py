import os
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()


def create_app(testing: bool = False) -> Flask:
    app = Flask(__name__)
    app.config['TESTING'] = testing

    CORS(app, resources={r'/api/*': {'origins': '*'}})

    from app.routes.terrain import bp
    app.register_blueprint(bp)

    return app
