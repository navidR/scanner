import { DataSource, In, Repository } from '@rosen-bridge/extended-typeorm';
import { AbstractLogger, DummyLogger } from '@rosen-bridge/abstract-logger';
import { chunk } from 'lodash-es';
import { Block } from '@rosen-bridge/scanner-interfaces';

import { RewardEntity } from '../entities/rewardEntity';
import { ExtractedReward } from '../interfaces/extractedReward';
import { dbIdChunkSize } from '../constants';

export class RewardAction {
  private readonly datasource: DataSource;
  private readonly logger: AbstractLogger;
  private readonly repository: Repository<RewardEntity>;

  constructor(dataSource: DataSource, logger?: AbstractLogger) {
    this.datasource = dataSource;
    this.logger = logger ? logger : new DummyLogger();
    this.repository = dataSource.getRepository(RewardEntity);
  }

  /**
   * Store a list of rewards in a specific block
   * @param rewards
   * @param spendBoxes
   * @param block
   * @param extractor
   */
  storeBlockRewards = async (
    rewards: Array<ExtractedReward>,
    block: Block,
    extractor: string,
  ) => {
    const txIds = rewards.map((item) => item.txId);
    const dbTxs = await this.repository.findBy({
      txId: In(txIds),
      extractor: extractor,
    });
    let success = true;
    const queryRunner = this.datasource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    const repository = await queryRunner.manager.getRepository(RewardEntity);
    try {
      for (const reward of rewards) {
        const entity = {
          txId: reward.txId,
          wid: reward.rewardedWIDs,
          rewardedWIDsCount: reward.rewardedWIDsCount,
          creationBlock: block.hash,
          creationHeight: block.height,
          creationTxId: reward.txId,
          serializedTransaction: reward.serializedTransaction,
          extractor: extractor,
          spendBlock: undefined,
          spendHeight: undefined,
          spendTxId: undefined,
        };
        const dbTx = dbTxs.filter((item) => item.txId === reward.txId);
        if (dbTx.length > 0) {
          this.logger.info(`Updating reward with txId [${reward.txId}]`);
          this.logger.debug(`Updated reward: [${JSON.stringify(entity)}]`);
          await repository.update({ txId: dbTx[0].txId }, entity);
        } else {
          this.logger.info(`Storing reward with txId: [${reward.txId}]`);
          this.logger.debug(`Inserted reward: [${JSON.stringify(entity)}]`);
          await repository.insert(entity);
        }
      }
      await queryRunner.commitTransaction();
    } catch (e) {
      this.logger.error(`An error occurred during storing reward boxes: ${e}`);
      await queryRunner.rollbackTransaction();
      success = false;
    } finally {
      await queryRunner.release();
    }
    return success;
  };

  /**
   * Insert a new reward into database
   * @param reward
   * @param extractor
   */
  insertReward = async (reward: ExtractedReward, extractor: string) => {
    return this.repository.insert({
      txId: reward.txId,
      triggertxId: reward.triggertxId,
      wid: reward.wid,
      rwtCount: reward.rwtCount,
      creationBlock: reward.blockId,
      creationHeight: reward.height,
      creationTxId: reward.txId,
      serialized: reward.serialized,
      extractor: extractor,
    });
  };

  /**
   * Update an unspent reward information in the database
   * @param reward
   * @param extractor
   */
  updateReward = async (reward: ExtractedReward, extractor: string) => {
    return this.repository.update(
      { txId: reward.txId, extractor: extractor },
      {
        triggertxId: reward.triggertxId,
        creationBlock: reward.blockId,
        creationHeight: reward.height,
        creationTxId: reward.txId,
        serialized: reward.serialized,
        wid: reward.wid,
        rwtCount: reward.rwtCount,
        spendBlock: null,
        spendHeight: 0,
      },
    );
  };

  /**
   * Update all rewards related to an specific invalid block
   * if box had been spent in the block mark it as unspent,
   * and if it was created within the block remove it from database
   * @param block
   * @param extractor
   */
  deleteBlock = async (block: string, extractor: string): Promise<void> => {
    this.logger.info(`Deleting rewards in block [${block}]`);
    const invalidRows = await this.repository.findBy({
      extractor: extractor,
      spendBlock: block,
    });
    if (invalidRows.length > 0) {
      await this.repository.delete({
        extractor: extractor,
        spendBlock: block,
      });
      for (const row of invalidRows) {
        this.logger.debug(
          `deleted invalid reward with txId [${row.txId}] at the forked block [${block}]`,
        );
      }
    }
    const updatingRows = await this.repository.findBy({
      extractor: extractor,
      spendBlock: block,
    });
    if (updatingRows.length > 0) {
      await this.repository.update(
        { spendBlock: block, extractor: extractor },
        { spendBlock: null, spendHeight: 0, spendTxId: null },
      );
      for (const row of updatingRows) {
        this.logger.debug(
          `removed spending information of the reward with txId [${row.txId}], spent at the forked block [${block}]`,
        );
      }
    }
  };

  /**
   * Return all stored reward box ids
   */
  getAllTxIds = async (extractor: string): Promise<Array<string>> => {
    const txIds = await this.repository.find({
      select: {
        txId: true,
      },
      where: {
        extractor: extractor,
      },
    });
    return txIds.map((item: { txId: string }) => item.txId);
  };

  /**
   * Remove an specified reward
   * @param txId
   * @param extractor
   */
  removeReward = async (txId: string, extractor: string) => {
    return await this.repository.delete({ txId: txId, extractor: extractor });
  };

  /**
   * Update the reward spending information
   * @param txId
   * @param extractor
   * @param blockId
   * @param blockHeight
   */
  updateSpendBlock = async (
    txId: string,
    extractor: string,
    blockId: string,
    blockHeight: number,
  ) => {
    return await this.repository.update(
      { txId: txId, extractor: extractor },
      { spendBlock: blockId, spendHeight: blockHeight },
    );
  };
}
