/**
 * @vms/contracts — the single source of truth for API types.
 *
 * Consumed by relative path: "@vms/contracts": "file:../vms-contracts".
 * Never hand-write a type that mirrors a backend serializer; add it here.
 */
export type { components, operations, paths } from "./schema";

export { createVmsClient } from "./client";
export type { VmsClient, VmsClientOptions } from "./client";

import type { components } from "./schema";

type Schemas = components["schemas"];

export type User = Schemas["User"];
export type Visitor = Schemas["Visitor"];
export type Device = Schemas["Device"];
export type PairingCode = Schemas["PairingCode"];
export type ScanEvent = Schemas["ScanEvent"];

/** What the lobby screen renders — pushed over WS and returned by the backfill. */
export type ScreenEvent = Schemas["ScreenEvent"];

export type VisitorCategory = Schemas["CategoryEnum"];
export type DeviceKind = Schemas["KindEnum"];
export type ScanResult = Schemas["ResultEnum"];
