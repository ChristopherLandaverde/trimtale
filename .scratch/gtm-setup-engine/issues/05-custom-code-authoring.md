# Verified Custom HTML and JavaScript authoring

Delivery mode: implementation
Status: in progress

## Production outcome

The website agent can adapt one authoritative third-party integration into reviewable
Custom HTML or JavaScript, expose its code and data behavior, and pass positive and
negative browser verification before version approval.

## Non-goals

- Inventing undocumented vendor protocols.
- Silent personal-data collection.
- General-purpose arbitrary code execution.
- Publication without the ordinary exact-version approval.

## Authorization

The user selected custom code as an MVP capability and authorized continuous Stage 1
implementation on 2026-08-24.

## Regression contract

- `packages/core/src/custom-code.test.ts` proves static policy checks reject forbidden data sources, undeclared destinations, and
  unsafe configuration shapes.
- Browser tests cover the expected page, an excluded page, consent-granted and denied
  states, duplicate prevention, outgoing destinations, and new page errors.
- The review displays exact code, destinations, inputs, firing scope, and evidence.

## Dependencies

- Issues 01, 02, and 04.

## Comments

### 2026-08-26 vendor boundary review

No evaluated vendor is a valid first Custom HTML proof under the accepted contract:

| Vendor | Authoritative GTM path | Decision |
| --- | --- | --- |
| Microsoft Clarity | The [official guide](https://learn.microsoft.com/en-us/clarity/third-party-integrations/google-tag-manager) recommends its direct GTM integration and offers an official template before manual Custom HTML. | Use the higher-priority mechanism, not Custom HTML. |
| Hotjar | The [official guide](https://help.hotjar.com/hc/en-us/articles/36820058585873-Install-the-Tracking-Code-with-Google-Tag-Manager) offers a direct integration and a built-in Hotjar tag before Custom HTML. | Use the higher-priority mechanism, not Custom HTML. |
| Plausible | The [official guide](https://plausible.io/gtm-template) provides an official GTM template for initialization and events. | Use the higher-priority mechanism, not Custom HTML. |
| HubSpot | The [official guide](https://knowledge.hubspot.com/reports/install-the-hubspot-tracking-code) prescribes Custom HTML for GTM, but the loader can track non-HubSpot forms and enable chat according to account settings. | Reject until its remote behavior and account settings are reviewable inputs. |

HubSpot is not a safe exception. Its tracking code collects page paths, IP addresses,
and online identifiers according to its [data-collection documentation](https://knowledge.hubspot.com/reports/data-collected-by-the-hubspot-tracking-code).
When non-HubSpot form collection is enabled, it scans forms, stores submissions in
local storage, and creates or updates contacts according to its
[forms documentation](https://knowledge.hubspot.com/forms/use-non-hubspot-forms).
Those behaviors cannot be inferred from the static loader snippet or represented by
the current declared-input contract.

The next implementation needs one explicit product choice:

- select another authoritative vendor whose recommended GTM path requires Custom HTML
  and whose data behavior is fully represented by the current contract; or
- expand the accepted outcome to verify vendor account settings and loaded-script
  behavior, including private-data and consent controls.

The second choice introduces new provider-state and remote-code verification behavior.
It is outside this issue's accepted production outcome and needs separate
authorization.
