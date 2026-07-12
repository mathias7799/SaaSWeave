import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { client, orpc } from "@saasweave/api/client/tanstack-start/orpc";
import { Button } from "@saasweave/ui/components/button";
import { Input } from "@saasweave/ui/components/input";
import { Label } from "@saasweave/ui/components/label";

import { consoleCommonMessages, profileMessages } from "@/shared/lib/console-messages";
import {
  ConsoleErrorState,
  ConsoleSkeleton,
  Panel,
  PanelHeader,
  SectionHeading
} from "@/shared/ui/console-kit";
import { Image } from "@/shared/ui/image";

export function ProfilePage() {
  const queryClient = useQueryClient();
  const profile = useQuery(orpc.console.profile.get.queryOptions());
  const [name, setName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const save = useMutation({
    mutationFn: (nextName: string) => client.console.profile.update({ name: nextName }),
    onSuccess: async () => {
      toast.success(profileMessages.profileUpdated());
      await queryClient.invalidateQueries({
        queryKey: orpc.console.profile.get.queryKey()
      });
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      const contract = await client.console.profile.requestAvatarUpload({
        contentType: file.type,
        fileName: file.name,
        size: file.size
      });
      const response = await fetch(contract.contract.url, {
        body: file,
        headers: { "Content-Type": file.type },
        method: contract.contract.method
      });
      if (!response.ok) throw new Error(profileMessages.uploadFailed());
      return client.console.profile.completeAvatarUpload({
        mediaAssetId: contract.mediaAssetId
      });
    },
    onSuccess: async () => {
      toast.success(profileMessages.avatarUpdated());
      await queryClient.invalidateQueries({
        queryKey: orpc.console.profile.get.queryKey()
      });
    },
    onError: (error: Error) => toast.error(error.message)
  });

  if (profile.isError) {
    return (
      <ConsoleErrorState
        description={profileMessages.errorDescription()}
        onRetry={() => profile.refetch()}
      />
    );
  }
  if (!profile.data) return <ConsoleSkeleton />;

  const displayName = name ?? profile.data.name;

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow={consoleCommonMessages.accountEyebrow()}
        title={profileMessages.title()}
        description={profileMessages.description()}
      />

      <Panel>
        <PanelHeader
          title={profileMessages.profileTitle()}
          description={profileMessages.profileDescription()}
        />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="profile-name">{profileMessages.displayNameLabel()}</Label>
            <Input
              id="profile-name"
              onChange={(event) => setName(event.target.value)}
              value={displayName}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">{consoleCommonMessages.emailLabel()}</Label>
            <Input disabled id="profile-email" value={profile.data.email} />
            <p className="text-xs text-muted-foreground">{profileMessages.emailChangeHint()}</p>
          </div>
        </div>
        <div className="border-t border-border px-5 py-4">
          <Button
            disabled={save.isPending || displayName.trim().length === 0}
            onClick={() => save.mutate(displayName.trim())}
            size="sm"
          >
            {save.isPending ? consoleCommonMessages.saving() : profileMessages.saveProfile()}
          </Button>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title={profileMessages.avatarTitle()}
          description={profileMessages.avatarDescription()}
        />
        <div className="flex items-center gap-4 p-5">
          {profile.data.image ? (
            <Image
              alt=""
              className="size-16 rounded-full object-cover"
              height={64}
              src={profile.data.image}
              width={64}
            />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-full bg-muted text-lg font-medium text-muted-foreground">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="space-y-2">
            <input
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadAvatar.mutate(file);
                event.target.value = "";
              }}
              ref={fileInputRef}
              type="file"
            />
            <Button
              disabled={uploadAvatar.isPending}
              onClick={() => fileInputRef.current?.click()}
              size="sm"
              variant="outline"
            >
              {uploadAvatar.isPending ? profileMessages.uploading() : profileMessages.uploadPhoto()}
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
