/**
 * The verdict, full screen.
 *
 * It covers the whole preview on purpose. A badge across a corner of a camera
 * feed is something to squint at; a wall of colour is something to read at arm's
 * length while looking at the person, which is what a guard is actually doing.
 *
 * Colour is never the only signal — each verdict also has its own word, its own
 * sound and its own haptic, because a guard may be colour-blind, in direct sun,
 * or looking away entirely.
 *
 * The photo is the reason this card is worth looking at. A name says who the badge
 * claims to be; only the face says whether the person holding it is that person.
 * It comes from `photo_url` on the scan response — an absolute URL built from the
 * backend's MEDIA_BASE_URL, so it must point at the server's LAN address, not
 * localhost, or the phone will try to load it from itself.
 */
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ScanResponse, ScanResult } from "@/api/scans";
import type { CachedVisitor } from "@/storage/queue";
import { colors, HIT_SIZE, radius, spacing } from "@/theme";

type Verdict = {
  headline: string;
  detail: string;
  background: string;
  ink: string;
  /** True when the guard must acknowledge before the camera resumes. */
  blocking: boolean;
};

const VERDICTS: Record<ScanResult, Verdict> = {
  valid: {
    headline: "Welcome",
    detail: "Badge is valid",
    background: colors.valid,
    ink: "#04140C",
    blocking: false,
  },
  invalid: {
    headline: "Not a valid badge",
    detail: "This QR code is not from this event",
    background: colors.invalid,
    ink: "#FFFFFF",
    blocking: true,
  },
  revoked: {
    headline: "Badge revoked",
    detail: "Do not admit. Send them to the registration desk",
    background: colors.revoked,
    ink: "#1A1000",
    blocking: true,
  },
  duplicate: {
    headline: "Already scanned",
    detail: "Same badge within the last minute",
    background: colors.surfaceRaised,
    ink: colors.text,
    blocking: false,
  },
};

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

export function ScanResultCard({
  response,
  onDismiss,
}: {
  response: ScanResponse;
  onDismiss: () => void;
}) {
  const verdict = VERDICTS[response.result];
  const visitor = response.visitor;

  return (
    <Pressable
      onPress={onDismiss}
      accessibilityRole="button"
      accessibilityLabel={`${verdict.headline}. ${visitor?.full_name ?? ""}. Tap to continue.`}
      style={[styles.fill, { backgroundColor: verdict.background }]}
    >
      <View style={styles.body}>
        <Text style={[styles.headline, { color: verdict.ink }]}>
          {verdict.headline}
        </Text>
        <Text style={[styles.detail, { color: verdict.ink }]}>{verdict.detail}</Text>

        {visitor ? (
          <View style={styles.visitor}>
            <View style={[styles.photo, { borderColor: verdict.ink }]}>
              {visitor.photo_url ? (
                <Image
                  source={{ uri: visitor.photo_url }}
                  style={styles.photoImage}
                  contentFit="cover"
                  // Cached, so a guest scanned twice does not re-download over a
                  // congested event router.
                  cachePolicy="memory-disk"
                  transition={120}
                  accessibilityLabel={`Badge photo of ${visitor.full_name}`}
                />
              ) : (
                // A photo is required at registration, so this is the defensive
                // path: a missing file must still leave a readable card.
                <Text style={[styles.initials, { color: verdict.ink }]}>
                  {initials(visitor.full_name)}
                </Text>
              )}
            </View>

            <View style={styles.identity}>
              <Text
                style={[styles.name, { color: verdict.ink }]}
                numberOfLines={2}
                adjustsFontSizeToFit
              >
                {visitor.full_name}
              </Text>
              <Text style={[styles.country, { color: verdict.ink }]} numberOfLines={1}>
                {visitor.country}
              </Text>
              {visitor.organization ? (
                <Text style={[styles.org, { color: verdict.ink }]} numberOfLines={1}>
                  {visitor.organization}
                </Text>
              ) : null}

              <View style={styles.tags}>
                {visitor.category === "vip" ? (
                  <Text style={[styles.tag, { color: verdict.ink, borderColor: verdict.ink }]}>
                    VIP
                  </Text>
                ) : null}
                <Text style={[styles.serial, { color: verdict.ink }]}>
                  {visitor.badge_serial}
                </Text>
              </View>
            </View>
          </View>
        ) : null}
      </View>

      <Text style={[styles.dismiss, { color: verdict.ink }]}>
        {verdict.blocking ? "Tap to continue" : "Tap to scan the next badge"}
      </Text>
    </Pressable>
  );
}

/**
 * Queued, not verified.
 *
 * The scan is saved on this phone and nothing has checked it. That distinction is
 * the entire design of this card: it is BLUE, never green, it says "not verified"
 * in the headline, and its sound is a low unhurried note rather than the bright
 * rising chirp of an accepted badge. A guard glancing at it must not come away
 * thinking the badge passed.
 *
 * When this phone has seen the badge before, the cached identity is shown so the
 * guard can still compare the face to the card — but it is labelled "last seen"
 * and dated, because it is a memory, not a check. The badge may have been revoked
 * in the meantime and this phone would have no way to know.
 */
export function ScanQueuedCard({
  visitor,
  scannedAt,
  onDismiss,
}: {
  visitor: CachedVisitor | null;
  scannedAt: Date;
  onDismiss: () => void;
}) {
  return (
    <Pressable
      onPress={onDismiss}
      accessibilityRole="button"
      accessibilityLabel={`Queued, not verified. ${visitor?.fullName ?? "Unknown badge"}. Tap to continue.`}
      style={[styles.fill, styles.queuedFill]}
    >
      <View style={styles.body}>
        <Text style={styles.queuedHeadline}>Queued</Text>
        <Text style={styles.queuedDetail}>
          Not verified — the server could not be reached
        </Text>

        {visitor ? (
          <>
            <View style={styles.visitor}>
              <View style={[styles.photo, styles.queuedPhoto]}>
                {visitor.photoUrl ? (
                  <Image
                    source={{ uri: visitor.photoUrl }}
                    style={styles.photoImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={120}
                    accessibilityLabel={`Badge photo of ${visitor.fullName}`}
                  />
                ) : (
                  <Text style={[styles.initials, { color: colors.text }]}>
                    {initials(visitor.fullName)}
                  </Text>
                )}
              </View>

              <View style={styles.identity}>
                <Text
                  style={[styles.name, { color: colors.text }]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                >
                  {visitor.fullName}
                </Text>
                <Text style={[styles.country, { color: colors.text }]} numberOfLines={1}>
                  {visitor.country}
                </Text>
                <View style={styles.tags}>
                  {visitor.category === "vip" ? (
                    <Text
                      style={[styles.tag, { color: colors.text, borderColor: colors.text }]}
                    >
                      VIP
                    </Text>
                  ) : null}
                  <Text style={[styles.serial, { color: colors.text }]}>
                    {visitor.badgeSerial}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.lastSeen}>
              Last seen on this phone at{" "}
              {new Date(visitor.seenAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
              . Not re-checked — this badge may have been revoked since.
            </Text>
          </>
        ) : (
          <Text style={styles.queuedNote}>
            This phone has not seen this badge before, so there is nothing to show
            you. Use your judgment at the door.
          </Text>
        )}

        <Text style={styles.queuedFooter}>
          Saved at{" "}
          {scannedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} and
          will sync when the network returns. Nothing has been lost.
        </Text>
      </View>

      <Text style={[styles.dismiss, { color: colors.text }]}>
        Tap to scan the next badge
      </Text>
    </Pressable>
  );
}

/**
 * Not a verdict.
 *
 * A failure to reach the server looks nothing like a refused badge, because the
 * guard must never turn a guest away over a dead router. Dark, not red; it names
 * the problem and offers the badge back rather than a decision about the person.
 */
export function ScanErrorCard({
  message,
  recoverable,
  onRetry,
  onDismiss,
}: {
  message: string;
  recoverable: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <View style={[styles.fill, styles.errorFill]}>
      <View style={styles.body}>
        <Text style={styles.errorHeadline}>Could not check this badge</Text>
        <Text style={styles.errorDetail}>{message}</Text>
        <Text style={styles.errorNote}>
          This is not the visitor&rsquo;s fault. Nothing has been recorded — do not
          turn them away on account of this screen.
        </Text>
      </View>

      <View style={styles.actions}>
        {recoverable ? (
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
          >
            <Text style={styles.retryLabel}>Try again</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          style={({ pressed }) => [styles.cancel, pressed && styles.retryPressed]}
        >
          <Text style={styles.cancelLabel}>Back to camera</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: "space-between",
    padding: spacing.lg,
  },
  errorFill: { backgroundColor: colors.background },
  // Blue. Not green, not amber, not red — this is the only state that is neither
  // a verdict nor a failure, and it must look like neither.
  queuedFill: { backgroundColor: "#123A5E" },
  queuedPhoto: { borderColor: colors.text },
  queuedHeadline: { color: colors.text, fontSize: 40, fontWeight: "800" },
  queuedDetail: { color: colors.text, fontSize: 18, fontWeight: "600", opacity: 0.85 },
  queuedNote: { color: colors.text, fontSize: 16, lineHeight: 23, opacity: 0.85 },
  lastSeen: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.8,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  queuedFooter: { color: colors.text, fontSize: 14, lineHeight: 20, opacity: 0.75 },
  body: { flex: 1, justifyContent: "center", gap: spacing.md },

  headline: { fontSize: 40, fontWeight: "800", letterSpacing: -0.5 },
  detail: { fontSize: 18, fontWeight: "600", opacity: 0.85 },

  visitor: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  photo: {
    width: 84,
    height: 112, // 3:4, the aspect the dashboard crops to
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photoImage: { width: "100%", height: "100%" },
  initials: { fontSize: 30, fontWeight: "800", opacity: 0.8 },
  identity: { flex: 1, gap: 2 },
  name: { fontSize: 28, fontWeight: "800" },
  country: { fontSize: 17, fontWeight: "600", opacity: 0.9 },
  org: { fontSize: 15, opacity: 0.75 },
  tags: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  tag: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    borderWidth: 1.5,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    overflow: "hidden",
  },
  serial: { fontSize: 13, fontWeight: "600", opacity: 0.75 },

  dismiss: { fontSize: 15, fontWeight: "600", textAlign: "center", opacity: 0.7 },

  errorHeadline: { color: colors.text, fontSize: 30, fontWeight: "800" },
  errorDetail: { color: colors.textMuted, fontSize: 17, lineHeight: 25 },
  errorNote: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  actions: { gap: spacing.sm },
  retry: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    minHeight: HIT_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  retryPressed: { opacity: 0.8 },
  retryLabel: { color: colors.onAccent, fontSize: 17, fontWeight: "700" },
  cancel: {
    minHeight: HIT_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelLabel: { color: colors.textMuted, fontSize: 16, fontWeight: "600" },
});
