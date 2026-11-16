FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt requirements.lock ./
RUN pip install --no-cache-dir -r requirements.lock && python -c "import openpyxl, et_xmlfile" && addgroup --system app && adduser --system --ingroup app app
COPY app ./app
COPY migrations ./migrations
USER app
CMD ["sh", "-c", "python -m app.migrate && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
