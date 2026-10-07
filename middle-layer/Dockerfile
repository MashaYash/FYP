FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

COPY middle-layer/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY shared/utilities /shared/utilities
RUN pip install /shared/utilities

COPY middle-layer/. .

ENV TESSERACT_CMD=/usr/bin/tesseract

EXPOSE 8000


CMD ["uvicorn", "app.server:app", "--host", "0.0.0.0", "--port", "8000","--reload"]