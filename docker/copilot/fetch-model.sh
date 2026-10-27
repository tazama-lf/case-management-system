#!/usr/bin/env sh
# Download the copilot's bundled model into docker/copilot/models (once).
#
#   ./fetch-model.sh            Qwen3-4B-Instruct-2507, GGUF Q4_K_M, about 2.5 GB (default; Apache-2.0)
#   ./fetch-model.sh small      Qwen2.5-1.5B-Instruct,  GGUF Q4_K_M, about 1.1 GB (Apache-2.0; weaker writing)
#
# Licences: https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507 and https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct
# (both apache-2.0). Do not swap in Qwen2.5-3B or -72B: those sizes use non-Apache Qwen licences.
set -eu
DIR="$(cd "$(dirname "$0")" && pwd)/models"
mkdir -p "$DIR"
if [ "${1:-}" = small ]; then
  FILE=qwen2.5-1.5b-instruct-q4_k_m.gguf
  URL="https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/$FILE"
  SHA256=6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e
else
  FILE=Qwen3-4B-Instruct-2507-Q4_K_M.gguf
  URL="https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/main/$FILE"
  SHA256=3605803b982cb64aead44f6c1b2ae36e3acdb41d8e46c8a94c6533bc4c67e597
fi
curl -fL -C - -o "$DIR/$FILE" "$URL"
echo "$SHA256  $DIR/$FILE" | sha256sum -c -
