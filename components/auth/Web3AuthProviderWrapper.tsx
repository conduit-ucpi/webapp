import { Web3AuthProvider } from "@web3auth/modal/react";
import { ReactNode, useEffect, useState } from "react";
import { useConfig } from "./ConfigProvider";
import { createWeb3AuthConfig } from "@/lib/web3authConfig";
import { Web3AuthContextConfig } from "@web3auth/modal/react";

interface Props {
  children: ReactNode;
}

export function Web3AuthProviderWrapper({ children }: Props) {
  const { config } = useConfig();
  const [web3AuthConfig, setWeb3AuthConfig] = useState<Web3AuthContextConfig | null>(null);

  useEffect(() => {
    if (config) {
      const authConfig = createWeb3AuthConfig(config);
      setWeb3AuthConfig(authConfig);
    }
  }, [config]);

  if (!web3AuthConfig) {
    return <div>Loading Web3Auth...</div>;
  }

  return (
    <Web3AuthProvider config={web3AuthConfig}>
      {children}
    </Web3AuthProvider>
  );
}