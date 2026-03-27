---
title: "shell_command with python3 -c and Jinja2: nested quoting breaks silently"
category: automation-issues
date: 2026-03-26
tags: [shell_command, python, jinja2, quoting, silent-failure]
---

# shell_command with python3 -c and Jinja2: nested quoting breaks silently

## Problem

A `shell_command` entry using `python3 -c "..."` with Jinja2-templated values
silently fails. No error in logs, no output, exit code 0 or 1 with no
explanation.

## Root Cause

Three layers of quoting collide:

1. **Jinja2 rendering** — HA renders the template first, injecting raw values
   into the shell string.
2. **Shell interpretation** — Bash interprets the rendered string, expanding
   `$` signs and splitting on unescaped quotes.
3. **Python string parsing** — `python3 -c` parses what remains.

Single quotes from Jinja output (e.g. entity names containing apostrophes)
clash with Python string delimiters. Dollar signs in OAuth tokens or URLs are
expanded by the shell as variable references, silently truncating values.

Additionally, `shell_command` caches Jinja templates at HA startup. Changes
require a full HA restart, not just a reload.

## Solution

Use standalone Python script files instead of inline `python3 -c`:

```yaml
# Bad: inline python with Jinja
shell_command:
  do_thing: >
    python3 -c "import requests; requests.post('{{ states('input_text.url') }}')"

# Good: standalone script with env vars or helper-based input
shell_command:
  do_thing: "python3 /config/custom_scripts/do_thing.py"
```

Pass parameters via:
- `input_text` helpers read inside the Python script using the HA REST API
- Environment variables set in the shell_command line
- Command-line arguments (`sys.argv`)

## Prevention

- Never embed Jinja2 templates inside `python3 -c` strings.
- If a shell_command needs dynamic values, write a standalone `.py` file.
- Remember that `shell_command` templates are cached at startup — a full
  HA restart is needed after any change.
