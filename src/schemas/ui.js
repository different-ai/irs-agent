const { z } = require('zod');

// Schema for UI/UX recommendations
const uiRecommendationSchema = z.object({
  recommendations: z.array(z.object({
    type: z.string(),
    reason: z.string(),
    interactiveElements: z.array(z.string())
  })),
  suggestedComponents: z.array(z.string())
});

// Schema for UI components
const uiComponentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    content: z.string(),
    variant: z.enum(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'])
  }),
  z.object({
    type: z.literal('date'),
    label: z.string(),
    value: z.string()
  }),
  z.object({
    type: z.literal('number'),
    label: z.string(),
    value: z.number()
  }),
  z.object({
    type: z.literal('checkbox'),
    label: z.string(),
    checked: z.boolean()
  }),
  z.object({
    type: z.literal('list'),
    items: z.array(z.object({
      content: z.string(),
      checked: z.boolean().optional()
    })),
    variant: z.enum(['ordered', 'unordered'])
  })
]);

const astSchema = z.object({
  ast: z.array(uiComponentSchema)
});

module.exports = {
  uiRecommendationSchema,
  uiComponentSchema,
  astSchema
};
