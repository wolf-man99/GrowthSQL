/**
 * The free-play account: everything running at once.
 *
 * The mission scenarios each isolate one thing, which is what makes them
 * teachable. The sandbox does the opposite on purpose — it hands over an account
 * with a Search campaign, a Performance Max campaign and (for the D2C business) an
 * App campaign all live at the same time, competing for the same money and, in two
 * cases, the same searches.
 *
 * That is the state a real account is in, and it is where the interesting mistakes
 * live. The Performance Max campaign here is not a demonstration of Performance
 * Max; it is sitting next to a Search campaign whose brand traffic it will start
 * taking on day one, and nothing on screen will announce that it has. Finding it
 * means reading the brand keyword's impression share and noticing it fell on a day
 * nothing about the brand keyword changed.
 *
 * The App campaign, likewise, is not there to be admired. It is optimising for
 * install volume against a target somebody copied from a case study, and it is
 * losing money on every customer it produces while reporting the best cost per
 * install in the account.
 */

import { campaign } from '../state';
import type { GState } from '../engine/types';
import { buildD2CStartingAccount } from './d2c-starting';
import { buildB2BStartingAccount } from './b2b-starting';
import { NORTHBOUND_APP } from './app-starting';
import type { VerticalId } from '../verticals';

export function buildSandbox(vertical: VerticalId): GState {
  return vertical === 'b2b' ? buildB2BSandbox() : buildD2CSandbox();
}

function buildD2CSandbox(): GState {
  const state = buildD2CStartingAccount();

  state.campaigns.push(
    campaign({
      id: 'c-pmax',
      name: 'Performance Max — Shoes',
      type: 'pmax',
      dailyBudget: 2200,
      bidStrategy: 'maximise_conversions',
      // Wide open. It will find the brand searches within a day, and it will keep
      // them until somebody notices and excludes them.
      pmaxReach: 1,
    }),
  );

  const app = campaign({
    id: 'c-app',
    name: 'App — Installs',
    type: 'app',
    dailyBudget: 3000,
  });
  app.app = {
    goal: 'installs',
    targetCpi: 40,
    assets: { headlines: 5, descriptions: 4, images: 10, videos: 0 },
    eventName: NORTHBOUND_APP.eventName,
    eventRate: NORTHBOUND_APP.eventRate,
    eventValue: NORTHBOUND_APP.eventValue,
  };
  state.campaigns.push(app);

  return state;
}

function buildB2BSandbox(): GState {
  const state = buildB2BStartingAccount();

  // No App campaign. Ledgerline sells a ₹90,000 annual contract to a finance team
  // through a booked demo; there is no app, and inventing one so the sandbox could
  // show off a third panel would be teaching a business that does not exist.
  state.campaigns.push(
    campaign({
      id: 'c-pmax',
      name: 'Performance Max — Software',
      type: 'pmax',
      dailyBudget: 2600,
      bidStrategy: 'maximise_conversions',
      pmaxReach: 1,
    }),
  );

  return state;
}
