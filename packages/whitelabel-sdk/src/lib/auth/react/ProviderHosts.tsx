import React, { useEffect, useState } from 'react';

import { PROVIDERS } from '@/lib/auth/core/providerManifest';
import type { AuthConfig, ProviderType } from '@/lib/auth/types';

type Host = { type: ProviderType; Component: React.ComponentType<{ config: AuthConfig }> };

/**
 * Mounts the React subtree of every applicable provider that declares one.
 *
 * Hooks-based wallet SDKs (Privy) need a `<Provider>` in the tree; imperative ones (AppKit)
 * do not. The manifest says which is which through `host`. This renders each host as a
 * SIBLING of the app, so a host arriving after first paint adds a node beside the app rather
 * than re-parenting it — re-parenting would remount every page.
 *
 * Client-only by construction: hosts load in an effect, so the server renders nothing here.
 */
export function ProviderHosts({ config }: { config: AuthConfig | null }) {
  const [hosts, setHosts] = useState<Host[]>([]);
  // The config object is rebuilt every render upstream; key the effect on its content.
  const configKey = config ? JSON.stringify(config) : null;

  useEffect(() => {
    if (!config) return;
    let live = true;
    const wanted = PROVIDERS.filter((d) => d.host && d.applies(config));
    Promise.all(
      wanted.map(async (d) => ({ type: d.type, Component: await (d.host as NonNullable<typeof d.host>)() }))
    ).then((loaded) => {
      if (live) setHosts(loaded);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey]);

  if (!config) return null;
  return (
    <>
      {hosts.map(({ type, Component }) => (
        <Component key={type} config={config} />
      ))}
    </>
  );
}
