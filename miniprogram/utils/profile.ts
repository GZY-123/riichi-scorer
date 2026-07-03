export interface UserProfile {
  openid?: string;
  nickName: string;
  avatarFileId?: string;
}

const PROFILE_STORAGE_KEY = "userProfile";
const LEGACY_NICKNAME_KEY = "nickName";

export function readCachedUserProfile(): UserProfile | null {
  const stored = wx.getStorageSync(PROFILE_STORAGE_KEY) as unknown;
  if (isUserProfileLike(stored)) {
    return normalizeProfile(stored);
  }

  const legacyNickName = wx.getStorageSync(LEGACY_NICKNAME_KEY);
  if (typeof legacyNickName === "string" && legacyNickName.trim()) {
    return {
      nickName: legacyNickName.trim()
    };
  }

  return null;
}

export function writeCachedUserProfile(profile: UserProfile): void {
  const normalized = normalizeProfile(profile);
  wx.setStorageSync(PROFILE_STORAGE_KEY, normalized);
  wx.setStorageSync(LEGACY_NICKNAME_KEY, normalized.nickName);
}

export function avatarFallbackText(nickName: string): string {
  return nickName.trim().slice(0, 1) || "麻";
}

function normalizeProfile(profile: UserProfile): UserProfile {
  const normalized: UserProfile = {
    nickName: profile.nickName.trim()
  };

  if (profile.openid?.trim()) {
    normalized.openid = profile.openid.trim();
  }
  if (profile.avatarFileId?.trim()) {
    normalized.avatarFileId = profile.avatarFileId.trim();
  }

  return normalized;
}

function isUserProfileLike(value: unknown): value is UserProfile {
  return (
    typeof value === "object" &&
    value !== null &&
    "nickName" in value &&
    typeof (value as { nickName?: unknown }).nickName === "string" &&
    Boolean((value as { nickName: string }).nickName.trim())
  );
}
