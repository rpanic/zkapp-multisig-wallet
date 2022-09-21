# Mina zkApp: MultiSig Wallet

This is an example zkapp implementing a multisig wallet, transfering a certain amount of MINA-token after a given threshold of signers has signed a proposal. 

Currently, only one concurrent proposal is supported, specifying a receiver and the amount of coins being sent.

There are two implementations:

### Local, sequential

`run.ts, multisig.ts`

This implementation implements the logic via the SmartContract and for every signer, a seperate transaction has to be submitted to the network. For every new transaction, one has to wait for the previous one to be included in a block.

### Proof merging, rollup mode

`run-rec.ts, multisig-recursive.ts`

Here I am implementing the same logic using the ZkProgram class, and extending it with proof-merging abilities. 
So one can sign the proposal with an arbitrary number of signers, and then submit it to chain all at once (or split into any number of parts for that matter).

#

Obviously, this is not production ready.

## How to build

```sh
npm run build
```

## How to run

### Local mode

```sh
node build/src/run.js
```

### Rollup mode

```sh
node build/src/run-rec.js
```

## How to run tests

```sh
npm run test
npm run testw # watch mode
```

## License

[Apache-2.0](LICENSE)
