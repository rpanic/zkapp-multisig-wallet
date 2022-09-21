import {
    CircuitValue,
    Field,
    SmartContract,
    method,
    Bool,
    state,
    State,
    isReady,
    Poseidon,
    Permissions,
    Mina,
    PrivateKey,
    PublicKey,
    arrayProp,
    prop,
    Circuit,
    UInt64,
    AccountUpdate,
    SelfProof,
    Experimental,
    Proof
  } from 'snarkyjs';
  import * as fs from 'fs'
  
  export { deploy, sendTo, signProposal, fundNewAccount, getZkAppState, createLocalBlockchain, createBerkeley, init };
  
  await isReady;

  export class SignerList extends CircuitValue {
    @arrayProp(PublicKey, 4) signers: PublicKey[]

    constructor(signers: PublicKey[]){
        super()
        this.signers = signers;
    }

    // plus(s: PublicKey) : SignerList {
    //     return new SignerList(this.signers. + s)
    // }

    hash() {
        return Poseidon.hash(this.signers.map(x => x.toFields()).flat())
    }

  }

  export class ProposalState extends CircuitValue {

    @arrayProp(Field, 3) proposalState : Field[]

    constructor(proposalState: Field[]){
        super()
        this.proposalState = proposalState;
    }

    hash() {
        return Poseidon.hash(this.proposalState)
    }

  }

  export class Proposal extends CircuitValue {
    @prop receiver : PublicKey
    @prop amount : Field

    hash() {
        return Poseidon.hash([...this.receiver.toFields(), this.amount])
    }
  }

  export class MultiSigState extends CircuitValue{

    @prop signerHash: Field;
    @prop proposalsHash: Field;
    @prop startProposalsHash: Field;

    constructor(
        signerHash: Field,
        proposalsHash: Field,
        startProposalsHash: Field,
    ){
        super()
        this.signerHash = signerHash;
        this.proposalsHash = proposalsHash;
        this.startProposalsHash = startProposalsHash;
    }

  }

  export { MultiSigZkProgram };

  let MultiSigZkProgram = Experimental.ZkProgram({

    publicInput: MultiSigState,

    methods: {
        // @method init(signerList: SignerList, numSigners: Field, threshold: Field)
        init: {
            privateInputs: [SignerList, Field],
            method(
                publicInput: MultiSigState,
                signerList: SignerList,
                startProposalHash: Field
            ){
                publicInput.signerHash.assertEquals(signerList.hash());
                publicInput.startProposalsHash.assertEquals(startProposalHash)
                publicInput.proposalsHash.assertEquals(startProposalHash)
            }
        },

        approve: {
            privateInputs: [Proposal, PrivateKey, SignerList, ProposalState, Bool, SelfProof],
            method(
                publicInput: MultiSigState,
                proposal: Proposal, pk: PrivateKey, signerList: SignerList, proposalState: ProposalState, vote: Bool,
                previousProof: SelfProof<MultiSigState>
            ){
                previousProof.verify()

                previousProof.publicInput.signerHash.assertEquals(signerList.hash())

                previousProof.publicInput.proposalsHash.assertEquals(proposalState.hash())

                let proposalHash = proposal.hash()

                let pub = pk.toPublicKey()
                let canVote = Bool(true)
                for(let i = 0 ; i < 3 ; i++){
                    canVote = canVote.or(signerList.signers[i].equals(pub))
                }
                canVote.assertEquals(true)

                proposalState.proposalState[0].assertEquals(proposalHash);
                proposalState.proposalState[1] = proposalState.proposalState[1].add(
                    Circuit.if(vote, Field.one, Field.zero)
                )

                proposalState.proposalState[2] = proposalState.proposalState[2].add(
                    Circuit.if(vote, Field.zero, Field.one)
                )

                publicInput.proposalsHash.assertEquals(proposalState.hash())
            }
        }
    }

  })

  export class MultiSigProof extends Proof<MultiSigState> {
    static publicInputType = MultiSigState;
    static tag = () => MultiSigZkApp;
  }
  
  export class MultiSigZkApp extends SmartContract {

    @state(Field) signerHash = State<Field>();
    @state(Field) proposalsHash = State<Field>();
    @state(Field) numSigners = State<Field>();
    @state(Field) signerThreshold = State<Field>();

    @method init(signerList: SignerList, numSigners: Field, threshold: Field) {
        this.signerHash.set(signerList.hash());
        this.signerThreshold.set(threshold);
        this.numSigners.set(numSigners)
      }

    @method approveWithProof(proof: MultiSigProof, proposal: Proposal, proposalState: ProposalState){

      this.signerThreshold.assertEquals(this.signerThreshold.get());
      this.numSigners.assertEquals(this.numSigners.get());
      this.signerHash.assertEquals(this.signerHash.get());
      this.proposalsHash.assertEquals(this.proposalsHash.get());

      this.proposalsHash.get().assertEquals(
        Circuit.if(
          this.proposalsHash.get().equals(Field.zero),
          Field.zero,
          proof.publicInput.startProposalsHash
        )
      )

      proof.verify()

      proof.publicInput.proposalsHash.assertEquals(proposalState.hash())

      proof.publicInput.signerHash.assertEquals(this.signerHash.get())

      let votesFor = proposalState.proposalState[1]
      let votesAgainst = proposalState.proposalState[2]
      let votesReached = votesFor.gte(this.signerThreshold.get())

      let amount = UInt64.from(
          Circuit.if(votesReached, proposal.amount, Field.zero)
      )

      this.self.send({to: proposal.receiver, amount})

      let newProposalsHash = Circuit.if(
          votesReached.or(
              votesAgainst.gte(this.numSigners.get().sub(this.signerThreshold.get()))
          ), 
          Field.zero, 
          proposalState.hash())

      // console.log(votesFor.toString())
      // console.log(votesAgainst.toString())
      // console.log(votesReached.toString())
      // console.log(newProposalsHash.toString())
      // console.log("-")
      // console.log(amount.toString())

      this.proposalsHash.set(newProposalsHash)

    }

    @method approve(proposal: Proposal, pk: PrivateKey, signerList: SignerList, proposalState: ProposalState, vote: Bool) {
      
      this.proposalsHash.assertEquals(this.proposalsHash.get());
      this.signerThreshold.assertEquals(this.signerThreshold.get());
      this.numSigners.assertEquals(this.numSigners.get());

      this.signerHash.assertEquals(signerList.hash())

      this.proposalsHash.get().assertEquals(Circuit.if(this.proposalsHash.get().equals(Field.zero), Field.zero, proposalState.hash()))

      let proposalHash = proposal.hash()

      let pub = pk.toPublicKey()
      let canVote = Bool(true)
      for(let i = 0 ; i < 5 ; i++){
          canVote = canVote.or(signerList.signers[0].equals(pub))
      }
      canVote.assertEquals(true)

      proposalState.proposalState[0].assertEquals(proposalHash);
      proposalState.proposalState[1] = proposalState.proposalState[1].add(
        Circuit.if(vote, Field.one, Field.zero)
      )

      proposalState.proposalState[2] = proposalState.proposalState[2].add(
        Circuit.if(vote, Field.zero, Field.one)
      )

      let votesFor = proposalState.proposalState[1]
      let votesAgainst = proposalState.proposalState[2]
      let votesReached = votesFor.gte(this.signerThreshold.get())

      let amount = UInt64.from(
        Circuit.if(votesReached, proposal.amount, Field.zero)
      )

      this.self.send({to: proposal.receiver, amount})

      let newProposalsHash = Circuit.if(
        votesReached.or(
          votesAgainst.gte(this.numSigners.get().sub(this.signerThreshold.get()))
        ), 
        Field.zero, 
        proposalState.hash())

      this.proposalsHash.set(newProposalsHash)

    }
  
  }
  
  // helpers
  function createLocalBlockchain(): PrivateKey {
    let Local = Mina.LocalBlockchain();
    Mina.setActiveInstance(Local);
  
    const account = Local.testAccounts[0].privateKey;
    return account;
  }

  function createBerkeley() : PrivateKey {
    let berkeley = Mina.BerkeleyQANet("https://proxy.berkeley.minaexplorer.com/graphql")

    Mina.setActiveInstance(berkeley)

    let data = JSON.parse(fs.readFileSync("keys/wallet.json", {encoding: 'utf-8'}));
    let pk = PrivateKey.fromBase58(data["privateKey"])!!
    return pk

  }
  
  async function deploy(
    zkAppInstance: MultiSigZkApp,
    zkAppPrivateKey: PrivateKey,
    signers: PublicKey[],
    account: PrivateKey,
    verificationKey: {
      data: string;
      hash: Field | string;
    } | undefined = undefined
  ) {
    let tx = await Mina.transaction(account, () => {
      AccountUpdate.fundNewAccount(account);
  
      let signerList = new SignerList(signers);
      zkAppInstance.deploy({ verificationKey, zkappKey: zkAppPrivateKey });
      zkAppInstance.setPermissions({
        ...Permissions.default(),
        editState: Permissions.proofOrSignature(),
        send: Permissions.proofOrSignature()
      });

      // zkAppInstance.self.body.preconditions.account.nonce.isSome = Bool(false);
      // // don't increment the nonce
      // zkAppInstance.self.body.incrementNonce = Bool(false);
      // // use full commitment (means with include the fee payer in the signature, so we're protected against replays)
      // zkAppInstance.self.body.useFullCommitment = Bool(true);
  
      console.log("Init with k = ", Math.ceil(signers.length / 2));

      zkAppInstance.init(signerList, Field.fromNumber(signers.length), Field.fromNumber(Math.ceil(signers.length / 2)));
      zkAppInstance.sign(zkAppPrivateKey)
    });
    // await tx.sign()
    await tx.send().wait();
  }

  async function init(
    account: PrivateKey,
    zkAppInstance: MultiSigZkApp,
    zkAppPrivateKey: PrivateKey,
    signers: PublicKey[],
  ){
    let tx = await Mina.transaction({feePayerKey: account, fee: 100000000}, () => {
      zkAppInstance.init(new SignerList(signers), Field.fromNumber(Math.ceil(signers.length / 2)), Field.fromNumber(signers.length));
    })
    await tx.prove()
    await tx.send().wait()
  }

  async function sendTo(
    sender: PrivateKey,
    receiver: PublicKey
  ){
    let tx = await Mina.transaction(sender, () => {

      AccountUpdate.createSigned(sender).send({ to: receiver, amount: UInt64.fromNumber(1000) })

    })
    await tx.send().wait();
  }

  async function fundNewAccount(
    payer: PrivateKey,
    account: PublicKey
  ){
    let tx = await Mina.transaction(payer, () => {
      AccountUpdate.createSigned(payer).send({to: account, amount: UInt64.fromNumber(1)})
      AccountUpdate.fundNewAccount(payer)
    })
    await tx.send().wait();
  }

  export async function signWithProof(
    proof: MultiSigProof,
    proposal: Proposal,
    proposalState: ProposalState,
    account: PrivateKey,
    zkAppPrivateKey: PrivateKey,
    zkAppAddress: PublicKey,
  ){

    let tx = await Mina.transaction(account, () => {
      let zkApp = new MultiSigZkApp(zkAppAddress);

      zkApp.approveWithProof(proof, proposal, proposalState)

      zkApp.sign(zkAppPrivateKey);
    });
    try {
      // await tx.prove()
      await tx.send().wait();
      return true;
    } catch (err) {
      console.log(err)
      return false;
    }
  }

  async function signProposal(
    proposal: Proposal,
    votes: [number, number],
    vote: boolean,
    pk: PrivateKey,
    signers: PublicKey[],
    account: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey
  ){

    let signerList = new SignerList(signers);

    let tx = await Mina.transaction(account, () => {
      let zkApp = new MultiSigZkApp(zkAppAddress);

      zkApp.approve(proposal, pk, signerList, new ProposalState([proposal.hash(), Field(votes[0]), Field(votes[1])]), Bool(vote))

      zkApp.sign(zkAppPrivateKey);
    });
    try {
      // await tx.prove()
      await tx.send().wait();
      return true;
    } catch (err) {
      console.log(err)
      return false;
    }
  }

  export async function signProposalBatch(
    proposal: Proposal,
    votes: [number, number][],
    vote: boolean[],
    pk: PrivateKey[],
    signers: PublicKey[],
    account: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey
  ){

    let signerList = new SignerList(signers);

    let tx = await Mina.transaction(account, () => {
      let zkApp = new MultiSigZkApp(zkAppAddress);

      for(let i = 0; i < votes.length ; i++){
        zkApp.approve(proposal, pk[i], signerList, new ProposalState([proposal.hash(), Field(votes[i][0]), Field(votes[i][1])]), Bool(vote[i]))
      }

      zkApp.sign(zkAppPrivateKey);
    });
    try {
      // await tx.prove()
      await tx.send().wait();
      return true;
    } catch (err) {
      console.log(err)
      return false;
    }
  }
  
  function getZkAppState(zkAppInstance: MultiSigZkApp) {
    let balance = zkAppInstance.account.balance.get().toConstant();
    let proposal = zkAppInstance.proposalsHash.get().toConstant();
    return { balance, proposal };
  }
  
  function divmod(k: number, n: number) {
    let q = Math.floor(k / n);
    return [q, k - q * n];
  }
  
  function fieldToHex(field: Field) {
    return BigInt(field.toString()).toString(16);
  }