from workers import asgi

from app.breach_service import xposedornot_workers_provider
from app.main import create_app


app = create_app(
    breach_provider=xposedornot_workers_provider,
    serve_local_assets=False,
)
Default = asgi.entrypoint(app)
