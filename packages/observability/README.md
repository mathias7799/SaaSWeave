# @saasweave/observability

Prometheus metrics and Hono request instrumentation shared by the API server and worker.

Metrics are exposed only when `METRICS_ENABLED=true`.

| Runtime    | Endpoint                     | Access policy                                                 |
| ---------- | ---------------------------- | ------------------------------------------------------------- |
| API server | `{VITE_SERVER_URL}/metrics`  | Requires `Authorization: Bearer $METRICS_BEARER_TOKEN`        |
| Worker     | `http://worker:9100/metrics` | No application auth; bind to the private service network only |

The worker records queue depth, oldest-job age, job duration, retries, retention rows, process
metrics, and event-loop lag. Distributed tracing is not configured; correlate structured logs with
request IDs until an OpenTelemetry SDK and exporter are deployed.

```bash
vp test
vp check
```
