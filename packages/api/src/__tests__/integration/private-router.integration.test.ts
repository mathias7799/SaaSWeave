/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper */
import { describe } from "vite-plus/test";

import { createCallerFor, expectOrpcError, integrationIt, seedOrgWithOwner } from "./harness";

describe.sequential("private router", () => {
  integrationIt("private.data returns NOT_IMPLEMENTED outside production", async () => {
    const seed = await seedOrgWithOwner();
    const caller = await createCallerFor({ seed });

    await expectOrpcError(() => caller.private.data(), "NOT_IMPLEMENTED");
  });
});
