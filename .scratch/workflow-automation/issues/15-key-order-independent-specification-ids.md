# Make normalizeNavigation key-order independent without changing existing specification IDs

Status: open

GitHub: #79

## Objective

Move the canonical navigation key order (`id, text, href, area, selector`, then any other
keys) into core's `normalizeNavigation`, so a request maps to the same specification
however it was serialized. Then remove the extension workaround in `navigation-run.ts`.

## Regression contract

To be written first: pinned existing IDs stay the same, and a key-reordered request
yields the same ID.
