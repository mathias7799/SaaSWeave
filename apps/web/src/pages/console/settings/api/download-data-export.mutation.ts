import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@saasweave/api/client/tanstack-start/orpc";

export function useDownloadDataExportMutation() {
  return useMutation(
    orpc.console.dataExport.download.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || "Failed to download export.");
      }
    })
  );
}
