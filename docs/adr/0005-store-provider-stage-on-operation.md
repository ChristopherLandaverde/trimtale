# Store provider stage on the tracking setup operation

Long Google work will record its stage and attempt on the existing tracking setup
operation instead of introducing a job store or treating the browser request as the
source of truth. The website agent will project `in_flight` only when that durable
attempt matches a live backend request; a started attempt without a live request is
`reconciling`, not failed or safe to retry. This adds operation-schema and
reconciliation work, but it prevents display timeouts, reloads, and backend restarts
from authorizing duplicate provider mutations.
