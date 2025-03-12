import { ITransactionInput } from './ITransactionInput.js';

interface ITransaction {
  readonly tokenId: string;
  readonly sourceState: Uint8Array;
  readonly input: ITransactionInput;
  readonly recipient: string;
}
