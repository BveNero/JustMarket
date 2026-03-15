FROM python:3.11-slim

WORKDIR /app

COPY . /app

ENV PORT=8000
ENV JM_DB_PATH=/data/justmarket.db

RUN mkdir -p /data \
    && PYTHONPYCACHEPREFIX=/tmp python3 -m py_compile server.py

EXPOSE 8000

CMD ["python3", "server.py"]
