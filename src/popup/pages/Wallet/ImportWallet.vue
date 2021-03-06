<template>
  <div>
    <app-header headerTab="create-tab" />
    <main class="main">
      <div class="main-logo" v-if="scene !== 3">
        <img
          src="images/harmony.png"
          alt="Harmony"
          :class="{ 'logo-md': selectType === 'keystore' && scene === 2 }"
        />
      </div>
      <div v-if="scene === 1">
        <div class="type-row">
          <div class="row-label">Select Type</div>
          <select class="input-field type-select" v-model="selectType">
            <option value="key">Private Key</option>
            <option value="mnemonic">Mnemonic</option>
            <option value="keystore">Harmony Keystore (CLI)</option>
          </select>
        </div>
        <div v-if="selectType !== 'keystore'">
          <div v-if="selectType === 'key'">
            <label class="input-label big-label">
              Paste your private Key
              <input
                class="input-field"
                type="password"
                name="priavtekey"
                ref="priavtekey"
                v-model="privateKey"
                placeholder="Input the private key"
                v-on:keyup.enter="importKey"
              />
            </label>
          </div>
          <div v-else>
            <label class="input-label">
              Paste your Mnemonic
              <textarea
                class="input-field"
                name="mnemonic"
                ref="mnemonic"
                v-model="mnemonic"
                placeholder="Input the Mnemonic"
              />
            </label>
          </div>
        </div>
        <div v-else class="file-row">
          <input type="file" class="file-field" @change="onSelectFile" />
        </div>

        <div class="button-group">
          <button
            v-show="wallets.accounts.length > 0"
            class="outline"
            @click="$router.push('/home')"
          >
            Cancel
          </button>
          <button
            class="primary"
            @click="importKey"
            :class="!wallets.accounts.length ? 'flex' : ''"
          >
            Import
          </button>
        </div>
      </div>
      <div v-else-if="scene === 2">
        <label class="input-label">
          Account Name
          <input
            class="input-field"
            type="text"
            name="name"
            ref="name"
            v-model="name"
            placeholder="Input the account name"
            v-on:keyup.enter="importAcc"
          />
        </label>
        <div v-if="selectType === 'keystore'">
          <label class="input-label">
            Enter the keystore file password
            <input
              class="input-field"
              type="password"
              name="keystorepass"
              ref="keystorepass"
              v-model="keystorepass"
              placeholder="Enter the keystore file password"
              v-on:keyup.enter="importAcc"
            />
          </label>
        </div>
        <div class="button-group">
          <button class="outline" @click="() => (scene = 1)">Back</button>
          <button class="primary" @click="importAcc" :disabled="!name">
            Next
          </button>
        </div>
      </div>
      <div v-else>
        <create-password @success="addAcc" :onBack="() => (scene = 2)" />
      </div>
      <notifications
        group="notify"
        width="250"
        :max="2"
        class="notifiaction-container"
      />
    </main>
  </div>
</template>

<script>
import { mapState, mapGetters } from "vuex";
import _ from "lodash";
import {
  encryptKeyStore,
  validatePrivateKey,
  getAddressFromPrivateKey,
  createAccountFromMnemonic,
  decryptKeyStoreFromFile,
  validateMnemonic,
} from "services/AccountService";

export default {
  data: () => ({
    name: "",
    keystorepass: "",
    privateKey: "",
    keyFromFile: "",
    mnemonic: "",
    scene: 1,
    selectType: "key",
    decryptResult: null,
    file: null,
    wallet: null,
  }),
  computed: {
    ...mapState(["wallets"]),
    ...mapGetters(["getPassword"]),
  },

  methods: {
    onSelectFile(event) {
      this.file = event.target.files[0];
    },
    async importKey() {
      if (this.selectType === "key") {
        if (!validatePrivateKey(this.privateKey)) {
          this.$notify({
            group: "notify",
            type: "error",
            text: "Please enter a valid private key",
          });
          return false;
        }
      }
      if (this.selectType === "mnemonic") {
        if (!validateMnemonic(this.mnemonic)) {
          this.$notify({
            group: "notify",
            type: "error",
            text: "Please enter a valid mnemonic",
          });
          return false;
        }
      }
      if (this.selectType === "keystore") {
        if (!this.file) {
          this.$notify({
            group: "notify",
            type: "error",
            text: "Please select a file",
          });
          return false;
        } else {
          const _this = this;
          await new Promise((resolve, reject) => {
            let reader = new window.FileReader();
            reader.onload = function(event) {
              try {
                _this.keyFromFile = JSON.parse(event.target.result);
                resolve();
              } catch (err) {
                _this.$notify({
                  group: "notify",
                  type: "error",
                  text: "Keystore file invalid",
                });
                return false;
              }
            };
            reader.readAsText(this.file);
          });
        }
      }
      this.scene = 2;
      this.$nextTick(() => this.$refs.name.focus());
    },
    async addAcc(password) {
      if (this.selectType === "key") {
        const oneAddr = getAddressFromPrivateKey(this.privateKey);

        const keystore = await encryptKeyStore(password, this.privateKey);
        this.wallet = {
          name: this.name,
          address: oneAddr,
          keystore,
          isLedger: false,
        };
      } else if (this.selectType == "mnemonic") {
        this.wallet = await createAccountFromMnemonic(
          this.name,
          this.mnemonic,
          password
        );
        this.wallet = { ...this.wallet, isLedger: false };
      } else {
        const encryptedKeyStore = await encryptKeyStore(
          password,
          this.decryptResult.privateKey
        );

        this.wallet = {
          name: this.name,
          address: this.decryptResult.address,
          keystore: encryptedKeyStore,
          isLedger: false,
        };
      }
      const acc = _.find(this.wallets.accounts, {
        address: this.wallet.address,
      });
      if (acc) {
        this.$notify({
          group: "notify",
          type: "error",
          text: "Account already exists",
        });
        return false;
      }
      this.$store.commit("wallets/addAccount", this.wallet);
      alert(
        "Your account is imported successfully. To continue, close this tab and use the extension."
      );
      chrome.tabs.getCurrent(function(tab) {
        chrome.tabs.remove(tab.id, function() {});
      });
    },
    async importAcc() {
      if (!this.name) {
        this.$notify({
          group: "notify",
          text: "Account name is required",
        });
        return false;
      }
      if (this.selectType == "keystore") {
        this.decryptResult = await decryptKeyStoreFromFile(
          this.keystorepass,
          this.keyFromFile
        );
        if (!this.decryptResult) {
          this.$notify({
            group: "notify",
            type: "error",
            text: "Keystore password is incorrect or file is invalid",
          });
          return false;
        }
      }
      if (this.getPassword) await this.addAcc(this.getPassword);
      else this.scene = 3;
    },
  },
};
</script>
<style scoped>
.type-row {
  display: flex;
  justify-content: space-between;
}
.row-label {
  width: 35%;
  margin: auto;
  color: black;
  justify-content: center;
}
.type-select {
  width: 65%;
}
.file-field {
  margin-top: 1rem;
  margin-bottom: 1rem;
  width: 300px;
}
.file-row {
  margin-bottom: 10px;
  display: flex;
  justify-content: center;
}
input[type="file"] {
  border: 1px solid #0a93eb;
  border-radius: 3px;
  padding: 0.5rem 1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.big-label {
  font-size: 1rem;
  color: black;
}
</style>
