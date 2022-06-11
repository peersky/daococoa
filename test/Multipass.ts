import { AdrSetupResult, EnvSetupResult, SignerIdentity } from "./utils";
import {
  setupAddresses,
  setupEnvironment,
  // baseFee,
  // CONTRACT_NAME,
  CONTRACT_VERSION,
  // getPlayerNameId,
  getUserRegisterProps,
  signMessage,
} from "./utils";
import { LibMultipass } from "../types/contracts/Multipass";
import { getInterfaceID } from "../scripts/libraries/utils";
import { expect } from "chai";
import { ethers } from "hardhat";
import { string } from "hardhat/internal/core/params/argumentTypes";
import { IMultipass__factory } from "../types/factories/contracts/interfaces/IMultipass__factory";
// import { Multipass__factory } from "../types/factories/contracts/diamond/";
const path = require("path");
const { time, constants } = require("@openzeppelin/test-helpers");
const { BigNumber } = require("ethers");
const {
  ZERO_ADDRESS,
  ZERO_BYTES32,
} = require("@openzeppelin/test-helpers/src/constants");
// import { Multipass } from '../types/contracts/Multipass'

const scriptName = path.basename(__filename, ".js");
const NEW_DOMAIN_NAME1 = "newDomainName1";
const NEW_DOMAIN_NAME2 = "newDomainName2";
const NEW_DOMAIN_NAME3 = "newDomainName3";
const STRING_32B = "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF";
const STRING_33B = "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF";
const STRING_0B = "";
const DEFAULT_FREE_REGISTRATIONS = ethers.BigNumber.from(3);
const DEFAULT_FEE = ethers.utils.parseEther("2");
const DEFAULT_DISCOUNT = ethers.utils.parseEther("1");
const DEFAULT_REWARD = ethers.utils.parseEther("0.5");
// let adr = await setupAddresses();
// let env = setupEnvironment(adr.contractDeployer, adr.multipassOwner);
let adr: AdrSetupResult;

let env: EnvSetupResult;

const emptyUserQuery: LibMultipass.NameQueryStruct = {
  name: ethers.utils.formatBytes32String(""),
  id: ethers.utils.formatBytes32String(""),
  domainName: ethers.utils.formatBytes32String(""),
  wallet: ZERO_ADDRESS,
  targetDomain: ethers.utils.formatBytes32String(""),
};

describe(scriptName, () => {
  beforeEach(async () => {
    adr = await setupAddresses();
    // console.log("dbg:", adr.contractDeployer, adr.multipassOwner);
    env = await setupEnvironment(adr.contractDeployer, adr.multipassOwner);
  });
  it("is Owned by contract owner", async () => {
    expect(await env.multipass.owner()).to.be.equal(
      adr.multipassOwner.wallet.address
    );
  });
  it("Transfer ownership can be done only by contract owner", async () => {
    await expect(
      env.multipass
        .connect(adr.multipassOwner.wallet)
        .transferOwnership(adr.gameCreator1.wallet.address)
    ).to.emit(env.multipass, "OwnershipTransferred(address,address)");

    await expect(
      env.multipass
        .connect(adr.maliciousActor1.wallet)
        .transferOwnership(adr.gameCreator1.wallet.address)
    ).to.revertedWith("LibDiamond: Must be contract owner");
  });
  it("Has zero domains", async () => {
    expect(await env.multipass.getContractState()).to.be.equal(0);
  });
  it("Supports multipass interface", async () => {
    const MultipassInterface = IMultipass__factory.createInterface();
    const multipassInterfaceId = getInterfaceID(MultipassInterface);
    expect(await env.multipass.supportsInterface(multipassInterfaceId._hex)).to
      .be.true;
  });

  it("Emits and increments when new domain initialized", async () => {
    await expect(
      await env.multipass
        .connect(adr.multipassOwner.wallet)
        .initializeDomain(
          adr.registrar1.wallet.address,
          1000,
          ethers.utils.parseEther("3"),
          ethers.utils.formatBytes32String(NEW_DOMAIN_NAME1),
          ethers.utils.parseEther("1"),
          ethers.utils.parseEther("1")
        )
    ).to.emit(env.multipass, "InitializedDomain");
    expect(await env.multipass.getContractState()).to.be.equal(1);
  });
  it("Reverts if intializing domain name props are wrong", async () => {
    await expect(
      env.multipass
        .connect(adr.multipassOwner.wallet)
        .initializeDomain(
          adr.registrar1.wallet.address,
          DEFAULT_FREE_REGISTRATIONS,
          ethers.utils.parseEther("3"),
          ethers.utils.formatBytes32String(NEW_DOMAIN_NAME1),
          ethers.utils.parseEther("1.0001"),
          ethers.utils.parseEther("2")
        )
    ).to.be.revertedWith(
      "Multipass->initializeDomain: referral values are higher then fee itself"
    );
    await expect(
      env.multipass
        .connect(adr.multipassOwner.wallet)
        .initializeDomain(
          constants.ZERO_ADDRESS,
          1000,
          ethers.utils.parseEther("3"),
          ethers.utils.formatBytes32String(NEW_DOMAIN_NAME1),
          ethers.utils.parseEther("1.0001"),
          ethers.utils.parseEther("2")
        )
    ).to.be.revertedWith(
      "Multipass->initializeDomain: You must provide a registrar address"
    );
    await expect(
      env.multipass
        .connect(adr.multipassOwner.wallet)
        .initializeDomain(
          adr.registrar1.wallet.address,
          1000,
          ethers.utils.parseEther("3"),
          ethers.utils.formatBytes32String(""),
          ethers.utils.parseEther("1"),
          ethers.utils.parseEther("2")
        )
    ).to.be.revertedWith(
      "Multipass->initializeDomain: Domain name cannot be empty"
    );

    await expect(
      env.multipass
        .connect(adr.multipassOwner.wallet)
        .initializeDomain(
          adr.registrar1.wallet.address,
          1000,
          ethers.constants.MaxUint256,
          ethers.utils.formatBytes32String(NEW_DOMAIN_NAME1),
          ethers.constants.MaxUint256,
          ethers.utils.parseEther("1")
        )
    ).to.be.revertedWith(
      "Multipass->initializeDomain: referrerReward + referralDiscount cause overflow"
    );
  });
  describe("When a new domain was initialized", () => {
    let numDomains = 0;
    beforeEach(async () => {
      await env.multipass
        .connect(adr.multipassOwner.wallet)
        .initializeDomain(
          adr.registrar1.wallet.address,
          DEFAULT_FREE_REGISTRATIONS,
          DEFAULT_FEE,
          ethers.utils.formatBytes32String(NEW_DOMAIN_NAME1),
          DEFAULT_REWARD,
          DEFAULT_DISCOUNT
        );
      numDomains = 1;
    });
    it("Reverts if domain name already registered", async () => {
      await expect(
        env.multipass
          .connect(adr.multipassOwner.wallet)
          .initializeDomain(
            adr.registrar1.wallet.address,
            DEFAULT_FREE_REGISTRATIONS,
            DEFAULT_FEE,
            ethers.utils.formatBytes32String(NEW_DOMAIN_NAME1),
            DEFAULT_REWARD,
            DEFAULT_DISCOUNT
          )
      ).to.be.revertedWith(
        "Multipass->initializeDomain: Domain name already exists"
      );
    });
    it("Domain name state is equal to initial values and is not active", async () => {
      const resp = await env.multipass.getDomainState(
        ethers.utils.formatBytes32String(NEW_DOMAIN_NAME1)
      );
      // expect(ethers.utils.parseBytes32String(resp)).to.be.equal(
      //   NEW_DOMAIN_NAME1
      // );
      expect(ethers.utils.parseBytes32String(resp["name"])).to.be.equal(
        NEW_DOMAIN_NAME1
      );
      expect(resp["fee"]).to.be.equal(DEFAULT_FEE);
      expect(resp["freeRegistrationsNumber"]).to.be.equal(
        DEFAULT_FREE_REGISTRATIONS
      );
      expect(resp["referrerReward"]).to.be.equal(DEFAULT_REWARD);
      expect(resp["referralDiscount"]).to.be.equal(DEFAULT_DISCOUNT);
      expect(resp["isActive"]).to.be.equal(false);
      expect(resp["registrar"]).to.be.equal(adr.registrar1.wallet.address);
      expect(resp["ttl"]).to.be.equal(0);
      expect(resp["registerSize"].toString()).to.be.equal("0");
    });
    it("Incremented number of domains", async () => {
      expect(await env.multipass.getContractState()).to.be.equal(numDomains);
    });
    it("emits when domain activated", async () => {
      await expect(
        env.multipass
          .connect(adr.multipassOwner.wallet)
          .activateDomain(ethers.utils.formatBytes32String(NEW_DOMAIN_NAME1))
      ).to.emit(env.multipass, "DomainActivated");
    });
    it("Does not allow to register because is not active", async () => {
      let applicantData: LibMultipass.RecordStruct = {
        name: ethers.utils.formatBytes32String(adr.player1.name),
        id: ethers.utils.formatBytes32String(adr.player1.id),
        wallet: adr.player1.wallet.address,
        nonce: 0,
      };
      await expect(
        env.multipass
          .connect(adr.player1.wallet)
          .register(
            applicantData,
            ethers.utils.formatBytes32String(NEW_DOMAIN_NAME1),
            ZERO_BYTES32,
            ZERO_BYTES32,
            emptyUserQuery,
            ZERO_BYTES32
          )
      ).to.be.revertedWith("Multipass->register: domain is not active");
    });
    describe("when domain was set to active", () => {
      beforeEach(async () => {
        await env.multipass
          .connect(adr.multipassOwner.wallet)
          .activateDomain(ethers.utils.formatBytes32String(NEW_DOMAIN_NAME1));
      });
      it("Is set to active", async () => {
        const resp = await env.multipass.getDomainState(
          ethers.utils.formatBytes32String(NEW_DOMAIN_NAME1)
        );
        expect(resp["isActive"]).to.be.true;
      });

      it("Emits on register when properties are valid", async () => {
        const registrarMessage = {
          name: ethers.utils.formatBytes32String(adr.player1.name),
          id: ethers.utils.formatBytes32String(adr.player1.id),
          domainName: ethers.utils.formatBytes32String(NEW_DOMAIN_NAME1),
          deadline: ethers.BigNumber.from(9999),
          nonce: ethers.BigNumber.from(0),
        };

        const registarSignature = await signMessage(
          registrarMessage,
          env.multipass.address,
          adr.registrar1
        );

        let applicantData: LibMultipass.RecordStruct = {
          name: ethers.utils.formatBytes32String(adr.player1.name),
          id: ethers.utils.formatBytes32String(adr.player1.id),
          wallet: adr.player1.wallet.address,
          nonce: 0,
        };

        await expect(
          env.multipass
            .connect(adr.player1.wallet)
            .register(
              applicantData,
              registrarMessage.domainName,
              registarSignature,
              registrarMessage.deadline,
              emptyUserQuery,
              ZERO_BYTES32
            )
        ).to.emit(env.multipass, "Registered");
      });

      it("Reverts on register if properties are invalid", async () => {
        const registrarMessage = {
          name: ethers.utils.formatBytes32String(adr.player1.name),
          id: ethers.utils.formatBytes32String(adr.player1.id),
          domainName: ethers.utils.formatBytes32String(NEW_DOMAIN_NAME1),
          deadline: ethers.BigNumber.from(9999),
          nonce: ethers.BigNumber.from(0),
        };

        const invalidRegistrarSignature = await signMessage(
          registrarMessage,
          env.multipass.address,
          adr.maliciousActor1
        );

        let applicantData: LibMultipass.RecordStruct = {
          name: ethers.utils.formatBytes32String(adr.player1.name),
          id: ethers.utils.formatBytes32String(adr.player1.id),
          wallet: adr.player1.wallet.address,
          nonce: 0,
        };

        await expect(
          env.multipass
            .connect(adr.player1.wallet)
            .register(
              applicantData,
              registrarMessage.domainName,
              invalidRegistrarSignature,
              registrarMessage.deadline,
              emptyUserQuery,
              ZERO_BYTES32
            )
        ).to.be.revertedWith(
          "Multipass->register: Registrar signature is not valid"
        );

        registrarMessage.deadline = ethers.BigNumber.from(
          ethers.provider.blockNumber
        );

        await expect(
          env.multipass
            .connect(adr.player1.wallet)
            .register(
              applicantData,
              registrarMessage.domainName,
              await signMessage(
                registrarMessage,
                env.multipass.address,
                adr.registrar1
              ),
              registrarMessage.deadline,
              emptyUserQuery,
              ZERO_BYTES32
            )
        ).to.be.revertedWith(
          "Multipass->register: Deadline is less than current block number"
        );
      });
      it("allows valid registrations for free until free tier has reached", async () => {
        const size = DEFAULT_FREE_REGISTRATIONS.toNumber();
        const players = [
          adr.player1,
          adr.player2,
          adr.player3,
          adr.player4,
          adr.player5,
        ];
        let i = 0;
        for (i = 0; i < size; i++) {
          const regProps = await getUserRegisterProps(
            players[i],
            adr.registrar1,
            NEW_DOMAIN_NAME1,
            99999,
            env.multipass.address
          );
          await expect(
            env.multipass
              .connect(adr.player1.wallet)
              .register(
                regProps.applicantData,
                regProps.registrarMessage.domainName,
                regProps.validSignature,
                regProps.registrarMessage.deadline,
                emptyUserQuery,
                ZERO_BYTES32
              )
          ).to.emit(env.multipass, "Registered");
        }
        const regProps = await getUserRegisterProps(
          players[i],
          adr.registrar1,
          NEW_DOMAIN_NAME1,
          99999,
          env.multipass.address
        );
        await expect(
          env.multipass
            .connect(adr.player1.wallet)
            .register(
              regProps.applicantData,
              regProps.registrarMessage.domainName,
              regProps.validSignature,
              regProps.registrarMessage.deadline,
              emptyUserQuery,
              ZERO_BYTES32
            )
        ).to.be.revertedWith(
          "Multipass->register: Payment value is not enough"
        );
      });

      describe("When user was registered", () => {
        let numDomains = 0;
        beforeEach(async () => {
          const regProps = await getUserRegisterProps(
            adr.player1,
            adr.registrar1,
            NEW_DOMAIN_NAME1,
            99999,
            env.multipass.address
          );

          await env.multipass
            .connect(adr.player1.wallet)
            .register(
              regProps.applicantData,
              regProps.registrarMessage.domainName,
              regProps.validSignature,
              regProps.registrarMessage.deadline,
              emptyUserQuery,
              ZERO_BYTES32
            );
        });
        it("Can find newly registered user ", async () => {
          //By full query
          let query: LibMultipass.NameQueryStruct = {
            name: ethers.utils.formatBytes32String(adr.player1.name),
            id: ethers.utils.formatBytes32String(adr.player1.id),
            wallet: adr.player1.wallet.address,
            domainName: ethers.utils.formatBytes32String(NEW_DOMAIN_NAME1),
            targetDomain: ethers.utils.formatBytes32String(""),
          };

          let resp = await env.multipass
            .connect(adr.player1.wallet)
            .resolveRecord(query);
          expect(resp[0]).to.be.true;

          //With id and address
          query = {
            name: ethers.utils.formatBytes32String(""),
            id: ethers.utils.formatBytes32String(adr.player1.id),
            wallet: adr.player1.wallet.address,
            domainName: ethers.utils.formatBytes32String(NEW_DOMAIN_NAME1),
            targetDomain: ethers.utils.formatBytes32String(""),
          };

          resp = await env.multipass
            .connect(adr.player1.wallet)
            .resolveRecord(query);
          expect(resp[0]).to.be.true;

          //With only id
          query = {
            name: ethers.utils.formatBytes32String(""),
            id: ethers.utils.formatBytes32String(adr.player1.id),
            wallet: ZERO_ADDRESS,
            domainName: ethers.utils.formatBytes32String(NEW_DOMAIN_NAME1),
            targetDomain: ethers.utils.formatBytes32String(""),
          };

          resp = await env.multipass
            .connect(adr.player1.wallet)
            .resolveRecord(query);
          expect(resp[0]).to.be.true;

          //With only address
          query = {
            name: ethers.utils.formatBytes32String(""),
            id: ethers.utils.formatBytes32String(""),
            wallet: adr.player1.wallet.address,
            domainName: ethers.utils.formatBytes32String(NEW_DOMAIN_NAME1),
            targetDomain: ethers.utils.formatBytes32String(""),
          };

          resp = await env.multipass
            .connect(adr.player1.wallet)
            .resolveRecord(query);
          expect(resp[0]).to.be.true;

          //With only name
          query = {
            name: ethers.utils.formatBytes32String(adr.player1.name),
            id: ethers.utils.formatBytes32String(""),
            wallet: ZERO_ADDRESS,
            domainName: ethers.utils.formatBytes32String(NEW_DOMAIN_NAME1),
            targetDomain: ethers.utils.formatBytes32String(""),
          };

          resp = await env.multipass
            .connect(adr.player1.wallet)
            .resolveRecord(query);
          expect(resp[0]).to.be.true;
        });

        it("Reverts registration if user id already exist", async () => {
          const regProps = await getUserRegisterProps(
            adr.player1,
            adr.registrar1,
            NEW_DOMAIN_NAME1,
            99999,
            env.multipass.address
          );
          await expect(
            env.multipass
              .connect(adr.player1.wallet)
              .register(
                regProps.applicantData,
                regProps.registrarMessage.domainName,
                regProps.validSignature,
                regProps.registrarMessage.deadline,
                emptyUserQuery,
                ZERO_BYTES32
              )
          ).to.be.revertedWith("User already registered, use modify instead");
          regProps.applicantData.id = ethers.utils.formatBytes32String(
            adr.player2.id
          );
          await expect(
            env.multipass
              .connect(adr.player1.wallet)
              .register(
                regProps.applicantData,
                regProps.registrarMessage.domainName,
                regProps.validSignature,
                regProps.registrarMessage.deadline,
                emptyUserQuery,
                ZERO_BYTES32
              )
          ).to.be.revertedWith("User already registered, use modify instead");
          regProps.applicantData.name = ethers.utils.formatBytes32String(
            adr.player2.name
          );
          await expect(
            env.multipass
              .connect(adr.player1.wallet)
              .register(
                regProps.applicantData,
                regProps.registrarMessage.domainName,
                regProps.validSignature,
                regProps.registrarMessage.deadline,
                emptyUserQuery,
                ZERO_BYTES32
              )
          ).to.be.revertedWith("User already registered, use modify instead");
        });
        it("Allows to register with referral code", async () => {
          const registrantProps = await getUserRegisterProps(
            adr.player2,
            adr.registrar1,
            NEW_DOMAIN_NAME1,
            99999,
            env.multipass.address,
            adr.player1
          );
          await expect(
            env.multipass
              .connect(adr.player1.wallet)
              .register(
                registrantProps.applicantData,
                registrantProps.registrarMessage.domainName,
                registrantProps.validSignature,
                registrantProps.registrarMessage.deadline,
                registrantProps.referrerData,
                registrantProps.referrerSignature
              )
          ).to.emit(env.multipass, "Referred");
        });
      });
    });
  });

  // describe("When new record is being made", () => {
  //   beforeEach(() => {});
  //   it("should make new record in DNS", async () => {});
  //   it("should ");
  // });
  // it("Should record Shopyto token address as native payment token", () => {});
  // it("Should record non-Shopyto token tx fee", () => {});
  // it("Should allow to mint and set price", () => {});
  // it("Should emit event on item is minted", () => {});
  // it("Should allow to transfer ownership", () => {});
  // it("Should allow to change base token with current token owners signature", () => {});
  // it("Should allow to change non native payments fee with current native payment token owners signature", () => {});

  // describe("When articules are being minted", () => {
  //   describe("When items with id already minted", () => {
  //     it("Should increase capacity of token id by mint amount", () => {});
  //   });
  //   it("Should mint token if Id does not exist", () => {});
  //   it("Should emit event on item is minted", () => {});
  //   it("Should throw if price is not set", () => {});
  //   it("Should throw if uri is not set", () => {});
  //   it("Should throw if ammount not specified", () => {});
  //   it("Should allow to purchase item", () => {});
  // });
  // describe("When individual item is being purchased", () => {
  //   it("Should thow if item does not exist", () => {});
  //   it("Should throw if amount is over the supply", () => {});
  //   it("Should throw if payment amount is incorrect", () => {});
  //   it("Should deduct supply by amount on success", () => {});
  //   it("Should emit on success", () => {});
  // });
  // describe("When multiple items (shopping cart) is being purchased", () => {
  //   it("Should thow if one of items does not exist", () => {});
  //   it("Should throw if one of items amount is over the supply", () => {});
  //   it("Should throw if payment amount is incorrect", () => {});
  //   it("Should not deduct any supply if transaction fails", () => {});
  //   it("Should deduct supply of each item by amount on success", () => {});

  //   it("Should emit on success", () => {});
  // });

  // it("should not allow to purchase for incorrect price", () => {});
});