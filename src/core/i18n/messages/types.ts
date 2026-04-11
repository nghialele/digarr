export const MESSAGE_KEYS = ['auth.signIn'] as const

export type MessageKey = (typeof MESSAGE_KEYS)[number]

export type MessageCatalog = Partial<Record<MessageKey, string>>
