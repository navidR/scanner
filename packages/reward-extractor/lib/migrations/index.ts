import { Migration1757994052340 } from "./sqlite/1757994052340-migration";
import { Migration1757994060468 } from "./postgres/1757994060468-migration";

export const migrations = {
  sqlite: [
    Migration1757994052340
  ],
  postgres: [
    Migration1757994060468
  ],
};
