/**
 * Who this device is, for the whole app.
 *
 * The root layout reads the keystore once at startup and publishes the result
 * here. Everything else asks this hook instead of touching SecureStore, so the
 * keystore is read exactly once per launch and the routing decision — pair screen
 * or camera — is made from one piece of state that pairing can update in place.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { setDeviceToken } from "@/api/client";
import {
  clearDeviceSession,
  isSecureStorageAvailable,
  loadDeviceSession,
  saveDeviceSession,
  type DeviceSession,
} from "@/storage/secure";

type SessionState = {
  /** True until the keystore has been read. Nothing should route before then. */
  loading: boolean;
  device: DeviceSession | null;
  /** False on web, where SecureStore has no implementation. */
  storageAvailable: boolean;
  adopt: (session: DeviceSession) => Promise<void>;
  forget: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [device, setDevice] = useState<DeviceSession | null>(null);
  const [storageAvailable, setStorageAvailable] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const available = await isSecureStorageAvailable();
      const stored = available ? await loadDeviceSession() : null;

      if (cancelled) return;
      setStorageAvailable(available);
      setDevice(stored);
      setDeviceToken(stored?.token ?? null);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const adopt = useCallback(async (session: DeviceSession) => {
    await saveDeviceSession(session);
    setDeviceToken(session.token);
    setDevice(session);
  }, []);

  const forget = useCallback(async () => {
    await clearDeviceSession();
    setDeviceToken(null);
    setDevice(null);
  }, []);

  const value = useMemo<SessionState>(
    () => ({ loading, device, storageAvailable, adopt, forget }),
    [loading, device, storageAvailable, adopt, forget],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
}
