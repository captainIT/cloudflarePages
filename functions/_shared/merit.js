const DAILY_LOGIN_MERIT = 1;

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
    lastLoginDate: null,
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
