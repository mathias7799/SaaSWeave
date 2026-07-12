import { ENV_WEB_ISOMORPHIC } from "@saasweave/env/web/env.isomorphic";
import { type WrapperImageProps } from "@saasweave/ui/components/image";
import { Image as RawImage } from "@saasweave/ui/components/image";

export function Image(props: WrapperImageProps) {
  const imgproxySourceBaseUrl =
    ENV_WEB_ISOMORPHIC.VITE_IMGPROXY_SOURCE_WEB_URL ?? ENV_WEB_ISOMORPHIC.VITE_WEB_URL;

  return (
    <RawImage
      {...props}
      siteBaseUrl={imgproxySourceBaseUrl}
      imgProxyBaseUrl={ENV_WEB_ISOMORPHIC.VITE_IMGPROXY_URL}
      imgProxySignature={ENV_WEB_ISOMORPHIC.VITE_IMGPROXY_SIGNATURE}
    />
  );
}
