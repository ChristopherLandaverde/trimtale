# Bind product access to Clerk Organizations

The single-organization beta will authenticate practitioners with one Clerk
Organization per backend deployment and map Clerk's Member and Admin roles to stable
product permissions. The Chrome extension uses OAuth authorization code with PKCE and
the backend uses Clerk's supported token verifier; the extension does not install
Clerk's browser SDK because its unrelated transitive wallet and React-Native packages
introduced high-severity audit findings. This accepts provider coupling for identity
while keeping organization ownership and route permissions in the product domain, so
a later provider change does not redefine tracking authority.
