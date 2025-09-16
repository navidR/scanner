import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1757994060468 implements MigrationInterface {
    name = 'Migration1757994060468'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "reward_entity" (
                "txId" character varying NOT NULL,
                "serializedTransaction" text NOT NULL,
                "timestamp" character varying NOT NULL,
                "tokenId" character varying NOT NULL,
                "bridgeFee" bigint NOT NULL,
                "networkFee" bigint NOT NULL,
                "emissionTokenId" text NOT NULL,
                "guardsEmission" bigint NOT NULL,
                "watchersEmission" bigint NOT NULL,
                "rewardedWIDsCount" integer NOT NULL,
                "rewardedWIDs" character varying NOT NULL,
                "spendBlock" text,
                "spendHeight" integer,
                "spendTxId" text,
                "extractor" character varying NOT NULL,
                CONSTRAINT "PK_fc9e93e1f49934a8549a09cf0a1" PRIMARY KEY ("txId")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TABLE "reward_entity"
        `);
    }

}
