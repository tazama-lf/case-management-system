#!/bin/sh
set -e

# CMS_FRONTEND_ORIGIN: space-separated list of allowed origins for frame-ancestors CSP
# e.g. "http://localhost:5175" or "https://app.example.com https://other.example.com"
if [ -z "$CMS_FRONTEND_ORIGIN" ]; then
  echo "ERROR: CMS_FRONTEND_ORIGIN must be set and non-empty" >&2
  exit 1
fi

# Build valid JSON for Voila.tornado_settings using Python's json module
TORNADO_SETTINGS=$(python -c "
import json, os
origin = os.environ['CMS_FRONTEND_ORIGIN']
csp = \"frame-ancestors 'self' \" + origin
settings = {'headers': {'Content-Security-Policy': csp}}
print(json.dumps(settings))
")

exec voila /app/notebooks \
  --config=/app/notebooks/voila.json \
  --Voila.ip=0.0.0.0 \
  --Voila.port=8866 \
  --Voila.tornado_settings="$TORNADO_SETTINGS" \
  --no-browser
