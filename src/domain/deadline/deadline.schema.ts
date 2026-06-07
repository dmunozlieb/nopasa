import { z } from 'zod';

/** All nine deadline categories. ITV and DNI are Spanish proper nouns, kept verbatim. */
export const DeadlineType = z.enum([
  'ITV',
  'DNI',
  'PASSPORT',
  'DRIVING_LICENSE',
  'INSURANCE',
  'SUBSCRIPTION',
  'WARRANTY',
  'GAS_INSPECTION',
  'OTHER',
]);
export type DeadlineType = z.infer<typeof DeadlineType>;

/** Manual lifecycle status. Defaults to ACTIVE at creation time. */
export const DeadlineStatus = z.enum(['ACTIVE', 'RESOLVED', 'CANCELLED']);
export type DeadlineStatus = z.infer<typeof DeadlineStatus>;

/** Source of truth for the domain entity. TS type is derived below via z.infer. */
export const deadlineSchema = z.object({
  id: z.string().min(1),
  type: DeadlineType,
  title: z.string().min(1),
  subtitle: z.string().optional(),
  dueDate: z.date(),
  amount: z.number().positive().optional(),
  amountLabel: z.string().optional(),
  reminderDaysBefore: z.array(z.number().int().nonnegative()),
  recurrenceMonths: z.number().int().positive().optional(),
  photoUri: z.string().optional(),
  createdAt: z.date(),
  status: DeadlineStatus,
});

export type Deadline = z.infer<typeof deadlineSchema>;
