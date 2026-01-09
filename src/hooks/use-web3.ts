import { use } from "react";
import { Web3Context } from "../contexts/web3-context";

export const useWeb3 = () => {
  const context = use(Web3Context);
  if (context === undefined) {
    throw new Error("useWeb3 must be used within a Web3Provider");
  }
  return context;
};
