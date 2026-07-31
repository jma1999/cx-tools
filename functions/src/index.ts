import { setGlobalOptions } from "firebase-functions/v2";

setGlobalOptions({
  region: "us-central1",
  maxInstances: 10,
});

/*
 * Secure callable functions will be added here
 * during the member-invitation phase.
 */