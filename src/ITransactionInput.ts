export interface ITransactionInput {
  readonly path: string;
  readonly recipient: string;
  readonly salt: string;
  readonly dataHash?: string;
  readonly message?: string;
}
