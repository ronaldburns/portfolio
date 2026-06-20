import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const projects = defineCollection({
	loader: glob({ base: './src/content/projects', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		// Human strings like "Sep 1, 2023" coerce cleanly to Date.
		date: z.coerce.date(),
		lastModified: z.coerce.date().optional(),
		published: z.boolean().default(true),
		// Hero / OG image - an R2 key or absolute URL (migrated later).
		image: z.string().optional(),
		url: z.string().optional(),
		repository: z.string().optional(),
		featured: z.boolean().default(false),
		tags: z.string().optional(),
	}),
});

export const collections = { projects };
