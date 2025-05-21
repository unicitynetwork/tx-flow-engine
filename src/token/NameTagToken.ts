import { NameTagTokenData } from './NameTagTokenData.js';
import { Token } from './Token.js';
import { ISerializable } from '../ISerializable.js';
import { MintTransactionData } from '../transaction/MintTransactionData.js';

export type NameTagToken = Token<NameTagTokenData, MintTransactionData<ISerializable>>;
