import cloud = require("wx-server-sdk");
import { normalizeUserProfile, UserProfileInput, UserProfileState } from "../common/roomLogic";

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

type UserProfileAction = "get" | "save";

interface UserProfileRequest extends UserProfileInput {
  action?: UserProfileAction;
}

interface UserProfileDocument extends UserProfileState {
  updatedAt: number;
}

exports.main = async (event: UserProfileRequest) => {
  const db = cloud.database();
  const { OPENID } = cloud.getWXContext();
  const action = event.action ?? "get";

  if (action === "get") {
    const profile = await getProfile(db, OPENID);
    return {
      openid: OPENID,
      profile: profile ?? null
    };
  }

  if (action === "save") {
    const profile = normalizeUserProfile({
      nickName: event.nickName,
      avatarFileId: event.avatarFileId
    });
    await saveProfileWithCollectionRetry(db, OPENID, profile);

    return {
      openid: OPENID,
      profile
    };
  }

  throw new Error("未知用户资料操作");
};

async function getProfile(db: any, openid: string): Promise<UserProfileState | undefined> {
  try {
    const snapshot = await db.collection("users").doc(openid).get();
    if (!snapshot.data) {
      return undefined;
    }

    return normalizeUserProfile(snapshot.data as UserProfileInput);
  } catch (error) {
    if (isMissingProfileRead(error)) {
      return undefined;
    }
    throw error;
  }
}

async function saveProfileWithCollectionRetry(
  db: any,
  openid: string,
  profile: UserProfileState
): Promise<void> {
  try {
    await saveProfile(db, openid, profile);
  } catch (error) {
    if (!isMissingCollection(error)) {
      throw error;
    }

    await createUsersCollection(db);
    await saveProfile(db, openid, profile);
  }
}

async function saveProfile(db: any, openid: string, profile: UserProfileState): Promise<void> {
  await db.collection("users").doc(openid).set({
    data: toUserProfileDocument(profile)
  });
}

function toUserProfileDocument(profile: UserProfileState): UserProfileDocument {
  return {
    nickName: profile.nickName,
    ...(profile.avatarFileId ? { avatarFileId: profile.avatarFileId } : {}),
    updatedAt: Date.now()
  };
}

async function createUsersCollection(db: any): Promise<void> {
  try {
    await db.createCollection("users");
  } catch (error) {
    if (!isCollectionAlreadyExists(error)) {
      throw error;
    }
  }
}

function isMissingProfileRead(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /collection.*not.*exist|document.*not.*exist|not found|不存在|-502005|-502002/i.test(message);
}

function isMissingCollection(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /collection.*not.*exist|不存在|-502005/i.test(message);
}

function isCollectionAlreadyExists(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /collection.*already.*exist|already exists|已存在|-501001/i.test(message);
}
