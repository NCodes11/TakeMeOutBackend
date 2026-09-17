import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { AppPalette } from '@/theme/appTheme';
import type { Stop, StopType } from '@/types/models';
import { stopTypeLabel } from '@/constants/stopTypes';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const TILE_BY_TYPE: Record<StopType, { icon: IconName; tone: keyof AppPalette }> = {
  coffee: { icon: 'coffee-outline', tone: 'tileAmber' },
  restaurant: { icon: 'silverware-fork-knife', tone: 'tileRose' },
  bar: { icon: 'glass-cocktail', tone: 'tileViolet' },
  dessert: { icon: 'ice-cream', tone: 'tileRose' },
  activity: { icon: 'ticket-confirmation-outline', tone: 'tileViolet' },
  attraction: { icon: 'star-four-points-outline', tone: 'tileBlue' },
  outdoors: { icon: 'pine-tree', tone: 'tileGreen' },
  shopping: { icon: 'shopping-outline', tone: 'tileAmber' },
  arts: { icon: 'palette-outline', tone: 'tileBlue' },
};

/** Soft pastel tile + icon used when a stop has no photo. */
export const categoryTile = (stop: Stop, palette: AppPalette) => {
  const type = stop.stopType && TILE_BY_TYPE[stop.stopType] ? stop.stopType : undefined;
  const entry = type
    ? TILE_BY_TYPE[type]
    : { icon: 'map-marker-outline' as IconName, tone: 'tileViolet' as const };
  return {
    icon: entry.icon,
    background: palette[entry.tone],
    label: type ? stopTypeLabel(type) : stop.category || 'Stop',
  };
};
