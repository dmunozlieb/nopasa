import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { DeadlineType } from '../../domain/deadline/deadline.schema';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Maps each deadline type to a MaterialCommunityIcons glyph name. */
const ICONS: Record<DeadlineType, IconName> = {
  ITV: 'car',
  DNI: 'card-account-details',
  PASSPORT: 'passport',
  DRIVING_LICENSE: 'card-account-details-outline',
  INSURANCE: 'shield-check',
  SUBSCRIPTION: 'television-classic',
  WARRANTY: 'package-variant-closed',
  GAS_INSPECTION: 'fire',
  OTHER: 'dots-horizontal',
};

export function typeIcon(type: DeadlineType): IconName {
  return ICONS[type];
}
