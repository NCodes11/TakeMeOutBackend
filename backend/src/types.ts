import { z } from 'zod';

export const tripFeedbackSchema = z
  .object({
    id: z.string().min(1),
    tripId: z.string().min(1),
    timestamp: z.string().datetime().optional(),
    thumbsUp: z.boolean(),
    feedbackText: z.string().optional(),
    selectedStopTypes: z.array(z.string()).optional().default([]),
    locationCity: z.string().optional(),
    locationState: z.string().optional(),
    stopCount: z.coerce.number().int().nonnegative(),
    priceTier: z.enum(['$', '$$', '$$$']),
    distancePreference: z.coerce.number().optional(),
    appVersion: z.string().optional(),
    deviceType: z.enum(['ios', 'android', 'web']).optional(),
    platform: z.enum(['ios', 'android', 'web']).optional(),
  })
  .strip();

export const featureRequestSchema = z
  .object({
    id: z.string().min(1),
    message: z.string().min(1),
    category: z.string().optional(),
    timestamp: z.string().datetime().optional(),
    appVersion: z.string().optional(),
    deviceType: z.enum(['ios', 'android', 'web']).optional(),
    platform: z.enum(['ios', 'android', 'web']).optional(),
    locationCity: z.string().optional(),
    locationState: z.string().optional(),
  })
  .strip();

export type TripFeedbackIngest = z.infer<typeof tripFeedbackSchema>;
export type FeatureRequestIngest = z.infer<typeof featureRequestSchema>;

export const adminFilterSchema = z
  .object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    thumbsUp: z.enum(['all', 'up', 'down']).optional().default('all'),
    category: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    q: z.string().optional(),
  })
  .strip();

export type AdminFilters = z.infer<typeof adminFilterSchema>;

export interface RequestMetadata {
  receivedAt: string;
  userAgent?: string;
  appVersion?: string;
  deviceType?: string;
  platform?: string;
}
