FROM python:3.12-alpine
WORKDIR /app
COPY server.py .
RUN adduser -D -u 1000 hub && mkdir -p /data/proposals /data/db && chown -R hub:hub /data
USER hub
ENV DATA_DIR=/data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
CMD ["python3", "-u", "server.py", "8080"]
