import {
  collection,
  doc,
  setDoc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { useTBAStore } from '@/store/tbaStore';
import { getGameConfig } from '@/config/games';
import type { EventConfig } from '@/types/scout';
import type { GameField } from '@/types/game';

// ─── Teams ───────────────────────────────────────────────────────────────────

const TEAMS = [
  254, 1678, 4414, 3310, 1323, 2910, 1619, 5026,
  2056, 148,  3538, 1114, 2767, 1241, 4910, 3015,
  604,  6328, 3360, 2522, 1086, 3476, 5987, 2658,
  2451, 1690, 7461, 2220, 4613, 3255, 1720, 6672,
  2468, 5190, 3314, 1477, 2169, 498,  8033, 5024,
];

// Skill 0-1 by team (higher-profile teams score more)
const SKILL: Record<number, number> = {
  254: 1.0, 1678: 0.95, 4414: 0.9, 2056: 0.88, 148: 0.85,
  604: 0.85, 6328: 0.82, 3310: 0.8, 1323: 0.78, 2910: 0.75,
};
const skill = (t: number) => SKILL[t] ?? 0.4 + (t % 7) * 0.06;

// Demo scout accounts
const SCOUTS = [
  { uid: 'demo-brando',  name: 'Brando'  },
  { uid: 'demo-kyle',    name: 'Kyle'    },
  { uid: 'demo-victor',  name: 'Victor'  },
  { uid: 'demo-jack',    name: 'Jack'    },
  { uid: 'demo-henry',   name: 'Henry'   },
  { uid: 'demo-walshie', name: 'Walshie' },
];

// ─── Seeded RNG ───────────────────────────────────────────────────────────────

let seed = 42;
function rng() { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; }
function rInt(min: number, max: number) { return Math.floor(rng() * (max - min + 1)) + min; }
function rBool(prob: number) { return rng() < prob; }

// ─── Dynamic match data from game config ─────────────────────────────────────

function matchData(teamNum: number, matchNum: number, fields: GameField[]) {
  const s = skill(teamNum);
  const isOutlier = teamNum === 1678 && matchNum === 22;
  const mult = isOutlier ? 1.8 : 1;
  const data: Record<string, unknown> = {};

  for (const f of fields) {
    switch (f.type) {
      case 'counter':
        data[f.id] = rInt(0, Math.max(1, Math.round(3 * s * mult)));
        break;
      case 'toggle':
        data[f.id] = rBool(0.5 + s * 0.35);
        break;
      case 'select':
        if (f.options?.length) {
          // Weight toward better options for skilled teams (first option assumed best)
          const idx = s > 0.8 ? 0 : s > 0.6 ? Math.min(1, f.options.length - 1) : rInt(0, f.options.length - 1);
          data[f.id] = f.options[idx];
        }
        break;
      case 'rating':
        data[f.id] = rInt(Math.round(1 + s * 2), 5);
        break;
      case 'timer':
        data[f.id] = rInt(0, Math.round(15 * s));
        break;
      case 'path':
        data[f.id] = [];
        break;
      case 'text':
      case 'textarea':
        data[f.id] = '';
        break;
    }
  }
  return data;
}

// ─── Qual schedule (50 matches, 6 robots each) ───────────────────────────────

function buildSchedule(): { matchNumber: number; red: number[]; blue: number[] }[] {
  const pool = [...TEAMS, ...TEAMS, ...TEAMS, ...TEAMS, ...TEAMS, ...TEAMS, ...TEAMS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const matches = [];
  for (let m = 0; m < 50; m++) {
    const offset = m * 6;
    const six = pool.slice(offset % pool.length, offset % pool.length + 6);
    while (six.length < 6) six.push(TEAMS[six.length % TEAMS.length]);
    matches.push({ matchNumber: m + 1, red: six.slice(0, 3), blue: six.slice(3, 6) });
  }
  return matches;
}

// ─── Main seeder ─────────────────────────────────────────────────────────────

const COMPLETED_MATCHES = 25;
const MATCH_INTERVAL = 8 * 60;

export async function seedDemoEvent(year: number, index: number): Promise<EventConfig> {
  seed = 42; // reset for determinism

  const EVENT_ID = `demo-${year}-${index}`;
  const NOW_UNIX = Math.floor(Date.now() / 1000);
  const game = getGameConfig(year);
  const allFields = [...game.match.auto, ...game.match.teleop, ...game.match.endgame];

  // ── Event document ──────────────────────────────────────────────────────────
  const label = index === 1 ? '' : ` #${index}`;
  const eventConfig: EventConfig = {
    id: EVENT_ID,
    name: `${year} Nutty Champs Demo${label}`,
    year,
    eventKey: EVENT_ID,
    pitLayout: {
      rows: 5,
      cols: 8,
      rowLabels: ['A', 'B', 'C', 'D', 'E'],
      colLabels: ['1', '2', '3', '4', '5', '6', '7', '8'],
    },
    teamAssignments: Object.fromEntries(
      TEAMS.map((t, i) => [`${Math.floor(i / 8)}-${i % 8}`, t])
    ),
    activeGameYear: year,
  };

  await setDoc(doc(db, 'events', EVENT_ID), eventConfig);

  const schedule = buildSchedule();

  // ── Pit entries ─────────────────────────────────────────────────────────────
  const pitBatch = writeBatch(db);
  TEAMS.forEach((team, i) => {
    const row = Math.floor(i / 8);
    let status: 'unclaimed' | 'dibbed' | 'scouted' = 'unclaimed';
    let dibbedBy: string | undefined;
    let dibbedByName: string | undefined;
    let scoutedBy: string | undefined;

    if (row < 4) {
      status = 'scouted'; scoutedBy = SCOUTS[i % 6].uid;
    } else {
      const col = i % 8;
      if (col < 6)      { status = 'scouted'; scoutedBy = SCOUTS[col % 6].uid; }
      else if (col === 6) { status = 'dibbed'; dibbedBy = SCOUTS[2].uid; dibbedByName = SCOUTS[2].name; }
    }

    pitBatch.set(doc(db, 'events', EVENT_ID, 'pits', String(team)), {
      teamNumber: team, row, col: i % 8, status,
      ...(dibbedBy   ? { dibbedBy, dibbedByName, dibbedAt: Timestamp.now() } : {}),
      ...(scoutedBy  ? { scoutedBy, scoutedAt: Timestamp.now() }             : {}),
      createdAt: Timestamp.now(),
    });
  });
  await pitBatch.commit();

  // ── Match entries ────────────────────────────────────────────────────────────
  const completedMatches = schedule.slice(0, COMPLETED_MATCHES);
  let batch = writeBatch(db);
  let batchCount = 0;

  for (const match of completedMatches) {
    const matchTime = NOW_UNIX - (COMPLETED_MATCHES - match.matchNumber + 1) * MATCH_INTERVAL;
    const skipSlot = match.matchNumber === 20 ? 'red3' : null;

    const slots = [
      { alliance: 'red'  as const, position: 1 as const, team: match.red[0],  scout: SCOUTS[0] },
      { alliance: 'red'  as const, position: 2 as const, team: match.red[1],  scout: SCOUTS[1] },
      { alliance: 'red'  as const, position: 3 as const, team: match.red[2],  scout: SCOUTS[2] },
      { alliance: 'blue' as const, position: 1 as const, team: match.blue[0], scout: SCOUTS[3] },
      { alliance: 'blue' as const, position: 2 as const, team: match.blue[1], scout: SCOUTS[4] },
      { alliance: 'blue' as const, position: 3 as const, team: match.blue[2], scout: SCOUTS[5] },
    ];

    for (const slot of slots) {
      if (`${slot.alliance}${slot.position}` === skipSlot) continue;
      const ref = doc(collection(db, 'events', EVENT_ID, 'matches'));
      batch.set(ref, {
        teamNumber: slot.team, matchNumber: match.matchNumber, matchType: 'qm',
        alliance: slot.alliance, alliancePosition: slot.position,
        scoutedBy: slot.scout.uid, scoutedByName: slot.scout.name,
        eventKey: EVENT_ID, year,
        timestamp: Timestamp.fromMillis(matchTime * 1000 + rInt(0, 120) * 1000),
        data: matchData(slot.team, match.matchNumber, allFields),
        flags: {}, notes: '',
      });
      if (++batchCount >= 400) { await batch.commit(); batch = writeBatch(db); batchCount = 0; }
    }
  }
  if (batchCount > 0) await batch.commit();

  // ── Station assignments ──────────────────────────────────────────────────────
  await setDoc(doc(db, 'events', EVENT_ID, 'meta', 'assignments'), {
    red1:  { uid: SCOUTS[0].uid, name: SCOUTS[0].name },
    red2:  { uid: SCOUTS[1].uid, name: SCOUTS[1].name },
    red3:  { uid: SCOUTS[2].uid, name: SCOUTS[2].name },
    blue1: { uid: SCOUTS[3].uid, name: SCOUTS[3].name },
    blue2: { uid: SCOUTS[4].uid, name: SCOUTS[4].name },
    blue3: { uid: SCOUTS[5].uid, name: SCOUTS[5].name },
  });

  // ── TBA store ────────────────────────────────────────────────────────────────
  useTBAStore.getState().setTBAData(
    {
      key: EVENT_ID, name: eventConfig.name, short_name: 'Nutty Champs',
      event_code: 'demo', year,
      start_date: `${year}-09-12`, end_date: `${year}-09-14`,
      location_name: 'Demo Arena', city: 'San Jose', state_prov: 'CA', country: 'USA',
    },
    TEAMS.map((t) => ({
      key: `frc${t}`, team_number: t,
      nickname: `Team ${t}`, name: `FRC Team ${t}`,
      city: null, state_prov: null,
    })),
    schedule.map((m) => {
      const matchTime = NOW_UNIX - (COMPLETED_MATCHES - m.matchNumber + 1) * MATCH_INTERVAL;
      const played = m.matchNumber <= COMPLETED_MATCHES;
      return {
        key: `${EVENT_ID}_qm${m.matchNumber}`,
        comp_level: 'qm' as const, set_number: 1, match_number: m.matchNumber,
        alliances: {
          red:  { team_keys: m.red.map((t)  => `frc${t}`), score: -1, dq_team_keys: [], surrogate_team_keys: [] },
          blue: { team_keys: m.blue.map((t) => `frc${t}`), score: -1, dq_team_keys: [], surrogate_team_keys: [] },
        },
        time: matchTime, predicted_time: matchTime,
        actual_time: played ? matchTime : null,
        post_result_time: played ? matchTime + 60 : null,
      };
    })
  );

  return eventConfig;
}
