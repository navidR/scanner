import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1757994052340 implements MigrationInterface {
    name = 'Migration1757994052340'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "reward_entity" (
                "txId" varchar PRIMARY KEY NOT NULL,
                "serializedTransaction" text NOT NULL,
                "timestamp" varchar NOT NULL,
                "tokenId" varchar NOT NULL,
                "bridgeFee" bigint NOT NULL,
                "networkFee" bigint NOT NULL,
                "emissionTokenId" text NOT NULL,
                "guardsEmission" bigint NOT NULL,
                "watchersEmission" bigint NOT NULL,
                "rewardedWIDsCount" integer NOT NULL,
                "rewardedWIDs" varchar NOT NULL,
                "spendBlock" text,
                "spendHeight" integer,
                "spendTxId" text,
                "extractor" varchar NOT NULL
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TABLE "reward_entity"
        `);
    }

}
