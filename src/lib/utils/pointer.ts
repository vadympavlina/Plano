/**
 * Whether the device has a mouse-like pointer. A form that grabs focus on open is a convenience with a
 * keyboard at hand, but on a phone it throws the keyboard over the form before the person has seen it.
 */
export const canAutoFocus = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
