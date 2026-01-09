export interface Token {
  name: string;
  symbol: string;
  address: string;
  decimals: number;
  logo?: string;
}

export const CASPER_TESTNET_TOKENS: Token[] = [
  {
    name: "SecureFlow Test Token",
    symbol: "SFT",
    address: "hash-46f3380815779532501538350153024853024853024853024853024853024853", // Placeholder
    decimals: 9,
  },
  {
    name: "Wrapped CSPR",
    symbol: "WCSPR",
    address: "hash-7a28380815779532501538350153024853024853024853024853024853024853", // Placeholder
    decimals: 9,
  }
];
