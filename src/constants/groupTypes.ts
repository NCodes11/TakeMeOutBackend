import { GroupType } from '@/types/models';

export const GROUP_TYPE_OPTIONS = [
  { value: 'Date', label: 'Date' },
  { value: 'Solo', label: 'Solo' },
  { value: 'Family', label: 'Family' },
  { value: 'Friends', label: 'Friends' },
] satisfies Array<{ value: GroupType; label: string }>;

export const GROUP_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  ...GROUP_TYPE_OPTIONS,
] as const;
