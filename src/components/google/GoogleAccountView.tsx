'use client';

/**
 * A mission and the account it is played in, sharing one clock.
 *
 * The two halves have to agree about what day it is. The brief counts down to a
 * horizon and its grade button unlocks there; the dashboard is what moves the
 * clock. Rendered as siblings under a server component they would not share that
 * number — the panel would keep whatever day the page was built with, tell a
 * learner standing on the last day that they had a fortnight left, and refuse to
 * grade a run that had finished.
 *
 * So the day lives here, in the one client component that contains both.
 */

import { useState } from 'react';
import { GoogleRunDashboard } from './GoogleRunDashboard';
import { GoogleMissionPanel, type MissionBrief } from './GoogleMissionPanel';
import type { GDayResult, GState } from '@/lib/gsim/engine/types';
import type { GMissionGrade } from '@/lib/gsim/missions/types';

export function GoogleAccountView({
  accountId, initialState, initialDays, brand, verticalLabel, breakEven, ceiling,
  conversionName, mission, initialGrade,
}: {
  accountId: string;
  initialState: GState;
  initialDays: GDayResult[];
  brand: string;
  verticalLabel: string;
  breakEven: number;
  ceiling: number;
  conversionName: string;
  /** Null for free play, which has no brief and no horizon. */
  mission: MissionBrief | null;
  initialGrade: GMissionGrade | null;
}) {
  const [day, setDay] = useState(initialState.day);

  return (
    <>
      {mission ? (
        <GoogleMissionPanel
          mission={mission}
          accountId={accountId}
          currentDay={day}
          initialGrade={initialGrade}
        />
      ) : null}

      <GoogleRunDashboard
        accountId={accountId}
        initialState={initialState}
        initialDays={initialDays}
        brand={brand}
        verticalLabel={verticalLabel}
        breakEven={breakEven}
        ceiling={ceiling}
        conversionName={conversionName}
        onDayChange={setDay}
      />
    </>
  );
}
