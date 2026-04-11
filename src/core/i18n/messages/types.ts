import { en } from './en'

export type MessageKey = keyof typeof en
export type MessageCatalog = Partial<Record<MessageKey, string>>

export const MESSAGE_KEYS = Object.freeze(Object.keys(en) as MessageKey[])
