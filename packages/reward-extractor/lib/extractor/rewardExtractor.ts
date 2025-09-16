import { DataSource } from '@rosen-bridge/extended-typeorm';
import * as wasm from 'ergo-lib-wasm-nodejs';
import { Buffer } from 'buffer';
import { difference } from 'lodash-es';
import { AbstractLogger, DummyLogger } from '@rosen-bridge/abstract-logger';
import ergoExplorerClientFactory from '@rosen-clients/ergo-explorer';
import { V1 } from '@rosen-clients/ergo-explorer';
import JsonBI from '@rosen-bridge/json-bigint';
import {
  Block,
  BlockInfo,
  Transaction,
} from '@rosen-bridge/scanner-interfaces';
import { AbstractExtractor } from '@rosen-bridge/abstract-extractor';

import { RewardAction } from '../actions/rewardAction';
import { DefaultApiLimit } from '../constants';
import { ExtractedReward } from '../interfaces/extractedReward';

export class RewardExtractor implements AbstractExtractor<Transaction> {
  private readonly logger: AbstractLogger;
  private readonly actions: RewardAction;
  private readonly id: string;
  private readonly ergoTree: string;
  readonly api;

  constructor(
    dataSource: DataSource,
    id: string,
    explorerUrl: string,
    rewardAddress: string,
    logger?: AbstractLogger,
  ) {
    this.id = id;
    this.ergoTree = wasm.Address.from_base58(rewardAddress)
      .to_ergo_tree()
      .to_base16_bytes();
    this.logger = logger ? logger : new DummyLogger();
    this.actions = new RewardAction(dataSource, this.logger);
    this.api = ergoExplorerClientFactory(explorerUrl);
  }

  /**
   * get Id for current extractor
   */
  getId = () => `${this.id}`;

  /**
   * Extract reward boxes in the specified block transactions
   * @param txs
   * @param block
   */
  processTransactions = (
    txs: Array<Transaction>,
    block: Block,
  ): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      try {
        const newRewards: Array<ExtractedReward> = [];
        const txSpendIds: string[] = [];
        txs.forEach((transaction) => {
          const widList: string[] = [];
          for (const output of transaction.outputs) {
            if (output.ergoTree !== this.ergoTree || !output.assets)
              continue;
            const boxOutput = wasm.ErgoBox.from_json(JsonBI.stringify(output));
            const r4 = boxOutput
              .register_value(wasm.NonMandatoryRegisterId.R4)
              ?.to_coll_coll_byte();
            if (!r4) {
              this.logger.debug(
                `A new reward box found without correct wid format at height ${block.height}`,
              );
              continue;
            }
            widList.push(Buffer.from(r4[0]).toString('hex'));
          };
          const newReward = {
            txId: transaction.id,
            serializedTransaction: Buffer.from(
              wasm.ErgoBox.from_json(
                JsonBI.stringify(transaction),
              ).sigma_serialize_bytes(),
            ).toString('base64'),
            timestamp: block.timestamp.toString(),
            tokenId: transaction.outputs[0].assets[0].tokenId,
            bridgeFee: 0n,
            networkFee: 0n,
            emissionTokenId: '',
            guardsEmission: 0n,
            watchersEmission: 0n,
            rewardedWIDsCount: null,
            rewardedWIDs: widList.join(', '),
            extractor: this.getId()
          };
          newRewards.push(newReward);
          this.logger.debug(
            `new reward found [${newReward}] at height ${block.height}`,
          );
          txSpendIds.push(transaction.id);
        });
        this.actions.storeBlockRewards(newRewards, block, this.getId())
          .catch((e) => {
            this.logger.error(
              `An error occurred in processing rewards in block [${block.hash}]: ${e}`,
            );
            reject(e);
          });
      } catch (e) {
        reject(e);
      }
    });
  };

  /**
   * fork one block and remove all stored information for this block
   * @param hash: block hash
   */
  forkBlock = async (hash: string): Promise<void> => {
    await this.actions.deleteBlock(hash, this.getId());
  };

  /**
   * Initializes the database with older rewards
   */
  initializeBoxes = async (initialBlock: BlockInfo) => {
    this.logger.debug(
      `Initializing reward table. storing reward txs created bellow height ${initialBlock.height}.`,
    );
    const unspentTxIds = await this.getUnspentRewards(initialBlock.height);
    this.logger.debug(`Unspent reward txIds ${unspentTxIds}`);

    // Storing extracted boxes
    let allStoredTxIds = await this.actions.getAllTxIds(this.getId());
    for (const reward of unspentTxIds) {
      if (allStoredTxIds.includes(reward.txId)) {
        await this.actions.updateReward(reward, this.getId());
        this.logger.info(
          `Updated the existing unspent reward with txId, [${reward.txId}]`,
        );
        this.logger.debug(`Updated reward: [${JSON.stringify(reward)}]`);
      } else {
        await this.actions.insertReward(reward, this.getId());
        this.logger.info(
          `Inserted new unspent reward with txId, [${reward.txId}]`,
        );
        this.logger.debug(`Inserted reward: [${JSON.stringify(reward)}]`);
      }
    }

    // Remove updated box ids from existing boxes in database
    allStoredTxIds = difference(allStoredTxIds, unspentTxIds);
    // Validating remained boxes
    this.logger.debug(
      `Validating and updating stored reward boxes with txIds ${allStoredTxIds}`,
    );
    await this.validateOldStoredRewards(allStoredTxIds, initialBlock.height);
  };

  /**
   * Validate all remaining boxes in the database
   * update the correct ones and remove the invalid ones
   * @param unchangedStoredTxIds
   * @param initialHeight
   */
  validateOldStoredRewards = async (
    unchangedStoredTxIds: Array<string>,
    initialHeight: number,
  ) => {
    for (const txId of unchangedStoredTxIds) {
      const box = await this.getRewardInfoWithTxId(txId);
      if (box && box.spendBlock && box.spendHeight) {
        if (box.spendHeight < initialHeight) {
          this.logger.debug(
            `updating spending information of reward with txId [${box.txId}] spent at height [${box.spendHeight}]`,
          );
          await this.actions.updateSpendBlock(
            txId,
            this.getId(),
            box.spendBlock,
            box.spendHeight,
          );
        } else {
          this.logger.debug(
            `reward with txId [${box.txId}] has been spent after the initialization height, updating spending information skipped.`,
          );
        }
      } else {
        await this.actions.removeReward(txId, this.getId());
        this.logger.info(
          `Removed invalid reward [${txId}] in initialization validation`,
        );
      }
    }
  };

  /**
   * Return extracted information of a reward with its txId
   * @param txId
   */
  getRewardInfoWithTxId = async (
    txId: string,
  ): Promise<ExtractedReward | undefined> => {
    try {
      const box = await this.api.v1.getApiV1BoxesP1(txId);
      return (await this.extractBoxData([box]))[0];
    } catch {
      this.logger.warn(`Box with id [${txId}] does not exists`);
      return undefined;
    }
  };

  /**
   * Returns block information of tx
   * @param txId
   */
  getTxBlock = async (txId: string) => {
    const tx = await this.api.v1.getApiV1TransactionsP1(txId);
    return {
      id: tx.blockId,
      height: tx.inclusionHeight,
    };
  };
}
