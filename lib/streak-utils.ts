export type DailyStreakInput = {
  current_count?: number | null;
  current_start?: string | null;
  longest_count?: number | null;
  banked_days?: number | null;
  bank_cap?: number | null;
  last_activity_at?: string | null;
};

export function getBankCap(isGold: boolean) {
  return isGold ? 5 : 3;
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function calculateDailyPostStreakState(
  existingStreak: DailyStreakInput | null | undefined,
  publishedAt: string,
  options: { isGold?: boolean } = {}
) {
  const publishedDate = new Date(publishedAt);
  const today = startOfUtcDay(publishedDate);
  const bankCap = getBankCap(Boolean(options.isGold));

  if (!existingStreak || !existingStreak.last_activity_at) {
    return {
      current_count: 1,
      current_start: publishedDate.toISOString(),
      longest_count: 1,
      banked_days: 0,
      bank_cap: bankCap,
      last_activity_at: publishedDate.toISOString(),
      status: 'active'
    };
  }

  const lastActivity = startOfUtcDay(new Date(existingStreak.last_activity_at));
  let nextCount = 1;
  let bankedDays = Number(existingStreak.banked_days ?? 0);
  let currentStart = existingStreak.current_start || publishedDate.toISOString();

  const daysSince = Math.floor((today.getTime() - lastActivity.getTime()) / 86400000);

  if (daysSince === 0) {
    nextCount = Number(existingStreak.current_count ?? 1);
    currentStart = existingStreak.current_start || publishedDate.toISOString();
  } else if (daysSince === 1) {
    nextCount = Number(existingStreak.current_count ?? 0) + 1;
  } else if (daysSince === 2 && bankedDays > 0) {
    nextCount = Number(existingStreak.current_count ?? 0) + 1;
    bankedDays = Math.max(0, bankedDays - 1);
  } else {
    nextCount = 1;
    currentStart = publishedDate.toISOString();
  }

  const nextLongest = Math.max(Number(existingStreak.longest_count ?? 0), nextCount);
  if (nextCount > 0 && nextCount % 7 === 0) {
    bankedDays = Math.min(bankCap, bankedDays + 1);
  }

  return {
    current_count: nextCount,
    current_start: currentStart,
    longest_count: nextLongest,
    banked_days: bankedDays,
    bank_cap: bankCap,
    last_activity_at: publishedDate.toISOString(),
    status: 'active'
  };
}
