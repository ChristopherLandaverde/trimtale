# Use a supported human-assisted handoff for exact GTM workspace preview

Status: accepted

Stage 1 will prepare and validate the exact managed workspace, then hand the tracking
practitioner into Google Tag Assistant to exercise that workspace on the website. The
agent may guide the run and accept normalized evidence only when it is bound to the
same setup, workspace, and quick-preview fingerprints. We will not automate an
undocumented Tag Assistant session interface; Google's documented `quick_preview`
method creates compiler evidence for a temporary container version but does not expose
a browser-session handoff. This retains one human preview step in exchange for a
supported integration and evidence we can defend. Before enabling a run, the website
agent may prove that the recognized container is loaded on the bound target and ask
the practitioner to explicitly confirm that Tag Assistant shows that target as
Connected. The confirmation is local, non-durable, and invalidated by a changed
operation, workspace, preview fingerprint, container, or page; it is not inferred from
a debug cookie or an undocumented Google interface.
