# Persist verified resolutions for later retrieval

Status: open

Blocked by: 07, 08

## Objective

Create the safe data boundary for future intelligence without implementing automatic rule changes or model training.

## Work

- Define a versioned verified-resolution contract.
- Require a confirmed cause, corrective action, and linked before-and-after run evidence.
- Store normalized environment attributes without personal information.
- Expose read and write operations suitable for later similarity retrieval.

## Done when

- An incomplete or unconfirmed diagnosis cannot become a verified resolution.
- A resolution links failing and passing evidence artifacts.
- No production verdict rule changes automatically.
- Persistence and privacy tests pass under `npm run verify`.

## Comments
