---
title: "Jinja2 dict(**x, **y) not supported in HA -- use | combine()"
category: template-issues
date: 2026-03-26
tags: [jinja2, templates, dict, combine]
---

# Jinja2 dict(**x, **y) not supported in HA -- use | combine()

## Problem

A template sensor using Python-style dict unpacking passes YAML validation but
fails Home Assistant's official configuration check:

```yaml
value_template: >
  {{ dict(**base_config, **overrides) }}
```

Error: `TemplateSyntaxError: expected token 'end of print statement', got '**'`

## Root Cause

Home Assistant's Jinja2 environment does not support Python's `**kwargs` dict
unpacking syntax. While `dict()` itself works, the double-star unpacking
operator is a CPython feature that Jinja2's template language does not
implement. Standard YAML linting won't catch this since it is valid YAML -- the
error only surfaces during Jinja2 template compilation.

## Solution

Use the `combine()` Jinja2 filter to merge dictionaries:

```yaml
value_template: >
  {% set ns = namespace(result={}) %}
  {% set ns.result = ns.result | combine(base_config) %}
  {% set ns.result = ns.result | combine(overrides) %}
  {{ ns.result }}
```

Or more concisely for two dicts:

```yaml
value_template: >
  {{ base_config | combine(overrides) }}
```

Add `| default({})` when a variable might be undefined on first boot:

```yaml
value_template: >
  {{ (base_config | default({})) | combine(overrides | default({})) }}
```

## Prevention

Never use Python-specific syntax (`**`, list comprehensions with `:=`, etc.)
in HA Jinja2 templates. Stick to Jinja2-native filters: `combine()` for dict
merging, `selectattr()`/`map()` for list operations. Test templates in
Developer Tools > Template before committing.
