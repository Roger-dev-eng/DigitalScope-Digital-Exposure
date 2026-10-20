FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

RUN addgroup --system app && adduser --system --ingroup app app

COPY requirements-docker.txt ./
RUN pip install --no-cache-dir -r requirements-docker.txt

COPY src/app ./src/app
COPY public ./public

USER app

EXPOSE 8000

CMD ["sh", "-c", "uvicorn --app-dir src app.main:app --host 0.0.0.0 --port ${PORT}"]
