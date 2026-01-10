import React from "react";
import { casperLegacyNetwork } from "../util/casper-legacy-constants";
import FundAccountButton from "./FundAccountButton";
import { WalletButton } from "./WalletButton";
import NetworkPill from "./NetworkPill";

const ConnectAccount: React.FC = () => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: "10px",
        verticalAlign: "middle",
      }}
    >
      <WalletButton />
      {casperLegacyNetwork !== "PUBLIC" && <FundAccountButton />}
      <NetworkPill />
    </div>
  );
};

export default ConnectAccount;
