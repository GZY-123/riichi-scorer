import { CLOUD_ENV_ID } from "./env";

App<IAppOption>({
  globalData: {
    openid: "",
    nickName: ""
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error("当前微信基础库不支持云开发");
      return;
    }

    wx.cloud.init({
      env: CLOUD_ENV_ID,
      traceUser: true
    });
  }
});
