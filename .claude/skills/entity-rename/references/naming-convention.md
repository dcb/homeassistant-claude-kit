# Entity Naming Convention

Standardize all entity IDs to English, descriptive, location-based naming.

## Format: `domain.{room}_{descriptor}`

| Entity Type | Pattern | Examples |
|---|---|---|
| Individual light (bulb) | `light.{room}_{descriptor}` | `light.bedroom_main_1`, `light.toilet_sink` |
| Hue Room group | `light.{room}` | `light.bedroom`, `light.toilet` |
| Hue Zone group | `light.{room}_{zone}` | `light.bedroom_lamps`, `light.bedroom_main` |
| Motion sensor | `binary_sensor.{room}_motion` | `binary_sensor.stairs_motion` |
| Other sensors | `sensor.{room}_{measurement}` | `sensor.stairs_illuminance` |
| Switch/dial event | `event.{room}_{type}_button_{n}` | `event.bedroom_switch_button_1` |
| Climate device | `climate.{room}_{type}` | `climate.living_room_ac` |
| Camera | `camera.{location}` | `camera.back_yard`, `camera.pavilion` |
| Media player | `media_player.{descriptor}` | `media_player.soundbar` |

## Rules

1. **Bulbs ALWAYS have a descriptor** -- never just the room name. Room-only names are reserved for Hue Room groups.
2. **snake_case, English only, lowercase.**
3. **No product names, serial numbers, or generic defaults** (no `jch_8862dcd1`, no `hue_ambiance_spot_1`).
4. **Don't repeat the domain word as suffix** -- `binary_sensor.stairs_motion`, NOT `stairs_motion_sensor`. Compound device names like `kitchen_motion_sensor_battery` are fine (identifies the device).
5. **Friendly names**: Title Case for room, lowercase for descriptor (e.g., "Bedroom main 1").
6. **Descriptors are functional/role-based** -- `_main`, `_sink`, `_spot`, NOT `_ceiling`. `_lamp` is ONLY for actual floor lamps.

## Room Name Standardization

Use consistent room names across all entities. Common mappings:

| Standard Name | Common Legacy Names |
|---|---|
| `living_room` | livingroom, living_room_1 |
| `bedroom` | master_bedroom, parents_bedroom |
| `bathroom` | upstairs_bathroom, main_bath |
| `toilet` | my_bathroom, wc, powder_room |
| `lobby` | hallway, entrance, foyer |
| `kitchen` | kitchen_1 |
| `storage` | my_storage, closet, under_stairs |
| `stairs` | stairway, staircase |

## Exceptions (Keep As-Is)

These entity IDs should NOT be renamed:

- **ESPHome device names** -- changing requires reflashing the device firmware (e.g., `sensor.livingroom_sensor_*`)
- **Integration-managed unique_ids** -- some integrations regenerate entity IDs from device serial numbers on reload
- **Already descriptive names** -- if an entity already follows the convention, skip it
- **Camera entities** that already use English location names

## Two-Step Rename Pattern

When entity A holds a name that entity B should have:

```
Step 1: Rename A to a temporary/final name  (frees the desired name)
Step 2: Rename B to the freed name          (takes the desired name)
```

Example: `light.kitchen` is a bulb, but `light.kitchen` should be the room group.

1. `light.kitchen` -> `light.kitchen_main` (bulb gets descriptor)
2. `light.kitchen_2` -> `light.kitchen` (group gets the clean name)

**Order is critical.** Always rename the blocker first.
