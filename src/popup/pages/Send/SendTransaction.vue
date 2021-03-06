<template>
  <div>
    <app-header
      :subtitle="getHeaderName"
      @refresh="refreshData"
      backRoute="/home"
    />
    <main class="main">
      <div v-if="scene === 1">
        <div
          v-show="message.show"
          class="message"
          :class="[message.type]"
          @click="onMessageClick"
        >
          <span v-if="message.type === 'success'"
            >Transaction Succeed: Click here to see the transaction</span
          >
          <span v-else>{{ message.text }}</span>
        </div>
        <div :class="{ row: !isToken, 'token-row': isToken }">
          <label class="input-label" :class="{ recipient: !isToken }">
            Recipient Address
            <ContactSelect :onSelected="onContactSelect" :value="recipient" />
            <div v-if="recipient && recipient.name" class="recipient-name">
              {{ recipient.name }}
            </div>
          </label>
          <label
            v-if="!isToken"
            class="input-label shard"
            :class="{ disabled: isHRCToken }"
          >
            To Shard
            <select
              class="input-field"
              v-model="toShard"
              :disabled="isHRCToken"
            >
              <option
                v-for="shard in account.shardArray"
                :key="shard.shardID"
                :value="shard.shardID"
              >
                {{ shard.shardID }}
              </option>
            </select>
          </label>
        </div>
        <div
          :class="{ row: !isToken, 'token-row': isToken }"
          class="amount-row"
        >
          <label class="input-label" :class="{ amount: !isToken }">
            Amount
            <input
              class="input-field"
              type="number"
              name="amount"
              ref="amount"
              step="any"
              placeholder="Amount"
              v-model="amount"
              v-on:keyup.enter="checkContactExist"
            />
          </label>
          <label v-if="!isToken" class="input-label token">
            Token
            <select class="input-field" v-model="selectedToken">
              <option
                v-for="(token, index) in tokenList"
                :key="index"
                :value="token"
              >
                {{ token.symbol }}
              </option>
            </select>
          </label>
        </div>
        <div
          class="maximum-label"
          v-show="!loading"
          @click="setMaxBalance"
          v-tooltip.bottom="'Max amount to send excluding network fee'"
        >
          Max:
          {{
            formatBalance(getMaxBalance, selectedToken.decimals) +
              " " +
              selectedToken.symbol
          }}
        </div>
        <div class="row gasfee-row">
          <label class="input-label gas-price">
            Gas Price
            <input
              class="input-field"
              type="number"
              name="gasprice"
              ref="gasprice"
              placeholder="Gas Price"
              v-model="gasPrice"
              step="any"
            />
          </label>
          <label
            class="input-label gas-limit"
            :class="{ error: gasLimit < estimateGasLimit }"
          >
            Gas Limit
            <input
              class="input-field"
              type="number"
              name="gaslimit"
              ref="gaslimit"
              v-model="gasLimit"
              placeholder="Gas Limit"
            />
          </label>
          <label
            class="input-label gas-one"
            :class="{ error: gasLimit < estimateGasLimit }"
          >
            Network Fee
            <input
              class="input-field"
              type="text"
              name="gasfee"
              ref="gasfee"
              readonly
              :value="`${getGasFee} ONE`"
            />
          </label>
        </div>
        <div
          class="estimategas-label"
          v-if="!isHRCToken"
          v-show="!loading"
          @click="setNetworkFee"
          v-tooltip.bottom="
            'Estimate gas fee for this transaction. Click to set the enough gas limit.'
          "
        >
          Estimate Gas Fee:
          {{ estimateGasFee }} ONE
        </div>

        <label class="input-label" :class="{ disabled: isHRCToken }">
          Input Data
          <textarea
            class="input-field input-data"
            type="textarea"
            name="inputdata"
            placeholder="Please enter hexadecimal data (optional)"
            v-model="inputData"
            :disabled="isHRCToken"
          />
        </label>
        <button class="primary flex" @click="checkContactExist">Send</button>
      </div>
      <!-- Approve Transaction Dialog -->
      <div v-else>
        <h3 class="center">Approve Transaction</h3>
        <p class="addressRow">
          From
          <span class="address__name">{{
            compressAddress(getFromAddress)
          }}</span>
          of Shard
          <b>{{ fromShard }}</b>
        </p>
        <div class="transaction column">
          <div class="row">
            <img src="images/harmony-big.png" class="transaction__logo" alt />
            <div class="transaction__meta">
              <div class="transaction__caption">
                Sending
                <b>{{ getString(amount) }}</b>
              </div>
            </div>
          </div>
          <div class="transaction__information">
            To
            <span class="to_recipient_name" v-if="recipient.name">{{
              recipient.name
            }}</span>
            <span v-if="recipient.name">(</span>
            <span class="address__name">{{
              compressAddress(recipient.address)
            }}</span>
            <span v-if="recipient.name">)</span>
            of Shard
            <b>{{ toShard }}</b>
          </div>
        </div>
        <div class="invoice-content">
          <div class="invoice">
            <div class="invoice__row">
              <span>Amount</span>
              <span>{{ getString(amount) }}</span>
            </div>
            <div class="invoice__row">
              <span>Network Fee</span>
              <span>{{ getGasFee }} ONE</span>
            </div>
            <div class="invoice__divider"></div>
            <div class="invoice__row">
              <span>Total</span>
              <span>{{ getString(getTotal) }}</span>
            </div>
          </div>
        </div>

        <div class="ledger-content" v-if="wallet.isLedger">
          <b>{{ ledgerConfirmTxt }}</b>
        </div>
        <div v-if="!wallet.isLedger" class="footer button-group">
          <button class="outline" @click="onBackClick()">Back</button>
          <button class="primary" ref="approve" @click="sendPayment">
            Approve
          </button>
        </div>
        <div v-else class="footer">
          <button
            v-if="ledgerError"
            @click="onBackClick()"
            class="primary flex"
          >
            Retry
          </button>
          <button v-else @click="onBackClick()" class="primary flex">
            Back
          </button>
        </div>
      </div>
      <check-modal
        @accept="showAddContactModal"
        @cancel="() => showConfirmDialog()"
      />
      <modal
        name="modal-contact-add"
        :adaptive="true"
        transition="scale"
        :width="330"
        height="auto"
      >
        <div class="modal-header">Add a contact</div>
        <div class="modal-body">
          <input
            type="text"
            name="name"
            class="modal-input-name"
            v-model="newName"
            ref="addName"
            placeholder="Input the name"
            v-on:keydown.enter="addContact"
          />
          <input
            type="text"
            name="address"
            class="modal-input-address"
            readonly
            v-model="newAddress"
            ref="addAddress"
            placeholder="Input the address"
          />
        </div>
        <div class="modal-footer">
          <div class="secondary" @click="onCloseModal">CLOSE</div>
          <div
            class="primary"
            @click="addContact"
            :class="{ disabled: !newName || !newAddress }"
          >
            ADD
          </div>
        </div>
      </modal>
      <notifications
        group="notify"
        width="250"
        :max="4"
        class="notifiaction-container"
      />
    </main>
  </div>
</template>

<script>
import { mapState, mapGetters } from "vuex";
import BigNumber from "bignumber.js";
import {
  decryptKeyStore,
  transferOne,
  getNetworkLink,
  sendTransction,
  estimateGas,
} from "services/AccountService";
import { sendToken } from "services/Hrc20Service";
import { isValidAddress } from "@harmony-js/utils";
import account from "mixins/account";
import helper from "mixins/helper";
import ContactSelect from "components/ContactSelect";
import CheckModal from "./CheckModal";
import {
  signTransactionWithLedger,
  signHRCTransactionWithLedger,
} from "services/LedgerService";
import {
  LEDGER_CONFIRM_PREPARE,
  LEDGER_CONFIRM_SUCCESS,
  LEDGER_CONFIRM_REJECT,
  LEDGER_LOCKED,
} from "~/types";

import { Unit } from "@harmony-js/utils";
export default {
  name: "send-transaction",
  mixins: [account, helper],
  components: {
    ContactSelect,
    CheckModal,
  },
  props: {
    isToken: {
      type: Boolean,
      default: false,
    },
    token: {
      type: Object,
    },
  },
  data: () => ({
    scene: 1,
    estimateGasLimit: 21000,
    amount: 0,
    fromShard: 0,
    toShard: 0,
    tokenList: [],
    newName: "",
    newAddress: "",
    recipient: null,
    gasPrice: 1,
    gasLimit: 21000,
    inputData: "",
    selectedToken: { symbol: "ONE", decimals: 18, isMainToken: true },
    ledgerError: false,
    message: {
      show: false,
      type: "error",
      text: "",
    },
    ledgerConfirmTxt: LEDGER_CONFIRM_PREPARE,
  }),

  computed: {
    ...mapState({
      wallet: (state) => state.wallets.active,
      loading: (state) => state.loading,
      contacts: (state) => state.settings.contacts,
      dontShowContactsModal: (state) => state.settings.dontShowContactsModal,
    }),
    ...mapGetters(["getPassword"]),
    getFromAddress() {
      return this.wallet.address;
    },
    isHRCToken() {
      return this.selectedToken && !this.selectedToken.isMainToken;
    },
    getGasFee() {
      return parseFloat((this.gasPrice * this.gasLimit) / Math.pow(10, 9));
    },
    getTotal() {
      if (!this.isHRCToken)
        return new BigNumber(this.amount).plus(this.getGasFee).toFixed();
      else return this.amount;
    },
    getOneBalance() {
      return new BigNumber(this.account.balance).toFixed();
    },
    getMaxBalance() {
      let max;
      if (!this.isHRCToken) {
        max = BigNumber.maximum(
          new BigNumber(this.account.balance).minus(this.getGasFee),
          0
        ).toFixed();
      } else {
        max = this.getTokenBalance(this.selectedToken);
      }
      if (max === undefined) return Number(0);
      return max;
    },
    getHeaderName() {
      if (this.isHRCToken) return `Send ${this.selectedToken.symbol} Token`;
      return "Send Payment";
    },
    estimateGasFee() {
      return new Unit.Wei(this.estimateGasLimit).toGwei();
    },
  },

  async mounted() {
    this.fromShard = this.account.shard;
    if (this.wallet.isLedger) await this.refreshData();
    else {
      this.initSelectedToken();
      await this.loadBalance();
    }
  },

  watch: {
    async recipient() {
      if (this.recipient && this.recipient.address)
        await this.calculateEstimateGas();
    },
    async inputData() {
      if (this.recipient && this.recipient.address)
        await this.calculateEstimateGas();
    },

    selectedToken() {
      this.toShard = 0;
      this.setGasLimit();
    },
    amount() {
      if (
        !RegExp(
          `^[0-9]*[.]?[0-9]{0,${this.selectedToken.decimals}}$`,
          "g"
        ).test(this.amount)
      )
        this.amount = this.amount.slice(0, this.amount.length - 1);
    },
  },
  methods: {
    async calculateEstimateGas() {
      this.estimateGasLimit = await estimateGas(
        this.getFromAddress,
        this.recipient.address,
        this.gasLimit,
        this.gasPrice,
        this.amount,
        this.inputData,
        this.fromShard
      );
    },
    onContactSelect(recipient) {
      const address = recipient;
      const findByAddress = _.find(this.contacts, { address });
      let name = "";
      if (findByAddress) name = findByAddress.name;
      this.recipient = { name, address };
    },
    renameIfExist(newName) {
      const findContactbyName = _.find(this.contacts, { name: newName });
      if (!findContactbyName) return newName;
      return this.renameIfExist(newName + " (2)");
    },
    onCloseModal() {
      this.$modal.hide("modal-contact-add");
      this.showConfirmDialog();
    },
    addContact() {
      this.newName = this.renameIfExist(this.newName);
      this.$modal.hide("modal-contact-add");
      this.$store.dispatch("settings/addContact", {
        name: this.newName,
        address: this.newAddress,
      });
      this.showConfirmDialog();
    },
    setNetworkFee(e) {
      e.preventDefault();
      if (!this.estimateGasLimit) return;
      this.gasLimit = this.estimateGasLimit;
    },

    setMaxBalance(e) {
      e.preventDefault();
      this.amount = this.getMaxBalance;
    },
    setGasLimit() {
      if (!this.isHRCToken) this.gasLimit = 21000;
      else this.gasLimit = 250000;
    },
    initSelectedToken() {
      if (!this.isToken) {
        this.tokenList = [
          { symbol: "ONE", decimals: 18, isMainToken: true },
          ...this.tokenArrayOfNetwork,
        ];
        this.selectedToken = this.tokenList[0];
      } else {
        this.selectedToken = this.token;
      }
    },
    getString(amount) {
      return `${amount} ${this.selectedToken.symbol}`;
    },
    onMessageClick() {
      if (this.message.type == "success") window.open(this.message.text);
    },
    async loadBalance() {
      await this.loadOneBalance();
      await this.loadAllTokenBalance();
    },
    onBackClick() {
      this.scene = 1;
      this.ledgerError = false;
      this.ledgerConfirmTxt = LEDGER_CONFIRM_PREPARE;
    },
    initScene() {
      this.scene = 1;
      this.amount = 0;
      this.recipient = null;
      this.toShard = 0;
      this.ledgerError = false;
      this.ledgerConfirmTxt = LEDGER_CONFIRM_PREPARE;
    },
    async processLedgerTransfer() {
      try {
        let signedRes;
        if (this.isHRCToken) {
          signedRes = await signHRCTransactionWithLedger(
            this.address,
            this.recipient.address,
            this.amount,
            this.gasLimit,
            this.gasPrice,
            this.selectedToken.decimals,
            this.selectedToken.address
          );
        } else {
          signedRes = await signTransactionWithLedger(
            this.recipient.address,
            this.fromShard,
            this.toShard,
            this.amount,
            this.gasLimit,
            this.gasPrice,
            this.inputData
          );
        }
        const { result, success } = signedRes;
        if (success) {
          const signedTxn = result;
          this.ledgerConfirmTxt = LEDGER_CONFIRM_SUCCESS;
          this.$notify({
            group: "notify",
            type: "success",
            text: LEDGER_CONFIRM_SUCCESS,
          });
          this.$store.commit("loading", true);
          const sendRes = await sendTransction(signedTxn);
          this.$store.commit("loading", false);

          if (sendRes.result) {
            this.showSuccessMsg(sendRes.mesg);
          } else {
            this.showErrMessage(sendRes.mesg);
          }
          this.initScene();
          this.loadBalance();
        } else {
          this.$store.commit("loading", false);
          this.$notify({
            group: "notify",
            type: "error",
            text: result,
          });
          this.ledgerConfirmTxt = result;
          this.ledgerError = true;
        }
      } catch (err) {
        console.error(err);

        this.$store.commit("loading", false);
        this.initScene();
        this.showErrMessage(err.message);
      }
    },
    async sendPayment() {
      const privateKey = await decryptKeyStore(
        this.getPassword,
        this.wallet.keystore
      );

      this.$store.commit("loading", true);
      try {
        // use the current selected account in the Account window
        let ret;
        if (!this.isHRCToken) {
          ret = await transferOne(
            this.recipient.address,
            this.fromShard,
            this.toShard,
            this.amount,
            privateKey,
            this.gasLimit,
            this.gasPrice,
            this.inputData
          );
        } else {
          //token transfer part
          ret = await sendToken(
            this.address,
            this.recipient.address,
            this.amount,
            privateKey,
            this.gasLimit,
            this.gasPrice,
            this.selectedToken.decimals,
            this.selectedToken.address
          );
        }

        this.$store.commit("loading", false);

        if (ret.result) {
          this.showSuccessMsg(ret.mesg);
        } else {
          this.showErrMessage(ret.mesg);
        }

        this.initScene();
        await this.loadBalance();
      } catch (e) {
        console.error(e);
        this.$store.commit("loading", false);
        this.initScene();
        this.showErrMessage(
          "Something went wrong while trying to send the payment"
        );
      }
    },
    showSuccessMsg(msg) {
      this.message.show = true;
      this.message.type = "success";
      this.message.text = msg;
    },
    showErrMessage(err) {
      this.message.show = true;
      this.message.type = "error";
      this.message.text = err;
    },
    checkContactExist(e) {
      e.preventDefault();
      this.message.show = false;
      if (!isValidAddress(this.recipient.address)) {
        this.showErrMessage("Invalid recipient address");
        return;
      }

      if (!this.selectedToken) {
        this.showErrMessage("Please select token that you want to send");
        return;
      }

      if (this.amount <= 0) {
        this.showErrMessage("Invalid token amount");
        return;
      } else {
        const minAmount = new BigNumber(1)
          .dividedBy(Math.pow(10, this.selectedToken.decimals))
          .toFixed();
        if (new BigNumber(this.amount).isLessThan(new BigNumber(minAmount))) {
          this.showErrMessage(
            `Minimum send amount is ${minAmount} ${this.selectedToken.symbol}`
          );
          return;
        }
      }

      if (!this.isHRCToken) {
        if (
          new BigNumber(this.estimateGasFee).isGreaterThan(
            new BigNumber(this.getGasFee)
          )
        ) {
          this.showErrMessage(
            "The network fee is not enough. It should be bigger then estimate gas fee"
          );
          return;
        }
        if (
          new BigNumber(this.getTotal).isGreaterThan(
            new BigNumber(this.getOneBalance)
          )
        ) {
          this.showErrMessage("Your balance is not enough");
          return;
        }
      } else {
        if (
          new BigNumber(this.getOneBalance).isLessThan(
            new BigNumber(this.getGasFee)
          )
        ) {
          this.showErrMessage("Your ONE balance is not enough");
          return;
        }
        if (
          new BigNumber(this.amount).isGreaterThan(
            new BigNumber(this.getMaxBalance),
            10
          )
        ) {
          this.showErrMessage("Your token balance is not enough");
          return;
        }
      }
      if (!this.dontShowContactsModal && !this.recipient.name) {
        this.$modal.show("modal-check-contact");
        return;
      }
      this.showConfirmDialog();
    },
    showAddContactModal() {
      this.newAddress = this.recipient.address;
      this.$modal.show("modal-contact-add");
    },
    showConfirmDialog() {
      this.amount = new BigNumber(this.amount)
        .decimalPlaces(
          Number(this.selectedToken.decimals),
          BigNumber.ROUND_HALF_DOWN
        )
        .toFixed();
      if (this.wallet.isLedger) {
        this.processLedgerTransfer();
      }
      this.scene = 2;
      if (!this.wallet.isLedger)
        this.$nextTick(() => this.$refs.approve.focus());
    },

    async refreshData() {
      this.message.show = false;
      this.$store.commit("loading", true);
      await this.initSelectedToken();
      await this.loadShardingInfo();
      await this.loadBalance();
      this.$store.commit("loading", false);
    },
  },
};
</script>
<style lang="scss" scoped>
h3 {
  margin-top: 0px;
}
.recipient,
.amount {
  width: 75%;
}
.token,
.shard {
  width: 25%;
}
.gas-price,
.gas-limit {
  width: 32%;
  &.error {
    input {
      border: 1px solid red;
    }
  }
}
.gas-one {
  width: 36%;
  &.error {
    input {
      border: 1px solid red;
    }
  }
}
.input-data {
  height: 100px;
}
.password-content {
  margin-bottom: 10px;
}
.center {
  text-align: center;
}
.ledger-content {
  font-size: 1rem;
  text-align: center;
  font-style: italic;
  margin-top: 20px;
}
.maximum-label {
  color: red;
  cursor: pointer;
  font-size: 12px;
  font-style: italic;
  margin-top: 3px;
  margin-left: 5px;
}
.gray {
  color: #bbb;
}
.amount-row {
  margin-bottom: -13px;
}

.invoice-content {
  margin-top: 1.5rem;
  margin-bottom: 1.5rem;
  font-size: 14px;
}
.recipient-name {
  position: absolute;
  left: 1.25rem;
  z-index: -1;
  color: #1f6bb7;
  font-style: italic;
  word-break: break-all;
  right: 1.25rem;
}
.to_recipient_name {
  font-weight: 700;
  color: black;
}
.token-row {
  display: flex;
  & > label {
    flex: 1;
  }
}
.gasfee-row {
  margin-bottom: -13px;
}
.estimategas-label {
  color: #113df0;
  cursor: pointer;
  font-size: 12px;
  font-style: italic;
  margin-top: 3px;
  margin-left: 5px;
}
</style>
