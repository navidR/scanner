export interface ExtractedReward {
  txId: string;
  serializedTransaction: string;
  timestamp: string;
  tokenId: string;
  bridgeFee: bigint;
  networkFee: bigint;
  emissionTokenId: string;
  guardsEmission: bigint;
  watchersEmission: bigint;
  rewardedWIDsCount: number | null;
  rewardedWIDs: string;
  spendBlock?: string | null;
  spendHeight?: number;
  spendTxId?: string | null;
  extractor: string;
}
