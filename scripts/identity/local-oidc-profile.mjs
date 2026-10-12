/** Provider-side metadata only; Person remains the source of personal data. */
export function buildLocalProvisioningProfile(current) {
  if (current === null || typeof current !== 'object' || !Array.isArray(current.attributes)
    || !current.attributes.some(attribute => attribute.name === 'username')) {
    throw new Error('Unexpected local identity user-profile configuration');
  }
  const profile = structuredClone(current);
  // Keycloak 26 uses an absent policy for its disabled default.
  // The literal "DISABLED" is not accepted by its profile endpoint.
  delete profile.unmanagedAttributePolicy;
  profile.attributes = profile.attributes.filter(attribute => attribute.name !== 'merdnAccessRequest');
  for (const attribute of profile.attributes) {
    if (['email', 'firstName', 'lastName'].includes(attribute.name)) delete attribute.required;
  }
  profile.attributes.push({
    name: 'merdnAccessRequest', displayName: 'MERDN provisioning reference',
    multivalued: false,
    permissions: { view: ['admin'], edit: ['admin'] },
    validations: {
      length: { min: 36, max: 36 },
      pattern: { pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' },
    },
  });
  return profile;
}
