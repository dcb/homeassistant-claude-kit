---
title: "Tesla Fleet OAuth token missing scopes after portal updates"
category: integration-issues
date: 2026-03-26
tags:
  - tesla
  - oauth
  - fleet-api
  - scopes
  - authentication
---

## Problem

`number.set_value` calls to the Tesla integration return HTTP 500 with "Missing vehicle charging commands scope", while `start_charge` / `stop_charge` work fine. The OAuth token appears valid (not expired, not revoked), and the Tesla Developer Portal shows the required scope checked.

## Root Cause

Tesla Fleet API OAuth tokens have three independent scope layers, all of which must agree:

1. **Developer Portal** -- the scopes checked in your app registration at developer.tesla.com
2. **Partner Registration** -- the scopes included in the `POST /api/1/partner_accounts` curl during initial partner setup
3. **Consent Screen** -- the scopes the user actually granted during the OAuth consent flow in the browser

A token minted **before** a scope was added to the Developer Portal will lack that scope permanently, even if:
- The Developer Portal now shows it checked
- The integration was "reconfigured" in HA (reconfigure reuses the existing token -- it does not trigger a new consent flow)

The specific failure mode: `vehicle_charging_cmds` scope was added to the portal after initial setup, but the existing token predates that addition. Start/stop charging uses the `vehicle_cmds` scope (granted at original setup), but `set_charging_amps` requires `vehicle_charging_cmds` (missing from the token).

## Solution

A full re-authentication from scratch is required. "Reconfigure" in HA is not sufficient because it reuses the existing token/refresh token pair.

1. **Decode the existing JWT** to confirm which scopes it actually has:
   ```
   # Paste your access token at jwt.io or use:
   echo "$TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq .scp
   ```

2. **Remove from HA**: Settings -> Devices & Services -> Tesla Fleet -> Delete

3. **Remove Application Credentials**: Settings -> Devices & Services -> Application Credentials -> delete the Tesla entry

4. **Revoke at Tesla**: Visit https://auth.tesla.com, sign in, find the app under Third-Party Apps, and revoke access

5. **Verify Developer Portal scopes**: Ensure all needed scopes are checked (especially `vehicle_charging_cmds` and `energy_cmds`)

6. **Re-add integration**: Settings -> Devices & Services -> Add Integration -> Tesla Fleet. This triggers a fresh consent flow with the current portal scopes.

7. **Verify the new token**: Decode the new JWT and confirm the `scp` array includes all required scopes.

## Prevention

- **Always decode JWTs after setup** to verify granted scopes match expectations. Do not trust the Developer Portal UI as a proxy for what the token actually contains.
- **When adding new scopes to the portal**, plan for a full re-authentication cycle. Document this in your change notes.
- **Keep a scope checklist** mapping each HA service call to its required Tesla scope:
  - `start_charge` / `stop_charge` -> `vehicle_cmds`
  - `set_charging_amps` / `set_charge_limit` -> `vehicle_charging_cmds`
  - `climate_on` / `climate_off` -> `vehicle_cmds`
  - `energy_site_info` -> `energy_cmds`
- **After any Tesla integration re-setup**, test one service call from each scope group before considering the setup complete.
