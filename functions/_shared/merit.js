const DAILY_LOGIN_MERIT = 1;
const DAILY_SHARE_MERIT = 1;

export const MERIT_TYPE = {
  LOGIN: 'login',
  LOGIN_STREAK: 'login_streak',
  SHARE: 'share',
};

export const MERIT_TYPE_LABELS = {
  login: '每日登录',
  login_streak: '连续登录奖励',
  share: '分享好友',
};

const STREAK_BONUSES = {
  3: 2,
  7: 5,
  14: 10,
  30: 30,
};

export function getTodayInChina() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function daysBetween(earlierDate, laterDate) {
  const start = new Date(`${earlierDate}T00:00:00+08:00`).getTime();
  const end = new Date(`${laterDate}T00:00:00+08:00`).getTime();
  return Math.round((end - start) / 86400000);
}

export function createDefaultUser(openid) {
  const now = new Date().toISOString();
  return {
    openid,
    totalMerit: 0,
    loginMerit: 0,
    shareMerit: 0,
    lastLoginDate: null,
    lastShareDate: null,
    consecutiveDays: 0,
    maxConsecutiveDays: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function getStreakBonus(consecutiveDays) {
  return STREAK_BONUSES[consecutiveDays] || 0;
}

export function processDailyLogin(user, today = getTodayInChina()) {
  if (user.lastLoginDate === today) {
    return {
      user,
      isNewLogin: false,
      todayReward: 0,
      dailyMerit: 0,
      streakBonus: 0,
      events: [],
    };
  }

  let consecutiveDays = 1;
  if (user.lastLoginDate) {
    const gap = daysBetween(user.lastLoginDate, today);
    if (gap === 1) {
      consecutiveDays = user.consecutiveDays + 1;
    }
  }

  const dailyMerit = DAILY_LOGIN_MERIT;
  const streakBonus = getStreakBonus(consecutiveDays);
  const todayReward = dailyMerit + streakBonus;
  const now = new Date().toISOString();

  const updatedUser = {
    ...user,
    totalMerit: user.totalMerit + todayReward,
    loginMerit: user.loginMerit + todayReward,
    lastLoginDate: today,
    consecutiveDays,
    maxConsecutiveDays: Math.max(user.maxConsecutiveDays, consecutiveDays),
    updatedAt: now,
  };

  return {
    user: updatedUser,
    isNewLogin: true,
    todayReward,
    dailyMerit,
    streakBonus,
    events: buildLoginMeritEvents(updatedUser, dailyMerit, streakBonus, today),
  };
}

export function buildLoginMeritEvents(user, dailyMerit, streakBonus, today) {
  const now = new Date().toISOString();
  const events = [];

  if (dailyMerit > 0) {
    events.push({
      type: MERIT_TYPE.LOGIN,
      amount: dailyMerit,
      description: MERIT_TYPE_LABELS.login,
      eventDate: today,
      createdAt: now,
    });
  }

  if (streakBonus > 0) {
    events.push({
      type: MERIT_TYPE.LOGIN_STREAK,
      amount: streakBonus,
      description: `连续登录${user.consecutiveDays}天奖励`,
      eventDate: today,
      createdAt: now,
    });
  }

  return events;
}

export function processShareMerit(user, today = getTodayInChina()) {
  if (user.lastShareDate === today) {
    return {
      user,
      isNewShare: false,
      todayReward: 0,
      events: [],
    };
  }

  const todayReward = DAILY_SHARE_MERIT;
  const now = new Date().toISOString();
  const updatedUser = {
    ...user,
    totalMerit: user.totalMerit + todayReward,
    shareMerit: (user.shareMerit || 0) + todayReward,
    lastShareDate: today,
    updatedAt: now,
  };

  return {
    user: updatedUser,
    isNewShare: true,
    todayReward,
    events: [{
      type: MERIT_TYPE.SHARE,
      amount: todayReward,
      description: MERIT_TYPE_LABELS.share,
      eventDate: today,
      createdAt: now,
    }],
  };
}

export function getNextStreakReward(consecutiveDays) {
  const milestones = Object.keys(STREAK_BONUSES)
    .map(Number)
    .sort((a, b) => a - b);

  for (const day of milestones) {
    if (consecutiveDays < day) {
      return { days: day, bonus: STREAK_BONUSES[day] };
    }
  }

  return null;
}
