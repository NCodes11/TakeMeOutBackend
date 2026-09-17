import { Alert, Linking, Platform } from 'react-native';

type OpenMapsOptionsParams = {
  name: string;
  lat: number;
  lng: number;
};

export async function openMapsOptions({
  name,
  lat,
  lng,
}: OpenMapsOptionsParams): Promise<void> {
  const encodedName = encodeURIComponent(name || 'Destination');

  const googleMapsAppUrl = `comgooglemaps://?daddr=${lat},${lng}&q=${encodedName}&directionsmode=driving`;
  const wazeUrl = `waze://?ll=${lat},${lng}&navigate=yes`;
  const appleMapsUrl = `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
  const browserUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  const options: Array<{ label: string; url: string }> = [];

  if (Platform.OS === 'ios') {
    options.push({ label: 'Apple Maps', url: appleMapsUrl });
  }

  const hasGoogleMaps = await Linking.canOpenURL(googleMapsAppUrl).catch(() => false);
  if (hasGoogleMaps) {
    options.push({ label: 'Google Maps', url: googleMapsAppUrl });
  }

  const hasWaze = await Linking.canOpenURL(wazeUrl).catch(() => false);
  if (hasWaze) {
    options.push({ label: 'Waze', url: wazeUrl });
  }

  options.push({ label: 'Browser', url: browserUrl });

  Alert.alert(
    'Open directions in',
    name || 'Destination',
    [
      ...options.map((option) => ({
        text: option.label,
        onPress: () => {
          void Linking.openURL(option.url);
        },
      })),
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ],
    { cancelable: true }
  );
}