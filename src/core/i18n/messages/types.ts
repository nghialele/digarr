import { en } from './en'

export type MessageKey = keyof typeof en
export type MessageCatalog = { [Key in MessageKey]: string }

export const MESSAGE_KEYS = Object.freeze(Object.keys(en) as MessageKey[])
