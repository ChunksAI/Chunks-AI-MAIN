\# Chemistry App - Backend



Python Flask server for the chemistry learning app.



\## Setup

```bash

pip install -r requirements.lock

python server.py

```



\## Updating dependencies

`requirements.txt` is the human-edited file listing direct dependencies with
minimum version constraints.  `requirements.lock` is the fully-pinned lock
file generated from it and must be committed alongside it.

To regenerate the lock file after editing `requirements.txt`:

```bash
# Install pip-tools once (developer machine only)
pip install pip-tools

# Regenerate the lock file (run from the backend/ directory)
pip-compile requirements.txt --output-file requirements.lock --generate-hashes --strip-extras --no-upgrade
```

Commit both `requirements.txt` and `requirements.lock` together.



\## Environment Variables



\- `OPENROUTER\_API\_KEY` - Your OpenRouter API key

\- `R2\_BUCKET\_URL` - Cloudflare R2 bucket URL

\- `PORT` - Server port (default: 5000)
