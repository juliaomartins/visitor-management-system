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

import { setDeviceRevokedHandler, setDeviceToken } from "@/api/client";
import {
  clearDeviceSession,
  canStoreSession,
  isSecureStorageAvailable,
  loadDeviceSession,
  saveDeviceSession,
  type DeviceSession,
} from "@/storage/secure";

type SessionState = {
  /** True until the keystore has been read. Nothing should route before then. */
  loading: boolean;
  device: DeviceSession | null;
  /**
   * Whether a token can be kept AT ALL. False only if the browser refuses to
   * store anything -- a private window, or storage blocked. This gates pairing.
   */
  storageAvailable: boolean;
  /**
   * Whether that store is a hardened OS keystore. False on web even when
   * pairing works, so the pairing screen can WARN instead of BLOCK.
   */
  storageIsSecure: boolean;
  adopt: (session: DeviceSession) => Promise<void>;
  forget: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [device, setDevice] = useState<DeviceSession | null>(null);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [storageIsSecure, setStorageIsSecure] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // TWO DIFFERENT QUESTIONS, and conflating them is what blocked web
      // pairing entirely. `canStoreSession` asks whether anything can be kept;
      // `isSecureStorageAvailable` asks whether the store is a real keystore.
      // Web answers yes to the first and no to the second.
      const [available, secure] = await Promise.all([
        canStoreSession(),
        isSecureStorageAvailable(),
      ]);
      const stored = available ? await loadDeviceSession() : null;

      if (cancelled) return;
      setStorageAvailable(available);
      setStorageIsSecure(secure);
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

  /*
    Revoked from the dashboard: drop the session so the app routes back to the
    pairing form and a new code can be entered.

    The OFFLINE QUEUE IS LEFT ALONE. The revoke dialog promises that scans saved
    on the phone still sync once it is paired again, and clearing them here would
    quietly break that promise — those rows are arrivals that really happened.
    Only a deliberate unpair, where the phone is being handed back, wipes them.
  */
  useEffect(() => {
    setDeviceRevokedHandler(() => {
      void forget();
    });
    return () => setDeviceRevokedHandler(null);
  }, [forget]);

  const value = useMemo<SessionState>(
    () => ({ loading, device, storageAvailable, storageIsSecure, adopt, forget }),
    [loading, device, storageAvailable, storageIsSecure, adopt, forget],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
}
