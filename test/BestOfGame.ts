import {
  AdrSetupResult,
  EnvSetupResult,
  getTurnSalt,
  SignerIdentity,
} from "./utils";
import {
  setupAddresses,
  setupEnvironment,
  getUserRegisterProps,
  signRegistrarMessage,
  BOGSettings,
  mineBlocks,
  mockProposalSecrets,
} from "./utils";
import { getInterfaceID } from "../scripts/libraries/utils";
import { expect } from "chai";
import { IBestOf } from "../types/typechain/hardhat-diamond-abi/HardhatDiamondABI.sol/BestOfDiamond";
import { ethers } from "hardhat";
const path = require("path");
const { time, constants } = require("@openzeppelin/test-helpers");
const { BigNumber } = require("ethers");
const {
  ZERO_ADDRESS,
  ZERO_BYTES32,
} = require("@openzeppelin/test-helpers/src/constants");
import { TokenMust, TokenTypes } from "../types/enums";
const scriptName = path.basename(__filename);

let adr: AdrSetupResult;

let env: EnvSetupResult;

describe(scriptName, () => {
  beforeEach(async () => {
    adr = await setupAddresses();
    env = await setupEnvironment({
      contractDeployer: adr.contractDeployer,
      multipassOwner: adr.multipassOwner,
      bestOfOwner: adr.gameOwner,
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
    expect(state.gamePrice).to.be.equal(BOGSettings.BOG_GAME_PRICE);
    expect(state.joinGamePrice).to.be.equal(BOGSettings.BOG_JOIN_GAME_PRICE);
    expect(state.numGames).to.be.equal(0);
    expect(state.rankToken.tokenAddress).to.be.equal(env.rankToken.address);
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
    await expect(state.rankToken.tokenAddress).to.be.equal(
      env.rankToken.address
    );
  });
  it("Can create game only with valid payments", async () => {
    await expect(
      env.bestOfGame
        .connect(adr.gameCreator1.wallet)
        ["createGame(address,uint256)"](adr.gameMaster1.wallet.address, 0)
    ).to.revertedWith("Not enough payment");
    await expect(
      env.bestOfGame
        .connect(adr.gameCreator1.wallet)
        ["createGame(address,uint256)"](adr.gameMaster1.wallet.address, 0, {
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
    await expect(
      env.bestOfGame
        .connect(adr.gameMaster1.wallet)
        .submitProposal(
          0,
          ethers.utils.formatBytes32String("mockString"),
          ethers.utils.formatBytes32String("mockString"),
          ethers.utils.formatBytes32String("mockString")
        )
    ).to.be.revertedWith("no game found");
    await expect(
      env.bestOfGame
        .connect(adr.gameMaster1.wallet)
        .submitVote(
          0,
          ethers.utils.formatBytes32String("mockString"),
          [1, 1, 1],
          ethers.utils.formatBytes32String("mockString")
        )
    ).to.be.revertedWith("no game found");
    await expect(
      env.bestOfGame.connect(adr.gameMaster1.wallet).openRegistration(0)
    ).to.be.revertedWith("no game found");
    await expect(
      env.bestOfGame.connect(adr.gameMaster1.wallet).addJoinRequirements(0, {
        token: { tokenAddress: ZERO_ADDRESS, tokenType: 0, tokenId: 1 },
        amount: 1,
        must: 0,
        requireParticularERC721: false,
      })
    ).to.be.revertedWith("no game found");
    await expect(
      env.bestOfGame.connect(adr.gameMaster1.wallet).removeJoinRequirement(0, 0)
    ).to.be.revertedWith("no game found");
    await expect(
      env.bestOfGame.connect(adr.gameMaster1.wallet).popJoinRequirements(0)
    ).to.be.revertedWith("no game found");
    await expect(
      env.bestOfGame.connect(adr.gameMaster1.wallet).joinGame(0)
    ).to.be.revertedWith("no game found");
    await expect(
      env.bestOfGame.connect(adr.gameMaster1.wallet).startGame(0)
    ).to.be.revertedWith("no game found");
    await expect(
      env.bestOfGame
        .connect(adr.gameMaster1.wallet)
        .endTurn(0, ZERO_BYTES32, [ZERO_ADDRESS])
    ).to.be.revertedWith("no game found");
  });
  it("Succedes to create ranked game only if sender has correspoding tier rank token", async () => {
    await expect(
      env.bestOfGame
        .connect(adr.gameCreator1.wallet)
        ["createGame(address,uint256)"](adr.gameMaster1.wallet.address, 1, {
          value: BOGSettings.BOG_GAME_PRICE,
        })
    ).to.be.revertedWith("ERC1155 balance not valid");
    await env.rankToken
      .connect(adr.gameOwner.wallet)
      .mint(
        adr.gameCreator1.wallet.address,
        1,
        1,
        ethers.utils.formatBytes32String("mockString")
      );
    await expect(
      env.bestOfGame
        .connect(adr.gameCreator1.wallet)
        ["createGame(address,uint256)"](adr.gameMaster1.wallet.address, 1, {
          value: BOGSettings.BOG_GAME_PRICE,
        })
    ).to.be.emit(env.bestOfGame, "gameCreated");

    await expect(
      env.bestOfGame
        .connect(adr.gameCreator1.wallet)
        ["createGame(address,uint256)"](adr.gameMaster1.wallet.address, 2, {
          value: BOGSettings.BOG_GAME_PRICE,
        })
    ).to.be.revertedWith("ERC1155 balance not valid");
    await env.rankToken
      .connect(adr.gameOwner.wallet)
      .mint(
        adr.gameCreator1.wallet.address,
        1,
        2,
        ethers.utils.formatBytes32String("mockString")
      );
    await expect(
      env.bestOfGame
        .connect(adr.gameCreator1.wallet)
        ["createGame(address,uint256)"](adr.gameMaster1.wallet.address, 2, {
          value: BOGSettings.BOG_GAME_PRICE,
        })
    ).to.be.emit(env.bestOfGame, "gameCreated");
  });
  describe("When a game of zero rank was created", () => {
    beforeEach(async () => {
      await env.bestOfGame
        .connect(adr.gameCreator1.wallet)
        ["createGame(address,uint256)"](adr.gameMaster1.wallet.address, 0, {
          value: BOGSettings.BOG_GAME_PRICE,
        });
    });
    it("Incremented number of games correctly", async () => {
      const state = await env.bestOfGame
        .connect(adr.gameCreator1.wallet)
        .getContractState();
      expect(state.numGames).to.be.equal(1);
    });
    it("Players cannot join until registration is open", async () => {
      await expect(
        env.bestOfGame.connect(adr.gameMaster1.wallet).joinGame(1)
      ).to.be.revertedWith("Registration was not yet open");
    });
    it("Game creator can add join requirements", async () => {
      const requirement: IBestOf.TokenActionStruct = {
        token: {
          tokenAddress: env.mockERC20.address,
          tokenType: TokenTypes.ERC20,
          tokenId: 0,
        },
        amount: "1",
        requireParticularERC721: false,
        must: TokenMust.HAVE,
      };
      await expect(
        env.bestOfGame
          .connect(adr.gameCreator1.wallet)
          .addJoinRequirements(1, requirement)
      ).to.be.emit(env.bestOfGame, "RequirementAdded");
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
        const requirement: IBestOf.TokenActionStruct = {
          token: {
            tokenAddress: env.mockERC20.address,
            tokenType: TokenTypes.ERC20,
            tokenId: 0,
          },
          amount: "1",
          requireParticularERC721: false,
          must: TokenMust.HAVE,
        };
        await expect(
          env.bestOfGame
            .connect(adr.gameCreator1.wallet)
            .addJoinRequirements(1, requirement)
        ).to.be.revertedWith("Cannot do when registration is open");
        await expect(
          env.bestOfGame.connect(adr.gameCreator1.wallet).popJoinRequirements(1)
        ).to.be.revertedWith("Cannot do when registration is open");
        await expect(
          env.bestOfGame
            .connect(adr.gameCreator1.wallet)
            .removeJoinRequirement(1, 1)
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
        ).to.be.revertedWith(
          "LibTurnBasedGame->startGame Joining period has not yet finished"
        );
      });
      it("No more than max players can join", async () => {
        for (let i = 1; i < BOGSettings.BOG_MAX_PLAYERS + 1; i++) {
          let name = `player${i}` as any as keyof AdrSetupResult;
          env.bestOfGame
            .connect(adr[`${name}`].wallet)
            .joinGame(1, { value: BOGSettings.BOG_JOIN_GAME_PRICE });
        }
        await expect(
          env.bestOfGame.connect(adr.player7.wallet).joinGame(1)
        ).to.be.revertedWith("Game is full");
      });
      it("Game cannot start too early", async () => {
        await expect(
          env.bestOfGame.connect(adr.gameMaster1.wallet).startGame(1)
        ).to.be.revertedWith(
          "LibTurnBasedGame->startGame Joining period has not yet finished"
        );
      });
      it("Game methods beside join and start are inactive", async () => {
        await expect(
          env.bestOfGame
            .connect(adr.gameMaster1.wallet)
            .submitProposal(
              1,
              ethers.utils.formatBytes32String("mockString"),
              ethers.utils.formatBytes32String("mockString"),
              ""
            )
        ).to.be.revertedWith("Game has not yet started");
        await expect(
          env.bestOfGame
            .connect(adr.gameMaster1.wallet)
            .endTurn(1, ZERO_BYTES32, [])
        ).to.be.revertedWith("Game has not yet started");
        await expect(
          env.bestOfGame
            .connect(adr.gameMaster1.wallet)
            .submitVote(
              1,
              ethers.utils.formatBytes32String("mockString"),
              [
                ethers.utils.formatBytes32String("mockString"),
                ethers.utils.formatBytes32String("mockString"),
                ethers.utils.formatBytes32String("mockString"),
              ],
              ethers.utils.formatBytes32String("mockString")
            )
        ).to.be.revertedWith("Game has not yet started");
      });
      it("Cannot be started if not enough players", async () => {
        await mineBlocks(BOGSettings.BOG_BLOCKS_TO_JOIN + 1);
        await expect(
          env.bestOfGame.connect(adr.gameMaster1.wallet).startGame(1)
        ).to.be.revertedWith("Not enough players to start the game");
      });
      describe("When there is enough players in game", () => {
        beforeEach(() => {
          for (let i = 1; i < BOGSettings.BOG_MAX_PLAYERS + 1; i++) {
            let name = `player${i}` as any as keyof AdrSetupResult;
            env.bestOfGame
              .connect(adr[`${name}`].wallet)
              .joinGame(1, { value: BOGSettings.BOG_JOIN_GAME_PRICE });
          }
        });
        it("Can start game only after joining period is over", async () => {
          await expect(
            env.bestOfGame.connect(adr.gameMaster1.wallet).startGame(1)
          ).to.be.revertedWith(
            "LibTurnBasedGame->startGame Joining period has not yet finished"
          );
          await mineBlocks(BOGSettings.BOG_BLOCKS_TO_JOIN + 1);
          await expect(
            env.bestOfGame.connect(adr.gameMaster1.wallet).startGame(1)
          ).to.be.emit(env.bestOfGame, "GameStarted");
        });
        it("Game methods beside start are inactive", async () => {
          await expect(
            env.bestOfGame
              .connect(adr.gameMaster1.wallet)
              .submitProposal(
                1,
                ethers.utils.formatBytes32String("mockString"),
                ethers.utils.formatBytes32String("mockString"),
                ""
              )
          ).to.be.revertedWith("Game has not yet started");
          await expect(
            env.bestOfGame
              .connect(adr.gameMaster1.wallet)
              .endTurn(1, ZERO_BYTES32, [])
          ).to.be.revertedWith("Game has not yet started");
          await expect(
            env.bestOfGame
              .connect(adr.gameMaster1.wallet)
              .submitVote(
                1,
                ethers.utils.formatBytes32String("mockString"),
                [
                  ethers.utils.formatBytes32String("mockString"),
                  ethers.utils.formatBytes32String("mockString"),
                  ethers.utils.formatBytes32String("mockString"),
                ],
                ethers.utils.formatBytes32String("mockString")
              )
          ).to.be.revertedWith("Game has not yet started");
        });
        describe("When game was started", () => {
          beforeEach(async () => {
            await mineBlocks(BOGSettings.BOG_BLOCKS_TO_JOIN + 1);
            await env.bestOfGame.connect(adr.gameMaster1.wallet).startGame(1);
          });
          it("First round has started", async () => {
            expect(
              await env.bestOfGame.connect(adr.player1.wallet).getRound(1)
            ).to.be.equal(1);
            expect(
              await env.bestOfGame.connect(adr.player1.wallet).getTurn(1)
            ).to.be.equal(1);
          });
          it("First round only proposals can be submitted", async () => {
            await expect(
              env.bestOfGame
                .connect(adr.gameMaster1.wallet)
                .submitProposal(
                  1,
                  ethers.utils.formatBytes32String("mockString"),
                  ethers.utils.formatBytes32String("mockString"),
                  ""
                )
            ).to.be.emit(env.bestOfGame, "ProposalSubmitted");
            // await expect(
            //   env.bestOfGame.connect(adr.gameMaster1.wallet).endTurn(1, 1, [])
            // ).to.be.revertedWith("Game has not yet started");
            await expect(
              env.bestOfGame
                .connect(adr.gameMaster1.wallet)
                .submitVote(
                  1,
                  ethers.utils.formatBytes32String("mockString"),
                  [
                    ethers.utils.formatBytes32String("mockString"),
                    ethers.utils.formatBytes32String("mockString"),
                    ethers.utils.formatBytes32String("mockString"),
                  ],
                  ethers.utils.formatBytes32String("mockString")
                )
            ).to.be.revertedWith("No proposals exist at round 1");
          });
          it("Processes only proposals only from game master", async () => {
            await expect(
              env.bestOfGame
                .connect(adr.gameMaster1.wallet)
                .submitProposal(
                  1,
                  ethers.utils.formatBytes32String("mockString"),
                  ethers.utils.formatBytes32String("mockString"),
                  ""
                )
            ).to.be.emit(env.bestOfGame, "ProposalSubmitted");
          });
          it.only("Can end turn after all proposals are received", async () => {
            let proposers = [];
            for (let i = 1; i < BOGSettings.BOG_MAX_PLAYERS + 1; i++) {
              let name = `player${i}` as any as keyof AdrSetupResult;
              const { proposerHidden, proof } = await mockProposalSecrets({
                proposer: adr[`${name}`],
                // proposer: adr.player1,
                gm: adr.gameMaster1,
                proposal: `Proposal-${name}-r1-t1`,
                gameId: 1,
                round: 1,
                turn: 1,
                verifierAddress: env.bestOfGame.address,
              });
              await env.bestOfGame
                .connect(adr.gameMaster1.wallet)
                .submitProposal(
                  1,
                  proposerHidden,
                  proof,
                  `Proposal-${name}-r1-t1`
                );
              proposers.push(adr[`${name}`].wallet.address);
            }
            await expect(
              env.bestOfGame
                .connect(adr.gameMaster1.wallet)
                .endTurn(
                  1,
                  getTurnSalt({ gameId: 1, round: 1, turn: 1 }),
                  proposers
                )
            ).to.be.emit(env.bestOfGame, "TurnEnded");
          });
          describe("When all players voted", () => {
            beforeEach(async () => {
              // for (let i = 1; i < BOGSettings.BOG_MAX_PLAYERS + 1; i++) {
              //   let name = `player${i}` as any as keyof AdrSetupResult;
              //   // adr[`${name}`].wallet
              //   const { proposerHidden, proof } = await mockProposalSecrets({
              //     proposer: adr[`${name}`],
              //     gm: adr.gameMaster1,
              //     proposal: "Proposal-p1-r1-t1",
              //     gameId: "1",
              //     round: 1,
              //     turn: 1,
              //     verifierAddress: env.bestOfGame.address,
              //   });
              //   env.bestOfGame
              //     .connect(adr.gameMaster1.wallet)
              //     .submitProposal(
              //       1,
              //       proposerHidden,
              //       proof,
              //       "Proposal-p1-r1-t1"
              //     );
              // }
            });
            it.only("Can end turn", async () => {
              const proposers = [];
              for (let i = 1; i < BOGSettings.BOG_MAX_PLAYERS + 1; i++) {
                let name = `player${i}` as any as keyof AdrSetupResult;
                proposers.push(adr[`${name}`].wallet.address);
              }

              await expect(
                env.bestOfGame
                  .connect(adr.gameMaster1.wallet)
                  .endTurn(
                    1,
                    getTurnSalt({ gameId: 1, round: 1, turn: 1 }),
                    proposers
                  )
              ).to.emit(env.bestOfGame, "TurnEnded");
            });
          });
          it("Can end turn after votes submitted first round", async () => {});
          it("Last movement can only accept votes", async () => {});
          it("Between last and first moves votes can be submitted and proosals - voted", async () => {});
          it("Emits when turn ended", async () => {});
          it("Emits when round is over", async () => {});
          it("Emits only when valid votes are submitted", async () => {});
          it("Emits only when valid proposals are submitted", async () => {});
          it("Score of players is equal to all votes submitted", async () => {});
          it("Rewards winners with rank token at the end of the round", async () => {});
          it("Winner can create next rank game", async () => {});
          describe("When next round starts, previous scores are reset", async () => {});
        });
      });
    });
  });
});
