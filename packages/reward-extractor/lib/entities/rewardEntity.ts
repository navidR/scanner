import {
  BigIntValueTransformer,
  Column,
  Entity,
  PrimaryColumn,
} from '@rosen-bridge/extended-typeorm';

@Entity('reward_entity')
export class RewardEntity {
  @PrimaryColumn({ type: 'varchar'})
  txId: string;

  @Column({ type: 'text' })
  serializedTransaction: string;

  @Column({ type: 'varchar' })
  timestamp: string;

  @Column({ type: 'varchar' })
  tokenId: string;

  @Column({ type: 'bigint', transformer: new BigIntValueTransformer() })
  bridgeFee: bigint;

  @Column({ type: 'bigint', transformer: new BigIntValueTransformer() })
  networkFee: bigint;

  @Column({ type: 'text' })
  emissionTokenId: string;

  @Column({ type: 'bigint', transformer: new BigIntValueTransformer() })
  guardsEmission: bigint;

  @Column({ type: 'bigint', transformer: new BigIntValueTransformer() })
  watchersEmission: bigint;

  @Column({ type: 'int', nullable: true })
  rewardedWIDsCount: number | undefined;

  @Column({ type: 'varchar' })
  rewardedWIDs: string;

  @Column({ nullable: true, type: 'text' })
  spendBlock?: string | null;

  @Column({ nullable: true, type: 'int' })
  spendHeight?: number;

  @Column({ nullable: true, type: 'text' })
  spendTxId?: string | null;

  @Column({ type: 'varchar' })
  extractor: string;
}
