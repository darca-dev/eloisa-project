# Provenance of the login template patch

`themes/eloisa/login/template.ftl` is derived from the `keycloak.v2` login
template shipped in Keycloak 26.7.1, under the Apache License 2.0.
The license copied from that same installed distribution is in
`KEYCLOAK-LICENSE.txt`.

Source artifact: `org.keycloak.keycloak-themes-26.7.1.jar`, entry
`theme/keycloak.v2/login/template.ftl` from the pinned local container.
Original template SHA-256:
`6221a3176c73a3fd67abc97076deb9cef112378ce157735a78bd865800315b37`.

Modification 049: add `aria-label="${msg('username')}"` to the readonly
`kc-attempted-username` input, whose inherited visible label points to a
different ID. The file also carries a modification notice. All template
branches, forms, actions, scripts, escaping and provider controls remain the
same as that pinned parent. No password, user, session or provider setting is
embedded in this file.

Publication cleanup 2026-10-15: remove one trailing space on the reset-login
button line; no template behavior changes.

The installer requires the exact Keycloak 26.7.1 image. When upgrading the
provider, compare its new parent template and port this minimal accessibility
fix if still necessary. Verify normal login, reauthentication and password
actions before selecting a new supported version.
