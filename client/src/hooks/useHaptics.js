import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const isNative = () => {
  try { return window.Capacitor?.isNativePlatform?.() ?? false; }
  catch { return false; }
};

export function useHaptics() {
  const impact = async (style = ImpactStyle.Light) => {
    if (!isNative()) return;
    try { await Haptics.impact({ style }); } catch {}
  };

  const notification = async (type = NotificationType.Success) => {
    if (!isNative()) return;
    try { await Haptics.notification({ type }); } catch {}
  };

  const tap    = () => impact(ImpactStyle.Light);
  const medium = () => impact(ImpactStyle.Medium);
  const heavy  = () => impact(ImpactStyle.Heavy);
  const success = () => notification(NotificationType.Success);
  const warn    = () => notification(NotificationType.Warning);
  const fail    = () => notification(NotificationType.Error);

  return { tap, medium, heavy, success, warn, fail, impact, notification };
}
