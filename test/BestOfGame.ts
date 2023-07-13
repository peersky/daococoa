import {
  AdrSetupResult,
  BOG_MAX_PLAYERS,
  BOG_MIN_PLAYERS,
  EnvSetupResult,
  getTurnSalt,
  mockVote,
  MockVotes,
  ProposalSubmittion,
  setupTest,
  SignerIdentity,
  signProposalMessage,
} from "./utils";
import {
  setupAddresses,
  setupEnvironment,
  BOGSettings,
  mineBlocks,
  mockProposals,
  mockVotes,
  getPlayers,
} from "./utils";
import { expect } from "chai";
import {
  BestOfDiamond,
  IBestOf,
  LibCoinVending,
} from "../types/typechain/hardhat-diamond-abi/HardhatDiamondABI.sol/BestOfDiamond";
import { contract, ethers } from "hardhat";
const path = require("path");
// import { TokenMust, TokenTypes } from "../types/enums";
import { BigNumber, BigNumberish } from "ethers";
import { assert } from "console";
const scriptName = path.basename(__filename);
import hre from "hardhat";
import { solidityKeccak256 } from "ethers/lib/utils";

let votes: MockVotes;
let proposalsStruct: ProposalSubmittion[];
let adr: AdrSetupResult;
let votersAddresses: string[];
let env: EnvSetupResult;

const createGame = async (
  gameContract: BestOfDiamond,
  signer: SignerIdentity,
  gameMaster: string,
  gameRank: BigNumberish,
  openNow?: boolean
) => {
  await gameContract
    .connect(signer.wallet)
    ["createGame(address,uint256)"](gameMaster, gameRank, {
      value: BOGSettings.BOG_GAME_PRICE,
    });
  const gameId = await gameContract
    .getContractState()
    .then(
      (state: IBestOf.ContractStateStructOutput) => state.BestOfState.numGames
    );
  if (openNow)
    await gameContract.connect(signer.wallet).openRegistration(gameId);
  return gameId;
};
const runToTheEnd = async (
  gameId: BigNumberish,
  gameContract: BestOfDiamond,
  gameMaster: SignerIdentity,
  players: [SignerIdentity, SignerIdentity, ...SignerIdentity[]],
  distribution?: "ftw" | "semiUniform" | "equal"
) => {
  // console.log("running to the end");
  // const initialTurn = await env.bestOfGame.getTurn(gameId);
  let isGameOver = await env.bestOfGame.isGameOver(gameId);
  while (!isGameOver) {
    const isLastTurn = await env.bestOfGame.isLastTurn(gameId);
    const turn = await env.bestOfGame.getTurn(gameId).then((r) => r.toNumber());
    if (turn !== 1) {
      votes = await mockValidVotes(
        players,
        gameContract,
        gameId,
        gameMaster,
        true,
        distribution ?? "ftw"
      );
    }
    if (!isLastTurn) {
    }
    const proposals = await mockValidProposals(
      players,
      gameContract,
      gameMaster,
      gameId,
      true
    );
    await gameContract.connect(gameMaster.wallet).endTurn(
      gameId,
      getTurnSalt({ gameId: gameId, turn: turn }),
      turn == 1 ? [] : votersAddresses,
      turn == 1 ? [] : votes?.map((vote) => vote.vote),
      proposals.map((prop) => prop.proposal),
      proposalsStruct.map((p) => p.proposer.wallet.address)
    );
    isGameOver = await env.bestOfGame.isGameOver(gameId);
  }
};
const runToLastTurn = async (
  gameId: BigNumberish,
  gameContract: BestOfDiamond,
  gameMaster: SignerIdentity,
  players: [SignerIdentity, SignerIdentity, ...SignerIdentity[]],
  distribution?: "ftw" | "semiUniform" | "equal"
): Promise<void> => {
  const initialTurn = await env.bestOfGame.getTurn(gameId);
  // console.log("running to last turn, initial: ", initialTurn.toString());
  for (
    let turn = initialTurn.toNumber();
    turn < BOGSettings.BOG_MAX_TURNS;
    turn++
  ) {
    if (turn !== 1) {
      votes = await mockValidVotes(
        players,
        gameContract,
        gameId,
        gameMaster,
        true,
        distribution ?? "ftw"
      );
    }

    const proposals = await mockValidProposals(
      players,
      gameContract,
      gameMaster,
      gameId,
      true
    );
    await gameContract.connect(gameMaster.wallet).endTurn(
      gameId,
      getTurnSalt({ gameId: gameId, turn: turn }),
      turn == 1 ? [] : votersAddresses,
      turn == 1 ? [] : votes?.map((vote) => vote.vote),
      proposals.map((prop) => prop.proposal),
      proposalsStruct.map((p) => p.proposer.wallet.address)
    );
  }
  const isLastTurn = await gameContract.isLastTurn(gameId);
  assert(isLastTurn, "should be last turn");
};

const endTurn = async (gameId: BigNumberish, gameContract: BestOfDiamond) => {
  const turn = await gameContract.getTurn(gameId);
  await gameContract.connect(adr.gameMaster1.wallet).endTurn(
    gameId,
    getTurnSalt({
      gameId: gameId,
      turn: turn,
    }),
    votersAddresses,
    votes.map((vote) => vote.vote),
    proposalsStruct.map((prop) => prop.proposal),
    proposalsStruct.map((p) => p.proposer.wallet.address)
  );
};

const runToOvertime = async (
  gameId: BigNumberish,
  gameContract: BestOfDiamond,
  gameMaster: SignerIdentity,
  players: [SignerIdentity, SignerIdentity, ...SignerIdentity[]]
) => {
  await runToLastTurn(gameId, gameContract, gameMaster, players, "equal");

  await mockValidVotes(
    players,
    gameContract,
    gameId,
    gameMaster,
    true,
    "equal"
  );
  const proposals = await mockValidProposals(
    players,
    gameContract,
    gameMaster,
    gameId,
    true
  );
  const turn = await gameContract.getTurn(gameId);
  await gameContract.connect(gameMaster.wallet).endTurn(
    gameId,
    getTurnSalt({
      gameId: gameId,
      turn: turn,
    }),
    votersAddresses,
    votes.map((vote) => vote.vote),
    proposals.map((prop) => prop.proposal),
    proposalsStruct.map((p) => p.proposer.wallet.address)
  );
};

// const runToTheEnd = async (
//   gameId: BigNumberish,
//   gameContract: BestOfDiamond,
//   gameMaster: SignerIdentity,
//   players: [SignerIdentity, SignerIdentity, ...SignerIdentity[]]
// ) => {

// await runToLastTurn(gameId, gameContract, gameMaster, players);

// await mockValidVotes(players, gameContract, gameId, gameMaster, true, "ftw");
// let turn = await gameContract.getTurn(gameId);
// console.log("attempt to finish last turn", turn.toString());
// await gameContract.connect(gameMaster.wallet).endTurn(
//   gameId,
//   getTurnSalt({
//     gameId: gameId,
//     turn: turn,
//   }),
//   votersAddresses,
//   votes.map((vote) => vote.vote)
// );
// turn = await gameContract.getTurn(gameId);
// const isOvertime = await env.bestOfGame.isOvertime(gameId);
// const isGameOver = await env.bestOfGame.isGameOver(gameId);
// while (!isGameOver) {
//   console.log("running isGameOver", isGameOver, isOvertime, turn.toString());
//   assert(isOvertime, "should be ovetime, now?");
//   await mockValidVotes(
//     players,
//     gameContract,
//     gameId,
//     gameMaster,
//     true,
//     "ftw"
//   );
//   await mockValidProposals(players, gameContract, gameMaster, gameId, true);
//   await gameContract.connect(gameMaster.wallet).endTurn(
//     gameId,
//     getTurnSalt({
//       gameId: gameId,
//       turn: turn,
//     }),
//     votersAddresses,
//     votes.map((vote) => vote.vote)
//   );
// }
// console.log("runToTheEnd", turn);
// };

const mockValidVotes = async (
  players: [SignerIdentity, SignerIdentity, ...SignerIdentity[]],
  gameContract: BestOfDiamond,
  gameId: BigNumberish,
  gameMaster: SignerIdentity,
  submitNow?: boolean,
  distribution?: "ftw" | "semiUniform" | "equal"
) => {
  const turn = await gameContract.getTurn(gameId);
  votes = await mockVotes({
    gameId: gameId,
    turn: turn,
    verifierAddress: gameContract.address,
    players: players,
    gm: gameMaster,
    proposals: proposalsStruct.map((item) => item.proposal),
    distribution: distribution ?? "semiUniform",
  });
  if (submitNow) {
    votersAddresses = players.map((player) => player.wallet.address);
    for (let i = 0; i < players.length; i++) {
      await env.bestOfGame
        .connect(players[i].wallet)
        .submitVote(
          gameId,
          votes[i].voteHidden,
          votes[i].proof,
          votes[i].publicSignature
        );
    }
  }
  return votes;
};

const startGame = async (
  gameId: BigNumberish
  // players: [SignerIdentity, SignerIdentity, ...SignerIdentity[]]
) => {
  await mineBlocks(BOGSettings.BOG_BLOCKS_TO_JOIN + 1);
  await env.bestOfGame.connect(adr.gameMaster1.wallet).startGame(gameId);
  // proposalsStruct = await mockProposals({
  //   players: players,
  //   gameId: 1,
  //   turn: 1,
  //   verifierAddress: env.bestOfGame.address,
  // });
};

const mockValidProposals = async (
  players: [SignerIdentity, SignerIdentity, ...SignerIdentity[]],
  gameContract: BestOfDiamond,
  gameMaster: SignerIdentity,
  gameId: BigNumberish,
  submitNow?: boolean
) => {
  const turn = await gameContract.getTurn(gameId);

  // getPlayers(adr, BOGSettings.BOG_MAX_PLAYERS)
  proposalsStruct = await mockProposals({
    players: players,
    gameId: gameId,
    turn: turn,
    verifierAddress: gameContract.address,
    gm: gameMaster,
  });
  if (submitNow) {
    for (let i = 0; i < players.length; i++) {
      await gameContract
        .connect(players[i].wallet)
        .submitProposal(
          gameId,
          proposalsStruct[i].gmSignature,
          proposalsStruct[i].proposalEncryptedByGM,
          proposalsStruct[i].proposalHash
        );
    }
  }
  return proposalsStruct;
};

const fillParty = async (
  players: [SignerIdentity, SignerIdentity, ...SignerIdentity[]],
  gameContract: BestOfDiamond,
  gameId: BigNumberish,
  mineJoinBlocks: boolean,
  startGame?: boolean,
  gameMaster?: SignerIdentity
) => {
  const valueToJoin = BOGSettings.BOG_JOIN_GAME_PRICE.add(
    ethers.utils.parseEther("0.4")
  );
  for (let i = 0; i < players.length; i++) {
    // let name = `player${i}` as any as keyof AdrSetupResult;
    if (!env.rankToken.address)
      throw new Error("Rank token undefined or undeployed");
    await env.rankToken
      .connect(players[i].wallet)
      .setApprovalForAll(env.bestOfGame.address, true);
    await gameContract
      .connect(players[i].wallet)
      .joinGame(gameId, { value: valueToJoin });
  }
  if (mineJoinBlocks) await mineBlocks(BOGSettings.BOG_BLOCKS_TO_JOIN + 1);
  if (startGame && gameMaster) {
    await env.bestOfGame.connect(gameMaster.wallet).startGame(gameId);
  }
};

describe(scriptName, () => {
  const requirement: LibCoinVending.ConfigPositionStruct = {
    ethValues: {
      have: ethers.utils.parseEther("0.1"),
      burn: ethers.utils.parseEther("0.1"),
      pay: ethers.utils.parseEther("0.1"),
      bet: ethers.utils.parseEther("0.1"),
      lock: ethers.utils.parseEther("0.1"),
    },
    contracts: [],
  };
  beforeEach(async () => {
    const setup = await setupTest();
    adr = setup.adr;
    env = setup.env;
    requirement.contracts.push({
      contractAddress: env.mockERC20.address,
      contractId: "0",
      contractType: "0",
      contractRequirement: {
        lock: { amount: ethers.utils.parseEther("0.1"), data: "0x" },
        pay: { amount: ethers.utils.parseEther("0.1"), data: "0x" },
        bet: { amount: ethers.utils.parseEther("0.1"), data: "0x" },
        burn: { amount: ethers.utils.parseEther("0.1"), data: "0x" },
        have: { amount: ethers.utils.parseEther("0.1"), data: "0x" },
      },
    });
    requirement.contracts.push({
      contractAddress: env.mockERC1155.address,
      contractId: "1",
      contractType: "1",
      contractRequirement: {
        lock: { amount: ethers.utils.parseEther("0.1"), data: "0x" },
        pay: { amount: ethers.utils.parseEther("0.1"), data: "0x" },
        bet: { amount: ethers.utils.parseEther("0.1"), data: "0x" },
        burn: { amount: ethers.utils.parseEther("0.1"), data: "0x" },
        have: { amount: ethers.utils.parseEther("0.1"), data: "0x" },
      },
    });

    requirement.contracts.push({
      contractAddress: env.mockERC721.address,
      contractId: "1",
      contractType: "2",
      contractRequirement: {
        lock: { amount: ethers.utils.parseEther("0"), data: "0x" },
        pay: { amount: ethers.utils.parseEther("0"), data: "0x" },
        bet: { amount: ethers.utils.parseEther("0"), data: "0x" },
        burn: { amount: ethers.utils.parseEther("0"), data: "0x" },
        have: { amount: "1", data: "0x" },
      },
    });
  });
  it("Is Owned by contract owner", async () => {
    expect(await env.bestOfGame.owner()).to.be.equal(
      adr.gameOwner.wallet.address
    );
  });
  it("Has correct initial settings", async () => {
    const state = await env.bestOfGame
      .connect(adr.gameCreator1.wallet)
      .getContractState();
    expect(state.BestOfState.gamePrice).to.be.equal(BOGSettings.BOG_GAME_PRICE);
    expect(state.BestOfState.joinGamePrice).to.be.equal(
      BOGSettings.BOG_JOIN_GAME_PRICE
    );
    expect(state.BestOfState.numGames).to.be.equal(0);
    expect(state.BestOfState.rankTokenAddress).to.be.equal(
      env.rankToken.address
    );
    expect(state.TBGSEttings.maxTurns).to.be.equal(BOGSettings.BOG_MAX_TURNS);
    expect(state.TBGSEttings.blocksPerTurn).to.be.equal(
      BOGSettings.BOG_BLOCKS_PER_TURN
    );
    expect(state.TBGSEttings.minPlayersSize).to.be.equal(
      BOGSettings.BOG_MIN_PLAYERS
    );
    expect(state.TBGSEttings.blocksToJoin).to.be.equal(
      BOGSettings.BOG_BLOCKS_TO_JOIN
    );
    expect(state.TBGSEttings.maxTurns).to.be.equal(BOGSettings.BOG_MAX_TURNS);
  });
  it("Transfer ownership can be done only by contract owner", async () => {
    await expect(
      env.bestOfGame
        .connect(adr.gameOwner.wallet)
        .transferOwnership(adr.gameCreator1.wallet.address)
    ).to.emit(env.bestOfGame, "OwnershipTransferred(address,address)");

    await expect(
      env.bestOfGame
        .connect(adr.maliciousActor1.wallet)
        .transferOwnership(adr.gameCreator1.wallet.address)
    ).to.revertedWith("LibDiamond: Must be contract owner");
  });
  it("has rank token assigned", async () => {
    const state = await env.bestOfGame.getContractState();
    await expect(state.BestOfState.rankTokenAddress).to.be.equal(
      env.rankToken.address
    );
    expect(await env.rankToken.owner()).to.be.equal(env.bestOfGame.address);
  });
  it("Can create game only with valid payments", async () => {
    await expect(
      env.bestOfGame
        .connect(adr.gameCreator1.wallet)
        ["createGame(address,uint256)"](adr.gameMaster1.wallet.address, 1)
    ).to.revertedWith("Not enough payment");
    await expect(
      env.bestOfGame
        .connect(adr.gameCreator1.wallet)
        ["createGame(address,uint256)"](adr.gameMaster1.wallet.address, 1, {
          value: BOGSettings.BOG_GAME_PRICE,
        })
    ).to.emit(env.bestOfGame, "gameCreated");
  });

  it("Cannot perform actions on games that do not exist", async () => {
    await expect(
      env.bestOfGame.connect(adr.gameCreator1.wallet).joinGame(1, {
        value: BOGSettings.BOG_GAME_PRICE,
      })
    ).to.be.revertedWith("no game found");
    proposalsStruct = await mockProposals({
      players: getPlayers(adr, BOGSettings.BOG_MAX_PLAYERS),
      gameId: 1,
      turn: 1,
      verifierAddress: env.bestOfGame.address,
      gm: adr.gameMaster1,
    });
    await expect(
      env.bestOfGame
        .connect(adr.gameMaster1.wallet)
        .submitProposal(
          2,
          proposalsStruct[0].gmSignature,
          proposalsStruct[0].proposalEncryptedByGM,
          proposalsStruct[0].proposalHash
        )
    ).to.be.revertedWith("no game found");
    votersAddresses = getPlayers(adr, BOGSettings.BOG_MAX_PLAYERS).map(
      (player) => player.wallet.address
    );
    votes = await mockVotes({
      gameId: 1,
      turn: 1,
      verifierAddress: env.bestOfGame.address,
      players: getPlayers(adr, BOGSettings.BOG_MAX_PLAYERS),
      gm: adr.gameMaster1,
      proposals: proposalsStruct.map((item) => item.proposal),
      distribution: "semiUniform",
    });
    await expect(
      env.bestOfGame
        .connect(adr.gameMaster1.wallet)
        .submitVote(
          1,
          votes[0].voteHidden,
          votes[0].proof,
          votes[0].publicSignature
        )
    ).to.be.revertedWith("no game found");
    await expect(
      env.bestOfGame.connect(adr.gameMaster1.wallet).openRegistration(1)
    ).to.be.revertedWith("no game found");
    // await expect(
    //   env.bestOfGame.connect(adr.gameMaster1.wallet).addJoinRequirements(0, {
    //     token: { tokenAddress: ZERO_ADDRESS, tokenType: 0, tokenId: 1 },
    //     amount: 1,
    //     must: 0,
    //     requireParticularERC721: false,
    //   })
    // ).to.be.revertedWith("no game found");
    // await expect(
    //   env.bestOfGame.connect(adr.gameMaster1.wallet).removeJoinRequirement(0, 0)
    // ).to.be.revertedWith("no game found");
    // await expect(
    //   env.bestOfGame.connect(adr.gameMaster1.wallet).popJoinRequirements(0)
    // ).to.be.revertedWith("no game found");
    await expect(
      env.bestOfGame.connect(adr.gameMaster1.wallet).joinGame(0)
    ).to.be.revertedWith("no game found");
    await expect(
      env.bestOfGame.connect(adr.gameMaster1.wallet).startGame(0)
    ).to.be.revertedWith("no game found");
    const proposals = await mockProposals({
      players: getPlayers(adr, BOGSettings.BOG_MAX_PLAYERS),
      gameId: 1,
      turn: 1,
      verifierAddress: env.bestOfGame.address,
      gm: adr.gameMaster1,
    });
    await expect(
      env.bestOfGame.connect(adr.gameMaster1.wallet).endTurn(
        1,
        getTurnSalt({ gameId: 1, turn: 1 }),
        votersAddresses,
        votes.map((vote) => vote.vote),
        proposals.map((prop) => prop.proposal),
        proposalsStruct.map((p) => p.proposer.wallet.address)
      )
    ).to.be.revertedWith("no game found");
    await expect(
      env.bestOfGame
        .connect(adr.gameMaster1.wallet)
        .submitProposal(
          1,
          proposalsStruct[0].gmSignature,
          proposalsStruct[0].proposalEncryptedByGM,
          proposalsStruct[0].proposalHash
        )
    ).to.be.revertedWith("no game found");
  });
  it("Succedes to create ranked game only if sender has correspoding tier rank token", async () => {
    await expect(
      env.bestOfGame
        .connect(adr.maliciousActor1.wallet)
        ["createGame(address,uint256)"](adr.gameMaster1.wallet.address, 2, {
          value: BOGSettings.BOG_GAME_PRICE,
        })
    ).to.be.revertedWith("Has no rank for this action");
  });
  describe("When a game of first rank was created", () => {
    beforeEach(async () => {
      await createGame(
        env.bestOfGame,
        adr.gameCreator1,
        adr.gameMaster1.wallet.address,
        1
      );
    });
    it("GM is correct", async () => {
      expect(await env.bestOfGame.getGM(1)).to.be.equal(
        adr.gameMaster1.wallet.address
      );
    });
    it("Incremented number of games correctly", async () => {
      const state = await env.bestOfGame
        .connect(adr.gameCreator1.wallet)
        .getContractState();
      expect(state.BestOfState.numGames).to.be.equal(1);
    });
    it("Players cannot join until registration is open", async () => {
      await expect(
        env.bestOfGame.connect(adr.player1.wallet).joinGame(1)
      ).to.be.revertedWith("addPlayer->cant join now");
    });
    it("Allows only game creator to add join requirements", async () => {
      await expect(
        env.bestOfGame
          .connect(adr.gameCreator1.wallet)
          .setJoinRequirements(1, requirement)
      ).to.be.emit(env.bestOfGame, "RequirementsConfigured");
      await expect(
        env.bestOfGame
          .connect(adr.maliciousActor1.wallet)
          .setJoinRequirements(1, requirement)
      ).to.be.revertedWith("Only game creator");
      await expect(
        env.bestOfGame
          .connect(adr.maliciousActor1.wallet)
          .setJoinRequirements(11, requirement)
      ).to.be.revertedWith("no game found");
    });
    it("Only game creator can open registration", async () => {
      await expect(
        env.bestOfGame.connect(adr.gameCreator1.wallet).openRegistration(1)
      ).to.be.emit(env.bestOfGame, "RegistrationOpen");
      await expect(
        env.bestOfGame.connect(adr.maliciousActor1.wallet).openRegistration(1)
      ).to.be.revertedWith("Only game creator");
    });
    describe("When registration was open without any additional requirements", () => {
      beforeEach(async () => {
        await env.bestOfGame
          .connect(adr.gameCreator1.wallet)
          .openRegistration(1);
      });
      it("Mutating join requirements is no longer possible", async () => {
        await expect(
          env.bestOfGame
            .connect(adr.gameCreator1.wallet)
            .setJoinRequirements(1, requirement)
        ).to.be.revertedWith("Cannot do when registration is open");
      });
      it("Qualified players can join", async () => {
        await expect(
          env.bestOfGame
            .connect(adr.player1.wallet)
            .joinGame(1, { value: BOGSettings.BOG_JOIN_GAME_PRICE })
        ).to.be.emit(env.bestOfGame, "PlayerJoined");
      });
      it("Game cannot be started until join blocktime has passed", async () => {
        env.bestOfGame
          .connect(adr.player1.wallet)
          .joinGame(1, { value: BOGSettings.BOG_JOIN_GAME_PRICE });
        env.bestOfGame
          .connect(adr.player2.wallet)
          .joinGame(1, { value: BOGSettings.BOG_JOIN_GAME_PRICE });
        env.bestOfGame
          .connect(adr.player3.wallet)
          .joinGame(1, { value: BOGSettings.BOG_JOIN_GAME_PRICE });

        await expect(
          env.bestOfGame.connect(adr.player1.wallet).startGame(1)
        ).to.be.revertedWith("startGame->Still Can Join");
      });
      it("No more than max players can join", async () => {
        for (let i = 1; i < BOGSettings.BOG_MAX_PLAYERS + 1; i++) {
          let name = `player${i}` as any as keyof AdrSetupResult;
          env.bestOfGame
            .connect(adr[`${name}`].wallet)
            .joinGame(1, { value: BOGSettings.BOG_JOIN_GAME_PRICE });
        }
        await expect(
          env.bestOfGame.connect(adr.maliciousActor1.wallet).joinGame(1)
        ).to.be.revertedWith("addPlayer->party full");
      });
      it("Game cannot start too early", async () => {
        await expect(
          env.bestOfGame.connect(adr.gameMaster1.wallet).startGame(1)
        ).to.be.revertedWith("startGame->Still Can Join");
      });
      it("Game methods beside join and start are inactive", async () => {
        await expect(
          env.bestOfGame
            .connect(adr.gameMaster1.wallet)
            .submitProposal(
              1,
              ethers.utils.formatBytes32String("mockString"),
              "mockString",
              solidityKeccak256(["string"], ["mockString"])
            )
        ).to.be.revertedWith("Game has not yet started");
        proposalsStruct = await mockProposals({
          players: getPlayers(adr, BOGSettings.BOG_MAX_PLAYERS),
          gameId: 1,
          turn: 1,
          verifierAddress: env.bestOfGame.address,
          gm: adr.gameMaster1,
        });
        votes = await mockVotes({
          gameId: 1,
          turn: 1,
          verifierAddress: env.bestOfGame.address,
          players: getPlayers(adr, BOGSettings.BOG_MAX_PLAYERS),
          gm: adr.gameMaster1,
          proposals: proposalsStruct.map((item) => item.proposal),
          distribution: "semiUniform",
        });
        votersAddresses = getPlayers(adr, BOGSettings.BOG_MAX_PLAYERS).map(
          (player) => player.wallet.address
        );
        await expect(
          env.bestOfGame.connect(adr.gameMaster1.wallet).endTurn(
            1,
            getTurnSalt({ gameId: 1, turn: 1 }),
            votersAddresses,
            votes.map((vote) => vote.vote),
            proposalsStruct.map((p) => p.proposalHash),
            proposalsStruct.map((p) => p.proposer.wallet.address)
          )
        ).to.be.revertedWith("Game has not yet started");
        await expect(
          env.bestOfGame
            .connect(adr.gameMaster1.wallet)
            .submitVote(
              1,
              votes[0].voteHidden,
              votes[0].proof,
              votes[0].publicSignature
            )
        ).to.be.revertedWith("Game has not yet started");
        await expect(
          env.bestOfGame.connect(adr.gameCreator1.wallet).openRegistration(1)
        ).to.be.revertedWith("Cannot do when registration is open");
        await expect(
          env.bestOfGame
            .connect(adr.gameCreator1.wallet)
            .setJoinRequirements(1, requirement)
        ).to.be.revertedWith("Cannot do when registration is open");

        await expect(
          env.bestOfGame.connect(adr.gameMaster1.wallet).endTurn(
            1,
            getTurnSalt({ gameId: 1, turn: 1 }),
            votersAddresses,
            votes.map((vote) => vote.vote),
            proposalsStruct.map((p) => p.proposalHash),
            proposalsStruct.map((p) => p.proposer.wallet.address)
          )
        ).to.be.revertedWith("Game has not yet started");
      });
      it("Cannot be started if not enough players", async () => {
        await mineBlocks(BOGSettings.BOG_BLOCKS_TO_JOIN + 1);
        await expect(
          env.bestOfGame.connect(adr.gameMaster1.wallet).startGame(1)
        ).to.be.revertedWith("startGame->Not enough players");
      });
      describe("When there is minimal number and below maximum players in game", () => {
        beforeEach(async () => {
          await fillParty(
            getPlayers(adr, BOGSettings.BOG_MIN_PLAYERS),
            env.bestOfGame,
            1,
            false
          );
        });
        it("Can start game only after joining period is over", async () => {
          await expect(
            env.bestOfGame.connect(adr.gameMaster1.wallet).startGame(1)
          ).to.be.revertedWith("startGame->Still Can Join");
          await mineBlocks(BOGSettings.BOG_BLOCKS_TO_JOIN + 1);
          await expect(
            env.bestOfGame.connect(adr.gameMaster1.wallet).startGame(1)
          ).to.be.emit(env.bestOfGame, "GameStarted");
        });
        it("Game methods beside start are inactive", async () => {
          //TODO: add more methods here
          proposalsStruct = await mockProposals({
            players: getPlayers(adr, BOGSettings.BOG_MAX_PLAYERS),
            gameId: 1,
            turn: 1,
            verifierAddress: env.bestOfGame.address,
            gm: adr.gameMaster1,
          });
          await expect(
            env.bestOfGame
              .connect(adr.gameMaster1.wallet)
              .submitProposal(
                1,
                proposalsStruct[0].gmSignature,
                proposalsStruct[0].proposalEncryptedByGM,
                proposalsStruct[0].proposalHash
              )
          ).to.be.revertedWith("Game has not yet started");
          votes = await mockVotes({
            gameId: 1,
            turn: 1,
            verifierAddress: env.bestOfGame.address,
            players: getPlayers(adr, BOGSettings.BOG_MAX_PLAYERS),
            gm: adr.gameMaster1,
            proposals: proposalsStruct.map((item) => item.proposal),
            distribution: "semiUniform",
          });
          votersAddresses = getPlayers(adr, BOGSettings.BOG_MAX_PLAYERS).map(
            (player) => player.wallet.address
          );

          await expect(
            env.bestOfGame.connect(adr.gameMaster1.wallet).endTurn(
              1,
              getTurnSalt({ gameId: 1, turn: 1 }),
              votersAddresses,
              votes.map((vote) => vote.vote),
              proposalsStruct.map((p) => p.proposalHash),
              proposalsStruct.map((p) => p.proposer.wallet.address)
            )
          ).to.be.revertedWith("Game has not yet started");
          await expect(
            env.bestOfGame
              .connect(adr.gameMaster1.wallet)
              .submitVote(
                1,
                votes[0].voteHidden,
                votes[0].proof,
                votes[0].publicSignature
              )
          ).to.be.revertedWith("Game has not yet started");
        });
        describe("When game has started", () => {
          beforeEach(async () => {
            await startGame(1);
          });
          it("First turn has started", async () => {
            expect(
              await env.bestOfGame.connect(adr.player1.wallet).getTurn(1)
            ).to.be.equal(1);
          });
          it("Accepts only proposals and no votes", async () => {
            const proposals = await mockProposals({
              players: getPlayers(adr, BOGSettings.BOG_MIN_PLAYERS),
              gameId: 1,
              turn: 1,
              verifierAddress: env.bestOfGame.address,
              gm: adr.gameMaster1,
            });
            await expect(
              env.bestOfGame
                .connect(proposals[0].proposer.wallet)
                .submitProposal(
                  1,
                  proposals[0].gmSignature,
                  proposals[0].proposalEncryptedByGM,
                  proposals[0].proposalHash
                )
            ).to.be.emit(env.bestOfGame, "ProposalSubmitted");
            votes = await mockVotes({
              gameId: 1,
              turn: 1,
              verifierAddress: env.bestOfGame.address,
              players: getPlayers(adr, BOGSettings.BOG_MIN_PLAYERS),
              gm: adr.gameMaster1,
              proposals: proposals.map((item) => item.proposal),
              distribution: "semiUniform",
            });
            votersAddresses = getPlayers(adr, BOGSettings.BOG_MAX_PLAYERS).map(
              (player) => player.wallet.address
            );

            await expect(
              env.bestOfGame
                .connect(adr.player1.wallet)
                .submitVote(
                  1,
                  votes[0].voteHidden,
                  votes[0].proof,
                  votes[0].publicSignature
                )
            ).to.be.revertedWith("No proposals exist at turn 1: cannot vote");
          });
          it("Processes only proposals only from player", async () => {
            await expect(
              env.bestOfGame
                .connect(adr.player1.wallet)
                .submitProposal(
                  1,
                  proposalsStruct[0].gmSignature,
                  proposalsStruct[0].proposalEncryptedByGM,
                  proposalsStruct[0].proposalHash
                )
            ).to.emit(env.bestOfGame, "ProposalSubmitted");
            await expect(
              env.bestOfGame
                .connect(adr.maliciousActor1.wallet)
                .submitProposal(
                  1,
                  proposalsStruct[0].gmSignature,
                  proposalsStruct[0].proposalEncryptedByGM,
                  proposalsStruct[0].proposalHash
                )
            ).to.be.revertedWith("not a player");
          });
          it("Can end turn if timeout reached with zero scores", async () => {
            await mineBlocks(BOGSettings.BOG_BLOCKS_PER_TURN + 1);
            await expect(
              env.bestOfGame
                .connect(adr.gameMaster1.wallet)
                .endTurn(1, getTurnSalt({ gameId: 1, turn: 1 }), [], [], [], [])
            )
              .to.be.emit(env.bestOfGame, "TurnEnded")
              .withArgs(
                1,
                1,
                getPlayers(adr, BOGSettings.BOG_MIN_PLAYERS).map(
                  (identity) => identity.wallet.address
                ),
                getPlayers(adr, BOGSettings.BOG_MIN_PLAYERS).map(() => 0),
                getTurnSalt({ gameId: 1, turn: 1 }),
                [],
                getPlayers(adr, BOGSettings.BOG_MIN_PLAYERS).map(
                  () => undefined
                )
              );
          });
          describe("When all proposals received", () => {
            beforeEach(async () => {
              proposalsStruct = await mockValidProposals(
                getPlayers(adr, BOGSettings.BOG_MIN_PLAYERS),
                env.bestOfGame,
                adr.gameMaster1,
                1,
                true
              );
            });
            it("Can end turn", async () => {
              await expect(
                env.bestOfGame.connect(adr.gameMaster1.wallet).endTurn(
                  1,
                  getTurnSalt({ gameId: 1, turn: 1 }),
                  [],
                  [],
                  proposalsStruct.map((p) => p.proposal),
                  proposalsStruct.map((p) => p.proposer.wallet.address)
                )
              ).to.be.emit(env.bestOfGame, "TurnEnded");
            });
            describe("When first turn was made", () => {
              beforeEach(async () => {
                await env.bestOfGame.connect(adr.gameMaster1.wallet).endTurn(
                  1,
                  getTurnSalt({ gameId: 1, turn: 1 }),
                  [],
                  [],
                  proposalsStruct.map((p) => p.proposal),
                  proposalsStruct.map((p) => p.proposer.wallet.address)
                );
              });
              it("throws if player submitted GM signed vote for player voting himself", async () => {
                proposalsStruct = await mockValidProposals(
                  getPlayers(adr, BOGSettings.BOG_MIN_PLAYERS),
                  env.bestOfGame,
                  adr.gameMaster1,
                  1,
                  true
                );
                const badVote = await mockVote({
                  voter: adr.player1,
                  gm: adr.gameMaster1,
                  gameId: 1,
                  verifierAddress: env.bestOfGame.address,
                  turn: 2,
                  vote: [0, 1, 2],
                });

                const badVotes = await mockVotes({
                  gameId: 1,
                  turn: 2,
                  verifierAddress: env.bestOfGame.address,
                  players: getPlayers(adr, BOGSettings.BOG_MIN_PLAYERS),
                  gm: adr.gameMaster1,
                  proposals: proposalsStruct.map((item) => item.proposal),
                  distribution: "semiUniform",
                });
                badVotes[0] = badVote;
                votersAddresses = getPlayers(
                  adr,
                  BOGSettings.BOG_MIN_PLAYERS
                ).map((player, idx) => player.wallet.address);
                for (let i = 0; i < votersAddresses.length; i++) {
                  let name = `player${i + 1}` as any as keyof AdrSetupResult;

                  await env.bestOfGame
                    .connect(adr[`${name}`].wallet)
                    .submitVote(
                      1,
                      badVotes[i].voteHidden,
                      badVotes[i].proof,
                      badVotes[i].publicSignature
                    );
                }

                await mineBlocks(BOGSettings.BOG_BLOCKS_PER_TURN + 1);
                await expect(
                  env.bestOfGame.connect(adr.gameMaster1.wallet).endTurn(
                    1,
                    getTurnSalt({ gameId: 1, turn: 2 }),
                    votersAddresses,
                    badVotes.map((vote) => vote.vote),
                    proposalsStruct.map((p) => p.proposal),
                    proposalsStruct.map((p) => p.proposer.wallet.address)
                  )
                ).to.be.revertedWith("voted for himself");
              });
              describe("When all players voted", () => {
                beforeEach(async () => {
                  votes = await mockValidVotes(
                    getPlayers(adr, BOGSettings.BOG_MIN_PLAYERS),
                    env.bestOfGame,
                    1,
                    adr.gameMaster1,
                    true
                  );
                  votersAddresses = getPlayers(
                    adr,
                    BOGSettings.BOG_MIN_PLAYERS
                  ).map((player) => player.wallet.address);
                });
                it("cannot end turn because players still have time to propose", async () => {
                  await expect(
                    env.bestOfGame.connect(adr.gameMaster1.wallet).endTurn(
                      1,
                      getTurnSalt({ gameId: 1, turn: 2 }),
                      votersAddresses,
                      votes.map((vote) => vote.vote),
                      proposalsStruct.map((p) => p.proposal),
                      proposalsStruct.map((p) => p.proposer.wallet.address)
                    )
                  ).to.be.revertedWith(
                    "Some players still have time to propose"
                  );
                });
                it.only("Can end turn if timeout reached", async () => {
                  await mineBlocks(BOGSettings.BOG_BLOCKS_PER_TURN + 1);
                  expect(await env.bestOfGame.getTurn(1)).to.be.equal(2);
                  const expectedScores: number[] = [];
                  const players = getPlayers(
                    adr,
                    BOGSettings.BOG_MIN_PLAYERS
                  ).length;
                  for (let i = 0; i < players; i++) {
                    expectedScores[i] = 0;
                    votes.forEach((playerVote) => {
                      playerVote.vote.forEach((vote, idx) => {
                        if (proposalsStruct[i].proposal === vote) {
                          expectedScores[i] += 3 - idx;
                        }
                      });
                    });
                  }
                  await expect(
                    env.bestOfGame.connect(adr.gameMaster1.wallet).endTurn(
                      1,
                      getTurnSalt({ gameId: 1, turn: 2 }),
                      votersAddresses,
                      votes.map((vote) => vote.vote),
                      [], //TODO: prevProposersRevealed - get clarify
                      []
                    )
                  )
                    .to.be.emit(env.bestOfGame, "TurnEnded")
                    .withArgs(
                      1,
                      2,
                      getPlayers(adr, BOGSettings.BOG_MIN_PLAYERS).map(
                        (identity) => identity.wallet.address
                      ),
                      expectedScores,
                      getTurnSalt({ gameId: 1, turn: 2 })
                    );
                });
              });
            });
          });
        });
        describe("When another game  of first rank is created", () => {
          beforeEach(async () => {
            await createGame(
              env.bestOfGame,
              adr.gameCreator1,
              adr.gameMaster2.wallet.address,
              1,
              true
            );
          });
          it("Reverts if players from another game tries to join", async () => {
            await expect(
              env.bestOfGame.connect(adr.player1.wallet).joinGame(2, {
                value: BOGSettings.BOG_GAME_PRICE,
              })
            ).to.be.revertedWith("addPlayer->Player in game");
          });
        });
      });
      describe("When there is not enough players and join time is out", () => {
        beforeEach(async () => {
          await fillParty(
            getPlayers(adr, BOG_MIN_PLAYERS - 1),
            env.bestOfGame,
            1,
            true
          );
        });
        it("It throws on game start", async () => {
          await expect(
            env.bestOfGame.connect(adr.gameCreator1.wallet).startGame(1)
          ).to.be.revertedWith("startGame->Not enough players");
        });
        it("Allows creator can close the game", async () => {
          await expect(
            env.bestOfGame.connect(adr.gameCreator1.wallet).cancelGame(1)
          ).to.emit(env.bestOfGame, "GameClosed");
        });
        it("Allows player to leave the game", async () => {
          await expect(
            env.bestOfGame.connect(adr.player1.wallet).leaveGame(1)
          ).to.emit(env.bestOfGame, "PlayerLeft");
        });
      });
    });
    describe("When registration was open with additional join requirements", () => {
      beforeEach(async () => {
        await env.bestOfGame
          .connect(adr.gameCreator1.wallet)
          .setJoinRequirements(1, requirement);
        await env.bestOfGame
          .connect(adr.gameCreator1.wallet)
          .openRegistration(1);
        const players = getPlayers(adr, BOG_MAX_PLAYERS, 0);
        for (let i = 0; i < players.length; i++) {
          await env.mockERC1155.mint(
            players[i].wallet.address,
            ethers.utils.parseEther("10"),
            "1",
            "0x"
          );
          await env.mockERC20.mint(
            players[i].wallet.address,
            ethers.utils.parseEther("10")
          );
          await env.mockERC721.mint(players[i].wallet.address, i + 1, "0x");
          await env.mockERC20
            .connect(players[i].wallet)
            .approve(env.bestOfGame.address, ethers.utils.parseEther("100"));
          await env.mockERC1155
            .connect(players[i].wallet)
            .setApprovalForAll(env.bestOfGame.address, true);
          await env.mockERC721
            .connect(players[i].wallet)
            .setApprovalForAll(env.bestOfGame.address, true);
        }
      });
      it("Fulfills funding requirement on join", async () => {
        await env.mockERC20
          .connect(adr.player1.wallet)
          .increaseAllowance(
            env.bestOfGame.address,
            ethers.utils.parseEther("100")
          );
        await env.bestOfGame
          .connect(adr.player1.wallet)
          .joinGame(1, { value: ethers.utils.parseEther("0.4") });
        expect(
          await env.mockERC1155.balanceOf(env.bestOfGame.address, "1")
        ).to.be.equal(ethers.utils.parseEther("0.4"));
        expect(
          await env.mockERC20.balanceOf(env.bestOfGame.address)
        ).to.be.equal(ethers.utils.parseEther("0.4"));
      });
      it("Returns requirements on leave", async () => {
        await env.mockERC20
          .connect(adr.player1.wallet)
          .increaseAllowance(
            env.bestOfGame.address,
            ethers.utils.parseEther("100")
          );
        await env.bestOfGame
          .connect(adr.player1.wallet)
          .joinGame(1, { value: ethers.utils.parseEther("10") });
        await env.bestOfGame.connect(adr.player1.wallet).leaveGame(1);
        expect(
          await env.mockERC1155.balanceOf(adr.player1.wallet.address, "1")
        ).to.be.equal(ethers.utils.parseEther("10"));
        expect(
          await env.mockERC20.balanceOf(adr.player1.wallet.address)
        ).to.be.equal(ethers.utils.parseEther("10"));
      });
      it("Returns requirements on game closed", async () => {
        await env.mockERC20
          .connect(adr.player1.wallet)
          .increaseAllowance(
            env.bestOfGame.address,
            ethers.utils.parseEther("100")
          );
        await env.bestOfGame
          .connect(adr.player1.wallet)
          .joinGame(1, { value: ethers.utils.parseEther("10") });
        await env.bestOfGame.connect(adr.gameCreator1.wallet).cancelGame(1);
        expect(
          await env.mockERC1155.balanceOf(adr.player1.wallet.address, "1")
        ).to.be.equal(ethers.utils.parseEther("10"));
        expect(
          await env.mockERC20.balanceOf(adr.player1.wallet.address)
        ).to.be.equal(ethers.utils.parseEther("10"));
      });
      it("Distributes rewards correctly when game is over", async () => {
        await fillParty(
          getPlayers(adr, BOG_MIN_PLAYERS, 0),
          env.bestOfGame,
          1,
          true,
          true,
          adr.gameMaster1
        );
        const balanceBefore1155 = await env.mockERC1155.balanceOf(
          adr.player1.wallet.address,
          "1"
        );
        const balanceBefore20 = await env.mockERC20.balanceOf(
          adr.player1.wallet.address
        );
        const creatorBalanceBefore20 = await env.mockERC20.balanceOf(
          adr.gameCreator1.wallet.address
        );

        const creatorBalanceBefore1155 = await env.mockERC1155.balanceOf(
          adr.gameCreator1.wallet.address,
          "1"
        );
        await runToTheEnd(
          1,
          env.bestOfGame,
          adr.gameMaster1,
          getPlayers(adr, BOG_MIN_PLAYERS, 0),
          "ftw"
        );
        expect(
          await env.mockERC20.balanceOf(adr.player1.wallet.address)
        ).to.be.equal(
          balanceBefore20
            .add(ethers.utils.parseEther("0.1").mul(BOG_MIN_PLAYERS))
            .add(ethers.utils.parseEther("0.1")) // Value to lock
        );
        expect(
          await env.mockERC20.balanceOf(adr.gameCreator1.wallet.address)
        ).to.be.equal(
          creatorBalanceBefore20.add(
            ethers.utils.parseEther("0.1").mul(BOG_MIN_PLAYERS)
          )
        );
        expect(
          await env.mockERC1155.balanceOf(adr.player1.wallet.address, "1")
        ).to.be.equal(
          balanceBefore1155
            .add(ethers.utils.parseEther("0.1").mul(BOG_MIN_PLAYERS))
            .add(ethers.utils.parseEther("0.1")) // Value to lock
        );
        expect(
          await env.mockERC1155.balanceOf(adr.gameCreator1.wallet.address, "1")
        ).to.be.equal(
          creatorBalanceBefore1155.add(
            ethers.utils.parseEther("0.1").mul(BOG_MIN_PLAYERS)
          )
        );
      });
    });
    describe("When it is last turn and equal scores", () => {
      beforeEach(async () => {
        await env.bestOfGame
          .connect(adr.gameCreator1.wallet)
          .openRegistration(1);
        await fillParty(
          getPlayers(adr, BOGSettings.BOG_MAX_PLAYERS),
          env.bestOfGame,
          1,
          true,
          true,
          adr.gameMaster1
        );
        await runToLastTurn(
          1,
          env.bestOfGame,
          adr.gameMaster1,
          getPlayers(adr, BOGSettings.BOG_MAX_PLAYERS),
          "equal"
        );
      });
      it("reverts on submit proposals", async () => {
        proposalsStruct = await mockProposals({
          players: getPlayers(adr, BOGSettings.BOG_MAX_PLAYERS),
          gameId: 1,
          turn: BOGSettings.BOG_MAX_TURNS,
          verifierAddress: env.bestOfGame.address,
          gm: adr.gameMaster1,
        });
        await expect(
          env.bestOfGame
            .connect(adr.gameMaster1.wallet)
            .submitProposal(
              1,
              proposalsStruct[0].gmSignature,
              proposalsStruct[0].proposalEncryptedByGM,
              proposalsStruct[0].proposalHash
            )
        ).to.be.revertedWith("Cannot propose in last turn");
      });
      it("Next turn without winner brings Game is in overtime conditions", async () => {
        let isGameOver = await env.bestOfGame.isGameOver(1);
        expect(isGameOver).to.be.false;
        await mockValidVotes(
          getPlayers(adr, BOGSettings.BOG_MAX_PLAYERS),
          env.bestOfGame,
          1,
          adr.gameMaster1,
          true,
          "equal"
        );
        await endTurn(1, env.bestOfGame);

        expect(await env.bestOfGame.isOvertime(1)).to.be.true;
      });
      describe("when is ovetime", () => {
        beforeEach(async () => {
          await mockValidVotes(
            getPlayers(adr, BOGSettings.BOG_MAX_PLAYERS),
            env.bestOfGame,
            1,
            adr.gameMaster1,
            true,
            "equal"
          );
          await endTurn(1, env.bestOfGame);
        });
        it("emits game Over when submited votes result unique leaders", async () => {
          await mockValidVotes(
            getPlayers(adr, BOGSettings.BOG_MAX_PLAYERS),
            env.bestOfGame,
            1,
            adr.gameMaster1,
            true,
            "ftw"
          );
          const proposals = await mockValidProposals(
            getPlayers(adr, BOGSettings.BOG_MAX_PLAYERS),
            env.bestOfGame,
            adr.gameMaster1,
            1,
            true
          );
          const currentTurn = await env.bestOfGame.getTurn(1);
          expect(
            await env.bestOfGame.connect(adr.gameMaster1.wallet).endTurn(
              1,
              getTurnSalt({
                gameId: 1,
                turn: currentTurn,
              }),
              votersAddresses,
              votes.map((vote) => vote.vote),
              proposals.map((p) => p.proposal),
              proposalsStruct.map((p) => p.proposer.wallet.address)
            )
          ).to.emit(env.bestOfGame, "GameOver");
        });
      });

      describe("When game is over", () => {
        beforeEach(async () => {
          await runToTheEnd(
            1,
            env.bestOfGame,
            adr.gameMaster1,
            getPlayers(adr, BOGSettings.BOG_MAX_PLAYERS)
          );
          const isover = await env.bestOfGame.isGameOver(1);
        });
        it("Throws on attempt to make another turn", async () => {
          const currentTurn = await env.bestOfGame.getTurn(1);
          votes = await mockVotes({
            gameId: 1,
            turn: currentTurn,
            verifierAddress: env.bestOfGame.address,
            players: getPlayers(adr, BOGSettings.BOG_MAX_PLAYERS),
            gm: adr.gameMaster1,
            proposals: proposalsStruct.map((item) => item.proposal),
            distribution: "ftw",
          });
          proposalsStruct = await mockProposals({
            players: getPlayers(adr, BOGSettings.BOG_MAX_PLAYERS),
            gameId: 1,
            turn: currentTurn,
            verifierAddress: env.bestOfGame.address,
            gm: adr.gameMaster1,
          });

          for (let i = 0; i < BOGSettings.BOG_MAX_PLAYERS; i++) {
            const proposals = await expect(
              env.bestOfGame
                .connect(adr.gameMaster1.wallet)
                .submitProposal(
                  1,
                  proposalsStruct[i].gmSignature,
                  proposalsStruct[i].proposalEncryptedByGM,
                  proposalsStruct[i].proposalHash
                )
            ).to.be.revertedWith("Game over");

            let name = `player${i + 1}` as any as keyof AdrSetupResult;
            await expect(
              env.bestOfGame
                .connect(adr[`${name}`].wallet)
                .submitVote(
                  1,
                  votes[i].voteHidden,
                  votes[i].proof,
                  votes[i].publicSignature
                )
            ).to.be.revertedWith("Game over");
          }
          await expect(
            env.bestOfGame.connect(adr.gameMaster1.wallet).endTurn(
              1,
              getTurnSalt({
                gameId: 1,
                turn: BOGSettings.BOG_MAX_TURNS,
              }),
              votersAddresses,
              votes.map((vote) => vote.vote),
              [],
              []
            )
          ).to.be.revertedWith("Game over");
        });
        it("Gave rewards to winners", async () => {
          expect(
            await env.rankToken.balanceOf(adr.player1.wallet.address, 2)
          ).to.be.equal(1);
          expect(
            await env.rankToken.balanceOf(adr.player2.wallet.address, 1)
          ).to.be.equal(2);
          expect(
            await env.rankToken.balanceOf(adr.player2.wallet.address, 2)
          ).to.be.equal(0);
          expect(
            await env.rankToken.balanceOf(adr.player3.wallet.address, 1)
          ).to.be.equal(1);
          expect(
            await env.rankToken.balanceOf(adr.player3.wallet.address, 2)
          ).to.be.equal(0);
        });
        it("Allows winner to create game of next rank", async () => {
          await expect(
            env.bestOfGame
              .connect(adr.player1.wallet)
              ["createGame(address,uint256)"](
                adr.gameMaster1.wallet.address,
                2,
                {
                  value: BOGSettings.BOG_GAME_PRICE,
                }
              )
          ).to.emit(env.bestOfGame, "gameCreated");
        });
        describe("When game of next rank is created and opened", () => {
          beforeEach(async () => {
            await env.bestOfGame
              .connect(adr.player1.wallet)
              ["createGame(address,uint256)"](
                adr.gameMaster1.wallet.address,
                2,
                {
                  value: BOGSettings.BOG_GAME_PRICE,
                }
              );
            await env.bestOfGame
              .connect(adr.player1.wallet)
              .openRegistration(2);
          });
          it("Can be joined only by rank token bearers", async () => {
            await env.rankToken
              .connect(adr.player1.wallet)
              .setApprovalForAll(env.bestOfGame.address, true);
            await env.rankToken
              .connect(adr.player2.wallet)
              .setApprovalForAll(env.bestOfGame.address, true);
            await expect(env.bestOfGame.connect(adr.player1.wallet).joinGame(2))
              .to.emit(env.bestOfGame, "PlayerJoined")
              .withArgs(2, adr.player1.wallet.address);
            await expect(
              env.bestOfGame.connect(adr.player2.wallet).joinGame(2)
            ).to.revertedWith("ERC1155: insufficient balance for transfer");
          });
        });
      });
    });
  });
  describe("When there was multiple first rank games played so higher rank game can be filled", () => {
    beforeEach(async () => {
      for (
        let numGames = 0;
        numGames < BOGSettings.BOG_MAX_PLAYERS;
        numGames++
      ) {
        const gameId = await createGame(
          env.bestOfGame,
          adr.gameCreator1,
          adr.gameMaster1.wallet.address,
          1,
          true
        );
        await fillParty(
          getPlayers(adr, BOGSettings.BOG_MIN_PLAYERS, numGames),
          env.bestOfGame,
          gameId,
          true,
          true,
          adr.gameMaster1
        );
        await runToTheEnd(
          gameId,
          env.bestOfGame,
          adr.gameMaster1,
          getPlayers(adr, BOGSettings.BOG_MIN_PLAYERS, numGames)
        );
      }
    });
    it("Winners have reward tokens", async () => {
      const balances: number[] = [];
      balances[0] = await env.rankToken
        .balanceOf(adr.player1.wallet.address, 2)
        .then((balance) => balances.push(balance.toNumber()));
      expect(
        await env.rankToken.balanceOf(adr.player1.wallet.address, 2)
      ).to.be.equal(1);
      expect(
        await env.rankToken.balanceOf(adr.player2.wallet.address, 2)
      ).to.be.equal(1);
      expect(
        await env.rankToken.balanceOf(adr.player3.wallet.address, 2)
      ).to.be.equal(1);
      expect(
        await env.rankToken.balanceOf(adr.player4.wallet.address, 2)
      ).to.be.equal(1);
      expect(
        await env.rankToken.balanceOf(adr.player5.wallet.address, 2)
      ).to.be.equal(1);
      expect(
        await env.rankToken.balanceOf(adr.player6.wallet.address, 2)
      ).to.be.equal(0);
    });
    describe("When game of next rank is created", () => {
      beforeEach(async () => {
        await createGame(
          env.bestOfGame,
          adr.player1,
          adr.gameMaster1.wallet.address,
          2,
          true
        );
      });
      it("Can be joined only by bearers of rank token", async () => {
        const lastCreatedGameId = await env.bestOfGame
          .getContractState()
          .then((r) => r.BestOfState.numGames);
        await env.rankToken
          .connect(adr.player2.wallet)
          .setApprovalForAll(env.bestOfGame.address, true);
        await expect(
          env.bestOfGame.connect(adr.player2.wallet).joinGame(lastCreatedGameId)
        ).to.emit(env.bestOfGame, "PlayerJoined");
        await env.rankToken
          .connect(adr.player6.wallet)
          .setApprovalForAll(env.bestOfGame.address, true);
        await expect(
          env.bestOfGame.connect(adr.player6.wallet).joinGame(lastCreatedGameId)
        ).to.be.revertedWith("ERC1155: insufficient balance for transfer");
      });
      it("Locks rank tokens when player joins", async () => {
        const balance = await env.rankToken.balanceOf(
          adr.player1.wallet.address,
          2
        );
        const lastCreatedGameId = await env.bestOfGame
          .getContractState()
          .then((r) => r.BestOfState.numGames);
        await env.rankToken
          .connect(adr.player1.wallet)
          .setApprovalForAll(env.bestOfGame.address, true);
        await env.bestOfGame
          .connect(adr.player1.wallet)
          .joinGame(lastCreatedGameId);
        const balance2 = await env.rankToken.balanceOf(
          adr.player1.wallet.address,
          2
        );
        expect(
          await env.rankToken.balanceOf(adr.player1.wallet.address, 2)
        ).to.be.equal(balance.toNumber() - 1);
      });
      it("Returns rank token if player leaves game", async () => {
        const lastCreatedGameId = await env.bestOfGame
          .getContractState()
          .then((r) => r.BestOfState.numGames);
        await env.rankToken
          .connect(adr.player1.wallet)
          .setApprovalForAll(env.bestOfGame.address, true);
        await env.bestOfGame
          .connect(adr.player1.wallet)
          .joinGame(lastCreatedGameId);
        expect(
          await env.rankToken.balanceOf(adr.player1.wallet.address, 2)
        ).to.be.equal(0);
        await env.bestOfGame
          .connect(adr.player1.wallet)
          .leaveGame(lastCreatedGameId);
        expect(
          await env.rankToken.balanceOf(adr.player1.wallet.address, 2)
        ).to.be.equal(1);
      });
      it("Returns rank token if was game closed", async () => {
        const lastCreatedGameId = await env.bestOfGame
          .getContractState()
          .then((r) => r.BestOfState.numGames);
        await env.rankToken
          .connect(adr.player1.wallet)
          .setApprovalForAll(env.bestOfGame.address, true);
        await env.rankToken
          .connect(adr.player2.wallet)
          .setApprovalForAll(env.bestOfGame.address, true);
        await env.bestOfGame
          .connect(adr.player1.wallet)
          .joinGame(lastCreatedGameId);
        await env.bestOfGame
          .connect(adr.player2.wallet)
          .joinGame(lastCreatedGameId);
        let p1balance = await env.rankToken.balanceOf(
          adr.player1.wallet.address,
          2
        );
        p1balance = p1balance.add(1);

        let p2balance = await env.rankToken.balanceOf(
          adr.player2.wallet.address,
          2
        );
        p2balance = p2balance.add(1);
        await env.bestOfGame
          .connect(adr.player1.wallet)
          .cancelGame(lastCreatedGameId);
        expect(
          await env.rankToken.balanceOf(adr.player1.wallet.address, 2)
        ).to.be.equal(p1balance);
        expect(
          await env.rankToken.balanceOf(adr.player2.wallet.address, 2)
        ).to.be.equal(p2balance);
      });
      describe("when this game is over", () => {
        const balancesBeforeJoined: BigNumber[] = [];
        beforeEach(async () => {
          const players = getPlayers(adr, BOGSettings.BOG_MIN_PLAYERS, 0);
          const lastCreatedGameId = await env.bestOfGame
            .getContractState()
            .then((r) => r.BestOfState.numGames);
          for (let i = 0; i < players.length; i++) {
            balancesBeforeJoined[i] = await env.rankToken.balanceOf(
              players[i].wallet.address,
              2
            );
          }
          await fillParty(
            players,
            env.bestOfGame,
            lastCreatedGameId,
            true,
            true,
            adr.gameMaster1
          );

          await runToTheEnd(
            lastCreatedGameId,
            env.bestOfGame,
            adr.gameMaster1,
            getPlayers(adr, BOGSettings.BOG_MIN_PLAYERS),
            "ftw"
          );
        });
        it("Winners have reward tokens", async () => {
          const balances: number[] = [];
          const players = getPlayers(adr, BOGSettings.BOG_MIN_PLAYERS, 0);
          for (let i = 0; i < players.length; i++) {
            balances[i] = await env.rankToken
              .balanceOf(players[i].wallet.address, 3)
              .then((bn) => bn.toNumber());
          }
          expect(balances[0]).to.be.equal(1);
          expect(balances[1]).to.be.equal(0);
          expect(balances[2]).to.be.equal(0);
        });
        it("Returned locked rank tokens", async () => {
          const balances: BigNumberish[] = [];
          const players = getPlayers(adr, BOGSettings.BOG_MIN_PLAYERS, 0);
          for (let i = 0; i < players.length; i++) {
            balances[i] = await env.rankToken.balanceOf(
              players[i].wallet.address,
              2
            );
          }

          expect(balances[0]).to.be.equal(balancesBeforeJoined[0]);
          expect(balances[1]).to.be.equal(balancesBeforeJoined[1].add(2));
          expect(balances[2]).to.be.equal(balancesBeforeJoined[2].add(1));
          for (let i = 3; i < players.length; i++) {
            expect(balances[i]).to.be.equal(balancesBeforeJoined[i]);
          }
        });
      });
    });
  });
});
