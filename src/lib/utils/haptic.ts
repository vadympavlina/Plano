/** A short tap of vibration where supported (Android); a no-op elsewhere (iOS has no web vibration). */
export const haptic = (ms = 12) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
};
