import { useMemo } from "react";
import {
  measureActionLatency,
  trackSuperAdminApiFailure,
  trackTelemetry,
  trackUnauthorizedRouteHit,
} from "../utils/telemetry";

export function useTelemetry() {
  return useMemo(
    () => ({
      trackTelemetry,
      trackUnauthorizedRouteHit,
      trackSuperAdminApiFailure,
      measureActionLatency,
    }),
    []
  );
}

export default useTelemetry;

