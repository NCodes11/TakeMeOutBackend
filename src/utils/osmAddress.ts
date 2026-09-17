const cleanTag = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const firstDefinedTag = (tags: Record<string, string> | undefined, keys: string[]) => {
  for (const key of keys) {
    const value = cleanTag(tags?.[key]);
    if (value) return value;
  }

  return undefined;
};

export const formatOsmDisplayAddress = (tags?: Record<string, string>) => {
  const fullAddress = firstDefinedTag(tags, ['addr:full', 'contact:street_address']);
  if (fullAddress) return fullAddress;

  const houseNumber = firstDefinedTag(tags, ['addr:housenumber']);
  const streetName = firstDefinedTag(tags, ['addr:street']);
  const streetLine = [houseNumber, streetName].filter(Boolean).join(' ').trim() || undefined;

  const locality = firstDefinedTag(tags, [
    'addr:city',
    'addr:town',
    'addr:village',
    'addr:hamlet',
    'addr:suburb',
    'is_in:city',
    'addr:county',
  ]);
  const region = firstDefinedTag(tags, ['addr:state', 'is_in:state']);
  const postcode = firstDefinedTag(tags, ['addr:postcode']);
  const localityLine = [locality, region].filter(Boolean).join(', ').trim() || undefined;

  if (streetLine && localityLine) return `${streetLine}, ${localityLine}`;
  if (streetLine && postcode) return `${streetLine}, ${postcode}`;
  if (streetLine) return streetLine;
  if (localityLine) return localityLine;
  if (postcode) return postcode;

  return '';
};
