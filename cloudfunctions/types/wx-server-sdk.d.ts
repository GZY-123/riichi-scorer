declare module "wx-server-sdk" {
  const cloud: {
    DYNAMIC_CURRENT_ENV: unknown;
    init(options?: Record<string, unknown>): void;
    database(): any;
    getWXContext(): {
      OPENID: string;
      APPID?: string;
      UNIONID?: string;
    };
  };

  export = cloud;
}
