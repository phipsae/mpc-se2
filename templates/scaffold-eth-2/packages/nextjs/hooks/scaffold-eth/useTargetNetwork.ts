import { useAccount } from "wagmi";
import scaffoldConfig from "~~/scaffold.config";

export function useTargetNetwork() {
  const { chain } = useAccount();
  
  // Return the connected chain if it's in our target networks, otherwise default to first target
  const targetNetwork = scaffoldConfig.targetNetworks.find(
    (network) => network.id === chain?.id
  ) || scaffoldConfig.targetNetworks[0];

  return {
    targetNetwork,
  };
}
