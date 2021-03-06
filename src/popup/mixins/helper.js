import BigNumber from "bignumber.js";
import apiService from "services/APIService";
import _ from "lodash";
export default {
  computed: {
    isExtendedView() {
      if (window.innerWidth > 370) return true;
      return false;
    },
  },
  methods: {
    openExpandPopup(route) {
      if (!this.isExtendedView) {
        chrome.tabs.create({
          url: `popup.html#${route}`,
        });
      } else {
        this.$router.push(route);
      }
    },
    formatBalance(balance, decimal) {
      return new BigNumber(balance).isEqualTo(0)
        ? 0
        : new BigNumber(balance).toFormat(Math.min(decimal, 36));
    },
    compressAddress(address, leftOffset = 15, RightOffet = 5) {
      return (
        address.substr(0, leftOffset) +
        "..." +
        address.substr(address.length - RightOffet, address.length)
      );
    },
    async checkSession(address) {
      return await new Promise(async (resolve, reject) => {
        const sessions = await apiService.getHostSessions();
        const findbyAddress = _.filter(sessions, {
          account: { address },
        });
        const sites = findbyAddress.map((elem) => elem.host);
        chrome.tabs.query({ active: true, currentWindow: true }, function(
          tabs
        ) {
          const tab = tabs[0];
          const domain = new URL(tab.url).hostname;
          let connected = false;
          if (sites.includes(domain)) connected = true;
          resolve({ sites, domain, connected });
        });
      });
    },
  },
};
