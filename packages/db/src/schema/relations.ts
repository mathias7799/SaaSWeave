import { defineRelations } from "drizzle-orm";

import * as schema from "#@/schema/index";

export const relations = defineRelations(schema, (r) => {
  return {
    batchJob: {
      items: r.many.batchJobItem(),
      organization: r.one.organization({
        from: r.batchJob.organizationId,
        to: r.organization.id
      })
    },
    batchJobItem: {
      batchJob: r.one.batchJob({
        from: r.batchJobItem.batchJobId,
        to: r.batchJob.id
      })
    },
    dataExportRequest: {
      organization: r.one.organization({
        from: r.dataExportRequest.organizationId,
        to: r.organization.id
      })
    },
    usageEvent: {
      organization: r.one.organization({
        from: r.usageEvent.organizationId,
        to: r.organization.id
      })
    },
    webhookDelivery: {
      endpoint: r.one.webhookEndpoint({
        from: r.webhookDelivery.endpointId,
        to: r.webhookEndpoint.id
      })
    },
    webhookEndpoint: {
      deliveries: r.many.webhookDelivery(),
      organization: r.one.organization({
        from: r.webhookEndpoint.organizationId,
        to: r.organization.id
      })
    }
  };
});
