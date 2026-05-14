# Chemistry App - Backend

Python Flask server for the chemistry learning app.

## Setup

```bash
pip install -r requirements.lock
python server.py
```

## Updating dependencies

`requirements.txt` is the human-edited file listing direct dependencies with
minimum version constraints. `requirements.lock` is the fully-pinned lock file
generated from it and must be committed alongside it.

To regenerate the lock file after editing `requirements.txt`:

```bash
# Install pip-tools once (developer machine only)
pip install pip-tools

# Regenerate the lock file (run from the backend/ directory).
# Use --no-upgrade to keep existing pins stable (recommended for routine changes).
pip-compile requirements.txt --output-file requirements.lock --generate-hashes --strip-extras --no-upgrade

# Omit --no-upgrade to allow upgrading all transitive deps to their latest
# compatible versions (use when doing a planned dependency refresh).
pip-compile requirements.txt --output-file requirements.lock --generate-hashes --strip-extras
```

Commit both `requirements.txt` and `requirements.lock` together.

## Environment Variables

- `OPENROUTER_API_KEY` - Your OpenRouter API key
- `R2_BUCKET_URL` - Cloudflare R2 bucket URL
- `PORT` - Server port (default: 5000)

