FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY db-service/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY shared/utilities /shared/utilities
RUN pip install /shared/utilities

COPY db-service/app ./app

EXPOSE 8010

CMD ["uvicorn", "app.main:DbLayer", "--host", "0.0.0.0", "--port", "8010","--reload"]