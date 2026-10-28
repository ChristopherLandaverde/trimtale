# Derive browser verdicts from the tracking setup contract

GTM Observability will evaluate normalized run evidence against a versioned browser
evidence contract carried by the tracking setup instead of adding verifier branches
for each analytics event. The contract names the required outcome, expected
destination event and parameters, permitted automatic events, duplicate policy,
data-layer and tag expectations, and negative observations. Permitted automatic events
are excluded only from duplicate counting and can never satisfy the expected event.
Event-specific evidence collection and privacy filtering remain at the browser
boundary, and the existing form evaluator remains authoritative until the shared
evaluator proves verdict parity across the accepted corpus.
